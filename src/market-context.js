import { SECTOR_ORDER } from './equity.js';
export const emptySectorPerformance = () => ({asOf:'',basis:'',source:'',sectors:SECTOR_ORDER.map(name=>({name,return:''}))});
export const emptyEarnings = () => ({asOf:'',source:'',quarters:[{period:'Q1',growth:'',kind:'Reported'},{period:'Q2',growth:'',kind:'Estimate'}],years:[{period:String(new Date().getFullYear()),growth:'',kind:'Estimate'},{period:String(new Date().getFullYear()+1),growth:'',kind:'Estimate'}],referenceConflict:false});
export const emptyMarketIndexes = () => ({asOf:'',source:'',basis:'',indexes:[
 {id:'sp500',label:'S&P 500',region:'U.S. large cap',return:''},
 {id:'nasdaq',label:'Nasdaq Composite',region:'U.S. growth',return:''},
 {id:'emerging',label:'MSCI Emerging Markets',region:'Emerging markets',return:''},
 {id:'msci',label:'MSCI World ex USA',region:'International developed',return:''},
]});
const numeric=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
const hasDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d));
export function validSectorPerformance(data) {
 return !!(data&&hasDate(data.asOf)&&typeof data.source==='string'&&data.source.trim()&&data.basis&&Array.isArray(data.sectors)&&data.sectors.length===11&&SECTOR_ORDER.every(name=>data.sectors.filter(s=>s.name===name&&numeric(s.return)&&Number(s.return)>=-100).length===1));
}
export function validEarnings(data) {
 return !!(data&&hasDate(data.asOf)&&typeof data.source==='string'&&data.source.trim()&&!data.referenceConflict&&Array.isArray(data.quarters)&&data.quarters.length===2&&Array.isArray(data.years)&&data.years.length===2&&[...data.quarters,...data.years].every(s=>typeof s.period==='string'&&s.period.trim()&&numeric(s.growth)&&['Reported','Estimate'].includes(s.kind)));
}
export function validMarketIndexes(data) {
 return !!(data&&hasDate(data.asOf)&&typeof data.source==='string'&&data.source.trim()&&typeof data.basis==='string'&&data.basis.trim()&&Array.isArray(data.indexes)&&data.indexes.length===4&&['sp500','nasdaq','emerging','msci'].every(id=>data.indexes.some(i=>i.id===id&&typeof i.label==='string'&&i.label.trim()&&typeof i.region==='string'&&i.region.trim()&&numeric(i.return)&&Number(i.return)>=-100)));
}
