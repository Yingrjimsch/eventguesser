import { useEffect, useRef } from "react";
import L, { type LeafletMouseEvent, type Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "../game/gameTypes";

type GuessMapProps = {
  value: GeoPoint | null;
  correctValue?: GeoPoint;
  disabled?: boolean;
  showConnection?: boolean;
  onChange: (point: GeoPoint) => void;
};

const defaultCenter: GeoPoint = {
  lat: 18,
  lng: 0,
};

const guessIcon = L.divIcon({
  className: "guess-marker",
  html: "<span></span>",
  iconSize: [30, 38],
  iconAnchor: [15, 36],
});

const correctIcon = L.divIcon({
  className: "guess-marker correct-marker",
  html: "<span></span>",
  iconSize: [30, 38],
  iconAnchor: [15, 36],
});

export function GuessMap({
  value,
  correctValue,
  disabled = false,
  showConnection = false,
  onChange,
}: GuessMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const correctMarkerRef = useRef<L.Marker | null>(null);
  const connectionRef = useRef<L.Polyline | null>(null);
  const onChangeRef = useRef(onChange);
  const disabledRef = useRef(disabled);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  useEffect(() => {
    const mapContainer = mapContainerRef.current;

    if (!mapContainer || mapRef.current) {
      return undefined;
    }

    const map = L.map(mapContainer, {
      center: [defaultCenter.lat, defaultCenter.lng],
      zoom: 3,
      minZoom: 3,
      scrollWheelZoom: true,
      touchZoom: true,
      maxBounds: [
        [-72, -180],
        [84, 180],
      ],
      worldCopyJump: true,
      zoomControl: false,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          "Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China, TomTom",
        maxZoom: 18,
      },
    ).addTo(map);

    map.on("click", (event: LeafletMouseEvent) => {
      if (disabledRef.current) {
        return;
      }

      onChangeRef.current({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      });
    });

    const invalidateSizeSoon = () => {
      window.setTimeout(() => map.invalidateSize(), 180);
      window.setTimeout(() => map.invalidateSize(), 360);
    };

    mapContainer.addEventListener("pointerenter", invalidateSizeSoon);
    mapContainer.addEventListener("focusin", invalidateSizeSoon);
    mapContainer.addEventListener("transitionend", invalidateSizeSoon);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];

      if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        map.invalidateSize();
      }
    });

    resizeObserver.observe(mapContainer);
    mapRef.current = map;

    return () => {
      mapContainer.removeEventListener("pointerenter", invalidateSizeSoon);
      mapContainer.removeEventListener("focusin", invalidateSizeSoon);
      mapContainer.removeEventListener("transitionend", invalidateSizeSoon);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      correctMarkerRef.current = null;
      connectionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }

    const position: L.LatLngExpression = [value.lat, value.lng];

    if (!markerRef.current) {
      markerRef.current = L.marker(position, {
        draggable: !disabled,
        icon: guessIcon,
      }).addTo(map);

      markerRef.current.on("dragend", () => {
        const markerPosition = markerRef.current?.getLatLng();

        if (markerPosition) {
          onChangeRef.current({
            lat: markerPosition.lat,
            lng: markerPosition.lng,
          });
        }
      });
    } else {
      markerRef.current.setLatLng(position);
      if (disabled) {
        markerRef.current.dragging?.disable();
      } else {
        markerRef.current.dragging?.enable();
      }
    }
  }, [disabled, value]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    correctMarkerRef.current?.remove();
    correctMarkerRef.current = null;
    connectionRef.current?.remove();
    connectionRef.current = null;

    if (!correctValue) {
      return;
    }

    const correctPosition: L.LatLngExpression = [correctValue.lat, correctValue.lng];
    correctMarkerRef.current = L.marker(correctPosition, {
      icon: correctIcon,
      interactive: false,
    }).addTo(map);

    if (value && showConnection) {
      const guessPosition: L.LatLngExpression = [value.lat, value.lng];

      connectionRef.current = L.polyline([guessPosition, correctPosition], {
        color: "#ffffff",
        dashArray: "7 8",
        opacity: 0.92,
        weight: 3,
      }).addTo(map);

      map.fitBounds(L.latLngBounds([guessPosition, correctPosition]).pad(0.45), {
        animate: true,
        maxZoom: 5,
      });
    }
  }, [correctValue, showConnection, value]);

  return <div className="guess-map" ref={mapContainerRef} />;
}
