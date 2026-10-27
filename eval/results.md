# NEXORA evaluation results

**11 valid / 12 run** (of 12 questions) · model `openai/gpt-oss-120b` · updated 2026-10-23 07:24 UTC

> 1 run(s) not evaluated because of rate limits. They are excluded from every number below and are retried automatically by `npm run eval`.

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
| 7 | What is the official height of Mount Everest in metres? | conflicting sources | ✅ | ✅ | completed | 47.9s | 4 | 3 | 8529 | 100% | 100% | 100% | 0 |
| 8 | What is the current Groq API price per million input tokens for GPT… | time sensitive | ✅ | ❌ | completed | 51.4s | 4 | 3 | 9186 | 100% | 100% | 100% | 0 |
| 9 | Who is the current CEO of OpenAI? | time sensitive | ✅ | ✅ | completed | 42.1s | 5 | 4 | 10988 | 100% | 100% | 100% | 0 |
| 10 | In what year was the paper 'Attention Is All You Need' published? | single fact | ✅ | ✅ | completed | 65.4s | 5 | 4 | 11321 | 100% | 100% | 100% | 0 |
| 11 | Explain how retrieval-augmented generation (RAG) works, and summari… | comprehensive synthesis | F1 0.21 ❌ | F1 0.12 ❌ | completed | 46.9s | 5 | 4 | 10563 | 100% | 62% | 50% | 1 |

## Not evaluated (rate limited)

| Question | Category | Reason |
|---|---|---|
| Compare the context window and pricing of GPT-OSS 120B and GPT-OSS … | comprehensive synthesis | rate limited / fallback used |

## Aggregate (NEXORA, valid rows only)

| Metric | Value |
|---|---|
| Valid rows | 11 of 12 run |
| Accuracy | 91% |
| Mean correctness score | 0.93 |
| Avg latency | 67.5s |
| Avg tool calls | 4.0 |
| Avg tokens | 12439 |
| Citation precision | 100% |
| Support rate | 96% |
| Read ratio | 85% |
| Completion rate | 100% |
| Step-limit rate | 0% |
| Fallback rate (all runs, incl. not evaluated) | 8% |

## NEXORA vs baseline (same questions, same model, baseline has no tools)

Compared on the 11 question(s) with a valid NEXORA row.

| Metric | NEXORA | Baseline |
|---|---|---|
| Accuracy | 91% | 73% |
| Mean correctness score | 0.93 | 0.74 |
| Avg latency | 67.5s | 4.1s |
| Avg tokens | 12439 | 458 |
| Cites retrieved sources | 100% precision | none |
| Accuracy: single fact (2) | 100% | 50% |
| Accuracy: multi hop (3) | 100% | 100% |
| Accuracy: time sensitive (3) | 100% | 67% |
| Accuracy: conflicting sources (2) | 100% | 100% |
| Accuracy: comprehensive synthesis (1) | 0% | 0% |
