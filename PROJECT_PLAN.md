# EventGuessr Project Plan

## 1. Product Concept

Build a React-based guessing game inspired by GeoGuessr, but centered around real-world events.

In each round, the player explores a 360-degree panorama or other event media, then guesses:

- Where the event happened.
- When the event happened.

The first playable category will be soccer matches. The system should be built as a generic event guessing engine so future categories, such as concerts or historical events, can reuse the same game loop.

## 2. Product Goals

- Provide a simple, polished single-player guessing game.
- Support equirectangular/spherical panoramas as the main round experience.
- Make location and time guessing equally important.
- Keep the content model modular so new event categories can be added later.
- Work well on laptops and mobile devices.
- Leave a clean path toward future multiplayer.

## 3. MVP Scope

The first version should include:

- React frontend.
- Single-player game mode.
- Soccer category only.
- Fixed curated dataset.
- Configurable number of rounds.
- Countdown timer per round.
- 360 panorama viewer.
- Normal event image fallback when true 360 media is not available.
- Map-based location guessing.
- Date or time guessing UI.
- Equal scoring weight for location and time.
- Speed multiplier based on remaining time.
- Timeout gives 0 points for the round.
- Round result screen.
- Final results summary.
- Responsive desktop and mobile layout.

Out of scope for the MVP:

- Multiplayer.
- User accounts.
- Leaderboards.
- User-uploaded panoramas.
- Multiple categories.
- Backend administration tools.
- Public content moderation.

## 4. Core Game Loop

1. Player opens the app.
2. Player starts a single-player game.
3. Player chooses game settings:
   - Category: Soccer.
   - Number of rounds.
   - Timer duration.
4. A round starts.
5. Player explores the panorama.
6. Player makes a location guess on a map.
7. Player makes a time guess.
8. Player submits before the countdown reaches zero.
9. App calculates the score.
10. Round result screen shows:
    - Player guessed location.
    - Correct location.
    - Distance error.
    - Player guessed time.
    - Correct time.
    - Time error.
    - Time used.
    - Round score.
11. After all rounds, final results are shown.

## 5. Event Module System

The app should be designed as:

```txt
Game Engine + Event Modules + Curated Dataset
```

The core game engine should not be soccer-specific. It should understand generic event concepts:

- Category.
- Media.
- Required guess fields.
- Correct answer.
- Scoring configuration.
- Round metadata.

Each module can define:

- Which media types it supports.
- Which guesses are required.
- How scores are weighted.
- Which metadata fields are displayed after the guess.

Initial module:

```txt
Soccer Match Module
```

Possible future modules:

- Concerts.
- Historical events.
- Music releases.
- News events.
- Sports beyond soccer.

## 6. Soccer Module

The first module should focus on soccer matches or soccer-related events.

The player sees a panorama from a stadium, match location, fan zone, or event-relevant place.

The player guesses:

- Match/event location.
- Match/event date.

Useful soccer metadata:

- Competition.
- Home team.
- Away team.
- Stadium.
- City.
- Country.
- Final score.
- Season.
- Match date.

Metadata should mostly be hidden during the round and revealed after submission.

## 7. Data Model

Suggested generic round shape:

```ts
type EventCategory = "soccer";

type EventMedia = {
  panoramaUrl?: string;
  imageUrl?: string;
  audioUrl?: string;
};

type EventAnswer = {
  location: {
    lat: number;
    lng: number;
  };
  occurredAt: string;
};

type EventRound = {
  id: string;
  category: EventCategory;
  title?: string;
  media: EventMedia;
  answer: EventAnswer;
  metadata?: Record<string, unknown>;
};
```

Suggested soccer metadata:

```ts
type SoccerMetadata = {
  competition?: string;
  homeTeam?: string;
  awayTeam?: string;
  stadium?: string;
  city?: string;
  country?: string;
  finalScore?: string;
  season?: string;
};
```

Suggested game settings:

```ts
type GameSettings = {
  category: EventCategory;
  roundCount: number;
  roundDurationSeconds: number;
};
```

Suggested guess shape:

```ts
type RoundGuess = {
  roundId: string;
  guessedLocation: {
    lat: number;
    lng: number;
  };
  guessedTime: string;
  secondsUsed: number;
};
```

## 8. Scoring Model

For the MVP, time and location should be equally important.

Recommended model:

```txt
Max round score: 5000
Location component: 2500 max
Time component: 2500 max
Speed: multiplier
Timeout: 0 points
```

Formula:

```txt
baseScore = locationScore + timeScore
finalScore = baseScore * speedMultiplier
```

Example speed multiplier:

```txt
100% time remaining: 1.00x
50% time remaining: 0.90x
10% time remaining: 0.75x
Timeout: 0.00x
```

This keeps correctness more important than speed while still rewarding fast guesses.

Scoring should be configurable:

```ts
type ScoringConfig = {
  maxRoundScore: number;
  locationWeight: number;
  timeWeight: number;
  speedMultiplierMin: number;
  timeoutScore: number;
};
```

Initial values:

```ts
const defaultScoringConfig = {
  maxRoundScore: 5000,
  locationWeight: 0.5,
  timeWeight: 0.5,
  speedMultiplierMin: 0.75,
  timeoutScore: 0,
};
```

## 9. Time Guessing

Open decision: choose the initial precision.

Recommended MVP approach:

- Store exact dates when known.
- Let the player guess a date.
- Score based on the difference in days.

This keeps the data flexible for future event types.

Alternative simpler MVP:

- Guess only the year.
- Score based on year difference.

This is easier, but less expressive for soccer matches because exact match dates are usually known.

Recommended default:

```txt
Use a date picker or timeline date input for MVP.
```

## 10. Location Guessing

The player should place a marker on a map.

The app should calculate distance between guessed and correct coordinates.

Recommended MVP map library:

- Leaflet for a simple first implementation.

Possible future upgrade:

- MapLibre GL for a more polished vector map experience.

Location scoring should be based on distance in kilometers. The distance curve should be configurable per category or difficulty.

## 11. UI Screens

### Start Screen

Purpose:

- Start a new game.
- Choose basic settings.

Controls:

- Category selector.
- Round count selector.
- Timer duration selector.
- Start button.

For MVP, the category selector only contains Soccer.

### Round Screen

Purpose:

- Let the player inspect the event media and make guesses.

Main elements:

- Panorama viewer.
- Countdown timer.
- Current round indicator.
- Score so far.
- Guess controls.
- Submit button.

Desktop layout:

- Panorama dominates the screen.
- Guess panel appears beside or below the panorama.

Mobile layout:

- Panorama fills most of the screen.
- Timer and primary actions remain visible.
- Guess controls can live in a bottom sheet or tabbed panel.

### Guess Panel

Controls:

- Map with draggable marker.
- Date input or timeline input.
- Submit button.

Submission should be disabled until both required guesses are provided.

### Round Result Screen

Purpose:

- Show what happened and how the player scored.

Display:

- Map line between guessed and correct location.
- Distance error.
- Correct location details.
- Guessed date.
- Correct date.
- Time error.
- Speed multiplier.
- Round score.
- Continue button.

### Final Results Screen

Purpose:

- Summarize the full game.

Display:

- Total score.
- Score per round.
- Best round.
- Worst round.
- Average distance error.
- Average time error.
- Play again button.

## 12. Technical Architecture

Recommended initial stack:

- React.
- TypeScript.
- Vite.
- Photo Sphere Viewer or Three.js for panoramas.
- Leaflet for map guessing.
- Local JSON or TypeScript dataset for curated rounds.
- CSS modules, plain CSS, or a lightweight styling approach.

Suggested source structure:

```txt
src/
  app/
    App.tsx
  game/
    gameTypes.ts
    scoring.ts
    gameState.ts
  modules/
    soccer/
      soccerModule.ts
      soccerRounds.ts
  components/
    PanoramaViewer.tsx
    GuessMap.tsx
    TimeGuessInput.tsx
    Timer.tsx
    RoundResult.tsx
    FinalResults.tsx
  styles/
    global.css
```

## 13. Dataset Plan

The MVP should use a fixed curated dataset.

Recommended first dataset size:

```txt
10 to 20 soccer rounds
```

Each round needs:

- Panorama image or event image.
- Correct latitude and longitude.
- Correct date.
- Soccer metadata.

Dataset quality matters more than quantity. A small set of good rounds is better than many weak rounds.

For the best 360 experience, a panorama should be an equirectangular image with a 2:1 aspect ratio that represents a full 360-degree horizontal and 180-degree vertical view. Normal match photos can still be used as event images, but they should not be forced into the panorama viewer because they will distort and will not behave like real spherical scenes.

Panorama source options:

- Own 360 photos.
- Licensed public panorama images.
- Generated or manually prepared equirectangular images.
- Placeholder test panoramas during development.

Important: avoid depending on image sources that do not allow reuse.

## 14. Future Multiplayer Direction

The MVP should not implement multiplayer, but the architecture should avoid blocking it.

Future multiplayer mode could work like this:

- Players join a room.
- Host starts a game.
- All players receive the same round at the same time.
- Each player submits guesses before the timer expires.
- Scores are revealed after everyone submits or time runs out.
- A scoreboard appears after each round.

Future backend needs:

- Rooms.
- Player sessions.
- Round synchronization.
- Server-side timers.
- Score validation.
- Real-time updates via WebSockets or a managed realtime service.

Design implication for MVP:

- Keep game state explicit.
- Keep scoring deterministic.
- Keep round data serializable.
- Avoid hiding core scoring logic inside UI components.

## 15. Implementation Phases

### Phase 1: Project Foundation

Goal:

- Create the React/TypeScript app and basic game shell.

Tasks:

- Initialize Vite React TypeScript project.
- Add basic routing or screen state.
- Add global styling.
- Define core types.
- Add soccer module placeholder.
- Add small mock dataset.
- Create start screen.
- Create basic game state flow.

Deliverable:

- A working app that can start a soccer game and move through placeholder rounds.

### Phase 2: Panorama Round Experience

Goal:

- Display real or placeholder equirectangular panoramas in a playable round screen.

Tasks:

- Install panorama viewer library.
- Build `PanoramaViewer` component.
- Load panorama from round data.
- Support desktop mouse drag.
- Support mobile touch drag.
- Handle loading and error states.

Deliverable:

- Player can inspect a 360 scene for each round.

### Phase 3: Guessing UI

Goal:

- Let the player submit location and time guesses.

Tasks:

- Add map library.
- Build `GuessMap` component.
- Allow marker placement.
- Build `TimeGuessInput`.
- Validate required guesses.
- Connect submit action to game state.

Deliverable:

- Player can submit a complete guess for each round.

### Phase 4: Scoring and Results

Goal:

- Calculate and show meaningful scores.

Tasks:

- Implement distance calculation.
- Implement time difference calculation.
- Implement location score.
- Implement time score.
- Implement speed multiplier.
- Add timeout behavior.
- Build round result screen.
- Build final results screen.

Deliverable:

- A full single-player game can be completed and scored.

### Phase 5: Responsive Polish

Goal:

- Make the game feel good on laptop and mobile.

Tasks:

- Refine desktop layout.
- Refine mobile layout.
- Add bottom-sheet or tabbed guess controls for mobile.
- Improve button states and spacing.
- Check text overflow.
- Check panorama/map sizing.
- Add accessible labels where needed.

Deliverable:

- The MVP is usable and visually clean across common screen sizes.

### Phase 6: Dataset Expansion

Goal:

- Replace mock data with a curated soccer dataset.

Tasks:

- Collect 10 to 20 soccer events.
- Add valid panorama assets.
- Add coordinates.
- Add event dates.
- Add metadata.
- Test each round manually.

Deliverable:

- The game has enough real content to be replayable.

## 16. Open Decisions

Before implementation, decide:

- Should time guessing use exact date or year-only for the first version?
- What should the default round duration be?
- How many rounds should be the default?
- Should the map be visible immediately or opened from a guess button?
- Should the player be allowed to change a guess before submitting?
- Should timeout instantly end the round or show a timeout result screen?
- What panorama viewer library should be used?
- What map library should be used?
- Where will the initial panorama assets come from?

Recommended defaults:

- Time guessing: exact date.
- Default round duration: 90 seconds.
- Default round count: 5.
- Map behavior: visible in desktop guess panel, bottom sheet on mobile.
- Guess changes: allowed until submit.
- Timeout: end round immediately with 0 points.
- Panorama library: Photo Sphere Viewer first, Three.js only if more control is needed.
- Map library: Leaflet first.

## 17. Success Criteria For MVP

The MVP is successful when:

- A player can start a soccer game.
- A player can complete multiple rounds.
- Each round displays a panorama.
- Each round accepts a location guess and time guess.
- Timer behavior is clear.
- Timeout gives 0 points.
- Scores feel understandable.
- Results clearly explain the score.
- The app works well on mobile and desktop.
- The code structure supports adding another category later.
