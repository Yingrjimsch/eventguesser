import { useEffect, useMemo, useRef } from "react";
import type { PointerEvent } from "react";

const minYear = 1930;
const maxYear = 2022;
const defaultYear = 1994;

type TimeGuessInputProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function TimeGuessInput({ value, disabled = false, onChange }: TimeGuessInputProps) {
  const selectedYear = parseYear(value) ?? defaultYear;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const dragRef = useRef({
    isDragging: false,
    moved: false,
    pointerId: 0,
    scrollLeft: 0,
    x: 0,
  });
  const suppressClickRef = useRef(false);
  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index),
    [],
  );

  useEffect(() => {
    const selectedItem = scrollRef.current?.querySelector<HTMLElement>(
      `[data-year="${selectedYear}"]`,
    );

    selectedItem?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
  }, [selectedYear]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  function pickYear(year: number) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    onChange(String(year));

    scrollRef.current?.querySelector<HTMLElement>(`[data-year="${year}"]`)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.pointerType === "touch") {
      return;
    }

    const scrollElement = scrollRef.current;

    if (!scrollElement) {
      return;
    }

    dragRef.current = {
      isDragging: true,
      moved: false,
      pointerId: event.pointerId,
      scrollLeft: scrollElement.scrollLeft,
      x: event.clientX,
    };
    scrollElement.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const scrollElement = scrollRef.current;

    if (!drag.isDragging || !scrollElement || event.pointerId !== drag.pointerId) {
      return;
    }

    const delta = event.clientX - drag.x;

    if (Math.abs(delta) > 4) {
      drag.moved = true;
      suppressClickRef.current = true;
    }

    scrollElement.scrollLeft = drag.scrollLeft - delta;
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const scrollElement = scrollRef.current;

    if (!drag.isDragging || event.pointerId !== drag.pointerId) {
      return;
    }

    drag.isDragging = false;

    if (scrollElement?.hasPointerCapture(event.pointerId)) {
      scrollElement.releasePointerCapture(event.pointerId);
    }

    if (drag.moved) {
      syncYearFromScroll();
    }
  }

  function syncYearFromScroll() {
    const scrollElement = scrollRef.current;

    if (!scrollElement) {
      return;
    }

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = window.requestAnimationFrame(() => {
      const center = scrollElement.getBoundingClientRect().left + scrollElement.clientWidth / 2;
      const items = Array.from(
        scrollElement.querySelectorAll<HTMLElement>("[data-year]"),
      );
      const closestItem = items.reduce<HTMLElement | null>((closest, item) => {
        if (!closest) {
          return item;
        }

        const itemCenter = item.getBoundingClientRect().left + item.clientWidth / 2;
        const closestCenter =
          closest.getBoundingClientRect().left + closest.clientWidth / 2;

        return Math.abs(itemCenter - center) < Math.abs(closestCenter - center)
          ? item
          : closest;
      }, null);
      const year = closestItem?.dataset.year;

      if (year && year !== String(selectedYear)) {
        onChange(year);
      }
    });
  }

  return (
    <div className="year-guess-control">
      <div className="year-guess-header">
        <label htmlFor="time-guess">When?</label>
        <output htmlFor="time-guess">{selectedYear}</output>
      </div>

      <div className="year-wheel-frame">
        <div className="year-wheel-boundaries" aria-hidden="true">
          <span>{minYear}</span>
          <span>{maxYear}</span>
        </div>

        <div
          className="year-wheel-scroll"
          id="time-guess"
          ref={scrollRef}
          onScroll={disabled ? undefined : syncYearFromScroll}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
          aria-label="Guess year"
        >
          {years.map((year) => (
            <button
              className={year === selectedYear ? "year-wheel-item is-selected" : "year-wheel-item"}
              data-year={year}
              disabled={disabled}
              key={year}
              type="button"
              onClick={() => pickYear(year)}
            >
              {year}
            </button>
          ))}
        </div>

        <div className="year-wheel-indicator" aria-hidden="true" />
      </div>
    </div>
  );
}

function parseYear(value: string) {
  const match = value.match(/^\d{4}/);

  if (!match) {
    return null;
  }

  const year = Number(match[0]);

  if (!Number.isFinite(year)) {
    return null;
  }

  return Math.max(minYear, Math.min(maxYear, year));
}
