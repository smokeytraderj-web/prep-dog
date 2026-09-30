import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowLeft,
  Upload,
  Check,
  Layers,
  PieChart,
  List,
  ChartNoAxesColumnIncreasing,
  MessageSquare,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  X,
  FileText,
} from "lucide-react";
import { parseHoldings, totalValue } from "./holdings";
import "./styles.css";
import "./workspace.css";
import "./report.css";
import "./slide-updates.css";
import EquitySlide from "./EquitySlide";
import { RiskSnapshotInput, RiskSnapshotSlide } from "./RiskSnapshot";
import "./risk-snapshot.css";
import "./data-drawers.css";
import { SourceSnippets, SourceSnippetSlide } from "./SourceSnippets";
import equityExample from "./equity-example.json";
import { validateEquity } from "./equity";
import { comparePortfolio, isBenchmarkStale } from "./benchmark";
import BenchmarkPanel, { useBenchmark } from "./BenchmarkPanel";
import HoldingsImport from "./HoldingsImport";
import { textToSheets } from "./holding-import";
import { fetchMarketJson } from "./market-fetch";
import { PortfolioOverview, PortfolioAllocation, ConcentrationSlide } from "./PortfolioSlides";
import { MarketIndexesSlide, MarketIndexesEditor, SectorPerformanceEditor, EarningsEditor, SectorPerformanceSlide, EarningsSlide } from "./MarketContext";
import { AccountSummarySlide, RegionalAttributionSlide, RiskSlide, AttributionSlide } from "./SupportingSlides";
import { validateSupporting, groupPositions } from "./supporting-data";
import { emptyMarketIndexes, emptySectorPerformance, emptyEarnings, validMarketIndexes, validSectorPerformance, validEarnings } from "./market-context";
const money = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
const sample =
  "AAPL 33032\nMSFT 49808\nNVDA 21208\nAVGO 34020\nJPM 34706\nLLY 23750";
const sections = [
  {
    id: "account-summary",
    name: "Account summary",
    description: "Major breakdown, account values, and equities versus fixed income.",
    icon: Layers,
    auto: true,
  },
  {
    id: "market-indexes",
    name: "YTD market snapshot",
    description: "S&P 500, Nasdaq, emerging markets, and MSCI returns.",
    icon: ChartNoAxesColumnIncreasing,
    auto: true,
  },
  {
    id: "regional-attribution",
    name: "Regional attribution",
    description: "Client regional weights compared with the same market regions.",
    icon: ChartNoAxesColumnIncreasing,
    auto: true,
  },
  {
    id: "equity",
    name: "Equity exposure",
    description: "Sector weights versus the current S&P 500 proxy.",
    icon: ChartNoAxesColumnIncreasing,
  },
  { id: "risk", name: "Risk snapshot", description: "Build the in-house model or import a sourced Riskalyze report.", icon: ShieldCheck },
];
function App() {
  const [step, setStep] = useState(0),
    [text, setText] = useState(""),
    [holdings, setHoldings] = useState([]),
    [errors, setErrors] = useState([]),
    [reviewed, setReviewed] = useState(false),
    [selected, setSelected] = useState(["account-summary", "market-indexes", "regional-attribution"]),
    [title, setTitle] = useState("Portfolio review"),
    [notes, setNotes] = useState(""),
    [page, setPage] = useState(0),
    [done, setDone] = useState(false),
    [drag, setDrag] = useState(false);
  const [importedEquity, setEquity] = useState(null),
    [equityError, setEquityError] = useState(""),
    [showExample, setShowExample] = useState(false);
  const [deckEquity, setDeckEquity] = useState(null);
  const [riskSnapshot, setRiskSnapshot] = useState(null);
  const [snippetImages, setSnippetImages] = useState([]);
  const [importBook, setImportBook] = useState(null), [importBusy, setImportBusy] = useState(false), [importSource, setImportSource] = useState("");
  const [marketIndexes, setMarketIndexes] = useState(emptyMarketIndexes), [sectorPerformance, setSectorPerformance] = useState(emptySectorPerformance), [earnings, setEarnings] = useState(emptyEarnings);
  const [marketLoading, setMarketLoading] = useState(false), [marketError, setMarketError] = useState("");
  const [deckMarket, setDeckMarket] = useState({});
  const [positions, setPositions] = useState([]), [supporting, setSupporting] = useState({}), [supportError, setSupportError] = useState("");
  const [preparedFor, setPreparedFor] = useState(""), [advisor, setAdvisor] = useState(""), [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-CA'));
  const supportFile = useRef(null);
  const assetReady = positions.length > 0 && positions.every(p => p.assetClass);
  const accountsReady = positions.length > 0 && positions.every(p => p.account);
  const benchmark = useBenchmark();
  async function refreshMarketIndexes() {
    setMarketLoading(true); setMarketError("");
    try {
      const data = await fetchMarketJson('/api/market/ytd');
      if (!validMarketIndexes(data)) throw Error('The market service returned incomplete index data. Please retry.');
      setMarketIndexes(data);
      setMarketError(data.warning || '');
    } catch (error) { setMarketError(error.message || 'YTD market data is unavailable.'); }
    finally { setMarketLoading(false); }
  }
  useEffect(() => { refreshMarketIndexes(); }, []);
  const comparison = benchmark.snapshot && holdings.length ? comparePortfolio(holdings, benchmark.snapshot) : null;
  const equity = importedEquity || (benchmark.snapshot && !isBenchmarkStale(benchmark.snapshot) ? comparison?.data : null);
  const equityFile = useRef(null);
  const file = useRef(null);
  const total = totalValue(holdings);
  const ranked = [...holdings].sort((a, b) => b.value - a.value);
  const noteLines = notes
    .split("\n")
    .filter(Boolean)
    .flatMap((line) => line.match(/.{1,140}(?:\s|$)|.{1,140}/g) || []);
  const slides = [
    { id: "cover", name: "Portfolio review" },
    ...sections
      .filter((s) => selected.includes(s.id))
      .flatMap((s) =>
        s.id === "risk" && riskSnapshot ? [{...s, name:"Risk snapshot"}] : s.id === "risk" && supporting.risk ? Array.from({length: Math.ceil(supporting.risk.accounts.length / 2)}, (_, i) => ({...s, offset: i * 2, name: `Risk metrics${supporting.risk.accounts.length > 2 ? ` · ${i + 1}` : ""}`}))
        : s.id === "attribution" && supporting.attribution ? supporting.attribution.accounts.map((a, i) => ({...s, accountIndex: i, name: `Contribution · ${a.name}`}))
        : [s],
      ),
  ];
  slides.push(...snippetImages.map(image => ({id:`snippet-${image.id}`, name:image.title || 'Source image', snippet:image})));
  const navigate = (n) => {
    setStep(n);
    setDone(false);
    setPage(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const parse = () => {
    const r = parseHoldings(text);
    setErrors(
      r.errors.length
        ? r.errors
        : r.holdings.length
          ? []
          : ["Add at least one holding to continue."],
    );
    if (r.holdings.length && !r.errors.length) {
      setImportSource("");
      setRiskSnapshot(null); setPositions(r.holdings); setSupporting({}); setSupportError("");
      setHoldings(r.holdings);
      setEquity(null);
      setEquityError("");
      setReviewed(true);
    }
  };
  async function upload(f) {
    if (!f) return;
    if (!/\.(xlsx|csv|txt|tsv)$/i.test(f.name)) {
      setErrors([
        "Upload an Excel (.xlsx), CSV, TSV, or text file. For older .xls files, save as .xlsx or paste the cells.",
      ]);
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErrors(["Choose a file smaller than 5 MB."]);
      return;
    }
    setImportBusy(true);
    try {
      let sheets;
      if (/\.xlsx$/i.test(f.name)) {
        const { default: readWorkbook } = await import("read-excel-file/browser");
        sheets = await readWorkbook(f);
      } else sheets = textToSheets(await f.text(), "Holdings");
      if (!sheets.length || sheets.every(s => !s.data.length)) throw Error("Empty workbook");
      setImportBook({name: f.name, sheets});
      setErrors([]);
    } catch {
      setErrors([
        "This file could not be read. Use an unprotected .xlsx, CSV, TSV or text file with ticker-level holdings.",
      ]);
    } finally { setImportBusy(false); }
  }

  function reset() {
    setRiskSnapshot(null);
    setSnippetImages([]);
    setText("");
    setImportBook(null); setImportSource(""); setPositions([]); setSupporting({}); setSupportError(""); setPreparedFor(""); setAdvisor("");
    refreshMarketIndexes(); setSectorPerformance(emptySectorPerformance()); setEarnings(emptyEarnings());
    setHoldings([]);
    setReviewed(false);
    setSelected(["account-summary", "market-indexes", "regional-attribution"]);
    setTitle("Portfolio review");
    setNotes("");
    setErrors([]);
    setEquity(null);
    setEquityError("");
    navigate(0);
  }
  async function uploadEquity(f) {
    if (!f) return;
    try {
      if (f.size > 1024 * 1024)
        throw Error("Choose a JSON file smaller than 1 MB.");
      setEquity(validateEquity(JSON.parse(await f.text())));
      setEquityError("");
    } catch (e) {
      setEquity(null);
      setEquityError(e.message);
    }
  }
  async function uploadSupporting(f) {
    if (!f) return;
    try {
      if (f.size > 2 * 1024 * 1024) throw Error("Choose a report data file smaller than 2 MB.");
      const data = validateSupporting(JSON.parse(await f.text()));
      setSupporting(v => ({...v, ...data}));
      if (data.risk) setRiskSnapshot(null);
      if (data.marketIndexes) setMarketIndexes(data.marketIndexes);
      if (data.sectorPerformance) setSectorPerformance(data.sectorPerformance);
      if (data.earnings) setEarnings(data.earnings);
      setSupportError("");
    } catch (e) { setSupportError(e.message || "This report data file could not be read."); }
  }
  function slideContent(slide) {
    if (slide.snippet) return <SourceSnippetSlide data={slide.snippet}/>;
    if (slide.id === "equity") return <EquitySlide data={deckEquity} />;
    if (slide.id === "cover")
      return (
        <div className="cover-content">
          <p className="eyebrow">PORTFOLIO REVIEW</p>
          <h2>{title || "Portfolio review"}</h2>{preparedFor && <p className="cover-client">Prepared for {preparedFor}</p>}
          <div className="gold-rule" />
          <p className="cover-sub">
            {advisor ? `Presented by ${advisor}` : "Gottfried & Somberg Wealth Management"}
          </p>
          <span className="cover-date">
            {reportDate ? new Date(`${reportDate}T12:00:00`).toLocaleDateString("en-US", {month: "long", day: "numeric", year: "numeric"}) : ""}
          </span>
        </div>
      );
    if (slide.id === "account-summary") return <AccountSummarySlide positions={positions} source={importSource}/>;
    if (slide.id === "market-indexes") return <MarketIndexesSlide data={deckMarket.marketIndexes}/>;
    if (slide.id === "regional-attribution") return <RegionalAttributionSlide positions={positions} data={deckMarket.marketIndexes}/>;
    if (slide.id === "risk" && deckMarket.riskSnapshot) return <RiskSnapshotSlide data={deckMarket.riskSnapshot}/>;
    if (slide.id === "risk") return <RiskSlide data={deckMarket.supporting.risk} offset={slide.offset}/>;
    if (slide.id === "attribution") return <AttributionSlide data={deckMarket.supporting.attribution} accountIndex={slide.accountIndex}/>;
    if (slide.id === "overview") return <PortfolioOverview holdings={holdings} equity={deckEquity}/>;
    if (slide.id === "allocation") return <PortfolioAllocation holdings={holdings} equity={deckEquity}/>;
    if (slide.id === "sector-performance") return <SectorPerformanceSlide data={deckMarket.sectorPerformance}/>;
    if (slide.id === "earnings") return <EarningsSlide data={deckMarket.earnings}/>;
    if (slide.id === "holdings")
      return (
        <>
          <h2>Holdings detail</h2>
          <table>
            <thead>
              <tr>
                <th>POSITION</th>
                <th>VALUE</th>
                <th>WEIGHT</th>
              </tr>
            </thead>
            <tbody>
              {holdings.slice(slide.offset, slide.offset + 8).map((h) => (
                <tr key={h.ticker}>
                  <td>{h.ticker}</td>
                  <td>{money(h.value)}</td>
                  <td>{((h.value / total) * 100).toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );
    if (slide.id === "concentration") return <ConcentrationSlide holdings={holdings}/>;
    return (
      <>
        <h2>For our conversation.</h2>
        <div className="discussion">
          {noteLines.slice(slide.offset, slide.offset + 4).map((n, i) => (
            <p key={i}>
              <span>{String(slide.offset + i + 1).padStart(2, "0")}</span>
              {n}
            </p>
          ))}
        </div>
      </>
    );
  }
  function renderSlide({ slide, index, print = false }) {
    return (
      <article
        className={`slide slide-${slide.id} ${slide.id === "cover" ? "cover" : ""} ${print ? "print-slide" : ""}`}
      >
        <div className="slide-brand">
          <img src="/gswm-logo.png" alt=""/><div>GOTTFRIED & SOMBERG <span>WEALTH MANAGEMENT</span></div>
        </div>
        <div className="slide-body">{slideContent(slide)}</div>
        <footer>
          <span>
            {slide.snippet ? "Source: uploaded image" : slide.id === "cover"
              ? "PORTFOLIO REVIEW"
              : ["market-indexes", "regional-attribution", "risk", "attribution", "account-summary"].includes(slide.id) ? "Source and reporting basis shown above"
              : slide.id === "equity"
                ? "Benchmark methodology and source shown above"
                : "Source: supplied portfolio position values"}
          </span>
          <span>{String(index + 1).padStart(2, "0")}</span>
        </footer>
      </article>
    );
  }
  return (
    <>
      <div className="app-shell print:hidden">
        <header className="app-header">
          <button type="button" className="brand brand-home" aria-label="Go to home" onClick={() => navigate(0)}>
            <img className="brand-logo" src="/gswm-logo.png" alt="Gottfried & Somberg Wealth Management logo"/>
            <div className="brand-name">
              GOTTFRIED & SOMBERG<small>WEALTH MANAGEMENT</small>
            </div>
          </button>
          <div className="product-name">
            Prep Dog <span className="product-divider">/</span><small>Portfolio studio</small>
          </div>
        </header>
        <nav className="step-nav" aria-label="Deck progress">
          {["Add holdings", "Choose components", "Review deck"].map(
            (label, i) => (
              <React.Fragment key={label}>
                {i > 0 && <span className="step-line" />}
                <button
                  aria-current={step === i ? "step" : undefined}
                  disabled={i > step}
                  onClick={() => navigate(i)}
                  className={`step ${step === i ? "active" : ""} ${step > i ? "complete" : ""}`}
                >
                  <span>
                    {step > i ? (
                      <Check size={13} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  {label}
                </button>
              </React.Fragment>
            ),
          )}
        </nav>
        <main className={step === 0 ? "input-main" : "workspace-main"}>
          {step === 0 && (
            <>
              {importBook ? <HoldingsImport book={importBook} onCancel={() => setImportBook(null)} onConfirm={(values, source, importedPositions) => {setRiskSnapshot(null);setHoldings(values);setPositions(importedPositions);setSupporting({});setSupportError("");setText(values.map(h => `${h.ticker} ${h.value}`).join("\n"));setImportSource(source);setImportBook(null);setReviewed(true);setSelected(["account-summary","market-indexes","regional-attribution"]);setEquity(null);setEquityError("");setErrors([]);}}/> : !reviewed ? (
                <section
                  aria-label="Add portfolio holdings"
                  className={`input-card ${drag ? "dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDrag(true);
                  }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDrag(false);
                    upload(e.dataTransfer.files[0]);
                  }}
                >
                  <div className="input-top">
                    <label htmlFor="holdings">Holdings</label>
                    <button
                      className="text-button"
                      onClick={() => {
                        setText(sample);
                        setErrors([]);
                      }}
                    >
                      Load example
                    </button>
                  </div>
                  <textarea
                    id="holdings"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setErrors([]);
                    }}
                    aria-describedby="holdings-format"
                    spellCheck="false"
                  />
                  <div className="input-actions">
                    <button
                      className="upload-button"
                      disabled={importBusy}
                      onClick={() => file.current.click()}
                    >
                      <Plus size={17} /> {importBusy ? "Reading file…" : "Upload file"}
                    </button>
                    <span className="file-types">XLSX, CSV, TXT</span>
                    <button
                      className="primary ml-auto"
                      onClick={parse}
                      disabled={!text.trim()}
                    >
                      Review holdings
                    </button>
                  </div>
                  <input
                    ref={file}
                    type="file"
                    accept=".xlsx,.csv,.tsv,.txt"
                    className="hidden"
                    onChange={(e) => {
                      upload(e.target.files[0]);
                      e.target.value = "";
                    }}
                  />
                </section>
              ) : (
                <section className="review-card">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <p className="eyebrow">{importSource ? "IMPORTED HOLDINGS" : "READY TO REVIEW"}</p>
                      <h2>{holdings.length} holdings</h2>{importSource && <p className="import-origin">{importSource}</p>}
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setReviewed(false)}
                    >
                      Edit input
                    </button>
                  </div>
                  <div className="holdings-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>TICKER</th>
                          <th>POSITION VALUE</th>
                          <th>WEIGHT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdings.map((h) => (
                          <tr key={h.ticker}>
                            <td>{h.ticker}</td>
                            <td>{money(h.value)}</td>
                            <td>{((h.value / total) * 100).toFixed(2)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="review-total">
                    <span>Total portfolio value</span>
                    <b>{money(total)}</b>
                  </div>
                  <div className="flex justify-end mt-6">
                    <button className="primary" onClick={() => navigate(1)}>
                      Choose components
                    </button>
                  </div>
                </section>
              )}
              {errors.length > 0 && (
                <div role="alert" className="errors">
                  {errors.map((e) => (
                    <p key={e}>{e}</p>
                  ))}
                </div>
              )}
              <div className="input-meta"><p id="holdings-format">Paste tickers and position values in USD, or drop a file.</p><p><ShieldCheck size={14} /> Holdings stay in your browser.</p></div>
              <BenchmarkPanel benchmark={benchmark}/>
            </>
          )}
          {step === 1 && (
            <>
              <div className="workspace-heading">
                <div>
                  <h1>Choose components</h1>
                  <p>Select the components you want in your deck.</p>
                </div>
                <span className="portfolio-pill">
                  {holdings.length} positions <span>·</span> {money(total)}
                </span>
              </div>
              <div className="builder-layout">
                <section>
                  <div className="auto-flow-note"><span className="slide-kicker">AUTOMATIC CORE DECK</span><p>These first three slides are always included and are built from the confirmed holdings and sourced market context.</p></div>
                  <div className="component-grid auto-components">
                    {sections.filter(s=>s.auto).map((s) => <div key={s.id} className="component-card auto-card selected"><div className="flex justify-between items-start"><s.icon size={23} strokeWidth={1.4} /><span className="auto-badge">AUTO</span></div><h2>{s.name}</h2><p>{s.description}</p></div>)}
                  </div>
                  <div className="optional-heading"><span className="slide-kicker">OPTIONAL ADD-ONS</span><p>Add only the specialist slides you want reviewed.</p></div>
                  <div className="component-grid optional-components">
                    {sections.filter(s=>!s.auto).map((s) => <button key={s.id} aria-pressed={selected.includes(s.id)} className={`component-card ${selected.includes(s.id) ? "selected" : ""}`} onClick={() => setSelected(v => v.includes(s.id) ? v.filter(x=>x!==s.id) : [...v,s.id])}><div className="flex justify-between items-start"><s.icon size={23} strokeWidth={1.4} /><span className="checkbox">{selected.includes(s.id) && <Check size={13} />}</span></div><h2>{s.name}</h2><p>{s.description}</p></button>)}
                  </div>
                  {selected.includes("equity") && (
                    <details className="data-drawer"><summary><span>Equity benchmark</span><small>{equity ? "Ready" : "Review needed"}</small><ChevronRight size={16}/></summary><div className="equity-input">
                      <div>
                        <h3>Portfolio vs. S&P 500</h3>
                        <p>{benchmark.loading && !benchmark.snapshot ? "Loading daily benchmark…" : benchmark.snapshot ? `IVV equity proxy · As of ${benchmark.snapshot.asOf}` : "Benchmark unavailable. Retry or import sector data."}</p>
                        {comparison && !importedEquity && <p className="coverage-note">{comparison.coverage.toFixed(1)}% of portfolio classified</p>}
                        {comparison?.unmatched.length > 0 && !importedEquity && <p className="errors" role="alert">Sector data needed for {comparison.unmatched.map(h => h.ticker).join(", ")}. Import verified sector data to include this slide. We do not guess ETF look-through or unknown sectors.</p>}
                        {benchmark.snapshot && isBenchmarkStale(benchmark.snapshot) && !importedEquity && <p className="errors">This benchmark is older than four days. Refresh or import a current sector file before building this slide.</p>}
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <button className="secondary" disabled={benchmark.loading} onClick={benchmark.refresh}>Refresh benchmark</button>
                        <button className="secondary" onClick={() => equityFile.current.click()}><Upload size={14} /> Import sector data</button>
                        <button className="text-button" onClick={() => setShowExample(true)}>Layout example</button>
                        {importedEquity && <button className="text-button" onClick={() => setEquity(null)}>Use daily benchmark</button>}
                      </div>
                      <input
                        className="hidden"
                        ref={equityFile}
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          uploadEquity(e.target.files[0]);
                          e.target.value = "";
                        }}
                      />
                      {equity && <p className="live-status"><Check size={15}/> {importedEquity ? "Imported sector data" : "Portfolio comparison ready"} · {equity.as_of}</p>}
                      {benchmark.error && !importedEquity && <p className="errors" role="alert">{benchmark.error}</p>}
                      {equityError && (
                        <p className="errors" role="alert">
                          {equityError}
                        </p>
                      )}
                    </div></details>
                  )}
                  {selected.includes("risk") && <details className="data-drawer"><summary><span>Risk inputs</span><small>{riskSnapshot || supporting.risk ? "Ready" : "Inputs needed"}</small><ChevronRight size={16}/></summary><RiskSnapshotInput holdings={holdings} positions={positions} asOf={reportDate} client={preparedFor} data={riskSnapshot} onChange={setRiskSnapshot}/></details>}
                  <details className="data-drawer"><summary><span>Market data</span><small>{marketLoading ? "Refreshing…" : marketIndexes.asOf ? `Through ${marketIndexes.asOf}` : "Not loaded"}{marketError ? " · Refresh issue" : ""}</small><ChevronRight size={16}/></summary><MarketIndexesEditor data={marketIndexes} onChange={setMarketIndexes} onRefresh={refreshMarketIndexes} loading={marketLoading} error={marketError}/></details>
                  {(selected.includes("risk") || selected.includes("market-indexes") || selected.includes("regional-attribution")) && <details className="data-drawer source-drawer"><summary><span>Source images & report data</span><small>{snippetImages.length ? `${snippetImages.length} images` : "Optional"}</small><ChevronRight size={16}/></summary><section className="supporting-upload"><p>Add screenshots and report snippets. Each image becomes its own slide, with an editable title and optional takeaway.</p><SourceSnippets images={snippetImages} onChange={setSnippetImages}/><details className="structured-data"><summary>Structured market and Riskalyze data</summary><p className="helper">Import verified values for the generated charts and metrics.</p><div className="flex gap-3 flex-wrap"><button className="secondary" onClick={() => supportFile.current.click()}><Upload size={15}/> Upload report data</button><a className="text-button" href="/report-data-template.json" download>Download data template</a></div><input className="hidden" ref={supportFile} type="file" accept=".json" onChange={e => {uploadSupporting(e.target.files[0]);e.target.value="";}}/><p className="helper">One JSON adapter can populate the automatic YTD index slide and the optional Riskalyze slide.</p>{supporting.marketIndexes && <p className="live-status">Market context loaded · {supporting.marketIndexes.asOf}</p>}{supporting.risk && <p className="live-status">Riskalyze data loaded · {supporting.risk.accounts.length} accounts · {supporting.risk.asOf}</p>}{supportError && <p className="errors" role="alert">{supportError}</p>}</details></section></details>}
                </section>
                <aside className="deck-summary">
                  <div className="summary-icon">
                    <FileText size={22} strokeWidth={1.4} />
                  </div>
                  <h2>Your deck</h2>
                  <label htmlFor="deck-title">Deck title</label>
                  <input
                    id="deck-title"
                    maxLength={65}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <div className="personalization"><label className="field-label">Prepared for<input maxLength={80} value={preparedFor} onChange={e=>setPreparedFor(e.target.value)}/></label><label className="field-label">Advisor<input maxLength={80} value={advisor} onChange={e=>setAdvisor(e.target.value)}/></label><label className="field-label">Report date<input type="date" value={reportDate} onChange={e=>setReportDate(e.target.value)}/></label></div>
                  <div className="deck-outline">
                    <div>
                      <span>01</span>Cover <small>Included</small>
                    </div>
                    {slides.slice(1).map((s, i) => (
                      <div key={s.id}><span>{String(i + 2).padStart(2, "0")}</span>{s.name}</div>
                    ))}
                  </div>
                  <div className="summary-count">
                    <span>{slides.length} slides</span>
                    <span>GSWM theme</span>
                  </div>
                  <button
                    className="primary w-full"
                    disabled={
                      !selected.length ||
                      (marketLoading && !validMarketIndexes(marketIndexes)) ||
                      (selected.includes("equity") && !equity) ||
                      (selected.includes("risk") && !supporting.risk && !riskSnapshot)
                    }
                    onClick={() => { setDeckEquity(equity); setDeckMarket({riskSnapshot: structuredClone(riskSnapshot), marketIndexes: structuredClone(marketIndexes), sectorPerformance: structuredClone(sectorPerformance), earnings: structuredClone(earnings), supporting: structuredClone(supporting)}); navigate(2); }}
                  >
                    Preview deck
                  </button>
                  {selected.includes("risk") && !supporting.risk && !riskSnapshot && <p className="helper">Upload risk model inputs or a sourced Riskalyze report to include this slide.</p>}
                  {selected.includes("equity") && !equity && <p className="helper">Complete the sector comparison to preview this component.</p>}
                  {selected.includes("notes") && !notes.trim() && (
                    <p className="helper">
                      Add your discussion points to continue.
                    </p>
                  )}
                  <button
                    className="text-button mx-auto mt-4"
                    onClick={() => navigate(0)}
                  >
                    <ArrowLeft size={14} /> Back to holdings
                  </button>
                </aside>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div className="workspace-heading">
                <div>
                  <h1>
                    {done ? "Your deck is ready." : "Review your deck"}
                  </h1>
                  <p>
                    {done
                      ? "Save a PDF or return to refine your components."
                      : "Review each slide before you finish your deck."}
                  </p>
                </div>
                <button className="secondary" onClick={() => navigate(1)}>
                  Edit components
                </button>
              </div>
              <div className="preview-layout">
                <aside className="slide-list">
                  {slides.map((s, i) => (
                    <button
                      key={`${s.id}${i}`}
                      aria-current={page === i ? "page" : undefined}
                      className={page === i ? "current" : ""}
                      onClick={() => setPage(i)}
                    >
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <div>{s.name}</div>
                    </button>
                  ))}
                </aside>
                <div className="preview-stage">
                  {renderSlide({ slide: slides[page], index: page })}
                  <div className="preview-controls">
                    <span>
                      {page + 1} / {slides.length}
                    </span>
                    <div className="flex gap-2">
                      <button
                        aria-label="Previous slide"
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        aria-label="Next slide"
                        disabled={page === slides.length - 1}
                        onClick={() => setPage(page + 1)}
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="finish-row">
                <p>
                  <ShieldCheck size={15} /> Prepared from your provided
                  holdings.
                </p>
                {done ? (
                  <div className="flex gap-3">
                    <button className="secondary" onClick={reset}>
                      Start a new deck
                    </button>
                    <button className="primary" onClick={() => window.print()}>
                      <Download size={16} /> Print / Save PDF
                    </button>
                  </div>
                ) : (
                  <button
                    className="primary"
                    onClick={() => {
                      setDone(true);
                      setPage(0);
                    }}
                  >
                    Finish deck <Check size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </main>

      </div>
      {showExample && (
        <div className="modal-backdrop" onClick={() => setShowExample(false)}>
          <section
            className="example-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Equity sector exposure example"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowExample(false);
              if (e.key === "Tab") {
                e.preventDefault();
                e.currentTarget.querySelector("button").focus();
              }
            }}
          >
            <button
              autoFocus
              aria-label="Close example"
              className="modal-close"
              onClick={() => setShowExample(false)}
            >
              <X size={20} />
            </button>
            <EquitySlide data={equityExample} example />
            <p className="helper">
              Example preview only. This data is not added to your deck.
            </p>
          </section>
        </div>
      )}
      <div className="print-deck">
        {done &&
          slides.map((s, i) => (
            <React.Fragment key={`${s.id}${i}`}>
              {renderSlide({ slide: s, index: i, print: true })}
            </React.Fragment>
          ))}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
