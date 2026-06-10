import { useEffect, useMemo, useState } from "react";
import { soccerModule } from "../modules/soccer/soccerModule";
import { hasRoundPanorama, loadSoccerRounds } from "../modules/soccer/soccerRounds";
import type { EventRound, GameSettings, RoundGuess, RoundOutcome } from "../game/gameTypes";
import { createInitialGameState, getCurrentRound } from "../game/gameState";
import { calculateRoundScore, createTimeoutRoundScore } from "../game/scoring";
import { StartScreen } from "../components/StartScreen";
import { RoundScreen } from "../components/RoundScreen";
import { FinalResultsScreen } from "../components/FinalResultsScreen";

type AppScreen = "start" | "round" | "final";

const defaultSettings: GameSettings = {
  category: "soccer",
  roundCount: 5,
  roundDurationSeconds: 90,
};

export function App() {
  const [screen, setScreen] = useState<AppScreen>("start");
  const [settings, setSettings] = useState<GameSettings>(defaultSettings);
  const [availableRounds, setAvailableRounds] = useState<EventRound[]>([]);
  const [roundDataError, setRoundDataError] = useState<string | null>(null);
  const [isRoundDataLoading, setIsRoundDataLoading] = useState(true);
  const [rounds, setRounds] = useState<EventRound[]>([]);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<RoundOutcome[]>([]);
  const [roundStartedAt, setRoundStartedAt] = useState<number>(Date.now());
  const score = useMemo(
    () => outcomes.reduce((total, outcome) => total + outcome.score.totalScore, 0),
    [outcomes],
  );

  const gameState = useMemo(
    () => ({
      ...createInitialGameState(settings, rounds, currentRoundIndex),
      score,
    }),
    [settings, rounds, currentRoundIndex, score],
  );

  const currentRound = getCurrentRound(gameState);
  const mediaReadyRoundCount = useMemo(
    () => availableRounds.filter(hasRoundPanorama).length,
    [availableRounds],
  );

  useEffect(() => {
    let isCancelled = false;

    setIsRoundDataLoading(true);
    setRoundDataError(null);

    loadSoccerRounds()
      .then((loadedRounds) => {
        if (isCancelled) {
          return;
        }

        setAvailableRounds(loadedRounds);
      })
      .catch((error: unknown) => {
        if (isCancelled) {
          return;
        }

        setAvailableRounds([]);
        setRoundDataError(error instanceof Error ? error.message : "Could not load game data");
      })
      .finally(() => {
        if (!isCancelled) {
          setIsRoundDataLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  function startGame(nextSettings: GameSettings) {
    if (availableRounds.length === 0) {
      return;
    }

    const selectedRounds = selectRandomRounds(availableRounds, nextSettings.roundCount);

    setSettings(nextSettings);
    setRounds(selectedRounds);
    setOutcomes([]);
    setCurrentRoundIndex(0);
    setRoundStartedAt(Date.now());
    setScreen("round");
  }

  function goToNextRound() {
    if (currentRoundIndex >= rounds.length - 1) {
      setScreen("final");
      return;
    }

    setCurrentRoundIndex((index) => index + 1);
    setRoundStartedAt(Date.now());
  }

  function submitGuess(guess: Omit<RoundGuess, "secondsUsed">) {
    if (!currentRound || outcomes.some((item) => item.roundId === guess.roundId)) {
      return;
    }

    const secondsUsed = Math.max(
      0,
      Math.round((Date.now() - roundStartedAt) / 1000),
    );
    const nextGuess: RoundGuess = {
      ...guess,
      secondsUsed,
    };
    const roundScore = calculateRoundScore(
      currentRound,
      nextGuess,
      settings.roundDurationSeconds,
      soccerModule.scoring,
    );

    setOutcomes((existingOutcomes) => {
      return [
        ...existingOutcomes.filter((item) => item.roundId !== guess.roundId),
        {
          roundId: guess.roundId,
          guess: nextGuess,
          score: roundScore,
          timedOut: false,
        },
      ];
    });
  }

  function timeOutRound(roundId: string) {
    if (!currentRound || outcomes.some((item) => item.roundId === roundId)) {
      return;
    }

    setOutcomes((existingOutcomes) => [
      ...existingOutcomes,
      {
        roundId,
        score: createTimeoutRoundScore(soccerModule.scoring),
        timedOut: true,
      },
    ]);
  }

  return (
    <main className="app-shell">
      {screen === "start" ? (
        <StartScreen
          availableModules={[soccerModule]}
          defaultSettings={settings}
          dataError={roundDataError}
          isDataLoading={isRoundDataLoading}
          maxRounds={mediaReadyRoundCount}
          onStart={startGame}
        />
      ) : null}

      {screen === "round" && currentRound ? (
        <RoundScreen
          gameState={gameState}
          round={currentRound}
          outcome={outcomes.find((outcome) => outcome.roundId === currentRound.id)}
          onNextRound={goToNextRound}
          onSubmitGuess={submitGuess}
          onTimeOut={timeOutRound}
        />
      ) : null}

      {screen === "final" ? (
        <FinalResultsScreen
          outcomes={outcomes}
          rounds={rounds}
          score={score}
          onPlayAgain={() => startGame(settings)}
          onExit={() => setScreen("start")}
        />
      ) : null}
    </main>
  );
}

function selectRandomRounds(rounds: EventRound[], roundCount: number) {
  const mediaReadyRounds = rounds.filter(hasRoundPanorama);
  const remainingRounds = rounds.filter((round) => !hasRoundPanorama(round));

  return [
    ...shuffleRounds(mediaReadyRounds),
    ...shuffleRounds(remainingRounds),
  ].slice(0, roundCount);
}

function shuffleRounds(rounds: EventRound[]) {
  return [...rounds].sort(() => Math.random() - 0.5);
}
