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
   books on the Bliss backend. Four steps are backend change requests and are
   marked in the UI:
     s1c  category pre-select ahead of the standard flow
     s5   coach picked before the date
     s1   quantity per court (round 2, client 2026-09-19)
     s8   add to calendar on the Bliss-rendered confirmation (round 2)
   Round 2 (client review 2026-09-19) added items 8 to 12: the Workshop
   category, a coach line on class session cards, a coach specialty filter on
   s5, add-to-calendar links on s8, and the court quantity stepper on s1.
   Each one is marked "round 2" inline below; nothing else moved.
   Round 5 (2026-10-03) adds RATES, the client's real court hire rate card,
   read by the landing page only, and Suki's three court marks to DIA.
   Front end only. No network calls. Every price inside the booking flow is
   still a placeholder. */

/* ---------- prices: one object, one edit when Suki's rate card lands ---------- */
const PRICES = { court:null, class:null, pt:null };   /* null renders as HK$ TBC */
function money(v){
  return v == null
    ? '<span class="price-tbc" data-price="tbc">HK$ TBC</span>'
    : 'HK$ ' + Number(v).toLocaleString('en-US');   /* 1,180, not 1180 */
}

/* ---------- round 5: court hire rate card, HK$ per court per hour ----------
   Source: the client's rate card, transcribed from the shared sheet
   2026-10-01 and cross-checked figure for figure against the official
   workbook 2026-10-03 (raw/assets/hksh-round5/). Volleyball and floorball
   price two courts differently, so they carry one row per court.
   Peak is 16:00 to 23:00 Monday to Friday, 07:00 to 23:00 on Saturdays,
   Sundays and public holidays; every other hour is off-peak.
   The commercial tier on the same sheet (HKEVA, HK Star, event) is marked
   "can't be booked online" and is deliberately not published here.
   The landing page's price table renders from RATES. The booking flow still
   reads PRICES above: pricing a slot needs the peak rule and a public
   holiday calendar, which is round 5's booking-phase work, not this pass. */
const RATES = {
  vb: [{ court:'A', peak:590, off:490 }, { court:'B', peak:490, off:390 }],
  bb: [{ peak:590, off:490 }],
  pb: [{ peak:390, off:290 }],
  fb: [{ court:'A', peak:590, off:490 }, { court:'B', peak:490, off:390 }],
  tq: [{ peak:390, off:290 }],
  db: [{ peak:590, off:490 }],
  bd: [{ peak:390, off:290 }],
};
const RATE_ORDER = ['vb','bb','pb','fb','tq','db','bd'];   /* the rate card's own order */
const MEMBERSHIP_FEE = 350;   /* one-off, sport class members: account plus training kit (2026-09-25 call) */
/* "from" prices for the landing page tiles: the lowest off-peak court rate,
   and TBC where the client's sheet is not readable yet (classes, PT). */
const FROM_PRICES = {
  court: Math.min(...RATE_ORDER.flatMap(id => RATES[id].map(r => r.off))),
  class: PRICES.class,
  pt: PRICES.pt,
};

/* ---------- round 5 (2026-10-04): the booking flow prices courts too ----------
   Alfred: the booking flow should carry the rate card, not HK$ TBC.
   Peak is 16:00 to 23:00 Monday to Friday, and 07:00 to 23:00 on Saturdays,
   Sundays and public holidays; every other hour is off-peak. A slot is
   priced by the hour it starts in. Public holidays are Hong Kong's general
   holidays, copied from the Government's own list
   (https://www.1823.gov.hk/common/ical/en.json, read 2026-10-04); extend the
   set when the 2028 list is gazetted.
   Volleyball and floorball price Court A (larger) and Court B (smaller)
   differently, so the customer picks the court (2026-09-25 call, Alfred
   2026-10-04); every other sport is assigned whichever court is free.
   Classes and personal training stay HK$ TBC until the class sheet's units
   are confirmed. */
const HK_HOLIDAYS = new Set([
  '2026-01-01','2026-02-17','2026-02-18','2026-02-19','2026-04-03','2026-04-04',
  '2026-04-06','2026-04-07','2026-05-01','2026-05-25','2026-06-19','2026-07-01',
  '2026-09-26','2026-10-01','2026-10-19','2026-12-25','2026-12-26',
  '2027-01-01','2027-02-06','2027-02-08','2027-02-09','2027-03-26','2027-03-27',
  '2027-03-29','2027-04-05','2027-05-01','2027-05-13','2027-06-09','2027-07-01',
  '2027-09-16','2027-10-01','2027-10-08','2027-12-25','2027-12-27',
]);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function isPeak(date, t){
  const h = parseInt(t, 10);
  const allDay = date.getDay() === 0 || date.getDay() === 6 || HK_HOLIDAYS.has(ymd(date));
  return allDay ? (h >= 7 && h < 23) : (h >= 16 && h < 23);
}
const twoCourts = id => !!(RATES[id] && RATES[id].length > 1);
/* the rate row for the chosen court, or null while a two-court sport has no court picked */
function rateRow(){
  const rows = RATES[S.court];
  if(!rows) return null;
  return rows.length === 1 ? rows[0] : (rows.find(r => r.court === S.csize) || null);
}
function slotPrice(dayIdx, t){
  const r = rateRow();
  return r ? (isPeak(dayDate(dayIdx), t) ? r.peak : r.off) : null;
}
/* the lowest rate the current choice can cost per hour, for "from" lines */
function fromRate(id){
  const rows = RATES[id] || [];
  const pool = (id === S.court && S.csize) ? rows.filter(r => r.court === S.csize) : rows;
  return pool.length ? Math.min(...pool.map(r => r.off)) : null;
}
/* venue total: exact once every hour has its slot, else "from" the lowest
   rate times the hours; null (HK$ TBC) for classes and personal training */
function courtTotal(){
  if(MODE !== 'venue' || !S.court) return null;
  if(S.times.length && rateRow())
    return { exact:true, v:S.times.reduce((a, t) => a + slotPrice(S.day, t), 0) };
  const f = fromRate(S.court);
  return f == null ? null : { exact:false, v:f };
}
const G = k => ((window.STRINGS || {})[L()] || {})[k] || '';   /* landing-page string keys */

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
/* round 4 N1/N9: bare sport names for the filter chips, keyed by court id
   plus "sc" for strength and conditioning */
const SPORTS = window.BOOKING_DATA.SPORTS || {};
const sportName = id => {
  const s = SPORTS[id];
  if(s) return L()==='zh' ? s.zh : s.en;
  const court = COURTS.find(c=>c.id===id);
  return court ? nm(court) : id;
};

/* ---------- round 4 item N1: the Workshop category now comes from the build ----------
   Round 2 appended the fourth category and its two sessions here at runtime,
   from bk. strings, because build_strings.py owned the cat./class. key
   families and was out of scope for that pass. Round 4 folds them into
   CATS_TEMPLATE / CLASSES_TEMPLATE, so there is one place that defines a
   category rather than two. The keys were renamed, not re-translated: the
   approved copy moved from bk.cat_ws to cat.ws.name and so on.
   Coach roles still come from COACHES, never invented: the client still owes
   the real names. */
const roleOf = id => (COACHES.find(c => c.id === id) || {n:''}).n;

/* Round 2 item 9: one neutral avatar glyph. Was inline in renderCoaches;
   lifted to a const so the coach line on the class session cards uses the
   same mark.
   (Round 2's COACH_TAGS specialty map was retired in round 4: the personal
   training filter is by sport now, read straight off each coach's `sport`
   field, so there is nothing to derive from the tag labels.) */
const AVATAR = `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.6"/><path d="M5 19c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`;
const coachVal  = role => `${role}, ${T('coach_tbc')}`;
const coachLine = role => `${T('l_coach')}: ${coachVal(role)}`;

/* ---------- hours: round 3 to 5 used a stepper; round 6 lets the time grid
   set the length (one hour, or two back to back), see pickSlot() ---------- */
const MAX_HOURS = 2;   /* max 2 hours a day per HKID, back to back (client 2026-09-19; Siu 2026-10-04) */

/* Round 4: three of the seven bookable sports had no court diagram, so they
   got a neutral outline rather than an invented approximation. Round 5
   (client, 2026-09-25): Suki drew the three herself (floorball, Teqvoly,
   dodgeball) and they now sit in DIA beside the agency's four, same role:
   the sport mark on the cards customers choose from (Alfred, 2026-10-03).
   DIA_TBC stays as the fallback for any future court with no art yet. */
const DIA_TBC = `<svg viewBox="0 0 106.15 94.01" aria-hidden="true" focusable="false"><rect x="8" y="8" width="90.15" height="78.01" rx="3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.55"/><line x1="53.07" y1="8" x2="53.07" y2="86.01" stroke="currentColor" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.55"/></svg>`;
const diaFor = c => (c && c.dia && DIA[c.dia]) ? DIA[c.dia] : DIA_TBC;

/* ---------- round 2 item 11: fixed details the calendar event quotes ---------- */
const VENUE = 'Sporting Hub Hong Kong';   /* brand name, identical in both locales per strings.en.json's glossary */
const REF = 'SHHK-2026-0001';             /* was inline in renderRecap */

const TIMES = ["07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00",
               "16:00","17:00","18:00","19:00","20:00","21:00","22:00"];
/* class session start times, one per card position. Lifted out of
   renderClasses (round 2 item 11) so the calendar link can read back the time
   the chosen card actually showed. */
const CLASS_TIMES = ["09:00","12:30","18:00","19:30","20:30"];
const CLS_TIME = {};
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
/* hours (round 3, hours per booking), times (round 3, one slot per hour),
   ctag (round 2, the coach specialty filter), sport (round 4 N1, the sport
   filter on the session list) and dow (round 4 N2, the weekday picker for
   term courses) are the additions to v1's state object. */
const S = { i:0, court:null, cat:null, cls:null, coach:null, size:null, day:0,
            times:[], filters:[], ctag:'', sport:'', dow:null, csize:null };

if (qs.get("court") && COURTS.some(c=>c.id===qs.get("court"))) S.court = qs.get("court");
/* round 3: ?t= preselects a slot. TIMES is defined above, so an unknown value
   is ignored rather than becoming a selection the grid cannot show. */
if (qs.get("t") && TIMES.includes(qs.get("t"))) S.times = [qs.get("t")];

const L  = () => lang();
const T  = k => (STR[L()] || STR.en)[k];
const pick = (o,k) => L()==='zh' ? o[k+'_zh'] : o[k+'_en'];
const nm = o => L()==='zh' ? o.zh : o.en;

const DIA = {"volleyball":`<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 106.15 94.01"><defs><style>.cls-1 {fill: currentColor;}</style></defs><g id="Layer_1-2" data-name="Layer 1"><g><path class="cls-1" d="M106.15,94.01H0l.05-.22L21.57,0h63.01l.03.14,21.54,93.87ZM.45,93.65h105.25L84.29.36H21.86L.45,93.65Z"/><rect class="cls-1" x="17.56" y="15.21" width="70.36" height=".36"/><rect class="cls-1" x="13.89" y="35.16" width="78.44" height=".36"/><rect class="cls-1" x="8.13" y="59.19" width="89.88" height=".36"/><g><rect class="cls-1" x="12.53" y="7.01" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="9.67" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="11.96" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="14.62" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="16.92" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="18.86" width="81.53" height=".18"/><rect class="cls-1" x="12.53" y="21.5" width="81.53" height=".18"/><rect class="cls-1" x="17.47" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="19.84" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="23.32" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="26.8" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="30.28" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="33.75" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="37.23" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="40.71" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="44.19" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="47.66" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="51.14" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="54.62" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="58.1" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="61.57" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="65.05" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="68.53" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="72.01" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="75.48" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="78.96" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="82.44" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="85.92" y="5.4" width=".18" height="16.19"/><rect class="cls-1" x="89.4" y="5.4" width=".18" height="16.19"/><path class="cls-1" d="M94.07,5.94H12.53c-.3,0-.54-.24-.54-.54s.24-.54.54-.54h81.53c.3,0,.54.24.54.54s-.24.54-.54.54Z"/><path class="cls-1" d="M12.53,39.64c-.59,0-1.07-.48-1.07-1.07V5.4c0-.59.48-1.07,1.07-1.07s1.07.48,1.07,1.07v33.16c0,.59-.48,1.07-1.07,1.07Z"/><path class="cls-1" d="M94.07,39.64c-.59,0-1.07-.48-1.07-1.07V5.4c0-.59.48-1.07,1.07-1.07s1.07.48,1.07,1.07v33.16c0,.59-.48,1.07-1.07,1.07Z"/></g></g></g></svg>`,"basketball":`<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180.92 77.25"><defs><style>.cls-1 {fill: currentColor;}</style></defs><g id="Layer_1-2" data-name="Layer 1"><g><path class="cls-1" d="M118.78,38.24h-.76c0-8.57-12.2-15.55-27.2-15.55s-27.2,6.97-27.2,15.55h-.76c0-8.99,12.54-16.3,27.96-16.3s27.96,7.31,27.96,16.3Z"/><path class="cls-1" d="M131.45,77.25H49.84l13.14-39.39h55.7l.08.26,12.69,39.12ZM50.89,76.49h79.52l-12.28-37.87h-54.61l-12.63,37.87Z"/><rect class="cls-1" x="121.7" y="48.02" width="7.36" height=".76"/><rect class="cls-1" x="124.39" y="56.32" width="7.3" height=".76"/><rect class="cls-1" x="127.66" y="65.61" width="7.47" height=".76"/><rect class="cls-1" x="52.6" y="48.02" width="7.36" height=".76"/><rect class="cls-1" x="49.96" y="56.32" width="7.3" height=".76"/><rect class="cls-1" x="46.52" y="65.61" width="7.47" height=".76"/><path class="cls-1" d="M180.92,77.25H0l.06-.43c.03-.19,2.94-19.43,15.53-38.4,7.4-11.15,16.64-20.04,27.48-26.41C56.61,4.04,72.67,0,90.82,0c17.15,0,32.55,4.04,45.79,12.01,10.59,6.37,19.81,15.26,27.42,26.41,12.95,18.97,16.77,38.2,16.8,38.39l.09.45ZM.88,76.49h179.12c-.66-3-4.84-20.44-16.61-37.68-7.55-11.05-16.69-19.86-27.19-26.17C123.1,4.76,107.83.76,90.82.76c-18.01,0-33.94,4-47.36,11.89-10.73,6.31-19.9,15.11-27.23,26.16C4.77,56.07,1.39,73.55.88,76.49Z"/><g><path class="cls-1" d="M118.34,41.15l-.72-.22c.27-.88.41-1.78.41-2.68h.76c0,.97-.15,1.95-.44,2.9Z"/><path class="cls-1" d="M90.82,54.55c-.97,0-1.95-.03-2.92-.09l.05-.75c1.91.12,3.87.11,5.76,0l.05.75c-.96.06-1.95.09-2.93.09ZM82.1,53.74c-1.97-.38-3.88-.88-5.66-1.51l.25-.71c1.75.61,3.62,1.11,5.55,1.48l-.14.74ZM99.56,53.74l-.14-.74c1.94-.37,3.81-.87,5.55-1.48l.25.71c-1.78.62-3.69,1.13-5.66,1.51ZM71.09,49.8c-1.84-1.07-3.41-2.28-4.67-3.59l.55-.52c1.21,1.26,2.73,2.43,4.51,3.46l-.38.65ZM110.57,49.8l-.38-.65c1.78-1.03,3.29-2.2,4.51-3.46l.55.52c-1.26,1.32-2.83,2.53-4.67,3.59Z"/><path class="cls-1" d="M63.31,41.15c-.29-.95-.44-1.93-.44-2.9h.76c0,.9.14,1.8.41,2.68l-.72.22Z"/></g></g></g></svg>`,"pickleball":`<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 106.15 94.01"><defs><style>.cls-1 {fill: currentColor;}</style></defs><g id="Layer_1-2" data-name="Layer 1"><g><g><path class="cls-1" d="M106.15,94.01H0l.05-.22L21.57,0h63.01l.03.14,21.54,93.87ZM.45,93.65h105.25L84.29.36H21.86L.45,93.65Z"/><polygon class="cls-1" points="80.53 15.57 26.2 15.57 17.65 15.21 89.16 15.21 80.53 15.57"/><polygon class="cls-1" points="97.92 59.54 7.91 59.54 17.56 59.19 89.16 59.19 97.92 59.54"/><rect class="cls-1" x="53.18" y="15.39" width=".36" height="43.98"/></g><rect class="cls-1" x="14.04" y="20.17" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="22.82" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="25.12" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="27.78" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="30.08" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="32.01" width="78.66" height=".18"/><rect class="cls-1" x="14.04" y="34.66" width="78.66" height=".18"/><rect class="cls-1" x="65.05" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="68.53" y="20.26" width=".18" height="14.49"/><g><rect class="cls-1" x="17.47" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="19.84" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="23.32" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="26.8" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="30.28" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="33.75" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="37.23" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="40.71" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="44.19" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="47.66" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="51.14" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="54.62" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="58.1" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="61.57" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="72.01" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="75.48" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="78.96" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="82.44" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="85.92" y="20.26" width=".18" height="14.49"/><rect class="cls-1" x="89.4" y="20.26" width=".18" height="14.49"/></g><path class="cls-1" d="M13.61,36.21c-.4,0-.72-.32-.72-.72v-16.22c0-.4.32-.72.72-.72s.72.32.72.72v16.22c0,.4-.32.72-.72.72Z"/><path class="cls-1" d="M93.05,36.21c-.4,0-.72-.32-.72-.72v-16.22c0-.4.32-.72.72-.72s.72.32.72.72v16.22c0,.4-.32.72-.72.72Z"/></g></g></svg>`,"badminton":`<svg aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 106.15 94.01"><defs><style>.cls-1 {fill: currentColor;}</style></defs><g id="Layer_1-2" data-name="Layer 1"><g><g><path class="cls-1" d="M106.15,94.01H0l.05-.22L21.57,0h63.01l.03.14,21.54,93.87ZM.45,93.65h105.25L84.29.36H21.86L.45,93.65Z"/><rect class="cls-1" x="86.61" y="-.12" width=".36" height="94.83" transform="translate(-7.49 17.61) rotate(-11.11)"/><rect class="cls-1" x="-27.48" y="47.12" width="94.83" height=".36" transform="translate(-30.33 57.7) rotate(-78.84)"/><rect class="cls-1" x="26.2" y="15.21" width="54.33" height=".36"/><rect class="cls-1" x="17.56" y="59.19" width="71.6" height=".36"/><rect class="cls-1" x="53.18" y="15.39" width=".36" height="43.98"/></g><g><rect class="cls-1" x="12.42" y="12.41" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="15.07" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="17.37" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="20.02" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="22.32" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="24.26" width="81.53" height=".18"/><rect class="cls-1" x="12.42" y="26.9" width="81.53" height=".18"/><rect class="cls-1" x="17.36" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="19.72" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="23.2" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="26.68" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="30.16" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="33.64" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="37.11" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="40.59" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="44.07" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="47.55" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="51.02" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="54.5" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="57.98" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="61.46" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="64.93" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="68.41" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="71.89" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="75.37" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="78.84" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="82.32" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="85.8" y="10.8" width=".18" height="16.19"/><rect class="cls-1" x="89.28" y="10.8" width=".18" height="16.19"/><path class="cls-1" d="M93.95,11.34H12.42c-.3,0-.54-.24-.54-.54s.24-.54.54-.54h81.53c.3,0,.54.24.54.54s-.24.54-.54.54Z"/><path class="cls-1" d="M12.42,40.88c-.59,0-1.07-.48-1.07-1.07V10.8c0-.59.48-1.07,1.07-1.07s1.07.48,1.07,1.07v29c0,.59-.48,1.07-1.07,1.07Z"/><path class="cls-1" d="M93.95,40.88c-.59,0-1.07-.48-1.07-1.07V10.8c0-.59.48-1.07,1.07-1.07s1.07.48,1.07,1.07v29c0,.59-.48,1.07-1.07,1.07Z"/></g></g></g></svg>`,"floorball":`<svg aria-hidden="true" focusable="false" data-name="Layer 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 68.26 65.52"><defs><style> .cls-1 { fill: currentColor; } </style></defs><g data-name="Layer 1"><g><g><g><path class="cls-1" d="M13.37,63.98c-1.68-1.04-2.81-2.73-3.16-4.65-.19-1.02-.07-1.97.22-2.95.34-1.16.92-2.2,1.94-2.91,1.14-.79,2.59-1.09,3.96-.74,1.79.45,3.56.65,5.42.39,4.82-.66,8.99-3.48,12.17-7.04,1.16-1.42,2.71-2.39,4.57-2.49L48.87.27c.05-.21.27-.3.43-.26l2.11.51c.13.13.18.29.13.49l-10.43,43.51c1.3.99,1.54,2.57,1.27,4.1-.25,1.16-.71,2.25-1.45,3.2-3.14,4.02-7.25,7.73-11.75,10.18-4.12,2.25-8.66,3.45-13.35,2.82-.89-.12-1.68-.36-2.47-.85ZM39.81,45.83c-.43-.36-.94-.55-1.51-.54-.72.02-1.4.25-2.02.65.37,1.4.66,2.77.89,4.22,1.01.13,1.99.18,3.01.18.79-1.31,1.23-3.64-.38-4.5ZM35.5,49.85l-.51-2.71-1.9,1.98c.81.3,1.57.54,2.41.73ZM36,55.08l-.25-3.39c-1.38-.27-2.65-.68-3.92-1.25.08,1.62.08,3.16.02,4.72.96.45,1.89.79,2.87,1.08l1.29-1.15ZM30.28,54.31l.05-2.92-2.2,1.39c.69.57,1.38,1.07,2.15,1.53ZM38.85,52.08l-1.42-.11.16,1.51,1.26-1.4ZM29.73,59.8l.41-3.49c-1.31-.74-2.45-1.6-3.53-2.61-.28,1.69-.63,3.28-1.04,4.91.8.78,1.64,1.45,2.53,2.07l1.63-.88ZM24.25,57.18l.71-2.98c-.85.28-1.59.48-2.43.65.54.82,1.08,1.6,1.72,2.33ZM14.65,62.52l2.04-2.92c-.76-1.61-1.33-3.25-1.78-4.99-.95.13-1.8.62-2.34,1.4-.28.43-.43.9-.53,1.41-.21.67-.24,1.33-.06,2.02.38,1.37,1.36,2.52,2.67,3.08ZM19.17,55.11c-.92-.05-1.71-.16-2.57-.35.33,1.05.69,2.05,1.15,3.07l1.42-2.73ZM22.45,62.67l1.21-3.46c-1.08-1.21-1.98-2.5-2.79-3.93-.66,1.56-1.35,3.01-2.15,4.49.62,1.12,1.32,2.19,2.1,3.18l1.64-.28ZM32.97,57.63l-1.25-.51-.14,1.51,1.39-1ZM26.11,61.56l-1.1-.96-.48,1.52,1.58-.56ZM18.63,63.07l-.94-1.52-.9,1.43c.62.06,1.22.09,1.84.09Z"/><path class="cls-1" d="M49.71,50.63c4.03-.47,7.63,2.44,8.08,6.4s-2.41,7.61-6.42,8.06-7.56-2.39-8.04-6.36c-.48-3.96,2.35-7.63,6.38-8.1ZM50.45,51.38c-.98.06-1.66.9-1.59,1.82s.87,1.63,1.81,1.56,1.64-.86,1.58-1.8-.82-1.65-1.8-1.58ZM44.28,58.69c.46.76,1.36,1.07,2.17.72s1.2-1.19.95-2.04c-.23-.77-1.01-1.31-1.85-1.19s-1.47.82-1.47,1.69c0,.3.05.56.21.83ZM55.25,56.17c-.98.06-1.65.9-1.59,1.82s.87,1.62,1.81,1.56,1.64-.86,1.58-1.8-.82-1.64-1.8-1.58ZM50.16,61.01c-.96.23-1.48,1.19-1.24,2.08s1.14,1.43,2.03,1.22,1.48-1.13,1.27-2.04-1.1-1.48-2.05-1.26Z"/></g></g><rect class="cls-1" x="0" y="64.77" width="68.26" height=".75"/></g></g></svg>`,"teqvoly":`<svg aria-hidden="true" focusable="false" data-name="Layer 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 117.42 44.49"><defs><style> .cls-1 { fill: currentColor; } </style></defs><g data-name="Layer 1"><g><path class="cls-1" d="M2.68,19.21S27.23,4.98,58.11,6.43c0,0,42.53,2.33,59.13,6.34,0,0-24.38-9.08-65.21,11.78-3.68,2.09-5.03,4.22-9.09,4.03S.17,21.81.17,21.81c0,0-.77-.74,2.52-2.6Z"/><path class="cls-1" d="M90.29,15.54c-.11,0-.23-.01-.35-.03-2.1-.39-6.53-.78-6.57-.78v-.15c.06,0,4.49.39,6.6.78.46.08.86,0,1.19-.26.93-.73,1.04-2.56,1.05-2.57,0,0-.19-1.96,0-5.06.19-3.02-2.72-3.59-2.84-3.61-.45-.04-45.49-3.63-48.17-3.69-.63,0-1.14.18-1.53.59-.99,1.02-.88,3.04-.88,3.06v3.65h-.15v-3.64c0-.08-.11-2.1.93-3.17.42-.44.97-.65,1.64-.64,2.68.06,47.73,3.65,48.19,3.69.04,0,3.17.61,2.97,3.77-.19,3.09,0,5.03,0,5.05,0,.09-.12,1.93-1.1,2.7-.28.22-.6.33-.95.33Z"/><path class="cls-1" d="M42.23,30.57c-2.02,0-3.53-.28-3.56-.29-.36-.06-36.2-6.03-37.46-6.19C-.2,23.92,0,21.88.02,21.79l.31.03s-.18,1.83.92,1.97c1.26.16,36,5.94,37.47,6.19.06.01,6.06,1.12,10.11-1.14.25-.14.6-.34,1.04-.6,3.32-1.92,12.13-7.02,23.13-10.94,13.83-4.93,26.19-6.31,36.74-4.11.05.01,4.56,1.09,5.83,1.31.54.09.94.02,1.19-.22.29-.27.39-.78.31-1.49l.31-.04c.09.82-.04,1.41-.4,1.75-.32.31-.81.41-1.45.3-1.29-.21-5.8-1.3-5.85-1.31-11.3-2.35-30.84-1.66-59.65,15.02-.44.26-.79.46-1.05.6-2.1,1.17-4.69,1.46-6.75,1.46Z"/><path class="cls-1" d="M34.06,39.76l-9.4-12.12,5.65.94.04.05,5.69,7.7,19.43-1.22.42,3.24-21.83,1.41ZM25.38,28.08l8.82,11.37,21.34-1.38-.34-2.63-19.31,1.21-.05-.07-5.71-7.71-4.75-.79Z"/><rect class="cls-1" x="32.74" y="37.01" width="23" height=".31" transform="translate(-2.1 2.66) rotate(-3.36)"/><polygon class="cls-1" points="60.5 44.49 57.95 23.94 58.26 23.91 60.71 43.69 65.41 37.4 90.84 35.79 104.97 12.77 103.02 12.61 90.19 33.15 90.11 33.16 65.82 34.67 65.8 34.36 90.01 32.86 102.86 12.28 105.49 12.51 91.02 36.09 90.94 36.09 65.57 37.69 60.5 44.49"/><polygon class="cls-1" points="61.36 40.72 58.92 23.47 59.15 23.44 61.5 40.13 69.2 29.76 70.15 18.48 70.38 18.5 69.42 29.84 69.4 29.87 61.36 40.72"/><polygon class="cls-1" points="60.98 35.76 60.8 35.61 65.42 29.76 66.13 20.11 66.36 20.13 65.65 29.84 65.62 29.87 60.98 35.76"/><polygon class="cls-1" points="64.66 36.14 64.64 35.83 90.38 34.27 103.99 12.46 104.25 12.63 90.56 34.57 64.66 36.14"/><rect class="cls-1" x="90.13" y="32.98" width=".31" height="1.46" transform="translate(-5.57 23.69) rotate(-14.5)"/><polygon class="cls-1" points="60.61 44.24 56.35 44.24 53.98 26.04 54.28 26 56.62 43.94 60.61 43.94 60.61 44.24"/><polygon class="cls-1" points="67.39 34.49 67.21 34.35 69.19 31.68 69.19 29.91 65.53 29.91 65.53 29.68 69.42 29.68 69.42 31.76 67.39 34.49"/><rect class="cls-1" x="65.29" y="35.94" width=".31" height="1.61" transform="translate(-2.1 4.02) rotate(-3.46)"/><rect class="cls-1" x="32.62" y="37" width="3.48" height=".31" transform="translate(-11.7 16.18) rotate(-22.76)"/></g></g></svg>`,"dodgeball":`<svg aria-hidden="true" focusable="false" data-name="Layer 2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108.79 97.26"><defs><style> .cls-1 { fill: currentColor; } </style></defs><g data-name="Layer 1"><g><path class="cls-1" d="M106.15,94.01H0l.05-.22L21.57,0h63.01l.03.14,21.54,93.87ZM.45,93.65h105.25L84.29.36H21.86L.45,93.65Z"/><rect class="cls-1" x="13.61" y="34.45" width="78.93" height=".5"/><rect class="cls-1" x="18.45" y="15.08" width="69.62" height=".25"/><rect class="cls-1" x="7.91" y="58.99" width="90.02" height=".75"/><g data-name="7a9uOk"><g><path class="cls-1" d="M100.92,94.83l-7.35-17.55-11.23-10.66c-3.79,1.06-7.01-1-8.18-4.67-1.97-6.21-3.05-12.48-2.88-19.18l-11.05.2c-1.15.02-2.06-.94-2.54-1.87l-3.05-9.17c2.21-.08,3.87-.72,5.64-2.04l2.36,7.01,14.94-.29c3.56-.07,6.46,2.67,6.39,6.23-.12,5.84.83,11.41,2.98,16.76l13.57,12.89,7.93,18.97c.9,2.15-.04,4.52-2.06,5.43s-4.52.21-5.47-2.06Z"/><path class="cls-1" d="M79.63,82.09l-11.81,13.63c-1.57,1.82-4.18,2-5.88.52-1.87-1.62-1.88-4.2-.24-6.09l10.51-12.1,3.17-11.41c2.04,1.45,4.11,2.04,6.42,1.58l1.36,1.27-3.54,12.59Z"/><path class="cls-1" d="M85.47,42.38c-.13-2.66-1.43-4.33-3.18-5.96,3.76-.54,7.29.42,10.74-.33,3.89-.84,7.44-2.7,11.22-3.82,1.65-.49,3.19.31,3.75,1.88.43,1.22-.06,3.14-1.63,3.68-4.12,1.42-8.07,3.22-12.3,4.29-2.74.7-5.64-.17-8.6.25Z"/><path class="cls-1" d="M76,21.16c3.73-1.08,7.34,1.1,8.27,4.72.86,3.34-1.09,6.98-4.61,7.95s-7.06-.94-8.11-4.49c-.97-3.3.78-7.12,4.46-8.18Z"/><path class="cls-1" d="M53.59,17.11c3.86-.76,7.28,1.82,7.98,5.39.73,3.7-1.72,7.32-5.48,8.01-3.56.65-7.09-1.64-7.88-5.32s1.42-7.31,5.38-8.08ZM55.24,18.52c-2.67-.31-4.91,1.53-5.55,3.98,2.39-.31,4.32-1.84,5.55-3.98ZM49.92,25.12c3.65-.71,6.13-2.69,7.74-5.75-.36-.38-1.04-.69-1.54-.65-1.41,2.51-3.58,4.24-6.5,4.71-.13.61-.08,1.25.31,1.7ZM60.08,23.41c.07-1.65-.6-2.6-1.68-3.6l-.66,1.31,2.34,2.3ZM59.19,26.85c2.02-2-.66-3.72-2.01-5.05-.47.51-.9,1-1.05,1.26,1.37,1.29,2.13,2.32,3.06,3.79ZM57.12,28.58c.38-.1,1.13-.56,1.26-.96-.46-1.53-1.61-3.02-2.98-3.97l-1.45.94c1.62,1.12,2.43,2.25,3.17,3.98ZM56.18,28.96c-.31-1.79-1.67-3.22-3.32-3.81l-2.83.88c1.14,2.31,3.49,3.62,6.15,2.94Z"/><path class="cls-1" d="M46.05,22.97h-9.17c-.22,0-.75-.3-.66-.43s.44-.4.66-.4h9.25c.19,0,.53.19.58.34s-.44.49-.66.49Z"/><path class="cls-1" d="M69.31,19.68l-6.92-.02c-.26,0-.71-.6-.54-.8l7.43-.03c.16,0,.48.1.59.15s.12.48.01.53-.44.16-.57.16Z"/><path class="cls-1" d="M38.56,19.67h-6.12c-.21,0-.58-.29-.66-.4s.41-.42.55-.42h6.2c.16,0,.53.3.61.41s-.4.42-.58.42Z"/><path class="cls-1" d="M47.23,19.69h-5.16s-.57-.43-.57-.43c-.13-.1.5-.44.66-.44l5.84.04c-.11.49-.43.76-.76.83Z"/><path class="cls-1" d="M67.91,28.52l-5.98-.04c-.02-.29.43-.83.69-.83l5.07.02c.13,0,.52.11.63.13.12.02-.22.72-.41.72Z"/><path class="cls-1" d="M40.89,28.52h-4.59c-.19,0-.66-.29-.63-.45s.42-.4.59-.4h4.45c.15.01.56.17.67.21.16.06-.3.64-.48.64Z"/><path class="cls-1" d="M34.3,22.33c1.87.64-5.38,1.05-5.22.22.29-.74,4.71-.39,5.22-.22Z"/><path class="cls-1" d="M47.81,28.47l-3.42.05c-.15,0-.63-.37-.55-.46s.37-.36.5-.36l2.87-.04c.24,0,.6.52.61.81Z"/><path class="cls-1" d="M76.16,19.18c-1.11.82-2.74.79-3.94,0,1.33-.5,2.56-.53,3.94,0Z"/><path class="cls-1" d="M66.4,22.39c-.85.93-2.33.85-3.53.1,1.07-.54,2.29-.47,3.53-.1Z"/></g></g></g></g></svg>`};

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

/* Round 5: the price line on a court card. A single-court sport, or a
   two-court sport once its court is picked, shows its off-peak to peak
   range; a two-court sport before the pick shows "from" its lowest rate. */
function courtPriceLine(c){
  const rows = RATES[c.id];
  if(!rows) return `${money(PRICES.court)} / ${L()==='zh'?'小時':'hour'}`;
  const r = (S.court === c.id && S.csize) ? rows.find(x => x.court === S.csize) : (rows.length === 1 ? rows[0] : null);
  return r ? T('rate_range').replace('{off}', money(r.off)).replace('{peak}', money(r.peak))
           : T('rate_from').replace('{p}', money(fromRate(c.id)));
}
/* Round 5: Court A (larger) or Court B (smaller), for the two sports priced
   by court. Renders between the selected card and the hours stepper, joined
   to them as one panel (booking.css .csize). No default: the customer
   chooses, because the two courts cost different amounts. */
function csizeHTML(c){
  return `
    <div class="csize" role="group" aria-label="${T('l_court')}">
      <span class="csize-l">${T('l_court')}</span>
      ${RATES[c.id].map(r => `<button type="button" class="csize-b" data-csize="${r.court}" aria-pressed="${S.csize===r.court}">
        <span class="cs-t">${G('prices.court' + r.court)}</span><span class="cs-p">${T('rate_from').replace('{p}', money(r.off))}</span></button>`).join('')}
    </div>`;
}
function renderCourts(){
  document.getElementById('courtList').innerHTML = COURTS.map(c=>{
    const sel = S.court===c.id;
    return `
    <button class="opt ${sel?'sel':''} ${sel&&twoCourts(c.id)?'has-panel':''}" data-court="${c.id}">
      <span class="dia">${diaFor(c)}</span>
      <span class="txt"><span class="t">${nm(c)}</span>
        <span class="d">${courtPriceLine(c)}</span></span>
    </button>${sel&&twoCourts(c.id)?csizeHTML(c):''}`;}).join('');
  /* Switching from one court to a DIFFERENT one resets the hours and clears
     any slots, since those were picked against the old court's availability.
     Choosing a court for the first time (S.court still null) must not, or a
     ?t= deep link would be wiped by the very first click. */
  bind('courtList','court',v=>{ if(S.court && S.court!==v){ S.times=[]; S.csize=null; } S.court=v; });
  document.querySelectorAll('#courtList .csize-b').forEach(b=>b.onclick=()=>{
    S.csize = b.dataset.csize; renderCourts(); sync();
  });
}
function renderCats(){
  document.getElementById('catList').innerHTML = CATS.map(c=>`
    <button class="opt ${S.cat===c.id?'sel':''}" data-cat="${c.id}">
      <span class="txt"><span class="t">${nm(c)}</span><span class="d">${pick(c,'d')}</span></span>
    </button>`).join('');
  bind('catList','cat',v=>{S.cat=v; S.filters=[v];});
}
function renderCoaches(){
  /* Round 4 N9: the filter chips are SPORTS, not specialty tags. The client
     overwrote All / Pickleball / Youth / Family with VOLLEYBALL, PICKLE BALL,
     BADMINTON, S&C, TEQVOLY and a trailing "......". Coaches carry a sport
     via their dia key, which is the court id; S&C has no court, so a coach
     whose specialty tags mention strength is grouped under 'sc'.
     Filtering stays client-side, and if the chosen coach falls outside the
     new filter the choice is cleared, so Next never stays enabled for a card
     nobody can see. */
  const cf = document.getElementById('coachFilters');
  if(cf){
    const ids = [...new Set(COACHES.map(c=>c.sport).filter(Boolean))];
    cf.innerHTML = `<button type="button" class="chip ${S.ctag?'':'on'}" data-t="">${T('filter_all')}</button>`
      + ids.map(id=>`<button type="button" class="chip ${S.ctag===id?'on':''}" data-t="${id}">${sportName(id)}</button>`).join('');
    cf.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{
      S.ctag = b.dataset.t;
      const cur = COACHES.find(c=>c.id===S.coach);
      if(cur && S.ctag && cur.sport !== S.ctag) S.coach = null;
      renderCoaches(); sync();
    });
  }
  const list = COACHES.filter(c => !S.ctag || c.sport === S.ctag);
  document.getElementById('coachList').innerHTML = list.map(c=>`
    <button class="opt ${S.coach===c.id?'sel':''}" data-coach="${c.id}">
      <span class="av" aria-hidden="true">${AVATAR}</span>
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
/* Round 4 N2: the four categories are two different products. A term course
   (sport classes, S&C) runs a fixed number of lessons on one weekday, so the
   customer picks a WEEKDAY. A one-off event (certificate, workshop) happens
   on a single date, so the date picker stays. kindOf() reads which model the
   current filter selection implies; with a mixed or empty filter it falls
   back to the date picker, which is the safer default because it never hides
   a real date. */
const DOW_KEYS = ['dow_sun','dow_mon','dow_tue','dow_wed','dow_thu','dow_fri','dow_sat'];
function kindOf(){
  const on = CATS.filter(c => !S.filters.length || S.filters.includes(c.id));
  const kinds = new Set(on.map(c => c.kind));
  return kinds.size === 1 ? [...kinds][0] : 'event';
}
/* Round 4 N4: a term course card shows its term range, weekday and lesson
   count; a one-off event shows its date and full time range. */
function classMeta(c){
  const t = [];
  if(c.lessons != null){
    const dow = T(DOW_KEYS[c.weekday]);
    t.push(`${T('l_term')}: ${c.term} (${dow})`);
    t.push(`${c.start} · ${c.dur} ${T('mins')}`);
    t.push(`${T('l_lessons')}: ${c.lessons}`);
  } else {
    const d = c.date ? new Date(c.date + 'T00:00:00') : null;
    const ds = d ? d.toLocaleDateString(L()==='zh'?'zh-HK':'en-GB',
                     {day:'numeric', month:L()==='zh'?'long':'short', year:'numeric'}) : '';
    if(ds) t.push(ds);
    t.push(c.end ? `${c.start} to ${c.end}` : `${c.start} · ${c.dur} ${T('mins')}`);
  }
  return t.map(x=>`<span class="d">${x}</span>`).join('');
}
function renderClasses(){
  const chips = document.getElementById('classChips');
  chips.innerHTML = CATS.map(c=>
    `<button class="chip ${S.filters.includes(c.id)?'on':''}" data-f="${c.id}">${nm(c)}</button>`).join('');
  chips.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{
    const v=b.dataset.f;
    S.filters = S.filters.includes(v) ? S.filters.filter(x=>x!==v) : S.filters.concat(v);
    S.cls=null; S.dow=null;
    renderClasses(); sync();
  });

  /* Round 4 N1: a sport filter row under the category chips. The client drew
     VOLLEYBALL, BADMINTON, BASKETBALL and an explicit "......", meaning the
     list continues, so every sport that actually has a class is listed. */
  const sf = document.getElementById('sportChips');
  if(sf){
    const ids = [...new Set(CLASSES.map(c=>c.sport).filter(Boolean))];
    sf.innerHTML = `<button type="button" class="chip ${S.sport?'':'on'}" data-s="">${T('sport_all')}</button>`
      + ids.map(id=>`<button type="button" class="chip ${S.sport===id?'on':''}" data-s="${id}">${sportName(id)}</button>`).join('');
    sf.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{
      S.sport = b.dataset.s; S.cls = null;
      renderClasses(); sync();
    });
  }

  const kind = kindOf();
  const dateWrap = document.getElementById('dates3wrap');
  const dowWrap = document.getElementById('dowWrap');
  const D = days();
  if(dateWrap) dateWrap.hidden = (kind === 'term');
  if(dowWrap) dowWrap.hidden = (kind !== 'term');

  if(kind === 'term' && dowWrap){
    /* weekdays that at least one visible course actually meets on */
    const avail = new Set(CLASSES.filter(c=>c.lessons!=null).map(c=>c.weekday));
    document.getElementById('dow').innerHTML = DOW_KEYS.map((k,i)=>
      `<button type="button" class="chip ${S.dow===i?'on':''}" data-w="${i}" ${avail.has(i)?'':'disabled'}>${T(k)}</button>`).join('');
    document.getElementById('dow').querySelectorAll('.chip').forEach(b=>b.onclick=()=>{
      const w = +b.dataset.w;
      S.dow = (S.dow===w) ? null : w;
      S.cls = null;
      renderClasses(); sync();
    });
    document.getElementById('s3sub').textContent = '';
  } else {
    document.getElementById('dates3').innerHTML = D.map((d,i)=>
      `<button class="date ${S.day===i?'on':''}" data-d="${i}"><span class="dw">${d.dw}</span><span class="dn">${d.dn}</span></button>`).join('');
    document.getElementById('dates3').querySelectorAll('.date').forEach(b=>
      b.onclick=()=>{S.day=+b.dataset.d; S.cls=null; renderClasses(); sync();});
    document.getElementById('s3sub').textContent = D[S.day].full;
  }

  const list = CLASSES.filter(c=>
       (!S.filters.length || S.filters.includes(c.cat))
    && (!S.sport || c.sport === S.sport)
    && (kind !== 'term' || S.dow == null || c.weekday === S.dow));
  /* round 2 item 11: remember the time each card shows, so the s8 calendar
     link can use the session's real start rather than guessing it. */
  list.forEach(c=>{ CLS_TIME[c.id] = c.start || CLASS_TIMES[0]; });
  /* round 2 item 9: the coach moves off the meta line onto a line of its own,
     with the avatar glyph, because the client asked to see who is
     responsible. The "name to confirm" half stays visible in client view,
     same convention as HK$ TBC. */
  document.getElementById('classList').innerHTML = list.length ? list.map(c=>`
    <button class="opt ${S.cls===c.id?'sel':''}" data-cls="${c.id}">
      <span class="txt"><span class="t">${nm(c)}</span>
        ${classMeta(c)}
        <span class="d">${pick(c,'d')}</span>
        <span class="cl"><span class="cl-av" aria-hidden="true">${AVATAR}</span>${coachLine(c.coach)}</span>
        <span class="tags"><span class="tag">${c.spots} ${T('spots')}</span></span></span>
      <span class="p">${money(PRICES.class)}</span>
    </button>`).join('') : `<p class="meta">${L()==='zh'?'此篩選沒有課堂。':'No classes match this filter.'}</p>`;
  bind('classList','cls',v=>{S.cls=v;});
}
/* Round 6 (N39, Siu 2026-10-04): up to two hours a day, back to back. The
   time grid sets the length, so the round 3 hours stepper is gone: tap a
   start time for one hour, then the hour just before or after it for two.
   Tapping any other free slot starts again from there. No free slot is ever
   disabled for being over the count: round 5 drew those in the booked style,
   which is why 10:00 and 12:00 looked taken to Siu. Only booked slots are
   struck through. Personal training still books one slot. */
const hourOf = t => Number(t.slice(0, 2));
function adjacentTo(t){
  return MODE === 'venue' && S.times.length === 1 && Math.abs(hourOf(t) - hourOf(S.times[0])) === 1;
}
function pickSlot(t){
  if(S.times.includes(t)){ S.times = S.times.filter(x => x !== t); return; }
  if(adjacentTo(t) && S.times.length < MAX_HOURS){ S.times = S.times.concat(t).sort(); return; }
  S.times = [t];
}
function needed(){ return 1; }
function renderSlots(){
  const D = days();
  document.getElementById('dates2').innerHTML = D.map((d,i)=>
    `<button class="date ${S.day===i?'on':''}" data-d="${i}"><span class="dw">${d.dw}</span><span class="dn">${d.dn}</span></button>`).join('');
  document.getElementById('dates2').querySelectorAll('.date').forEach(b=>
    b.onclick=()=>{S.day=+b.dataset.d; S.times=[]; renderSlots(); sync();});
  const who = MODE==='pt'
    ? (COACHES.find(c=>c.id===S.coach)||{n:''}).n
    : nm(COURTS.find(c=>c.id===S.court)||{en:'',zh:''})
      + (MODE==='venue' && twoCourts(S.court) && S.csize ? ', ' + G('prices.court' + S.csize) : '');   /* round 6: A and B cost different amounts */
  document.getElementById('s2sub').textContent = who + ' · ' + D[S.day].full;
  document.getElementById('slots').innerHTML = TIMES.map((t,i)=>{
    const gone = taken(S.day,i);
    const on = S.times.includes(t);
    /* the free hour either side of a single pick: tap it for two hours */
    const adj = !on && !gone && adjacentTo(t);
    /* round 5: on a court booking each slot shows what that hour costs */
    const p = MODE==='venue' ? slotPrice(S.day, t) : null;
    const price = p == null ? '' : `<span class="tp">${money(p)}</span>`;
    return `<button class="tslot ${on?'on':''} ${adj?'adj':''} ${p!=null&&isPeak(dayDate(S.day), t)?'peak':''}" data-t="${t}" ${gone?'disabled':''}>${t}${price}</button>`;
  }).join('');
  const rn = document.getElementById('s2rates');
  if(rn){ rn.hidden = MODE!=='venue'; rn.textContent = G('prices.hours'); }
  const sn = document.getElementById('s2note');
  if(sn) sn.hidden = MODE!=='venue';
  document.getElementById('slots').querySelectorAll('.tslot').forEach(b=>
    b.onclick=()=>{
      pickSlot(b.dataset.t);
      renderSlots(); sync();
    });
}
function bind(id, key, fn){
  document.getElementById(id).querySelectorAll('.opt').forEach(b=>b.onclick=()=>{
    fn(b.dataset[key]); render(); sync();
  });
}

/* ---------- summary ---------- */
/* Round 3: several slots read as one value, e.g. "Tuesday 4 Nov, 08:00 and
   10:00". Joined with the locale's own conjunction so no dash or slash
   enters the copy. */
function whenText(){
  const D = days();
  if(!S.times.length) return null;
  const sep = L()==='zh' ? '、' : ', ';
  return `${D[S.day].full}, ${S.times.join(sep)}`;
}
function lines(){
  const out=[], D=days();
  if(MODE==='venue'){
    const c=COURTS.find(x=>x.id===S.court);
    out.push([T('l_court'), c ? nm(c) + (twoCourts(c.id) && S.csize ? ', ' + G('prices.court' + S.csize) : '') : null]);
    /* round 3: hours booked rides its own line, so it reaches the summary
       aside, the s7 block and the s8 recap in one place */
    out.push([T('qty_l'), S.times.length ? String(S.times.length) : null]);
    out.push([T('l_when'), whenText()]);
  }
  if(MODE==='class'){
    const cat=bookedCat(), cl=CLASSES.find(x=>x.id===S.cls);
    out.push([T('st_cat'), cat?nm(cat):null]);
    out.push([T('l_class'), cl?nm(cl):null]);
    /* round 2 item 9: who is responsible, in the summary and the recap too.
       .wrapv lets this one value wrap, since .li .v is nowrap by default. */
    if(cl) out.push([T('l_coach'), `<span class="wrapv">${coachVal(cl.coach)}</span>`]);
    if(cl) out.push([T('l_dur'), `${cl.dur} ${T('mins')}`]);
    /* round 4 N4: a term course is described by its term, weekday and lesson
       count; a one-off event by its date. */
    if(cl && cl.lessons != null){
      out.push([T('l_term'), `${cl.term} (${T(DOW_KEYS[cl.weekday])})`]);
      out.push([T('l_lessons'), String(cl.lessons)]);
    } else {
      out.push([T('l_when'), S.cls ? D[S.day].full : null]);
    }
  }
  if(MODE==='pt'){
    const co=COACHES.find(x=>x.id===S.coach), sz=SIZES.find(x=>x.id===S.size);
    out.push([T('l_coach'), co?co.n:null]);
    /* round 4 N10: group size became a coaching ratio */
    out.push([T('l_ratio'), sz?nm(sz):null]);
    out.push([T('l_when'), whenText()]);
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
  /* round 3: the sticky bar carries no line list, so the hours ride on its
     total instead. */
  /* round 5: court bookings show a real total, exact once every hour has a
     slot and "from" before that; classes and personal training stay TBC. */
  const tot = courtTotal();
  const totHTML = tot == null ? money(null)
    : (tot.exact ? money(tot.v) : G('price.fromTemplate').replace('{p}', money(tot.v)));
  const st = document.getElementById('sumTotal');
  if(st){ st.innerHTML = totHTML; st.classList.toggle('price-tbc', tot == null); }
  const bt = document.getElementById('barTotal');
  if(bt){ bt.innerHTML = totHTML + '<span id="barQty"></span>'; bt.classList.toggle('price-tbc', tot == null); }
  const s7 = document.getElementById('s7lines');
  /* Round 4 N11: personal training itemises coaching and court hire as
     separate lines before the total, because the client's receipt does.
     Both read HK$ TBC until the rate card lands, like every other price. */
  const split = MODE==='pt'
    ? `<div class="li"><span class="k">${T('l_coaching')}</span><span class="v">${money(PRICES.pt)}</span></div>
       <div class="li"><span class="k">${T('l_courtfee')}</span><span class="v">${money(PRICES.court)}</span></div>`
    : '';
  if(s7) s7.innerHTML = `<div class="summary" style="max-width:460px">${html}${split}
    <div class="total"><span>${T('sum_total')}</span><span>${totHTML}</span></div>
    <p class="policy">${T('policy')}</p></div>`;
}

/* ---------- flow control ---------- */
/* Round 4 N7: the details form differs per category. Workshop and
   certificate courses ask a fuller set (date of birth, gender, how did you
   hear about us); venue, personal training and training classes ask the
   short set. Training classes should follow EVA's member registration
   exactly (client, 2026-09-24), but nobody has supplied EVA's field list, so
   they keep the short set and carry a change-request callout rather than an
   invented form.
   The category is read off the CHOSEN CLASS, not S.cat: S.cat records the
   pre-select on s1c, but the session list lets the customer filter to a
   different category and book from it, so the class is the truth. */
function bookedCat(){
  const cl = CLASSES.find(c => c.id === S.cls);
  if(cl) return CATS.find(c => c.id === cl.cat) || null;
  return CATS.find(c => c.id === S.cat) || null;
}
function formKind(){
  if(MODE !== 'class') return 'short';
  const cat = bookedCat();
  return (cat && cat.kind === 'event') ? 'full' : 'short';
}
function requiredFields(){
  const base = ['fFirst','fLast','fHkid','fEmail','fPhone'];
  return formKind()==='full' ? base.concat('fDob','fGender','fHear') : base;
}
function canAdvance(){
  const id = FLOWS[MODE][S.i];
  if(id==='s1')  return !!S.court && (!twoCourts(S.court) || !!S.csize);
  if(id==='s1c') return !!S.cat;
  if(id==='s5')  return !!S.coach;
  if(id==='s5b') return !!S.size;
  if(id==='s3')  return !!S.cls;
  /* round 6: one slot, or two back to back (pickSlot keeps them adjacent) */
  if(id==='s2')  return S.times.length >= needed();
  if(id==='s6')  return requiredFields().every(i=>{
                       const el = document.getElementById(i);
                       return !el || el.closest('[hidden]') ? true : el.value.trim();
                     })
                     && document.getElementById('cWaiver').checked;
  return true;
}
/* Round 4 N7/N8: show the fields this category actually asks for, point the
   terms link at the right body of terms, and surface the EVA change request
   on training classes. */
function renderForm(){
  const full = formKind()==='full';
  const ex = document.getElementById('s6extra');
  if(ex) ex.hidden = !full;
  /* the notes field survives on workshop and certificate only: the client
     said LCSD does not ask it for court hire (round 3), then listed it for
     workshops and certificates (round 4) */
  const notes = document.getElementById('fNotesRow');
  if(notes) notes.hidden = !full;
  const eva = document.getElementById('crEva');
  if(eva) eva.hidden = !(MODE==='class' && !full);

  /* Round 3 A6 / round 4 N8: make the words "terms and conditions" inside the
     waiver sentence clickable, in whichever position that phrase occupies in
     the current language. Built here rather than in the markup because both
     halves are translated strings: appending a second copy of the phrase
     after the sentence would print it twice. */
  const wt = document.getElementById('waiverText');
  if(wt){
    const sentence = T('c_waiv'), phrase = T('tc_link');
    const at = sentence.indexOf(phrase);
    const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    wt.innerHTML = at === -1
      ? `${esc(sentence)} <span class="tc-open" id="tcOpen" role="button" tabindex="0">${esc(phrase)}</span>`
      : esc(sentence.slice(0, at))
        + `<span class="tc-open" id="tcOpen" role="button" tabindex="0">${esc(phrase)}</span>`
        + esc(sentence.slice(at + phrase.length));
    const btn = document.getElementById('tcOpen');
    if(btn){
      /* a span, not a button: a button is an atomic inline-block, so a long
         phrase would sit on its own line instead of flowing inside the
         sentence. role and keyboard handling are restored by hand. */
      btn.onclick = e => { e.preventDefault(); e.stopPropagation(); openTerms(); };
      btn.onkeydown = e => {
        if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); e.stopPropagation(); openTerms(); }
      };
    }
  }
}
/* which set of terms this booking falls under */
function tcKey(){
  if(MODE==='venue') return 'venue';
  if(MODE==='pt') return 'pt';
  const cat = bookedCat();
  return cat ? cat.id : 'venue';
}
function openTerms(){
  const dlg = document.getElementById('tcPanel');
  if(!dlg) return;
  document.getElementById('tcTitle').textContent = T('tc_h_' + tcKey());
  document.getElementById('tcText').textContent = T('tc_pending');
  dlg.hidden = false;
}
function closeTerms(){
  const dlg = document.getElementById('tcPanel');
  if(dlg) dlg.hidden = true;
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
  if(id==='s6')  renderForm();      /* round 4 N7 */
  if(id==='s8'){ renderRecap(); renderCal(); }   /* round 2 item 11 */
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
  const art = MODE==='venue'
    ? diaFor(COURTS.find(c=>c.id===S.court))
    : DIA['basketball'];
  document.getElementById('recap').innerHTML =
    `<div class="watermark">${art}</div>${lineHTML()}
     <div class="li"><span class="k">${T('ref')}</span><span class="v">${REF}</span></div>`;
}

/* ---------- round 2 item 11: add to calendar (s8) ----------
   One event, two links: a Google Calendar TEMPLATE url opened in a new tab,
   and the same event as a VCALENDAR on a data: url for Apple Calendar.
   Times are local floating (no Z, no TZID), with ctz=Asia/Hong_Kong on the
   Google link, per the round 2 brief. Durations: a venue slot is one hour, a
   class is its own dur, PT is 60 minutes. The confirmation page is rendered
   by the Bliss backend, so both links are a change request for Edward; the
   .cr callout on s8 says so. */
function dayDate(i){ const d = new Date(); d.setDate(d.getDate() + i); return d; }
function stamp(d){
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`;
}
function calEvent(){
  let title = '', time = S.times[0], mins = 60;
  if(MODE==='venue'){
    const c = COURTS.find(x=>x.id===S.court);
    title = c ? nm(c) : '';
    mins = 60 * Math.max(1, S.times.length);   /* round 6: two back-to-back hours */
  }
  if(MODE==='class'){
    const cl = CLASSES.find(x=>x.id===S.cls);
    title = cl ? nm(cl) : '';
    time = CLS_TIME[S.cls] || (cl && cl.start) || CLASS_TIMES[0];
    mins = cl ? cl.dur : 60;
  }
  if(MODE==='pt'){
    const co = COACHES.find(x=>x.id===S.coach);
    title = T('cal_pt') + (co ? ' · ' + co.n : '');
  }
  if(!time) return null;
  const base = dayDate(S.day), hm = time.split(':').map(Number);
  const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hm[0], hm[1], 0);
  const end = new Date(start.getTime() + mins * 60000);
  return { title, start:stamp(start), end:stamp(end), details:`${T('ref')} ${REF} · ${VENUE}` };
}
function renderCal(){
  const g = document.getElementById('gcal'), i = document.getElementById('ics');
  if(!g || !i) return;
  const e = calEvent(); if(!e) return;
  g.href = 'https://calendar.google.com/calendar/render?action=TEMPLATE'
    + '&text=' + encodeURIComponent(e.title)
    + '&dates=' + e.start + '/' + e.end
    + '&details=' + encodeURIComponent(e.details)
    + '&location=' + encodeURIComponent(VENUE)
    + '&ctz=' + encodeURIComponent('Asia/Hong_Kong');
  const ics = [
    'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Sporting Hub Hong Kong//Booking prototype//EN',
    'CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:' + REF + '@sportinghub.hk',
    'DTSTAMP:' + e.start,'DTSTART:' + e.start,'DTEND:' + e.end,
    'SUMMARY:' + e.title,'DESCRIPTION:' + e.details,'LOCATION:' + VENUE,
    'END:VEVENT','END:VCALENDAR'
  ].join('\r\n');
  i.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
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
  /* round 4 N7: the extra workshop and certificate fields validate too */
  ['fFirst','fLast','fHkid','fEmail','fPhone','fDob','fGender','fHear','cWaiver'].forEach(i=>{
    const el=document.getElementById(i); if(el) el.addEventListener('input', sync);
  });
  /* round 4 N8 + round 3 A6: the terms panel. The open button is built by
     renderForm (the link sits inside a translated sentence), so only the
     panel's own dismiss handlers are wired here. */
  const tcClose = document.getElementById('tcClose');
  if(tcClose) tcClose.onclick = closeTerms;
  const tcPanel = document.getElementById('tcPanel');
  if(tcPanel) tcPanel.addEventListener('click', e => { if(e.target === tcPanel) closeTerms(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeTerms(); });
  boot(pageExtras);
}
