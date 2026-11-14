import { RPKA_2027_KEGIATAN, RPKA_2027_PROKER } from '../data/rpka2027Seed';
import type {
  AppSettings,
  KegiatanRpkaItem,
  OrgDataset,
  PengurusItem,
  ProgramKerjaItem,
  UnitItem,
  UserRole,
} from '../types/org';
import { normalizeWhatsApp } from '../utils/whatsapp';

const STORAGE_KEYS = {
  GAS_URL: 'duwd_gas_webapp_url_v2',
  UNITS: 'duwd_units_cache_v2',
  PENGURUS: 'duwd_pengurus_cache_v2',
  PROKER: 'duwd_proker_cache_v2',
  KEGIATAN: 'duwd_kegiatan_cache_v2',
  SETTINGS: 'duwd_settings_cache_v2',
  PINS: 'duwd_local_pins_v2',
};

export const STARTER_UNITS: UnitItem[] = [
  { id: 'UNIT-01', kodeUnit: 'PI', namaUnit: 'Pengurus Inti (PI)', urutan: 1, aktif: true },
  { id: 'UNIT-02', kodeUnit: 'WILAYAH', namaUnit: 'Bidang Pembinaan Wilayah', urutan: 2, aktif: true },
  { id: 'UNIT-03', kodeUnit: 'DAERAH', namaUnit: 'Bidang Konsolidasi Daerah', urutan: 3, aktif: true },
  { id: 'UNIT-04', kodeUnit: 'KADER', namaUnit: 'Bidang Kaderisasi & Levelisasi', urutan: 4, aktif: true },
  { id: 'UNIT-05', kodeUnit: 'ADMIN-IT', namaUnit: 'Bidang Administrasi & Digitalisasi', urutan: 5, aktif: true },
];

const DEFAULT_PINS = {
  superadmin: 'duwd-super-2026',
  admin: 'duwd-admin-2026',
};

export function loadLocalSettings(): AppSettings {
  try {
    const gasUrl =
      window.localStorage.getItem(STORAGE_KEYS.GAS_URL) ||
      (import.meta.env.VITE_GAS_WEBAPP_URL as string | undefined) ||
      '';
    const rawSettings = window.localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const parsed = rawSettings ? (JSON.parse(rawSettings) as Partial<AppSettings>) : {};
    return {
      namaAplikasi: parsed.namaAplikasi || 'DUWD DPP WI',
      logoDataUrl: parsed.logoDataUrl || '',
      rpkaDriveUrl: parsed.rpkaDriveUrl || '',
      gasWebAppUrl: gasUrl,
    };
  } catch {
    return {
      namaAplikasi: 'DUWD DPP WI',
      logoDataUrl: '',
      rpkaDriveUrl: '',
      gasWebAppUrl: '',
    };
  }
}

export function saveGasWebAppUrl(url: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.GAS_URL, url.trim());
  } catch {
    // Ignore storage quota error
  }
}

export function saveLocalSettingsCache(settings: {
  namaAplikasi: string;
  logoDataUrl: string;
  rpkaDriveUrl: string;
}): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // Ignore storage quota error
  }
}

export function loadLocalUnits(): UnitItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.UNITS);
    if (!raw) return STARTER_UNITS;
    const parsed = JSON.parse(raw) as UnitItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : STARTER_UNITS;
  } catch {
    return STARTER_UNITS;
  }
}

export function saveLocalUnits(units: UnitItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(units));
  } catch {
    // Ignore
  }
}

export function loadLocalPengurus(): PengurusItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.PENGURUS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PengurusItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalPengurus(list: PengurusItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.PENGURUS, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalProker(): ProgramKerjaItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.PROKER);
    if (!raw) return RPKA_2027_PROKER;
    const parsed = JSON.parse(raw) as ProgramKerjaItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : RPKA_2027_PROKER;
  } catch {
    return RPKA_2027_PROKER;
  }
}

export function saveLocalProker(list: ProgramKerjaItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.PROKER, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalKegiatan(): KegiatanRpkaItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.KEGIATAN);
    if (!raw) return RPKA_2027_KEGIATAN;
    const parsed = JSON.parse(raw) as KegiatanRpkaItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : RPKA_2027_KEGIATAN;
  } catch {
    return RPKA_2027_KEGIATAN;
  }
}

export function saveLocalKegiatan(list: KegiatanRpkaItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

function loadLocalPins(): { superadmin: string; admin: string } {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.PINS);
    if (!raw) return DEFAULT_PINS;
    const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_PINS>;
    return {
      superadmin: parsed.superadmin || DEFAULT_PINS.superadmin,
      admin: parsed.admin || DEFAULT_PINS.admin,
    };
  } catch {
    return DEFAULT_PINS;
  }
}

function saveLocalPins(pins: { superadmin?: string; admin?: string }): void {
  const current = loadLocalPins();
  const next = {
    superadmin: pins.superadmin?.trim() || current.superadmin,
    admin: pins.admin?.trim() || current.admin,
  };
  try {
    window.localStorage.setItem(STORAGE_KEYS.PINS, JSON.stringify(next));
  } catch {
    // Ignore
  }
}

async function gasGet<T>(
  webAppUrl: string,
  params: Record<string, string>,
): Promise<{ ok: boolean; data?: T; role?: UserRole; error?: string; message?: string }> {
  const url = new URL(webAppUrl);
  Object.entries(params).forEach(([k, v]) => {
    url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { method: 'GET' });
  return (await res.json()) as {
    ok: boolean;
    data?: T;
    role?: UserRole;
    error?: string;
    message?: string;
  };
}

async function gasPost<T>(
  webAppUrl: string,
  action: string,
  pin: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; data?: T; error?: string; message?: string }> {
  const res = await fetch(webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, pin, payload }),
  });
  return (await res.json()) as { ok: boolean; data?: T; error?: string; message?: string };
}

export async function testGasConnection(
  webAppUrl: string,
): Promise<{ ok: boolean; message: string }> {
  const cleanUrl = webAppUrl.trim();
  if (!cleanUrl) {
    return { ok: false, message: 'URL Web App Google Apps Script masih kosong.' };
  }
  try {
    const res = await gasGet(cleanUrl, { action: 'ping' });
    return {
      ok: Boolean(res.ok),
      message: res.message || res.error || 'Respons tidak dikenali dari Apps Script.',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Gagal menghubungi Google Apps Script.',
    };
  }
}

export async function fetchAllOrgData(webAppUrl: string): Promise<{
  dataset: OrgDataset;
  synced: boolean;
  error?: string;
}> {
  const localSettings = loadLocalSettings();
  const fallback: OrgDataset = {
    units: loadLocalUnits(),
    pengurus: loadLocalPengurus(),
    proker: loadLocalProker(),
    kegiatan: loadLocalKegiatan(),
    settings: {
      namaAplikasi: localSettings.namaAplikasi,
      logoDataUrl: localSettings.logoDataUrl,
      rpkaDriveUrl: localSettings.rpkaDriveUrl,
    },
  };

  if (!webAppUrl.trim()) {
    return { dataset: fallback, synced: false };
  }

  try {
    const res = await gasGet<OrgDataset>(webAppUrl.trim(), { action: 'getAllData' });
    if (res.ok && res.data) {
      const units = res.data.units?.length > 0 ? res.data.units : STARTER_UNITS;
      const proker = res.data.proker?.length > 0 ? res.data.proker : RPKA_2027_PROKER;
      const kegiatan = res.data.kegiatan?.length > 0 ? res.data.kegiatan : RPKA_2027_KEGIATAN;
      saveLocalUnits(units);
      saveLocalPengurus(res.data.pengurus || []);
      saveLocalProker(proker);
      saveLocalKegiatan(kegiatan);
      saveLocalSettingsCache({
        namaAplikasi: res.data.settings?.namaAplikasi || 'DUWD DPP WI',
        logoDataUrl: res.data.settings?.logoDataUrl || localSettings.logoDataUrl,
        rpkaDriveUrl: res.data.settings?.rpkaDriveUrl || localSettings.rpkaDriveUrl,
      });
      return {
        dataset: {
          units,
          pengurus: res.data.pengurus || [],
          proker,
          kegiatan,
          settings: {
            namaAplikasi: res.data.settings?.namaAplikasi || 'DUWD DPP WI',
            logoDataUrl: res.data.settings?.logoDataUrl || localSettings.logoDataUrl,
            rpkaDriveUrl: res.data.settings?.rpkaDriveUrl || localSettings.rpkaDriveUrl,
          },
        },
        synced: true,
      };
    }
    return { dataset: fallback, synced: false, error: res.error };
  } catch (err) {
    return {
      dataset: fallback,
      synced: false,
      error: err instanceof Error ? err.message : 'Gagal sinkronisasi data dari Spreadsheet.',
    };
  }
}

export async function authenticatePin(
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; role?: UserRole; error?: string }> {
  const cleanPin = pin.trim();
  if (!cleanPin) return { ok: false, error: 'Masukkan PIN akses terlebih dahulu.' };

  if (webAppUrl.trim()) {
    try {
      const res = await gasGet(webAppUrl.trim(), { action: 'verifyPin', pin: cleanPin });
      if (res.ok && res.role) {
        return { ok: true, role: res.role };
      }
      return { ok: false, error: res.error || 'PIN akses tidak sesuai.' };
    } catch {
      // Fallback to local verification if GAS unreachable
    }
  }

  const pins = loadLocalPins();
  if (cleanPin === pins.superadmin) return { ok: true, role: 'superadmin' };
  if (cleanPin === pins.admin) return { ok: true, role: 'admin' };
  return { ok: false, error: 'PIN akses tidak sesuai.' };
}

export async function savePengurusRecord(
  input: {
    id?: string;
    namaLengkap: string;
    namaPanggilan: string;
    whatsapp: string;
    unitId: string;
    namaUnit: string;
    amanah: string;
    dibuatPada?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: PengurusItem; synced: boolean; error?: string }> {
  const normalizedWa = normalizeWhatsApp(input.whatsapp);
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

  if (webAppUrl.trim()) {
    const res = await gasPost<PengurusItem>(webAppUrl.trim(), 'savePengurus', pin, {
      ...input,
      whatsapp: normalizedWa,
    });
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return { ok: false, synced: false, error: res.error || 'Gagal menyimpan ke Spreadsheet.' };
  }

  const item: PengurusItem = {
    id: input.id || `PGR-${Date.now().toString().slice(-6)}`,
    namaLengkap: input.namaLengkap.trim(),
    namaPanggilan: input.namaPanggilan.trim(),
    whatsapp: normalizedWa,
    unitId: input.unitId,
    namaUnit: input.namaUnit,
    amanah: input.amanah.trim(),
    dibuatPada: input.dibuatPada || nowStr,
    diperbaruiPada: nowStr,
  };
  return { ok: true, item, synced: false };
}

export async function deletePengurusRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deletePengurus', pin, { id });
    return { ok: res.ok, synced: true, error: res.error };
  }
  return { ok: true, synced: false };
}

export async function saveKegiatanRecord(
  input: KegiatanRpkaItem,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: KegiatanRpkaItem; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost<KegiatanRpkaItem>(webAppUrl.trim(), 'saveKegiatan', pin, {
      ...input,
    });
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return { ok: false, synced: false, error: res.error || 'Gagal menyimpan kegiatan.' };
  }
  return { ok: true, item: input, synced: false };
}

export async function deleteKegiatanRecord(
  kodeKegiatan: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteKegiatan', pin, { kodeKegiatan });
    return { ok: res.ok, synced: true, error: res.error };
  }
  return { ok: true, synced: false };
}

export async function saveUnitRecord(
  input: {
    id?: string;
    kodeUnit: string;
    namaUnit: string;
    urutan: number;
    aktif: boolean;
  },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: UnitItem; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost<UnitItem>(webAppUrl.trim(), 'saveUnit', pin, { ...input });
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return { ok: false, synced: false, error: res.error || 'Gagal menyimpan Unit ke Spreadsheet.' };
  }

  const item: UnitItem = {
    id: input.id || `UNIT-${Date.now().toString().slice(-4)}`,
    kodeUnit: input.kodeUnit.trim().toUpperCase(),
    namaUnit: input.namaUnit.trim(),
    urutan: Number(input.urutan) || 99,
    aktif: input.aktif,
  };
  return { ok: true, item, synced: false };
}

export async function deleteUnitRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteUnit', pin, { id });
    return { ok: res.ok, synced: true, error: res.error };
  }
  return { ok: true, synced: false };
}

export async function saveAppSettings(
  input: {
    namaAplikasi: string;
    logoDataUrl: string;
    rpkaDriveUrl: string;
    adminPin?: string;
    superAdminPin?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  saveLocalSettingsCache({
    namaAplikasi: input.namaAplikasi.trim() || 'DUWD DPP WI',
    logoDataUrl: input.logoDataUrl,
    rpkaDriveUrl: input.rpkaDriveUrl.trim(),
  });
  if (input.adminPin || input.superAdminPin) {
    saveLocalPins({
      admin: input.adminPin,
      superadmin: input.superAdminPin,
    });
  }

  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'updateSettings', pin, { ...input });
    return { ok: res.ok, synced: true, error: res.error };
  }
  return { ok: true, synced: false };
}
