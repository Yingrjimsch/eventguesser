import type { EventRound, RoundOutcome } from "../game/gameTypes";

type FinalResultsScreenProps = {
  rounds: EventRound[];
  outcomes: RoundOutcome[];
  score: number;
  onPlayAgain: () => void;
  onExit: () => void;
};

export function FinalResultsScreen({
  rounds,
  outcomes,
  score,
  onPlayAgain,
  onExit,
}: FinalResultsScreenProps) {
  const completedOutcomes = rounds
    .map((round) => {
      const outcome = outcomes.find((item) => item.roundId === round.id);

      return outcome ? { round, outcome } : null;
    })
    .filter((item): item is { round: EventRound; outcome: RoundOutcome } =>
      Boolean(item),
    );
  const guessedOutcomes = completedOutcomes.filter(({ outcome }) => !outcome.timedOut);
  const bestRound = getExtremeRound(completedOutcomes, "best");
  const worstRound = getExtremeRound(completedOutcomes, "worst");
  const averageDistanceKm = getAverage(
    guessedOutcomes.map(({ outcome }) => outcome.score.distanceKm),
  );
  const averageDateErrorDays = getAverage(
    guessedOutcomes.map(({ outcome }) => outcome.score.dateErrorDays),
  );

  return (
    <section className="final-screen">
      <header className="final-hero">
        <p className="eyebrow">World Cup run complete</p>
        <h1>{score.toLocaleString()} points</h1>
        <p>
          {completedOutcomes.length} of {rounds.length} rounds completed.
        </p>
      </header>

      <div className="final-summary-grid">
        <SummaryMetric label="Average distance" value={formatDistance(averageDistanceKm)} />
        <SummaryMetric label="Average date error" value={formatDays(averageDateErrorDays)} />
        <SummaryMetric
          label="Best round"
          value={bestRound ? formatRoundScore(bestRound.outcome) : "None"}
          detail={bestRound ? getRoundName(bestRound.round) : undefined}
        />
        <SummaryMetric
          label="Worst round"
          value={worstRound ? formatRoundScore(worstRound.outcome) : "None"}
          detail={worstRound ? getRoundName(worstRound.round) : undefined}
        />
      </div>

      <section className="round-summary-list" aria-label="Round results">
        {completedOutcomes.map(({ round, outcome }, index) => (
          <article className="round-summary-item" key={round.id}>
            <div>
              <span>Round {index + 1}</span>
              <strong>{getRoundName(round)}</strong>
              <p>{getRoundPlace(round)}</p>
            </div>

            <div className="round-summary-metrics">
              <span>{outcome.timedOut ? "Timed out" : formatDistance(outcome.score.distanceKm)}</span>
              <span>{formatDays(outcome.score.dateErrorDays)}</span>
              <strong>{outcome.score.totalScore.toLocaleString()}</strong>
            </div>
          </article>
        ))}
      </section>

      <div className="final-actions">
        <button className="primary-action" type="button" onClick={onPlayAgain}>
          Play again
        </button>
        <button className="secondary-action" type="button" onClick={onExit}>
          Back to start
        </button>
      </div>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="summary-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

function getExtremeRound(
  items: Array<{ round: EventRound; outcome: RoundOutcome }>,
  direction: "best" | "worst",
) {
  if (items.length === 0) {
    return null;
  }

  return items.reduce((selected, item) => {
    if (direction === "best") {
      return item.outcome.score.totalScore > selected.outcome.score.totalScore
        ? item
        : selected;
    }

    return item.outcome.score.totalScore < selected.outcome.score.totalScore
      ? item
      : selected;
  }, items[0]);
}

function getAverage(values: Array<number | null>) {
  const numericValues = values.filter((value): value is number => value !== null);

  if (numericValues.length === 0) {
    return null;
  }

  return numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
}

function getRoundName(round: EventRound) {
  const metadata = (round.metadata ?? {}) as Record<string, unknown>;

  if (metadata.homeTeam && metadata.awayTeam) {
    return `${String(metadata.homeTeam)} vs ${String(metadata.awayTeam)}`;
  }

  return round.title ?? "Unknown event";
}

function getRoundPlace(round: EventRound) {
  const metadata = (round.metadata ?? {}) as Record<string, unknown>;

  return [metadata.stadium, metadata.city, metadata.country]
    .filter(Boolean)
    .map(String)
    .join(", ");
}

function formatRoundScore(outcome: RoundOutcome) {
  return `${outcome.score.totalScore.toLocaleString()} pts`;
}

function formatDistance(distanceKm: number | null) {
  if (distanceKm === null) {
    return "No guesses";
  }

  return `${Math.round(distanceKm).toLocaleString()} km`;
}

function formatDays(days: number | null) {
  if (days === null) {
    return "No guesses";
  }

  if (days >= 365) {
    return `${(days / 365).toFixed(1)} years`;
  }

  if (Math.round(days) === 1) {
    return "1 day";
  }

  return `${Math.round(days)} days`;
}
