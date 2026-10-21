# NEXORA — Autonomous Research & Evidence Agent

NEXORA answers questions by researching them: a ReAct agent searches the web (Tavily), reads the pages, saves the key facts as notes, and writes an answer where every claim cites `[n]` and is checked against the page it came from. Normal chat is still available; Research mode is a toggle in the composer.

PICT Pune, Dept. of IT, Group TY_10-9 · AIML CIE-1 project. Independent student project, not affiliated with any AI model provider.

Built with Next.js (App Router) + a Vite + React client, Prisma + SQLite persistence, and Groq (tool calling + streaming) with a Pollinations fallback.

## Features

- **Research mode (NEXORA agent)** — multi-step web research (web_search → read_page → save_note), live Reason / Act / Observe trace, citation tracking with a support check, persistent research notes, and guardrails (step limit, token budget, untrusted web data, citation checks). Traces and reports are saved and reopen from history.
- **Live streaming chat** — token-by-token Groq replies with stop, retry / regenerate
- **Model switcher** — GPT-OSS 120B (default) and GPT-OSS 20B: the models available on the configured Groq key; choice persists locally and is sent with every request
- **Persistent history** — SQLite-backed sessions with search, rename, delete
- **Artifacts panel** — fenced code blocks open side-by-side with copy, download, and live HTML/SVG preview
- **Rich messages** — Markdown + GFM + syntax highlighting, read-aloud (TTS), copy, share-link
- **Voice dictation** — microphone input via Web Speech API where supported
- **Command palette** — ⌘K / Ctrl+K quick actions, theme toggle (light/dark)
- **Dual frontend** — polished Next.js app + Vite React client sharing the same store, models, and API contracts

## Tech stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router), React 19 |
| Alt client | Vite 8 + React Router 7 |
| Styling | Tailwind CSS 4, Framer Motion, lucide-react |
| State | Zustand (persisted theme / sidebar / model) |
| DB | SQLite via Prisma 6 (`Session` → `Message`) |
| AI | Groq OpenAI-compatible streaming API, Pollinations keyless fallback |

## Quickstart

**Prerequisites:** Node.js 20+, npm, a [Groq API key](https://console.groq.com).

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# then edit .env:
#   DATABASE_URL="file:./dev.db"
#   GROQ_API_KEY="gsk_..."
#   GROQ_MODEL="openai/gpt-oss-120b"   # optional override
#   POLLINATIONS_API_KEY=""            # optional fallback key

# 3. Migrate the database
npm run db:migrate

# 4. Run the app
npm run next-dev   # Next.js on http://localhost:3001
```

Optional Vite client (uses the Next API on :3001):

```bash
npm run dev        # Vite on http://localhost:3000
```

Open `http://localhost:3001` → **Start researching** → `/chat`.

## Scripts

| Command | What it does |
|---|---|
| `npm run next-dev` | Next.js dev server on port 3001 |
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | Typecheck + Vite production build |
| `npm run lint` | ESLint |
| `npm run db:migrate` | `prisma migrate dev` (creates/updates SQLite DB) |
| `npm run db:studio` | Open Prisma Studio to inspect sessions/messages |

## Configuration

All config lives in `.env` (never committed — `.env` and `*.db` are gitignored). See `.env.example`.

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | yes | `file:./dev.db` | SQLite file location |
| `GROQ_API_KEY` | yes | — | Primary provider |
| `GROQ_MODEL` | no | `openai/gpt-oss-120b` | Must be a model your Groq key can access |
| `POLLINATIONS_API_KEY` | no | — | Without it, the fallback uses the keyless endpoint |

Model allowlist lives in `src/lib/models.ts` and is shared by both frontends.

## API

Base: `http://localhost:3001/api`

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/sessions` | List sessions (latest first) |
| `POST` | `/api/sessions` | Create session `{ title? }` |
| `GET` | `/api/sessions/[id]` | Get session + messages |
| `PATCH` | `/api/sessions/[id]` | Rename `{ title }` |
| `DELETE` | `/api/sessions/[id]` | Delete session (cascades messages) |
| `POST` | `/api/chat` | Stream a reply (SSE); body `{ sessionId, message, model?, regenerate? }` |

Streaming uses server-sent events; the client aborts via `AbortController` for Stop.

## Project structure

```
app/                  Next.js App Router (landing, /chat, API routes)
  api/chat/route.ts       SSE streaming endpoint (Groq → Pollinations fallback)
  api/sessions/...        Session + message CRUD
  chat/                   Chat pages + client
src/
  features/chat/          Composer, MessageList, ArtifactPanel, CommandPalette
  features/landing/       Landing sections
  components/             ModelPicker, ShareButton, ThemeToggle, layout
  store/useChatStore.ts   Zustand chat state (streaming, retry, artifacts)
  lib/models.ts           Model allowlist (single source of truth)
  lib/speech.ts           Voice dictation + read-aloud helpers
  server/ai.ts            Groq / Pollinations streaming logic
prisma/
  schema.prisma           Session / Message models (SQLite)
  migrations/             Migration history
```

## Data model

```prisma
model Session {
  id        String    @id @default(cuid())
  title     String    @default("New conversation")
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]
}

model Message {
  id        String   @id @default(cuid())
  sessionId String
  role      String   // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}
```

## Security notes

- `.env`, `*.db`, and `prisma/dev.db*` are gitignored — never commit keys or the local database.
- Chat input is user-controlled; the API sanitizes the model id against the allowlist.
- Artifact HTML/SVG preview renders in a sandboxed `srcDoc` iframe.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `401 / model not found` from Groq | Your key can't access `GROQ_MODEL` — list your models in the Groq console and update `.env` / the top-bar picker |
| Empty reply warning | Provider returned nothing; retry or switch to Llama 3.1 8B |
| Vite client can't load sessions | Start the Next API first (`npm run next-dev` on :3001) |
| Prisma `dev.db` missing | Re-run `npm run db:migrate` |

## License

No license file yet — all rights reserved by default. Add one (e.g. MIT) if you want others to reuse this.
