/* Sporting Hub Hong Kong - booking state machine, prototype v2.
   v1 _booking.js (html/prototype/_booking.js) with the six data blocks
   (STR, COURTS, CATS, CLASSES, COACHES, SIZES) replaced by references into
   window.BOOKING_DATA (built by scripts/build_strings.py from strings.js,
   loaded before this file) instead of hard-coded English/Chinese literals.
   Every function below -- T(), pick(), nm(), days(), every render*(),
   canAdvance(), next(), prev(), sync(), renderSummary(), renderRecap() and
   pageExtras() -- is byte-identical to v1 apart from where it reads its
   data, per BRIEF.md. Two documented exceptions inside pageExtras() and
   renderCoaches(), each flagged inline below. FLOWS, RAIL, S, TIMES,
   taken(), PRICES, money() and DIA are unchanged from v1: they are either
   pure state-machine plumbing or vector court-diagram assets, not text
   copy, so they do not move to strings.js.
   Mirrors the Bliss prototype's screen ids (s1/s2/s5/s6/s7/s8) because HKSH
   books on the Bliss backend. Two steps are backend change requests and are
   marked in the UI:
     s1c  category pre-select ahead of the standard flow
     s5   coach picked before the date
   Front end only. No network calls. Every price is a placeholder. */

/* ---------- prices: one object, one edit when Suki's rate card lands ---------- */
const PRICES = { court:null, class:null, pt:null };   /* null renders as HK$ TBC */
function money(v){
  return v == null
    ? '<span class="price-tbc" data-price="tbc">HK$ TBC</span>'
    : 'HK$ ' + v;
}

/* ---------- data: read from strings.js (window.BOOKING_DATA), not hard-coded ----------
   v1 hard-coded these six consts with English/Chinese literals inline.
   build_strings.py assembles the identical object shapes (en/zh, d_en/d_zh,
   h_en/h_zh, x_en/x_zh, tags_en/tags_zh) from strings.en.json /
   strings.zh.json plus a small non-text template, so every downstream
   function that reads COURTS / CATS / CLASSES / COACHES / SIZES / STR by
   name needs no further change. */
const STR = window.BOOKING_DATA.STR;
const COURTS = window.BOOKING_DATA.COURTS;
const CATS = window.BOOKING_DATA.CATS;
const CLASSES = window.BOOKING_DATA.CLASSES;
const COACHES = window.BOOKING_DATA.COACHES;
const SIZES = window.BOOKING_DATA.SIZES;

const TIMES = ["07:00","08:00","09:00","10:00","11:00","12:00","14:00","15:00",
               "16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
/* deterministic "already booked" pattern, so the demo looks the same every load */
const taken = (dayIdx, i) => ((dayIdx * 7 + i * 5) % 11) < 3;

/* ---------- state ---------- */
const qs = new URLSearchParams(location.search);
const MODE = ["venue","class","pt"].includes(qs.get("mode")) ? qs.get("mode") : "venue";
const FLOWS = {
  venue: ["s1","s2","s6","s7","s8"],
  class: ["s1c","s3","s6","s7","s8"],
  pt:    ["s5","s5b","s2","s6","s7","s8"]
};
const RAIL = {
  venue: ["st_court","st_when","st_you","st_pay"],
  class: ["st_cat","st_session","st_you","st_pay"],
  pt:    ["st_coach","st_size","st_when","st_you","st_pay"]
};
const S = { i:0, court:null, cat:null, cls:null, coach:null, size:null, day:0, time:null, filters:[] };

if (qs.get("court") && COURTS.some(c=>c.id===qs.get("court"))) S.court = qs.get("court");
if (qs.get("t")) S.time = qs.get("t");

const L  = () => lang();
const T  = k => (STR[L()] || STR.en)[k];
const pick = (o,k) => L()==='zh' ? o[k+'_zh'] : o[k+'_en'];
const nm = o => L()==='zh' ? o.zh : o.en;

const DIA = {"volleyball":`<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 106.15 94.01"><defs><style>.cls-1 {fill: currentColor;}</style></defs><g id="Layer_1-2" data-name="Layer 1"><g><path class="cls-1" d="M106.15,94.01H0l.05-.22L21.57,0h63.01l.03.14,21.54,93.87ZM.45,93.65h105.25L84.29.36H21.86L.45,93.65Z"/><rect class="cls-1" x="17.56" y="15.21" width="70.36" height=".36"/><rect class="cls-1" x="13.89" y="35.16" width="78.44" height=".36"/><rect class="cls-1" x="8.13" y="59.19" width="89.88" height=".36"/><g><rect class="cls-1" x="12.53" y="7.01" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="9.67" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="11.96" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="14.62" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="16.92" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="18.86" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="21.5" width="81.53" height=".18"/><rect class="cls-1" x="17.47" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="19.84" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="23.32" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="26.8" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="30.28" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="33.75" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="37.23" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="40.71" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="44.19" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="47.66" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="51.14" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="54.62" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="58.1" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="61.57" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="65.05" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="68.53" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="72.01" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="75.48" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="78.96" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="82.44" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="85.92" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="89.4" y="5.4" width=".18" height="16.19"/><path class="cls-1" d="M94.07,5.94H12.53c-.3,0-.54-.24-.54-.54s.24-.54.54-.54h81.53c.3,0,.54.24.54.54s-.24.54-.54.54Z"/><path class="cls-1" d="M12.53,39.64c-.59,0-1.07-.48-1.07-1.07V5.4c0-.59.48-1.07,1.07-1.07s1.07.48,1.07,1.07v33.16c0,.59-.48,1.07-1.07,1.07Z"/><path class="cls-1" d="M94.07,39.64c-.59,0-1.07-.48-1.07-1.07V5.4c0-.59.48-1.07,1.07-1.07s1.07.48,1.07,1.07v33.16c0,.59-.48,1.07-1.07,1.07Z"/></g></g></g></svg>`,"basketball":`<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180.92 77.25"><defs><style>.cls-1 {fill: currentColor;}</style></defs><g id="Layer_1-2" data-name="Layer 1"><g><path class="cls-1" d="M118.78,38.24h-.76c0-8.57-12.2-15.55-27.2-15.55s-27.2,6.97-27.2,15.55h-.76c0-8.99,12.54-16.3,27.96-16.3s27.96,7.31,27.96,16.3Z"/><path class="cls-1" d="M131.45,77.25H49.84l13.14-39.39h55.7l.08.26,12.69,39.12ZM50.89,76.49h79.52l-12.28-37.87h-54.61l-12.63,37.87Z"/><rect class="cls-1" x="121.7" y="48.02" width="7.36" height=".76"/><rect class="cls-1" x="124.39" y="56.32" width="7.3" height=".76"/><rect class="cls-1" x="127.66" y="65.61" width="7.47" height=".76"/><rect class="cls-1" x="52.6" y="48.02" width="7.36" height=".76"/><rect class="cls-1" x="49.96" y="56.32" width="7.3" height=".76"/><rect class="cls-1" x="46.52" y="65.61" width="7.47" height=".76"/><path class="cls-1" d="M180.92,77.25H0l.06-.43c.03-.19,2.94-19.43,15.53-38.4,7.4-11.15,16.64-20.04,27.48-26.41C56.61,4.04,72.67,0,90.82,0c17.15,0,32.55,4.04,45.79,12.01,10.59,6.37,19.81,15.26,27.42,26.41,12.95,18.97,16.77,38.2,16.8,38.39l.09.45ZM.88,76.49h179.12c-.66-3-4.84-20.44-16.61-37.68-7.55-11.05-16.69-19.86-27.19-26.17C123.1,4.76,107.83.76,90.82.76c-18.01,0-33.94,4-47.36,11.89-10.73,6.31-19.9,15.11-27.23,26.16C4.77,56.07,1.39,73.55.88,76.49Z"/><g><path class="cls-1" d="M118.34,41.15l-.72-.22c.27-.88.41-1.78.41-2.68h.76c0,.97-.15,1.95-.44,2.9Z"/><path class="cls-1" d="M90.82,54.55c-.97,0-1.95-.03-2.92-.09l.05-.75c1.91.12,3.87.11,5.76,0l.05.75c-.96.06-1.95.09-2.93.09ZM82.1,53.74c-1.97-.38-3.88-.88-5.66-1.51l.25-.71c1.75.61,3.62,1.11,5.55,1.48l-.14.74ZM99.56,53.74l-.14-.74c1.94-.37,3.81-.87,5.55-1.48l.25.71c-1.78.62-3.69,1.13-5.66,1.51ZM71.09,49.8c-1.84-1.07-3.41-2.28-4.67-3.59l.55-.52c1.21,1.26,2.73,2.43,4.51,3.46l-.38.65ZM110.57,49.8l-.38-.65c1.78-1.03,3.29-2.2,4.51-3.46l.55.52c-1.26,1.32-2.83,2.53-4.67,3.59Z"/><path class="cls-1" d="M63.31,41.15c-.29-.95-.44-1.93-.44-2.9h.76c0,.9.14,1.8.41,2.68l-.72.22Z"/></g></g></g></svg>`,"pickleball":`<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 106.15 94.01"><defs><style>.cls-1 {fill: currentColor;}</style></defs><g id="Layer_1-2" data-name="Layer 1"><g><g><path class="cls-1" d="M106.15,94.01H0l.05-.22L21.57,0h63.01l.03.14,21.54,93.87ZM.45,93.65h105.25L84.29.36H21.86L.45,93.65Z"/><polygon class="cls-1" points="80.53 15.57 26.2 15.57 17.65 15.21 89.16 15.21 80.53 15.57"/><polygon class="cls-1" points="97.92 59.54 7.91 59.54 17.56 59.19 89.16 59.19 97.92 59.54"/><rect class="cls-1" x="53.18" y="15.39" width=".36" height="43.98"/></g><rect class="cls-1" x="14.04" y="20.17" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="22.82" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="25.12" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="27.78" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="30.08" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="32.01" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="34.66" width="78.66" height=".18"/><rect class="cls-1" x="65.05" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="68.53" y="20.26" width=".18" height="14.49"/><g><rect class="cls-1" x="17.47" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="19.84" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="23.32" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="26.8" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="30.28" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="33.75" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="37.23" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="40.71" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="44.19" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="47.66" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="51.14" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="54.62" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="58.1" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="61.57" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="72.01" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="75.48" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="78.96" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="82.44" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="85.92" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="89.4" y="20.26" width=".18" height="14.49"/></g><path class="cls-1" d="M13.61,36.21c-.4,0-.72-.32-.72-.72v-16.22c0-.4.32-.72.72-.72s.72.32.72.72v16.22c0,.4-.32.72-.72.72Z"/><path class="cls-1" d="M93.05,36.21c-.4,0-.72-.32-.72-.72v-16.22c0-.4.32-.72.72-.72s.72.32.72.72v16.22c0,.4-.32.72-.72.72Z"/></g></g></svg>`,"badminton":`<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 106.15 94.01"><defs><style>.cls-1 {fill: currentColor;}</style></defs><g id="Layer_1-2" data-name="Layer 1"><g><g><path class="cls-1" d="M106.15,94.01H0l.05-.22L21.57,0h63.01l.03.14,21.54,93.87ZM.45,93.65h105.25L84.29.36H21.86L.45,93.65Z"/><rect class="cls-1" x="86.61" y="-.12" width=".36" height="94.83" transform="translate(-7.49 17.61) rotate(-11.11)"/><rect class="cls-1" x="-27.48" y="47.12" width="94.83" height=".36" transform="translate(-30.33 57.7) rotate(-78.84)"/><rect class="cls-1" x="26.2" y="15.21" width="54.33" height=".36"/><rect class="cls-1" x="17.56" y="59.19" width="71.6" height=".36"/><rect class="cls-1" x="53.18" y="15.39" width=".36" height="43.98"/></g><g><rect class="cls-1" x="12.42" y="12.41" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="15.07" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="17.37" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="20.02" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="22.32" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="24.26" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="26.9" width="81.53" height=".18"/><rect class="cls-1" x="17.36" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="19.72" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="23.2" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="26.68" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="30.16" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="33.64" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="37.11" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="40.59" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="44.07" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="47.55" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="51.02" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="54.5" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="57.98" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="61.46" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="64.93" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="68.41" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="71.89" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="75.37" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="78.84" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="82.32" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="85.8" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="89.28" y="10.8" width=".18" height="16.19"/><path class="cls-1" d="M93.95,11.34H12.42c-.3,0-.54-.24-.54-.54s.24-.54.54-.54h81.53c.3,0,.54.24.54.54s-.24.54-.54.54Z"/><path class="cls-1" d="M12.42,40.88c-.59,0-1.07-.48-1.07-1.07V10.8c0-.59.48-1.07,1.07-1.07s1.07.48,1.07,1.07v29c0,.59-.48,1.07-1.07,1.07Z"/><path class="cls-1" d="M93.95,40.88c-.59,0-1.07-.48-1.07-1.07V10.8c0-.59.48-1.07,1.07-1.07s1.07.48,1.07,1.07v29c0,.59-.48,1.07-1.07,1.07Z"/></g></g></g></svg>`};

function days(){
  const out=[], base=new Date();
  for(let i=0;i<10;i++){
    const d=new Date(base); d.setDate(base.getDate()+i);
    out.push({
      dw: d.toLocaleDateString(L()==='zh'?'zh-HK':'en-GB',{weekday:'short'}),
      dn: d.getDate(),
      full: d.toLocaleDateString(L()==='zh'?'zh-HK':'en-GB',
            {weekday:'long',day:'numeric',month:L()==='zh'?'long':'short'})
    });
  }
  return out;
}

/* ---------- rendering ---------- */
function renderRail(){
  const flow = FLOWS[MODE], keys = RAIL[MODE];
  document.getElementById('rail').innerHTML = keys.map((k,n)=>{
    const cls = n===S.i ? 'on' : (n<S.i ? 'done' : '');
    return `<li class="${cls}"><span class="n">${n<S.i?'✓':n+1}</span><span class="t">${T(k)}</span></li>`;
  }).join('');
}

function renderCourts(){
  document.getElementById('courtList').innerHTML = COURTS.map(c=>`
    <button class="opt ${S.court===c.id?'sel':''}" data-court="${c.id}">
      <span class="dia">${DIA[c.dia]}</span>
      <span class="txt"><span class="t">${nm(c)}</span>
        <span class="d">${T('hall')} ${pick(c,'h').replace(/^Hall |館$/g,'')} · ${money(PRICES.court)} / ${L()==='zh'?'小時':'hour'}</span></span>
    </button>`).join('');
  bind('courtList','court',v=>{S.court=v;});
}
function renderCats(){
  document.getElementById('catList').innerHTML = CATS.map(c=>`
    <button class="opt ${S.cat===c.id?'sel':''}" data-cat="${c.id}">
      <span class="txt"><span class="t">${nm(c)}</span><span class="d">${pick(c,'d')}</span></span>
    </button>`).join('');
  bind('catList','cat',v=>{S.cat=v; S.filters=[v];});
}
function renderCoaches(){
  document.getElementById('coachList').innerHTML = COACHES.map(c=>`
    <button class="opt ${S.coach===c.id?'sel':''}" data-coach="${c.id}">
      <span class="av" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.6"/><path d="M5 19c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></span>
      <span class="txt"><span class="t">${c.n}</span><span class="d">${nm(c)}</span>
        <span class="d">${pick(c,'x')}</span>
        <span class="tags">${(L()==='zh'?c.tags_zh:c.tags_en).map(t=>`<span class="tag">${t}</span>`).join('')}</span></span>
    </button>`).join('');
  bind('coachList','coach',v=>{S.coach=v;});
}
function renderSizes(){
  document.getElementById('sizeList').innerHTML = SIZES.map(s=>`
    <button class="opt ${S.size===s.id?'sel':''}" data-size="${s.id}">
      <span class="txt"><span class="t">${nm(s)}</span><span class="d">${pick(s,'d')}</span>
      <span class="d">${money(PRICES.pt)} / ${L()==='zh'?'每位':'person'}</span></span>
    </button>`).join('');
  bind('sizeList','size',v=>{S.size=v;});
}
function renderClasses(){
  const chips = document.getElementById('classChips');
  chips.innerHTML = CATS.map(c=>
    `<button class="chip ${S.filters.includes(c.id)?'on':''}" data-f="${c.id}">${nm(c)}</button>`).join('');
  chips.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{
    const v=b.dataset.f;
    S.filters = S.filters.includes(v) ? S.filters.filter(x=>x!==v) : S.filters.concat(v);
    renderClasses(); sync();
  });
  const D = days();
  document.getElementById('dates3').innerHTML = D.map((d,i)=>
    `<button class="date ${S.day===i?'on':''}" data-d="${i}"><span class="dw">${d.dw}</span><span class="dn">${d.dn}</span></button>`).join('');
  document.getElementById('dates3').querySelectorAll('.date').forEach(b=>
    b.onclick=()=>{S.day=+b.dataset.d; S.cls=null; renderClasses(); sync();});
  document.getElementById('s3sub').textContent = D[S.day].full;

  const list = CLASSES.filter(c=>!S.filters.length || S.filters.includes(c.cat));
  document.getElementById('classList').innerHTML = list.length ? list.map((c,i)=>`
    <button class="opt ${S.cls===c.id?'sel':''}" data-cls="${c.id}">
      <span class="txt"><span class="t">${nm(c)}</span>
        <span class="d">${["09:00","12:30","18:00","19:30","20:30"][i%5]} · ${c.dur} ${T('mins')} · ${c.coach}</span>
        <span class="d">${pick(c,'d')}</span>
        <span class="tags"><span class="tag">${c.spots} ${T('spots')}</span></span></span>
      <span class="p">${money(PRICES.class)}</span>
    </button>`).join('') : `<p class="meta">${L()==='zh'?'呢個篩選冇課堂。':'No classes match this filter.'}</p>`;
  bind('classList','cls',v=>{S.cls=v;});
}
function renderSlots(){
  const D = days();
  document.getElementById('dates2').innerHTML = D.map((d,i)=>
    `<button class="date ${S.day===i?'on':''}" data-d="${i}"><span class="dw">${d.dw}</span><span class="dn">${d.dn}</span></button>`).join('');
  document.getElementById('dates2').querySelectorAll('.date').forEach(b=>
    b.onclick=()=>{S.day=+b.dataset.d; S.time=null; renderSlots(); sync();});
  const who = MODE==='pt'
    ? (COACHES.find(c=>c.id===S.coach)||{n:''}).n
    : nm(COURTS.find(c=>c.id===S.court)||{en:'',zh:''});
  document.getElementById('s2sub').textContent = who + ' · ' + D[S.day].full;
  document.getElementById('slots').innerHTML = TIMES.map((t,i)=>{
    const gone = taken(S.day,i);
    return `<button class="tslot ${S.time===t?'on':''}" data-t="${t}" ${gone?'disabled':''}>${t}</button>`;
  }).join('');
  document.getElementById('slots').querySelectorAll('.tslot').forEach(b=>
    b.onclick=()=>{S.time=b.dataset.t; renderSlots(); sync();});
}
function bind(id, key, fn){
  document.getElementById(id).querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
    fn(b.dataset[key]); render(); sync();
  });
}

/* ---------- summary ---------- */
function lines(){
  const out=[], D=days();
  if(MODE==='venue'){
    const c=COURTS.find(x=>x.id===S.court);
    out.push([T('l_court'), c?nm(c):null]);
    out.push([T('l_when'), S.time ? `${D[S.day].full}, ${S.time}` : null]);
  }
  if(MODE==='class'){
    const cat=CATS.find(x=>x.id===S.cat), cl=CLASSES.find(x=>x.id===S.cls);
    out.push([T('st_cat'), cat?nm(cat):null]);
    out.push([T('l_class'), cl?nm(cl):null]);
    if(cl) out.push([T('l_dur'), `${cl.dur} ${T('mins')}`]);
    out.push([T('l_when'), S.cls ? D[S.day].full : null]);
  }
  if(MODE==='pt'){
    const co=COACHES.find(x=>x.id===S.coach), sz=SIZES.find(x=>x.id===S.size);
    out.push([T('l_coach'), co?co.n:null]);
    out.push([T('l_size'), sz?nm(sz):null]);
    out.push([T('l_when'), S.time ? `${D[S.day].full}, ${S.time}` : null]);
  }
  return out;
}
function lineHTML(){
  return lines().map(([k,v])=>
    `<div class="li ${v?'':'empty'}"><span class="k">${k}</span><span class="v">${v||T('l_none')}</span></div>`
  ).join('');
}
function renderSummary(){
  const html = lineHTML();
  document.getElementById('sumLines').innerHTML = html;
  const s7 = document.getElementById('s7lines');
  if(s7) s7.innerHTML = `<div class="summary" style="max-width:460px">${html}
    <div class="total"><span>${T('sum_total')}</span><span class="price-tbc" data-price="tbc">HK$ TBC</span></div>
    <p class="policy">${T('policy')}</p></div>`;
}

/* ---------- flow control ---------- */
function canAdvance(){
  const id = FLOWS[MODE][S.i];
  if(id==='s1')  return !!S.court;
  if(id==='s1c') return !!S.cat;
  if(id==='s5')  return !!S.coach;
  if(id==='s5b') return !!S.size;
  if(id==='s3')  return !!S.cls;
  if(id==='s2')  return !!S.time;
  if(id==='s6')  return ['fFirst','fLast','fEmail','fPhone'].every(i=>document.getElementById(i).value.trim())
                     && document.getElementById('cWaiver').checked;
  return true;
}
function render(){
  const flow = FLOWS[MODE], id = flow[S.i];
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on', s.id===id));
  renderRail();
  if(id==='s1')  renderCourts();
  if(id==='s1c') renderCats();
  if(id==='s5')  renderCoaches();
  if(id==='s5b') renderSizes();
  if(id==='s3')  renderClasses();
  if(id==='s2')  renderSlots();
  if(id==='s8')  renderRecap();
  renderSummary();

  const last = id==='s8';
  const isPay = id==='s7';
  document.getElementById('summary').hidden = last;
  document.getElementById('bar').style.display = last ? 'none' : '';
  document.body.classList.toggle('has-bar', !last);
  document.body.classList.toggle('in-checkout', isPay || id==='s6');
  const label = isPay ? T('pay') : T('next');
  document.getElementById('sumNext').textContent = label;
  document.getElementById('barNext').textContent = label;
  sync();
  window.scrollTo({top:0, behavior:'instant'});
}
function sync(){
  const ok = canAdvance();
  document.getElementById('sumNext').disabled = !ok;
  document.getElementById('barNext').disabled = !ok;
  renderSummary();
}
function next(){
  if(!canAdvance()){
    if(FLOWS[MODE][S.i]==='s6') document.getElementById('fWarn').classList.add('on');
    return;
  }
  document.getElementById('fWarn').classList.remove('on');
  if(S.i < FLOWS[MODE].length-1){ S.i++; render(); }
}
function prev(){
  if(S.i>0){ S.i--; render(); } else { location.href='index.html'; }
}
function renderRecap(){
  const art = DIA[MODE==='venue'
    ? (COURTS.find(c=>c.id===S.court)||{dia:'volleyball'}).dia
    : 'basketball'];
  document.getElementById('recap').innerHTML =
    `<div class="watermark">${art}</div>${lineHTML()}
     <div class="li"><span class="k">${T('ref')}</span><span class="v">SHHK-2026-0001</span></div>`;
}

/* ---------- boot ---------- */
function pageExtras(){
  render();
  waLink('waFloat', T('wa_prefill'));
}
/* Guarded, not byte-identical to v1: booking.js is also loaded on
   index.html per BRIEF.md ("put [PRICES] in booking.js, load it on the
   landing too"), purely for the PRICES object and money(). index.html has
   no #back / #sumNext / #barNext / form fields, and supplies its own
   pageExtras() and its own boot() call in its inline script. Without this
   guard the unconditional getElementById('back').onclick below would throw
   on index.html before its own script ever runs. On booking.html #back
   exists, so the guard is true and every line below behaves exactly as v1
   did unconditionally. */
if (document.getElementById('back')) {
  document.getElementById('back').onclick = prev;
  document.getElementById('sumNext').onclick = next;
  document.getElementById('barNext').onclick = next;
  ['fFirst','fLast','fEmail','fPhone','cWaiver'].forEach(i=>{
    const el=document.getElementById(i); if(el) el.addEventListener('input', sync);
  });
  boot(pageExtras);
}
