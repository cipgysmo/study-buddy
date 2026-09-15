# Study Buddy

A private, browser-based study companion for a single student, powered by a local
LLM. It runs as one Docker container on your home server (TrueNAS Scale) and talks
to your local model over the LAN. No data leaves your network.

## Features

- **Subjects & materials** — organize subjects; upload PDFs, images, or text.
- **AI tutor** — Socratic chat grounded in a subject's materials (streaming).
- **Exam prep** — generate a day-by-day study plan from an exam date + level.
- **Flashcards** — generate cards and review them with SM-2 spaced repetition.
- **Quizzes** — generate multiple-choice quizzes, take them, get graded.
- **Practice** — open-ended exercises with step-by-step solutions, plus true/false drills.
- **Scan** — photograph a page and OCR it to text (uses the model's vision).
- **Progress** — activity, streaks, and per-subject mastery.
- **i18n** — Czech and English (cookie-based, easy to extend).

## Tech stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · SQLite (better-sqlite3) ·
OpenAI-compatible client (llama-swap) · next-intl · Vitest. Built as a `standalone`
server for a small Docker image.

## Local development

```bash
npm install
cp .env.example .env.local   # then edit values
npm run dev                  # http://localhost:3000
```

Useful scripts:

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint .
npm run build       # production build
npm test            # vitest (unit tests)
```

## Configuration

Environment variables (see `.env.example`):

| Var            | Default                          | Description                                  |
| -------------- | -------------------------------- | -------------------------------------------- |
| `LLM_BASE_URL` | `http://192.168.1.136:8080/v1/`  | OpenAI-compatible endpoint (llama-swap).     |
| `LLM_MODEL`    | `local-ai`                       | Model id exposed by the router.              |
| `LLM_API_KEY`  | `local`                          | Ignored by llama-swap; some servers need it. |
| `PORT`         | `3000`                           | Port the server listens on.                  |
| `DATA_DIR`     | `./data`                         | Where the SQLite DB + uploads live.          |
| `APP_PASSWORD` | *(empty)*                        | Optional LAN password gate (empty = off).    |

The LLM must support **vision** for the Scan feature (the current `local-ai`
router does).

## Deploy on TrueNAS Scale (Docker)

1. **Copy the project** to a folder on the NAS, e.g. `/mnt/tank/apps/study-buddy`.
2. **Create a dataset** for data (so the DB + uploads survive rebuilds), e.g.
   `/mnt/tank/apps/study-buddy-data`.
3. **Set the dataset's permissions** so the container user (uid `1000`) can write:
   in the TrueNAS UI, set the dataset's owner to uid `1000` (or make it world-writable).
4. **Edit `docker-compose.yml`**:
   - Point the volume at your dataset: `- /mnt/tank/apps/study-buddy-data:/app/data`
   - Set `APP_PASSWORD` if you want the password gate.
   - Confirm `LLM_BASE_URL` reaches your AI host from the NAS.
5. **Start it** — either pull the published image (recommended) or build locally:
   ```bash
   cd /mnt/tank/apps/study-buddy
   # Pull the image auto-published by GitHub Actions (push code -> image updates):
   docker compose pull
   docker compose up -d
   # ...or build from source on the NAS instead:
   # docker compose up -d --build
   ```
6. **Open** `http://<nas-ip>:3000` from any device on the LAN.

### Publishing the image (GHCR)

The image is published automatically to GitHub Container Registry. Pushing to
`main` runs `.github/workflows/publish.yml`, which builds and pushes
`ghcr.io/cipgysmo/study-buddy:latest` (plus a `sha` tag). To update the app on
the NAS, just pull again:

```bash
docker compose pull && docker compose up -d
```

The workflow uses the built-in `GITHUB_TOKEN` (needs `packages: write`, already
set), so no extra secrets are required.

The container runs as a non-root user, drops all capabilities, and has a health
check. Data persists in the mounted dataset.

## Notes

- The app is single-user by design; the optional `APP_PASSWORD` gate is the only
  access control. Keep it on a trusted LAN.
- To add a language, add `src/i18n/locales/<code>.json` and register it in
  `src/i18n/languages.ts`.
