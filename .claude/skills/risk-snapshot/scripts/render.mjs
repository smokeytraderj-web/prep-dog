// Render a snapshot as a print-ready 16:9 GSWM slide (HTML + inline SVG).
const NAVY = "#1b2a4a";
const MID = "#759bbf";
const DOWN = "#b8433a";
const UP = "#2e7d64";
const CLASS_COLORS = {
  stocks: "#1b2a4a",
  bonds: "#4a7fb5",
  other: "#8a7652",
  cash: "#b6c6d6",
};
const LABELS = { stocks: "Stocks", bonds: "Bonds", other: "Other", cash: "Cash" };

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const usd = (n, signed = false) =>
  `${n < 0 ? "-" : signed ? "+" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const pct = (n, d = 2) => `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`;
const plain = (n, d = 2) => `${n.toFixed(d)}%`;

function donut(slices) {
  const r = 52;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = slices
    .map((s) => {
      const len = (s.percent / 100) * c;
      const seg = `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${CLASS_COLORS[s.name] ?? MID}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" transform="rotate(-90 70 70)"/>`;
      offset += len;
      return seg;
    })
    .join("");
  return `<svg viewBox="0 0 140 140" width="140" height="140" role="img" aria-label="Asset allocation. Exact percentages are listed beside the chart.">${arcs}</svg>`;
}

function rangeBar(range) {
  const span = Math.abs(range.downside_pct) + Math.abs(range.upside_pct) || 1;
  const zero = (Math.abs(range.downside_pct) / span) * 660;
  return `<svg viewBox="0 0 660 34" role="img" aria-label="Six month ninety-five percent probability range. Exact values are labeled above the bar.">
      <rect x="0" y="12" width="${zero.toFixed(1)}" height="9" fill="${DOWN}"/>
      <rect x="${zero.toFixed(1)}" y="12" width="${(660 - zero).toFixed(1)}" height="9" fill="${UP}"/>
      <text x="0" y="33" font-size="9" fill="#6f879b">5%</text>
      <text x="660" y="33" font-size="9" fill="#6f879b" text-anchor="end">95%</text>
    </svg>`;
}

function costBar(costs) {
  const parts = [
    ["est_tax_drag_pct", "Est. Tax Drag", NAVY],
    ["expense_ratio_pct", "Expense Ratio", "#d0942f"],
    ["advisory_fees_pct", "Advisory Fees", "#6a5a8c"],
  ];
  const scale = Math.max(1, parts.reduce((s, [k]) => s + costs[k], 0));
  let x = 0;
  const segs = parts
    .map(([k, , color]) => {
      const w = (costs[k] / scale) * 660;
      const seg = `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="10" fill="${color}"/>`;
      x += w;
      return seg;
    })
    .join("");
  const legend = parts
    .map(
      ([k, label, color]) =>
        `<div><span class="rs-swatch" style="background:${color}"></span><strong>${plain(costs[k])}</strong><span>${label}</span></div>`,
    )
    .join("");
  return { svg: `<svg viewBox="0 0 660 10" role="img" aria-label="Proposal costs. Exact percentages are listed below.">${segs}</svg><div class="rs-scale"><span>0%</span><span>${scale.toFixed(0)}%</span></div>`, legend };
}

function scoreScale(score) {
  const x = ((score - 1) / 98) * 300;
  return `<svg viewBox="0 0 310 54" role="img" aria-label="Risk Score ${score} on a 1 to 99 scale.">
      <rect x="0" y="16" width="300" height="7" fill="#e2e8ef"/>
      <rect x="0" y="16" width="${x.toFixed(1)}" height="7" fill="${NAVY}"/>
      <polygon points="${(x - 5).toFixed(1)},11 ${(x + 5).toFixed(1)},11 ${x.toFixed(1)},18" fill="${NAVY}"/>
      <text x="${x.toFixed(1)}" y="8" font-size="10" fill="${NAVY}" text-anchor="middle" font-weight="600">${score}</text>
      <text x="0" y="38" font-size="9" fill="#6f879b">1 · less modeled downside</text>
      <text x="300" y="38" font-size="9" fill="#6f879b" text-anchor="end">99</text>
    </svg>`;
}

export function renderSlide(s) {
  const cost = costBar(s.costs);
  const metrics = [
    ["Risk-Adjusted Grade", s.metrics.grade.toFixed(1)],
    ["Annual Dividend", plain(s.metrics.annual_dividend_pct)],
    ["Max Drawdown", plain(s.metrics.max_drawdown_pct)],
    ["Annual Range Midpoint", plain(s.metrics.annual_range_midpoint_pct)],
  ];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>Risk Snapshot — ${esc(s.portfolio_label)}</title>
<style>
  :root{--navy:${NAVY};--muted:#6f879b}
  *{box-sizing:border-box}
  body{margin:0;background:#0f1d33;font-family:"Inter","Segoe UI",Arial,sans-serif;color:var(--navy)}
  .rs-slide{width:1280px;height:720px;margin:24px auto;background:#fff;padding:44px 56px;display:flex;flex-direction:column}
  .rs-head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e2e8ef;padding-bottom:18px}
  .rs-kicker{font-size:9px;letter-spacing:1.8px;color:#8a7652;margin:0 0 6px}
  .rs-total{font-size:44px;font-weight:450;letter-spacing:-1.5px;margin:0}
  .rs-sub{font-size:11px;color:var(--muted);margin:6px 0 0}
  .rs-score{border:2px solid var(--navy);padding:8px 16px;text-align:center}
  .rs-score span{display:block;font-size:9px;letter-spacing:1.6px}
  .rs-score strong{display:block;font-size:34px;font-weight:500;line-height:1.1}
  .rs-body{display:grid;grid-template-columns:1fr 360px;gap:36px;flex:1;padding-top:22px}
  h3{font-size:10px;letter-spacing:1.6px;color:#8a7652;font-weight:600;margin:0 0 12px;text-transform:uppercase}
  .rs-range-figs{display:flex;gap:44px;margin-bottom:6px}
  .rs-range-figs strong{display:block;font-size:22px;font-weight:450}
  .rs-range-figs span{font-size:11px;color:var(--muted)}
  .rs-down strong{color:${DOWN}}.rs-up strong{color:${UP}}
  .rs-alloc{display:flex;align-items:center;gap:28px;margin-top:30px}
  .rs-legend{flex:1;font-size:12px}
  .rs-legend div{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #f0f3f7}
  .rs-legend b{margin-left:auto;font-weight:500}
  .rs-swatch{width:9px;height:9px;border-radius:2px;flex:none;display:inline-block}
  .rs-metrics div{display:flex;justify-content:space-between;font-size:12px;background:#f5f7fa;padding:9px 12px;margin-bottom:6px}
  .rs-metrics b{font-weight:500}
  .rs-costs{margin-top:26px}
  .rs-scale{display:flex;justify-content:space-between;font-size:9px;color:var(--muted);margin-top:3px}
  .rs-cost-legend{display:flex;gap:18px;margin-top:12px;font-size:10px;color:var(--muted)}
  .rs-cost-legend div{display:flex;align-items:center;gap:5px}
  .rs-cost-legend strong{font-size:12px;color:var(--navy);font-weight:500}
  .rs-note{font-size:10px;line-height:1.6;color:var(--muted);margin:8px 0 0}
  .rs-foot{border-top:1px solid #e2e8ef;padding-top:12px;margin-top:auto;font-size:9px;line-height:1.6;color:var(--muted)}
  @media print{body{background:#fff}.rs-slide{margin:0;box-shadow:none}@page{size:1280px 720px;margin:0}}
</style></head>
<body><section class="rs-slide">
  <header class="rs-head">
    <div>
      <p class="rs-kicker">${esc(s.portfolio_label.toUpperCase())} TOTAL</p>
      <p class="rs-total">${usd(s.total_value)}</p>
      <p class="rs-sub">${esc(s.client_label ? `${s.client_label} · ` : "")}As of ${esc(s.as_of)}</p>
    </div>
    <div class="rs-score"><span>RISK</span><strong>${s.risk_score}</strong></div>
  </header>
  <div class="rs-body">
    <div>
      <h3>95% Probability Range (${s.range.horizon_months} months)</h3>
      <div class="rs-range-figs">
        <div class="rs-down"><strong>${usd(s.range.downside_value)}</strong><span>${pct(s.range.downside_pct)}</span></div>
        <div class="rs-up"><strong>${usd(s.range.upside_value, true)}</strong><span>${pct(s.range.upside_pct)}</span></div>
      </div>
      ${rangeBar(s.range)}
      <div class="rs-alloc">
        ${donut(s.allocation)}
        <div class="rs-legend">${s.allocation
          .map(
            (a) =>
              `<div><span class="rs-swatch" style="background:${CLASS_COLORS[a.name] ?? MID}"></span>${LABELS[a.name] ?? esc(a.name)}<b>${plain(a.percent)}</b></div>`,
          )
          .join("")}</div>
      </div>
      <div class="rs-costs">
        <h3>Proposal Costs</h3>
        ${cost.svg}
        <div class="rs-cost-legend">${cost.legend}</div>
      </div>
    </div>
    <div>
      <h3>Portfolio Measures</h3>
      <div class="rs-metrics">${metrics
        .map(([k, v]) => `<div>${esc(k)}<b>${esc(v)}</b></div>`)
        .join("")}</div>
      <h3 style="margin-top:26px">Risk Score</h3>
      ${scoreScale(s.risk_score)}
      <p class="rs-note">Our 1&ndash;99 scale, from the modeled six-month downside. Not a suitability judgment and not a vendor score.</p>
    </div>
  </div>
  <footer class="rs-foot">
    ${esc(s.basis.method)} Range is a modeled ${esc(s.range.confidence)} over ${s.range.horizon_months} months from ${esc(s.basis.covariance)}, not a guarantee or a forecast of maximum loss. Volatility ${plain(s.metrics.annual_volatility_pct)} annualized; risk-free ${plain(s.basis.risk_free_pct)}. ${esc(s.basis.drawdown_basis)} Values are supplied position values, not live prices.${s.warnings.length ? ` ${esc(s.warnings.join(" "))}` : ""}
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
