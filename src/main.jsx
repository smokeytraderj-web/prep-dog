import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Upload,
  Check,
  Layers,
  ChartNoAxesColumnIncreasing,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  X,
  Sun,
  Moon,
  GripVertical,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { parseHoldings, totalValue } from "./holdings";
import "./styles.css";
import "./workspace.css";
import "./report.css";
import "./slide-updates.css";
import EquitySlide from "./EquitySlide";
import { RiskSnapshotStatus, RiskSnapshotSlide } from "./RiskSnapshot";
import "./risk-snapshot.css";
import "./data-drawers.css";
import "./slide-fit.css";
import "./slide-theme.css";
import "./slide-navy.css";
import "./context-board.css";
import { SectorYtdSlide, EarningsExpectationsSlide, ContentsSlide, AttributionSlide as PositionAttributionSlide } from "./ContextSlides";
import { computeAttribution } from "./attribution";
import { SP500_EARNINGS } from "./earnings-data";
import "./slide-dwyer.css";
import "./print-fidelity.css";
import { NavyFrame, NavyCover, NavyAccountSummary, NavyMarketIndexes, NavyRegional, NavyEquity, NavyRisk } from "./NavySlides";
import { SourceSnippets, SourceSnippetSlide } from "./SourceSnippets";
import equityExample from "./equity-example.json";
import { validateEquity } from "./equity";
import { enrichPositions } from "./asset-class";
import { comparePortfolio, isBenchmarkStale } from "./benchmark";
import BenchmarkPanel, { useBenchmark } from "./BenchmarkPanel";
import HoldingsImport from "./HoldingsImport";
import ContextChat from "./ContextChat";
import { contextLines } from "./context-chat";
import "./studio.css";
import { textToSheets, detectTable, extractHoldings } from "./holding-import";
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
// A balanced book rather than six mega-caps. The funds are all iShares, so the
// equity slide can take its sector look-through from the provider's own daily
// holdings file and the whole deck builds with nothing to import.
// public/example-holdings.csv is the same book with the account, asset class
// and region columns that a real custodian export would carry.
const sample = [
  "IVV 420000", "AAPL 95000", "MSFT 110000", "JPM 78000", "LLY 64000",
  "IWF 180000", "IEFA 165000", "IEMG 92000",
  "AGG 300000", "MUB 180000", "IGIB 120000", "TLT 85000",
  "SGOV 95000", "IAU 85000", "IYR 70000",
].join("\n");
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
    id: "fixed-income",
    name: "Fixed income snapshot",
    description: "Aggregate, Treasury, corporate and municipal year-to-date returns.",
    icon: ChartNoAxesColumnIncreasing,
    auto: true,
  },
  {
    id: "sector-ytd",
    name: "Sector performance",
    description: "The eleven S&P 500 sectors ranked by year-to-date return.",
    icon: ChartNoAxesColumnIncreasing,
    auto: true,
  },
  {
    id: "earnings-expectations",
    name: "S&P 500 earnings",
    description: "The earnings path, with consensus estimates for the forward years.",
    icon: ChartNoAxesColumnIncreasing,
    auto: true,
  },
  {
    id: "regional-attribution",
    name: "Attribution performance",
    description: "Which positions carried the portfolio, and which held it back.",
    icon: ChartNoAxesColumnIncreasing,
    auto: true,
  },
  {
    id: "equity",
    name: "Equity exposure",
    description: "Sector weights versus the current S&P 500 proxy.",
    icon: ChartNoAxesColumnIncreasing,
    auto: true,
  },
  { id: "risk", name: "Risk snapshot", description: "Risk score, modeled range, and allocation from the confirmed holdings.", icon: ShieldCheck, auto: true },
];
// The deck prints at 13.333in x 7.5in (96dpi), so the preview renders a slide at
// exactly that pixel size and scales it to the stage. Reviewing a true miniature
// of the page means the preview and the PDF cannot disagree about what fits.
const PAGE_W = 1280;
const PAGE_H = 720;
// Below this the slide stylesheets drop the fixed ratio and reflow for reading,
// which is more useful on a phone than a faithful but unreadable thumbnail.
const SCALED_PREVIEW_MIN = 761;

function SlideFrame({ children }) {
  const frame = useRef(null);
  const [scale, setScale] = useState(null);
  useEffect(() => {
    const element = frame.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const measure = (width) =>
      setScale(window.innerWidth < SCALED_PREVIEW_MIN || !width ? null : width / PAGE_W);
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width));
    observer.observe(element);
    measure(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);
  // The frame is always rendered so it can be measured; the page inside it is
  // only scaled once that measurement exists.
  return (
    <div className="slide-frame" ref={frame} style={scale ? { height: PAGE_H * scale } : undefined}>
      {scale ? (
        <div
          className="slide-page"
          style={{ transform: `scale(${scale})`, "--page-w": `${PAGE_W}px`, "--page-h": `${PAGE_H}px` }}
        >
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function App() {
  const [step, setStep] = useState(0),
    [text, setText] = useState(""),
    [holdings, setHoldings] = useState([]),
    [errors, setErrors] = useState([]),
    [reviewed, setReviewed] = useState(false),
    [title, setTitle] = useState("Account review"),
    [page, setPage] = useState(0),
    [printing, setPrinting] = useState(false),
    [drag, setDrag] = useState(false);
  // Every component the app can build is in the deck from the moment the
  // holdings are confirmed. The advisor curates by dragging and deleting
  // rather than by picking from a menu first, so the only deck state here is
  // what was reordered and what was thrown out.
  const [order, setOrder] = useState([]),
    [removed, setRemoved] = useState([]),
    [dragKey, setDragKey] = useState(null),
    [contextEntries, setContextEntries] = useState([]);
  // Slides only: the app chrome keeps its own palette. Persisted so an advisor
  // who works in one theme is not flipped back on every deck.
  const [slideTheme, setSlideTheme] = useState(() => {
    try { return localStorage.getItem("prepdog.slideTheme") === "dark" ? "dark" : "light"; }
    catch { return "light"; }
  });
  useEffect(() => {
    try { localStorage.setItem("prepdog.slideTheme", slideTheme); } catch { /* private window */ }
  }, [slideTheme]);
  // The print deck is only mounted while printing -- rendering every slide for
  // the whole session costs more than the one frame it takes here. Two frames,
  // so the pages are laid out before the dialog takes its snapshot.
  useEffect(() => {
    if (!printing) return;
    let second;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => {
        try { window.print(); } finally { setPrinting(false); }
      });
    });
    return () => { cancelAnimationFrame(first); if (second) cancelAnimationFrame(second); };
  }, [printing]);
  const [importedEquity, setEquity] = useState(null),
    [equityError, setEquityError] = useState(""),
    [showExample, setShowExample] = useState(false);
  const [riskSnapshot, setRiskSnapshot] = useState(null);
  const [riskStatus, setRiskStatus] = useState({busy: false, error: "", retry: null});
  const [snippetImages, setSnippetImages] = useState([]);
  const [importBook, setImportBook] = useState(null), [importBusy, setImportBusy] = useState(false), [importSource, setImportSource] = useState("");
  const [marketIndexes, setMarketIndexes] = useState(emptyMarketIndexes), [sectorPerformance, setSectorPerformance] = useState(emptySectorPerformance), [earnings, setEarnings] = useState(emptyEarnings);
  const [marketLoading, setMarketLoading] = useState(false), [marketError, setMarketError] = useState("");
  // The fixed income and sector boards come from the same endpoint as the
  // equity one, each a separate request so a failure on one does not blank the
  // others.
  const [fixedIncome, setFixedIncome] = useState(null), [sectorBoard, setSectorBoard] = useState(null);
  // Attribution needs a year-to-date return for each position the client holds,
  // so unlike the fixed boards this request depends on the holdings.
  const [positionReturns, setPositionReturns] = useState(null);
  const [positions, setPositions] = useState([]), [supporting, setSupporting] = useState({}), [supportError, setSupportError] = useState("");
  const [preparedFor, setPreparedFor] = useState(""), [advisor, setAdvisor] = useState(""), [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-CA'));
  const supportFile = useRef(null);
  const assetReady = positions.length > 0 && positions.every(p => p.assetClass);
  const accountsReady = positions.length > 0 && positions.every(p => p.account);
  const benchmark = useBenchmark();
  // Sector look-through for any fund the advisor holds, taken from the fund
  // provider's own daily holdings file rather than asked of the advisor.
  const [fundSectors, setFundSectors] = useState({});
  const fundKey = holdings.map(h => h.ticker).sort().join(",");
  useEffect(() => {
    if (!fundKey) { setFundSectors({}); return; }
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/fund-sectors?symbols=${encodeURIComponent(fundKey)}`, {headers: {Accept: "application/json"}});
        const payload = await response.json().catch(() => null);
        if (!cancelled && response.ok && payload?.funds) setFundSectors(payload.funds);
      } catch { /* the slide reports its own coverage either way */ }
    })();
    return () => { cancelled = true; };
  }, [fundKey]);
  // A pasted list carries ticker and value only, which left the account and
  // regional slides showing placeholders. Fill in what the benchmark and the
  // fund tables can establish; anything unresolved stays blank, so those slides
  // still report their real coverage rather than a guess.
  const enrichedPositions = React.useMemo(
    () => enrichPositions(positions, benchmark.snapshot),
    [positions, benchmark.snapshot],
  );
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
  async function refreshBoard(board, apply) {
    try {
      const data = await fetchMarketJson(`/api/market/ytd?board=${board}`);
      if (Array.isArray(data?.indexes) && data.indexes.length) apply(data);
    } catch { /* the slide shows its own waiting state rather than failing the deck */ }
  }
  useEffect(() => {
    refreshMarketIndexes();
    refreshBoard('fixed-income', setFixedIncome);
    refreshBoard('sectors', setSectorBoard);
  }, []);
  const tickerKey = holdings.map(h => h.ticker).sort().join(',');
  useEffect(() => {
    if (!tickerKey) { setPositionReturns(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchMarketJson(`/api/market/ytd?symbols=${encodeURIComponent(tickerKey)}`);
        if (cancelled || !Array.isArray(data?.indexes)) return;
        setPositionReturns({
          asOf: data.asOf,
          source: data.source,
          returns: Object.fromEntries(data.indexes.map(index => [index.symbol, index.return])),
        });
      } catch { if (!cancelled) setPositionReturns(null); }
    })();
    return () => { cancelled = true; };
  }, [tickerKey]);
  const attribution = React.useMemo(
    () => (positionReturns ? computeAttribution(holdings, positionReturns.returns) : null),
    [holdings, positionReturns],
  );
  const comparison = benchmark.snapshot && holdings.length ? comparePortfolio(holdings, benchmark.snapshot, fundSectors) : null;
  const equity = importedEquity || (benchmark.snapshot && !isBenchmarkStale(benchmark.snapshot) ? comparison?.data : null);
  const equityFile = useRef(null);
  const file = useRef(null);
  const total = totalValue(holdings);
  const noteLines = contextLines(contextEntries);
  // Each component is built unless the data behind it is missing, in which case
  // it drops out rather than printing an empty page. Keys are stable so a
  // reorder or a deletion survives a market refresh.
  const built = [
    { key: "cover", id: "cover", name: "Account review" },
    { key: "contents", id: "contents", name: "Contents" },
    ...sections.flatMap((s) =>
      s.id === "risk" && riskSnapshot ? [{...s, key: "risk", name: "Risk snapshot"}]
      : s.id === "risk" && supporting.risk ? Array.from({length: Math.ceil(supporting.risk.accounts.length / 2)}, (_, i) => ({...s, key: `risk-${i}`, offset: i * 2, name: `Risk metrics${supporting.risk.accounts.length > 2 ? ` · ${i + 1}` : ""}`}))
      : s.id === "risk" ? []
      : s.id === "equity" && !equity ? []
      : s.id === "attribution" && supporting.attribution ? supporting.attribution.accounts.map((a, i) => ({...s, key: `attribution-${i}`, accountIndex: i, name: `Contribution · ${a.name}`}))
      : [{...s, key: s.id}],
    ),
    ...snippetImages.map(image => ({key: `snippet-${image.id}`, id: `snippet-${image.id}`, name: image.title || "Source image", snippet: image})),
    ...Array.from({length: Math.ceil(noteLines.length / 4)}, (_, i) => ({key: `notes-${i}`, id: "notes", offset: i * 4, name: noteLines.length > 4 ? `For our conversation · ${i + 1}` : "For our conversation"})),
  ];
  // The cover stays first whatever the order says; everything after it follows
  // the advisor's arrangement, and a slide the order has not seen yet (a new
  // snippet, a new discussion page) keeps its natural place at the end.
  const slides = (() => {
    const kept = built.filter((slide) => !removed.includes(slide.key));
    const rank = new Map(order.map((key, i) => [key, i]));
    const rest = kept
      .filter((slide) => slide.key !== "cover")
      .map((slide, i) => ({slide, i}))
      .sort((a, b) => {
        const left = rank.has(a.slide.key) ? rank.get(a.slide.key) : Number.MAX_SAFE_INTEGER;
        const right = rank.has(b.slide.key) ? rank.get(b.slide.key) : Number.MAX_SAFE_INTEGER;
        return left - right || a.i - b.i;
      })
      .map(({slide}) => slide);
    const cover = kept.find((slide) => slide.key === "cover");
    return cover ? [cover, ...rest] : rest;
  })();
  // A deletion can take the slide that was on screen with it.
  useEffect(() => {
    if (page > slides.length - 1) setPage(Math.max(0, slides.length - 1));
  }, [slides.length, page]);
  function moveSlide(fromKey, toKey) {
    if (!fromKey || !toKey || fromKey === toKey || fromKey === "cover" || toKey === "cover") return;
    const keys = slides.map((slide) => slide.key);
    const from = keys.indexOf(fromKey), to = keys.indexOf(toKey);
    if (from < 0 || to < 0) return;
    keys.splice(to, 0, keys.splice(from, 1)[0]);
    setOrder(keys);
    setPage(keys.indexOf(fromKey));
  }
  function nudgeSlide(key, delta) {
    const keys = slides.map((slide) => slide.key);
    const target = keys[keys.indexOf(key) + delta];
    if (target) moveSlide(key, target);
  }
  function deleteSlide(key) {
    if (key === "cover") return;
    setRemoved((list) => (list.includes(key) ? list : [...list, key]));
  }
  const navigate = (n) => {
    setStep(n);
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

  // "Load example" used to paste ticker-and-value lines, which parseHoldings is
  // the only thing that reads. That format cannot carry an account, an asset
  // class or a region, so the account summary fell back to largest positions
  // and the regional slide had nothing to match on. The example now comes from
  // the same CSV the Example file link offers, through the same import path a
  // real custodian export takes, so the deck demonstrates every slide.
  async function loadExample() {
    setImportBusy(true);
    try {
      const response = await fetch("/example-holdings.csv");
      if (!response.ok) throw Error("not found");
      const sheets = textToSheets(await response.text(), "Example holdings");
      const rows = sheets[0].data;
      const result = extractHoldings(rows, detectTable(rows));
      if (!result.holdings.length) throw Error("empty");
      setRiskSnapshot(null);
      setHoldings(result.holdings);
      setPositions(result.positions);
      setText(result.holdings.map(h => `${h.ticker} ${h.value}`).join("\n"));
      setImportSource("Example holdings");
      setSupporting({}); setSupportError(""); setEquity(null); setEquityError("");
      setErrors([]);
      // Go straight to the review step, the way a confirmed file import does.
      // Returning to the paste box would send these rows back through parse(),
      // which rebuilds positions from the textarea and so drops the account,
      // asset class and region the CSV carries.
      setReviewed(true);
      setOrder([]); setRemoved([]);
    } catch {
      // The sample still works without the file; it just has no account column.
      setText(sample);
      setPositions([]);
      setImportSource("");
      setErrors([]);
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
    setOrder([]); setRemoved([]);
    setTitle("Account review");
    setContextEntries([]);
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
  // The deck's own details are edited on the cover, in the preview, rather than
  // in a form beside it: the field you type in is the line that prints. These
  // inputs are only ever rendered in the preview, never in the print deck.
  function coverFields(navy) {
    const prefix = navy ? "navy-" : "";
    return (
      <div className="cover-edit" onClick={(e) => e.stopPropagation()}>
        <label>
          <span>Prepared for</span>
          <input id={`${prefix}cover-client`} maxLength={80} value={preparedFor} placeholder="Client name"
            onChange={(e) => setPreparedFor(e.target.value)}/>
        </label>
        <label>
          <span>Deck title</span>
          <input id={`${prefix}cover-title`} maxLength={65} value={title} placeholder="Account review"
            onChange={(e) => setTitle(e.target.value)}/>
        </label>
        <label>
          <span>Advisor</span>
          <input id={`${prefix}cover-advisor`} maxLength={80} value={advisor} placeholder="Presented by"
            onChange={(e) => setAdvisor(e.target.value)}/>
        </label>
        <label>
          <span>Report date</span>
          <input id={`${prefix}cover-date`} type="date" value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}/>
        </label>
      </div>
    );
  }
  function slideContent(slide, editable) {
    if (slide.snippet) return <SourceSnippetSlide data={slide.snippet}/>;
    if (slide.id === "equity") return <EquitySlide data={equity} />;
    if (slide.id === "cover")
      return (
        <div className="cover-content">
          <p className="eyebrow">ACCOUNT REVIEW</p>
          <h2>{preparedFor?.trim() || title?.trim() || "Account review"}</h2>
          {preparedFor?.trim() && <p className="cover-client">{title?.trim() || "Account review"}</p>}
          <div className="gold-rule" />
          <p className="cover-sub">
            {advisor ? `Presented by ${advisor}` : "Gottfried & Somberg Wealth Management"}
          </p>
          <span className="cover-date">
            {reportDate ? new Date(`${reportDate}T12:00:00`).toLocaleDateString("en-US", {month: "long", day: "numeric", year: "numeric"}) : ""}
          </span>
          {editable && coverFields(false)}
        </div>
      );
    if (slide.id === "contents") return <ContentsSlide slides={slides}/>;
    if (slide.id === "account-summary") return <AccountSummarySlide positions={enrichedPositions} source={importSource}/>;
    if (slide.id === "market-indexes") return <MarketIndexesSlide data={marketIndexes}/>;
    if (slide.id === "fixed-income") return <MarketIndexesSlide data={fixedIncome} kicker="MARKET CONTEXT" title="Fixed income, year to date"/>;
    if (slide.id === "sector-ytd") return <SectorYtdSlide data={sectorBoard}/>;
    if (slide.id === "earnings-expectations") return <EarningsExpectationsSlide data={supporting.earningsTable || SP500_EARNINGS}/>;
    if (slide.id === "regional-attribution") return <PositionAttributionSlide result={attribution} asOf={positionReturns?.asOf} source={positionReturns?.source}/>;
    if (slide.id === "risk" && riskSnapshot) return <RiskSnapshotSlide data={riskSnapshot} theme={slideTheme}/>;
    if (slide.id === "risk") return <RiskSlide data={supporting.risk} offset={slide.offset}/>;
    if (slide.id === "attribution") return <AttributionSlide data={supporting.attribution} accountIndex={slide.accountIndex}/>;
    if (slide.id === "overview") return <PortfolioOverview holdings={holdings} equity={equity}/>;
    if (slide.id === "allocation") return <PortfolioAllocation holdings={holdings} equity={equity}/>;
    if (slide.id === "sector-performance") return <SectorPerformanceSlide data={sectorPerformance}/>;
    if (slide.id === "earnings") return <EarningsSlide data={earnings}/>;
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
  // Navy renders its own components, not the light ones restyled. A slide
  // without a navy composition falls through to the light one rather than
  // showing a half-themed page.
  const NAVY_LABELS = {
    "cover": "IN-HOUSE PORTFOLIO ANALYTICS",
    "account-summary": "ACCOUNT SUMMARY",
    "contents": "CONTENTS",
    "market-indexes": "MARKET SNAPSHOT",
    "fixed-income": "FIXED INCOME",
    "sector-ytd": "SECTOR PERFORMANCE",
    "earnings-expectations": "S&P 500 EARNINGS",
    "regional-attribution": "ATTRIBUTION PERFORMANCE",
    "equity": "EQUITY EXPOSURE",
    "risk": "RISK SNAPSHOT",
  };
  function navyContent(slide, editable) {
    if (slide.snippet) return null;
    const label = NAVY_LABELS[slide.id];
    if (!label) return null;
    const positions = enrichedPositions;
    if (slide.id === "cover")
      return {label, body: <><NavyCover title={title} preparedFor={preparedFor} advisor={advisor} reportDate={reportDate} total={total}/>{editable && coverFields(true)}</>};
    if (slide.id === "account-summary")
      return {label, body: <NavyAccountSummary positions={positions} source={importSource} asOf={reportDate}/>};
    if (slide.id === "market-indexes")
      return {label, body: <NavyMarketIndexes data={marketIndexes}/>};
    if (slide.id === "contents")
      return {label, body: <ContentsSlide slides={slides} navy/>};
    if (slide.id === "fixed-income")
      return {label, body: <NavyMarketIndexes data={fixedIncome} heading="Fixed income, year to date"
        title="What bonds did" note="Total returns, so coupon income is included. Bond market segments are shown through ETF proxies."/>};
    if (slide.id === "sector-ytd")
      return {label, body: <SectorYtdSlide data={sectorBoard} navy/>};
    if (slide.id === "earnings-expectations")
      return {label, body: <EarningsExpectationsSlide data={supporting.earningsTable || SP500_EARNINGS} navy/>};
    if (slide.id === "regional-attribution")
      return {label, body: <PositionAttributionSlide result={attribution} asOf={positionReturns?.asOf} source={positionReturns?.source} navy/>};
    if (slide.id === "equity" && equity)
      return {label, body: <NavyEquity data={equity}/>};
    if (slide.id === "risk" && riskSnapshot)
      return {label, body: <NavyRisk s={riskSnapshot}/>};
    return null;
  }
  function renderSlide({ slide, index, editable }) {
    const navy = slideTheme === "dark" ? navyContent(slide, editable) : null;
    if (navy)
      return (
        <article
          data-slide-theme="dark"
          className={`slide navy-slide slide-${slide.id} ${slide.id === "cover" ? "cover" : ""}`}
        >
          <NavyFrame label={navy.label} page={String(index + 1).padStart(2, "0")} cover={slide.id === "cover"}>
            {navy.body}
          </NavyFrame>
        </article>
      );
    return (
      <article
        data-slide-theme={slideTheme}
        className={`slide slide-${slide.id} ${slide.id === "cover" ? "cover" : ""}`}
      >
        <div className="slide-brand">
          <img src="/gswm-logo.png" alt=""/><div>GOTTFRIED & SOMBERG <span>WEALTH MANAGEMENT</span></div>
        </div>
        <div className="slide-body">{slideContent(slide, editable)}</div>
        <footer>
          {/* The Dwyer template puts the firm name in the footer and the
              source note inside the slide, where the figures are. */}
          <span>GOTTFRIED &amp; SOMBERG WEALTH MANAGEMENT, LLC</span>
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
          {["Add holdings", "Build the deck"].map(
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
              {importBook ? <HoldingsImport book={importBook} onCancel={() => setImportBook(null)} onConfirm={(values, source, importedPositions) => {setRiskSnapshot(null);setHoldings(values);setPositions(importedPositions);setSupporting({});setSupportError("");setText(values.map(h => `${h.ticker} ${h.value}`).join("\n"));setImportSource(source);setImportBook(null);setReviewed(true);setOrder([]);setRemoved([]);setEquity(null);setEquityError("");setErrors([]);}}/> : !reviewed ? (
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
                      disabled={importBusy}
                      onClick={loadExample}
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
                    {/* The pasted sample carries ticker and value only. This file
                        also has the account, asset class and region columns, which
                        are what the account summary and regional slides need. */}
                    <a className="text-button" href="/example-holdings.csv" download>Example file</a>
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
                      Build the deck
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
                  <h1>{printing ? "Printing your deck…" : "Your deck"}</h1>
                  <p>
                    Every component is built from your holdings. Drag a slide to move it,
                    delete what you do not need, and edit the cover in place.
                  </p>
                </div>
                <span className="portfolio-pill">
                  {holdings.length} positions <span>·</span> {money(total)}
                </span>
              </div>
              <div className="preview-layout">
                <aside className="slide-list" aria-label="Deck slides">
                  {slides.map((s, i) => (
                    <div
                      key={s.key}
                      className={`slide-row ${page === i ? "current" : ""} ${dragKey === s.key ? "dragging" : ""}`}
                      onDragOver={(e) => { if (dragKey && s.key !== "cover") e.preventDefault(); }}
                      onDrop={(e) => { e.preventDefault(); moveSlide(dragKey, s.key); setDragKey(null); }}
                    >
                      {s.key === "cover" ? (
                        <span className="slide-grip is-pinned" title="The cover opens every deck">
                          <GripVertical size={14} />
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="slide-grip"
                          draggable
                          aria-label={`Move ${s.name}. Use the arrow keys to reorder.`}
                          onDragStart={() => setDragKey(s.key)}
                          onDragEnd={() => setDragKey(null)}
                          onKeyDown={(e) => {
                            if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
                            e.preventDefault();
                            nudgeSlide(s.key, e.key === "ArrowUp" ? -1 : 1);
                          }}
                        >
                          <GripVertical size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="slide-pick"
                        aria-current={page === i ? "page" : undefined}
                        onClick={() => setPage(i)}
                      >
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <div>{s.name}</div>
                      </button>
                      {s.key !== "cover" && (
                        <button
                          type="button"
                          className="slide-drop"
                          aria-label={`Delete ${s.name}`}
                          onClick={() => deleteSlide(s.key)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {removed.length > 0 && (
                    <button type="button" className="text-button restore-slides" onClick={() => setRemoved([])}>
                      <RotateCcw size={13} /> Restore {removed.length} deleted
                    </button>
                  )}
                </aside>
                <div className="preview-stage">
                  <SlideFrame>{renderSlide({ slide: slides[page], index: page, editable: slides[page]?.id === "cover" })}</SlideFrame>
                  <div className="preview-controls">
                    <span>
                      {page + 1} / {slides.length}
                    </span>
                    <div className="theme-toggle" role="group" aria-label="Slide theme">
                      {["light", "dark"].map((option) => (
                        <button
                          key={option}
                          type="button"
                          className={slideTheme === option ? "current" : ""}
                          aria-pressed={slideTheme === option}
                          onClick={() => setSlideTheme(option)}
                        >
                          {option === "light" ? <Sun size={13} /> : <Moon size={13} />}
                          {option === "light" ? "Light" : "Navy"}
                        </button>
                      ))}
                    </div>
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
              {/* Uploads and context sit under the preview, where the deck they
                  change is in view. */}
              <section className="studio-panels" aria-label="Deck inputs">
                <details className="data-drawer source-drawer" open>
                  <summary><span>Files &amp; source images</span><small>{snippetImages.length ? `${snippetImages.length} images` : "Optional"}</small><ChevronRight size={16}/></summary>
                  <section className="supporting-upload">
                    <p>Add screenshots and report snippets. Each image becomes its own slide, with an editable title and optional takeaway.</p>
                    <SourceSnippets images={snippetImages} onChange={setSnippetImages}/>
                    <details className="structured-data">
                      <summary>Structured market and Riskalyze data</summary>
                      <p className="helper">Import verified values for the generated charts and metrics.</p>
                      <div className="flex gap-3 flex-wrap">
                        <button className="secondary" onClick={() => supportFile.current.click()}><Upload size={15}/> Upload report data</button>
                        <a className="text-button" href="/report-data-template.json" download>Download data template</a>
                      </div>
                      <input className="hidden" ref={supportFile} type="file" accept=".json" onChange={e => {uploadSupporting(e.target.files[0]);e.target.value="";}}/>
                      <p className="helper">One JSON adapter can populate the automatic YTD index slide and the optional Riskalyze slide.</p>
                      {supporting.marketIndexes && <p className="live-status">Market context loaded · {supporting.marketIndexes.asOf}</p>}
                      {supporting.risk && <p className="live-status">Riskalyze data loaded · {supporting.risk.accounts.length} accounts · {supporting.risk.asOf}</p>}
                      {!supporting.risk && !riskSnapshot && !riskStatus.busy && riskStatus.error && (
                        <p className="helper">{riskStatus.error} The risk slide is left out of the deck.{riskStatus.retry && <> <button className="text-button inline" onClick={riskStatus.retry}>Try again</button></>}</p>
                      )}
                      {supportError && <p className="errors" role="alert">{supportError}</p>}
                    </details>
                    <details className="structured-data">
                      <summary>Sector data for the equity slide</summary>
                      <p className="helper">The equity slide takes its sector look-through from the fund providers. Import verified sector data to override it, or when a holding cannot be resolved.</p>
                      <div className="flex gap-3 flex-wrap">
                        <button className="secondary" onClick={() => equityFile.current.click()}><Upload size={14}/> Import sector data</button>
                        <button className="secondary" disabled={benchmark.loading} onClick={benchmark.refresh}>Refresh benchmark</button>
                        <button className="text-button" onClick={() => setShowExample(true)}>Layout example</button>
                        {importedEquity && <button className="text-button" onClick={() => setEquity(null)}>Use daily benchmark</button>}
                      </div>
                      <input className="hidden" ref={equityFile} type="file" accept=".json" onChange={(e) => {uploadEquity(e.target.files[0]);e.target.value="";}}/>
                      {equity
                        ? <p className="live-status"><Check size={15}/> {importedEquity ? "Imported sector data" : "Portfolio comparison ready"} · {equity.as_of}</p>
                        : <p className="helper">{comparison?.unmatched.length ? `Sector data needed for ${comparison.unmatched.map(h => h.ticker).join(", ")}.` : benchmark.error || "The equity slide is left out until sector data resolves."}</p>}
                      {equityError && <p className="errors" role="alert">{equityError}</p>}
                    </details>
                  </section>
                </details>
                <details className="data-drawer">
                  <summary><span>Market data</span><small>{marketLoading ? "Refreshing…" : marketIndexes.asOf ? `Through ${marketIndexes.asOf}` : "Not loaded"}{marketError ? " · Refresh issue" : ""}</small><ChevronRight size={16}/></summary>
                  <MarketIndexesEditor data={marketIndexes} onChange={setMarketIndexes} onRefresh={refreshMarketIndexes} loading={marketLoading} error={marketError}/>
                </details>
                <details className="data-drawer context-drawer" open>
                  <summary><span>Context</span><small>{(() => { const n = contextEntries.filter(e => e.role === "user").length; return n ? `${n} ${n === 1 ? "point" : "points"}` : "No context yet"; })()}</small><ChevronRight size={16}/></summary>
                  <ContextChat
                    entries={contextEntries}
                    onChange={setContextEntries}
                    deckContext={{title, preparedFor, advisor, reportDate, holdings, total, slides: slides.map(s => s.name)}}
                  />
                </details>
              </section>
              {/* The snapshot builds itself from the holdings. It stays mounted so
                  swapping panels does not remount it and refire the price history
                  fetch; when it cannot be built the slide is simply absent. */}
              <div className="hidden">
                <RiskSnapshotStatus holdings={holdings} positions={enrichedPositions} benchmark={benchmark.snapshot} asOf={reportDate} client={preparedFor} data={riskSnapshot} onChange={setRiskSnapshot} onStatus={setRiskStatus}/>
              </div>
              <div className="finish-row">
                <p>
                  <ShieldCheck size={15} /> Prepared from your provided holdings.
                </p>
                <div className="flex gap-3">
                  <button className="secondary" onClick={reset}>
                    Start a new deck
                  </button>
                  <button className="primary" disabled={printing || !slides.length} onClick={() => setPrinting(true)}>
                    <Download size={16} /> {printing ? "Preparing…" : "Print / Save PDF"}
                  </button>
                </div>
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
        {printing &&
          slides.map((s, i) => (
            <React.Fragment key={s.key}>
              {renderSlide({ slide: s, index: i })}
            </React.Fragment>
          ))}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
