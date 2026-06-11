import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { EventRound, RoundOutcome } from "../game/gameTypes";

type FinalResultsScreenProps = {
  rounds: EventRound[];
  outcomes: RoundOutcome[];
  score: number;
  leaderboard?: Array<{
    id: string;
    isYou?: boolean;
    name: string;
    score: number;
  }>;
  onPlayAgain?: () => void;
  onExit: () => void;
};

type ReportState = "idle" | "sending" | "sent" | "error";

const reportApiUrl = import.meta.env.VITE_REPORT_API_URL || "/api/reports";

export function FinalResultsScreen({
  rounds,
  outcomes,
  score,
  leaderboard,
  onPlayAgain,
  onExit,
}: FinalResultsScreenProps) {
  const [reportStates, setReportStates] = useState<Record<string, ReportState>>({});
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

      {leaderboard ? (
        <section className="compact-leaderboard" aria-label="Leaderboard">
          <div className="compact-leaderboard-header">
            <span>Leaderboard</span>
            <strong>{leaderboard.length} players</strong>
          </div>
          <div className="compact-leaderboard-list">
            {leaderboard.map((player, index) => (
              <article className="compact-leaderboard-item" key={player.id}>
                <span>{index + 1}</span>
                <strong>
                  {player.name}
                  {player.isYou ? " (You)" : ""}
                </strong>
                <b>{player.score.toLocaleString()}</b>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <div className="final-summary-grid">
        <SummaryMetric label="Average distance error" value={formatDistance(averageDistanceKm)} />
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

      <p className="final-report-note">
        If a panorama is bad or not recognizable, report it with one click from
        the round list below.
      </p>

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

            {reportStates[getReportKey(round)] === "sent" ? (
              <span className="report-image-label">Reported</span>
            ) : (
              <button
                className="report-image-link"
                type="button"
                disabled={reportStates[getReportKey(round)] === "sending"}
                onClick={() => {
                  void submitImageReport(round, setReportStates);
                }}
              >
                {getReportLabel(reportStates[getReportKey(round)] ?? "idle")}
              </button>
            )}
          </article>
        ))}
      </section>

      <div className="final-actions">
        {onPlayAgain ? (
          <button className="primary-action" type="button" onClick={onPlayAgain}>
            Play again
          </button>
        ) : null}
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

async function submitImageReport(
  round: EventRound,
  setReportStates: Dispatch<SetStateAction<Record<string, ReportState>>>,
) {
  const reportKey = getReportKey(round);
  const panoramaUrl = getRoundPanoramaUrl(round);
  const imageName = getFileName(panoramaUrl);

  setReportStates((states) => ({ ...states, [reportKey]: "sending" }));

  try {
    const response = await fetch(reportApiUrl, {
      body: JSON.stringify({
        imageName,
        imageUrl: panoramaUrl,
        match: getRoundName(round),
        place: getRoundPlace(round),
        roundId: round.id,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Report failed");
    }

    setReportStates((states) => ({ ...states, [reportKey]: "sent" }));
  } catch {
    setReportStates((states) => ({ ...states, [reportKey]: "error" }));
  }
}

function getReportLabel(state: ReportState) {
  if (state === "sending") {
    return "Sending...";
  }

  if (state === "sent") {
    return "Reported";
  }

  if (state === "error") {
    return "Try again";
  }

  return "Report image";
}

function getReportKey(round: EventRound) {
  return `${round.id}:${getFileName(getRoundPanoramaUrl(round))}`;
}

function getRoundPanoramaUrl(round: EventRound) {
  return round.media.panorama?.url ?? round.media.panoramas?.[0]?.url ?? "unknown";
}

function getFileName(url: string) {
  const path = url.split("?")[0];
  const name = path.split("/").filter(Boolean).at(-1);

  return name ? decodeURIComponent(name) : "unknown";
}
