# Prep Dog

GSWM portfolio-deck workspace built with React, Vite, Tailwind CSS and Lucide. A dark navy application surrounds white, print-ready presentation slides.

## Run

```sh
npm ci
npm run dev
npm test
npm run build
```

The Vite dev server and Vercel deployment both expose `/api/benchmark/sp500`. The server only fetches public benchmark data; user holdings remain in browser memory. No accounts, database or API keys are required. `npm run build:site` packages the same app and benchmark endpoint for Sites.

## Holdings and deck flow

Paste two columns (ticker and total USD position value), or upload XLSX, CSV, TSV or TXT up to 5 MB. Excel uses the first sheet. Headers, markdown tables, comma-formatted values and duplicate tickers are supported. Correct invalid rows, confirm holdings, select components, preview, finish and print/save a PDF. Holdings details paginate at eight positions per slide. Allocation groups portfolios with more than six holdings into the five largest plus Other, with a matching legend.

No holdings are stored in localStorage or sent to the benchmark endpoint. Reloading clears the portfolio. Values are supplied position values, not fetched live prices.

## Daily S&P 500 exposure

The benchmark uses the public [iShares IVV daily holdings CSV](https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/latest-holdings.csv). IVV tracks the S&P 500 but is an ETF proxy, not a licensed official index constituent feed. Equity market values are aggregated into all 11 sectors and normalized to 100%; cash and derivatives are excluded. The API rejects incomplete files, missing sectors, invalid dates, duplicate symbols and unexpected constituent counts.

The app fetches on load, hourly while open, on returning to the tab, and via Refresh. Server/CDN caching lasts at most one hour per cache layer; browser caching is five minutes. This retrieves the provider's published daily snapshot. It is not intraday market-open/close exposure. The provider's effective date is displayed separately from retrieval time. Snapshots older than four calendar days are marked older and blocked for automatic slide generation. A refresh failure preserves an already loaded snapshot with an explicit warning, never a fake fresh timestamp.

Individual holdings are classified against the provider's current constituent sectors. IVV gets equity-only look-through. Other funds, non-constituent equities and cash require a verified imported sector file; incomplete coverage blocks comparison rather than silently renormalizing a partial portfolio. Import custom sector JSON using `src/equity-example.json` as the schema. Sample data is preview-only. Editing and confirming holdings clears previously imported sector data.

Verified against the actual provider file on 2026-09-29: 504 equity holdings, effective date 2026-09-28, all 11 sectors. No hardcoded market snapshot is shipped.

## Slide skill roadmap

The equity slide uses the supplied 11-sector layout, with actual portfolio-minus-benchmark differences. Navy is overweight; light blue is underweight.

The risk page is implemented as a Claude skill in `.claude/skills/risk-snapshot/`: holdings JSON in, a reviewable `snapshot.json` of measures, then a self-contained 16:9 print slide. Its measures (1-99 Risk Score, six-month 95% probability range, allocation, risk-adjusted grade, drawdown, cost bar) are in-house and documented in that skill's `reference/methodology.md`; they are not Riskalyze/Nitrogen figures and must never be labeled as such. `npm test` covers it. Draft app-module specifications are in `docs/slide-skills/attribution-report.md` and `docs/slide-skills/riskalyze.md`. Each defines one core slide, up to two optional slides, required report data and validation rules. They are not yet executable or selectable components. An anonymized report for each is the next input needed to finalize the layouts and extraction contracts.

## Deployment

Vercel uses the repository's `vercel.json` and `api/benchmark/sp500.js`. GitHub pushes trigger deployment when its existing Vercel integration is connected. Sites uses its own source repository and the Worker build; changes must be published to each destination. A successful GitHub push alone does not update Sites.

Checks: parser and benchmark tests, actual provider/API fetch, browser paste/upload → selection → sector comparison → PDF flow, mobile layout and provider-failure state. Export is browser print/PDF; PPTX and remote skill execution are not implemented.
