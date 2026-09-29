# Attribution report — slide skill specification

Status: draft contract; awaiting an anonymized source report and layout review. This is an app module specification, not an installed or executable skill.

## Purpose and inputs
Turn a supplied, authoritative performance-attribution report into one to three GSWM slides. Holdings alone are insufficient. Require portfolio/benchmark names, exact period, base currency, gross/net basis, portfolio return, benchmark return, reported attribution methodology and units, and source page references. Accept supplied allocation, selection and interaction effects at the report's stated level; require contributions to return separately if used. Never call contribution to return “attribution.”

## Slide 1 — What drove relative performance
16:9 white slide with navy title in the top 12%. Period and benchmark sit directly below. Three aligned figures show portfolio return, benchmark return and active return. The middle 55% is a diverging horizontal chart of the largest positive and negative reported sector effects, with a common zero line and labels in basis points. Use navy and light blue, never gold. The right quarter holds at most two observations derived from those exact effects. Bottom band contains method, gross/net basis, source and residual disclosure. Show a residual/Other row whenever effects have been aggregated.

## Optional slide 2 — Allocation and selection
Select only if the report supplies compatible allocation/selection effects. Use grouped diverging horizontal bars, one row per sector, a shared symmetric scale and a compact two-color legend. Show interaction separately if the supplied method requires it. Label exact units. Do not combine effects from different methodologies or periods.

## Optional slide 3 — Contributors and detractors
Select only if security-level contribution data exists. Two balanced ranked lists, five contributors and five detractors at most, with compact horizontal bars and exact reported contributions. The heading must say “Contribution to return” when that is the metric. Do not imply security contributions explain benchmark-relative attribution unless the source actually provides it.

## Validation gate
- Extract values and source references for review before generating slides.
- Reconcile portfolio return minus benchmark return to active return using the source's definition and rounding tolerance. Distinguish arithmetic and geometric excess return.
- Reconcile reported effects to their reported total; preserve and label unexplained residuals rather than scaling them away.
- Preserve multi-period linking method; never add monthly effects blindly.
- Never infer returns from a single holdings snapshot or invent missing benchmark returns.
- Report dates, units and source remain visible on every slide.

## Next input needed
One anonymized attribution report, plus a preferred finished slide if available. Use it to finalize field extraction, tolerances, exact layout and a reproducible acceptance fixture before exposing this module as selectable in the app.
