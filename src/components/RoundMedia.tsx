import type { EventRound } from "../game/gameTypes";
import { EventImage } from "./EventImage";
import { PanoramaViewer } from "./PanoramaViewer";

type RoundMediaProps = {
  round: EventRound;
};

export function RoundMedia({ round }: RoundMediaProps) {
  const panoramaUrl = round.media.panoramaUrl ?? round.media.sphericalImageUrl;
  const imageUrl = round.media.imageUrl;

  if (panoramaUrl) {
    return <PanoramaViewer panoramaUrl={panoramaUrl} title={round.title} />;
  }

  if (imageUrl) {
    return <EventImage imageUrl={imageUrl} title={round.title} />;
  }

  return (
    <div className="panorama-missing" role="alert">
      Event media unavailable
    </div>
  );
}
