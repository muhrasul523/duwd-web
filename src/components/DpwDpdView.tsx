import {
  AlertTriangle,
  Building2,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteDpcRecord,
  deleteDpdRecord,
  deleteDprRecord,
  deleteDpwRecord,
  fetchWilayahChildren,
  importKodeWilayahBatch,
  saveDpcRecord,
  saveDpdRecord,
  saveDprRecord,
  saveDpwRecord,
} from '../services/orgService';
import {
  loadAllKecamatan,
  loadAllKelurahan,
  loadKelurahanByProv,
  loadWilayahSummary,
  type WilayahKecOption,
  type WilayahKelOption,
  type WilayahSummaryIndex,
} from '../services/wilayahDataService';
import type {
  DpcItem,
  DpdItem,
  DprItem,
  DpwItem,
  JenisLembaga,
  KelembagaanUnifiedRow,
  KodeWilayahItem,
  StatusTerbentuk,
  TingkatWilayah,
  UserRole,
} from '../types/org';
import {
  buildWhatsAppLink,
  isValidWhatsApp,
  normalizeWhatsApp,
} from '../utils/whatsapp';
import { WhatsAppInput } from './WhatsAppInput';
import {
  formatKelembagaanRowsText,
  WilayahCopyModal,
  type CopyFormatMode,
} from './WilayahCopyModal';

interface DpwDpdViewProps {
  role: UserRole;
  activePin: string;
  webAppUrl: string;
  wilayahConnected: boolean;
  kodeWilayahList: KodeWilayahItem[];
  dpwList: DpwItem[];
  dpdList: DpdItem[];
  dpcList: DpcItem[];
  dprList: DprItem[];
  syncing: boolean;
  onRefresh: () => void;
  onSaveDpw: (item: DpwItem) => void;
  onDeleteDpw: (id: string) => void;
  onSaveDpd: (item: DpdItem) => void;
  onDeleteDpd: (id: string) => void;
  onSaveDpc: (item: DpcItem) => void;
  onDeleteDpc: (id: string) => void;
  onSaveDpr: (item: DprItem) => void;
  onDeleteDpr: (id: string) => void;
  onImportedKodeWilayah: (rows: KodeWilayahItem[]) => void;
}

type SubTab = 'dpw' | 'dpd' | 'dpc' | 'dpr' | 'semua' | 'wilayah';
type StatusFilter = 'ALL' | 'SUDAH_ADA' | StatusTerbentuk;
type ContactFilter = 'ALL' | 'LENGKAP' | 'ADA_KETUA' | 'ADA_SEKRETARIS' | 'BELUM_ADA';

const PAGE_SIZE = 50;
const MAX_MODAL_COPY_ROWS = 5000;

const STATUS_TERBENTUK_OPTIONS: StatusTerbentuk[] = [
  'Sudah Terbentuk',
  'Persiapan',
  'Belum Terbentuk',
];

function compareKode(a: string, b: string): number {
  return String(a || '').localeCompare(String(b || ''), 'id', { numeric: true });
}

function getStatusColor(status: StatusTerbentuk): string {
  switch (status) {
    case 'Sudah Terbentuk':
      return 'text-emerald-700 font-semibold';
    case 'Persiapan':
      return 'text-[#9A6008] font-semibold';
    default:
      return 'text-[#6B8187] font-medium';
  }
}

function getJenisLabel(jenis: JenisLembaga): string {
  switch (jenis) {
    case 'DPW':
      return 'DPW · Provinsi';
    case 'DPD':
      return 'DPD · Kab/Kota';
    case 'DPC':
      return 'DPC · Kecamatan';
    case 'DPR':
      return 'DPR · Kel/Desa';
  }
}

function escapeCsvCell(val: string | undefined): string {
  const s = String(val ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function inferTingkat(kode: string, rawTingkat?: string): TingkatWilayah {
  const clean = (rawTingkat || '').trim().toLowerCase();
  if (clean.includes('pulau')) return 'Pulau';
  if (clean.includes('prov')) return 'Provinsi';
  if (clean.includes('kab') || clean.includes('kota')) return 'KabKota';
  if (clean.includes('kec')) return 'Kecamatan';
  if (clean.includes('kel') || clean.includes('desa')) return 'KelDesa';

  const segs = kode.split('.').filter(Boolean).length;
  if (kode.toUpperCase().startsWith('P-')) return 'Pulau';
  if (segs <= 1) return 'Provinsi';
  if (segs === 2) return 'KabKota';
  if (segs === 3) return 'Kecamatan';
  return 'KelDesa';
}

export function DpwDpdView({
  role,
  activePin,
  webAppUrl,
  wilayahConnected,
  kodeWilayahList,
  dpwList,
  dpdList,
  dpcList,
  dprList,
  syncing,
  onRefresh,
  onSaveDpw,
  onDeleteDpw,
  onSaveDpd,
  onDeleteDpd,
  onSaveDpc,
  onDeleteDpc,
  onSaveDpr,
  onDeleteDpr,
  onImportedKodeWilayah,
}: DpwDpdViewProps) {
  const isSuperAdmin = role === 'superadmin';
  const canEditContacts = role === 'superadmin' || role === 'admin';

  // Territory static datasets
  const [summary, setSummary] = useState<WilayahSummaryIndex | null>(null);
  const [kecs, setKecs] = useState<WilayahKecOption[]>([]);
  const [kecsLoaded, setKecsLoaded] = useState(false);
  const [loadingKecs, setLoadingKecs] = useState(false);

  const [kels, setKels] = useState<WilayahKelOption[]>([]);
  const [allKelLoaded, setAllKelLoaded] = useState(false);
  const [loadedKelProv, setLoadedKelProv] = useState<string>('');
  const [loadingKels, setLoadingKels] = useState(false);

  // Navigation & Filters
  const [subTab, setSubTab] = useState<SubTab>('dpw');
  const [filterPulau, setFilterPulau] = useState('ALL');
  const [filterProvinsi, setFilterProvinsi] = useState('ALL');
  const [filterKabKota, setFilterKabKota] = useState('ALL');
  const [filterKecamatan, setFilterKecamatan] = useState('ALL');
  const [filterJenis, setFilterJenis] = useState<'ALL' | JenisLembaga>('ALL');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('ALL');
  const [filterContact, setFilterContact] = useState<ContactFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Notices & Errors
  const [notice, setNotice] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  // Per-row Copy dropdown & Copy modal
  const [openCopyKey, setOpenCopyKey] = useState<string | null>(null);
  const copyMenuContainerRef = useRef<HTMLDivElement | null>(null);
  const [copyModalState, setCopyModalState] = useState<{
    title: string;
    subtitle?: string;
    rows: KelembagaanUnifiedRow[];
    initialMode: CopyFormatMode;
  } | null>(null);

  // Edit / Create Modal (unified across DPW, DPD, DPC, DPR)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isManualCreate, setIsManualCreate] = useState(false);
  const [formJenis, setFormJenis] = useState<JenisLembaga>('DPW');
  const [formId, setFormId] = useState<string | undefined>(undefined);
  const [formHasSheetRecord, setFormHasSheetRecord] = useState(false);
  const [formKodeWilayah, setFormKodeWilayah] = useState('');
  const [formPulau, setFormPulau] = useState('');
  const [formKodeProvinsi, setFormKodeProvinsi] = useState('');
  const [formNamaProvinsi, setFormNamaProvinsi] = useState('');
  const [formKodeKabKota, setFormKodeKabKota] = useState('');
  const [formNamaKabKota, setFormNamaKabKota] = useState('');
  const [formKodeKecamatan, setFormKodeKecamatan] = useState('');
  const [formNamaKecamatan, setFormNamaKecamatan] = useState('');
  const [formNamaKelDesa, setFormNamaKelDesa] = useState('');
  const [formNamaLembaga, setFormNamaLembaga] = useState('');
  const [formStatus, setFormStatus] = useState<StatusTerbentuk>('Sudah Terbentuk');
  const [formKetuaNama, setFormKetuaNama] = useState('');
  const [formKetuaWa, setFormKetuaWa] = useState('');
  const [formSekNama, setFormSekNama] = useState('');
  const [formSekWa, setFormSekWa] = useState('');
  const [formAlamat, setFormAlamat] = useState('');
  const [formDrive, setFormDrive] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formDeleting, setFormDeleting] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Referensi Kode Wilayah GAS remote / CSV
  const [remoteWilayahRows, setRemoteWilayahRows] = useState<KodeWilayahItem[]>([]);
  const [loadingRemoteWilayah, setLoadingRemoteWilayah] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);

  // Close copy dropdown when clicking outside or pressing Escape
  useEffect(() => {
    if (!openCopyKey) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        copyMenuContainerRef.current &&
        !copyMenuContainerRef.current.contains(e.target as Node)
      ) {
        setOpenCopyKey(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenCopyKey(null);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openCopyKey]);

  // Load summary (pulau, prov, kab) on mount
  useEffect(() => {
    let active = true;
    void loadWilayahSummary().then((data) => {
      if (active) setSummary(data);
    });
    return () => {
      active = false;
    };
  }, []);

  // Load kecamatan dataset on demand
  const ensureKecamatanLoaded = async (): Promise<WilayahKecOption[]> => {
    if (kecsLoaded) return kecs;
    setLoadingKecs(true);
    try {
      const { list } = await loadAllKecamatan();
      setKecs(list);
      setKecsLoaded(true);
      return list;
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Gagal memuat data kecamatan.',
      );
      return [];
    } finally {
      setLoadingKecs(false);
    }
  };

  // Load kelurahan dataset on demand (by province or full 83k)
  const ensureKelurahanLoaded = async (
    provCode: string,
    allowAll: boolean,
  ): Promise<WilayahKelOption[]> => {
    if (allKelLoaded) return kels;
    if (provCode !== 'ALL') {
      if (loadedKelProv === provCode && kels.length > 0) return kels;
      setLoadingKels(true);
      try {
        const list = await loadKelurahanByProv(provCode);
        setKels(list);
        setLoadedKelProv(provCode);
        return list;
      } catch (err) {
        setErrorBanner(
          err instanceof Error ? err.message : 'Gagal memuat data kelurahan/desa.',
        );
        return [];
      } finally {
        setLoadingKels(false);
      }
    }
    if (!allowAll) return [];
    setLoadingKels(true);
    try {
      const list = await loadAllKelurahan();
      setKels(list);
      setAllKelLoaded(true);
      setLoadedKelProv('ALL');
      return list;
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Gagal memuat seluruh data kelurahan/desa.',
      );
      return [];
    } finally {
      setLoadingKels(false);
    }
  };

  // Auto-load kecamatan & kelurahan when switching tabs / province filters
  useEffect(() => {
    if (
      subTab === 'dpc' ||
      subTab === 'dpr' ||
      subTab === 'semua' ||
      subTab === 'wilayah' ||
      filterKabKota !== 'ALL'
    ) {
      if (!kecsLoaded && !loadingKecs) {
        void ensureKecamatanLoaded();
      }
    }
  }, [subTab, filterKabKota, kecsLoaded, loadingKecs]);

  useEffect(() => {
    if (subTab === 'dpr' || subTab === 'wilayah') {
      void ensureKelurahanLoaded(filterProvinsi, subTab === 'dpr');
    } else if (subTab === 'semua' && (filterJenis === 'DPR' || filterProvinsi !== 'ALL')) {
      void ensureKelurahanLoaded(filterProvinsi, filterJenis === 'DPR');
    }
  }, [subTab, filterProvinsi, filterJenis]);

  // Reset pagination when filters or active tab change
  useEffect(() => {
    setCurrentPage(1);
    setOpenCopyKey(null);
  }, [
    subTab,
    filterPulau,
    filterProvinsi,
    filterKabKota,
    filterKecamatan,
    filterJenis,
    filterStatus,
    filterContact,
    searchQuery,
  ]);

  // Cascading dropdown options
  const pulauOptions = useMemo(() => {
    if (summary && summary.pulaus.length > 0) return summary.pulaus.map((p) => p.nama);
    const set = new Set<string>();
    kodeWilayahList.forEach((k) => {
      if (k.pulau) set.add(k.pulau);
    });
    return Array.from(set);
  }, [summary, kodeWilayahList]);

  const provOptions = useMemo(() => {
    const base =
      summary && summary.provs.length > 0
        ? summary.provs
        : kodeWilayahList
            .filter((k) => k.tingkat === 'Provinsi')
            .map((k) => ({
              kode: k.kodeWilayah,
              nama: k.namaProvinsi,
              pulau: k.pulau,
              pulauId: '',
            }));
    return base
      .filter((p) => filterPulau === 'ALL' || p.pulau === filterPulau)
      .sort((a, b) => compareKode(a.kode, b.kode));
  }, [summary, kodeWilayahList, filterPulau]);

  const kabOptions = useMemo(() => {
    if (!summary) return [];
    return summary.kabs
      .filter((k) => {
        if (filterPulau !== 'ALL' && k.pulau !== filterPulau) return false;
        if (filterProvinsi !== 'ALL' && k.kodeProv !== filterProvinsi) return false;
        return true;
      })
      .sort((a, b) => compareKode(a.kode, b.kode));
  }, [summary, filterPulau, filterProvinsi]);

  const kecOptions = useMemo(() => {
    if (!kecsLoaded) return [];
    return kecs
      .filter((k) => {
        if (filterPulau !== 'ALL' && k.pulau !== filterPulau) return false;
        if (filterProvinsi !== 'ALL' && k.kodeProv !== filterProvinsi) return false;
        if (filterKabKota !== 'ALL' && k.kodeKab !== filterKabKota) return false;
        return true;
      })
      .sort((a, b) => compareKode(a.kode, b.kode));
  }, [kecs, kecsLoaded, filterPulau, filterProvinsi, filterKabKota]);

  // Merge master territories with Google Sheet records (DPW, DPD, DPC, DPR)
  const mergedDpwRows = useMemo<KelembagaanUnifiedRow[]>(() => {
    const sheetMap = new Map<string, DpwItem>();
    dpwList.forEach((d) => sheetMap.set(d.kodeWilayah, d));

    const provs = summary?.provs || [];
    const seen = new Set<string>();
    const rows: KelembagaanUnifiedRow[] = provs.map((p) => {
      seen.add(p.kode);
      const s = sheetMap.get(p.kode);
      return {
        jenis: 'DPW',
        id: s?.id,
        kodeWilayah: p.kode,
        pulau: s?.pulau || p.pulau,
        kodeProvinsi: p.kode,
        namaProvinsi: s?.namaProvinsi || p.nama,
        namaLembaga: s?.namaDpw || `DPW Wahdah Islamiyah ${p.nama}`,
        namaWilayah: s?.namaProvinsi || p.nama,
        statusTerbentuk: s?.statusTerbentuk || 'Belum Terbentuk',
        ketuaNama: s?.ketuaNama || '',
        ketuaWa: s?.ketuaWa || '',
        sekretarisNama: s?.sekretarisNama || '',
        sekretarisWa: s?.sekretarisWa || '',
        alamatKantor: s?.alamatKantor || '',
        tautanDrive: s?.tautanDrive || '',
        diperbaruiPada: s?.diperbaruiPada || '',
        hasSheetRecord: Boolean(s),
      };
    });

    dpwList.forEach((s) => {
      if (!seen.has(s.kodeWilayah)) {
        rows.push({
          jenis: 'DPW',
          id: s.id,
          kodeWilayah: s.kodeWilayah,
          pulau: s.pulau,
          kodeProvinsi: s.kodeWilayah,
          namaProvinsi: s.namaProvinsi,
          namaLembaga: s.namaDpw,
          namaWilayah: s.namaProvinsi,
          statusTerbentuk: s.statusTerbentuk || 'Sudah Terbentuk',
          ketuaNama: s.ketuaNama,
          ketuaWa: s.ketuaWa,
          sekretarisNama: s.sekretarisNama,
          sekretarisWa: s.sekretarisWa,
          alamatKantor: s.alamatKantor,
          tautanDrive: s.tautanDrive,
          diperbaruiPada: s.diperbaruiPada,
          hasSheetRecord: true,
        });
      }
    });

    return rows.sort((a, b) => compareKode(a.kodeWilayah, b.kodeWilayah));
  }, [summary, dpwList]);

  const mergedDpdRows = useMemo<KelembagaanUnifiedRow[]>(() => {
    const sheetMap = new Map<string, DpdItem>();
    dpdList.forEach((d) => sheetMap.set(d.kodeWilayah, d));

    const kabs = summary?.kabs || [];
    const seen = new Set<string>();
    const rows: KelembagaanUnifiedRow[] = kabs.map((k) => {
      seen.add(k.kode);
      const s = sheetMap.get(k.kode);
      return {
        jenis: 'DPD',
        id: s?.id,
        kodeWilayah: k.kode,
        pulau: s?.pulau || k.pulau,
        kodeProvinsi: s?.kodeProvinsi || k.kodeProv,
        namaProvinsi: s?.namaProvinsi || k.namaProv,
        kodeKabKota: k.kode,
        namaKabKota: s?.namaKabKota || k.nama,
        namaLembaga: s?.namaDpd || `DPD Wahdah Islamiyah ${k.nama}`,
        namaWilayah: s?.namaKabKota || k.nama,
        statusTerbentuk: s?.statusTerbentuk || 'Belum Terbentuk',
        ketuaNama: s?.ketuaNama || '',
        ketuaWa: s?.ketuaWa || '',
        sekretarisNama: s?.sekretarisNama || '',
        sekretarisWa: s?.sekretarisWa || '',
        alamatKantor: s?.alamatKantor || '',
        tautanDrive: s?.tautanDrive || '',
        diperbaruiPada: s?.diperbaruiPada || '',
        hasSheetRecord: Boolean(s),
      };
    });

    dpdList.forEach((s) => {
      if (!seen.has(s.kodeWilayah)) {
        rows.push({
          jenis: 'DPD',
          id: s.id,
          kodeWilayah: s.kodeWilayah,
          pulau: s.pulau,
          kodeProvinsi: s.kodeProvinsi,
          namaProvinsi: s.namaProvinsi,
          kodeKabKota: s.kodeWilayah,
          namaKabKota: s.namaKabKota,
          namaLembaga: s.namaDpd,
          namaWilayah: s.namaKabKota,
          statusTerbentuk: s.statusTerbentuk || 'Sudah Terbentuk',
          ketuaNama: s.ketuaNama,
          ketuaWa: s.ketuaWa,
          sekretarisNama: s.sekretarisNama,
          sekretarisWa: s.sekretarisWa,
          alamatKantor: s.alamatKantor,
          tautanDrive: s.tautanDrive,
          diperbaruiPada: s.diperbaruiPada,
          hasSheetRecord: true,
        });
      }
    });

    return rows.sort((a, b) => compareKode(a.kodeWilayah, b.kodeWilayah));
  }, [summary, dpdList]);

  const mergedDpcRows = useMemo<KelembagaanUnifiedRow[]>(() => {
    const sheetMap = new Map<string, DpcItem>();
    dpcList.forEach((d) => sheetMap.set(d.kodeWilayah, d));

    const seen = new Set<string>();
    const rows: KelembagaanUnifiedRow[] = kecs.map((k) => {
      seen.add(k.kode);
      const s = sheetMap.get(k.kode);
      return {
        jenis: 'DPC',
        id: s?.id,
        kodeWilayah: k.kode,
        pulau: s?.pulau || k.pulau,
        kodeProvinsi: s?.kodeProvinsi || k.kodeProv,
        namaProvinsi: s?.namaProvinsi || k.namaProv,
        kodeKabKota: s?.kodeKabKota || k.kodeKab,
        namaKabKota: s?.namaKabKota || k.namaKab,
        kodeKecamatan: k.kode,
        namaKecamatan: s?.namaKecamatan || k.nama,
        namaLembaga: s?.namaDpc || `DPC Wahdah Islamiyah ${k.nama}`,
        namaWilayah: s?.namaKecamatan || k.nama,
        statusTerbentuk: s?.statusTerbentuk || 'Belum Terbentuk',
        ketuaNama: s?.ketuaNama || '',
        ketuaWa: s?.ketuaWa || '',
        sekretarisNama: s?.sekretarisNama || '',
        sekretarisWa: s?.sekretarisWa || '',
        alamatKantor: s?.alamatKantor || '',
        tautanDrive: s?.tautanDrive || '',
        diperbaruiPada: s?.diperbaruiPada || '',
        hasSheetRecord: Boolean(s),
      };
    });

    dpcList.forEach((s) => {
      if (!seen.has(s.kodeWilayah)) {
        rows.push({
          jenis: 'DPC',
          id: s.id,
          kodeWilayah: s.kodeWilayah,
          pulau: s.pulau,
          kodeProvinsi: s.kodeProvinsi,
          namaProvinsi: s.namaProvinsi,
          kodeKabKota: s.kodeKabKota,
          namaKabKota: s.namaKabKota,
          kodeKecamatan: s.kodeWilayah,
          namaKecamatan: s.namaKecamatan,
          namaLembaga: s.namaDpc,
          namaWilayah: s.namaKecamatan,
          statusTerbentuk: s.statusTerbentuk || 'Sudah Terbentuk',
          ketuaNama: s.ketuaNama,
          ketuaWa: s.ketuaWa,
          sekretarisNama: s.sekretarisNama,
          sekretarisWa: s.sekretarisWa,
          alamatKantor: s.alamatKantor,
          tautanDrive: s.tautanDrive,
          diperbaruiPada: s.diperbaruiPada,
          hasSheetRecord: true,
        });
      }
    });

    return rows.sort((a, b) => compareKode(a.kodeWilayah, b.kodeWilayah));
  }, [kecs, dpcList]);

  const mergedDprRows = useMemo<KelembagaanUnifiedRow[]>(() => {
    const sheetMap = new Map<string, DprItem>();
    dprList.forEach((d) => sheetMap.set(d.kodeWilayah, d));

    const seen = new Set<string>();
    const rows: KelembagaanUnifiedRow[] = kels.map((k) => {
      seen.add(k.kode);
      const s = sheetMap.get(k.kode);
      return {
        jenis: 'DPR',
        id: s?.id,
        kodeWilayah: k.kode,
        pulau: s?.pulau || k.pulau,
        kodeProvinsi: s?.kodeProvinsi || k.kodeProv,
        namaProvinsi: s?.namaProvinsi || k.namaProv,
        kodeKabKota: s?.kodeKabKota || k.kodeKab,
        namaKabKota: s?.namaKabKota || k.namaKab,
        kodeKecamatan: s?.kodeKecamatan || k.kodeKec,
        namaKecamatan: s?.namaKecamatan || k.namaKec,
        namaKelDesa: s?.namaKelDesa || k.nama,
        namaLembaga: s?.namaDpr || `DPR Wahdah Islamiyah ${k.nama}`,
        namaWilayah: s?.namaKelDesa || k.nama,
        statusTerbentuk: s?.statusTerbentuk || 'Belum Terbentuk',
        ketuaNama: s?.ketuaNama || '',
        ketuaWa: s?.ketuaWa || '',
        sekretarisNama: s?.sekretarisNama || '',
        sekretarisWa: s?.sekretarisWa || '',
        alamatKantor: s?.alamatKantor || '',
        tautanDrive: s?.tautanDrive || '',
        diperbaruiPada: s?.diperbaruiPada || '',
        hasSheetRecord: Boolean(s),
      };
    });

    dprList.forEach((s) => {
      if (
        !seen.has(s.kodeWilayah) &&
        (filterProvinsi === 'ALL' || s.kodeProvinsi === filterProvinsi)
      ) {
        rows.push({
          jenis: 'DPR',
          id: s.id,
          kodeWilayah: s.kodeWilayah,
          pulau: s.pulau,
          kodeProvinsi: s.kodeProvinsi,
          namaProvinsi: s.namaProvinsi,
          kodeKabKota: s.kodeKabKota,
          namaKabKota: s.namaKabKota,
          kodeKecamatan: s.kodeKecamatan,
          namaKecamatan: s.namaKecamatan,
          namaKelDesa: s.namaKelDesa,
          namaLembaga: s.namaDpr,
          namaWilayah: s.namaKelDesa,
          statusTerbentuk: s.statusTerbentuk || 'Sudah Terbentuk',
          ketuaNama: s.ketuaNama,
          ketuaWa: s.ketuaWa,
          sekretarisNama: s.sekretarisNama,
          sekretarisWa: s.sekretarisWa,
          alamatKantor: s.alamatKantor,
          tautanDrive: s.tautanDrive,
          diperbaruiPada: s.diperbaruiPada,
          hasSheetRecord: true,
        });
      }
    });

    return rows.sort((a, b) => compareKode(a.kodeWilayah, b.kodeWilayah));
  }, [kels, dprList, filterProvinsi]);

  // Active rows according to SubTab
  const activeSourceRows = useMemo<KelembagaanUnifiedRow[]>(() => {
    if (subTab === 'dpw') return mergedDpwRows;
    if (subTab === 'dpd') return mergedDpdRows;
    if (subTab === 'dpc') return mergedDpcRows;
    if (subTab === 'dpr') return mergedDprRows;
    if (subTab === 'semua') {
      const pool: KelembagaanUnifiedRow[] = [];
      if (filterJenis === 'ALL' || filterJenis === 'DPW') pool.push(...mergedDpwRows);
      if (filterJenis === 'ALL' || filterJenis === 'DPD') pool.push(...mergedDpdRows);
      if (filterJenis === 'ALL' || filterJenis === 'DPC') pool.push(...mergedDpcRows);
      if (
        filterJenis === 'DPR' ||
        (filterJenis === 'ALL' && (allKelLoaded || filterProvinsi !== 'ALL'))
      ) {
        pool.push(...mergedDprRows);
      }
      return pool;
    }
    return [];
  }, [
    subTab,
    filterJenis,
    filterProvinsi,
    allKelLoaded,
    mergedDpwRows,
    mergedDpdRows,
    mergedDpcRows,
    mergedDprRows,
  ]);

  // Apply multi-criteria filters
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return activeSourceRows.filter((row) => {
      if (filterPulau !== 'ALL' && row.pulau !== filterPulau) return false;
      if (filterProvinsi !== 'ALL' && row.kodeProvinsi !== filterProvinsi) return false;
      if (filterKabKota !== 'ALL') {
        if (row.jenis === 'DPW') return false;
        if (row.kodeKabKota !== filterKabKota) return false;
      }
      if (filterKecamatan !== 'ALL') {
        if (row.jenis === 'DPW' || row.jenis === 'DPD') return false;
        if (row.kodeKecamatan !== filterKecamatan) return false;
      }
      if (subTab === 'semua' && filterJenis !== 'ALL' && row.jenis !== filterJenis) {
        return false;
      }
      if (filterStatus === 'SUDAH_ADA') {
        if (row.statusTerbentuk !== 'Sudah Terbentuk' && row.statusTerbentuk !== 'Persiapan') {
          return false;
        }
      } else if (filterStatus !== 'ALL' && row.statusTerbentuk !== filterStatus) {
        return false;
      }

      const hasKetua = Boolean(row.ketuaNama.trim() || row.ketuaWa.trim());
      const hasSek = Boolean(row.sekretarisNama.trim() || row.sekretarisWa.trim());
      if (filterContact === 'LENGKAP' && !(hasKetua && hasSek)) return false;
      if (filterContact === 'ADA_KETUA' && !hasKetua) return false;
      if (filterContact === 'ADA_SEKRETARIS' && !hasSek) return false;
      if (filterContact === 'BELUM_ADA' && (hasKetua || hasSek)) return false;

      if (q) {
        const hay = [
          row.kodeWilayah,
          row.jenis,
          row.pulau,
          row.namaProvinsi,
          row.namaKabKota || '',
          row.namaKecamatan || '',
          row.namaKelDesa || '',
          row.namaLembaga,
          row.ketuaNama,
          row.ketuaWa,
          row.sekretarisNama,
          row.sekretarisWa,
          row.alamatKantor || '',
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [
    activeSourceRows,
    filterPulau,
    filterProvinsi,
    filterKabKota,
    filterKecamatan,
    subTab,
    filterJenis,
    filterStatus,
    filterContact,
    searchQuery,
  ]);

  // Referensi Kode Wilayah rows (using static summary + kecs + kels, OR remote sheet rows if loaded)
  const filteredWilayahRows = useMemo<KodeWilayahItem[]>(() => {
    let source: KodeWilayahItem[] = [];
    if (remoteWilayahRows.length > 0) {
      source = remoteWilayahRows;
    } else if (summary) {
      const provItems: KodeWilayahItem[] = summary.provs.map((p) => ({
        kodeWilayah: p.kode,
        tingkat: 'Provinsi',
        pulau: p.pulau,
        kodeProvinsi: p.kode,
        namaProvinsi: p.nama,
        parentKode: p.pulauId,
      }));
      const kabItems: KodeWilayahItem[] = summary.kabs.map((k) => ({
        kodeWilayah: k.kode,
        tingkat: 'KabKota',
        pulau: k.pulau,
        kodeProvinsi: k.kodeProv,
        namaProvinsi: k.namaProv,
        kodeKabKota: k.kode,
        namaKabKota: k.nama,
        parentKode: k.kodeProv,
      }));
      const kecItems: KodeWilayahItem[] = kecs.map((k) => ({
        kodeWilayah: k.kode,
        tingkat: 'Kecamatan',
        pulau: k.pulau,
        kodeProvinsi: k.kodeProv,
        namaProvinsi: k.namaProv,
        kodeKabKota: k.kodeKab,
        namaKabKota: k.namaKab,
        kodeKecamatan: k.kode,
        namaKecamatan: k.nama,
        parentKode: k.kodeKab,
      }));
      const kelItems: KodeWilayahItem[] = kels.map((k) => ({
        kodeWilayah: k.kode,
        tingkat: 'KelDesa',
        pulau: k.pulau,
        kodeProvinsi: k.kodeProv,
        namaProvinsi: k.namaProv,
        kodeKabKota: k.kodeKab,
        namaKabKota: k.namaKab,
        kodeKecamatan: k.kodeKec,
        namaKecamatan: k.namaKec,
        namaKelDesa: k.nama,
        parentKode: k.kodeKec,
      }));
      source = [...provItems, ...kabItems, ...kecItems, ...kelItems];
    } else {
      source = kodeWilayahList;
    }

    const q = searchQuery.trim().toLowerCase();
    return source
      .filter((item) => {
        if (filterPulau !== 'ALL' && item.pulau !== filterPulau) return false;
        if (filterProvinsi !== 'ALL' && item.kodeProvinsi !== filterProvinsi) return false;
        if (filterKabKota !== 'ALL' && item.kodeKabKota !== filterKabKota) return false;
        if (filterKecamatan !== 'ALL' && item.kodeKecamatan !== filterKecamatan) return false;
        if (q) {
          const hay = [
            item.kodeWilayah,
            item.tingkat,
            item.pulau,
            item.namaProvinsi,
            item.namaKabKota || '',
            item.namaKecamatan || '',
            item.namaKelDesa || '',
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => compareKode(a.kodeWilayah, b.kodeWilayah));
  }, [
    remoteWilayahRows,
    summary,
    kecs,
    kels,
    kodeWilayahList,
    filterPulau,
    filterProvinsi,
    filterKabKota,
    filterKecamatan,
    searchQuery,
  ]);

  // Pagination slice
  const activeItemCount =
    subTab === 'wilayah' ? filteredWilayahRows.length : filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(activeItemCount / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;

  const pagedRows = useMemo(
    () => filteredRows.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredRows, pageStart],
  );
  const pagedWilayahRows = useMemo(
    () => filteredWilayahRows.slice(pageStart, pageStart + PAGE_SIZE),
    [filteredWilayahRows, pageStart],
  );

  // KPI Counters
  const kpi = useMemo(() => {
    const dpwTerbentuk = dpwList.filter((d) => d.statusTerbentuk === 'Sudah Terbentuk').length;
    const dpwPersiapan = dpwList.filter((d) => d.statusTerbentuk === 'Persiapan').length;

    const dpdTerbentuk = dpdList.filter((d) => d.statusTerbentuk === 'Sudah Terbentuk').length;
    const dpdPersiapan = dpdList.filter((d) => d.statusTerbentuk === 'Persiapan').length;

    const dpcTerbentuk = dpcList.filter((d) => d.statusTerbentuk === 'Sudah Terbentuk').length;
    const dpcPersiapan = dpcList.filter((d) => d.statusTerbentuk === 'Persiapan').length;

    const dprTerbentuk = dprList.filter((d) => d.statusTerbentuk === 'Sudah Terbentuk').length;
    const dprPersiapan = dprList.filter((d) => d.statusTerbentuk === 'Persiapan').length;

    return {
      dpwTerbentuk,
      dpwPersiapan,
      dpwTotal: summary?.provs.length || 38,
      dpdTerbentuk,
      dpdPersiapan,
      dpdTotal: summary?.kabs.length || 514,
      dpcTerbentuk,
      dpcPersiapan,
      dpcTotal: kecsLoaded ? kecs.length : 7277,
      dprTerbentuk,
      dprPersiapan,
      dprTotal: 83762,
    };
  }, [dpwList, dpdList, dpcList, dprList, summary, kecsLoaded, kecs.length]);

  const hasActiveFilters =
    filterPulau !== 'ALL' ||
    filterProvinsi !== 'ALL' ||
    filterKabKota !== 'ALL' ||
    filterKecamatan !== 'ALL' ||
    filterJenis !== 'ALL' ||
    filterStatus !== 'ALL' ||
    filterContact !== 'ALL' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setFilterPulau('ALL');
    setFilterProvinsi('ALL');
    setFilterKabKota('ALL');
    setFilterKecamatan('ALL');
    setFilterJenis('ALL');
    setFilterStatus('ALL');
    setFilterContact('ALL');
    setSearchQuery('');
    setRemoteWilayahRows([]);
  };

  // Contextual Copy Title
  const buildFilterCopyTitle = (): string => {
    const scopeParts: string[] = [];
    if (subTab === 'dpw') scopeParts.push('DPW');
    else if (subTab === 'dpd') scopeParts.push('DPD');
    else if (subTab === 'dpc') scopeParts.push('DPC');
    else if (subTab === 'dpr') scopeParts.push('DPR');
    else if (filterJenis !== 'ALL') scopeParts.push(filterJenis);
    else scopeParts.push('Kelembagaan WI');

    if (filterKecamatan !== 'ALL') {
      const kec = kecOptions.find((k) => k.kode === filterKecamatan);
      if (kec) scopeParts.push(`Kec. ${kec.nama}`);
    } else if (filterKabKota !== 'ALL') {
      const kab = kabOptions.find((k) => k.kode === filterKabKota);
      if (kab) scopeParts.push(kab.nama);
    } else if (filterProvinsi !== 'ALL') {
      const prov = provOptions.find((p) => p.kode === filterProvinsi);
      if (prov) scopeParts.push(`Prov. ${prov.nama}`);
    } else if (filterPulau !== 'ALL') {
      scopeParts.push(`Pulau ${filterPulau}`);
    }

    return `Daftar ${scopeParts.join(' · ')}`;
  };

  const handleOpenFilteredCopyModal = () => {
    const title = buildFilterCopyTitle();
    const total = filteredRows.length;
    const rowsForModal =
      total > MAX_MODAL_COPY_ROWS ? filteredRows.slice(0, MAX_MODAL_COPY_ROWS) : filteredRows;
    const subtitle =
      total > MAX_MODAL_COPY_ROWS
        ? `Menampilkan ${MAX_MODAL_COPY_ROWS.toLocaleString('id-ID')} entri pertama dari ${total.toLocaleString('id-ID')} hasil filter. Gunakan filter Provinsi/Kabupaten atau Unduh CSV untuk seluruh data.`
        : `${total.toLocaleString('id-ID')} data hasil filter siap disalin.`;

    setCopyModalState({
      title,
      subtitle,
      rows: rowsForModal,
      initialMode: 'ketua_sekretaris',
    });
  };

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 4000);
  };

  const handleQuickRowCopy = async (row: KelembagaanUnifiedRow, mode: CopyFormatMode) => {
    const text = formatKelembagaanRowsText([row], mode, {
      includeKode: true,
      includeStatus: true,
      includeNumbering: false,
      headerTitle: '',
    });
    try {
      await navigator.clipboard.writeText(text);
      setOpenCopyKey(null);
      showTempNotice(`Info "${row.namaLembaga}" berhasil disalin ke clipboard.`);
    } catch {
      setCopyModalState({
        title: row.namaLembaga,
        rows: [row],
        initialMode: mode,
      });
      setOpenCopyKey(null);
    }
  };

  const handleOpenChildCopyModal = async (
    parentRow: KelembagaanUnifiedRow,
    initialMode: CopyFormatMode,
  ) => {
    setOpenCopyKey(null);

    if (parentRow.jenis === 'DPW') {
      const children = mergedDpdRows.filter(
        (d) => d.kodeProvinsi === parentRow.kodeProvinsi,
      );
      setCopyModalState({
        title: `Daftar DPD di Provinsi ${parentRow.namaProvinsi}`,
        subtitle: `${children.length} Kab/Kota di bawah ${parentRow.namaLembaga}. Pilih format Daftar Nama Saja, Ketua Saja, Sekretaris Saja, atau Info Lengkap.`,
        rows: children,
        initialMode,
      });
      return;
    }

    if (parentRow.jenis === 'DPD') {
      const kecList = await ensureKecamatanLoaded();
      const dpcSheetMap = new Map<string, DpcItem>();
      dpcList.forEach((d) => dpcSheetMap.set(d.kodeWilayah, d));
      const children: KelembagaanUnifiedRow[] = kecList
        .filter((k) => k.kodeKab === parentRow.kodeWilayah)
        .sort((a, b) => compareKode(a.kode, b.kode))
        .map((k) => {
          const s = dpcSheetMap.get(k.kode);
          return {
            jenis: 'DPC',
            id: s?.id,
            kodeWilayah: k.kode,
            pulau: s?.pulau || k.pulau,
            kodeProvinsi: s?.kodeProvinsi || k.kodeProv,
            namaProvinsi: s?.namaProvinsi || k.namaProv,
            kodeKabKota: s?.kodeKabKota || k.kodeKab,
            namaKabKota: s?.namaKabKota || k.namaKab,
            kodeKecamatan: k.kode,
            namaKecamatan: s?.namaKecamatan || k.nama,
            namaLembaga: s?.namaDpc || `DPC Wahdah Islamiyah ${k.nama}`,
            namaWilayah: s?.namaKecamatan || k.nama,
            statusTerbentuk: s?.statusTerbentuk || 'Belum Terbentuk',
            ketuaNama: s?.ketuaNama || '',
            ketuaWa: s?.ketuaWa || '',
            sekretarisNama: s?.sekretarisNama || '',
            sekretarisWa: s?.sekretarisWa || '',
            alamatKantor: s?.alamatKantor || '',
            tautanDrive: s?.tautanDrive || '',
            hasSheetRecord: Boolean(s),
          };
        });

      setCopyModalState({
        title: `Daftar DPC di ${parentRow.namaKabKota || parentRow.namaWilayah}`,
        subtitle: `${children.length} Kecamatan di bawah ${parentRow.namaLembaga}.`,
        rows: children,
        initialMode,
      });
      return;
    }

    if (parentRow.jenis === 'DPC') {
      const kelList = await loadKelurahanByProv(parentRow.kodeProvinsi);
      const dprSheetMap = new Map<string, DprItem>();
      dprList.forEach((d) => dprSheetMap.set(d.kodeWilayah, d));
      const children: KelembagaanUnifiedRow[] = kelList
        .filter((k) => k.kodeKec === parentRow.kodeWilayah)
        .sort((a, b) => compareKode(a.kode, b.kode))
        .map((k) => {
          const s = dprSheetMap.get(k.kode);
          return {
            jenis: 'DPR',
            id: s?.id,
            kodeWilayah: k.kode,
            pulau: s?.pulau || k.pulau,
            kodeProvinsi: s?.kodeProvinsi || k.kodeProv,
            namaProvinsi: s?.namaProvinsi || k.namaProv,
            kodeKabKota: s?.kodeKabKota || k.kodeKab,
            namaKabKota: s?.namaKabKota || k.namaKab,
            kodeKecamatan: s?.kodeKecamatan || k.kodeKec,
            namaKecamatan: s?.namaKecamatan || k.namaKec,
            namaKelDesa: s?.namaKelDesa || k.nama,
            namaLembaga: s?.namaDpr || `DPR Wahdah Islamiyah ${k.nama}`,
            namaWilayah: s?.namaKelDesa || k.nama,
            statusTerbentuk: s?.statusTerbentuk || 'Belum Terbentuk',
            ketuaNama: s?.ketuaNama || '',
            ketuaWa: s?.ketuaWa || '',
            sekretarisNama: s?.sekretarisNama || '',
            sekretarisWa: s?.sekretarisWa || '',
            alamatKantor: s?.alamatKantor || '',
            tautanDrive: s?.tautanDrive || '',
            hasSheetRecord: Boolean(s),
          };
        });

      setCopyModalState({
        title: `Daftar DPR di Kecamatan ${parentRow.namaKecamatan || parentRow.namaWilayah}`,
        subtitle: `${children.length} Kelurahan/Desa di bawah ${parentRow.namaLembaga}.`,
        rows: children,
        initialMode,
      });
    }
  };

  // Open Edit Modal for existing row
  const openEditModal = (row: KelembagaanUnifiedRow) => {
    setIsManualCreate(false);
    setFormJenis(row.jenis);
    setFormId(row.id);
    setFormHasSheetRecord(row.hasSheetRecord);
    setFormKodeWilayah(row.kodeWilayah);
    setFormPulau(row.pulau);
    setFormKodeProvinsi(row.kodeProvinsi);
    setFormNamaProvinsi(row.namaProvinsi);
    setFormKodeKabKota(row.kodeKabKota || '');
    setFormNamaKabKota(row.namaKabKota || '');
    setFormKodeKecamatan(row.kodeKecamatan || '');
    setFormNamaKecamatan(row.namaKecamatan || '');
    setFormNamaKelDesa(row.namaKelDesa || '');
    setFormNamaLembaga(row.namaLembaga);
    setFormStatus(row.statusTerbentuk);
    setFormKetuaNama(row.ketuaNama);
    setFormKetuaWa(row.ketuaWa);
    setFormSekNama(row.sekretarisNama);
    setFormSekWa(row.sekretarisWa);
    setFormAlamat(row.alamatKantor || '');
    setFormDrive(row.tautanDrive || '');
    setFormErr('');
    setConfirmDeleteOpen(false);
    setEditModalOpen(true);
  };

  // Open Manual Create Modal (Super Admin only)
  const openManualCreateModal = (jenis: JenisLembaga) => {
    const prov =
      provOptions.find((p) => p.kode === filterProvinsi) || provOptions[0];
    setIsManualCreate(true);
    setFormJenis(jenis);
    setFormId(undefined);
    setFormHasSheetRecord(false);
    setFormKodeWilayah(prov?.kode || '');
    setFormPulau(prov?.pulau || '');
    setFormKodeProvinsi(prov?.kode || '');
    setFormNamaProvinsi(prov?.nama || '');
    setFormKodeKabKota('');
    setFormNamaKabKota('');
    setFormKodeKecamatan('');
    setFormNamaKecamatan('');
    setFormNamaKelDesa('');
    setFormNamaLembaga(
      jenis === 'DPW' && prov ? `DPW Wahdah Islamiyah ${prov.nama}` : '',
    );
    setFormStatus('Sudah Terbentuk');
    setFormKetuaNama('');
    setFormKetuaWa('');
    setFormSekNama('');
    setFormSekWa('');
    setFormAlamat('');
    setFormDrive('');
    setFormErr('');
    setConfirmDeleteOpen(false);
    setEditModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');

    if (!formKodeWilayah.trim() || !formNamaLembaga.trim()) {
      setFormErr('Kode wilayah dan nama lembaga wajib diisi.');
      return;
    }

    const cleanKetuaWa = formKetuaWa.trim() ? normalizeWhatsApp(formKetuaWa) : '';
    const cleanSekWa = formSekWa.trim() ? normalizeWhatsApp(formSekWa) : '';

    if (cleanKetuaWa && !isValidWhatsApp(cleanKetuaWa)) {
      setFormErr('Nomor WhatsApp Ketua tidak valid (gunakan awalan 08 atau 628).');
      return;
    }
    if (cleanSekWa && !isValidWhatsApp(cleanSekWa)) {
      setFormErr('Nomor WhatsApp Sekretaris tidak valid (gunakan awalan 08 atau 628).');
      return;
    }

    setFormSaving(true);
    try {
      if (formJenis === 'DPW') {
        const res = await saveDpwRecord(
          {
            id: formId,
            kodeWilayah: formKodeWilayah.trim(),
            pulau: formPulau.trim(),
            namaDpw: formNamaLembaga.trim(),
            namaProvinsi: formNamaProvinsi.trim(),
            statusTerbentuk: formStatus,
            ketuaNama: formKetuaNama.trim(),
            ketuaWa: cleanKetuaWa,
            sekretarisNama: formSekNama.trim(),
            sekretarisWa: cleanSekWa,
            alamatKantor: formAlamat.trim(),
            tautanDrive: formDrive.trim(),
          },
          activePin,
          webAppUrl,
        );
        if (res.ok && res.item) {
          onSaveDpw(res.item);
          setEditModalOpen(false);
          showTempNotice(
            res.synced
              ? `"${res.item.namaDpw}" tersimpan ke Spreadsheet #2 (tab DPW).`
              : `"${res.item.namaDpw}" disimpan di browser lokal.`,
          );
        } else {
          setFormErr(res.error || 'Gagal menyimpan data DPW.');
        }
        return;
      }

      if (formJenis === 'DPD') {
        const res = await saveDpdRecord(
          {
            id: formId,
            kodeWilayah: formKodeWilayah.trim(),
            kodeProvinsi:
              formKodeProvinsi.trim() || formKodeWilayah.trim().split('.')[0] || '',
            pulau: formPulau.trim(),
            namaProvinsi: formNamaProvinsi.trim(),
            namaKabKota: formNamaKabKota.trim() || formNamaLembaga.trim(),
            namaDpd: formNamaLembaga.trim(),
            statusTerbentuk: formStatus,
            ketuaNama: formKetuaNama.trim(),
            ketuaWa: cleanKetuaWa,
            sekretarisNama: formSekNama.trim(),
            sekretarisWa: cleanSekWa,
            alamatKantor: formAlamat.trim(),
            tautanDrive: formDrive.trim(),
          },
          activePin,
          webAppUrl,
        );
        if (res.ok && res.item) {
          onSaveDpd(res.item);
          setEditModalOpen(false);
          showTempNotice(
            res.synced
              ? `"${res.item.namaDpd}" tersimpan ke Spreadsheet #2 (tab DPD).`
              : `"${res.item.namaDpd}" disimpan di browser lokal.`,
          );
        } else {
          setFormErr(res.error || 'Gagal menyimpan data DPD.');
        }
        return;
      }

      if (formJenis === 'DPC') {
        const segs = formKodeWilayah.trim().split('.');
        const res = await saveDpcRecord(
          {
            id: formId,
            kodeWilayah: formKodeWilayah.trim(),
            kodeKabKota:
              formKodeKabKota.trim() || (segs.length >= 2 ? segs.slice(0, 2).join('.') : ''),
            kodeProvinsi: formKodeProvinsi.trim() || segs[0] || '',
            pulau: formPulau.trim(),
            namaProvinsi: formNamaProvinsi.trim(),
            namaKabKota: formNamaKabKota.trim(),
            namaKecamatan: formNamaKecamatan.trim() || formNamaLembaga.trim(),
            namaDpc: formNamaLembaga.trim(),
            statusTerbentuk: formStatus,
            ketuaNama: formKetuaNama.trim(),
            ketuaWa: cleanKetuaWa,
            sekretarisNama: formSekNama.trim(),
            sekretarisWa: cleanSekWa,
            alamatKantor: formAlamat.trim(),
            tautanDrive: formDrive.trim(),
          },
          activePin,
          webAppUrl,
        );
        if (res.ok && res.item) {
          onSaveDpc(res.item);
          setEditModalOpen(false);
          showTempNotice(
            res.synced
              ? `"${res.item.namaDpc}" tersimpan ke Spreadsheet #2 (tab DPC).`
              : `"${res.item.namaDpc}" disimpan di browser lokal.`,
          );
        } else {
          setFormErr(res.error || 'Gagal menyimpan data DPC.');
        }
        return;
      }

      // formJenis === 'DPR'
      const segs = formKodeWilayah.trim().split('.');
      const res = await saveDprRecord(
        {
          id: formId,
          kodeWilayah: formKodeWilayah.trim(),
          kodeKecamatan:
            formKodeKecamatan.trim() || (segs.length >= 3 ? segs.slice(0, 3).join('.') : ''),
          kodeKabKota:
            formKodeKabKota.trim() || (segs.length >= 2 ? segs.slice(0, 2).join('.') : ''),
          kodeProvinsi: formKodeProvinsi.trim() || segs[0] || '',
          pulau: formPulau.trim(),
          namaProvinsi: formNamaProvinsi.trim(),
          namaKabKota: formNamaKabKota.trim(),
          namaKecamatan: formNamaKecamatan.trim(),
          namaKelDesa: formNamaKelDesa.trim() || formNamaLembaga.trim(),
          namaDpr: formNamaLembaga.trim(),
          statusTerbentuk: formStatus,
          ketuaNama: formKetuaNama.trim(),
          ketuaWa: cleanKetuaWa,
          sekretarisNama: formSekNama.trim(),
          sekretarisWa: cleanSekWa,
          alamatKantor: formAlamat.trim(),
          tautanDrive: formDrive.trim(),
        },
        activePin,
        webAppUrl,
      );
      if (res.ok && res.item) {
        onSaveDpr(res.item);
        setEditModalOpen(false);
        showTempNotice(
          res.synced
            ? `"${res.item.namaDpr}" tersimpan ke Spreadsheet #2 (tab DPR).`
            : `"${res.item.namaDpr}" disimpan di browser lokal.`,
        );
      } else {
        setFormErr(res.error || 'Gagal menyimpan data DPR.');
      }
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteCurrentRecord = async () => {
    if (!formId) return;
    setFormDeleting(true);
    setFormErr('');
    try {
      const res =
        formJenis === 'DPW'
          ? await deleteDpwRecord(formId, activePin, webAppUrl)
          : formJenis === 'DPD'
            ? await deleteDpdRecord(formId, activePin, webAppUrl)
            : formJenis === 'DPC'
              ? await deleteDpcRecord(formId, activePin, webAppUrl)
              : await deleteDprRecord(formId, activePin, webAppUrl);

      if (res.ok) {
        if (formJenis === 'DPW') onDeleteDpw(formId);
        else if (formJenis === 'DPD') onDeleteDpd(formId);
        else if (formJenis === 'DPC') onDeleteDpc(formId);
        else onDeleteDpr(formId);

        setEditModalOpen(false);
        showTempNotice(
          res.synced
            ? `Catatan ${formJenis} dihapus dari Spreadsheet #2 (status wilayah kembali Belum Terbentuk).`
            : `Catatan ${formJenis} dihapus dari penyimpanan lokal.`,
        );
      } else {
        setFormErr(res.error || `Gagal menghapus data ${formJenis}.`);
      }
    } finally {
      setFormDeleting(false);
    }
  };

  // Load remote children from GAS Spreadsheet #2
  const handleLoadRemoteWilayah = async () => {
    if (!webAppUrl.trim() || filterProvinsi === 'ALL') return;
    setLoadingRemoteWilayah(true);
    setErrorBanner('');
    try {
      const res = await fetchWilayahChildren(webAppUrl, {
        kodeProvinsi: filterProvinsi,
      });
      if (res.ok) {
        setRemoteWilayahRows(res.data);
        showTempNotice(
          `Memuat ${res.data.length.toLocaleString('id-ID')} baris detail kode wilayah dari Spreadsheet #2.`,
        );
      } else {
        setErrorBanner(res.error || 'Gagal memuat detail wilayah dari Spreadsheet #2.');
      }
    } finally {
      setLoadingRemoteWilayah(false);
    }
  };

  // CSV Upload to Spreadsheet #2 (supports 11-column KODE_WILAYAH_gabungan CSV or standard Kode_Wilayah format)
  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportingCsv(true);
    setErrorBanner('');
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setErrorBanner('File CSV kosong atau tidak memiliki baris data.');
        return;
      }

      const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
      const headers = splitCsvLine(lines[0], delimiter).map((h) =>
        h.toLowerCase().replace(/[^a-z0-9]/g, ''),
      );

      const isFlatGabungan =
        headers.includes('pulau') &&
        headers.includes('prov') &&
        headers.includes('kab') &&
        headers.includes('kec') &&
        headers.includes('kel');

      const parsedRows: KodeWilayahItem[] = [];

      if (isFlatGabungan) {
        const idxId = headers.indexOf('id');
        const idxPulau = headers.indexOf('pulau');
        const idxProv = headers.indexOf('prov');
        const idxProvId = headers.indexOf('provid');
        const idxKab = headers.indexOf('kab');
        const idxKabId = headers.indexOf('kabid');
        const idxKec = headers.indexOf('kec');
        const idxKecId = headers.indexOf('kecid');
        const idxKel = headers.indexOf('kel');
        const idxKelId = headers.indexOf('kelid');

        for (let i = 1; i < lines.length; i++) {
          const cols = splitCsvLine(lines[i], delimiter);
          const kode =
            (idxKelId >= 0 ? cols[idxKelId] : '') || (idxId >= 0 ? cols[idxId] : '') || '';
          if (!kode) continue;
          const kodeKec = idxKecId >= 0 ? cols[idxKecId] || '' : '';
          parsedRows.push({
            kodeWilayah: kode,
            tingkat: 'KelDesa',
            pulau: idxPulau >= 0 ? cols[idxPulau] || '' : '',
            kodeProvinsi: idxProvId >= 0 ? cols[idxProvId] || '' : '',
            namaProvinsi: idxProv >= 0 ? cols[idxProv] || '' : '',
            kodeKabKota: idxKabId >= 0 ? cols[idxKabId] || '' : '',
            namaKabKota: idxKab >= 0 ? cols[idxKab] || '' : '',
            kodeKecamatan: kodeKec,
            namaKecamatan: idxKec >= 0 ? cols[idxKec] || '' : '',
            namaKelDesa: idxKel >= 0 ? cols[idxKel] || '' : '',
            parentKode: kodeKec,
          });
        }
      } else {
        const findIdx = (candidates: string[]) =>
          headers.findIndex((h) => candidates.some((c) => h.includes(c)));
        const idxKode = findIdx(['kodewilayah', 'kode', 'code']);
        const idxTingkat = findIdx(['tingkat', 'level']);
        const idxPulau = findIdx(['pulau', 'island', 'region']);
        const idxKodeProv = findIdx(['kodeprov']);
        const idxNamaProv = findIdx(['namaprov', 'provinsi']);
        const idxKodeKab = findIdx(['kodekab', 'kodekota']);
        const idxNamaKab = findIdx(['namakab', 'kabkota', 'kabupaten', 'kota']);
        const idxKodeKec = findIdx(['kodekec']);
        const idxNamaKec = findIdx(['namakec', 'kecamatan']);
        const idxNamaDesa = findIdx(['keldesa', 'kelurahan', 'desa']);
        const idxParent = findIdx(['parent']);

        for (let i = 1; i < lines.length; i++) {
          const cols = splitCsvLine(lines[i], delimiter);
          const kode = idxKode >= 0 ? cols[idxKode] || '' : cols[0] || '';
          if (!kode) continue;
          const tingkat = inferTingkat(kode, idxTingkat >= 0 ? cols[idxTingkat] : undefined);
          const segs = kode.split('.').filter(Boolean);
          parsedRows.push({
            kodeWilayah: kode,
            tingkat,
            pulau: idxPulau >= 0 ? cols[idxPulau] || '' : '',
            kodeProvinsi: idxKodeProv >= 0 ? cols[idxKodeProv] || segs[0] || '' : segs[0] || '',
            namaProvinsi: idxNamaProv >= 0 ? cols[idxNamaProv] || '' : '',
            kodeKabKota:
              idxKodeKab >= 0
                ? cols[idxKodeKab] || ''
                : segs.length >= 2
                  ? segs.slice(0, 2).join('.')
                  : '',
            namaKabKota: idxNamaKab >= 0 ? cols[idxNamaKab] || '' : '',
            kodeKecamatan:
              idxKodeKec >= 0
                ? cols[idxKodeKec] || ''
                : segs.length >= 3
                  ? segs.slice(0, 3).join('.')
                  : '',
            namaKecamatan: idxNamaKec >= 0 ? cols[idxNamaKec] || '' : '',
            namaKelDesa: idxNamaDesa >= 0 ? cols[idxNamaDesa] || '' : '',
            parentKode:
              idxParent >= 0
                ? cols[idxParent] || ''
                : segs.length > 1
                  ? segs.slice(0, segs.length - 1).join('.')
                  : '',
          });
        }
      }

      if (parsedRows.length === 0) {
        setErrorBanner('Tidak ada baris kode wilayah valid yang terbaca dari CSV.');
        return;
      }

      const BATCH_SIZE = 500;
      for (let start = 0; start < parsedRows.length; start += BATCH_SIZE) {
        const slice = parsedRows.slice(start, start + BATCH_SIZE);
        const res = await importKodeWilayahBatch(
          slice,
          start === 0,
          activePin,
          webAppUrl,
        );
        if (!res.ok) {
          setErrorBanner(res.error || 'Gagal mengunggah batch CSV ke Spreadsheet #2.');
          return;
        }
      }

      const summaryRows = parsedRows.filter(
        (r) => r.tingkat === 'Pulau' || r.tingkat === 'Provinsi' || r.tingkat === 'KabKota',
      );
      if (summaryRows.length > 0) {
        onImportedKodeWilayah(summaryRows);
      }
      showTempNotice(
        `Berhasil mengimpor ${parsedRows.length.toLocaleString('id-ID')} baris kode wilayah ke Spreadsheet #2.`,
      );
    } finally {
      setImportingCsv(false);
    }
  };

  // Export CSV for filtered institutional rows
  const handleExportCsv = () => {
    const headers = [
      'Kode Wilayah',
      'Tingkat',
      'Pulau',
      'Provinsi',
      'Kabupaten/Kota',
      'Kecamatan',
      'Kelurahan/Desa',
      'Nama Lembaga',
      'Status Terbentuk',
      'Ketua',
      'WA Ketua',
      'Sekretaris',
      'WA Sekretaris',
      'Alamat Kantor',
      'Tautan Drive',
    ];
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...filteredRows.map((d) =>
        [
          d.kodeWilayah,
          d.jenis,
          d.pulau,
          d.namaProvinsi,
          d.namaKabKota || '',
          d.namaKecamatan || '',
          d.namaKelDesa || '',
          d.namaLembaga,
          d.statusTerbentuk,
          d.ketuaNama,
          d.ketuaWa,
          d.sekretarisNama,
          d.sekretarisWa,
          d.alamatKantor || '',
          d.tautanDrive || '',
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kelembagaan_${subTab.toUpperCase()}_DUWD_WI.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoadingTabData =
    (subTab === 'dpc' && loadingKecs) ||
    (subTab === 'dpr' && (loadingKecs || loadingKels)) ||
    (subTab === 'semua' && (loadingKecs || loadingKels));

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'dpw', label: `DPW (${kpi.dpwTotal})` },
    { id: 'dpd', label: `DPD (${kpi.dpdTotal})` },
    { id: 'dpc', label: `DPC (${kpi.dpcTotal.toLocaleString('id-ID')})` },
    { id: 'dpr', label: `DPR (${kpi.dprTotal.toLocaleString('id-ID')})` },
    { id: 'semua', label: 'Semua Lembaga' },
    { id: 'wilayah', label: 'Referensi Kode Wilayah' },
  ];

  return (
    <section className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 lg:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#0C7A89]">
            Konsolidasi Wilayah &amp; Daerah &middot; Hierarki 83.762 Kode Wilayah Indonesia
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] sm:text-3xl">
            Direktori DPW, DPD, DPC &amp; DPR
          </h1>
          <p className="mt-1 text-sm text-[#526A70]">
            Provinsi (DPW) &middot; Kab/Kota (DPD) &middot; Kecamatan (DPC) &middot; Kelurahan/Desa (DPR). Pulau digunakan untuk pengelompokan wilayah.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {subTab !== 'wilayah' && (
            <>
              <button
                type="button"
                disabled={filteredRows.length === 0}
                onClick={handleOpenFilteredCopyModal}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-[#0C7A89]/25 bg-[#EBF5F8] px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4] disabled:opacity-50"
              >
                <Copy className="h-3.5 w-3.5 text-[#0C7A89]" />
                <span>Salin Hasil ({filteredRows.length.toLocaleString('id-ID')})</span>
              </button>

              <button
                type="button"
                disabled={filteredRows.length === 0}
                onClick={handleExportCsv}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5 text-[#0C7A89]" />
                <span>Unduh CSV</span>
              </button>
            </>
          )}

          {webAppUrl.trim() && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={syncing}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan Sheet'}</span>
            </button>
          )}

          {isSuperAdmin &&
            (subTab === 'dpw' || subTab === 'dpd' || subTab === 'dpc' || subTab === 'dpr') && (
              <button
                type="button"
                onClick={() => openManualCreateModal(subTab.toUpperCase() as JenisLembaga)}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah {subTab.toUpperCase()}</span>
              </button>
            )}
        </div>
      </div>

      {/* Warning jika Spreadsheet #2 belum tersambung */}
      {(!webAppUrl.trim() || !wilayahConnected) && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#D88B15]/35 bg-[#FFF9EE] px-4 py-3 text-xs text-[#7D4D06]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D88B15]" />
          <div>
            <span className="font-bold">Info Koneksi Spreadsheet #2:</span>{' '}
            {!webAppUrl.trim()
              ? 'Daftar 83.762 kode wilayah tetap aktif secara lokal, namun perubahan status & kontak tidak akan tersimpan ke Google Spreadsheet sebelum URL Web App GAS diatur di Pengaturan & GAS.'
              : 'Spreadsheet #2 belum ditautkan di Pengaturan & GAS (mode pratinjau lokal aktif).'}
          </div>
        </div>
      )}

      {/* Role Permissions Info for Admin */}
      {role === 'admin' && (
        <div className="mt-3 rounded-xl border border-[#0C7A89]/20 bg-[#F2FAFB] px-4 py-2.5 text-xs text-[#07525E]">
          <span className="font-bold">Hak Akses Admin:</span> Anda dapat mengedit <strong>Nama &amp; Nomor WhatsApp Ketua dan Sekretaris</strong> pada DPW, DPD, DPC, dan DPR. Pengaturan status pembentukan lembaga dikelola oleh Super Admin.
        </div>
      )}

      {/* KPI Summary Strip (4 columns, clean typography) */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setSubTab('dpw')}
          className="glass-surface cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-white/85"
        >
          <div className="text-[11px] font-semibold text-[#526A70]">DPW &middot; Provinsi</div>
          <div className="mt-1 text-2xl font-bold text-[#07525E] tabular-nums">
            {kpi.dpwTerbentuk}
            <span className="ml-1 text-sm font-medium text-[#6B8187]">
              / {kpi.dpwTotal}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] tabular-nums">
            Terbentuk &middot; Persiapan: {kpi.dpwPersiapan}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('dpd')}
          className="glass-surface cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-white/85"
        >
          <div className="text-[11px] font-semibold text-[#526A70]">DPD &middot; Kab/Kota</div>
          <div className="mt-1 text-2xl font-bold text-[#0C7A89] tabular-nums">
            {kpi.dpdTerbentuk}
            <span className="ml-1 text-sm font-medium text-[#6B8187]">
              / {kpi.dpdTotal}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] tabular-nums">
            Terbentuk &middot; Persiapan: {kpi.dpdPersiapan}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('dpc')}
          className="glass-surface cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-white/85"
        >
          <div className="text-[11px] font-semibold text-[#526A70]">DPC &middot; Kecamatan</div>
          <div className="mt-1 text-2xl font-bold text-[#07525E] tabular-nums">
            {kpi.dpcTerbentuk}
            <span className="ml-1 text-sm font-medium text-[#6B8187]">
              / {kpi.dpcTotal.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] tabular-nums">
            Terbentuk &middot; Persiapan: {kpi.dpcPersiapan}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('dpr')}
          className="glass-surface cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-white/85"
        >
          <div className="text-[11px] font-semibold text-[#526A70]">DPR &middot; Kel/Desa</div>
          <div className="mt-1 text-2xl font-bold text-[#D88B15] tabular-nums">
            {kpi.dprTerbentuk}
            <span className="ml-1 text-sm font-medium text-[#6B8187]">
              / {kpi.dprTotal.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] tabular-nums">
            Terbentuk &middot; Persiapan: {kpi.dprPersiapan}
          </div>
        </button>
      </div>

      {notice && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#0C7A89]/25 bg-[#ECF6F2] px-4 py-2.5 text-xs font-medium text-[#07525E]">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="cursor-pointer text-[#526A70]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner('')}
            className="cursor-pointer text-amber-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sub-navigation + Cascading Multi-Filter Bar */}
      <div className="mt-5 glass-surface p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-xl bg-[#EBF5F8]/85 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`cursor-pointer whitespace-nowrap shrink-0 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  subTab === tab.id
                    ? 'bg-white text-[#07525E] shadow-xs'
                    : 'text-[#526A70] hover:text-[#07525E]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {isSuperAdmin && subTab === 'wilayah' && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-[#EBF5F8] px-3.5 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4]">
              <Upload className="h-3.5 w-3.5 text-[#0C7A89]" />
              <span>
                {importingCsv ? 'Mengimpor CSV...' : 'Impor CSV ke Sheet #2'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={importingCsv}
                onChange={handleCsvFileUpload}
                className="sr-only"
              />
            </label>
          )}
        </div>

        {/* Row 1 Filters: Search, Pulau, Provinsi, Kab/Kota, Kecamatan */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
          <div className="relative lg:col-span-4">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B8187]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode, wilayah, lembaga, ketua, sekretaris, WA..."
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2.5 pr-4 pl-10 text-xs text-[#0F2429] placeholder:text-[#7D9197] focus:border-[#0C7A89] focus:outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              value={filterPulau}
              onChange={(e) => {
                setFilterPulau(e.target.value);
                setFilterProvinsi('ALL');
                setFilterKabKota('ALL');
                setFilterKecamatan('ALL');
                setRemoteWilayahRows([]);
              }}
              aria-label="Filter Pulau"
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none"
            >
              <option value="ALL">Semua Pulau (7)</option>
              {pulauOptions.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={filterProvinsi}
              onChange={(e) => {
                setFilterProvinsi(e.target.value);
                setFilterKabKota('ALL');
                setFilterKecamatan('ALL');
                setRemoteWilayahRows([]);
              }}
              aria-label="Filter Provinsi"
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none"
            >
              <option value="ALL">Semua Provinsi</option>
              {provOptions.map((p) => (
                <option key={p.kode} value={p.kode}>
                  {p.kode} — {p.nama}
                </option>
              ))}
            </select>
          </div>

          {subTab !== 'dpw' && (
            <div className="lg:col-span-2">
              <select
                value={filterKabKota}
                onChange={(e) => {
                  setFilterKabKota(e.target.value);
                  setFilterKecamatan('ALL');
                }}
                aria-label="Filter Kabupaten/Kota"
                className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none"
              >
                <option value="ALL">Semua Kab/Kota</option>
                {kabOptions.map((k) => (
                  <option key={k.kode} value={k.kode}>
                    {k.kode} — {k.nama}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(subTab === 'dpc' || subTab === 'dpr' || subTab === 'semua' || subTab === 'wilayah') && (
            <div className="lg:col-span-2">
              <select
                value={filterKecamatan}
                onChange={(e) => setFilterKecamatan(e.target.value)}
                disabled={!kecsLoaded}
                aria-label="Filter Kecamatan"
                className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none disabled:opacity-60"
              >
                <option value="ALL">
                  {kecsLoaded ? 'Semua Kecamatan' : 'Memuat Kecamatan...'}
                </option>
                {kecOptions.map((k) => (
                  <option key={k.kode} value={k.kode}>
                    {k.kode} — {k.nama}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Row 2 Filters: Jenis (on Semua), Status Lembaga, Kelengkapan Kontak, Reset */}
        {subTab !== 'wilayah' ? (
          <div className="flex flex-wrap items-center gap-2.5">
            {subTab === 'semua' && (
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value as 'ALL' | JenisLembaga)}
                aria-label="Filter Jenis Lembaga"
                className="rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none"
              >
                <option value="ALL">Semua Jenis (DPW/DPD/DPC/DPR)</option>
                <option value="DPW">DPW (Provinsi)</option>
                <option value="DPD">DPD (Kab/Kota)</option>
                <option value="DPC">DPC (Kecamatan)</option>
                <option value="DPR">DPR (Kelurahan/Desa)</option>
              </select>
            )}

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
              aria-label="Filter Status Pembentukan"
              className="rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none"
            >
              <option value="ALL">Semua Status Lembaga</option>
              <option value="SUDAH_ADA">Sudah Ada Lembaga (Terbentuk / Persiapan)</option>
              {STATUS_TERBENTUK_OPTIONS.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>

            <select
              value={filterContact}
              onChange={(e) => setFilterContact(e.target.value as ContactFilter)}
              aria-label="Filter Kelengkapan Kontak"
              className="rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none"
            >
              <option value="ALL">Semua Kelengkapan Kontak</option>
              <option value="LENGKAP">Kontak Lengkap (Ketua &amp; Sekretaris)</option>
              <option value="ADA_KETUA">Sudah Ada Ketua</option>
              <option value="ADA_SEKRETARIS">Sudah Ada Sekretaris</option>
              <option value="BELUM_ADA">Belum Ada Kontak</option>
            </select>

            {subTab === 'semua' && !allKelLoaded && filterProvinsi === 'ALL' && filterJenis === 'ALL' && (
              <button
                type="button"
                onClick={() => void ensureKelurahanLoaded('ALL', true)}
                disabled={loadingKels}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#0C7A89]/25 bg-[#F2FAFB] px-3 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#E3F3F7] disabled:opacity-60"
              >
                {loadingKels && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Muat 83.762 DPR (Kel/Desa)</span>
              </button>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-xs font-semibold text-[#526A70] hover:text-[#07525E]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Filter</span>
              </button>
            )}

            <span className="ml-auto text-xs font-medium text-[#526A70] tabular-nums">
              {filteredRows.length.toLocaleString('id-ID')} hasil ditemukan
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {wilayahConnected && filterProvinsi !== 'ALL' && (
                <button
                  type="button"
                  disabled={loadingRemoteWilayah}
                  onClick={() => void handleLoadRemoteWilayah()}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#0C7A89]/25 bg-[#EBF5F8] px-3 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4] disabled:opacity-50"
                >
                  {loadingRemoteWilayah && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Ambil dari Sheet #2</span>
                </button>
              )}
              {!allKelLoaded && filterProvinsi === 'ALL' && (
                <button
                  type="button"
                  disabled={loadingKels}
                  onClick={() => void ensureKelurahanLoaded('ALL', true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#0C7A89]/25 bg-[#F2FAFB] px-3 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#E3F3F7] disabled:opacity-60"
                >
                  {loadingKels && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Muat Seluruh 83.762 Kel/Desa</span>
                </button>
              )}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-xs font-semibold text-[#526A70] hover:text-[#07525E]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </div>
            <span className="text-xs font-medium text-[#526A70] tabular-nums">
              {filteredWilayahRows.length.toLocaleString('id-ID')} kode wilayah tampil
            </span>
          </div>
        )}
      </div>

      {/* MAIN CONTENT TABLE */}
      {subTab !== 'wilayah' ? (
        <div className="mt-5 glass-surface-strong overflow-visible">
          {isLoadingTabData && pagedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-[#0C7A89]" />
              <p className="mt-3 text-sm font-semibold text-[#07525E]">
                Memuat data wilayah Indonesia...
              </p>
              <p className="mt-1 text-xs text-[#526A70]">
                Menyiapkan daftar hierarki kode wilayah dan status kelembagaan.
              </p>
            </div>
          ) : pagedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF5F8] text-[#0C7A89]">
                <Building2 className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-base font-bold text-[#07525E]">
                Tidak Ada Data yang Cocok
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#526A70]">
                Ubah kata kunci pencarian atau atur ulang filter Pulau, Provinsi, Kabupaten, Kecamatan, maupun status lembaga.
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#07525E] px-4 py-2 text-xs font-semibold text-white"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Semua Filter</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto" ref={copyMenuContainerRef}>
              <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold tracking-wide text-[#355158] uppercase">
                    <th className="px-4 py-3.5">Kode &amp; Tingkat</th>
                    <th className="px-4 py-3.5">Hierarki Wilayah</th>
                    <th className="px-4 py-3.5">Lembaga &amp; Status</th>
                    <th className="px-4 py-3.5">Ketua</th>
                    <th className="px-4 py-3.5">Sekretaris</th>
                    <th className="px-4 py-3.5 text-right">Salin &amp; Kelola</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#07525E]/8">
                  {pagedRows.map((row) => {
                    const rowKey = `${row.jenis}-${row.kodeWilayah}`;
                    const isMenuOpen = openCopyKey === rowKey;
                    const wilayahTrail = [
                      row.pulau,
                      row.namaProvinsi,
                      row.namaKabKota,
                      row.namaKecamatan,
                      row.namaKelDesa,
                    ]
                      .filter(Boolean)
                      .join(' / ');

                    return (
                      <tr key={rowKey} className="align-top hover:bg-white/75">
                        <td className="px-4 py-3.5">
                          <div className="font-mono font-bold text-[#07525E] tabular-nums">
                            {row.kodeWilayah}
                          </div>
                          <div className="mt-0.5 text-[11px] font-medium text-[#526A70]">
                            {getJenisLabel(row.jenis)}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-[#0F2429]">{row.namaWilayah}</div>
                          <div className="mt-0.5 text-[11px] text-[#526A70]">
                            {wilayahTrail || '-'}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-bold text-[#07525E]">{row.namaLembaga}</div>
                          <div className={`mt-0.5 text-[11px] ${getStatusColor(row.statusTerbentuk)}`}>
                            {row.statusTerbentuk}
                          </div>
                          {row.tautanDrive && (
                            <a
                              href={row.tautanDrive}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0C7A89] hover:underline"
                            >
                              <ExternalLink className="h-3 w-3" />
                              <span>Drive SK</span>
                            </a>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-[#0F2429]">
                            {row.ketuaNama || '-'}
                          </div>
                          {row.ketuaWa ? (
                            <a
                              href={buildWhatsAppLink(row.ketuaWa)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#0C7A89] hover:underline tabular-nums"
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
                              <span>{row.ketuaWa}</span>
                            </a>
                          ) : (
                            <div className="mt-0.5 text-[11px] text-[#7D9197]">WA belum diisi</div>
                          )}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-[#0F2429]">
                            {row.sekretarisNama || '-'}
                          </div>
                          {row.sekretarisWa ? (
                            <a
                              href={buildWhatsAppLink(row.sekretarisWa)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#0C7A89] hover:underline tabular-nums"
                            >
                              <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
                              <span>{row.sekretarisWa}</span>
                            </a>
                          ) : (
                            <div className="mt-0.5 text-[11px] text-[#7D9197]">WA belum diisi</div>
                          )}
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="relative inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenCopyKey((prev) => (prev === rowKey ? null : rowKey))
                              }
                              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-[#0C7A89]/25 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8]"
                            >
                              <Copy className="h-3 w-3 text-[#0C7A89]" />
                              <span>Salin</span>
                              <ChevronDown className="h-3 w-3" />
                            </button>

                            {canEditContacts && (
                              <button
                                type="button"
                                onClick={() => openEditModal(row)}
                                className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-[#07525E]/15 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8]"
                              >
                                <Pencil className="h-3 w-3 text-[#0C7A89]" />
                                <span>{isSuperAdmin ? 'Edit' : 'Edit Kontak'}</span>
                              </button>
                            )}

                            {isMenuOpen && (
                              <div className="absolute top-full right-0 z-30 mt-1.5 w-64 rounded-xl border border-[#07525E]/15 bg-white p-1.5 text-left shadow-xl">
                                <div className="px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#6B8187] uppercase">
                                  Salin Baris Ini
                                </div>
                                <button
                                  type="button"
                                  onClick={() => void handleQuickRowCopy(row, 'ketua_sekretaris')}
                                  className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#0F2429] hover:bg-[#EBF5F8]"
                                >
                                  Salin Ketua &amp; Sekretaris
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleQuickRowCopy(row, 'ketua_saja')}
                                  className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#0F2429] hover:bg-[#EBF5F8]"
                                >
                                  Salin Ketua Saja
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleQuickRowCopy(row, 'sekretaris_saja')}
                                  className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#0F2429] hover:bg-[#EBF5F8]"
                                >
                                  Salin Sekretaris Saja
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleQuickRowCopy(row, 'lengkap')}
                                  className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#0F2429] hover:bg-[#EBF5F8]"
                                >
                                  Salin Info Lengkap
                                </button>

                                {row.jenis !== 'DPR' && (
                                  <>
                                    <div className="my-1 border-t border-[#07525E]/10" />
                                    <div className="px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#0C7A89] uppercase">
                                      Salin Wilayah Turunan
                                    </div>
                                    {row.jenis === 'DPW' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleOpenChildCopyModal(row, 'nama_saja')
                                          }
                                          className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8]"
                                        >
                                          Daftar Nama DPD di Prov. ini
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleOpenChildCopyModal(row, 'ketua_sekretaris')
                                          }
                                          className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#07525E] hover:bg-[#EBF5F8]"
                                        >
                                          Ketua &amp; Sek DPD di Prov. ini
                                        </button>
                                      </>
                                    )}
                                    {row.jenis === 'DPD' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleOpenChildCopyModal(row, 'nama_saja')
                                          }
                                          className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8]"
                                        >
                                          Daftar Nama DPC di Kab/Kota ini
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleOpenChildCopyModal(row, 'ketua_sekretaris')
                                          }
                                          className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#07525E] hover:bg-[#EBF5F8]"
                                        >
                                          Ketua &amp; Sek DPC di Kab/Kota ini
                                        </button>
                                      </>
                                    )}
                                    {row.jenis === 'DPC' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleOpenChildCopyModal(row, 'nama_saja')
                                          }
                                          className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8]"
                                        >
                                          Daftar Nama DPR di Kec. ini
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handleOpenChildCopyModal(row, 'ketua_sekretaris')
                                          }
                                          className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#07525E] hover:bg-[#EBF5F8]"
                                        >
                                          Ketua &amp; Sek DPR di Kec. ini
                                        </button>
                                      </>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* TAB REFERENSI KODE WILAYAH */
        <div className="mt-5 glass-surface-strong overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 bg-[#F4FAFB] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[#0C7A89]" />
              <span className="text-xs font-bold text-[#07525E]">
                Master Referensi Kode Wilayah Indonesia (Pulau, Provinsi, Kab/Kota, Kecamatan, Kel/Desa)
              </span>
            </div>
            <span className="text-[11px] font-medium text-[#526A70] tabular-nums">
              Menampilkan {filteredWilayahRows.length.toLocaleString('id-ID')} baris
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#07525E]/10 bg-white/70 text-[11px] font-bold tracking-wide text-[#355158] uppercase">
                  <th className="px-4 py-3">Kode Wilayah</th>
                  <th className="px-4 py-3">Tingkat</th>
                  <th className="px-4 py-3">Pulau</th>
                  <th className="px-4 py-3">Provinsi</th>
                  <th className="px-4 py-3">Kabupaten/Kota</th>
                  <th className="px-4 py-3">Kecamatan / Kel-Desa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#07525E]/8">
                {pagedWilayahRows.map((row) => (
                  <tr
                    key={`${row.tingkat}-${row.kodeWilayah}`}
                    className="hover:bg-white/75"
                  >
                    <td className="px-4 py-3 font-mono font-bold text-[#07525E] tabular-nums">
                      {row.kodeWilayah}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[#0C7A89]">
                      {row.tingkat}
                    </td>
                    <td className="px-4 py-3 text-[#355158]">{row.pulau || '-'}</td>
                    <td className="px-4 py-3 font-medium text-[#0F2429]">
                      {row.namaProvinsi || '-'}
                    </td>
                    <td className="px-4 py-3 text-[#355158]">
                      {row.namaKabKota || '-'}
                    </td>
                    <td className="px-4 py-3 text-[#355158]">
                      {[row.namaKecamatan, row.namaKelDesa].filter(Boolean).join(' / ') || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bar */}
      {activeItemCount > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#07525E]/10 bg-white/70 px-4 py-2.5 text-xs text-[#355158]">
          <span className="font-medium tabular-nums">
            Menampilkan {(pageStart + 1).toLocaleString('id-ID')}–
            {Math.min(pageStart + PAGE_SIZE, activeItemCount).toLocaleString('id-ID')} dari{' '}
            {activeItemCount.toLocaleString('id-ID')} data (Halaman {safePage.toLocaleString('id-ID')} /{' '}
            {totalPages.toLocaleString('id-ID')})
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#07525E]/15 bg-white px-3 py-1.5 font-semibold text-[#07525E] hover:bg-[#EBF5F8] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Sebelumnya</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#07525E]/15 bg-white px-3 py-1.5 font-semibold text-[#07525E] hover:bg-[#EBF5F8] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>Berikutnya</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* COPY MODAL */}
      {copyModalState && (
        <WilayahCopyModal
          title={copyModalState.title}
          subtitle={copyModalState.subtitle}
          rows={copyModalState.rows}
          initialMode={copyModalState.initialMode}
          onClose={() => setCopyModalState(null)}
        />
      )}

      {/* UNIFIED EDIT / CREATE MODAL (DPW, DPD, DPC, DPR) */}
      {editModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kelembagaan-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072B31]/45 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong relative max-h-[92vh] w-full max-w-xl overflow-y-auto bg-white p-6">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              aria-label="Tutup form"
              className="absolute top-4 right-4 cursor-pointer rounded-lg p-1.5 text-[#526A70] hover:bg-[#EBF5F8]"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 id="kelembagaan-modal-title" className="text-lg font-bold text-[#07525E]">
              {isManualCreate
                ? `Tambah Data ${formJenis}`
                : isSuperAdmin
                  ? `Kelola ${formJenis} · ${formKodeWilayah}`
                  : `Edit Kontak ${formJenis} · ${formKodeWilayah}`}
            </h2>
            <p className="mt-1 text-xs text-[#526A70]">
              {isSuperAdmin
                ? `Pengaturan status pembentukan, nama lembaga, serta kontak Ketua & Sekretaris ${formJenis} di Spreadsheet #2.`
                : 'Mode Admin: Anda hanya diperkenankan mengubah Nama dan Nomor WhatsApp Ketua & Sekretaris.'}
            </p>

            <form onSubmit={handleSubmitForm} className="mt-5 space-y-4">
              {isManualCreate && isSuperAdmin ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#355158]">
                      Kode Wilayah *
                    </label>
                    <input
                      type="text"
                      value={formKodeWilayah}
                      onChange={(e) => setFormKodeWilayah(e.target.value)}
                      placeholder="Contoh: 73 atau 73.71 atau 73.71.01"
                      className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#355158]">
                      Pulau
                    </label>
                    <input
                      type="text"
                      value={formPulau}
                      onChange={(e) => setFormPulau(e.target.value)}
                      placeholder="Contoh: Sulawesi"
                      className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#355158]">
                      Nama Provinsi
                    </label>
                    <input
                      type="text"
                      value={formNamaProvinsi}
                      onChange={(e) => setFormNamaProvinsi(e.target.value)}
                      placeholder="Contoh: Sulawesi Selatan"
                      className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                    />
                  </div>
                  {formJenis !== 'DPW' && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#355158]">
                        Nama Kab/Kota
                      </label>
                      <input
                        type="text"
                        value={formNamaKabKota}
                        onChange={(e) => setFormNamaKabKota(e.target.value)}
                        placeholder="Contoh: Kota Makassar"
                        className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                      />
                    </div>
                  )}
                  {(formJenis === 'DPC' || formJenis === 'DPR') && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#355158]">
                        Nama Kecamatan
                      </label>
                      <input
                        type="text"
                        value={formNamaKecamatan}
                        onChange={(e) => setFormNamaKecamatan(e.target.value)}
                        className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                      />
                    </div>
                  )}
                  {formJenis === 'DPR' && (
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-[#355158]">
                        Nama Kelurahan/Desa
                      </label>
                      <input
                        type="text"
                        value={formNamaKelDesa}
                        onChange={(e) => setFormNamaKelDesa(e.target.value)}
                        className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-[#07525E]/10 bg-[#F4FAFB] px-3.5 py-2.5 text-xs text-[#355158]">
                  <span className="font-mono font-bold text-[#07525E]">{formKodeWilayah}</span>
                  <span className="mx-1.5 text-[#7D9197]">&middot;</span>
                  <span>
                    {[
                      formPulau,
                      formNamaProvinsi,
                      formNamaKabKota,
                      formNamaKecamatan,
                      formNamaKelDesa,
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Nama Lembaga {formJenis}
                  </label>
                  <input
                    type="text"
                    disabled={!isSuperAdmin}
                    value={formNamaLembaga}
                    onChange={(e) => setFormNamaLembaga(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none disabled:bg-[#F4FAFB] disabled:text-[#526A70]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Status Kelembagaan
                  </label>
                  <select
                    disabled={!isSuperAdmin}
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as StatusTerbentuk)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none disabled:bg-[#F4FAFB] disabled:text-[#526A70]"
                  >
                    {STATUS_TERBENTUK_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Nama Ketua {formJenis}
                  </label>
                  <input
                    type="text"
                    value={formKetuaNama}
                    onChange={(e) => setFormKetuaNama(e.target.value)}
                    placeholder="Nama lengkap Ketua"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="form-ketua-wa"
                    className="mb-1 block text-xs font-semibold text-[#355158]"
                  >
                    Nomor WA Ketua
                  </label>
                  <WhatsAppInput
                    id="form-ketua-wa"
                    value={formKetuaWa}
                    onChange={setFormKetuaWa}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Nama Sekretaris {formJenis}
                  </label>
                  <input
                    type="text"
                    value={formSekNama}
                    onChange={(e) => setFormSekNama(e.target.value)}
                    placeholder="Nama lengkap Sekretaris"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
                <div>
                  <label
                    htmlFor="form-sek-wa"
                    className="mb-1 block text-xs font-semibold text-[#355158]"
                  >
                    Nomor WA Sekretaris
                  </label>
                  <WhatsAppInput
                    id="form-sek-wa"
                    value={formSekWa}
                    onChange={setFormSekWa}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158]">
                  Alamat Kantor / Sekretariat (Opsional)
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={formAlamat}
                  onChange={(e) => setFormAlamat(e.target.value)}
                  placeholder="Jl. ..."
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none disabled:bg-[#F4FAFB] disabled:text-[#526A70]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158]">
                  Tautan Google Drive SK / Dokumen (Opsional)
                </label>
                <input
                  type="url"
                  disabled={!isSuperAdmin}
                  value={formDrive}
                  onChange={(e) => setFormDrive(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none disabled:bg-[#F4FAFB] disabled:text-[#526A70]"
                />
              </div>

              {formErr && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900">
                  {formErr}
                </div>
              )}

              {confirmDeleteOpen && isSuperAdmin && formHasSheetRecord && formId && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900">
                  <span className="font-medium">
                    Hapus catatan ini dari Spreadsheet #2? Wilayah akan kembali ke status Belum Terbentuk.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(false)}
                      className="cursor-pointer rounded-lg px-2.5 py-1 font-semibold text-[#355158] hover:bg-white"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={formDeleting}
                      onClick={() => void handleDeleteCurrentRecord()}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{formDeleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div>
                  {isSuperAdmin && formHasSheetRecord && formId && !confirmDeleteOpen && (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(true)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Hapus dari Sheet</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold text-[#526A70] hover:bg-[#F4FAFB]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={formSaving}
                    className="cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
                  >
                    {formSaving
                      ? 'Menyimpan...'
                      : isSuperAdmin
                        ? `Simpan ${formJenis}`
                        : 'Simpan Kontak'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
