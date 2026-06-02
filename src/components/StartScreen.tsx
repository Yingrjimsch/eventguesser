import { useState } from "react";
import type { EventCategory, GameModule, GameSettings } from "../game/gameTypes";

type StartScreenProps = {
  availableModules: GameModule[];
  defaultSettings: GameSettings;
  maxRounds: number;
  onStart: (settings: GameSettings) => void;
};

const timerOptions = [60, 90, 120];

export function StartScreen({
  availableModules,
  defaultSettings,
  maxRounds,
  onStart,
}: StartScreenProps) {
  const [category, setCategory] = useState<EventCategory>(defaultSettings.category);
  const [roundCount, setRoundCount] = useState(defaultSettings.roundCount);
  const [roundDurationSeconds, setRoundDurationSeconds] = useState(
    defaultSettings.roundDurationSeconds,
  );

  const selectedModule = availableModules.find((module) => module.id === category);

  return (
    <section className="start-screen">
      <div className="start-copy">
        <p className="eyebrow">EventGuessr</p>
        <h1>Guess the place. Guess the date.</h1>
        <p>
          Explore event scenes, place your guess, and score by getting close in
          both location and time.
        </p>
      </div>

      <form
        className="setup-panel"
        onSubmit={(event) => {
          event.preventDefault();
          onStart({
            category,
            roundCount,
            roundDurationSeconds,
          });
        }}
      >
        <div className="field-group">
          <label htmlFor="category">Category</label>
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

        <div className="field-grid">
          <div className="field-group">
            <label htmlFor="rounds">Rounds</label>
            <input
              id="rounds"
              max={maxRounds}
              min={1}
              type="number"
              value={roundCount}
              onChange={(event) => {
                setRoundCount(Number(event.target.value));
              }}
            />
          </div>

          <div className="field-group">
            <label htmlFor="timer">Timer</label>
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

        <button className="primary-action" type="submit">
          Start game
        </button>
      </form>
    </section>
  );
}
