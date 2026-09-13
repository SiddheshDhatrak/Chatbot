This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

# Claude Maison d'IA

A polished AI chat salon with streamed Groq responses, persistent SQLite-backed conversations, and a responsive React workspace.

## Run locally

Copy `.env.example` to `.env`, then set `DATABASE_URL` and `GROQ_API_KEY`. The default Groq model is `openai/gpt-oss-120b`; use a model listed by your Groq account if needed.

```bash
npm install
npm run db:migrate
npm run next-dev
```

Open `http://localhost:3001` for the Next.js application. The Vite client is available with `npm run dev` on port `3000` when the API server is running on port `3001`.

## Checks

```bash
npm run lint
npm run build
```

API keys and local databases are ignored by Git. Never commit `.env` or provider credentials.
