import csv
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path


YEARS = [1998, 2002, 2006, 2010, 2014, 2018, 2022]
ROOT = Path(__file__).resolve().parents[1]
SCRAPED = ROOT / "scraped"
OUTPUT = ROOT / "src" / "data" / "worldCupEventsSince1998.json"
COORDINATE_CACHE = SCRAPED / "stadium_coordinates_cache.json"
COORDINATE_OVERRIDES = {
    "Stade de la Beaujoire": {"lat": 47.2534, "lng": -1.5219},
    "Parc des Princes": {"lat": 48.841465, "lng": 2.252616},
    "Daegu World Cup Stadium": {"lat": 35.8245, "lng": 128.6875},
    "Daegu Stadium": {"lat": 35.8245, "lng": 128.6875},
    "Volksparkstadion": {"lat": 53.58722, "lng": 9.89861},
    "Fritz-Walter-Stadion": {"lat": 49.4342, "lng": 7.7725},
    "Cape Town Stadium": {"lat": -33.903469, "lng": 18.411102},
    "Arena Pantanal": {"lat": -15.6031, "lng": -56.1206},
}


def main():
    stadiums = read_csv(SCRAPED / "fjelstul_stadiums.csv")
    matches = read_csv(SCRAPED / "fjelstul_matches.csv")
    stadium_by_id = {stadium["stadium_id"]: stadium for stadium in stadiums}
    relevant_matches = [
        match
        for match in matches
        if match["tournament_id"] in {f"WC-{year}" for year in YEARS}
    ]
    coordinates_by_title = load_coordinate_cache()
    coordinates_by_title.update(COORDINATE_OVERRIDES)
    missing_titles = sorted(
        {
            wikipedia_title(stadium_by_id[match["stadium_id"]]["stadium_wikipedia_link"])
            for match in relevant_matches
            if wikipedia_title(stadium_by_id[match["stadium_id"]]["stadium_wikipedia_link"])
            not in coordinates_by_title
        }
    )

    if missing_titles:
        coordinates_by_title.update(fetch_coordinates(missing_titles))
        COORDINATE_CACHE.write_text(
            json.dumps(coordinates_by_title, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )

    events = [
        create_event(match, stadium_by_id[match["stadium_id"]], coordinates_by_title)
        for match in relevant_matches
    ]
    payload = {
        "schemaVersion": 1,
        "description": (
            "Men's FIFA World Cup match/event data from France 1998 through "
            "Qatar 2022, generated from the Fjelstul World Cup Database with "
            "stadium coordinates resolved from stadium Wikipedia pages."
        ),
        "coverage": {
            "competition": "FIFA Men's World Cup",
            "years": YEARS,
            "expectedMatchesPerTournament": 64,
            "totalMatches": len(events),
        },
        "sources": [
            {
                "name": "The Fjelstul World Cup Database",
                "url": "https://github.com/jfjelstul/worldcup",
                "usedFor": "Match list, dates, stages, teams, scores, stadiums, cities, countries, stadium Wikipedia links.",
            },
            {
                "name": "Wikipedia / MediaWiki GeoData",
                "url": "https://www.mediawiki.org/wiki/Extension:GeoData",
                "usedFor": "Latitude and longitude coordinates from stadium pages linked by the source dataset.",
            },
            {
                "name": "Public stadium coordinate lookups",
                "url": "https://latitude.to/",
                "usedFor": "Fallback coordinates where linked stadium pages did not expose MediaWiki GeoData coordinates.",
            },
        ],
        "events": events,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    missing_coordinates = [
        event for event in events if event["location"]["lat"] is None or event["location"]["lng"] is None
    ]
    print(f"Wrote {len(events)} events to {OUTPUT}")
    print(f"Missing coordinates: {len(missing_coordinates)}")


def read_csv(path):
    with path.open(newline="", encoding="utf-8") as file:
        return list(csv.DictReader(file))


def load_coordinate_cache():
    if not COORDINATE_CACHE.exists():
        return {}

    return json.loads(COORDINATE_CACHE.read_text(encoding="utf-8"))


def fetch_coordinates(titles):
    coordinates = {}
    chunks = [titles[index : index + 50] for index in range(0, len(titles), 50)]

    for chunk in chunks:
        params = urllib.parse.urlencode(
            {
                "action": "query",
                "format": "json",
                "prop": "coordinates",
                "colimit": "max",
                "redirects": "1",
                "titles": "|".join(chunk),
            }
        )
        request = urllib.request.Request(
            f"https://en.wikipedia.org/w/api.php?{params}",
            headers={"User-Agent": "EventGuessrDataBuilder/0.1"},
        )

        with urllib.request.urlopen(request, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))

        query = data.get("query", {})
        redirect_target_by_source = {
            redirect["from"]: redirect["to"] for redirect in query.get("redirects", [])
        }
        page_coordinates_by_title = {}

        for page in query.get("pages", {}).values():
            title = page.get("title")
            page_coordinates = page.get("coordinates") or []

            if title and page_coordinates:
                page_coordinates_by_title[title] = {
                    "lat": page_coordinates[0].get("lat"),
                    "lng": page_coordinates[0].get("lon"),
                }
            elif title:
                page_coordinates_by_title[title] = {"lat": None, "lng": None}

        coordinates.update(page_coordinates_by_title)

        for source_title, target_title in redirect_target_by_source.items():
            coordinates[source_title] = page_coordinates_by_title.get(
                target_title,
                {"lat": None, "lng": None},
            )

        time.sleep(0.25)

    return coordinates


def create_event(match, stadium, coordinates_by_title):
    year = int(match["tournament_id"].replace("WC-", ""))
    stadium_title = wikipedia_title(stadium["stadium_wikipedia_link"])
    coordinates = coordinates_by_title.get(stadium_title, {"lat": None, "lng": None})
    score = {
        "fullTime": {
            "home": int(match["home_team_score"]),
            "away": int(match["away_team_score"]),
        },
        "display": match["score"],
        "afterExtraTime": parse_bool(match["extra_time"]),
        "penaltyShootout": parse_bool(match["penalty_shootout"]),
    }

    if match["score_penalties"]:
        score["penalties"] = {
            "home": int(match["home_team_score_penalties"]),
            "away": int(match["away_team_score_penalties"]),
            "display": match["score_penalties"],
        }

    return {
        "id": match["match_id"],
        "tournament": {
            "id": match["tournament_id"],
            "name": match["tournament_name"],
            "year": year,
        },
        "stage": match["stage_name"],
        "group": normalize_group(match["group_name"]),
        "date": match["match_date"],
        "time": match["match_time"] or None,
        "teams": {
            "home": {
                "id": match["home_team_id"],
                "name": match["home_team_name"],
                "code": match["home_team_code"],
            },
            "away": {
                "id": match["away_team_id"],
                "name": match["away_team_name"],
                "code": match["away_team_code"],
            },
        },
        "score": score,
        "stadium": {
            "id": match["stadium_id"],
            "name": stadium["stadium_name"],
            "city": stadium["city_name"],
            "country": stadium["country_name"],
            "capacity": parse_int(stadium["stadium_capacity"]),
            "wikipediaUrl": stadium["stadium_wikipedia_link"],
        },
        "location": {
            "lat": coordinates.get("lat"),
            "lng": coordinates.get("lng"),
        },
        "detailUrl": detail_url(year, match),
        "summary": summary(year, match, stadium),
    }


def summary(year, match, stadium):
    home = match["home_team_name"]
    away = match["away_team_name"]
    stage = match["stage_name"]
    place = f'{stadium["stadium_name"]} in {stadium["city_name"]}, {stadium["country_name"]}'
    score = match["score"]

    if parse_bool(match["penalty_shootout"]):
        return (
            f"In the {stage} of the {year} FIFA World Cup, {home} and {away} "
            f"finished {score} at {place}, with the tie decided by a penalty shootout."
        )

    return (
        f"In the {stage} of the {year} FIFA World Cup, {home} played {away} "
        f"at {place}; the match finished {score}."
    )


def detail_url(year, match):
    base = f"https://en.wikipedia.org/wiki/{year}_FIFA_World_Cup"

    group = normalize_group(match["group_name"])

    if group:
        return f"{base}_{group.replace(' ', '_')}"

    stage = match["stage_name"].lower()
    anchor = {
        "round of 16": "Round_of_16",
        "quarter-finals": "Quarter-finals",
        "semi-finals": "Semi-finals",
        "third-place match": "Third_place_play-off",
        "final": "Final",
    }.get(stage, stage.replace(" ", "_"))

    return f"{base}_knockout_stage#{anchor}"


def wikipedia_title(url):
    path = urllib.parse.urlparse(url).path
    title = path.rsplit("/", 1)[-1]
    return urllib.parse.unquote(title).replace("_", " ")


def parse_bool(value):
    return value.lower() in {"1", "true", "yes"}


def normalize_group(value):
    if not value or value == "not applicable":
        return None

    return value


def parse_int(value):
    return int(value) if value else None


if __name__ == "__main__":
    main()
