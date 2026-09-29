// Render a snapshot as a print-ready 16:9 GSWM slide (HTML + inline SVG).
//
// Palette is the app's own (src/styles.css), not a vendor's. Allocation is four
// ordered parts of a whole, so it uses the brand navy ramp as a sequential
// scale (checked monotonic light-to-dark) rather than four categorical hues --
// the brand's muted tones cannot supply four that separate under the dataviz
// checks. The range is the one diverging encoding: brand terracotta against
// brand blue, validated for CVD separation and contrast. Re-run the dataviz
// validator before changing any hue.
const INK = "#142f49";
const INK2 = "#385875";
const MUTED = "#7892a7";
const RULE = "#dce4ec";
const TRACK = "#e7eef5";
const GOLD = "#bfa775";
const DOWN = "#bd6a52";
const UP = "#3d6fa8";
const RAMP = ["#142f49", "#385875", "#7892a7", "#b9cce4"]; // sequential, dark->light
const LABELS = { stocks: "Stocks", bonds: "Bonds", other: "Other", cash: "Cash" };

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const usd = (n, signed = false) =>
  `${n < 0 ? "−" : signed ? "+" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
const pct = (n, d = 2) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(d)}%`;
const plain = (n, d = 2) => `${n.toFixed(d)}%`;

// Risk Score as a circular gauge: the filled arc is the score's position on the
// 1-99 scale, the number sits inside the ring.
function gauge(score, size = 172) {
  const r = size / 2 - 15;
  const c = 2 * Math.PI * r;
  const frac = (score - 1) / 98;
  const mid = size / 2;
  const angle = -90 + frac * 360;
  const px = mid + r * Math.cos((angle * Math.PI) / 180);
  const py = mid + r * Math.sin((angle * Math.PI) / 180);
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Risk Score ${score} on a 1 to 99 scale.">
    <circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${TRACK}" stroke-width="13"/>
    <circle cx="${mid}" cy="${mid}" r="${r}" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"
      stroke-dasharray="${(frac * c).toFixed(2)} ${((1 - frac) * c).toFixed(2)}" transform="rotate(-90 ${mid} ${mid})"/>
    <circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="7.5" fill="#fff" stroke="${GOLD}" stroke-width="3"/>
    <text x="${mid}" y="${mid - 6}" text-anchor="middle" font-size="9.5" letter-spacing="1.7" fill="${MUTED}" font-weight="600">RISK SCORE</text>
    <text x="${mid}" y="${mid + 32}" text-anchor="middle" font-size="50" font-weight="500" fill="${INK}">${score}</text>
    <text x="${mid}" y="${mid + 50}" text-anchor="middle" font-size="9.5" fill="${MUTED}">1 &#183; low &#8212; 99 &#183; high</text>
  </svg>`;
}

// Diverging range bar, anchored at zero, 4px rounded outer ends.
function rangeBar(range, w = 470, h = 15) {
  const span = Math.abs(range.downside_pct) + Math.abs(range.upside_pct) || 1;
  const z = (Math.abs(range.downside_pct) / span) * w;
  return `<svg viewBox="0 0 ${w} ${h + 21}" width="${w}" role="img" aria-label="Six-month 95% probability range from ${pct(range.downside_pct)} to ${pct(range.upside_pct)}.">
    <path d="M4 0 h${(z - 6).toFixed(1)} v${h} h-${(z - 6).toFixed(1)} a4 4 0 0 1-4-4 v-${h - 8} a4 4 0 0 1 4-4z" fill="${DOWN}"/>
    <path d="M${(z + 2).toFixed(1)} 0 h${(w - z - 6).toFixed(1)} a4 4 0 0 1 4 4 v${h - 8} a4 4 0 0 1-4 4 h-${(w - z - 6).toFixed(1)}z" fill="${UP}"/>
    <line x1="${z.toFixed(1)}" x2="${z.toFixed(1)}" y1="-4" y2="${h + 4}" stroke="${INK}" stroke-width="1.5"/>
    <text x="0" y="${h + 19}" font-size="9" fill="${MUTED}">5th percentile</text>
    <text x="${z.toFixed(1)}" y="${h + 19}" font-size="9" fill="${INK2}" text-anchor="middle">0%</text>
    <text x="${w}" y="${h + 19}" font-size="9" fill="${MUTED}" text-anchor="end">95th percentile</text>
  </svg>`;
}

// 100% stacked allocation bar on the sequential ramp, largest share first,
// 2px surface gaps between segments.
function stacked(alloc, w = 500, h = 24) {
  let x = 0;
  const segs = alloc
    .map((a, i) => {
      const sw = (a.percent / 100) * w - (i ? 2 : 0);
      const g = `<rect x="${(x + (i ? 2 : 0)).toFixed(1)}" y="0" width="${Math.max(0, sw).toFixed(1)}" height="${h}" fill="${RAMP[i] ?? RAMP.at(-1)}"/>`;
      x += sw + (i ? 2 : 0);
      return g;
    })
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="Allocation: ${alloc.map((a) => `${LABELS[a.name] ?? a.name} ${plain(a.percent)}`).join(", ")}.">${segs}</svg>`;
}

function costBar(costs, w = 500) {
  const rows = [
    ["Est. Tax Drag", costs.est_tax_drag_pct],
    ["Expense Ratio", costs.expense_ratio_pct],
    ["Advisory Fees", costs.advisory_fees_pct],
  ];
  const total = rows.reduce((a, [, v]) => a + v, 0);
  return { rows, total };
}

export function renderSlide(s) {
  // Allocation reads as a ramp only when it is ordered, so sort by share.
  const alloc = [...s.allocation].sort((a, b) => b.percent - a.percent);
  const { rows: costs, total: costTotal } = costBar(s.costs);
  // Regrouped from the vendor's flat list into what each measure describes.
  const riskRows = [
    ["Annualized Volatility", plain(s.metrics.annual_volatility_pct)],
    ["Max Drawdown", plain(s.metrics.max_drawdown_pct)],
    ["Risk-Adjusted Grade", `${s.metrics.grade.toFixed(1)} / 4.3`],
  ];
  const returnRows = [
    ["Annual Range Midpoint", plain(s.metrics.annual_range_midpoint_pct)],
    ["Annual Dividend", plain(s.metrics.annual_dividend_pct)],
    ["Total Annual Cost", plain(costTotal)],
  ];
  const table = (rows) =>
    `<table class="tab">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>Risk Snapshot &mdash; ${esc(s.portfolio_label)}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#101c30;font-family:"Inter","Segoe UI",Arial,sans-serif;color:${INK};-webkit-font-smoothing:antialiased}
  .rs-slide{width:1280px;height:720px;margin:20px auto;background:#fff;padding:40px 60px 30px;display:flex;flex-direction:column;overflow:hidden}
  .rs-name{font-family:Georgia,"Times New Roman",serif;font-size:19px;letter-spacing:.4px;margin:0}
  .rs-rule{height:2px;background:${INK};margin-top:13px}
  .rs-meta{display:flex;justify-content:space-between;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:${MUTED};margin-top:10px}
  h3{font-size:9.5px;letter-spacing:1.7px;text-transform:uppercase;color:${MUTED};font-weight:600;margin:0 0 13px}
  .rs-body{display:grid;grid-template-columns:1fr 330px;gap:56px;flex:1;padding-top:16px;min-height:0}
  .rs-lede{display:flex;gap:52px;padding-bottom:16px;border-bottom:1px solid ${RULE}}
  .rs-lede em{font-style:normal;display:block;font-size:9.5px;letter-spacing:1.7px;color:${MUTED};font-weight:600;margin-bottom:8px}
  .rs-lede b{font-family:Georgia,serif;font-size:40px;font-weight:400;letter-spacing:-1px;display:block;line-height:1;font-variant-numeric:tabular-nums}
  .rs-lede span{font-size:10.5px;color:${INK2};display:block;margin-top:7px}
  .rs-figs{display:flex;gap:48px;margin-bottom:15px}
  .rs-figs strong{font-family:Georgia,serif;font-size:27px;font-weight:400;display:block;font-variant-numeric:tabular-nums}
  .rs-figs span{font-size:10.5px;color:${INK2}}
  .rs-block{padding:16px 0;border-bottom:1px solid ${RULE}}
  .tab{width:100%;border-collapse:collapse;font-size:12px}
  .tab td{padding:6.5px 0;border-bottom:1px solid ${RULE}}
  .tab td:last-child{text-align:right;font-variant-numeric:tabular-nums;font-weight:500}
  .tab tr:last-child td{border-bottom:0}
  .rs-legend{display:flex;flex-wrap:wrap;gap:8px 24px;font-size:11px;margin-top:11px;color:${INK2}}
  .rs-sw{width:9px;height:9px;border-radius:2px;display:inline-block;margin-right:7px;vertical-align:middle}
  .rs-gauge{display:flex;flex-direction:column;align-items:center;padding-bottom:16px;border-bottom:1px solid ${RULE}}
  .rs-gauge p{font-size:10px;line-height:1.6;color:${MUTED};margin:13px 0 0;text-align:center}
  .rs-costs{display:flex;justify-content:space-between;font-size:11.5px;padding:6px 0;border-bottom:1px solid ${RULE}}
  .rs-costs b{font-weight:500;font-variant-numeric:tabular-nums}
  .rs-foot{font-size:8.5px;line-height:1.55;flex:none;color:${MUTED};border-top:1px solid ${RULE};padding-top:10px;margin-top:12px}
  @media print{body{background:#fff}.rs-slide{margin:0}@page{size:1280px 720px;margin:0}}
</style></head>
<body><section class="rs-slide">
  <p class="rs-name">Risk Snapshot</p><div class="rs-rule"></div>
  <div class="rs-meta">
    <span>${esc(s.portfolio_label)}${s.client_label ? ` &#183; ${esc(s.client_label)}` : ""}</span>
    <span>As of ${esc(s.as_of)}</span>
  </div>
  <div class="rs-body">
    <div>
      <div class="rs-lede">
        <div><em>${esc(s.portfolio_label.toUpperCase())} TOTAL</em><b>${usd(s.total_value)}</b><span>Supplied position values</span></div>
        <div><em>SIX-MONTH DOWNSIDE</em><b style="color:${DOWN}">${pct(s.range.downside_pct)}</b><span>${usd(s.range.downside_value)} &#183; sets the Risk Score</span></div>
        <div><em>SIX-MONTH UPSIDE</em><b style="color:${UP}">${pct(s.range.upside_pct)}</b><span>${usd(s.range.upside_value, true)}</span></div>
      </div>
      <div class="rs-block">
        <h3>95% Probability Range &#183; Six Months</h3>
        ${rangeBar(s.range, 500)}
      </div>
      <div class="rs-block">
        <h3>Allocation</h3>
        ${stacked(alloc, 500)}
        <div class="rs-legend">${alloc
          .map(
            (a, i) =>
              `<span><span class="rs-sw" style="background:${RAMP[i] ?? RAMP.at(-1)}"></span>${esc(LABELS[a.name] ?? a.name)} <b style="font-weight:500">${plain(a.percent)}</b></span>`,
          )
          .join("")}</div>
      </div>
      <div style="padding-top:16px">
        <h3>Proposal Costs</h3>
        ${costs.map(([k, v]) => `<div class="rs-costs"><span>${esc(k)}</span><b>${plain(v)}</b></div>`).join("")}
        <div class="rs-costs" style="border:0"><span style="font-weight:600">Total</span><b>${plain(costTotal)}</b></div>
      </div>
    </div>
    <div>
      <div class="rs-gauge">
        ${gauge(s.risk_score)}
        <p>Our 1&#8211;99 scale, set by the six-month downside above.<br/>Not a suitability judgment and not a vendor score.</p>
      </div>
      <div style="padding-top:18px"><h3>Risk Characteristics</h3>${table(riskRows)}</div>
      <div style="padding-top:18px"><h3>Return Characteristics</h3>${table(returnRows)}</div>
    </div>
  </div>
  <footer class="rs-foot">
    ${esc(s.basis.method)} The range is a modeled ${esc(s.range.confidence)} over ${s.range.horizon_months} months from ${esc(s.basis.covariance)} &mdash; not a guarantee and not a forecast of maximum loss. Risk-free ${plain(s.basis.risk_free_pct)}. ${esc(s.basis.drawdown_basis)} Values are supplied position values, not live prices.${s.warnings.length ? ` ${esc(s.warnings.join(" "))}` : ""}
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
