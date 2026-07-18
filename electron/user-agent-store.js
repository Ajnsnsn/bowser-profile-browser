import { app } from 'electron';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_USER_AGENTS = 5_000;

function cleanUserAgent(value) {
  const userAgent = String(value ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (userAgent.length < 10 || userAgent.length > 1_000) return '';
  if (/[\r\n\0]/.test(userAgent) || !userAgent.includes('/')) return '';
  return userAgent;
}

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"' && quoted && line[index + 1] === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  values.push(current.trim());
  return values;
}

function collectJsonEntries(value, output = []) {
  if (typeof value === 'string') {
    output.push({ value });
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectJsonEntries(item, output));
  } else if (value && typeof value === 'object') {
    const userAgent = value.userAgent ?? value.user_agent ?? value.ua ?? value.value;
    if (typeof userAgent === 'string') {
      output.push({ value: userAgent, label: value.name ?? value.label ?? '' });
    } else {
      const nested = value.userAgents ?? value.user_agents ?? value.agents ?? value.data;
      if (nested) collectJsonEntries(nested, output);
    }
  }
  return output;
}

export function parseUserAgentContent(content, extension = '.txt') {
  const text = String(content).replace(/^\uFEFF/, '').trim();
  if (!text) return [];

  let rawEntries = [];
  const looksJson = ['.json', '.jsonl'].includes(extension.toLowerCase()) || /^[\[{]/.test(text);
  if (looksJson) {
    try {
      if (extension.toLowerCase() === '.jsonl') {
        rawEntries = text.split(/\r?\n/).flatMap((line) => {
          try { return collectJsonEntries(JSON.parse(line)); } catch { return []; }
        });
      } else {
        rawEntries = collectJsonEntries(JSON.parse(text));
      }
    } catch (error) {
      throw new Error(`Format JSON tidak valid: ${error.message}`);
    }
  } else if (extension.toLowerCase() === '.csv') {
    const rows = text.split(/\r?\n/).filter(Boolean).map(parseCsvLine);
    const header = rows[0].map((value) => value.toLowerCase().replace(/[\s_-]/g, ''));
    const userAgentIndex = header.findIndex((value) => ['useragent', 'ua', 'value'].includes(value));
    const labelIndex = header.findIndex((value) => ['name', 'label', 'browser'].includes(value));
    const start = userAgentIndex === -1 ? 0 : 1;
    rawEntries = rows.slice(start).map((row) => ({
      value: row[userAgentIndex === -1 ? 0 : userAgentIndex],
      label: labelIndex === -1 ? '' : row[labelIndex],
    }));
  } else {
    rawEntries = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'))
      .map((value) => ({ value }));
  }

  const unique = new Map();
  for (const entry of rawEntries) {
    const value = cleanUserAgent(entry.value);
    if (!value || unique.has(value)) continue;
    unique.set(value, { value, label: String(entry.label || '').trim().slice(0, 100) });
    if (unique.size >= MAX_USER_AGENTS) break;
  }
  return [...unique.values()];
}

function deriveLabel(userAgent) {
  const browser = /Edg\/([\d.]+)/.exec(userAgent)
    ? `Edge ${/Edg\/([\d.]+)/.exec(userAgent)[1].split('.')[0]}`
    : /Firefox\/([\d.]+)/.exec(userAgent)
      ? `Firefox ${/Firefox\/([\d.]+)/.exec(userAgent)[1].split('.')[0]}`
      : /(?:Chrome|CriOS)\/([\d.]+)/.exec(userAgent)
        ? `Chrome ${/(?:Chrome|CriOS)\/([\d.]+)/.exec(userAgent)[1].split('.')[0]}`
        : /Version\/([\d.]+).*Safari\//.exec(userAgent)
          ? `Safari ${/Version\/([\d.]+).*Safari\//.exec(userAgent)[1].split('.')[0]}`
          : 'User-Agent';
  const platform = /Android/i.test(userAgent) ? 'Android'
    : /iPhone|iPad/i.test(userAgent) ? 'iOS'
      : /Macintosh|Mac OS X/i.test(userAgent) ? 'macOS'
        : /Windows/i.test(userAgent) ? 'Windows'
          : /Linux/i.test(userAgent) ? 'Linux'
            : 'Lainnya';
  return `${browser} · ${platform}`;
}

function idFor(userAgent) {
  return createHash('sha256').update(userAgent).digest('hex').slice(0, 20);
}

export class UserAgentStore {
  constructor() {
    this.file = path.join(app.getPath('userData'), 'user-agents.json');
    this.entries = [];
  }

  async load() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.entries = Array.isArray(parsed.entries)
        ? parsed.entries.filter((entry) => cleanUserAgent(entry.value))
        : [];
    } catch (error) {
      if (error.code !== 'ENOENT') console.warn(`Pustaka User-Agent gagal dimuat: ${error.message}`);
      this.entries = [];
    }
    return this.list();
  }

  list() {
    return this.entries.map((entry) => ({ ...entry }));
  }

  async importFile(filePath) {
    const stat = await fs.stat(filePath);
    if (stat.size > MAX_FILE_SIZE) throw new Error('File User-Agent maksimal 10 MB');
    const parsed = parseUserAgentContent(await fs.readFile(filePath, 'utf8'), path.extname(filePath));
    if (!parsed.length) throw new Error('Tidak ditemukan User-Agent yang valid di file');

    const existing = new Set(this.entries.map((entry) => entry.value));
    const addedEntries = [];
    for (const item of parsed) {
      if (existing.has(item.value) || this.entries.length >= MAX_USER_AGENTS) continue;
      const entry = {
        id: idFor(item.value),
        label: item.label || deriveLabel(item.value),
        value: item.value,
        source: path.basename(filePath).slice(0, 160),
      };
      this.entries.push(entry);
      addedEntries.push(entry);
      existing.add(item.value);
    }
    await this.#persist();
    return {
      added: addedEntries.length,
      total: this.entries.length,
      firstAddedId: addedEntries[0]?.id || '',
    };
  }

  async clear() {
    this.entries = [];
    await this.#persist();
  }

  async #persist() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify({ version: 1, entries: this.entries }, null, 2), 'utf8');
  }
}
