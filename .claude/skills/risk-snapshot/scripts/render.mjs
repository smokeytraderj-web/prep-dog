// Render a snapshot as a print-ready GSWM deck slide (HTML + inline SVG).
//
// Chrome follows the deck's house style in src/styles.css and src/main.jsx:
// 16:10 page, brand lockup top-left, gold eyebrow over a serif title, right
// aligned as-of, hairline rules, an italic source note, and a footer carrying
// the reporting basis and page number.
//
// Palette is the app's own. Allocation is four ordered parts of a whole, so it
// uses the brand navy ramp as a sequential scale (checked monotonic
// light-to-dark) rather than four categorical hues -- the brand's muted tones
// cannot supply four that separate under the dataviz checks. The range is the
// one diverging encoding, brand terracotta against brand blue, validated for
// CVD separation and contrast. Re-run the dataviz validator before changing a
// hue, and re-render before calling a layout change done.
const INK = "#142f49";
const INK2 = "#385875";
const MUTED = "#7892a7";
const FAINT = "#8b9eae";
const RULE = "#e6edf3";
const TRACK = "#e7eef5";
const GOLD = "#8c7853";
// Polarity follows src/EquitySlide.jsx: navy against light blue, no red. Both
// ends are directly labeled, so direction is never carried by color alone --
// which is also the required relief for the light step's contrast.
const DOWN = "#1b2a4a";
const UP = "#759bbf";
const RAMP = ["#142f49", "#385875", "#7892a7", "#b9cce4"]; // sequential, dark->light
const LABELS = { stocks: "Stocks", bonds: "Bonds", other: "Other", cash: "Cash" };

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const usd = (n, signed = false) =>
  `${n < 0 ? "−" : signed ? "+" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const pct = (n, d = 2) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(d)}%`;
const plain = (n, d = 2) => `${n.toFixed(d)}%`;

// Risk Score as a ring gauge: the arc fills to the score's place on 1-99 and
// the number sits inside, so the score reads as the page's one headline.
function gauge(score, size = 132) {
  const r = size / 2 - 11;
  const c = 2 * Math.PI * r;
  const frac = (score - 1) / 98;
  const m = size / 2;
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Risk Score ${score} on a 1 to 99 scale.">
    <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${TRACK}" stroke-width="8"/>
    <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"
      stroke-dasharray="${(frac * c).toFixed(2)} ${((1 - frac) * c).toFixed(2)}" transform="rotate(-90 ${m} ${m})"/>
    <text x="${m}" y="${m - 12}" text-anchor="middle" font-size="7.5" letter-spacing="1.9" fill="${MUTED}" font-weight="600">RISK SCORE</text>
    <text x="${m}" y="${m + 21}" text-anchor="middle" font-size="44" font-weight="400" fill="${INK}" font-family="Georgia,serif">${score}</text>
    <text x="${m}" y="${m + 38}" text-anchor="middle" font-size="8" fill="${FAINT}">of 99</text>
  </svg>`;
}

// Diverging range bar, anchored at today's value. Ending portfolio values sit
// above each end and the percentile each one represents sits below, so the bar
// states what the metric is without a legend.
function rangeBar(range, total, w, h = 15) {
  const span = Math.abs(range.downside_pct) + Math.abs(range.upside_pct) || 1;
  const z = (Math.abs(range.downside_pct) / span) * w;
  const lo = total + range.downside_value;
  const hi = total + range.upside_value;
  return `<svg viewBox="0 0 ${w} ${h + 54}" width="${w}" role="img" aria-label="In 95 of 100 modeled six-month periods the portfolio ends between ${usd(lo)} and ${usd(hi)}.">
    <text x="0" y="12" font-size="13" fill="${INK}" font-family="Georgia,serif">${usd(lo)}</text>
    <text x="${z.toFixed(1)}" y="12" font-size="9" fill="${MUTED}" text-anchor="middle">${usd(total)} today</text>
    <text x="${w}" y="12" font-size="13" fill="${INK}" font-family="Georgia,serif" text-anchor="end">${usd(hi)}</text>
    <g transform="translate(0 24)">
      <path d="M3 0 h${(z - 5).toFixed(1)} v${h} h-${(z - 5).toFixed(1)} a3 3 0 0 1-3-3 v-${h - 6} a3 3 0 0 1 3-3z" fill="${DOWN}"/>
      <path d="M${(z + 2).toFixed(1)} 0 h${(w - z - 5).toFixed(1)} a3 3 0 0 1 3 3 v${h - 6} a3 3 0 0 1-3 3 h-${(w - z - 5).toFixed(1)}z" fill="${UP}"/>
      <line x1="${z.toFixed(1)}" x2="${z.toFixed(1)}" y1="-6" y2="${h + 6}" stroke="${MUTED}" stroke-width="1"/>
      <text x="0" y="${h + 18}" font-size="8.5" fill="${FAINT}">5th percentile &#183; ${pct(range.downside_pct)}</text>
      <text x="${w}" y="${h + 18}" font-size="8.5" fill="${FAINT}" text-anchor="end">95th percentile &#183; ${pct(range.upside_pct)}</text>
    </g>
  </svg>`;
}

// 100% stacked allocation bar on the sequential ramp, largest share first,
// 2px surface gaps between segments.
function stacked(alloc, w, h = 34) {
  let x = 0;
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="Allocation: ${alloc.map((a) => `${LABELS[a.name] ?? a.name} ${plain(a.percent)}`).join(", ")}.">${alloc
    .map((a, i) => {
      const sw = (a.percent / 100) * w - (i ? 2 : 0);
      const g = `<rect x="${(x + (i ? 2 : 0)).toFixed(1)}" y="0" width="${Math.max(0, sw).toFixed(1)}" height="${h}" fill="${RAMP[i] ?? RAMP.at(-1)}"/>`;
      x += sw + (i ? 2 : 0);
      return g;
    })
    .join("")}</svg>`;
}

export function renderSlide(s) {
  // The ramp only reads as a ramp when the shares are ordered.
  const alloc = [...s.allocation].sort((a, b) => b.percent - a.percent);
  const costTotal =
    s.costs.est_tax_drag_pct + s.costs.expense_ratio_pct + s.costs.advisory_fees_pct;
  // One table rather than the vendor's split tiles; cost detail sits beneath it
  // as a quiet line instead of its own block.
  const measures = [
    ["Annualized volatility", plain(s.metrics.annual_volatility_pct)],
    ["Max drawdown", plain(s.metrics.max_drawdown_pct)],
    ["Annual range midpoint", plain(s.metrics.annual_range_midpoint_pct)],
    ["Annual dividend", plain(s.metrics.annual_dividend_pct)],
    ["Risk-adjusted grade", `${s.metrics.grade.toFixed(1)} / 4.3`],
    ["Total annual cost", plain(costTotal)],
  ];

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>Risk Snapshot &mdash; ${esc(s.portfolio_label)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#101c30;font-family:"Inter","Segoe UI",Arial,sans-serif;color:${INK};-webkit-font-smoothing:antialiased}
  .slide{width:1280px;height:800px;margin:20px auto;background:#fff;padding:48px 64px 30px;display:flex;flex-direction:column;overflow:hidden}
  .brand{display:flex;align-items:center;gap:14px}
  .mark{width:38px;height:38px;border-radius:50%;border:1px solid #b7c3cf;display:flex;align-items:center;justify-content:center;font-family:Georgia,serif;font-size:13px;line-height:1;letter-spacing:-.5px;color:${INK};flex:none}
  .brand>div b{display:block;font-size:8px;letter-spacing:1.5px;font-weight:600;color:${INK}}
  .brand>div span{display:block;font-size:5.5px;letter-spacing:1.8px;color:#8094a4;margin-top:4px}
  .head{display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;padding-bottom:16px;border-bottom:1px solid ${RULE}}
  .eyebrow{font-size:9px;letter-spacing:2.2px;font-weight:600;color:${GOLD};margin:0 0 14px}
  h2{font-family:Georgia,"Times New Roman",serif;font-size:36px;font-weight:400;letter-spacing:-1px;line-height:1.15;margin:0}
  .asof{font-size:10px;color:${INK2};letter-spacing:.3px}
  .body{flex:1;display:flex;flex-direction:column;min-height:0}
  .lede{display:grid;grid-template-columns:1fr 1fr 190px;gap:48px;align-items:center;padding:18px 0;border-bottom:1px solid ${RULE}}
  .lede em{font-style:normal;display:block;font-size:8.5px;letter-spacing:1.9px;color:${MUTED};font-weight:600;margin-bottom:11px}
  .lede b{font-family:Georgia,serif;font-size:34px;font-weight:400;letter-spacing:-1.2px;line-height:1;display:block;font-variant-numeric:tabular-nums}
  .lede p{font-size:10px;color:${MUTED};margin:9px 0 0}
  .pair{display:flex;gap:40px}
  .pair b{font-size:24px}
  .pair i{font-style:normal;display:block;font-size:8.5px;letter-spacing:1.6px;text-transform:uppercase;color:${MUTED};font-weight:600;margin-top:9px}
  .pair span{display:block;font-size:11px;color:${INK2};margin-top:4px;font-variant-numeric:tabular-nums}
  .grid{display:grid;grid-template-columns:1fr 320px;gap:60px;padding-top:20px;flex:1;min-height:0}
  h3{font-size:8.5px;letter-spacing:1.9px;text-transform:uppercase;color:${MUTED};font-weight:600;margin:0 0 16px}
  .explain{font-size:9.5px;line-height:1.6;color:${INK2};margin:11px 0 0;max-width:560px}
  .legend{display:flex;flex-wrap:wrap;gap:9px 28px;font-size:10.5px;color:${INK2};margin-top:12px}
  .sw{width:8px;height:8px;border-radius:2px;display:inline-block;margin-right:7px;vertical-align:middle}
  table{width:100%;border-collapse:collapse;font-size:10.5px}
  td{padding:8px 0;border-bottom:1px solid ${RULE}}
  td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-weight:500}
  tr:last-child td{border-bottom:0}
  .costline{font-size:9px;color:${FAINT};margin:12px 0 0;line-height:1.6}
  .note{font-size:9px;font-style:italic;color:${FAINT};line-height:1.6;margin:16px 0 0;flex:none}
  footer{display:flex;justify-content:space-between;font-size:7.5px;color:${FAINT};letter-spacing:.4px;border-top:1px solid ${RULE};padding-top:12px;margin-top:12px;flex:none}
  @media print{body{background:#fff}.slide{margin:0}@page{size:1280px 800px;margin:0}}
</style></head>
<body><section class="slide">
  <div class="brand"><span class="mark">G&amp;S</span><div><b>GOTTFRIED &amp; SOMBERG</b><span>WEALTH MANAGEMENT</span></div></div>
  <div class="head">
    <div><p class="eyebrow">RISK SNAPSHOT</p><h2>How much the portfolio can move</h2></div>
    <span class="asof">As of ${esc(s.as_of)}</span>
  </div>
  <div class="body">
    <div class="lede">
      <div>
        <em>${esc(s.portfolio_label.toUpperCase())} TOTAL</em>
        <b>${usd(s.total_value)}</b>
        <p>Supplied position values${s.client_label ? ` &#183; ${esc(s.client_label)}` : ""}</p>
      </div>
      <div>
        <em>SIX-MONTH RANGE &#183; 95% PROBABILITY</em>
        <div class="pair">
          <div><b>${pct(s.range.downside_pct)}</b><i>Downside</i><span>${usd(s.range.downside_value)}</span></div>
          <div><b>${pct(s.range.upside_pct)}</b><i>Upside</i><span>${usd(s.range.upside_value, true)}</span></div>
        </div>
      </div>
      <div style="justify-self:end;text-align:center">
        ${gauge(s.risk_score)}
        <p style="margin-top:8px">Set by the six-month downside</p>
      </div>
    </div>
    <div class="grid">
      <div>
        <h3>Where the portfolio could be in six months</h3>
        ${rangeBar(s.range, s.total_value, 560)}
        <p class="explain">In 95 of every 100 modeled six-month periods the portfolio ends between these two values. One period in twenty falls outside them, and the model does not say how far.</p>
        <div style="margin-top:20px">
          <h3>Allocation</h3>
          ${stacked(alloc, 560)}
          <div class="legend">${alloc
            .map(
              (a, i) =>
                `<span><span class="sw" style="background:${RAMP[i] ?? RAMP.at(-1)}"></span>${esc(LABELS[a.name] ?? a.name)} <b style="font-weight:500">${plain(a.percent)}</b></span>`,
            )
            .join("")}</div>
        </div>
      </div>
      <div>
        <h3>Portfolio measures</h3>
        <table>${measures.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
        <p class="costline">Cost detail: est. tax drag ${plain(s.costs.est_tax_drag_pct)} &#183; expense ratio ${plain(s.costs.expense_ratio_pct)} &#183; advisory ${plain(s.costs.advisory_fees_pct)}</p>
      </div>
    </div>
    <p class="note">${esc(s.basis.method)} The range is a modeled ${esc(s.range.confidence)} over ${s.range.horizon_months} months from ${esc(s.basis.covariance)} &mdash; not a guarantee and not a forecast of maximum loss. Risk-free ${plain(s.basis.risk_free_pct)}. ${esc(s.basis.drawdown_basis)}${s.warnings.length ? ` ${esc(s.warnings.join(" "))}` : ""}</p>
  </div>
  <footer>
    <span>Source: supplied portfolio position values</span>
    <span>${esc(s.page_number ?? "")}</span>
  </footer>
</section></body></html>
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import("node:fs");
  const [, , inPath, outPath] = process.argv;
  if (!inPath) {
    console.error("usage: node scripts/render.mjs <snapshot.json> [out.html]");
    process.exit(1);
  }
  const html = renderSlide(JSON.parse(fs.readFileSync(inPath, "utf8")));
  if (outPath) fs.writeFileSync(outPath, html);
  else process.stdout.write(html);
}
