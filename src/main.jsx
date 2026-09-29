import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
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
import EquitySlide from "./EquitySlide";
import equityExample from "./equity-example.json";
import { SECTOR_ORDER, validateEquity } from "./equity";
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
    id: "overview",
    name: "Portfolio overview",
    description: "The big picture. Total value and position count.",
    icon: Layers,
  },
  {
    id: "allocation",
    name: "Position allocation",
    description: "A clear view of how the portfolio is weighted.",
    icon: PieChart,
  },
  {
    id: "holdings",
    name: "Holdings detail",
    description: "Every position, value, and portfolio weight.",
    icon: List,
  },
  {
    id: "concentration",
    name: "Concentration",
    description: "Largest positions and their combined weight.",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    id: "equity",
    name: "Equity sector exposure",
    description: "Sector weights and over / underweight vs. a benchmark.",
    icon: ChartNoAxesColumnIncreasing,
  },
  {
    id: "notes",
    name: "Discussion points",
    description: "Your talking points for the conversation.",
    icon: MessageSquare,
  },
];
function App() {
  const [step, setStep] = useState(0),
    [text, setText] = useState(""),
    [holdings, setHoldings] = useState([]),
    [errors, setErrors] = useState([]),
    [reviewed, setReviewed] = useState(false),
    [selected, setSelected] = useState(["overview", "allocation", "holdings"]),
    [title, setTitle] = useState("Portfolio review"),
    [notes, setNotes] = useState(""),
    [page, setPage] = useState(0),
    [done, setDone] = useState(false),
    [drag, setDrag] = useState(false);
  const [equity, setEquity] = useState(null),
    [equityError, setEquityError] = useState(""),
    [equityStatus, setEquityStatus] = useState(""),
    [showExample, setShowExample] = useState(false);
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
        s.id === "holdings"
          ? Array.from({ length: Math.ceil(holdings.length / 8) }, (_, i) => ({
              ...s,
              offset: i * 8,
              name: `Holdings detail${holdings.length > 8 ? ` · ${i + 1}` : ""}`,
            }))
          : s.id === "notes"
            ? Array.from(
                { length: Math.max(1, Math.ceil(noteLines.length / 4)) },
                (_, i) => ({
                  ...s,
                  offset: i * 4,
                  name: `Discussion points${noteLines.length > 4 ? ` · ${i + 1}` : ""}`,
                }),
              )
            : [s],
      ),
  ];
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
      setHoldings(r.holdings);
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
    try {
      let input;
      if (/\.xlsx$/i.test(f.name)) {
        const { readSheet: readXlsxFile } =
          await import("read-excel-file/browser");
        const rows = await readXlsxFile(f);
        input = rows
          .filter((row) => row.some((v) => v !== null))
          .map((row) => row.map((v) => v ?? "").join("\t"))
          .join("\n");
      } else input = await f.text();
      setText(input);
      setReviewed(false);
      setErrors([]);
    } catch {
      setErrors([
        "This file could not be read. Use an unprotected .xlsx file, or paste the holdings directly.",
      ]);
    }
  }

  function reset() {
    setText("");
    setHoldings([]);
    setReviewed(false);
    setSelected(["overview", "allocation", "holdings"]);
    setTitle("Portfolio review");
    setNotes("");
    setErrors([]);
    setEquity(null);
    setEquityError("");
    setEquityStatus("");
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
  async function loadLiveEquity() {
    setEquityStatus("Loading latest S&P 500 exposure…");
    setEquityError("");
    try {
      const response = await fetch("/api/benchmark/sp500");
      if (!response.ok) throw Error("The live benchmark source is unavailable right now.");
      const { readSheet } = await import("read-excel-file/browser");
      const rows = await readSheet(await response.blob());
      const headerIndex = rows.findIndex((row) => row.some((cell) => /sector/i.test(String(cell || ""))) && row.some((cell) => /weight/i.test(String(cell || ""))));
      if (headerIndex < 0) throw Error("The benchmark source format changed. Use the supplied sector file instead.");
      const headers = rows[headerIndex].map((cell) => String(cell || "").toLowerCase());
      const sectorIndex = headers.findIndex((header) => header.includes("sector"));
      const weightIndex = headers.findIndex((header) => header.includes("weight"));
      const map = {"information technology":"Info Tech","technology":"Info Tech","financials":"Financial Svcs","financial services":"Financial Svcs","consumer discretionary":"Cons Discr","consumer cyclical":"Cons Discr","communication services":"Comms Svcs","communication":"Comms Svcs","industrials":"Industrials","health care":"Healthcare","healthcare":"Healthcare","consumer staples":"Cons Staples","consumer defensive":"Cons Staples","real estate":"REITs","energy":"Energy","materials":"Materials","utilities":"Utilities"};
      const totals = Object.fromEntries(SECTOR_ORDER.map((name) => [name, 0]));
      rows.slice(headerIndex + 1).forEach((row) => { const sector = map[String(row[sectorIndex] || "").trim().toLowerCase()]; const weight = Number(String(row[weightIndex] || "").replace(/%/g, "").replace(/,/g, "")); if (sector && Number.isFinite(weight)) totals[sector] += weight; });
      const sectors = SECTOR_ORDER.map((name) => ({ name, portfolio: totals[name], benchmark: totals[name] }));
      const totalWeight = sectors.reduce((sum, sector) => sum + sector.benchmark, 0);
      if (totalWeight < 95) throw Error("The benchmark source did not return a complete sector snapshot.");
      const asOf = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
      setEquity(validateEquity({ title: "S&P 500 Equity Exposure", as_of: `Updated ${asOf}`, portfolio_label: "S&P 500", benchmark_label: "S&P 500", benchmark_short: "S&P 500", source_note: "Source: State Street SPY daily holdings workbook.", sectors }));
      setEquityStatus("Latest benchmark snapshot loaded");
    } catch (e) { setEquity(null); setEquityStatus(""); setEquityError(e.message); }
  }
  function slideContent(slide) {
    if (slide.id === "equity") return <EquitySlide data={equity} />;
    if (slide.id === "cover")
      return (
        <div className="cover-content">
          <p className="eyebrow">A MORE INFORMED CONVERSATION</p>
          <h2>{title || "Portfolio review"}</h2>
          <div className="gold-rule" />
          <p className="cover-sub">
            Prepared with Gottfried & Somberg
            <br />
            Wealth Management
          </p>
          <span className="cover-date">
            {new Date().toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
      );
    if (slide.id === "overview")
      return (
        <>
          <h2>Your portfolio, at a glance.</h2>
          <div className="slide-metrics">
            <div>
              <small>Total portfolio value</small>
              <strong>{money(total)}</strong>
            </div>
            <div>
              <small>Positions</small>
              <strong>{holdings.length}</strong>
            </div>
          </div>
          <p className="slide-note">
            Based on the position values provided for this review.
          </p>
        </>
      );
    if (slide.id === "allocation") {
      const colors = ["#173b5a", "#315f82", "#5b86a6", "#88a8bd", "#b4c6d2", "#d0dce4"];
      let cursor = 0;
      const stops = ranked.map((h, i) => {
        const start = cursor;
        cursor += (h.value / total) * 100;
        return `${colors[i % colors.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
      }).join(", ");
      const topThree = ranked.slice(0, 3).reduce((sum, h) => sum + h.value, 0) / total * 100;
      const largest = ranked[0];
      return (
        <>
          <h2>Where the portfolio is invested.</h2>
          <div className="allocation-visual">
            <div className="allocation-donut" style={{ background: `conic-gradient(${stops})` }}>
              <div className="allocation-donut-center"><strong>{holdings.length}</strong><span>positions</span></div>
            </div>
            <div className="allocation-readout">
              <p className="allocation-kicker">PORTFOLIO MIX</p>
              <strong>{topThree.toFixed(1)}%</strong>
              <span>in the three largest positions</span>
              <p className="allocation-insight">Largest position: <b>{largest?.ticker}</b> at {((largest?.value / total) * 100).toFixed(1)}%.</p>
            </div>
          </div>
          <div className="allocation-legend">
            {ranked.slice(0, 6).map((h, i) => (
              <div key={h.ticker}><span className="allocation-swatch" style={{ background: colors[i % colors.length] }} /><b>{h.ticker}</b><span>{((h.value / total) * 100).toFixed(1)}%</span></div>
            ))}
          </div>
          {ranked.length > 6 && <p className="slide-note">Top six shown individually; remaining positions are included in the chart.</p>}
        </>
      );
    }
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
    if (slide.id === "concentration")
      return (
        <>
          <h2>Where the portfolio is focused.</h2>
          <div className="concentration">
            <strong>
              {(
                (ranked.slice(0, 3).reduce((s, h) => s + h.value, 0) / total) *
                100
              ).toFixed(1)}
              <span>%</span>
            </strong>
            <p>in the {Math.min(3, ranked.length)} largest positions</p>
          </div>
          <div className="top-positions">
            {ranked.slice(0, 3).map((h) => (
              <div key={h.ticker}>
                <b>{h.ticker}</b>
                <span>{((h.value / total) * 100).toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </>
      );
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
        className={`slide ${slide.id === "cover" ? "cover" : ""} ${print ? "print-slide" : ""}`}
      >
        <div className="slide-brand">
          GOTTFRIED & SOMBERG <span>WEALTH MANAGEMENT</span>
        </div>
        <div className="slide-body">{slideContent(slide)}</div>
        <footer>
          <span>
            {slide.id === "cover"
              ? "PORTFOLIO REVIEW"
              : slide.id === "equity"
                ? "Source: imported sector data · As-of date supplied above"
                : "Source: user-provided holdings · No live market data"}
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
          <div className="brand">
            <span className="brand-mark">
              G<span>&</span>S
            </span>
            <div className="brand-name">
              GOTTFRIED & SOMBERG<small>WEALTH MANAGEMENT</small>
            </div>
          </div>
          <div className="product-name">
            prep dog
            <span className="gold-dot" />
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
              {!reviewed ? (
                <section
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
                    <label htmlFor="holdings">Add your holdings</label>
                    <button
                      className="text-button"
                      onClick={() => {
                        setText(sample);
                        setErrors([]);
                      }}
                    >
                      Try an example <ArrowRight size={13} />
                    </button>
                  </div>
                  <textarea
                    id="holdings"
                    value={text}
                    onChange={(e) => {
                      setText(e.target.value);
                      setErrors([]);
                    }}
                    placeholder={
                      "Paste holdings here…\n\nAAPL  33,032\nMSFT  49,808\nNVDA  21,208"
                    }
                    spellCheck="false"
                  />
                  <div className="input-hint">
                    Ticker + position value (USD). Paste any two-column list, or
                    upload an Excel / CSV file.
                  </div>
                  <div className="input-actions">
                    <button
                      className="upload-button"
                      onClick={() => file.current.click()}
                    >
                      <Plus size={17} /> Upload file
                    </button>
                    <span className="file-types">XLSX, CSV, TXT</span>
                    <button
                      className="primary ml-auto"
                      onClick={parse}
                      disabled={!text.trim()}
                    >
                      Review holdings <ArrowRight size={16} />
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
                      <p className="eyebrow">READY TO REVIEW</p>
                      <h2>{holdings.length} positions. All in view.</h2>
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
                      Choose components <ArrowRight size={16} />
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
              <div className="privacy-note">
                <ShieldCheck size={14} /> Your holdings stay in this browser
                session.
              </div>
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
                  <div className="component-grid">
                    {sections.map((s) => (
                      <button
                        key={s.id}
                        aria-pressed={selected.includes(s.id)}
                        className={`component-card ${selected.includes(s.id) ? "selected" : ""}`}
                        onClick={() =>
                          setSelected((v) =>
                            v.includes(s.id)
                              ? v.filter((x) => x !== s.id)
                              : [...v, s.id],
                          )
                        }
                      >
                        <div className="flex justify-between items-start">
                          <s.icon size={23} strokeWidth={1.4} />
                          <span className="checkbox">
                            {selected.includes(s.id) && <Check size={13} />}
                          </span>
                        </div>
                        <h2>{s.name}</h2>
                        <p>{s.description}</p>
                      </button>
                    ))}
                  </div>
                  {selected.includes("equity") && (
                    <div className="equity-input">
                      <div>
                        <h3>Equity sector data</h3>
                        <p>
                          Attach the sector JSON produced for this portfolio.
                          Requires all 11 sectors and benchmark weights.
                        </p>
                      </div>
                      <div className="flex gap-3 flex-wrap">
                        <button className="primary" onClick={loadLiveEquity}>
                          <ChartNoAxesColumnIncreasing size={14} /> Load live S&P 500
                        </button>
                        <button className="secondary" onClick={() => equityFile.current.click()}>
                          <Upload size={14} /> Import sector data
                        </button>
                        <button className="text-button" onClick={() => setShowExample(true)}>View example</button>
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
                      {equityStatus && <p className="live-status"><span className="live-dot" />{equityStatus} · {equity?.as_of}</p>}
                      {equity && !equityStatus && <p className="helper">Loaded: {equity.portfolio_label} · {equity.as_of}</p>}
                      {equityError && (
                        <p className="errors" role="alert">
                          {equityError}
                        </p>
                      )}
                    </div>
                  )}
                  {selected.includes("notes") && (
                    <div className="notes-input">
                      <label htmlFor="notes">Discussion points</label>
                      <textarea
                        id="notes"
                        maxLength={800}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add one talking point per line…"
                      />
                      <small>{notes.length}/800 characters</small>
                    </div>
                  )}
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
                  <div className="deck-outline">
                    <div>
                      <span>01</span>Cover <small>Included</small>
                    </div>
                    {sections
                      .filter((s) => selected.includes(s.id))
                      .map((s, i) => (
                        <div key={s.id}>
                          <span>{String(i + 2).padStart(2, "0")}</span>
                          {s.name}
                        </div>
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
                      (selected.includes("notes") && !notes.trim()) ||
                      (selected.includes("equity") && !equity)
                    }
                    onClick={() => navigate(2)}
                  >
                    Preview deck <ArrowRight size={16} />
                  </button>
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
