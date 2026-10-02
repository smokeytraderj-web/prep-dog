#!/usr/bin/env python3
"""Checks the snapshot's year-to-date basis and its all-or-nothing rule.

Run: python scripts/market_snapshot_test.py
The network is never touched: prices are supplied, so what is under test is the
arithmetic the deck's figures come from.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from market_snapshot import BOARDS, build_board, year_to_date  # noqa: E402

failures = []


def check(name, condition, detail=""):
    print(f"{'ok  ' if condition else 'FAIL'} {name}{'' if condition else '  ' + detail}")
    if not condition:
        failures.append(name)


series = [
    ("2025-12-29", 100.0),
    ("2025-12-31", 200.0),   # the base: the last close of the prior year
    ("2026-01-02", 210.0),
    ("2026-06-30", 190.0),
    ("2026-10-02", 250.0),   # the latest close
]
value, start, end, points = year_to_date(series, 2026)
check("measures from the prior year-end close, not the first day of January",
      round(value, 6) == 25.0, f"got {value}")
check("reports the dates it measured between", (start, end) == ("2025-12-31", "2026-10-02"), f"got {start}..{end}")
check("the first point is the base, at zero", points[0] == {"date": "2025-12-31", "return": 0.0}, f"got {points[0]}")
check("a point mid-year carries its own return", round(points[2]["return"], 6) == -5.0, f"got {points[2]}")
check("next year's closes are not counted",
      len(year_to_date([*series, ("2027-01-04", 999.0)], 2026)[3]) == len(points))

for bad, why in [([("2026-01-02", 10.0)], "no prior year-end close"),
                 ([("2025-12-31", 10.0)], "no close in the current year"),
                 ([("2025-12-31", 0.0), ("2026-01-02", 10.0)], "a zero close cannot be a base")]:
    try:
        year_to_date(bad, 2026)
        check(f"refuses a series with {why}", False, "it returned a figure instead")
    except ValueError:
        check(f"refuses a series with {why}", True)

# A board publishes whole or not at all.
good = {"2025-12-31": 100.0, "2026-10-02": 110.0}
fetch_ok = lambda symbol, year: list(good.items())


def fetch_one_broken(symbol, year):
    if symbol == "XLE":
        raise ValueError("delisted")
    return list(good.items())


board = build_board("indexes", BOARDS["indexes"], 2026, fetch_ok)
check("a complete board carries every symbol", len(board["indexes"]) == 4, f"got {len(board['indexes'])}")
check("the board's as-of is the latest close it holds", board["asOf"] == "2026-10-02", board["asOf"])
check("the board carries its source and basis", bool(board["source"] and board["basis"]))
try:
    build_board("sectors", BOARDS["sectors"], 2026, fetch_one_broken)
    check("a board with a missing symbol is refused, not published short", False, "it published anyway")
except ValueError as problem:
    check("a board with a missing symbol is refused, not published short", "XLE" in str(problem))

print(f"\n{len(failures)} failed" if failures else "\nall passed")
sys.exit(1 if failures else 0)
