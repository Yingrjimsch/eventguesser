import type { EventRound } from "../game/gameTypes";
import { PanoramaViewer } from "./PanoramaViewer";

type RoundMediaProps = {
  round: EventRound;
};

export function RoundMedia({ round }: RoundMediaProps) {
  const panoramaUrl = round.media.panorama?.url;

  if (panoramaUrl) {
    return <PanoramaViewer panoramaUrl={panoramaUrl} title={round.title} />;
  }

  return (
    <div className="panorama-missing" role="alert">
      Event media unavailable
    </div>
  );
}
