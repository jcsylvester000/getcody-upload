# GRID · Cody Uploader

Next.js 16 + React 19 + TypeScript app that uploads documents into GRID Property Ventures' Cody AI (getcody.ai) knowledge-base folders, one batch of ≤10 at a time, and logs every upload to Neon Postgres.

## What it does
| # | Objective | Where |
|---|---|---|
| 1 | See all Cody folders via the API key (follows pagination) | `app/api/cody/folders`, `lib/server/cody.ts` |
| 2 | Tick-box folder filter (multi-select, remembered) | `components/FolderPicker.tsx` |
| 3 | Upload to ticked folders — Cody starts learning automatically on create | `app/api/uploads/*`, `lib/api.ts` |
| 4 | History of every file → folder in Neon | `db/schema.ts`, `app/api/history`, `components/HistoryTab.tsx` |
| 5 | Max 10 documents per batch | `hooks/useUploadQueue.ts` (`BATCH_SIZE`), enforced again in `app/api/batches` |
| 6 | Waits until the batch is learned before the next batch | `lib/server/sync.ts`, `app/api/batches/[id]` |
| 7 | Everything waits in a queue until you press **Start sending** | `components/UploadTab.tsx` |
| 8 | Documents in ticked folders with upload dates + status | `components/DocumentsTab.tsx` |
| 9 | Preview before upload (PDF, TXT/MD, RTF, DOCX/DOCM, PPTX/PPTM text) | `components/FilePreview.tsx` |
| 10 | Access-code modal on every load (default **412099**, override with `APP_PASSWORD`); API locked server-side | `components/PasswordGate.tsx`, `proxy.ts`, `lib/auth.ts` |
| 11 | Queue + files survive refresh (IndexedDB in this browser) | `lib/idb.ts`, `hooks/useUploadQueue.ts` |
| 12 | Kanban board `/board`: Inbox → Queued → Uploading → Converting → Learning → Learned / Needs attention, live (5 s) | `components/KanbanBoard.tsx` |
| 13 | Activity log of every action (Neon `activity_log`) + live feed | `lib/server/activity.ts`, `app/api/activity`, `components/ActivityFeed.tsx` |
| 14 | Create folders, delete documents from folders (with confirm) | `app/api/cody/folders`, `app/api/cody/documents/[id]` |
| 15 | Dashboard `/dashboard`: totals, success rate, uploads per day, uploads by folder, file types, live activity (7/30/90 days/all) | `components/Dashboard.tsx`, `app/api/stats` |

Old URLs `/login` and `/brand` redirect to `/`; unknown URLs send you to the dashboard.

Access code note: the hardcoded default lives in `lib/auth.ts`. It's a shared code, not user accounts — set a stronger `APP_PASSWORD` in Netlify before sharing the URL widely.

## Run locally
```powershell
npm install
npm run dev          # http://localhost:3000
```
`.env.local` holds the secrets (git-ignored). Tables are created automatically on first use (or `npm run db:migrate`).
Check connections: open `http://localhost:3000/api/health`.

## Upload flow (Cody API v1, https://developers.meetcody.ai)
1. `POST /uploads/signed-url` → S3 URL + key (server)
2. `PUT` file to the S3 URL (browser direct; if blocked, server relay for files ≤ 5.5 MB)
3. `POST /documents/file { folder_id, key }` (server) — Cody converts and learns it (minutes, up to ~1 h)
4. App polls `GET /documents?folder_id=` every 10 s, matches the new document by name + time, and updates Neon: `uploaded → syncing → synced` (or `sync_failed` / `timeout` after 65 min).
5. When the whole batch is settled, the next 10 go. Cody `429` (too many files processing) → automatic wait + retry.

Note: queued files live in browser memory — keep the tab open until the queue finishes (the app warns before closing).

## Deploy to Netlify
1. Push to GitHub (below). 2. Netlify → **Add new site → Import from Git** → pick `getcody-upload`. Build settings come from `netlify.toml`.
3. **Site configuration → Environment variables**: `CODY_API_KEY`, `CODY_API_BASE`, `DATABASE_URL`, `APP_PASSWORD` (required in production — the site is locked without it).
4. Deploy. Then open `/api/health` (after logging in) to confirm Cody + Neon.

Netlify limit: function request bodies ~6 MB, so large files must go browser → S3 directly. If Cody's S3 blocks the browser (CORS), files > 5.5 MB will show a clear error; files under that use the relay.

## Push to GitHub (PowerShell)
```powershell
cd "C:\Users\jcsyl\Desktop\Website Enhancement Agency\5 - Final Application\Getcody Data Upload Application"
git init
git add .
git status            # confirm .env.local is NOT listed
git commit -m "GRID Cody Uploader v0.2"
git branch -M main
git remote add origin https://github.com/jcsylvester000/getcody-upload.git
git push -u origin main
```

## Structure
```
app/            pages (/, /brand, /login) + api/ route handlers
components/     UI (FolderPicker, DocumentsTab, UploadTab, HistoryTab, FilePreview, StatusBadge, AppHeader)
hooks/          useUploadQueue — batching + wait-for-learning runner
lib/server/     server-only: cody.ts (API), db.ts (Neon), sync.ts (status matching), logs.ts
lib/            api.ts (browser → our API), types.ts, file-rules.ts, auth.ts
db/             schema.ts (used by app) + schema.sql (readable copy)
proxy.ts        password gate (APP_PASSWORD)
public/brand/   logo files from the GRID Brand Guide
```
