import { useEffect, useMemo, useRef, useState } from "react";

const minYear = 1950;
const maxYear = 2026;
const defaultYear = 2000;

type TimeGuessInputProps = {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
};

export function TimeGuessInput({ value, disabled = false, onChange }: TimeGuessInputProps) {
  const selectedYear = parseYear(value) ?? defaultYear;
  const [isOpen, setIsOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const years = useMemo(
    () => Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index),
    [],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const selectedItem = scrollRef.current?.querySelector<HTMLElement>(
      `[data-year="${selectedYear}"]`,
    );

    selectedItem?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
  }, [isOpen, selectedYear]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  function pickYear(year: number) {
    onChange(String(year));
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

      <button
        className="year-wheel-trigger"
        disabled={disabled}
        id="time-guess"
        type="button"
        onClick={() => setIsOpen(true)}
      >
        <span>{minYear}</span>
        <strong>{selectedYear}</strong>
        <span>{maxYear}</span>
      </button>

      {isOpen ? (
        <div className="year-wheel-overlay" role="dialog" aria-modal="true">
          <div className="year-wheel-topbar">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2>{selectedYear}</h2>
            </div>
            <button className="secondary-action" type="button" onClick={() => setIsOpen(false)}>
              Done
            </button>
          </div>

          <div className="year-wheel-boundaries" aria-hidden="true">
            <span>{minYear}</span>
            <span>{maxYear}</span>
          </div>

          <div
            className="year-wheel-scroll"
            ref={scrollRef}
            onScroll={syncYearFromScroll}
          >
            {years.map((year) => (
              <button
                className={year === selectedYear ? "year-wheel-item is-selected" : "year-wheel-item"}
                data-year={year}
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
      ) : null}
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
