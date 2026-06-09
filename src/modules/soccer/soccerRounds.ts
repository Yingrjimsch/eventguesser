import type { EventRound } from "../../game/gameTypes";
import worldCupRoundData from "../../data/worldCupRoundData.json";
import { getWorldCupPublicMedia } from "./worldCupPublicMedia";

export type SoccerMetadata = {
  competition?: string;
  stage?: string;
  group?: string;
  homeTeam?: string;
  awayTeam?: string;
  stadium?: string;
  city?: string;
  country?: string;
  finalScore?: string;
  penaltyScore?: string;
  season?: string;
  summary?: string;
  detailUrl?: string;
};

type WorldCupRoundDataPayload = {
  rounds: WorldCupRound[];
};

type WorldCupRound = {
  id: string;
  title: string;
  occurredAt: string;
  location: {
    lat: number;
    lng: number;
  };
  competition: string;
  stage: string;
  group: string | null;
  homeTeam: string;
  awayTeam: string;
  stadium: string;
  city: string;
  country: string;
  finalScore: string;
  penaltyScore: string | null;
  season: string;
  detailUrl: string;
  summary: string;
};

const worldCupData = worldCupRoundData as WorldCupRoundDataPayload;

export const soccerRounds: EventRound<SoccerMetadata>[] = worldCupData.rounds.map(
  (round) => ({
    id: round.id,
    category: "soccer",
    title: round.title,
    media: {
      ...getWorldCupPublicMedia(round.id),
    },
    answer: {
      location: {
        lat: round.location.lat,
        lng: round.location.lng,
      },
      occurredAt: round.occurredAt,
    },
    metadata: {
      competition: round.competition,
      stage: round.stage,
      group: round.group ?? undefined,
      homeTeam: round.homeTeam,
      awayTeam: round.awayTeam,
      stadium: round.stadium,
      city: round.city,
      country: round.country,
      finalScore: round.finalScore,
      penaltyScore: round.penaltyScore ?? undefined,
      season: round.season,
      summary: round.summary,
      detailUrl: round.detailUrl,
    },
  }),
);
