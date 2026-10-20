const models = [
  "minimax/minimax-m3.1-flash:free",
  "nvidia/nemotron-3-super-120b-a12b:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3.5-lightning:free",
  "xingchen-agi/xing4.0-29b-a4b:free",
  "nvidia/nemotron-3-ultra-550b-a55b:free",
];

const tools = [{
  type: "function",
  function: {
    name: "web_search",
    description: "Search the web",
    parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
}];

for (const model of models) {
  const t0 = Date.now();
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + process.env.OPENROUTER_API_KEY,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Find the current price of GPT-OSS 120B on Groq. Use the tool." }],
        tools,
        tool_choice: "auto",
      }),
    });
    const j = await r.json();
    const call = j.choices?.[0]?.message?.tool_calls?.[0];
    let argsOk = false;
    try { argsOk = !!JSON.parse(call?.function?.arguments ?? "")?.query; } catch {}
    console.log(
      model.padEnd(42),
      call ? "TOOL_CALL" : "NO_TOOL",
      argsOk ? "args_ok" : "args_bad",
      ((Date.now() - t0) / 1000).toFixed(1) + "s",
      j.error ? "ERR " + (j.error.code ?? "") + " " + String(j.error.message).slice(0, 60) : ""
    );
  } catch (e) {
    console.log(model.padEnd(42), "FAILED", e.message);
  }
  await new Promise((res) => setTimeout(res, 3000));
}