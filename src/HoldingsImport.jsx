import React,{useState} from 'react';
import {FileSpreadsheet,Check, X} from 'lucide-react';
import {detectTable,extractHoldings} from './holding-import.js';
import {totalValue} from './holdings.js';
const usd=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
export default function HoldingsImport({book,onConfirm,onCancel}) {
 const initial=book.sheets.map(s=>detectTable(s.data));
 const best=initial.reduce((a,v,i)=>v.score>initial[a].score?i:a,0);
 const [sheetIndex,setSheetIndex]=useState(best),[mapping,setMapping]=useState(initial[best]);
 const sheet=book.sheets[sheetIndex],headers=sheet.data[mapping.header]||[];
 const result=extractHoldings(sheet.data,mapping);
 const update=(key,value)=>setMapping(m=>({...m,[key]:value}));
 const column=(key,label)=><label className="field-label">{label}<select value={mapping[key]} onChange={e=>update(key,Number(e.target.value))}><option value={-1}>Not included</option>{headers.map((h,i)=><option key={i} value={i}>{String(h||`Column ${i+1}`).slice(0,60)}</option>)}</select></label>;
 return <section className="import-review">
  <div className="import-heading"><div><span className="section-kicker"><FileSpreadsheet size={16}/> FILE IMPORT</span><h2>Confirm your holdings</h2><p>{book.name}</p></div><button className="icon-button" onClick={onCancel} aria-label="Cancel file import"><X size={19}/></button></div>
  <div className="import-mapping">
   <label className="field-label">Worksheet<select value={sheetIndex} onChange={e=>{const i=Number(e.target.value);setSheetIndex(i);setMapping(detectTable(book.sheets[i].data));}}>{book.sheets.map((s,i)=><option key={i} value={i}>{s.sheet}</option>)}</select></label>
   <label className="field-label">Header row<input type="number" min="1" max={sheet.data.length} value={mapping.header+1} onChange={e=>{const header=Math.max(0,Number(e.target.value)-1);setMapping({...detectTable(sheet.data.slice(header)),header});}}/></label>
   {column('ticker','Ticker / symbol')}
   <label className="field-label">Position value<select value={mapping.mode} onChange={e=>update('mode',e.target.value)}><option value="value">Use market value column</option><option value="quantity">Calculate quantity × price</option></select></label>
   {mapping.mode==='value'?column('value','Market value (USD)'):<>{column('quantity','Quantity / shares')}{column('price','Unit price (USD)')}</>}
   {column('account','Account (optional)')}{column('assetClass','Asset class (optional)')}{column('securityName','Security name (optional)')}
   {column('region','Region / geography (optional)')}
   {mapping.currency>=0&&column('currency','Currency')}
  </div>
  <p className="import-method">{mapping.mode==='value'?'Uses the total value of each position. Share price and cost basis are not position values.':'Calculates position value from quantity × unit price. Confirm both are in the same units and USD.'}</p>
  <div className="import-raw"><table><thead><tr>{headers.map((h,i)=><th key={i}>{String(h||`Column ${i+1}`)}</th>)}</tr></thead><tbody>{sheet.data.slice(mapping.header+1,mapping.header+5).map((r,i)=><tr key={i}>{headers.map((_,j)=><td key={j}>{String(r[j]??'')}</td>)}</tr>)}</tbody></table></div>
  {result.errors.length>0&&<div className="errors" role="alert">{result.errors.slice(0,5).map(e=><p key={e}>{e}</p>)}{result.errors.length>5&&<p>{result.errors.length-5} more rows need correction.</p>}</div>}
  {result.skipped.length>0&&<details className="import-skipped"><summary>{result.skipped.length} summary or zero-value rows excluded</summary>{result.skipped.map(s=><p key={s}>{s}</p>)}</details>}
  <div className="import-result"><div><strong>{result.holdings.length} positions · {usd(totalValue(result.holdings))}</strong><p>{result.sourceRows} source rows; repeated tickers are combined.</p></div><button className="primary" disabled={!result.holdings.length||!!result.errors.length} onClick={()=>onConfirm(result.holdings,`${book.name} · ${sheet.sheet}`,result.positions)}><Check size={16}/> Use these holdings</button></div>
 </section>;
}
