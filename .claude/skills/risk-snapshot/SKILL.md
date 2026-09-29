---
name: risk-snapshot
description: Turn a holdings list into a one-page risk snapshot slide — portfolio total, 1-99 Risk Score, six-month 95% probability range in dollars and percent, stocks/bonds/other/cash allocation donut, risk-adjusted grade, dividend, max drawdown, annual range midpoint, and a tax drag / expense ratio / advisory fee cost bar. Use this when someone asks for a Riskalyze- or Nitrogen-style risk page, a "risk number" slide, a proposal risk summary, a downside/upside range for a portfolio, or a risk section for a GSWM client deck. Not for sector attribution (see docs/slide-skills/attribution-report.md) or equity sector exposure (src/EquitySlide.jsx).
---

# Risk snapshot slide

Builds the risk page of a client deck from holdings the user supplies. It is an
in-house re-implementation of the layout and measure set of a Riskalyze/Nitrogen
proposal page, formatted for GSWM 16:9 slides. It does **not** reproduce their
proprietary Risk Number or GPA, and no output may be labeled as theirs.

## Pipeline

```sh
node scripts/snapshot.mjs input.json snapshot.json   # holdings -> measures
node scripts/render.mjs snapshot.json slide.html     # measures -> 16:9 slide
```

`slide.html` is self-contained (no scripts, no network, inline SVG) and prints to
one 1280x720 page. Run `node --test scripts/snapshot.test.mjs` after any change.

## Step 1 — collect the input

Write `input.json` from what the user gives you. `assets/sample-input.json` is a
working example. Never invent a figure; ask for anything missing.

| Field | Required | Notes |
| --- | --- | --- |
| `as_of` | yes | Date shown on the slide. |
| `portfolio_label` | yes | e.g. `Proposal`, `Current`. |
| `client_label` | no | Printed beside the portfolio total. |
| `page_number` | no | Footer page number, e.g. `06`, to match its place in the deck. |
| `risk_free_pct` | no | Default 4.0; used only by the grade. |
| `advisory_fee_pct` | no | Default 0; stated, never assumed. |
| `periods_per_year` | no | Default 12; set 252 for daily history. |
| `holdings[].ticker` | yes | Unique; combine duplicates first. |
| `holdings[].value` | yes | Position value in USD, positive. |
| `holdings[].asset_class` | yes | `stocks`, `bonds`, `other` or `cash`. |
| `holdings[].history` | preferred | Prices, oldest first, same periods for every holding. |
| `holdings[].annual_return_pct` / `annual_vol_pct` | if no history | Both required together. |
| `holdings[].yield_pct`, `expense_ratio_pct`, `tax_drag_pct` | no | Default 0, which understates the cost bar — say so if you leave them out. |
| `holdings[].max_drawdown_pct` | no | Only used when history is absent. |

The repository's own paste/upload parser (`src/holdings.js`) gives you ticker and
value; asset class and the return inputs still have to be supplied or looked up.

Supply `history` whenever you can. Aligned history for *every* holding gives a
real blended portfolio series — true covariance and a true drawdown. Anything
else falls back to the documented class-correlation assumptions and the snapshot
carries a warning that the slide footer prints.

## Step 2 — review before rendering

Read `snapshot.json` back to the user with the inputs beside it, and check:

- Allocation totals 100% and the class split matches how they describe the book.
- The downside and upside dollar figures equal the percentages times the total.
- Every `warnings` entry is acceptable to show a client; they appear in the footer.
- Costs are not silently zero.
- Comparing two portfolios? Build one snapshot per portfolio from the **same**
  horizon, confidence, risk-free rate and period count, or don't show them together.

## Step 3 — render and place

Render the slide, open it, and print to PDF at 1280x800 (16:10, the deck's page
size). To pull it into a deck,
hand `snapshot.json` to the deck builder rather than re-typing figures.

## Matching a vendor's score

Asked to make the number tie out to a Riskalyze/Nitrogen report? Read
`reference/methodology.md` section "Matching a vendor's exact score" before
answering. Short version: exact parity is not computable from holdings, mostly
because their security history and fund look-through differ from ours, not
because of the formula. Use their number if the firm subscribes; otherwise
record real report pairs in `assets/calibration.json` and run
`node scripts/calibrate.mjs` to measure and narrow the gap. Supplying real price
history helps more than retuning anchors ever will.

## Rules

- The Risk Score, grade and range come from `reference/methodology.md`. Do not
  retune the anchors to hit a number someone expects.
- Never call the output a Riskalyze Risk Number, a Nitrogen score or a GPA.
- The range is modeled, not a guarantee and not a maximum loss. The footer says
  so; keep it.
- No live prices are fetched. Values are the supplied position values.
- Colors are the app's own palette and the encodings are deliberate; see
  "Slide encodings" in `reference/methodology.md`. Re-run the dataviz validator
  before changing any hue, and re-render before calling a layout change done.
- Omit a measure rather than estimating it. A missing measure is a question for
  the user, not a default.
