import { useState } from "react";
import type { CSSProperties } from "react";
import type { EventRound, GameSettings } from "../game/gameTypes";
import { InteractiveWorldCupBall } from "./InteractiveWorldCupBall";

type StartScreenProps = {
  dataError?: string | null;
  defaultSettings: GameSettings;
  isDataLoading?: boolean;
  maxRounds: number;
  rounds: EventRound[];
  onHostMultiplayer: (settings: GameSettings) => void;
  onStart: (settings: GameSettings) => void;
};

const timerOptions = [60, 90, 120];
const minWorldCupYear = 1930;
const maxWorldCupYear = 2022;
const triondaModelUrl =
  import.meta.env.VITE_TRIONDA_MODEL_URL ||
  "/models/trionda/source/Trionda%202026.glb";

export function StartScreen({
  dataError,
  defaultSettings,
  isDataLoading = false,
  maxRounds,
  rounds,
  onHostMultiplayer,
  onStart,
}: StartScreenProps) {
  const category = defaultSettings.category;
  const [roundCount, setRoundCount] = useState(defaultSettings.roundCount);
  const [roundDurationSeconds, setRoundDurationSeconds] = useState(
    defaultSettings.roundDurationSeconds,
  );
  const [startYear, setStartYear] = useState(defaultSettings.startYear);
  const [endYear, setEndYear] = useState(defaultSettings.endYear);
  const [hasTouchedBall, setHasTouchedBall] = useState(false);

  const selectedYearRange = clampYearRange(startYear, endYear);
  const filteredMaxRounds = getRoundCountForRange(
    rounds,
    selectedYearRange.startYear,
    selectedYearRange.endYear,
  );
  const canUseSettings = !isDataLoading && !dataError && maxRounds > 0;
  const canStart = canUseSettings && filteredMaxRounds > 0;
  const selectedRoundCount = clampRoundCount(roundCount, filteredMaxRounds || maxRounds);
  const settings = {
    category,
    endYear: selectedYearRange.endYear,
    roundCount: selectedRoundCount,
    roundDurationSeconds,
    startYear: selectedYearRange.startYear,
  };
  const yearRangeStyle = {
    "--range-end": `${getYearRangePercent(selectedYearRange.endYear)}%`,
    "--range-start": `${getYearRangePercent(selectedYearRange.startYear)}%`,
  } as CSSProperties;

  return (
    <section className="start-screen">
      <div className={hasTouchedBall ? "start-copy is-behind-ball" : "start-copy"}>
        <p className="eyebrow">What worldcup?</p>
        <h1>Guess the match. Find the stadium.</h1>
        <p>
          Drop into World Cup scenes, place the stadium, and scroll the timeline
          to the tournament year.
        </p>
      </div>

      <InteractiveWorldCupBall
        modelUrl={triondaModelUrl}
        onFirstTouch={() => setHasTouchedBall(true)}
      />

      <form
        className="setup-panel start-panel"
        onSubmit={(event) => {
          event.preventDefault();
          onStart(settings);
        }}
      >
        <button className="primary-action" type="submit" disabled={!canStart}>
          {isDataLoading ? "Loading match data" : "Let's Play"}
        </button>

        <button
          className="secondary-action"
          type="button"
          disabled={!canStart}
          onClick={() => {
            onHostMultiplayer(settings);
          }}
        >
          Host game
        </button>

        <details className="start-settings">
          <summary>Settings</summary>
          {/*
          <div className="field-group">
            <label htmlFor="category">Edition</label>
            <select
              id="category"
              value={category}
              onChange={(event) => setCategory(event.target.value as EventCategory)}
            >
              {availableModules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.label}
                </option>
              ))}
            </select>
            {selectedModule ? <span>{selectedModule.description}</span> : null}
          </div>
          */}

          <div className="field-grid">
            <div className="field-group">
              <label htmlFor="rounds">Matches</label>
              <input
                id="rounds"
                max={filteredMaxRounds || maxRounds}
                min={1}
                type="number"
                disabled={!canUseSettings}
                value={roundCount}
                onChange={(event) => {
                  setRoundCount(clampRoundCount(event.target.value, maxRounds));
                }}
              />
            </div>

            <div className="field-group">
              <label htmlFor="timer">Clock</label>
              <select
                id="timer"
                value={roundDurationSeconds}
                disabled={!canUseSettings}
                onChange={(event) => setRoundDurationSeconds(Number(event.target.value))}
              >
                {timerOptions.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} seconds
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="year-range-control">
            <div className="year-range-header">
              <span>World Cups</span>
              <output>
                {selectedYearRange.startYear} - {selectedYearRange.endYear}
              </output>
            </div>

            <div className="dual-year-range" style={yearRangeStyle}>
              <div className="dual-year-range-track" aria-hidden="true">
                <span></span>
              </div>
              <input
                aria-label="From World Cup"
                className="dual-year-range-input dual-year-range-input-start"
                id="start-year"
                max={maxWorldCupYear}
                min={minWorldCupYear}
                step={4}
                type="range"
                disabled={!canUseSettings}
                value={selectedYearRange.startYear}
                onChange={(event) => {
                  const nextStartYear = clampYear(event.target.value);

                  setStartYear(nextStartYear);
                  if (nextStartYear > selectedYearRange.endYear) {
                    setEndYear(nextStartYear);
                  }
                }}
              />
              <input
                aria-label="To World Cup"
                className="dual-year-range-input dual-year-range-input-end"
                id="end-year"
                max={maxWorldCupYear}
                min={minWorldCupYear}
                step={4}
                type="range"
                disabled={!canUseSettings}
                value={selectedYearRange.endYear}
                onChange={(event) => {
                  const nextEndYear = clampYear(event.target.value);

                  setEndYear(nextEndYear);
                  if (nextEndYear < selectedYearRange.startYear) {
                    setStartYear(nextEndYear);
                  }
                }}
              />
            </div>

            <div className="year-range-scale" aria-hidden="true">
              <span>{minWorldCupYear}</span>
              <span>{maxWorldCupYear}</span>
            </div>
          </div>

          <span className="range-match-count">
            {filteredMaxRounds} matches in selected range
          </span>
        </details>

        {isDataLoading || dataError ? (
          <div className="start-data-state" aria-live="polite">
            {isDataLoading ? <span>Loading match data...</span> : null}
            {dataError ? <span role="alert">{dataError}</span> : null}
          </div>
        ) : null}
      </form>
    </section>
  );
}

function clampYear(value: number | string) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return minWorldCupYear;
  }

  return Math.max(minWorldCupYear, Math.min(maxWorldCupYear, Math.trunc(numericValue)));
}

function clampYearRange(startYear: number, endYear: number) {
  const safeStartYear = clampYear(startYear);
  const safeEndYear = clampYear(endYear);

  return {
    endYear: Math.max(safeStartYear, safeEndYear),
    startYear: Math.min(safeStartYear, safeEndYear),
  };
}

function getYearRangePercent(year: number) {
  return ((clampYear(year) - minWorldCupYear) / (maxWorldCupYear - minWorldCupYear)) * 100;
}

function getRoundCountForRange(rounds: EventRound[], startYear: number, endYear: number) {
  return rounds.filter((round) => {
    const year = Number(round.answer.occurredAt.slice(0, 4));

    return Number.isFinite(year) && year >= startYear && year <= endYear && round.media.panoramas?.length;
  }).length;
}

function clampRoundCount(value: number | string, maxRounds: number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 1;
  }

  return Math.max(1, Math.min(maxRounds || 1, Math.trunc(numericValue)));
}
