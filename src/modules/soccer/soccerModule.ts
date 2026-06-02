import type { GameModule } from "../../game/gameTypes";
import { defaultScoringConfig } from "../../game/scoring";

export const soccerModule: GameModule = {
  id: "soccer",
  label: "Soccer",
  description: "Guess the stadium and date of memorable soccer events.",
  mediaTypes: ["panorama"],
  guessFields: ["location", "time"],
  scoring: defaultScoringConfig,
};
