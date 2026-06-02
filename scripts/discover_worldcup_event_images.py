import argparse
import json
import time
import urllib.parse
import urllib.request
from urllib.error import HTTPError
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVENTS_INPUT = ROOT / "src" / "data" / "worldCupEventsSince1998.json"
OUTPUT = ROOT / "src" / "data" / "worldCupEventImages.json"
USER_AGENT = "EventGuessrImageDiscovery/0.1"


def main():
    args = parse_args()
    source = json.loads(EVENTS_INPUT.read_text(encoding="utf-8"))
    events = source["events"][args.start :]

    if args.limit:
        events = events[: args.limit]

    payload = load_existing_payload()
    images_by_event_id = payload.setdefault("events", {})
    scanned_without_images = set(payload.setdefault("scannedWithoutImages", []))

    for index, event in enumerate(events, start=args.start + 1):
        if not args.refresh and (
            event["id"] in images_by_event_id or event["id"] in scanned_without_images
        ):
            print(f"[{index}/{len(source['events'])}] already scanned: {event['id']}", flush=True)
            continue

        category = commons_match_category(event)
        files = fetch_category_files(category)

        if not files:
            scanned_without_images.add(event["id"])
            print(f"[{index}/{len(source['events'])}] no category files: {event['id']}", flush=True)
            continue

        image_infos = fetch_image_infos([file["title"] for file in files[:8]])

        if image_infos:
            images_by_event_id[event["id"]] = {
                "category": category,
                "images": image_infos,
            }
            scanned_without_images.discard(event["id"])
            print(
                f"[{index}/{len(source['events'])}] {event['id']}: {len(image_infos)} images",
                flush=True,
            )
        else:
            scanned_without_images.add(event["id"])
            print(f"[{index}/{len(source['events'])}] no image metadata: {event['id']}", flush=True)

        time.sleep(0.35)

    payload["scannedWithoutImages"] = sorted(scanned_without_images)

    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"Wrote images for {len(images_by_event_id)} events and "
        f"{len(scanned_without_images)} misses to {OUTPUT}"
    )


def parse_args():
    parser = argparse.ArgumentParser(
        description="Discover Wikimedia Commons images for World Cup match events."
    )
    parser.add_argument(
        "--start",
        type=int,
        default=0,
        help="Zero-based event offset to start from.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Maximum number of events to scan. Use 0 for all events.",
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="Rescan events even if they already have an image or known miss.",
    )

    return parser.parse_args()


def load_existing_payload():
    if OUTPUT.exists():
        payload = json.loads(OUTPUT.read_text(encoding="utf-8"))
        payload.setdefault("schemaVersion", 1)
        payload.setdefault("events", {})
        payload.setdefault("scannedWithoutImages", [])
        return payload

    return {
        "schemaVersion": 1,
        "description": (
            "Match-specific Wikimedia Commons images keyed by World Cup event id. "
            "Images are discovered from per-match Commons categories where available."
        ),
        "sources": [
            {
                "name": "Wikimedia Commons",
                "url": "https://commons.wikimedia.org/",
                "usedFor": "Freely licensed match image discovery and image metadata.",
            }
        ],
        "events": {},
        "scannedWithoutImages": [],
    }


def commons_match_category(event):
    match_number = int(event["id"].rsplit("-", 1)[-1])
    year = event["tournament"]["year"]
    home = event["teams"]["home"]["name"]
    away = event["teams"]["away"]["name"]

    return f"Category:{year} FIFA World Cup Match {match_number}, {home} v {away}"


def fetch_category_files(category):
    params = {
        "action": "query",
        "format": "json",
        "list": "categorymembers",
        "cmtitle": category,
        "cmtype": "file",
        "cmlimit": "50",
    }
    data = commons_api(params)

    return data.get("query", {}).get("categorymembers", [])


def fetch_image_infos(titles):
    params = {
        "action": "query",
        "format": "json",
        "prop": "imageinfo",
        "titles": "|".join(titles),
        "iiprop": "url|extmetadata|mime",
        "iiurlwidth": "2048",
    }
    data = commons_api(params)
    pages = data.get("query", {}).get("pages", {}).values()
    images = []

    for page in pages:
        imageinfo = (page.get("imageinfo") or [{}])[0]
        metadata = imageinfo.get("extmetadata") or {}
        image_url = imageinfo.get("thumburl") or imageinfo.get("url")

        if not image_url:
            continue

        images.append(
            {
                "title": page.get("title"),
                "pageUrl": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(page.get('title', '').replace(' ', '_'))}",
                "imageUrl": image_url,
                "sourceUrl": imageinfo.get("descriptionurl"),
                "license": metadata_value(metadata, "LicenseShortName"),
                "artist": metadata_value(metadata, "Artist"),
                "credit": metadata_value(metadata, "Credit"),
                "mime": imageinfo.get("mime"),
            }
        )

    return images


def metadata_value(metadata, key):
    value = metadata.get(key, {}).get("value")

    return value if value else None


def commons_api(params):
    encoded = urllib.parse.urlencode(params)
    request = urllib.request.Request(
        f"https://commons.wikimedia.org/w/api.php?{encoded}",
        headers={"User-Agent": USER_AGENT},
    )

    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            if error.code != 429 or attempt == 4:
                raise

            retry_after = error.headers.get("retry-after")
            delay = int(retry_after) if retry_after and retry_after.isdigit() else 2 ** attempt
            time.sleep(delay)

    raise RuntimeError("Commons API request failed after retries")


if __name__ == "__main__":
    main()
