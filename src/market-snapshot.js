// The saved market snapshot, written by scripts/market_snapshot.py.
//
// The app asks Yahoo for its figures server-side, which works from a desktop
// and is refused from most datacentre addresses -- so the same deck built from
// a deployed worker loses every market slide. This reads the file the script
// leaves behind and serves the board from it instead. It is never a substitute
// for a live refresh: the board it returns carries the date it was taken and a
// warning the panel shows, so a saved figure can never pass as today's.

export const SNAPSHOT_PATH = '/market-snapshot.json';

const SYMBOLS_BOARD = 'symbols';

export function boardFromSnapshot(snapshot, boardKey, symbols = []) {
  const saved = snapshot?.boards?.[symbols.length ? SYMBOLS_BOARD : boardKey];
  if (!saved?.indexes?.length) return null;
  if (!symbols.length) return withWarning(saved);
  // A position board is only usable when it prices every holding asked for;
  // a partial one would quietly drop positions from attribution.
  const wanted = symbols.map(s => s.toUpperCase());
  const held = new Map(saved.indexes.map(index => [String(index.symbol).toUpperCase(), index]));
  if (!wanted.every(symbol => held.has(symbol))) return null;
  return withWarning({...saved, indexes: wanted.map(symbol => held.get(symbol))});
}

function withWarning(board) {
  return {
    ...board,
    delivery: 'snapshot',
    warning: `Live market data was unavailable, so these figures come from the saved snapshot taken ${board.asOf}. Refresh before the meeting to use today's.`,
  };
}

// The board key and symbol list the app asked the live service for.
export function requestedBoard(path) {
  const query = path.slice(path.indexOf('?') + 1);
  const params = new URLSearchParams(path.includes('?') ? query : '');
  const symbols = (params.get('symbols') || '').split(',').map(s => s.trim()).filter(Boolean);
  return {board: params.get('board') || 'indexes', symbols};
}
