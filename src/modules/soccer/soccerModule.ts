import type { GameModule } from "../../game/gameTypes";
import { defaultScoringConfig } from "../../game/scoring";

export const soccerModule: GameModule = {
  id: "soccer",
  label: "World Cup",
  description: "Guess the stadium and tournament year from World Cup match panoramas.",
  mediaTypes: ["panorama"],
  guessFields: ["location", "time"],
  scoring: defaultScoringConfig,
};
