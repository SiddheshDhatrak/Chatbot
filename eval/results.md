# NEXORA evaluation results

**6 valid / 12 run** (of 12 questions) · model `openai/gpt-oss-120b` · updated 2026-10-21 05:59 UTC

> 6 run(s) not evaluated because of rate limits. They are excluded from every number below and are retried automatically by `npm run eval`.

Correctness: short answers use normalized exact match or contains-match against the ground truth; questions with `match: all` need every key figure (partial credit shown); other comprehensive answers use token-level F1 against a reference (correct at F1 ≥ 0.35). Baseline = the same model answering once with no tools.

## Evaluated questions

| # | Question | Category | NEXORA | Baseline | Status | Latency | Steps | Tools | Tokens | Precision | Support | Read ratio | Snippet-only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Who founded Groq and in what year was it founded? | single fact | ✅ | ❌ | completed | 53.0s | 4 | 3 | 9371 | 100% | 100% | 100% | 0 |
| 2 | In which city is the headquarters of the organization that released… | multi hop | ✅ | ✅ | completed | 117.3s | 7 | 6 | 18067 | 100% | 100% | 0% | 1 |
| 3 | What is the context window, in tokens, of GPT-OSS 120B on Groq acco… | time sensitive | ✅ | ✅ | completed | 92.5s | 5 | 4 | 13486 | 100% | 100% | 100% | 0 |
| 4 | The paper 'Attention Is All You Need' introduced the Transformer. W… | multi hop | ✅ | ✅ | completed | 37.5s | 4 | 3 | 10558 | 100% | 100% | 100% | 0 |
| 5 | At which conference was 'Attention Is All You Need' presented, and … | multi hop | ✅ | ✅ | completed | 138.4s | 8 | 7 | 23794 | — | — | — | 0 |
| 6 | Who invented the incandescent light bulb? | conflicting sources | ✅ | ✅ | completed | 50.3s | 4 | 3 | 10969 | 100% | — | 100% | 0 |

## Not evaluated (rate limited)

| Question | Category | Reason |
|---|---|---|
| What is the official height of Mount Everest in metres? | conflicting sources | Groq daily token limit (TPD); fell back to a model without tools |
| What is the current Groq API price per million input tokens for GPT… | time sensitive | Groq daily token limit (TPD); fell back to a model without tools |
| Who is the current CEO of OpenAI? | time sensitive | Groq daily token limit (TPD); fell back to a model without tools |
| In what year was the paper 'Attention Is All You Need' published? | single fact | Groq daily token limit (TPD); fell back to a model without tools |
| Compare the context window and pricing of GPT-OSS 120B and GPT-OSS … | comprehensive synthesis | Groq daily token limit (TPD); fell back to a model without tools |
| Explain how retrieval-augmented generation (RAG) works, and summari… | comprehensive synthesis | Groq daily token limit (TPD); fell back to a model without tools |

## Aggregate (NEXORA, valid rows only)

| Metric | Value |
|---|---|
| Valid rows | 6 of 12 run |
| Accuracy | 100% |
| Mean correctness score | 1.00 |
| Avg latency | 81.5s |
| Avg tool calls | 4.3 |
| Avg tokens | 14374 |
| Citation precision | 100% |
| Support rate | 100% |
| Read ratio | 80% |
| Completion rate | 100% |
| Step-limit rate | 0% |
| Fallback rate (all runs, incl. not evaluated) | 50% |

## NEXORA vs baseline (same questions, same model, baseline has no tools)

Compared on the 6 question(s) with a valid NEXORA row.

| Metric | NEXORA | Baseline |
|---|---|---|
| Accuracy | 100% | 83% |
| Mean correctness score | 1.00 | 0.83 |
| Avg latency | 81.5s | 1.4s |
| Avg tokens | 14374 | 369 |
| Cites retrieved sources | 100% precision | none |
| Accuracy: single fact (1) | 100% | 0% |
| Accuracy: multi hop (3) | 100% | 100% |
| Accuracy: time sensitive (1) | 100% | 100% |
| Accuracy: conflicting sources (1) | 100% | 100% |
