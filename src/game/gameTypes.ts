export type EventCategory = "soccer";

export type EventMediaType = "panorama";

export type GuessField = "location" | "time";

export type EventPanorama = {
  url: string;
  label?: string;
};

export type EventMedia = {
  panorama?: EventPanorama;
  panoramas?: EventPanorama[];
};

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type EventAnswer = {
  location: GeoPoint;
  occurredAt: string;
};

export type EventRound<TMetadata = Record<string, unknown>> = {
  id: string;
  category: EventCategory;
  title?: string;
  media: EventMedia;
  answer: EventAnswer;
  metadata?: TMetadata;
};

export type GameSettings = {
  category: EventCategory;
  roundCount: number;
  roundDurationSeconds: number;
};

export type RoundGuess = {
  roundId: string;
  guessedLocation: GeoPoint;
  guessedTime: string;
  secondsUsed: number;
};

export type RoundScore = {
  locationScore: number;
  timeScore: number;
  totalScore: number;
  distanceKm: number | null;
  dateErrorDays: number | null;
  speedMultiplier: number;
};

export type RoundOutcome = {
  roundId: string;
  guess?: RoundGuess;
  score: RoundScore;
  timedOut: boolean;
};

export type ScoringConfig = {
  maxRoundScore: number;
  locationWeight: number;
  timeWeight: number;
  speedMultiplierMin: number;
  timeoutScore: number;
};

export type GameModule = {
  id: EventCategory;
  label: string;
  description: string;
  mediaTypes: EventMediaType[];
  guessFields: GuessField[];
  scoring: ScoringConfig;
};

export type GameState = {
  settings: GameSettings;
  rounds: EventRound[];
  currentRoundIndex: number;
  totalRounds: number;
  score: number;
};
