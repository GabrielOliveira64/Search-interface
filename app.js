// ═══════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════
let cfg = null;

async function loadConfig() {
  try {
    const res = await fetch('/api/config');
    cfg = await res.json();
    if (cfg.newsMaxPerFeed      === undefined) cfg.newsMaxPerFeed      = 5;
    if (cfg.newsMaxAll          === undefined) cfg.newsMaxAll          = 10;
    if (!cfg.newsFilters)        cfg.newsFilters        = [];
    if (!cfg.newsFiltersNeg)     cfg.newsFiltersNeg     = [];
    if (!cfg.newsFilterScope)    cfg.newsFilterScope    = 'title';
    if (!cfg.newsFilterScopeNeg) cfg.newsFilterScopeNeg = 'title';
    if (cfg.activeFeed          === undefined) cfg.activeFeed          = -1;
    if (cfg.showNewsImages      === undefined) cfg.showNewsImages      = true;
    if (!cfg.linkTarget)         cfg.linkTarget         = 'blank'; // 'blank' | 'self'
  } catch {
    showToast('❌ Não foi possível conectar ao servidor. Rode: node server.js');
  }
}

async function saveConfig() {
  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg)
    });
  } catch {
    showToast('❌ Erro ao salvar configurações.');
  }
}

// ═══════════════════════════════════════
// EXPORT / IMPORT
// ═══════════════════════════════════════
function exportDB() {
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'db.json';
  a.click();
  URL.revokeObjectURL(a.href);
  showToast('✅ db.json exportado!');
}

function importDB() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const imported = JSON.parse(ev.target.result);
        if (!imported.feeds || !imported.categories || !imported.engines)
          throw new Error('Arquivo inválido');
        cfg = imported;
        if (cfg.newsMaxPerFeed      === undefined) cfg.newsMaxPerFeed      = 5;
        if (cfg.newsMaxAll          === undefined) cfg.newsMaxAll          = 10;
        if (!cfg.newsFilters)        cfg.newsFilters        = [];
        if (!cfg.newsFiltersNeg)     cfg.newsFiltersNeg     = [];
        if (!cfg.newsFilterScope)    cfg.newsFilterScope    = 'title';
        if (!cfg.newsFilterScopeNeg) cfg.newsFilterScopeNeg = 'title';
        if (cfg.activeFeed          === undefined) cfg.activeFeed          = -1;
        if (cfg.showNewsImages      === undefined) cfg.showNewsImages      = true;
        if (!cfg.linkTarget)         cfg.linkTarget         = 'blank';
        await saveConfig();
        renderSettingsModal();
        renderEngines();
        renderCategories();
        renderNewsTabs();
        feedCache = {};
        loadNews();
        showToast('✅ db.json importado com sucesso!');
      } catch {
        showToast('❌ Arquivo inválido ou corrompido.');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      background:var(--surface);border:1px solid var(--border);
      color:var(--text);padding:10px 20px;border-radius:10px;
      font-family:'DM Mono',monospace;font-size:13px;
      z-index:9999;opacity:0;transition:opacity 0.25s;pointer-events:none;
      white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { toast.style.opacity = '0'; }, 2800);
}

// ═══════════════════════════════════════
// THEME
// ═══════════════════════════════════════
function setTheme(t) {
  cfg.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeDark').classList.toggle('active',  t === 'dark');
  document.getElementById('themeLight').classList.toggle('active', t === 'light');
}

// ═══════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════
const DAYS   = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  document.getElementById('clock').textContent = `${h}:${m}:${s}`;
  document.getElementById('dateDisplay').textContent =
    `${DAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]} de ${now.getFullYear()}`;
}

// ═══════════════════════════════════════
// LINK TARGET HELPER
// ═══════════════════════════════════════
function linkTarget() {
  return cfg.linkTarget === 'self' ? '_self' : '_blank';
}

// ═══════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════
function renderEngines() {
  document.getElementById('engineSelector').innerHTML = cfg.engines.map((e, i) =>
    `<button class="engine-btn ${i === cfg.activeEngine ? 'active' : ''}" onclick="selectEngine(${i})">${escHtml(e.name)}</button>`
  ).join('');
}
function selectEngine(i) { cfg.activeEngine = i; renderEngines(); }
function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  window.open(cfg.engines[cfg.activeEngine].url + encodeURIComponent(q), linkTarget());
}

// ═══════════════════════════════════════
// CATEGORIES — com drag & drop
// ═══════════════════════════════════════
let dragSrc = null; // { type: 'cat'|'site', ci, si }

function renderCategories() {
  const tabs = document.getElementById('catTabs');
  const grid = document.getElementById('sitesGrid');
  const target = linkTarget();

  // Tabs de categoria com drag
  tabs.innerHTML = cfg.categories.map((c, i) =>
    `<button
      class="cat-tab ${i === cfg.activeCat ? 'active' : ''}"
      draggable="true"
      data-ci="${i}"
      onclick="selectCat(${i})"
      ondragstart="onCatDragStart(event,${i})"
      ondragover="onCatDragOver(event)"
      ondrop="onCatDrop(event,${i})"
      ondragend="onDragEnd()"
    >${escHtml(c.name)}</button>`
  ).join('');

  const cat = cfg.categories[cfg.activeCat] || cfg.categories[0];
  if (!cat) { grid.innerHTML = ''; return; }

  // Sites com drag
  grid.innerHTML = cat.sites.map((s, si) =>
    `<a class="site-card"
      href="${s.url}"
      target="${target}"
      draggable="true"
      data-si="${si}"
      ondragstart="onSiteDragStart(event,${si})"
      ondragover="onSiteDragOver(event)"
      ondrop="onSiteDrop(event,${si})"
      ondragend="onDragEnd()"
      onclick="handleSiteClick(event,'${escHtml(s.url)}')">
      <img class="site-favicon" src="${s.favicon}"
        onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><text y=%2224%22 font-size=%2224%22>🌐</text></svg>'"
        alt="${escHtml(s.name)}">
      <div class="site-name">${escHtml(s.name)}</div>
    </a>`
  ).join('');
}

function handleSiteClick(e, url) {
  // Não navega se foi um drag
  if (e.defaultPrevented) return;
}

function selectCat(i) { cfg.activeCat = i; renderCategories(); }

// Drag categorias
function onCatDragStart(e, i) {
  dragSrc = { type: 'cat', i };
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}
function onCatDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function onCatDrop(e, targetI) {
  e.preventDefault();
  if (!dragSrc || dragSrc.type !== 'cat' || dragSrc.i === targetI) return;
  const cats = cfg.categories;
  const [moved] = cats.splice(dragSrc.i, 1);
  cats.splice(targetI, 0, moved);
  // Mantém seleção na mesma categoria
  if (cfg.activeCat === dragSrc.i) cfg.activeCat = targetI;
  else if (cfg.activeCat >= Math.min(dragSrc.i, targetI) && cfg.activeCat <= Math.max(dragSrc.i, targetI)) {
    cfg.activeCat += dragSrc.i < targetI ? -1 : 1;
  }
  dragSrc = null;
  renderCategories();
}

// Drag sites
function onSiteDragStart(e, si) {
  dragSrc = { type: 'site', si };
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
}
function onSiteDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }
function onSiteDrop(e, targetSi) {
  e.preventDefault();
  if (!dragSrc || dragSrc.type !== 'site' || dragSrc.si === targetSi) return;
  const cat = cfg.categories[cfg.activeCat];
  const [moved] = cat.sites.splice(dragSrc.si, 1);
  cat.sites.splice(targetSi, 0, moved);
  dragSrc = null;
  renderCategories();
  saveConfig(); // persiste ordem
}
function onDragEnd() {
  dragSrc = null;
  document.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
}

// ═══════════════════════════════════════
// NEWS
// ═══════════════════════════════════════
let feedCache = {};
const CACHE_TTL = 5 * 60 * 1000;

async function fetchFeed(feedUrl) {
  const now = Date.now();
  const cached = feedCache[feedUrl];
  if (cached && (now - cached.fetchedAt) < CACHE_TTL) return cached.xml;
  const res = await fetch(`/api/rss?url=${encodeURIComponent(feedUrl)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const xml = await res.text();
  feedCache[feedUrl] = { xml, fetchedAt: now };
  return xml;
}

function warmupAllFeeds() {
  if (!cfg.feeds?.length) return;
  cfg.feeds.forEach(f => fetchFeed(f.url).catch(() => {}));
}

function applyFilters(items) {
  const posFilters = (cfg.newsFilters    || []).map(f => f.toLowerCase().trim()).filter(Boolean);
  const negFilters = (cfg.newsFiltersNeg || []).map(f => f.toLowerCase().trim()).filter(Boolean);
  const posScope   = cfg.newsFilterScope    || 'title';
  const negScope   = cfg.newsFilterScopeNeg || 'title';

  return items.filter(item => {
    const titleLow = item.title.toLowerCase();
    const descLow  = item.desc.toLowerCase();
    const haystackPos = posScope === 'title' ? titleLow : posScope === 'description' ? descLow : titleLow + ' ' + descLow;
    const haystackNeg = negScope === 'title' ? titleLow : negScope === 'description' ? descLow : titleLow + ' ' + descLow;
    if (negFilters.length && negFilters.some(f => haystackNeg.includes(f))) return false;
    if (posFilters.length && !posFilters.some(f => haystackPos.includes(f))) return false;
    return true;
  });
}

// Extrai imagem do RSS (media:content, enclosure, og:image no description)
function extractImage(item) {
  // media:content
  const media = item.querySelector('media\\:content, content') ||
                [...item.querySelectorAll('*')].find(el => el.nodeName.toLowerCase().includes('content') && el.getAttribute('url'));
  if (media?.getAttribute('url')) return media.getAttribute('url');

  // enclosure
  const enc = item.querySelector('enclosure');
  if (enc?.getAttribute('type')?.startsWith('image')) return enc.getAttribute('url');

  // <image> dentro do item
  const imgEl = item.querySelector('image');
  if (imgEl?.textContent?.trim().startsWith('http')) return imgEl.textContent.trim();

  // og:image ou src dentro da description (HTML)
  const descRaw = item.querySelector('description, summary, content')?.textContent || '';
  const srcMatch = descRaw.match(/src=["']([^"']+\.(jpg|jpeg|png|webp|gif))/i);
  if (srcMatch) return srcMatch[1];

  return null;
}

function parseXML(xmlText, feedName) {
  const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
  const rawItems = [...xml.querySelectorAll('item, entry')];
  const items = rawItems.map(item => {
    const title   = item.querySelector('title')?.textContent?.trim() || '';
    const linkEl  = item.querySelector('link');
    const link    = linkEl?.getAttribute('href') || linkEl?.textContent?.trim() || '#';
    const desc    = stripHtml(item.querySelector('description, summary, content')?.textContent || '');
    const pubDate = item.querySelector('pubDate, published, updated')?.textContent || '';
    const image   = extractImage(item);
    return { title, link, desc, pubDate, feedName, image };
  });
  return applyFilters(items);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderNewsCard(item) {
  const dateStr    = item.pubDate ? formatDate(new Date(item.pubDate)) : '';
  const target     = linkTarget();
  const showImages = cfg.showNewsImages !== false;
  const imgHtml    = showImages && item.image
    ? `<img class="news-thumb" src="${escHtml(item.image)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : '';

  return `
    <a class="news-card ${showImages && item.image ? 'has-image' : ''}" href="${item.link}" target="${target}" rel="noopener">
      ${imgHtml}
      <div class="news-card-body">
        <div class="news-title">${escHtml(item.title || 'Sem título')}</div>
        ${item.desc ? `<div class="news-desc">${escHtml(item.desc)}</div>` : ''}
        <div class="news-meta">
          <span class="news-source-badge">${escHtml(item.feedName)}</span>
          ${dateStr ? `<span class="news-date">${dateStr}</span>` : ''}
        </div>
      </div>
      <span class="news-arrow">→</span>
    </a>
  `;
}

function renderNewsTabs() {
  const el = document.getElementById('newsSourceTabs');
  const allActive = cfg.activeFeed === -1;
  let html = `<button class="news-tab ${allActive ? 'active' : ''}" onclick="selectFeed(-1)">Todos</button>`;
  html += cfg.feeds.map((f, i) =>
    `<button class="news-tab ${i === cfg.activeFeed ? 'active' : ''}" onclick="selectFeed(${i})">${escHtml(f.name)}</button>`
  ).join('');
  el.innerHTML = html;
}

function selectFeed(i) { cfg.activeFeed = i; renderNewsTabs(); loadNews(); }

async function loadNews() {
  const grid     = document.getElementById('newsGrid');
  const btn      = document.getElementById('refreshBtn');
  const limitOne = cfg.newsMaxPerFeed || 5;
  const limitAll = cfg.newsMaxAll     || 10;

  if (!cfg.feeds.length) { grid.innerHTML = '<div class="news-empty">Nenhum feed configurado.</div>'; return; }

  btn.classList.add('spinning');
  setTimeout(() => btn.classList.remove('spinning'), 700);

  // ── Feed único ──────────────────────────────────────────────
  if (cfg.activeFeed >= 0) {
    const feed   = cfg.feeds[cfg.activeFeed];
    const cached = feedCache[feed.url];
    if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
      const items = parseXML(cached.xml, feed.name).slice(0, limitOne);
      grid.innerHTML = items.length
        ? items.map(renderNewsCard).join('')
        : '<div class="news-empty">Nenhum resultado para os filtros definidos.</div>';
      return;
    }
    grid.innerHTML = `<div class="news-loading"><div class="loader"></div><br>Carregando ${escHtml(feed.name)}...</div>`;
    try {
      const xml   = await fetchFeed(feed.url);
      const items = parseXML(xml, feed.name).slice(0, limitOne);
      grid.innerHTML = items.length
        ? items.map(renderNewsCard).join('')
        : '<div class="news-empty">Nenhum resultado para os filtros definidos.</div>';
    } catch {
      grid.innerHTML = `<div class="news-empty">⚠️ Não foi possível carregar o feed.<br><br>
        <small style="line-height:1.8">• Verifique se a URL do RSS está correta<br>• Tente novamente (↺)</small></div>`;
    }
    return;
  }

  // ── Todos: shuffle misturado ─────────────────────────────────
  const allItemsPool = [];
  const pendingFeeds = [];

  cfg.feeds.forEach(feed => {
    const cached = feedCache[feed.url];
    if (cached?.xml && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
      allItemsPool.push(...parseXML(cached.xml, feed.name));
    } else {
      pendingFeeds.push(feed);
    }
  });

  function renderPool() {
    const mixed = shuffle(allItemsPool).slice(0, limitAll);
    if (mixed.length === 0 && pendingFeeds.length === 0) {
      grid.innerHTML = '<div class="news-empty">Nenhum resultado para os filtros definidos.</div>';
      return;
    }
    const loadingPlaceholder = pendingFeeds.length > 0
      ? `<div class="news-loading" style="padding:16px 0"><div class="loader" style="width:14px;height:14px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px"></div><span style="font-size:11px;color:var(--muted);font-family:'DM Mono',monospace">carregando ${pendingFeeds.length} feed(s)...</span></div>`
      : '';
    grid.innerHTML = mixed.map(renderNewsCard).join('') + loadingPlaceholder;
  }

  renderPool();

  if (pendingFeeds.length > 0) {
    pendingFeeds.forEach(feed => {
      fetchFeed(feed.url)
        .then(xml => {
          allItemsPool.push(...parseXML(xml, feed.name));
          pendingFeeds.splice(pendingFeeds.indexOf(feed), 1);
          renderPool();
        })
        .catch(() => {
          pendingFeeds.splice(pendingFeeds.indexOf(feed), 1);
          renderPool();
        });
    });
  }
}

function forceRefresh() { feedCache = {}; loadNews(); }

// ═══════════════════════════════════════
// UTILS
// ═══════════════════════════════════════
function stripHtml(html) {
  return html.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
}
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function formatDate(d) {
  if (isNaN(d)) return '';
  const diff = Date.now() - d;
  if (diff < 3600000)  return `${Math.floor(diff/60000)}min atrás`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h atrás`;
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

// ═══════════════════════════════════════
// SETTINGS — ABAS
// ═══════════════════════════════════════
let activeTab = 'tema';

function switchTab(tab) {
  activeTab = tab;
  document.querySelectorAll('.stab').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.stab-content').forEach(c =>
    c.classList.toggle('active', c.id === `tab-${tab}`));
}

function openSettings() {
  renderSettingsModal();
  switchTab(activeTab);
  document.getElementById('settingsModal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderSettingsModal() {
  setTheme(cfg.theme);

  // Motores
  document.getElementById('engineTagsList').innerHTML = cfg.engines.map((e, i) =>
    `<span class="settings-tag">${escHtml(e.name)}<button class="tag-remove" onclick="removeEngine(${i})">✕</button></span>`
  ).join('');

  // Feeds
  document.getElementById('feedTagsList').innerHTML = cfg.feeds.map((f, i) =>
    `<span class="settings-tag">${escHtml(f.name)}<button class="tag-remove" onclick="removeFeed(${i})">✕</button></span>`
  ).join('');

  // Limites
  document.getElementById('newsMaxInput').value    = cfg.newsMaxPerFeed || 5;
  document.getElementById('newsMaxAllInput').value = cfg.newsMaxAll     || 10;

  // Imagens
  document.getElementById('toggleShowImages').checked = cfg.showNewsImages !== false;

  // Link target
  const lt = cfg.linkTarget || 'blank';
  document.querySelectorAll('.link-target-opt').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.target === lt));

  // Filtro positivo
  document.getElementById('filterTagsList').innerHTML = (cfg.newsFilters || []).map((f, i) =>
    `<span class="settings-tag">${escHtml(f)}<button class="tag-remove" onclick="removeFilter(${i})">✕</button></span>`
  ).join('');
  const posScope = cfg.newsFilterScope || 'title';
  document.querySelectorAll('.scope-opt').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.scope === posScope));

  // Filtro negativo
  document.getElementById('filterNegTagsList').innerHTML = (cfg.newsFiltersNeg || []).map((f, i) =>
    `<span class="settings-tag neg">${escHtml(f)}<button class="tag-remove" onclick="removeFilterNeg(${i})">✕</button></span>`
  ).join('');
  const negScope = cfg.newsFilterScopeNeg || 'title';
  document.querySelectorAll('.scope-opt-neg').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.scope === negScope));

  renderCatEditor();
}

function renderCatEditor() {
  document.getElementById('catEditor').innerHTML = cfg.categories.map((cat, ci) => `
    <div style="background:var(--surface2);border-radius:10px;padding:12px;margin-bottom:10px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-weight:700;font-size:13px">${escHtml(cat.name)}</span>
        <button class="tag-remove" onclick="removeCat(${ci})">✕ remover</button>
      </div>
      <div class="tags-list">
        ${cat.sites.map((s, si) =>
          `<span class="settings-tag">${escHtml(s.name)}<button class="tag-remove" onclick="removeSite(${ci},${si})">✕</button></span>`
        ).join('')}
      </div>
      <div class="add-input-row">
        <input class="settings-input" id="newSiteName_${ci}" placeholder="Nome do site">
        <input class="settings-input" id="newSiteUrl_${ci}"  placeholder="URL (https://...)">
        <button class="btn-add" onclick="addSite(${ci})">+ Add</button>
      </div>
    </div>
  `).join('');
}

// ── engines ──
function addEngine() {
  const name = document.getElementById('newEngineName').value.trim();
  const url  = document.getElementById('newEngineUrl').value.trim();
  if (!name || !url) return;
  cfg.engines.push({ name, url });
  document.getElementById('newEngineName').value = '';
  document.getElementById('newEngineUrl').value  = '';
  renderSettingsModal(); switchTab('buscas');
}
function removeEngine(i) {
  cfg.engines.splice(i, 1);
  if (cfg.activeEngine >= cfg.engines.length) cfg.activeEngine = 0;
  renderSettingsModal(); switchTab('buscas');
}

// ── feeds ──
function addFeed() {
  const name = document.getElementById('newFeedName').value.trim();
  const url  = document.getElementById('newFeedUrl').value.trim();
  if (!name || !url) return;
  cfg.feeds.push({ name, url });
  document.getElementById('newFeedName').value = '';
  document.getElementById('newFeedUrl').value  = '';
  renderSettingsModal(); switchTab('noticias');
}
function removeFeed(i) {
  cfg.feeds.splice(i, 1);
  if (cfg.activeFeed >= cfg.feeds.length) cfg.activeFeed = -1;
  renderSettingsModal(); switchTab('noticias');
}

// ── categorias ──
function addCategory() {
  const name = document.getElementById('newCatName').value.trim();
  if (!name) return;
  cfg.categories.push({ name, sites: [] });
  document.getElementById('newCatName').value = '';
  renderCatEditor();
}
function removeCat(i) {
  cfg.categories.splice(i, 1);
  if (cfg.activeCat >= cfg.categories.length) cfg.activeCat = 0;
  renderCatEditor();
}
function addSite(ci) {
  const name = document.getElementById(`newSiteName_${ci}`).value.trim();
  const url  = document.getElementById(`newSiteUrl_${ci}`).value.trim();
  if (!name || !url) return;
  const cleanUrl = url.startsWith('http') ? url : 'https://' + url;
  cfg.categories[ci].sites.push({ name, url: cleanUrl, favicon: `https://${new URL(cleanUrl).hostname}/favicon.ico` });
  renderCatEditor();
}
function removeSite(ci, si) { cfg.categories[ci].sites.splice(si, 1); renderCatEditor(); }

// ── filtro positivo ──
function addFilter() {
  const val = document.getElementById('newFilterInput').value.trim();
  if (!val) return;
  if (!cfg.newsFilters.includes(val)) cfg.newsFilters.push(val);
  document.getElementById('newFilterInput').value = '';
  renderSettingsModal(); switchTab('noticias');
}
function removeFilter(i) { cfg.newsFilters.splice(i, 1); renderSettingsModal(); switchTab('noticias'); }
function setFilterScope(scope) {
  cfg.newsFilterScope = scope;
  document.querySelectorAll('.scope-opt').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.scope === scope));
}

// ── filtro negativo ──
function addFilterNeg() {
  const val = document.getElementById('newFilterNegInput').value.trim();
  if (!val) return;
  if (!cfg.newsFiltersNeg) cfg.newsFiltersNeg = [];
  if (!cfg.newsFiltersNeg.includes(val)) cfg.newsFiltersNeg.push(val);
  document.getElementById('newFilterNegInput').value = '';
  renderSettingsModal(); switchTab('noticias');
}
function removeFilterNeg(i) { cfg.newsFiltersNeg.splice(i, 1); renderSettingsModal(); switchTab('noticias'); }
function setFilterScopeNeg(scope) {
  cfg.newsFilterScopeNeg = scope;
  document.querySelectorAll('.scope-opt-neg').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.scope === scope));
}

// ── imagens ──
function toggleShowImages(val) {
  cfg.showNewsImages = val;
}

// ── link target ──
function setLinkTarget(t) {
  cfg.linkTarget = t;
  document.querySelectorAll('.link-target-opt').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.target === t));
}

// ── salvar ──
async function saveSettings() {
  const maxOne = parseInt(document.getElementById('newsMaxInput').value);
  const maxAll = parseInt(document.getElementById('newsMaxAllInput').value);
  if (!isNaN(maxOne) && maxOne > 0) cfg.newsMaxPerFeed = maxOne;
  if (!isNaN(maxAll) && maxAll > 0) cfg.newsMaxAll     = maxAll;
  cfg.showNewsImages = document.getElementById('toggleShowImages').checked;
  await saveConfig();
  closeSettings();
  renderEngines();
  renderCategories();
  renderNewsTabs();
  feedCache = {};
  loadNews();
  showToast('✅ Configurações salvas!');
}

document.getElementById('settingsModal').addEventListener('click', function(e) {
  if (e.target === this) closeSettings();
});

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
async function init() {
  await loadConfig();
  if (!cfg) return;
  setTheme(cfg.theme);
  updateClock();
  setInterval(updateClock, 1000);
  renderEngines();
  renderCategories();
  renderNewsTabs();
  warmupAllFeeds();
  loadNews();
}

init();