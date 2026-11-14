# API reference

The Express server (`server/`) exposes a small JSON API under `/api`. In development it runs on port 8787 and Vite proxies `/api` to it; in production the same server also serves the built web app.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Status, and whether AI is configured |
| POST | `/api/complaints` | `{type, state, district, details, contact?, clientId?}` → `{ticketId, status}`. Validated with zod, rate-limited. `clientId` makes offline retries safe (no duplicates). |
| GET | `/api/complaints?state=&district=&type=&ids=` | Public list. Contact details are never included. |
| PATCH | `/api/complaints/:id/status` | `Authorization: Bearer <ADMIN_TOKEN>`, body `{status}`: `logged` → `routed` → `acknowledged` → `resolved` |
| GET | `/api/complaints/heatmap` | Counts by district and type |
| POST | `/api/chat` | Streams the assistant reply (server-sent events). On any failure returns `{code}` so the app falls back to FAQ search. |

## Examples

```bash
# Health check
curl http://localhost:8787/api/health

# Log a complaint
curl -X POST http://localhost:8787/api/complaints \
  -H 'Content-Type: application/json' \
  -d '{"type":"outage","state":"Rajasthan","district":"Jaisalmer","details":"No power since morning"}'

# Move a complaint forward (admin only)
curl -X PATCH http://localhost:8787/api/complaints/<ticketId>/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"routed"}'
```

## Security

- `helmet` with a strict Content Security Policy, `cors`, and `express-rate-limit` on write and chat routes.
- `ANTHROPIC_API_KEY` stays on the server and is never sent to the browser.
- Contact details given with a complaint are stored but never returned by the public list.
