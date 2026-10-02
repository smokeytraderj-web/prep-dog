// The context chat is local. Nothing leaves the browser, so the promise the
// holdings screen makes still holds, and `sendContext` is the single seam an
// AI backend would take over: give it a reply and the transcript renders one,
// leave it null and the composer simply records what the advisor typed.
export const CONTEXT_LIMIT = 600;

export function contextEntry(text, role = 'user') {
  const clean = String(text || '').trim().replace(/\s+/g, ' ').slice(0, CONTEXT_LIMIT);
  if (!clean) return null;
  const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  return {id, role, text: clean};
}

// Returns {reply} -- a string to add to the transcript, or null for none.
// A server-backed version would post `text` plus `context` and return the
// model's answer here; the component needs no other change.
export async function sendContext(text, context) {  // eslint-disable-line no-unused-vars
  return {reply: null};
}

export function contextLines(entries, width = 140) {
  return entries
    .filter(entry => entry.role === 'user')
    .flatMap(entry => entry.text.match(new RegExp(`.{1,${width}}(?:\\s|$)|.{1,${width}}`, 'g')) || [])
    .map(line => line.trim())
    .filter(Boolean);
}
