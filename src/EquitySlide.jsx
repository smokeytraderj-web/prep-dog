import React from "react";
export default function EquitySlide({ data, example = false }) {
  const diffs = data.sectors.map((s) => s.portfolio - s.benchmark),
    pos = Math.max(0, ...diffs),
    neg = Math.max(0, ...diffs.map((d) => -d)),
    scale = 138 / (pos + neg || 1),
    zero = 23 + pos * scale;
  return (
    <div className="equity-slide">
      <div className="equity-heading">
        <h2>Equity Sector Exposure</h2>
        <span>{data.as_of}</span>
      </div>
      {example && (
        <p className="example-banner">
          EXAMPLE ONLY · Supplied sample data, not your portfolio
        </p>
      )}
      <table className="sector-table">
        <thead>
          <tr>
            <th></th>
            <th colSpan="4">Cyclical</th>
            <th colSpan="4">Sensitive</th>
            <th colSpan="3">Defensive</th>
          </tr>
          <tr>
            <th></th>
            {data.sectors.map((s) => (
              <th key={s.name}>{s.name}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {["portfolio", "benchmark"].map((k) => (
            <tr key={k}>
              <td>{data[`${k}_label`]}</td>
              {data.sectors.map((s) => (
                <td key={s.name}>{s[k].toFixed(2)}%</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="chart-caption">
        Relative weight vs. {data.benchmark_short || data.benchmark_label}{" "}
        (percentage points)
      </p>
      <svg
        viewBox="0 0 880 218"
        role="img"
        aria-label="Sector over and underweight chart. Exact values appear above each bar."
      >
        <line
          x1="0"
          x2="880"
          y1={zero}
          y2={zero}
          stroke="#9fb3c7"
          strokeWidth="1"
        />
        {data.sectors.map((s, i) => {
          const d = diffs[i],
            h = Math.abs(d) * scale,
            x = i * 80 + 23;
          return (
            <g key={s.name}>
              <rect
                x={x}
                y={d >= 0 ? zero - h : zero}
                width="34"
                height={h}
                fill={d >= 0 ? "#1b2a4a" : "#759bbf"}
              />
              <text
                x={x + 17}
                y={d >= 0 ? zero - h - 6 : zero + h + 14}
                textAnchor="middle"
                fontSize="11"
                fill="#1b2a4a"
              >
                {d > 0 ? "+" : ""}
                {d.toFixed(2)}
              </text>
              <text
                x={x + 17}
                y="200"
                textAnchor="middle"
                fontSize="10"
                fill="#365873"
              >
                {s.name}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="equity-source">{data.source_note}</p>
    </div>
  );
}
