import {
  AlertTriangle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Loader2,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildLembagaId,
  deleteDpcRecord,
  deleteDpdRecord,
  deleteDprRecord,
  deleteDpwRecord,
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
  UserRole,
} from '../types/org';
import {
  buildWhatsAppLink,
  isValidWhatsApp,
  normalizeWhatsApp,
} from '../utils/whatsapp';
import { WhatsAppInput } from './WhatsAppInput';
import {
  formatEntityDisplayName,
  formatKelembagaanRowsText,
  WilayahCopyModal,
  type CopyFormatMode,
} from './WilayahCopyModal';

interface DpwDpdViewProps {
  role: UserRole;
  activePin: string;
  webAppUrl: string;
  wilayahConnected: boolean;
  kodeWilayahList?: KodeWilayahItem[];
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
  onImportedKodeWilayah?: (rows: KodeWilayahItem[]) => void;
}

type SubTab = 'dpw' | 'dpd' | 'dpc' | 'dpr' | 'semua';
type StatusFilter = 'ALL' | StatusTerbentuk;
type ContactFilter = 'ALL' | 'LENGKAP' | 'ADA_KETUA' | 'ADA_SEKRETARIS' | 'BELUM_ADA';
type TargetMode = 'full' | 'visi2030';
type PageSizeOption = 5 | 10 | 25 | 50 | 100 | 500 | 'ALL';

interface PickerCandidate {
  kode: string;
  nama: string;
  pulau: string;
  kodeProv: string;
  namaProv: string;
  kodeKab?: string;
  namaKab?: string;
  kodeKec?: string;
  namaKec?: string;
  namaKel?: string;
  subtitle: string;
  alreadyTerbentuk: boolean;
}

const PAGE_SIZE_OPTIONS: PageSizeOption[] = [5, 10, 25, 50, 100, 500, 'ALL'];
const MAX_ALL_RENDER_ROWS = 2000;
const MAX_MODAL_COPY_ROWS = 5000;
const VISI_2030_DPW_TARGET = 38;
const VISI_2030_DPD_TARGET = 412;

const STATUS_TERBENTUK_OPTIONS: StatusTerbentuk[] = [
  'Sudah Terbentuk',
  'Belum Terbentuk',
];

function normalizeStatus(raw: string | undefined): StatusTerbentuk {
  return String(raw || '').trim() === 'Sudah Terbentuk'
    ? 'Sudah Terbentuk'
    : 'Belum Terbentuk';
}

function compareKode(a: string, b: string): number {
  return String(a || '').localeCompare(String(b || ''), 'id', { numeric: true });
}

function formatPct(count: number, total: number): string {
  if (!total || total <= 0) return '0%';
  const pct = (count / total) * 100;
  if (pct >= 100) return '100%';
  if (pct === 0) return '0%';
  return `${pct.toLocaleString('id-ID', {
    minimumFractionDigits: pct < 1 ? 2 : 1,
    maximumFractionDigits: pct < 1 ? 2 : 1,
  })}%`;
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

export function DpwDpdView({
  role,
  activePin,
  webAppUrl,
  wilayahConnected,
  kodeWilayahList = [],
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

  // Navigation, Target Mode & Filters (default auto-filter: Sudah Terbentuk)
  const [targetMode, setTargetMode] = useState<TargetMode>('full');
  const [subTab, setSubTab] = useState<SubTab>('dpw');
  const [filterPulau, setFilterPulau] = useState('ALL');
  const [filterProvinsi, setFilterProvinsi] = useState('ALL');
  const [filterKabKota, setFilterKabKota] = useState('ALL');
  const [filterKecamatan, setFilterKecamatan] = useState('ALL');
  const [filterJenis, setFilterJenis] = useState<'ALL' | JenisLembaga>('ALL');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('Sudah Terbentuk');
  const [filterContact, setFilterContact] = useState<ContactFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState<PageSizeOption>(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Notices, Errors & Background Sync Status
  const [notice, setNotice] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [bgPendingCount, setBgPendingCount] = useState(0);
  const [bgSavedNotice, setBgSavedNotice] = useState('');
  const bgNoticeTimerRef = useRef<number | null>(null);

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
  const [formErr, setFormErr] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // Smart Autodropdown Autosearch Territory Picker inside Create Modal
  const [pickerPulauFilter, setPickerPulauFilter] = useState('ALL');
  const [pickerProvFilter, setPickerProvFilter] = useState('ALL');
  const [pickerKabFilter, setPickerKabFilter] = useState('ALL');
  const [pickerKecFilter, setPickerKecFilter] = useState('ALL');
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerDropdownOpen, setPickerDropdownOpen] = useState(false);
  const pickerContainerRef = useRef<HTMLDivElement | null>(null);
  const [modalKels, setModalKels] = useState<WilayahKelOption[]>([]);
  const [loadingModalKels, setLoadingModalKels] = useState(false);

  // Close copy dropdown on outside click or Escape
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

  // Close territory picker dropdown on outside click
  useEffect(() => {
    if (!pickerDropdownOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (
        pickerContainerRef.current &&
        !pickerContainerRef.current.contains(e.target as Node)
      ) {
        setPickerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [pickerDropdownOpen]);

  // Lazy-load kelurahan per provinsi for DPR picker inside Create Modal
  useEffect(() => {
    if (!editModalOpen || !isManualCreate || formJenis !== 'DPR') return;
    if (pickerProvFilter === 'ALL') {
      setModalKels([]);
      return;
    }
    let active = true;
    setLoadingModalKels(true);
    void loadKelurahanByProv(pickerProvFilter)
      .then((list) => {
        if (active) setModalKels(list);
      })
      .catch(() => {
        if (active) setModalKels([]);
      })
      .finally(() => {
        if (active) setLoadingModalKels(false);
      });
    return () => {
      active = false;
    };
  }, [editModalOpen, isManualCreate, formJenis, pickerProvFilter]);

  useEffect(() => {
    return () => {
      if (bgNoticeTimerRef.current) {
        window.clearTimeout(bgNoticeTimerRef.current);
      }
    };
  }, []);

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

  useEffect(() => {
    if (
      subTab === 'dpc' ||
      subTab === 'dpr' ||
      subTab === 'semua' ||
      filterKabKota !== 'ALL'
    ) {
      if (!kecsLoaded && !loadingKecs) {
        void ensureKecamatanLoaded();
      }
    }
  }, [subTab, filterKabKota, kecsLoaded, loadingKecs]);

  useEffect(() => {
    if (subTab === 'dpr') {
      void ensureKelurahanLoaded(filterProvinsi, true);
    } else if (subTab === 'semua' && (filterJenis === 'DPR' || filterProvinsi !== 'ALL')) {
      void ensureKelurahanLoaded(filterProvinsi, filterJenis === 'DPR');
    }
  }, [subTab, filterProvinsi, filterJenis]);

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
    pageSize,
  ]);

  const handleSelectTab = (tab: SubTab) => {
    setSubTab(tab);
    // Saat klik tab DPW/DPD/DPC/DPR/Semua, autofilter ke Sudah Terbentuk
    setFilterStatus('Sudah Terbentuk');
    if (tab === 'dpw') {
      setFilterKabKota('ALL');
      setFilterKecamatan('ALL');
    } else if (tab === 'dpd') {
      setFilterKecamatan('ALL');
    }
  };

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
        namaLembaga: s?.namaDpw || `DPW ${p.nama}`,
        namaWilayah: s?.namaProvinsi || p.nama,
        statusTerbentuk: normalizeStatus(s?.statusTerbentuk),
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
          statusTerbentuk: normalizeStatus(s.statusTerbentuk),
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
        namaLembaga: s?.namaDpd || `DPD ${k.nama}`,
        namaWilayah: s?.namaKabKota || k.nama,
        statusTerbentuk: normalizeStatus(s?.statusTerbentuk),
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
          statusTerbentuk: normalizeStatus(s.statusTerbentuk),
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
        namaLembaga: s?.namaDpc || `DPC ${k.nama}`,
        namaWilayah: s?.namaKecamatan || k.nama,
        statusTerbentuk: normalizeStatus(s?.statusTerbentuk),
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
          statusTerbentuk: normalizeStatus(s.statusTerbentuk),
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
        namaLembaga: s?.namaDpr || `DPR ${k.nama}`,
        namaWilayah: s?.namaKelDesa || k.nama,
        statusTerbentuk: normalizeStatus(s?.statusTerbentuk),
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
          statusTerbentuk: normalizeStatus(s.statusTerbentuk),
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
      if (filterStatus !== 'ALL' && row.statusTerbentuk !== filterStatus) {
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
          formatEntityDisplayName(row, true),
          row.ketuaNama,
          row.ketuaWa,
          row.sekretarisNama,
          row.sekretarisWa,
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

  // Pagination (default 10, opsi 5/10/25/50/100/500/Semua)
  const activeItemCount = filteredRows.length;
  const isAllMode = pageSize === 'ALL';
  const effectivePageSize = isAllMode
    ? Math.max(1, Math.min(activeItemCount, MAX_ALL_RENDER_ROWS))
    : pageSize;
  const totalPages = isAllMode
    ? 1
    : Math.max(1, Math.ceil(activeItemCount / effectivePageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = isAllMode ? 0 : (safePage - 1) * effectivePageSize;

  const pagedRows = useMemo(
    () =>
      isAllMode
        ? filteredRows.slice(0, MAX_ALL_RENDER_ROWS)
        : filteredRows.slice(pageStart, pageStart + effectivePageSize),
    [filteredRows, isAllMode, pageStart, effectivePageSize],
  );

  // KPI Counters
  const kpi = useMemo(() => {
    const dpwTerbentuk = dpwList.filter(
      (d) => normalizeStatus(d.statusTerbentuk) === 'Sudah Terbentuk',
    ).length;
    const dpdTerbentuk = dpdList.filter(
      (d) => normalizeStatus(d.statusTerbentuk) === 'Sudah Terbentuk',
    ).length;
    const dpcTerbentuk = dpcList.filter(
      (d) => normalizeStatus(d.statusTerbentuk) === 'Sudah Terbentuk',
    ).length;
    const dprTerbentuk = dprList.filter(
      (d) => normalizeStatus(d.statusTerbentuk) === 'Sudah Terbentuk',
    ).length;

    return {
      dpwTerbentuk,
      dpwFullTotal: summary?.provs.length || 38,
      dpdTerbentuk,
      dpdFullTotal: summary?.kabs.length || 514,
      dpcTerbentuk,
      dpcTotal: kecsLoaded ? kecs.length : 7277,
      dprTerbentuk,
      dprTotal: 83762,
    };
  }, [dpwList, dpdList, dpcList, dprList, summary, kecsLoaded, kecs.length]);

  const hasActiveFilters =
    filterPulau !== 'ALL' ||
    filterProvinsi !== 'ALL' ||
    filterKabKota !== 'ALL' ||
    filterKecamatan !== 'ALL' ||
    filterJenis !== 'ALL' ||
    filterStatus !== 'Sudah Terbentuk' ||
    filterContact !== 'ALL' ||
    searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    setFilterPulau('ALL');
    setFilterProvinsi('ALL');
    setFilterKabKota('ALL');
    setFilterKecamatan('ALL');
    setFilterJenis('ALL');
    setFilterStatus('Sudah Terbentuk');
    setFilterContact('ALL');
    setSearchQuery('');
  };

  // Contextual Copy Title
  const buildFilterCopyTitle = (): string => {
    const scopeParts: string[] = [];
    if (subTab === 'dpw') scopeParts.push('DPW');
    else if (subTab === 'dpd') scopeParts.push('DPD');
    else if (subTab === 'dpc') scopeParts.push('DPC');
    else if (subTab === 'dpr') scopeParts.push('DPR');
    else if (filterJenis !== 'ALL') scopeParts.push(filterJenis);
    else scopeParts.push('Wilayah & Daerah');

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
      includeKode: false,
      includeNumbering: false,
      includeWi: false,
      groupByParent: false,
      headerTitle: '',
    });
    const label = formatEntityDisplayName(row, false);
    try {
      await navigator.clipboard.writeText(text);
      setOpenCopyKey(null);
      showTempNotice(`Info "${label}" berhasil disalin ke clipboard.`);
    } catch {
      setCopyModalState({
        title: label,
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
        subtitle: `${children.length} Kab/Kota di Provinsi ${parentRow.namaProvinsi}.`,
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
            namaLembaga: s?.namaDpc || `DPC ${k.nama}`,
            namaWilayah: s?.namaKecamatan || k.nama,
            statusTerbentuk: normalizeStatus(s?.statusTerbentuk),
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
        subtitle: `${children.length} Kecamatan di ${parentRow.namaKabKota || parentRow.namaWilayah}.`,
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
            namaLembaga: s?.namaDpr || `DPR ${k.nama}`,
            namaWilayah: s?.namaKelDesa || k.nama,
            statusTerbentuk: normalizeStatus(s?.statusTerbentuk),
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
        subtitle: `${children.length} Kelurahan/Desa di Kecamatan ${parentRow.namaKecamatan || parentRow.namaWilayah}.`,
        rows: children,
        initialMode,
      });
    }
  };

  // Options for Smart Territory Autodropdown inside Create Modal
  const pickerProvOptions = useMemo(() => {
    if (!summary) return [];
    return summary.provs
      .filter((p) => pickerPulauFilter === 'ALL' || p.pulau === pickerPulauFilter)
      .sort((a, b) => compareKode(a.kode, b.kode));
  }, [summary, pickerPulauFilter]);

  const pickerKabOptions = useMemo(() => {
    if (!summary) return [];
    return summary.kabs
      .filter((k) => {
        if (pickerPulauFilter !== 'ALL' && k.pulau !== pickerPulauFilter) return false;
        if (pickerProvFilter !== 'ALL' && k.kodeProv !== pickerProvFilter) return false;
        return true;
      })
      .sort((a, b) => compareKode(a.kode, b.kode));
  }, [summary, pickerPulauFilter, pickerProvFilter]);

  const pickerKecOptions = useMemo(() => {
    if (!kecsLoaded) return [];
    return kecs
      .filter((k) => {
        if (pickerPulauFilter !== 'ALL' && k.pulau !== pickerPulauFilter) return false;
        if (pickerProvFilter !== 'ALL' && k.kodeProv !== pickerProvFilter) return false;
        if (pickerKabFilter !== 'ALL' && k.kodeKab !== pickerKabFilter) return false;
        return true;
      })
      .sort((a, b) => compareKode(a.kode, b.kode));
  }, [kecs, kecsLoaded, pickerPulauFilter, pickerProvFilter, pickerKabFilter]);

  const pickerCandidates = useMemo<PickerCandidate[]>(() => {
    if (!editModalOpen || !isManualCreate) return [];
    const q = pickerQuery.trim().toLowerCase();

    if (formJenis === 'DPW') {
      const formedSet = new Set(
        dpwList
          .filter((d) => normalizeStatus(d.statusTerbentuk) === 'Sudah Terbentuk')
          .map((d) => d.kodeWilayah),
      );
      const list = (summary?.provs || [])
        .filter((p) => {
          if (pickerPulauFilter !== 'ALL' && p.pulau !== pickerPulauFilter) return false;
          if (!q) return true;
          return `${p.kode} ${p.nama} ${p.pulau}`.toLowerCase().includes(q);
        })
        .sort((a, b) => compareKode(a.kode, b.kode));
      return list.slice(0, 60).map((p) => ({
        kode: p.kode,
        nama: p.nama,
        pulau: p.pulau,
        kodeProv: p.kode,
        namaProv: p.nama,
        subtitle: `Pulau ${p.pulau}`,
        alreadyTerbentuk: formedSet.has(p.kode),
      }));
    }

    if (formJenis === 'DPD') {
      const formedSet = new Set(
        dpdList
          .filter((d) => normalizeStatus(d.statusTerbentuk) === 'Sudah Terbentuk')
          .map((d) => d.kodeWilayah),
      );
      const list = (summary?.kabs || [])
        .filter((k) => {
          if (pickerPulauFilter !== 'ALL' && k.pulau !== pickerPulauFilter) return false;
          if (pickerProvFilter !== 'ALL' && k.kodeProv !== pickerProvFilter) return false;
          if (!q) return true;
          return `${k.kode} ${k.nama} ${k.namaProv} ${k.pulau}`.toLowerCase().includes(q);
        })
        .sort((a, b) => compareKode(a.kode, b.kode));
      return list.slice(0, 60).map((k) => ({
        kode: k.kode,
        nama: k.nama,
        pulau: k.pulau,
        kodeProv: k.kodeProv,
        namaProv: k.namaProv,
        kodeKab: k.kode,
        namaKab: k.nama,
        subtitle: `${k.namaProv} · ${k.pulau}`,
        alreadyTerbentuk: formedSet.has(k.kode),
      }));
    }

    if (formJenis === 'DPC') {
      const formedSet = new Set(
        dpcList
          .filter((d) => normalizeStatus(d.statusTerbentuk) === 'Sudah Terbentuk')
          .map((d) => d.kodeWilayah),
      );
      const list = kecs
        .filter((k) => {
          if (pickerPulauFilter !== 'ALL' && k.pulau !== pickerPulauFilter) return false;
          if (pickerProvFilter !== 'ALL' && k.kodeProv !== pickerProvFilter) return false;
          if (pickerKabFilter !== 'ALL' && k.kodeKab !== pickerKabFilter) return false;
          if (!q) return true;
          return `${k.kode} ${k.nama} ${k.namaKab} ${k.namaProv}`.toLowerCase().includes(q);
        })
        .sort((a, b) => compareKode(a.kode, b.kode));
      return list.slice(0, 60).map((k) => ({
        kode: k.kode,
        nama: k.nama,
        pulau: k.pulau,
        kodeProv: k.kodeProv,
        namaProv: k.namaProv,
        kodeKab: k.kodeKab,
        namaKab: k.namaKab,
        kodeKec: k.kode,
        namaKec: k.nama,
        subtitle: `${k.namaKab} · ${k.namaProv}`,
        alreadyTerbentuk: formedSet.has(k.kode),
      }));
    }

    // DPR
    const formedSet = new Set(
      dprList
        .filter((d) => normalizeStatus(d.statusTerbentuk) === 'Sudah Terbentuk')
        .map((d) => d.kodeWilayah),
    );
    const list = modalKels
      .filter((k) => {
        if (pickerKabFilter !== 'ALL' && k.kodeKab !== pickerKabFilter) return false;
        if (pickerKecFilter !== 'ALL' && k.kodeKec !== pickerKecFilter) return false;
        if (!q) return true;
        return `${k.kode} ${k.nama} ${k.namaKec} ${k.namaKab}`.toLowerCase().includes(q);
      })
      .sort((a, b) => compareKode(a.kode, b.kode));
    return list.slice(0, 60).map((k) => ({
      kode: k.kode,
      nama: k.nama,
      pulau: k.pulau,
      kodeProv: k.kodeProv,
      namaProv: k.namaProv,
      kodeKab: k.kodeKab,
      namaKab: k.namaKab,
      kodeKec: k.kodeKec,
      namaKec: k.namaKec,
      namaKel: k.nama,
      subtitle: `Kec. ${k.namaKec} · ${k.namaKab}`,
      alreadyTerbentuk: formedSet.has(k.kode),
    }));
  }, [
    editModalOpen,
    isManualCreate,
    formJenis,
    pickerQuery,
    pickerPulauFilter,
    pickerProvFilter,
    pickerKabFilter,
    pickerKecFilter,
    summary,
    kecs,
    modalKels,
    dpwList,
    dpdList,
    dpcList,
    dprList,
  ]);

  const handleSelectPickerTerritory = (item: PickerCandidate) => {
    setFormKodeWilayah(item.kode);
    setFormPulau(item.pulau);
    setFormKodeProvinsi(item.kodeProv);
    setFormNamaProvinsi(item.namaProv);
    setFormKodeKabKota(item.kodeKab || '');
    setFormNamaKabKota(item.namaKab || '');
    setFormKodeKecamatan(item.kodeKec || '');
    setFormNamaKecamatan(item.namaKec || '');
    setFormNamaKelDesa(item.namaKel || '');

    // Pre-populate if territory already exists in sheet so it edits cleanly without losing contacts
    if (formJenis === 'DPW') {
      const existing = dpwList.find((d) => d.kodeWilayah === item.kode);
      setFormId(existing?.id || buildLembagaId('DPW', item.kode));
      setFormHasSheetRecord(Boolean(existing));
      setFormNamaLembaga(existing?.namaDpw || `DPW ${item.nama}`);
      setFormStatus(existing ? normalizeStatus(existing.statusTerbentuk) : 'Sudah Terbentuk');
      setFormKetuaNama((existing?.ketuaNama || '').toUpperCase());
      setFormKetuaWa(existing?.ketuaWa || '');
      setFormSekNama((existing?.sekretarisNama || '').toUpperCase());
      setFormSekWa(existing?.sekretarisWa || '');
    } else if (formJenis === 'DPD') {
      const existing = dpdList.find((d) => d.kodeWilayah === item.kode);
      setFormId(existing?.id || buildLembagaId('DPD', item.kode));
      setFormHasSheetRecord(Boolean(existing));
      setFormNamaLembaga(existing?.namaDpd || `DPD ${item.nama}`);
      setFormStatus(existing ? normalizeStatus(existing.statusTerbentuk) : 'Sudah Terbentuk');
      setFormKetuaNama((existing?.ketuaNama || '').toUpperCase());
      setFormKetuaWa(existing?.ketuaWa || '');
      setFormSekNama((existing?.sekretarisNama || '').toUpperCase());
      setFormSekWa(existing?.sekretarisWa || '');
    } else if (formJenis === 'DPC') {
      const existing = dpcList.find((d) => d.kodeWilayah === item.kode);
      setFormId(existing?.id || buildLembagaId('DPC', item.kode));
      setFormHasSheetRecord(Boolean(existing));
      setFormNamaLembaga(existing?.namaDpc || `DPC ${item.nama}`);
      setFormStatus(existing ? normalizeStatus(existing.statusTerbentuk) : 'Sudah Terbentuk');
      setFormKetuaNama((existing?.ketuaNama || '').toUpperCase());
      setFormKetuaWa(existing?.ketuaWa || '');
      setFormSekNama((existing?.sekretarisNama || '').toUpperCase());
      setFormSekWa(existing?.sekretarisWa || '');
    } else {
      const existing = dprList.find((d) => d.kodeWilayah === item.kode);
      setFormId(existing?.id || buildLembagaId('DPR', item.kode));
      setFormHasSheetRecord(Boolean(existing));
      setFormNamaLembaga(existing?.namaDpr || `DPR ${item.nama}`);
      setFormStatus(existing ? normalizeStatus(existing.statusTerbentuk) : 'Sudah Terbentuk');
      setFormKetuaNama((existing?.ketuaNama || '').toUpperCase());
      setFormKetuaWa(existing?.ketuaWa || '');
      setFormSekNama((existing?.sekretarisNama || '').toUpperCase());
      setFormSekWa(existing?.sekretarisWa || '');
    }

    setPickerQuery(item.nama);
    setPickerDropdownOpen(false);
    setFormErr('');
  };

  const handleClearSelectedTerritory = () => {
    setFormKodeWilayah('');
    setFormPulau('');
    setFormKodeProvinsi('');
    setFormNamaProvinsi('');
    setFormKodeKabKota('');
    setFormNamaKabKota('');
    setFormKodeKecamatan('');
    setFormNamaKecamatan('');
    setFormNamaKelDesa('');
    setFormNamaLembaga('');
    setFormId(undefined);
    setFormHasSheetRecord(false);
    setPickerQuery('');
    setPickerDropdownOpen(true);
  };

  const showBackgroundSavedToast = (msg: string) => {
    setBgSavedNotice(msg);
    if (bgNoticeTimerRef.current) {
      window.clearTimeout(bgNoticeTimerRef.current);
    }
    bgNoticeTimerRef.current = window.setTimeout(() => {
      setBgSavedNotice('');
    }, 4000);
  };

  // Open Edit Modal for existing row
  const openEditModal = (row: KelembagaanUnifiedRow) => {
    setIsManualCreate(false);
    setFormJenis(row.jenis);
    setFormId(row.id || buildLembagaId(row.jenis, row.kodeWilayah));
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
    setFormKetuaNama((row.ketuaNama || '').toUpperCase());
    setFormKetuaWa(row.ketuaWa);
    setFormSekNama((row.sekretarisNama || '').toUpperCase());
    setFormSekWa(row.sekretarisWa);
    setFormErr('');
    setConfirmDeleteOpen(false);
    setPickerDropdownOpen(false);
    setEditModalOpen(true);
  };

  // Open Smart Create Modal (Super Admin only) with Autodropdown Autosearch
  const openManualCreateModal = (jenis: JenisLembaga) => {
    setIsManualCreate(true);
    setFormJenis(jenis);
    setFormId(undefined);
    setFormHasSheetRecord(false);
    setFormKodeWilayah('');
    setFormPulau('');
    setFormKodeProvinsi('');
    setFormNamaProvinsi('');
    setFormKodeKabKota('');
    setFormNamaKabKota('');
    setFormKodeKecamatan('');
    setFormNamaKecamatan('');
    setFormNamaKelDesa('');
    setFormNamaLembaga('');
    setFormStatus('Sudah Terbentuk');
    setFormKetuaNama('');
    setFormKetuaWa('');
    setFormSekNama('');
    setFormSekWa('');
    setFormErr('');
    setConfirmDeleteOpen(false);

    // Sync narrowing dropdowns with current view filter for convenience
    setPickerPulauFilter(filterPulau);
    setPickerProvFilter(filterProvinsi);
    setPickerKabFilter(filterKabKota);
    setPickerKecFilter(filterKecamatan);
    setPickerQuery('');
    setPickerDropdownOpen(jenis !== 'DPR' || filterProvinsi !== 'ALL');

    if (jenis === 'DPC' || jenis === 'DPR') {
      void ensureKecamatanLoaded();
    }

    setEditModalOpen(true);
  };

  // Optimistic instant save + background Google Apps Script sync
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');

    const kode = formKodeWilayah.trim();
    const namaLembaga = formNamaLembaga.trim();

    if (!kode) {
      setFormErr(
        `Silakan pilih wilayah ${formJenis} terlebih dahulu dari daftar pencarian otomatis.`,
      );
      return;
    }
    if (!namaLembaga) {
      setFormErr(`Nama ${formJenis} wajib diisi.`);
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

    const jenisSnapshot = formJenis;
    const detId = buildLembagaId(jenisSnapshot, kode);
    const ketuaNamaUp = formKetuaNama.trim().toUpperCase();
    const sekNamaUp = formSekNama.trim().toUpperCase();
    const nowIso = new Date().toISOString();
    const segs = kode.split('.');

    // 1. Update UI & cache immediately (optimistic) and close modal so user can keep working
    if (jenisSnapshot === 'DPW') {
      const optimistic: DpwItem = {
        id: detId,
        kodeWilayah: kode,
        pulau: formPulau.trim(),
        namaDpw: namaLembaga,
        namaProvinsi: formNamaProvinsi.trim(),
        statusTerbentuk: formStatus,
        ketuaNama: ketuaNamaUp,
        ketuaWa: cleanKetuaWa,
        sekretarisNama: sekNamaUp,
        sekretarisWa: cleanSekWa,
        alamatKantor: '',
        tautanDrive: '',
        diperbaruiPada: nowIso,
      };
      onSaveDpw(optimistic);
      setEditModalOpen(false);

      if (!webAppUrl.trim()) {
        showTempNotice(`"${optimistic.namaDpw}" (${detId}) disimpan di browser lokal.`);
        return;
      }

      setBgPendingCount((c) => c + 1);
      void (async () => {
        try {
          const res = await saveDpwRecord(optimistic, activePin, webAppUrl);
          if (res.ok && res.item) {
            onSaveDpw(res.item);
            showBackgroundSavedToast(
              `"${res.item.namaDpw}" (${res.item.id}) tersimpan ke Spreadsheet #2.`,
            );
          } else {
            setErrorBanner(
              `Gagal menyimpan "${optimistic.namaDpw}" ke Spreadsheet #2: ${res.error || 'Terjadi kesalahan jaringan.'}`,
            );
          }
        } finally {
          setBgPendingCount((c) => Math.max(0, c - 1));
        }
      })();
      return;
    }

    if (jenisSnapshot === 'DPD') {
      const optimistic: DpdItem = {
        id: detId,
        kodeWilayah: kode,
        kodeProvinsi: formKodeProvinsi.trim() || segs[0] || '',
        pulau: formPulau.trim(),
        namaProvinsi: formNamaProvinsi.trim(),
        namaKabKota: formNamaKabKota.trim() || namaLembaga,
        namaDpd: namaLembaga,
        statusTerbentuk: formStatus,
        ketuaNama: ketuaNamaUp,
        ketuaWa: cleanKetuaWa,
        sekretarisNama: sekNamaUp,
        sekretarisWa: cleanSekWa,
        alamatKantor: '',
        tautanDrive: '',
        diperbaruiPada: nowIso,
      };
      onSaveDpd(optimistic);
      setEditModalOpen(false);

      if (!webAppUrl.trim()) {
        showTempNotice(`"${optimistic.namaDpd}" (${detId}) disimpan di browser lokal.`);
        return;
      }

      setBgPendingCount((c) => c + 1);
      void (async () => {
        try {
          const res = await saveDpdRecord(optimistic, activePin, webAppUrl);
          if (res.ok && res.item) {
            onSaveDpd(res.item);
            showBackgroundSavedToast(
              `"${res.item.namaDpd}" (${res.item.id}) tersimpan ke Spreadsheet #2.`,
            );
          } else {
            setErrorBanner(
              `Gagal menyimpan "${optimistic.namaDpd}" ke Spreadsheet #2: ${res.error || 'Terjadi kesalahan jaringan.'}`,
            );
          }
        } finally {
          setBgPendingCount((c) => Math.max(0, c - 1));
        }
      })();
      return;
    }

    if (jenisSnapshot === 'DPC') {
      const optimistic: DpcItem = {
        id: detId,
        kodeWilayah: kode,
        kodeKabKota:
          formKodeKabKota.trim() || (segs.length >= 2 ? segs.slice(0, 2).join('.') : ''),
        kodeProvinsi: formKodeProvinsi.trim() || segs[0] || '',
        pulau: formPulau.trim(),
        namaProvinsi: formNamaProvinsi.trim(),
        namaKabKota: formNamaKabKota.trim(),
        namaKecamatan: formNamaKecamatan.trim() || namaLembaga,
        namaDpc: namaLembaga,
        statusTerbentuk: formStatus,
        ketuaNama: ketuaNamaUp,
        ketuaWa: cleanKetuaWa,
        sekretarisNama: sekNamaUp,
        sekretarisWa: cleanSekWa,
        alamatKantor: '',
        tautanDrive: '',
        diperbaruiPada: nowIso,
      };
      onSaveDpc(optimistic);
      setEditModalOpen(false);

      if (!webAppUrl.trim()) {
        showTempNotice(`"${optimistic.namaDpc}" (${detId}) disimpan di browser lokal.`);
        return;
      }

      setBgPendingCount((c) => c + 1);
      void (async () => {
        try {
          const res = await saveDpcRecord(optimistic, activePin, webAppUrl);
          if (res.ok && res.item) {
            onSaveDpc(res.item);
            showBackgroundSavedToast(
              `"${res.item.namaDpc}" (${res.item.id}) tersimpan ke Spreadsheet #2.`,
            );
          } else {
            setErrorBanner(
              `Gagal menyimpan "${optimistic.namaDpc}" ke Spreadsheet #2: ${res.error || 'Terjadi kesalahan jaringan.'}`,
            );
          }
        } finally {
          setBgPendingCount((c) => Math.max(0, c - 1));
        }
      })();
      return;
    }

    // DPR
    const optimistic: DprItem = {
      id: detId,
      kodeWilayah: kode,
      kodeKecamatan:
        formKodeKecamatan.trim() || (segs.length >= 3 ? segs.slice(0, 3).join('.') : ''),
      kodeKabKota:
        formKodeKabKota.trim() || (segs.length >= 2 ? segs.slice(0, 2).join('.') : ''),
      kodeProvinsi: formKodeProvinsi.trim() || segs[0] || '',
      pulau: formPulau.trim(),
      namaProvinsi: formNamaProvinsi.trim(),
      namaKabKota: formNamaKabKota.trim(),
      namaKecamatan: formNamaKecamatan.trim(),
      namaKelDesa: formNamaKelDesa.trim() || namaLembaga,
      namaDpr: namaLembaga,
      statusTerbentuk: formStatus,
      ketuaNama: ketuaNamaUp,
      ketuaWa: cleanKetuaWa,
      sekretarisNama: sekNamaUp,
      sekretarisWa: cleanSekWa,
      alamatKantor: '',
      tautanDrive: '',
      diperbaruiPada: nowIso,
    };
    onSaveDpr(optimistic);
    setEditModalOpen(false);

    if (!webAppUrl.trim()) {
      showTempNotice(`"${optimistic.namaDpr}" (${detId}) disimpan di browser lokal.`);
      return;
    }

    setBgPendingCount((c) => c + 1);
    void (async () => {
      try {
        const res = await saveDprRecord(optimistic, activePin, webAppUrl);
        if (res.ok && res.item) {
          onSaveDpr(res.item);
          showBackgroundSavedToast(
            `"${res.item.namaDpr}" (${res.item.id}) tersimpan ke Spreadsheet #2.`,
          );
        } else {
          setErrorBanner(
            `Gagal menyimpan "${optimistic.namaDpr}" ke Spreadsheet #2: ${res.error || 'Terjadi kesalahan jaringan.'}`,
          );
        }
      } finally {
        setBgPendingCount((c) => Math.max(0, c - 1));
      }
    })();
  };

  // Optimistic background delete
  const handleDeleteCurrentRecord = () => {
    if (!formId) return;
    const targetId = formId;
    const targetJenis = formJenis;
    const targetLabel = formNamaLembaga || targetId;

    if (targetJenis === 'DPW') onDeleteDpw(targetId);
    else if (targetJenis === 'DPD') onDeleteDpd(targetId);
    else if (targetJenis === 'DPC') onDeleteDpc(targetId);
    else onDeleteDpr(targetId);

    setEditModalOpen(false);

    if (!webAppUrl.trim()) {
      showTempNotice(`Catatan "${targetLabel}" dihapus dari penyimpanan lokal.`);
      return;
    }

    setBgPendingCount((c) => c + 1);
    void (async () => {
      try {
        const res =
          targetJenis === 'DPW'
            ? await deleteDpwRecord(targetId, activePin, webAppUrl)
            : targetJenis === 'DPD'
              ? await deleteDpdRecord(targetId, activePin, webAppUrl)
              : targetJenis === 'DPC'
                ? await deleteDpcRecord(targetId, activePin, webAppUrl)
                : await deleteDprRecord(targetId, activePin, webAppUrl);

        if (res.ok) {
          showBackgroundSavedToast(
            `Catatan "${targetLabel}" dihapus dari Spreadsheet #2.`,
          );
        } else {
          setErrorBanner(
            `Gagal menghapus "${targetLabel}" dari Spreadsheet #2: ${res.error || 'Terjadi kesalahan jaringan.'}`,
          );
        }
      } finally {
        setBgPendingCount((c) => Math.max(0, c - 1));
      }
    })();
  };

  // Export CSV for filtered institutional rows (tanpa Alamat Kantor & Tautan Drive)
  const handleExportCsv = () => {
    const headers = [
      'No',
      'ID',
      'Kode Wilayah',
      'Tingkat',
      'Pulau',
      'Provinsi',
      'Kabupaten/Kota',
      'Kecamatan',
      'Kelurahan/Desa',
      'Nama',
      'Status Terbentuk',
      'Ketua',
      'WA Ketua',
      'Sekretaris',
      'WA Sekretaris',
    ];
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...filteredRows.map((d, idx) =>
        [
          String(idx + 1),
          d.id || buildLembagaId(d.jenis, d.kodeWilayah),
          d.kodeWilayah,
          d.jenis,
          d.pulau,
          d.namaProvinsi,
          d.namaKabKota || '',
          d.namaKecamatan || '',
          d.namaKelDesa || '',
          formatEntityDisplayName(d, false),
          d.statusTerbentuk,
          d.ketuaNama,
          d.ketuaWa,
          d.sekretarisNama,
          d.sekretarisWa,
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
    a.download = `DPW_DPD_${subTab.toUpperCase()}_DUWD_WI.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isLoadingTabData =
    (subTab === 'dpc' && loadingKecs) ||
    (subTab === 'dpr' && (loadingKecs || loadingKels)) ||
    (subTab === 'semua' && (loadingKecs || loadingKels));

  const tabs: { id: SubTab; label: string }[] = [
    { id: 'dpw', label: `DPW (${kpi.dpwFullTotal})` },
    { id: 'dpd', label: `DPD (${kpi.dpdFullTotal})` },
    { id: 'dpc', label: `DPC (${kpi.dpcTotal.toLocaleString('id-ID')})` },
    { id: 'dpr', label: `DPR (${kpi.dprTotal.toLocaleString('id-ID')})` },
    { id: 'semua', label: 'Semua Lembaga' },
  ];

  const activeDpwTarget =
    targetMode === 'visi2030' ? VISI_2030_DPW_TARGET : kpi.dpwFullTotal;
  const activeDpdTarget =
    targetMode === 'visi2030' ? VISI_2030_DPD_TARGET : kpi.dpdFullTotal;

  return (
    <section className="duwd-container px-2 py-7 sm:px-4 lg:py-9">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
            Departemen Urusan Wilayah &amp; Daerah &middot; DPP Wahdah Islamiyah
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] dark:text-[#E6F4F7] sm:text-3xl">
            Direktori DPW &amp; DPD
          </h1>
          <p className="mt-1 text-sm text-[#526A70] dark:text-[#9BB5BC]">
            Data kepengurusan DPW, DPD, DPC, dan DPR Wahdah Islamiyah seluruh Indonesia beserta kontak Ketua dan Sekretaris.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={filteredRows.length === 0}
            onClick={handleOpenFilteredCopyModal}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#0C7A89]/25 bg-[#EBF5F8] px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4] disabled:opacity-50 dark:border-[#3EC1D3]/30 dark:bg-[#113540] dark:text-[#E6F4F7] dark:hover:bg-[#164452]"
          >
            <Copy className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
            <span>Salin Hasil ({filteredRows.length.toLocaleString('id-ID')})</span>
          </button>

          <button
            type="button"
            disabled={filteredRows.length === 0}
            onClick={handleExportCsv}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-50 dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
          >
            <Download className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
            <span>Unduh CSV</span>
          </button>

          {webAppUrl.trim() && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={syncing}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-60 dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan Sheet'}</span>
            </button>
          )}

          {isSuperAdmin && subTab !== 'semua' && (
            <button
              type="button"
              onClick={() => openManualCreateModal(subTab.toUpperCase() as JenisLembaga)}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah {subTab.toUpperCase()}</span>
            </button>
          )}
        </div>
      </div>

      {/* Warning jika Spreadsheet #2 belum tersambung */}
      {(!webAppUrl.trim() || !wilayahConnected) && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#D88B15]/35 bg-[#FFF9EE] px-4 py-3 text-xs text-[#7D4D06] dark:border-[#F0B243]/30 dark:bg-[#2A2010] dark:text-[#F6CB77]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D88B15] dark:text-[#F0B243]" />
          <div>
            <span className="font-bold">Info Koneksi Spreadsheet #2:</span>{' '}
            {!webAppUrl.trim()
              ? 'Daftar wilayah aktif secara lokal, namun perubahan status & kontak belum tersimpan ke Google Spreadsheet sebelum URL Web App GAS diatur di Pengaturan & GAS.'
              : 'Spreadsheet #2 belum ditautkan di Pengaturan & GAS (mode pratinjau lokal aktif).'}
          </div>
        </div>
      )}

      {/* Role Permissions Info for Admin */}
      {role === 'admin' && (
        <div className="mt-3 rounded-xl border border-[#0C7A89]/20 bg-[#F2FAFB] px-4 py-2.5 text-xs text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2E36] dark:text-[#BCEAF0]">
          <span className="font-bold">Hak Akses Admin:</span> Anda dapat mengedit <strong>Nama &amp; Nomor WhatsApp Ketua dan Sekretaris</strong> pada DPW, DPD, DPC, dan DPR. Pengaturan status pembentukan lembaga dikelola oleh Super Admin.
        </div>
      )}

      {/* Target Mode Switcher + KPI Summary Strip */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-semibold text-[#526A70] dark:text-[#9BB5BC]">
          Rekapitulasi Capaian Kelembagaan
        </div>
        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-[#EBF5F8]/90 p-1 dark:bg-[#0D2A33]">
          <button
            type="button"
            onClick={() => setTargetMode('full')}
            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              targetMode === 'full'
                ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                : 'text-[#526A70] hover:text-[#07525E] dark:text-[#9BB5BC] dark:hover:text-[#E6F4F7]'
            }`}
          >
            Keseluruhan (38 DPW &middot; 514 DPD)
          </button>
          <button
            type="button"
            onClick={() => setTargetMode('visi2030')}
            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              targetMode === 'visi2030'
                ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                : 'text-[#526A70] hover:text-[#07525E] dark:text-[#9BB5BC] dark:hover:text-[#E6F4F7]'
            }`}
          >
            Target Visi 2030 (38 DPW &middot; 412 DPD)
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => handleSelectTab('dpw')}
          className="glass-surface cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-white/85 dark:hover:bg-[#113540]"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#526A70] dark:text-[#9BB5BC]">
            <span>DPW &middot; Provinsi</span>
            <span className="font-bold text-[#0C7A89] tabular-nums dark:text-[#3EC1D3]">
              {formatPct(kpi.dpwTerbentuk, activeDpwTarget)}
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold text-[#07525E] tabular-nums dark:text-[#E6F4F7]">
            {kpi.dpwTerbentuk}
            <span className="ml-1 text-sm font-medium text-[#6B8187] dark:text-[#8DA8B0]">
              / {activeDpwTarget}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#8DA8B0]">
            {targetMode === 'visi2030'
              ? 'Target Visi 2030 (100% Provinsi)'
              : 'Sudah Terbentuk · Total Provinsi'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('dpd')}
          className="glass-surface cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-white/85 dark:hover:bg-[#113540]"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#526A70] dark:text-[#9BB5BC]">
            <span>DPD &middot; Kab/Kota</span>
            <span className="font-bold text-[#0C7A89] tabular-nums dark:text-[#3EC1D3]">
              {formatPct(kpi.dpdTerbentuk, activeDpdTarget)}
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0C7A89] tabular-nums dark:text-[#3EC1D3]">
            {kpi.dpdTerbentuk}
            <span className="ml-1 text-sm font-medium text-[#6B8187] dark:text-[#8DA8B0]">
              / {activeDpdTarget}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#8DA8B0]">
            {targetMode === 'visi2030'
              ? 'Target Visi 2030: 80% (412 dari 514)'
              : 'Sudah Terbentuk · Total Kab/Kota'}
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('dpc')}
          className="glass-surface cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-white/85 dark:hover:bg-[#113540]"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#526A70] dark:text-[#9BB5BC]">
            <span>DPC &middot; Kecamatan</span>
            <span className="font-bold text-[#07525E] tabular-nums dark:text-[#BCEAF0]">
              {formatPct(kpi.dpcTerbentuk, kpi.dpcTotal)}
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold text-[#07525E] tabular-nums dark:text-[#E6F4F7]">
            {kpi.dpcTerbentuk}
            <span className="ml-1 text-sm font-medium text-[#6B8187] dark:text-[#8DA8B0]">
              / {kpi.dpcTotal.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#8DA8B0]">
            Sudah Terbentuk &middot; Total Kecamatan
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleSelectTab('dpr')}
          className="glass-surface cursor-pointer px-4 py-3.5 text-left transition-colors hover:bg-white/85 dark:hover:bg-[#113540]"
        >
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#526A70] dark:text-[#9BB5BC]">
            <span>DPR &middot; Kel/Desa</span>
            <span className="font-bold text-[#D88B15] tabular-nums dark:text-[#F0B243]">
              {formatPct(kpi.dprTerbentuk, kpi.dprTotal)}
            </span>
          </div>
          <div className="mt-1 text-2xl font-bold text-[#D88B15] tabular-nums dark:text-[#F0B243]">
            {kpi.dprTerbentuk}
            <span className="ml-1 text-sm font-medium text-[#6B8187] dark:text-[#8DA8B0]">
              / {kpi.dprTotal.toLocaleString('id-ID')}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#8DA8B0]">
            Sudah Terbentuk &middot; Total Kel/Desa
          </div>
        </button>
      </div>

      {/* Background Sync Non-Blocking Indicator */}
      {bgPendingCount > 0 && (
        <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#0C7A89]/30 bg-[#EBF7F9] px-4 py-2.5 text-xs font-semibold text-[#07525E] dark:border-[#3EC1D3]/35 dark:bg-[#0D2F38] dark:text-[#BCEAF0]">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0C7A89] dark:text-[#3EC1D3]" />
          <span>
            Menyimpan {bgPendingCount} perubahan ke Spreadsheet #2 di balik layar... Anda dapat langsung lanjut mengelola data lain.
          </span>
        </div>
      )}

      {bgPendingCount === 0 && bgSavedNotice && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-50/90 px-4 py-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-950/50 dark:text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{bgSavedNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setBgSavedNotice('')}
            className="cursor-pointer text-emerald-700 dark:text-emerald-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#0C7A89]/25 bg-[#ECF6F2] px-4 py-2.5 text-xs font-medium text-[#07525E] dark:border-[#3EC1D3]/30 dark:bg-[#0D2E36] dark:text-[#BCEAF0]">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="cursor-pointer text-[#526A70] dark:text-[#9BB5BC]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/60 dark:text-amber-200">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner('')}
            className="cursor-pointer text-amber-700 dark:text-amber-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sub-navigation + Cascading Multi-Filter Bar */}
      <div className="mt-5 glass-surface space-y-3.5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-xl bg-[#EBF5F8]/85 p-1 dark:bg-[#0D2A33]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={`shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                  subTab === tab.id
                    ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                    : 'text-[#526A70] hover:text-[#07525E] dark:text-[#9BB5BC] dark:hover:text-[#E6F4F7]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Row 1 Filters: Search, Pulau, Provinsi, Kab/Kota, Kecamatan */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
          <div className="relative lg:col-span-4">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B8187] dark:text-[#8DA8B0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode, wilayah, ketua, sekretaris, WA..."
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2.5 pr-4 pl-10 text-xs text-[#0F2429] placeholder:text-[#7D9197] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7] dark:placeholder:text-[#6D8B94] dark:focus:border-[#3EC1D3]"
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
              }}
              aria-label="Filter Pulau"
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
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
              }}
              aria-label="Filter Provinsi"
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
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
                className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
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

          {(subTab === 'dpc' || subTab === 'dpr' || subTab === 'semua') && (
            <div className="lg:col-span-2">
              <select
                value={filterKecamatan}
                onChange={(e) => setFilterKecamatan(e.target.value)}
                disabled={!kecsLoaded}
                aria-label="Filter Kecamatan"
                className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none disabled:opacity-60 dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
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
        <div className="flex flex-wrap items-center gap-2.5">
          {subTab === 'semua' && (
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value as 'ALL' | JenisLembaga)}
              aria-label="Filter Jenis Lembaga"
              className="rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
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
            className="rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
          >
            <option value="Sudah Terbentuk">Sudah Terbentuk</option>
            <option value="ALL">Semua Status (Terbentuk &amp; Belum)</option>
            <option value="Belum Terbentuk">Belum Terbentuk</option>
          </select>

          <select
            value={filterContact}
            onChange={(e) => setFilterContact(e.target.value as ContactFilter)}
            aria-label="Filter Kelengkapan Kontak"
            className="rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
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
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#0C7A89]/25 bg-[#F2FAFB] px-3 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#E3F3F7] disabled:opacity-60 dark:border-[#3EC1D3]/30 dark:bg-[#113540] dark:text-[#E6F4F7] dark:hover:bg-[#164452]"
            >
              {loadingKels && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Muat 83.762 DPR (Kel/Desa)</span>
            </button>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-xs font-semibold text-[#526A70] hover:text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#9BB5BC] dark:hover:text-[#E6F4F7]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Filter</span>
            </button>
          )}

          <span className="ml-auto text-xs font-medium text-[#526A70] tabular-nums dark:text-[#9BB5BC]">
            {filteredRows.length.toLocaleString('id-ID')} hasil ditemukan
          </span>
        </div>
      </div>

      {/* MAIN TABLE (5 Kolom Bersih + Zebra Striping) */}
      <div className="mt-5 glass-surface-strong overflow-visible">
        {isLoadingTabData && pagedRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#0C7A89] dark:text-[#3EC1D3]" />
            <p className="mt-3 text-sm font-semibold text-[#07525E] dark:text-[#E6F4F7]">
              Memuat data wilayah Indonesia...
            </p>
            <p className="mt-1 text-xs text-[#526A70] dark:text-[#9BB5BC]">
              Menyiapkan daftar kode wilayah dan status kelembagaan.
            </p>
          </div>
        ) : pagedRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF5F8] text-[#0C7A89] dark:bg-[#113540] dark:text-[#3EC1D3]">
              <Building2 className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
              {filterStatus === 'Sudah Terbentuk'
                ? 'Belum Ada Lembaga Berstatus Sudah Terbentuk pada Filter Ini'
                : 'Tidak Ada Data yang Cocok'}
            </h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[#526A70] dark:text-[#9BB5BC]">
              {filterStatus === 'Sudah Terbentuk'
                ? 'Ubah filter status ke "Semua Status" untuk menampilkan seluruh wilayah yang belum terbentuk ataupun mengatur statusnya.'
                : 'Ubah kata kunci pencarian atau atur ulang filter Pulau, Provinsi, Kabupaten, Kecamatan, maupun status.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {filterStatus !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setFilterStatus('ALL')}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white"
                >
                  <span>Tampilkan Semua Status</span>
                </button>
              )}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/20 bg-white px-4 py-2 text-xs font-semibold text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto" ref={copyMenuContainerRef}>
            <table className="duwd-zebra-table w-full min-w-[920px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold tracking-wide text-[#355158] uppercase dark:border-[#3EC1D3]/15 dark:bg-[#0C2730] dark:text-[#9BB5BC]">
                  <th className="w-12 px-3 py-3.5 text-center">No</th>
                  <th className="px-4 py-3.5">Kode &amp; Tingkat</th>
                  <th className="px-4 py-3.5">Wilayah &amp; Status</th>
                  <th className="px-4 py-3.5">Ketua</th>
                  <th className="px-4 py-3.5">Sekretaris</th>
                  <th className="px-4 py-3.5 text-right">Salin &amp; Kelola</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#07525E]/8 dark:divide-[#3EC1D3]/10">
                {pagedRows.map((row, idx) => {
                  const rowKey = `${row.jenis}-${row.kodeWilayah}`;
                  const isMenuOpen = openCopyKey === rowKey;
                  const displayName = formatEntityDisplayName(row, false);
                  const parentTrail = [
                    row.pulau,
                    row.jenis !== 'DPW' ? row.namaProvinsi : '',
                    row.jenis === 'DPC' || row.jenis === 'DPR' ? row.namaKabKota : '',
                    row.jenis === 'DPR' ? row.namaKecamatan : '',
                  ]
                    .filter(Boolean)
                    .join(' / ');

                  return (
                    <tr key={rowKey} className="align-top">
                      <td className="px-3 py-3.5 text-center font-mono text-[11px] font-semibold text-[#526A70] tabular-nums dark:text-[#8DA8B0]">
                        {(pageStart + idx + 1).toLocaleString('id-ID')}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-[#07525E] tabular-nums dark:text-[#E6F4F7]">
                          {row.kodeWilayah}
                        </div>
                        <div className="mt-0.5 text-[11px] font-medium text-[#526A70] dark:text-[#8DA8B0]">
                          {getJenisLabel(row.jenis)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#07525E] dark:text-[#E6F4F7]">
                          {displayName}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-[#526A70] dark:text-[#9BB5BC]">
                          <span>{parentTrail || '-'}</span>
                          <span aria-hidden="true">&middot;</span>
                          <span
                            className={
                              row.statusTerbentuk === 'Sudah Terbentuk'
                                ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                : 'font-medium text-[#6B8187] dark:text-[#7D9CA4]'
                            }
                          >
                            {row.statusTerbentuk}
                          </span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#0F2429] dark:text-[#E6F4F7]">
                          {row.ketuaNama || '-'}
                        </div>
                        {row.ketuaWa ? (
                          <a
                            href={buildWhatsAppLink(row.ketuaWa)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#0C7A89] hover:underline tabular-nums dark:text-[#3EC1D3]"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                            <span>{row.ketuaWa}</span>
                          </a>
                        ) : (
                          <div className="mt-0.5 text-[11px] text-[#7D9197] dark:text-[#6D8B94]">
                            WA belum diisi
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#0F2429] dark:text-[#E6F4F7]">
                          {row.sekretarisNama || '-'}
                        </div>
                        {row.sekretarisWa ? (
                          <a
                            href={buildWhatsAppLink(row.sekretarisWa)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#0C7A89] hover:underline tabular-nums dark:text-[#3EC1D3]"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                            <span>{row.sekretarisWa}</span>
                          </a>
                        ) : (
                          <div className="mt-0.5 text-[11px] text-[#7D9197] dark:text-[#6D8B94]">
                            WA belum diisi
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="relative inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setOpenCopyKey((prev) => (prev === rowKey ? null : rowKey))
                            }
                            className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-[#0C7A89]/25 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/30 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
                          >
                            <Copy className="h-3 w-3 text-[#0C7A89] dark:text-[#3EC1D3]" />
                            <span>Salin</span>
                            <ChevronDown className="h-3 w-3" />
                          </button>

                          {canEditContacts && (
                            <button
                              type="button"
                              onClick={() => openEditModal(row)}
                              className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-[#07525E]/15 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
                            >
                              <Pencil className="h-3 w-3 text-[#0C7A89] dark:text-[#3EC1D3]" />
                              <span>{isSuperAdmin ? 'Edit' : 'Edit Kontak'}</span>
                            </button>
                          )}

                          {isMenuOpen && (
                            <div className="absolute top-full right-0 z-30 mt-1.5 w-64 rounded-xl border border-[#07525E]/15 bg-white p-1.5 text-left shadow-xl dark:border-[#3EC1D3]/25 dark:bg-[#0B2229]">
                              <div className="px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#6B8187] uppercase dark:text-[#8DA8B0]">
                                Salin Baris Ini
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleQuickRowCopy(row, 'ketua_sekretaris')}
                                className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#0F2429] hover:bg-[#EBF5F8] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
                              >
                                Salin Ketua &amp; Sekretaris
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleQuickRowCopy(row, 'ketua_saja')}
                                className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#0F2429] hover:bg-[#EBF5F8] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
                              >
                                Salin Ketua Saja
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleQuickRowCopy(row, 'sekretaris_saja')}
                                className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#0F2429] hover:bg-[#EBF5F8] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
                              >
                                Salin Sekretaris Saja
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleQuickRowCopy(row, 'lengkap')}
                                className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#0F2429] hover:bg-[#EBF5F8] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
                              >
                                Salin Info Lengkap
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenCopyKey(null);
                                  setCopyModalState({
                                    title: formatEntityDisplayName(row, false),
                                    rows: [row],
                                    initialMode: 'ketua_sekretaris',
                                  });
                                }}
                                className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[#0C7A89] hover:bg-[#EBF5F8] dark:text-[#3EC1D3] dark:hover:bg-[#113540]"
                              >
                                Buka Pengaturan Salin...
                              </button>

                              {row.jenis !== 'DPR' && (
                                <>
                                  <div className="my-1 border-t border-[#07525E]/10 dark:border-[#3EC1D3]/15" />
                                  <div className="px-2.5 py-1 text-[10px] font-bold tracking-wide text-[#0C7A89] uppercase dark:text-[#3EC1D3]">
                                    Salin Wilayah Turunan
                                  </div>
                                  {row.jenis === 'DPW' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleOpenChildCopyModal(row, 'nama_saja')
                                        }
                                        className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
                                      >
                                        Daftar Nama DPD di Prov. ini
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleOpenChildCopyModal(row, 'ketua_sekretaris')
                                        }
                                        className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#07525E] hover:bg-[#EBF5F8] dark:text-[#B4CCD3] dark:hover:bg-[#113540]"
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
                                        className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
                                      >
                                        Daftar Nama DPC di Kab/Kota ini
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleOpenChildCopyModal(row, 'ketua_sekretaris')
                                        }
                                        className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#07525E] hover:bg-[#EBF5F8] dark:text-[#B4CCD3] dark:hover:bg-[#113540]"
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
                                        className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
                                      >
                                        Daftar Nama DPR di Kec. ini
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void handleOpenChildCopyModal(row, 'ketua_sekretaris')
                                        }
                                        className="block w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-[#07525E] hover:bg-[#EBF5F8] dark:text-[#B4CCD3] dark:hover:bg-[#113540]"
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

      {/* Pagination Bar (Default 10, opsi 5/10/25/50/100/500/Semua) */}
      {activeItemCount > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#07525E]/10 bg-white/75 px-4 py-2.5 text-xs text-[#355158] dark:border-[#3EC1D3]/15 dark:bg-[#0B2229]/85 dark:text-[#B4CCD3]">
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-1.5 font-medium">
              <span>Tampilkan</span>
              <select
                value={String(pageSize)}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageSize(val === 'ALL' ? 'ALL' : (Number(val) as PageSizeOption));
                }}
                aria-label="Jumlah baris per halaman"
                className="rounded-lg border border-[#07525E]/20 bg-white px-2.5 py-1 text-xs font-bold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={String(opt)} value={String(opt)}>
                    {opt === 'ALL' ? 'Semua' : opt}
                  </option>
                ))}
              </select>
              <span>baris</span>
            </label>

            <span className="font-medium tabular-nums">
              Menampilkan {(pageStart + 1).toLocaleString('id-ID')}–
              {Math.min(pageStart + pagedRows.length, activeItemCount).toLocaleString('id-ID')}{' '}
              dari {activeItemCount.toLocaleString('id-ID')} data
              {isAllMode && activeItemCount > MAX_ALL_RENDER_ROWS && (
                <span className="ml-1.5 text-[11px] text-[#D88B15] dark:text-[#F0B243]">
                  (dibatasi {MAX_ALL_RENDER_ROWS.toLocaleString('id-ID')} baris agar tetap ringan; gunakan filter Provinsi/Kab)
                </span>
              )}
            </span>
          </div>

          {!isAllMode && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#07525E]/15 bg-white px-3 py-1.5 font-semibold text-[#07525E] hover:bg-[#EBF5F8] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Sebelumnya</span>
              </button>
              <span className="px-2 font-semibold tabular-nums text-[#07525E] dark:text-[#E6F4F7]">
                {safePage.toLocaleString('id-ID')} / {totalPages.toLocaleString('id-ID')}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#07525E]/15 bg-white px-3 py-1.5 font-semibold text-[#07525E] hover:bg-[#EBF5F8] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
              >
                <span>Berikutnya</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072B31]/50 p-4 backdrop-blur-sm dark:bg-black/70"
        >
          <div className="glass-surface-strong relative max-h-[92vh] w-full max-w-xl overflow-y-auto bg-white p-6 dark:bg-[#0B2229]">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              aria-label="Tutup form"
              className="absolute top-4 right-4 cursor-pointer rounded-lg p-1.5 text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
            >
              <X className="h-4 w-4" />
            </button>

            <h2
              id="kelembagaan-modal-title"
              className="text-lg font-bold text-[#07525E] dark:text-[#E6F4F7]"
            >
              {isManualCreate
                ? `Tambah Data ${formJenis}`
                : isSuperAdmin
                  ? `Kelola ${formJenis} · ${formKodeWilayah}`
                  : `Edit Kontak ${formJenis} · ${formKodeWilayah}`}
            </h2>
            <p className="mt-1 text-xs text-[#526A70] dark:text-[#9BB5BC]">
              {isSuperAdmin
                ? `Pilih wilayah secara otomatis (kode, pulau, dan provinsi terisi otomatis). Proses simpan berjalan di balik layar.`
                : 'Mode Admin: Anda hanya diperkenankan mengubah Nama dan Nomor WhatsApp Ketua & Sekretaris.'}
            </p>

            <form onSubmit={handleSubmitForm} className="mt-5 space-y-4">
              {isManualCreate && isSuperAdmin ? (
                <div className="space-y-3 rounded-2xl border border-[#0C7A89]/20 bg-[#F4FAFB]/90 p-3.5 dark:border-[#3EC1D3]/25 dark:bg-[#081F26]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                      Pilih Wilayah {formJenis}{' '}
                      {formJenis === 'DPW'
                        ? '(Provinsi)'
                        : formJenis === 'DPD'
                          ? '(Kabupaten / Kota)'
                          : formJenis === 'DPC'
                            ? '(Kecamatan)'
                            : '(Kelurahan / Desa)'}
                    </span>
                    <span className="text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                      Autosearch dari database wilayah
                    </span>
                  </div>

                  {/* Filter opsional untuk mempercepat pencarian bertingkat */}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {formJenis === 'DPW' && (
                      <select
                        value={pickerPulauFilter}
                        onChange={(e) => setPickerPulauFilter(e.target.value)}
                        aria-label="Filter Pulau"
                        className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                      >
                        <option value="ALL">Semua Pulau (7)</option>
                        {pulauOptions.map((p) => (
                          <option key={p} value={p}>
                            Pulau {p}
                          </option>
                        ))}
                      </select>
                    )}

                    {(formJenis === 'DPD' || formJenis === 'DPC' || formJenis === 'DPR') && (
                      <select
                        value={pickerProvFilter}
                        onChange={(e) => {
                          setPickerProvFilter(e.target.value);
                          setPickerKabFilter('ALL');
                          setPickerKecFilter('ALL');
                          setPickerDropdownOpen(true);
                        }}
                        aria-label="Filter Provinsi"
                        className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                      >
                        <option value="ALL">
                          {formJenis === 'DPR'
                            ? '— Pilih Provinsi Terlebih Dahulu —'
                            : 'Semua Provinsi (38)'}
                        </option>
                        {pickerProvOptions.map((p) => (
                          <option key={p.kode} value={p.kode}>
                            {p.kode} — {p.nama}
                          </option>
                        ))}
                      </select>
                    )}

                    {(formJenis === 'DPC' || formJenis === 'DPR') && (
                      <select
                        value={pickerKabFilter}
                        onChange={(e) => {
                          setPickerKabFilter(e.target.value);
                          setPickerKecFilter('ALL');
                          setPickerDropdownOpen(true);
                        }}
                        aria-label="Filter Kab/Kota"
                        className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                      >
                        <option value="ALL">Semua Kab/Kota</option>
                        {pickerKabOptions.map((k) => (
                          <option key={k.kode} value={k.kode}>
                            {k.kode} — {k.nama}
                          </option>
                        ))}
                      </select>
                    )}

                    {formJenis === 'DPR' && pickerProvFilter !== 'ALL' && (
                      <select
                        value={pickerKecFilter}
                        onChange={(e) => {
                          setPickerKecFilter(e.target.value);
                          setPickerDropdownOpen(true);
                        }}
                        aria-label="Filter Kecamatan"
                        className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none sm:col-span-2 dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                      >
                        <option value="ALL">Semua Kecamatan</option>
                        {pickerKecOptions.map((k) => (
                          <option key={k.kode} value={k.kode}>
                            {k.kode} — {k.nama}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Autosearch Autodropdown Input */}
                  <div className="relative" ref={pickerContainerRef}>
                    <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B8187] dark:text-[#8DA8B0]" />
                    <input
                      type="text"
                      value={pickerQuery}
                      onFocus={() => setPickerDropdownOpen(true)}
                      onChange={(e) => {
                        setPickerQuery(e.target.value);
                        setPickerDropdownOpen(true);
                      }}
                      disabled={formJenis === 'DPR' && pickerProvFilter === 'ALL'}
                      placeholder={
                        formJenis === 'DPW'
                          ? 'Ketik nama provinsi atau kode (contoh: Aceh, 73)...'
                          : formJenis === 'DPD'
                            ? 'Ketik nama kab/kota atau kode (contoh: Bulukumba, Makassar, 73.02)...'
                            : formJenis === 'DPC'
                              ? 'Ketik nama kecamatan atau kabupaten...'
                              : pickerProvFilter === 'ALL'
                                ? 'Pilih Provinsi di atas dulu untuk memuat Kel/Desa...'
                                : 'Ketik nama kelurahan/desa atau kecamatan...'
                      }
                      className="w-full rounded-xl border border-[#0C7A89]/30 bg-white py-2.5 pr-9 pl-10 text-xs font-medium text-[#0F2429] placeholder:text-[#7D9197] focus:border-[#0C7A89] focus:outline-none disabled:opacity-60 dark:border-[#3EC1D3]/35 dark:bg-[#071A20] dark:text-[#E6F4F7] dark:placeholder:text-[#6D8B94]"
                    />
                    {pickerQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickerQuery('');
                          setPickerDropdownOpen(true);
                        }}
                        aria-label="Hapus pencarian wilayah"
                        className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded-md p-1 text-[#6B8187] hover:bg-[#EBF5F8] dark:text-[#8DA8B0] dark:hover:bg-[#113540]"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {pickerDropdownOpen && (
                      <div className="absolute top-full right-0 left-0 z-40 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-[#07525E]/18 bg-white p-1.5 shadow-xl dark:border-[#3EC1D3]/30 dark:bg-[#071A20]">
                        {(formJenis === 'DPC' && loadingKecs) ||
                        (formJenis === 'DPR' && loadingModalKels) ? (
                          <div className="flex items-center justify-center gap-2 py-4 text-xs text-[#526A70] dark:text-[#9BB5BC]">
                            <Loader2 className="h-4 w-4 animate-spin text-[#0C7A89]" />
                            <span>Memuat daftar wilayah...</span>
                          </div>
                        ) : pickerCandidates.length === 0 ? (
                          <div className="px-3 py-3 text-center text-xs text-[#526A70] dark:text-[#8DA8B0]">
                            {formJenis === 'DPR' && pickerProvFilter === 'ALL'
                              ? 'Silakan pilih Provinsi terlebih dahulu di dropdown atas.'
                              : 'Tidak ada wilayah yang cocok dengan kata kunci tersebut.'}
                          </div>
                        ) : (
                          pickerCandidates.map((cand) => {
                            const isSelected = formKodeWilayah === cand.kode;
                            return (
                              <button
                                key={cand.kode}
                                type="button"
                                onClick={() => handleSelectPickerTerritory(cand)}
                                className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                                  isSelected
                                    ? 'bg-[#E3F4F7] dark:bg-[#123B46]'
                                    : 'hover:bg-[#F2FAFB] dark:hover:bg-[#0E2E37]'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="truncate text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                                    {cand.nama}
                                  </div>
                                  <div className="truncate text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                                    <span className="font-mono font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
                                      {cand.kode}
                                    </span>{' '}
                                    &middot; {cand.subtitle}
                                  </div>
                                </div>
                                {cand.alreadyTerbentuk && (
                                  <span className="shrink-0 rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                                    Terbentuk
                                  </span>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>

                  {/* Ringkasan Otomatis Wilayah Terpilih (Kode, ID, Pulau, Provinsi) */}
                  {formKodeWilayah && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#0C7A89]/25 bg-white px-3.5 py-2.5 text-xs dark:border-[#3EC1D3]/30 dark:bg-[#0D2A33]">
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0C7A89] dark:text-[#3EC1D3]" />
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-[#E6F4F7] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#07525E] dark:bg-[#13424F] dark:text-[#3EC1D3]">
                              ID: {buildLembagaId(formJenis, formKodeWilayah)}
                            </span>
                            <span className="font-mono font-bold text-[#07525E] dark:text-[#E6F4F7]">
                              Kode {formKodeWilayah}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#9BB5BC]">
                            {[
                              formPulau,
                              formNamaProvinsi,
                              formNamaKabKota,
                              formNamaKecamatan,
                              formNamaKelDesa,
                            ]
                              .filter(Boolean)
                              .join(' / ')}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearSelectedTerritory}
                        className="cursor-pointer rounded-lg px-2 py-1 text-[11px] font-semibold text-[#0C7A89] hover:bg-[#EBF5F8] dark:text-[#3EC1D3] dark:hover:bg-[#13424F]"
                      >
                        Ganti
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#07525E]/10 bg-[#F4FAFB] px-3.5 py-2.5 text-xs text-[#355158] dark:border-[#3EC1D3]/20 dark:bg-[#0D2A33] dark:text-[#B4CCD3]">
                  <span className="rounded-md bg-[#E6F4F7] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#07525E] dark:bg-[#13424F] dark:text-[#3EC1D3]">
                    {buildLembagaId(formJenis, formKodeWilayah)}
                  </span>
                  <span className="font-mono font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    {formKodeWilayah}
                  </span>
                  <span className="text-[#7D9197]">&middot;</span>
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

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Nama {formJenis}
                </label>
                <input
                  type="text"
                  disabled={!isSuperAdmin}
                  value={formNamaLembaga}
                  onChange={(e) => setFormNamaLembaga(e.target.value)}
                  placeholder={`Otomatis terisi saat memilih wilayah ${formJenis}`}
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none disabled:bg-[#F4FAFB] disabled:text-[#526A70] dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7] dark:disabled:bg-[#0D2A33] dark:disabled:text-[#8DA8B0]"
                />
              </div>

              {/* Status Kelembagaan: Pilihan Langsung 1-Klik */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Status Kelembagaan
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {STATUS_TERBENTUK_OPTIONS.map((st) => {
                    const active = formStatus === st;
                    const isFormed = st === 'Sudah Terbentuk';
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={!isSuperAdmin}
                        onClick={() => setFormStatus(st)}
                        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:opacity-65 ${
                          active
                            ? isFormed
                              ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm dark:border-emerald-500 dark:bg-emerald-600'
                              : 'border-[#07525E] bg-[#07525E] text-white shadow-sm dark:border-[#3EC1D3] dark:bg-[#154A59]'
                            : 'border-[#07525E]/18 bg-white text-[#355158] hover:border-[#0C7A89]/50 hover:bg-[#F4FAFB] dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#B4CCD3] dark:hover:bg-[#0D2A33]'
                        }`}
                      >
                        {active && <Check className="h-3.5 w-3.5 shrink-0" />}
                        <span>{st}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Nama Ketua {formJenis}
                  </label>
                  <input
                    type="text"
                    value={formKetuaNama}
                    onChange={(e) => setFormKetuaNama(e.target.value.toUpperCase())}
                    placeholder="NAMA LENGKAP KETUA"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm uppercase text-[#0F2429] placeholder:normal-case focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="form-ketua-wa"
                    className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]"
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
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Nama Sekretaris {formJenis}
                  </label>
                  <input
                    type="text"
                    value={formSekNama}
                    onChange={(e) => setFormSekNama(e.target.value.toUpperCase())}
                    placeholder="NAMA LENGKAP SEKRETARIS"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm uppercase text-[#0F2429] placeholder:normal-case focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="form-sek-wa"
                    className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]"
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

              {formErr && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/60 dark:text-amber-200">
                  {formErr}
                </div>
              )}

              {confirmDeleteOpen && isSuperAdmin && formHasSheetRecord && formId && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-950/60 dark:text-red-200">
                  <span className="font-medium">
                    Hapus catatan ini dari Spreadsheet #2? Wilayah akan kembali ke status Belum Terbentuk.
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteOpen(false)}
                      className="cursor-pointer rounded-lg px-2.5 py-1 font-semibold text-[#355158] hover:bg-white dark:text-[#B4CCD3] dark:hover:bg-[#113540]"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteCurrentRecord}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-red-600 px-3 py-1 font-semibold text-white hover:bg-red-700"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Ya, Hapus</span>
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
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-950/60"
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
                    className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold text-[#526A70] hover:bg-[#F4FAFB] dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
                  >
                    {isSuperAdmin ? `Simpan ${formJenis}` : 'Simpan Kontak'}
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
