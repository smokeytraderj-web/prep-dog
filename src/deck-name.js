// The saved PDF is a client file, so it is named like one: who it is for, that
// it is a review, then the date it covers. Browsers take the print filename
// from document.title, so that is the only lever we have — there is no API to
// set it directly, which is why this builds a title rather than a filename.

// Characters that are illegal or awkward in a filename on at least one of
// Windows, macOS and Linux. The browser would substitute or drop them, so we
// do it ourselves and keep the result predictable.
const UNSAFE = /[\\/:*?"<>|\u0000-\u001f]+/g;

export function cleanName(value) {
  return String(value ?? '')
    .replace(UNSAFE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');
}

// An ISO date sorts correctly in a folder of past reviews, which a "October 1,
// 2026" label does not. A date we cannot parse is dropped rather than guessed.
export function reviewDate(value) {
  const text = cleanName(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  // Date() rolls an out-of-range day forward: "2026-02-30" silently becomes
  // March 2nd. A client file must not be dated a day the user never chose, so
  // the parse only counts if it round-trips to the same calendar date.
  const parsed = new Date(`${text}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10) === text ? text : '';
}

// "Jane Smith Review 2026-10-01". Without a client the deck is not yet
// personalized, so it falls back to "Account Review" and keeps the date.
export function deckName(preparedFor, reportDate) {
  const client = cleanName(preparedFor);
  const date = reviewDate(reportDate);
  return [client || 'Account', 'Review', date].filter(Boolean).join(' ');
}
