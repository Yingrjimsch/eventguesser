import { useEffect, useMemo, useRef, useState } from "react";
import { soccerModule } from "../modules/soccer/soccerModule";
import { hasRoundPanorama, loadSoccerRounds } from "../modules/soccer/soccerRounds";
import type { EventRound, GameSettings, RoundGuess, RoundOutcome } from "../game/gameTypes";
import { createInitialGameState, getCurrentRound } from "../game/gameState";
import { calculateRoundScore, createTimeoutRoundScore } from "../game/scoring";
import { StartScreen } from "../components/StartScreen";
import { RoundScreen } from "../components/RoundScreen";
import { FinalResultsScreen } from "../components/FinalResultsScreen";
import { MultiplayerLobby } from "../components/MultiplayerLobby";
import { MultiplayerLeaderboard } from "../components/MultiplayerLeaderboard";

type AppScreen = "start" | "round" | "final" | "multiplayer";

type MultiplayerPlayer = {
  id: string;
  isHost: boolean;
  isYou?: boolean;
  name: string;
  outcomes: RoundOutcome[];
  score: number;
};

type MultiplayerState = {
  currentRoundIndex: number;
  isHost: boolean;
  leaderboard: Array<{
    id: string;
    isYou?: boolean;
    name: string;
    score: number;
  }>;
  phase: "lobby" | "round" | "final";
  playerId: string;
  players: MultiplayerPlayer[];
  roomId: string;
  roundStartedAt: number | null;
  rounds: EventRound[];
  settings: GameSettings;
};

const defaultSettings: GameSettings = {
  category: "soccer",
  roundCount: 5,
  roundDurationSeconds: 90,
};
const multiplayerSessionStorageKey = "worldcup-guesser-multiplayer-session";

export function App() {
  const [screen, setScreen] = useState<AppScreen>("start");
  const [settings, setSettings] = useState<GameSettings>(defaultSettings);
  const [availableRounds, setAvailableRounds] = useState<EventRound[]>([]);
  const [roundDataError, setRoundDataError] = useState<string | null>(null);
  const [isRoundDataLoading, setIsRoundDataLoading] = useState(true);
  const [rounds, setRounds] = useState<EventRound[]>([]);
  const [multiplayerState, setMultiplayerState] = useState<MultiplayerState | null>(null);
  const [multiplayerError, setMultiplayerError] = useState<string | null>(null);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [outcomes, setOutcomes] = useState<RoundOutcome[]>([]);
  const [roundStartedAt, setRoundStartedAt] = useState<number>(Date.now());
  const didHandleInitialRoom = useRef(false);
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

  useEffect(() => {
    if (didHandleInitialRoom.current) {
      return;
    }

    didHandleInitialRoom.current = true;

    const roomId = new URLSearchParams(window.location.search).get("room");

    if (roomId) {
      void joinMultiplayerRoom(roomId);
    }
  }, []);

  useEffect(() => {
    if (!multiplayerState?.roomId || !multiplayerState.playerId) {
      return undefined;
    }

    const events = new EventSource(
      `/api/rooms/${multiplayerState.roomId}/events?playerId=${multiplayerState.playerId}`,
    );

    events.addEventListener("state", (event) => {
      setMultiplayerState(JSON.parse((event as MessageEvent).data) as MultiplayerState);
      setScreen("multiplayer");
    });
    events.onerror = () => {
      setMultiplayerError("Multiplayer connection lost");
    };

    return () => events.close();
  }, [multiplayerState?.playerId, multiplayerState?.roomId]);

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

  async function hostMultiplayerGame(nextSettings: GameSettings) {
    const state = await postJson<MultiplayerState>("/api/rooms", {
      roundCount: nextSettings.roundCount,
      roundDurationSeconds: nextSettings.roundDurationSeconds,
    });

    setMultiplayerState(state);
    rememberMultiplayerSession(state.roomId, state.playerId);
    setSettings(nextSettings);
    setMultiplayerError(null);
    setScreen("multiplayer");
    window.history.replaceState(null, "", `?room=${state.roomId}`);
  }

  async function joinMultiplayerRoom(roomId: string) {
    try {
      const savedPlayerId = getRememberedMultiplayerPlayerId(roomId);
      const state = await postJson<MultiplayerState>(`/api/rooms/${roomId}/join`, {
        playerId: savedPlayerId,
      });

      setMultiplayerState(state);
      rememberMultiplayerSession(state.roomId, state.playerId);
      setSettings(state.settings);
      setMultiplayerError(null);
      setScreen("multiplayer");
      window.history.replaceState(null, "", `?room=${state.roomId}`);
    } catch (error) {
      setMultiplayerError(error instanceof Error ? error.message : "Could not join room");
      setScreen("start");
    }
  }

  async function startMultiplayerRound() {
    if (!multiplayerState) {
      return;
    }

    const state = await postJson<MultiplayerState>(
      `/api/rooms/${multiplayerState.roomId}/start`,
      { playerId: multiplayerState.playerId },
    );
    setMultiplayerState(state);
  }

  async function submitMultiplayerGuess(guess: Omit<RoundGuess, "secondsUsed">) {
    if (!multiplayerState) {
      return;
    }

    const state = await postJson<MultiplayerState>(
      `/api/rooms/${multiplayerState.roomId}/guess`,
      {
        guessedLocation: guess.guessedLocation,
        guessedTime: guess.guessedTime,
        playerId: multiplayerState.playerId,
      },
    );
    setMultiplayerState(state);
  }

  async function timeoutMultiplayerRound() {
    if (!multiplayerState) {
      return;
    }

    const state = await postJson<MultiplayerState>(
      `/api/rooms/${multiplayerState.roomId}/timeout`,
      { playerId: multiplayerState.playerId },
    );
    setMultiplayerState(state);
  }

  async function goToNextMultiplayerRound() {
    if (!multiplayerState?.isHost) {
      return;
    }

    const state = await postJson<MultiplayerState>(
      `/api/rooms/${multiplayerState.roomId}/next`,
      { playerId: multiplayerState.playerId },
    );
    setMultiplayerState(state);
  }

  function exitMultiplayer() {
    if (multiplayerState) {
      forgetMultiplayerSession(multiplayerState.roomId);
    }

    setMultiplayerState(null);
    setMultiplayerError(null);
    window.history.replaceState(null, "", window.location.pathname);
    setScreen("start");
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
          defaultSettings={settings}
          dataError={roundDataError}
          isDataLoading={isRoundDataLoading}
          maxRounds={mediaReadyRoundCount}
          onHostMultiplayer={hostMultiplayerGame}
          onStart={startGame}
        />
      ) : null}

      {screen === "start" && multiplayerError ? (
        <div className="startup-error" role="alert">
          {multiplayerError}
        </div>
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

      {screen === "multiplayer" && multiplayerState?.phase === "lobby" ? (
        <MultiplayerLobby
          inviteUrl={`${window.location.origin}${window.location.pathname}?room=${multiplayerState.roomId}`}
          isHost={multiplayerState.isHost}
          players={multiplayerState.players}
          roomId={multiplayerState.roomId}
          onStart={startMultiplayerRound}
          onExit={exitMultiplayer}
        />
      ) : null}

      {screen === "multiplayer" && multiplayerState?.phase === "round" ? (
        <MultiplayerRoundScreen
          state={multiplayerState}
          onNextRound={goToNextMultiplayerRound}
          onSubmitGuess={submitMultiplayerGuess}
          onTimeOut={timeoutMultiplayerRound}
        />
      ) : null}

      {screen === "multiplayer" && multiplayerState?.phase === "final" ? (
        <MultiplayerLeaderboard
          leaderboard={multiplayerState.leaderboard}
          outcomes={
            multiplayerState.players.find((player) => player.isYou)?.outcomes ?? []
          }
          rounds={multiplayerState.rounds}
          score={multiplayerState.players.find((player) => player.isYou)?.score ?? 0}
          onExit={exitMultiplayer}
        />
      ) : null}
    </main>
  );
}

function MultiplayerRoundScreen({
  state,
  onNextRound,
  onSubmitGuess,
  onTimeOut,
}: {
  state: MultiplayerState;
  onNextRound: () => void;
  onSubmitGuess: (guess: Omit<RoundGuess, "secondsUsed">) => void;
  onTimeOut: (roundId: string) => void;
}) {
  const round = state.rounds[state.currentRoundIndex];
  const currentPlayer = state.players.find((player) => player.isYou);
  const outcome = currentPlayer?.outcomes.find((item) => item.roundId === round?.id);
  const submittedCount = round
    ? state.players.filter((player) =>
        player.outcomes.some((item) => item.roundId === round.id),
      ).length
    : 0;
  const totalPlayers = state.players.length;

  if (!round) {
    return null;
  }

  return (
    <RoundScreen
      gameState={{
        ...createInitialGameState(
          state.settings,
          state.rounds,
          state.currentRoundIndex,
        ),
        score: currentPlayer?.score ?? 0,
      }}
      round={round}
      outcome={outcome}
      autoAdvanceResult={false}
      canAdvanceResult={state.isHost && submittedCount === totalPlayers}
      nextUnavailableLabel="Waiting for host"
      roundStartedAt={state.roundStartedAt ?? undefined}
      waitingForPlayers={
        outcome && submittedCount < totalPlayers
          ? { submittedCount, totalPlayers }
          : undefined
      }
      onNextRound={onNextRound}
      onSubmitGuess={onSubmitGuess}
      onTimeOut={onTimeOut}
    />
  );
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
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

function getRememberedMultiplayerPlayerId(roomId: string) {
  try {
    const session = JSON.parse(
      window.localStorage.getItem(multiplayerSessionStorageKey) ?? "{}",
    ) as Record<string, string>;

    return session[roomId] ?? "";
  } catch {
    return "";
  }
}

function rememberMultiplayerSession(roomId: string, playerId: string) {
  try {
    const session = JSON.parse(
      window.localStorage.getItem(multiplayerSessionStorageKey) ?? "{}",
    ) as Record<string, string>;

    window.localStorage.setItem(
      multiplayerSessionStorageKey,
      JSON.stringify({ ...session, [roomId]: playerId }),
    );
  } catch {
    window.localStorage.setItem(
      multiplayerSessionStorageKey,
      JSON.stringify({ [roomId]: playerId }),
    );
  }
}

function forgetMultiplayerSession(roomId: string) {
  try {
    const session = JSON.parse(
      window.localStorage.getItem(multiplayerSessionStorageKey) ?? "{}",
    ) as Record<string, string>;

    delete session[roomId];
    window.localStorage.setItem(multiplayerSessionStorageKey, JSON.stringify(session));
  } catch {
    window.localStorage.removeItem(multiplayerSessionStorageKey);
  }
}
