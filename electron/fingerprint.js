import { randomUUID } from 'node:crypto';

const CORE_PRESETS = {
  windows_laptop: Object.freeze({
    label: 'Windows Laptop · Intel',
    group: 'Windows',
    platform: 'Win32',
    uaPlatform: 'Windows',
    platformVersion: '10.0.0',
    architecture: 'x86',
    model: '',
    mobile: false,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    pixelRatio: 1,
    colorDepth: 24,
    width: 1366,
    height: 768,
    gpuVendor: 'Google Inc. (Intel)',
    gpuRenderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics, Direct3D11)',
  }),
  windows_desktop: Object.freeze({
    label: 'Windows Desktop · NVIDIA',
    group: 'Windows',
    platform: 'Win32',
    uaPlatform: 'Windows',
    platformVersion: '10.0.0',
    architecture: 'x86',
    model: '',
    mobile: false,
    hardwareConcurrency: 16,
    deviceMemory: 16,
    maxTouchPoints: 0,
    pixelRatio: 1,
    colorDepth: 24,
    width: 1920,
    height: 1080,
    gpuVendor: 'Google Inc. (NVIDIA)',
    gpuRenderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060, Direct3D11)',
  }),
  macbook_m2: Object.freeze({
    label: 'MacBook · Apple M2',
    group: 'macOS',
    platform: 'MacIntel',
    uaPlatform: 'macOS',
    platformVersion: '14.5.0',
    architecture: 'arm',
    model: '',
    mobile: false,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 0,
    pixelRatio: 2,
    colorDepth: 30,
    width: 1440,
    height: 900,
    gpuVendor: 'Google Inc. (Apple)',
    gpuRenderer: 'ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)',
  }),
  android_pixel: Object.freeze({
    label: 'Android · Pixel 8',
    group: 'Android',
    platform: 'Linux armv81',
    uaPlatform: 'Android',
    platformVersion: '14.0.0',
    architecture: 'arm',
    model: 'Pixel 8',
    mobile: true,
    hardwareConcurrency: 8,
    deviceMemory: 8,
    maxTouchPoints: 5,
    pixelRatio: 2.625,
    colorDepth: 24,
    width: 412,
    height: 915,
    gpuVendor: 'Google Inc. (Qualcomm)',
    gpuRenderer: 'ANGLE (Qualcomm, Adreno (TM) 740, OpenGL ES 3.2)',
  }),
};

const GROUP_DEFAULTS = {
  Windows: {
    platform: 'Win32', uaPlatform: 'Windows', platformVersion: '10.0.0', architecture: 'x86',
    model: '', mobile: false, maxTouchPoints: 0, colorDepth: 24, ratios: [1, 1, 1.25, 1.5], backend: 'Direct3D11',
  },
  macOS: {
    platform: 'MacIntel', uaPlatform: 'macOS', platformVersion: '14.5.0', architecture: 'arm',
    model: '', mobile: false, maxTouchPoints: 0, colorDepth: 30, ratios: [2, 2, 2, 2], backend: 'Metal',
  },
  Android: {
    platform: 'Linux armv81', uaPlatform: 'Android', platformVersion: '14.0.0', architecture: 'arm',
    mobile: true, maxTouchPoints: 5, colorDepth: 24, ratios: [2.625, 2.75, 3, 3.25], backend: 'OpenGL ES 3.2',
  },
  Linux: {
    platform: 'Linux x86_64', uaPlatform: 'Linux', platformVersion: '6.8.0', architecture: 'x86',
    model: '', mobile: false, maxTouchPoints: 0, colorDepth: 24, ratios: [1, 1, 1.25, 1.5], backend: 'OpenGL 4.6',
  },
};

const DEVICE_FAMILIES = [
  { id: 'thinkpad_x1', name: 'ThinkPad X1 Carbon', group: 'Windows', r: [[1920,1200],[2240,1400],[2880,1800],[1920,1080]], c: [8,12,16,12], m: [8,16,32,16], vendor: 'Google Inc. (Intel)', g: ['Intel(R) Iris(R) Xe Graphics','Intel(R) Arc(TM) Graphics'] },
  { id: 'dell_xps13', name: 'Dell XPS 13', group: 'Windows', r: [[1920,1200],[2560,1600],[2880,1800],[3840,2400]], c: [8,12,16,16], m: [8,16,16,32], vendor: 'Google Inc. (Intel)', g: ['Intel(R) Iris(R) Xe Graphics','Intel(R) Arc(TM) Graphics'], touch: 10 },
  { id: 'dell_xps15', name: 'Dell XPS 15', group: 'Windows', r: [[1920,1200],[2560,1600],[3456,2160],[3840,2400]], c: [12,16,20,20], m: [16,16,32,64], vendor: 'Google Inc. (NVIDIA)', g: ['NVIDIA GeForce RTX 4050 Laptop GPU','NVIDIA GeForce RTX 4070 Laptop GPU'], touch: 10 },
  { id: 'surface_pro9', name: 'Microsoft Surface Pro 9', group: 'Windows', r: [[1920,1280],[2160,1440],[2560,1706],[2880,1920]], c: [8,8,12,16], m: [8,16,16,32], vendor: 'Google Inc. (Intel)', g: ['Intel(R) Iris(R) Xe Graphics'], touch: 10 },
  { id: 'hp_spectre', name: 'HP Spectre x360', group: 'Windows', r: [[1920,1200],[2560,1600],[2880,1800],[3000,2000]], c: [8,12,16,16], m: [8,16,16,32], vendor: 'Google Inc. (Intel)', g: ['Intel(R) Iris(R) Xe Graphics','Intel(R) Arc(TM) Graphics'], touch: 10 },
  { id: 'asus_zenbook', name: 'ASUS Zenbook OLED', group: 'Windows', r: [[1920,1080],[1920,1200],[2880,1800],[3200,2000]], c: [8,12,16,16], m: [8,16,16,32], vendor: 'Google Inc. (Intel)', g: ['Intel(R) Iris(R) Xe Graphics','Intel(R) Arc(TM) Graphics'] },
  { id: 'acer_swift', name: 'Acer Swift Go', group: 'Windows', r: [[1366,768],[1920,1080],[1920,1200],[2560,1600]], c: [8,8,12,16], m: [8,16,16,32], vendor: 'Google Inc. (Intel)', g: ['Intel(R) UHD Graphics','Intel(R) Iris(R) Xe Graphics'] },
  { id: 'msi_creator', name: 'MSI Creator', group: 'Windows', r: [[1920,1080],[2560,1440],[2560,1600],[3840,2160]], c: [12,16,20,24], m: [16,32,32,64], vendor: 'Google Inc. (NVIDIA)', g: ['NVIDIA GeForce RTX 4060 Laptop GPU','NVIDIA GeForce RTX 4080 Laptop GPU'] },
  { id: 'lenovo_legion', name: 'Lenovo Legion Pro', group: 'Windows', r: [[1920,1080],[1920,1200],[2560,1440],[2560,1600]], c: [12,16,24,32], m: [16,16,32,64], vendor: 'Google Inc. (NVIDIA)', g: ['NVIDIA GeForce RTX 4060 Laptop GPU','NVIDIA GeForce RTX 4090 Laptop GPU'] },
  { id: 'asus_rog', name: 'ASUS ROG Zephyrus', group: 'Windows', r: [[1920,1200],[2560,1440],[2560,1600],[2880,1800]], c: [12,16,24,32], m: [16,32,32,64], vendor: 'Google Inc. (NVIDIA)', g: ['NVIDIA GeForce RTX 4070 Laptop GPU','NVIDIA GeForce RTX 4090 Laptop GPU'] },
  { id: 'desktop_nvidia', name: 'Windows Workstation NVIDIA', group: 'Windows', r: [[1920,1080],[2560,1440],[3440,1440],[3840,2160]], c: [12,16,24,32], m: [16,32,64,64], vendor: 'Google Inc. (NVIDIA)', g: ['NVIDIA GeForce RTX 3060','NVIDIA GeForce RTX 4080'] },
  { id: 'desktop_amd', name: 'Windows Workstation AMD', group: 'Windows', r: [[1920,1080],[2560,1440],[3440,1440],[3840,2160]], c: [12,16,24,32], m: [16,32,32,64], vendor: 'Google Inc. (AMD)', g: ['AMD Radeon RX 6700 XT','AMD Radeon RX 7900 XT'] },
  { id: 'macbook_air_m1', name: 'MacBook Air M1', group: 'macOS', r: [[1280,800],[1440,900],[1680,1050],[2560,1600]], c: [8,8,8,8], m: [8,8,16,16], vendor: 'Google Inc. (Apple)', g: ['Apple M1'] },
  { id: 'macbook_air_m3', name: 'MacBook Air M3', group: 'macOS', r: [[1440,900],[1680,1050],[1710,1107],[2560,1664]], c: [8,8,10,10], m: [8,16,16,24], vendor: 'Google Inc. (Apple)', g: ['Apple M3'] },
  { id: 'macbook_pro_m2', name: 'MacBook Pro M2', group: 'macOS', r: [[1512,982],[1728,1117],[1800,1169],[3024,1964]], c: [10,12,12,12], m: [16,16,32,64], vendor: 'Google Inc. (Apple)', g: ['Apple M2 Pro','Apple M2 Max'] },
  { id: 'macbook_pro_m3', name: 'MacBook Pro M3', group: 'macOS', r: [[1512,982],[1728,1117],[1800,1169],[3456,2234]], c: [12,14,16,16], m: [18,36,48,64], vendor: 'Google Inc. (Apple)', g: ['Apple M3 Pro','Apple M3 Max'] },
  { id: 'galaxy_s24', name: 'Samsung Galaxy S24', group: 'Android', model: 'SM-S921B', r: [[360,780],[384,832],[412,892],[432,936]], c: [8,8,8,8], m: [8,8,12,12], vendor: 'Google Inc. (Qualcomm)', g: ['Adreno (TM) 750'] },
  { id: 'galaxy_a55', name: 'Samsung Galaxy A55', group: 'Android', model: 'SM-A556B', r: [[360,800],[384,854],[412,915],[432,960]], c: [6,8,8,8], m: [6,8,8,12], vendor: 'Google Inc. (ARM)', g: ['Mali-G68','Mali-G710'] },
  { id: 'pixel7', name: 'Google Pixel 7', group: 'Android', model: 'Pixel 7', r: [[360,800],[393,851],[412,915],[432,960]], c: [8,8,8,8], m: [8,8,12,12], vendor: 'Google Inc. (ARM)', g: ['Mali-G710','Mali-G715'] },
  { id: 'oneplus12', name: 'OnePlus 12', group: 'Android', model: 'CPH2581', r: [[360,800],[384,854],[412,915],[450,1000]], c: [8,8,8,8], m: [8,12,16,16], vendor: 'Google Inc. (Qualcomm)', g: ['Adreno (TM) 750'] },
  { id: 'ubuntu_intel', name: 'Ubuntu Laptop Intel', group: 'Linux', r: [[1366,768],[1920,1080],[1920,1200],[2560,1440]], c: [4,8,12,16], m: [8,8,16,32], vendor: 'Intel Open Source Technology Center', g: ['Mesa Intel(R) UHD Graphics','Mesa Intel(R) Iris(R) Xe Graphics'] },
  { id: 'ubuntu_nvidia', name: 'Ubuntu Desktop NVIDIA', group: 'Linux', r: [[1920,1080],[2560,1440],[3440,1440],[3840,2160]], c: [8,12,16,24], m: [16,16,32,64], vendor: 'NVIDIA Corporation', g: ['NVIDIA GeForce RTX 3060/PCIe/SSE2','NVIDIA GeForce RTX 4080/PCIe/SSE2'] },
  { id: 'fedora_amd', name: 'Fedora Workstation AMD', group: 'Linux', r: [[1920,1080],[2560,1440],[3440,1440],[3840,2160]], c: [8,12,16,24], m: [16,16,32,64], vendor: 'AMD', g: ['AMD Radeon RX 6700 XT (RADV NAVI22)','AMD Radeon RX 7900 XT (RADV NAVI31)'] },
  { id: 'arch_workstation', name: 'Arch Linux Workstation', group: 'Linux', r: [[1920,1080],[2560,1440],[3440,1440],[3840,2160]], c: [8,16,24,32], m: [16,32,64,64], vendor: 'Mesa', g: ['Mesa Intel(R) Arc(TM) A770 Graphics','AMD Radeon RX 7800 XT (RADV NAVI32)'] },
];

function buildFamilyPresets() {
  const presets = {};
  for (const family of DEVICE_FAMILIES) {
    const defaults = GROUP_DEFAULTS[family.group];
    for (let index = 0; index < 4; index += 1) {
      const [width, height] = family.r[index];
      const gpu = family.g[index % family.g.length];
      presets[`${family.id}_${index + 1}`] = Object.freeze({
        ...defaults,
        label: `${family.name} · ${width}×${height} · ${family.m[index]} GB`,
        group: family.group,
        model: family.model ?? defaults.model,
        maxTouchPoints: family.touch ?? defaults.maxTouchPoints,
        hardwareConcurrency: family.c[index],
        deviceMemory: family.m[index],
        pixelRatio: family.ratios?.[index] ?? defaults.ratios[index],
        width,
        height,
        gpuVendor: family.vendor,
        gpuRenderer: `ANGLE (${family.vendor}, ${gpu}, ${family.backend ?? defaults.backend})`,
      });
    }
  }
  return presets;
}

export const FINGERPRINT_PRESETS = Object.freeze({
  ...CORE_PRESETS,
  ...buildFamilyPresets(),
});

if (Object.keys(FINGERPRINT_PRESETS).length !== 100) {
  throw new Error('Katalog fingerprint harus berisi tepat 100 preset');
}

export function normalizeFingerprint(input = {}, existing = null) {
  const preset = Object.hasOwn(FINGERPRINT_PRESETS, input.preset)
    ? input.preset
    : Object.hasOwn(FINGERPRINT_PRESETS, existing?.preset)
      ? existing.preset
      : 'windows_laptop';
  const rawSeed = String(input.seed || existing?.seed || randomUUID()).trim();
  const stableUserAgent = String(input.userAgent || existing?.userAgent || '').trim().slice(0, 1_000);
  return {
    preset,
    seed: rawSeed.slice(0, 128) || randomUUID(),
    userAgent: stableUserAgent,
  };
}

export function getFingerprintPreset(name) {
  return FINGERPRINT_PRESETS[name] || FINGERPRINT_PRESETS.windows_laptop;
}

export function resolveUserAgent(profile, defaultUserAgent) {
  if (profile.userAgent) return profile.userAgent;
  if (profile.fingerprint?.userAgent) return profile.fingerprint.userAgent;
  const preset = getFingerprintPreset(profile.fingerprint?.preset);
  let userAgent = String(defaultUserAgent).replace(/\sElectron\/[^\s]+/i, '');

  if (preset.uaPlatform === 'macOS') {
    userAgent = userAgent.replace(/\([^)]*\)/, '(Macintosh; Intel Mac OS X 10_15_7)');
  } else if (preset.uaPlatform === 'Android') {
    userAgent = userAgent
      .replace(/\([^)]*\)/, `(Linux; Android 14; ${preset.model || 'Android Device'})`)
      .replace(/\sSafari\//, ' Mobile Safari/');
  } else if (preset.uaPlatform === 'Linux') {
    userAgent = userAgent.replace(/\([^)]*\)/, '(X11; Linux x86_64)');
  }
  return userAgent;
}

export function buildUserAgentMetadata(userAgent, presetName) {
  const preset = getFingerprintPreset(presetName);
  const chromeVersion = /(?:Chrome|Chromium)\/([\d.]+)/i.exec(userAgent)?.[1];
  if (!chromeVersion) return undefined;
  const major = chromeVersion.split('.')[0];
  return {
    brands: [
      { brand: 'Not_A Brand', version: '99' },
      { brand: 'Chromium', version: major },
      { brand: 'Google Chrome', version: major },
    ],
    fullVersionList: [
      { brand: 'Not_A Brand', version: '99.0.0.0' },
      { brand: 'Chromium', version: chromeVersion },
      { brand: 'Google Chrome', version: chromeVersion },
    ],
    platform: preset.uaPlatform,
    platformVersion: preset.platformVersion,
    architecture: preset.architecture,
    model: preset.model,
    mobile: preset.mobile,
    bitness: preset.mobile ? '' : '64',
    wow64: false,
  };
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function buildFingerprintInjection(profile) {
  const preset = getFingerprintPreset(profile.fingerprint?.preset);
  const seedHash = hashSeed(profile.fingerprint?.seed || profile.id);
  const config = {
    platform: preset.platform,
    hardwareConcurrency: preset.hardwareConcurrency,
    deviceMemory: preset.deviceMemory,
    maxTouchPoints: preset.maxTouchPoints,
    colorDepth: preset.colorDepth,
    pixelRatio: preset.pixelRatio,
    screenWidth: profile.width,
    screenHeight: profile.height,
    gpuVendor: preset.gpuVendor,
    gpuRenderer: preset.gpuRenderer,
    languages: [profile.locale, profile.locale.split('-')[0], 'en-US', 'en'],
    seedHash,
  };

  return `
    (() => {
      'use strict';
      const fp = ${JSON.stringify(config)};
      const define = (target, property, getter) => {
        try {
          Object.defineProperty(target, property, { configurable: true, get: getter });
        } catch (_) {}
      };

      if (typeof Navigator !== 'undefined') {
        define(Navigator.prototype, 'platform', () => fp.platform);
        define(Navigator.prototype, 'hardwareConcurrency', () => fp.hardwareConcurrency);
        define(Navigator.prototype, 'deviceMemory', () => fp.deviceMemory);
        define(Navigator.prototype, 'maxTouchPoints', () => fp.maxTouchPoints);
        define(Navigator.prototype, 'language', () => fp.languages[0]);
        define(Navigator.prototype, 'languages', () => Object.freeze([...fp.languages]));
      }

      if (typeof Screen !== 'undefined') {
        define(Screen.prototype, 'width', () => fp.screenWidth);
        define(Screen.prototype, 'height', () => fp.screenHeight);
        define(Screen.prototype, 'availWidth', () => fp.screenWidth);
        define(Screen.prototype, 'availHeight', () => Math.max(0, fp.screenHeight - 40));
        define(Screen.prototype, 'colorDepth', () => fp.colorDepth);
        define(Screen.prototype, 'pixelDepth', () => fp.colorDepth);
      }
      define(window, 'devicePixelRatio', () => fp.pixelRatio);

      const patchWebGL = (prototype) => {
        if (!prototype?.getParameter || prototype.getParameter.__bowserPatched) return;
        const original = prototype.getParameter;
        const patched = function(parameter) {
          if (parameter === 37445 || parameter === 0x1F00) return fp.gpuVendor;
          if (parameter === 37446 || parameter === 0x1F01) return fp.gpuRenderer;
          return original.call(this, parameter);
        };
        define(patched, '__bowserPatched', () => true);
        prototype.getParameter = patched;
      };
      patchWebGL(globalThis.WebGLRenderingContext?.prototype);
      patchWebGL(globalThis.WebGL2RenderingContext?.prototype);

      if (globalThis.CanvasRenderingContext2D && globalThis.HTMLCanvasElement) {
        const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        const tweak = (imageData) => {
          const data = imageData?.data;
          if (!data?.length) return imageData;
          const pixels = Math.max(1, data.length >>> 2);
          const stride = Math.max(1, Math.floor(pixels / 64));
          const channel = fp.seedHash % 3;
          const amplitude = 1 + ((fp.seedHash >>> 8) % 2);
          for (let pixel = fp.seedHash % stride; pixel < pixels; pixel += stride) {
            const index = pixel * 4 + channel;
            const direction = ((pixel + fp.seedHash) & 1) ? 1 : -1;
            data[index] = Math.max(0, Math.min(255, data[index] + direction * amplitude));
          }
          return imageData;
        };

        CanvasRenderingContext2D.prototype.getImageData = function(...args) {
          return tweak(originalGetImageData.apply(this, args));
        };
        HTMLCanvasElement.prototype.toDataURL = function(...args) {
          try {
            if (!this.width || !this.height) return originalToDataURL.apply(this, args);
            const context = this.getContext('2d');
            if (!context) return originalToDataURL.apply(this, args);
            const imageData = tweak(originalGetImageData.call(context, 0, 0, this.width, this.height));
            const clone = document.createElement('canvas');
            clone.width = this.width;
            clone.height = this.height;
            clone.getContext('2d').putImageData(imageData, 0, 0);
            return originalToDataURL.apply(clone, args);
          } catch (_) {
            return originalToDataURL.apply(this, args);
          }
        };
      }
    })();
  `;
}
