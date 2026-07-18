const state = {
  profiles: [],
  running: [],
  dataPath: '',
  version: '1.0.0',
  query: '',
  fingerprintPresets: {},
  userAgents: [],
};

const elements = {
  grid: document.querySelector('#profile-grid'),
  totalCount: document.querySelector('#total-count'),
  runningCount: document.querySelector('#running-count'),
  summary: document.querySelector('#profile-summary'),
  search: document.querySelector('#search-input'),
  dialog: document.querySelector('#profile-dialog'),
  form: document.querySelector('#profile-form'),
  title: document.querySelector('#dialog-title'),
  version: document.querySelector('#version-label'),
  clearPasswordRow: document.querySelector('#clear-password-row'),
  toastRegion: document.querySelector('#toast-region'),
};

const field = (id) => document.querySelector(`#${id}`);

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function initials(name) {
  return String(name || 'P')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

function profileColor(id) {
  const colors = ['violet', 'blue', 'cyan', 'amber', 'rose', 'green'];
  const value = [...String(id)].reduce((total, char) => total + char.charCodeAt(0), 0);
  return colors[value % colors.length];
}

function hostFromUrl(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

function toast(message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  elements.toastRegion.append(node);
  requestAnimationFrame(() => node.classList.add('visible'));
  setTimeout(() => {
    node.classList.remove('visible');
    setTimeout(() => node.remove(), 250);
  }, 3200);
}

function setState(nextState) {
  Object.assign(state, nextState);
  render();
}

function render() {
  elements.totalCount.textContent = String(state.profiles.length);
  elements.runningCount.textContent = String(state.running.length);
  elements.version.textContent = `v${state.version}`;
  elements.summary.textContent = state.profiles.length
    ? `${state.profiles.length} profil tersimpan · ${state.running.length} aktif`
    : 'Belum ada profil';
  if (!elements.dialog.open) {
    refreshUserAgentLibrary();
    refreshFingerprintPresetOptions();
  }

  const query = state.query.toLocaleLowerCase('id');
  const filtered = state.profiles.filter((profile) =>
    [profile.name, profile.locale, profile.timezone, profile.startUrl, profile.fingerprint?.preset]
      .some((value) => String(value).toLocaleLowerCase('id').includes(query))
  );

  if (!filtered.length) {
    elements.grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-illustration"><span></span><span></span><span></span></div>
        <h3>${query ? 'Profil tidak ditemukan' : 'Buat profil pertama Anda'}</h3>
        <p>${query ? 'Coba gunakan kata pencarian lain.' : 'Setiap profil memiliki cookie, cache, proxy, dan pengaturan browser tersendiri.'}</p>
        ${query ? '' : '<button class="button primary compact" data-action="new" type="button">Buat profil</button>'}
      </div>`;
    return;
  }

  elements.grid.innerHTML = filtered.map((profile) => {
    const running = state.running.includes(profile.id);
    const proxyLabel = profile.proxy.url ? hostFromUrl(profile.proxy.url) : 'Tanpa proxy';
    const fingerprintPreset = state.fingerprintPresets[profile.fingerprint?.preset];
    const fingerprintLabel = fingerprintPreset?.label || profile.fingerprint?.preset || 'Fingerprint standar';
    const fingerprintId = String(profile.fingerprint?.seed || '').slice(0, 8);
    return `
      <article class="profile-card ${running ? 'is-running' : ''}">
        <div class="card-topline">
          <div class="profile-avatar ${profileColor(profile.id)}">${escapeHtml(initials(profile.name))}</div>
          <div class="profile-status ${running ? 'running' : ''}">
            <span></span>${running ? 'Berjalan' : 'Siap'}
          </div>
        </div>
        <div class="profile-title">
          <h3 title="${escapeHtml(profile.name)}">${escapeHtml(profile.name)}</h3>
          <p title="${escapeHtml(profile.startUrl)}">${escapeHtml(hostFromUrl(profile.startUrl))}</p>
        </div>
        <div class="profile-details">
          <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.92 6h-2.95a15.7 15.7 0 0 0-1.38-3.56A8.05 8.05 0 0 1 18.92 8ZM12 4c.83 1.2 1.47 2.53 1.87 4h-3.74A13.65 13.65 0 0 1 12 4ZM4.26 14A7.8 7.8 0 0 1 4 12c0-.69.09-1.36.26-2h3.39a16.4 16.4 0 0 0 0 4H4.26Zm.82 2h2.95c.31 1.25.77 2.45 1.38 3.56A8.05 8.05 0 0 1 5.08 16Zm2.95-8H5.08a8.05 8.05 0 0 1 4.33-3.56A15.7 15.7 0 0 0 8.03 8ZM12 20a13.65 13.65 0 0 1-1.87-4h3.74A13.65 13.65 0 0 1 12 20Zm2.28-6H9.72a14.4 14.4 0 0 1 0-4h4.56a14.4 14.4 0 0 1 0 4Zm.31 5.56A15.7 15.7 0 0 0 15.97 16h2.95a8.05 8.05 0 0 1-4.33 3.56ZM16.35 14a16.4 16.4 0 0 0 0-4h3.39c.17.64.26 1.31.26 2s-.09 1.36-.26 2h-3.39Z"/></svg>${escapeHtml(profile.locale)}</span>
          <span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 18h-2v-2h2v2Zm2.07-7.25-.9.92A3.5 3.5 0 0 0 13 16h-2v-.5c0-1 .4-1.96 1.1-2.66l1.24-1.26A2 2 0 1 0 10 10H8a4 4 0 1 1 7.07 2.75Z"/></svg>${escapeHtml(profile.width)} × ${escapeHtml(profile.height)}</span>
          <span class="detail-wide" title="${escapeHtml(fingerprintLabel)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.81 4.47c-.08 0-.16-.02-.23-.06A10.8 10.8 0 0 0 12 3C8.07 3 4.5 5.18 2.7 8.69a.5.5 0 0 1-.89-.46A11.46 11.46 0 0 1 12 2c2.12 0 4.2.53 6.06 1.52a.5.5 0 0 1-.25.95ZM6.03 21a.5.5 0 0 1-.36-.85c2.08-2.13 2.35-4.43 2.62-6.66.25-2.08.51-4.23 2.44-5.25a3.3 3.3 0 0 1 3.62.45c1.3 1.2 1.42 2.86 1.54 4.46.12 1.62.24 3.29 1.54 4.59a.5.5 0 1 1-.71.71c-1.56-1.56-1.7-3.43-1.83-5.23-.11-1.5-.21-2.79-1.22-3.73a2.31 2.31 0 0 0-2.47-.37c-1.47.78-1.68 2.51-1.92 4.49-.27 2.28-.59 4.87-2.89 7.23a.5.5 0 0 1-.36.16Zm4.23.5a.5.5 0 0 1-.36-.85c2.08-2.13 2.28-4.46 2.45-6.33.1-1.14.18-2.04.66-2.69a.5.5 0 1 1 .8.6c-.31.42-.38 1.19-.46 2.18-.18 2.02-.4 4.53-2.73 6.93a.5.5 0 0 1-.36.16ZM3.5 17.85a.5.5 0 0 1-.45-.72c.9-1.82 1.1-3.51 1.3-5.15.25-2.15.5-4.17 2.25-5.9A7.61 7.61 0 0 1 12 3.85c3.91 0 7.24 3 7.58 6.84.15 1.73.43 3.69 1.34 5.23a.5.5 0 1 1-.86.51c-1.01-1.71-1.31-3.8-1.48-5.65A6.62 6.62 0 0 0 12 4.85a6.62 6.62 0 0 0-4.7 1.94c-1.5 1.48-1.71 3.26-1.96 5.31-.2 1.72-.42 3.5-1.39 5.47a.5.5 0 0 1-.45.28Z"/></svg>${escapeHtml(fingerprintLabel)} · ${escapeHtml(fingerprintId)}</span>
          <span class="detail-wide"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 6A4.5 4.5 0 1 0 12 10.5 4.5 4.5 0 0 0 7.5 6Zm0 2A2.5 2.5 0 1 1 5 10.5 2.5 2.5 0 0 1 7.5 8Zm9-2A4.5 4.5 0 1 0 21 10.5 4.5 4.5 0 0 0 16.5 6Zm0 2a2.5 2.5 0 1 1-2.5 2.5A2.5 2.5 0 0 1 16.5 8ZM12 10a2 2 0 1 0 2 2 2 2 0 0 0-2-2Z"/></svg>${escapeHtml(proxyLabel)}</span>
        </div>
        <div class="card-actions">
          <button class="button ${running ? 'danger-subtle' : 'launch'}" data-action="${running ? 'stop' : 'launch'}" data-id="${profile.id}" type="button">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${running ? 'M6 6h12v12H6z' : 'm8 5 11 7-11 7V5Z'}"/></svg>
            ${running ? 'Tutup' : 'Jalankan'}
          </button>
          <button class="icon-button card-icon" data-action="edit" data-id="${profile.id}" type="button" title="Edit profil" aria-label="Edit profil">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25ZM20.71 7.04a1 1 0 0 0 0-1.42l-2.34-2.34a1 1 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82Z"/></svg>
          </button>
          <button class="icon-button card-icon" data-action="duplicate" data-id="${profile.id}" type="button" title="Duplikat" aria-label="Duplikat profil">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1Zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Zm0 16H8V7h11v14Z"/></svg>
          </button>
          <button class="icon-button card-icon delete" data-action="delete" data-id="${profile.id}" type="button" title="Hapus" aria-label="Hapus profil">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12ZM8 9h8v10H8V9Zm7.5-5-1-1h-5l-1 1H5v2h14V4h-3.5Z"/></svg>
          </button>
        </div>
      </article>`;
  }).join('');
}

function openProfileDialog(profile = null) {
  if (elements.dialog.open) elements.dialog.close();
  elements.dialog.removeAttribute('inert');
  elements.dialog.style.pointerEvents = 'auto';
  for (const control of elements.form.querySelectorAll('input, select, textarea, button')) {
    control.disabled = false;
    if ('readOnly' in control) control.readOnly = false;
  }
  elements.form.reset();
  field('fingerprint-search').value = '';
  field('profile-id').value = profile?.id || '';
  field('profile-name').value = profile?.name || '';
  field('start-url').value = profile?.startUrl || 'https://www.google.com';
  field('locale').value = profile?.locale || 'id-ID';
  field('timezone').value = profile?.timezone || 'Asia/Jakarta';
  setResolutionValue(profile?.width || 1366, profile?.height || 768);
  field('user-agent').value = profile?.userAgent || '';
  refreshUserAgentLibrary();
  const presetId = profile?.fingerprint?.preset || 'windows_laptop';
  refreshFingerprintPresetOptions(presetId);
  field('fingerprint-preset').value = presetId;
  field('fingerprint-seed').value = profile?.fingerprint?.seed || crypto.randomUUID();
  refreshFingerprintSummary(false);
  field('proxy-url').value = profile?.proxy.url || '';
  field('proxy-username').value = profile?.proxy.username || '';
  field('proxy-password').value = '';
  field('proxy-password').placeholder = profile?.proxy.passwordSet ? 'Password tersimpan' : 'Opsional';
  field('clear-password').checked = false;
  elements.clearPasswordRow.hidden = !profile?.proxy.passwordSet;
  elements.title.textContent = profile ? 'Edit profil' : 'Buat profil baru';
  elements.dialog.showModal();
  const body = elements.dialog.querySelector('.dialog-body');
  if (body) body.scrollTop = 0;
  window.focus();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const name = field('profile-name');
      name.focus({ preventScroll: true });
      if (profile) name.select();
    });
  });
}

function refreshUserAgentLibrary(preferredId = '') {
  const select = field('user-agent-library');
  if (!select) return;
  const previous = preferredId || select.value;
  const currentUserAgent = field('user-agent')?.value || '';
  select.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = state.userAgents.length
    ? `Pilih salah satu dari ${state.userAgents.length} User-Agent`
    : 'Belum ada daftar yang diimpor';
  select.append(placeholder);

  for (const entry of state.userAgents) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = `${entry.label} — ${entry.source}`;
    option.title = entry.value;
    select.append(option);
  }

  const matching = state.userAgents.find((entry) => entry.value === currentUserAgent);
  const target = preferredId || matching?.id || previous;
  select.value = state.userAgents.some((entry) => entry.id === target) ? target : '';
  field('clear-user-agents').disabled = state.userAgents.length === 0;
}

function refreshFingerprintPresetOptions(preferredId = '') {
  const select = field('fingerprint-preset');
  if (!select) return;
  const previous = preferredId || select.value || 'windows_laptop';
  const query = String(field('fingerprint-search')?.value || '').trim().toLocaleLowerCase('id');
  const allEntries = Object.entries(state.fingerprintPresets);
  let entries = allEntries.filter(([id, preset]) =>
    !query || `${id} ${preset.label} ${preset.group}`.toLocaleLowerCase('id').includes(query)
  );
  if (previous && !entries.some(([id]) => id === previous)) {
    const selected = allEntries.find(([id]) => id === previous);
    if (selected) entries = [selected, ...entries];
  }

  select.replaceChildren();
  const groupOrder = ['Windows', 'macOS', 'Android', 'Linux'];
  for (const groupName of groupOrder) {
    const groupEntries = entries.filter(([, preset]) => preset.group === groupName);
    if (!groupEntries.length) continue;
    const group = document.createElement('optgroup');
    group.label = `${groupName} · ${groupEntries.length} preset`;
    for (const [id, preset] of groupEntries) {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = preset.label;
      group.append(option);
    }
    select.append(group);
  }
  if (!select.options.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Preset tidak ditemukan';
    select.append(option);
  }
  select.value = allEntries.some(([id]) => id === previous) ? previous : select.options[0]?.value || '';
}

function setResolutionValue(width, height) {
  const select = field('resolution');
  const value = `${width}x${height}`;
  if (![...select.options].some((option) => option.value === value)) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = `${width} × ${height} · preset`;
    option.dataset.presetResolution = 'true';
    select.append(option);
  }
  select.value = value;
}

function refreshFingerprintSummary(syncResolution = false) {
  const presetId = field('fingerprint-preset').value;
  const preset = state.fingerprintPresets[presetId] || {};
  const seed = field('fingerprint-seed').value;
  field('fingerprint-id-label').textContent = seed ? seed.slice(0, 12) : 'baru';
  field('fp-platform').textContent = preset.platform || '—';
  field('fp-hardware').textContent = preset.hardwareConcurrency
    ? `${preset.hardwareConcurrency} core · ${preset.deviceMemory} GB`
    : '—';
  field('fp-gpu').textContent = String(preset.gpuRenderer || '—')
    .replace(/^ANGLE \([^,]+,\s*/, '')
    .replace(/,\s*(Direct3D11|OpenGL.*|Unspecified Version).*\)$/, '')
    .slice(0, 42);

  if (syncResolution && preset.width && preset.height) {
    setResolutionValue(preset.width, preset.height);
  }
}

function closeProfileDialog() {
  if (elements.dialog.open) elements.dialog.close();
  elements.dialog.style.pointerEvents = '';
}

async function handleAction(action, id, button) {
  const profile = state.profiles.find((item) => item.id === id);
  try {
    if (action === 'new') {
      openProfileDialog();
      return;
    }
    if (action === 'edit') {
      openProfileDialog(profile);
      return;
    }
    if (action === 'delete') {
      const accepted = window.confirm(`Hapus “${profile.name}”?\n\nCookie, cache, dan seluruh data sesi profil ini juga akan dihapus.`);
      if (!accepted) return;
      button.disabled = true;
      await window.bowser.deleteProfile(id);
      toast('Profil dan data sesinya telah dihapus');
      return;
    }
    button.disabled = true;
    if (action === 'launch') {
      await window.bowser.launchProfile(id);
      toast(`${profile.name} berhasil dijalankan`);
    } else if (action === 'stop') {
      await window.bowser.stopProfile(id);
    } else if (action === 'duplicate') {
      await window.bowser.duplicateProfile(id);
      toast('Salinan profil berhasil dibuat');
    }
  } catch (error) {
    toast(error.message || 'Operasi gagal', 'error');
  } finally {
    button.disabled = false;
  }
}

elements.grid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  handleAction(button.dataset.action, button.dataset.id, button);
});

elements.search.addEventListener('input', () => {
  state.query = elements.search.value.trim();
  render();
});

document.querySelector('#create-profile').addEventListener('click', () => openProfileDialog());
field('fingerprint-preset').addEventListener('change', () => refreshFingerprintSummary(true));
field('fingerprint-search').addEventListener('input', () => {
  refreshFingerprintPresetOptions();
  refreshFingerprintSummary(false);
});
field('randomize-fingerprint').addEventListener('click', () => {
  field('fingerprint-seed').value = crypto.randomUUID();
  refreshFingerprintSummary(false);
  toast('Fingerprint baru dibuat');
});
field('user-agent-library').addEventListener('change', () => {
  const entry = state.userAgents.find((item) => item.id === field('user-agent-library').value);
  if (entry) field('user-agent').value = entry.value;
});
field('user-agent').addEventListener('input', () => refreshUserAgentLibrary());
field('import-user-agents').addEventListener('click', async () => {
  const button = field('import-user-agents');
  button.disabled = true;
  try {
    const result = await window.bowser.importUserAgents();
    if (result.canceled) return;
    setState(await window.bowser.getState());
    refreshUserAgentLibrary(result.firstAddedId);
    if (result.firstAddedId) {
      const entry = state.userAgents.find((item) => item.id === result.firstAddedId);
      if (entry) field('user-agent').value = entry.value;
    }
    toast(result.added
      ? `${result.added} User-Agent berhasil diimpor`
      : 'Semua User-Agent di file sudah ada');
  } catch (error) {
    toast(error.message || 'File User-Agent gagal diimpor', 'error');
  } finally {
    button.disabled = false;
  }
});
field('clear-user-agents').addEventListener('click', async () => {
  if (!state.userAgents.length) return;
  if (!window.confirm('Hapus seluruh daftar User-Agent yang sudah diimpor?')) return;
  try {
    await window.bowser.clearUserAgents();
    setState(await window.bowser.getState());
    toast('Daftar User-Agent dihapus');
  } catch (error) {
    toast(error.message || 'Daftar gagal dihapus', 'error');
  }
});
document.querySelector('#close-dialog').addEventListener('click', closeProfileDialog);
document.querySelector('#cancel-dialog').addEventListener('click', closeProfileDialog);
document.querySelector('#open-data-folder').addEventListener('click', async () => {
  try {
    await window.bowser.openDataFolder();
  } catch (error) {
    toast(error.message || 'Folder tidak dapat dibuka', 'error');
  }
});

elements.dialog.addEventListener('click', (event) => {
  const rect = elements.dialog.getBoundingClientRect();
  const outside = event.clientX < rect.left || event.clientX > rect.right ||
    event.clientY < rect.top || event.clientY > rect.bottom;
  if (outside) closeProfileDialog();
});

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submit = field('save-profile');
  const label = submit.querySelector('.button-label');
  const [width, height] = field('resolution').value.split('x').map(Number);
  const profile = {
    id: field('profile-id').value || undefined,
    name: field('profile-name').value,
    startUrl: field('start-url').value,
    locale: field('locale').value,
    timezone: field('timezone').value,
    width,
    height,
    userAgent: field('user-agent').value,
    fingerprint: {
      preset: field('fingerprint-preset').value,
      seed: field('fingerprint-seed').value,
    },
    proxy: {
      url: field('proxy-url').value,
      username: field('proxy-username').value,
      password: field('proxy-password').value,
      clearPassword: field('clear-password').checked,
    },
  };

  submit.disabled = true;
  label.textContent = 'Menyimpan...';
  try {
    await window.bowser.saveProfile(profile);
    closeProfileDialog();
    toast(profile.id ? 'Perubahan profil disimpan' : 'Profil baru berhasil dibuat');
  } catch (error) {
    toast(error.message || 'Profil gagal disimpan', 'error');
  } finally {
    submit.disabled = false;
    label.textContent = 'Simpan profil';
  }
});

window.bowser.onStateChanged(setState);

window.bowser.getState()
  .then(setState)
  .catch((error) => {
    elements.grid.innerHTML = `<div class="error-state">Gagal memuat aplikasi: ${escapeHtml(error.message)}</div>`;
  });
