import type { EventMedia, EventRound } from "../../game/gameTypes";

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

type WorldCupMediaDataPayload = {
  media: Record<string, EventMedia>;
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

const roundDataUrl =
  import.meta.env.VITE_WORLD_CUP_ROUND_DATA_URL || "/data/worldCupRoundData.json";
const mediaDataUrl =
  import.meta.env.VITE_WORLD_CUP_MEDIA_DATA_URL || "/data/worldCupMediaData.json";

export async function loadSoccerRounds() {
  const [roundData, mediaData] = await Promise.all([
    fetchJson<WorldCupRoundDataPayload>(roundDataUrl),
    fetchJson<WorldCupMediaDataPayload>(mediaDataUrl),
  ]);

  return roundData.rounds.map((round) => toEventRound(round, mediaData.media[round.id]));
}

export function hasRoundPanorama(round: EventRound) {
  return Boolean(round.media.panoramas?.length);
}

function toEventRound(
  round: WorldCupRound,
  media: EventMedia | undefined,
): EventRound<SoccerMetadata> {
  const panoramas = media?.panoramas ?? [];
  const panorama = panoramas.length > 0 ? pickRandomItem(panoramas) : undefined;

  return {
    id: round.id,
    category: "soccer",
    title: round.title,
    media: {
      ...(media ?? {}),
      panorama,
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
  };
}

function pickRandomItem<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-cache" });

  if (!response.ok) {
    throw new Error(`Could not load ${url} (${response.status})`);
  }

  return response.json() as Promise<T>;
}
