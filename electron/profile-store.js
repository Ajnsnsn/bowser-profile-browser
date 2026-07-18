import { app, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { normalizeFingerprint, resolveUserAgent } from './fingerprint.js';

const DEFAULTS = Object.freeze({
  name: 'Profil baru',
  startUrl: 'https://www.google.com',
  userAgent: '',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta',
  width: 1366,
  height: 768,
  proxy: {
    url: '',
    username: '',
  },
});

function cleanText(value, maxLength = 300) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cleanUrl(value) {
  const input = cleanText(value, 2048) || DEFAULTS.startUrl;
  const withScheme = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const parsed = new URL(withScheme);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL harus memakai http:// atau https://');
  }
  return parsed.toString();
}

function cleanProxyUrl(value) {
  const input = cleanText(value, 500);
  if (!input) return '';
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `http://${input}`;
  const parsed = new URL(withScheme);
  if (!['http:', 'https:', 'socks4:', 'socks5:'].includes(parsed.protocol)) {
    throw new Error('Proxy harus memakai HTTP, HTTPS, SOCKS4, atau SOCKS5');
  }
  if (!parsed.hostname || !parsed.port) {
    throw new Error('Alamat proxy harus menyertakan host dan port');
  }
  parsed.username = '';
  parsed.password = '';
  return parsed.toString().replace(/\/$/, '');
}

function clampDimension(value, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(7680, Math.max(320, number)) : fallback;
}

function encryptSecret(value) {
  if (!value) return '';
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Enkripsi kredensial tidak tersedia di perangkat ini');
  }
  return safeStorage.encryptString(String(value)).toString('base64');
}

function decryptSecret(value) {
  if (!value) return '';
  try {
    return safeStorage.decryptString(Buffer.from(value, 'base64'));
  } catch {
    return '';
  }
}

export class ProfileStore {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'profiles.json');
    this.profiles = [];
  }

  async load() {
    try {
      const raw = await fs.readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      const storedProfiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
      const needsMigration = storedProfiles.some((profile) => !profile.fingerprint?.seed);
      this.profiles = storedProfiles
        .map((profile) => ({
            ...profile,
            fingerprint: normalizeFingerprint(profile.fingerprint),
          }));
      if (needsMigration) await this.#persist();
    } catch (error) {
      if (error.code !== 'ENOENT') {
        await this.#backupDamagedFile();
      }
      this.profiles = [];
    }
    return this.list();
  }

  list() {
    return this.profiles
      .map((profile) => this.#toPublic(profile))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  get(id) {
    return this.profiles.find((profile) => profile.id === id) ?? null;
  }

  getRuntime(id) {
    const profile = this.get(id);
    if (!profile) return null;
    return {
      ...this.#toPublic(profile),
      proxy: {
        ...profile.proxy,
        password: decryptSecret(profile.proxy?.passwordEncrypted),
      },
    };
  }

  async ensureStableUserAgents(defaultUserAgent) {
    let changed = false;
    for (const profile of this.profiles) {
      const fingerprint = normalizeFingerprint(profile.fingerprint);
      if (!fingerprint.userAgent) {
        fingerprint.userAgent = resolveUserAgent(
          { ...profile, fingerprint },
          defaultUserAgent
        );
        profile.fingerprint = fingerprint;
        changed = true;
      }
    }
    if (changed) await this.#persist();
  }

  async save(input = {}) {
    const id = cleanText(input.id, 80);
    const existing = id ? this.get(id) : null;
    const now = new Date().toISOString();
    const passwordInput = typeof input.proxy?.password === 'string'
      ? input.proxy.password
      : null;
    const passwordEncrypted = input.proxy?.clearPassword
      ? ''
      : passwordInput
        ? encryptSecret(passwordInput)
        : existing?.proxy?.passwordEncrypted || '';

    const profile = {
      id: existing?.id || randomUUID(),
      name: cleanText(input.name, 80) || DEFAULTS.name,
      startUrl: cleanUrl(input.startUrl),
      userAgent: cleanText(input.userAgent, 1000),
      locale: cleanText(input.locale, 40) || DEFAULTS.locale,
      timezone: cleanText(input.timezone, 80) || DEFAULTS.timezone,
      width: clampDimension(input.width, DEFAULTS.width),
      height: clampDimension(input.height, DEFAULTS.height),
      fingerprint: normalizeFingerprint(input.fingerprint, existing?.fingerprint),
      proxy: {
        url: cleanProxyUrl(input.proxy?.url),
        username: cleanText(input.proxy?.username, 200),
        passwordEncrypted,
      },
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (existing) {
      this.profiles[this.profiles.indexOf(existing)] = profile;
    } else {
      this.profiles.push(profile);
    }
    await this.#persist();
    return this.#toPublic(profile);
  }

  async duplicate(id) {
    const original = this.get(id);
    if (!original) throw new Error('Profil tidak ditemukan');
    const now = new Date().toISOString();
    const copy = {
      ...structuredClone(original),
      id: randomUUID(),
      name: `${original.name} (Salinan)`,
      fingerprint: {
        ...original.fingerprint,
        seed: randomUUID(),
      },
      createdAt: now,
      updatedAt: now,
    };
    this.profiles.push(copy);
    await this.#persist();
    return this.#toPublic(copy);
  }

  async remove(id) {
    const index = this.profiles.findIndex((profile) => profile.id === id);
    if (index === -1) throw new Error('Profil tidak ditemukan');
    this.profiles.splice(index, 1);
    await this.#persist();
  }

  #toPublic(profile) {
    return {
      id: profile.id,
      name: profile.name,
      startUrl: profile.startUrl,
      userAgent: profile.userAgent || '',
      locale: profile.locale,
      timezone: profile.timezone,
      width: profile.width,
      height: profile.height,
      fingerprint: normalizeFingerprint(profile.fingerprint),
      proxy: {
        url: profile.proxy?.url || '',
        username: profile.proxy?.username || '',
        passwordSet: Boolean(profile.proxy?.passwordEncrypted),
      },
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  }

  async #persist() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await fs.writeFile(temporary, JSON.stringify({ version: 1, profiles: this.profiles }, null, 2), 'utf8');
    await fs.rename(temporary, this.file).catch(async () => {
      await fs.rm(this.file, { force: true });
      await fs.rename(temporary, this.file);
    });
  }

  async #backupDamagedFile() {
    const backup = `${this.file}.damaged-${Date.now()}`;
    await fs.rename(this.file, backup).catch(() => {});
  }
}

export { cleanUrl };
