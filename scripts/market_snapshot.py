#!/usr/bin/env python3
"""Build a dated market snapshot with yfinance, in the shape /api/market/ytd returns.

The app fetches Yahoo's chart API directly from its server. That works from a
desktop, but Yahoo blocks most datacentre addresses, so the same request from a
deployed worker is refused and every market slide drops out of the deck. This
writes the same figures to a file the app can fall back on, so a deck built
anywhere still carries market context, dated and attributed rather than
silently stale.

    python scripts/market_snapshot.py                     # the three boards
    python scripts/market_snapshot.py --symbols IVV,AGG   # plus position returns
    python scripts/market_snapshot.py --out somewhere.json

The year-to-date basis is the one the app's own parser uses: the last adjusted
close of the prior year against the latest adjusted close of this one, so a
snapshot and a live refresh cannot disagree about what "year to date" means.
"""
import argparse
import json
import math
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = ROOT / "public" / "market-snapshot.json"

# Kept in step with src/market-indexes.js by src/market-boards.test.js, which
# reads this table and fails if the two lists ever drift apart.
BOARDS = {
    "indexes": {
        "source": "Yahoo Finance historical chart data; EEM and EFA are ETF proxies for MSCI benchmarks.",
        "basis": "YTD from prior year-end close. Price returns for indexes; adjusted-close returns for ETF proxies",
        "definitions": [
            {"id": "sp500", "symbol": "^GSPC", "label": "S&P 500", "region": "U.S. large cap", "proxy": False},
            {"id": "nasdaq", "symbol": "^IXIC", "label": "Nasdaq Composite", "region": "U.S. growth", "proxy": False},
            {"id": "emerging", "symbol": "EEM", "label": "MSCI Emerging Markets", "region": "Emerging markets", "proxy": True},
            {"id": "msci", "symbol": "EFA", "label": "MSCI EAFE", "region": "International developed", "proxy": True},
        ],
    },
    "fixed-income": {
        "source": "Yahoo Finance historical chart data. AGG, IEF, LQD and MUB are ETF proxies for their bond market segments.",
        "basis": "YTD from prior year-end close. Adjusted-close total returns, so coupon income is included",
        "definitions": [
            {"id": "aggregate", "symbol": "AGG", "label": "U.S. Aggregate Bond", "region": "Core taxable", "proxy": True},
            {"id": "treasury", "symbol": "IEF", "label": "7-10 Year Treasury", "region": "Treasuries", "proxy": True},
            {"id": "corporate", "symbol": "LQD", "label": "Investment Grade Corporate", "region": "Corporate credit", "proxy": True},
            {"id": "municipal", "symbol": "MUB", "label": "Municipal Bond", "region": "Municipals", "proxy": True},
        ],
    },
    "sectors": {
        "source": "Yahoo Finance historical chart data. The Select Sector SPDR funds are proxies for the eleven S&P 500 GICS sectors.",
        "basis": "YTD from prior year-end close. Adjusted-close total returns, so distributions are included",
        "definitions": [
            {"id": "materials", "symbol": "XLB", "label": "Materials", "region": "Materials", "proxy": True},
            {"id": "discretionary", "symbol": "XLY", "label": "Cons. Disc.", "region": "Consumer Discretionary", "proxy": True},
            {"id": "financials", "symbol": "XLF", "label": "Financials", "region": "Financials", "proxy": True},
            {"id": "realestate", "symbol": "XLRE", "label": "Real Estate", "region": "Real Estate", "proxy": True},
            {"id": "communication", "symbol": "XLC", "label": "Comm. Services", "region": "Communication Services", "proxy": True},
            {"id": "energy", "symbol": "XLE", "label": "Energy", "region": "Energy", "proxy": True},
            {"id": "industrials", "symbol": "XLI", "label": "Industrials", "region": "Industrials", "proxy": True},
            {"id": "technology", "symbol": "XLK", "label": "Info. Tech", "region": "Information Technology", "proxy": True},
            {"id": "staples", "symbol": "XLP", "label": "Cons. Staples", "region": "Consumer Staples", "proxy": True},
            {"id": "healthcare", "symbol": "XLV", "label": "Health Care", "region": "Health Care", "proxy": True},
            {"id": "utilities", "symbol": "XLU", "label": "Utilities", "region": "Utilities", "proxy": True},
        ],
    },
}

SYMBOL = re.compile(r"^[A-Z^][A-Z0-9.^-]{0,14}$")


def year_to_date(series, year):
    """(return %, start date, end date, points) on the app's own basis.

    `series` is [(iso date, adjusted close)] in ascending order. The base is the
    last close before 1 January, which is what makes this a year-to-date figure
    rather than a first-trading-day one.
    """
    priors = [p for p in series if p[0] < f"{year}-01-01" and p[1] > 0]
    current = [p for p in series if f"{year}-01-01" <= p[0] < f"{year + 1}-01-01" and p[1] > 0]
    if not priors or not current:
        raise ValueError("missing the prior year-end close or any close in the current year")
    base = priors[-1]
    last = current[-1]
    points = [
        {"date": date, "return": (value / base[1] - 1) * 100}
        for date, value in [base, *current]
    ]
    return (last[1] / base[1] - 1) * 100, base[0], last[0], points


def history(symbol, year):
    """Adjusted closes from the November before the year start until today."""
    import yfinance

    frame = yfinance.Ticker(symbol).history(
        start=f"{year - 1}-11-01", interval="1d", auto_adjust=True, raise_errors=True
    )
    if frame is None or frame.empty:
        raise ValueError(f"Yahoo Finance returned no history for {symbol}")
    out = []
    for stamp, close in frame["Close"].items():
        value = float(close)
        if math.isfinite(value) and value > 0:
            out.append((stamp.strftime("%Y-%m-%d"), value))
    return out


def build_board(key, board, year, fetch=history):
    indexes, failures = [], []
    for definition in board["definitions"]:
        try:
            value, start, end, points = year_to_date(fetch(definition["symbol"], year), year)
        except Exception as problem:            # one symbol must not lose the board
            failures.append(f"{definition['symbol']}: {problem}")
            continue
        indexes.append({**definition, "return": value, "startDate": start, "endDate": end, "points": points})
    # A board is published whole or not at all: a sector chart missing three of
    # its eleven bars is worse than a slide that stays out of the deck.
    if len(indexes) != len(board["definitions"]):
        raise ValueError(f"{key}: {len(board['definitions']) - len(indexes)} of "
                         f"{len(board['definitions'])} symbols failed. " + "; ".join(failures))
    return {
        "asOf": max(index["endDate"] for index in indexes),
        "board": key,
        "source": board["source"],
        "basis": board["basis"],
        "indexes": indexes,
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
    }


def build(symbols=(), year=None, fetch=history):
    year = year or datetime.now(timezone.utc).year
    snapshot = {"generated": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
                "year": year, "boards": {}}
    for key, board in BOARDS.items():
        snapshot["boards"][key] = build_board(key, board, year, fetch)
    if symbols:
        definitions = [{"id": s, "symbol": s, "label": s, "region": "Position", "proxy": False} for s in symbols]
        snapshot["boards"]["symbols"] = build_board(
            "symbols", {"source": "Yahoo Finance historical chart data, by position.",
                        "basis": "YTD from prior year-end close, adjusted closes",
                        "definitions": definitions}, year, fetch)
    return snapshot


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--symbols", default="", help="comma separated tickers to price as well as the boards")
    parser.add_argument("--out", default=str(DEFAULT_OUT), help=f"where to write (default {DEFAULT_OUT})")
    parser.add_argument("--year", type=int, default=None, help="the year to measure (default: this one)")
    args = parser.parse_args(argv)

    symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
    bad = [s for s in symbols if not SYMBOL.match(s)]
    if bad:
        parser.error(f"not tickers: {', '.join(bad)}")

    try:
        snapshot = build(symbols[:60], args.year)
    except Exception as problem:
        # Leave whatever is already on disk alone: a dated snapshot beats none.
        print(f"Market snapshot failed, the existing file is untouched: {problem}", file=sys.stderr)
        return 1

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(snapshot, indent=1), encoding="utf-8")
    for key, board in snapshot["boards"].items():
        print(f"{key:13} {len(board['indexes']):2} symbols  as of {board['asOf']}")
    print(f"written to {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
