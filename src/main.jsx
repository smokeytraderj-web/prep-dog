import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
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
  Sun,
  Moon,
  Landmark,
  GripVertical,
} from "lucide-react";
import { parseHoldings, totalValue } from "./holdings";
import { splitAccountBlocks, hasNamedAccounts } from "./account-blocks";
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
import { deckName } from "./deck-name";
import { SP500_EARNINGS } from "./earnings-data";
import "./slide-dwyer.css";
import "./slide-brand.css";
import "./slide-dwyer-layouts.css";
import { DwyerRisk, DwyerContents } from "./DwyerSlides";
import "./print-fidelity.css";
import { DwyerDiscussion } from "./DwyerSlides";
import { NavyFrame, NavyCover, NavyCoverClassic, NavyAccountSummary, NavyMarketIndexes, NavyRegional, NavyEquity, NavyRisk, NavyAllocation, NavyAssetClassPerformance, NavyAdmin } from "./NavySlides";
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
import MultiAccountImport from "./MultiAccountImport";
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
    id: "allocation",
    name: "Overall asset allocation",
    description: "The donut and class table, with estimated values and the equity split.",
    icon: PieChart,
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
    id: "asset-class-performance",
    name: "Asset class performance",
    description: "Year-to-date return for each asset class the portfolio holds.",
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
  },
  { id: "risk", name: "Risk snapshot", description: "Risk score, modeled range, and allocation from the confirmed holdings.", icon: ShieldCheck },
  {
    id: "admin",
    name: "Admin",
    description: "Custodian and portal transition, what stays the same, and professional contacts.",
    icon: Landmark,
    auto: true,
  },
];

// Every slide the app can build is in the standing deck. There is no step that
// asks which ones to make any more: the deck arrives whole and the advisor
// takes slides out of it. Derived, not listed, so adding a section cannot
// leave the reset paths behind.
const AUTO_SLIDES = sections.map(s => s.id);

// Three meetings, three decks. The slides and the order are the same machinery
// either way -- a preset only says which ones to start from, and every one of
// them can still be dragged, removed or added back afterwards.
export const DECK_PRESETS = [
  {
    id: "quarterly",
    name: "Quarterly review",
    note: "The full review: holdings, markets, positioning and what we are doing.",
    ids: AUTO_SLIDES,
  },
  {
    id: "transition",
    name: "Transition meeting",
    // The custodian move is the reason for the meeting, so it opens rather than
    // closes, and the market pages that would pad it out are left behind.
    note: "Led by the custodian move, with just enough of the portfolio behind it.",
    ids: ["admin", "account-summary", "allocation", "risk"],
  },
  {
    id: "prospect",
    name: "Prospect",
    // No attribution: contribution figures assume positions we have not held.
    // No admin: they are not a client yet, so there is nothing to transition.
    note: "What they hold today, the risk in it, and how we read the market.",
    ids: ["account-summary", "allocation", "risk", "equity", "market-indexes", "sector-ytd", "fixed-income"],
  },
];

// The preset a deck is currently on, or null once it has been rearranged. The
// order matters: moving a slide makes the deck this advisor's, not the preset's.
export const presetOf = (selected) =>
  DECK_PRESETS.find(preset =>
    preset.ids.length === selected.length && preset.ids.every((id, i) => selected[i] === id),
  )?.id || null;

// Every slide's position is the advisor's to choose, Admin included, so the
// selected list is the deck order exactly as it stands.
const orderSelection = (ids) => ids;

// Four slide styles. 1 and 2 are the Dwyer template reproduced on white and on
// navy. 3 and 4 are the September 2026 brand guide: Primary #001644, Stability
// #BD603B, Playfair Display over Roboto. Style 3 is not style 4 repainted —
// white gets its own document layout, which is the whole point of having both.
const SLIDE_THEMES = [
  {id: "light",       label: "Light",   dark: false, brand: false},
  {id: "dark",        label: "Navy",    dark: true,  brand: false},
  {id: "brand-light", label: "Style 3", dark: false, brand: true},
  {id: "brand-navy",  label: "Style 4", dark: true,  brand: true},
];
const DEFAULT_THEME = "dark";
// Not themeOf(DEFAULT_THEME) as the fallback: that recurses forever the moment
// DEFAULT_THEME stops naming a style that exists.
const themeOf = id => SLIDE_THEMES.find(t => t.id === id)
  || SLIDE_THEMES.find(t => t.id === DEFAULT_THEME)
  || SLIDE_THEMES[0];
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
    [selected, setSelected] = useState(AUTO_SLIDES),
    [title, setTitle] = useState("Portfolio review"),
    [contextEntries, setContextEntries] = useState([]),
    [page, setPage] = useState(0),
    [done, setDone] = useState(false),
    [drag, setDrag] = useState(false);
  // Slides only: the app chrome keeps its own palette. Persisted so an advisor
  // who works in one theme is not flipped back on every deck.
  const [slideTheme, setSlideTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("prepdog.slideTheme");
      return SLIDE_THEMES.some(t => t.id === saved) ? saved : DEFAULT_THEME;
    } catch { return DEFAULT_THEME; }
  });
  useEffect(() => {
    try { localStorage.setItem("prepdog.slideTheme", slideTheme); } catch { /* private window */ }
  }, [slideTheme]);
  const [importedEquity, setEquity] = useState(null),
    [equityError, setEquityError] = useState(""),
    [showExample, setShowExample] = useState(false);
  const [riskSnapshot, setRiskSnapshot] = useState(null);
  const [riskStatus, setRiskStatus] = useState({busy: false, error: "", retry: null});
  const [snippetImages, setSnippetImages] = useState([]);
  const [multiAccount, setMultiAccount] = useState(false);
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
  // Browsers offer document.title as the default name in the print dialog, so
  // naming the deck here is what makes the saved PDF land as "Jane Smith
  // Review 2026-10-01" instead of "Prep Dog · GSWM.pdf". The workspace tab
  // keeps the product name until a deck is actually finished.
  const savedDeckName = deckName(preparedFor, reportDate);
  useEffect(() => {
    if (!done) return;
    const previous = document.title;
    document.title = savedDeckName;
    return () => { document.title = previous; };
  }, [done, savedDeckName]);
  const [admin, setAdmin] = useState({
    heading: "Transition to LPL Financial",
    when: "",
    fromCustodian: "NFS",
    toCustodian: "LPL Financial",
    fromPortal: "Investor360\u00b0",
    toPortal: "Account View",
    staysTheSame: [
      "Your advisory team at Gottfried & Somberg",
      "Your investment strategy and portfolios",
      "Your planning relationship with us",
    ],
    whatYouSee: [
      "Custody and statements with LPL",
      "Online access through Account View",
      "New login details ahead of the transition",
    ],
    contacts: [{role: "CPA", name: ""}, {role: "Estate Attorney", name: ""}],
  });
  // Reordering the deck. The handle is deliberately quiet — an advisor who
  // never drags anything should not have to look at a row of controls — so the
  // affordance appears on hover and focus rather than sitting on the page.
  // Styles 3 and 4 are drafts: visible only once the advisor asks for them, and
  // the deck drops back to Light when they are put away, so a half-finished
  // style cannot be the one that gets printed by accident.
  const [showDrafts, setShowDrafts] = useState(false);
  const [dragId, setDragId] = useState(null);
  function moveSlide(from, to) {
    setSelected(v => {
      const order = orderSelection(v);
      if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return v;
      const next = [...order];
      next.splice(to, 0, ...next.splice(from, 1));
      return orderSelection(next);
    });
  }
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
  const ranked = [...holdings].sort((a, b) => b.value - a.value);
  const noteLines = contextLines(contextEntries);
  const deckOrder = orderSelection(selected);
  const slides = [
    { id: "cover", name: "Account review" },
    { id: "contents", name: "Contents" },
    ...deckOrder
      .map((id) => sections.find((s) => s.id === id))
      .filter(Boolean)
      .flatMap((s) =>
        s.id === "risk" && riskSnapshot ? [{...s, name:"Risk snapshot"}] : s.id === "risk" && supporting.risk ? Array.from({length: Math.ceil(supporting.risk.accounts.length / 2)}, (_, i) => ({...s, offset: i * 2, name: `Risk metrics${supporting.risk.accounts.length > 2 ? ` · ${i + 1}` : ""}`}))
        : s.id === "risk" ? []
        : s.id === "equity" && !equity ? []
        : s.id === "market-indexes" && !validMarketIndexes(marketIndexes) ? []
        : s.id === "fixed-income" && !fixedIncome?.indexes?.length ? []
        : s.id === "sector-ytd" && !sectorBoard?.indexes?.length ? []
        : s.id === "asset-class-performance" && !positionReturns ? []
        : s.id === "regional-attribution" && !attribution?.rows?.length ? []
        : s.id === "attribution" && supporting.attribution ? supporting.attribution.accounts.map((a, i) => ({...s, accountIndex: i, name: `Contribution · ${a.name}`}))
        : [s],
      ),
  ];
  slides.push(...snippetImages.map(image => ({id:`snippet-${image.id}`, name:image.title || 'Source image', snippet:image})));
  // The points typed into the context notebook close the deck.
  slides.push(...Array.from({length: Math.ceil(noteLines.length / 4)}, (_, i) => ({
    id: "notes", offset: i * 4,
    name: noteLines.length > 4 ? `For our conversation · ${i + 1}` : "For our conversation",
  })));
  useEffect(() => {
    if (page > slides.length - 1) setPage(Math.max(0, slides.length - 1));
  }, [slides.length, page]);

  // Arrow keys step through the deck while it is on screen. Typing in a field
  // has to keep its own arrow behaviour — the report date, the admin fields and
  // every slide title are inputs — so a keystroke aimed at one is left alone,
  // as is any modified key, which belongs to the browser.
  useEffect(() => {
    if (step !== 1) return;
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      if (el?.isContentEditable) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName || "")) return;
      const last = slides.length - 1;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); setPage((n) => Math.min(last, n + 1)); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); setPage((n) => Math.max(0, n - 1)); }
      else if (e.key === "Home") { e.preventDefault(); setPage(0); }
      else if (e.key === "End") { e.preventDefault(); setPage(last); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, slides.length]);
  const navigate = (n) => {
    setStep(n);
    setDone(false);
    setPage(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const parse = () => {
    // A paste that names its accounts ("Joint :" over its holdings, then
    // "Trust :" over theirs) builds those accounts, so the account slide works
    // without going through the multiple-accounts panel. A paste with no
    // headers is one portfolio, exactly as before.
    const blocks = hasNamedAccounts(text) ? splitAccountBlocks(text) : null;
    const parsed = blocks
      ? blocks.map(b => ({name: b.name, ...parseHoldings(b.text)}))
      : [{name: '', ...parseHoldings(text)}];
    const errors = parsed.flatMap(b =>
      b.errors.map(e => (b.name ? `${b.name} — ${e}` : e)));
    const totals = new Map();
    const positions = [];
    for (const block of parsed) {
      for (const holding of block.holdings) {
        totals.set(holding.ticker, (totals.get(holding.ticker) || 0) + holding.value);
        positions.push(block.name ? {...holding, account: block.name} : {...holding});
      }
    }
    const holdings = [...totals].map(([ticker, value]) => ({ticker, value}));
    setErrors(errors.length ? errors : holdings.length ? [] : ["Add at least one holding to continue."]);
    if (holdings.length && !errors.length) {
      setImportSource(blocks ? `Pasted holdings: ${blocks.map(b => b.name).join(', ')}` : "");
      setRiskSnapshot(null); setPositions(positions); setSupporting({}); setSupportError("");
      setHoldings(holdings);
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
      setSelected(AUTO_SLIDES);
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
    setSelected(AUTO_SLIDES);
    setTitle("Portfolio review");
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
  function slideContent(slide) {
    if (slide.snippet) return <SourceSnippetSlide data={slide.snippet}/>;
    if (slide.id === "equity") return <EquitySlide data={equity} />;
    if (slide.id === "cover")
      return (
        <div className="cover-content">
          <p className="eyebrow">ACCOUNT REVIEW</p>
          <h2>{preparedFor?.trim() || title || "Account review"}</h2>
          {preparedFor?.trim() && <p className="cover-client">Account review</p>}
          <div className="gold-rule" />
          <p className="cover-sub">
            {advisor ? `Presented by ${advisor}` : "Gottfried & Somberg Wealth Management"}
          </p>
          <span className="cover-date">
            {reportDate ? new Date(`${reportDate}T12:00:00`).toLocaleDateString("en-US", {month: "long", day: "numeric", year: "numeric"}) : ""}
          </span>
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
    "allocation": "ASSET ALLOCATION",
    "asset-class-performance": "ASSET CLASS PERFORMANCE",
    "admin": "ADMINISTRATIVE UPDATES",
    "equity": "EQUITY EXPOSURE",
    "risk": "RISK SNAPSHOT",
    "notes": "FOR OUR CONVERSATION",
  };
  // The file writes its as-of as a date a client would read. Navy keeps the ISO
  // stamp it already had; only the light deck spells it out.
  const longDate = (iso) => {
    const d = iso ? new Date(`${iso}T12:00:00`) : null;
    return d && !Number.isNaN(d.getTime())
      ? d.toLocaleDateString('en-US', {month: 'long', day: 'numeric', year: 'numeric'})
      : iso;
  };
  function navyContent(slide, editable) {
    const asOfLabel = themeOf(slideTheme).dark ? reportDate : longDate(reportDate);
    if (slide.snippet) return null;
    const label = NAVY_LABELS[slide.id];
    if (!label) return null;
    const positions = enrichedPositions;
    if (slide.id === "cover") {
      // Only the light deck was rebuilt on the Dwyer file's split cover; navy
      // keeps the cover it already had.
      const Cover = themeOf(slideTheme).dark ? NavyCoverClassic : NavyCover;
      return {label, body: <Cover title={title} preparedFor={preparedFor} advisor={advisor} reportDate={reportDate} total={total}/>};
    }
    if (slide.id === "account-summary")
      return {label, body: <NavyAccountSummary positions={positions} source={importSource} asOf={asOfLabel}/>};
    if (slide.id === "market-indexes")
      return {label, body: <NavyMarketIndexes data={marketIndexes}/>};
    if (slide.id === "contents")
      // The file groups its agenda into numbered sections across two columns;
      // navy keeps the single list it had.
      return {label, body: themeOf(slideTheme).dark
        ? <ContentsSlide slides={slides} navy/>
        : <DwyerContents slides={slides}/>};
    if (slide.id === "fixed-income")
      return {label, body: <NavyMarketIndexes data={fixedIncome} heading="Fixed income, year to date"
        title="What bonds did" note="Total returns, so coupon income is included. Bond market segments are shown through ETF proxies."/>};
    if (slide.id === "sector-ytd")
      return {label, body: <SectorYtdSlide data={sectorBoard} navy longDates={!themeOf(slideTheme).dark}/>};
    if (slide.id === "earnings-expectations")
      return {label, body: <EarningsExpectationsSlide data={supporting.earningsTable || SP500_EARNINGS} navy longDates={!themeOf(slideTheme).dark}/>};
    if (slide.id === "regional-attribution")
      return {label, body: <PositionAttributionSlide result={attribution} asOf={positionReturns?.asOf} source={positionReturns?.source} navy longDates={!themeOf(slideTheme).dark}/>};
    if (slide.id === "equity" && equity)
      return {label, body: <NavyEquity data={equity}/>};
    if (slide.id === "risk" && riskSnapshot)
      // The file's risk slide is a different arrangement, not the navy one
      // recoloured, so the light deck renders its own.
      return {label, body: themeOf(slideTheme).dark
        ? <NavyRisk s={riskSnapshot}/>
        : <DwyerRisk s={riskSnapshot}/>};
    if (slide.id === "notes")
      return {label, body: <DwyerDiscussion points={noteLines.slice(slide.offset, slide.offset + 4)}/>};
    if (slide.id === "allocation")
      return {label, body: <NavyAllocation positions={positions} asOf={asOfLabel} source={importSource}/>};
    if (slide.id === "asset-class-performance")
      return {label, body: <NavyAssetClassPerformance positions={positions} returns={positionReturns?.returns}
        asOf={positionReturns?.asOf} source={positionReturns?.source}/>};
    if (slide.id === "admin")
      return {label, body: <NavyAdmin admin={admin} edit={editable} onChange={setAdmin}/>};
    return null;
  }
  function renderSlide({ slide, index, editable }) {
    // These are the Dwyer slides: the spine, the promoted figure, the gold
    // rules. That design is not navy's alone, so both themes render it and the
    // palette is what changes — light serves it on white. The theme is on the
    // article, which is where slide-dwyer.css redefines the colours; the
    // components below are the same ones in either theme.
    const theme = themeOf(slideTheme);
    const dwyer = navyContent(slide, editable);
    if (dwyer)
      return (
        <article
          data-slide-theme={theme.dark ? "dark" : "light"}
          data-slide-style={slideTheme}
          className={[
            "slide", "navy-slide",
            theme.dark ? "" : "navy-light",
            theme.brand ? "brand-slide" : "",
            theme.brand && !theme.dark ? "brand-doc" : "",
            `slide-${slide.id}`,
            slide.id === "cover" ? "cover" : "",
          ].filter(Boolean).join(" ")}
        >
          <NavyFrame label={dwyer.label} page={String(index + 1).padStart(2, "0")} cover={slide.id === "cover"}>
            {dwyer.body}
          </NavyFrame>
        </article>
      );
    return (
      <article
        data-slide-theme={themeOf(slideTheme).dark ? "dark" : "light"}
        data-slide-style={slideTheme}
        className={`slide slide-${slide.id} ${slide.id === "cover" ? "cover" : ""}`}
      >
        <div className="slide-brand">
          <img src="/gswm-logo.png" alt=""/><div>GOTTFRIED & SOMBERG <span>WEALTH MANAGEMENT</span></div>
        </div>
        <div className="slide-body">{slideContent(slide)}</div>
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
          <button type="button" className="brand brand-home" title="Back to holdings"
            aria-label="Back to holdings" onClick={() => { if (step === 0 && reviewed) setReviewed(false); else navigate(0); }}>
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
              {multiAccount ? <MultiAccountImport
                onCancel={() => setMultiAccount(false)}
                onConfirm={(merged) => {
                  setRiskSnapshot(null);
                  setHoldings(merged.holdings);
                  setPositions(merged.positions);
                  setSupporting({}); setSupportError("");
                  setText(merged.holdings.map(h => `${h.ticker} ${h.value}`).join("\n"));
                  setImportSource(merged.source);
                  setMultiAccount(false);
                  setReviewed(true);
                  setSelected(AUTO_SLIDES);
                  setEquity(null); setEquityError(""); setErrors([]);
                }}/> : importBook ? <HoldingsImport book={importBook} onCancel={() => setImportBook(null)} onConfirm={(values, source, importedPositions) => {setRiskSnapshot(null);setHoldings(values);setPositions(importedPositions);setSupporting({});setSupportError("");setText(values.map(h => `${h.ticker} ${h.value}`).join("\n"));setImportSource(source);setImportBook(null);setReviewed(true);setSelected(AUTO_SLIDES);setEquity(null);setEquityError("");setErrors([]);}}/> : !reviewed ? (
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
                    {/* One file per account, for a client whose holdings arrive
                        as a file each rather than one book with an account
                        column. */}
                    <button className="upload-button" disabled={importBusy}
                      onClick={() => setMultiAccount(true)}>
                      <Layers size={16} /> Multiple accounts
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
                  <h1>
                    {done ? "Your deck is ready." : "Review your deck"}
                  </h1>
                  <p>
                    {done
                      ? "Save a PDF, or keep editing \u2014 nothing is locked."
                      : "Built from your holdings. Drag to reorder, remove what you do not need, add anything back."}
                  </p>
                </div>
              </div>
              {/* A preset is a starting point, not a mode: it sets which
                  slides are in the deck and in what order, and everything
                  after that is the list below. */}
              <div className="deck-presets" role="group" aria-label="Deck preset">
                {DECK_PRESETS.map((preset) => {
                  const current = presetOf(selected) === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={current ? "current" : ""}
                      aria-pressed={current}
                      title={preset.note}
                      onClick={() => { setSelected(preset.ids); setPage(0); }}
                    >
                      {preset.name}
                    </button>
                  );
                })}
                <span className="deck-preset-note">
                  {presetOf(selected)
                    ? DECK_PRESETS.find((preset) => preset.id === presetOf(selected)).note
                    : "Rearranged from a preset. Pick one again to start over."}
                </span>
              </div>
              <div className="preview-layout">
                <aside className="slide-list">
                  {slides.map((s, i) => {
                    // The cover and contents open every deck, so they are not
                    // draggable and have nothing to remove. A section slide
                    // moves by reordering `selected`; an image slide is removed
                    // from the images themselves.
                    const sectionId = sections.some((x) => x.id === s.id) ? s.id : null;
                    const snippetId = s.snippet?.id || null;
                    const movable = Boolean(sectionId);
                    return <div
                      key={`${s.id}${i}`}
                      className={`slide-row ${page === i ? "current" : ""} ${dragId && dragId === sectionId ? "is-dragging" : ""}`}
                      draggable={movable}
                      onDragStart={movable ? (e) => { setDragId(sectionId); e.dataTransfer.effectAllowed = "move"; } : undefined}
                      onDragEnd={movable ? () => setDragId(null) : undefined}
                      onDragOver={movable ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } : undefined}
                      onDrop={movable ? (e) => {
                        e.preventDefault();
                        moveSlide(deckOrder.indexOf(dragId), deckOrder.indexOf(sectionId));
                        setDragId(null);
                      } : undefined}
                    >
                      <button
                        aria-current={page === i ? "page" : undefined}
                        className="slide-row-open"
                        onClick={() => setPage(i)}
                      >
                        <span>{String(i + 1).padStart(2, "0")}</span>
                        <div>{s.name}</div>
                      </button>
                      {(sectionId || snippetId) && <span className="slide-row-tools">
                        {movable && <>
                          <button type="button" aria-label={`Move ${s.name} up`}
                            disabled={deckOrder.indexOf(sectionId) === 0}
                            onClick={() => moveSlide(deckOrder.indexOf(sectionId), deckOrder.indexOf(sectionId) - 1)}>↑</button>
                          <button type="button" aria-label={`Move ${s.name} down`}
                            disabled={deckOrder.indexOf(sectionId) === deckOrder.length - 1}
                            onClick={() => moveSlide(deckOrder.indexOf(sectionId), deckOrder.indexOf(sectionId) + 1)}>↓</button>
                        </>}
                        <button type="button" aria-label={`Remove ${s.name}`} onClick={() => {
                          if (sectionId) setSelected((v) => v.filter((x) => x !== sectionId));
                          else setSnippetImages((v) => v.filter((img) => img.id !== snippetId));
                        }}><X size={13}/></button>
                      </span>}
                    </div>;
                  })}
                  {/* Adding a slide back belongs here too: this is where the
                      deck is actually being read, so removing something and
                      wanting it again should not mean going back a step. */}
                  {sections.filter((x) => !selected.includes(x.id)).length > 0 && <div className="slide-list-add">
                    {sections.filter((x) => !selected.includes(x.id)).map((x) => (
                      <button key={x.id} type="button" onClick={() => setSelected((v) => [...v, x.id])}>
                        <Plus size={12}/> {x.name}
                      </button>
                    ))}
                  </div>}
                </aside>
                <div className="preview-stage">
                  <SlideFrame>{renderSlide({ slide: slides[page], index: page, editable: true })}</SlideFrame>
                  <div className="preview-controls">
                    <span>
                      {page + 1} / {slides.length}
                    </span>
                    <div className="theme-toggle" role="group" aria-label="Slide theme">
                      {SLIDE_THEMES.filter((o) => !o.brand || showDrafts).map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          className={`${slideTheme === option.id ? "current" : ""} ${option.brand ? "is-draft" : ""}`}
                          aria-pressed={slideTheme === option.id}
                          onClick={() => setSlideTheme(option.id)}
                          title={option.brand ? "In progress: brand guide palette and type" : "Dwyer template"}
                        >
                          {option.dark ? <Moon size={13} /> : <Sun size={13} />}
                          {option.label}
                        </button>
                      ))}
                      {/* The two brand styles are still being worked on, so they
                          are not offered alongside the two finished ones. This
                          opens them without announcing them. */}
                      <button
                        type="button"
                        className="draft-reveal"
                        aria-expanded={showDrafts}
                        aria-label={showDrafts ? "Hide draft styles" : "Show draft styles"}
                        onClick={() => { if (showDrafts && themeOf(slideTheme).brand) setSlideTheme(DEFAULT_THEME); setShowDrafts((v) => !v); }}
                      >
                        {showDrafts ? "\u00d7" : "\u22ef"}
                      </button>
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
                  {/* The deck's own details belong with the cover, not in a
                      form on a step that no longer exists. The strip appears
                      under the preview while the cover is the slide on screen,
                      so the line being typed is the line being watched. */}
                  {slides[page]?.id === "cover" && (
                    <div className="cover-fields">
                      <label><span>Prepared for</span>
                        <input id="cover-client" maxLength={80} placeholder="Client name" value={preparedFor} onChange={(e) => setPreparedFor(e.target.value)}/></label>
                      <label><span>Deck title</span>
                        <input id="cover-title" maxLength={65} placeholder="Portfolio review" value={title} onChange={(e) => setTitle(e.target.value)}/></label>
                      <label><span>Advisor</span>
                        <input id="cover-advisor" maxLength={80} placeholder="Presented by" value={advisor} onChange={(e) => setAdvisor(e.target.value)}/></label>
                      <label><span>Report date</span>
                        <input id="cover-date" type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)}/></label>
                    </div>
                  )}
                </div>
              </div>
              {/* The inputs sit under the deck they change, where the slide
                  they feed is in view. There is no step that asks what to
                  build any more, so this is the only place they can live. */}
              <section className="studio-panels" aria-label="Deck inputs">
                <details className="data-drawer source-drawer" open>
                  <summary><span>Files &amp; source images</span><small>{snippetImages.length ? `${snippetImages.length} images` : "Optional"}</small><ChevronRight size={16}/></summary>
                  <section className="supporting-upload">
                    <p>Add screenshots and report snippets. Each image becomes its own slide. Give it a context sentence and the slide leads with your point, with the image as support.</p>
                    <SourceSnippets images={snippetImages} onChange={setSnippetImages}/>
                    {/* A few sentences about the meeting, kept next to the
                        images because both are the advisor's own material
                        rather than fetched data. */}
                    <ContextChat
                      entries={contextEntries}
                      onChange={setContextEntries}
                      deckContext={{title, preparedFor, advisor, reportDate, holdings, total, slides: slides.map(s => s.name)}}
                    />
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
                      <p className="helper">{benchmark.loading && !benchmark.snapshot ? "Loading the daily benchmark…" : benchmark.snapshot ? `IVV equity proxy · As of ${benchmark.snapshot.asOf}` : "Benchmark unavailable. Retry, or import sector data."}</p>
                      {comparison && !importedEquity && <p className="coverage-note">{comparison.coverage.toFixed(1)}% of portfolio classified</p>}
                      {comparison?.unmatched.length > 0 && !importedEquity && <p className="helper">Sector data needed for {comparison.unmatched.map(h => h.ticker).join(", ")}. Until it resolves the equity slide is left out: ETF look-through and unknown sectors are never guessed.</p>}
                      {benchmark.snapshot && isBenchmarkStale(benchmark.snapshot) && !importedEquity && <p className="errors">This benchmark is older than four days. Refresh, or import a current sector file.</p>}
                      <div className="flex gap-3 flex-wrap">
                        <button className="secondary" disabled={benchmark.loading} onClick={benchmark.refresh}>Refresh benchmark</button>
                        <button className="secondary" onClick={() => equityFile.current.click()}><Upload size={14}/> Import sector data</button>
                        <button className="text-button" onClick={async () => {
                          try {
                            const response = await fetch("/example-sectors.json");
                            if (!response.ok) throw Error("The example sector file could not be loaded.");
                            setEquity(validateEquity(await response.json()));
                            setEquityError("");
                          } catch (error) { setEquityError(error.message || "The example sector file could not be loaded."); }
                        }}>Load example sectors</button>
                        <button className="text-button" onClick={() => setShowExample(true)}>Layout example</button>
                        {importedEquity && <button className="text-button" onClick={() => setEquity(null)}>Use daily benchmark</button>}
                      </div>
                      <input className="hidden" ref={equityFile} type="file" accept=".json" onChange={(e) => {uploadEquity(e.target.files[0]);e.target.value="";}}/>
                      {equity && <p className="live-status"><Check size={15}/> {importedEquity ? "Imported sector data" : "Portfolio comparison ready"} · {equity.as_of}</p>}
                      {benchmark.error && !importedEquity && <p className="errors" role="alert">{benchmark.error}</p>}
                      {equityError && <p className="errors" role="alert">{equityError}</p>}
                    </details>
                  </section>
                </details>
                <details className="data-drawer">
                  <summary><span>Market data</span><small>{marketLoading ? "Refreshing…" : marketIndexes.asOf ? `Through ${marketIndexes.asOf}` : "Not loaded"}{marketError ? " · Refresh issue" : ""}</small><ChevronRight size={16}/></summary>
                  <MarketIndexesEditor data={marketIndexes} onChange={setMarketIndexes} onRefresh={refreshMarketIndexes} loading={marketLoading} error={marketError}/>
                </details>
              </section>
              {/* The snapshot builds itself from the holdings, and stays mounted
                  so moving between panels cannot remount it and refire the
                  price-history fetch. When it fails the slide is simply absent. */}
              <div className="hidden">
                <RiskSnapshotStatus holdings={holdings} positions={enrichedPositions} benchmark={benchmark.snapshot} asOf={reportDate} client={preparedFor} data={riskSnapshot} onChange={setRiskSnapshot} onStatus={setRiskStatus}/>
              </div>
              <div className="finish-row">
                <p>
                  <ShieldCheck size={15} /> Prepared from your provided
                  holdings.
                </p>
                {done ? (
                  <div className="flex items-center gap-3">
                    <span className="saved-as">
                      Saves as <strong>{savedDeckName}.pdf</strong>
                    </span>
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
              {renderSlide({ slide: s, index: i })}
            </React.Fragment>
          ))}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
