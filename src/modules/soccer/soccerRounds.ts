import type { EventRound } from "../../game/gameTypes";
import worldCupEventImages from "../../data/worldCupEventImages.json";
import worldCupRoundData from "../../data/worldCupRoundData.json";

const matchPhotoPlaceholder = "/events/mexico-86-placeholder.jpg";

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

type WorldCupEventImagesPayload = {
  events: Record<
    string,
    {
      images?: Array<{
        imageUrl?: string;
      }>;
    }
  >;
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
const worldCupImages = worldCupEventImages as WorldCupEventImagesPayload;

export const soccerRounds: EventRound<SoccerMetadata>[] = worldCupData.rounds.map(
  (round) => ({
    id: round.id,
    category: "soccer",
    title: round.title,
    media: {
      sphericalImageUrl: getSphericalImageUrl(round.id),
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

function getSphericalImageUrl(roundId: string) {
  return worldCupImages.events[roundId]?.images?.find((image) => image.imageUrl)?.imageUrl
    ?? matchPhotoPlaceholder;
}
