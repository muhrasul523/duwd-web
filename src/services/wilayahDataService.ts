import { STARTER_KODE_WILAYAH } from '../data/kodeWilayahSeed';
import type { KodeWilayahItem } from '../types/org';

export interface WilayahPulauOption {
  id: string;
  nama: string;
}

export interface WilayahProvOption {
  kode: string;
  nama: string;
  pulau: string;
  pulauId: string;
}

export interface WilayahKabOption {
  kode: string;
  nama: string;
  kodeProv: string;
  namaProv: string;
  pulau: string;
}

export interface WilayahKecOption {
  kode: string;
  nama: string;
  kodeKab: string;
  namaKab: string;
  kodeProv: string;
  namaProv: string;
  pulau: string;
}

export interface WilayahKelOption {
  kode: string;
  nama: string;
  kodeKec: string;
  namaKec: string;
  kodeKab: string;
  namaKab: string;
  kodeProv: string;
  namaProv: string;
  pulau: string;
}

export interface WilayahSummaryIndex {
  pulaus: WilayahPulauOption[];
  provs: WilayahProvOption[];
  kabs: WilayahKabOption[];
  provMap: Map<string, WilayahProvOption>;
  kabMap: Map<string, WilayahKabOption>;
}

interface RawSummaryJson {
  pulaus: [string, string][];
  provs: [string, string, string, string][];
  kabs: [string, string, string][];
}

type RawKecTuple = [string, string, string, string]; // [kodeKec, namaKec, kodeKab, kodeProv]
type RawKelProvTuple = [string, string, string]; // [kodeKel, namaKel, kodeKec]
type RawKelAllTuple = [string, string, string, string]; // [kodeKel, namaKel, kodeKec, kodeProv]

let cachedSummary: WilayahSummaryIndex | null = null;
let summaryPromise: Promise<WilayahSummaryIndex> | null = null;

let cachedKecs: WilayahKecOption[] | null = null;
let kecsPromise: Promise<WilayahKecOption[]> | null = null;
let cachedKecMap: Map<string, WilayahKecOption> | null = null;

const cachedKelByProv = new Map<string, WilayahKelOption[]>();
const kelProvPromises = new Map<string, Promise<WilayahKelOption[]>>();

let cachedAllKel: WilayahKelOption[] | null = null;
let allKelPromise: Promise<WilayahKelOption[]> | null = null;

function baseUrl(relPath: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  return `${base}${relPath.startsWith('/') ? relPath : `/${relPath}`}`;
}

function buildFallbackSummary(): WilayahSummaryIndex {
  const pulauSet = new Map<string, WilayahPulauOption>();
  const provs: WilayahProvOption[] = STARTER_KODE_WILAYAH.map((p, idx) => {
    const pId = String((idx + 1) * 10);
    if (!pulauSet.has(p.pulau)) {
      pulauSet.set(p.pulau, { id: pId, nama: p.pulau });
    }
    return {
      kode: p.kodeWilayah,
      nama: p.namaProvinsi,
      pulau: p.pulau,
      pulauId: pulauSet.get(p.pulau)?.id || '',
    };
  });
  const provMap = new Map(provs.map((p) => [p.kode, p]));
  return {
    pulaus: Array.from(pulauSet.values()),
    provs,
    kabs: [],
    provMap,
    kabMap: new Map(),
  };
}

export async function loadWilayahSummary(): Promise<WilayahSummaryIndex> {
  if (cachedSummary) return cachedSummary;
  if (summaryPromise) return summaryPromise;

  summaryPromise = (async () => {
    try {
      const res = await fetch(baseUrl('/data/wilayah/summary.json'));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = (await res.json()) as RawSummaryJson;
      const pulaus: WilayahPulauOption[] = raw.pulaus.map(([id, nama]) => ({ id, nama }));
      const provs: WilayahProvOption[] = raw.provs.map(([kode, nama, pulau, pulauId]) => ({
        kode,
        nama,
        pulau,
        pulauId,
      }));
      const provMap = new Map(provs.map((p) => [p.kode, p]));
      const kabs: WilayahKabOption[] = raw.kabs.map(([kode, nama, kodeProv]) => {
        const prov = provMap.get(kodeProv);
        return {
          kode,
          nama,
          kodeProv,
          namaProv: prov?.nama || '',
          pulau: prov?.pulau || '',
        };
      });
      const kabMap = new Map(kabs.map((k) => [k.kode, k]));
      cachedSummary = { pulaus, provs, kabs, provMap, kabMap };
      return cachedSummary;
    } catch {
      cachedSummary = buildFallbackSummary();
      return cachedSummary;
    }
  })();

  return summaryPromise;
}

export async function loadAllKecamatan(): Promise<{
  list: WilayahKecOption[];
  kecMap: Map<string, WilayahKecOption>;
}> {
  if (cachedKecs && cachedKecMap) {
    return { list: cachedKecs, kecMap: cachedKecMap };
  }
  if (!kecsPromise) {
    kecsPromise = (async () => {
      const summary = await loadWilayahSummary();
      const res = await fetch(baseUrl('/data/wilayah/kecamatan.json'));
      if (!res.ok) throw new Error('Gagal memuat data kecamatan.');
      const raw = (await res.json()) as RawKecTuple[];
      const list: WilayahKecOption[] = raw.map(([kode, nama, kodeKab, kodeProv]) => {
        const kab = summary.kabMap.get(kodeKab);
        const prov = summary.provMap.get(kodeProv);
        return {
          kode,
          nama,
          kodeKab,
          namaKab: kab?.nama || '',
          kodeProv,
          namaProv: prov?.nama || '',
          pulau: prov?.pulau || '',
        };
      });
      cachedKecs = list;
      cachedKecMap = new Map(list.map((k) => [k.kode, k]));
      return list;
    })();
  }
  const list = await kecsPromise;
  return { list, kecMap: cachedKecMap || new Map() };
}

export async function loadKelurahanByProv(kodeProv: string): Promise<WilayahKelOption[]> {
  if (!kodeProv || kodeProv === 'ALL') return [];
  const existing = cachedKelByProv.get(kodeProv);
  if (existing) return existing;

  const inflight = kelProvPromises.get(kodeProv);
  if (inflight) return inflight;

  const p = (async () => {
    const { kecMap } = await loadAllKecamatan();
    const res = await fetch(baseUrl(`/data/wilayah/kel/${encodeURIComponent(kodeProv)}.json`));
    if (!res.ok) throw new Error(`Gagal memuat data kelurahan untuk provinsi ${kodeProv}.`);
    const raw = (await res.json()) as RawKelProvTuple[];
    const list: WilayahKelOption[] = raw.map(([kode, nama, kodeKec]) => {
      const kec = kecMap.get(kodeKec);
      return {
        kode,
        nama,
        kodeKec,
        namaKec: kec?.nama || '',
        kodeKab: kec?.kodeKab || kodeKec.split('.').slice(0, 2).join('.'),
        namaKab: kec?.namaKab || '',
        kodeProv: kec?.kodeProv || kodeProv,
        namaProv: kec?.namaProv || '',
        pulau: kec?.pulau || '',
      };
    });
    cachedKelByProv.set(kodeProv, list);
    return list;
  })();

  kelProvPromises.set(kodeProv, p);
  return p;
}

export async function loadAllKelurahan(): Promise<WilayahKelOption[]> {
  if (cachedAllKel) return cachedAllKel;
  if (allKelPromise) return allKelPromise;

  allKelPromise = (async () => {
    const { kecMap } = await loadAllKecamatan();
    const res = await fetch(baseUrl('/data/wilayah/kel-all.json'));
    if (!res.ok) throw new Error('Gagal memuat seluruh data kelurahan/desa.');
    const raw = (await res.json()) as RawKelAllTuple[];
    const list: WilayahKelOption[] = raw.map(([kode, nama, kodeKec, kodeProv]) => {
      const kec = kecMap.get(kodeKec);
      return {
        kode,
        nama,
        kodeKec,
        namaKec: kec?.nama || '',
        kodeKab: kec?.kodeKab || kodeKec.split('.').slice(0, 2).join('.'),
        namaKab: kec?.namaKab || '',
        kodeProv: kec?.kodeProv || kodeProv,
        namaProv: kec?.namaProv || '',
        pulau: kec?.pulau || '',
      };
    });
    cachedAllKel = list;
    return list;
  })();

  return allKelPromise;
}

export function summaryToKodeWilayahItems(summary: WilayahSummaryIndex): KodeWilayahItem[] {
  const provRows: KodeWilayahItem[] = summary.provs.map((p) => ({
    kodeWilayah: p.kode,
    tingkat: 'Provinsi',
    pulau: p.pulau,
    kodeProvinsi: p.kode,
    namaProvinsi: p.nama,
    parentKode: p.pulauId,
  }));
  const kabRows: KodeWilayahItem[] = summary.kabs.map((k) => ({
    kodeWilayah: k.kode,
    tingkat: 'KabKota',
    pulau: k.pulau,
    kodeProvinsi: k.kodeProv,
    namaProvinsi: k.namaProv,
    kodeKabKota: k.kode,
    namaKabKota: k.nama,
    parentKode: k.kodeProv,
  }));
  return [...provRows, ...kabRows];
}
