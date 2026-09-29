import { validSectorPerformance, validEarnings, validMarketIndexes } from './market-context.js';
const str=v=>typeof v==='string'&&v.trim().length>0;
const num=v=>typeof v==='number'&&Number.isFinite(v);
const date=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v));
export function validateSupporting(data) {
 if(!data||typeof data!=='object')throw Error('Upload a report data object.');
 const out={};
 if(data.marketIndexes){if(!validMarketIndexes(data.marketIndexes))throw Error('Market indexes require a date, source, return basis and four sourced YTD index returns.');out.marketIndexes=data.marketIndexes;}
 if(data.sectorPerformance){if(!validSectorPerformance(data.sectorPerformance))throw Error('Sector performance requires a date, source, return basis and all 11 sector returns.');out.sectorPerformance=data.sectorPerformance;}
 if(data.earnings){if(!validEarnings(data.earnings))throw Error('Earnings require a date, source, and reported/estimated growth for each quarter and year.');out.earnings=data.earnings;}
 if(data.risk){
  const r=data.risk;
  if(!date(r.asOf)||!str(r.source)||!Array.isArray(r.accounts)||!r.accounts.length||r.accounts.length>30)throw Error('Risk data requires an as-of date, source and account data.');
  r.accounts.forEach(a=>{
   if(!str(a.name)||![a.value,a.score,a.lowerPct,a.upperPct,a.confidence,a.horizonMonths].every(num)||a.value<=0||a.score<1||a.score>99||a.lowerPct<-100||a.lowerPct>a.upperPct||a.confidence<=0||a.confidence>=100||a.horizonMonths<=0)throw Error('Each risk account needs a positive value, valid 1–99 score, ordered outcome range, confidence and horizon.');
   for(const k of ['gpa','dividend','midpoint'])if(a[k]!=null&&!num(a[k]))throw Error(`Risk ${k} must be numeric when supplied.`);
  });out.risk=r;
 }
 if(data.attribution){
  const a=data.attribution;
  if(!date(a.periodStart)||!date(a.periodEnd)||a.periodEnd<a.periodStart||!str(a.source)||!str(a.feeBasis)||!Array.isArray(a.accounts)||!a.accounts.length||a.accounts.length>30)throw Error('Contribution data requires valid period dates, fee basis, source and accounts.');
  a.accounts.forEach(account=>{
   if(!str(account.name)||!Array.isArray(account.holdings)||!account.holdings.length||account.holdings.some(h=>!str(h.ticker)||!num(h.contribution)||h.return!=null&&!num(h.return)))throw Error('Each account needs named positions with numeric reported contribution values.');
   const symbols=account.holdings.map(h=>h.ticker.toUpperCase());if(new Set(symbols).size!==symbols.length)throw Error('Contribution data has duplicate positions within an account. Aggregate them in the source report.');
  });out.attribution=a;
 }
 if(!Object.keys(out).length)throw Error('No supported report data found. Use sectorPerformance, earnings, risk or attribution.');
 return out;
}
export function groupPositions(positions,key) {
 const groups=new Map();
 for(const p of positions){const name=p[key]?.trim()||'Unclassified';const g=groups.get(name)||{name,value:0,count:0};g.value+=p.value;g.count++;groups.set(name,g);}
 return [...groups.values()].sort((a,b)=>b.value-a.value);
}
