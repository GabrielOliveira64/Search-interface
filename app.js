// ═══════════════════════════════════════
// DEFAULT CONFIG
// ═══════════════════════════════════════
const DEFAULT_CONFIG = {
  theme: 'dark',
  engines: [
    { name: 'Google', url: 'https://www.google.com/search?q=' },
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=' },
    { name: 'GitHub', url: 'https://github.com/search?q=' },
    { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  ],
  categories: [
    {
      name: 'Trabalho',
      sites: [
        { name: 'GitHub', url: 'https://github.com', favicon: 'https://github.com/favicon.ico' },
        { name: 'Stack Overflow', url: 'https://stackoverflow.com', favicon: 'https://stackoverflow.com/favicon.ico' },
        { name: 'Notion', url: 'https://notion.so', favicon: 'https://www.notion.so/front-static/favicon.ico' },
        { name: 'Figma', url: 'https://figma.com', favicon: 'https://static.figma.com/app/icon/1/favicon.png' },
        { name: 'Gmail', url: 'https://mail.google.com', favicon: 'https://mail.google.com/favicon.ico' },
        { name: 'Drive', url: 'https://drive.google.com', favicon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png' },
      ]
    },
    {
      name: 'Entretenimento',
      sites: [
        { name: 'YouTube', url: 'https://youtube.com', favicon: 'https://youtube.com/favicon.ico' },
        { name: 'Netflix', url: 'https://netflix.com', favicon: 'https://assets.nflxext.com/us/ffe/siteui/common/icons/nficon2016.ico' },
        { name: 'Spotify', url: 'https://open.spotify.com', favicon: 'https://open.spotify.com/favicon.ico' },
        { name: 'Twitch', url: 'https://twitch.tv', favicon: 'https://static.twitchsvc.net/assets/uploads/glitch_474x356.png' },
      ]
    },
    {
      name: 'Social',
      sites: [
        { name: 'Twitter/X', url: 'https://x.com', favicon: 'https://abs.twimg.com/favicons/twitter.3.ico' },
        { name: 'Reddit', url: 'https://reddit.com', favicon: 'https://www.reddit.com/favicon.ico' },
        { name: 'Instagram', url: 'https://instagram.com', favicon: 'https://www.instagram.com/favicon.ico' },
        { name: 'LinkedIn', url: 'https://linkedin.com', favicon: 'https://www.linkedin.com/favicon.ico' },
      ]
    },
    {
      name: 'Dev',
      sites: [
        { name: 'MDN', url: 'https://developer.mozilla.org', favicon: 'https://developer.mozilla.org/favicon.ico' },
        { name: 'npm', url: 'https://npmjs.com', favicon: 'https://static-production.npmjs.com/58a19602036db1daee0d7863c94673a4.png' },
        { name: 'CodePen', url: 'https://codepen.io', favicon: 'https://cpwebassets.codepen.io/assets/favicon/favicon-touch-de50acbf5d634ec6791894eba4ba9cf490f709b3d742597c6fc4b734eba37f8.png' },
        { name: 'Vercel', url: 'https://vercel.com', favicon: 'https://assets.vercel.com/image/upload/front/favicon/vercel/32x32.png' },
        { name: 'Replit', url: 'https://replit.com', favicon: 'https://replit.com/public/icons/favicon-196.png' },
      ]
    }
  ],
  feeds: [
    { name: 'G1', url: 'https://g1.globo.com/rss/g1/' },
    { name: 'Tecnoblog', url: 'https://tecnoblog.net/feed/' },
    { name: 'BBC Brasil', url: 'https://www.bbc.com/portuguese/index.xml' },
  ],
  activeEngine: 0,
  activeCat: 0,
  activeFeed: 0
};

// ═══════════════════════════════════════
// STATE
// ═══════════════════════════════════════
let cfg = loadConfig();

function loadConfig() {
  try {
    const saved = localStorage.getItem('portalConfig');
    return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  } catch { return JSON.parse(JSON.stringify(DEFAULT_CONFIG)); }
}

function saveConfig() {
  localStorage.setItem('portalConfig', JSON.stringify(cfg));
}

// ═══════════════════════════════════════
// THEME
// ═══════════════════════════════════════
function setTheme(t) {
  cfg.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  document.getElementById('themeDark').classList.toggle('active', t === 'dark');
  document.getElementById('themeLight').classList.toggle('active', t === 'light');
}

// ═══════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════
const DAYS = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
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
// SEARCH ENGINES
// ═══════════════════════════════════════
function renderEngines() {
  const el = document.getElementById('engineSelector');
  el.innerHTML = cfg.engines.map((e, i) =>
    `<button class="engine-btn ${i === cfg.activeEngine ? 'active' : ''}" onclick="selectEngine(${i})">${e.name}</button>`
  ).join('');
}

function selectEngine(i) {
  cfg.activeEngine = i;
  renderEngines();
}

function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  if (!q) return;
  const engine = cfg.engines[cfg.activeEngine];
  window.open(engine.url + encodeURIComponent(q), '_blank');
}

// ═══════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════
function renderCategories() {
  const tabs = document.getElementById('catTabs');
  const grid = document.getElementById('sitesGrid');

  tabs.innerHTML = cfg.categories.map((c, i) =>
    `<button class="cat-tab ${i === cfg.activeCat ? 'active' : ''}" onclick="selectCat(${i})">${c.name}</button>`
  ).join('');

  const cat = cfg.categories[cfg.activeCat] || cfg.categories[0];
  if (!cat) { grid.innerHTML = ''; return; }

  grid.innerHTML = cat.sites.map(s => `
    <a class="site-card" href="${s.url}" target="_blank">
      <img class="site-favicon" src="${s.favicon}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><text y=%2224%22 font-size=%2224%22>🌐</text></svg>'" alt="${s.name}">
      <div class="site-name">${s.name}</div>
    </a>
  `).join('');
}

function selectCat(i) {
  cfg.activeCat = i;
  renderCategories();
}

// ═══════════════════════════════════════
// NEWS - RSS via proxy CORS
// ═══════════════════════════════════════
const PROXIES = [
  url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  url => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://thingproxy.freeboard.io/fetch/${url}`,
];

async function fetchWithFallback(url) {
  for (let i = 0; i < PROXIES.length; i++) {
    try {
      const proxyUrl = PROXIES[i](url);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) continue;
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (json.contents) return json.contents;
      } catch {}
      if (text.includes('<rss') || text.includes('<feed') || text.includes('<item')) return text;
    } catch {}
  }
  throw new Error('Todos os proxies falharam');
}

function renderNewsTabs() {
  const el = document.getElementById('newsSourceTabs');
  el.innerHTML = cfg.feeds.map((f, i) =>
    `<button class="news-tab ${i === cfg.activeFeed ? 'active' : ''}" onclick="selectFeed(${i})">${f.name}</button>`
  ).join('');
}

function selectFeed(i) {
  cfg.activeFeed = i;
  renderNewsTabs();
  loadNews();
}

async function loadNews() {
  const grid = document.getElementById('newsGrid');
  const btn = document.getElementById('refreshBtn');

  if (!cfg.feeds.length) {
    grid.innerHTML = '<div class="news-empty">Nenhum feed configurado.</div>';
    return;
  }

  grid.innerHTML = '<div class="news-loading"><div class="loader"></div><br>Carregando...</div>';
  btn.classList.add('spinning');
  setTimeout(() => btn.classList.remove('spinning'), 700);

  const feed = cfg.feeds[cfg.activeFeed] || cfg.feeds[0];

  try {
    const xmlText = await fetchWithFallback(feed.url);
    const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
    const items = [...xml.querySelectorAll('item, entry')].slice(0, 12);

    if (!items.length) throw new Error('Sem itens');

    grid.innerHTML = items.map(item => {
      const title = item.querySelector('title')?.textContent || 'Sem título';
      const linkEl = item.querySelector('link');
      const link = linkEl?.getAttribute('href') || linkEl?.textContent || '#';
      const desc = stripHtml(item.querySelector('description, summary, content')?.textContent || '');
      const pubDate = item.querySelector('pubDate, published, updated')?.textContent || '';
      const dateStr = pubDate ? formatDate(new Date(pubDate)) : '';

      return `
        <a class="news-card" href="${link}" target="_blank" rel="noopener">
          <div>
            <div class="news-title">${escHtml(title)}</div>
            ${desc ? `<div class="news-desc">${escHtml(desc)}</div>` : ''}
            <div class="news-meta">
              <span class="news-source-badge">${feed.name}</span>
              ${dateStr ? `<span class="news-date">${dateStr}</span>` : ''}
            </div>
          </div>
          <span class="news-arrow">→</span>
        </a>
      `;
    }).join('');

  } catch (e) {
    grid.innerHTML = `<div class="news-empty">
      ⚠️ Não foi possível carregar o feed.<br><br>
      <small style="line-height:1.8">
        Possíveis causas:<br>
        • O site não tem RSS ou a URL está errada<br>
        • Todos os proxies estão instáveis agora<br>
        • Tente novamente em alguns segundos (↺)
      </small>
    </div>`;
  }
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim();
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(d) {
  if (isNaN(d)) return '';
  const diff = Date.now() - d;
  if (diff < 3600000) return `${Math.floor(diff/60000)}min atrás`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h atrás`;
  return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}

// ═══════════════════════════════════════
// SETTINGS MODAL
// ═══════════════════════════════════════
function openSettings() {
  renderSettingsModal();
  document.getElementById('settingsModal').classList.add('open');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
}

function renderSettingsModal() {
  setTheme(cfg.theme);

  const etl = document.getElementById('engineTagsList');
  etl.innerHTML = cfg.engines.map((e, i) =>
    `<span class="settings-tag">${e.name}<button class="tag-remove" onclick="removeEngine(${i})">✕</button></span>`
  ).join('');

  const ftl = document.getElementById('feedTagsList');
  ftl.innerHTML = cfg.feeds.map((f, i) =>
    `<span class="settings-tag">${f.name}<button class="tag-remove" onclick="removeFeed(${i})">✕</button></span>`
  ).join('');

  renderCatEditor();
}

function renderCatEditor() {
  const el = document.getElementById('catEditor');
  el.innerHTML = cfg.categories.map((cat, ci) => `
    <div style="background:var(--surface2);border-radius:10px;padding:12px;margin-bottom:10px;border:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <span style="font-weight:700;font-size:13px">${cat.name}</span>
        <button class="tag-remove" onclick="removeCat(${ci})">✕ remover categoria</button>
      </div>
      <div class="tags-list">
        ${cat.sites.map((s, si) =>
          `<span class="settings-tag">${s.name}<button class="tag-remove" onclick="removeSite(${ci},${si})">✕</button></span>`
        ).join('')}
      </div>
      <div class="add-input-row">
        <input class="settings-input" id="newSiteName_${ci}" placeholder="Nome do site">
        <input class="settings-input" id="newSiteUrl_${ci}" placeholder="URL (https://...)">
        <button class="btn-add" onclick="addSite(${ci})">+ Add</button>
      </div>
    </div>
  `).join('');
}

function addEngine() {
  const name = document.getElementById('newEngineName').value.trim();
  const url = document.getElementById('newEngineUrl').value.trim();
  if (!name || !url) return;
  cfg.engines.push({ name, url });
  document.getElementById('newEngineName').value = '';
  document.getElementById('newEngineUrl').value = '';
  renderSettingsModal();
}

function removeEngine(i) {
  cfg.engines.splice(i, 1);
  if (cfg.activeEngine >= cfg.engines.length) cfg.activeEngine = 0;
  renderSettingsModal();
}

function addFeed() {
  const name = document.getElementById('newFeedName').value.trim();
  const url = document.getElementById('newFeedUrl').value.trim();
  if (!name || !url) return;
  cfg.feeds.push({ name, url });
  document.getElementById('newFeedName').value = '';
  document.getElementById('newFeedUrl').value = '';
  renderSettingsModal();
}

function removeFeed(i) {
  cfg.feeds.splice(i, 1);
  if (cfg.activeFeed >= cfg.feeds.length) cfg.activeFeed = 0;
  renderSettingsModal();
}

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
  const url = document.getElementById(`newSiteUrl_${ci}`).value.trim();
  if (!name || !url) return;
  const cleanUrl = url.startsWith('http') ? url : 'https://' + url;
  const host = new URL(cleanUrl).hostname;
  cfg.categories[ci].sites.push({
    name,
    url: cleanUrl,
    favicon: `https://${host}/favicon.ico`
  });
  renderCatEditor();
}

function removeSite(ci, si) {
  cfg.categories[ci].sites.splice(si, 1);
  renderCatEditor();
}

function saveSettings() {
  saveConfig();
  closeSettings();
  renderEngines();
  renderCategories();
  renderNewsTabs();
  loadNews();
}

// Fechar modal clicando fora
document.getElementById('settingsModal').addEventListener('click', function(e) {
  if (e.target === this) closeSettings();
});

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════
function init() {
  setTheme(cfg.theme);
  updateClock();
  setInterval(updateClock, 1000);
  renderEngines();
  renderCategories();
  renderNewsTabs();
  loadNews();
}

init();
