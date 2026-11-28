import { STARTER_KODE_WILAYAH } from '../data/kodeWilayahSeed';
import { RPKA_2027_KEGIATAN, RPKA_2027_PROKER } from '../data/rpka2027Seed';
import type {
  AppSettings,
  BroadcastChannel,
  BroadcastConfigStatus,
  BroadcastItem,
  BroadcastModeKirim,
  DokumenFileItem,
  DokumenKategoriItem,
  DokumenSubkategoriItem,
  DokumenTipeItem,
  DpcItem,
  DpdItem,
  DprItem,
  DpwItem,
  KegiatanRpkaItem,
  KodeWilayahItem,
  MusyawarahItem,
  OrgDataset,
  PendataanLookupResult,
  PengurusItem,
  PresensiItem,
  ProgramKerjaItem,
  UnitItem,
  UserRole,
  WaGroupItem,
} from '../types/org';
import {
  normalizePresensiStatus,
  resolveJenisKegiatan,
  resolvePolaJadwal,
} from '../utils/scheduleParser';
import { normalizeWhatsApp } from '../utils/whatsapp';

export const DOKUMEN_DRIVE_ROOT_FOLDER_ID = '10RCn0CcMmFWqraQqJP0k0KYBFwN6_xew';
export const DOKUMEN_DRIVE_ROOT_URL =
  'https://drive.google.com/drive/folders/10RCn0CcMmFWqraQqJP0k0KYBFwN6_xew?usp=drive_link';

const STORAGE_KEYS = {
  GAS_URL: 'duwd_gas_webapp_url_v2',
  UNITS: 'duwd_units_cache_v3',
  PENGURUS: 'duwd_pengurus_cache_v2',
  PROKER: 'duwd_proker_cache_v3',
  KEGIATAN: 'duwd_kegiatan_cache_v2',
  MUSYAWARAH: 'duwd_musyawarah_cache_v1',
  PRESENSI: 'duwd_presensi_cache_v1',
  DOKUMEN_KATEGORI: 'duwd_dokumen_kategori_cache_v1',
  DOKUMEN_SUBKATEGORI: 'duwd_dokumen_subkategori_cache_v1',
  DOKUMEN_FILE: 'duwd_dokumen_file_cache_v1',
  KODE_WILAYAH: 'duwd_kode_wilayah_cache_v1',
  DPW: 'duwd_dpw_cache_v1',
  DPD: 'duwd_dpd_cache_v1',
  DPC: 'duwd_dpc_cache_v1',
  DPR: 'duwd_dpr_cache_v1',
  SETTINGS: 'duwd_settings_cache_v2',
  PINS: 'duwd_local_pins_v2',
  WA_GROUPS: 'duwd_wa_groups_local_v1',
  BROADCAST_QUEUE: 'duwd_broadcast_queue_local_v1',
};

export const STARTER_UNITS: UnitItem[] = [
  { id: 'UNIT-00', kodeUnit: 'PI', namaUnit: 'Pengurus Inti', urutan: 0, aktif: true },
  { id: 'UNIT-01', kodeUnit: 'EKSPANSI', namaUnit: 'PENDIRIAN DAN PEMBINAAN DPW DPD', urutan: 1, aktif: true },
  { id: 'UNIT-02', kodeUnit: 'KELEMBAGAAN', namaUnit: 'PENINGKATAN KUALITAS KELEMBAGAAN DPW DPD', urutan: 2, aktif: true },
  { id: 'UNIT-03', kodeUnit: 'KEPENGURUSAN', namaUnit: 'PENINGKATAN KUALITAS PENGURUS DPW DAN DPD', urutan: 3, aktif: true },
  { id: 'UNIT-04', kodeUnit: 'MONEV', namaUnit: 'MONITORING DAN EVALUASI KINERJA DPW DPD', urutan: 4, aktif: true },
  { id: 'UNIT-05', kodeUnit: 'INOVASI', namaUnit: 'PENINGKATAN KINERJA, MUTU, DAN INOVASI INTERNAL', urutan: 5, aktif: true },
];

const DEFAULT_PINS = {
  superadmin: 'duwd-super-2026',
  admin: 'duwd-admin-2026',
};

export function extractSpreadsheetId(raw: string): string {
  const val = raw.trim();
  if (!val) return '';
  const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] ? match[1] : val;
}

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
      wilayahSpreadsheetId: parsed.wilayahSpreadsheetId || '',
      gasWebAppUrl: gasUrl,
    };
  } catch {
    return {
      namaAplikasi: 'DUWD DPP WI',
      logoDataUrl: '',
      rpkaDriveUrl: '',
      wilayahSpreadsheetId: '',
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
  wilayahSpreadsheetId: string;
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
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((k) => ({
        ...k,
        jenisKegiatan: resolveJenisKegiatan(k),
        polaJadwal: resolvePolaJadwal(k),
      }));
    }
    return RPKA_2027_KEGIATAN;
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

export function loadLocalMusyawarah(): MusyawarahItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.MUSYAWARAH);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MusyawarahItem[];
    return Array.isArray(parsed)
      ? parsed.map((m) => ({
          ...m,
          musyawarahKe: Math.min(52, Math.max(1, Number(m.musyawarahKe) || 1)),
          pesertaTambahanIds: Array.isArray(m.pesertaTambahanIds) ? m.pesertaTambahanIds : [],
        }))
      : [];
  } catch {
    return [];
  }
}

export function saveLocalMusyawarah(list: MusyawarahItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.MUSYAWARAH, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalPresensi(): PresensiItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.PRESENSI);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PresensiItem[];
    return Array.isArray(parsed)
      ? parsed.map((p) => ({
          ...p,
          status: normalizePresensiStatus(p.status),
        }))
      : [];
  } catch {
    return [];
  }
}

export function saveLocalPresensi(list: PresensiItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.PRESENSI, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalDokumenKategori(): DokumenKategoriItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.DOKUMEN_KATEGORI);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DokumenKategoriItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalDokumenKategori(list: DokumenKategoriItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.DOKUMEN_KATEGORI, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalDokumenSubkategori(): DokumenSubkategoriItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.DOKUMEN_SUBKATEGORI);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DokumenSubkategoriItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalDokumenSubkategori(list: DokumenSubkategoriItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.DOKUMEN_SUBKATEGORI, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalDokumenFile(): DokumenFileItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.DOKUMEN_FILE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DokumenFileItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalDokumenFile(list: DokumenFileItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.DOKUMEN_FILE, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalKodeWilayah(): KodeWilayahItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.KODE_WILAYAH);
    if (!raw) return STARTER_KODE_WILAYAH;
    const parsed = JSON.parse(raw) as KodeWilayahItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : STARTER_KODE_WILAYAH;
  } catch {
    return STARTER_KODE_WILAYAH;
  }
}

export function saveLocalKodeWilayah(list: KodeWilayahItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.KODE_WILAYAH, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalDpw(): DpwItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.DPW);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DpwItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalDpw(list: DpwItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.DPW, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalDpd(): DpdItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.DPD);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DpdItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalDpd(list: DpdItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.DPD, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalDpc(): DpcItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.DPC);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DpcItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalDpc(list: DpcItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.DPC, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalDpr(): DprItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.DPR);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DprItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalDpr(list: DprItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.DPR, JSON.stringify(list));
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

interface GasJsonResponse<T> {
  ok: boolean;
  data?: T;
  role?: UserRole;
  error?: string;
  message?: string;
  masterName?: string;
  wilayahConnected?: boolean;
  wilayahName?: string;
  wilayahError?: string;
  count?: number;
}

async function parseGasResponse<T>(res: Response): Promise<GasJsonResponse<T>> {
  const rawText = await res.text();
  try {
    return JSON.parse(rawText) as GasJsonResponse<T>;
  } catch {
    if (rawText.includes('accounts.google.com') || rawText.includes('<!DOCTYPE html')) {
      return {
        ok: false,
        error:
          'Google Apps Script tidak mengembalikan JSON. Pastikan Deployment Web App diatur "Who has access: Anyone" dan menggunakan URL /exec terbaru.',
      };
    }
    return {
      ok: false,
      error: `Respons tidak valid dari Apps Script (HTTP ${res.status}).`,
    };
  }
}

async function gasGet<T>(
  webAppUrl: string,
  params: Record<string, string>,
): Promise<GasJsonResponse<T>> {
  try {
    const url = new URL(webAppUrl);
    Object.entries(params).forEach(([k, v]) => {
      url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString(), { method: 'GET' });
    return await parseGasResponse<T>(res);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Gagal menghubungi Google Apps Script.',
    };
  }
}

async function gasPost<T>(
  webAppUrl: string,
  action: string,
  pin: string,
  payload: Record<string, unknown>,
): Promise<GasJsonResponse<T>> {
  try {
    const res = await fetch(webAppUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, pin, payload }),
    });
    return await parseGasResponse<T>(res);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Gagal mengirim ke Google Apps Script: ${err.message}`
          : 'Gagal mengirim data ke Google Apps Script.',
    };
  }
}

export async function testGasConnection(webAppUrl: string): Promise<{
  ok: boolean;
  message: string;
  masterName?: string;
  wilayahConnected?: boolean;
  wilayahName?: string;
  wilayahError?: string;
}> {
  const cleanUrl = webAppUrl.trim();
  if (!cleanUrl) {
    return { ok: false, message: 'URL Web App Google Apps Script masih kosong.' };
  }
  const res = await gasGet(cleanUrl, { action: 'ping' });
  return {
    ok: Boolean(res.ok),
    message: res.message || res.error || 'Respons tidak dikenali dari Apps Script.',
    masterName: res.masterName,
    wilayahConnected: res.wilayahConnected,
    wilayahName: res.wilayahName,
    wilayahError: res.wilayahError,
  };
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
    musyawarah: loadLocalMusyawarah(),
    presensi: loadLocalPresensi(),
    dokumenKategori: loadLocalDokumenKategori(),
    dokumenSubkategori: loadLocalDokumenSubkategori(),
    dokumenFile: loadLocalDokumenFile(),
    kodeWilayah: loadLocalKodeWilayah(),
    dpw: loadLocalDpw(),
    dpd: loadLocalDpd(),
    dpc: loadLocalDpc(),
    dpr: loadLocalDpr(),
    wilayahConnected: false,
    settings: {
      namaAplikasi: localSettings.namaAplikasi,
      logoDataUrl: localSettings.logoDataUrl,
      rpkaDriveUrl: localSettings.rpkaDriveUrl,
      wilayahSpreadsheetId: localSettings.wilayahSpreadsheetId,
    },
  };

  if (!webAppUrl.trim()) {
    return { dataset: fallback, synced: false };
  }

  const res = await gasGet<OrgDataset>(webAppUrl.trim(), { action: 'getAllData' });
  if (res.ok && res.data) {
    const units = res.data.units?.length > 0 ? res.data.units : STARTER_UNITS;
    const proker = res.data.proker?.length > 0 ? res.data.proker : RPKA_2027_PROKER;
    const rawKegiatan = res.data.kegiatan?.length > 0 ? res.data.kegiatan : RPKA_2027_KEGIATAN;
    const kegiatan = rawKegiatan.map((k) => ({
      ...k,
      jenisKegiatan: resolveJenisKegiatan(k),
      polaJadwal: resolvePolaJadwal(k),
    }));
    const musyawarah = Array.isArray(res.data.musyawarah)
      ? res.data.musyawarah.map((m) => ({
          ...m,
          musyawarahKe: Math.min(52, Math.max(1, Number(m.musyawarahKe) || 1)),
          pesertaTambahanIds: Array.isArray(m.pesertaTambahanIds) ? m.pesertaTambahanIds : [],
        }))
      : loadLocalMusyawarah();
    const presensi = Array.isArray(res.data.presensi)
      ? res.data.presensi.map((p) => ({
          ...p,
          status: normalizePresensiStatus(p.status),
        }))
      : loadLocalPresensi();
    const dokumenKategori = Array.isArray(res.data.dokumenKategori)
      ? res.data.dokumenKategori
      : loadLocalDokumenKategori();
    const dokumenSubkategori = Array.isArray(res.data.dokumenSubkategori)
      ? res.data.dokumenSubkategori
      : loadLocalDokumenSubkategori();
    const dokumenFile = Array.isArray(res.data.dokumenFile)
      ? res.data.dokumenFile
      : loadLocalDokumenFile();
    const kodeWilayah =
      res.data.kodeWilayah?.length > 0 ? res.data.kodeWilayah : STARTER_KODE_WILAYAH;
    const dpw = Array.isArray(res.data.dpw) ? res.data.dpw : [];
    const dpd = Array.isArray(res.data.dpd) ? res.data.dpd : [];
    const dpc = Array.isArray(res.data.dpc) ? res.data.dpc : [];
    const dpr = Array.isArray(res.data.dpr) ? res.data.dpr : [];
    const wilayahConnected = Boolean(res.data.wilayahConnected);

    saveLocalUnits(units);
    saveLocalPengurus(res.data.pengurus || []);
    saveLocalProker(proker);
    saveLocalKegiatan(kegiatan);
    saveLocalMusyawarah(musyawarah);
    saveLocalPresensi(presensi);
    saveLocalDokumenKategori(dokumenKategori);
    saveLocalDokumenSubkategori(dokumenSubkategori);
    saveLocalDokumenFile(dokumenFile);
    saveLocalKodeWilayah(kodeWilayah);
    saveLocalDpw(dpw);
    saveLocalDpd(dpd);
    saveLocalDpc(dpc);
    saveLocalDpr(dpr);

    const nextSettings = {
      namaAplikasi: res.data.settings?.namaAplikasi || 'DUWD DPP WI',
      logoDataUrl: res.data.settings?.logoDataUrl || localSettings.logoDataUrl,
      rpkaDriveUrl: res.data.settings?.rpkaDriveUrl ?? localSettings.rpkaDriveUrl,
      wilayahSpreadsheetId:
        res.data.settings?.wilayahSpreadsheetId ?? localSettings.wilayahSpreadsheetId,
    };
    saveLocalSettingsCache(nextSettings);

    return {
      dataset: {
        units,
        pengurus: res.data.pengurus || [],
        proker,
        kegiatan,
        musyawarah,
        presensi,
        dokumenKategori,
        dokumenSubkategori,
        dokumenFile,
        kodeWilayah,
        dpw,
        dpd,
        dpc,
        dpr,
        wilayahConnected,
        settings: nextSettings,
      },
      synced: true,
    };
  }

  return { dataset: fallback, synced: false, error: res.error };
}

export async function fetchWilayahChildren(
  webAppUrl: string,
  params: { parentKode?: string; kodeProvinsi?: string; tingkat?: string },
): Promise<{ ok: boolean; data: KodeWilayahItem[]; error?: string }> {
  if (!webAppUrl.trim()) {
    return { ok: false, data: [], error: 'Web App GAS belum terhubung.' };
  }
  const query: Record<string, string> = { action: 'getWilayahChildren' };
  if (params.parentKode) query.parentKode = params.parentKode;
  if (params.kodeProvinsi) query.kodeProvinsi = params.kodeProvinsi;
  if (params.tingkat) query.tingkat = params.tingkat;

  const res = await gasGet<KodeWilayahItem[]>(webAppUrl.trim(), query);
  if (res.ok && Array.isArray(res.data)) {
    return { ok: true, data: res.data };
  }
  return { ok: false, data: [], error: res.error || 'Gagal mengambil detail wilayah.' };
}

export async function authenticatePin(
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; role?: UserRole; error?: string }> {
  const cleanPin = pin.trim();
  if (!cleanPin) return { ok: false, error: 'Masukkan PIN akses terlebih dahulu.' };

  if (webAppUrl.trim()) {
    const res = await gasGet(webAppUrl.trim(), { action: 'verifyPin', pin: cleanPin });
    if (res.ok && res.role) {
      return { ok: true, role: res.role };
    }
    if (res.error && !res.error.includes('Gagal menghubungi')) {
      return { ok: false, error: res.error || 'PIN akses tidak sesuai.' };
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
    email?: string;
    namaBank?: string;
    nomorRekening?: string;
    namaPemilikRekening?: string;
    dibuatPada?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: PengurusItem; synced: boolean; error?: string }> {
  const normalizedWa = normalizeWhatsApp(input.whatsapp);
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const cleanEmail = input.email !== undefined ? input.email.trim().toLowerCase() : undefined;
  const cleanBank = input.namaBank !== undefined ? input.namaBank.trim() : undefined;
  const cleanRek =
    input.nomorRekening !== undefined ? input.nomorRekening.replace(/\D/g, '') : undefined;
  const cleanPemilik =
    input.namaPemilikRekening !== undefined
      ? input.namaPemilikRekening.trim().toUpperCase()
      : undefined;

  if (webAppUrl.trim()) {
    const res = await gasPost<PengurusItem>(webAppUrl.trim(), 'savePengurus', pin, {
      ...input,
      whatsapp: normalizedWa,
      email: cleanEmail,
      namaBank: cleanBank,
      nomorRekening: cleanRek,
      namaPemilikRekening: cleanPemilik,
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
    email: cleanEmail,
    namaBank: cleanBank,
    nomorRekening: cleanRek,
    namaPemilikRekening: cleanPemilik,
    sudahPendataan: Boolean(cleanEmail && cleanRek),
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
    if (!res.ok) {
      return { ok: false, synced: false, error: res.error || 'Gagal menghapus dari Spreadsheet.' };
    }
    return { ok: true, synced: true };
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

export async function updateKegiatanJenisRecord(
  item: KegiatanRpkaItem,
  nextJenis: 'Event' | 'Monev',
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: KegiatanRpkaItem; synced: boolean; error?: string }> {
  const updatedLocal: KegiatanRpkaItem = { ...item, jenisKegiatan: nextJenis };
  if (webAppUrl.trim()) {
    const res = await gasPost<KegiatanRpkaItem>(webAppUrl.trim(), 'updateKegiatanJenis', pin, {
      kodeKegiatan: item.kodeKegiatan,
      jenisKegiatan: nextJenis,
      item: updatedLocal,
    });
    if (res.ok) {
      return { ok: true, item: res.data || updatedLocal, synced: true };
    }
    // Fallback ke saveKegiatan untuk GAS versi sebelumnya jika Super Admin
    const fallback = await gasPost<KegiatanRpkaItem>(webAppUrl.trim(), 'saveKegiatan', pin, {
      ...updatedLocal,
    });
    if (fallback.ok && fallback.data) {
      return { ok: true, item: fallback.data, synced: true };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || fallback.error || 'Gagal memperbarui kategori Event/Monev.',
    };
  }
  return { ok: true, item: updatedLocal, synced: false };
}

export async function deleteKegiatanRecord(
  kodeKegiatan: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteKegiatan', pin, { kodeKegiatan });
    if (!res.ok) {
      return { ok: false, synced: false, error: res.error || 'Gagal menghapus kegiatan.' };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export interface DriveUploadResult {
  ok: boolean;
  fileId?: string;
  fileName?: string;
  url?: string;
  previewUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export async function checkDriveAuthStatus(webAppUrl: string): Promise<{
  ok: boolean;
  authorized: boolean;
  folderName?: string;
  folderUrl?: string;
  message?: string;
}> {
  const cleanUrl = webAppUrl.trim();
  if (!cleanUrl) {
    return {
      ok: false,
      authorized: false,
      message: 'URL Web App Google Apps Script belum dihubungkan di menu Pengaturan.',
    };
  }
  const res = await gasGet<{
    authorized: boolean;
    folderName?: string;
    folderUrl?: string;
  }>(cleanUrl, { action: 'checkDriveAuth' });
  if (res.ok && res.data) {
    return {
      ok: true,
      authorized: Boolean(res.data.authorized),
      folderName: res.data.folderName,
      folderUrl: res.data.folderUrl,
      message: res.message,
    };
  }
  return {
    ok: false,
    authorized: false,
    message: res.error || 'Belum dapat memverifikasi izin Google Drive di Apps Script.',
  };
}

export async function uploadMusyawarahFileToDrive(
  input: {
    kind: 'notula_file' | 'dokumentasi';
    fileName: string;
    mimeType: string;
    base64Data: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<DriveUploadResult> {
  if (!webAppUrl.trim()) {
    return {
      ok: false,
      error:
        'URL Web App Google Apps Script belum terhubung. Hubungkan GAS di Pengaturan agar berkas otomatis terunggah ke Google Drive.',
    };
  }
  const res = await gasPost<{
    fileId: string;
    fileName: string;
    url: string;
    previewUrl: string;
    thumbnailUrl?: string;
  }>(webAppUrl.trim(), 'uploadMusyawarahFile', pin, input);
  if (res.ok && res.data) {
    return {
      ok: true,
      fileId: res.data.fileId,
      fileName: res.data.fileName,
      url: res.data.url,
      previewUrl: res.data.previewUrl,
      thumbnailUrl: res.data.thumbnailUrl,
    };
  }
  return {
    ok: false,
    error:
      res.error ||
      'Gagal mengunggah berkas ke Google Drive. Pastikan fungsi otorisasiGoogleDrive() sudah dijalankan di Apps Script.',
  };
}

export async function uploadMusyawarahNotulaTextToDrive(
  input: {
    baseFileName: string;
    judul: string;
    jenis: 'Pleno' | 'Unit';
    unitLabel?: string;
    musyawarahKe: number;
    tanggalFormatted: string;
    notulaTeks: string;
    presensiRingkasan?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<DriveUploadResult> {
  if (!webAppUrl.trim()) {
    return {
      ok: false,
      error:
        'URL Web App Google Apps Script belum terhubung. Teks notula disimpan secara lokal, namun konversi PDF ke Google Drive memerlukan koneksi GAS.',
    };
  }
  const res = await gasPost<{
    fileId: string;
    fileName: string;
    url: string;
    previewUrl: string;
  }>(webAppUrl.trim(), 'uploadMusyawarahNotulaText', pin, input);
  if (res.ok && res.data) {
    return {
      ok: true,
      fileId: res.data.fileId,
      fileName: res.data.fileName,
      url: res.data.url,
      previewUrl: res.data.previewUrl,
    };
  }
  return {
    ok: false,
    error:
      res.error ||
      'Gagal mengonversi teks notula ke PDF di Google Drive. Pastikan izin Drive & Docs sudah diotorisasi di Apps Script.',
  };
}

export async function saveMusyawarahRecord(
  input: Omit<MusyawarahItem, 'id'> & { id?: string },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: MusyawarahItem; synced: boolean; error?: string }> {
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const cleanPayload = {
    ...input,
    judul: input.judul.trim(),
    musyawarahKe: Math.min(52, Math.max(1, Math.round(Number(input.musyawarahKe) || 1))),
    tempat: (input.tempat || '').trim() || 'Online',
    pesertaTambahanIds: Array.isArray(input.pesertaTambahanIds)
      ? Array.from(new Set(input.pesertaTambahanIds))
      : [],
  };

  if (webAppUrl.trim()) {
    const res = await gasPost<MusyawarahItem>(webAppUrl.trim(), 'saveMusyawarah', pin, cleanPayload);
    if (res.ok && res.data) {
      return {
        ok: true,
        item: {
          ...res.data,
          musyawarahKe: Math.min(52, Math.max(1, Number(res.data.musyawarahKe) || cleanPayload.musyawarahKe)),
          pesertaTambahanIds: Array.isArray(res.data.pesertaTambahanIds)
            ? res.data.pesertaTambahanIds
            : cleanPayload.pesertaTambahanIds,
          dokumentasiPreviewUrl: input.dokumentasiPreviewUrl || res.data.dokumentasiPreviewUrl,
        },
        synced: true,
      };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal menyimpan data musyawarah ke Spreadsheet.',
    };
  }

  const item: MusyawarahItem = {
    ...cleanPayload,
    id: input.id || `MSY-${Date.now().toString().slice(-6)}`,
    dibuatPada: input.dibuatPada || nowStr,
    diperbaruiPada: nowStr,
  };
  return { ok: true, item, synced: false };
}

export async function deleteMusyawarahRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteMusyawarah', pin, { id });
    if (!res.ok) {
      return { ok: false, synced: false, error: res.error || 'Gagal menghapus musyawarah.' };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export async function savePresensiBatchRecord(
  musyawarahId: string,
  entries: PresensiItem[],
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; items?: PresensiItem[]; synced: boolean; error?: string }> {
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const normalized: PresensiItem[] = entries.map((e) => ({
    ...e,
    id: e.id || `${musyawarahId}__${e.pengurusId}`,
    musyawarahId,
    diperbaruiPada: nowStr,
  }));

  if (webAppUrl.trim()) {
    const res = await gasPost<PresensiItem[]>(webAppUrl.trim(), 'savePresensiBatch', pin, {
      musyawarahId,
      entries: normalized,
    });
    if (res.ok) {
      return {
        ok: true,
        items: Array.isArray(res.data) ? res.data : normalized,
        synced: true,
      };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal menyimpan presensi ke Spreadsheet.',
    };
  }

  return { ok: true, items: normalized, synced: false };
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
    urutan: Number(input.urutan) ?? 99,
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
    if (!res.ok) {
      return { ok: false, synced: false, error: res.error || 'Gagal menghapus Unit.' };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export function buildLembagaId(
  jenis: 'DPW' | 'DPD' | 'DPC' | 'DPR',
  kodeWilayah: string,
): string {
  const cleanKode = String(kodeWilayah || '').replace(/[^0-9a-zA-Z]/g, '');
  return `${jenis.toLowerCase()}-${cleanKode || Date.now().toString().slice(-6)}`;
}

export async function saveDpwRecord(
  input: Omit<DpwItem, 'id'> & { id?: string },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: DpwItem; synced: boolean; error?: string }> {
  const deterministicId = buildLembagaId('DPW', input.kodeWilayah);
  const payload = {
    ...input,
    id: deterministicId,
    ketuaNama: (input.ketuaNama || '').trim().toUpperCase(),
    ketuaWa: normalizeWhatsApp(input.ketuaWa),
    sekretarisNama: (input.sekretarisNama || '').trim().toUpperCase(),
    sekretarisWa: normalizeWhatsApp(input.sekretarisWa),
    alamatKantor: '',
    tautanDrive: '',
  };

  if (webAppUrl.trim()) {
    const res = await gasPost<DpwItem>(webAppUrl.trim(), 'saveDpw', pin, payload);
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal menyimpan DPW ke Spreadsheet #2.',
    };
  }

  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return {
    ok: true,
    synced: false,
    item: {
      ...payload,
      id: deterministicId,
      diperbaruiPada: nowStr,
    },
  };
}

export async function deleteDpwRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteDpw', pin, { id });
    if (!res.ok) {
      return { ok: false, synced: false, error: res.error || 'Gagal menghapus DPW.' };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export async function saveDpdRecord(
  input: Omit<DpdItem, 'id'> & { id?: string },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: DpdItem; synced: boolean; error?: string }> {
  const deterministicId = buildLembagaId('DPD', input.kodeWilayah);
  const payload = {
    ...input,
    id: deterministicId,
    ketuaNama: (input.ketuaNama || '').trim().toUpperCase(),
    ketuaWa: normalizeWhatsApp(input.ketuaWa),
    sekretarisNama: (input.sekretarisNama || '').trim().toUpperCase(),
    sekretarisWa: normalizeWhatsApp(input.sekretarisWa),
    alamatKantor: '',
    tautanDrive: '',
  };

  if (webAppUrl.trim()) {
    const res = await gasPost<DpdItem>(webAppUrl.trim(), 'saveDpd', pin, payload);
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal menyimpan DPD ke Spreadsheet #2.',
    };
  }

  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return {
    ok: true,
    synced: false,
    item: {
      ...payload,
      id: deterministicId,
      diperbaruiPada: nowStr,
    },
  };
}

export async function deleteDpdRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteDpd', pin, { id });
    if (!res.ok) {
      return { ok: false, synced: false, error: res.error || 'Gagal menghapus DPD.' };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export async function saveDpcRecord(
  input: Omit<DpcItem, 'id'> & { id?: string },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: DpcItem; synced: boolean; error?: string }> {
  const deterministicId = buildLembagaId('DPC', input.kodeWilayah);
  const payload = {
    ...input,
    id: deterministicId,
    ketuaNama: (input.ketuaNama || '').trim().toUpperCase(),
    ketuaWa: normalizeWhatsApp(input.ketuaWa),
    sekretarisNama: (input.sekretarisNama || '').trim().toUpperCase(),
    sekretarisWa: normalizeWhatsApp(input.sekretarisWa),
    alamatKantor: '',
    tautanDrive: '',
  };

  if (webAppUrl.trim()) {
    const res = await gasPost<DpcItem>(webAppUrl.trim(), 'saveDpc', pin, payload);
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal menyimpan DPC ke Spreadsheet #2.',
    };
  }

  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return {
    ok: true,
    synced: false,
    item: {
      ...payload,
      id: deterministicId,
      diperbaruiPada: nowStr,
    },
  };
}

export async function deleteDpcRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteDpc', pin, { id });
    if (!res.ok) {
      return { ok: false, synced: false, error: res.error || 'Gagal menghapus DPC.' };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export async function saveDprRecord(
  input: Omit<DprItem, 'id'> & { id?: string },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: DprItem; synced: boolean; error?: string }> {
  const deterministicId = buildLembagaId('DPR', input.kodeWilayah);
  const payload = {
    ...input,
    id: deterministicId,
    ketuaNama: (input.ketuaNama || '').trim().toUpperCase(),
    ketuaWa: normalizeWhatsApp(input.ketuaWa),
    sekretarisNama: (input.sekretarisNama || '').trim().toUpperCase(),
    sekretarisWa: normalizeWhatsApp(input.sekretarisWa),
    alamatKantor: '',
    tautanDrive: '',
  };

  if (webAppUrl.trim()) {
    const res = await gasPost<DprItem>(webAppUrl.trim(), 'saveDpr', pin, payload);
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal menyimpan DPR ke Spreadsheet #2.',
    };
  }

  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  return {
    ok: true,
    synced: false,
    item: {
      ...payload,
      id: deterministicId,
      diperbaruiPada: nowStr,
    },
  };
}

export async function deleteDprRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteDpr', pin, { id });
    if (!res.ok) {
      return { ok: false, synced: false, error: res.error || 'Gagal menghapus DPR.' };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export async function importKodeWilayahBatch(
  rows: KodeWilayahItem[],
  replaceAll: boolean,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; count?: number; synced: boolean; error?: string }> {
  if (!webAppUrl.trim()) {
    saveLocalKodeWilayah(rows);
    return { ok: true, count: rows.length, synced: false };
  }
  const res = await gasPost(webAppUrl.trim(), 'importKodeWilayah', pin, {
    rows,
    replaceAll,
  });
  if (!res.ok) {
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal mengimpor kode wilayah ke Spreadsheet #2.',
    };
  }
  return { ok: true, count: res.count || rows.length, synced: true };
}

export async function setupWilayahSpreadsheetRemote(
  wilayahSpreadsheetId: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; message?: string; error?: string }> {
  if (!webAppUrl.trim()) {
    return { ok: false, error: 'URL Web App Google Apps Script (/exec) belum diisi.' };
  }
  const cleanId = extractSpreadsheetId(wilayahSpreadsheetId);
  const res = await gasPost<{ wilayahSpreadsheetId: string; wilayahName: string }>(
    webAppUrl.trim(),
    'setupWilayahSpreadsheet',
    pin,
    { wilayahSpreadsheetId: cleanId },
  );
  if (!res.ok) {
    return { ok: false, error: res.error || 'Gagal menyiapkan Spreadsheet #2.' };
  }
  return { ok: true, message: res.message };
}

export async function saveAppSettings(
  input: {
    namaAplikasi: string;
    logoDataUrl: string;
    rpkaDriveUrl: string;
    wilayahSpreadsheetId: string;
    adminPin?: string;
    superAdminPin?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  const cleanWilayahId = extractSpreadsheetId(input.wilayahSpreadsheetId);

  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'updateSettings', pin, {
      ...input,
      wilayahSpreadsheetId: cleanWilayahId,
    });
    if (!res.ok) {
      return {
        ok: false,
        synced: false,
        error: res.error || 'Gagal menyimpan pengaturan ke Spreadsheet.',
      };
    }
  }

  saveLocalSettingsCache({
    namaAplikasi: input.namaAplikasi.trim() || 'DUWD DPP WI',
    logoDataUrl: input.logoDataUrl,
    rpkaDriveUrl: input.rpkaDriveUrl.trim(),
    wilayahSpreadsheetId: cleanWilayahId,
  });

  if (input.adminPin || input.superAdminPin) {
    saveLocalPins({
      admin: input.adminPin,
      superadmin: input.superAdminPin,
    });
  }

  return { ok: true, synced: Boolean(webAppUrl.trim()) };
}

// ============================================================================
// PUSAT DOKUMEN — KATEGORI, SUBFOLDER & UPLOAD GOOGLE DRIVE (TERMASUK ZIP)
// ============================================================================

export async function saveDokumenKategoriRecord(
  input: {
    id?: string;
    namaKategori: string;
    deskripsi?: string;
    urutan: number;
    tanggalUpdate: string;
    driveFolderId?: string;
    driveFolderUrl?: string;
    dibuatPada?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: DokumenKategoriItem; synced: boolean; error?: string }> {
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const payload = {
    ...input,
    namaKategori: input.namaKategori.trim(),
    deskripsi: (input.deskripsi || '').trim(),
    urutan: Number(input.urutan) || 1,
    tanggalUpdate: input.tanggalUpdate.trim() || nowStr.slice(0, 10),
  };

  if (webAppUrl.trim()) {
    const res = await gasPost<DokumenKategoriItem>(
      webAppUrl.trim(),
      'saveDokumenKategori',
      pin,
      payload,
    );
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal menyimpan kategori dokumen ke Spreadsheet & Drive.',
    };
  }

  const item: DokumenKategoriItem = {
    id: input.id || `KAT-${Date.now().toString().slice(-6)}`,
    namaKategori: payload.namaKategori,
    deskripsi: payload.deskripsi,
    urutan: payload.urutan,
    driveFolderId: input.driveFolderId || '',
    driveFolderUrl: input.driveFolderUrl || DOKUMEN_DRIVE_ROOT_URL,
    tanggalUpdate: payload.tanggalUpdate,
    dibuatPada: input.dibuatPada || nowStr,
    diperbaruiPada: nowStr,
  };
  return { ok: true, item, synced: false };
}

export async function deleteDokumenKategoriRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteDokumenKategori', pin, { id });
    if (!res.ok) {
      return {
        ok: false,
        synced: false,
        error: res.error || 'Gagal menghapus kategori dokumen.',
      };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export async function uploadDokumenFileToDrive(
  input: {
    kategoriId: string;
    namaKategori: string;
    subfolder: string;
    judulDokumen: string;
    originalFileName: string;
    mimeType: string;
    ukuranBytes: number;
    base64Data: string;
    extractZip: boolean;
    tanggalUpdate: string;
    keterangan?: string;
    replaceDokumenId?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{
  ok: boolean;
  items?: DokumenFileItem[];
  categoryFolderId?: string;
  categoryFolderUrl?: string;
  synced: boolean;
  error?: string;
}> {
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const extMatch = input.originalFileName.match(/\.([a-zA-Z0-9]+)$/);
  const ext = extMatch?.[1] ? extMatch[1].toLowerCase() : 'file';

  if (webAppUrl.trim()) {
    const res = await gasPost<{
      items: DokumenFileItem[];
      categoryFolderId?: string;
      categoryFolderUrl?: string;
    }>(webAppUrl.trim(), 'uploadDokumenFile', pin, input);
    if (res.ok && res.data && Array.isArray(res.data.items)) {
      return {
        ok: true,
        items: res.data.items,
        categoryFolderId: res.data.categoryFolderId,
        categoryFolderUrl: res.data.categoryFolderUrl,
        synced: true,
      };
    }
    return {
      ok: false,
      synced: false,
      error:
        res.error ||
        'Gagal mengunggah berkas ke Google Drive. Pastikan fungsi otorisasiGoogleDrive() sudah dijalankan dan Deploy New Version aktif.',
    };
  }

  // Fallback pratinjau lokal jika GAS belum terhubung
  const cleanTitle = input.judulDokumen.trim() || input.originalFileName.replace(/\.[^.]+$/, '');
  const renamed = input.subfolder.trim()
    ? `${input.namaKategori} - ${input.subfolder.trim()} - ${cleanTitle}.${ext}`
    : cleanTitle.toLowerCase() === input.namaKategori.trim().toLowerCase()
      ? `${cleanTitle}.${ext}`
      : `${input.namaKategori} - ${cleanTitle}.${ext}`;

  const localItem: DokumenFileItem = {
    id: input.replaceDokumenId || `DOK-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`,
    kategoriId: input.kategoriId,
    namaKategori: input.namaKategori,
    subfolder: input.subfolder.trim(),
    judulDokumen: cleanTitle,
    namaFileDrive: renamed,
    ekstensi: ext,
    mimeType: input.mimeType,
    ukuranBytes: input.ukuranBytes,
    driveFileId: '',
    driveFileUrl: DOKUMEN_DRIVE_ROOT_URL,
    driveFolderId: '',
    driveFolderUrl: DOKUMEN_DRIVE_ROOT_URL,
    tanggalUpdate: input.tanggalUpdate || nowStr.slice(0, 10),
    keterangan: (input.keterangan || '').trim(),
    dibuatPada: nowStr,
    diperbaruiPada: nowStr,
  };
  return { ok: true, items: [localItem], synced: false };
}

export async function reorderDokumenKategoriRecords(
  orders: { id: string; urutan: number }[],
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'reorderDokumenKategori', pin, { orders });
    if (!res.ok) {
      return {
        ok: false,
        synced: false,
        error: res.error || 'Gagal menyimpan urutan kategori dokumen.',
      };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export async function saveDokumenSubkategoriRecord(
  input: {
    id?: string;
    kategoriId: string;
    namaKategori: string;
    namaSubkategori: string;
    urutan: number;
    tanggalUpdate: string;
    driveFolderId?: string;
    driveFolderUrl?: string;
    dibuatPada?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{
  ok: boolean;
  item?: DokumenSubkategoriItem;
  synced: boolean;
  error?: string;
}> {
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const payload = {
    ...input,
    namaSubkategori: input.namaSubkategori.trim(),
    urutan: Number(input.urutan) || 1,
    tanggalUpdate: input.tanggalUpdate.trim() || nowStr.slice(0, 10),
  };

  if (webAppUrl.trim()) {
    const res = await gasPost<DokumenSubkategoriItem>(
      webAppUrl.trim(),
      'saveDokumenSubkategori',
      pin,
      payload,
    );
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal menyimpan subkategori dokumen ke Spreadsheet & Drive.',
    };
  }

  const item: DokumenSubkategoriItem = {
    id: input.id || `SUB-${Date.now().toString().slice(-6)}`,
    kategoriId: payload.kategoriId,
    namaKategori: payload.namaKategori,
    namaSubkategori: payload.namaSubkategori,
    urutan: payload.urutan,
    driveFolderId: input.driveFolderId || '',
    driveFolderUrl: input.driveFolderUrl || DOKUMEN_DRIVE_ROOT_URL,
    tanggalUpdate: payload.tanggalUpdate,
    dibuatPada: input.dibuatPada || nowStr,
    diperbaruiPada: nowStr,
  };
  return { ok: true, item, synced: false };
}

export async function deleteDokumenSubkategoriRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteDokumenSubkategori', pin, { id });
    if (!res.ok) {
      return {
        ok: false,
        synced: false,
        error: res.error || 'Gagal menghapus subkategori dokumen.',
      };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export async function saveDokumenFileRecord(
  input: {
    id?: string;
    kategoriId: string;
    namaKategori: string;
    subfolder: string;
    judulDokumen: string;
    tipeItem?: DokumenTipeItem;
    namaFileDrive?: string;
    ekstensi?: string;
    mimeType?: string;
    ukuranBytes?: number;
    driveFileId?: string;
    driveFileUrl: string;
    driveFolderId?: string;
    driveFolderUrl?: string;
    tanggalUpdate: string;
    keterangan?: string;
    jumlahDilihat?: number;
    jumlahDiunduh?: number;
    dibuatPada?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: DokumenFileItem; synced: boolean; error?: string }> {
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const tipeItem: DokumenTipeItem = input.tipeItem || (input.driveFileId ? 'file' : 'link');
  const payload = {
    ...input,
    tipeItem,
    subfolder: (input.subfolder || '').trim(),
    judulDokumen: input.judulDokumen.trim(),
    driveFileUrl: input.driveFileUrl.trim(),
    tanggalUpdate: input.tanggalUpdate.trim() || nowStr.slice(0, 10),
    keterangan: (input.keterangan || '').trim(),
  };

  if (webAppUrl.trim()) {
    const res = await gasPost<DokumenFileItem>(
      webAppUrl.trim(),
      'saveDokumenFile',
      pin,
      payload,
    );
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal memperbarui dokumen di Spreadsheet & Google Drive.',
    };
  }

  const item: DokumenFileItem = {
    id: input.id || `DOK-${Date.now().toString().slice(-6)}`,
    kategoriId: payload.kategoriId,
    namaKategori: payload.namaKategori,
    subfolder: payload.subfolder,
    judulDokumen: payload.judulDokumen,
    tipeItem,
    namaFileDrive: input.namaFileDrive || payload.judulDokumen,
    ekstensi: input.ekstensi || (tipeItem === 'link' ? 'link' : 'file'),
    mimeType: input.mimeType || '',
    ukuranBytes: input.ukuranBytes || 0,
    driveFileId: input.driveFileId || '',
    driveFileUrl: payload.driveFileUrl,
    driveFolderId: input.driveFolderId || '',
    driveFolderUrl: input.driveFolderUrl || DOKUMEN_DRIVE_ROOT_URL,
    tanggalUpdate: payload.tanggalUpdate,
    keterangan: payload.keterangan,
    jumlahDilihat: Number(input.jumlahDilihat || 0),
    jumlahDiunduh: Number(input.jumlahDiunduh || 0),
    dibuatPada: input.dibuatPada || nowStr,
    diperbaruiPada: nowStr,
  };
  return { ok: true, item, synced: false };
}

export async function deleteDokumenFileRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteDokumenFile', pin, { id });
    if (!res.ok) {
      return {
        ok: false,
        synced: false,
        error: res.error || 'Gagal menghapus file dokumen.',
      };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export async function trackDokumenStatRecord(
  id: string,
  metric: 'view' | 'download',
  webAppUrl: string,
): Promise<{ ok: boolean; jumlahDilihat?: number; jumlahDiunduh?: number }> {
  if (!webAppUrl.trim() || !id.trim()) {
    return { ok: false };
  }
  const res = await gasPost<{
    id: string;
    jumlahDilihat: number;
    jumlahDiunduh: number;
  }>(webAppUrl.trim(), 'trackDokumenStat', '', { id, metric });
  if (res.ok && res.data) {
    return {
      ok: true,
      jumlahDilihat: Number(res.data.jumlahDilihat || 0),
      jumlahDiunduh: Number(res.data.jumlahDiunduh || 0),
    };
  }
  return { ok: false };
}

// ============================================================================
// PENDATAAN EMAIL & NOMOR REKENING PENGURUS (/data-pengurus)
// ============================================================================

export async function lookupPengurusByWa(
  whatsapp: string,
  webAppUrl: string,
): Promise<{
  ok: boolean;
  found: boolean;
  pengurus?: PendataanLookupResult;
  error?: string;
}> {
  const normalized = normalizeWhatsApp(whatsapp);
  if (!normalized || normalized.length < 9) {
    return {
      ok: false,
      found: false,
      error: 'Masukkan nomor WhatsApp yang valid.',
    };
  }

  if (webAppUrl.trim()) {
    const res = await gasPost<{
      found: boolean;
      pengurus?: PendataanLookupResult;
    }>(webAppUrl.trim(), 'lookupPengurusByWa', '', { whatsapp: normalized });
    if (res.ok && res.data) {
      return {
        ok: true,
        found: Boolean(res.data.found),
        pengurus: res.data.pengurus,
      };
    }
    return {
      ok: false,
      found: false,
      error: res.error || 'Gagal memeriksa nomor WhatsApp ke server.',
    };
  }

  // Fallback lokal bila GAS belum dihubungkan
  const localList = loadLocalPengurus();
  const units = loadLocalUnits();
  const matched = localList.find((p) => normalizeWhatsApp(p.whatsapp) === normalized);
  if (!matched) {
    return { ok: true, found: false };
  }
  const unitObj = units.find((u) => u.id === matched.unitId);
  return {
    ok: true,
    found: true,
    pengurus: {
      id: matched.id,
      namaLengkap: matched.namaLengkap,
      namaPanggilan: matched.namaPanggilan,
      whatsapp: matched.whatsapp,
      unitId: matched.unitId,
      namaUnit: matched.namaUnit,
      kodeUnit: unitObj?.kodeUnit || '',
      amanah: matched.amanah,
      email: matched.email || '',
      namaBank: matched.namaBank || '',
      nomorRekening: matched.nomorRekening || '',
      namaPemilikRekening: matched.namaPemilikRekening || '',
      pendataanDiperbaruiPada: matched.pendataanDiperbaruiPada || '',
    },
  };
}

export async function submitPendataanPengurus(
  payload: {
    id: string;
    whatsapp: string;
    email: string;
    namaBank: string;
    nomorRekening: string;
    namaPemilikRekening: string;
  },
  webAppUrl: string,
): Promise<{
  ok: boolean;
  pengurus?: PendataanLookupResult;
  synced: boolean;
  error?: string;
}> {
  const cleanPayload = {
    id: payload.id.trim(),
    whatsapp: normalizeWhatsApp(payload.whatsapp),
    email: payload.email.trim().toLowerCase(),
    namaBank: payload.namaBank.trim(),
    nomorRekening: payload.nomorRekening.replace(/\D/g, ''),
    namaPemilikRekening: payload.namaPemilikRekening.trim().toUpperCase(),
  };

  if (webAppUrl.trim()) {
    const res = await gasPost<PendataanLookupResult>(
      webAppUrl.trim(),
      'submitPendataanPengurus',
      '',
      cleanPayload,
    );
    if (res.ok && res.data) {
      return { ok: true, pengurus: res.data, synced: true };
    }
    return {
      ok: false,
      synced: false,
      error: res.error || 'Gagal menyimpan data pendataan pengurus.',
    };
  }

  // Fallback lokal
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const list = loadLocalPengurus();
  let updatedItem: PengurusItem | undefined;
  const next = list.map((p) => {
    if (p.id !== cleanPayload.id) return p;
    updatedItem = {
      ...p,
      email: cleanPayload.email,
      namaBank: cleanPayload.namaBank,
      nomorRekening: cleanPayload.nomorRekening,
      namaPemilikRekening: cleanPayload.namaPemilikRekening,
      pendataanDiperbaruiPada: nowStr,
      sudahPendataan: true,
      diperbaruiPada: nowStr,
    };
    return updatedItem;
  });
  if (!updatedItem) {
    return { ok: false, synced: false, error: 'Data pengurus tidak ditemukan.' };
  }
  saveLocalPengurus(next);
  return {
    ok: true,
    synced: false,
    pengurus: {
      id: updatedItem.id,
      namaLengkap: updatedItem.namaLengkap,
      namaPanggilan: updatedItem.namaPanggilan,
      whatsapp: updatedItem.whatsapp,
      unitId: updatedItem.unitId,
      namaUnit: updatedItem.namaUnit,
      amanah: updatedItem.amanah,
      email: updatedItem.email,
      namaBank: updatedItem.namaBank,
      nomorRekening: updatedItem.nomorRekening,
      namaPemilikRekening: updatedItem.namaPemilikRekening,
      pendataanDiperbaruiPada: updatedItem.pendataanDiperbaruiPada,
    },
  };
}

// ============================================================================
// BROADCAST (WHATSAPP RECHAT & EMAIL ALIAS) + DATA PRIVAT PENGURUS (ADMIN)
// ============================================================================

export function loadLocalWaGroups(): WaGroupItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.WA_GROUPS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WaGroupItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalWaGroups(list: WaGroupItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.WA_GROUPS, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export function loadLocalBroadcastQueue(): BroadcastItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.BROADCAST_QUEUE);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as BroadcastItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalBroadcastQueue(list: BroadcastItem[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEYS.BROADCAST_QUEUE, JSON.stringify(list));
  } catch {
    // Ignore
  }
}

export const DEFAULT_BROADCAST_CONFIG: BroadcastConfigStatus = {
  rechatConfigured: false,
  rechatKeyMasked: '',
  rechatApiUrl: 'https://www.rechat.id/api/v1/messages',
  emailAlias: 'dppwiduwd@gmail.com',
  emailSenderName: 'DUWD DPP Wahdah Islamiyah',
  triggerActive: false,
  availableEmailAliases: [],
};

export async function fetchPrivatePengurusAndBroadcast(
  pin: string,
  webAppUrl: string,
): Promise<{
  ok: boolean;
  pengurus?: PengurusItem[];
  waGroups: WaGroupItem[];
  broadcastQueue: BroadcastItem[];
  broadcastConfig: BroadcastConfigStatus;
  error?: string;
}> {
  if (!webAppUrl.trim() || !pin.trim()) {
    return {
      ok: true,
      waGroups: loadLocalWaGroups(),
      broadcastQueue: loadLocalBroadcastQueue(),
      broadcastConfig: DEFAULT_BROADCAST_CONFIG,
    };
  }

  const res = await gasPost<{
    pengurus: PengurusItem[];
    waGroups: WaGroupItem[];
    broadcastQueue: BroadcastItem[];
    broadcastConfig: BroadcastConfigStatus;
  }>(webAppUrl.trim(), 'getPrivatePengurusAndBroadcast', pin, {});

  if (res.ok && res.data) {
    const waGroups = Array.isArray(res.data.waGroups) ? res.data.waGroups : [];
    const broadcastQueue = Array.isArray(res.data.broadcastQueue) ? res.data.broadcastQueue : [];
    const broadcastConfig = res.data.broadcastConfig || DEFAULT_BROADCAST_CONFIG;
    saveLocalWaGroups(waGroups);
    saveLocalBroadcastQueue(broadcastQueue);
    return {
      ok: true,
      pengurus: Array.isArray(res.data.pengurus) ? res.data.pengurus : undefined,
      waGroups,
      broadcastQueue,
      broadcastConfig,
    };
  }

  return {
    ok: false,
    waGroups: loadLocalWaGroups(),
    broadcastQueue: loadLocalBroadcastQueue(),
    broadcastConfig: DEFAULT_BROADCAST_CONFIG,
    error: res.error || 'Gagal memuat data broadcast & pendataan pengurus.',
  };
}

export async function saveBroadcastConfigRecord(
  input: {
    rechatApiKey?: string;
    clearRechatApiKey?: boolean;
    rechatApiUrl?: string;
    emailAlias?: string;
    emailSenderName?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{
  ok: boolean;
  broadcastConfig?: BroadcastConfigStatus;
  message?: string;
  error?: string;
}> {
  if (!webAppUrl.trim()) {
    return {
      ok: false,
      error: 'URL Web App Google Apps Script belum dihubungkan di menu Pengaturan.',
    };
  }
  const res = await gasPost<BroadcastConfigStatus>(
    webAppUrl.trim(),
    'saveBroadcastConfig',
    pin,
    input,
  );
  if (res.ok) {
    return {
      ok: true,
      broadcastConfig: res.data,
      message: res.message || 'Konfigurasi Broadcast tersimpan aman di Google Apps Script.',
    };
  }
  return {
    ok: false,
    error: res.error || 'Gagal menyimpan konfigurasi Broadcast.',
  };
}

export async function installBroadcastTriggerRemote(
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; triggerActive?: boolean; message?: string; error?: string }> {
  if (!webAppUrl.trim()) {
    return { ok: false, error: 'URL Web App GAS belum terhubung.' };
  }
  const res = await gasPost<{ triggerActive: boolean }>(
    webAppUrl.trim(),
    'installBroadcastTrigger',
    pin,
    {},
  );
  if (res.ok) {
    return {
      ok: true,
      triggerActive: Boolean(res.data?.triggerActive ?? true),
      message: res.message || 'Jadwal otomatis Broadcast (setiap 5 menit) aktif.',
    };
  }
  return { ok: false, error: res.error || 'Gagal mengaktifkan trigger otomatis Broadcast.' };
}

export async function saveWaGroupRecord(
  input: {
    id?: string;
    namaGrup: string;
    groupId: string;
    keterangan?: string;
    dibuatPada?: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: WaGroupItem; synced: boolean; error?: string }> {
  const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const cleanGroupId = input.groupId.trim();
  const payload = {
    ...input,
    namaGrup: input.namaGrup.trim(),
    groupId: cleanGroupId,
    keterangan: (input.keterangan || '').trim(),
  };

  if (webAppUrl.trim()) {
    const res = await gasPost<WaGroupItem>(webAppUrl.trim(), 'saveWaGroup', pin, payload);
    if (res.ok && res.data) {
      return { ok: true, item: res.data, synced: true };
    }
    return { ok: false, synced: false, error: res.error || 'Gagal menyimpan grup WhatsApp.' };
  }

  const item: WaGroupItem = {
    id: input.id || `GRP-${Date.now().toString().slice(-6)}`,
    namaGrup: payload.namaGrup,
    groupId: payload.groupId,
    keterangan: payload.keterangan,
    dibuatPada: input.dibuatPada || nowStr,
    diperbaruiPada: nowStr,
  };
  return { ok: true, item, synced: false };
}

export async function deleteWaGroupRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; synced: boolean; error?: string }> {
  if (webAppUrl.trim()) {
    const res = await gasPost(webAppUrl.trim(), 'deleteWaGroup', pin, { id });
    if (!res.ok) {
      return { ok: false, synced: false, error: res.error || 'Gagal menghapus grup WhatsApp.' };
    }
    return { ok: true, synced: true };
  }
  return { ok: true, synced: false };
}

export async function uploadBroadcastImageToDrive(
  input: {
    fileName: string;
    mimeType: string;
    base64Data: string;
  },
  pin: string,
  webAppUrl: string,
): Promise<{
  ok: boolean;
  fileId?: string;
  fileName?: string;
  imageUrl?: string;
  driveUrl?: string;
  error?: string;
}> {
  if (!webAppUrl.trim()) {
    return {
      ok: false,
      error: 'URL Web App Google Apps Script belum terhubung untuk unggah foto broadcast.',
    };
  }
  const res = await gasPost<{
    fileId: string;
    fileName: string;
    imageUrl: string;
    driveUrl: string;
  }>(webAppUrl.trim(), 'uploadBroadcastImage', pin, input);
  if (res.ok && res.data) {
    return {
      ok: true,
      fileId: res.data.fileId,
      fileName: res.data.fileName,
      imageUrl: res.data.imageUrl,
      driveUrl: res.data.driveUrl,
    };
  }
  return {
    ok: false,
    error: res.error || 'Gagal mengunggah foto broadcast ke Google Drive.',
  };
}

export async function sendOrScheduleBroadcastRecord(
  input: {
    judul: string;
    channel: BroadcastChannel;
    targetPengurusIds: string[];
    targetGroupIds: string[];
    targetSummary: string;
    pesanWa: string;
    emailSubject: string;
    emailBody: string;
    imageBase64?: string;
    imageMimeType?: string;
    imageName?: string;
    modeKirim: BroadcastModeKirim;
    jadwalKirim?: string; // YYYY-MM-DD HH:mm (WITA)
    delayDetik?: number; // Jeda antar pesan dalam detik (0 - 300)
  },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: BroadcastItem; message?: string; error?: string }> {
  if (!webAppUrl.trim()) {
    return {
      ok: false,
      error: 'URL Web App Google Apps Script belum terhubung. Hubungkan GAS terlebih dahulu untuk mengirim Broadcast.',
    };
  }
  const res = await gasPost<BroadcastItem>(
    webAppUrl.trim(),
    'sendOrScheduleBroadcast',
    pin,
    input,
  );
  if (res.ok && res.data) {
    return {
      ok: true,
      item: res.data,
      message: res.message,
    };
  }
  return {
    ok: false,
    error: res.error || 'Gagal memproses Broadcast.',
  };
}

export async function cancelScheduledBroadcastRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: BroadcastItem; error?: string }> {
  if (!webAppUrl.trim()) {
    return { ok: false, error: 'URL Web App GAS belum terhubung.' };
  }
  const res = await gasPost<BroadcastItem>(
    webAppUrl.trim(),
    'cancelScheduledBroadcast',
    pin,
    { id },
  );
  if (res.ok) {
    return { ok: true, item: res.data };
  }
  return { ok: false, error: res.error || 'Gagal membatalkan jadwal Broadcast.' };
}

export async function deleteBroadcastItemRecord(
  id: string,
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!webAppUrl.trim()) {
    return { ok: true };
  }
  const res = await gasPost(webAppUrl.trim(), 'deleteBroadcastItem', pin, { id });
  if (!res.ok) {
    return { ok: false, error: res.error || 'Gagal menghapus riwayat Broadcast.' };
  }
  return { ok: true };
}

export async function runDueBroadcastsNowRecord(
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; processed?: number; message?: string; error?: string }> {
  if (!webAppUrl.trim()) {
    return { ok: false, error: 'URL Web App GAS belum terhubung.' };
  }
  const res = await gasPost<{ processed: number }>(
    webAppUrl.trim(),
    'runDueBroadcastsNow',
    pin,
    {},
  );
  if (res.ok) {
    return {
      ok: true,
      processed: Number(res.data?.processed || 0),
      message: res.message,
    };
  }
  return { ok: false, error: res.error || 'Gagal menjalankan antrean jadwal Broadcast.' };
}
