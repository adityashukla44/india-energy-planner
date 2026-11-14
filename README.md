# India Energy Planner

FlairQuest 2.0 Ideathon, Track 8: Energy & Resource Management.

Pick an Indian district on a 3D map, see its energy profile, describe local demand (homes, a clinic, a school, water pumps, streetlights), and get an auto-designed solar / wind / small-hydro / battery / diesel system. The app prices it over 20 years and plans a month-by-month rollout.

It also finds matching subsidies, ranks all 50 districts by impact, answers questions through an AI assistant, and lets people log and track power complaints (with a 3D outage heatmap). It works in English, Hindi, Tamil and Bengali, and offline after the first visit.

Pages: Home · Map · Planner · Costs · Rollout · Impact · Subsidies · Help · Complaints · Heatmap · Data & Assumptions.

## Setup

Requirements: Node 22 or newer (tested on Node 26).

```bash
npm install
cp .env.example .env
npm run seed     # load the 42 sample complaints (marked "Sample") for the heatmap
npm run dev      # API on :8787, web app on http://localhost:5173
npm test         # unit tests (Vitest): engine, subsidies, FAQ search, chat streaming, translations
npm run test:e2e # Playwright smoke test: every page, desktop + phone, offline mode
npm run build    # production build (includes the service worker)
npm start        # serves the built app + API on PORT (default 8787)
```

First Playwright run only: `npx playwright install chromium`.

`.env` variables:

| Variable | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Turns on the AI assistant on the Help page. Without it, the assistant answers from the FAQ instead. Never sent to the browser. |
| `ANTHROPIC_MODEL` | Optional. Defaults to `claude-opus-5-5`. |
| `ADMIN_TOKEN` | Required to change a complaint's status (`PATCH /api/complaints/:id/status`). |
| `PORT` | API / production server port (default 8787). |

## Deploy (public website)

The app is one Node service: `npm run build` builds the site and server, `npm start` serves both on `PORT`. On first start with an empty database it loads the sample complaints automatically.

**Render (free tier):** push this folder to a GitHub repo, then in Render choose **New → Blueprint** and pick the repo. `render.yaml` sets everything up (Node 22, build and start commands, health check, a generated `ADMIN_TOKEN`). Add `ANTHROPIC_API_KEY` in the service's **Environment** tab to turn on the AI assistant.

**Any Docker host (Railway, Fly.io, etc.):** the `Dockerfile` builds and runs the app on port 8787.

Free hosting notes: the free Render service sleeps after about 15 minutes idle (the first visit then takes up to a minute), and its disk is temporary, so logged complaints reset on each redeploy. Attach a persistent disk and set `DB_PATH` to keep them.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Status, and whether AI is configured |
| POST | `/api/complaints` | `{type, state, district, details, contact?, clientId?}` → `{ticketId, status}`. Validated with zod, rate-limited. `clientId` makes offline retries safe (no duplicates). |
| GET | `/api/complaints?state=&district=&type=&ids=` | Public list. Contact details are never included. |
| PATCH | `/api/complaints/:id/status` | `Authorization: Bearer <ADMIN_TOKEN>`, body `{status}`: `logged` → `routed` → `acknowledged` → `resolved` |
| GET | `/api/complaints/heatmap` | Counts by district and type |
| POST | `/api/chat` | Streams the assistant reply (server-sent events). On any failure returns `{code}` so the app falls back to FAQ search. |

## Offline

The app is a PWA. After one online visit, every page and all data (districts, costs, boundary, subsidies, helplines, FAQ, sample complaints) are cached by the service worker. Complaints made offline are stored in IndexedDB and sent automatically when the connection returns. Only the AI assistant needs the internet.

## Structure

```
client/          Vite + React 18 + TypeScript + Tailwind
  src/engine/    pure planning maths (resource, demand, sizing, costs, lifecycle, rollout, impact, plan) + tests
  src/three/     react-three-fiber scenes (hero, 3D map, district diorama, system scene, procedural models)
  src/pages/     one route per page
  src/i18n/      en, hi, ta, bn strings
  public/data/   all data as JSON: districts, costs, india-boundary, subsidies, helplines, faq, sample-complaints
server/          Express + TypeScript (helmet, cors, rate limit, zod), SQLite via better-sqlite3
  src/routes/    health, complaints, chat
e2e/             Playwright smoke tests
scripts/         data tools (district generator, NASA POWER import)
```

## Updating data (no code needed)

- **Costs:** edit `client/public/data/costs.json`. Each item has `value` (the default), optional `min`/`max`/`step` (slider range), `kind` (`sourced` or `assumption`) and `source` (a key into `sources`). Assumptions show an "Assumption" label in the app.
- **Add a district:** add one object to `client/public/data/districts.json` with the same fields as the others: `id, name, state, category, lat, lon, population_est, demand_mwh_yr_est, ghi_monthly[12], wind50m_monthly[12], small_hydro_potential, biomass_potential, geothermal_potential, grid_access, diesel_dependence, sources, illustrative`. It appears on every page automatically.
- **Real solar/wind data:** download NASA POWER monthly climatology CSVs (`ALLSKY_SFC_SW_DWN` and `WS50M`) per district from the [Data Access Viewer](https://power.larc.nasa.gov/data-access-viewer/), save them as `data-raw/<district-id>.csv`, then run `npm run import:nasa`. Those districts become `illustrative: false`.
- **Subsidies:** edit `subsidies.json`. Each scheme lists `projectTypes`, `states` (`"all"` or a list), `status` (`active` / `transition`), `rules`, `url` and a `calc` block (`pmsg_home`, `per_kw_capped`, `pct` or `none`).
- **Helplines:** edit `helplines.json`. Only confirmed numbers go in `number`; for DISCOMs, `discom_number` stays `"To verify"` until checked, with the official `url`.
- **FAQ:** edit `faq.json` (`q` in en/hi/ta/bn, `a` in English, optional `tags` to help search).
- `npm run data:districts` regenerates the illustrative values from `scripts/build-districts.mjs`. It overwrites `districts.json`, so don't run it after hand edits.

## Data sources

Every sourced figure is listed in the app on **Data & Assumptions** (`/data`), linked from the footer. Main sources: Business Today (solar cost, PM Surya Ghar), QuickEstimate (batteries), Secured Engineers (diesel vs grid vs solar), CERC draft RE tariffs FY 2026-27, MNRE Solar Atlas + Solargis tiers (via InfraLens), Pulse / T&D India / Mercom (national figures), Ministry of Power (1912).

## Map boundary: please verify

`client/public/data/india-boundary.geojson` is built from **DataMeet's Survey of India based state boundaries** (`States/Admin2` in https://github.com/datameet/maps, CC BY 4.0). It includes all of Jammu & Kashmir and Ladakh, following the official map of India. The file has 36 states/UTs plus a dissolved country outline, simplified for the web:

```bash
npx mapshaper -i Admin2.shp -rename-layers states -rename-fields name=ST_NM -simplify 1.6% keep-shapes weighted -clean \
  -each 'kind="state"' -dissolve2 + name=country -each 'kind="country"; name="India"' target=country \
  -merge-layers target=country,states force name=india -o format=geojson precision=0.001 india-boundary.geojson
```

**Flagged for verification:** check it against the Survey of India's official political map before publishing.

## Key assumptions

- Sizing uses each month's average day, not hourly weather: an estimate from monthly averages, not a guarantee.
- The worst solar month includes one low-sun spell (storm slider, 1–5 days, solar at 35%). Battery autonomy goes from 1 day to 2 days across that range.
- PV starts at demand ÷ (worst-month GHI × 0.75) × 1.1. The engine then adds PV or battery, whichever is cheaper per unit of shortfall removed, until the worst month meets ≥ 99% of demand.
- The cheapest option (20-year NPV) that meets the target is recommended. Geothermal is shown only as potential and never sized.
- District resource values are **illustrative** until NASA POWER data is imported.

## Translations

English, Hindi, Tamil and Bengali cover every label, button, result sentence, chart axis, error message and FAQ question. FAQ answers and the long technical paragraphs on the Data & Assumptions page stay in English. District and state names stay in English. Numbers use the Indian format (lakh, crore).

**A native speaker must review the Hindi, Tamil and Bengali translations before public use.** A unit test checks that every translation has the same keys and `{{placeholders}}` as English.
