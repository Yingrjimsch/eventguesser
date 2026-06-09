import { useEffect, useRef, useState } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import "@photo-sphere-viewer/core/index.css";

type PanoramaStatus = "loading" | "ready" | "error";

type PanoramaViewerProps = {
  panoramaUrl: string;
  title?: string;
};

export function PanoramaViewer({ panoramaUrl, title }: PanoramaViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [status, setStatus] = useState<PanoramaStatus>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return undefined;
    }

    setStatus("loading");
    setErrorMessage(null);

    let cancelled = false;

    const containerElement = container;

    async function createViewer() {
      try {
        const resolvedPanorama = await resolvePanoramaSource(panoramaUrl);

        if (cancelled) {
          return;
        }

        const viewer = new Viewer({
          container: containerElement,
          panorama: resolvedPanorama,
          caption: title,
          defaultZoomLvl: 35,
          mousewheel: true,
          navbar: false,
          loadingTxt: "Loading panorama",
        });

        viewer.addEventListener("panorama-loaded", () => {
          setStatus("ready");
        });

        viewer.addEventListener("panorama-error", (event) => {
          setStatus("error");
          setErrorMessage(event.error.message);
        });

        viewerRef.current = viewer;
      } catch (error) {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(error instanceof Error ? error.message : "Unknown panorama error");
        }
      }
    }

    void createViewer();

    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [panoramaUrl, title]);

  return (
    <div className="panorama-viewer-shell" aria-label={title ?? "Event panorama"}>
      <div className="panorama-viewer" ref={containerRef} />

      {status === "loading" ? (
        <div className="panorama-state" role="status">
          Loading panorama
        </div>
      ) : null}

      {status === "error" ? (
        <div className="panorama-state panorama-state-error" role="alert">
          <strong>Panorama failed to load</strong>
          {errorMessage ? <span>{errorMessage}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

async function resolvePanoramaSource(panoramaUrl: string) {
  if (panoramaUrl.endsWith(".svg")) {
    return createGeneratedStadiumPanorama();
  }

  if (!isLikelyEquirectangularAsset(panoramaUrl)) {
    return createSphericalTextureFromImage(panoramaUrl);
  }

  if (await hasEquirectangularAspectRatio(panoramaUrl)) {
    return panoramaUrl;
  }

  return createSphericalTextureFromImage(panoramaUrl);
}

function isLikelyEquirectangularAsset(panoramaUrl: string) {
  return panoramaUrl.includes("/panoramas/");
}

function hasEquirectangularAspectRatio(imageUrl: string) {
  return new Promise<boolean>((resolve) => {
    const image = new Image();

    image.onload = () => {
      const aspectRatio = image.naturalWidth / image.naturalHeight;
      resolve(aspectRatio > 1.9 && aspectRatio < 2.1);
    };

    image.onerror = () => {
      resolve(false);
    };

    image.crossOrigin = "anonymous";
    image.src = imageUrl;
  });
}

function createSphericalTextureFromImage(imageUrl: string) {
  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      const width = 2048;
      const height = 1024;
      const ctx = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;

      if (!ctx) {
        reject(new Error("Canvas rendering is not available"));
        return;
      }

      ctx.fillStyle = "#111816";
      ctx.fillRect(0, 0, width, height);

      const sourceAspect = image.naturalWidth / image.naturalHeight;
      const targetAspect = width / height;
      let sourceX = 0;
      let sourceY = 0;
      let sourceWidth = image.naturalWidth;
      let sourceHeight = image.naturalHeight;

      if (sourceAspect > targetAspect) {
        sourceWidth = image.naturalHeight * targetAspect;
        sourceX = (image.naturalWidth - sourceWidth) / 2;
      } else {
        sourceHeight = image.naturalWidth / targetAspect;
        sourceY = (image.naturalHeight - sourceHeight) / 2;
      }

      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        width,
        height,
      );

      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };

    image.onerror = () => {
      reject(new Error(`Could not load image: ${imageUrl}`));
    };

    image.crossOrigin = "anonymous";
    image.src = imageUrl;
  });
}

function createGeneratedStadiumPanorama() {
  const canvas = document.createElement("canvas");
  const width = 2048;
  const height = 1024;
  const ctx = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;

  if (!ctx) {
    throw new Error("Canvas rendering is not available");
  }

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, "#87b8d2");
  sky.addColorStop(0.55, "#d9c68d");
  sky.addColorStop(1, "#5f8c68");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#2f7e4f";
  ctx.fillRect(0, 620, width, 404);

  drawEllipse(ctx, 1024, 610, 1110, 220, "#254a42");
  drawEllipse(ctx, 1024, 640, 970, 174, "#d9dfd7");
  drawEllipse(ctx, 1024, 692, 780, 128, "#243733");
  drawEllipse(ctx, 1024, 724, 710, 108, "#2f7e4f");

  ctx.fillStyle = "rgba(255,255,255,0.58)";
  for (let i = 0; i < 950; i += 1) {
    const x = (i * 97) % width;
    const y = 430 + ((i * 37) % 150);
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = "rgba(247,244,233,0.9)";
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.ellipse(1024, 810, 520, 94, 0, Math.PI, 0);
  ctx.stroke();

  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(1024, 620);
  ctx.lineTo(1024, height);
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(1024, 842, 150, 42, 0, 0, Math.PI * 2);
  ctx.stroke();

  drawFlag(ctx, 140, 560, "#d53748");
  drawFlag(ctx, 214, 548, "#f4c84e");
  drawFlag(ctx, 300, 562, "#2c7bbe");
  drawFlag(ctx, 1686, 562, "#d53748");
  drawFlag(ctx, 1760, 548, "#f4c84e");
  drawFlag(ctx, 1846, 560, "#2c7bbe");

  return canvas.toDataURL("image/jpeg", 0.92);
}

function drawEllipse(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  fillStyle: string,
) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawFlag(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  fillStyle: string,
) {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  ctx.roundRect(x, y, 64, 42, 3);
  ctx.fill();
}
