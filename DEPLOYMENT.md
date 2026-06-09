# World Cup Guesser Deployment Plan

## Current Shape

- The app is a static Vite/React frontend.
- The JavaScript and CSS build output is small enough for a normal static web container.
- The panorama assets dominate deployment size: `public` is about 3.6 GB, while only the 502 referenced panorama files are about 1.42 GB.
- Vite copies everything under `public` into `dist`, so unreferenced generated image candidates are currently shipped too.

## Recommended Architecture

Use two delivery paths:

1. Serve the Vite app from a small nginx container in Kubernetes.
2. Serve panorama PNGs from object storage or a CDN-backed static host.

Good asset targets:

- S3, Azure Blob Storage, GCS, or MinIO.
- A static nginx service backed by a persistent volume, if object storage is not available.
- A CDN in front of the asset host once the game has external users.

This keeps application rollouts small. A UI-only change should not require pulling a multi-GB image on every Kubernetes node.

## Phase 1: Curate Runtime Assets

Before containerizing, move or copy only referenced panorama files into the runtime asset location.

Target result:

- Keep all generated attempts outside `public`.
- Keep only active game assets in a deployable asset directory.
- Regenerate `src/modules/soccer/worldCupPublicMedia.ts` so URLs point either to `/panoramas/...` or to an external asset base URL.

If assets stay in the app container, the curated image is still roughly 1.42 GB before Docker layer overhead. That works for a private deployment, but it will make pulls and rollbacks slow.

## Phase 2: Production Container

Use a multi-stage build:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
```

Use nginx caching rules:

```nginx
server {
  listen 8080;
  root /usr/share/nginx/html;
  index index.html;

  location = /index.html {
    add_header Cache-Control "no-cache";
  }

  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  location /panoramas/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  location / {
    try_files $uri /index.html;
  }
}
```

Create a `.dockerignore` before building images:

```gitignore
.git
node_modules
dist
scraped
*.local
.DS_Store
```

If panoramas are externalized, also ignore `public/panoramas` and inject the asset base URL during build.

## Phase 3: Kubernetes Resources

Create:

- `Deployment` for the nginx app container.
- `Service` on port 8080.
- `Ingress` for the public hostname.
- `ConfigMap` for nginx config if you do not bake it into the image.
- Optional separate static-asset `Deployment` or object-storage sync job if assets are not in the app image.

Baseline pod settings:

- Run as non-root.
- `readOnlyRootFilesystem: true`.
- Drop Linux capabilities.
- Add readiness and liveness probes against `/`.
- Start with low CPU and memory requests for nginx, then tune from ingress metrics.

## Phase 4: CI/CD

Pipeline:

1. `npm ci`
2. `npm run build`
3. Build and push Docker image.
4. Sync panorama assets if they are external.
5. Deploy with Helm or Kustomize.
6. Smoke test the Ingress URL and at least one panorama URL.

Use immutable image tags, for example the Git SHA. Use a separate stable tag only as a pointer.

## Phase 5: Production Checks

- Confirm browser access to OpenStreetMap tiles or replace them with a production tile provider.
- Add a Content Security Policy that permits the app host, panorama host, and map tile host.
- Check largest panorama load time on mobile.
- Add 404 monitoring for panorama URLs.
- Decide whether old generated attempts belong in archival storage rather than the app repo.
