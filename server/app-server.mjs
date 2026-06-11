import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const port = Number(process.env.PORT ?? 8080);
const distDir = resolve(process.env.DIST_DIR ?? "dist");
const dataDir = resolve(process.env.DATA_DIR ?? "/app/data");
const panoramaDir = resolve(process.env.PANORAMA_DIR ?? "/app/panoramas");
const repo = process.env.GITHUB_REPOSITORY ?? "Yingrjimsch/eventguesser";
const githubToken = process.env.GITHUB_TOKEN;
const reportLabel = process.env.GITHUB_REPORT_LABEL ?? "image-report";
const duplicateWindowMs = Number(process.env.REPORT_DUPLICATE_WINDOW_MS ?? 60_000);
const recentReports = new Map();
const rooms = new Map();

const modernPlayerNames = [
  "Lionel Messi",
  "Cristiano Ronaldo",
  "Zinedine Zidane",
  "Ronaldo Nazário",
  "Ronaldinho",
  "Kylian Mbappé",
  "Neymar",
  "Luka Modrić",
  "Andrés Iniesta",
  "Xavi",
  "Gianluigi Buffon",
  "Iker Casillas",
  "Miroslav Klose",
  "Thierry Henry",
  "Erling Haaland",
  "Vinícius Júnior",
  "Jude Bellingham",
  "Lamine Yamal",
  "Jamal Musiala",
  "Florian Wirtz",
  "Pedri",
  "Gavi",
  "Rodri",
  "Kevin De Bruyne",
  "Mohamed Salah",
  "Sadio Mané",
  "Harry Kane",
  "Robert Lewandowski",
  "Karim Benzema",
  "Antoine Griezmann",
  "Eden Hazard",
  "Luis Suárez",
  "Sergio Agüero",
  "Wayne Rooney",
  "Zlatan Ibrahimović",
  "Gareth Bale",
  "Toni Kroos",
  "Sergio Ramos",
  "Gerard Piqué",
  "Carles Puyol",
  "Marcelo",
  "Dani Alves",
  "Philipp Lahm",
  "Manuel Neuer",
  "Thibaut Courtois",
  "Virgil van Dijk",
  "Alisson Becker",
  "Ederson",
  "Joshua Kimmich",
  "Thomas Müller",
  "Mesut Özil",
  "Ángel Di María",
  "Paulo Dybala",
  "Lautaro Martínez",
  "Julián Álvarez",
  "Phil Foden",
  "Bukayo Saka",
  "Declan Rice",
  "Cole Palmer",
  "Khvicha Kvaratskhelia",
  "Victor Osimhen",
  "Rafael Leão",
  "Bruno Fernandes",
  "Bernardo Silva",
  "João Cancelo",
  "Heung-min Son",
  "Achraf Hakimi",
  "Riyad Mahrez",
  "Yaya Touré",
  "Didier Drogba",
  "Samuel Eto'o",
  "Cesc Fàbregas",
  "David Villa",
  "Fernando Torres",
  "Kaká",
  "Andrea Pirlo",
  "Alessandro Del Piero",
  "Francesco Totti",
  "Steven Gerrard",
  "Frank Lampard",
  "Paul Scholes",
  "Raúl",
  "Arjen Robben",
  "Franck Ribéry",
  "Bastian Schweinsteiger",
  "David Beckham",
  "Ruud van Nistelrooy",
  "Michael Ballack",
  "Clarence Seedorf",
  "Sergio Busquets",
  "N'Golo Kanté",
  "Casemiro",
  "Raphaël Varane",
  "Pepe",
  "Giorgio Chiellini",
];

const classicPlayerNames = [
  "Pelé",
  "Diego Maradona",
  "Johan Cruyff",
  "Franz Beckenbauer",
  "Gerd Müller",
  "Paolo Maldini",
  "Roberto Baggio",
  "Zico",
  "Bobby Charlton",
  "Ferenc Puskás",
  "Michel Platini",
  "George Best",
  "Lev Yashin",
  "Eusébio",
  "Garrincha",
  "Alfredo Di Stéfano",
  "Gianni Rivera",
  "Giacinto Facchetti",
  "Bobby Moore",
  "Dino Zoff",
  "Kenny Dalglish",
  "Gheorghe Hagi",
  "Romário",
  "Hristo Stoichkov",
  "Lothar Matthäus",
  "Ruud Gullit",
  "Marco van Basten",
  "Sócrates",
  "Carlos Alberto",
  "Jairzinho",
  "Rivellino",
];

const playerNames = [...modernPlayerNames, ...classicPlayerNames];

const scoringConfig = {
  locationWeight: 0.5,
  maxRoundScore: 5000,
  speedMultiplierMin: 0.75,
  timeWeight: 0.5,
  timeoutScore: 0,
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

    if (request.method === "GET" && url.pathname === "/healthz") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }

    await serveStatic(response, url.pathname);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error";
    sendJson(response, 500, { error: message });
  }
});

server.listen(port, () => {
  console.log(`Eventguesser server listening on ${port}`);
});

async function handleApi(request, response, url) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, null);
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/reports") {
    await handleReport(request, response);
    return;
  }

  const roomMatch = url.pathname.match(/^\/api\/rooms(?:\/([^/]+))?(?:\/([^/]+))?$/);

  if (roomMatch) {
    await handleRoomApi(request, response, url, roomMatch[1], roomMatch[2]);
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function handleRoomApi(request, response, url, roomId, action) {
  if (request.method === "POST" && !roomId) {
    const payload = await readJsonBody(request);
    const room = await createRoom(payload);
    const host = addPlayer(room, true);
    sendRoom(response, room, host.id);
    return;
  }

  const room = roomId ? rooms.get(roomId) : null;

  if (!room) {
    sendJson(response, 404, { error: "Room not found" });
    return;
  }

  if (request.method === "GET" && action === "events") {
    subscribeToRoom(request, response, room, url.searchParams.get("playerId") ?? "");
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  if (action === "join") {
    const payload = await readJsonBody(request);
    const existingPlayerId =
      typeof payload?.playerId === "string" ? payload.playerId.trim() : "";
    const player = existingPlayerId && room.players.has(existingPlayerId)
      ? room.players.get(existingPlayerId)
      : addPlayer(room, false);

    broadcastRoom(room);
    sendRoom(response, room, player.id);
    return;
  }

  const payload = await readJsonBody(request);
  const player = room.players.get(readRequiredString(payload, "playerId"));

  if (!player) {
    sendJson(response, 403, { error: "Unknown player" });
    return;
  }

  if (action === "start") {
    assertHost(room, player);
    room.phase = "round";
    room.currentRoundIndex = 0;
    room.roundStartedAt = Date.now();
    broadcastRoom(room);
    sendRoom(response, room, player.id);
    return;
  }

  if (action === "guess") {
    submitPlayerGuess(room, player, payload, false);
    broadcastRoom(room);
    sendRoom(response, room, player.id);
    return;
  }

  if (action === "timeout") {
    submitPlayerGuess(room, player, payload, true);
    broadcastRoom(room);
    sendRoom(response, room, player.id);
    return;
  }

  if (action === "next") {
    assertHost(room, player);

    if (!isCurrentRoundComplete(room)) {
      sendJson(response, 409, { error: "Waiting for every player to submit" });
      return;
    }

    if (room.currentRoundIndex >= room.rounds.length - 1) {
      room.phase = "final";
    } else {
      room.currentRoundIndex += 1;
      room.roundStartedAt = Date.now();
    }

    broadcastRoom(room);
    sendRoom(response, room, player.id);
    return;
  }

  sendJson(response, 404, { error: "Room action not found" });
}

async function createRoom(payload) {
  const settings = {
    category: "soccer",
    roundCount: clampNumber(Number(payload?.roundCount ?? 5), 1, 20),
    roundDurationSeconds: clampNumber(Number(payload?.roundDurationSeconds ?? 90), 30, 180),
  };
  const availableRounds = await loadRounds();
  const room = {
    clients: new Set(),
    createdAt: Date.now(),
    currentRoundIndex: 0,
    hostId: "",
    id: createRoomId(),
    phase: "lobby",
    players: new Map(),
    playerNameQueue: shuffle(playerNames),
    roundStartedAt: null,
    rounds: selectRandomRounds(availableRounds, settings.roundCount),
    settings,
  };

  rooms.set(room.id, room);
  return room;
}

function addPlayer(room, isHost) {
  const player = {
    id: randomUUID(),
    isHost,
    name: nextPlayerName(room),
    outcomes: [],
  };

  room.players.set(player.id, player);

  if (isHost) {
    room.hostId = player.id;
  }

  return player;
}

function subscribeToRoom(request, response, room, playerId) {
  response.writeHead(200, {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Content-Type": "text/event-stream",
  });
  response.write(`event: state\ndata: ${JSON.stringify(createRoomState(room, playerId))}\n\n`);

  const client = { playerId, response };
  room.clients.add(client);

  request.on("close", () => {
    room.clients.delete(client);
  });
}

function broadcastRoom(room) {
  for (const client of room.clients) {
    client.response.write(
      `event: state\ndata: ${JSON.stringify(createRoomState(room, client.playerId))}\n\n`,
    );
  }
}

function sendRoom(response, room, playerId) {
  sendJson(response, 200, createRoomState(room, playerId));
}

function createRoomState(room, playerId) {
  const players = [...room.players.values()].map((player) => ({
    id: player.id,
    isHost: player.id === room.hostId,
    isYou: player.id === playerId,
    name: player.name,
    outcomes: player.outcomes,
    score: player.outcomes.reduce((total, outcome) => total + outcome.score.totalScore, 0),
  }));

  return {
    currentRoundIndex: room.currentRoundIndex,
    hostId: room.hostId,
    isHost: playerId === room.hostId,
    leaderboard: players
      .map((player) => ({
        id: player.id,
        isYou: player.isYou,
        name: player.name,
        score: player.score,
      }))
      .sort((a, b) => b.score - a.score),
    phase: room.phase,
    playerId,
    players,
    roomId: room.id,
    roundStartedAt: room.roundStartedAt,
    rounds: room.rounds,
    settings: room.settings,
  };
}

function submitPlayerGuess(room, player, payload, timedOut) {
  if (room.phase !== "round") {
    throw new Error("Room is not in a round");
  }

  const round = room.rounds[room.currentRoundIndex];

  if (!round || player.outcomes.some((outcome) => outcome.roundId === round.id)) {
    return;
  }

  if (timedOut) {
    player.outcomes.push({
      roundId: round.id,
      score: createTimeoutRoundScore(),
      timedOut: true,
    });
    return;
  }

  const guess = {
    guessedLocation: payload.guessedLocation,
    guessedTime: readRequiredString(payload, "guessedTime"),
    roundId: round.id,
    secondsUsed: Math.max(
      0,
      Math.round((Date.now() - (room.roundStartedAt ?? Date.now())) / 1000),
    ),
  };

  player.outcomes.push({
    guess,
    roundId: round.id,
    score: calculateRoundScore(round, guess, room.settings.roundDurationSeconds),
    timedOut: false,
  });
}

function assertHost(room, player) {
  if (room.hostId !== player.id) {
    throw new Error("Only the host can do this");
  }
}

async function loadRounds() {
  const [roundData, mediaData] = await Promise.all([
    readJsonFile(join(dataDir, "worldCupRoundData.json")),
    readJsonFile(join(dataDir, "worldCupMediaData.json")),
  ]);

  return roundData.rounds.map((round) => {
    const media = mediaData.media[round.id] ?? {};
    const panoramas = media.panoramas ?? [];

    return {
      answer: {
        location: round.location,
        occurredAt: round.occurredAt,
      },
      category: "soccer",
      id: round.id,
      media: {
        ...media,
        panorama: panoramas.length > 0 ? pickRandomItem(panoramas) : undefined,
      },
      metadata: {
        city: round.city,
        competition: round.competition,
        country: round.country,
        detailUrl: round.detailUrl,
        finalScore: round.finalScore,
        group: round.group ?? undefined,
        homeTeam: round.homeTeam,
        awayTeam: round.awayTeam,
        penaltyScore: round.penaltyScore ?? undefined,
        season: round.season,
        stage: round.stage,
        stadium: round.stadium,
        summary: round.summary,
      },
      title: round.title,
    };
  });
}

function selectRandomRounds(rounds, roundCount) {
  const mediaReadyRounds = rounds.filter((round) => Boolean(round.media.panoramas?.length));
  const remainingRounds = rounds.filter((round) => !round.media.panoramas?.length);

  return [...shuffle(mediaReadyRounds), ...shuffle(remainingRounds)].slice(0, roundCount);
}

function nextPlayerName(room) {
  const usedNames = new Set([...room.players.values()].map((player) => player.name));

  const queuedName = room.playerNameQueue.find((name) => !usedNames.has(name));

  return queuedName ?? `Player ${room.players.size + 1}`;
}

function isCurrentRoundComplete(room) {
  const round = room.rounds[room.currentRoundIndex];

  if (!round || room.players.size === 0) {
    return false;
  }

  return [...room.players.values()].every((player) =>
    player.outcomes.some((outcome) => outcome.roundId === round.id),
  );
}

function createRoomId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function pickRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function calculateRoundScore(round, guess, roundDurationSeconds) {
  const distanceKm = calculateDistanceKm(
    round.answer.location.lat,
    round.answer.location.lng,
    guess.guessedLocation.lat,
    guess.guessedLocation.lng,
  );
  const dateErrorDays = calculateDateErrorDays(round.answer.occurredAt, guess.guessedTime);
  const locationScore = calculateLocationScore(distanceKm);
  const timeScore = calculateTimeScore(dateErrorDays);
  const speedMultiplier = calculateSpeedMultiplier(guess.secondsUsed, roundDurationSeconds);

  return {
    dateErrorDays,
    distanceKm,
    locationScore,
    speedMultiplier,
    timeScore,
    totalScore: Math.round((locationScore + timeScore) * speedMultiplier),
  };
}

function createTimeoutRoundScore() {
  return {
    dateErrorDays: null,
    distanceKm: null,
    locationScore: 0,
    speedMultiplier: 0,
    timeScore: 0,
    totalScore: scoringConfig.timeoutScore,
  };
}

function calculateDistanceKm(firstLat, firstLng, secondLat, secondLng) {
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

function calculateDateErrorDays(correctDate, guessedDate) {
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

function calculateLocationScore(distanceKm) {
  const maxScore = Math.round(scoringConfig.maxRoundScore * scoringConfig.locationWeight);

  return Math.round(Math.max(0, Math.min(maxScore, maxScore * Math.exp(-distanceKm / 1800))));
}

function calculateTimeScore(dateErrorDays) {
  const maxScore = Math.round(scoringConfig.maxRoundScore * scoringConfig.timeWeight);

  if (!Number.isFinite(dateErrorDays)) {
    return 0;
  }

  return Math.round(Math.max(0, Math.min(maxScore, maxScore * Math.exp(-dateErrorDays / 365))));
}

function calculateSpeedMultiplier(secondsUsed, roundDurationSeconds) {
  if (roundDurationSeconds <= 0 || secondsUsed >= roundDurationSeconds) {
    return scoringConfig.speedMultiplierMin;
  }

  const remainingRatio = Math.max(
    0,
    Math.min(1, (roundDurationSeconds - secondsUsed) / roundDurationSeconds),
  );

  return scoringConfig.speedMultiplierMin + (1 - scoringConfig.speedMultiplierMin) * remainingRatio;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function extractYear(value) {
  const match = value.match(/^\d{4}/);

  return match ? Number(match[0]) : null;
}

async function handleReport(request, response) {
  if (!githubToken) {
    sendJson(response, 500, { error: "Report service is not configured" });
    return;
  }

  const payload = validateReportPayload(await readJsonBody(request));
  const clientKey = createClientKey(request, payload);

  if (isRecentlyReported(clientKey)) {
    sendJson(response, 202, { status: "deduplicated" });
    return;
  }

  rememberReport(clientKey);

  const existingIssue = await findExistingIssue(payload);

  if (existingIssue) {
    await createIssueComment(existingIssue.number, payload);
    sendJson(response, 200, { issueUrl: existingIssue.html_url, status: "commented" });
    return;
  }

  const issue = await createIssue(payload);
  sendJson(response, 201, { issueUrl: issue.html_url, status: "created" });
}

function validateReportPayload(value) {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid report payload");
  }

  return {
    imageName: readRequiredString(value, "imageName"),
    imageUrl: readRequiredString(value, "imageUrl"),
    match: readRequiredString(value, "match"),
    place: readOptionalString(value, "place"),
    roundId: readRequiredString(value, "roundId"),
  };
}

function createClientKey(request, payload) {
  const forwardedFor = request.headers["x-forwarded-for"];
  const ip = Array.isArray(forwardedFor)
    ? forwardedFor[0]
    : forwardedFor?.split(",")[0] ?? request.socket.remoteAddress ?? "unknown";

  return `${ip}:${payload.roundId}:${payload.imageName}`;
}

function isRecentlyReported(key) {
  pruneRecentReports();

  return recentReports.has(key);
}

function rememberReport(key) {
  recentReports.set(key, Date.now());
}

function pruneRecentReports() {
  const cutoff = Date.now() - duplicateWindowMs;

  for (const [key, timestamp] of recentReports.entries()) {
    if (timestamp < cutoff) {
      recentReports.delete(key);
    }
  }
}

async function findExistingIssue(payload) {
  const imageHash = createImageHash(payload);
  const query = encodeURIComponent(`repo:${repo} is:issue is:open "${imageHash}"`);
  const result = await githubRequest(`/search/issues?q=${query}`);

  return result.items?.[0] ?? null;
}

async function createIssue(payload) {
  const issue = {
    body: createIssueBody(payload),
    labels: [reportLabel],
    title: `Image report: ${payload.roundId} ${payload.imageName}`,
  };

  try {
    return await githubRequest(`/repos/${repo}/issues`, {
      body: JSON.stringify(issue),
      method: "POST",
    });
  } catch (error) {
    console.warn(`Creating labeled issue failed, retrying without label: ${error.message}`);
    return githubRequest(`/repos/${repo}/issues`, {
      body: JSON.stringify({
        body: issue.body,
        title: issue.title,
      }),
      method: "POST",
    });
  }
}

async function createIssueComment(issueNumber, payload) {
  return githubRequest(`/repos/${repo}/issues/${issueNumber}/comments`, {
    body: JSON.stringify({
      body: [
        "Additional report received.",
        "",
        `Reported image: ${payload.imageName}`,
        `Match code: ${payload.roundId}`,
        `Image hash: ${createImageHash(payload)}`,
      ].join("\n"),
    }),
    method: "POST",
  });
}

function createIssueBody(payload) {
  return [
    "## Image report",
    "",
    `Match code: ${payload.roundId}`,
    `Match: ${payload.match}`,
    `Place: ${payload.place || "Unknown"}`,
    `Image name: ${payload.imageName}`,
    `Image path: ${payload.imageUrl}`,
    `Image hash: ${createImageHash(payload)}`,
    "",
    "A player reported that this panorama is bad or not recognizable.",
  ].join("\n");
}

function createImageHash(payload) {
  return createHash("sha256")
    .update(`${payload.roundId}:${payload.imageName}:${payload.imageUrl}`)
    .digest("hex")
    .slice(0, 16);
}

async function githubRequest(path, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "Content-Type": "application/json",
      "User-Agent": "eventguesser-report-api",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(body?.message ?? `GitHub request failed (${response.status})`);
  }

  return body;
}

async function serveStatic(response, urlPath) {
  const decodedPath = decodeURIComponent(urlPath);

  if (decodedPath.startsWith("/data/")) {
    serveFile(response, dataDir, decodedPath.replace(/^\/data\/?/, ""));
    return;
  }

  if (decodedPath.startsWith("/panoramas/")) {
    serveFile(response, panoramaDir, decodedPath.replace(/^\/panoramas\/?/, ""));
    return;
  }

  const filePath = decodedPath === "/" ? "index.html" : decodedPath.slice(1);
  const didServe = serveFile(response, distDir, filePath, false);

  if (!didServe) {
    serveFile(response, distDir, "index.html");
  }
}

function serveFile(response, root, relativePath, sendNotFound = true) {
  const safePath = normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(root, safePath);

  if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    if (sendNotFound) {
      sendJson(response, 404, { error: "Not found" });
    }

    return false;
  }

  response.writeHead(200, {
    "Cache-Control": getCacheControl(filePath),
    "Content-Type": getContentType(filePath),
  });
  createReadStream(filePath).pipe(response);
  return true;
}

function getCacheControl(filePath) {
  if (filePath.includes("/assets/") || filePath.includes("/models/") || filePath.includes("/panoramas/")) {
    return "public, max-age=31536000, immutable";
  }

  return "no-cache";
}

function getContentType(filePath) {
  const extension = extname(filePath).toLowerCase();

  return {
    ".css": "text/css",
    ".glb": "model/gltf-binary",
    ".html": "text/html",
    ".ico": "image/x-icon",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
  }[extension] ?? "application/octet-stream";
}

async function readJsonFile(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonBody(request) {
  let body = "";

  for await (const chunk of request) {
    body += chunk;

    if (body.length > 20_000) {
      throw new Error("Payload is too large");
    }
  }

  return body ? JSON.parse(body) : {};
}

function readRequiredString(value, key) {
  const field = value[key];

  if (typeof field !== "string" || field.trim().length === 0) {
    throw new Error(`Missing ${key}`);
  }

  return field.trim();
}

function readOptionalString(value, key) {
  const field = value[key];

  return typeof field === "string" && field.trim() ? field.trim() : "";
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": process.env.CORS_ORIGIN ?? "*",
    "Content-Type": "application/json",
  });

  response.end(body === null ? "" : JSON.stringify(body));
}
