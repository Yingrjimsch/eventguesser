import type { EventRound, GameState, RoundGuess, RoundOutcome } from "../game/gameTypes";
import { GuessPanel } from "./GuessPanel";
import { RoundMedia } from "./RoundMedia";

type RoundScreenProps = {
  gameState: GameState;
  round: EventRound;
  outcome?: RoundOutcome;
  autoAdvanceResult?: boolean;
  canAdvanceResult?: boolean;
  onNextRound: () => void;
  onSubmitGuess: (guess: Omit<RoundGuess, "secondsUsed">) => void;
  onTimeOut: (roundId: string) => void;
  nextUnavailableLabel?: string;
  roundStartedAt?: number;
  waitingForPlayers?: {
    submittedCount: number;
    totalPlayers: number;
  };
};

export function RoundScreen({
  gameState,
  round,
  outcome,
  autoAdvanceResult = true,
  canAdvanceResult = true,
  onNextRound,
  onSubmitGuess,
  onTimeOut,
  nextUnavailableLabel,
  roundStartedAt,
  waitingForPlayers,
}: RoundScreenProps) {
  const isLastRound = gameState.currentRoundIndex === gameState.totalRounds - 1;

  return (
    <section className="round-screen">
      <header className="round-header">
        <div>
          <p className="eyebrow">World Cup match</p>
          <h1>
            Round {gameState.currentRoundIndex + 1} of {gameState.totalRounds}
          </h1>
        </div>
      </header>

      <div className="round-layout">
        <RoundMedia round={round} />

        <GuessPanel
          round={round}
          roundDurationSeconds={gameState.settings.roundDurationSeconds}
          score={gameState.score}
          outcome={outcome}
          isLastRound={isLastRound}
          autoAdvanceResult={autoAdvanceResult}
          canAdvanceResult={canAdvanceResult}
          nextUnavailableLabel={nextUnavailableLabel}
          waitingForPlayers={waitingForPlayers}
          onSubmitGuess={onSubmitGuess}
          onNextRound={onNextRound}
          onTimeOut={onTimeOut}
          roundStartedAt={roundStartedAt}
        />
      </div>
    </section>
  );
}
