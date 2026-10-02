import React, { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { CONTEXT_LIMIT, contextEntry, sendContext } from './context-chat';

export default function ContextChat({ entries, onChange, deckContext }) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const transcript = useRef(null);
  useEffect(() => {
    const element = transcript.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [entries.length]);
  async function submit(event) {
    event.preventDefault();
    const entry = contextEntry(draft);
    if (!entry) return;
    const next = [...entries, entry];
    onChange(next);
    setDraft('');
    setError('');
    setBusy(true);
    try {
      const { reply } = (await sendContext(entry.text, deckContext)) || {};
      const answer = reply && contextEntry(reply, 'assistant');
      if (answer) onChange([...next, answer]);
    } catch (problem) {
      setError(problem.message || 'That note could not be sent.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="context-chat">
      <p className="helper">
        Tell the deck what this meeting is about. Each point you add becomes a line on the
        closing discussion slide. Nothing is sent anywhere.
      </p>
      <div className="context-transcript" ref={transcript} aria-live="polite">
        {entries.length === 0 ? (
          <p className="context-empty">
            No context yet. &ldquo;Revisit the muni ladder&rdquo;, &ldquo;client asked about
            the tech weight&rdquo; &mdash; whatever you want on the page.
          </p>
        ) : (
          entries.map((entry, index) => (
            <div key={entry.id} className={`context-line is-${entry.role}`}>
              {entry.role === 'user' && (
                <span className="context-index">{String(index + 1).padStart(2, '0')}</span>
              )}
              <p>{entry.text}</p>
              {entry.role === 'user' && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove context point ${index + 1}`}
                  onClick={() => onChange(entries.filter(e => e.id !== entry.id))}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
      <form className="context-composer" onSubmit={submit}>
        <label className="sr-only" htmlFor="context-draft">Discussion point</label>
        <input
          id="context-draft"
          value={draft}
          maxLength={CONTEXT_LIMIT}
          placeholder="Add a discussion point…"
          onChange={event => setDraft(event.target.value)}
        />
        <button className="primary" type="submit" disabled={busy || !draft.trim()}>
          <Send size={15} /> Add
        </button>
      </form>
      {error && <p className="errors" role="alert">{error}</p>}
    </section>
  );
}
