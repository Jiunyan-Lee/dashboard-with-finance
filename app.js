const STORAGE_KEY='finance-compass-v2';
const COLORS={stocks:'#147550',bonds:'#24587e',cash:'#bd8729',aggressive:'#147550',conservative:'#63a883',longBond:'#24587e',shortBond:'#7faed1'};
const currency=new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:0});
const AMOUNT_MASK_KEY='finance-compass-hide-amounts';
let amountsHidden=localStorage.getItem(AMOUNT_MASK_KEY)==='true';
const num=value=>Number(String(value??'').replace(/,/g,''))||0;
const money=value=>amountsHidden?'****':currency.format(num(value));
const axisMoney=value=>amountsHidden?'****':new Intl.NumberFormat('zh-TW',{notation:'compact'}).format(value);
const pct=value=>`${(value*100).toFixed(1)}%`;
const today=()=>new Date().toISOString().slice(0,10);
const fresh=()=>({current:{month:new Date().toISOString().slice(0,7),entryDate:today(),salary:'',totalInvestment:'',banks:[],holdings:[],brokerCash:[],debts:[]},snapshots:[],trades:[]});
let state=load(),charts={};
function normalize(s){const base=fresh(),legacyInvestment=s.settings?.totalInvestment??'';const migrate=item=>({...item,totalInvestment:item.totalInvestment??legacyInvestment,entryDate:item.entryDate||''});return {...base,...s,current:{...base.current,...(s.current||{}),totalInvestment:s.current?.totalInvestment??legacyInvestment},snapshots:Array.isArray(s.snapshots)?s.snapshots.map(migrate):[],trades:Array.isArray(s.trades)?s.trades:[]}}
function load(){try{return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)||localStorage.getItem('finance-compass-v1')||'{}'))}catch{return fresh()}}
function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(state))}
function sum(items){return items.reduce((total,item)=>total+num(item.amount),0)}
function compute(data=state.current){const banks=sum(data.banks||[]),brokerCash=sum(data.brokerCash||[]),aggressive=sum((data.holdings||[]).filter(x=>x.category==='aggressive')),conservative=sum((data.holdings||[]).filter(x=>x.category==='conservative')),longBond=sum((data.holdings||[]).filter(x=>x.category==='longBond')),shortBond=sum((data.holdings||[]).filter(x=>x.category==='shortBond')),stocks=aggressive+conservative,bonds=longBond+shortBond,cash=banks+brokerCash,assets=stocks+bonds+cash,debt=sum(data.debts||[]),net=assets-debt;return{banks,brokerCash,aggressive,conservative,longBond,shortBond,stocks,bonds,cash,assets,debt,net,disposable:cash-debt,debtRatio:assets?debt/assets:0,leverage:net>0?debt/net:0,stockBondRatio:bonds?stocks/bonds:null}}
function snapshots(){return [...state.snapshots].sort((a,b)=>a.month.localeCompare(b.month))}
function latestSnapshot(){const items=snapshots();return items.at(-1)||state.current}
function monthLabel(month){if(!month)return'—';const[y,m]=month.split('-');return`${y}/${m}`}
function workMonths(){const earliest=snapshots()[0]?.month;if(!earliest)return 0;const[y,m]=earliest.split('-').map(Number),now=new Date();return Math.max(1,(now.getFullYear()-y)*12+(now.getMonth()+1-m)+1)}
function accruedSalary(){return snapshots().reduce((total,s)=>total+num(s.salary),0)}
function formatInput(input){const raw=String(input.value).replace(/[^0-9]/g,'');input.value=raw?Number(raw).toLocaleString('zh-TW'):''}
function bindMoney(input,onChange){formatInput(input);input.addEventListener('input',()=>{formatInput(input);onChange(input.value)})}
function getContainer(kind){return document.getElementById({banks:'banksRows',holdings:'holdingsRows',brokerCash:'brokerCashRows',debts:'debtsRows'}[kind])}
function renderRows(kind){const host=getContainer(kind);host.innerHTML='';state.current[kind].forEach((row,index)=>{const fragment=document.getElementById(kind==='holdings'?'holdingTemplate':'simpleTemplate').content.cloneNode(true);fragment.querySelectorAll('[data-field]').forEach(el=>{const field=el.dataset.field;el.value=row[field]||'';if(field==='amount')bindMoney(el,v=>{state.current[kind][index][field]=v;save();renderDashboard()});else el.addEventListener('input',e=>{state.current[kind][index][field]=e.target.value;save();renderDashboard()})});fragment.querySelector('.remove').addEventListener('click',()=>{state.current[kind].splice(index,1);save();renderRows(kind);renderDashboard()});host.append(fragment)})}
function renderInput(){for(const id of['snapshotMonth','entryDate'])document.getElementById(id).value=state.current[id]||'';for(const[id,field]of[['monthlySalary','salary'],['monthlyInvestment','totalInvestment']]){const input=document.getElementById(id);input.value=state.current[field]||'';formatInput(input)}['banks','holdings','brokerCash','debts'].forEach(renderRows)}
function metric(label,value,detail='',emphasis=false){return`<div class="metric ${emphasis?'emphasis':''}"><label>${label}</label><strong>${value}</strong>${detail?`<small>${detail}</small>`:''}</div>`}
function renderDashboard(){const c=compute(),salary=accruedSalary(),months=workMonths(),spend=salary-c.assets;document.getElementById('headlineMetrics').innerHTML=[metric('總資產',money(c.assets),`含債務 ${money(c.debt)}`,true),metric('淨資產',money(c.net),'總資產 − 債務金額'),metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡'),metric('粗估累積花費',money(spend),'累積薪水 − 總資產'),metric('股票資產占比',pct(c.assets?c.stocks/c.assets:0),money(c.stocks)),metric('債券資產占比',pct(c.assets?c.bonds/c.assets:0),money(c.bonds)),metric('現金占比',pct(c.assets?c.cash/c.assets:0),`證券現金 ${money(c.brokerCash)} + 銀行現金 ${money(c.banks)} = 現金總額 ${money(c.cash)}`),metric('槓桿比例',pct(c.leverage),`債務比 ${pct(c.debtRatio)}`)].join('');document.getElementById('detailMetrics').innerHTML=[metric('股債比',c.stocks+c.bonds?`${pct(c.stocks/(c.stocks+c.bonds))}：${pct(c.bonds/(c.stocks+c.bonds))}`:'—','股票：債券'),metric('積極型占比',pct(c.assets?c.aggressive/c.assets:0),money(c.aggressive)),metric('保守型占比',pct(c.assets?c.conservative/c.assets:0),money(c.conservative)),metric('長債占比',pct(c.assets?c.longBond/c.assets:0),money(c.longBond)),metric('短債占比',pct(c.assets?c.shortBond/c.assets:0),money(c.shortBond)),].join('');const last=snapshots().at(-1);document.getElementById('snapshotCaption').textContent=last?`最近資料卡：${monthLabel(last.month)}｜填寫於 ${last.entryDate||'—'}`:'尚未儲存月度資料';renderAllocation(c);renderCharts();renderPerformance()}
function renderAllocation(c){const items=[['積極型',c.aggressive,COLORS.aggressive],['保守型',c.conservative,COLORS.conservative],['長債',c.longBond,COLORS.longBond],['短債',c.shortBond,COLORS.shortBond],['銀行／證券現金',c.cash,COLORS.cash]];document.getElementById('allocationList').innerHTML=items.map(([name,value,color])=>`<div class="alloc-row"><i class="swatch" style="background:${color}"></i><span>${name}</span><strong>${money(value)}<small>${pct(c.assets?value/c.assets:0)}</small></strong></div>`).join('');charts.allocation?.destroy();charts.allocation=new Chart(document.getElementById('allocationChart'),{type:'doughnut',data:{labels:items.map(x=>x[0]),datasets:[{data:items.map(x=>x[1]),backgroundColor:items.map(x=>x[2]),borderWidth:0}]},options:{cutout:'72%',plugins:{legend:{display:false},tooltip:{callbacks:{label:x=>`${x.label}：${money(x.raw)}`}}}}})}
function chartOptions(percent=false,stacked=false){return{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:18}},tooltip:{callbacks:{label:x=>`${x.dataset.label}：${percent?x.parsed.y.toFixed(1)+'%':money(x.parsed.y)}`}}},scales:{x:{stacked,grid:{display:false}},y:{stacked,beginAtZero:true,ticks:{callback:x=>percent?`${x}%`:axisMoney(x)}}}}}
function renderCharts(){const rows=snapshots().map(s=>({month:s.month,salary:num(s.salary),...compute(s)})),labels=rows.map(r=>monthLabel(r.month));charts.ratio?.destroy();charts.history?.destroy();charts.ratio=new Chart(document.getElementById('ratioChart'),{type:'line',data:{labels,datasets:[['股票','stocks'],['債券','bonds'],['現金','cash']].map(([label,key])=>({label,data:rows.map(r=>r.assets?r[key]/r.assets*100:0),borderColor:COLORS[key],backgroundColor:COLORS[key],tension:.25}))},options:chartOptions(true)});let running=0;charts.history=new Chart(document.getElementById('historyChart'),{data:{labels,datasets:[{type:'bar',label:'股票',data:rows.map(r=>r.stocks),backgroundColor:COLORS.stocks,stack:'asset'},{type:'bar',label:'債券',data:rows.map(r=>r.bonds),backgroundColor:COLORS.bonds,stack:'asset'},{type:'bar',label:'現金',data:rows.map(r=>r.cash),backgroundColor:COLORS.cash,stack:'asset'},{type:'line',label:'總資產',data:rows.map(r=>r.assets),borderColor:'#14251e',backgroundColor:'#14251e',tension:.22,pointRadius:3},{type:'line',label:'累積薪水',data:rows.map(r=>(running+=r.salary)),borderColor:'#73589d',backgroundColor:'#73589d',tension:.22,pointRadius:3}]},options:chartOptions(false,true)})}
function renderPerformance(){const latest=latestSnapshot(),c=compute(latest),investment=num(latest.totalInvestment),realized=state.trades.reduce((total,t)=>total+num(t.proceeds)-num(t.cost),0),market=c.stocks+c.bonds,net=realized+market+c.brokerCash-c.debt-investment;document.getElementById('performanceMetrics').innerHTML=[metric('最新總投入金額',money(investment),`採用 ${monthLabel(latest.month)} 資料`),metric('已實現損益',money(realized),realized>=0?'獲利':'虧損'),metric('現在總市值',money(market)),metric('證券戶現金',money(c.brokerCash)),metric('負債金額',money(c.debt)),metric('淨損益金額',money(net),'已實現＋市值＋證券現金−負債−投入',net>=0)].join('');const host=document.getElementById('tradeRows');host.innerHTML='';state.trades.forEach((trade,index)=>{const tr=document.createElement('tr');tr.innerHTML='<td><input data-field="date" type="date"></td><td><input data-field="name" placeholder="例如：台積電"></td><td><input data-field="cost" class="money-input" inputmode="numeric" placeholder="0"></td><td><input data-field="proceeds" class="money-input" inputmode="numeric" placeholder="0"></td><td class="pnl"></td><td><button class="remove">×</button></td>';tr.querySelectorAll('[data-field]').forEach(el=>{const f=el.dataset.field;el.value=trade[f]||'';if(['cost','proceeds'].includes(f))bindMoney(el,v=>{state.trades[index][f]=v;save();renderPerformance()});else el.addEventListener('input',e=>{state.trades[index][f]=e.target.value;save();renderPerformance()})});const pnl=num(trade.proceeds)-num(trade.cost),pnlCell=tr.querySelector('.pnl');pnlCell.textContent=money(pnl);pnlCell.className=`pnl ${pnl>=0?'profit':'loss'}`;tr.querySelector('.remove').addEventListener('click',()=>{state.trades.splice(index,1);save();renderPerformance()});host.append(tr)})}
function saveSnapshot(){if(!state.current.month)return alert('請選擇資料月份。');if(!state.current.entryDate)state.current.entryDate=today();const copy=structuredClone(state.current),i=state.snapshots.findIndex(s=>s.month===copy.month);if(i>=0)state.snapshots[i]=copy;else state.snapshots.push(copy);state.snapshots.sort((a,b)=>a.month.localeCompare(b.month));save();renderDashboard();renderRecordSelector();alert(`${monthLabel(copy.month)} 的月度資料已儲存。`)}
function list(data){return data.length?`<ul>${data.map(x=>`<li><span>${x.name||x.account||'未命名'}${x.category?`（${({aggressive:'積極型',conservative:'保守型',longBond:'長債',shortBond:'短債'})[x.category]}）`:''}</span><strong>${money(x.amount)}</strong></li>`).join('')}</ul>`:'<p class="muted">無資料</p>'}
function renderRecordSelector(){const select=document.getElementById('recordMonth'),items=snapshots(),previous=select.value;select.innerHTML=items.length?items.map(s=>`<option value="${s.month}">${monthLabel(s.month)}</option>`).join(''):'<option value="">尚無資料</option>';select.value=items.some(s=>s.month===previous)?previous:items.at(-1)?.month||'';renderRecord()}
function renderRecord(){const month=document.getElementById('recordMonth').value,s=state.snapshots.find(x=>x.month===month),empty=document.getElementById('recordEmpty'),card=document.getElementById('recordCard');if(!s){empty.hidden=false;card.hidden=true;return}const c=compute(s);empty.hidden=true;card.hidden=false;card.innerHTML=`<article class="record-card"><div class="record-top"><div><h2>${monthLabel(s.month)} 資料卡</h2><p class="record-date">填寫日期：${s.entryDate||'未紀錄'}</p></div><button class="button ghost" id="loadRecord">載入此月份資料</button></div><div class="record-kpis"><div class="record-kpi"><span>總資產</span><strong>${money(c.assets)}</strong></div><div class="record-kpi"><span>淨資產</span><strong>${money(c.net)}</strong></div><div class="record-kpi"><span>本月薪水</span><strong>${money(s.salary)}</strong></div><div class="record-kpi"><span>總投入金額</span><strong>${money(s.totalInvestment)}</strong></div></div><div class="record-lists"><div class="record-list"><h3>銀行帳戶</h3>${list(s.banks||[])}</div><div class="record-list"><h3>證券資產</h3>${list(s.holdings||[])}</div><div class="record-list"><h3>證券戶現金</h3>${list(s.brokerCash||[])}</div><div class="record-list"><h3>債務</h3>${list(s.debts||[])}</div></div></article>`;setupHeatmapTooltipsV16(card);document.getElementById('loadRecord').addEventListener('click',()=>{state.current=structuredClone(s);save();renderInput();renderDashboard();navigate('monthly')})}
function navigate(page){document.querySelectorAll('.page,.nav').forEach(x=>x.classList.remove('active'));document.getElementById(page).classList.add('active');document.querySelector(`.nav[data-page="${page}"]`).classList.add('active')}
document.querySelectorAll('.nav').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.go)));document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>{const kind=b.dataset.add;if(kind==='trades'){state.trades.push({date:'',name:'',cost:'',proceeds:''});renderPerformance()}else{state.current[kind].push(kind==='holdings'?{account:'',name:'',category:'aggressive',amount:''}:{name:'',amount:''});renderRows(kind)}save()}));
document.getElementById('snapshotMonth').addEventListener('input',e=>{state.current.month=e.target.value;save()});document.getElementById('entryDate').addEventListener('input',e=>{state.current.entryDate=e.target.value;save()});bindMoney(document.getElementById('monthlySalary'),v=>{state.current.salary=v;save();renderDashboard()});bindMoney(document.getElementById('monthlyInvestment'),v=>{state.current.totalInvestment=v;save();renderPerformance()});document.getElementById('saveSnapshotBtn').addEventListener('click',saveSnapshot);document.getElementById('clearBtn').addEventListener('click',()=>{if(confirm('確定清空目前未儲存的資料？已儲存的資料卡不會被刪除。')){const month=state.current.month;state.current={...fresh().current,month};save();renderInput();renderDashboard()}});document.getElementById('recordMonth').addEventListener('change',renderRecord);
document.getElementById('exportBtn').addEventListener('click',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));a.download=`finance-dashboard-${today()}.json`;a.click();URL.revokeObjectURL(a.href)});document.getElementById('importInput').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{state=normalize(JSON.parse(reader.result));save();hydrate();alert('備份已匯入。')}catch{alert('無法讀取此備份檔案。')}};reader.readAsText(file)});
function hydrate(){renderInput();renderDashboard();renderRecordSelector()}hydrate();

// Version 3 financial calculations and presentation overrides.
function categoryNameV3(value){return({aggressive:'積極型',conservative:'保守型',leveraged:'槓桿型',longBond:'長債',shortBond:'短債'})[value]||value}
function compute(data=state.current){const banks=sum(data.banks||[]),brokerCash=sum(data.brokerCash||[]),h=data.holdings||[],aggressive=sum(h.filter(x=>x.category==='aggressive')),conservative=sum(h.filter(x=>x.category==='conservative')),leveraged=sum(h.filter(x=>x.category==='leveraged')),longBond=sum(h.filter(x=>x.category==='longBond')),shortBond=sum(h.filter(x=>x.category==='shortBond')),stocks=aggressive+conservative+leveraged,bonds=longBond+shortBond,cash=banks+brokerCash,assets=stocks+bonds+cash,debt=sum(data.debts||[]),net=assets-debt,exposure=aggressive+conservative+longBond+shortBond+leveraged*2;return{banks,brokerCash,aggressive,conservative,leveraged,longBond,shortBond,stocks,bonds,cash,assets,debt,net,exposure,disposable:cash-debt,debtRatio:net?debt/net:0,leverage:net?exposure/net:0,stockBondRatio:bonds?stocks/bonds:null}}
function overviewMarkupV3(data){const c=compute(data),salary=accruedSalary(),months=workMonths(),spend=salary-c.assets;return{c,headline:[metric('總資產',money(c.assets),`含債務 ${money(c.debt)}`,true),metric('淨資產',money(c.net),'總資產 − 債務金額'),metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡'),metric('粗估累積花費',money(spend),'累積薪水 − 總資產'),metric('股票資產占比',pct(c.assets?c.stocks/c.assets:0),money(c.stocks)),metric('債券資產占比',pct(c.assets?c.bonds/c.assets:0),money(c.bonds)),metric('現金占比',pct(c.assets?c.cash/c.assets:0),`證券現金 ${money(c.brokerCash)} + 銀行現金 ${money(c.banks)} = 現金總額 ${money(c.cash)}`),metric('槓桿比例',pct(c.leverage),`曝險 ${money(c.exposure)}`)].join(''),detail:[metric('股債比',c.stocks+c.bonds?`${pct(c.stocks/(c.stocks+c.bonds))}：${pct(c.bonds/(c.stocks+c.bonds))}`:'—','股票：債券'),metric('積極型占比',pct(c.assets?c.aggressive/c.assets:0),money(c.aggressive)),metric('保守型占比',pct(c.assets?c.conservative/c.assets:0),money(c.conservative)),metric('槓桿型占比',pct(c.assets?c.leveraged/c.assets:0),money(c.leveraged)),metric('長債占比',pct(c.assets?c.longBond/c.assets:0),money(c.longBond)),metric('短債占比',pct(c.assets?c.shortBond/c.assets:0),money(c.shortBond)),].join('')}}
function allocationV3(c){const items=[['積極型',c.aggressive,COLORS.aggressive],['保守型',c.conservative,COLORS.conservative],['槓桿型',c.leveraged,'#9a5ba0'],['長債',c.longBond,COLORS.longBond],['短債',c.shortBond,COLORS.shortBond],['銀行／證券現金',c.cash,COLORS.cash]];return{items,html:items.map(([name,value,color])=>`<div class="alloc-row"><i class="swatch" style="background:${color}"></i><span>${name}</span><strong>${money(value)}<small>${pct(c.assets?value/c.assets:0)}</small></strong></div>`).join('')}}
function renderAllocation(c){const view=allocationV3(c);document.getElementById('allocationList').innerHTML=view.html;charts.allocation?.destroy();charts.allocation=new Chart(document.getElementById('allocationChart'),{type:'doughnut',data:{labels:view.items.map(x=>x[0]),datasets:[{data:view.items.map(x=>x[1]),backgroundColor:view.items.map(x=>x[2]),borderWidth:0}]},options:{cutout:'72%',plugins:{legend:{display:false},tooltip:{callbacks:{label:x=>`${x.label}：${money(x.raw)}`}}}}})}
function renderDashboard(){const latest=latestSnapshot(),view=overviewMarkupV3(latest),last=snapshots().at(-1);document.getElementById('headlineMetrics').innerHTML=view.headline;document.getElementById('detailMetrics').innerHTML=view.detail;document.getElementById('snapshotCaption').textContent=last?`最新資料卡：${monthLabel(last.month)}｜填寫於 ${last.entryDate||'—'}`:'尚未儲存月度資料';renderAllocation(view.c);renderCharts();renderPerformance()}
function monthSequenceV3(){const first=snapshots()[0]?.month;if(!first)return[];let[y,m]=first.split('-').map(Number);const now=new Date(),out=[];while(y<now.getFullYear()||(y===now.getFullYear()&&m<=now.getMonth()+1)){out.push(`${y}-${String(m).padStart(2,'0')}`);m++;if(m===13){m=1;y++}}return out}
function renderCharts(){const cards=snapshots(),byMonth=new Map(cards.map(s=>[s.month,s])),rows=monthSequenceV3().map(month=>{const s=byMonth.get(month);return s?{month,salary:num(s.salary),investment:num(s.totalInvestment),...compute(s)}:{month,salary:0,investment:null,assets:null,stocks:null,bonds:null,cash:null}}),labels=rows.map(r=>monthLabel(r.month));charts.ratio?.destroy();charts.history?.destroy();charts.ratio=new Chart(document.getElementById('ratioChart'),{type:'line',data:{labels,datasets:[['股票','stocks'],['債券','bonds'],['現金','cash']].map(([label,key])=>({label,data:rows.map(r=>r.assets?r[key]/r.assets*100:null),borderColor:COLORS[key],backgroundColor:COLORS[key],tension:.25,spanGaps:true}))},options:chartOptions(true)});let salaryTotal=0,lastInvestment=null;charts.history=new Chart(document.getElementById('historyChart'),{data:{labels,datasets:[{type:'bar',label:'股票',data:rows.map(r=>r.stocks),backgroundColor:COLORS.stocks,stack:'asset'},{type:'bar',label:'債券',data:rows.map(r=>r.bonds),backgroundColor:COLORS.bonds,stack:'asset'},{type:'bar',label:'現金',data:rows.map(r=>r.cash),backgroundColor:COLORS.cash,stack:'asset'},{type:'line',label:'總資產',data:rows.map(r=>r.assets),borderColor:'#14251e',backgroundColor:'#14251e',tension:.22,pointRadius:3,spanGaps:true},{type:'line',label:'累積薪水',data:rows.map(r=>(salaryTotal+=r.salary)),borderColor:'#73589d',backgroundColor:'#73589d',tension:.22,pointRadius:2},{type:'line',label:'總投入金額',data:rows.map(r=>{if(r.investment!==null)lastInvestment=r.investment;return lastInvestment}),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.22,pointRadius:3,spanGaps:true}]},options:chartOptions(false,true)})}
function performanceV3(){const latest=latestSnapshot(),c=compute(latest),investment=num(latest.totalInvestment),realized=state.trades.reduce((total,t)=>total+num(t.proceeds)-num(t.cost),0),market=c.stocks+c.bonds,net=realized+market+c.brokerCash-c.debt-investment;return{latest,c,investment,realized,market,net}}
function renderPerformanceSummaryV3(){const {latest,c,investment,realized,market,net}=performanceV3();document.getElementById('performanceMetrics').innerHTML=[metric('最新總投入金額',money(investment),`採用 ${monthLabel(latest.month)} 資料`),metric('已實現損益',money(realized),realized>=0?'獲利':'虧損'),metric('現在總市值',money(market)),metric('證券戶現金',money(c.brokerCash)),metric('負債金額',money(c.debt)),metric('淨損益金額',money(net),'已實現＋市值＋證券現金−負債−投入',net>=0)].join('')}
function renderPerformance(){renderPerformanceSummaryV3();const host=document.getElementById('tradeRows');host.innerHTML='';state.trades.forEach((trade,index)=>{const tr=document.createElement('tr');tr.innerHTML='<td><input data-field="date" type="date"></td><td><input data-field="name" placeholder="例如：台積電"></td><td><input data-field="cost" class="money-input" inputmode="numeric" placeholder="0"></td><td><input data-field="proceeds" class="money-input" inputmode="numeric" placeholder="0"></td><td class="pnl"></td><td><button class="remove">×</button></td>';const refresh=()=>{const pnl=num(trade.proceeds)-num(trade.cost),cell=tr.querySelector('.pnl');cell.textContent=money(pnl);cell.className=`pnl ${pnl>=0?'profit':'loss'}`};tr.querySelectorAll('[data-field]').forEach(el=>{const field=el.dataset.field;el.value=trade[field]||'';if(field==='cost'||field==='proceeds')bindMoney(el,value=>{trade[field]=value;refresh();renderPerformanceSummaryV3();save()});else el.addEventListener('input',e=>{trade[field]=e.target.value;save()})});refresh();tr.querySelector('.remove').addEventListener('click',()=>{state.trades.splice(index,1);save();renderPerformance()});host.append(tr)})}
function list(data){return data.length?`<ul>${data.map(x=>`<li><span>${x.name||x.account||'未命名'}${x.category?`（${categoryNameV3(x.category)}）`:''}</span><strong>${money(x.amount)}</strong></li>`).join('')}</ul>`:'<p class="muted">無資料</p>'}
function growthMarkupV3(s){const cards=snapshots(),i=cards.findIndex(x=>x.month===s.month),cur=compute(s),prev=i>0?compute(cards[i-1]):null,first=cards.find(x=>x.month.startsWith(s.month.slice(0,4))),base=first?compute(first):null,diff=(a,b)=>b===null?'—':money(a-b);return[metric('總資產月成長',diff(cur.assets,prev?.assets??null),prev?`較 ${monthLabel(cards[i-1].month)}`:'無上月資料'),metric('總資產年成長',diff(cur.assets,base?.assets??null),base?`較 ${monthLabel(first.month)}`:'無年度基準'),metric('扣除質押後總資產成長',diff(cur.net,base?.net??null),base?'以淨資產（總資產−債務）計算':'無年度基準'),metric('年度績效',base?.net?pct((cur.net-base.net)/base.net):'—',base?`較 ${monthLabel(first.month)} 淨資產`:'無年度基準')].join('')}
function annualMarkupV3(s){const year=s.month.slice(0,4),items=snapshots().filter(x=>x.month.startsWith(year)),total=items.reduce((n,x)=>n+num(x.salary),0);return[metric(`${year} 年度總薪資`,money(total),`${items.length} 筆月度資料`),metric(`${year} 年度平均薪資`,items.length?money(total/items.length):'—','依已儲存資料卡平均')].join('')}
function renderRecord(){const month=document.getElementById('recordMonth').value,s=state.snapshots.find(x=>x.month===month),empty=document.getElementById('recordEmpty'),card=document.getElementById('recordCard');if(!s){empty.hidden=false;card.hidden=true;return}const overview=overviewMarkupV3(s),allocation=allocationV3(overview.c);empty.hidden=true;card.hidden=false;card.innerHTML=`<article class="record-card"><div class="record-top"><div><h2>${monthLabel(s.month)} 資料卡</h2><p class="record-date">填寫日期：${s.entryDate||'未紀錄'}</p></div><div class="actions record-actions"><button class="button ghost" id="loadRecord">載入此月份資料</button><button class="button danger-ghost" id="deleteRecord">刪除此月份資料</button></div></div><div class="record-section"><h3>總覽統計</h3><div class="metric-grid summary-grid">${metric('總資產',money(overview.c.assets),`含債務 ${money(overview.c.debt)}`,true)}${metric('淨資產',money(overview.c.net),'總資產 − 債務金額')}${metric('股票資產金額',money(overview.c.stocks))}${metric('債券資產金額',money(overview.c.bonds))}${metric('證券現金金額',money(overview.c.brokerCash))}${metric('總投入金額',money(s.totalInvestment),'截至該月份的累積投入本金')}${metric('股票資產占比',pct(overview.c.assets?overview.c.stocks/overview.c.assets:0),money(overview.c.stocks))}${metric('債券資產占比',pct(overview.c.assets?overview.c.bonds/overview.c.assets:0),money(overview.c.bonds))}${metric('現金占比',pct(overview.c.assets?overview.c.cash/overview.c.assets:0),`證券現金 ${money(overview.c.brokerCash)} + 銀行現金 ${money(overview.c.banks)} = 現金總額 ${money(overview.c.cash)}`)}${metric('槓桿比例',pct(overview.c.leverage),`曝險 ${money(overview.c.exposure)}`)}${metric('債務金額',money(overview.c.debt),'該月份債務總額')}${metric('債務比',pct(overview.c.assets?overview.c.debt/overview.c.assets:0),'債務金額 ÷ 總資產金額')}${metric('淨債務比',pct(overview.c.net?overview.c.debt/overview.c.net:0),'債務金額 ÷ 淨資產金額')}${metric('可支配金額',money(overview.c.disposable),'現金 − 債務')}</div></div><div class="record-section"><h3>投資組合指標</h3><div class="metric-grid">${overview.detail}</div></div><div class="record-section"><h3>收入與花費</h3><div class="metric-grid income-expense-metrics-grid">${incomeExpenseMetricsV13(overview.c,s)}</div></div><div class="record-section"><h3>月／年資產變化</h3><div class="metric-grid">${growthMarkupV3(s)}</div></div><div class="record-section"><h3>年度統計</h3><div class="metric-grid">${annualMarkupV3(s)}</div></div><div class="record-section"><h3>資產熱力圖</h3><p class="muted">每筆資產的區塊面積依金額比例呈現</p><div class="heatmap-wrap">${heatmapV15(s)}</div></div><div class="record-lists"><div class="record-list"><h3>銀行帳戶</h3>${list(s.banks||[])}</div><div class="record-list"><h3>證券資產</h3>${list(s.holdings||[])}</div><div class="record-list"><h3>證券戶現金</h3>${list(s.brokerCash||[])}</div><div class="record-list"><h3>債務</h3>${list(s.debts||[])}</div></div></article>`;setupHeatmapTooltipsV16(card);document.getElementById('loadRecord').addEventListener('click',()=>{state.current=structuredClone(s);save();renderInput();navigate('monthly')});document.getElementById('deleteRecord').addEventListener('click',()=>{if(!confirm('確定要刪除 '+monthLabel(s.month)+' 的整張月度資料卡嗎？此動作無法復原，建議先匯出備份。'))return;const index=state.snapshots.findIndex(item=>item.month===s.month);if(index<0)return;state.snapshots.splice(index,1);save();renderRecordSelector();renderDashboard();window.refreshDynamicReviewV19?.()})}

hydrate();

// Version 4: keep asset bars stacked while rendering line series from a zero baseline.
function historyOptionsV4(){return{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:18}},tooltip:{callbacks:{label:x=>`${x.dataset.label}：${money(x.parsed.y)}`}}},scales:{x:{stacked:true,grid:{display:false}},yBars:{stacked:true,beginAtZero:true,min:0,position:'left',ticks:{callback:x=>axisMoney(x)}},yLines:{stacked:false,beginAtZero:true,min:0,position:'right',grid:{drawOnChartArea:false},ticks:{callback:x=>axisMoney(x)}}}}}
function renderCharts(){const cards=snapshots(),byMonth=new Map(cards.map(s=>[s.month,s])),rows=monthSequenceV3().map(month=>{const s=byMonth.get(month);return s?{month,salary:num(s.salary),investment:num(s.totalInvestment),...compute(s)}:{month,salary:0,investment:null,assets:null,stocks:null,bonds:null,cash:null}}),labels=rows.map(r=>monthLabel(r.month));charts.ratio?.destroy();charts.history?.destroy();charts.ratio=new Chart(document.getElementById('ratioChart'),{type:'line',data:{labels,datasets:[['股票','stocks'],['債券','bonds'],['現金','cash']].map(([label,key])=>({label,data:rows.map(r=>r.assets?r[key]/r.assets*100:null),borderColor:COLORS[key],backgroundColor:COLORS[key],tension:.25,spanGaps:true}))},options:chartOptions(true)});let salaryTotal=0,lastInvestment=null;charts.history=new Chart(document.getElementById('historyChart'),{data:{labels,datasets:[{type:'bar',label:'股票',data:rows.map(r=>r.stocks),backgroundColor:COLORS.stocks,stack:'asset',yAxisID:'yBars'},{type:'bar',label:'債券',data:rows.map(r=>r.bonds),backgroundColor:COLORS.bonds,stack:'asset',yAxisID:'yBars'},{type:'bar',label:'現金',data:rows.map(r=>r.cash),backgroundColor:COLORS.cash,stack:'asset',yAxisID:'yBars'},{type:'line',label:'總資產',data:rows.map(r=>r.assets),borderColor:'#14251e',backgroundColor:'#14251e',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines'},{type:'line',label:'累積薪水',data:rows.map(r=>(salaryTotal+=r.salary)),borderColor:'#73589d',backgroundColor:'#73589d',tension:.22,pointRadius:2,yAxisID:'yLines'},{type:'line',label:'總投入金額',data:rows.map(r=>{if(r.investment!==null)lastInvestment=r.investment;return lastInvestment}),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines'}]},options:historyOptionsV4()})}

// Version 5: synchronize both vertical scales and draw line series above asset bars.
function historyOptionsV5(maximum){const common={beginAtZero:true,max:Math.max(1,maximum),ticks:{callback:x=>axisMoney(x)}};return{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:18}},tooltip:{callbacks:{label:x=>`${x.dataset.label}：${money(x.parsed.y)}`}}},scales:{x:{stacked:true,grid:{display:false}},yBars:{...common,stacked:true,position:'left'},yLines:{...common,stacked:false,position:'right',grid:{drawOnChartArea:false}}}}}
function renderCharts(){const cards=snapshots(),byMonth=new Map(cards.map(s=>[s.month,s])),rows=monthSequenceV3().map(month=>{const s=byMonth.get(month);return s?{month,salary:num(s.salary),investment:num(s.totalInvestment),...compute(s)}:{month,salary:0,investment:null,assets:null,stocks:null,bonds:null,cash:null}}),labels=rows.map(r=>monthLabel(r.month));charts.ratio?.destroy();charts.history?.destroy();charts.ratio=new Chart(document.getElementById('ratioChart'),{type:'line',data:{labels,datasets:[['股票','stocks'],['債券','bonds'],['現金','cash']].map(([label,key])=>({label,data:rows.map(r=>r.assets?r[key]/r.assets*100:null),borderColor:COLORS[key],backgroundColor:COLORS[key],tension:.25,spanGaps:true}))},options:chartOptions(true)});let salaryTotal=0,lastInvestment=null;const salaryLine=rows.map(r=>(salaryTotal+=r.salary)),investmentLine=rows.map(r=>{if(r.investment!==null)lastInvestment=r.investment;return lastInvestment}),maximum=Math.max(0,...rows.map(r=>r.assets||0),...salaryLine,...investmentLine.map(x=>x||0));charts.history=new Chart(document.getElementById('historyChart'),{data:{labels,datasets:[{type:'bar',label:'股票',data:rows.map(r=>r.stocks),backgroundColor:COLORS.stocks,stack:'asset',yAxisID:'yBars',order:2},{type:'bar',label:'債券',data:rows.map(r=>r.bonds),backgroundColor:COLORS.bonds,stack:'asset',yAxisID:'yBars',order:2},{type:'bar',label:'現金',data:rows.map(r=>r.cash),backgroundColor:COLORS.cash,stack:'asset',yAxisID:'yBars',order:2},{type:'line',label:'總資產',data:rows.map(r=>r.assets),borderColor:'#14251e',backgroundColor:'#14251e',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1},{type:'line',label:'累積薪水',data:salaryLine,borderColor:'#73589d',backgroundColor:'#73589d',tension:.22,pointRadius:2,yAxisID:'yLines',order:1},{type:'line',label:'總投入金額',data:investmentLine,borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1}]},options:historyOptionsV5(maximum)})}

// Version 6: padded million-rounded range and mirrored percentage scale.
function chartOptions(percent=false,stacked=false){const scales={x:{stacked,grid:{display:false}},y:{stacked,beginAtZero:true,ticks:{callback:x=>percent?`${x}%`:axisMoney(x)}}};if(percent){scales.y.max=100;scales.yRight={position:'right',beginAtZero:true,max:100,grid:{drawOnChartArea:false},ticks:{callback:x=>`${x}%`}}}return{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:18}},tooltip:{callbacks:{label:x=>`${x.dataset.label}：${percent?x.parsed.y.toFixed(1)+'%':money(x.parsed.y)}`}}},scales}}
function historyOptionsV6(maximum){const padded=Math.ceil((maximum*1.2)/1000000)*1000000,common={beginAtZero:true,max:Math.max(1000000,padded),ticks:{callback:x=>axisMoney(x)}};return{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:18}},tooltip:{callbacks:{label:x=>`${x.dataset.label}：${money(x.parsed.y)}`}}},scales:{x:{stacked:true,grid:{display:false}},yBars:{...common,stacked:true,position:'left'},yLines:{...common,stacked:false,position:'right',grid:{drawOnChartArea:false}}}}}
function renderCharts(){const cards=snapshots(),byMonth=new Map(cards.map(s=>[s.month,s])),rows=monthSequenceV3().map(month=>{const s=byMonth.get(month);return s?{month,salary:num(s.salary),investment:num(s.totalInvestment),...compute(s)}:{month,salary:0,investment:null,assets:null,stocks:null,bonds:null,cash:null}}),labels=rows.map(r=>monthLabel(r.month));charts.ratio?.destroy();charts.history?.destroy();charts.ratio=new Chart(document.getElementById('ratioChart'),{type:'line',data:{labels,datasets:[['股票','stocks'],['債券','bonds'],['現金','cash']].map(([label,key])=>({label,data:rows.map(r=>r.assets?r[key]/r.assets*100:null),borderColor:COLORS[key],backgroundColor:COLORS[key],tension:.25,spanGaps:true}))},options:chartOptions(true)});let salaryTotal=0,lastInvestment=null;const salaryLine=rows.map(r=>(salaryTotal+=r.salary)),investmentLine=rows.map(r=>{if(r.investment!==null)lastInvestment=r.investment;return lastInvestment}),maximum=Math.max(0,...rows.map(r=>r.assets||0),...salaryLine,...investmentLine.map(x=>x||0));charts.history=new Chart(document.getElementById('historyChart'),{data:{labels,datasets:[{type:'bar',label:'股票',data:rows.map(r=>r.stocks),backgroundColor:COLORS.stocks,stack:'asset',yAxisID:'yBars',order:2},{type:'bar',label:'債券',data:rows.map(r=>r.bonds),backgroundColor:COLORS.bonds,stack:'asset',yAxisID:'yBars',order:2},{type:'bar',label:'現金',data:rows.map(r=>r.cash),backgroundColor:COLORS.cash,stack:'asset',yAxisID:'yBars',order:2},{type:'line',label:'總資產',data:rows.map(r=>r.assets),borderColor:'#14251e',backgroundColor:'#14251e',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1},{type:'line',label:'累積薪水',data:salaryLine,borderColor:'#73589d',backgroundColor:'#73589d',tension:.22,pointRadius:2,yAxisID:'yLines',order:1},{type:'line',label:'總投入金額',data:investmentLine,borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1}]},options:historyOptionsV6(maximum)})}

// Version 7: separate cash bars and add the net-assets line.
function renderCharts(){const cards=snapshots(),byMonth=new Map(cards.map(s=>[s.month,s])),rows=monthSequenceV3().map(month=>{const s=byMonth.get(month);return s?{month,salary:num(s.salary),investment:num(s.totalInvestment),...compute(s)}:{month,salary:0,investment:null,assets:null,net:null,stocks:null,bonds:null,banks:null,brokerCash:null,cash:null}}),labels=rows.map(r=>monthLabel(r.month));charts.ratio?.destroy();charts.history?.destroy();charts.ratio=new Chart(document.getElementById('ratioChart'),{type:'line',data:{labels,datasets:[['股票','stocks'],['債券','bonds'],['現金','cash']].map(([label,key])=>({label,data:rows.map(r=>r.assets?r[key]/r.assets*100:null),borderColor:COLORS[key],backgroundColor:COLORS[key],tension:.25,spanGaps:true,clip:8}))},options:chartOptions(true)});let salaryTotal=0,lastInvestment=null;const salaryLine=rows.map(r=>(salaryTotal+=r.salary)),investmentLine=rows.map(r=>{if(r.investment!==null)lastInvestment=r.investment;return lastInvestment}),maximum=Math.max(0,...rows.map(r=>r.assets||0),...rows.map(r=>r.net||0),...salaryLine,...investmentLine.map(x=>x||0));charts.history=new Chart(document.getElementById('historyChart'),{data:{labels,datasets:[{type:'bar',label:'股票',data:rows.map(r=>r.stocks),backgroundColor:COLORS.stocks,stack:'asset',yAxisID:'yBars',order:2},{type:'bar',label:'債券',data:rows.map(r=>r.bonds),backgroundColor:COLORS.bonds,stack:'asset',yAxisID:'yBars',order:2},{type:'bar',label:'證券現金',data:rows.map(r=>r.brokerCash),backgroundColor:'#d6a946',stack:'asset',yAxisID:'yBars',order:2},{type:'bar',label:'銀行現金',data:rows.map(r=>r.banks),backgroundColor:COLORS.cash,stack:'asset',yAxisID:'yBars',order:2},{type:'line',label:'總資產',data:rows.map(r=>r.assets),borderColor:'#14251e',backgroundColor:'#14251e',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1},{type:'line',label:'淨資產',data:rows.map(r=>r.net),borderColor:'#1b778f',backgroundColor:'#1b778f',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1},{type:'line',label:'累積薪水',data:salaryLine,borderColor:'#73589d',backgroundColor:'#73589d',tension:.22,pointRadius:2,yAxisID:'yLines',order:1},{type:'line',label:'總投入金額',data:investmentLine,borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1}]},options:historyOptionsV6(maximum)})}

// Version 8: scrollable sales ledger, Taiwan gain/loss styling, and annual trade aggregation.
function tradeRateV8(trade){const cost=num(trade.cost),pnl=num(trade.proceeds)-cost;return cost?pnl/cost:0}
function tradeClassV8(value){return value>=0?'pnl-positive':'pnl-negative'}
function renderPerformanceSummaryV8(){const {latest,c,investment,realized,market,net}=performanceV3(),realizedClass=tradeClassV8(realized);document.getElementById('performanceMetrics').innerHTML=[metric('最新總投入金額',money(investment),`採用 ${monthLabel(latest.month)} 資料`),`<div class="metric ${realizedClass}"><label>已實現損益</label><strong>${money(realized)}</strong><small>${realized>=0?'獲利':'虧損'}</small></div>`,metric('現在總市值',money(market)),metric('證券戶現金',money(c.brokerCash)),metric('負債金額',money(c.debt)),metric('淨損益金額',money(net),'已實現＋市值＋證券現金−負債−投入',net>=0)].join('')}
function renderAnnualTradeStatsV8(){const groups=new Map();state.trades.forEach(trade=>{const year=/^\d{4}/.test(trade.date||'')?trade.date.slice(0,4):'未填日期',item=groups.get(year)||{count:0,quantity:0,cost:0,proceeds:0};item.count++;item.quantity+=num(trade.quantity);item.cost+=num(trade.cost);item.proceeds+=num(trade.proceeds);groups.set(year,item)});const host=document.getElementById('annualTradeRows');host.innerHTML=[...groups.entries()].sort((a,b)=>b[0].localeCompare(a[0],'zh-Hant')).map(([year,item])=>{const pnl=item.proceeds-item.cost,rate=item.cost?pnl/item.cost:0;return`<tr><td>${year}</td><td>${item.count}</td><td>${new Intl.NumberFormat('zh-TW').format(item.quantity)}</td><td>${money(item.cost)}</td><td>${money(item.proceeds)}</td><td class="${tradeClassV8(pnl)}">${money(pnl)}</td><td class="${tradeClassV8(pnl)} return-cell">${pct(rate)}</td></tr>`}).join('')||'<tr><td colspan="7" class="muted">尚無賣出紀錄</td></tr>'}
function renderPerformance(){renderPerformanceSummaryV8();const host=document.getElementById('tradeRows');host.innerHTML='';state.trades.forEach((trade,index)=>{const tr=document.createElement('tr');tr.innerHTML='<td><input data-field="date" type="date"></td><td><input data-field="code" placeholder="例如：2330"></td><td><input data-field="name" placeholder="例如：台積電"></td><td><input data-field="quantity" class="money-input" inputmode="numeric" placeholder="0"></td><td><input data-field="price" class="money-input" inputmode="numeric" placeholder="0"></td><td><input data-field="cost" class="money-input" inputmode="numeric" placeholder="0"></td><td><input data-field="proceeds" class="money-input" inputmode="numeric" placeholder="0"></td><td class="pnl"></td><td class="return-cell"></td><td><button class="remove">×</button></td>';const refresh=()=>{const pnl=num(trade.proceeds)-num(trade.cost),rate=tradeRateV8(trade),pnlCell=tr.querySelector('.pnl'),rateCell=tr.querySelector('.return-cell');pnlCell.textContent=money(pnl);pnlCell.className=`pnl ${tradeClassV8(pnl)}`;rateCell.textContent=pct(rate);rateCell.className=`return-cell ${tradeClassV8(pnl)}`};tr.querySelectorAll('[data-field]').forEach(el=>{const field=el.dataset.field;el.value=trade[field]||'';if(['quantity','price','cost','proceeds'].includes(field))bindMoney(el,value=>{trade[field]=value;refresh();renderPerformanceSummaryV8();renderAnnualTradeStatsV8();save()});else el.addEventListener('input',e=>{trade[field]=e.target.value;renderAnnualTradeStatsV8();save()})});refresh();tr.querySelector('.remove').addEventListener('click',()=>{state.trades.splice(index,1);save();renderPerformance()});host.append(tr)});renderAnnualTradeStatsV8()}

// Version 9: simplify the sales ledger and annual summary columns.
function renderAnnualTradeStatsV8(){const groups=new Map();state.trades.forEach(trade=>{const year=/^\d{4}/.test(trade.date||'')?trade.date.slice(0,4):'未填日期',item=groups.get(year)||{count:0,cost:0,proceeds:0};item.count++;item.cost+=num(trade.cost);item.proceeds+=num(trade.proceeds);groups.set(year,item)});const host=document.getElementById('annualTradeRows');host.innerHTML=[...groups.entries()].sort((a,b)=>b[0].localeCompare(a[0],'zh-Hant')).map(([year,item])=>{const pnl=item.proceeds-item.cost,rate=item.cost?pnl/item.cost:0;return`<tr><td>${year}</td><td>${item.count}</td><td>${money(item.cost)}</td><td>${money(item.proceeds)}</td><td class="${tradeClassV8(pnl)}">${money(pnl)}</td><td class="${tradeClassV8(pnl)} return-cell">${pct(rate)}</td></tr>`}).join('')||'<tr><td colspan="6" class="muted">尚無賣出紀錄</td></tr>'}
function renderPerformance(){renderPerformanceSummaryV8();const host=document.getElementById('tradeRows');host.innerHTML='';state.trades.forEach((trade,index)=>{const tr=document.createElement('tr');tr.innerHTML='<td><input data-field="date" type="date"></td><td><input data-field="name" placeholder="例如：台積電"></td><td><input data-field="cost" class="money-input" inputmode="numeric" placeholder="0"></td><td><input data-field="proceeds" class="money-input" inputmode="numeric" placeholder="0"></td><td class="pnl"></td><td class="return-cell"></td><td><button class="remove">×</button></td>';const refresh=()=>{const pnl=num(trade.proceeds)-num(trade.cost),rate=tradeRateV8(trade),pnlCell=tr.querySelector('.pnl'),rateCell=tr.querySelector('.return-cell');pnlCell.textContent=money(pnl);pnlCell.className=`pnl ${tradeClassV8(pnl)}`;rateCell.textContent=pct(rate);rateCell.className=`return-cell ${tradeClassV8(pnl)}`};tr.querySelectorAll('[data-field]').forEach(el=>{const field=el.dataset.field;el.value=trade[field]||'';if(field==='cost'||field==='proceeds')bindMoney(el,value=>{trade[field]=value;refresh();renderPerformanceSummaryV8();renderAnnualTradeStatsV8();save()});else el.addEventListener('input',e=>{trade[field]=e.target.value;renderAnnualTradeStatsV8();save()})});refresh();tr.querySelector('.remove').addEventListener('click',()=>{state.trades.splice(index,1);save();renderPerformance()});host.append(tr)});renderAnnualTradeStatsV8()}

// Version 10: add stock-position growth and performance metrics to monthly record cards.
function growthMarkupV3(s){const cards=snapshots(),i=cards.findIndex(x=>x.month===s.month),cur=compute(s),prev=i>0?compute(cards[i-1]):null,first=cards.find(x=>x.month.startsWith(s.month.slice(0,4))),base=first?compute(first):null,diff=(a,b)=>b===null?'—':money(a-b),stockPosition=value=>value.stocks+value.bonds+value.brokerCash,netStockPosition=value=>stockPosition(value)-value.debt,currentStock=stockPosition(cur),currentNetStock=netStockPosition(cur),previousStock=prev?stockPosition(prev):null,yearStock=base?stockPosition(base):null,yearNetStock=base?netStockPosition(base):null,investment=num(s.totalInvestment);return[metric('總資產月成長',diff(cur.assets,prev?.assets??null),prev?`較 ${monthLabel(cards[i-1].month)}`:'無上月資料'),metric('總資產年成長',diff(cur.assets,base?.assets??null),base?`較 ${monthLabel(first.month)}`:'無年度基準'),metric('扣除質押後總資產成長',diff(cur.net,base?.net??null),base?'以淨資產（總資產−債務）計算':'無年度基準'),metric('年度績效',base?.net?pct((cur.net-base.net)/base.net):'—',base?`較 ${monthLabel(first.month)} 淨資產`:'無年度基準'),metric('股票部位月成長',diff(currentStock,previousStock),prev?`較 ${monthLabel(cards[i-1].month)}`:'無上月資料'),metric('股票部位年成長',diff(currentStock,yearStock),base?`較 ${monthLabel(first.month)}`:'無年度基準'),metric('扣除質押後股票部位成長',diff(currentNetStock,yearNetStock),base?'股票＋債券＋證券現金−債務':'無年度基準'),metric('股票部位年度績效',yearNetStock?pct((currentNetStock-yearNetStock)/yearNetStock):'—',base?`較 ${monthLabel(first.month)} 扣債務股票部位`:'無年度基準'),metric('股票部位總成長',money(currentStock-investment),'較當月總投入金額'),metric('扣除質押後股票部位總成長',money(currentNetStock-investment),'股票部位−債務−總投入'),metric('股票部位總績效',investment?pct((currentNetStock-investment)/investment):'—','扣債務股票部位相對總投入金額')].join('')}

// Version 11: stock-position annual comparisons use current investment plus January's stock-position total growth.
function growthMarkupV3(s){const cards=snapshots(),i=cards.findIndex(x=>x.month===s.month),cur=compute(s),prev=i>0?compute(cards[i-1]):null,yearFirst=cards.find(x=>x.month.startsWith(s.month.slice(0,4))),base=yearFirst?compute(yearFirst):null,january=cards.find(x=>x.month===`${s.month.slice(0,4)}-01`),januaryValue=january?compute(january):null,diff=(a,b)=>b===null?'—':money(a-b),stockPosition=value=>value.stocks+value.bonds+value.brokerCash,netStockPosition=value=>stockPosition(value)-value.debt,currentStock=stockPosition(cur),currentNetStock=netStockPosition(cur),previousStock=prev?stockPosition(prev):null,investment=num(s.totalInvestment),januaryStockGrowth=januaryValue?stockPosition(januaryValue)-num(january.totalInvestment):null,stockAnnualBase=januaryStockGrowth===null?null:investment+januaryStockGrowth;return[metric('總資產月成長',diff(cur.assets,prev?.assets??null),prev?`較 ${monthLabel(cards[i-1].month)}`:'無上月資料'),metric('總資產年成長',diff(cur.assets,base?.assets??null),base?`較 ${monthLabel(yearFirst.month)}`:'無年度基準'),metric('扣除質押後總資產成長',diff(cur.net,base?.net??null),base?'以淨資產（總資產−債務）計算':'無年度基準'),metric('年度績效',base?.net?pct((cur.net-base.net)/base.net):'—',base?`較 ${monthLabel(yearFirst.month)} 淨資產`:'無年度基準'),metric('股票部位月成長',diff(currentStock,previousStock),prev?`較 ${monthLabel(cards[i-1].month)}`:'無上月資料'),metric('股票部位年成長',diff(currentStock,stockAnnualBase),january?`基準：本月投入＋${monthLabel(january.month)}總成長`:'無 1 月資料'),metric('扣除質押後股票部位成長',diff(currentNetStock,stockAnnualBase),january?'扣債務後部位；基準同上':'無 1 月資料'),metric('股票部位年度績效',stockAnnualBase?pct((currentNetStock-stockAnnualBase)/stockAnnualBase):'—',january?'扣債務後部位相對年度基準':'無 1 月資料'),metric('股票部位總成長',money(currentStock-investment),'較當月總投入金額'),metric('扣除質押後股票部位總成長',money(currentNetStock-investment),'股票部位−債務−總投入'),metric('股票部位總績效',investment?pct((currentNetStock-investment)/investment):'—','扣債務股票部位相對總投入金額')].join('')}

// Version 12: keep dashboard summary aligned with the monthly-record overview summary.
function summaryMetricsV12(c,totalInvestment){return`${metric('總資產',money(c.assets),`含債務 ${money(c.debt)}`,true)}${metric('淨資產',money(c.net),'總資產 − 債務金額')}${metric('粗估累積花費',money(accruedSalary()-c.assets),'累積薪水 − 總資產')}${metric('股票資產金額',money(c.stocks))}${metric('債券資產金額',money(c.bonds))}${metric('證券現金金額',money(c.brokerCash))}${metric('總投入金額',money(totalInvestment),'截至該月份的累積投入本金')}${metric('股票資產占比',pct(c.assets?c.stocks/c.assets:0),money(c.stocks))}${metric('債券資產占比',pct(c.assets?c.bonds/c.assets:0),money(c.bonds))}${metric('現金占比',pct(c.assets?c.cash/c.assets:0),`證券現金 ${money(c.brokerCash)} + 銀行現金 ${money(c.banks)} = 現金總額 ${money(c.cash)}`)}${metric('槓桿比例',pct(c.leverage),`曝險 ${money(c.exposure)}`)}${metric('債務金額',money(c.debt),'該月份債務總額')}${metric('債務比',pct(c.assets?c.debt/c.assets:0),'債務金額 ÷ 總資產金額')}${metric('淨債務比',pct(c.net?c.debt/c.net:0),'債務金額 ÷ 淨資產金額')}${metric('可支配金額',money(c.disposable),'現金 − 債務')}`}
function renderDashboard(){const latest=latestSnapshot(),view=overviewMarkupV3(latest),last=snapshots().at(-1);document.getElementById('headlineMetrics').innerHTML=summaryMetricsV12(view.c,latest.totalInvestment);document.getElementById('detailMetrics').innerHTML=view.detail;document.getElementById('snapshotCaption').textContent=last?`最新資料卡：${monthLabel(last.month)}｜填寫於 ${last.entryDate||'—'}`:'尚未儲存月度資料';renderAllocation(view.c);renderCharts();renderPerformance()}

// Version 13: separate income and spending indicators from asset summary.
function incomeExpenseMetricsV13(c){const salary=accruedSalary(),months=workMonths(),spend=salary-c.assets;return`${metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡')}${metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡起 ${months} 個月`:'尚無資料卡')}${metric('粗估累積花費',money(spend),'累積薪水 − 總資產')}`}
function summaryMetricsV12(c,totalInvestment){return`${metric('總資產',money(c.assets),`含債務 ${money(c.debt)}`,true)}${metric('淨資產',money(c.net),'總資產 − 債務金額')}${metric('股票資產金額',money(c.stocks))}${metric('債券資產金額',money(c.bonds))}${metric('證券現金金額',money(c.brokerCash))}${metric('總投入金額',money(totalInvestment),'截至該月份的累積投入本金')}${metric('股票資產占比',pct(c.assets?c.stocks/c.assets:0),money(c.stocks))}${metric('債券資產占比',pct(c.assets?c.bonds/c.assets:0),money(c.bonds))}${metric('現金占比',pct(c.assets?c.cash/c.assets:0),`證券現金 ${money(c.brokerCash)} + 銀行現金 ${money(c.banks)} = 現金總額 ${money(c.cash)}`)}${metric('槓桿比例',pct(c.leverage),`曝險 ${money(c.exposure)}`)}${metric('債務金額',money(c.debt),'該月份債務總額')}${metric('債務比',pct(c.assets?c.debt/c.assets:0),'債務金額 ÷ 總資產金額')}${metric('淨債務比',pct(c.net?c.debt/c.net:0),'債務金額 ÷ 淨資產金額')}${metric('可支配金額',money(c.disposable),'現金 − 債務')}`}
function renderDashboard(){const latest=latestSnapshot(),view=overviewMarkupV3(latest),last=snapshots().at(-1);document.getElementById('headlineMetrics').innerHTML=summaryMetricsV12(view.c,latest.totalInvestment);document.getElementById('incomeExpenseMetrics').innerHTML=incomeExpenseMetricsV13(view.c);document.getElementById('detailMetrics').innerHTML=view.detail;document.getElementById('snapshotCaption').textContent=last?`最新資料卡：${monthLabel(last.month)}｜填寫於 ${last.entryDate||'—'}`:'尚未儲存月度資料';renderAllocation(view.c);renderCharts();renderPerformance()}

// Version 14: render the monthly-record asset allocation with the same donut chart as dashboard.
function renderRecordAllocationV14(c){const canvas=document.getElementById('recordAllocationChart');if(!canvas)return;const view=allocationV3(c);charts.recordAllocation?.destroy();charts.recordAllocation=new Chart(canvas,{type:'doughnut',data:{labels:view.items.map(x=>x[0]),datasets:[{data:view.items.map(x=>x[1]),backgroundColor:view.items.map(x=>x[2]),borderWidth:0}]},options:{cutout:'72%',plugins:{legend:{display:false},tooltip:{callbacks:{label:x=>`${x.label}：${money(x.raw)}`}}}}})}

// Version 14.1: restore all four metrics in the dedicated income and spending section.
function incomeExpenseMetricsV13(c){const salary=accruedSalary(),months=workMonths(),spend=salary-c.assets;return`${metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡')}${metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡起 ${months} 個月`:'尚無資料卡')}${metric('粗估累積花費',money(spend),'累積薪水 − 總資產')}${metric('平均月花費',months?money(spend/months):'—',months?'粗估累積花費 ÷ 工作月數':'尚無資料卡')}`}

// Version 15: render monthly-record assets as a transaction-level heatmap.
function heatmapV15(s){const colorByType={aggressive:'#147550',conservative:'#63a883',leveraged:'#9a5ba0',longBond:'#24587e',shortBond:'#7faed1',bank:'#a96e1b',broker:'#e3bb4d'},entries=[...(s.holdings||[]).map(item=>({title:item.name||'未命名證券',subtitle:'證券資產｜'+categoryNameV3(item.category),amount:num(item.amount),type:item.category||'aggressive'})),...(s.banks||[]).map(item=>({title:item.name||'未命名銀行帳戶',subtitle:'銀行帳戶｜銀行現金',amount:num(item.amount),type:'bank'})),...(s.brokerCash||[]).map(item=>({title:item.name||'未命名證券戶',subtitle:'證券資產｜證券戶現金',amount:num(item.amount),type:'broker'}))].filter(item=>item.amount>0);if(!entries.length)return'<p class="muted">此月份尚無金額大於 0 的證券資產、銀行帳戶或證券戶現金資料。</p>';const legend=[...new Map(entries.map(item=>[item.type,item])).values()].map(item=>'<span class="heatmap-legend-item"><i style="--legend-color:'+(colorByType[item.type]||'#6c7b73')+'"></i>'+item.subtitle+'</span>').join(''),total=entries.reduce((sum,item)=>sum+item.amount,0),items=entries.sort((a,b)=>b.amount-a.amount).map(item=>({...item,area:item.amount/total*600000})),remaining={x:0,y:0,w:1000,h:600},tiles=[];let row=[];const worst=(cells,side)=>{if(!cells.length)return Infinity;const sum=cells.reduce((n,item)=>n+item.area,0),max=Math.max(...cells.map(item=>item.area)),min=Math.min(...cells.map(item=>item.area));return Math.max(side*side*max/(sum*sum),sum*sum/(side*side*min))};const commit=()=>{const sum=row.reduce((n,item)=>n+item.area,0);if(remaining.w>=remaining.h){const width=sum/remaining.h;let y=remaining.y;row.forEach(item=>{const height=item.area/width;tiles.push({...item,x:remaining.x,y,w:width,h:height});y+=height});remaining.x+=width;remaining.w-=width}else{const height=sum/remaining.w;let x=remaining.x;row.forEach(item=>{const width=item.area/height;tiles.push({...item,x,y:remaining.y,w:width,h:height});x+=width});remaining.y+=height;remaining.h-=height}row=[]};items.forEach(item=>{const side=Math.min(remaining.w,remaining.h);if(!row.length||worst(row,side)>=worst([...row,item],side))row.push(item);else{commit();row.push(item)}});if(row.length)commit();const cells=tiles.map(item=>{const font=Math.min(30,Math.max(9,Math.sqrt(item.w*item.h)/5.8)),tiny=item.w<38||item.h<28,left=Math.max(0,Math.min(100,item.x/10)),top=Math.max(0,Math.min(100,item.y/6)),width=Math.max(0,Math.min(item.w/10,100-left)),height=Math.max(0,Math.min(item.h/6,100-top));return'<article class="heatmap-cell '+(tiny?'heatmap-tiny':'')+'" style="--heat-color:'+(colorByType[item.type]||'#6c7b73')+';--name-size:'+font.toFixed(1)+'px;left:'+left+'%;top:'+top+'%;width:'+width+'%;height:'+height+'%"><strong class="heatmap-name">'+item.title+'</strong><div class="heatmap-tooltip"><strong class="heatmap-tooltip-title">'+item.subtitle+'</strong><span class="heatmap-tooltip-name">'+item.title+'</span><span class="heatmap-tooltip-value"><i></i>'+money(item.amount)+'</span><span class="heatmap-tooltip-percent">占總資產 '+pct(item.amount/total)+'</span></div></article>'}).join('');return'<div class="heatmap-legend">'+legend+'</div><div class="heatmap-treemap">'+cells+'</div>'}

// Version 16: keep the treemap clipped while showing the hover tooltip in a page-level layer.
function setupHeatmapTooltipsV16(host){let tip=document.getElementById('heatmapFloatingTooltip');if(!tip){tip=document.createElement('div');tip.id='heatmapFloatingTooltip';tip.className='heatmap-floating-tooltip';tip.hidden=true;document.body.append(tip)}const move=(event,cell)=>{const gap=14;tip.style.setProperty('--heat-color',getComputedStyle(cell).getPropertyValue('--heat-color'));let x=event.clientX+gap,y=event.clientY+gap;const rect=tip.getBoundingClientRect();if(x+rect.width>window.innerWidth-8)x=event.clientX-rect.width-gap;if(y+rect.height>window.innerHeight-8)y=event.clientY-rect.height-gap;tip.style.left=x+'px';tip.style.top=y+'px'};host.querySelectorAll('.heatmap-cell').forEach(cell=>{const source=cell.querySelector('.heatmap-tooltip');cell.addEventListener('pointerenter',event=>{tip.innerHTML=source.innerHTML;tip.hidden=false;move(event,cell)});cell.addEventListener('pointermove',event=>move(event,cell));cell.addEventListener('pointerleave',()=>{tip.hidden=true})})}
// Version 17: always dismiss the floating tooltip when the pointer leaves the treemap.
function setupHeatmapTooltipsV16(host){let tip=document.getElementById('heatmapFloatingTooltip');if(!tip){tip=document.createElement('div');tip.id='heatmapFloatingTooltip';tip.className='heatmap-floating-tooltip';tip.hidden=true;document.body.append(tip)}if(!tip.dataset.dismissBound){document.addEventListener('pointermove',event=>{if(!event.target.closest('.heatmap-treemap'))tip.hidden=true});tip.dataset.dismissBound='1'}const hide=()=>{tip.hidden=true},move=(event,cell)=>{const gap=14;tip.style.setProperty('--heat-color',getComputedStyle(cell).getPropertyValue('--heat-color'));let x=event.clientX+gap,y=event.clientY+gap;const rect=tip.getBoundingClientRect();if(x+rect.width>window.innerWidth-8)x=event.clientX-rect.width-gap;if(y+rect.height>window.innerHeight-8)y=event.clientY-rect.height-gap;tip.style.left=x+'px';tip.style.top=y+'px'};host.querySelector('.heatmap-treemap')?.addEventListener('pointerleave',hide);host.querySelectorAll('.heatmap-cell').forEach(cell=>{const source=cell.querySelector('.heatmap-tooltip');cell.addEventListener('pointerenter',event=>{tip.innerHTML=source.innerHTML;tip.hidden=false;move(event,cell)});cell.addEventListener('pointermove',event=>move(event,cell));cell.addEventListener('pointerleave',hide)})}
// Version 18: use the treemap legend as a category filter.
function heatmapV15(s){const colorByType={aggressive:'#147550',conservative:'#63a883',leveraged:'#9a5ba0',longBond:'#24587e',shortBond:'#7faed1',bank:'#a96e1b',broker:'#e3bb4d'},allEntries=[...(s.holdings||[]).map(item=>({title:item.name||'未命名證券',subtitle:'證券資產｜'+categoryNameV3(item.category),amount:num(item.amount),type:item.category||'aggressive'})),...(s.banks||[]).map(item=>({title:item.name||'未命名銀行帳戶',subtitle:'銀行帳戶｜銀行現金',amount:num(item.amount),type:'bank'})),...(s.brokerCash||[]).map(item=>({title:item.name||'未命名證券戶',subtitle:'證券資產｜證券戶現金',amount:num(item.amount),type:'broker'}))].filter(item=>item.amount>0);if(!allEntries.length)return'<p class="muted">此月份尚無金額大於 0 的證券資產、銀行帳戶或證券戶現金資料。</p>';const types=[...new Map(allEntries.map(item=>[item.type,item])).values()];if(!window.heatmapFiltersV18)window.heatmapFiltersV18=new Set(types.map(item=>item.type));const selected=window.heatmapFiltersV18,legend=types.map(item=>'<button type="button" class="heatmap-legend-item '+(selected.has(item.type)?'':'is-off')+'" data-heatmap-type="'+item.type+'" aria-pressed="'+selected.has(item.type)+'"><i style="--legend-color:'+(colorByType[item.type]||'#6c7b73')+'"></i>'+item.subtitle+'</button>').join(''),entries=allEntries.filter(item=>selected.has(item.type));if(!entries.length)return'<div class="heatmap-legend">'+legend+'</div><p class="muted heatmap-empty">請至少開啟一個圖例類別。</p>';const total=entries.reduce((sum,item)=>sum+item.amount,0),items=entries.sort((a,b)=>b.amount-a.amount).map(item=>({...item,area:item.amount/total*600000})),remaining={x:0,y:0,w:1000,h:600},tiles=[];let row=[];const worst=(cells,side)=>{if(!cells.length)return Infinity;const sum=cells.reduce((n,item)=>n+item.area,0),max=Math.max(...cells.map(item=>item.area)),min=Math.min(...cells.map(item=>item.area));return Math.max(side*side*max/(sum*sum),sum*sum/(side*side*min))};const commit=()=>{const sum=row.reduce((n,item)=>n+item.area,0);if(remaining.w>=remaining.h){const width=sum/remaining.h;let y=remaining.y;row.forEach(item=>{const height=item.area/width;tiles.push({...item,x:remaining.x,y,w:width,h:height});y+=height});remaining.x+=width;remaining.w-=width}else{const height=sum/remaining.w;let x=remaining.x;row.forEach(item=>{const width=item.area/height;tiles.push({...item,x,y:remaining.y,w:width,h:height});x+=width});remaining.y+=height;remaining.h-=height}row=[]};items.forEach(item=>{const side=Math.min(remaining.w,remaining.h);if(!row.length||worst(row,side)>=worst([...row,item],side))row.push(item);else{commit();row.push(item)}});if(row.length)commit();const cells=tiles.map(item=>{const font=Math.min(30,Math.max(9,Math.sqrt(item.w*item.h)/5.8)),tiny=item.w<38||item.h<28,left=Math.max(0,Math.min(100,item.x/10)),top=Math.max(0,Math.min(100,item.y/6)),width=Math.max(0,Math.min(item.w/10,100-left)),height=Math.max(0,Math.min(item.h/6,100-top));return'<article class="heatmap-cell '+(tiny?'heatmap-tiny':'')+'" style="--heat-color:'+(colorByType[item.type]||'#6c7b73')+';--name-size:'+font.toFixed(1)+'px;left:'+left+'%;top:'+top+'%;width:'+width+'%;height:'+height+'%"><strong class="heatmap-name">'+item.title+'</strong><div class="heatmap-tooltip"><strong class="heatmap-tooltip-title">'+item.subtitle+'</strong><span class="heatmap-tooltip-name">'+item.title+'</span><span class="heatmap-tooltip-value"><i></i>'+money(item.amount)+'</span><span class="heatmap-tooltip-percent">占顯示資產 '+pct(item.amount/total)+'</span></div></article>'}).join('');return'<div class="heatmap-legend">'+legend+'</div><div class="heatmap-treemap">'+cells+'</div>'}

function setupHeatmapTooltipsV16(host){let tip=document.getElementById('heatmapFloatingTooltip');if(!tip){tip=document.createElement('div');tip.id='heatmapFloatingTooltip';tip.className='heatmap-floating-tooltip';tip.hidden=true;document.body.append(tip)}if(!tip.dataset.dismissBound){document.addEventListener('pointermove',event=>{if(!event.target.closest('.heatmap-treemap'))tip.hidden=true});tip.dataset.dismissBound='1'}host.querySelectorAll('[data-heatmap-type]').forEach(button=>button.addEventListener('click',()=>{const selected=window.heatmapFiltersV18||(window.heatmapFiltersV18=new Set()),type=button.dataset.heatmapType;selected.has(type)?selected.delete(type):selected.add(type);tip.hidden=true;renderRecord()}));const hide=()=>{tip.hidden=true},move=(event,cell)=>{const gap=14;tip.style.setProperty('--heat-color',getComputedStyle(cell).getPropertyValue('--heat-color'));let x=event.clientX+gap,y=event.clientY+gap;const rect=tip.getBoundingClientRect();if(x+rect.width>window.innerWidth-8)x=event.clientX-rect.width-gap;if(y+rect.height>window.innerHeight-8)y=event.clientY-rect.height-gap;tip.style.left=x+'px';tip.style.top=y+'px'};host.querySelector('.heatmap-treemap')?.addEventListener('pointerleave',hide);host.querySelectorAll('.heatmap-cell').forEach(cell=>{const source=cell.querySelector('.heatmap-tooltip');cell.addEventListener('pointerenter',event=>{tip.innerHTML=source.innerHTML;tip.hidden=false;move(event,cell)});cell.addEventListener('pointermove',event=>move(event,cell));cell.addEventListener('pointerleave',hide)})}
// Clear all data saved by this application in the current browser/origin.
document.getElementById('clearAllDataBtn').addEventListener('click',()=>{if(!confirm('確定要清除這個瀏覽器中所有月度資料、賣出紀錄與目前填寫內容嗎？此動作無法復原，建議先匯出備份。'))return;localStorage.removeItem(STORAGE_KEY);localStorage.removeItem('finance-compass-v1');localStorage.removeItem(AMOUNT_MASK_KEY);delete window.heatmapFiltersV18;location.reload()});
// Version 19: dynamic review page with shared month range and smooth playback.
function reviewStateV19(){return window.dynamicReviewV19||(window.dynamicReviewV19={charts:{},timer:null,frame:0,panels:['allocation','ratio','history','heatmap'],playing:[]})}
function reviewRowsV19(){const start=document.getElementById('reviewStartMonth')?.value||'',end=document.getElementById('reviewEndMonth')?.value||'';return snapshots().filter(s=>(!start||s.month>=start)&&(!end||s.month<=end))}
function reviewLegendClickV19(event,item,legend){if(reviewStateV19().timer)return;Chart.defaults.plugins.legend.onClick(event,item,legend)}
function reviewOptionsV19(percent){return{responsive:true,maintainAspectRatio:false,animation:{duration:620,easing:'easeOutQuart'},interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:16},onClick:reviewLegendClickV19},tooltip:{callbacks:{label:x=>x.dataset&&x.dataset.type==='line'?x.dataset.label+'：'+money(x.parsed.y):x.dataset?x.dataset.label+'：'+(percent?x.parsed.y.toFixed(1)+'%':money(x.parsed.y)):x.label+'：'+money(x.raw)}}},scales:percent?{x:{grid:{display:false}},y:{beginAtZero:true,max:100,ticks:{callback:x=>x+'%'}}}:{x:{stacked:true,grid:{display:false}},yBars:{stacked:true,beginAtZero:true,min:0,position:'left',ticks:{callback:x=>axisMoney(x)}},yLines:{stacked:false,beginAtZero:true,min:0,position:'right',grid:{drawOnChartArea:false},ticks:{callback:x=>axisMoney(x)}}}}}
function reviewMaxV19(rows){const max=Math.max(0,...rows.map(s=>{const c=compute(s);return Math.max(c.assets,c.net,c.stocks+c.bonds+c.brokerCash)}),...rows.map(s=>num(s.totalInvestment)));return Math.max(1000000,Math.ceil(max*1.2/1000000)*1000000)}
function reviewUpsertChartV19(name,id,config){const state=reviewStateV19(),canvas=document.getElementById(id),old=state.charts[name];if(!canvas)return;if(!old){state.charts[name]=new Chart(canvas,config);return}old.data.labels=config.data.labels;old.data.datasets=config.data.datasets;old.options=config.options;old.update()}
function renderReviewAllocationV19(snapshot){const c=compute(snapshot),view=allocationV3(c);reviewUpsertChartV19('allocation','reviewAllocationChart',{type:'doughnut',data:{labels:view.items.map(x=>x[0]),datasets:[{data:view.items.map(x=>x[1]),backgroundColor:view.items.map(x=>x[2]),borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,animation:{duration:620,easing:'easeOutQuart'},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:16},onClick:reviewLegendClickV19},tooltip:{callbacks:{label:x=>x.label+'：'+money(x.raw)}}},cutout:'62%'}})}
function renderReviewRatioV19(rows,frame){const labels=rows.map(x=>monthLabel(x.month)),visible=rows.map((s,index)=>index<=frame?compute(s):null);reviewUpsertChartV19('ratio','reviewRatioChart',{type:'line',data:{labels,datasets:[['股票','stocks',COLORS.stocks],['債券','bonds',COLORS.bonds],['現金','cash',COLORS.cash]].map(item=>({label:item[0],data:visible.map(c=>c&&c.assets?c[item[1]]/c.assets*100:null),borderColor:item[2],backgroundColor:item[2],tension:.28,pointRadius:3,spanGaps:false}))},options:reviewOptionsV19(true)})}
function renderReviewHistoryV19(rows,frame){const labels=rows.map(x=>monthLabel(x.month)),all=snapshots(),start=rows[0]?.month||'',priorSalary=all.filter(x=>x.month<start).reduce((sum,x)=>sum+num(x.salary),0);let salary=priorSalary,lastInvestment=all.filter(x=>x.month<start).at(-1)?.totalInvestment||null;const values=rows.map((s,index)=>{const c=compute(s);salary+=num(s.salary);if(s.totalInvestment!==undefined&&s.totalInvestment!=='')lastInvestment=num(s.totalInvestment);return index<=frame?{c,salary,investment:lastInvestment}:null}),maximum=reviewMaxV19(rows),options=reviewOptionsV19(false);options.scales.yBars.max=maximum;options.scales.yLines.max=maximum;reviewUpsertChartV19('history','reviewHistoryChart',{data:{labels,datasets:[{type:'bar',label:'股票',data:values.map(v=>v?v.c.stocks:null),backgroundColor:COLORS.stocks,stack:'asset',yAxisID:'yBars',order:2},{type:'bar',label:'債券',data:values.map(v=>v?v.c.bonds:null),backgroundColor:COLORS.bonds,stack:'asset',yAxisID:'yBars',order:2},{type:'bar',label:'證券現金',data:values.map(v=>v?v.c.brokerCash:null),backgroundColor:'#e3bb4d',stack:'asset',yAxisID:'yBars',order:2},{type:'bar',label:'銀行現金',data:values.map(v=>v?v.c.banks:null),backgroundColor:COLORS.cash,stack:'asset',yAxisID:'yBars',order:2},{type:'line',label:'總資產',data:values.map(v=>v?v.c.assets:null),borderColor:'#14251e',backgroundColor:'#14251e',tension:.25,pointRadius:3,yAxisID:'yLines',order:1},{type:'line',label:'淨資產',data:values.map(v=>v?v.c.net:null),borderColor:'#1b778f',backgroundColor:'#1b778f',tension:.25,pointRadius:3,yAxisID:'yLines',order:1},{type:'line',label:'累積薪水',data:values.map(v=>v?v.salary:null),borderColor:'#73589d',backgroundColor:'#73589d',tension:.25,pointRadius:3,yAxisID:'yLines',order:1},{type:'line',label:'總投入金額',data:values.map(v=>v?v.investment:null),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,yAxisID:'yLines',order:1}]},options})}
function renderReviewHeatmapV19(snapshot){const host=document.getElementById('reviewHeatmap');if(!host)return;host.dataset.reviewHeatmap='true';host.innerHTML=heatmapV15(snapshot);setupHeatmapTooltipsV16(host)}
function renderDynamicReviewV19(frame,only){const rows=reviewRowsV19(),state=reviewStateV19();if(!rows.length){document.getElementById('reviewStatus').textContent='請先儲存至少一筆月度資料。';return}const safeFrame=Math.max(0,Math.min(frame===undefined?rows.length-1:frame,rows.length-1)),snapshot=rows[safeFrame],panels=only||state.panels;state.frame=safeFrame;if(panels.includes('allocation'))renderReviewAllocationV19(snapshot);if(panels.includes('ratio'))renderReviewRatioV19(rows,safeFrame);if(panels.includes('history'))renderReviewHistoryV19(rows,safeFrame);if(panels.includes('heatmap'))renderReviewHeatmapV19(snapshot);document.getElementById('reviewStatus').textContent='回顧月份：'+monthLabel(snapshot.month)+'（'+(safeFrame+1)+' / '+rows.length+'）'}
function updateReviewPlaybackUiV19(){const state=reviewStateV19(),running=!!state.timer;document.getElementById('review').classList.toggle('is-playing',running);document.querySelectorAll('[data-review-play]').forEach(button=>{const active=running&&state.playing.includes(button.dataset.reviewPlay);button.textContent=active?'❚❚ 暫停':'▶ 播放';button.closest('.review-card').classList.toggle('is-playing',active)});const all=document.getElementById('reviewPlayAll');all.textContent=running&&state.playing.length===state.panels.length?'❚❚ 全部暫停':'▶ 全部播放'}
function stopReviewPlaybackV19(){const state=reviewStateV19();if(state.timer)clearInterval(state.timer);state.timer=null;state.playing=[];updateReviewPlaybackUiV19()}
function playReviewV19(panels){const state=reviewStateV19(),rows=reviewRowsV19();if(!rows.length)return;if(state.timer){stopReviewPlaybackV19();return}state.playing=panels;state.frame=0;renderDynamicReviewV19(0,panels);updateReviewPlaybackUiV19();state.timer=setInterval(()=>{state.frame++;if(state.frame>=rows.length){stopReviewPlaybackV19();return}renderDynamicReviewV19(state.frame,panels)},850)}
function initDynamicReviewV19(){const start=document.getElementById('reviewStartMonth'),end=document.getElementById('reviewEndMonth');if(!start||!end)return;const fill=()=>{const rows=snapshots(),previousStart=start.value,previousEnd=end.value,options=rows.map(s=>'<option value="'+s.month+'">'+monthLabel(s.month)+'</option>').join('');start.innerHTML=options;end.innerHTML=options;start.value=rows.some(s=>s.month===previousStart)?previousStart:rows[0]?.month||'';end.value=rows.some(s=>s.month===previousEnd)?previousEnd:rows.at(-1)?.month||'';renderDynamicReviewV19()};start.addEventListener('change',()=>{if(end.value&&start.value>end.value)end.value=start.value;stopReviewPlaybackV19();renderDynamicReviewV19()});end.addEventListener('change',()=>{if(start.value&&end.value<start.value)start.value=end.value;stopReviewPlaybackV19();renderDynamicReviewV19()});document.querySelectorAll('[data-review-play]').forEach(button=>button.addEventListener('click',()=>playReviewV19([button.dataset.reviewPlay])));document.getElementById('reviewPlayAll').addEventListener('click',()=>playReviewV19(reviewStateV19().panels));window.refreshDynamicReviewV19=fill;fill()}
function setupHeatmapTooltipsV16(host){let tip=document.getElementById('heatmapFloatingTooltip');if(!tip){tip=document.createElement('div');tip.id='heatmapFloatingTooltip';tip.className='heatmap-floating-tooltip';tip.hidden=true;document.body.append(tip)}if(!tip.dataset.dismissBound){document.addEventListener('pointermove',event=>{if(!event.target.closest('.heatmap-treemap'))tip.hidden=true});tip.dataset.dismissBound='1'}const isReview=host.dataset.reviewHeatmap==='true';host.querySelectorAll('[data-heatmap-type]').forEach(button=>button.addEventListener('click',()=>{if(reviewStateV19().timer)return;const selected=window.heatmapFiltersV18||(window.heatmapFiltersV18=new Set()),type=button.dataset.heatmapType;selected.has(type)?selected.delete(type):selected.add(type);tip.hidden=true;if(isReview)renderDynamicReviewV19(reviewStateV19().frame);else renderRecord()}));const hide=()=>{tip.hidden=true},move=(event,cell)=>{const gap=14;tip.style.setProperty('--heat-color',getComputedStyle(cell).getPropertyValue('--heat-color'));let x=event.clientX+gap,y=event.clientY+gap;const rect=tip.getBoundingClientRect();if(x+rect.width>window.innerWidth-8)x=event.clientX-rect.width-gap;if(y+rect.height>window.innerHeight-8)y=event.clientY-rect.height-gap;tip.style.left=x+'px';tip.style.top=y+'px'};host.querySelector('.heatmap-treemap')?.addEventListener('pointerleave',hide);host.querySelectorAll('.heatmap-cell').forEach(cell=>{const source=cell.querySelector('.heatmap-tooltip');cell.addEventListener('pointerenter',event=>{tip.innerHTML=source.innerHTML;tip.hidden=false;move(event,cell)});cell.addEventListener('pointermove',event=>move(event,cell));cell.addEventListener('pointerleave',hide)})}
initDynamicReviewV19();
// Keep dynamic-review month selectors in sync after saving or importing local data.
function saveSnapshot(){if(!state.current.month)return alert('請選擇資料月份。');if(!state.current.entryDate)state.current.entryDate=today();const copy=structuredClone(state.current),i=state.snapshots.findIndex(s=>s.month===copy.month);if(i>=0)state.snapshots[i]=copy;else state.snapshots.push(copy);state.snapshots.sort((a,b)=>a.month.localeCompare(b.month));save();renderDashboard();renderRecordSelector();window.refreshDynamicReviewV19?.();alert(monthLabel(copy.month)+' 的月度資料已儲存。')}
function hydrate(){renderInput();renderDashboard();renderRecordSelector();window.refreshDynamicReviewV19?.()}
// Include cumulative income when fixing the dynamic-review Y-axis range.
function reviewMaxV19(rows){const start=rows[0]?.month||'',all=snapshots(),priorSalary=all.filter(x=>x.month<start).reduce((sum,x)=>sum+num(x.salary),0);let salary=priorSalary,max=0;rows.forEach(s=>{const c=compute(s);salary+=num(s.salary);max=Math.max(max,c.assets,c.net,c.stocks+c.bonds+c.brokerCash,num(s.totalInvestment),salary)});return Math.max(1000000,Math.ceil(max*1.2/1000000)*1000000)}
// Version 20: playback speed, scrubber, full heatmap legend, and continuous chart updates.
function heatmapEntriesV20(s){return[...(s.holdings||[]).map(item=>({title:item.name||'未命名證券',subtitle:'證券資產｜'+categoryNameV3(item.category),amount:num(item.amount),type:item.category||'aggressive'})),...(s.banks||[]).map(item=>({title:item.name||'未命名銀行帳戶',subtitle:'銀行帳戶｜銀行現金',amount:num(item.amount),type:'bank'})),...(s.brokerCash||[]).map(item=>({title:item.name||'未命名證券戶',subtitle:'證券資產｜證券戶現金',amount:num(item.amount),type:'broker'}))].filter(item=>item.amount>0)}
function heatmapLayoutV20(items){const remaining={x:0,y:0,w:1000,h:600},tiles=[];let row=[];const worst=(cells,side)=>{if(!cells.length)return Infinity;const sum=cells.reduce((n,item)=>n+item.area,0),max=Math.max(...cells.map(item=>item.area)),min=Math.min(...cells.map(item=>item.area));return Math.max(side*side*max/(sum*sum),sum*sum/(side*side*min))},commit=()=>{const sum=row.reduce((n,item)=>n+item.area,0);if(remaining.w>=remaining.h){const width=sum/remaining.h;let y=remaining.y;row.forEach(item=>{const height=item.area/width;tiles.push({...item,x:remaining.x,y,w:width,h:height});y+=height});remaining.x+=width;remaining.w-=width}else{const height=sum/remaining.w;let x=remaining.x;row.forEach(item=>{const width=item.area/height;tiles.push({...item,x,y:remaining.y,w:width,h:height});x+=width});remaining.y+=height;remaining.h-=height}row=[]};items.forEach(item=>{const side=Math.min(remaining.w,remaining.h);if(!row.length||worst(row,side)>=worst([...row,item],side))row.push(item);else{commit();row.push(item)}});if(row.length)commit();return tiles}
function heatmapV15(s){const colorByType={aggressive:'#147550',conservative:'#63a883',leveraged:'#9a5ba0',longBond:'#24587e',shortBond:'#7faed1',bank:'#a96e1b',broker:'#e3bb4d'},types=[{type:'aggressive',subtitle:'證券資產｜積極型'},{type:'conservative',subtitle:'證券資產｜保守型'},{type:'leveraged',subtitle:'證券資產｜槓桿型'},{type:'longBond',subtitle:'證券資產｜長債'},{type:'shortBond',subtitle:'證券資產｜短債'},{type:'bank',subtitle:'銀行帳戶｜銀行現金'},{type:'broker',subtitle:'證券資產｜證券戶現金'}],allEntries=heatmapEntriesV20(s);if(!window.heatmapFiltersV18)window.heatmapFiltersV18=new Set(types.map(item=>item.type));const selected=window.heatmapFiltersV18,legend=types.map(item=>'<button type="button" class="heatmap-legend-item '+(selected.has(item.type)?'':'is-off')+'" data-heatmap-type="'+item.type+'" aria-pressed="'+selected.has(item.type)+'"><i style="--legend-color:'+(colorByType[item.type]||'#6c7b73')+'"></i>'+item.subtitle+'</button>').join(''),entries=allEntries.filter(item=>selected.has(item.type));if(!entries.length)return'<div class="heatmap-legend">'+legend+'</div><p class="muted heatmap-empty">目前篩選類別在此月份沒有可呈現的資產資料。</p>';const total=entries.reduce((sum,item)=>sum+item.amount,0),tiles=heatmapGroupedLayoutV31(entries,total),cells=tiles.map(item=>{const font=Math.min(30,Math.max(9,Math.sqrt(item.w*item.h)/5.8)),tiny=item.w<38||item.h<28,left=Math.max(0,Math.min(100,item.x/10)),top=Math.max(0,Math.min(100,item.y/6)),width=Math.max(0,Math.min(item.w/10,100-left)),height=Math.max(0,Math.min(item.h/6,100-top));return'<article class="heatmap-cell '+(tiny?'heatmap-tiny':'')+'" style="--heat-color:'+(colorByType[item.type]||'#6c7b73')+';--name-size:'+font.toFixed(1)+'px;left:'+left+'%;top:'+top+'%;width:'+width+'%;height:'+height+'%"><strong class="heatmap-name">'+item.title+'</strong><div class="heatmap-tooltip"><strong class="heatmap-tooltip-title">'+item.subtitle+'</strong><span class="heatmap-tooltip-name">'+item.title+'</span><span class="heatmap-tooltip-value"><i></i>'+money(item.amount)+'</span><span class="heatmap-tooltip-percent">占顯示資產 '+pct(item.amount/total)+'</span></div></article>'}).join('');return'<div class="heatmap-legend">'+legend+'</div><div class="heatmap-treemap">'+cells+'</div>'}
function reviewStateV19(){const state=window.dynamicReviewV19||(window.dynamicReviewV19={charts:{},timer:null,frame:0,panels:['allocation','ratio','history','heatmap'],playing:[],speed:850});if(!state.speed)state.speed=850;return state}
function reviewUpsertChartV19(name,id,config){const state=reviewStateV19(),canvas=document.getElementById(id),old=state.charts[name];if(!canvas)return;if(!old){state.charts[name]=new Chart(canvas,config);return}const visibility=old.data.datasets.map((dataset,index)=>old.isDatasetVisible(index));old.data.labels=config.data.labels;old.data.datasets=config.data.datasets;old.options=config.options;old.data.datasets.forEach((dataset,index)=>old.setDatasetVisibility(index,visibility[index]!==false));old.update()}
function renderDynamicReviewV19(frame,only){const rows=reviewRowsV19(),state=reviewStateV19(),progress=document.getElementById('reviewProgress'),progressText=document.getElementById('reviewProgressText');if(!rows.length){document.getElementById('reviewStatus').textContent='請先儲存至少一筆月度資料。';if(progress){progress.max=0;progress.value=0}if(progressText)progressText.textContent='—';return}const safeFrame=Math.max(0,Math.min(frame===undefined?rows.length-1:frame,rows.length-1)),snapshot=rows[safeFrame],panels=only||state.panels;state.frame=safeFrame;if(progress){progress.max=Math.max(0,rows.length-1);progress.value=safeFrame}if(progressText)progressText.textContent=(safeFrame+1)+' / '+rows.length;if(panels.includes('allocation'))renderReviewAllocationV19(snapshot);if(panels.includes('ratio'))renderReviewRatioV19(rows,safeFrame);if(panels.includes('history'))renderReviewHistoryV19(rows,safeFrame);if(panels.includes('heatmap'))renderReviewHeatmapV19(snapshot);document.getElementById('reviewStatus').textContent='回顧月份：'+monthLabel(snapshot.month)+'（'+(safeFrame+1)+' / '+rows.length+'）'}
function scheduleReviewV20(){const state=reviewStateV19(),rows=reviewRowsV19();if(state.timer)clearInterval(state.timer);state.timer=setInterval(()=>{state.frame++;if(state.frame>=rows.length){stopReviewPlaybackV19();return}renderDynamicReviewV19(state.frame,state.playing)},state.speed)}
function playReviewV19(panels){const state=reviewStateV19(),rows=reviewRowsV19();if(!rows.length)return;if(state.timer){stopReviewPlaybackV19();return}state.playing=panels;state.frame=0;renderDynamicReviewV19(0,panels);updateReviewPlaybackUiV19();scheduleReviewV20()}
function initDynamicReviewV19(){const start=document.getElementById('reviewStartMonth'),end=document.getElementById('reviewEndMonth'),speed=document.getElementById('reviewSpeed'),progress=document.getElementById('reviewProgress');if(!start||!end)return;const fill=()=>{const rows=snapshots(),previousStart=start.value,previousEnd=end.value,options=rows.map(s=>'<option value="'+s.month+'">'+monthLabel(s.month)+'</option>').join('');start.innerHTML=options;end.innerHTML=options;start.value=rows.some(s=>s.month===previousStart)?previousStart:rows[0]?.month||'';end.value=rows.some(s=>s.month===previousEnd)?previousEnd:rows.at(-1)?.month||'';renderDynamicReviewV19()};start.addEventListener('change',()=>{if(end.value&&start.value>end.value)end.value=start.value;stopReviewPlaybackV19();renderDynamicReviewV19()});end.addEventListener('change',()=>{if(start.value&&end.value<start.value)start.value=end.value;stopReviewPlaybackV19();renderDynamicReviewV19()});speed.addEventListener('change',()=>{const state=reviewStateV19();state.speed=Number(speed.value);if(state.timer)scheduleReviewV20()});progress.addEventListener('input',()=>{stopReviewPlaybackV19();renderDynamicReviewV19(Number(progress.value))});document.querySelectorAll('[data-review-play]').forEach(button=>button.addEventListener('click',()=>playReviewV19([button.dataset.reviewPlay])));document.getElementById('reviewPlayAll').addEventListener('click',()=>playReviewV19(reviewStateV19().panels));window.refreshDynamicReviewV19=fill;fill()}
initDynamicReviewV19();
// Guard duplicate historical initialization calls so review controls receive one listener set.
function initDynamicReviewV19(){const start=document.getElementById('reviewStartMonth'),end=document.getElementById('reviewEndMonth'),speed=document.getElementById('reviewSpeed'),progress=document.getElementById('reviewProgress');if(!start||!end||!speed||!progress)return;const fill=()=>{const rows=snapshots(),previousStart=start.value,previousEnd=end.value,options=rows.map(s=>'<option value="'+s.month+'">'+monthLabel(s.month)+'</option>').join('');start.innerHTML=options;end.innerHTML=options;start.value=rows.some(s=>s.month===previousStart)?previousStart:rows[0]?.month||'';end.value=rows.some(s=>s.month===previousEnd)?previousEnd:rows.at(-1)?.month||'';renderDynamicReviewV19()};window.refreshDynamicReviewV19=fill;if(start.dataset.reviewInitialized==='true'){fill();return}start.dataset.reviewInitialized='true';start.addEventListener('change',()=>{if(end.value&&start.value>end.value)end.value=start.value;stopReviewPlaybackV19();renderDynamicReviewV19()});end.addEventListener('change',()=>{if(start.value&&end.value<start.value)start.value=end.value;stopReviewPlaybackV19();renderDynamicReviewV19()});speed.addEventListener('change',()=>{const state=reviewStateV19();state.speed=Number(speed.value);if(state.timer)scheduleReviewV20()});progress.addEventListener('input',()=>{stopReviewPlaybackV19();renderDynamicReviewV19(Number(progress.value))});document.querySelectorAll('[data-review-play]').forEach(button=>button.addEventListener('click',()=>playReviewV19([button.dataset.reviewPlay])));document.getElementById('reviewPlayAll').addEventListener('click',()=>playReviewV19(reviewStateV19().panels));fill()}
// Version 21: individual panel playback speed and scrubbers.
function reviewStateV19(){const state=window.dynamicReviewV19||(window.dynamicReviewV19={charts:{},frame:0,panels:['allocation','ratio','history','heatmap']});state.timers=state.timers||{};state.frames=state.frames||{};state.playing=Object.keys(state.timers).filter(key=>state.timers[key]);return state}
function isReviewPlayingV21(){return Object.values(reviewStateV19().timers).some(Boolean)}
function reviewDelayV21(panel){const input=document.getElementById('reviewSpeed-'+panel),monthsPerSecond=Math.max(.1,Number(input?.value)||1);return Math.max(1,Math.round(1000/monthsPerSecond))}function reviewTransitionDurationV27(panel){return Math.max(1,Math.min(650,Math.floor(reviewDelayV21(panel)*.8)))}
function updateReviewPlaybackUiV19(){const state=reviewStateV19(),running=isReviewPlayingV21();document.getElementById('review').classList.toggle('is-playing',running);document.querySelectorAll('[data-review-play]').forEach(button=>{const panel=button.dataset.reviewPlay,active=!!state.timers[panel];button.textContent=active?'❚❚ 暫停':'▶ 播放';button.closest('.review-card').classList.toggle('is-playing',active)});const all=document.getElementById('reviewPlayAll');all.textContent=running?'❚❚ 全部暫停':'▶ 全部播放'}
function stopReviewPanelV21(panel){const state=reviewStateV19();if(state.timers[panel])clearInterval(state.timers[panel]);delete state.timers[panel];state.playing=Object.keys(state.timers);updateReviewPlaybackUiV19()}
function stopReviewPlaybackV19(){reviewStateV19().panels.forEach(stopReviewPanelV21)}
function renderReviewPanelV21(panel,frame){const rows=reviewRowsV19(),state=reviewStateV19(),progress=document.getElementById('reviewProgress-'+panel),progressText=document.getElementById('reviewProgressText-'+panel),now=document.getElementById('reviewNow-'+panel);if(!rows.length){if(now)now.textContent='目前月份：—';return}const safeFrame=Math.max(0,Math.min(frame===undefined?rows.length-1:frame,rows.length-1)),snapshot=rows[safeFrame];state.frames[panel]=safeFrame;if(progress){progress.max=Math.max(0,rows.length-1);progress.value=safeFrame}if(progressText)progressText.textContent=(safeFrame+1)+' / '+rows.length;if(now)now.textContent='目前月份：'+monthLabel(snapshot.month);if(panel==='allocation')renderReviewAllocationV19(snapshot);if(panel==='ratio')renderReviewRatioV19(rows,safeFrame);if(panel==='history')renderReviewHistoryV19(rows,safeFrame);if(panel==='heatmap')renderReviewHeatmapV19(snapshot)}
function renderDynamicReviewV19(frame,only){const state=reviewStateV19(),panels=only||state.panels,rows=reviewRowsV19();if(!rows.length){document.getElementById('reviewStatus').textContent='請先儲存至少一筆月度資料。';return}panels.forEach(panel=>renderReviewPanelV21(panel,frame===undefined?state.frames[panel]:frame));document.getElementById('reviewStatus').textContent='回顧區間：'+monthLabel(rows[0].month)+' 至 '+monthLabel(rows.at(-1).month)}
function scheduleReviewPanelV21(panel){const state=reviewStateV19(),rows=reviewRowsV19();if(state.timers[panel])clearInterval(state.timers[panel]);state.timers[panel]=setInterval(()=>{const next=(state.frames[panel]??0)+1;if(next>=rows.length){stopReviewPanelV21(panel);return}renderReviewPanelV21(panel,next)},reviewDelayV21(panel))}
function playReviewPanelV21(panel){const state=reviewStateV19(),rows=reviewRowsV19();if(!rows.length)return;if(state.timers[panel]){stopReviewPanelV21(panel);return}renderReviewPanelV21(panel,0);scheduleReviewPanelV21(panel);updateReviewPlaybackUiV19()}
function playAllReviewV21(){const state=reviewStateV19();if(isReviewPlayingV21()){stopReviewPlaybackV19();return}state.panels.forEach(panel=>{renderReviewPanelV21(panel,0);scheduleReviewPanelV21(panel)});updateReviewPlaybackUiV19()}
function reviewLegendClickV19(event,item,legend){if(isReviewPlayingV21())return;Chart.defaults.plugins.legend.onClick(event,item,legend)}
function initDynamicReviewV19(){const start=document.getElementById('reviewStartMonth'),end=document.getElementById('reviewEndMonth');if(!start||!end)return;const fill=()=>{const rows=snapshots(),previousStart=start.value,previousEnd=end.value,options=rows.map(s=>'<option value="'+s.month+'">'+monthLabel(s.month)+'</option>').join('');start.innerHTML=options;end.innerHTML=options;start.value=rows.some(s=>s.month===previousStart)?previousStart:rows[0]?.month||'';end.value=rows.some(s=>s.month===previousEnd)?previousEnd:rows.at(-1)?.month||'';const state=reviewStateV19(),rangeRows=reviewRowsV19();state.panels.forEach(panel=>state.frames[panel]=rangeRows.length?0:0);renderDynamicReviewV19()};window.refreshDynamicReviewV19=fill;if(start.dataset.reviewInitialized==='true'){fill();return}start.dataset.reviewInitialized='true';start.addEventListener('change',()=>{if(end.value&&start.value>end.value)end.value=start.value;stopReviewPlaybackV19();fill()});end.addEventListener('change',()=>{if(start.value&&end.value<start.value)start.value=end.value;stopReviewPlaybackV19();fill()});reviewStateV19().panels.forEach(panel=>{const speed=document.getElementById('reviewSpeed-'+panel),progress=document.getElementById('reviewProgress-'+panel);speed.addEventListener('change',()=>{if(reviewStateV19().timers[panel])scheduleReviewPanelV21(panel)});progress.addEventListener('input',()=>{stopReviewPanelV21(panel);renderReviewPanelV21(panel,Number(progress.value))})});document.querySelectorAll('[data-review-play]').forEach(button=>button.addEventListener('click',()=>playReviewPanelV21(button.dataset.reviewPlay)));document.getElementById('reviewPlayAll').addEventListener('click',playAllReviewV21);fill()}
function setupHeatmapTooltipsV16(host){let tip=document.getElementById('heatmapFloatingTooltip');if(!tip){tip=document.createElement('div');tip.id='heatmapFloatingTooltip';tip.className='heatmap-floating-tooltip';tip.hidden=true;document.body.append(tip)}if(!tip.dataset.dismissBound){document.addEventListener('pointermove',event=>{if(!event.target.closest('.heatmap-treemap'))tip.hidden=true});tip.dataset.dismissBound='1'}const isReview=host.dataset.reviewHeatmap==='true';host.querySelectorAll('[data-heatmap-type]').forEach(button=>button.addEventListener('click',()=>{if(isReviewPlayingV21())return;const selected=window.heatmapFiltersV18||(window.heatmapFiltersV18=new Set()),type=button.dataset.heatmapType;selected.has(type)?selected.delete(type):selected.add(type);tip.hidden=true;if(isReview)renderReviewPanelV21('heatmap',reviewStateV19().frames.heatmap);else renderRecord()}));const hide=()=>{tip.hidden=true},move=(event,cell)=>{const gap=14;tip.style.setProperty('--heat-color',getComputedStyle(cell).getPropertyValue('--heat-color'));let x=event.clientX+gap,y=event.clientY+gap;const rect=tip.getBoundingClientRect();if(x+rect.width>window.innerWidth-8)x=event.clientX-rect.width-gap;if(y+rect.height>window.innerHeight-8)y=event.clientY-rect.height-gap;tip.style.left=x+'px';tip.style.top=y+'px'};host.querySelector('.heatmap-treemap')?.addEventListener('pointerleave',hide);host.querySelectorAll('.heatmap-cell').forEach(cell=>{const source=cell.querySelector('.heatmap-tooltip');cell.addEventListener('pointerenter',event=>{tip.innerHTML=source.innerHTML;tip.hidden=false;move(event,cell)});cell.addEventListener('pointermove',event=>move(event,cell));cell.addEventListener('pointerleave',hide)})}
initDynamicReviewV19();
// Version 22: mutate the existing doughnut dataset so the ring morphs instead of restarting.
function renderReviewAllocationV19(snapshot){const c=compute(snapshot),view=allocationV3(c),state=reviewStateV19(),canvas=document.getElementById('reviewAllocationChart'),existing=state.charts.allocation,labels=view.items.map(x=>x[0]),values=view.items.map(x=>x[1]),colors=view.items.map(x=>x[2]),options={responsive:true,maintainAspectRatio:false,animation:{duration:reviewTransitionDurationV27('allocation'),easing:'easeInOutCubic'},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:16},onClick:reviewAllocationLegendClickV32},tooltip:{callbacks:{label:x=>x.label+'：'+money(x.raw)}}},cutout:'62%'};if(!canvas)return;if(!existing){state.charts.allocation=new Chart(canvas,{type:'doughnut',data:{labels,datasets:[{data:values,backgroundColor:colors,borderWidth:0}]},options});return}existing.data.labels=labels;const dataset=existing.data.datasets[0];dataset.data=values;dataset.backgroundColor=colors;dataset.borderWidth=0;existing.options.animation=options.animation;existing.options.plugins=options.plugins;existing.options.cutout=options.cutout;existing.update()}
// Version 23: preserve history chart state; animate only the newly revealed month.
function renderReviewHistoryV19(rows,frame){
 const labels=rows.map(x=>monthLabel(x.month)),all=snapshots(),start=rows[0]?.month||'',priorSalary=all.filter(x=>x.month<start).reduce((sum,x)=>sum+num(x.salary),0);
 let salary=priorSalary,lastInvestment=all.filter(x=>x.month<start).at(-1)?.totalInvestment||null;
 const values=rows.map((s,index)=>{const c=compute(s);salary+=num(s.salary);if(s.totalInvestment!==undefined&&s.totalInvestment!=='')lastInvestment=num(s.totalInvestment);return index<=frame?{c,salary,investment:lastInvestment}:null});
 let maximum=reviewHistoryMaxV28(values),options=reviewOptionsV19(false);options.animation=false;options.scales.yBars.max=maximum;options.scales.yLines.max=maximum;
 const definitions=[
  {type:'bar',label:'股票',data:values.map(v=>v?v.c.stocks:null),backgroundColor:COLORS.stocks,stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'債券',data:values.map(v=>v?v.c.bonds:null),backgroundColor:COLORS.bonds,stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'證券現金',data:values.map(v=>v?v.c.brokerCash:null),backgroundColor:'#e3bb4d',stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'銀行現金',data:values.map(v=>v?v.c.banks:null),backgroundColor:COLORS.cash,stack:'asset',yAxisID:'yBars',order:2},
  {type:'line',label:'總資產',data:values.map(v=>v?v.c.assets:null),borderColor:'#14251e',backgroundColor:'#14251e',tension:.25,pointRadius:3,yAxisID:'yLines',order:1},
  {type:'line',label:'淨資產',data:values.map(v=>v?v.c.net:null),borderColor:'#1b778f',backgroundColor:'#1b778f',tension:.25,pointRadius:3,yAxisID:'yLines',order:1},
  {type:'line',label:'累積薪水',data:values.map(v=>v?v.salary:null),borderColor:'#73589d',backgroundColor:'#73589d',tension:.25,pointRadius:3,yAxisID:'yLines',order:1},
  {type:'line',label:'總投入金額',data:values.map(v=>v?v.investment:null),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,yAxisID:'yLines',order:1}
 ];
 const state=reviewStateV19(),canvas=document.getElementById('reviewHistoryChart'),chart=state.charts.history;if(!canvas)return;if(chart)maximum=reviewHistoryMaxForVisibleV34(chart,definitions);options.scales.yBars.max=maximum;options.scales.yLines.max=maximum;
 if(!chart){state.charts.history=new Chart(canvas,{type:'bar',data:{labels,datasets:definitions},options});state.charts.history._reviewFrame=frame;state.charts.history._historyAxisMax=maximum;return}
 if(chart._historyAnimation){cancelAnimationFrame(chart._historyAnimation);chart._historyAnimation=null}const visibility=chart.data.datasets.map((dataset,index)=>chart.isDatasetVisible(index)),isNextMonth=chart._reviewFrame===frame-1;chart.data.labels=labels;
 if(isNextMonth){const nextAxisMax=Math.max(chart._historyAxisMax||0,maximum);if(nextAxisMax!==chart._historyAxisMax){chart.options.scales.yBars.max=nextAxisMax;chart.options.scales.yLines.max=nextAxisMax;chart._historyAxisMax=nextAxisMax}chart._reviewFrame=frame;animateHistoryMonthV25(chart,definitions,frame);return}
 definitions.forEach((definition,index)=>{if(chart.data.datasets[index])Object.assign(chart.data.datasets[index],definition);else chart.data.datasets.push(definition)});
 chart.data.datasets.length=definitions.length;chart.options=options;chart.data.datasets.forEach((dataset,index)=>chart.setDatasetVisibility(index,visibility[index]!==false));chart._reviewFrame=frame;chart._historyAxisMax=maximum;chart.update('none');
}
// Version 25: animate only the new month; all previously displayed points stay untouched.
function animateHistoryMonthV25(chart,definitions,frame){
 if(chart._historyAnimation)cancelAnimationFrame(chart._historyAnimation);
 const duration=reviewTransitionDurationV27('history'),targets=definitions.map(definition=>definition.data[frame]);
 chart.data.datasets.forEach((dataset,index)=>{const target=targets[index];if(target===null||target===undefined||target===''){dataset.data[frame]=target;return}const prior=dataset.type==='line'&&frame>0?dataset.data[frame-1]:0;dataset.data[frame]=Number.isFinite(Number(prior))?Number(prior):0});
 chart.update('none');
 const started=performance.now(),step=now=>{const progress=Math.min(1,(now-started)/duration);const eased=1-Math.pow(1-progress,3);chart.data.datasets.forEach((dataset,index)=>{const target=targets[index];if(target===null||target===undefined||target==='')return;const prior=dataset.type==='line'&&frame>0?dataset.data[frame-1]:0,startValue=Number.isFinite(Number(prior))?Number(prior):0;dataset.data[frame]=startValue+(Number(target)-startValue)*eased});chart.update('none');if(progress<1)chart._historyAnimation=requestAnimationFrame(step);else chart._historyAnimation=null};
 chart._historyAnimation=requestAnimationFrame(step);
}
// Version 26: ratio review follows the same incremental line animation as asset history.
function renderReviewRatioV19(rows,frame){
 const labels=rows.map(x=>monthLabel(x.month)),definitions=[['股票','stocks',COLORS.stocks],['債券','bonds',COLORS.bonds],['現金','cash',COLORS.cash]].map(item=>({label:item[0],data:rows.map((snapshot,index)=>{if(index>frame)return null;const c=compute(snapshot);return c.assets?c[item[1]]/c.assets*100:null}),borderColor:item[2],backgroundColor:item[2],tension:.28,pointRadius:3,spanGaps:false,clip:8}));
 const options=reviewOptionsV19(true);options.animation=false;const state=reviewStateV19(),canvas=document.getElementById('reviewRatioChart'),chart=state.charts.ratio;if(!canvas)return;
 if(!chart){state.charts.ratio=new Chart(canvas,{type:'line',data:{labels,datasets:definitions},options});state.charts.ratio._ratioFrame=frame;return}
 const isNextMonth=chart._ratioFrame===frame-1;if(isNextMonth){chart._ratioFrame=frame;animateRatioMonthV26(chart,definitions,frame);return}
 if(chart._ratioAnimation){cancelAnimationFrame(chart._ratioAnimation);chart._ratioAnimation=null}const visibility=chart.data.datasets.map((dataset,index)=>chart.isDatasetVisible(index));chart.data.labels=labels;definitions.forEach((definition,index)=>{if(chart.data.datasets[index])Object.assign(chart.data.datasets[index],definition);else chart.data.datasets.push(definition)});chart.data.datasets.length=definitions.length;chart.options=options;chart.data.datasets.forEach((dataset,index)=>chart.setDatasetVisibility(index,visibility[index]!==false));chart._ratioFrame=frame;chart.update('none');
}
function animateRatioMonthV26(chart,definitions,frame){
 if(chart._ratioAnimation)cancelAnimationFrame(chart._ratioAnimation);const duration=reviewTransitionDurationV27('ratio'),targets=definitions.map(definition=>definition.data[frame]);
 chart.data.datasets.forEach((dataset,index)=>{const target=targets[index];if(target===null||target===undefined){dataset.data[frame]=target;return}const prior=frame>0?dataset.data[frame-1]:0;dataset.data[frame]=Number.isFinite(Number(prior))?Number(prior):0});chart.update('none');
 const started=performance.now(),step=now=>{const progress=Math.min(1,(now-started)/duration),eased=1-Math.pow(1-progress,3);chart.data.datasets.forEach((dataset,index)=>{const target=targets[index];if(target===null||target===undefined)return;const prior=frame>0?dataset.data[frame-1]:0,startValue=Number.isFinite(Number(prior))?Number(prior):0;dataset.data[frame]=startValue+(Number(target)-startValue)*eased});chart.update('none');if(progress<1)chart._ratioAnimation=requestAnimationFrame(step);else chart._ratioAnimation=null};chart._ratioAnimation=requestAnimationFrame(step);
}
// Version 28: scale the history chart to the data revealed so far.
function reviewHistoryMaxV28(values){
 const maximum=Math.max(0,...values.filter(Boolean).flatMap(value=>[value.c.assets,value.c.net,value.c.stocks+value.c.bonds+value.c.brokerCash,value.salary,value.investment]));
 if(!maximum)return 100000;const expanded=maximum*1.2,base=Math.pow(10,Math.floor(Math.log10(expanded))),steps=[1,1.2,1.5,2,2.5,3,4,5,6,8,10],factor=steps.find(step=>step>=expanded/base)||10;return factor*base;
}
// Version 29: browser-local privacy toggle for every displayed monetary amount.
function syncMoneyInputMaskV29(){document.querySelectorAll('input.money-input').forEach(input=>{if(amountsHidden){if(input.dataset.amountMask===undefined){input.dataset.amountMask=input.value;input.value='****';input.readOnly=true}}else if(input.dataset.amountMask!==undefined){input.value=input.dataset.amountMask;input.readOnly=false;delete input.dataset.amountMask}})}
function renderAmountMaskV29(){document.body.classList.toggle('amounts-hidden',amountsHidden);const button=document.getElementById('hideAmountsBtn');if(button){button.textContent=amountsHidden?'顯示金額':'隱藏金額';button.setAttribute('aria-pressed',String(amountsHidden))}renderDashboard();renderRecord();window.refreshDynamicReviewV19?.();syncMoneyInputMaskV29()}
function initAmountMaskV29(){const button=document.getElementById('hideAmountsBtn');if(!button)return;button.addEventListener('click',()=>{amountsHidden=!amountsHidden;localStorage.setItem(AMOUNT_MASK_KEY,String(amountsHidden));renderAmountMaskV29()});new MutationObserver(()=>{if(amountsHidden)syncMoneyInputMaskV29()}).observe(document.body,{childList:true,subtree:true});renderAmountMaskV29()}
initAmountMaskV29();
// Version 30: never advance a panel while its current chart transition is still drawing.
function reviewPanelAnimatingV30(panel){const chart=reviewStateV19().charts[panel];return panel==='history'?Boolean(chart?._historyAnimation):panel==='ratio'?Boolean(chart?._ratioAnimation):false}
function scheduleReviewPanelV21(panel){
 const state=reviewStateV19(),rows=reviewRowsV19();if(state.timers[panel])clearTimeout(state.timers[panel]);
 const delay=reviewDelayV21(panel),transition=panel==='history'||panel==='ratio'?reviewTransitionDurationV27(panel):0;
 const advance=()=>{if(!state.timers[panel])return;if(reviewPanelAnimatingV30(panel)){state.timers[panel]=setTimeout(advance,16);return}const next=(state.frames[panel]??0)+1;if(next>=rows.length){stopReviewPanelV21(panel);return}renderReviewPanelV21(panel,next);state.timers[panel]=setTimeout(advance,Math.max(1,delay-transition))};
 state.timers[panel]=setTimeout(advance,delay);
}
// Version 31: allocate a parent region per asset category, then tile entries inside it.
function heatmapGroupedLayoutV31(entries,total){
 const order=['aggressive','conservative','leveraged','longBond','shortBond','bank','broker'],groups=order.map(type=>{const items=entries.filter(item=>item.type===type),amount=items.reduce((sum,item)=>sum+item.amount,0);return{type,items,amount}}).filter(group=>group.items.length);
 const parents=heatmapLayoutV20(groups.map(group=>({...group,area:group.amount/total*600000})));return parents.flatMap(parent=>{const local=heatmapLayoutV20(parent.items.slice().sort((a,b)=>b.amount-a.amount).map(item=>({...item,area:item.amount/parent.amount*600000})));return local.map(item=>({...item,x:parent.x+item.x/1000*parent.w,y:parent.y+item.y/600*parent.h,w:item.w/1000*parent.w,h:item.h/600*parent.h}))});
}
// Version 32: each doughnut legend item independently toggles its matching asset segment.
function reviewAllocationLegendClickV32(event,item,legend){if(isReviewPlayingV21())return;const chart=legend.chart;chart.toggleDataVisibility(item.index);chart.update()}
// Version 33: dashboard allocation list doubles as an individual legend toggle.
function renderAllocation(c){
 const view=allocationV3(c),hidden=window.dashboardAllocationHiddenV33||(window.dashboardAllocationHiddenV33=new Set()),list=document.getElementById('allocationList'),canvas=document.getElementById('allocationChart');
 if(!list||!canvas)return;list.innerHTML=view.items.map(([name,value,color],index)=>`<button type="button" class="alloc-row allocation-legend-toggle ${hidden.has(index)?'is-off':''}" data-allocation-index="${index}" aria-pressed="${!hidden.has(index)}"><i class="swatch" style="background:${color}"></i><span>${name}</span><strong>${money(value)}<small>${pct(c.assets?value/c.assets:0)}</small></strong></button>`).join('');
 charts.allocation?.destroy();charts.allocation=new Chart(canvas,{type:'doughnut',data:{labels:view.items.map(item=>item[0]),datasets:[{data:view.items.map(item=>item[1]),backgroundColor:view.items.map(item=>item[2]),borderWidth:0}]},options:{cutout:'72%',plugins:{legend:{display:false},tooltip:{callbacks:{label:item=>`${item.label}：${money(item.raw)}`}}}}});
 view.items.forEach((_,index)=>{if(hidden.has(index))charts.allocation.toggleDataVisibility(index)});charts.allocation.update('none');
 list.querySelectorAll('[data-allocation-index]').forEach(button=>button.addEventListener('click',()=>{const index=Number(button.dataset.allocationIndex);if(hidden.has(index))hidden.delete(index);else hidden.add(index);charts.allocation.toggleDataVisibility(index);charts.allocation.update();button.classList.toggle('is-off',hidden.has(index));button.setAttribute('aria-pressed',String(!hidden.has(index)))}));
}
// Version 34: calculate the history chart scale from only the legend-visible series.
function reviewHistoryNiceMaxV34(numbers){const maximum=Math.max(0,...numbers.filter(value=>Number.isFinite(Number(value))).map(Number));if(!maximum)return 100000;const expanded=maximum*1.2,base=Math.pow(10,Math.floor(Math.log10(expanded))),steps=[1,1.2,1.5,2,2.5,3,4,5,6,8,10],factor=steps.find(step=>step>=expanded/base)||10;return factor*base}
function reviewHistoryMaxForVisibleV34(chart,definitions=chart.data.datasets){return reviewHistoryNiceMaxV34(definitions.flatMap((dataset,index)=>chart.isDatasetVisible(index)?dataset.data:[]))}
function reviewLegendClickV19(event,item,legend){if(isReviewPlayingV21())return;Chart.defaults.plugins.legend.onClick(event,item,legend);const chart=legend.chart;if(chart.canvas?.id==='reviewHistoryChart'){const maximum=reviewHistoryMaxForVisibleV34(chart);chart.options.scales.yBars.max=maximum;chart.options.scales.yLines.max=maximum;chart._historyAxisMax=maximum;chart.update('none')}}
// Version 35: keep 0.1 as the sole low-speed step while spinner buttons otherwise use whole months/second.
function initReviewSpeedStepperV35(){document.querySelectorAll('[id^="reviewSpeed-"]').forEach(input=>{if(input.dataset.speedStepperBound)return;input.dataset.speedStepperBound='1';input.dataset.lastSpeed=String(Number(input.value)||1);input.addEventListener('input',()=>{const previous=Number(input.dataset.lastSpeed),current=Number(input.value);if(!Number.isFinite(current))return;let next=current;if(previous===.1&&Math.abs(current-1.1)<.001)next=1;else if(Number.isInteger(previous)&&Math.abs(current-(previous+.1))<.001)next=previous+1;else if(Number.isInteger(previous)&&Math.abs(current-(previous-.9))<.001)next=Math.max(.1,previous-1);if(next!==current)input.value=String(next);input.dataset.lastSpeed=String(Number(input.value)||.1)})})}
initReviewSpeedStepperV35();
// Version 36: monthly cards accumulate income and expenses only through the selected card month.
function incomeExpenseMetricsV13(c,throughSnapshot){
 if(!throughSnapshot){const salary=accruedSalary(),months=workMonths(),spend=salary-c.assets;return`${metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡')}${metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡起 ${months} 個月`:'尚無資料卡')}${metric('粗估累積花費',money(spend),'累積薪水 − 總資產')}${metric('平均月花費',months?money(spend/months):'—',months?'粗估累積花費 ÷ 工作月數':'尚無資料卡')}`}
 const cards=snapshots().filter(snapshot=>snapshot.month<=throughSnapshot.month),first=cards[0]?.month,end=throughSnapshot.month,salary=cards.reduce((sum,snapshot)=>sum+num(snapshot.salary),0),months=first?((Number(end.slice(0,4))-Number(first.slice(0,4)))*12+Number(end.slice(5,7))-Number(first.slice(5,7))+1):0,spend=salary-c.assets;
 return`${metric('累積薪水',money(salary),months?`資料卡期間 ${months} 個月`:'尚無資料卡')}${metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡至本月 ${months} 個月`:'尚無資料卡')}${metric('粗估累積花費',money(spend),'累積薪水 − 本月總資產')}${metric('平均月花費',months?money(spend/months):'—',months?'粗估累積花費 ÷ 資料卡期間':'尚無資料卡')}`
}
// Version 37: annual card statistics run only from January through the viewed month.
function annualMarkupV3(s){
 const year=s.month.slice(0,4),items=snapshots().filter(snapshot=>snapshot.month>=year+'-01'&&snapshot.month<=s.month),total=items.reduce((sum,snapshot)=>sum+num(snapshot.salary),0),period=year+'/01 至 '+monthLabel(s.month);
 return[metric(year+' 年度累計薪資',money(total),period+'｜'+items.length+' 筆月度資料'),metric(year+' 年度平均薪資',items.length?money(total/items.length):'—',period+'｜依已儲存資料卡平均')].join('')
}
// Version 38: bank-level initial-asset flags and expanded income/expense metrics.
function renderRows(kind){
 const host=getContainer(kind);host.innerHTML='';state.current[kind].forEach((row,index)=>{if(kind==='banks'){const element=document.createElement('div');element.className='data-row bank';element.innerHTML='<input data-field="name" placeholder="名稱"><input data-field="amount" class="money-input" inputmode="numeric" placeholder="0"><label class="initial-asset-check" aria-label="初始資產"><input data-field="initialAsset" type="checkbox"></label><button class="remove">×</button>';element.querySelector('[data-field="name"]').value=row.name||'';const amount=element.querySelector('[data-field="amount"]');amount.value=row.amount||'';bindMoney(amount,value=>{state.current.banks[index].amount=value;save();renderDashboard()});element.querySelector('[data-field="name"]').addEventListener('input',event=>{state.current.banks[index].name=event.target.value;save();renderDashboard()});const initial=element.querySelector('[data-field="initialAsset"]');initial.checked=Boolean(row.initialAsset);initial.addEventListener('change',event=>{state.current.banks[index].initialAsset=event.target.checked;save()});element.querySelector('.remove').addEventListener('click',()=>{state.current.banks.splice(index,1);save();renderRows('banks');renderDashboard()});host.append(element);return}const fragment=document.getElementById(kind==='holdings'?'holdingTemplate':'simpleTemplate').content.cloneNode(true);fragment.querySelectorAll('[data-field]').forEach(input=>{const field=input.dataset.field;input.value=row[field]||'';if(field==='amount')bindMoney(input,value=>{state.current[kind][index][field]=value;save();renderDashboard()});else input.addEventListener('input',event=>{state.current[kind][index][field]=event.target.value;save();renderDashboard()})});fragment.querySelector('.remove').addEventListener('click',()=>{state.current[kind].splice(index,1);save();renderRows(kind);renderDashboard()});host.append(fragment)})
}
function incomeExpenseMetricsV13(c,throughSnapshot){
 if(!throughSnapshot){const salary=accruedSalary(),months=workMonths(),spend=salary-c.assets;return`${metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡')}${metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡起 ${months} 個月`:'尚無資料卡')}${metric('粗估累積花費',money(spend),'累積薪水 − 總資產')}${metric('粗估平均月花費',months?money(spend/months):'—',months?'粗估累積花費 ÷ 工作月數':'尚無資料卡')}`}
 const cards=snapshots().filter(snapshot=>snapshot.month<=throughSnapshot.month),first=cards[0],firstMonth=first?.month,end=throughSnapshot.month,salary=cards.reduce((sum,snapshot)=>sum+num(snapshot.salary),0),months=firstMonth?((Number(end.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(end.slice(5,7))-Number(firstMonth.slice(5,7))+1):0,initialAssets=sum((throughSnapshot.banks||[]).filter(bank=>bank.initialAsset)),roughSpend=initialAssets+salary-c.assets,actualSpend=initialAssets+salary-num(throughSnapshot.totalInvestment)-c.cash;
 return`${metric('累積薪水',money(salary),months?`資料卡期間 ${months} 個月`:'尚無資料卡')}${metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡至本月 ${months} 個月`:'尚無資料卡')}${metric('粗估累積花費',money(roughSpend),'初始資產 ＋ 累積薪水 − 本月總資產')}${metric('粗估平均月花費',months?money(roughSpend/months):'—',months?'粗估累積花費 ÷ 資料卡期間':'尚無資料卡')}${metric('實際累積花費',money(actualSpend),'初始資產 ＋ 累積薪水 − 總投入金額 − 現金總額')}${metric('實際平均月花費',months?money(actualSpend/months):'—',months?'實際累積花費 ÷ 資料卡期間':'尚無資料卡')}`
}
// Version 39: dashboard trend of monthly average spending, calculated from each card's own initial-asset flags.
function averageExpenseTrendV39(){
 const cards=snapshots();
 if(!cards.length)return[];
 const firstMonth=cards[0].month;
 return cards.map((snapshot,index)=>{
  const period=cards.slice(0,index+1),salary=period.reduce((total,item)=>total+num(item.salary),0),months=(Number(snapshot.month.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(snapshot.month.slice(5,7))-Number(firstMonth.slice(5,7))+1,c=compute(snapshot),initialAssets=sum((snapshot.banks||[]).filter(bank=>bank.initialAsset)),rough=initialAssets+salary-c.assets,actual=initialAssets+salary-num(snapshot.totalInvestment)-c.cash;
  return{month:snapshot.month,rough:months?rough/months:null,actual:months?actual/months:null};
 });
}
function renderAverageExpenseChartV39(){
 const canvas=document.getElementById('averageExpenseChart');
 if(!canvas)return;
 const rows=averageExpenseTrendV39();
 charts.averageExpense?.destroy();
 charts.averageExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估平均月花費',data:rows.map(row=>row.rough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:true},
  {label:'實際平均月花費',data:rows.map(row=>row.actual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:true}
 ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:18}},tooltip:{callbacks:{label:item=>item.dataset.label+'：'+money(item.parsed.y)}}},scales:{x:{grid:{display:false}},y:{ticks:{callback:value=>axisMoney(value)}}}}});
}
function renderDashboard(){
 const latest=latestSnapshot(),view=overviewMarkupV3(latest),last=snapshots().at(-1);
 document.getElementById('headlineMetrics').innerHTML=summaryMetricsV12(view.c,latest.totalInvestment);
 document.getElementById('incomeExpenseMetrics').innerHTML=incomeExpenseMetricsV13(view.c);
 document.getElementById('detailMetrics').innerHTML=view.detail;
 document.getElementById('snapshotCaption').textContent=last?`最新資料卡：${monthLabel(last.month)}｜填寫於 ${last.entryDate||'—'}`:'尚未儲存月度資料';
 renderAllocation(view.c);renderAverageExpenseChartV39();renderCharts();renderPerformance();
}
// Version 40: show a synchronized right-side scale on the dashboard average-spending trend.
function renderAverageExpenseChartV39(){
 const canvas=document.getElementById('averageExpenseChart');
 if(!canvas)return;
 const rows=averageExpenseTrendV39(),values=rows.flatMap(row=>[row.rough,row.actual]).filter(value=>Number.isFinite(value));
 const rawMin=values.length?Math.min(...values):0,rawMax=values.length?Math.max(...values):0,range=Math.max(rawMax-rawMin,Math.abs(rawMax),Math.abs(rawMin),1),padding=range*.12,minimum=rawMin<0?rawMin-padding:0,maximum=rawMax>0?rawMax+padding:100;
 const moneyScale={min:minimum,max:maximum,ticks:{callback:value=>axisMoney(value)}};
 charts.averageExpense?.destroy();
 charts.averageExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估平均月花費',data:rows.map(row=>row.rough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:true,yAxisID:'y'},
  {label:'實際平均月花費',data:rows.map(row=>row.actual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:true,yAxisID:'y'}
 ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:18}},tooltip:{callbacks:{label:item=>item.dataset.label+'：'+money(item.parsed.y)}}},scales:{x:{grid:{display:false}},y:moneyScale,yRight:{...moneyScale,position:'right',grid:{drawOnChartArea:false}}}}});
}
// Version 41: dashboard cumulative spending trend, using the same card-by-card formulas as the monthly record.
function cumulativeExpenseTrendV41(){
 const cards=snapshots();
 if(!cards.length)return[];
 return cards.map((snapshot,index)=>{
  const salary=cards.slice(0,index+1).reduce((total,item)=>total+num(item.salary),0),c=compute(snapshot),initialAssets=sum((snapshot.banks||[]).filter(bank=>bank.initialAsset));
  return{month:snapshot.month,rough:initialAssets+salary-c.assets,actual:initialAssets+salary-num(snapshot.totalInvestment)-c.cash};
 });
}
function renderCumulativeExpenseChartV41(){
 const canvas=document.getElementById('cumulativeExpenseChart');
 if(!canvas)return;
 const rows=cumulativeExpenseTrendV41(),values=rows.flatMap(row=>[row.rough,row.actual]).filter(value=>Number.isFinite(value));
 const rawMin=values.length?Math.min(...values):0,rawMax=values.length?Math.max(...values):0,range=Math.max(rawMax-rawMin,Math.abs(rawMax),Math.abs(rawMin),1),padding=range*.12,minimum=rawMin<0?rawMin-padding:0,maximum=rawMax>0?rawMax+padding:100;
 const moneyScale={min:minimum,max:maximum,ticks:{callback:value=>axisMoney(value)}};
 charts.cumulativeExpense?.destroy();
 charts.cumulativeExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估累積花費',data:rows.map(row=>row.rough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:true,yAxisID:'y'},
  {label:'實際累積花費',data:rows.map(row=>row.actual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:true,yAxisID:'y'}
 ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:18}},tooltip:{callbacks:{label:item=>item.dataset.label+'：'+money(item.parsed.y)}}},scales:{x:{grid:{display:false}},y:moneyScale,yRight:{...moneyScale,position:'right',grid:{drawOnChartArea:false}}}}});
}
function renderDashboard(){
 const latest=latestSnapshot(),view=overviewMarkupV3(latest),last=snapshots().at(-1);
 document.getElementById('headlineMetrics').innerHTML=summaryMetricsV12(view.c,latest.totalInvestment);
 document.getElementById('incomeExpenseMetrics').innerHTML=incomeExpenseMetricsV13(view.c);
 document.getElementById('detailMetrics').innerHTML=view.detail;
 document.getElementById('snapshotCaption').textContent=last?`最新資料卡：${monthLabel(last.month)}｜填寫於 ${last.entryDate||'—'}`:'尚未儲存月度資料';
 renderAllocation(view.c);renderAverageExpenseChartV39();renderCharts();renderPerformance();renderCumulativeExpenseChartV41();
}
// Version 42: cumulative spending chart uses a whole-million ceiling on both vertical scales.
function renderCumulativeExpenseChartV41(){
 const canvas=document.getElementById('cumulativeExpenseChart');
 if(!canvas)return;
 const rows=cumulativeExpenseTrendV41(),values=rows.flatMap(row=>[row.rough,row.actual]).filter(value=>Number.isFinite(value));
 const rawMin=values.length?Math.min(...values):0,rawMax=values.length?Math.max(...values):0,range=Math.max(rawMax-rawMin,Math.abs(rawMax),Math.abs(rawMin),1),padding=range*.12,minimum=rawMin<0?rawMin-padding:0,maximum=Math.max(1000000,Math.ceil(Math.max(0,rawMax)/1000000)*1000000);
 const moneyScale={min:minimum,max:maximum,ticks:{callback:value=>axisMoney(value)}};
 charts.cumulativeExpense?.destroy();
 charts.cumulativeExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估累積花費',data:rows.map(row=>row.rough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:true,yAxisID:'y'},
  {label:'實際累積花費',data:rows.map(row=>row.actual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:true,yAxisID:'y'}
 ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:18}},tooltip:{callbacks:{label:item=>item.dataset.label+'：'+money(item.parsed.y)}}},scales:{x:{grid:{display:false}},y:moneyScale,yRight:{...moneyScale,position:'right',grid:{drawOnChartArea:false}}}}});
}
// Version 43: dashboard Y axes follow only the datasets currently enabled by their legends.
function dashboardAxisValuesV43(chart){
 const datasets=chart.data.datasets||[],visible=datasets.filter((dataset,index)=>chart.isDatasetVisible(index)),lineValues=visible.filter(dataset=>dataset.type!=='bar').flatMap(dataset=>dataset.data||[]).filter(value=>Number.isFinite(Number(value))).map(Number),bars=visible.filter(dataset=>dataset.type==='bar'),barTotals=(chart.data.labels||[]).map((_,index)=>bars.reduce((total,dataset)=>total+(Number(dataset.data?.[index])||0),0));
 return{minimum:Math.min(0,...lineValues),maximum:Math.max(0,...lineValues,...barTotals)};
}
function dashboardYAxisBoundsV43(chart){
 const {minimum,maximum}=dashboardAxisValuesV43(chart),id=chart.canvas?.id||'',range=Math.max(maximum-minimum,Math.abs(maximum),Math.abs(minimum),1),lower=minimum<0?minimum-range*.12:0;
 if(id==='ratioChart'){return{min:0,max:Math.min(100,Math.max(10,Math.ceil(maximum*1.1/10)*10))};}
 if(id==='historyChart'||id==='cumulativeExpenseChart'){return{min:lower,max:Math.max(1000000,Math.ceil(Math.max(0,maximum)*1.2/1000000)*1000000)};}
 const upper=maximum>0?maximum+range*.12:100;
 return{min:lower,max:upper};
}
function refreshDashboardYAxisV43(chart){
 if(!chart)return;
 const bounds=dashboardYAxisBoundsV43(chart),scales=chart.options.scales||{};
 if(scales.y){scales.y.min=bounds.min;scales.y.max=bounds.max;}
 if(scales.yRight){scales.yRight.min=bounds.min;scales.yRight.max=bounds.max;}
 if(scales.yBars){scales.yBars.min=bounds.min;scales.yBars.max=bounds.max;}
 if(scales.yLines){scales.yLines.min=bounds.min;scales.yLines.max=bounds.max;}
}
function dashboardLegendClickV43(event,item,legend){
 Chart.defaults.plugins.legend.onClick(event,item,legend);
 refreshDashboardYAxisV43(legend.chart);
 legend.chart.update();
}
function dashboardLineOptionsV43(percent=false){
 const options=chartOptions(percent);
 options.plugins.legend.onClick=dashboardLegendClickV43;
 return options;
}
function dashboardExpenseOptionsV43(){return{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:18},onClick:dashboardLegendClickV43},tooltip:{callbacks:{label:item=>item.dataset.label+'：'+money(item.parsed.y)}}},scales:{x:{grid:{display:false}},y:{ticks:{callback:value=>axisMoney(value)}},yRight:{position:'right',grid:{drawOnChartArea:false},ticks:{callback:value=>axisMoney(value)}}}}}
function renderAverageExpenseChartV39(){
 const canvas=document.getElementById('averageExpenseChart');if(!canvas)return;
 const rows=averageExpenseTrendV39();charts.averageExpense?.destroy();
 charts.averageExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估平均月花費',data:rows.map(row=>row.rough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:true},
  {label:'實際平均月花費',data:rows.map(row=>row.actual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:true}
 ]},options:dashboardExpenseOptionsV43()});refreshDashboardYAxisV43(charts.averageExpense);charts.averageExpense.update('none');
}
function renderCumulativeExpenseChartV41(){
 const canvas=document.getElementById('cumulativeExpenseChart');if(!canvas)return;
 const rows=cumulativeExpenseTrendV41();charts.cumulativeExpense?.destroy();
 charts.cumulativeExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估累積花費',data:rows.map(row=>row.rough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:true},
  {label:'實際累積花費',data:rows.map(row=>row.actual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:true}
 ]},options:dashboardExpenseOptionsV43()});refreshDashboardYAxisV43(charts.cumulativeExpense);charts.cumulativeExpense.update('none');
}
function renderCharts(){
 const cards=snapshots(),byMonth=new Map(cards.map(snapshot=>[snapshot.month,snapshot])),rows=monthSequenceV3().map(month=>{const snapshot=byMonth.get(month);return snapshot?{month,salary:num(snapshot.salary),investment:num(snapshot.totalInvestment),...compute(snapshot)}:{month,salary:0,investment:null,assets:null,net:null,stocks:null,bonds:null,banks:null,brokerCash:null,cash:null}}),labels=rows.map(row=>monthLabel(row.month));
 charts.ratio?.destroy();charts.history?.destroy();
 charts.ratio=new Chart(document.getElementById('ratioChart'),{type:'line',data:{labels,datasets:[['股票','stocks'],['債券','bonds'],['現金','cash']].map(([label,key])=>({label,data:rows.map(row=>row.assets?row[key]/row.assets*100:null),borderColor:COLORS[key],backgroundColor:COLORS[key],tension:.25,pointRadius:3,spanGaps:true,clip:8}))},options:dashboardLineOptionsV43(true)});
 let salaryTotal=0,lastInvestment=null;const salaryLine=rows.map(row=>(salaryTotal+=row.salary)),investmentLine=rows.map(row=>{if(row.investment!==null)lastInvestment=row.investment;return lastInvestment}),maximum=Math.max(0,...rows.map(row=>row.assets||0),...rows.map(row=>row.net||0),...salaryLine,...investmentLine.map(value=>value||0)),historyOptions=historyOptionsV6(maximum);historyOptions.plugins.legend.onClick=dashboardLegendClickV43;
 charts.history=new Chart(document.getElementById('historyChart'),{data:{labels,datasets:[
  {type:'bar',label:'股票',data:rows.map(row=>row.stocks),backgroundColor:COLORS.stocks,stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'債券',data:rows.map(row=>row.bonds),backgroundColor:COLORS.bonds,stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'證券現金',data:rows.map(row=>row.brokerCash),backgroundColor:'#d6a946',stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'銀行現金',data:rows.map(row=>row.banks),backgroundColor:COLORS.cash,stack:'asset',yAxisID:'yBars',order:2},
  {type:'line',label:'總資產',data:rows.map(row=>row.assets),borderColor:'#14251e',backgroundColor:'#14251e',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1},
  {type:'line',label:'淨資產',data:rows.map(row=>row.net),borderColor:'#1b778f',backgroundColor:'#1b778f',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1},
  {type:'line',label:'累積薪水',data:salaryLine,borderColor:'#73589d',backgroundColor:'#73589d',tension:.22,pointRadius:2,yAxisID:'yLines',order:1},
  {type:'line',label:'總投入金額',data:investmentLine,borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1}
 ]},options:historyOptions});
 refreshDashboardYAxisV43(charts.ratio);charts.ratio.update('none');refreshDashboardYAxisV43(charts.history);charts.history.update('none');
}
// Version 44: dashboard graphs stop at the latest saved card and separate legend fading from axis rescaling.
function monthSequenceV3(){
 const cards=snapshots(),first=cards[0]?.month,last=cards.at(-1)?.month;
 if(!first||!last)return[];
 let [year,month]=first.split('-').map(Number);const [lastYear,lastMonth]=last.split('-').map(Number),result=[];
 while(year<lastYear||(year===lastYear&&month<=lastMonth)){result.push(`${year}-${String(month).padStart(2,'0')}`);month++;if(month===13){month=1;year++;}}
 return result;
}
function dashboardLegendClickV43(event,item,legend){
 const chart=legend.chart;
 chart.toggleDataVisibility(item.datasetIndex);
 chart.update();
 if(chart._dashboardAxisTimer)clearTimeout(chart._dashboardAxisTimer);
 const duration=Number(chart.options.animation?.duration)||280;
 chart._dashboardAxisTimer=setTimeout(()=>{refreshDashboardYAxisV43(chart);chart.update();chart._dashboardAxisTimer=null;},duration);
}
function tuneDashboardChartV44(chart){
 if(!chart)return;
 chart.data.datasets.forEach(dataset=>{if(dataset.type!=='bar')dataset.clip=8;});
 chart.options.animation={duration:280,easing:'easeOutQuart'};
 chart.options.layout={...(chart.options.layout||{}),padding:{top:8,right:16,bottom:12,left:10}};
 chart.options.plugins.legend.onClick=dashboardLegendClickV43;
 chart.update('none');
}
function renderDashboard(){
 const latest=latestSnapshot(),view=overviewMarkupV3(latest),last=snapshots().at(-1);
 document.getElementById('headlineMetrics').innerHTML=summaryMetricsV12(view.c,latest.totalInvestment);
 document.getElementById('incomeExpenseMetrics').innerHTML=incomeExpenseMetricsV13(view.c);
 document.getElementById('detailMetrics').innerHTML=view.detail;
 document.getElementById('snapshotCaption').textContent=last?`最新資料卡：${monthLabel(last.month)}｜填寫於 ${last.entryDate||'—'}`:'尚未儲存月度資料';
 renderAllocation(view.c);renderAverageExpenseChartV39();renderCharts();renderPerformance();renderCumulativeExpenseChartV41();
 [charts.ratio,charts.history,charts.averageExpense,charts.cumulativeExpense].forEach(tuneDashboardChartV44);
}
// Version 45: reserve chart-area breathing room so endpoint markers are never clipped at scale boundaries.
function dashboardYAxisBoundsV43(chart){
 const {minimum,maximum}=dashboardAxisValuesV43(chart),id=chart.canvas?.id||'',range=Math.max(maximum-minimum,Math.abs(maximum),Math.abs(minimum),1),lower=minimum<0?minimum-range*.12:0;
 if(id==='ratioChart'){return{min:0,max:Math.max(10,Math.ceil(Math.max(maximum,1)*1.1/10)*10)};}
 if(id==='historyChart'||id==='cumulativeExpenseChart'){return{min:lower,max:Math.max(1000000,Math.ceil(Math.max(0,maximum)*1.2/1000000)*1000000)};}
 return{min:lower,max:maximum>0?maximum+range*.12:100};
}
function tuneDashboardChartV44(chart){
 if(!chart)return;
 chart.data.datasets.forEach(dataset=>{if(dataset.type!=='bar')dataset.clip=14;});
 chart.options.animation={duration:280,easing:'easeOutQuart'};
 chart.options.layout={...(chart.options.layout||{}),padding:{top:16,right:24,bottom:18,left:16}};
 chart.options.plugins.legend.onClick=dashboardLegendClickV43;
 refreshDashboardYAxisV43(chart);
 chart.update('none');
}
// Version 46: prevent floating-point precision from rounding a 100% ratio scale up to 120%.
function dashboardYAxisBoundsV43(chart){
 const {minimum,maximum}=dashboardAxisValuesV43(chart),id=chart.canvas?.id||'',range=Math.max(maximum-minimum,Math.abs(maximum),Math.abs(minimum),1),lower=minimum<0?minimum-range*.12:0;
 if(id==='ratioChart'){const padded=Math.max(maximum,1)*1.1;return{min:0,max:Math.max(10,Math.ceil((padded-1e-9)/10)*10)};}
 if(id==='historyChart'||id==='cumulativeExpenseChart'){return{min:lower,max:Math.max(1000000,Math.ceil(Math.max(0,maximum)*1.2/1000000)*1000000)};}
 return{min:lower,max:maximum>0?maximum+range*.12:100};
}
// Version 47: use Chart.js native legend toggling first, then recalculate dashboard axes after the series transition.
function dashboardLegendClickV43(event,item,legend){
 const chart=legend.chart;
 Chart.defaults.plugins.legend.onClick(event,item,legend);
 if(chart._dashboardAxisTimer)clearTimeout(chart._dashboardAxisTimer);
 const duration=Number(chart.options.animation?.duration)||280;
 chart._dashboardAxisTimer=setTimeout(()=>{refreshDashboardYAxisV43(chart);chart.update();chart._dashboardAxisTimer=null;},duration);
}
function tuneDashboardChartV44(chart){
 if(!chart)return;
 chart.data.datasets.forEach(dataset=>{if(dataset.type!=='bar')dataset.clip=14;});
 chart.options.animation={duration:280,easing:'easeOutQuart'};
 chart.options.layout={...(chart.options.layout||{}),padding:{top:16,right:24,bottom:18,left:16}};
 chart.options.plugins.legend.onClick=dashboardLegendClickV43;
 refreshDashboardYAxisV43(chart);
 requestAnimationFrame(()=>{refreshDashboardYAxisV43(chart);chart.update();});
}
// Version 48: sequence dashboard legend transitions differently for hiding and showing series.
function dashboardAxisValuesV43(chart,includeIndex=null){
 const datasets=chart.data.datasets||[],visible=datasets.filter((dataset,index)=>chart.isDatasetVisible(index)||index===includeIndex),lineValues=visible.filter(dataset=>dataset.type!=='bar').flatMap(dataset=>dataset.data||[]).filter(value=>Number.isFinite(Number(value))).map(Number),bars=visible.filter(dataset=>dataset.type==='bar'),barTotals=(chart.data.labels||[]).map((_,index)=>bars.reduce((total,dataset)=>total+(Number(dataset.data?.[index])||0),0));
 return{minimum:Math.min(0,...lineValues),maximum:Math.max(0,...lineValues,...barTotals)};
}
function dashboardYAxisBoundsV43(chart,includeIndex=null){
 const {minimum,maximum}=dashboardAxisValuesV43(chart,includeIndex),id=chart.canvas?.id||'',range=Math.max(maximum-minimum,Math.abs(maximum),Math.abs(minimum),1),lower=minimum<0?minimum-range*.12:0;
 if(id==='ratioChart'){const padded=Math.max(maximum,1)*1.1;return{min:0,max:Math.max(10,Math.ceil((padded-1e-9)/10)*10)};}
 if(id==='historyChart'||id==='cumulativeExpenseChart'){return{min:lower,max:Math.max(1000000,Math.ceil(Math.max(0,maximum)*1.2/1000000)*1000000)};}
 return{min:lower,max:maximum>0?maximum+range*.12:100};
}
function applyDashboardYAxisV48(chart,bounds){
 const scales=chart.options.scales||{};
 if(scales.y){scales.y.min=bounds.min;scales.y.max=bounds.max;}
 if(scales.yRight){scales.yRight.min=bounds.min;scales.yRight.max=bounds.max;}
 if(scales.yBars){scales.yBars.min=bounds.min;scales.yBars.max=bounds.max;}
 if(scales.yLines){scales.yLines.min=bounds.min;scales.yLines.max=bounds.max;}
}
function refreshDashboardYAxisV43(chart){if(chart)applyDashboardYAxisV48(chart,dashboardYAxisBoundsV43(chart));}
function dashboardLegendClickV43(event,item,legend){
 const chart=legend.chart,index=item.datasetIndex,opening=!chart.isDatasetVisible(index),duration=Number(chart.options.animation?.duration)||280;
 if(chart._dashboardAxisTimer)clearTimeout(chart._dashboardAxisTimer);
 if(opening){
  applyDashboardYAxisV48(chart,dashboardYAxisBoundsV43(chart,index));
  chart.update();
  chart._dashboardAxisTimer=setTimeout(()=>{chart.toggleDataVisibility(index);chart.update();chart._dashboardAxisTimer=null;},duration);
  return;
 }
 chart.toggleDataVisibility(index);
 chart.update();
 chart._dashboardAxisTimer=setTimeout(()=>{refreshDashboardYAxisV43(chart);chart.update();chart._dashboardAxisTimer=null;},duration);
}
// Version 49: line and bar charts must toggle dataset visibility (not doughnut data-item visibility).
function dashboardLegendClickV43(event,item,legend){
 const chart=legend.chart,index=item.datasetIndex,opening=!chart.isDatasetVisible(index),duration=Number(chart.options.animation?.duration)||280;
 if(chart._dashboardAxisTimer)clearTimeout(chart._dashboardAxisTimer);
 if(opening){
  applyDashboardYAxisV48(chart,dashboardYAxisBoundsV43(chart,index));
  chart.update();
  chart._dashboardAxisTimer=setTimeout(()=>{chart.setDatasetVisibility(index,true);chart.update();chart._dashboardAxisTimer=null;},duration);
  return;
 }
 chart.setDatasetVisibility(index,false);
 chart.update();
 chart._dashboardAxisTimer=setTimeout(()=>{refreshDashboardYAxisV43(chart);chart.update();chart._dashboardAxisTimer=null;},duration);
}
// Version 50: use a smaller dynamic money scale when only low-value dashboard series are enabled.
function dashboardMoneyMaxV50(maximum){
 if(!(maximum>0))return 100000;
 const expanded=maximum*1.2,unit=expanded<=1000000?100000:1000000;
 return Math.ceil((expanded-1e-9)/unit)*unit;
}
function dashboardYAxisBoundsV43(chart,includeIndex=null){
 const {minimum,maximum}=dashboardAxisValuesV43(chart,includeIndex),id=chart.canvas?.id||'',range=Math.max(maximum-minimum,Math.abs(maximum),Math.abs(minimum),1),lower=minimum<0?minimum-range*.12:0;
 if(id==='ratioChart'){const padded=Math.max(maximum,1)*1.1;return{min:0,max:Math.max(10,Math.ceil((padded-1e-9)/10)*10)};}
 if(id==='historyChart'||id==='cumulativeExpenseChart'){return{min:lower,max:dashboardMoneyMaxV50(Math.max(0,maximum))};}
 return{min:lower,max:maximum>0?maximum+range*.12:100};
}
// Version 51: use a fine-grained "nice" scale for the dashboard asset-history chart.
function dashboardHistoryMoneyMaxV51(maximum){
 if(!(maximum>0))return 100000;
 const target=maximum*1.05,magnitude=Math.pow(10,Math.floor(Math.log10(target))),steps=[1,1.2,1.5,2,2.5,3,4,5,6,8,10],step=steps.find(value=>value*magnitude>=target-1e-9)||10;
 return step*magnitude;
}
function dashboardYAxisBoundsV43(chart,includeIndex=null){
 const {minimum,maximum}=dashboardAxisValuesV43(chart,includeIndex),id=chart.canvas?.id||'',range=Math.max(maximum-minimum,Math.abs(maximum),Math.abs(minimum),1),lower=minimum<0?minimum-range*.12:0;
 if(id==='ratioChart'){const padded=Math.max(maximum,1)*1.1;return{min:0,max:Math.max(10,Math.ceil((padded-1e-9)/10)*10)};}
 if(id==='historyChart'){return{min:lower,max:dashboardHistoryMoneyMaxV51(Math.max(0,maximum))};}
 if(id==='cumulativeExpenseChart'){return{min:lower,max:dashboardMoneyMaxV50(Math.max(0,maximum))};}
 return{min:lower,max:maximum>0?maximum+range*.12:100};
}
// Version 52: actual spending excludes initial-asset cash from the cash deduction.
function cashExcludingInitialAssetsV52(snapshot){return sum((snapshot.banks||[]).filter(bank=>!bank.initialAsset))+sum(snapshot.brokerCash||[]);}
function incomeExpenseMetricsV13(c,throughSnapshot){
 if(!throughSnapshot){const salary=accruedSalary(),months=workMonths(),spend=salary-c.assets;return`${metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡')}${metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡起 ${months} 個月`:'尚無資料卡')}${metric('粗估累積花費',money(spend),'累積薪水 − 總資產')}${metric('粗估平均月花費',months?money(spend/months):'—',months?'粗估累積花費 ÷ 工作月數':'尚無資料卡')}`}
 const cards=snapshots().filter(snapshot=>snapshot.month<=throughSnapshot.month),firstMonth=cards[0]?.month,end=throughSnapshot.month,salary=cards.reduce((total,snapshot)=>total+num(snapshot.salary),0),months=firstMonth?((Number(end.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(end.slice(5,7))-Number(firstMonth.slice(5,7))+1):0,initialAssets=sum((throughSnapshot.banks||[]).filter(bank=>bank.initialAsset)),roughSpend=initialAssets+salary-c.assets,actualSpend=salary-num(throughSnapshot.totalInvestment)-cashExcludingInitialAssetsV52(throughSnapshot);
 return`${metric('累積薪水',money(salary),months?`資料卡期間 ${months} 個月`:'尚無資料卡')}${metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡至本月 ${months} 個月`:'尚無資料卡')}${metric('粗估累積花費',money(roughSpend),'初始資產 ＋ 累積薪水 − 本月總資產')}${metric('粗估平均月花費',months?money(roughSpend/months):'—',months?'粗估累積花費 ÷ 資料卡期間':'尚無資料卡')}${metric('實際累積花費',money(actualSpend),'累積薪水 − 總投入金額 − 不含初始資產的現金總額')}${metric('實際平均月花費',months?money(actualSpend/months):'—',months?'實際累積花費 ÷ 資料卡期間':'尚無資料卡')}`;
}
function averageExpenseTrendV39(){
 const cards=snapshots();if(!cards.length)return[];const firstMonth=cards[0].month;
 return cards.map((snapshot,index)=>{const salary=cards.slice(0,index+1).reduce((total,item)=>total+num(item.salary),0),months=(Number(snapshot.month.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(snapshot.month.slice(5,7))-Number(firstMonth.slice(5,7))+1,c=compute(snapshot),initialAssets=sum((snapshot.banks||[]).filter(bank=>bank.initialAsset)),rough=initialAssets+salary-c.assets,actual=salary-num(snapshot.totalInvestment)-cashExcludingInitialAssetsV52(snapshot);return{month:snapshot.month,rough:months?rough/months:null,actual:months?actual/months:null};});
}
function cumulativeExpenseTrendV41(){
 const cards=snapshots();if(!cards.length)return[];
 return cards.map((snapshot,index)=>{const salary=cards.slice(0,index+1).reduce((total,item)=>total+num(item.salary),0),c=compute(snapshot),initialAssets=sum((snapshot.banks||[]).filter(bank=>bank.initialAsset));return{month:snapshot.month,rough:initialAssets+salary-c.assets,actual:salary-num(snapshot.totalInvestment)-cashExcludingInitialAssetsV52(snapshot)};});
}
// Version 53: the form uses state.current.month; keep the month control synchronized when loading a record card.
function renderInput(){
 document.getElementById('snapshotMonth').value=state.current.month||'';
 document.getElementById('entryDate').value=state.current.entryDate||'';
 for(const [id,field] of [['monthlySalary','salary'],['monthlyInvestment','totalInvestment']]){
  const input=document.getElementById(id);input.value=state.current[field]||'';formatInput(input);
 }
 ['banks','holdings','brokerCash','debts'].forEach(renderRows);
}
// Version 54: move monthly-record load and delete actions to the monthly input page.
function renderRecordSelector(){
 const items=snapshots(),options=items.length?items.map(snapshot=>`<option value="${snapshot.month}">${monthLabel(snapshot.month)}</option>`).join(''):'<option value="">尚無資料</option>';
 const applyOptions=(id,fallback)=>{const select=document.getElementById(id);if(!select)return;const previous=select.value;select.innerHTML=options;select.value=items.some(snapshot=>snapshot.month===previous)?previous:(items.some(snapshot=>snapshot.month===fallback)?fallback:items.at(-1)?.month||'');};
 applyOptions('recordMonth');
 applyOptions('monthlyRecordMonth',state.current.month);
 renderRecord();
}
function initMonthlyRecordActionsV54(){
 const monthSelect=document.getElementById('monthlyRecordMonth'),loadButton=document.getElementById('loadMonthlyRecordBtn'),deleteButton=document.getElementById('deleteMonthlyRecordBtn');
 if(!monthSelect||!loadButton||!deleteButton||loadButton.dataset.bound)return;
 loadButton.dataset.bound='1';
 loadButton.addEventListener('click',()=>{const snapshot=state.snapshots.find(item=>item.month===monthSelect.value);if(!snapshot)return alert('請先選擇已儲存的資料月份。');state.current=structuredClone(snapshot);save();renderInput();navigate('monthly');});
 deleteButton.addEventListener('click',()=>{const month=monthSelect.value,index=state.snapshots.findIndex(item=>item.month===month);if(index<0)return alert('請先選擇已儲存的資料月份。');if(!confirm('確定要刪除 '+monthLabel(month)+' 的整張月度資料卡嗎？此動作無法復原，建議先匯出備份。'))return;state.snapshots.splice(index,1);save();renderRecordSelector();renderDashboard();window.refreshDynamicReviewV19?.();});
}
initMonthlyRecordActionsV54();
// Version 56: selecting a month on the monthly-input page loads its card immediately.
function initMonthlyRecordActionsV54(){
 const monthSelect=document.getElementById('monthlyRecordMonth'),deleteButton=document.getElementById('deleteMonthlyRecordBtn');
 if(!monthSelect||!deleteButton||monthSelect.dataset.bound)return;
 monthSelect.dataset.bound='1';
 const loadSelected=()=>{const snapshot=state.snapshots.find(item=>item.month===monthSelect.value);if(!snapshot)return;state.current=structuredClone(snapshot);save();renderInput();};
 monthSelect.addEventListener('change',loadSelected);
 deleteButton.addEventListener('click',()=>{const month=monthSelect.value,index=state.snapshots.findIndex(item=>item.month===month);if(index<0)return alert('請先選擇已儲存的資料月份。');if(!confirm('確定要刪除 '+monthLabel(month)+' 的整張月度資料卡嗎？此動作無法復原，建議先匯出備份。'))return;state.snapshots.splice(index,1);save();renderRecordSelector();renderDashboard();window.refreshDynamicReviewV19?.();});
}
// Version 71: dynamic-review ratio chart includes leverage and net debt ratio.
function reviewRatioScaleMaxV71(values){
 const maximum=Math.max(0,...values.filter(value=>Number.isFinite(Number(value))).map(Number));
 return Math.max(100,Math.ceil((maximum*1.1-1e-9)/10)*10);
}
function reviewRatioMaxForVisibleV71(chart,definitions=chart.data.datasets){
 return reviewRatioScaleMaxV71(definitions.flatMap((dataset,index)=>chart.isDatasetVisible(index)?dataset.data:[]));
}
function reviewLegendClickV19(event,item,legend){
 if(isReviewPlayingV21())return;
 Chart.defaults.plugins.legend.onClick(event,item,legend);
 const chart=legend.chart;
 if(chart.canvas?.id==='reviewHistoryChart'){
  const maximum=reviewHistoryMaxForVisibleV34(chart);
  chart.options.scales.yBars.max=maximum;
  chart.options.scales.yLines.max=maximum;
  chart._historyAxisMax=maximum;
  chart.update('none');
  return;
 }
 if(chart.canvas?.id==='reviewRatioChart'){
  chart.options.scales.y.max=reviewRatioMaxForVisibleV71(chart);
  chart.update('none');
 }
}
function renderReviewRatioV19(rows,frame){
 const labels=rows.map(x=>monthLabel(x.month));
 const series=[
  ['股票','stocks',COLORS.stocks,value=>value.assets?value.stocks/value.assets*100:null],
  ['債券','bonds',COLORS.bonds,value=>value.assets?value.bonds/value.assets*100:null],
  ['現金','cash',COLORS.cash,value=>value.assets?value.cash/value.assets*100:null],
  ['槓桿比例','leverage','#9a5ba0',value=>value.leverage*100],
  ['淨債務比','netDebtRatio','#b14d72',value=>value.debtRatio*100]
 ];
 const definitions=series.map(([label,key,color,getValue])=>({label,data:rows.map((snapshot,index)=>{if(index>frame)return null;return getValue(compute(snapshot));}),borderColor:color,backgroundColor:color,tension:.28,pointRadius:3,spanGaps:false,clip:8}));
 const options=reviewOptionsV19(true);
 options.animation=false;
 const state=reviewStateV19(),canvas=document.getElementById('reviewRatioChart'),chart=state.charts.ratio;
 if(!canvas)return;
 if(!chart){
  options.scales.y.max=reviewRatioScaleMaxV71(definitions.flatMap(definition=>definition.data));
  state.charts.ratio=new Chart(canvas,{type:'line',data:{labels,datasets:definitions},options});
  state.charts.ratio._ratioFrame=frame;
  return;
 }
 const isNextMonth=chart._ratioFrame===frame-1;
 if(isNextMonth){
  chart.options.scales.y.max=reviewRatioScaleMaxV71(definitions.flatMap((definition,index)=>chart.isDatasetVisible(index)?definition.data:[]));
  chart._ratioFrame=frame;
  animateRatioMonthV26(chart,definitions,frame);
  return;
 }
 if(chart._ratioAnimation){cancelAnimationFrame(chart._ratioAnimation);chart._ratioAnimation=null}
 const visibility=chart.data.datasets.map((dataset,index)=>chart.isDatasetVisible(index));
 chart.data.labels=labels;
 definitions.forEach((definition,index)=>{if(chart.data.datasets[index])Object.assign(chart.data.datasets[index],definition);else chart.data.datasets.push(definition)});
 chart.data.datasets.length=definitions.length;
 chart.options=options;
 chart.data.datasets.forEach((dataset,index)=>chart.setDatasetVisibility(index,visibility[index]!==false));
 chart.options.scales.y.max=reviewRatioMaxForVisibleV71(chart,definitions);
 chart._ratioFrame=frame;
 chart.update('none');
}
// Version 72: dashboard ratio chart includes leverage and net debt ratio.
function renderCharts(){
 const cards=snapshots(),byMonth=new Map(cards.map(snapshot=>[snapshot.month,snapshot])),rows=monthSequenceV3().map(month=>{const snapshot=byMonth.get(month);return snapshot?{month,salary:num(snapshot.salary),investment:num(snapshot.totalInvestment),...compute(snapshot)}:{month,salary:0,investment:null,assets:null,net:null,stocks:null,bonds:null,banks:null,brokerCash:null,cash:null,leverage:null,debtRatio:null}}),labels=rows.map(row=>monthLabel(row.month));
 charts.ratio?.destroy();charts.history?.destroy();
 const ratioSeries=[
  ['股票','stocks',COLORS.stocks,row=>row.assets?row.stocks/row.assets*100:null],
  ['債券','bonds',COLORS.bonds,row=>row.assets?row.bonds/row.assets*100:null],
  ['現金','cash',COLORS.cash,row=>row.assets?row.cash/row.assets*100:null],
  ['槓桿比例','leverage','#9a5ba0',row=>Number.isFinite(row.leverage)?row.leverage*100:null],
  ['淨債務比','netDebtRatio','#b14d72',row=>Number.isFinite(row.debtRatio)?row.debtRatio*100:null]
 ];
 charts.ratio=new Chart(document.getElementById('ratioChart'),{type:'line',data:{labels,datasets:ratioSeries.map(([label,key,color,getValue])=>({label,data:rows.map(getValue),borderColor:color,backgroundColor:color,tension:.25,pointRadius:3,spanGaps:true,clip:8}))},options:dashboardLineOptionsV43(true)});
 let salaryTotal=0,lastInvestment=null;const salaryLine=rows.map(row=>(salaryTotal+=row.salary)),investmentLine=rows.map(row=>{if(row.investment!==null)lastInvestment=row.investment;return lastInvestment}),maximum=Math.max(0,...rows.map(row=>row.assets||0),...rows.map(row=>row.net||0),...salaryLine,...investmentLine.map(value=>value||0)),historyOptions=historyOptionsV6(maximum);historyOptions.plugins.legend.onClick=dashboardLegendClickV43;
 charts.history=new Chart(document.getElementById('historyChart'),{data:{labels,datasets:[
  {type:'bar',label:'股票',data:rows.map(row=>row.stocks),backgroundColor:COLORS.stocks,stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'債券',data:rows.map(row=>row.bonds),backgroundColor:COLORS.bonds,stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'證券現金',data:rows.map(row=>row.brokerCash),backgroundColor:'#d6a946',stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'銀行現金',data:rows.map(row=>row.banks),backgroundColor:COLORS.cash,stack:'asset',yAxisID:'yBars',order:2},
  {type:'line',label:'總資產',data:rows.map(row=>row.assets),borderColor:'#14251e',backgroundColor:'#14251e',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1},
  {type:'line',label:'淨資產',data:rows.map(row=>row.net),borderColor:'#1b778f',backgroundColor:'#1b778f',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1},
  {type:'line',label:'累積薪水',data:salaryLine,borderColor:'#73589d',backgroundColor:'#73589d',tension:.22,pointRadius:2,yAxisID:'yLines',order:1},
  {type:'line',label:'總投入金額',data:investmentLine,borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.22,pointRadius:3,spanGaps:true,yAxisID:'yLines',order:1}
 ]},options:historyOptions});
 refreshDashboardYAxisV43(charts.ratio);charts.ratio.update('none');refreshDashboardYAxisV43(charts.history);charts.history.update('none');
}
// Version 73: keep the dashboard ratio scale at 100% until any visible line exceeds it.
function dashboardYAxisBoundsV43(chart,includeIndex=null){
 const {minimum,maximum}=dashboardAxisValuesV43(chart,includeIndex),id=chart.canvas?.id||'',range=Math.max(maximum-minimum,Math.abs(maximum),Math.abs(minimum),1),lower=minimum<0?minimum-range*.12:0;
 if(id==='ratioChart'){
  if(maximum<=100+1e-9)return{min:0,max:100};
  const padded=maximum*1.1;
  return{min:0,max:Math.max(110,Math.ceil((padded-1e-9)/10)*10)};
 }
 if(id==='historyChart'){return{min:lower,max:dashboardHistoryMoneyMaxV51(Math.max(0,maximum))};}
 if(id==='cumulativeExpenseChart'){return{min:lower,max:dashboardMoneyMaxV50(Math.max(0,maximum))};}
 return{min:lower,max:maximum>0?maximum+range*.12:100};
}
// Version 75: dynamically scale the review ratio axis from the played and legend-visible lines.
function reviewRatioScaleMaxV71(values){
 const maximum=Math.max(0,...values.filter(value=>Number.isFinite(Number(value))).map(Number));
 if(!(maximum>0))return 10;
 return Math.max(10,Math.ceil((maximum*1.1-1e-9)/10)*10);
}
// Version 76: cap review-ratio dynamic scaling at 100% unless a visible line exceeds 100%.
function reviewRatioScaleMaxV71(values){
 const maximum=Math.max(0,...values.filter(value=>Number.isFinite(Number(value))).map(Number));
 if(!(maximum>0))return 10;
 const padded=Math.ceil((maximum*1.1-1e-9)/10)*10;
 return maximum<=100+1e-9?Math.min(100,Math.max(10,padded)):Math.max(110,padded);
}
// Version 77: pin the review-ratio lower bound at 0% during frame and legend transitions.
function reviewLegendClickV19(event,item,legend){
 if(isReviewPlayingV21())return;
 Chart.defaults.plugins.legend.onClick(event,item,legend);
 const chart=legend.chart;
 if(chart.canvas?.id==='reviewHistoryChart'){
  const maximum=reviewHistoryMaxForVisibleV34(chart);
  chart.options.scales.yBars.min=0;chart.options.scales.yBars.max=maximum;
  chart.options.scales.yLines.min=0;chart.options.scales.yLines.max=maximum;
  chart._historyAxisMax=maximum;
  chart.update('none');
  return;
 }
 if(chart.canvas?.id==='reviewRatioChart'){
  chart.options.scales.y.min=0;
  chart.options.scales.y.max=reviewRatioMaxForVisibleV71(chart);
  chart.update('none');
 }
}
function renderReviewRatioV19(rows,frame){
 const labels=rows.map(x=>monthLabel(x.month));
 const series=[
  ['股票','stocks',COLORS.stocks,value=>value.assets?value.stocks/value.assets*100:null],
  ['債券','bonds',COLORS.bonds,value=>value.assets?value.bonds/value.assets*100:null],
  ['現金','cash',COLORS.cash,value=>value.assets?value.cash/value.assets*100:null],
  ['槓桿比例','leverage','#9a5ba0',value=>value.leverage*100],
  ['淨債務比','netDebtRatio','#b14d72',value=>value.debtRatio*100]
 ];
 const definitions=series.map(([label,key,color,getValue])=>({label,data:rows.map((snapshot,index)=>index>frame?null:getValue(compute(snapshot))),borderColor:color,backgroundColor:color,tension:.28,pointRadius:3,spanGaps:false,clip:8}));
 const options=reviewOptionsV19(true);
 options.animation=false;options.scales.y.min=0;
 const state=reviewStateV19(),canvas=document.getElementById('reviewRatioChart'),chart=state.charts.ratio;
 if(!canvas)return;
 if(!chart){
  options.scales.y.max=reviewRatioScaleMaxV71(definitions.flatMap(definition=>definition.data));
  state.charts.ratio=new Chart(canvas,{type:'line',data:{labels,datasets:definitions},options});
  state.charts.ratio._ratioFrame=frame;
  return;
 }
 const isNextMonth=chart._ratioFrame===frame-1;
 if(isNextMonth){
  chart.options.scales.y.min=0;
  chart.options.scales.y.max=reviewRatioScaleMaxV71(definitions.flatMap((definition,index)=>chart.isDatasetVisible(index)?definition.data:[]));
  chart._ratioFrame=frame;
  animateRatioMonthV26(chart,definitions,frame);
  return;
 }
 if(chart._ratioAnimation){cancelAnimationFrame(chart._ratioAnimation);chart._ratioAnimation=null}
 const visibility=chart.data.datasets.map((dataset,index)=>chart.isDatasetVisible(index));
 chart.data.labels=labels;
 definitions.forEach((definition,index)=>{if(chart.data.datasets[index])Object.assign(chart.data.datasets[index],definition);else chart.data.datasets.push(definition)});
 chart.data.datasets.length=definitions.length;
 chart.options=options;
 chart.data.datasets.forEach((dataset,index)=>chart.setDatasetVisibility(index,visibility[index]!==false));
 chart.options.scales.y.min=0;
 chart.options.scales.y.max=reviewRatioMaxForVisibleV71(chart,definitions);
 chart._ratioFrame=frame;
 chart.update('none');
}
// Version 78: mirror the review-ratio percentage scale on the right side.
function reviewOptionsV19(percent){
 const ratioScales={
  x:{grid:{display:false}},
  y:{beginAtZero:true,min:0,max:100,position:'left',ticks:{callback:value=>value+'%'}},
  yRight:{beginAtZero:true,min:0,max:100,position:'right',grid:{drawOnChartArea:false},ticks:{callback:value=>value+'%'}}
 };
 return{responsive:true,maintainAspectRatio:false,animation:{duration:620,easing:'easeOutQuart'},interaction:{mode:'index',intersect:false},plugins:{legend:{position:'bottom',labels:{boxWidth:10,usePointStyle:true,padding:16},onClick:reviewLegendClickV19},tooltip:{callbacks:{label:item=>item.dataset&&item.dataset.type==='line'?item.dataset.label+'：'+money(item.parsed.y):item.dataset?item.dataset.label+'：'+(percent?item.parsed.y.toFixed(1)+'%':money(item.parsed.y)):item.label+'：'+money(item.raw)}}},scales:percent?ratioScales:{x:{stacked:true,grid:{display:false}},yBars:{stacked:true,beginAtZero:true,min:0,position:'left',ticks:{callback:value=>axisMoney(value)}},yLines:{stacked:false,beginAtZero:true,min:0,position:'right',grid:{drawOnChartArea:false},ticks:{callback:value=>axisMoney(value)}}}};
}
function setReviewRatioAxisBoundsV78(chart,maximum){
 const scales=chart.options.scales;
 scales.y.min=0;scales.y.max=maximum;
 scales.yRight.min=0;scales.yRight.max=maximum;
}
function reviewLegendClickV19(event,item,legend){
 if(isReviewPlayingV21())return;
 Chart.defaults.plugins.legend.onClick(event,item,legend);
 const chart=legend.chart;
 if(chart.canvas?.id==='reviewHistoryChart'){
  const maximum=reviewHistoryMaxForVisibleV34(chart);
  chart.options.scales.yBars.min=0;chart.options.scales.yBars.max=maximum;
  chart.options.scales.yLines.min=0;chart.options.scales.yLines.max=maximum;
  chart._historyAxisMax=maximum;chart.update('none');return;
 }
 if(chart.canvas?.id==='reviewRatioChart'){
  setReviewRatioAxisBoundsV78(chart,reviewRatioMaxForVisibleV71(chart));
  chart.update('none');
 }
}
function renderReviewRatioV19(rows,frame){
 const labels=rows.map(item=>monthLabel(item.month));
 const series=[
  ['股票',COLORS.stocks,value=>value.assets?value.stocks/value.assets*100:null],
  ['債券',COLORS.bonds,value=>value.assets?value.bonds/value.assets*100:null],
  ['現金',COLORS.cash,value=>value.assets?value.cash/value.assets*100:null],
  ['槓桿比例','#9a5ba0',value=>value.leverage*100],
  ['淨債務比','#b14d72',value=>value.debtRatio*100]
 ];
 const definitions=series.map(([label,color,getValue])=>({label,data:rows.map((snapshot,index)=>index>frame?null:getValue(compute(snapshot))),borderColor:color,backgroundColor:color,tension:.28,pointRadius:3,spanGaps:false,clip:8}));
 const options=reviewOptionsV19(true);options.animation=false;
 const state=reviewStateV19(),canvas=document.getElementById('reviewRatioChart'),chart=state.charts.ratio;
 if(!canvas)return;
 if(!chart){
  const maximum=reviewRatioScaleMaxV71(definitions.flatMap(definition=>definition.data));
  options.scales.y.min=0;options.scales.y.max=maximum;options.scales.yRight.min=0;options.scales.yRight.max=maximum;
  state.charts.ratio=new Chart(canvas,{type:'line',data:{labels,datasets:definitions},options});state.charts.ratio._ratioFrame=frame;return;
 }
 const isNextMonth=chart._ratioFrame===frame-1;
 if(isNextMonth){
  setReviewRatioAxisBoundsV78(chart,reviewRatioScaleMaxV71(definitions.flatMap((definition,index)=>chart.isDatasetVisible(index)?definition.data:[])));
  chart._ratioFrame=frame;animateRatioMonthV26(chart,definitions,frame);return;
 }
 if(chart._ratioAnimation){cancelAnimationFrame(chart._ratioAnimation);chart._ratioAnimation=null}
 const visibility=chart.data.datasets.map((dataset,index)=>chart.isDatasetVisible(index));
 chart.data.labels=labels;definitions.forEach((definition,index)=>{if(chart.data.datasets[index])Object.assign(chart.data.datasets[index],definition);else chart.data.datasets.push(definition)});chart.data.datasets.length=definitions.length;chart.options=options;
 chart.data.datasets.forEach((dataset,index)=>chart.setDatasetVisibility(index,visibility[index]!==false));
 setReviewRatioAxisBoundsV78(chart,reviewRatioMaxForVisibleV71(chart,definitions));
 chart._ratioFrame=frame;chart.update('none');
}
// Version 88: actual spending uses cumulative salary minus investment and all bank cash; add monthly spending deltas.
function bankCashV88(snapshot){return sum(snapshot?.banks||[]);}
function spendingValuesV88(throughSnapshot){
 const cards=snapshots().filter(snapshot=>snapshot.month<=throughSnapshot.month);
 const salary=cards.reduce((total,snapshot)=>total+num(snapshot.salary),0);
 const c=compute(throughSnapshot);
 const initialAssets=sum((throughSnapshot.banks||[]).filter(bank=>bank.initialAsset));
 const rough=initialAssets+salary-c.assets;
 const actual=salary-num(throughSnapshot.totalInvestment)-bankCashV88(throughSnapshot);
 const previous=cards.length>1?cards.at(-2):null;
 if(!previous)return{salary,rough,actual,previous:null,previousRough:null,previousActual:null};
 const previousCards=cards.slice(0,-1);
 const previousSalary=previousCards.reduce((total,snapshot)=>total+num(snapshot.salary),0);
 const previousC=compute(previous);
 const previousInitialAssets=sum((previous.banks||[]).filter(bank=>bank.initialAsset));
 return{salary,rough,actual,previous,previousRough:previousInitialAssets+previousSalary-previousC.assets,previousActual:previousSalary-num(previous.totalInvestment)-bankCashV88(previous)};
}
function incomeExpenseMetricsV13(c,throughSnapshot){
 if(!throughSnapshot){
  const salary=accruedSalary(),months=workMonths(),initialAssets=sum((state.current.banks||[]).filter(bank=>bank.initialAsset)),rough=initialAssets+salary-c.assets,actual=initialAssets+salary-num(state.current.totalInvestment)-bankCashV88(state.current);
  return`${metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡')}${metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡起 ${months} 個月`:'尚無資料卡')}${metric('粗估累積花費',money(rough),'累積薪水 − 總資產')}${metric('粗估平均月花費',months?money(rough/months):'—',months?'粗估累積花費 ÷ 工作月數':'尚無資料卡')}${metric('實際累積花費',money(actual),'初始資產 ＋ 累積薪水 − 總投入金額 − 銀行現金')}${metric('實際平均月花費',months?money(actual/months):'—',months?'實際累積花費 ÷ 工作月數':'尚無資料卡')}${metric('粗估本月花費','—','請先儲存前一個月份資料')}${metric('實際本月花費','—','請先儲存前一個月份資料')}`;
 }
 const cards=snapshots().filter(snapshot=>snapshot.month<=throughSnapshot.month),firstMonth=cards[0]?.month,end=throughSnapshot.month,months=firstMonth?((Number(end.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(end.slice(5,7))-Number(firstMonth.slice(5,7))+1):0,spending=spendingValuesV88(throughSnapshot);
 const monthlyRough=spending.previous?spending.rough-spending.previousRough:null,monthlyActual=spending.previous?spending.actual-spending.previousActual:null;
 return`${metric('累積薪水',money(spending.salary),months?`資料卡期間 ${months} 個月`:'尚無資料卡')}${metric('平均月收入',months?money(spending.salary/months):'—',months?`最早資料卡至本月 ${months} 個月`:'尚無資料卡')}${metric('粗估累積花費',money(spending.rough),'初始資產 ＋ 累積薪水 − 本月總資產')}${metric('粗估平均月花費',months?money(spending.rough/months):'—',months?'粗估累積花費 ÷ 資料卡期間':'尚無資料卡')}${metric('實際累積花費',money(spending.actual),'初始資產 ＋ 累積薪水 − 總投入金額 − 銀行現金')}${metric('實際平均月花費',months?money(spending.actual/months):'—',months?'實際累積花費 ÷ 資料卡期間':'尚無資料卡')}${metric('粗估本月花費',monthlyRough===null?'—':money(monthlyRough),spending.previous?'本月粗估累積花費 − 前一個月粗估累積花費':'無前一個月份資料')}${metric('實際本月花費',monthlyActual===null?'—':money(monthlyActual),spending.previous?'本月實際累積花費 − 前一個月實際累積花費':'無前一個月份資料')}`;
}
function averageExpenseTrendV39(){
 const cards=snapshots();if(!cards.length)return[];const firstMonth=cards[0].month;
 return cards.map((snapshot,index)=>{const spending=spendingValuesV88(snapshot),months=(Number(snapshot.month.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(snapshot.month.slice(5,7))-Number(firstMonth.slice(5,7))+1;return{month:snapshot.month,rough:months?spending.rough/months:null,actual:months?spending.actual/months:null};});
}
function cumulativeExpenseTrendV41(){return snapshots().map(snapshot=>{const spending=spendingValuesV88(snapshot);return{month:snapshot.month,rough:spending.rough,actual:spending.actual};});}
// Version 89: group income-and-expense metrics into the requested 2 / 3 / 3 rows.
function incomeExpenseRowsV89(rows){return rows.map(row=>`<div class="income-expense-row" style="--income-columns:${row.length}">${row.join('')}</div>`).join('');}
function incomeExpenseMetricsV13(c,throughSnapshot){
 if(!throughSnapshot){
  const salary=accruedSalary(),months=workMonths(),initialAssets=sum((state.current.banks||[]).filter(bank=>bank.initialAsset)),rough=initialAssets+salary-c.assets,actual=initialAssets+salary-num(state.current.totalInvestment)-bankCashV88(state.current);
  return incomeExpenseRowsV89([
   [metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡'),metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡起 ${months} 個月`:'尚無資料卡')],
   [metric('粗估累積花費',money(rough),'累積薪水 − 總資產'),metric('粗估本月花費','—','請先儲存前一個月份資料'),metric('粗估平均月花費',months?money(rough/months):'—',months?'粗估累積花費 ÷ 工作月數':'尚無資料卡')],
   [metric('實際累積花費',money(actual),'初始資產 ＋ 累積薪水 − 總投入金額 − 銀行現金'),metric('實際本月花費','—','請先儲存前一個月份資料'),metric('實際平均月花費',months?money(actual/months):'—',months?'實際累積花費 ÷ 工作月數':'尚無資料卡')]
  ]);
 }
 const cards=snapshots().filter(snapshot=>snapshot.month<=throughSnapshot.month),firstMonth=cards[0]?.month,end=throughSnapshot.month,months=firstMonth?((Number(end.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(end.slice(5,7))-Number(firstMonth.slice(5,7))+1):0,spending=spendingValuesV88(throughSnapshot),monthlyRough=spending.previous?spending.rough-spending.previousRough:null,monthlyActual=spending.previous?spending.actual-spending.previousActual:null;
 return incomeExpenseRowsV89([
  [metric('累積薪水',money(spending.salary),months?`資料卡期間 ${months} 個月`:'尚無資料卡'),metric('平均月收入',months?money(spending.salary/months):'—',months?`最早資料卡至本月 ${months} 個月`:'尚無資料卡')],
  [metric('粗估累積花費',money(spending.rough),'初始資產 ＋ 累積薪水 − 本月總資產'),metric('粗估本月花費',monthlyRough===null?'—':money(monthlyRough),spending.previous?'本月粗估累積花費 − 前一個月粗估累積花費':'無前一個月份資料'),metric('粗估平均月花費',months?money(spending.rough/months):'—',months?'粗估累積花費 ÷ 資料卡期間':'尚無資料卡')],
  [metric('實際累積花費',money(spending.actual),'初始資產 ＋ 累積薪水 − 總投入金額 − 銀行現金'),metric('實際本月花費',monthlyActual===null?'—':money(monthlyActual),spending.previous?'本月實際累積花費 − 前一個月實際累積花費':'無前一個月份資料'),metric('實際平均月花費',months?money(spending.actual/months):'—',months?'實際累積花費 ÷ 資料卡期間':'尚無資料卡')]
 ]);
}
// Version 92: dashboard income and expense always uses the latest stored monthly record.
function renderDashboard(){
 const latest=latestSnapshot(),view=overviewMarkupV3(latest),last=snapshots().at(-1);
 document.getElementById('headlineMetrics').innerHTML=summaryMetricsV12(view.c,latest.totalInvestment);
 document.getElementById('incomeExpenseMetrics').innerHTML=incomeExpenseMetricsV13(view.c,latest);
 document.getElementById('detailMetrics').innerHTML=view.detail;
 document.getElementById('snapshotCaption').textContent=last?`最新資料卡：${monthLabel(last.month)}｜填寫於 ${last.entryDate||'—'}`:'尚未儲存月度資料';
 renderAllocation(view.c);renderAverageExpenseChartV39();renderCharts();renderPerformance();renderCumulativeExpenseChartV41();
 [charts.ratio,charts.history,charts.averageExpense,charts.cumulativeExpense].forEach(tuneDashboardChartV44);
}
// Version 93: actual cumulative spending includes the selected initial bank assets.
function spendingValuesV88(throughSnapshot){
 const cards=snapshots().filter(snapshot=>snapshot.month<=throughSnapshot.month);
 const salary=cards.reduce((total,snapshot)=>total+num(snapshot.salary),0);
 const c=compute(throughSnapshot);
 const initialAssets=sum((throughSnapshot.banks||[]).filter(bank=>bank.initialAsset));
 const rough=initialAssets+salary-c.assets;
 const actual=initialAssets+salary-num(throughSnapshot.totalInvestment)-bankCashV88(throughSnapshot);
 const previous=cards.length>1?cards.at(-2):null;
 if(!previous)return{salary,rough,actual,previous:null,previousRough:null,previousActual:null};
 const previousCards=cards.slice(0,-1);
 const previousSalary=previousCards.reduce((total,snapshot)=>total+num(snapshot.salary),0);
 const previousC=compute(previous);
 const previousInitialAssets=sum((previous.banks||[]).filter(bank=>bank.initialAsset));
 return{salary,rough,actual,previous,previousRough:previousInitialAssets+previousSalary-previousC.assets,previousActual:previousInitialAssets+previousSalary-num(previous.totalInvestment)-bankCashV88(previous)};
}
// Version 94: add monthly rough and actual spending lines to the average-spending trend.
function averageExpenseTrendV39(){
 const cards=snapshots();if(!cards.length)return[];const firstMonth=cards[0].month;
 return cards.map(snapshot=>{
  const spending=spendingValuesV88(snapshot);
  const months=(Number(snapshot.month.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(snapshot.month.slice(5,7))-Number(firstMonth.slice(5,7))+1;
  return{month:snapshot.month,rough:months?spending.rough/months:null,actual:months?spending.actual/months:null,monthlyRough:spending.previous?spending.rough-spending.previousRough:null,monthlyActual:spending.previous?spending.actual-spending.previousActual:null};
 });
}
function renderAverageExpenseChartV39(){
 const canvas=document.getElementById('averageExpenseChart');if(!canvas)return;
 const rows=averageExpenseTrendV39();charts.averageExpense?.destroy();
 charts.averageExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估平均月花費',data:rows.map(row=>row.rough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:true},
  {label:'實際平均月花費',data:rows.map(row=>row.actual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:true},
  {label:'粗估本月花費',data:rows.map(row=>row.monthlyRough),borderColor:'#b14d72',backgroundColor:'#b14d72',borderDash:[6,4],tension:.25,pointRadius:3,spanGaps:false},
  {label:'實際本月花費',data:rows.map(row=>row.monthlyActual),borderColor:'#147550',backgroundColor:'#147550',borderDash:[6,4],tension:.25,pointRadius:3,spanGaps:false}
 ]},options:dashboardExpenseOptionsV43()});refreshDashboardYAxisV43(charts.averageExpense);charts.averageExpense.update('none');
}
// Version 95: separate monthly-spending lines into their own dashboard chart.
function renderAverageExpenseChartV39(){
 const canvas=document.getElementById('averageExpenseChart');if(!canvas)return;
 const rows=averageExpenseTrendV39();charts.averageExpense?.destroy();
 charts.averageExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估平均月花費',data:rows.map(row=>row.rough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:true},
  {label:'實際平均月花費',data:rows.map(row=>row.actual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:true}
 ]},options:dashboardExpenseOptionsV43()});refreshDashboardYAxisV43(charts.averageExpense);charts.averageExpense.update('none');
}
function renderMonthlyExpenseChartV95(){
 const canvas=document.getElementById('monthlyExpenseChart');if(!canvas)return;
 const rows=averageExpenseTrendV39();charts.monthlyExpense?.destroy();
 charts.monthlyExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估本月花費',data:rows.map(row=>row.monthlyRough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:false},
  {label:'實際本月花費',data:rows.map(row=>row.monthlyActual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:false}
 ]},options:dashboardExpenseOptionsV43()});refreshDashboardYAxisV43(charts.monthlyExpense);charts.monthlyExpense.update('none');
}
function renderDashboard(){
 const latest=latestSnapshot(),view=overviewMarkupV3(latest),last=snapshots().at(-1);
 document.getElementById('headlineMetrics').innerHTML=summaryMetricsV12(view.c,latest.totalInvestment);
 document.getElementById('incomeExpenseMetrics').innerHTML=incomeExpenseMetricsV13(view.c,latest);
 document.getElementById('detailMetrics').innerHTML=view.detail;
 document.getElementById('snapshotCaption').textContent=last?`最新資料卡：${monthLabel(last.month)}｜填寫於 ${last.entryDate||'—'}`:'尚未儲存月度資料';
 renderAllocation(view.c);renderCharts();renderPerformance();renderCumulativeExpenseChartV41();renderAverageExpenseChartV39();renderMonthlyExpenseChartV95();
 [charts.ratio,charts.history,charts.cumulativeExpense,charts.averageExpense,charts.monthlyExpense].forEach(tuneDashboardChartV44);
}
// Version 96: the top-left brand quickly returns the current page to its top.
function scrollToPageTopV96(){
 const start=window.scrollY||document.documentElement.scrollTop||0;
 if(start<=0)return;
 const startedAt=performance.now(),duration=220;
 const step=now=>{
  const progress=Math.min((now-startedAt)/duration,1),eased=1-Math.pow(1-progress,3);
  window.scrollTo(0,Math.round(start*(1-eased)));
  if(progress<1)requestAnimationFrame(step);
 };
 requestAnimationFrame(step);
}
function initScrollTopV96(){const button=document.getElementById('scrollTopBtn');if(button&&!button.dataset.scrollTopBound){button.addEventListener('click',scrollToPageTopV96);button.dataset.scrollTopBound='true';}}
initScrollTopV96();
// Version 99: every spending calculation uses only the initial assets selected on that same month; none selected means zero.
function initialAssetsV99(snapshot){return sum((snapshot?.banks||[]).filter(bank=>bank.initialAsset));}
function spendingValuesV88(throughSnapshot){
 const cards=snapshots().filter(snapshot=>snapshot.month<=throughSnapshot.month);
 const salary=cards.reduce((total,snapshot)=>total+num(snapshot.salary),0);
 const c=compute(throughSnapshot),initialAssets=initialAssetsV99(throughSnapshot);
 const rough=initialAssets+salary-c.assets;
 const actual=initialAssets+salary-num(throughSnapshot.totalInvestment)-bankCashV88(throughSnapshot);
 const previous=cards.length>1?cards.at(-2):null;
 if(!previous)return{salary,rough,actual,previous:null,previousRough:null,previousActual:null};
 const previousSalary=cards.slice(0,-1).reduce((total,snapshot)=>total+num(snapshot.salary),0);
 const previousC=compute(previous),previousInitialAssets=initialAssetsV99(previous);
 return{salary,rough,actual,previous,previousRough:previousInitialAssets+previousSalary-previousC.assets,previousActual:previousInitialAssets+previousSalary-num(previous.totalInvestment)-bankCashV88(previous)};
}
function incomeExpenseMetricsV13(c,throughSnapshot){
 if(!throughSnapshot){
  const salary=accruedSalary(),months=workMonths(),initialAssets=initialAssetsV99(state.current),rough=initialAssets+salary-c.assets,actual=initialAssets+salary-num(state.current.totalInvestment)-bankCashV88(state.current);
  return incomeExpenseRowsV89([
   [metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡'),metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡起 ${months} 個月`:'尚無資料卡')],
   [metric('粗估累積花費',money(rough),'初始資產 ＋ 累積薪水 − 本月總資產'),metric('粗估本月花費','—','請先儲存前一個月份資料'),metric('粗估平均月花費',months?money(rough/months):'—',months?'粗估累積花費 ÷ 工作月數':'尚無資料卡')],
   [metric('實際累積花費',money(actual),'初始資產 ＋ 累積薪水 − 總投入金額 − 銀行現金'),metric('實際本月花費','—','請先儲存前一個月份資料'),metric('實際平均月花費',months?money(actual/months):'—',months?'實際累積花費 ÷ 工作月數':'尚無資料卡')]
  ]);
 }
 const cards=snapshots().filter(snapshot=>snapshot.month<=throughSnapshot.month),firstMonth=cards[0]?.month,end=throughSnapshot.month,months=firstMonth?((Number(end.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(end.slice(5,7))-Number(firstMonth.slice(5,7))+1):0,spending=spendingValuesV88(throughSnapshot),monthlyRough=spending.previous?spending.rough-spending.previousRough:null,monthlyActual=spending.previous?spending.actual-spending.previousActual:null;
 return incomeExpenseRowsV89([
  [metric('累積薪水',money(spending.salary),months?`資料卡期間 ${months} 個月`:'尚無資料卡'),metric('平均月收入',months?money(spending.salary/months):'—',months?`最早資料卡至本月 ${months} 個月`:'尚無資料卡')],
  [metric('粗估累積花費',money(spending.rough),'初始資產 ＋ 累積薪水 − 本月總資產'),metric('粗估本月花費',monthlyRough===null?'—':money(monthlyRough),spending.previous?'本月粗估累積花費 − 前一個月粗估累積花費':'無前一個月份資料'),metric('粗估平均月花費',months?money(spending.rough/months):'—',months?'粗估累積花費 ÷ 資料卡期間':'尚無資料卡')],
  [metric('實際累積花費',money(spending.actual),'初始資產 ＋ 累積薪水 − 總投入金額 − 銀行現金'),metric('實際本月花費',monthlyActual===null?'—':money(monthlyActual),spending.previous?'本月實際累積花費 − 前一個月實際累積花費':'無前一個月份資料'),metric('實際平均月花費',months?money(spending.actual/months):'—',months?'實際累積花費 ÷ 資料卡期間':'尚無資料卡')]
 ]);
}
// Version 100: place current-month salary before cumulative income and separate monthly-record content into visual groups.
function incomeExpenseMetricsV13(c,throughSnapshot){
 const currentSalary=num(throughSnapshot?.salary??state.current?.salary);
 if(!throughSnapshot){
  const salary=accruedSalary(),months=workMonths(),initialAssets=initialAssetsV99(state.current),rough=initialAssets+salary-c.assets,actual=initialAssets+salary-num(state.current.totalInvestment)-bankCashV88(state.current);
  return incomeExpenseRowsV89([
   [metric('本月入帳薪水',money(currentSalary),'本月資料卡填入的薪水'),metric('累積薪水',money(salary),months?`工作 ${months} 個月`:'尚無資料卡'),metric('平均月收入',months?money(salary/months):'—',months?`最早資料卡起 ${months} 個月`:'尚無資料卡')],
   [metric('粗估累積花費',money(rough),'初始資產 ＋ 累積薪水 − 本月總資產'),metric('粗估本月花費','—','請先儲存前一個月份資料'),metric('粗估平均月花費',months?money(rough/months):'—',months?'粗估累積花費 ÷ 工作月數':'尚無資料卡')],
   [metric('實際累積花費',money(actual),'初始資產 ＋ 累積薪水 − 總投入金額 − 銀行現金'),metric('實際本月花費','—','請先儲存前一個月份資料'),metric('實際平均月花費',months?money(actual/months):'—',months?'實際累積花費 ÷ 工作月數':'尚無資料卡')]
  ]);
 }
 const cards=snapshots().filter(snapshot=>snapshot.month<=throughSnapshot.month),firstMonth=cards[0]?.month,end=throughSnapshot.month,months=firstMonth?((Number(end.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(end.slice(5,7))-Number(firstMonth.slice(5,7))+1):0,spending=spendingValuesV88(throughSnapshot),monthlyRough=spending.previous?spending.rough-spending.previousRough:null,monthlyActual=spending.previous?spending.actual-spending.previousActual:null;
 return incomeExpenseRowsV89([
  [metric('本月入帳薪水',money(currentSalary),'本月資料卡填入的薪水'),metric('累積薪水',money(spending.salary),months?`資料卡期間 ${months} 個月`:'尚無資料卡'),metric('平均月收入',months?money(spending.salary/months):'—',months?`最早資料卡至本月 ${months} 個月`:'尚無資料卡')],
  [metric('粗估累積花費',money(spending.rough),'初始資產 ＋ 累積薪水 − 本月總資產'),metric('粗估本月花費',monthlyRough===null?'—':money(monthlyRough),spending.previous?'本月粗估累積花費 − 前一個月粗估累積花費':'無前一個月份資料'),metric('粗估平均月花費',months?money(spending.rough/months):'—',months?'粗估累積花費 ÷ 資料卡期間':'尚無資料卡')],
  [metric('實際累積花費',money(spending.actual),'初始資產 ＋ 累積薪水 − 總投入金額 − 銀行現金'),metric('實際本月花費',monthlyActual===null?'—':money(monthlyActual),spending.previous?'本月實際累積花費 − 前一個月實際累積花費':'無前一個月份資料'),metric('實際平均月花費',months?money(spending.actual/months):'—',months?'實際累積花費 ÷ 資料卡期間':'尚無資料卡')]
 ]);
}
// Version 101: annual comparisons run from each January baseline through the following January.
function annualComparisonBaseMonthV101(month){
 const year=Number(month.slice(0,4)),monthNumber=Number(month.slice(5,7));
 return `${monthNumber===1?year-1:year}-01`;
}
function growthMarkupV3(s){
 const cards=snapshots(),i=cards.findIndex(item=>item.month===s.month),cur=compute(s),prev=i>0?compute(cards[i-1]):null;
 const baselineMonth=annualComparisonBaseMonthV101(s.month),baselineSnapshot=cards.find(item=>item.month===baselineMonth),base=baselineSnapshot?compute(baselineSnapshot):null;
 const diff=(a,b)=>b===null?'—':money(a-b),stockPosition=value=>value.stocks+value.bonds+value.brokerCash,netStockPosition=value=>stockPosition(value)-value.debt;
 const currentStock=stockPosition(cur),currentNetStock=netStockPosition(cur),previousStock=prev?stockPosition(prev):null,investment=num(s.totalInvestment);
 const baselineStockGrowth=base?stockPosition(base)-num(baselineSnapshot.totalInvestment):null,stockAnnualBase=baselineStockGrowth===null?null:investment+baselineStockGrowth;
 return[
  metric('總資產月成長',diff(cur.assets,prev?.assets??null),prev?`較 ${monthLabel(cards[i-1].month)}`:'無上月資料'),
  metric('總資產年成長',diff(cur.assets,base?.assets??null),base?`較 ${monthLabel(baselineMonth)}`:`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('扣除質押後總資產成長',diff(cur.net,base?.net??null),base?`較 ${monthLabel(baselineMonth)} 淨資產`:`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('年度績效',base?.net?pct((cur.net-base.net)/base.net):'—',base?`較 ${monthLabel(baselineMonth)} 淨資產`:`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('股票部位月成長',diff(currentStock,previousStock),prev?`較 ${monthLabel(cards[i-1].month)}`:'無上月資料'),
  metric('股票部位年成長',diff(currentStock,stockAnnualBase),base?`基準：本月投入＋${monthLabel(baselineMonth)}總成長`:`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('扣除質押後股票部位成長',diff(currentNetStock,stockAnnualBase),base?'扣債務後部位；基準同上':`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('股票部位年度績效',stockAnnualBase?pct((currentNetStock-stockAnnualBase)/stockAnnualBase):'—',base?'扣債務後部位相對年度基準':`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('股票部位總成長',money(currentStock-investment),'較當月總投入金額'),
  metric('扣除質押後股票部位總成長',money(currentNetStock-investment),'股票部位−債務−總投入'),
  metric('股票部位總績效',investment?pct((currentNetStock-investment)/investment):'—','扣債務股票部位相對總投入金額')
 ].join('');
}
// Version 102: add an annual record page based on stored monthly snapshots.
function annualRecordYearsV102(){return [...new Set(snapshots().map(snapshot=>snapshot.month.slice(0,4)))].sort();}
function annualExpenseTotalsV102(items){
 let rough=0,actual=0,roughCount=0,actualCount=0;
 items.forEach(snapshot=>{
  const spending=spendingValuesV88(snapshot);
  if(spending.previous){rough+=spending.rough-spending.previousRough;actual+=spending.actual-spending.previousActual;roughCount++;actualCount++;}
 });
 return{rough,actual,roughCount,actualCount};
}
function renderAnnualRecordSelectorV102(){
 const select=document.getElementById('annualRecordYear');if(!select)return;
 const years=annualRecordYearsV102(),previous=select.value;
 select.innerHTML=years.length?years.map(year=>`<option value="${year}">${year} 年</option>`).join(''):'<option value="">尚無資料</option>';
 select.value=years.includes(previous)?previous:years.at(-1)||'';
 renderAnnualRecordV102();
}
function renderAnnualRecordV102(){
 const select=document.getElementById('annualRecordYear'),empty=document.getElementById('annualRecordEmpty'),card=document.getElementById('annualRecordCard');if(!select||!empty||!card)return;
 const year=select.value,period=annualPeriodV107(year),items=period.flowItems;
 if(!period.closing){empty.hidden=false;card.hidden=true;return;}
 const first=period.baseline||period.closing,last=period.closing,firstComputed=compute(first),lastComputed=compute(last),salary=period.salaryItems.reduce((total,snapshot)=>total+num(snapshot.salary),0),expense=annualExpenseTotalsV102(items),stockPosition=value=>value.stocks+value.bonds+value.brokerCash;
 const monthRange=`${year}/01～${Number(year)+1}/01`,monthCount=items.length;
 const annualRough=expense.roughCount?money(expense.rough):'—',annualActual=expense.actualCount?money(expense.actual):'—';
 const assetChange=lastComputed.assets-firstComputed.assets,netChange=lastComputed.net-firstComputed.net,stockChange=stockPosition(lastComputed)-stockPosition(firstComputed);
 const overview=overviewMarkupV3(last);
 card.innerHTML=`<article class="record-card annual-record-card"><div class="record-top"><div><h2>${year} 年度資料卡</h2><p class="record-date">統計基準 ${monthRange}｜${period.settled?'已結算':'尚未結算'}｜花費涵蓋 ${monthCount} 個月份｜期末採用 ${monthLabel(last.month)}</p></div></div><div class="record-section"><h3>年度總覽</h3><div class="metric-grid summary-grid">${metric('年末總資產',money(lastComputed.assets),`含債務 ${money(lastComputed.debt)}`,true)}${metric('年末淨資產',money(lastComputed.net),'總資產 − 債務金額')}${metric('年末股票資產',money(lastComputed.stocks))}${metric('年末債券資產',money(lastComputed.bonds))}${metric('年末證券現金',money(lastComputed.brokerCash))}${metric('年末銀行現金',money(lastComputed.banks))}${metric('年末債務',money(lastComputed.debt))}${metric('年末總投入金額',money(last.totalInvestment),`採用 ${monthLabel(last.month)} 資料`)}</div></div><div class="record-section"><h3>年度收入與花費</h3><div class="metric-grid">${metric('年度入帳薪水',money(salary),`${period.salaryItems.length} 筆當年度薪水資料合計`)}${metric('年度平均月薪',period.salaryItems.length?money(salary/period.salaryItems.length):'—','依當年度已儲存薪水月份平均')}${metric('年度粗估花費',annualRough,expense.roughCount?`${expense.roughCount} 個可比較月份加總`:'缺少可比較的前期資料')}${metric('年度實際花費',annualActual,expense.actualCount?`${expense.actualCount} 個可比較月份加總`:'缺少可比較的前期資料')}</div></div><div class="record-section"><h3>年度資產變化</h3><div class="metric-grid annual-growth-grid">${annualGrowthMarkupV106(last)}</div></div><div class="record-section"><h3>年末投資組合指標</h3><div class="metric-grid">${overview.detail}</div></div><div class="record-section"><h3>資產熱力圖</h3><p class="muted">採用年度最後一張月度資料卡，依七個資產大分類彙整</p><div class="heatmap-wrap annual-category-heatmap">${annualCategoryHeatmapV105(last)}</div></div><div class="record-lists"><div class="record-list"><h3>年末銀行帳戶</h3>${list(last.banks||[])}</div><div class="record-list"><h3>年末證券資產</h3>${list(last.holdings||[])}</div><div class="record-list"><h3>年末證券戶現金</h3>${list(last.brokerCash||[])}</div><div class="record-list"><h3>年末債務</h3>${list(last.debts||[])}</div></div></article>`;
 setupHeatmapTooltipsV16(card);
 empty.hidden=true;card.hidden=false;
}
document.getElementById('annualRecordYear')?.addEventListener('change',renderAnnualRecordV102);
document.querySelector('.nav[data-page="annual-records"]')?.addEventListener('click',renderAnnualRecordSelectorV102);
document.getElementById('saveSnapshotBtn')?.addEventListener('click',renderAnnualRecordSelectorV102);
renderAnnualRecordSelectorV102();
// Version 103: add matching income lines to the three dashboard expense charts.
function expenseIncomeTrendV103(){
 const cards=snapshots();if(!cards.length)return[];const firstMonth=cards[0].month;let cumulativeSalary=0;
 return cards.map(snapshot=>{
  cumulativeSalary+=num(snapshot.salary);
  const spending=spendingValuesV88(snapshot),months=(Number(snapshot.month.slice(0,4))-Number(firstMonth.slice(0,4)))*12+Number(snapshot.month.slice(5,7))-Number(firstMonth.slice(5,7))+1;
  return{month:snapshot.month,rough:spending.rough,actual:spending.actual,cumulativeSalary,averageIncome:months?cumulativeSalary/months:null,monthlySalary:num(snapshot.salary),monthlyRough:spending.previous?spending.rough-spending.previousRough:null,monthlyActual:spending.previous?spending.actual-spending.previousActual:null};
 });
}
function renderCumulativeExpenseChartV41(){
 const canvas=document.getElementById('cumulativeExpenseChart');if(!canvas)return;
 const rows=expenseIncomeTrendV103();charts.cumulativeExpense?.destroy();
 charts.cumulativeExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估累積花費',data:rows.map(row=>row.rough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:true},
  {label:'實際累積花費',data:rows.map(row=>row.actual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:true},
  {label:'累積薪水',data:rows.map(row=>row.cumulativeSalary),borderColor:'#73589d',backgroundColor:'#73589d',tension:.25,pointRadius:3,spanGaps:true}
 ]},options:dashboardExpenseOptionsV43()});refreshDashboardYAxisV43(charts.cumulativeExpense);charts.cumulativeExpense.update('none');
}
function renderAverageExpenseChartV39(){
 const canvas=document.getElementById('averageExpenseChart');if(!canvas)return;
 const rows=expenseIncomeTrendV103();charts.averageExpense?.destroy();
 charts.averageExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估平均月花費',data:rows.map(row=>{const first=rows[0]?.month,months=first?((Number(row.month.slice(0,4))-Number(first.slice(0,4)))*12+Number(row.month.slice(5,7))-Number(first.slice(5,7))+1):0;return months?row.rough/months:null;}),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:true},
  {label:'實際平均月花費',data:rows.map(row=>{const first=rows[0]?.month,months=first?((Number(row.month.slice(0,4))-Number(first.slice(0,4)))*12+Number(row.month.slice(5,7))-Number(first.slice(5,7))+1):0;return months?row.actual/months:null;}),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:true},
  {label:'平均月收入',data:rows.map(row=>row.averageIncome),borderColor:'#73589d',backgroundColor:'#73589d',tension:.25,pointRadius:3,spanGaps:true}
 ]},options:dashboardExpenseOptionsV43()});refreshDashboardYAxisV43(charts.averageExpense);charts.averageExpense.update('none');
}
function renderMonthlyExpenseChartV95(){
 const canvas=document.getElementById('monthlyExpenseChart');if(!canvas)return;
 const rows=expenseIncomeTrendV103();charts.monthlyExpense?.destroy();
 charts.monthlyExpense=new Chart(canvas,{type:'line',data:{labels:rows.map(row=>monthLabel(row.month)),datasets:[
  {label:'粗估本月花費',data:rows.map(row=>row.monthlyRough),borderColor:'#b14d72',backgroundColor:'#b14d72',tension:.25,pointRadius:3,spanGaps:false},
  {label:'實際本月花費',data:rows.map(row=>row.monthlyActual),borderColor:'#147550',backgroundColor:'#147550',tension:.25,pointRadius:3,spanGaps:false},
  {label:'本月入帳薪水',data:rows.map(row=>row.monthlySalary),borderColor:'#73589d',backgroundColor:'#73589d',tension:.25,pointRadius:3,spanGaps:true}
 ]},options:dashboardExpenseOptionsV43()});refreshDashboardYAxisV43(charts.monthlyExpense);charts.monthlyExpense.update('none');
}
// Version 104: add five annual dashboard charts before the monthly chart series.
function annualDashboardRowsV104(){
 const monthly=expenseIncomeTrendV103(),monthlyByMonth=new Map(monthly.map(row=>[row.month,row])),groups=new Map();
 snapshots().forEach(snapshot=>{const year=snapshot.month.slice(0,4);if(!groups.has(year))groups.set(year,[]);groups.get(year).push(snapshot);});
 return [...groups.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([year,items])=>{
  const last=items.at(-1),c=compute(last),lastTrend=monthlyByMonth.get(last.month),priorTrend=monthly.filter(row=>row.month<year+'-01').at(-1);
  return{year,last,c,cumulativeSalary:lastTrend?.cumulativeSalary??0,averageIncome:lastTrend?.averageIncome??null,rough:lastTrend?.rough??null,actual:lastTrend?.actual??null,roughAverage:lastTrend&&lastTrend.averageIncome!==null?averageExpenseValueV104(lastTrend.rough,last.month):null,actualAverage:lastTrend&&lastTrend.averageIncome!==null?averageExpenseValueV104(lastTrend.actual,last.month):null,annualSalary:items.reduce((total,item)=>total+num(item.salary),0),annualRough:lastTrend?lastTrend.rough-(priorTrend?.rough??0):null,annualActual:lastTrend?lastTrend.actual-(priorTrend?.actual??0):null};
 });
}
function averageExpenseValueV104(value,month){const first=snapshots()[0]?.month;if(!first)return null;const months=(Number(month.slice(0,4))-Number(first.slice(0,4)))*12+Number(month.slice(5,7))-Number(first.slice(5,7))+1;return months?value/months:null;}
function annualLineDatasetV104(label,data,color){return{label,data,borderColor:color,backgroundColor:color,tension:.25,pointRadius:3,spanGaps:true,clip:8};}
function renderAnnualDashboardChartsV104(){
 const rows=annualDashboardRowsV104(),labels=rows.map(row=>`${row.year} 年`);
 ['annualRatio','annualHistory','annualCumulativeExpense','annualAverageExpense','annualExpense'].forEach(key=>charts[key]?.destroy());
 const ratioCanvas=document.getElementById('annualRatioChart');if(!ratioCanvas)return;
 charts.annualRatio=new Chart(ratioCanvas,{type:'line',data:{labels,datasets:[
  annualLineDatasetV104('股票',rows.map(row=>row.c.assets?row.c.stocks/row.c.assets*100:null),COLORS.stocks),
  annualLineDatasetV104('債券',rows.map(row=>row.c.assets?row.c.bonds/row.c.assets*100:null),COLORS.bonds),
  annualLineDatasetV104('現金',rows.map(row=>row.c.assets?row.c.cash/row.c.assets*100:null),COLORS.cash),
  annualLineDatasetV104('槓桿比例',rows.map(row=>Number.isFinite(row.c.leverage)?row.c.leverage*100:null),'#9a5ba0'),
  annualLineDatasetV104('淨債務比',rows.map(row=>Number.isFinite(row.c.debtRatio)?row.c.debtRatio*100:null),'#b14d72')
 ]},options:dashboardLineOptionsV43(true)});
 const maximum=Math.max(0,...rows.flatMap(row=>[row.c.assets,row.c.net,row.c.stocks,row.c.bonds,row.c.brokerCash,row.c.banks,row.cumulativeSalary,num(row.last.totalInvestment)])),historyOptions=historyOptionsV6(maximum);historyOptions.plugins.legend.onClick=dashboardLegendClickV43;
 charts.annualHistory=new Chart(document.getElementById('annualHistoryChart'),{data:{labels,datasets:[
  {type:'bar',label:'股票',data:rows.map(row=>row.c.stocks),backgroundColor:COLORS.stocks,stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'債券',data:rows.map(row=>row.c.bonds),backgroundColor:COLORS.bonds,stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'證券現金',data:rows.map(row=>row.c.brokerCash),backgroundColor:'#d6a946',stack:'asset',yAxisID:'yBars',order:2},
  {type:'bar',label:'銀行現金',data:rows.map(row=>row.c.banks),backgroundColor:COLORS.cash,stack:'asset',yAxisID:'yBars',order:2},
  {...annualLineDatasetV104('總資產',rows.map(row=>row.c.assets),'#14251e'),type:'line',yAxisID:'yLines',order:1},
  {...annualLineDatasetV104('淨資產',rows.map(row=>row.c.net),'#1b778f'),type:'line',yAxisID:'yLines',order:1},
  {...annualLineDatasetV104('累積薪水',rows.map(row=>row.cumulativeSalary),'#73589d'),type:'line',yAxisID:'yLines',order:1},
  {...annualLineDatasetV104('總投入金額',rows.map(row=>num(row.last.totalInvestment)),'#b14d72'),type:'line',yAxisID:'yLines',order:1}
 ]},options:historyOptions});
 charts.annualCumulativeExpense=new Chart(document.getElementById('annualCumulativeExpenseChart'),{type:'line',data:{labels,datasets:[annualLineDatasetV104('粗估累積花費',rows.map(row=>row.rough),'#b14d72'),annualLineDatasetV104('實際累積花費',rows.map(row=>row.actual),'#147550'),annualLineDatasetV104('累積薪水',rows.map(row=>row.cumulativeSalary),'#73589d')]},options:dashboardExpenseOptionsV43()});
 charts.annualAverageExpense=new Chart(document.getElementById('annualAverageExpenseChart'),{type:'line',data:{labels,datasets:[annualLineDatasetV104('粗估平均月花費',rows.map(row=>row.roughAverage),'#b14d72'),annualLineDatasetV104('實際平均月花費',rows.map(row=>row.actualAverage),'#147550'),annualLineDatasetV104('平均月收入',rows.map(row=>row.averageIncome),'#73589d')]},options:dashboardExpenseOptionsV43()});
 charts.annualExpense=new Chart(document.getElementById('annualExpenseChart'),{type:'line',data:{labels,datasets:[annualLineDatasetV104('年度粗估花費',rows.map(row=>row.annualRough),'#b14d72'),annualLineDatasetV104('年度實際花費',rows.map(row=>row.annualActual),'#147550'),annualLineDatasetV104('年度入帳薪水',rows.map(row=>row.annualSalary),'#73589d')]},options:dashboardExpenseOptionsV43()});
 [charts.annualRatio,charts.annualHistory,charts.annualCumulativeExpense,charts.annualAverageExpense,charts.annualExpense].forEach(chart=>{refreshDashboardYAxisV43(chart);chart.update('none');tuneDashboardChartV44(chart);});
}
function dashboardYAxisBoundsV43(chart,includeIndex=null){
 const {minimum,maximum}=dashboardAxisValuesV43(chart,includeIndex),id=chart.canvas?.id||'',range=Math.max(maximum-minimum,Math.abs(maximum),Math.abs(minimum),1),lower=minimum<0?minimum-range*.12:0;
 if(id==='ratioChart'||id==='annualRatioChart'){if(maximum<=100+1e-9)return{min:0,max:100};const padded=maximum*1.1;return{min:0,max:Math.max(110,Math.ceil((padded-1e-9)/10)*10)};}
 if(id==='historyChart'||id==='annualHistoryChart')return{min:lower,max:dashboardHistoryMoneyMaxV51(Math.max(0,maximum))};
 if(id==='cumulativeExpenseChart'||id==='annualCumulativeExpenseChart')return{min:lower,max:dashboardMoneyMaxV50(Math.max(0,maximum))};
 return{min:lower,max:maximum>0?maximum+range*.12:100};
}
function renderDashboard(){
 const latest=latestSnapshot(),view=overviewMarkupV3(latest),last=snapshots().at(-1);
 document.getElementById('headlineMetrics').innerHTML=summaryMetricsV12(view.c,latest.totalInvestment);
 document.getElementById('incomeExpenseMetrics').innerHTML=incomeExpenseMetricsV13(view.c,latest);
 document.getElementById('detailMetrics').innerHTML=view.detail;
 document.getElementById('snapshotCaption').textContent=last?`最新資料卡：${monthLabel(last.month)}｜填寫於 ${last.entryDate||'—'}`:'尚未儲存月度資料';
 renderAllocation(view.c);renderAnnualDashboardChartsV104();renderCharts();renderPerformance();renderCumulativeExpenseChartV41();renderAverageExpenseChartV39();renderMonthlyExpenseChartV95();
 [charts.ratio,charts.history,charts.cumulativeExpense,charts.averageExpense,charts.monthlyExpense].forEach(tuneDashboardChartV44);
}
// Version 105: annual-record heatmap aggregates the latest snapshot into seven asset categories.
function annualCategoryHeatmapV105(snapshot){
 const c=compute(snapshot),colors={aggressive:'#147550',conservative:'#63a883',leveraged:'#9a5ba0',longBond:'#24587e',shortBond:'#7faed1',bank:'#a96e1b',broker:'#e3bb4d'},entries=[
  {type:'aggressive',title:'證券資產｜積極型',amount:c.aggressive},{type:'conservative',title:'證券資產｜保守型',amount:c.conservative},{type:'leveraged',title:'證券資產｜槓桿型',amount:c.leveraged},{type:'longBond',title:'證券資產｜長債',amount:c.longBond},{type:'shortBond',title:'證券資產｜短債',amount:c.shortBond},{type:'bank',title:'銀行帳戶｜銀行現金',amount:c.banks},{type:'broker',title:'證券資產｜證券戶現金',amount:c.brokerCash}
 ],legend=entries.map(item=>'<span class="heatmap-legend-item"><i style="--legend-color:'+(colors[item.type]||'#6c7b73')+'"></i>'+item.title+'</span>').join(''),visible=entries.filter(item=>item.amount>0),total=visible.reduce((sum,item)=>sum+item.amount,0);
 if(!visible.length)return'<div class="heatmap-legend">'+legend+'</div><p class="muted heatmap-empty">該年度最後月份沒有可呈現的資產資料。</p>';
 const tiles=heatmapLayoutV20(visible.map(item=>({...item,area:item.amount/total*600000})).sort((a,b)=>b.amount-a.amount)),cells=tiles.map(item=>{const font=Math.min(30,Math.max(9,Math.sqrt(item.w*item.h)/5.8)),tiny=item.w<38||item.h<28,left=Math.max(0,Math.min(100,item.x/10)),top=Math.max(0,Math.min(100,item.y/6)),width=Math.max(0,Math.min(item.w/10,100-left)),height=Math.max(0,Math.min(item.h/6,100-top));return'<article class="heatmap-cell '+(tiny?'heatmap-tiny':'')+'" style="--heat-color:'+(colors[item.type]||'#6c7b73')+';--name-size:'+font.toFixed(1)+'px;left:'+left+'%;top:'+top+'%;width:'+width+'%;height:'+height+'%"><strong class="heatmap-name">'+item.title+'</strong><div class="heatmap-tooltip"><strong class="heatmap-tooltip-title">'+item.title+'</strong><span class="heatmap-tooltip-name">年度大分類</span><span class="heatmap-tooltip-value"><i></i>'+money(item.amount)+'</span><span class="heatmap-tooltip-percent">占七類資產 '+pct(item.amount/total)+'</span></div></article>'}).join('');
 return'<div class="heatmap-legend">'+legend+'</div><div class="heatmap-treemap">'+cells+'</div>';
}
// Version 106: annual-record growth cards mirror the nine annual metrics from monthly records.
function annualGrowthMarkupV106(snapshot){
 const cards=snapshots(),current=compute(snapshot),baselineMonth=annualComparisonBaseMonthV101(snapshot.month),baselineSnapshot=cards.find(item=>item.month===baselineMonth),baseline=baselineSnapshot?compute(baselineSnapshot):null;
 const diff=(a,b)=>b===null?'—':money(a-b),stockPosition=value=>value.stocks+value.bonds+value.brokerCash,netStockPosition=value=>stockPosition(value)-value.debt,currentStock=stockPosition(current),currentNetStock=netStockPosition(current),investment=num(snapshot.totalInvestment),baselineStockGrowth=baseline?stockPosition(baseline)-num(baselineSnapshot.totalInvestment):null,stockAnnualBase=baselineStockGrowth===null?null:investment+baselineStockGrowth;
 return[
  metric('總資產年成長',diff(current.assets,baseline?.assets??null),baseline?`較 ${monthLabel(baselineMonth)}`:`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('扣除質押後總資產成長',diff(current.net,baseline?.net??null),baseline?`較 ${monthLabel(baselineMonth)} 淨資產`:`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('年度績效',baseline?.net?pct((current.net-baseline.net)/baseline.net):'—',baseline?`較 ${monthLabel(baselineMonth)} 淨資產`:`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('股票部位年成長',diff(currentStock,stockAnnualBase),baseline?`基準：年末投入＋${monthLabel(baselineMonth)}總成長`:`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('扣除質押後股票部位成長',diff(currentNetStock,stockAnnualBase),baseline?'扣債務後部位；基準同上':`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('股票部位年度績效',stockAnnualBase?pct((currentNetStock-stockAnnualBase)/stockAnnualBase):'—',baseline?'扣債務後部位相對年度基準':`無 ${monthLabel(baselineMonth)} 基準資料`),
  metric('股票部位總成長',money(currentStock-investment),'較年末總投入金額'),
  metric('扣除質押後股票部位總成長',money(currentNetStock-investment),'股票部位−債務−年末總投入'),
  metric('股票部位總績效',investment?pct((currentNetStock-investment)/investment):'—','扣債務股票部位相對年末總投入金額')
 ].join('');
}
// Version 107: annual periods close on the following January snapshot.
function annualPeriodV107(year){
 const cards=snapshots(),start=`${year}-01`,nextJanuary=`${Number(year)+1}-01`,baseline=cards.find(snapshot=>snapshot.month===start)||null,nextClosing=cards.find(snapshot=>snapshot.month===nextJanuary)||null,calendarItems=cards.filter(snapshot=>snapshot.month>=start&&snapshot.month<nextJanuary),closing=nextClosing||calendarItems.at(-1)||null;
 return{year,start,nextJanuary,baseline,closing,settled:!!nextClosing,salaryItems:calendarItems,flowItems:closing?cards.filter(snapshot=>snapshot.month>start&&snapshot.month<=closing.month):[]};
}
function annualDashboardRowsV104(){
 const monthly=expenseIncomeTrendV103(),monthlyByMonth=new Map(monthly.map(row=>[row.month,row]));
 return annualRecordYearsV102().map(year=>{
  const period=annualPeriodV107(year),last=period.closing;if(!last)return null;
  const c=compute(last),lastTrend=monthlyByMonth.get(last.month),expense=annualExpenseTotalsV102(period.flowItems),annualSalary=period.salaryItems.reduce((total,item)=>total+num(item.salary),0);
  return{year,last,c,settled:period.settled,cumulativeSalary:lastTrend?.cumulativeSalary??0,averageIncome:lastTrend?.averageIncome??null,rough:lastTrend?.rough??null,actual:lastTrend?.actual??null,roughAverage:lastTrend?averageExpenseValueV104(lastTrend.rough,last.month):null,actualAverage:lastTrend?averageExpenseValueV104(lastTrend.actual,last.month):null,annualSalary,annualRough:expense.roughCount?expense.rough:null,annualActual:expense.actualCount?expense.actual:null};
 }).filter(Boolean);
}
// Version 108: annual heatmap legends use the monthly button style and an independent filter state.
function annualCategoryHeatmapV105(snapshot){
 const c=compute(snapshot),colors={aggressive:'#147550',conservative:'#63a883',leveraged:'#9a5ba0',longBond:'#24587e',shortBond:'#7faed1',bank:'#a96e1b',broker:'#e3bb4d'},entries=[
  {type:'aggressive',title:'證券資產｜積極型',amount:c.aggressive},{type:'conservative',title:'證券資產｜保守型',amount:c.conservative},{type:'leveraged',title:'證券資產｜槓桿型',amount:c.leveraged},{type:'longBond',title:'證券資產｜長債',amount:c.longBond},{type:'shortBond',title:'證券資產｜短債',amount:c.shortBond},{type:'bank',title:'銀行帳戶｜銀行現金',amount:c.banks},{type:'broker',title:'證券資產｜證券戶現金',amount:c.brokerCash}
 ];
 if(!window.annualHeatmapFiltersV108)window.annualHeatmapFiltersV108=new Set(entries.map(item=>item.type));
 const selected=window.annualHeatmapFiltersV108,legend=entries.map(item=>'<button type="button" class="heatmap-legend-item '+(selected.has(item.type)?'':'is-off')+'" data-annual-heatmap-type="'+item.type+'" aria-pressed="'+selected.has(item.type)+'"><i style="--legend-color:'+(colors[item.type]||'#6c7b73')+'"></i>'+item.title+'</button>').join(''),visible=entries.filter(item=>selected.has(item.type)&&item.amount>0),total=visible.reduce((sum,item)=>sum+item.amount,0);
 if(!visible.length)return'<div class="heatmap-legend">'+legend+'</div><p class="muted heatmap-empty">請至少開啟一個有資產金額的圖例類別。</p>';
 const tiles=heatmapLayoutV20(visible.map(item=>({...item,area:item.amount/total*600000})).sort((a,b)=>b.amount-a.amount)),cells=tiles.map(item=>{const font=Math.min(30,Math.max(9,Math.sqrt(item.w*item.h)/5.8)),tiny=item.w<38||item.h<28,left=Math.max(0,Math.min(100,item.x/10)),top=Math.max(0,Math.min(100,item.y/6)),width=Math.max(0,Math.min(item.w/10,100-left)),height=Math.max(0,Math.min(item.h/6,100-top));return'<article class="heatmap-cell '+(tiny?'heatmap-tiny':'')+'" style="--heat-color:'+(colors[item.type]||'#6c7b73')+';--name-size:'+font.toFixed(1)+'px;left:'+left+'%;top:'+top+'%;width:'+width+'%;height:'+height+'%"><strong class="heatmap-name">'+item.title+'</strong><div class="heatmap-tooltip"><strong class="heatmap-tooltip-title">'+item.title+'</strong><span class="heatmap-tooltip-name">年度大分類</span><span class="heatmap-tooltip-value"><i></i>'+money(item.amount)+'</span><span class="heatmap-tooltip-percent">占顯示資產 '+pct(item.amount/total)+'</span></div></article>'}).join('');
 return'<div class="heatmap-legend">'+legend+'</div><div class="heatmap-treemap">'+cells+'</div>';
}
function setupHeatmapTooltipsV16(host){
 let tip=document.getElementById('heatmapFloatingTooltip');if(!tip){tip=document.createElement('div');tip.id='heatmapFloatingTooltip';tip.className='heatmap-floating-tooltip';tip.hidden=true;document.body.append(tip)}
 if(!tip.dataset.dismissBound){document.addEventListener('pointermove',event=>{if(!event.target.closest('.heatmap-treemap'))tip.hidden=true});tip.dataset.dismissBound='1'}
 const isReview=host.dataset.reviewHeatmap==='true';
 host.querySelectorAll('[data-heatmap-type]').forEach(button=>button.addEventListener('click',()=>{if(isReview&&isReviewPlayingV21())return;const selected=window.heatmapFiltersV18||(window.heatmapFiltersV18=new Set()),type=button.dataset.heatmapType;selected.has(type)?selected.delete(type):selected.add(type);tip.hidden=true;if(isReview)renderReviewPanelV21('heatmap',reviewStateV19().frames.heatmap);else renderRecord()}));
 host.querySelectorAll('[data-annual-heatmap-type]').forEach(button=>button.addEventListener('click',()=>{const selected=window.annualHeatmapFiltersV108||(window.annualHeatmapFiltersV108=new Set()),type=button.dataset.annualHeatmapType;selected.has(type)?selected.delete(type):selected.add(type);tip.hidden=true;renderAnnualRecordV102()}));
 const hide=()=>{tip.hidden=true},move=(event,cell)=>{const gap=14;tip.style.setProperty('--heat-color',getComputedStyle(cell).getPropertyValue('--heat-color'));let x=event.clientX+gap,y=event.clientY+gap;const rect=tip.getBoundingClientRect();if(x+rect.width>window.innerWidth-8)x=event.clientX-rect.width-gap;if(y+rect.height>window.innerHeight-8)y=event.clientY-rect.height-gap;tip.style.left=x+'px';tip.style.top=y+'px'};
 host.querySelector('.heatmap-treemap')?.addEventListener('pointerleave',hide);host.querySelectorAll('.heatmap-cell').forEach(cell=>{const source=cell.querySelector('.heatmap-tooltip');cell.addEventListener('pointerenter',event=>{tip.innerHTML=source.innerHTML;tip.hidden=false;move(event,cell)});cell.addEventListener('pointermove',event=>move(event,cell));cell.addEventListener('pointerleave',hide)});
}