# Hexovate ERP — Preview Run Doc

The app is a two-part project: a React + Vite frontend (repo root) and an
Express + MongoDB API (`server/`). The preview registers the Vite dev server,
which talks to the API, which talks to a local `mongod`.

## Artifacts a fresh checkout needs

1. **Env files** — copy from the main checkout (they contain no secrets for
   the frontend; server values are dev defaults):
   - Root `.env` → `VITE_API_URL=http://localhost:4000/api` (the frontend also
     falls back to this URL if the file is absent — see `src/api/client.ts`).
   - `server/.env` is optional; all server config has dev defaults in
     `server/src/config/env.js` (port 4000, `MONGODB_URI` unset → in-memory
     MongoDB via mongodb-memory-server, dev-only JWT secret, CORS allows any
     localhost origin).
2. **Dependencies** — `npm install` at the repo root and `npm install` inside
   `server/` (mongodb-memory-server is a server devDependency used as the
   fallback database).
3. **Seeded demo database** (optional but recommended) — the dev database
   lives in `server/.mongo-data` (a standalone mongod dbpath). To rebuild it
   from scratch: start mongod on `server/.mongo-data` (see below), then run
   `cd server && MONGODB_URI="mongodb://127.0.0.1:27018/hexovate" npm run seed`.
   Demo accounts (password `Password123!`) are printed at the end of the seed.

## Running the stack

Three detached services, in order:

1. **MongoDB** (port 27018, standalone):
   ```powershell
   powershell -NoProfile -Command "(Start-Process -FilePath '<path-to>\mongod-x64-win32-8.2.6.exe' -ArgumentList '--dbpath','server/.mongo-data','--port','27018','--bind_ip','127.0.0.1' -WorkingDirectory '<repo>' -RedirectStandardOutput '<repo>\.freebuff\mongod.log' -RedirectStandardError '<repo>\.freebuff\mongod.log.err' -WindowStyle Hidden -PassThru).Id"
   ```
   The mongod binary lives in `%USERPROFILE%\.cache\mongodb-binaries\` on
   this machine (installed by mongodb-memory-server); on a fresh machine run
   the seed without `MONGODB_URI` to get an ephemeral in-memory DB instead.

2. **API** (port 4000):
   ```powershell
   powershell -NoProfile -Command '$env:MONGODB_URI="mongodb://127.0.0.1:27018/hexovate"; $env:PORT="4000"; (Start-Process -FilePath "node.exe" -ArgumentList "src/server.js" -WorkingDirectory "<repo>\server" -RedirectStandardOutput "<repo>\.freebuff\api.log" -RedirectStandardError "<repo>\.freebuff\api.log.err" -WindowStyle Hidden -PassThru).Id'
   ```
   Health check: `curl http://127.0.0.1:4000/api/health` → `{"success":true,...}`.

3. **Frontend** (Vite, port 5173):
   ```powershell
   powershell -NoProfile -Command "(Start-Process -FilePath 'npm.cmd' -ArgumentList 'run','dev' -WorkingDirectory '<repo>' -RedirectStandardOutput '<repo>\.freebuff\preview.log' -RedirectStandardError '<repo>\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
   ```
   Then `curl http://localhost:5173/` should return 200. The preview is
   registered at `http://localhost:5173/`.

Notes:

- The PowerShell `Start-Process` calls intentionally hang the calling shell
  (redirected stream handles) — the printed PID / `netstat` check confirms
  the service actually started.
- Standard ports are 5173 / 4000 / 27018. If any is taken, pick a free one
  and adapt `PORT`/`--port` env and the root `.env` `VITE_API_URL` (CORS
  allows any localhost origin, so the API accepts other ports).
- Logs live in `.freebuff/` (`mongod.log`, `api.log`,
  `preview-<id>.log` + `.err` per process).