import type { EventRound, RoundGuess, RoundScore, ScoringConfig } from "./gameTypes";

export const defaultScoringConfig: ScoringConfig = {
  maxRoundScore: 5000,
  locationWeight: 0.5,
  timeWeight: 0.5,
  speedMultiplierMin: 0.75,
  timeoutScore: 0,
};

export function getComponentMaxScore(
  config: ScoringConfig,
  component: "location" | "time",
) {
  const weight = component === "location" ? config.locationWeight : config.timeWeight;

  return Math.round(config.maxRoundScore * weight);
}

export function calculateRoundScore(
  round: EventRound,
  guess: RoundGuess,
  roundDurationSeconds: number,
  config: ScoringConfig,
): RoundScore {
  const distanceKm = calculateDistanceKm(
    round.answer.location.lat,
    round.answer.location.lng,
    guess.guessedLocation.lat,
    guess.guessedLocation.lng,
  );
  const dateErrorDays = calculateDateErrorDays(
    round.answer.occurredAt,
    guess.guessedTime,
  );
  const locationScore = calculateLocationScore(distanceKm, config);
  const timeScore = calculateTimeScore(dateErrorDays, config);
  const speedMultiplier = calculateSpeedMultiplier(
    guess.secondsUsed,
    roundDurationSeconds,
    config,
  );
  const totalScore = Math.round((locationScore + timeScore) * speedMultiplier);

  return {
    locationScore,
    timeScore,
    totalScore,
    distanceKm,
    dateErrorDays,
    speedMultiplier,
  };
}

export function createTimeoutRoundScore(config: ScoringConfig): RoundScore {
  return {
    locationScore: 0,
    timeScore: 0,
    totalScore: config.timeoutScore,
    distanceKm: null,
    dateErrorDays: null,
    speedMultiplier: 0,
  };
}

export function calculateDistanceKm(
  firstLat: number,
  firstLng: number,
  secondLat: number,
  secondLng: number,
) {
  const earthRadiusKm = 6371;
  const latDelta = toRadians(secondLat - firstLat);
  const lngDelta = toRadians(secondLng - firstLng);
  const firstLatRad = toRadians(firstLat);
  const secondLatRad = toRadians(secondLat);

  const haversine =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(firstLatRad) * Math.cos(secondLatRad) * Math.sin(lngDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function calculateDateErrorDays(correctDate: string, guessedDate: string) {
  const correctYear = extractYear(correctDate);
  const guessedYear = extractYear(guessedDate);

  if (correctYear !== null && guessedYear !== null && /^\d{4}$/.test(guessedDate)) {
    return Math.abs(correctYear - guessedYear) * 365;
  }

  const millisecondsPerDay = 1000 * 60 * 60 * 24;
  const correctTime = Date.parse(`${correctDate}T00:00:00Z`);
  const guessedTime = Date.parse(`${guessedDate}T00:00:00Z`);

  if (Number.isNaN(correctTime) || Number.isNaN(guessedTime)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round(Math.abs(correctTime - guessedTime) / millisecondsPerDay);
}

function calculateLocationScore(distanceKm: number, config: ScoringConfig) {
  const maxScore = getComponentMaxScore(config, "location");
  const score = maxScore * Math.exp(-distanceKm / 1800);

  return Math.round(Math.max(0, Math.min(maxScore, score)));
}

function calculateTimeScore(dateErrorDays: number, config: ScoringConfig) {
  const maxScore = getComponentMaxScore(config, "time");

  if (!Number.isFinite(dateErrorDays)) {
    return 0;
  }

  const score = maxScore * Math.exp(-dateErrorDays / 365);

  return Math.round(Math.max(0, Math.min(maxScore, score)));
}

function calculateSpeedMultiplier(
  secondsUsed: number,
  roundDurationSeconds: number,
  config: ScoringConfig,
) {
  if (roundDurationSeconds <= 0 || secondsUsed >= roundDurationSeconds) {
    return config.speedMultiplierMin;
  }

  const remainingRatio = Math.max(
    0,
    Math.min(1, (roundDurationSeconds - secondsUsed) / roundDurationSeconds),
  );

  return config.speedMultiplierMin + (1 - config.speedMultiplierMin) * remainingRatio;
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function extractYear(value: string) {
  const match = value.match(/^\d{4}/);

  if (!match) {
    return null;
  }

  const year = Number(match[0]);

  return Number.isFinite(year) ? year : null;
}
