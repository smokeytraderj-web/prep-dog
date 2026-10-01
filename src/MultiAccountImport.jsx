import React, {useRef, useState} from 'react';
import {Upload, X, Check, Plus, FileSpreadsheet} from 'lucide-react';
import {detectTable, extractHoldings, textToSheets} from './holding-import.js';
import {accountErrors, mergeAccounts, MIN_ACCOUNTS, MAX_ACCOUNTS} from './multi-account.js';
import {parseHoldings} from './holdings.js';

const usd = n => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(n);

const blank = () => ({id: crypto.randomUUID(), name: '', mode: 'file', text: '', fileName: '', positions: [], holdings: [], errors: [], busy: false});

// One file per account, each named by the advisor. The columns are detected the
// same way the single-file import detects them; what is different is that the
// account is the name typed here rather than a column, because the reason to
// use this is that the files do not carry a usable account of their own.
export default function MultiAccountImport({onConfirm, onCancel}) {
  const [rows, setRows] = useState([blank(), blank()]);
  const inputs = useRef({});

  const patch = (id, next) => setRows(list => list.map(r => (r.id === id ? {...r, ...next} : r)));

  async function readFile(id, file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      patch(id, {errors: ['Choose a file smaller than 5 MB.'], positions: [], holdings: [], fileName: file.name});
      return;
    }
    patch(id, {busy: true, errors: [], fileName: file.name});
    try {
      let sheets;
      if (/\.xlsx$/i.test(file.name)) {
        const {default: readWorkbook} = await import('read-excel-file/browser');
        sheets = await readWorkbook(file);
      } else sheets = textToSheets(await file.text(), 'Holdings');
      if (!sheets.length || sheets.every(s => !s.data.length)) throw Error('Empty workbook');
      // The sheet that scores best, the same choice the single-file review opens on.
      const mappings = sheets.map(s => detectTable(s.data));
      const best = mappings.reduce((a, m, i) => (m.score > mappings[a].score ? i : a), 0);
      const result = extractHoldings(sheets[best].data, mappings[best]);
      if (!result.positions?.length) {
        throw Error('No priced positions were found in this file. Use the single-file import to map its columns.');
      }
      patch(id, {
        busy: false,
        positions: result.positions,
        holdings: result.holdings,
        errors: result.errors.slice(0, 3),
      });
    } catch (error) {
      patch(id, {
        busy: false, positions: [], holdings: [],
        errors: [error.message || 'This file could not be read. Use an unprotected .xlsx, CSV, TSV or text file.'],
      });
    }
  }

  function readPaste(id, text) {
    if (!text.trim()) {
      patch(id, {text, positions: [], holdings: [], errors: []});
      return;
    }
    const {holdings, errors} = parseHoldings(text);
    patch(id, {
      text,
      holdings,
      // Ticker and value only; asset class and region are filled in from the
      // fund table afterwards, exactly as a pasted single portfolio is.
      positions: holdings.map(h => ({ticker: h.ticker, value: h.value})),
      errors: errors.slice(0, 3),
    });
  }

  const merged = mergeAccounts(rows);
  const problems = accountErrors(rows);
  const rowErrors = rows.some(r => r.errors.length);
  const total = merged.positions.reduce((n, p) => n + p.value, 0);

  return <section className="import-review multi-import">
    <div className="import-heading">
      <div>
        <span className="section-kicker"><FileSpreadsheet size={16}/> MULTIPLE ACCOUNTS</span>
        <h2>One file per account</h2>
        <p>Name each account, then attach its file or paste its holdings. The name you type is what the deck groups by, so a file with no account column, or the custodian's own number, is fine. Between {MIN_ACCOUNTS} and {MAX_ACCOUNTS} accounts.</p>
      </div>
      <button className="icon-button" onClick={onCancel} aria-label="Cancel multiple account import"><X size={19}/></button>
    </div>

    <ol className="account-rows">
      {rows.map((row, i) => <li key={row.id} className="account-row">
        <span className="account-no">{String(i + 1).padStart(2, '0')}</span>
        <label className="field-label">Account name
          <input maxLength={60} value={row.name} placeholder="Joint Taxable"
            onChange={e => patch(row.id, {name: e.target.value})}/>
        </label>
        <div className="account-file">
          <div className="account-mode" role="group" aria-label={`How account ${i + 1} is supplied`}>
            <button type="button" className={row.mode === 'file' ? 'current' : ''}
              onClick={() => patch(row.id, {mode: 'file', text: '', positions: [], holdings: [], errors: []})}>File</button>
            <button type="button" className={row.mode === 'paste' ? 'current' : ''}
              onClick={() => patch(row.id, {mode: 'paste', fileName: '', positions: [], holdings: [], errors: []})}>Paste</button>
          </div>
          {row.mode === 'paste'
            ? <textarea className="account-paste" rows={3} spellCheck="false"
                placeholder={'IVV 420000\nAAPL 95000'}
                value={row.text}
                onChange={e => readPaste(row.id, e.target.value)}/>
            : <>
                <button type="button" className="secondary" disabled={row.busy}
                  onClick={() => inputs.current[row.id]?.click()}>
                  <Upload size={14}/> {row.busy ? 'Reading…' : row.fileName ? 'Replace file' : 'Choose file'}
                </button>
                <input ref={el => {inputs.current[row.id] = el;}} className="hidden" type="file"
                  accept=".xlsx,.csv,.tsv,.txt"
                  onChange={e => {readFile(row.id, e.target.files[0]); e.target.value = '';}}/>
              </>}
          {row.fileName && <small>{row.fileName}</small>}
          {row.positions.length > 0 && <small className="account-ok">
            {row.positions.length} positions · {usd(row.positions.reduce((n, p) => n + p.value, 0))}
          </small>}
          {row.errors.map(e => <small key={e} className="account-bad">{e}</small>)}
        </div>
        <button type="button" className="icon-button" aria-label={`Remove account ${i + 1}`}
          disabled={rows.length <= MIN_ACCOUNTS}
          onClick={() => setRows(list => list.filter(r => r.id !== row.id))}><X size={16}/></button>
      </li>)}
    </ol>

    {rows.length < MAX_ACCOUNTS && <button type="button" className="text-button add-account"
      onClick={() => setRows(list => [...list, blank()])}>
      <Plus size={14}/> Add another account
    </button>}

    {problems.length > 0 && <div className="errors" role="alert">{problems.map(p => <p key={p}>{p}</p>)}</div>}

    <div className="import-result">
      <div>
        <strong>{merged.positions.length} positions · {usd(total)}</strong>
        <p>{merged.accounts.length} accounts. A security held in more than one account counts once in the portfolio total and stays separate on the account slide.</p>
      </div>
      <button className="primary" disabled={problems.length > 0 || rowErrors || !merged.positions.length}
        onClick={() => onConfirm(merged)}>
        <Check size={16}/> Use these accounts
      </button>
    </div>
  </section>;
}
