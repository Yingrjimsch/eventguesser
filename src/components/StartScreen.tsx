import { useState } from "react";
import type { EventCategory, GameModule, GameSettings } from "../game/gameTypes";
import { InteractiveWorldCupBall } from "./InteractiveWorldCupBall";

type StartScreenProps = {
  availableModules: GameModule[];
  defaultSettings: GameSettings;
  maxRounds: number;
  onStart: (settings: GameSettings) => void;
};

const timerOptions = [60, 90, 120];
const triondaModelUrl =
  import.meta.env.VITE_TRIONDA_MODEL_URL ||
  "/models/trionda/source/Trionda%202026.glb";

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
        <p className="eyebrow">World Cup Guesser</p>
        <h1>Guess the match. Find the stadium.</h1>
        <p>
          Drop into World Cup scenes, place the stadium, and scroll the timeline
          to the tournament year.
        </p>
      </div>

      <InteractiveWorldCupBall modelUrl={triondaModelUrl} />

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

        <div className="field-grid">
          <div className="field-group">
            <label htmlFor="rounds">Matches</label>
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

        <button className="primary-action" type="submit">
          Start World Cup run
        </button>
      </form>
    </section>
  );
}
