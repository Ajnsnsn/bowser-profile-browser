import { app, BrowserWindow, dialog, ipcMain, Menu, screen, session, shell, WebContentsView } from 'electron';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProfileStore, cleanUrl } from './profile-store.js';
import { UserAgentStore } from './user-agent-store.js';
import {
  FINGERPRINT_PRESETS,
  buildFingerprintInjection,
  buildUserAgentMetadata,
  getFingerprintPreset,
  resolveUserAgent,
} from './fingerprint.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUI_FILE = path.join(__dirname, '..', 'src', 'gui', 'index.html');
const PRELOAD_FILE = path.join(__dirname, 'preload.cjs');
const BROWSER_SHELL_FILE = path.join(__dirname, '..', 'src', 'gui', 'browser-shell.html');
const BROWSER_PRELOAD_FILE = path.join(__dirname, 'browser-preload.cjs');
const BROWSER_TOOLBAR_HEIGHT = 56;
const isSmokeTest = process.argv.includes('--smoke-test') || app.commandLine.hasSwitch('smoke-test');
const isScreenshotTest = process.argv.includes('--screenshot-test') || app.commandLine.hasSwitch('screenshot-test');
const isIntegrationTest = process.argv.includes('--integration-test') || app.commandLine.hasSwitch('integration-test');
const isTestMode = isSmokeTest || isScreenshotTest || isIntegrationTest;

if (isTestMode) {
  app.setPath('userData', path.join(app.getPath('temp'), `bowser-profile-browser-test-${process.pid}`));
}

let dashboard = null;
let profileStore = null;
let userAgentStore = null;
let quitting = false;
const browserWindows = new Map();
const webContentsProfiles = new Map();
const browserShellProfiles = new Map();

app.setName('Bowser Profile Browser');

function partitionFor(id) {
  return `persist:bowser-${String(id).replace(/[^a-zA-Z0-9-]/g, '')}`;
}

function isWebUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function currentState() {
  return {
    profiles: profileStore?.list() || [],
    running: [...browserWindows.keys()],
    dataPath: app.getPath('userData'),
    version: app.getVersion(),
    fingerprintPresets: Object.fromEntries(
      Object.entries(FINGERPRINT_PRESETS).map(([id, preset]) => [id, {
        label: preset.label,
        group: preset.group,
        width: preset.width,
        height: preset.height,
        platform: preset.platform,
        hardwareConcurrency: preset.hardwareConcurrency,
        deviceMemory: preset.deviceMemory,
        gpuRenderer: preset.gpuRenderer,
      }])
    ),
    userAgents: userAgentStore?.list() || [],
  };
}

function prepareProfileForSave(input = {}) {
  const existing = input.id ? profileStore.get(String(input.id)) : null;
  const preset = Object.hasOwn(FINGERPRINT_PRESETS, input.fingerprint?.preset)
    ? input.fingerprint.preset
    : existing?.fingerprint?.preset || 'windows_laptop';
  const keepExisting = existing?.fingerprint?.preset === preset && existing.fingerprint?.userAgent;
  const generatedUserAgent = keepExisting || resolveUserAgent(
    { userAgent: '', fingerprint: { preset, userAgent: '' } },
    session.defaultSession.getUserAgent()
  );
  return {
    ...input,
    fingerprint: {
      ...input.fingerprint,
      preset,
      userAgent: generatedUserAgent,
    },
  };
}

function broadcastState() {
  if (dashboard && !dashboard.isDestroyed()) {
    dashboard.webContents.send('state:changed', currentState());
  }
}

function assertDashboard(event) {
  if (!dashboard || event.sender.id !== dashboard.webContents.id) {
    throw new Error('Permintaan tidak diizinkan');
  }
}

function createDashboard() {
  dashboard = new BrowserWindow({
    width: 1260,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#0b0f18',
    title: 'Bowser Profile Browser',
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_FILE,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  dashboard.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  dashboard.webContents.on('will-navigate', (event) => event.preventDefault());
  dashboard.loadFile(GUI_FILE);
  dashboard.once('ready-to-show', () => {
    if (!isTestMode) dashboard.show();
  });
  dashboard.on('closed', () => {
    dashboard = null;
    if (!quitting) app.quit();
  });

  if (isTestMode) {
    let finished = false;
    const timer = setTimeout(() => {
      if (!finished) {
        console.error('SMOKE_FAIL: GUI tidak selesai dimuat');
        app.exit(1);
      }
    }, 12_000);
    dashboard.webContents.once('did-finish-load', () => {
      finished = true;
      clearTimeout(timer);
      setTimeout(async () => {
        try {
          if (isIntegrationTest) {
            await runIntegrationTest();
            console.log('INTEGRATION_OK: simpan, jalankan, dan tutup profil berhasil');
          } else if (isScreenshotTest) {
            const visualProfile = await profileStore.save({
              name: 'Riset Jakarta',
              startUrl: 'https://example.com',
              locale: 'id-ID',
              timezone: 'Asia/Jakarta',
              width: 1366,
              height: 768,
              proxy: {},
            });
            broadcastState();
            await new Promise((resolve) => setTimeout(resolve, 250));
            const image = await dashboard.webContents.capturePage();
            const screenshotPath = path.join(process.cwd(), 'dashboard-smoke.png');
            await fs.writeFile(screenshotPath, image.toPNG());
            await dashboard.webContents.executeJavaScript(
              `document.querySelector('[data-action="edit"]')?.click()`
            );
            await new Promise((resolve) => setTimeout(resolve, 200));
            const presetOptionCount = await dashboard.webContents.executeJavaScript(
              `document.querySelector('#fingerprint-preset')?.options.length`
            );
            if (presetOptionCount !== 100) {
              throw new Error(`Selector GUI hanya memuat ${presetOptionCount} preset`);
            }
            const modalImage = await dashboard.webContents.capturePage();
            const modalPath = path.join(process.cwd(), 'dashboard-modal-smoke.png');
            await fs.writeFile(modalPath, modalImage.toPNG());
            await dashboard.webContents.executeJavaScript(`document.querySelector('#profile-dialog')?.close()`);
            await launchProfile(visualProfile.id);
            await new Promise((resolve) => setTimeout(resolve, 350));
            const browserRecord = browserWindows.get(visualProfile.id);
            const browserImage = await browserRecord.window.capturePage();
            const browserPath = path.join(process.cwd(), 'browser-toolbar-smoke.png');
            await fs.writeFile(browserPath, browserImage.toPNG());
            await stopProfile(visualProfile.id);
            console.log(`VISUAL_OK: ${screenshotPath} | ${modalPath} | ${browserPath}`);
          } else {
            console.log('SMOKE_OK: GUI berhasil dimuat');
          }
          app.exit(0);
        } catch (error) {
          console.error(`TEST_FAIL: ${error.stack || error.message}`);
          app.exit(1);
        }
      }, isScreenshotTest ? 700 : 200);
    });
    dashboard.webContents.once('did-fail-load', (_event, code, description) => {
      finished = true;
      clearTimeout(timer);
      console.error(`SMOKE_FAIL: ${code} ${description}`);
      app.exit(1);
    });
  }
}

async function applyProfileEmulation(contents, profile, userAgent) {
  const preset = getFingerprintPreset(profile.fingerprint?.preset);
  try {
    contents.debugger.attach('1.3');
    await contents.debugger.sendCommand('Page.enable');
    await contents.debugger.sendCommand('Network.enable');
    const metadata = buildUserAgentMetadata(userAgent, profile.fingerprint?.preset);
    await contents.debugger.sendCommand('Network.setUserAgentOverride', {
      userAgent,
      acceptLanguage: `${profile.locale},${profile.locale.split('-')[0]};q=0.9,en;q=0.8`,
      platform: preset.platform,
      ...(metadata ? { userAgentMetadata: metadata } : {}),
    });
    await contents.debugger.sendCommand('Emulation.setTimezoneOverride', {
      timezoneId: profile.timezone,
    });
    await contents.debugger.sendCommand('Emulation.setLocaleOverride', {
      locale: profile.locale,
    });
    await contents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: profile.width,
      height: profile.height,
      screenWidth: profile.width,
      screenHeight: profile.height,
      deviceScaleFactor: preset.pixelRatio,
      mobile: preset.mobile,
    });
    await contents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
      enabled: preset.maxTouchPoints > 0,
      ...(preset.maxTouchPoints > 0 ? { maxTouchPoints: preset.maxTouchPoints } : {}),
    });
    await contents.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
      source: buildFingerprintInjection(profile),
    });
    return true;
  } catch (error) {
    console.warn(`Emulasi sebagian tidak tersedia: ${error.message}`);
    return false;
  }
}

async function configureProxy(profileSession, profile) {
  if (!profile.proxy.url) {
    await profileSession.setProxy({ mode: 'direct' });
    return;
  }
  const proxy = new URL(profile.proxy.url);
  const rules = `${proxy.protocol}//${proxy.hostname}:${proxy.port}`;
  await profileSession.setProxy({
    mode: 'fixed_servers',
    proxyRules: rules,
    proxyBypassRules: '<local>',
  });
}

function layoutBrowserView(record) {
  if (!record || record.window.isDestroyed()) return;
  const [width, height] = record.window.getContentSize();
  record.view.setBounds({
    x: 0,
    y: BROWSER_TOOLBAR_HEIGHT,
    width,
    height: Math.max(0, height - BROWSER_TOOLBAR_HEIGHT),
  });
}

function getBrowserState(record) {
  const contents = record.view.webContents;
  return {
    profileName: record.profile.name,
    url: contents.isDestroyed() ? '' : contents.getURL(),
    title: contents.isDestroyed() ? '' : contents.getTitle(),
    canGoBack: !contents.isDestroyed() && contents.navigationHistory.canGoBack(),
    canGoForward: !contents.isDestroyed() && contents.navigationHistory.canGoForward(),
    loading: !contents.isDestroyed() && contents.isLoading(),
  };
}

function sendBrowserState(record) {
  if (!record?.window.isDestroyed()) {
    record.window.webContents.send('browser:state', getBrowserState(record));
  }
}

function normalizeBrowserInput(value) {
  const input = String(value || '').trim();
  if (!input) throw new Error('Alamat tidak boleh kosong');
  const looksLikeHost = input.includes('.') ||
    /^localhost(?::\d+)?(?:\/|$)/i.test(input) ||
    /^\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?(?:\/|$)/.test(input) ||
    /^\[[\da-f:]+\](?::\d+)?(?:\/|$)/i.test(input);
  if (/\s/.test(input) || (!looksLikeHost && !/^https?:\/\//i.test(input))) {
    return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
  }
  return cleanUrl(input);
}

async function navigateBrowser(record, value) {
  const url = normalizeBrowserInput(value);
  await record.view.webContents.loadURL(url);
}

function reloadOrStop(record) {
  const contents = record.view.webContents;
  if (contents.isLoading()) contents.stop();
  else contents.reload();
}

function handleBrowserShortcut(record, event, input) {
  if (input.type !== 'keyDown') return;
  const key = String(input.key).toLowerCase();
  const control = input.control || input.meta;
  const history = record.view.webContents.navigationHistory;
  if (input.alt && key === 'left' && history.canGoBack()) {
    event.preventDefault();
    history.goBack();
  } else if (input.alt && key === 'right' && history.canGoForward()) {
    event.preventDefault();
    history.goForward();
  } else if (control && key === 'l') {
    event.preventDefault();
    record.window.webContents.send('browser:focus-location');
  } else if ((control && key === 'r') || key === 'f5') {
    event.preventDefault();
    if (control && input.shift) record.view.webContents.reloadIgnoringCache();
    else record.view.webContents.reload();
  } else if (key === 'escape' && record.view.webContents.isLoading()) {
    event.preventDefault();
    record.view.webContents.stop();
  } else if (control && key === 'w') {
    event.preventDefault();
    record.window.close();
  }
}

async function launchProfile(id) {
  const existing = browserWindows.get(id);
  if (existing && !existing.window.isDestroyed()) {
    existing.window.show();
    existing.window.focus();
    return;
  }

  const profile = profileStore.getRuntime(id);
  if (!profile) throw new Error('Profil tidak ditemukan');

  const display = screen.getPrimaryDisplay().workAreaSize;
  const width = Math.min(display.width, Math.max(760, profile.width));
  const height = Math.min(display.height, Math.max(616, profile.height + BROWSER_TOOLBAR_HEIGHT));
  const partition = partitionFor(profile.id);
  const profileSession = session.fromPartition(partition);
  await configureProxy(profileSession, profile);

  const win = new BrowserWindow({
    width,
    height,
    minWidth: 640,
    minHeight: 536,
    show: false,
    title: profile.name,
    autoHideMenuBar: true,
    backgroundColor: '#101620',
    webPreferences: {
      preload: BROWSER_PRELOAD_FILE,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });

  const view = new WebContentsView({
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
    },
  });
  view.setBackgroundColor('#ffffff');
  win.contentView.addChildView(view);

  const record = { window: win, view, profile, startUrl: cleanUrl(profile.startUrl) };
  const pageContents = view.webContents;
  const pageContentsId = pageContents.id;
  const shellContentsId = win.webContents.id;
  browserWindows.set(id, record);
  webContentsProfiles.set(pageContentsId, id);
  browserShellProfiles.set(shellContentsId, id);
  layoutBrowserView(record);
  broadcastState();

  win.on('resize', () => layoutBrowserView(record));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.on('before-input-event', (event, input) => handleBrowserShortcut(record, event, input));
  pageContents.on('before-input-event', (event, input) => handleBrowserShortcut(record, event, input));

  pageContents.setWindowOpenHandler(({ url }) => {
    if (isWebUrl(url)) setTimeout(() => navigateBrowser(record, url).catch(() => {}), 0);
    return { action: 'deny' };
  });
  pageContents.on('will-navigate', (event, url) => {
    if (url !== 'about:blank' && !isWebUrl(url)) {
      event.preventDefault();
      if (/^(mailto|tel):/i.test(url)) shell.openExternal(url).catch(() => {});
    }
  });

  for (const eventName of ['did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page']) {
    pageContents.on(eventName, () => sendBrowserState(record));
  }
  pageContents.on('page-title-updated', (_event, title) => {
    win.setTitle(title ? `${title} — ${profile.name}` : profile.name);
    sendBrowserState(record);
  });
  win.webContents.on('did-finish-load', () => sendBrowserState(record));
  win.on('closed', () => {
    webContentsProfiles.delete(pageContentsId);
    browserShellProfiles.delete(shellContentsId);
    browserWindows.delete(id);
    if (!pageContents.isDestroyed()) pageContents.close();
    broadcastState();
  });

  const userAgent = resolveUserAgent(profile, profileSession.getUserAgent());
  pageContents.setUserAgent(userAgent, profile.locale);
  await win.loadFile(BROWSER_SHELL_FILE);
  await pageContents.loadURL('about:blank');
  await withTimeout(
    applyProfileEmulation(pageContents, profile, userAgent),
    3_000,
    'Penerapan emulasi profil'
  ).catch((error) => {
    console.warn(error.message);
    return false;
  });
  try {
    await pageContents.loadURL(record.startUrl);
  } finally {
    if (!win.isDestroyed()) {
      sendBrowserState(record);
      win.show();
      pageContents.focus();
    }
  }
}

async function stopProfile(id) {
  const record = browserWindows.get(id);
  if (record && !record.window.isDestroyed()) record.window.close();
}

function withTimeout(promise, milliseconds, label) {
  let timer;
  const timeout = new Promise((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} melewati batas ${milliseconds}ms`)), milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function runIntegrationTest() {
  if (Object.keys(FINGERPRINT_PRESETS).length !== 100) {
    throw new Error(`Jumlah preset harus 100, aktual ${Object.keys(FINGERPRINT_PRESETS).length}`);
  }
  let pageOneLoads = 0;
  const server = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    if (request.url?.startsWith('/two')) {
      response.end('<!doctype html><html><body>Bowser page two</body></html>');
    } else {
      pageOneLoads += 1;
      response.end('<!doctype html><html><body>Bowser integration ready</body></html>');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    const userAgentFile = path.join(app.getPath('userData'), 'integration-user-agents.txt');
    await fs.mkdir(path.dirname(userAgentFile), { recursive: true });
    const importedUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36';
    await fs.writeFile(userAgentFile, `${importedUserAgent}\n${importedUserAgent}\n`, 'utf8');
    const imported = await userAgentStore.importFile(userAgentFile);
    if (imported.added !== 1 || userAgentStore.list()[0]?.value !== importedUserAgent) {
      throw new Error('Import file User-Agent gagal');
    }
    const csvFile = path.join(app.getPath('userData'), 'integration-user-agents.csv');
    const csvUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0';
    await fs.writeFile(csvFile, `name,user_agent\nFirefox Test,"${csvUserAgent}"\n`, 'utf8');
    const csvImported = await userAgentStore.importFile(csvFile);
    const jsonFile = path.join(app.getPath('userData'), 'integration-user-agents.json');
    const jsonUserAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
    await fs.writeFile(jsonFile, JSON.stringify([{ name: 'Safari Test', userAgent: jsonUserAgent }]), 'utf8');
    const jsonImported = await userAgentStore.importFile(jsonFile);
    if (csvImported.added !== 1 || jsonImported.added !== 1 || userAgentStore.list().length !== 3) {
      throw new Error('Parser CSV/JSON User-Agent gagal');
    }

    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const input = {
      name: 'Integration Test',
      startUrl: `${baseUrl}/one`,
      locale: 'id-ID',
      timezone: 'Asia/Jakarta',
      width: 1024,
      height: 768,
      userAgent: importedUserAgent,
      fingerprint: { preset: 'windows_desktop', seed: 'integration-test-seed' },
      proxy: {},
    };
    const saved = await withTimeout(
      dashboard.webContents.executeJavaScript(`window.bowser.saveProfile(${JSON.stringify(input)})`),
      5_000,
      'Simpan profil via IPC'
    );
    if (!saved?.id || !profileStore.get(saved.id)) {
      throw new Error('Profil tidak tersimpan melalui IPC');
    }
    const stablePresetUserAgent = profileStore.get(saved.id).fingerprint?.userAgent;
    if (!stablePresetUserAgent) {
      throw new Error('User-Agent preset tidak tersimpan di profil');
    }

    await withTimeout(launchProfile(saved.id), 10_000, 'Peluncuran profil');
    const profileRecord = browserWindows.get(saved.id);
    if (!profileRecord || profileRecord.window.isDestroyed()) {
      throw new Error('Jendela profil tidak terbuka');
    }
    const pageState = await withTimeout(
      profileRecord.view.webContents.executeJavaScript(`(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 20;
        const context = canvas.getContext('2d');
        context.fillStyle = '#7957ff';
        context.fillRect(0, 0, 40, 20);
        return {
          text: document.body.textContent,
          platform: navigator.platform,
          cores: navigator.hardwareConcurrency,
          memory: navigator.deviceMemory,
          userAgent: navigator.userAgent,
          canvasA: canvas.toDataURL(),
          canvasB: canvas.toDataURL(),
        };
      })()`),
      5_000,
      'Verifikasi halaman profil'
    );
    if (!pageState.text.includes('Bowser integration ready')) {
      throw new Error('Konten browser profil tidak termuat');
    }
    if (pageState.platform !== 'Win32' || pageState.cores !== 16 || pageState.memory !== 16) {
      throw new Error(`Override hardware fingerprint tidak diterapkan: ${JSON.stringify({
        platform: pageState.platform,
        cores: pageState.cores,
        memory: pageState.memory,
      })}`);
    }
    if (pageState.userAgent !== importedUserAgent) {
      throw new Error('User-Agent hasil import tidak diterapkan');
    }
    if (pageState.canvasA !== pageState.canvasB) {
      throw new Error('Canvas fingerprint tidak konsisten dalam satu profil');
    }

    await profileRecord.window.webContents.executeJavaScript(
      `window.browserControls.navigate(${JSON.stringify(`${baseUrl}/two`)})`
    );
    const pageTwoText = await profileRecord.view.webContents.executeJavaScript('document.body.textContent');
    if (!pageTwoText.includes('Bowser page two') || !profileRecord.view.webContents.navigationHistory.canGoBack()) {
      throw new Error('Navigasi URL atau tombol Back tidak siap');
    }
    const backFinished = new Promise((resolve) => profileRecord.view.webContents.once('did-stop-loading', resolve));
    await profileRecord.window.webContents.executeJavaScript('window.browserControls.back()');
    await withTimeout(backFinished, 3_000, 'Navigasi Back');
    const pageOneText = await profileRecord.view.webContents.executeJavaScript('document.body.textContent');
    if (!pageOneText.includes('Bowser integration ready')) {
      throw new Error('Tombol Back gagal kembali ke halaman sebelumnya');
    }
    const reloadFinished = new Promise((resolve) => profileRecord.view.webContents.once('did-stop-loading', resolve));
    await profileRecord.window.webContents.executeJavaScript('window.browserControls.reloadOrStop()');
    await withTimeout(reloadFinished, 3_000, 'Navigasi Reload');
    if (pageOneLoads < 2) {
      throw new Error('Tombol Reload tidak memuat ulang halaman');
    }

    const firstWindowClosed = new Promise((resolve) => profileRecord.window.once('closed', resolve));
    await stopProfile(saved.id);
    await withTimeout(firstWindowClosed, 3_000, 'Penutupan profil pertama');

    await dashboard.webContents.executeJavaScript(`window.bowser.saveProfile(${JSON.stringify({
      ...input,
      id: saved.id,
      userAgent: '',
      fingerprint: { preset: 'windows_desktop', seed: 'integration-test-seed-changed' },
    })})`);
    await withTimeout(launchProfile(saved.id), 10_000, 'Peluncuran fingerprint baru');
    const changedRecord = browserWindows.get(saved.id);
    const changedState = await changedRecord.view.webContents.executeJavaScript(`(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 20;
      const context = canvas.getContext('2d');
      context.fillStyle = '#7957ff';
      context.fillRect(0, 0, 40, 20);
      return { canvas: canvas.toDataURL(), userAgent: navigator.userAgent };
    })()`);
    if (changedState.canvas === pageState.canvasA) {
      throw new Error('Canvas fingerprint tidak berubah setelah seed diganti');
    }
    if (changedState.userAgent !== stablePresetUserAgent) {
      throw new Error('User-Agent preset berubah saat profil dibuka kembali');
    }
    const changedWindowClosed = new Promise((resolve) => changedRecord.window.once('closed', resolve));
    await stopProfile(saved.id);
    await withTimeout(changedWindowClosed, 3_000, 'Penutupan profil kedua');

    const formRegression = await dashboard.webContents.executeJavaScript(`(async () => {
      window.confirm = () => true;
      const deleteButton = document.querySelector('[data-action="delete"][data-id="${saved.id}"]');
      if (!deleteButton) return { error: 'Tombol hapus tidak ditemukan' };
      deleteButton.click();
      for (let attempt = 0; attempt < 60; attempt += 1) {
        if (!document.querySelector('[data-id="${saved.id}"]')) break;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (document.querySelector('[data-id="${saved.id}"]')) return { error: 'Profil tidak terhapus dari GUI' };
      document.querySelector('#create-profile').click();
      await new Promise((resolve) => setTimeout(resolve, 80));
      const dialog = document.querySelector('#profile-dialog');
      const name = document.querySelector('#profile-name');
      const userAgent = document.querySelector('#user-agent');
      const preset = document.querySelector('#fingerprint-preset');
      name.focus();
      name.value = 'Profil Setelah Hapus';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      userAgent.value = 'Mozilla/5.0 Regression Test/1.0';
      userAgent.dispatchEvent(new Event('input', { bubbles: true }));
      preset.value = 'macbook_air_m3_1';
      preset.dispatchEvent(new Event('change', { bubbles: true }));
      const result = {
        open: dialog.open,
        nameDisabled: name.disabled,
        userAgentDisabled: userAgent.disabled,
        presetDisabled: preset.disabled,
        name: name.value,
        userAgent: userAgent.value,
        preset: preset.value,
        optionCount: preset.options.length,
      };
      dialog.close();
      return result;
    })()`);
    if (formRegression.error || !formRegression.open || formRegression.nameDisabled ||
        formRegression.userAgentDisabled || formRegression.presetDisabled ||
        formRegression.name !== 'Profil Setelah Hapus' ||
        formRegression.userAgent !== 'Mozilla/5.0 Regression Test/1.0' ||
        formRegression.preset !== 'macbook_air_m3_1' || formRegression.optionCount !== 100) {
      throw new Error(`Regresi form setelah hapus profil: ${JSON.stringify(formRegression)}`);
    }
  } finally {
    await userAgentStore.clear().catch(() => {});
    await new Promise((resolve) => server.close(resolve));
  }
}

function getBrowserRecord(event) {
  const profileId = browserShellProfiles.get(event.sender.id);
  const record = profileId ? browserWindows.get(profileId) : null;
  if (!record || record.window.webContents.id !== event.sender.id) {
    throw new Error('Kontrol browser tidak diizinkan');
  }
  return record;
}

function registerIpc() {
  ipcMain.handle('app:get-state', (event) => {
    assertDashboard(event);
    return currentState();
  });
  ipcMain.handle('app:open-data-folder', async (event) => {
    assertDashboard(event);
    const result = await shell.openPath(app.getPath('userData'));
    if (result) throw new Error(result);
  });
  ipcMain.handle('user-agents:import', async (event) => {
    assertDashboard(event);
    const selection = await dialog.showOpenDialog(dashboard, {
      title: 'Pilih file User-Agent',
      properties: ['openFile'],
      filters: [
        { name: 'Daftar User-Agent', extensions: ['txt', 'csv', 'json', 'jsonl'] },
        { name: 'Semua file', extensions: ['*'] },
      ],
    });
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true };
    const result = await userAgentStore.importFile(selection.filePaths[0]);
    broadcastState();
    return { ...result, canceled: false };
  });
  ipcMain.handle('user-agents:clear', async (event) => {
    assertDashboard(event);
    await userAgentStore.clear();
    broadcastState();
  });
  ipcMain.handle('profile:save', async (event, input) => {
    assertDashboard(event);
    const result = await profileStore.save(prepareProfileForSave(input));
    broadcastState();
    return result;
  });
  ipcMain.handle('profile:duplicate', async (event, id) => {
    assertDashboard(event);
    const result = await profileStore.duplicate(String(id));
    broadcastState();
    return result;
  });
  ipcMain.handle('profile:delete', async (event, id) => {
    assertDashboard(event);
    const profileId = String(id);
    await stopProfile(profileId);
    const profileSession = session.fromPartition(partitionFor(profileId));
    await profileSession.clearStorageData();
    await profileSession.clearCache();
    await profileStore.remove(profileId);
    broadcastState();
  });
  ipcMain.handle('profile:launch', async (event, id) => {
    assertDashboard(event);
    await launchProfile(String(id));
  });
  ipcMain.handle('profile:stop', async (event, id) => {
    assertDashboard(event);
    await stopProfile(String(id));
  });
  ipcMain.handle('browser:back', (event) => {
    const record = getBrowserRecord(event);
    const history = record.view.webContents.navigationHistory;
    if (history.canGoBack()) history.goBack();
  });
  ipcMain.handle('browser:forward', (event) => {
    const record = getBrowserRecord(event);
    const history = record.view.webContents.navigationHistory;
    if (history.canGoForward()) history.goForward();
  });
  ipcMain.handle('browser:reload-or-stop', (event) => {
    reloadOrStop(getBrowserRecord(event));
  });
  ipcMain.handle('browser:home', async (event) => {
    const record = getBrowserRecord(event);
    await record.view.webContents.loadURL(record.startUrl);
  });
  ipcMain.handle('browser:navigate', async (event, value) => {
    const record = getBrowserRecord(event);
    await navigateBrowser(record, String(value).slice(0, 2_048));
  });
}

app.on('login', (event, webContents, _details, authInfo, callback) => {
  if (!authInfo.isProxy) return;
  const profileId = webContentsProfiles.get(webContents.id);
  const profile = profileStore?.getRuntime(profileId);
  if (!profile?.proxy.username) return;
  event.preventDefault();
  callback(profile.proxy.username, profile.proxy.password || '');
});

app.on('before-quit', () => {
  quitting = true;
});

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  profileStore = new ProfileStore();
  userAgentStore = new UserAgentStore();
  await Promise.all([profileStore.load(), userAgentStore.load()]);
  await profileStore.ensureStableUserAgents(session.defaultSession.getUserAgent());
  registerIpc();
  createDashboard();
});

app.on('window-all-closed', () => app.quit());

app.on('activate', () => {
  if (!dashboard) createDashboard();
});
