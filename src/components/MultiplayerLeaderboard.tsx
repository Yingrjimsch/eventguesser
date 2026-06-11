import type { EventRound, RoundOutcome } from "../game/gameTypes";
import { FinalResultsScreen } from "./FinalResultsScreen";

type MultiplayerLeaderboardProps = {
  leaderboard: Array<{
    id: string;
    isYou?: boolean;
    name: string;
    score: number;
  }>;
  outcomes: RoundOutcome[];
  rounds: EventRound[];
  score: number;
  onExit: () => void;
};

export function MultiplayerLeaderboard({
  leaderboard,
  outcomes,
  rounds,
  score,
  onExit,
}: MultiplayerLeaderboardProps) {
  return (
    <FinalResultsScreen
      leaderboard={leaderboard}
      outcomes={outcomes}
      rounds={rounds}
      score={score}
      onExit={onExit}
    />
  );
}
