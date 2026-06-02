import type { EventRound, GameSettings, GameState } from "./gameTypes";

export function createInitialGameState(
  settings: GameSettings,
  rounds: EventRound[],
  currentRoundIndex = 0,
): GameState {
  return {
    settings,
    rounds,
    currentRoundIndex,
    totalRounds: rounds.length,
    score: 0,
  };
}

export function getCurrentRound(gameState: GameState): EventRound | undefined {
  return gameState.rounds[gameState.currentRoundIndex];
}
