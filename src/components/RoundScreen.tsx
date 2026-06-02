import type { EventRound, GameState, RoundGuess, RoundOutcome } from "../game/gameTypes";
import { GuessPanel } from "./GuessPanel";
import { RoundMedia } from "./RoundMedia";

type RoundScreenProps = {
  gameState: GameState;
  round: EventRound;
  outcome?: RoundOutcome;
  onExit: () => void;
  onNextRound: () => void;
  onSubmitGuess: (guess: Omit<RoundGuess, "secondsUsed">) => void;
  onTimeOut: (roundId: string) => void;
};

export function RoundScreen({
  gameState,
  round,
  outcome,
  onExit,
  onNextRound,
  onSubmitGuess,
  onTimeOut,
}: RoundScreenProps) {
  const isLastRound = gameState.currentRoundIndex === gameState.totalRounds - 1;

  return (
    <section className="round-screen">
      <header className="round-header">
        <div>
          <p className="eyebrow">Soccer round</p>
          <h1>
            Round {gameState.currentRoundIndex + 1} of {gameState.totalRounds}
          </h1>
        </div>
        <button className="secondary-action" type="button" onClick={onExit}>
          Exit
        </button>
      </header>

      <div className="round-layout">
        <RoundMedia round={round} />

        <GuessPanel
          round={round}
          roundDurationSeconds={gameState.settings.roundDurationSeconds}
          score={gameState.score}
          outcome={outcome}
          isLastRound={isLastRound}
          onSubmitGuess={onSubmitGuess}
          onNextRound={onNextRound}
          onTimeOut={onTimeOut}
        />
      </div>
    </section>
  );
}
