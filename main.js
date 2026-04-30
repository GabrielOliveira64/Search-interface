// ═══════════════════════════════════════════════════════════════
// main.js — Processo principal Electron
// Gerencia: janela do painel, bandeja do sistema, servidor HTTP
// ═══════════════════════════════════════════════════════════════
const { app, BrowserWindow, Tray, Menu, nativeImage,
        ipcMain, shell, nativeTheme } = require('electron');
const path   = require('path');
const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const urlMod = require('url');
const { execSync, exec } = require('child_process');

// ── electron-store para preferências do app ──────────────────────
let Store;
try { Store = require('electron-store'); } catch {}
const store = Store ? new Store() : {
  get: (k, d) => d,
  set: () => {},
};

// ── caminhos ────────────────────────────────────────────────────
// Em produção: arquivos estáticos ficam em resources/app.asar (read-only)
// db.json e dados mutáveis ficam ao lado do .exe
const APP_DIR    = app.isPackaged ? path.dirname(process.execPath) : __dirname;
const STATIC_DIR = app.isPackaged ? path.join(process.resourcesPath, 'app.asar') : __dirname;
const DB_FILE = path.join(APP_DIR, 'db.json'); // sempre ao lado do .exe

// ── estado ──────────────────────────────────────────────────────
let tray        = null;
let panelWin    = null;
let httpServer  = null;
let serverPort  = store.get('port', 3000);
let serverRunning = false;
let startTime   = null;
let rssCache    = {};
const CACHE_TTL = 5 * 60 * 1000;

// ════════════════════════════════════════════════════════════════
// DB
// ════════════════════════════════════════════════════════════════
const DEFAULT_CONFIG = {
  theme: 'dark', newsMaxPerFeed: 5,
  newsFilters: [], newsFilterScope: 'title',
  engines: [
    { name: 'Google',     url: 'https://www.google.com/search?q=' },
    { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
    { name: 'YouTube',    url: 'https://www.youtube.com/results?search_query=' },
    { name: 'GitHub',     url: 'https://github.com/search?q=' },
    { name: 'Bing',       url: 'https://www.bing.com/search?q=' },
  ],
  categories: [
    { name: 'Trabalho', sites: [
      { name: 'GitHub',         url: 'https://github.com',        favicon: 'https://github.com/favicon.ico' },
      { name: 'Stack Overflow', url: 'https://stackoverflow.com', favicon: 'https://stackoverflow.com/favicon.ico' },
      { name: 'Notion',         url: 'https://notion.so',         favicon: 'https://www.notion.so/front-static/favicon.ico' },
      { name: 'Gmail',          url: 'https://mail.google.com',   favicon: 'https://mail.google.com/favicon.ico' },
    ]},
    { name: 'Dev', sites: [
      { name: 'MDN',     url: 'https://developer.mozilla.org', favicon: 'https://developer.mozilla.org/favicon.ico' },
      { name: 'npm',     url: 'https://npmjs.com',             favicon: 'https://static-production.npmjs.com/58a19602036db1daee0d7863c94673a4.png' },
    ]},
  ],
  feeds: [
    { name: 'G1',        url: 'https://g1.globo.com/rss/g1/' },
    { name: 'Tecnoblog', url: 'https://tecnoblog.net/feed/' },
    { name: 'BBC Brasil', url: 'https://www.bbc.com/portuguese/index.xml' },
  ],
  activeEngine: 0, activeCat: 0, activeFeed: -1
};

function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {}
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

if (!fs.existsSync(DB_FILE)) writeDB(DEFAULT_CONFIG);

// ════════════════════════════════════════════════════════════════
// RSS CACHE
// ════════════════════════════════════════════════════════════════
function fetchRSS(feedUrl) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(feedUrl);
    const lib = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET', timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PortalRSS/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      }
    };
    const req = lib.request(opts, res => {
      if ([301,302,303,307,308].includes(res.statusCode) && res.headers.location)
        return fetchRSS(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
    req.end();
  });
}

async function getCachedRSS(feedUrl) {
  const now = Date.now();
  const entry = rssCache[feedUrl];
  if (entry?.xml && (now - entry.fetchedAt) < CACHE_TTL) return entry.xml;
  if (entry?.promise) return entry.promise;

  const promise = fetchRSS(feedUrl)
    .then(xml => { rssCache[feedUrl] = { xml, fetchedAt: Date.now(), promise: null }; return xml; })
    .catch(err => { rssCache[feedUrl] = { xml: null, fetchedAt: 0, promise: null }; throw err; });

  rssCache[feedUrl] = { xml: entry?.xml || null, fetchedAt: entry?.fetchedAt || 0, promise };
  return promise;
}

async function warmupFeeds() {
  const db = readDB();
  if (!db.feeds?.length) return;
  log(`Warmup: pré-carregando ${db.feeds.length} feed(s)...`);
  const results = await Promise.allSettled(db.feeds.map(f => getCachedRSS(f.url)));
  results.forEach((r, i) => {
    log(r.status === 'fulfilled' ? `✓ ${db.feeds[i].name}` : `✗ ${db.feeds[i].name}: ${r.reason?.message}`);
  });
  log('Warmup concluído.');
  broadcastStatus();
}

// ════════════════════════════════════════════════════════════════
// SERVIDOR HTTP
// ════════════════════════════════════════════════════════════════
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico':  'image/x-icon',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('JSON inválido')); } });
    req.on('error', reject);
  });
}

function createHTTPServer(port) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(async (req, res) => {
      const parsed   = urlMod.parse(req.url, true);
      const pathname = parsed.pathname;

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

      if (req.method === 'GET' && pathname === '/api/config')
        return sendJSON(res, 200, readDB());

      if (req.method === 'POST' && pathname === '/api/config') {
        try {
          const body = await readBody(req);
          if (!body.feeds || !body.categories || !body.engines) throw new Error('Config inválida');
          writeDB(body);
          setTimeout(warmupFeeds, 100);
          return sendJSON(res, 200, { ok: true });
        } catch (e) { return sendJSON(res, 400, { error: e.message }); }
      }

      if (req.method === 'GET' && pathname === '/api/rss') {
        const feedUrl = parsed.query.url;
        if (!feedUrl) return sendJSON(res, 400, { error: 'url obrigatória' });
        try {
          const xml = await getCachedRSS(feedUrl);
          res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' });
          return res.end(xml);
        } catch (e) { return sendJSON(res, 502, { error: e.message }); }
      }

      // Arquivos estáticos
      let filePath = pathname === '/' ? '/index.html' : pathname;
      filePath = path.join(STATIC_DIR, filePath);
      if (!filePath.startsWith(STATIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }

      fs.readFile(filePath, (err, data) => {
        if (err) { res.writeHead(404); res.end('Not found'); return; }
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });

    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => resolve(srv));
  });
}

async function startServer() {
  if (serverRunning) return;
  try {
    httpServer = await createHTTPServer(serverPort);
    serverRunning = true;
    startTime = new Date();
    rssCache  = {}; // limpa cache ao reiniciar
    log(`Servidor iniciado em http://localhost:${serverPort}`);
    updateTrayMenu();
    broadcastStatus();
    warmupFeeds();
  } catch (e) {
    log(`Erro ao iniciar servidor: ${e.message}`);
    broadcastStatus();
  }
}

async function stopServer() {
  if (!serverRunning || !httpServer) return;
  serverRunning = false;
  updateTrayMenu();
  broadcastStatus();

  await new Promise(resolve => {
    const timeout = setTimeout(() => {
      httpServer = null;
      startTime  = null;
      log('Servidor parado (timeout forçado).');
      resolve();
    }, 3000);

    httpServer.close(() => {
      clearTimeout(timeout);
      httpServer = null;
      startTime  = null;
      log('Servidor parado.');
      resolve();
    });

    // Destrói conexões keep-alive que impedem o close de completar
    httpServer.closeAllConnections?.();
  });

  // Delay de 2s antes de liberar o botão para evitar race condition na porta
  await new Promise(r => setTimeout(r, 2000));
  broadcastStatus();
}

// ════════════════════════════════════════════════════════════════
// LOGS
// ════════════════════════════════════════════════════════════════
const logLines = [];
function log(msg) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logLines.push(line);
  if (logLines.length > 200) logLines.shift();
  console.log(line);
  if (panelWin && !panelWin.isDestroyed())
    panelWin.webContents.send('log', line);
}

// ════════════════════════════════════════════════════════════════
// STATUS BROADCAST
// ════════════════════════════════════════════════════════════════
function broadcastStatus() {
  if (!panelWin || panelWin.isDestroyed()) return;
  panelWin.webContents.send('status', getStatus());
}

function getStatus() {
  const uptime = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const cachedFeeds = Object.values(rssCache).filter(e => e.xml).length;
  return {
    running: serverRunning,
    port: serverPort,
    url: `http://localhost:${serverPort}`,
    uptime,
    cachedFeeds,
    totalFeeds: readDB().feeds?.length || 0,
    autostart: store.get('autostart', false),
  };
}

// ════════════════════════════════════════════════════════════════
// AUTOSTART (Windows Task Scheduler)
// ════════════════════════════════════════════════════════════════
function enableAutostart() {
  try {
    const taskName = 'PortalApp';
    let trValue;

    if (app.isPackaged) {
      // Empacotado: só o .exe, sem argumentos
      trValue = `"${process.execPath}"`;
    } else {
      // Dev: electron + main.js — o schtasks exige que tudo fique numa
      // única string delimitada por aspas externas, com aspas internas escapadas
      const electron = process.execPath;
      const mainJs   = path.join(__dirname, 'main.js');
      // Formato exigido pelo schtasks: '"exe" "arg"' → /tr "\"exe\" \"arg\""
      trValue = `"\\"${electron}\\" \\"${mainJs}\\""`;
    }

    const cmd = `schtasks /create /tn "${taskName}" /tr ${trValue} /sc onlogon /rl limited /f`;
    execSync(cmd, { windowsHide: true, stdio: 'pipe' });
    store.set('autostart', true);
    log('Autostart ativado (Task Scheduler).');
    return true;
  } catch (e) {
    // Extrai só a primeira linha do erro para o log ficar limpo
    const msg = e.message.split('\n').find(l => l.trim()) || e.message;
    log(`Erro ao ativar autostart: ${msg}`);
    return false;
  }
}

function disableAutostart() {
  try {
    execSync('schtasks /delete /tn "PortalApp" /f', { windowsHide: true });
    store.set('autostart', false);
    log('Autostart desativado.');
    return true;
  } catch (e) {
    log(`Erro ao desativar autostart: ${e.message}`);
    return false;
  }
}

// ════════════════════════════════════════════════════════════════
// TRAY
// ════════════════════════════════════════════════════════════════
function createTrayIcon() {
  // Busca icon.png em múltiplos locais (cobre dev, produção e asar)
  const candidates = [
    path.join(__dirname, 'icon.png'),
    path.join(APP_DIR, 'icon.png'),
    path.join(process.resourcesPath || '', 'icon.png'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) return img.resize({ width: 16, height: 16 });
      }
    } catch {}
  }
  // Fallback: quadrado roxo 16x16 gerado inline
  return nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkIBIwEqmHgWoGHP7/Z2BgYGAk0hCqccGogVQ3BKrxAtV4gepxTrQgAOuMCxGbXKT8AAAAAElFTkSuQmCC'
  );
}

function updateTrayMenu() {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    { label: serverRunning ? '🟢 Servidor rodando' : '🔴 Servidor parado', enabled: false },
    { label: serverRunning ? `http://localhost:${serverPort}` : '—', enabled: false },
    { type: 'separator' },
    { label: '📂 Abrir Portal no Browser', click: () => { if (serverRunning) shell.openExternal(`http://localhost:${serverPort}`); } },
    { label: '🖥️ Abrir Painel de Controle', click: showPanel },
    { type: 'separator' },
    { label: serverRunning ? '⏹ Parar Servidor' : '▶ Iniciar Servidor',
      click: () => serverRunning ? stopServer() : startServer() },
    { type: 'separator' },
    { label: '✕ Sair', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.setToolTip(serverRunning ? `Home • http://localhost:${serverPort}` : 'Home • Servidor parado');
}

// ════════════════════════════════════════════════════════════════
// JANELA DO PAINEL
// ════════════════════════════════════════════════════════════════
function showPanel() {
  if (panelWin && !panelWin.isDestroyed()) {
    panelWin.show();
    panelWin.focus();
    return;
  }

  panelWin = new BrowserWindow({
    width: 480, height: 620,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'icon.png'),
  });

  panelWin.loadFile(app.isPackaged ? path.join(process.resourcesPath, 'app.asar', 'panel.html') : path.join(__dirname, 'panel.html'));

  // Envia logs anteriores quando a janela carrega
  panelWin.webContents.on('did-finish-load', () => {
    logLines.forEach(l => panelWin.webContents.send('log', l));
    broadcastStatus();
  });

  // Minimiza para tray ao fechar, não encerra o app
  panelWin.on('close', e => {
    if (!app.isQuiting) {
      e.preventDefault();
      panelWin.hide();
    }
  });
}

// ════════════════════════════════════════════════════════════════
// IPC — comunicação painel ↔ main
// ════════════════════════════════════════════════════════════════
ipcMain.handle('get-status', () => getStatus());
ipcMain.handle('get-logs',   () => logLines);

ipcMain.handle('start-server', async () => {
  await startServer();
  return getStatus();
});

ipcMain.handle('stop-server', async () => {
  await stopServer();
  return getStatus();
});

ipcMain.handle('set-port', async (_, port) => {
  const p = parseInt(port);
  if (isNaN(p) || p < 1024 || p > 65535) return { error: 'Porta inválida (1024–65535)' };
  if (serverRunning) await stopServer();
  serverPort = p;
  store.set('port', p);
  log(`Porta alterada para ${p}.`);
  return getStatus();
});

ipcMain.handle('set-autostart', async (_, enable) => {
  const ok = enable ? enableAutostart() : disableAutostart();
  broadcastStatus();
  return { ok };
});

ipcMain.handle('open-portal', () => {
  if (serverRunning) shell.openExternal(`http://localhost:${serverPort}`);
});

ipcMain.handle('open-folder', () => {
  shell.openPath(APP_DIR);
});

ipcMain.handle('minimize-panel', () => {
  if (panelWin) panelWin.hide();
});

ipcMain.handle('close-app', () => {
  app.isQuiting = true;
  app.quit();
});

// Uptime tick — a cada 1s atualiza o painel
setInterval(() => {
  if (serverRunning && panelWin && !panelWin.isDestroyed())
    panelWin.webContents.send('tick', Math.floor((Date.now() - startTime) / 1000));
}, 1000);

// ════════════════════════════════════════════════════════════════
// APP LIFECYCLE
// ════════════════════════════════════════════════════════════════
app.whenReady().then(async () => {
  app.setAppUserModelId('com.home.app');

  // Cria ícone na bandeja
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Home');
  tray.on('double-click', showPanel);
  updateTrayMenu();

  // Abre painel na primeira execução
  showPanel();

  // Inicia servidor automaticamente
  await startServer();
});

app.on('window-all-closed', e => {
  // Não encerra o app ao fechar todas as janelas — fica na bandeja
  e.preventDefault();
});

app.on('before-quit', async () => {
  app.isQuiting = true;
  await stopServer();
});
