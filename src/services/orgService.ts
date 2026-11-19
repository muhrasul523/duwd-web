import { STARTER_KODE_WILAYAH } from '../data/kodeWilayahSeed';
import { RPKA_2027_KEGIATAN, RPKA_2027_PROKER } from '../data/rpka2027Seed';
import type {
  AppSettings,
  DpcItem,
  DpdItem,
  DprItem,
  DpwItem,
  KegiatanRpkaItem,
  KodeWilayahItem,
  MusyawarahItem,
  OrgDataset,
  PengurusItem,
  PresensiItem,
  ProgramKerjaItem,
  UnitItem,
  UserRole,
} from '../types/org';
import {
  normalizePresensiStatus,
  resolveJenisKegiatan,
  resolvePolaJadwal,
} from '../utils/scheduleParser';
import { normalizeWhatsApp } from '../utils/whatsapp';

const STORAGE_KEYS = {
  GAS_URL: 'duwd_gas_webapp_url_v2',
  UNITS: 'duwd_units_cache_v3',
  PENGURUS: 'duwd_pengurus_cache_v2',
  PROKER: 'duwd_proker_cache_v3',
  KEGIATAN: 'duwd_kegiatan_cache_v2',
  MUSYAWARAH: 'duwd_musyawarah_cache_v1',
  PRESENSI: 'duwd_presensi_cache_v1',
  KODE_WILAYAH: 'duwd_kode_wilayah_cache_v1',
  DPW: 'duwd_dpw_cache_v1',
  DPD: 'duwd_dpd_cache_v1',
  DPC: 'duwd_dpc_cache_v1',
  DPR: 'duwd_dpr_cache_v1',
  SETTINGS: 'duwd_settings_cache_v2',
  PINS: 'duwd_local_pins_v2',
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

export async function saveDpwRecord(
  input: Omit<DpwItem, 'id'> & { id?: string },
  pin: string,
  webAppUrl: string,
): Promise<{ ok: boolean; item?: DpwItem; synced: boolean; error?: string }> {
  const payload = {
    ...input,
    ketuaWa: normalizeWhatsApp(input.ketuaWa),
    sekretarisWa: normalizeWhatsApp(input.sekretarisWa),
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
      id: input.id || `DPW-${Date.now().toString().slice(-6)}`,
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
  const payload = {
    ...input,
    ketuaWa: normalizeWhatsApp(input.ketuaWa),
    sekretarisWa: normalizeWhatsApp(input.sekretarisWa),
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
      id: input.id || `DPD-${Date.now().toString().slice(-6)}`,
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
  const payload = {
    ...input,
    ketuaWa: normalizeWhatsApp(input.ketuaWa),
    sekretarisWa: normalizeWhatsApp(input.sekretarisWa),
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
      id: input.id || `DPC-${Date.now().toString().slice(-6)}`,
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
  const payload = {
    ...input,
    ketuaWa: normalizeWhatsApp(input.ketuaWa),
    sekretarisWa: normalizeWhatsApp(input.sekretarisWa),
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
      id: input.id || `DPR-${Date.now().toString().slice(-6)}`,
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
