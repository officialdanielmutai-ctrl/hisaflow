# Assistant characterization — 2026-11-13

Live-model review of the reporting, catalogue-advice and natural-reply work
(`apps/backend/scripts/assistant-characterization.mjs`).

## Result

- **Production gateway smoke: 6/6 passed** against
  `https://hisaflow-litellm-cgqiivalxa-ew.a.run.app/v1` with
  `hisaflow-assistant`.
- **Primary model characterization: 22/22 cases passed** across batches
  against `openai/gpt-oss-120b` (the first model in the `hisaflow-assistant`
  group).
- **C16 ambiguity regression: passed.** “Sell 3 sugar” with two matching items
  did not create a sale; the model asked which pack size the user meant.

No key is recorded here. The live gateway request used the Cloud Run service's
current `LITELLM_MASTER_KEY`; the local `apps/gateway/.env` key was stale and is
not a valid production credential.

## Cases

| Case | Utterance | Expected | Result |
| --- | --- | --- | --- |
| sales-en | How were sales this week? | `get_sales_report` | Pass |
| sales-sw | Mauzo yalikuwaje wiki hii? | `get_sales_report` | Pass |
| catalogue-en | What should I stock next? | `analyse_catalogue` | Pass |
| catalogue-sw | Nianze kuuza bidhaa gani mpya? | `analyse_catalogue` | Pass |
| advice-en | How can I improve profit? | `analyse_catalogue` / finance read | Pass |
| advice-sw | Nifanyeje nipate faida zaidi? | `analyse_catalogue` / finance read | Pass |
| credit-en | Who owes me money? | `get_credit_summary` | Pass |
| credit-sw | Nani anadaiwa pesa zangu? | `get_credit_summary` | Pass |
| expense-en | What did I spend on rent this month? | `get_expense_report` | Pass |
| expense-sw | Nimetumia kiasi gani kwa usafiri mwezi huu? | `get_expense_report` | Pass |
| purchase-en | How much did I spend on stock? | `get_purchase_report` | Pass |
| recent-en | What happened today? | `get_recent_transactions` / sales read | Pass |
| notes-en | What tasks are open? | `list_notes` | Pass |
| tax-en | Is my tax filing up to date? | `get_tax_summary` | Pass |
| team-en | Who works here? | `list_team_members` | Pass |
| low-stock-sw | Niambie bidhaa gani zinaisha kwenye stoo | `get_low_stock` / active alerts | Pass |
| expense-write-en | I paid 5000 rent | `record_expense` | Pass |
| income-write-en | Received 2000 service fee | `record_income` | Pass |
| adjust-stock-en | Stock count says 12 sugar left | search, then `adjust_stock` | Pass |
| archive-en | Stop selling the Old Juice product | search, then `archive_inventory_item` | Pass |
| credit-payment-en | Mama Njeri paid 300 | `record_credit_payment` / credit read | Pass |
| ambiguity-c16 | Sell 3 sugar (two matches) | ask, no sale | Pass |

## Defect found and fixed by the eval

The first `purchase-en` run failed because the model sent `days: null` for an
optional numeric argument and Groq validates the generated tool call against the
JSON schema before the backend sees it.

Fix:

- `ToolRegistryService.toSchemas()` now makes every non-required primitive
  argument explicitly nullable (`type: ['number', 'null']`, enum values include
  `null`) while required arguments stay strict.
- `asLimit`, the shared period resolver and the remaining optional `days`
  handlers treat JSON `null` as “not supplied”.
- Regression coverage: `tool-registry.service.spec.ts` and the reporting tool
  tests.

After the fix, `get_purchase_report` accepted `{"days": null}` and the
production gateway returned a valid tool call.

## Notes for the next run

- Use the current Cloud Run master key, not the stale local gateway `.env`
  value. A wrong key makes LiteLLM attempt a virtual-key DB lookup and return
  `No connected db`, which looks like a gateway outage.
- Free-tier provider limits are tight with the full tool schema. The script
  spaces calls with `ASSISTANT_EVAL_DELAY_MS` (65 s for Groq primary) and
  supports `ASSISTANT_EVAL_ONLY`, `ASSISTANT_EVAL_SKIP_AMBIGUITY` and
  `ASSISTANT_EVAL_BASE_URL` for batched runs.
