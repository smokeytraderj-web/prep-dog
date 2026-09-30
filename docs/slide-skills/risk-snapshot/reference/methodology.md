# Risk snapshot methodology

Every formula the skill uses, in the order `scripts/snapshot.mjs` applies them.
Implementation: `scripts/lib.mjs`. All anchors are ours; they are calibrated to
be monotonic and continuous, not to match any vendor's proprietary score.

## 1. Weights and allocation
Weight `w_i = value_i / total`. Allocation is the weight sum per asset class,
in percent. Classes: stocks, bonds, other, cash.

## 2. Return and volatility
With aligned price history for every holding, a blended portfolio series is
built as `P_t = sum_i w_i * (price_i,t / price_i,0)`, converted to periodic
simple returns, then annualized: `vol = stdev(r) * sqrt(periods_per_year)`
(sample stdev, n-1) and `return = (1 + mean(r))^periods_per_year - 1`. This
carries real covariance.

Without aligned history, return is the weighted average of supplied annual
returns and volatility is
`sqrt( sum_i sum_j w_i w_j sigma_i sigma_j rho(class_i, class_j) )`,
with `rho = 1` for a holding against itself and otherwise the class matrix in
`lib.mjs` (`DEFAULT_CORRELATION`, overridable per run via `input.correlation`).
Runs of this kind emit a warning that the slide footer prints.

## 3. Six-month 90% probability range
Scaled to a six-month horizon: `mu6 = (1 + annual_return)^0.5 - 1`,
`sigma6 = annual_vol / sqrt(2)`. The range is the one-tailed 5th and 95th
percentile of a normal distribution:

```
downside = mu6 - 1.645 * sigma6
upside   = mu6 + 1.645 * sigma6
```

Dollar figures are the percentages times the portfolio total. The range is a
modeled distribution, not a guarantee, not a forecast and not a maximum loss.

## 4. Annual range midpoint
`(1 + (downside + upside) / 2)^2 - 1` — the six-month midpoint compounded to a
year. Worked check: a -10.27% / +18.33% range gives 8.22%.

## 5. Risk Score (1-99)
Piecewise-linear interpolation on the loss portion of six-month downside, clamped to
1..99 and rounded:

| Downside | 0% | 2.5% | 5% | 10% | 15% | 20% | 30% | 45%+ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Score | 1 | 15 | 27 | 51 | 68 | 79 | 90 | 99 |

A -10.27% downside gives 52. Higher score means more modeled downside; it is not
a suitability judgment and carries no vendor's meaning.

## 6. Risk-adjusted grade (0.0-4.3)
`ratio = (annual range midpoint - risk_free) / annual volatility`, then
interpolation on: -0.25 -> 0.0, 0 -> 1.0, 0.10 -> 1.8, 0.20 -> 2.6,
0.30 -> 3.6, 0.40 -> 4.3. Rounded to one decimal. The model omits the grade when volatility is zero or the risk-free rate is missing.
This is not a Riskalyze GPA and will not agree with one.

## 7. Max drawdown
From the blended portfolio series, the worst `P_t / running_peak - 1`. Without
aligned history: the weighted average of supplied holding drawdowns, which is
not a portfolio drawdown and is labeled as such; with neither, the measure is omitted. The basis used is always printed in the footer.

## 8. Costs
Weighted averages of the supplied per-holding `tax_drag_pct` and
`expense_ratio_pct`, plus the stated `advisory_fee_pct` (not weighted, not
inferred). Omitted inputs stay missing; the app omits incomplete measures and total costs.

## Validation gates
- Reject non-positive values, duplicate tickers, unknown asset classes, missing
  date or label, and a holding with neither history nor both return and vol.
- Allocation must total 100%; dollar range must equal percent range times total.
- Never mix two portfolios computed on different horizons, confidence levels,
  risk-free rates or period counts on one slide.
- Never retune an anchor table to produce an expected score.

## Matching a vendor's exact score

Exact parity with a Riskalyze/Nitrogen Risk Number is **not reachable by
computation from holdings alone**, for three separate reasons. Only one of them
is about the formula:

1. **The mapping is proprietary.** The scale from modeled downside to a 1-99
   score is not published. Ours is an anchor table that happens to agree at the
   point we could observe (-10.27% downside -> 52).
2. **The inputs differ even when the formula agrees.** Their score is computed
   from their own security history database, their lookback window and stress
   period, and their look-through from funds to underlying holdings. Two engines
   using the same formula on different return histories produce different
   scores. This is usually a larger gap than the mapping.
3. **Some inputs are not derivable.** A client's risk tolerance score comes from
   a questionnaire, not from a portfolio. No amount of holdings data recovers it.

Three honest routes, best first:

- **Use their number.** If the firm subscribes, take the score from the vendor's
  own report or integration and put it on the slide with attribution. This is the
  only way to display a real Risk Number, and it is not a compliance problem
  because it is theirs and is labeled as theirs.
- **Calibrate ours against theirs.** Collect real report pages that print both a
  six-month 95% downside and the score, record them in `assets/calibration.json`,
  and run `scripts/calibrate.mjs` to see the residual and a re-fitted anchor
  table. Roughly a dozen pairs spread across the range gets our score close over
  the range that matters. It still will not tie out holding-for-holding, because
  of reason 2 above.
- **Improve the inputs.** Supplying real aligned price history for every holding
  removes our correlation assumptions and is the single biggest accuracy gain
  available to us. Do this before touching the anchors.

Never retune an anchor to make one portfolio hit an expected number, and never
label a calibrated output as a Risk Number or a GPA. Calibration narrows a gap
between two different measures; it does not merge them.

## Slide chrome

The slide follows the deck's house style, taken from `src/styles.css` and
`src/main.jsx` rather than invented: a 16:10 page, the brand lockup top-left,
a gold eyebrow over a serif title, the as-of right-aligned on the title
baseline, hairline `#e6edf3` rules, an italic source note, and a footer
carrying the reporting basis and the page number (`page_number` on the input).
A slide that does not sit beside the other deck pages unchanged is wrong, so
compare against them before shipping a layout change.

## Slide encodings

The palette is the app's own (`src/styles.css`), not a vendor's.

- **Allocation is sequential, not categorical.** Four asset classes are ordered
  parts of one whole, so they use the brand navy ramp
  (`#142f49 #385875 #7892a7 #b9cce4`, checked monotonic light-to-dark) with the
  largest share first, 2px surface gaps and a directly labeled legend. The
  brand's muted tones cannot supply four categorical hues that separate under
  the dataviz checks -- gold against terracotta fails even for normal vision --
  so four distinct hues here would be a defect, not a style choice.
- **The range is navy against light blue**, the same polarity pair
  `src/EquitySlide.jsx` already uses (`#1b2a4a` / `#759bbf`), zero-anchored. No
  red and no green anywhere on the slide. Because the light step sits under 3:1
  against white, both ends carry their value as a direct label -- that labeling
  is the required relief, not decoration, so do not remove it. Direction is
  never carried by color alone.
- **The Risk Score is a ring gauge**, filled to the score's position on 1-99
  with the number inside and `of 99` naming the scale. No marker, no needle and
  no colored zones: an arc against a plain track is the whole mark. It is the
  page's headline, and the downside figure that sets it is labeled as its
  source.
- **Measures are one table**, with cost components demoted to a single quiet
  line beneath it rather than their own block, and annualized volatility
  promoted out of the footnote. The page carries one chart per idea and no
  decoration: anything that does not answer how much, how risky, what of, or
  what it costs does not belong on it.

The range is stated so it explains itself. The lede names each side (Downside,
Upside) with its percentage and its dollar figure. The bar is anchored at
today's value and labeled with the ending portfolio values at each end, the
percentile each one represents, and one sentence saying what 90% means: in 90
of every 100 modeled six-month periods the portfolio ends between them, one in
ten falls outside, and the model does not say how far. A range shown as two
bare percentages is not a finished slide -- a reader who does not already know
the measure cannot tell what it claims, and the tail disclosure is what keeps
the modeled range from reading as a floor.

Figures on the page wear ink, never a series color: the range percentages are
navy text beside a colored bar, not colored text.

Re-run `scripts/validate_palette.js` from the dataviz skill before changing any
hue, and re-render and look at the slide before calling a layout change done.
