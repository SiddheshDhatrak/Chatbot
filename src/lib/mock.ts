export const PROMPT_GALLERY = [
  {
    title: "Draft a founder update",
    prompt: "Draft an elegant investor update for a pre-seed AI startup: wins, metrics, asks. Tone: confident, warm, concise.",
    icon: "pen",
  },
  {
    title: "Explain a paper",
    prompt: "Explain attention mechanisms like I'm a smart product designer — with an analogy, a diagram in words, and 3 takeaways.",
    icon: "sparkles",
  },
  {
    title: "Refactor this code",
    prompt: "Refactor this React component for readability and performance, and explain each change:\n\n```tsx\nfunction List({items}) { return items.map((i,idx) => <div key={idx}>{i}</div>) }\n```",
    icon: "code",
  },
  {
    title: "Plan Kyoto in 4 days",
    prompt: "Plan a slow-luxury 4-day Kyoto itinerary: ryokans, kissaten, gardens at opening time, one splurge dinner per day.",
    icon: "map",
  },
];

export const MOCK_SESSIONS_SEED = [
  { title: "Maison-style landing copy", updatedAt: Date.now() - 1000 * 60 * 12 },
  { title: "Q3 board narrative", updatedAt: Date.now() - 1000 * 60 * 60 * 5 },
  { title: "Attention paper, explained", updatedAt: Date.now() - 1000 * 60 * 60 * 26 },
  { title: "Kyoto slow itinerary", updatedAt: Date.now() - 1000 * 60 * 60 * 50 },
  { title: "TypeScript generics drill", updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 9 },
];

const LUXE_REPLIES = [
  `A pleasure — let's elevate this.\n\nHere's how I'd frame it:\n\n1. **Lead with the insight**, not the information. One sharp sentence that carries the room.\n2. **Structure in threes.** Rhythm is luxury — triads feel inevitable.\n3. **End with a single, gilded ask.** Clarity is the rarest courtesy.\n\n> "Elegance is refusal — of noise, of haste, of the unnecessary."\n\nTell me which direction you'd like to refine, and I'll compose the full piece.`,
  `Consider it done — with a touch of couture.\n\n\`\`\`tsx\n// Before: anonymous, hurried\nfunction List({ items }: { items: string[] }) {\n  return items.map((item) => <Row key={item} value={item} />);\n}\n\n// After: tailored, memoized, intentional\nconst Row = memo(function Row({ value }: { value: string }) {\n  return <div className="row">{value}</div>;\n});\n\nexport function List({ items }: { items: string[] }) {\n  return (\n    <ul aria-label="results">\n      {items.map((item) => (\n        <li key={item}>\n          <Row value={item} />\n        </li>\n      ))}\n    </ul>\n  );\n}\n\`\`\`\n\nThree moves: **stable keys**, **memoized rows**, **semantic list**. Shall I open this as an artifact for side-by-side review?`,
  `An exquisite question. Let me unfold it slowly.\n\n| Layer | Role | Analogy |\n|---|---|---|\n| Query | What I'm looking for | The guest's request |\n| Key | What each word offers | The menu |\n| Value | What each word contributes | The dish itself |\n\nAttention is a **maître d'** — seating every word next to the company it deserves. The result: context, composed like a seating chart.\n\nShall we go deeper — multi-head attention next?`,
];

export function pickMockReply(input: string): { text: string; hasArtifact: boolean } {
  const lower = input.toLowerCase();
  const hasArtifact = /code|refactor|component|artifact|landing|css|react/i.test(input);
  if (hasArtifact) return { text: LUXE_REPLIES[1], hasArtifact: true };
  if (/attention|paper|explain/i.test(lower)) return { text: LUXE_REPLIES[2], hasArtifact: false };
  return { text: LUXE_REPLIES[Math.floor(Math.random() * LUXE_REPLIES.length)] ?? LUXE_REPLIES[0]!, hasArtifact };
}

export const ARTIFACT_DEMO = {
  title: "Refactored List.tsx",
  language: "tsx",
  code: `import { memo } from "react";

const Row = memo(function Row({ value }: { value: string }) {
  return <div className="row">{value}</div>;
});

export function List({ items }: { items: string[] }) {
  return (
    <ul aria-label="results" className="space-y-2">
      {items.map((item) => (
        <li key={item}>
          <Row value={item} />
        </li>
      ))}
    </ul>
  );
}`,
};
