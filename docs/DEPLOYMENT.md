# Deployment

The app is one Node service: `npm run build` builds the site and server, `npm start` serves both on `PORT`. On first start with an empty database it loads the sample complaints automatically.

## Render (free tier)

1. In Render choose **New → Blueprint** and pick this repository.
2. `render.yaml` sets everything up (Node 22, build and start commands, health check, a generated `ADMIN_TOKEN`).
3. Add `ANTHROPIC_API_KEY` in the service's **Environment** tab to turn on the AI assistant.

## Any Docker host (Railway, Fly.io, etc.)

The `Dockerfile` builds and runs the app on port 8787.

```bash
docker build -t india-energy-planner .
docker run -p 8787:8787 --env-file .env india-energy-planner
```

## Notes on free hosting

The free Render service sleeps after about 15 minutes idle (the first visit then takes up to a minute), and its disk is temporary, so logged complaints reset on each redeploy. Attach a persistent disk and set `DB_PATH` to keep them.

## Offline (PWA)

After one online visit, every page and all data (districts, costs, boundary, subsidies, helplines, FAQ, sample complaints) are cached by the service worker. Complaints made offline are stored in IndexedDB and sent automatically when the connection returns. Only the AI assistant needs the internet.
