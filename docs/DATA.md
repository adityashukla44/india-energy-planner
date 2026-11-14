# Data, sources and assumptions

All app data lives as JSON in `client/public/data/`. You can update it without touching code.

## Updating data

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
