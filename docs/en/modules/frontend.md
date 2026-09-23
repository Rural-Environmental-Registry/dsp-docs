# rer-dsp-frontend

This module is part of the [DSP](../index.md) — see the full documentation in [rer-dsp-docs](../index.md). The information below covers this module only.

## Purpose

The `rer-dsp-frontend` is the DSP web UI: search by territorial hierarchy, KPIs, interactive map, and supporting screens (Geoservices, About).

## Responsibilities

- Render Home with territorial search/hierarchy, KPIs, and map.
- Consume the backend API for business data and configuration.
- Consume GeoServer Exhibition (WMS/WFS) directly for map layer display.

## Stack

| Item | Value |
|------|--------|
| Framework | Vue 3 (Composition API) + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Maps | [`@rural-environmental-registry/map_component`](https://www.npmjs.com/package/@rural-environmental-registry/map_component) (Leaflet-based) |
| Tests | Vitest |

## How to run

| Command | Action |
|---------|--------|
| `npm run dev` | Dev server on port 5173 |
| `npm run build` | Type-check + production build (Vite) |
| `npm run test` / `npm run coverage` | Tests with Vitest |

Docker: multi-stage build, served by nginx:alpine at `/dsp/`, port 8080 in the container. Does not publish a port on the host — external access goes through the core gateway at `/dsp/`.

## Environment variables

| Variable | Purpose |
|----------|--------|
| `VITE_BASE_URL` | Application base path (default `/dsp/`) |
| `VITE_DSP_API_URL` | Backend URL (default `/dsp-backend`, relative path resolved by the gateway on the same origin). If missing at build time, the value is read at runtime from `public/config/env.json` (`urlBackend` field) |

Runtime config via `public/config/env.json` lets you change the backend URL **without rebuilding** the image — mount a different file by volume/ConfigMap.

## Main screens

| Screen | Content |
|--------|---------|
| Home | Territorial search/hierarchy + KPIs + map |
| Geoservices | Geospatial layers |
| About | Adopter-configurable content — banner and tabs from `GET /config/about` (`aboutService.ts`), rendered as Markdown (`marked` + `DOMPurify`, via `renderMarkdown.ts`); if disabled in config, the tab section and menu item are hidden |

## Map component

The Home map uses the shared package [`@rural-environmental-registry/map_component`](https://www.npmjs.com/package/@rural-environmental-registry/map_component), Leaflet-based.

| Item | Value |
|------|--------|
| Role in DSP | WMS display + theme/sub-layer menu with toggle |
| Layer source | Backend API only (`GET /map/getBaseMaps`, `GET /map/getLayers`) — no local fallback; configuration failures are visible in the UI |

The map component consumes `/map/getBaseMaps` and `/map/getLayers` and integrates GeoServer Exhibition (WMS/WFS) via the `map_component` package. Business orchestration (filters, map click → property detail) lives in the DSP frontend, not in the package itself.

On the Home detail panel, `screens.home.detail.fields` (via `GET /config/installation`) defines fields and order. Values come from `attributes` in the detail response. Empty or missing list: the current 8 fields from the structural DTO. Download and “nearby others” stay outside that list.

## Backend integration

Endpoints consumed by the frontend:

| Endpoint | Use |
|----------|-----|
| `GET /config/installation` | Labels, hierarchy, screens, KPIs, and `screens.home.detail.fields` |
| `GET /downloads/themes` | Download themes |
| `POST /downloads/search` | Search items by hierarchy/theme |
| `GET /downloads/file` | CSV file download via backend |
| `GET /map/getBaseMaps` | Base maps |
| `GET /map/getLayers` | Map layers |
| `GET /geoServices/getRegions` | Regions |
| `GET /state/getAll` | States |

See also: [Data flow](../architecture/data-flow.md), [Architecture](../architecture/overview.md).
