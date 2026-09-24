# Mavhu Frontend

React + TypeScript (Vite) app for role selection, sign-in and sign-up. It talks to
[`mavhu-api-system`](../mavhu-api-system) — the API must be running before the UI is useful.

---

## Prerequisites

- **Node.js 20 or newer** (`node -v`) and npm 10+ (`npm -v`)
- A running copy of the API (`mavhu-api-system`) with its database migrated and seeded
- Git (to clone the repo)

---

## First-time setup

```bash
# 1. Move into the frontend project
cd mavhu-frontend-system

# 2. Install dependencies
npm install

# 3. Create your local env file
cp .env.example .env
```

Open `.env` and confirm `VITE_API_URL` points at the running API. The default is:

```env
VITE_API_URL=http://localhost:3000/api/v1
```

If your API runs on a different host or port, change this value.

---

## Running the app

```bash
npm run dev
```

Then open http://localhost:5173 in your browser. Vite hot-reloads on save.

Before you can sign in, make sure the sibling API is running:

```bash
cd ../mavhu-api-system
npm install
npm run migrate
npm run seed
npm run dev
```

---

## Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server on http://localhost:5173 |
| `npm run build` | Type-check with `tsc` and produce a production build in `dist/` |
| `npm run preview` | Serve the built `dist/` locally to sanity-check the production bundle |

---

## Project structure (Model–View–Presenter)

```
src/
  model/       Data & rules: role catalogue, API services, session storage. No React.
  presenter/   Screen logic as hooks (state, validation, navigation). No markup.
  view/        Dumb components: screens, shared components, CSS. Props in, JSX out.
  app/         Router + pages, each binding one presenter to one view.
  main.tsx     Entry point.
```

---

## Roles

| Role | Can self sign-up? |
|---|---|
| Mavhu Admin | No — provisioned by Mavhu |
| Auditor | No — provisioned by Mavhu |
| ESG Approver / Contributor / Reader | Yes |

The API enforces this too: `POST /auth/register` rejects `MAVHU_ADMIN` and `AUDITOR` with 403.

---

## Theming

Light and dark palettes live in `src/view/styles/tokens.css` (sampled from the logo). The theme
toggle persists to `localStorage`; the first visit follows the OS setting.

---

## Demo accounts

After running the seed (`npm run seed` in `mavhu-api-system`), every account below uses the password
`Mavhu@2026!` (override with `SEED_PASSWORD`). Rotate these outside local development.

| Role | Email |
|---|---|
| Mavhu Admin | tendai.moyo@mavhu.africa, rudo.chikwanha@mavhu.africa, farai.ncube@mavhu.africa |
| Auditor | tafadzwa.sibanda@cbz.co.zw |
| ESG Approver | nyasha.dube@cbz.co.zw, kudzai.zhou@maronderamaize.co.zw |
| ESG Contributor | blessing.mhlanga@chipingetea.co.zw, tinashe.gumbo@maronderamaize.co.zw |
| ESG Reader | chipo.mutasa@cbz.co.zw, rutendo.makoni@chiredzisugar.co.zw |

---

## Troubleshooting

- **`npm install` fails on peer-dep errors** — make sure you're on Node 20+. Delete `node_modules`
  and `package-lock.json` and reinstall if needed.
- **Sign-in returns a network error** — the API is not running, or `VITE_API_URL` in `.env` points
  to the wrong host/port. Confirm the API is up (e.g. `curl http://localhost:3000/api/v1/health`).
- **CORS errors in the browser console** — the API must allow `http://localhost:5173`. Check the
  API's CORS config.
- **Port 5173 is already in use** — stop the other process, or run `npm run dev -- --port 5174`.
- **Changes to `.env` aren't picked up** — Vite reads env vars at start. Stop and restart
  `npm run dev` after editing `.env`.
