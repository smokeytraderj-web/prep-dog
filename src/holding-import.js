import { parseCsv } from './benchmark.js';
import { parseHoldings } from './holdings.js';
const clean = v => String(v ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const patterns = {
 ticker: /^(ticker|symbol|tickersymbol|securitysymbol|securityticker)$/,
 value: /^(marketvalue|marketvalueusd|mktvalue|currentvalue|positionvalue|holdingvalue|holdingsvalue|value|currentbalance|balance)$/,
 quantity: /^(quantity|shares|units|qty|sharequantity|numberofshares)$/,
 price: /^(price|lastprice|currentprice|marketprice|unitprice|shareprice)$/,
 currency: /^(currency|currencycode|marketcurrency)$/,
 account: /^(account|accountname|accountregistration|registration)$/,
 assetClass: /^(assetclass|assetcategory|primaryassetclass|assetclassprimary|allocationcategory)$/,
 region: /^(region|geography|geographicregion|marketregion|geographicallocation|countryregion)$/,
 securityName: /^(securityname|holdingname|description|securitydescription|name)$/,
};
export function detectTable(rows) {
 let best = {header:0,ticker:-1,value:-1,quantity:-1,price:-1,currency:-1,account:-1,assetClass:-1,region:-1,securityName:-1,score:0};
 rows.slice(0,50).forEach((row,header)=>{
  const fields=Object.fromEntries(Object.entries(patterns).map(([key,re])=>[key,row.findIndex(v=>re.test(clean(v)))]));
  const score=(fields.ticker>=0?10:0)+(fields.value>=0?8:0)+(fields.quantity>=0?2:0)+(fields.price>=0?1:0);
  if(score>best.score)best={header,...fields,score};
 });
 return {...best,mode:best.value>=0?'value':'quantity'};
}
export function numberFromCell(value) {
 if(typeof value==='number')return value;
 const text=String(value??'').trim();
 if(!text || /%/.test(text))return NaN;
 const normalized=text.replace(/^\((.*)\)$/,'-$1').replace(/[$,\s]/g,'');
 return /^-?\d+(\.\d+)?$/.test(normalized)?Number(normalized):NaN;
}
export function extractHoldings(rows,mapping) {
 const holdings=new Map(),positions=[],errors=[],skipped=[];let sourceRows=0;
 if(mapping.ticker<0 || (mapping.mode==='value'?mapping.value<0:mapping.quantity<0||mapping.price<0))return {holdings:[],errors:['Choose a ticker column and either market value or quantity × price.'],skipped,sourceRows};
 const mapped=[mapping.ticker,...(mapping.mode==='value'?[mapping.value]:[mapping.quantity,mapping.price])];
 if(new Set(mapped).size!==mapped.length)return {holdings:[],errors:['Choose different columns for ticker, value, quantity and price.'],skipped,sourceRows};
 rows.slice(mapping.header+1).forEach((row,i)=>{
  const line=mapping.header+i+2;
  if(!row.some(v=>v!==null&&String(v).trim()!==''))return;
  const ticker=String(row[mapping.ticker]??'').trim().toUpperCase();
  if(patterns.ticker.test(clean(ticker)))return;
  if(row.some(v=>/^\s*(grand\s+total|sub\s*total|total)(\s|$|:)/i.test(String(v??'')))){skipped.push(`Row ${line}: summary total`);return;}
  if(['N/A','NA','NONE'].includes(ticker)||!/^[A-Z0-9][A-Z0-9.^/-]{0,20}$/.test(ticker)){errors.push(`Row ${line}: a ticker is missing or invalid.`);return;}
  if(mapping.currency>=0 && !['','USD','US DOLLAR','US DOLLARS','$'].includes(String(row[mapping.currency]??'').trim().toUpperCase())){errors.push(`Row ${line}: convert this position to USD before importing.`);return;}
  if(mapping.mode==='quantity' && (numberFromCell(row[mapping.quantity])<0 || numberFromCell(row[mapping.price])<0)){errors.push(`Row ${line}: quantity and price must be nonnegative.`);return;}
  const value=mapping.mode==='value'?numberFromCell(row[mapping.value]):numberFromCell(row[mapping.quantity])*numberFromCell(row[mapping.price]);
  if(!Number.isFinite(value)||value<0){errors.push(`Row ${line}: ${mapping.mode==='value'?'market value':'quantity or price'} is missing, invalid or negative.`);return;}
  if(value===0){skipped.push(`Row ${line}: zero-value position`);return;}
  sourceRows++;holdings.set(ticker,(holdings.get(ticker)||0)+value);
  positions.push({ticker,value,...Object.fromEntries(["account","assetClass","region","securityName"].filter(k=>mapping[k]>=0).map(k=>[k,String(row[mapping[k]]??" ").trim()]))});
 });
 return {holdings:[...holdings].map(([ticker,value])=>({ticker,value})),errors,skipped,sourceRows,positions};
}
export function textToSheets(text,name='Uploaded holdings') {
 if(text.includes('\t')||text.includes(';')||text.includes(',')) {
  const delimiter=text.includes('\t')?'\t':text.includes(';')?';':',';
  const rows=parseCsv(text.replace(/^\uFEFF/,''),delimiter);
  if(detectTable(rows).score>=10)return [{sheet:name,data:rows}];
 }
 const result=parseHoldings(text);
 if(!result.errors.length && result.holdings.length)return [{sheet:name,data:[['Ticker','Market value'],...result.holdings.map(h=>[h.ticker,h.value])]}];
 const rows=parseCsv(text.replace(/^\uFEFF/,''),text.includes('\t')?'\t':text.includes(';')?';':',');
 return [{sheet:name,data:rows}];
}
