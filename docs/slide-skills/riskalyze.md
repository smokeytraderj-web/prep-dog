# Riskalyze — slide skill specification

Status: implemented as the `risk-snapshot` skill in `.claude/skills/risk-snapshot/`. That skill is the executable contract; formulas live in its `reference/methodology.md` and the sections below record the layout rules it follows. It is a Claude skill, not yet a selectable app module inside the React workspace.

## Purpose and inputs
Two distinct paths, never blended on one slide.

**Transcribe a vendor report.** When a Riskalyze/Nitrogen report is the source, require report date, client/portfolio labels, source references and every metric's exact name, units, horizon and stated confidence level. Use the supplied Risk Numbers and modeled ranges only; never reconstruct a proprietary score, infer a client's tolerance from holdings or invent scenario results.

**Compute in-house from holdings.** This is what `.claude/skills/risk-snapshot/` does: it derives its own 1-99 Risk Score, six-month 95% probability range, allocation, risk-adjusted grade, drawdown and cost bar from supplied position values and return inputs, under `reference/methodology.md`. These figures are ours. They carry no vendor's meaning, must never be labeled a Risk Number or a GPA, and must never be presented beside vendor figures as though the scales agree. A client's risk tolerance is still an input, never something derived from the holdings.

## Slide 1 — Risk alignment
16:9 white slide. Navy title at top; report date and portfolio labels beneath. Center a single horizontal 1–99 score scale only when that is the scale stated by the source. Plot separate clearly labeled markers for the client's stated tolerance, current portfolio and proposed portfolio, including only available values. Below, show a brief factual comparison (“Current portfolio score is X above the stated target”). Avoid arbitrary safe/danger zones, endorsements or invented suitability conclusions. Bottom source band includes score definition and report date.

## Optional slide 2 — Modeled outcome range
Use a single horizontal range plot centered on zero, showing source-provided lower and upper outcomes in the same units, with exact labels. If comparing current and proposed portfolios, use parallel rows with identical scales, horizons, confidence and valuation bases. A short method note identifies modeled outcomes, not guarantees. Do not substitute a different confidence level, annualize an unannualized range or hide asymmetric outcomes. Add dollar outcomes only if the report supplies them or explicitly supports the conversion from an agreed portfolio value.

## Optional slide 3 — Scenario comparison
Use source-provided scenario results only. A small matrix or grouped horizontal chart compares current and proposed portfolios for up to four scenarios. Give every scenario its source label and period. Keep axis scales consistent; no fabricated backtests or claims that historical scenarios forecast future losses.

## Validation gate
- Review extracted values beside source page references before generating slides.
- Preserve exact dates, labels, score scale, units, assumptions and methodology disclosures.
- Block incompatible comparisons (different horizon, confidence, portfolio basis or report date) until reviewed.
- Omit unavailable slides rather than synthesizing data.
- Use navy, white and blue; avoid gold bars and alarmist color coding.

## Next input needed
One anonymized Riskalyze export/report and any example slide already approved for client use. Confirm which of risk alignment, modeled range and scenarios belongs in the default deck before implementing extraction or enabling the component.
