/**
 * Run one NEXORA research question from the terminal and print every event.
 *   npm run try:agent -- "your question" [--model llama-3.3-70b-versatile] [--keep]
 * Creates a temp Session for the run; pass --keep to leave it in the DB.
 */
import "dotenv/config";
import { db } from "@/server/db";
import { runAgent } from "@/server/agent";

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  const v = argv[i + 1];
  argv.splice(i, v && !v.startsWith("--") ? 2 : 1);
  return v ?? "";
};
const model = flag("--model");
const keep = flag("--keep") !== undefined;
const question =
  argv.join(" ").trim() ||
  "Compare the architectures of Llama 3.3 70B and GPT-OSS 120B, and list their current Groq API pricing.";

const line = (s = "") => console.log(s);

/** Notes saved in the run, marking which ones the harness auto-saved. */
async function printNotes(runId: string) {
  const [notes, autoSteps] = await Promise.all([
    db.note.findMany({ where: { runId }, orderBy: { createdAt: "asc" } }),
    db.step.findMany({ where: { runId, tool: "save_note", argsJson: { contains: '"auto":true' } } }),
  ]);
  const autoIds = new Set(
    autoSteps.map((s: { observation: string }) => (JSON.parse(s.observation) as { id?: string }).id),
  );
  line(`\n================ NOTES SAVED (${notes.length}) ================`);
  for (const n of notes) {
    const body = n.content.replace(/\s+/g, " ");
    line(`- [${autoIds.has(n.id) ? "auto" : "model"}] ${n.title}  <${n.sourceUrl ?? "no source"}>`);
    line(`    ${body.slice(0, 300)}${body.length > 300 ? "…" : ""}`);
  }
}

async function main() {
  const session = await db.session.create({ data: { title: `NEXORA: ${question.slice(0, 40)}` } });
  line(`Question: ${question}`);
  line(`Requested model: ${model || "(none, research list decides)"}`);
  line("");

  let runId: string | null = null;
  try {
    for await (const ev of runAgent({ question, sessionId: session.id, model })) {
      switch (ev.type) {
        case "run_start":
          runId = ev.runId;
          line(`▶ run_start  runId=${ev.runId}  model=${ev.model}`);
          break;
        case "reason":
          line(`\n🧠 [step ${ev.step}] REASON: ${ev.text.replace(/\s+/g, " ")}`);
          break;
        case "act":
          line(`🔧 [step ${ev.step}] ACT: ${ev.tool}(${JSON.stringify(ev.args)})`);
          break;
        case "observe":
          line(`${ev.ok ? "👁 " : "❌"} [step ${ev.step}] OBSERVE ${ev.tool} (${ev.latencyMs} ms): ${ev.preview}`);
          break;
        case "warning":
          line(`⚠️  WARNING: ${ev.message}`);
          break;
        case "answer":
          line("\n================ ANSWER ================\n");
          line(ev.text);
          line("\n================ SOURCES (validated by harness) ================");
          for (const s of ev.sources) line(`[${s.index}] ${s.title} - ${s.url}`);
          line("\n================ CITATION REPORT ================");
          line(JSON.stringify(ev.citationReport, null, 2));
          break;
        case "done":
          line("\n================ METRICS ================");
          line(JSON.stringify(ev.metrics, null, 2));
          break;
      }
    }
    if (runId) await printNotes(runId);
  } finally {
    if (!keep) await db.session.delete({ where: { id: session.id } }).catch(() => {});
    else line(`\n(kept session ${session.id})`);
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("try-agent crashed:", err);
  process.exit(1);
});
