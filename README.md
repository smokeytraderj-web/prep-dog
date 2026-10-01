# Prep Dog

GSWM portfolio-deck workspace built with React, Vite, Tailwind CSS and Lucide. A dark navy application surrounds white, print-ready presentation slides.

## Run

```sh
npm ci
npm run dev
npm test
npm run build
```

The Vite dev server and Sites Worker expose `/api/benchmark/sp500`, `/api/market/ytd` and `/api/history`. The server only fetches public benchmark data; user holdings remain in browser memory. No accounts, database or API keys are required. `npm run build:site` packages the app and benchmark endpoint for Sites.

## Holdings and deck flow

Paste two columns (ticker and total USD position value), or upload XLSX, CSV, TSV or TXT up to 5 MB. Excel uses the first sheet. Headers, markdown tables, comma-formatted values and duplicate tickers are supported. Correct invalid rows, confirm holdings, select components, preview, finish and print/save a PDF. Holdings details paginate at eight positions per slide. Allocation groups portfolios with more than six holdings into the five largest plus Other, with a matching legend.

No holdings are stored in localStorage or sent to the benchmark endpoint. Reloading clears the portfolio. Values are supplied position values, not fetched live prices.

## Daily S&P 500 exposure

The benchmark uses the public [iShares IVV daily holdings CSV](https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf/latest-holdings.csv). IVV tracks the S&P 500 but is an ETF proxy, not a licensed official index constituent feed. Equity market values are aggregated into all 11 sectors and normalized to 100%; cash and derivatives are excluded. The API rejects incomplete files, missing sectors, invalid dates, duplicate symbols and unexpected constituent counts.

The app fetches on load, hourly while open, on returning to the tab, and via Refresh. Server/CDN caching lasts at most one hour per cache layer; browser caching is five minutes. This retrieves the provider's published daily snapshot. It is not intraday market-open/close exposure. The provider's effective date is displayed separately from retrieval time. Snapshots older than four calendar days are marked older and blocked for automatic slide generation. A refresh failure preserves an already loaded snapshot with an explicit warning, never a fake fresh timestamp.

Individual holdings are classified against the provider's current constituent sectors. IVV gets equity-only look-through. Other funds, non-constituent equities and cash require a verified imported sector file; incomplete coverage blocks comparison rather than silently renormalizing a partial portfolio. Import custom sector JSON using `src/equity-example.json` as the schema. Sample data is preview-only. Editing and confirming holdings clears previously imported sector data.

Verified against the actual provider file on 2026-09-29: 504 equity holdings, effective date 2026-09-28, all 11 sectors. No hardcoded market snapshot is shipped.

## Automatic YTD market snapshot

The first market slide loads year-to-date returns automatically from Yahoo Finance historical chart data when the workspace opens, with a manual refresh control. It uses direct index symbols for the S&P 500 (`^GSPC`) and Nasdaq Composite (`^IXIC`), and clearly labeled ETF proxies for MSCI Emerging Markets (`EEM`) and MSCI EAFE (`EFA`). The endpoint calculates adjusted-close returns from the last available close of the prior year through the latest available session, displays the provider date, and caches the response for one hour. If the provider is unavailable, the deck keeps the last loaded snapshot or asks for a sourced upload rather than inventing a value.

## Slide skill roadmap

The equity slide uses the supplied 11-sector layout, with actual portfolio-minus-benchmark differences. Navy is overweight; light blue is underweight.

Draft app-module specifications are in `docs/slide-skills/attribution-report.md` and `docs/slide-skills/riskalyze.md`. Each defines one core slide, up to two optional slides, required report data and validation rules. They are not yet executable or selectable components. An anonymized report for each is the next input needed to finalize the layouts and extraction contracts. The Riskalyze draft covers importing a vendor report; it is not the Risk snapshot component, which needs no import.

## Deployment

Sites is the primary host and publishes the Worker build, including the benchmark endpoint. The repository keeps a `vercel.json` compatibility file with Git deployments disabled, so GitHub pushes do not create a competing Vercel deployment. A GitHub push alone does not publish Sites; publish the updated source through Sites after changes.

Checks: parser and benchmark tests, actual provider/API fetch, browser paste/upload → selection → sector comparison → PDF flow, mobile layout and provider-failure state. Export is browser print/PDF; PPTX and remote skill execution are not implemented.

## Personalized report behavior

The report flow is driven by the uploaded file. Workbook imports inspect all worksheets, locate a holdings header below preamble rows, detect ticker/symbol, market value, quantity, price, currency, account, asset class and security name columns, and show a review table before accepting the data. Market value is preferred; quantity × price is available when a market value column is absent. A price-only export is blocked because a share price is not a position value. Non-USD rows, invalid tickers, totals, negative values and ambiguous rows are surfaced for correction.

The upload review preserves per-row account and asset-class detail. This powers the personalized asset allocation and account summary slides, and asset classes supplied there take priority in the risk snapshot. Historical performance, vendor risk scores, earnings expectations and attribution are never invented from a current holdings snapshot. They require a sourced supporting report JSON using `public/report-data-template.json`. The deck builder only enables those components after validation of dates, units, source, periods and reported values.

The Max Bender reference informs the report structure: a client cover, portfolio overview, asset allocation, account summary, market context, risk metrics and performance contribution. The supplied Bloom pages 5 and 8 informed the sector-performance and earnings layouts. Their fixed example values are not shipped as production data.

Sites is the primary publication. Vercel Git deployments are disabled in `vercel.json` so a GitHub push does not create a competing Vercel deployment. GitHub remains the source of truth and every Sites publication is built from the pushed commit.

## Image source slides

Drop PNG, JPG, or WEBP snippets into Source data (up to 8 MB per image). Each image creates its own slide with an editable title and optional takeaway. Images remain in browser memory and are included in print/PDF output; this does not extract or invent data from the images. The logo returns to the holdings screen without clearing the current work. The YTD slide includes a daily return graph when history is available, or a comparison bar chart for manually supplied returns.

## Example data

`Load example` fills the paste box with a balanced book — US and international
equity, investment-grade and municipal bonds, Treasuries, cash and real assets —
so the allocation and risk slides have all four asset classes to show. Pasting
only carries ticker and value, so the classification comes from the fund table
and the benchmark constituents.

Two files in `public/` exercise the parts that need more than ticker and value:

| File | What it unlocks |
| --- | --- |
| `example-holdings.csv` | 15 positions across 4 accounts with Account, Asset Class and Region columns. Populates the account summary's equities-vs-fixed-income split and the regional attribution slide, which are both blocked without them. |
| `example-sectors.json` | A hand-prepared sector file, kept as a worked example of the import format. The equity slide no longer needs it: look-through is fetched from the fund provider. |

The **Example file** link beside the upload button downloads the holdings CSV;
import the sector JSON from the Equity benchmark panel. Benchmark weights in the
sector file come from the IVV daily holdings file; the fund sleeves use published
sector mixes. Both files are illustrative, not a client portfolio.

## Fund sector look-through

The equity slide needs a sector for every position. Individual equities come
from the IVV constituent file. For funds, the app reads the provider's own daily
holdings file rather than asking the advisor to import one:

- `/api/fund-sectors` resolves a ticker through the iShares product list (526
  products, cached for a day) and aggregates that fund's equity holdings into
  the eleven sector weights.
- The provider's own asset classification settles the rest. A Fixed Income,
  Commodity or Money Market fund has no equity sleeve, so its file is never
  fetched -- a bullion trust does not publish one. Those positions leave the
  equity sleeve instead of blocking the slide, and the slide says what share of
  the portfolio it covers.
- A fund outside that list still blocks the slide. The app does not guess
  look-through it cannot source.

Caches hold the in-flight promise rather than the settled value, because a deck
asks for every ticker at once and duplicate requests get rate-limited. A
transient failure is returned `no-store`, so a brief provider outage does not
leave a fund looking unknown for the rest of the cache window.

## Slide sizing

The deck prints at 13.333in x 7.5in (1280x720 at 96dpi). The preview renders each
slide at exactly that pixel size and scales it to the stage with a CSS transform,
so what you review is a true miniature of the printed page. A slide that fits in
the preview fits in the PDF, at any window width — the two cannot disagree. Below
the 760px breakpoint the slides reflow for reading instead of scaling.

## Slide theme

The deck preview carries a **Light / Navy** toggle that themes the slides only; the
surrounding app keeps its own palette. The choice persists per browser and is what
prints, so a navy deck saves as a navy PDF.

Every colour in the slide stylesheets is written as `var(--c-<hex>, #<hex>)`. With no
token defined the light deck renders exactly as it always did; `src/slide-theme.css`
defines those tokens on a dark slide and repaints the subtree. On top of the palette
swap the navy deck gets its own accent ramp and chart series, heavier rules, bordered
panels and a light chip behind the brand seal, so it reads as a deliberate dark deck
rather than an inverted light one. Both themes pass WCAG AA contrast for slide text.

## Risk snapshot skill

The supplied skill is versioned in `docs/slide-skills/risk-snapshot/`, including its methodology, renderer, example inputs, calibration helper and tests. Select **Risk snapshot** and the slide builds itself from the confirmed holdings — there is nothing to download, fill in or upload. The app uses the same pure model as the CLI.

Inputs are derived the way the equity slide derives sector exposure:

- **Asset class** comes from the fund table in `src/asset-class.js` (equity, bond, cash and commodity/REIT funds), the IVV constituent file for individual equities, and an asset class supplied in an imported holdings file wins over both. An unmatched ticker is grouped as `other` and named in a slide warning rather than guessed.
- **Return, volatility, covariance and drawdown** come from 60 months of aligned adjusted closes fetched per holding from `/api/history`, so the model takes its blended-portfolio path rather than the class-correlation fallback.
- **Dividend yield** is each holding's trailing twelve-month distributions over its latest unadjusted close, from the same request. A holding that paid nothing in the window is a measured zero.
- **The risk-free rate** is the 13-week Treasury bill (`^IRX`), which is what lets the slide show a risk-adjusted grade.
- **Expense ratio** comes from the published-rate table in `src/fund-costs.js`. An individual equity identified from the constituent file carries none, which is a fact rather than an assumption. A fund with no rate on file omits the measure for the whole portfolio and names itself in a warning.
- **Tax drag and the advisory fee** stay omitted. Neither is derivable from market data — tax drag needs a tax rate and the fee is a firm input — so they are absent rather than guessed at zero.

A holding with no usable history blocks the slide with a named error instead of being dropped from the portfolio.

`src/fund-costs.js` is a maintained list, not live data. Check a rate before it goes on a client deck if the fund has recently repriced.

Integration corrections: the original 1.645 normal quantile defines a 5th–95th percentile interval with **90% central coverage**; its formula and score anchors are preserved with corrected labels. Unknown costs, yield, risk-free rates, and drawdown are omitted instead of silently defaulted or estimated. History requires shared ordered dates. The model is explicitly in-house and is never branded as a Riskalyze Risk Number or GPA.

From the skill directory: `node scripts/snapshot.mjs assets/sample-input.json snapshot.json`, then `node scripts/render.mjs snapshot.json slide.html`. The sample is for testing only and never prepopulates a client deck. `npm test` includes the skill and portfolio-integration tests.

## Market feed recovery

Market requests retry once and distinguish provider failures, timeouts, and sign-in HTML responses. The benchmark loader can show the verified, dated public snapshot in `public/benchmark-snapshot.json` if live retrieval fails; it is labeled as saved data and remains subject to the four-day stale-data gate. Successful provider responses replace it. This snapshot is public market data, not user holdings. Yahoo chart requests validate the payload and try the second Yahoo endpoint when the first fails. Starting another report preserves market data while refreshing it. Page 2 data controls live in compact, collapsed sections.
