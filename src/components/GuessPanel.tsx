import { useEffect, useMemo, useState } from "react";
import type { EventRound, GeoPoint, RoundGuess, RoundOutcome } from "../game/gameTypes";
import { GuessMap } from "./GuessMap";
import { TimeGuessInput } from "./TimeGuessInput";

type GuessPanelProps = {
  round: EventRound;
  roundDurationSeconds: number;
  score: number;
  outcome?: RoundOutcome;
  isLastRound: boolean;
  onSubmitGuess: (guess: Omit<RoundGuess, "secondsUsed">) => void;
  onNextRound: () => void;
  onTimeOut: (roundId: string) => void;
};

export function GuessPanel({
  round,
  roundDurationSeconds,
  score,
  outcome,
  isLastRound,
  onSubmitGuess,
  onNextRound,
  onTimeOut,
}: GuessPanelProps) {
  const [locationGuess, setLocationGuess] = useState<GeoPoint | null>(
    outcome?.guess?.guessedLocation ?? null,
  );
  const [timeGuess, setTimeGuess] = useState(outcome?.guess?.guessedTime ?? "2000");
  const [remainingSeconds, setRemainingSeconds] = useState(roundDurationSeconds);
  const [isGuessPanelOpen, setIsGuessPanelOpen] = useState(false);

  useEffect(() => {
    setLocationGuess(outcome?.guess?.guessedLocation ?? null);
    setTimeGuess(outcome?.guess?.guessedTime ?? "2000");
    setIsGuessPanelOpen(false);
  }, [round.id, roundDurationSeconds, outcome]);

  useEffect(() => {
    setRemainingSeconds(roundDurationSeconds);
  }, [round.id, roundDurationSeconds]);

  useEffect(() => {
    if (outcome || remainingSeconds <= 0) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setRemainingSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [remainingSeconds, outcome]);

  useEffect(() => {
    if (outcome || remainingSeconds > 0) {
      return undefined;
    }

    onTimeOut(round.id);

    return undefined;
  }, [onTimeOut, outcome, remainingSeconds, round.id]);

  useEffect(() => {
    if (!outcome) {
      return undefined;
    }

    const timeoutId = window.setTimeout(onNextRound, isLastRound ? 9500 : 7500);

    return () => window.clearTimeout(timeoutId);
  }, [isLastRound, onNextRound, outcome]);

  const canSubmit = Boolean(
    locationGuess && timeGuess && !outcome && remainingSeconds > 0,
  );
  const isLocked = Boolean(outcome) || remainingSeconds <= 0;

  const coordinatePreview = useMemo(() => {
    if (!locationGuess) {
      return "No marker placed";
    }

    return `${locationGuess.lat.toFixed(3)}, ${locationGuess.lng.toFixed(3)}`;
  }, [locationGuess]);

  return (
    <>
      <div className="status-grid">
        <div>
          <span>Timer</span>
          <strong>{formatTimer(remainingSeconds)}</strong>
        </div>
        <div>
          <span>Score</span>
          <strong>{score}</strong>
        </div>
      </div>

      {!outcome ? (
        <button
          className="guess-toggle"
          type="button"
          aria-controls="guess-panel"
          aria-expanded={isGuessPanelOpen}
          aria-label={
            isGuessPanelOpen
              ? "Close location and time guess controls"
              : "Open location and time guess controls"
          }
          onClick={() => setIsGuessPanelOpen((isOpen) => !isOpen)}
        >
          <span aria-hidden="true">?</span>
        </button>
      ) : null}

      <aside
        className={isGuessPanelOpen ? "guess-shell is-open" : "guess-shell"}
        id="guess-panel"
      >
      <div className="guess-panel-topbar">
        <span>Place and time</span>
      </div>

      <form
        className="guess-form"
        onSubmit={(event) => {
          event.preventDefault();

          if (!locationGuess || !timeGuess) {
            return;
          }

          onSubmitGuess({
            roundId: round.id,
            guessedLocation: locationGuess,
            guessedTime: timeGuess,
          });
        }}
      >
        <section className="guess-card map-card">
          <div className="guess-card-header">
            <h2>Location</h2>
            <span>{coordinatePreview}</span>
          </div>
          <GuessMap
            value={locationGuess}
            correctValue={outcome ? round.answer.location : undefined}
            disabled={isLocked}
            showConnection={Boolean(outcome?.guess)}
            onChange={setLocationGuess}
          />
        </section>

        <section className="guess-card">
          <TimeGuessInput value={timeGuess} disabled={isLocked} onChange={setTimeGuess} />
        </section>

        <div className="guess-actions">
          <button className="primary-action" type="submit" disabled={!canSubmit}>
            Submit guess
          </button>

          {!outcome ? (
            <button
              className="secondary-action"
              type="button"
              disabled={remainingSeconds > 0}
              onClick={onNextRound}
            >
              {isLastRound ? "Finish game" : "Next round"}
            </button>
          ) : null}
        </div>
      </form>
    </aside>

      {outcome ? (
        <RoundResultOverlay
          round={round}
          outcome={outcome}
          isLastRound={isLastRound}
          onNextRound={onNextRound}
        />
      ) : null}
    </>
  );
}

function RoundResultOverlay({
  round,
  outcome,
  isLastRound,
  onNextRound,
}: {
  round: EventRound;
  outcome: RoundOutcome;
  isLastRound: boolean;
  onNextRound: () => void;
}) {
  const metadata = (round.metadata ?? {}) as Record<string, unknown>;
  const eventName = [
    metadata.competition,
    metadata.homeTeam && metadata.awayTeam
      ? `${String(metadata.homeTeam)} vs ${String(metadata.awayTeam)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const place = [metadata.stadium, metadata.city, metadata.country]
    .filter(Boolean)
    .map(String)
    .join(", ");
  const brief =
    metadata.summary ??
    `${eventName || round.title || "This event"} took place at ${place || "the highlighted location"} on ${round.answer.occurredAt}.`;
  const detailUrl = typeof metadata.detailUrl === "string" ? metadata.detailUrl : null;
  const result = outcome.score;

  return (
    <section className="round-result-overlay" aria-live="polite">
      <div className="round-result-card">
        <div className="result-title">
          <p className="eyebrow">{outcome.timedOut ? "Time up" : "Round result"}</p>
          <h2>{eventName || round.title || "Round result"}</h2>
        </div>
        {place ? <span>{place}</span> : null}

        <div className="result-stats">
          <div>
            <span>Distance</span>
            <strong>{formatDistance(result.distanceKm)}</strong>
          </div>
          <div>
            <span>Date error</span>
            <strong>{formatDays(result.dateErrorDays)}</strong>
          </div>
          <div>
            <span>Round score</span>
            <strong>{result.totalScore}</strong>
          </div>
        </div>

        <p>
          {String(brief)}
        </p>
        {detailUrl ? (
          <a className="result-source-link" href={detailUrl} target="_blank" rel="noreferrer">
            View source
          </a>
        ) : null}
        <div className="answer-row">
          <span>
            Your year: {formatGuessYear(outcome.guess?.guessedTime)}. Correct date:{" "}
            {round.answer.occurredAt}.
          </span>
          <span>
            Speed: {(result.speedMultiplier * 100).toFixed(0)}%. Location points:{" "}
            {result.locationScore}. Time points: {result.timeScore}.
          </span>
        </div>

        <button className="primary-action" type="button" onClick={onNextRound}>
          {isLastRound ? "Show final results" : "Next round"}
        </button>
      </div>
    </section>
  );
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${minutes}:${remaining.toString().padStart(2, "0")}`;
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) {
    return "No guess";
  }

  if (distanceKm >= 1000) {
    return `${Math.round(distanceKm).toLocaleString()} km away`;
  }

  return `${Math.round(distanceKm)} km away`;
}

function formatDays(days: number | null) {
  if (days === null) {
    return "No guess";
  }

  if (!Number.isFinite(days)) {
    return "Invalid date";
  }

  if (days === 1) {
    return "1 day";
  }

  if (days >= 365) {
    return `${(days / 365).toFixed(1)} years`;
  }

  return `${days} days`;
}

function formatGuessYear(value?: string) {
  if (!value) {
    return "No guess";
  }

  return value.slice(0, 4);
}
