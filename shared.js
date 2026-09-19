/* Sporting Hub Hong Kong — prototype v2 shared front end
   v1 _shared.js logic (lang(), setLang(), waLink(), initNav(), boot()),
   adapted for:
     - the v2 nav markup (.nav-lockup / .nav-items / .lang-toggle / .nav-burger
       / .drawer / .drawer-scrim instead of v1's .lockup / .nav ul / .lang /
       .burger / .drawer / .scrim; the [data-lang] buttons live inside
       .lang-toggle here, not a bare .lang group)
     - the data-str / data-str-ph / data-str-aria / data-str-title
       convention (flat window.STRINGS[lang][key] lookup) instead of v1's
       data-i18n / data-i18n-ph / data-i18n-aria against a per-page STR
       object passed into boot().
   Both index.html and booking.html load strings.js before this file, then
   this file before their own page script (booking.js / none for index.html,
   which calls boot() directly at the end of its own inline script -- see
   index.html's closing <script> block).
   Front end only. No network calls beyond localStorage. */

const WA_NUMBER = "852XXXXXXXX";   /* TBC: replace with the real number, then search for WA_NUMBER */

/* ---------- language ---------- */
/* Same localStorage key as v1 ('shhk-lang'), so index.html and booking.html
   agree on language across a navigation between them (BRIEF.md: "persists
   in localStorage shhk-lang (the v1 key, so both pages agree)"). */
function lang(){ return localStorage.getItem('shhk-lang') || 'en'; }

function setLang(l){
  try{ localStorage.setItem('shhk-lang', l); }catch(e){}
  document.documentElement.lang = (l === 'zh') ? 'zh-Hant' : 'en';
  const d = (window.STRINGS && window.STRINGS[l]) || (window.STRINGS && window.STRINGS.en) || {};
  document.querySelectorAll('[data-str]').forEach(el=>{
    const v = d[el.getAttribute('data-str')]; if (v !== undefined) el.textContent = v;
  });
  document.querySelectorAll('[data-str-ph]').forEach(el=>{
    const v = d[el.getAttribute('data-str-ph')]; if (v !== undefined) el.placeholder = v;
  });
  document.querySelectorAll('[data-str-aria]').forEach(el=>{
    const v = d[el.getAttribute('data-str-aria')]; if (v !== undefined) el.setAttribute('aria-label', v);
  });
  document.querySelectorAll('[data-str-title]').forEach(el=>{
    const v = d[el.getAttribute('data-str-title')]; if (v !== undefined) el.setAttribute('title', v);
  });
  document.querySelectorAll('.lang-toggle button[data-lang]').forEach(b=>{
    b.setAttribute('aria-pressed', String(b.dataset.lang === l));
  });
  if (_after) _after();
}

/* ---------- WhatsApp deep link ---------- */
/* wa.me link with a per-page prefill, so enquiries arrive labelled. Text is
   passed in already resolved (the caller reads it from STRINGS so no
   Chinese/English literal lives in this file). */
function waLink(id, text){
  const a = document.getElementById(id); if (!a) return;
  a.href = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(text);
}

/* ---------- nav: language toggle clicks + mobile drawer ---------- */
let _after = null;

function initNav(){
  document.querySelectorAll('.lang-toggle button[data-lang]').forEach(b=>{
    b.onclick = () => setLang(b.dataset.lang);
  });

  const burger = document.getElementById('burger');
  const drawer = document.getElementById('drawer');
  const drawerScrim = document.getElementById('drawerScrim');
  const closeX = document.getElementById('drawerX');
  if (!burger || !drawer) return;   /* booking.html has no burger/drawer */
  const open = v => {
    drawer.classList.toggle('is-open', v);
    if (drawerScrim) drawerScrim.classList.toggle('is-open', v);
    burger.setAttribute('aria-expanded', String(v));
    document.body.style.overflow = v ? 'hidden' : '';
    if (v){ const first = drawer.querySelector('a'); if (first) first.focus(); }
  };
  burger.onclick = () => open(!drawer.classList.contains('is-open'));
  if (closeX) closeX.onclick = () => { open(false); burger.focus(); };
  if (drawerScrim) drawerScrim.onclick = () => open(false);
  drawer.querySelectorAll('a').forEach(a => a.onclick = () => open(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) { open(false); burger.focus(); }
  });
}

/* ---------- boot ---------- */
/* after: optional callback run once on boot and again on every language
   switch (v1's _after / pageExtras hook), so a page's dynamic renderers
   (booking.js's render(), for instance) redraw in the new language. */
function boot(after){
  _after = after || null;
  initView();
  initNav();
  setLang(lang());
}

/* ---------- dev / client view (2026-09-09) ---------- */
/* index.html's tweaks panel writes the choice to localStorage 'shhk-mock-view'.
   booking.html has no panel and shipped with data-view="dev" hard-coded, so a
   client who had switched to Client on the landing page still saw every dev
   tag and the three "Backend change request" callouts on the booking screens.
   Both pages now read the same key here; ?view=client|dev on either URL sets
   it. Client view hides .tbc, .photo-slot, .dev-note and .cr via CSS.

   Round 2 (client review 2026-09-19, item 8): the DEFAULT is now client, not
   dev. A first-time visitor with nothing in localStorage and no query param
   sees the presentable page; dev annotations are opt-in through ?view=dev or
   the landing page's panel switch, and persist exactly as before. Nothing
   else about the panel logic changes. booking.html inherits this unchanged,
   since it calls the same boot() -> initView() and has no panel of its own. */
function initView(){
  const KEY = 'shhk-mock-view';
  let v = null;
  try{
    const forced = new URLSearchParams(location.search).get('view');
    if (forced === 'client' || forced === 'dev'){ localStorage.setItem(KEY, forced); }
    v = localStorage.getItem(KEY);
  }catch(e){}
  document.documentElement.setAttribute('data-view', v === 'dev' ? 'dev' : 'client');
}
