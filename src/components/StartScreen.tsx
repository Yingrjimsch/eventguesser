import { useState } from "react";
import type { GameSettings } from "../game/gameTypes";
import { InteractiveWorldCupBall } from "./InteractiveWorldCupBall";

type StartScreenProps = {
  dataError?: string | null;
  defaultSettings: GameSettings;
  isDataLoading?: boolean;
  maxRounds: number;
  onHostMultiplayer: (settings: GameSettings) => void;
  onStart: (settings: GameSettings) => void;
};

const timerOptions = [60, 90, 120];
const triondaModelUrl =
  import.meta.env.VITE_TRIONDA_MODEL_URL ||
  "/models/trionda/source/Trionda%202026.glb";

export function StartScreen({
  dataError,
  defaultSettings,
  isDataLoading = false,
  maxRounds,
  onHostMultiplayer,
  onStart,
}: StartScreenProps) {
  const category = defaultSettings.category;
  const [roundCount, setRoundCount] = useState(defaultSettings.roundCount);
  const [roundDurationSeconds, setRoundDurationSeconds] = useState(
    defaultSettings.roundDurationSeconds,
  );
  const [hasTouchedBall, setHasTouchedBall] = useState(false);

  const canStart = !isDataLoading && !dataError && maxRounds > 0;
  const selectedRoundCount = clampRoundCount(roundCount, maxRounds);

  return (
    <section className="start-screen">
      <div className={hasTouchedBall ? "start-copy is-behind-ball" : "start-copy"}>
        <p className="eyebrow">Which Worldcup?</p>
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
          onStart({
            category,
            roundCount: selectedRoundCount,
            roundDurationSeconds,
          });
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
            onHostMultiplayer({
              category,
              roundCount: selectedRoundCount,
              roundDurationSeconds,
            });
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
                max={maxRounds}
                min={1}
                type="number"
                disabled={!canStart}
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

function clampRoundCount(value: number | string, maxRounds: number) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 1;
  }

  return Math.max(1, Math.min(maxRounds || 1, Math.trunc(numericValue)));
}
