# Prep Dog

A focused, frontend-only portfolio deck workspace for Gottfried & Somberg Wealth Management. React, Vite, Tailwind CSS, and Lucide icons. Navy, white, and blues; no gold chart bars.

## Run

```sh
npm ci
npm run dev
```

`npm run build` produces `dist/`. `npm test` checks import validation. Import this GitHub repository into Vercel using the included Vite configuration. No environment variables, account, database, or backend are required.

## Flow

1. Paste holdings or upload `.xlsx`, `.csv`, `.tsv`, or `.txt` from your computer. Excel uses the first sheet. Input is two columns: ticker and **total position value in USD**, not share price. Headers are optional. Markdown tables and comma-formatted values are supported. Duplicate tickers are combined. Unreadable rows block continuation for correction.
2. Confirm parsed holdings and totals, then select deck components.
3. Preview all slides, finish the deck, and print/save a PDF. Holdings detail paginates at eight positions per slide.

Everything stays in browser memory and disappears when the page reloads. No holdings are uploaded to a server or stored in localStorage. The example portfolio is clearly user-triggered.

## Equity exposure component

The supplied `equity-sector-exposure` skill informs the frontend data contract and layout. It has an 11-sector table grouped into Cyclical, Sensitive, and Defensive, with portfolio minus benchmark bars. Navy is overweight; blue is underweight. It does not execute the Python skill or infer sector data from tickers.

Select Equity sector exposure and import sector JSON matching `src/equity-example.json`. The data must include all 11 unique sectors, percentage weights, portfolio/benchmark labels, as-of date, and source note. Both sets of sector weights must total approximately 100%. The supplied sample is available in a separate, clearly marked example dialog and is never automatically added to a client deck. Imported JSON must correspond to the portfolio being reviewed.

## Planned skill integration

Keep slide definitions in a component registry and add a backend adapter for each future skill. The frontend should submit confirmed holdings, selected component IDs, and options, then receive validated slide data/artifacts. Do not execute arbitrary uploaded skill code in the browser. Wait for every selected component to complete before making the final deck available.

### Daily S&P 500 benchmark requirement

This frontend has **no live benchmark feed or scheduled refresh**. Future backend work must:

- Obtain licensed/authorized S&P 500 constituents, constituent weights, and sector classifications from a selected provider.
- Refresh at least once per US trading day; target two snapshots around the market open and after the close, subject to provider availability.
- Use America/New_York and a US exchange calendar, including holidays, daylight saving time, and early closes. Do not assume every weekday has a 16:00 close.
- Store both provider effective time and retrieval time, validate completeness, and atomically publish a full snapshot.
- Display source, effective date/time, and freshness in the component and exported slide. Never label an old snapshot as current after a failed refresh.
- Calculate portfolio sector exposure with verified classifications and fund look-through where needed. Flag missing coverage rather than silently assigning sectors.

## Scope

Implemented: browser import, selection, data-driven preview, sample skill preview, sector JSON adapter, browser print/PDF layout. Not implemented: live prices/benchmarks, automated research, remote skill execution, PPTX export, server accounts, or hosting deployment.
