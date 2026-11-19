import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Check,
  CheckCheck,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  checkDriveAuthStatus,
  deleteMusyawarahRecord,
  saveMusyawarahRecord,
  savePresensiBatchRecord,
  uploadMusyawarahFileToDrive,
  uploadMusyawarahNotulaTextToDrive,
} from '../services/orgService';
import type {
  JenisMusyawarah,
  MusyawarahItem,
  NotulaMode,
  PengurusItem,
  PresensiItem,
  PresensiStatus,
  UnitItem,
  UserRole,
} from '../types/org';
import {
  BULAN_INDONESIA,
  MUSYAWARAH_DRIVE_FOLDER_URL,
  buildMusyawarahFileBaseName,
  formatTanggalIndonesia,
  normalizePresensiStatus,
} from '../utils/scheduleParser';

interface MusyawarahViewProps {
  role: UserRole;
  activePin: string;
  webAppUrl: string;
  units: UnitItem[];
  pengurusList: PengurusItem[];
  musyawarahList: MusyawarahItem[];
  presensiList: PresensiItem[];
  syncing: boolean;
  onRefresh: () => void;
  onSaveMusyawarah: (item: MusyawarahItem) => void;
  onDeleteMusyawarah: (id: string) => void;
  onSavePresensiBatch: (musyawarahId: string, entries: PresensiItem[]) => void;
}

type MusyawarahSubTab = 'daftar' | 'rekap';

const PRESENSI_STATUSES: PresensiStatus[] = [
  'Hadir',
  'Izin Sebelum Rapat',
  'Izin Setelah Rapat',
  'Tidak Hadir',
];

const AMANAH_ORDER: Record<string, number> = {
  ketua: 1,
  'wakil ketua': 2,
  sekretaris: 3,
  'wakil sekretaris': 4,
  bendahara: 5,
  'wakil bendahara': 6,
  anggota: 7,
};

function formatPct(num: number, denom: number): string {
  if (!denom || denom <= 0) return '0%';
  const pct = (num / denom) * 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(1)}%`;
}

function escapeCsvCell(value: string | number | undefined): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function formatUnitOptionLabel(u: UnitItem): string {
  if (u.urutan === 0 || u.kodeUnit.toUpperCase() === 'PI') {
    return `PI — ${u.namaUnit}`;
  }
  return `Unit ${u.urutan} (${u.kodeUnit}) — ${u.namaUnit}`;
}

function formatUnitCompactBadge(u?: UnitItem | null, fallback?: string): string {
  if (!u) return fallback || 'Unit';
  if (u.urutan === 0 || u.kodeUnit.toUpperCase() === 'PI') {
    return 'PI';
  }
  return `Unit ${u.urutan} · ${u.kodeUnit}`;
}

function getStatusShortLabel(status: PresensiStatus): string {
  switch (status) {
    case 'Hadir':
      return 'Hadir';
    case 'Izin Sebelum Rapat':
      return 'Izin Sebelum';
    case 'Izin Setelah Rapat':
      return 'Izin Setelah';
    case 'Tidak Hadir':
      return 'Tidak Hadir';
  }
}

function getStatusTextClass(status: PresensiStatus): string {
  switch (status) {
    case 'Hadir':
      return 'text-emerald-700 dark:text-emerald-400';
    case 'Izin Sebelum Rapat':
      return 'text-[#0C7A89] dark:text-[#38C6D9]';
    case 'Izin Setelah Rapat':
      return 'text-[#B46E09] dark:text-[#F0A93B]';
    case 'Tidak Hadir':
      return 'text-rose-600 dark:text-rose-400';
  }
}

function getStatusBadgeClass(status: PresensiStatus): string {
  switch (status) {
    case 'Hadir':
      return 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25 dark:text-emerald-300';
    case 'Izin Sebelum Rapat':
      return 'bg-[#0C7A89]/15 text-[#07525E] border-[#0C7A89]/25 dark:text-[#5AD6E6]';
    case 'Izin Setelah Rapat':
      return 'bg-[#D88B15]/15 text-[#9A5E08] border-[#D88B15]/30 dark:text-[#F0B24A]';
    case 'Tidak Hadir':
      return 'bg-rose-500/15 text-rose-700 border-rose-500/25 dark:text-rose-300';
  }
}

function getStatusActiveButtonClass(status: PresensiStatus): string {
  switch (status) {
    case 'Hadir':
      return 'bg-emerald-600 text-white border-emerald-600 shadow-xs';
    case 'Izin Sebelum Rapat':
      return 'bg-[#0C7A89] text-white border-[#0C7A89] shadow-xs';
    case 'Izin Setelah Rapat':
      return 'bg-[#D88B15] text-white border-[#D88B15] shadow-xs';
    case 'Tidak Hadir':
      return 'bg-rose-600 text-white border-rose-600 shadow-xs';
  }
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file dari perangkat.'));
    reader.readAsDataURL(file);
  });
}

function prepareImageForUpload(file: File): Promise<{
  base64Data: string;
  mimeType: string;
  ext: 'jpg' | 'png';
  previewDataUrl: string;
}> {
  return new Promise((resolve, reject) => {
    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca gambar dokumentasi.'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => {
        const idx = dataUrl.indexOf(',');
        resolve({
          base64Data: idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl,
          mimeType: isPng ? 'image/png' : 'image/jpeg',
          ext: isPng ? 'png' : 'jpg',
          previewDataUrl: dataUrl,
        });
      };
      img.onload = () => {
        const maxSide = 1600;
        const needsResize = img.width > maxSide || img.height > maxSide || file.size > 1_800_000;
        if (!needsResize) {
          const idx = dataUrl.indexOf(',');
          resolve({
            base64Data: idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl,
            mimeType: isPng ? 'image/png' : 'image/jpeg',
            ext: isPng ? 'png' : 'jpg',
            previewDataUrl: dataUrl,
          });
          return;
        }
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          const idx = dataUrl.indexOf(',');
          resolve({
            base64Data: idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl,
            mimeType: isPng ? 'image/png' : 'image/jpeg',
            ext: isPng ? 'png' : 'jpg',
            previewDataUrl: dataUrl,
          });
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const outMime = isPng && file.size <= 2_200_000 ? 'image/png' : 'image/jpeg';
        const outExt: 'jpg' | 'png' = outMime === 'image/png' ? 'png' : 'jpg';
        const compressedUrl =
          outMime === 'image/png'
            ? canvas.toDataURL('image/png')
            : canvas.toDataURL('image/jpeg', 0.84);
        const idx = compressedUrl.indexOf(',');
        resolve({
          base64Data: idx >= 0 ? compressedUrl.slice(idx + 1) : compressedUrl,
          mimeType: outMime,
          ext: outExt,
          previewDataUrl: compressedUrl,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

function getFileExtension(name: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : '';
}

function getDriveEmbedUrl(fileId?: string, fallbackUrl?: string): string {
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
  const match = (fallbackUrl || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) {
    return `https://drive.google.com/file/d/${match[1]}/preview`;
  }
  return '';
}

function getDriveImagePreviewUrl(msy: MusyawarahItem): string {
  if (msy.dokumentasiPreviewUrl) return msy.dokumentasiPreviewUrl;
  if (msy.dokumentasiFileId) {
    return `https://drive.google.com/thumbnail?id=${msy.dokumentasiFileId}&sz=w1400`;
  }
  const match = (msy.dokumentasiFileUrl || '').match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match?.[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w1400`;
  }
  return '';
}

export function MusyawarahView({
  role,
  activePin,
  webAppUrl,
  units,
  pengurusList,
  musyawarahList,
  presensiList,
  syncing,
  onRefresh,
  onSaveMusyawarah,
  onDeleteMusyawarah,
  onSavePresensiBatch,
}: MusyawarahViewProps) {
  const canManage = role === 'superadmin' || role === 'admin';

  const [subTab, setSubTab] = useState<MusyawarahSubTab>('daftar');
  const [notice, setNotice] = useState('');

  // Filter Daftar Musyawarah
  const [filterJenis, setFilterJenis] = useState<'ALL' | JenisMusyawarah>('ALL');
  const [filterUnitId, setFilterUnitId] = useState<string>('ALL');
  const [filterBulan, setFilterBulan] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Rekap Kehadiran
  const [rekapUnitId, setRekapUnitId] = useState<string>('ALL');
  const [rekapJenis, setRekapJenis] = useState<'ALL' | JenisMusyawarah>('ALL');
  const [rekapBulan, setRekapBulan] = useState<string>('ALL');
  const [rekapSearch, setRekapSearch] = useState('');
  const [detailPengurusHistoryId, setDetailPengurusHistoryId] = useState<string | null>(null);

  // Status Otorisasi Google Drive
  const [checkingDrive, setCheckingDrive] = useState(false);
  const [driveStatus, setDriveStatus] = useState<{
    checked: boolean;
    authorized: boolean;
    message: string;
    folderName?: string;
  }>({
    checked: false,
    authorized: false,
    message: '',
  });

  // Form Modal Buat / Edit Musyawarah Lengkap
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MusyawarahItem | null>(null);
  const [jenis, setJenis] = useState<JenisMusyawarah>('Pleno');
  const [unitId, setUnitId] = useState('');
  const [musyawarahKe, setMusyawarahKe] = useState<number>(1);
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [judul, setJudul] = useState('');
  const [tempat, setTempat] = useState('Online (Zoom)');
  const [waktuMulai, setWaktuMulai] = useState('20:00');
  const [pesertaTambahanIds, setPesertaTambahanIds] = useState<string[]>([]);
  const [extraSearchForm, setExtraSearchForm] = useState('');
  const [showExtraPickerForm, setShowExtraPickerForm] = useState(false);
  const [formPresensiSearch, setFormPresensiSearch] = useState('');
  const [formPresensiDraft, setFormPresensiDraft] = useState<
    Record<string, { status: PresensiStatus; keterangan: string }>
  >({});

  // Notula & Dokumentasi pada Form
  const [notulaMode, setNotulaMode] = useState<NotulaMode>('teks');
  const [notulaTeks, setNotulaTeks] = useState('');
  const [notulaFile, setNotulaFile] = useState<File | null>(null);
  const [dokumentasiFile, setDokumentasiFile] = useState<File | null>(null);
  const [dokumentasiLocalPreview, setDokumentasiLocalPreview] = useState<string>('');
  const [savingForm, setSavingForm] = useState(false);
  const [savingStep, setSavingStep] = useState('');
  const [formError, setFormError] = useState('');

  // Konfirmasi hapus
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modal Preview Notula & Dokumentasi
  const [viewNotulaMsy, setViewNotulaMsy] = useState<MusyawarahItem | null>(null);
  const [viewDokumentasiMsy, setViewDokumentasiMsy] = useState<MusyawarahItem | null>(null);

  // Modal Lembar Presensi Cepat (Lihat / Edit Presensi saja)
  const [activePresensiMsyId, setActivePresensiMsyId] = useState<string | null>(null);
  const [draftEntries, setDraftEntries] = useState<
    Record<string, { status: PresensiStatus; keterangan: string }>
  >({});
  const [draftExtraIds, setDraftExtraIds] = useState<string[]>([]);
  const [showAddExtraInSheet, setShowAddExtraInSheet] = useState(false);
  const [extraSearchSheet, setExtraSearchSheet] = useState('');
  const [presensiSearch, setPresensiSearch] = useState('');
  const [savingPresensi, setSavingPresensi] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Semua unit aktif dari PI (urutan 0) hingga Unit 5 (urutan 5)
  const activeUnits = useMemo(
    () => units.filter((u) => u.aktif).sort((a, b) => a.urutan - b.urutan),
    [units],
  );

  const unitMap = useMemo(() => {
    const map = new Map<string, UnitItem>();
    units.forEach((u) => map.set(u.id, u));
    return map;
  }, [units]);

  const sortedPengurus = useMemo(() => {
    return [...pengurusList].sort((a, b) => {
      const uA = unitMap.get(a.unitId)?.urutan ?? 999;
      const uB = unitMap.get(b.unitId)?.urutan ?? 999;
      if (uA !== uB) return uA - uB;
      const amA = AMANAH_ORDER[(a.amanah || '').trim().toLowerCase()] ?? 99;
      const amB = AMANAH_ORDER[(b.amanah || '').trim().toLowerCase()] ?? 99;
      if (amA !== amB) return amA - amB;
      return a.namaLengkap.localeCompare(b.namaLengkap, 'id');
    });
  }, [pengurusList, unitMap]);

  const presensiByMsy = useMemo(() => {
    const map = new Map<string, PresensiItem[]>();
    presensiList.forEach((p) => {
      const normalized = { ...p, status: normalizePresensiStatus(p.status) };
      const list = map.get(p.musyawarahId);
      if (list) list.push(normalized);
      else map.set(p.musyawarahId, [normalized]);
    });
    return map;
  }, [presensiList]);

  const resolveParticipants = (
    targetJenis: JenisMusyawarah,
    targetUnitId: string | undefined,
    extraIds: string[] = [],
  ): { pengurus: PengurusItem; sumber: 'Wajib' | 'Tambahan' }[] => {
    if (targetJenis === 'Pleno') {
      return sortedPengurus.map((p) => ({ pengurus: p, sumber: 'Wajib' as const }));
    }
    const extraSet = new Set(extraIds);
    const primary = sortedPengurus
      .filter((p) => p.unitId === targetUnitId)
      .map((p) => ({ pengurus: p, sumber: 'Wajib' as const }));
    const primaryIds = new Set(primary.map((x) => x.pengurus.id));
    const extras = sortedPengurus
      .filter((p) => !primaryIds.has(p.id) && extraSet.has(p.id))
      .map((p) => ({ pengurus: p, sumber: 'Tambahan' as const }));
    return [...primary, ...extras];
  };

  const resolveParticipantsForMusyawarah = (
    msy: MusyawarahItem,
    overrideExtraIds?: string[],
  ): { pengurus: PengurusItem; sumber: 'Wajib' | 'Tambahan' }[] => {
    return resolveParticipants(
      msy.jenis,
      msy.unitId,
      overrideExtraIds ?? msy.pesertaTambahanIds ?? [],
    );
  };

  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    musyawarahList.forEach((m) => {
      if (m.tanggal && m.tanggal.length >= 7) {
        set.add(m.tanggal.slice(0, 7));
      }
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [musyawarahList]);

  const formatYearMonth = (ym: string): string => {
    const [y, m] = ym.split('-');
    const idx = Number(m) - 1;
    if (!y || idx < 0 || idx > 11) return ym;
    return `${BULAN_INDONESIA[idx]} ${y}`;
  };

  const suggestNextMusyawarahKe = (targetJenis: JenisMusyawarah, targetUnitId: string): number => {
    const scoped = musyawarahList.filter((m) => {
      if (m.jenis !== targetJenis) return false;
      if (targetJenis === 'Unit') return m.unitId === targetUnitId;
      return true;
    });
    if (scoped.length === 0) return 1;
    const maxKe = Math.max(...scoped.map((m) => Number(m.musyawarahKe) || 1));
    return Math.min(52, maxKe + 1);
  };

  const filteredMusyawarah = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return [...musyawarahList]
      .filter((m) => {
        if (filterJenis !== 'ALL' && m.jenis !== filterJenis) return false;
        if (filterUnitId !== 'ALL') {
          if (m.jenis !== 'Unit' || m.unitId !== filterUnitId) return false;
        }
        if (filterBulan !== 'ALL' && !m.tanggal.startsWith(filterBulan)) return false;
        if (q) {
          const u = m.unitId ? unitMap.get(m.unitId) : undefined;
          const hay =
            `${m.judul} ${m.jenis} ke-${m.musyawarahKe} ${u?.kodeUnit || ''} ${u?.namaUnit || ''} ${m.namaUnit || ''} ${m.tempat || ''} ${m.tanggal}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const d = b.tanggal.localeCompare(a.tanggal);
        if (d !== 0) return d;
        return (b.musyawarahKe || 1) - (a.musyawarahKe || 1);
      });
  }, [musyawarahList, filterJenis, filterUnitId, filterBulan, searchQuery, unitMap]);

  const globalStats = useMemo(() => {
    const totalMsy = musyawarahList.length;
    const totalPleno = musyawarahList.filter((m) => m.jenis === 'Pleno').length;
    const totalUnit = musyawarahList.filter((m) => m.jenis === 'Unit').length;

    let sumUndangan = 0;
    let sumHadir = 0;
    musyawarahList.forEach((m) => {
      const entries = presensiByMsy.get(m.id) || [];
      if (entries.length > 0) {
        sumUndangan += entries.length;
        sumHadir += entries.filter((e) => e.status === 'Hadir').length;
      } else {
        const participants = resolveParticipantsForMusyawarah(m);
        sumUndangan += participants.length;
      }
    });

    return {
      totalMsy,
      totalPleno,
      totalUnit,
      avgPct: formatPct(sumHadir, sumUndangan),
      sumHadir,
      sumUndangan,
    };
  }, [musyawarahList, presensiByMsy, sortedPengurus]);

  const rekapScopedMusyawarah = useMemo(() => {
    return musyawarahList.filter((m) => {
      if (rekapJenis !== 'ALL' && m.jenis !== rekapJenis) return false;
      if (rekapBulan !== 'ALL' && !m.tanggal.startsWith(rekapBulan)) return false;
      return true;
    });
  }, [musyawarahList, rekapJenis, rekapBulan]);

  const rekapPengurusRows = useMemo(() => {
    const q = rekapSearch.trim().toLowerCase();
    const targetPengurus = sortedPengurus.filter((p) => {
      if (rekapUnitId !== 'ALL' && p.unitId !== rekapUnitId) return false;
      if (q) {
        const uKode = unitMap.get(p.unitId)?.kodeUnit || '';
        const hay = `${p.namaLengkap} ${p.namaPanggilan} ${uKode} ${p.namaUnit} ${p.amanah}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return targetPengurus.map((p) => {
      let plenoTotal = 0;
      let plenoHadir = 0;
      let unitTotal = 0;
      let unitHadir = 0;
      let hadir = 0;
      let izinSebelum = 0;
      let izinSetelah = 0;
      let tidakHadir = 0;
      let belumDiisi = 0;

      const history: {
        musyawarah: MusyawarahItem;
        sumber: 'Wajib' | 'Tambahan';
        status: PresensiStatus | 'Belum Diisi';
        keterangan: string;
      }[] = [];

      rekapScopedMusyawarah.forEach((m) => {
        const entries = presensiByMsy.get(m.id) || [];
        const entry = entries.find((e) => e.pengurusId === p.id);
        const isPleno = m.jenis === 'Pleno';
        const isUnitMember = m.jenis === 'Unit' && m.unitId === p.unitId;
        const isExtra = m.jenis === 'Unit' && (m.pesertaTambahanIds || []).includes(p.id);
        const isInvited = isPleno || isUnitMember || isExtra || Boolean(entry);

        if (!isInvited) return;

        const sumber: 'Wajib' | 'Tambahan' =
          entry?.sumberPeserta || (isExtra && !isUnitMember ? 'Tambahan' : 'Wajib');
        const st: PresensiStatus | 'Belum Diisi' = entry
          ? normalizePresensiStatus(entry.status)
          : 'Belum Diisi';

        if (isPleno) {
          plenoTotal += 1;
          if (st === 'Hadir') plenoHadir += 1;
        } else {
          unitTotal += 1;
          if (st === 'Hadir') unitHadir += 1;
        }

        if (st === 'Hadir') hadir += 1;
        else if (st === 'Izin Sebelum Rapat') izinSebelum += 1;
        else if (st === 'Izin Setelah Rapat') izinSetelah += 1;
        else if (st === 'Tidak Hadir') tidakHadir += 1;
        else belumDiisi += 1;

        history.push({
          musyawarah: m,
          sumber,
          status: st,
          keterangan: entry?.keterangan || '',
        });
      });

      const totalUndangan = plenoTotal + unitTotal;
      const pctTotal = totalUndangan > 0 ? (hadir / totalUndangan) * 100 : 0;
      history.sort((a, b) => b.musyawarah.tanggal.localeCompare(a.musyawarah.tanggal));

      return {
        pengurus: p,
        unitKode: unitMap.get(p.unitId)?.kodeUnit || p.namaUnit,
        plenoHadir,
        plenoTotal,
        unitHadir,
        unitTotal,
        hadir,
        izinSebelum,
        izinSetelah,
        tidakHadir,
        belumDiisi,
        totalUndangan,
        pctTotal,
        history,
      };
    });
  }, [sortedPengurus, rekapUnitId, rekapSearch, rekapScopedMusyawarah, presensiByMsy, unitMap]);

  const showTempNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 5000);
  };

  const handleCheckDriveAuth = async () => {
    setCheckingDrive(true);
    try {
      const res = await checkDriveAuthStatus(webAppUrl);
      setDriveStatus({
        checked: true,
        authorized: res.authorized,
        folderName: res.folderName,
        message:
          res.message ||
          (res.authorized
            ? 'Google Drive & Docs terotorisasi dan siap menyimpan notula & dokumentasi.'
            : 'Izin Google Drive/Docs belum diotorisasi di Google Apps Script.'),
      });
    } finally {
      setCheckingDrive(false);
    }
  };

  // Peserta untuk Form Tambah / Edit Musyawarah
  const formParticipants = useMemo(
    () => resolveParticipants(jenis, unitId, pesertaTambahanIds),
    [jenis, unitId, pesertaTambahanIds, sortedPengurus],
  );

  const filteredFormParticipants = useMemo(() => {
    const q = formPresensiSearch.trim().toLowerCase();
    if (!q) return formParticipants;
    return formParticipants.filter(({ pengurus }) => {
      const uKode = unitMap.get(pengurus.unitId)?.kodeUnit || '';
      return `${pengurus.namaLengkap} ${pengurus.namaPanggilan} ${uKode} ${pengurus.amanah}`
        .toLowerCase()
        .includes(q);
    });
  }, [formParticipants, formPresensiSearch, unitMap]);

  const candidateExtrasForForm = useMemo(() => {
    if (jenis !== 'Unit') return [];
    const q = extraSearchForm.trim().toLowerCase();
    return sortedPengurus.filter((p) => {
      if (p.unitId === unitId) return false;
      if (!q) return true;
      const uKode = unitMap.get(p.unitId)?.kodeUnit || '';
      return `${p.namaLengkap} ${p.namaPanggilan} ${uKode} ${p.amanah}`.toLowerCase().includes(q);
    });
  }, [jenis, unitId, sortedPengurus, extraSearchForm, unitMap]);

  // Nama file Drive yang akan otomatis dibuat
  const computedBaseFileName = useMemo(() => {
    const u = jenis === 'Unit' ? unitMap.get(unitId) : null;
    return buildMusyawarahFileBaseName({
      jenis,
      musyawarahKe,
      tanggal,
      unit: u,
    });
  }, [jenis, musyawarahKe, tanggal, unitId, unitMap]);

  const notulaTargetFileName = useMemo(() => {
    if (notulaMode === 'file') {
      const ext = notulaFile ? getFileExtension(notulaFile.name) || 'pdf' : 'pdf';
      return `${computedBaseFileName}.${ext}`;
    }
    return `${computedBaseFileName}.pdf`;
  }, [notulaMode, notulaFile, computedBaseFileName]);

  const dokumentasiTargetFileName = useMemo(() => {
    const ext = dokumentasiFile
      ? getFileExtension(dokumentasiFile.name) === 'png'
        ? 'png'
        : 'jpg'
      : 'jpg';
    return `${computedBaseFileName}.${ext}`;
  }, [dokumentasiFile, computedBaseFileName]);

  // Hitungan ringkas presensi pada form
  const formPresensiCounts = useMemo(() => {
    let hadir = 0;
    let izinSebelum = 0;
    let izinSetelah = 0;
    let tidakHadir = 0;
    formParticipants.forEach(({ pengurus }) => {
      const st = formPresensiDraft[pengurus.id]?.status || 'Hadir';
      if (st === 'Hadir') hadir += 1;
      else if (st === 'Izin Sebelum Rapat') izinSebelum += 1;
      else if (st === 'Izin Setelah Rapat') izinSetelah += 1;
      else tidakHadir += 1;
    });
    return { hadir, izinSebelum, izinSetelah, tidakHadir, total: formParticipants.length };
  }, [formParticipants, formPresensiDraft]);

  const buildInitialFormDraft = (
    targetJenis: JenisMusyawarah,
    targetUnitId: string,
    extraIds: string[],
    existingEntries?: PresensiItem[],
  ) => {
    const existingMap = new Map<string, PresensiItem>();
    (existingEntries || []).forEach((e) => existingMap.set(e.pengurusId, e));
    const list = resolveParticipants(targetJenis, targetUnitId, extraIds);
    const next: Record<string, { status: PresensiStatus; keterangan: string }> = {};
    list.forEach(({ pengurus }) => {
      const prev = existingMap.get(pengurus.id);
      next[pengurus.id] = {
        status: prev ? normalizePresensiStatus(prev.status) : 'Hadir',
        keterangan: prev?.keterangan || '',
      };
    });
    return next;
  };

  const openCreateForm = () => {
    const defaultUnit = activeUnits[0]?.id || '';
    const nextKe = suggestNextMusyawarahKe('Pleno', defaultUnit);
    setEditingItem(null);
    setJenis('Pleno');
    setUnitId(defaultUnit);
    setMusyawarahKe(nextKe);
    setTanggal(new Date().toISOString().slice(0, 10));
    setJudul('');
    setTempat('Online (Zoom)');
    setWaktuMulai('20:00');
    setPesertaTambahanIds([]);
    setExtraSearchForm('');
    setShowExtraPickerForm(false);
    setFormPresensiSearch('');
    setFormPresensiDraft(buildInitialFormDraft('Pleno', defaultUnit, []));
    setNotulaMode('teks');
    setNotulaTeks('');
    setNotulaFile(null);
    setDokumentasiFile(null);
    setDokumentasiLocalPreview('');
    setSavingStep('');
    setFormError('');
    setFormOpen(true);
    if (webAppUrl.trim() && !driveStatus.checked) {
      void handleCheckDriveAuth();
    }
  };

  const openEditForm = (item: MusyawarahItem) => {
    const existingEntries = presensiByMsy.get(item.id) || [];
    const targetUnit = item.unitId || activeUnits[0]?.id || '';
    const extras = item.pesertaTambahanIds || [];
    setEditingItem(item);
    setJenis(item.jenis);
    setUnitId(targetUnit);
    setMusyawarahKe(Math.min(52, Math.max(1, Number(item.musyawarahKe) || 1)));
    setTanggal(item.tanggal);
    setJudul(item.judul);
    setTempat(item.tempat || 'Online');
    setWaktuMulai(item.waktuMulai || '');
    setPesertaTambahanIds(extras);
    setExtraSearchForm('');
    setShowExtraPickerForm(false);
    setFormPresensiSearch('');
    setFormPresensiDraft(buildInitialFormDraft(item.jenis, targetUnit, extras, existingEntries));
    setNotulaMode(item.notulaMode === 'file' ? 'file' : 'teks');
    setNotulaTeks(item.notulaTeks || item.notulensiRingkas || '');
    setNotulaFile(null);
    setDokumentasiFile(null);
    setDokumentasiLocalPreview(getDriveImagePreviewUrl(item));
    setSavingStep('');
    setFormError('');
    setFormOpen(true);
    if (webAppUrl.trim() && !driveStatus.checked) {
      void handleCheckDriveAuth();
    }
  };

  const handleJenisChange = (nextJenis: JenisMusyawarah) => {
    setJenis(nextJenis);
    const nextUnit = unitId || activeUnits[0]?.id || '';
    if (nextJenis === 'Unit' && !unitId && nextUnit) {
      setUnitId(nextUnit);
    }
    if (!editingItem) {
      setMusyawarahKe(suggestNextMusyawarahKe(nextJenis, nextUnit));
    }
    setFormPresensiDraft((prev) => {
      const next = { ...prev };
      resolveParticipants(nextJenis, nextUnit, nextJenis === 'Unit' ? pesertaTambahanIds : []).forEach(
        ({ pengurus }) => {
          if (!next[pengurus.id]) {
            next[pengurus.id] = { status: 'Hadir', keterangan: '' };
          }
        },
      );
      return next;
    });
  };

  const handleUnitChange = (nextUnitId: string) => {
    setUnitId(nextUnitId);
    const cleanedExtras = pesertaTambahanIds.filter((pid) => {
      const found = sortedPengurus.find((p) => p.id === pid);
      return found && found.unitId !== nextUnitId;
    });
    setPesertaTambahanIds(cleanedExtras);
    if (!editingItem && jenis === 'Unit') {
      setMusyawarahKe(suggestNextMusyawarahKe('Unit', nextUnitId));
    }
    setFormPresensiDraft((prev) => {
      const next = { ...prev };
      resolveParticipants('Unit', nextUnitId, cleanedExtras).forEach(({ pengurus }) => {
        if (!next[pengurus.id]) {
          next[pengurus.id] = { status: 'Hadir', keterangan: '' };
        }
      });
      return next;
    });
  };

  const handleNotulaFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = getFileExtension(f.name);
    if (!['pdf', 'doc', 'docx'].includes(ext)) {
      setFormError('Berkas notula hanya menerima format PDF (.pdf) atau Word (.doc / .docx).');
      e.target.value = '';
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setFormError('Ukuran berkas notula maksimal 15 MB.');
      e.target.value = '';
      return;
    }
    setFormError('');
    setNotulaFile(f);
  };

  const handleDokumentasiFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = getFileExtension(f.name);
    if (!['jpg', 'jpeg', 'png'].includes(ext) && !['image/jpeg', 'image/png'].includes(f.type)) {
      setFormError('Foto dokumentasi hanya menerima format gambar JPG/JPEG atau PNG.');
      e.target.value = '';
      return;
    }
    if (f.size > 12 * 1024 * 1024) {
      setFormError('Ukuran foto dokumentasi maksimal 12 MB.');
      e.target.value = '';
      return;
    }
    setFormError('');
    setDokumentasiFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      setDokumentasiLocalPreview(String(reader.result || ''));
    };
    reader.readAsDataURL(f);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const keNum = Math.round(Number(musyawarahKe));
    if (!Number.isFinite(keNum) || keNum < 1 || keNum > 52) {
      setFormError('Nomor "Musyawarah Ke" harus antara 1 sampai 52.');
      return;
    }
    if (!tanggal.trim()) {
      setFormError('Tanggal musyawarah wajib diisi.');
      return;
    }
    if (jenis === 'Unit' && !unitId) {
      setFormError('Pilih unit penyelenggara (PI hingga Unit 5) untuk Musyawarah Unit.');
      return;
    }

    const chosenUnit = jenis === 'Unit' ? unitMap.get(unitId) : undefined;
    const defaultJudul =
      jenis === 'Pleno'
        ? `Musyawarah Pleno Ke-${keNum}`
        : `Musyawarah ${formatUnitCompactBadge(chosenUnit)} Ke-${keNum}`;
    const finalJudul = judul.trim() || defaultJudul;

    const baseName = buildMusyawarahFileBaseName({
      jenis,
      musyawarahKe: keNum,
      tanggal,
      unit: chosenUnit,
    });

    const presensiRingkasanText = `Hadir: ${formPresensiCounts.hadir}/${formPresensiCounts.total} (${formatPct(formPresensiCounts.hadir, formPresensiCounts.total)}) | Izin Sebelum Rapat: ${formPresensiCounts.izinSebelum} | Izin Setelah Rapat: ${formPresensiCounts.izinSetelah} | Tidak Hadir: ${formPresensiCounts.tidakHadir}`;

    let finalNotulaFileName = editingItem?.notulaFileName || '';
    let finalNotulaFileUrl = editingItem?.notulaFileUrl || '';
    let finalNotulaFileId = editingItem?.notulaFileId || '';
    let finalDokFileName = editingItem?.dokumentasiFileName || '';
    let finalDokFileUrl = editingItem?.dokumentasiFileUrl || '';
    let finalDokFileId = editingItem?.dokumentasiFileId || '';
    let finalDokPreviewUrl = dokumentasiLocalPreview || editingItem?.dokumentasiPreviewUrl || '';
    const uploadWarnings: string[] = [];

    setSavingForm(true);
    try {
      // 1. Proses Notula (Upload File PDF/Word ATAU Konversi Teks -> Word/Docs -> PDF di Drive)
      if (notulaMode === 'file' && notulaFile) {
        const ext = getFileExtension(notulaFile.name) || 'pdf';
        const targetName = `${baseName}.${ext}`;
        if (webAppUrl.trim()) {
          setSavingStep(`Mengunggah file notula "${targetName}" ke Google Drive...`);
          const base64Data = await readFileAsBase64(notulaFile);
          const upRes = await uploadMusyawarahFileToDrive(
            {
              kind: 'notula_file',
              fileName: targetName,
              mimeType:
                notulaFile.type ||
                (ext === 'pdf'
                  ? 'application/pdf'
                  : ext === 'docx'
                    ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                    : 'application/msword'),
              base64Data,
            },
            activePin,
            webAppUrl,
          );
          if (!upRes.ok) {
            setFormError(
              upRes.error ||
                'Gagal mengunggah berkas notula ke Google Drive. Pastikan izin Drive sudah diotorisasi.',
            );
            return;
          }
          finalNotulaFileName = upRes.fileName || targetName;
          finalNotulaFileUrl = upRes.url || '';
          finalNotulaFileId = upRes.fileId || '';
        } else {
          finalNotulaFileName = targetName;
          uploadWarnings.push('File notula baru dicatat lokal (hubungkan GAS untuk upload ke Drive).');
        }
      } else if (notulaMode === 'teks' && notulaTeks.trim()) {
        const textChanged =
          !editingItem ||
          (editingItem.notulaTeks || '').trim() !== notulaTeks.trim() ||
          !editingItem.notulaFileUrl;
        if (textChanged) {
          if (webAppUrl.trim()) {
            setSavingStep(`Mengonversi teks notula ke Word/Docs & PDF "${baseName}.pdf" di Drive...`);
            const pdfRes = await uploadMusyawarahNotulaTextToDrive(
              {
                baseFileName: baseName,
                judul: finalJudul,
                jenis,
                unitLabel: chosenUnit ? formatUnitOptionLabel(chosenUnit) : 'Seluruh Pengurus DUWD',
                musyawarahKe: keNum,
                tanggalFormatted: formatTanggalIndonesia(tanggal),
                notulaTeks: notulaTeks.trim(),
                presensiRingkasan: presensiRingkasanText,
              },
              activePin,
              webAppUrl,
            );
            if (!pdfRes.ok) {
              setFormError(
                pdfRes.error ||
                  'Gagal membuat PDF notula di Google Drive. Pastikan fungsi otorisasiGoogleDrive() sudah dijalankan di Apps Script.',
              );
              return;
            }
            finalNotulaFileName = pdfRes.fileName || `${baseName}.pdf`;
            finalNotulaFileUrl = pdfRes.url || '';
            finalNotulaFileId = pdfRes.fileId || '';
          } else {
            finalNotulaFileName = `${baseName}.pdf`;
            uploadWarnings.push(
              'Teks notula tersimpan lokal (hubungkan GAS agar otomatis menjadi PDF di Google Drive).',
            );
          }
        }
      }

      // 2. Proses Dokumentasi (1 Foto JPG/PNG ke Drive)
      if (dokumentasiFile) {
        setSavingStep('Menyiapkan foto dokumentasi...');
        const prepared = await prepareImageForUpload(dokumentasiFile);
        const targetDokName = `${baseName}.${prepared.ext}`;
        finalDokPreviewUrl = prepared.previewDataUrl;

        if (webAppUrl.trim()) {
          setSavingStep(`Mengunggah foto dokumentasi "${targetDokName}" ke Google Drive...`);
          const dokRes = await uploadMusyawarahFileToDrive(
            {
              kind: 'dokumentasi',
              fileName: targetDokName,
              mimeType: prepared.mimeType,
              base64Data: prepared.base64Data,
            },
            activePin,
            webAppUrl,
          );
          if (!dokRes.ok) {
            setFormError(
              dokRes.error ||
                'Gagal mengunggah foto dokumentasi ke Google Drive. Pastikan izin Drive sudah diotorisasi.',
            );
            return;
          }
          finalDokFileName = dokRes.fileName || targetDokName;
          finalDokFileUrl = dokRes.url || '';
          finalDokFileId = dokRes.fileId || '';
          if (dokRes.thumbnailUrl) {
            finalDokPreviewUrl = dokRes.thumbnailUrl;
          }
        } else {
          finalDokFileName = targetDokName;
          uploadWarnings.push(
            'Foto dokumentasi tersimpan sebagai pratinjau lokal (hubungkan GAS untuk upload ke Drive).',
          );
        }
      }

      // 3. Simpan Data Musyawarah
      setSavingStep('Menyimpan data musyawarah...');
      const msyRes = await saveMusyawarahRecord(
        {
          id: editingItem?.id,
          judul: finalJudul,
          jenis,
          musyawarahKe: keNum,
          unitId: chosenUnit?.id || '',
          namaUnit: chosenUnit ? formatUnitOptionLabel(chosenUnit) : '',
          tanggal,
          waktuMulai: waktuMulai.trim(),
          waktuSelesai: editingItem?.waktuSelesai || '',
          tempat: tempat.trim() || 'Online',
          pimpinanRapat: editingItem?.pimpinanRapat || '',
          notulaMode: notulaMode || (notulaTeks.trim() ? 'teks' : ''),
          notulaTeks: notulaMode === 'teks' ? notulaTeks.trim() : editingItem?.notulaTeks || '',
          notulaFileName: finalNotulaFileName,
          notulaFileUrl: finalNotulaFileUrl,
          notulaFileId: finalNotulaFileId,
          dokumentasiFileName: finalDokFileName,
          dokumentasiFileUrl: finalDokFileUrl,
          dokumentasiFileId: finalDokFileId,
          dokumentasiPreviewUrl: finalDokPreviewUrl,
          notulensiRingkas: notulaMode === 'teks' ? notulaTeks.trim().slice(0, 220) : '',
          tautanDrive: finalNotulaFileUrl || finalDokFileUrl || MUSYAWARAH_DRIVE_FOLDER_URL,
          pesertaTambahanIds: jenis === 'Unit' ? pesertaTambahanIds : [],
          dibuatPada: editingItem?.dibuatPada,
        },
        activePin,
        webAppUrl,
      );

      if (!msyRes.ok || !msyRes.item) {
        setFormError(msyRes.error || 'Gagal menyimpan data musyawarah.');
        return;
      }

      const savedMsy = msyRes.item;
      onSaveMusyawarah(savedMsy);

      // 4. Simpan Presensi Pengurus langsung dalam satu alur
      setSavingStep(`Menyimpan presensi ${formParticipants.length} pengurus...`);
      const batchEntries: PresensiItem[] = formParticipants.map(({ pengurus, sumber }) => {
        const draft = formPresensiDraft[pengurus.id] || {
          status: 'Hadir' as PresensiStatus,
          keterangan: '',
        };
        return {
          id: `${savedMsy.id}__${pengurus.id}`,
          musyawarahId: savedMsy.id,
          pengurusId: pengurus.id,
          namaLengkap: pengurus.namaLengkap,
          unitKode: unitMap.get(pengurus.unitId)?.kodeUnit || pengurus.namaUnit,
          amanah: pengurus.amanah,
          sumberPeserta: sumber,
          status: draft.status,
          keterangan: draft.keterangan.trim(),
        };
      });

      const presRes = await savePresensiBatchRecord(savedMsy.id, batchEntries, activePin, webAppUrl);
      if (presRes.ok && presRes.items) {
        onSavePresensiBatch(savedMsy.id, presRes.items);
      }

      setFormOpen(false);
      const extraInfo = uploadWarnings.length ? ` (${uploadWarnings.join(' ')})` : '';
      showTempNotice(
        msyRes.synced
          ? `"${savedMsy.judul}" beserta presensi (${batchEntries.length} pengurus) & berkas Drive berhasil disimpan.${extraInfo}`
          : `"${savedMsy.judul}" beserta presensi tersimpan di sesi lokal.${extraInfo}`,
      );
    } finally {
      setSavingForm(false);
      setSavingStep('');
    }
  };

  const handleDeleteMusyawarah = async (id: string) => {
    const res = await deleteMusyawarahRecord(id, activePin, webAppUrl);
    if (res.ok) {
      onDeleteMusyawarah(id);
      setConfirmDeleteId(null);
      showTempNotice(
        res.synced
          ? 'Data musyawarah dan presensinya dihapus dari Google Sheets.'
          : 'Data musyawarah dihapus dari daftar lokal.',
      );
    } else {
      setConfirmDeleteId(null);
      showTempNotice(res.error || 'Gagal menghapus musyawarah.');
    }
  };

  // Modal Lembar Presensi Cepat
  const openPresensiModal = (msy: MusyawarahItem) => {
    const existing = presensiByMsy.get(msy.id) || [];
    const existingMap = new Map<string, PresensiItem>();
    existing.forEach((e) => existingMap.set(e.pengurusId, e));

    const extraIdsFromPresensi = existing
      .filter((e) => e.sumberPeserta === 'Tambahan')
      .map((e) => e.pengurusId);
    const mergedExtras = Array.from(
      new Set([...(msy.pesertaTambahanIds || []), ...extraIdsFromPresensi]),
    );

    const participants = resolveParticipantsForMusyawarah(msy, mergedExtras);
    const nextDraft: Record<string, { status: PresensiStatus; keterangan: string }> = {};
    participants.forEach(({ pengurus }) => {
      const prev = existingMap.get(pengurus.id);
      nextDraft[pengurus.id] = {
        status: prev ? normalizePresensiStatus(prev.status) : 'Hadir',
        keterangan: prev?.keterangan || '',
      };
    });

    setDraftExtraIds(mergedExtras);
    setDraftEntries(nextDraft);
    setPresensiSearch('');
    setExtraSearchSheet('');
    setShowAddExtraInSheet(false);
    setActivePresensiMsyId(msy.id);
  };

  const activePresensiMsy = useMemo(
    () => musyawarahList.find((m) => m.id === activePresensiMsyId) || null,
    [musyawarahList, activePresensiMsyId],
  );

  const activeSheetParticipants = useMemo(() => {
    if (!activePresensiMsy) return [];
    return resolveParticipantsForMusyawarah(activePresensiMsy, draftExtraIds);
  }, [activePresensiMsy, draftExtraIds, sortedPengurus]);

  const filteredSheetParticipants = useMemo(() => {
    const q = presensiSearch.trim().toLowerCase();
    if (!q) return activeSheetParticipants;
    return activeSheetParticipants.filter(({ pengurus }) => {
      const uKode = unitMap.get(pengurus.unitId)?.kodeUnit || '';
      return `${pengurus.namaLengkap} ${pengurus.namaPanggilan} ${uKode} ${pengurus.amanah}`
        .toLowerCase()
        .includes(q);
    });
  }, [activeSheetParticipants, presensiSearch, unitMap]);

  const candidateExtrasForSheet = useMemo(() => {
    if (!activePresensiMsy || activePresensiMsy.jenis !== 'Unit') return [];
    const q = extraSearchSheet.trim().toLowerCase();
    return sortedPengurus.filter((p) => {
      if (p.unitId === activePresensiMsy.unitId) return false;
      if (!q) return true;
      const uKode = unitMap.get(p.unitId)?.kodeUnit || '';
      return `${p.namaLengkap} ${p.namaPanggilan} ${uKode} ${p.amanah}`.toLowerCase().includes(q);
    });
  }, [activePresensiMsy, sortedPengurus, extraSearchSheet, unitMap]);

  const toggleExtraParticipantInSheet = (pengurusId: string) => {
    setDraftExtraIds((prev) => {
      if (prev.includes(pengurusId)) {
        return prev.filter((id) => id !== pengurusId);
      }
      setDraftEntries((dPrev) => ({
        ...dPrev,
        [pengurusId]: dPrev[pengurusId] || { status: 'Hadir', keterangan: '' },
      }));
      return [...prev, pengurusId];
    });
  };

  const toggleExtraParticipantInForm = (pengurusId: string) => {
    setPesertaTambahanIds((prev) => {
      if (prev.includes(pengurusId)) {
        return prev.filter((id) => id !== pengurusId);
      }
      setFormPresensiDraft((dPrev) => ({
        ...dPrev,
        [pengurusId]: dPrev[pengurusId] || { status: 'Hadir', keterangan: '' },
      }));
      return [...prev, pengurusId];
    });
  };

  const handleMarkAllFormHadir = () => {
    setFormPresensiDraft((prev) => {
      const next = { ...prev };
      formParticipants.forEach(({ pengurus }) => {
        next[pengurus.id] = {
          status: 'Hadir',
          keterangan: next[pengurus.id]?.keterangan || '',
        };
      });
      return next;
    });
  };

  const handleMarkAllSheetHadir = () => {
    setDraftEntries((prev) => {
      const next = { ...prev };
      activeSheetParticipants.forEach(({ pengurus }) => {
        next[pengurus.id] = {
          status: 'Hadir',
          keterangan: next[pengurus.id]?.keterangan || '',
        };
      });
      return next;
    });
  };

  const handleSavePresensiSheet = async () => {
    if (!activePresensiMsy) return;
    setSavingPresensi(true);
    try {
      const oldExtras = [...(activePresensiMsy.pesertaTambahanIds || [])].sort().join(',');
      const newExtras = [...draftExtraIds].sort().join(',');
      if (activePresensiMsy.jenis === 'Unit' && oldExtras !== newExtras) {
        const msyRes = await saveMusyawarahRecord(
          {
            ...activePresensiMsy,
            pesertaTambahanIds: draftExtraIds,
          },
          activePin,
          webAppUrl,
        );
        if (msyRes.ok && msyRes.item) {
          onSaveMusyawarah(msyRes.item);
        }
      }

      const entries: PresensiItem[] = activeSheetParticipants.map(({ pengurus, sumber }) => {
        const draft = draftEntries[pengurus.id] || {
          status: 'Hadir' as PresensiStatus,
          keterangan: '',
        };
        return {
          id: `${activePresensiMsy.id}__${pengurus.id}`,
          musyawarahId: activePresensiMsy.id,
          pengurusId: pengurus.id,
          namaLengkap: pengurus.namaLengkap,
          unitKode: unitMap.get(pengurus.unitId)?.kodeUnit || pengurus.namaUnit,
          amanah: pengurus.amanah,
          sumberPeserta: sumber,
          status: draft.status,
          keterangan: draft.keterangan.trim(),
        };
      });

      const res = await savePresensiBatchRecord(
        activePresensiMsy.id,
        entries,
        activePin,
        webAppUrl,
      );

      if (res.ok && res.items) {
        onSavePresensiBatch(activePresensiMsy.id, res.items);
        setActivePresensiMsyId(null);
        showTempNotice(
          res.synced
            ? `Presensi "${activePresensiMsy.judul}" (${res.items.length} pengurus) tersimpan ke Google Sheets.`
            : `Presensi "${activePresensiMsy.judul}" (${res.items.length} pengurus) disimpan di sesi lokal.`,
        );
      } else {
        showTempNotice(res.error || 'Gagal menyimpan presensi.');
      }
    } finally {
      setSavingPresensi(false);
    }
  };

  // Salin Rekap 1 Musyawarah ke WA (4 status resmi)
  const handleCopyMusyawarahWa = async (msy: MusyawarahItem) => {
    const entries = presensiByMsy.get(msy.id) || [];
    const participants = resolveParticipantsForMusyawarah(msy);
    const entryMap = new Map(entries.map((e) => [e.pengurusId, e]));

    const hadirList: string[] = [];
    const izinSebelumList: string[] = [];
    const izinSetelahList: string[] = [];
    const tidakHadirList: string[] = [];

    participants.forEach(({ pengurus, sumber }) => {
      const e = entryMap.get(pengurus.id);
      const uKode = unitMap.get(pengurus.unitId)?.kodeUnit || '';
      const suffix = sumber === 'Tambahan' ? ` (${uKode} · Tambahan)` : ` (${uKode})`;
      const ket = e?.keterangan ? ` — ${e.keterangan}` : '';
      const label = `${pengurus.namaLengkap}${suffix}${ket}`;
      const st = e ? normalizePresensiStatus(e.status) : 'Tidak Hadir';
      if (st === 'Hadir') hadirList.push(label);
      else if (st === 'Izin Sebelum Rapat') izinSebelumList.push(label);
      else if (st === 'Izin Setelah Rapat') izinSetelahList.push(label);
      else tidakHadirList.push(label);
    });

    const total = participants.length;
    const uObj = msy.unitId ? unitMap.get(msy.unitId) : undefined;
    const unitLabel =
      msy.jenis === 'Unit' ? ` (${formatUnitCompactBadge(uObj, msy.namaUnit)})` : ' (Seluruh Pengurus)';

    const lines = [
      `*REKAP PRESENSI MUSYAWARAH ${msy.jenis.toUpperCase()} KE-${msy.musyawarahKe || 1}${unitLabel}*`,
      `Agenda : ${msy.judul}`,
      `Tanggal: ${formatTanggalIndonesia(msy.tanggal)}`,
      `Kehadiran: ${hadirList.length}/${total} (${formatPct(hadirList.length, total)})`,
      '',
      `*Hadir (${hadirList.length}):*`,
      ...(hadirList.length ? hadirList.map((n, i) => `${i + 1}. ${n}`) : ['-']),
    ];

    if (izinSebelumList.length) {
      lines.push(
        '',
        `*Izin Sebelum Rapat (${izinSebelumList.length}):*`,
        ...izinSebelumList.map((n, i) => `${i + 1}. ${n}`),
      );
    }
    if (izinSetelahList.length) {
      lines.push(
        '',
        `*Izin Setelah Rapat (${izinSetelahList.length}):*`,
        ...izinSetelahList.map((n, i) => `${i + 1}. ${n}`),
      );
    }
    if (tidakHadirList.length) {
      lines.push(
        '',
        `*Tidak Hadir (${tidakHadirList.length}):*`,
        ...tidakHadirList.map((n, i) => `${i + 1}. ${n}`),
      );
    }
    if (msy.notulaFileUrl) {
      lines.push('', `Notula: ${msy.notulaFileUrl}`);
    }
    if (msy.dokumentasiFileUrl) {
      lines.push(`Dokumentasi: ${msy.dokumentasiFileUrl}`);
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedId(msy.id);
      window.setTimeout(() => setCopiedId(null), 1800);
      showTempNotice(`Rekap presensi "${msy.judul}" disalin ke clipboard.`);
    } catch {
      showTempNotice('Gagal menyalin ke clipboard.');
    }
  };

  const handleCopyRekapWa = async () => {
    const plenoCnt = rekapScopedMusyawarah.filter((m) => m.jenis === 'Pleno').length;
    const unitCnt = rekapScopedMusyawarah.filter((m) => m.jenis === 'Unit').length;
    const lines = [
      `*REKAP KEHADIRAN MUSYAWARAH DUWD DPP WI*`,
      `Total Musyawarah: ${rekapScopedMusyawarah.length} (Pleno: ${plenoCnt} · Unit: ${unitCnt})`,
      '',
      ...rekapPengurusRows.map(
        (r, idx) =>
          `${idx + 1}. ${r.pengurus.namaLengkap} (${r.unitKode}) — Hadir ${r.hadir}/${r.totalUndangan} (${formatPct(r.hadir, r.totalUndangan)}) | Izin Sblm: ${r.izinSebelum}, Izin Stlh: ${r.izinSetelah}, Tdk Hadir: ${r.tidakHadir}`,
      ),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showTempNotice('Rekap kehadiran seluruh pengurus berhasil disalin ke clipboard.');
    } catch {
      showTempNotice('Gagal menyalin rekap.');
    }
  };

  const handleExportRekapCsv = () => {
    const headers = [
      'No',
      'Nama Lengkap',
      'Nama Panggilan',
      'Unit',
      'Amanah',
      'Pleno Hadir',
      'Pleno Total',
      'Pleno (%)',
      'Unit Hadir',
      'Unit Total',
      'Unit (%)',
      'Hadir',
      'Izin Sebelum Rapat',
      'Izin Setelah Rapat',
      'Tidak Hadir',
      'Total Undangan',
      'Persentase Kehadiran',
    ];
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...rekapPengurusRows.map((r, idx) =>
        [
          idx + 1,
          r.pengurus.namaLengkap,
          r.pengurus.namaPanggilan,
          r.unitKode,
          r.pengurus.amanah,
          r.plenoHadir,
          r.plenoTotal,
          formatPct(r.plenoHadir, r.plenoTotal),
          r.unitHadir,
          r.unitTotal,
          formatPct(r.unitHadir, r.unitTotal),
          r.hadir,
          r.izinSebelum,
          r.izinSetelah,
          r.tidakHadir,
          r.totalUndangan,
          formatPct(r.hadir, r.totalUndangan),
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    ];

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `REKAP_PRESENSI_MUSYAWARAH_DUWD.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const detailPengurusRow = useMemo(
    () => rekapPengurusRows.find((r) => r.pengurus.id === detailPengurusHistoryId) || null,
    [rekapPengurusRows, detailPengurusHistoryId],
  );

  return (
    <section className="duwd-container px-4 py-6 sm:px-6 lg:py-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold text-[#0C7A89] dark:text-[#38C6D9]">
            Departemen Urusan Wilayah dan Daerah &middot; DPP Wahdah Islamiyah
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] dark:text-[#E6F4F7] sm:text-3xl">
            Presensi &amp; Arsip Musyawarah
          </h1>
          <p className="mt-1 text-sm text-[#526A70] dark:text-[#93B1B9]">
            Pencatatan Musyawarah Pleno dan Musyawarah Unit (PI–Unit 5), presensi 4 status, notula otomatis PDF, dan foto dokumentasi di Google Drive.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <a
            href={MUSYAWARAH_DRIVE_FOLDER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#07525E]/15 bg-white/85 px-3 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#D9EEF2] dark:hover:bg-[#15313A]"
          >
            <FolderOpen className="h-3.5 w-3.5 text-[#D88B15]" />
            <span>Folder Drive</span>
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>

          {webAppUrl.trim() && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={syncing}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-60 dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#D9EEF2] dark:hover:bg-[#15313A]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
            </button>
          )}

          {canManage && (
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Musyawarah</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
            Total Musyawarah
          </div>
          <div className="mt-1 text-2xl font-bold text-[#07525E] dark:text-[#E6F4F7] tabular-nums">
            {globalStats.totalMsy}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#84A4AC]">
            Tersinkron ke Kalender Kegiatan
          </div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
            Musyawarah Pleno
          </div>
          <div className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
            {globalStats.totalPleno}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#84A4AC]">
            Seluruh pengurus ({sortedPengurus.length} orang)
          </div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
            Musyawarah Unit
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {globalStats.totalUnit}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#84A4AC]">
            PI &amp; Unit 1–5 + lintas unit
          </div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
            Rata-rata Kehadiran
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0C7A89] dark:text-[#38C6D9] tabular-nums">
            {globalStats.avgPct}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#84A4AC] tabular-nums">
            {globalStats.sumHadir} hadir dari {globalStats.sumUndangan} undangan
          </div>
        </div>
      </div>

      {notice && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#0C7A89]/25 bg-[#ECF6F2] px-4 py-2.5 text-xs font-medium text-[#07525E] dark:border-[#38C6D9]/25 dark:bg-[#0E2B26] dark:text-[#CDEEE5]">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="cursor-pointer text-[#526A70] dark:text-[#93B1B9]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sub-tab Switcher */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-xl bg-[#EBF5F8]/90 p-1 dark:bg-[#102A32]">
          <button
            type="button"
            onClick={() => setSubTab('daftar')}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'daftar'
                ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#173944] dark:text-[#E6F4F7]'
                : 'text-[#526A70] hover:text-[#07525E] dark:text-[#93B1B9] dark:hover:text-[#E6F4F7]'
            }`}
          >
            <ClipboardCheck className="h-3.5 w-3.5" />
            <span>Daftar Musyawarah ({musyawarahList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('rekap')}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
              subTab === 'rekap'
                ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#173944] dark:text-[#E6F4F7]'
                : 'text-[#526A70] hover:text-[#07525E] dark:text-[#93B1B9] dark:hover:text-[#E6F4F7]'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Rekap Kehadiran Pengurus</span>
          </button>
        </div>

        {subTab === 'rekap' && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopyRekapWa()}
              disabled={rekapPengurusRows.length === 0}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#0C7A89]/25 bg-[#EBF5F8] px-3.5 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4] disabled:opacity-50 dark:border-[#38C6D9]/25 dark:bg-[#102A32] dark:text-[#D9EEF2] dark:hover:bg-[#173944]"
            >
              <Copy className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#38C6D9]" />
              <span>Salin Rekap WA</span>
            </button>
            <button
              type="button"
              onClick={handleExportRekapCsv}
              disabled={rekapPengurusRows.length === 0}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-50 dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#D9EEF2] dark:hover:bg-[#15313A]"
            >
              <Download className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#38C6D9]" />
              <span>Unduh CSV Rekap</span>
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: DAFTAR MUSYAWARAH */}
      {subTab === 'daftar' && (
        <>
          <div className="mt-4 glass-surface p-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
              <div className="relative lg:col-span-5">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B8187] dark:text-[#84A4AC]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari judul, nomor musyawarah, unit, atau tanggal..."
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2.5 pr-4 pl-10 text-xs text-[#0F2429] placeholder:text-[#7D9197] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6] dark:placeholder:text-[#6E8E97]"
                />
              </div>

              <div className="lg:col-span-2">
                <select
                  value={filterJenis}
                  onChange={(e) => setFilterJenis(e.target.value as 'ALL' | JenisMusyawarah)}
                  aria-label="Filter jenis musyawarah"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]"
                >
                  <option value="ALL">Semua Jenis</option>
                  <option value="Pleno">Musyawarah Pleno</option>
                  <option value="Unit">Musyawarah Unit</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <select
                  value={filterUnitId}
                  onChange={(e) => setFilterUnitId(e.target.value)}
                  aria-label="Filter unit musyawarah"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]"
                >
                  <option value="ALL">Semua Unit (PI – Unit 5)</option>
                  {activeUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatUnitOptionLabel(u)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <select
                  value={filterBulan}
                  onChange={(e) => setFilterBulan(e.target.value)}
                  aria-label="Filter bulan musyawarah"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]"
                >
                  <option value="ALL">Semua Bulan</option>
                  {availableMonths.map((ym) => (
                    <option key={ym} value={ym}>
                      {formatYearMonth(ym)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 glass-surface-strong overflow-hidden">
            {filteredMusyawarah.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF5F8] text-[#0C7A89] dark:bg-[#102A32] dark:text-[#38C6D9]">
                  <CalendarDays className="h-6 w-6" />
                </div>
                <h2 className="mt-4 text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  {musyawarahList.length === 0
                    ? 'Belum Ada Agenda Musyawarah Tercatat'
                    : 'Tidak Ada Musyawarah Sesuai Filter'}
                </h2>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#526A70] dark:text-[#93B1B9]">
                  {musyawarahList.length === 0
                    ? canManage
                      ? 'Klik "Tambah Musyawarah" untuk mencatat musyawarah Pleno atau Unit beserta presensi pengurus, notula, dan foto dokumentasi ke Google Drive.'
                      : 'Belum ada data musyawarah tercatat. Masuk sebagai Admin atau Super Admin untuk menambah musyawarah.'
                    : 'Ubah kata kunci pencarian atau atur ulang filter jenis, unit, dan bulan.'}
                </p>
                {canManage && musyawarahList.length === 0 && (
                  <button
                    type="button"
                    onClick={openCreateForm}
                    className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-xs font-semibold text-white"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Tambah Musyawarah Pertama</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="duwd-zebra-table w-full min-w-[1040px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold tracking-wide text-[#355158] uppercase dark:border-[#38C6D9]/15 dark:bg-[#0B1E24] dark:text-[#9FC1CA]">
                      <th className="w-[140px] px-4 py-3.5">Tanggal &amp; Ke-</th>
                      <th className="px-4 py-3.5">Musyawarah &amp; Lingkup</th>
                      <th className="w-[230px] px-4 py-3.5">Kehadiran Pengurus</th>
                      <th className="w-[215px] px-4 py-3.5">Notula &amp; Dokumentasi</th>
                      <th className="w-[210px] px-4 py-3.5 text-right">Presensi &amp; Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#07525E]/8 dark:divide-[#38C6D9]/10">
                    {filteredMusyawarah.map((msy) => {
                      const entries = presensiByMsy.get(msy.id) || [];
                      const participants = resolveParticipantsForMusyawarah(msy);
                      const totalPeserta = Math.max(participants.length, entries.length);
                      const jmlHadir = entries.filter((e) => e.status === 'Hadir').length;
                      const jmlIzinSblm = entries.filter(
                        (e) => e.status === 'Izin Sebelum Rapat',
                      ).length;
                      const jmlIzinStlh = entries.filter(
                        (e) => e.status === 'Izin Setelah Rapat',
                      ).length;
                      const jmlTidakHadir = entries.filter((e) => e.status === 'Tidak Hadir').length;
                      const hasRecorded = entries.length > 0;
                      const pctNum =
                        totalPeserta > 0 ? Math.round((jmlHadir / totalPeserta) * 100) : 0;
                      const uObj = msy.unitId ? unitMap.get(msy.unitId) : undefined;
                      const hasNotula = Boolean(
                        msy.notulaFileUrl || msy.notulaFileId || msy.notulaTeks?.trim(),
                      );
                      const hasDok = Boolean(
                        msy.dokumentasiFileUrl ||
                          msy.dokumentasiFileId ||
                          msy.dokumentasiPreviewUrl,
                      );

                      return (
                        <tr key={msy.id} className="align-top transition-colors">
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7] tabular-nums">
                              {formatTanggalIndonesia(msy.tanggal)}
                            </div>
                            <div className="mt-1 inline-flex items-center rounded-md border border-[#07525E]/15 bg-white/80 px-2 py-0.5 text-[10px] font-bold text-[#07525E] dark:border-[#38C6D9]/20 dark:bg-[#102A32] dark:text-[#7CD8E6]">
                              Musyawarah Ke-{msy.musyawarahKe || 1}
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                  msy.jenis === 'Pleno'
                                    ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                                    : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                }`}
                              >
                                {msy.jenis === 'Pleno'
                                  ? 'Pleno'
                                  : `Unit · ${formatUnitCompactBadge(uObj, msy.namaUnit)}`}
                              </span>
                              {(msy.pesertaTambahanIds?.length || 0) > 0 && (
                                <span className="inline-flex items-center rounded-md bg-[#D88B15]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#9A5E08] dark:text-[#F0B24A]">
                                  +{msy.pesertaTambahanIds.length} lintas unit
                                </span>
                              )}
                            </div>
                            <div className="mt-1 font-bold text-[#07525E] dark:text-[#E6F4F7]">
                              {msy.judul}
                            </div>
                            {(msy.tempat || msy.waktuMulai) && (
                              <div className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#93B1B9]">
                                {[msy.tempat, msy.waktuMulai ? `${msy.waktuMulai} WITA` : '']
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-bold text-[#07525E] dark:text-[#E6F4F7] tabular-nums">
                                {hasRecorded
                                  ? `${jmlHadir}/${totalPeserta} Hadir (${pctNum}%)`
                                  : `0/${totalPeserta} (Belum diisi)`}
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#07525E]/10 dark:bg-[#38C6D9]/15">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#0C7A89] to-emerald-500 transition-all"
                                style={{ width: `${hasRecorded ? pctNum : 0}%` }}
                              />
                            </div>
                            {hasRecorded && (
                              <div className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] font-semibold tabular-nums">
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  Hadir: {jmlHadir}
                                </span>
                                <span className="text-[#0C7A89] dark:text-[#38C6D9]">
                                  Izin Sblm: {jmlIzinSblm}
                                </span>
                                <span className="text-[#B46E09] dark:text-[#F0A93B]">
                                  Izin Stlh: {jmlIzinStlh}
                                </span>
                                <span className="text-rose-600 dark:text-rose-400">
                                  Tdk Hadir: {jmlTidakHadir}
                                </span>
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => setViewNotulaMsy(msy)}
                                disabled={!hasNotula}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                                  hasNotula
                                    ? 'border-[#0C7A89]/25 bg-[#EBF5F8] text-[#07525E] hover:bg-[#DCEEF4] dark:border-[#38C6D9]/25 dark:bg-[#102A32] dark:text-[#D9EEF2] dark:hover:bg-[#173944]'
                                    : 'cursor-not-allowed border-[#07525E]/10 bg-transparent text-[#8DA2A8] opacity-60 dark:border-[#38C6D9]/10 dark:text-[#5B7A83]'
                                }`}
                              >
                                <FileText className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#38C6D9]" />
                                <span>Lihat Notula</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setViewDokumentasiMsy(msy)}
                                disabled={!hasDok}
                                className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                                  hasDok
                                    ? 'border-[#D88B15]/30 bg-[#FEF6E7] text-[#9A5E08] hover:bg-[#FDEBC8] dark:border-[#D88B15]/30 dark:bg-[#2E210C] dark:text-[#F0B24A] dark:hover:bg-[#3B2A10]'
                                    : 'cursor-not-allowed border-[#07525E]/10 bg-transparent text-[#8DA2A8] opacity-60 dark:border-[#38C6D9]/10 dark:text-[#5B7A83]'
                                }`}
                              >
                                <ImageIcon className="h-3.5 w-3.5 text-[#D88B15]" />
                                <span>Dokumentasi</span>
                              </button>
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openPresensiModal(msy)}
                                className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#0C7A89] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#07525E]"
                              >
                                <ClipboardCheck className="h-3.5 w-3.5" />
                                <span>{canManage ? 'Presensi' : 'Lihat'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleCopyMusyawarahWa(msy)}
                                title="Salin rekap presensi untuk WhatsApp"
                                className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#07525E]/15 bg-white/85 px-2 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-white dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#D9EEF2]"
                              >
                                {copiedId === msy.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>

                              {canManage && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => openEditForm(msy)}
                                    title="Edit musyawarah, notula & dokumentasi"
                                    className="inline-flex cursor-pointer items-center rounded-lg border border-[#07525E]/15 bg-white/85 p-1.5 text-[#07525E] hover:bg-white dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#D9EEF2]"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(msy.id)}
                                    title="Hapus musyawarah"
                                    className="inline-flex cursor-pointer items-center rounded-lg border border-rose-500/20 bg-rose-50/70 p-1.5 text-rose-600 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:text-rose-400"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
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
        </>
      )}

      {/* TAB 2: REKAP KEHADIRAN PENGURUS */}
      {subTab === 'rekap' && (
        <>
          <div className="mt-4 glass-surface p-4">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
              <div className="relative lg:col-span-4">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B8187] dark:text-[#84A4AC]" />
                <input
                  type="text"
                  value={rekapSearch}
                  onChange={(e) => setRekapSearch(e.target.value)}
                  placeholder="Cari nama pengurus, unit, atau amanah..."
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2.5 pr-4 pl-10 text-xs text-[#0F2429] placeholder:text-[#7D9197] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6] dark:placeholder:text-[#6E8E97]"
                />
              </div>

              <div className="lg:col-span-3">
                <select
                  value={rekapUnitId}
                  onChange={(e) => setRekapUnitId(e.target.value)}
                  aria-label="Filter unit pengurus"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]"
                >
                  <option value="ALL">Semua Unit Pengurus</option>
                  {activeUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {formatUnitOptionLabel(u)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <select
                  value={rekapJenis}
                  onChange={(e) => setRekapJenis(e.target.value as 'ALL' | JenisMusyawarah)}
                  aria-label="Filter jenis musyawarah untuk rekap"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]"
                >
                  <option value="ALL">Pleno &amp; Unit</option>
                  <option value="Pleno">Pleno Saja</option>
                  <option value="Unit">Unit Saja</option>
                </select>
              </div>

              <div className="lg:col-span-3">
                <select
                  value={rekapBulan}
                  onChange={(e) => setRekapBulan(e.target.value)}
                  aria-label="Filter bulan untuk rekap"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]"
                >
                  <option value="ALL">Semua Periode ({rekapScopedMusyawarah.length} rapat)</option>
                  {availableMonths.map((ym) => (
                    <option key={ym} value={ym}>
                      {formatYearMonth(ym)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-4 glass-surface-strong overflow-hidden">
            {rekapPengurusRows.length === 0 ? (
              <div className="px-6 py-14 text-center text-xs text-[#526A70] dark:text-[#93B1B9]">
                Belum ada data pengurus yang sesuai filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="duwd-zebra-table w-full min-w-[1040px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold tracking-wide text-[#355158] uppercase dark:border-[#38C6D9]/15 dark:bg-[#0B1E24] dark:text-[#9FC1CA]">
                      <th className="w-[44px] px-3 py-3.5 text-center">No</th>
                      <th className="px-4 py-3.5">Pengurus &amp; Unit</th>
                      <th className="w-[105px] px-3 py-3.5 text-center">Pleno</th>
                      <th className="w-[105px] px-3 py-3.5 text-center">Unit</th>
                      <th className="w-[72px] px-2.5 py-3.5 text-center text-emerald-700 dark:text-emerald-400">
                        Hadir
                      </th>
                      <th className="w-[92px] px-2.5 py-3.5 text-center text-[#0C7A89] dark:text-[#38C6D9]">
                        Izin Sblm
                      </th>
                      <th className="w-[92px] px-2.5 py-3.5 text-center text-[#B46E09] dark:text-[#F0A93B]">
                        Izin Stlh
                      </th>
                      <th className="w-[86px] px-2.5 py-3.5 text-center text-rose-600 dark:text-rose-400">
                        Tdk Hadir
                      </th>
                      <th className="w-[155px] px-4 py-3.5">Persentase</th>
                      <th className="w-[90px] px-3 py-3.5 text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#07525E]/8 dark:divide-[#38C6D9]/10">
                    {rekapPengurusRows.map((row, idx) => (
                      <tr key={row.pengurus.id} className="align-middle transition-colors">
                        <td className="px-3 py-3 text-center font-semibold text-[#6B8187] tabular-nums dark:text-[#84A4AC]">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-[#07525E] dark:text-[#E6F4F7]">
                            {row.pengurus.namaLengkap}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#93B1B9]">
                            {row.unitKode} &middot; {row.pengurus.amanah}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums">
                          <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                            {row.plenoHadir}/{row.plenoTotal}
                          </div>
                          <div className="text-[10px] text-[#6B8187] dark:text-[#84A4AC]">
                            {formatPct(row.plenoHadir, row.plenoTotal)}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums">
                          <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                            {row.unitHadir}/{row.unitTotal}
                          </div>
                          <div className="text-[10px] text-[#6B8187] dark:text-[#84A4AC]">
                            {formatPct(row.unitHadir, row.unitTotal)}
                          </div>
                        </td>
                        <td className="px-2.5 py-3 text-center font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                          {row.hadir}
                        </td>
                        <td className="px-2.5 py-3 text-center font-semibold text-[#0C7A89] tabular-nums dark:text-[#38C6D9]">
                          {row.izinSebelum}
                        </td>
                        <td className="px-2.5 py-3 text-center font-semibold text-[#B46E09] tabular-nums dark:text-[#F0A93B]">
                          {row.izinSetelah}
                        </td>
                        <td className="px-2.5 py-3 text-center font-semibold text-rose-600 tabular-nums dark:text-rose-400">
                          {row.tidakHadir}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-between text-[11px] font-bold tabular-nums">
                            <span className="text-[#07525E] dark:text-[#E6F4F7]">
                              {formatPct(row.hadir, row.totalUndangan)}
                            </span>
                            <span className="text-[10px] font-medium text-[#6B8187] dark:text-[#84A4AC]">
                              {row.hadir}/{row.totalUndangan}
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#07525E]/10 dark:bg-[#38C6D9]/15">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#0C7A89] to-emerald-500"
                              style={{ width: `${Math.min(100, Math.round(row.pctTotal))}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setDetailPengurusHistoryId(row.pengurus.id)}
                            className="cursor-pointer rounded-lg border border-[#07525E]/15 bg-white/85 px-2.5 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-white dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#D9EEF2]"
                          >
                            Riwayat
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL FORM TAMBAH / EDIT MUSYAWARAH (LENGKAP DENGAN PRESENSI, NOTULA, DOKUMENTASI) */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181D]/60 p-3 backdrop-blur-md sm:p-5"
          onClick={() => !savingForm && setFormOpen(false)}
        >
          <div
            className="glass-surface-strong flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-[#07525E]/10 px-5 py-4 dark:border-[#38C6D9]/15">
              <div>
                <h2 className="text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  {editingItem ? 'Edit Musyawarah & Berkas' : 'Tambah Musyawarah Baru'}
                </h2>
                <p className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#93B1B9]">
                  Isi identitas musyawarah, presensi pengurus, notula, dan 1 foto dokumentasi dalam satu form.
                </p>
              </div>
              <button
                type="button"
                disabled={savingForm}
                onClick={() => setFormOpen(false)}
                className="cursor-pointer rounded-xl p-1.5 text-[#526A70] hover:bg-[#07525E]/10 disabled:opacity-50 dark:text-[#93B1B9]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Banner Otorisasi Google Drive & Format Nama File */}
              <div className="rounded-xl border border-[#0C7A89]/20 bg-[#F2FAFC] p-3.5 text-xs dark:border-[#38C6D9]/20 dark:bg-[#0D232A]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                    <ShieldCheck className="h-4 w-4 text-[#0C7A89] dark:text-[#38C6D9]" />
                    <span>Penyimpanan Otomatis Google Drive</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={MUSYAWARAH_DRIVE_FOLDER_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-[#07525E]/15 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-[#07525E] hover:bg-white dark:border-[#38C6D9]/20 dark:bg-[#122C35] dark:text-[#D9EEF2]"
                    >
                      <FolderOpen className="h-3 w-3 text-[#D88B15]" />
                      <span>Buka Folder</span>
                    </a>
                    {webAppUrl.trim() && (
                      <button
                        type="button"
                        onClick={() => void handleCheckDriveAuth()}
                        disabled={checkingDrive}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#0C7A89]/15 px-2.5 py-1 text-[11px] font-semibold text-[#07525E] hover:bg-[#0C7A89]/25 dark:text-[#7CD8E6]"
                      >
                        <RefreshCw className={`h-3 w-3 ${checkingDrive ? 'animate-spin' : ''}`} />
                        <span>{checkingDrive ? 'Mengecek...' : 'Cek Izin Drive'}</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] text-[#4A646B] dark:text-[#9FC1CA] sm:grid-cols-2">
                  <div>
                    <span className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                      Nama File Notula:
                    </span>{' '}
                    <span className="font-mono text-[10.5px]">{notulaTargetFileName}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                      Nama File Dokumentasi:
                    </span>{' '}
                    <span className="font-mono text-[10.5px]">{dokumentasiTargetFileName}</span>
                  </div>
                </div>

                {driveStatus.checked && (
                  <div
                    className={`mt-2 flex items-start gap-2 rounded-lg px-2.5 py-1.5 text-[11px] ${
                      driveStatus.authorized
                        ? 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-500/15 text-amber-900 dark:text-amber-300'
                    }`}
                  >
                    {driveStatus.authorized ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>
                      {driveStatus.authorized
                        ? `Terotorisasi ke folder "${driveStatus.folderName || 'Arsip Musyawarah'}". Upload notula & dokumentasi siap digunakan.`
                        : `${driveStatus.message} Jalankan fungsi otorisasiGoogleDrive() di Google Apps Script lalu Deploy New Version.`}
                    </span>
                  </div>
                )}
              </div>

              {/* Bagian 1: Identitas Musyawarah */}
              <div className="space-y-3">
                <div className="text-[11px] font-bold tracking-wide text-[#0C7A89] uppercase dark:text-[#38C6D9]">
                  1. Identitas Musyawarah
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  {/* Jenis Musyawarah */}
                  <div className="sm:col-span-5">
                    <label className="mb-1 block text-xs font-semibold text-[#07525E] dark:text-[#D9EEF2]">
                      Jenis Musyawarah *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Pleno', 'Unit'] as JenisMusyawarah[]).map((j) => (
                        <button
                          key={j}
                          type="button"
                          onClick={() => handleJenisChange(j)}
                          className={`cursor-pointer rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
                            jenis === j
                              ? j === 'Pleno'
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-[#07525E]/15 bg-white/85 text-[#07525E] hover:bg-white dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]'
                          }`}
                        >
                          {j === 'Pleno' ? 'Musyawarah Pleno' : 'Musyawarah Unit'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Musyawarah Ke (1-52) */}
                  <div className="sm:col-span-3">
                    <label className="mb-1 block text-xs font-semibold text-[#07525E] dark:text-[#D9EEF2]">
                      Musyawarah Ke- (1–52) *
                    </label>
                    <select
                      value={musyawarahKe}
                      onChange={(e) => setMusyawarahKe(Number(e.target.value))}
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/95 px-3 py-2 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6]"
                    >
                      {Array.from({ length: 52 }, (_, i) => i + 1).map((num) => (
                        <option key={num} value={num}>
                          Ke-{num}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Input Tanggal */}
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-xs font-semibold text-[#07525E] dark:text-[#D9EEF2]">
                      Tanggal Pelaksanaan *
                    </label>
                    <input
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/95 px-3 py-2 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6]"
                    />
                  </div>
                </div>

                {/* Pilih Unit (jika Musyawarah Unit) — PI sampai Unit 5 */}
                {jenis === 'Unit' && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#07525E] dark:text-[#D9EEF2]">
                      Pilih Unit Penyelenggara (PI – Unit 5) *
                    </label>
                    <select
                      value={unitId}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      required
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/95 px-3 py-2.5 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6]"
                    >
                      {activeUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {formatUnitOptionLabel(u)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-6">
                    <label className="mb-1 block text-xs font-semibold text-[#07525E] dark:text-[#D9EEF2]">
                      Agenda / Judul Musyawarah (opsional, otomatis jika kosong)
                    </label>
                    <input
                      type="text"
                      value={judul}
                      onChange={(e) => setJudul(e.target.value)}
                      placeholder={
                        jenis === 'Pleno'
                          ? `Musyawarah Pleno Ke-${musyawarahKe}`
                          : `Musyawarah ${formatUnitCompactBadge(unitMap.get(unitId))} Ke-${musyawarahKe}`
                      }
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/95 px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6]"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="mb-1 block text-xs font-semibold text-[#07525E] dark:text-[#D9EEF2]">
                      Tempat / Media
                    </label>
                    <input
                      type="text"
                      value={tempat}
                      onChange={(e) => setTempat(e.target.value)}
                      placeholder="Online (Zoom) / Kantor DPP"
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/95 px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-[#07525E] dark:text-[#D9EEF2]">
                      Jam Mulai
                    </label>
                    <input
                      type="time"
                      value={waktuMulai}
                      onChange={(e) => setWaktuMulai(e.target.value)}
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/95 px-2.5 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6]"
                    />
                  </div>
                </div>
              </div>

              {/* Bagian 2: Presensi Pengurus (4 Status) */}
              <div className="space-y-3 border-t border-[#07525E]/10 pt-4 dark:border-[#38C6D9]/15">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-[11px] font-bold tracking-wide text-[#0C7A89] uppercase dark:text-[#38C6D9]">
                      2. Presensi Pengurus ({formPresensiCounts.total} Peserta)
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold tabular-nums">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Hadir: {formPresensiCounts.hadir}
                      </span>
                      <span className="text-[#0C7A89] dark:text-[#38C6D9]">
                        Izin Sebelum Rapat: {formPresensiCounts.izinSebelum}
                      </span>
                      <span className="text-[#B46E09] dark:text-[#F0A93B]">
                        Izin Setelah Rapat: {formPresensiCounts.izinSetelah}
                      </span>
                      <span className="text-rose-600 dark:text-rose-400">
                        Tidak Hadir: {formPresensiCounts.tidakHadir}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {jenis === 'Unit' && (
                      <button
                        type="button"
                        onClick={() => setShowExtraPickerForm((v) => !v)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#D88B15]/30 bg-[#FEF6E7] px-2.5 py-1.5 text-[11px] font-semibold text-[#9A5E08] hover:bg-[#FDEBC8] dark:bg-[#2E210C] dark:text-[#F0B24A]"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>Tambah dari PI / Unit Lain ({pesertaTambahanIds.length})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleMarkAllFormHadir}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-emerald-600/25 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Semua Hadir</span>
                    </button>
                  </div>
                </div>

                {/* Picker Peserta Tambahan untuk Musyawarah Unit */}
                {jenis === 'Unit' && showExtraPickerForm && (
                  <div className="rounded-xl border border-[#D88B15]/25 bg-[#FEFBF3] p-3 dark:border-[#D88B15]/25 dark:bg-[#1E1A11]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[#9A5E08] dark:text-[#F0B24A]">
                        Pilih Peserta Tambahan (PI atau Unit Lain)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowExtraPickerForm(false)}
                        className="cursor-pointer text-[11px] font-semibold text-[#526A70] hover:underline dark:text-[#93B1B9]"
                      >
                        Selesai
                      </button>
                    </div>
                    <input
                      type="text"
                      value={extraSearchForm}
                      onChange={(e) => setExtraSearchForm(e.target.value)}
                      placeholder="Cari nama pengurus PI / unit lain..."
                      className="mt-2 w-full rounded-lg border border-[#07525E]/15 bg-white px-3 py-1.5 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6]"
                    />
                    <div className="mt-2 grid max-h-36 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                      {candidateExtrasForForm.map((p) => {
                        const checked = pesertaTambahanIds.includes(p.id);
                        const uKode = unitMap.get(p.unitId)?.kodeUnit || '';
                        return (
                          <label
                            key={p.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] ${
                              checked
                                ? 'border-[#0C7A89] bg-[#EBF5F8] dark:bg-[#102A32]'
                                : 'border-[#07525E]/10 bg-white/80 dark:border-[#38C6D9]/15 dark:bg-[#0F242B]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleExtraParticipantInForm(p.id)}
                              className="h-3.5 w-3.5 accent-[#0C7A89]"
                            />
                            <span className="truncate font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                              {p.namaLengkap}
                            </span>
                            <span className="ml-auto shrink-0 text-[10px] text-[#6B8187] dark:text-[#84A4AC]">
                              {uKode}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cari Pengurus di daftar presensi */}
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#6B8187]" />
                  <input
                    type="text"
                    value={formPresensiSearch}
                    onChange={(e) => setFormPresensiSearch(e.target.value)}
                    placeholder="Filter nama pengurus di daftar presensi..."
                    className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2 pr-3 pl-9 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6]"
                  />
                </div>

                {/* Tabel Presensi Pengurus Inline */}
                <div className="max-h-72 overflow-y-auto rounded-xl border border-[#07525E]/12 dark:border-[#38C6D9]/15">
                  {filteredFormParticipants.length === 0 ? (
                    <div className="px-4 py-8 text-center text-xs text-[#526A70] dark:text-[#93B1B9]">
                      Tidak ada pengurus pada daftar ini.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#07525E]/8 dark:divide-[#38C6D9]/10">
                      {filteredFormParticipants.map(({ pengurus, sumber }, idx) => {
                        const draft = formPresensiDraft[pengurus.id] || {
                          status: 'Hadir' as PresensiStatus,
                          keterangan: '',
                        };
                        const uKode = unitMap.get(pengurus.unitId)?.kodeUnit || pengurus.namaUnit;
                        return (
                          <div
                            key={pengurus.id}
                            className={`flex flex-col gap-2 px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between ${
                              idx % 2 === 1
                                ? 'bg-[#F4FAFB]/80 dark:bg-[#0E242B]/65'
                                : 'bg-white/70 dark:bg-[#09181E]/50'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[11px] font-semibold text-[#6B8187] tabular-nums">
                                  {idx + 1}.
                                </span>
                                <span className="truncate text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                                  {pengurus.namaLengkap}
                                </span>
                                <span className="rounded bg-[#07525E]/8 px-1.5 py-0.5 text-[10px] font-semibold text-[#355158] dark:bg-[#38C6D9]/15 dark:text-[#9FC1CA]">
                                  {uKode}
                                </span>
                                {sumber === 'Tambahan' && (
                                  <span className="rounded bg-[#D88B15]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#9A5E08] dark:text-[#F0B24A]">
                                    Tambahan
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-1">
                              {PRESENSI_STATUSES.map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() =>
                                    setFormPresensiDraft((prev) => ({
                                      ...prev,
                                      [pengurus.id]: {
                                        status: st,
                                        keterangan: prev[pengurus.id]?.keterangan || '',
                                      },
                                    }))
                                  }
                                  className={`cursor-pointer rounded-lg border px-2 py-1 text-[10.5px] font-semibold transition-colors ${
                                    draft.status === st
                                      ? getStatusActiveButtonClass(st)
                                      : 'border-[#07525E]/15 bg-white text-[#4A646B] hover:border-[#0C7A89]/40 dark:border-[#38C6D9]/20 dark:bg-[#0D2128] dark:text-[#A5C5CE]'
                                  }`}
                                >
                                  {st}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Bagian 3: Upload Notula Musyawarah (File PDF/Word ATAU Teks -> Otomatis Word & PDF) */}
              <div className="space-y-3 border-t border-[#07525E]/10 pt-4 dark:border-[#38C6D9]/15">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-bold tracking-wide text-[#0C7A89] uppercase dark:text-[#38C6D9]">
                    3. Notula Musyawarah
                  </div>

                  <div className="inline-flex gap-1 rounded-xl bg-[#EBF5F8] p-1 dark:bg-[#102A32]">
                    <button
                      type="button"
                      onClick={() => setNotulaMode('teks')}
                      className={`cursor-pointer rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors ${
                        notulaMode === 'teks'
                          ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#173944] dark:text-[#E6F4F7]'
                          : 'text-[#526A70] dark:text-[#93B1B9]'
                      }`}
                    >
                      Tulis / Paste Teks (Otomatis PDF)
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotulaMode('file')}
                      className={`cursor-pointer rounded-lg px-3 py-1 text-[11px] font-semibold transition-colors ${
                        notulaMode === 'file'
                          ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#173944] dark:text-[#E6F4F7]'
                          : 'text-[#526A70] dark:text-[#93B1B9]'
                      }`}
                    >
                      Upload File (PDF / Word)
                    </button>
                  </div>
                </div>

                {notulaMode === 'teks' ? (
                  <div>
                    <textarea
                      rows={6}
                      value={notulaTeks}
                      onChange={(e) => setNotulaTeks(e.target.value)}
                      placeholder="Ketik atau tempel (paste) hasil notula musyawarah di sini...&#10;&#10;Saat Anda klik Simpan, teks ini otomatis dimasukkan ke dokumen Word/Google Docs, dikonversi ke PDF, dan disimpan di folder Google Drive dengan nama sesuai format resmi."
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/95 p-3 text-xs leading-relaxed text-[#0F2429] placeholder:text-[#7D9197] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6] dark:placeholder:text-[#6E8E97]"
                    />
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#526A70] dark:text-[#93B1B9]">
                      <span>
                        Otomatis dikonversi ke PDF: <strong className="font-mono">{computedBaseFileName}.pdf</strong>
                      </span>
                      <span className="tabular-nums">{notulaTeks.trim().length} karakter</span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-[#0C7A89]/35 bg-[#F6FBFC] p-4 dark:border-[#38C6D9]/30 dark:bg-[#0B1E24]">
                    <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0C7A89]/12 text-[#0C7A89] dark:text-[#38C6D9]">
                          <Upload className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                            {notulaFile
                              ? notulaFile.name
                              : editingItem?.notulaFileName
                                ? `Tersimpan: ${editingItem.notulaFileName}`
                                : 'Pilih Berkas Notula (.pdf, .doc, .docx)'}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#93B1B9]">
                            {notulaFile
                              ? `${(notulaFile.size / 1024).toFixed(0)} KB · Akan disimpan di Drive sebagai "${notulaTargetFileName}"`
                              : 'Hanya menerima file PDF atau Microsoft Word (maksimal 15 MB).'}
                          </div>
                        </div>
                      </div>

                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#0C7A89] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#07525E]">
                        <FileText className="h-3.5 w-3.5" />
                        <span>{notulaFile ? 'Ganti File' : 'Pilih PDF / Word'}</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                          onChange={handleNotulaFilePick}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Bagian 4: Upload Dokumentasi (1 Foto JPG/PNG) */}
              <div className="space-y-3 border-t border-[#07525E]/10 pt-4 dark:border-[#38C6D9]/15">
                <div className="text-[11px] font-bold tracking-wide text-[#0C7A89] uppercase dark:text-[#38C6D9]">
                  4. Upload Dokumentasi (1 Foto JPG / PNG)
                </div>

                <div className="rounded-xl border border-dashed border-[#D88B15]/40 bg-[#FEFBF4] p-4 dark:border-[#D88B15]/30 dark:bg-[#1A160D]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      {dokumentasiLocalPreview ? (
                        <img
                          src={dokumentasiLocalPreview}
                          alt="Pratinjau Dokumentasi"
                          className="h-16 w-24 shrink-0 rounded-lg border border-[#07525E]/15 object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg bg-[#D88B15]/12 text-[#D88B15]">
                          <ImageIcon className="h-6 w-6" />
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                          {dokumentasiFile
                            ? dokumentasiFile.name
                            : editingItem?.dokumentasiFileName
                              ? `Tersimpan: ${editingItem.dokumentasiFileName}`
                              : 'Pilih 1 Foto Dokumentasi (JPG / PNG)'}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#93B1B9]">
                          {dokumentasiFile
                            ? `${(dokumentasiFile.size / 1024).toFixed(0)} KB · Disimpan di Drive sebagai "${dokumentasiTargetFileName}"`
                            : 'Hanya menerima gambar format .jpg, .jpeg, atau .png (1 foto).'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {dokumentasiFile && (
                        <button
                          type="button"
                          onClick={() => {
                            setDokumentasiFile(null);
                            setDokumentasiLocalPreview(
                              editingItem ? getDriveImagePreviewUrl(editingItem) : '',
                            );
                          }}
                          className="cursor-pointer rounded-xl border border-[#07525E]/15 px-3 py-2 text-xs font-semibold text-[#526A70] hover:bg-white dark:text-[#93B1B9]"
                        >
                          Batal
                        </button>
                      )}
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#D88B15] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#B46E09]">
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>{dokumentasiFile ? 'Ganti Foto' : 'Pilih Foto JPG/PNG'}</span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                          onChange={handleDokumentasiFilePick}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-50/90 px-3.5 py-2.5 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {savingForm && savingStep && (
                <div className="flex items-center gap-2 rounded-xl border border-[#0C7A89]/25 bg-[#EBF5F8] px-3.5 py-2.5 text-xs font-semibold text-[#07525E] dark:border-[#38C6D9]/25 dark:bg-[#102A32] dark:text-[#D9EEF2]">
                  <Loader2 className="h-4 w-4 animate-spin text-[#0C7A89] dark:text-[#38C6D9]" />
                  <span>{savingStep}</span>
                </div>
              )}

              {/* Footer Modal */}
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#07525E]/10 pt-4 dark:border-[#38C6D9]/15">
                <button
                  type="button"
                  disabled={savingForm}
                  onClick={() => setFormOpen(false)}
                  className="cursor-pointer rounded-xl border border-[#07525E]/15 px-4 py-2.5 text-xs font-semibold text-[#526A70] hover:bg-[#07525E]/5 disabled:opacity-50 dark:border-[#38C6D9]/20 dark:text-[#93B1B9]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2.5 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  {savingForm && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>
                    {savingForm
                      ? 'Menyimpan & Mengunggah...'
                      : editingItem
                        ? 'Simpan Perubahan'
                        : 'Simpan Musyawarah & Upload Drive'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LIHAT NOTULA */}
      {viewNotulaMsy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181D]/65 p-3 backdrop-blur-md sm:p-6"
          onClick={() => setViewNotulaMsy(null)}
        >
          <div
            className="glass-surface-strong flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 px-5 py-4 dark:border-[#38C6D9]/15">
              <div>
                <div className="text-[11px] font-semibold text-[#0C7A89] dark:text-[#38C6D9]">
                  Notula Musyawarah &middot; {formatTanggalIndonesia(viewNotulaMsy.tanggal)}
                </div>
                <h2 className="mt-0.5 text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  {viewNotulaMsy.notulaFileName || viewNotulaMsy.judul}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {viewNotulaMsy.notulaTeks && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(viewNotulaMsy.notulaTeks || '');
                        showTempNotice('Teks notula berhasil disalin.');
                      } catch {
                        showTempNotice('Gagal menyalin teks notula.');
                      }
                    }}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/15 bg-white/85 px-3 py-2 text-xs font-semibold text-[#07525E] hover:bg-white dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#D9EEF2]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Salin Teks</span>
                  </button>
                )}
                {viewNotulaMsy.notulaFileUrl && (
                  <a
                    href={viewNotulaMsy.notulaFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#0C7A89] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#07525E]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Buka di Google Drive</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setViewNotulaMsy(null)}
                  className="cursor-pointer rounded-xl p-1.5 text-[#526A70] hover:bg-[#07525E]/10 dark:text-[#93B1B9]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {getDriveEmbedUrl(viewNotulaMsy.notulaFileId, viewNotulaMsy.notulaFileUrl) ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-xl border border-[#07525E]/15 bg-white dark:border-[#38C6D9]/20">
                    <iframe
                      title={`Pratinjau Notula ${viewNotulaMsy.judul}`}
                      src={getDriveEmbedUrl(viewNotulaMsy.notulaFileId, viewNotulaMsy.notulaFileUrl)}
                      className="h-[62vh] w-full border-0"
                      allow="autoplay"
                    />
                  </div>
                  {viewNotulaMsy.notulaTeks && (
                    <details className="rounded-xl border border-[#07525E]/12 bg-[#F6FBFC] p-3.5 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
                      <summary className="cursor-pointer text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                        Lihat Teks Sumber Notula
                      </summary>
                      <pre className="mt-2.5 whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#2D454B] dark:text-[#C9E2E8]">
                        {viewNotulaMsy.notulaTeks}
                      </pre>
                    </details>
                  )}
                </div>
              ) : viewNotulaMsy.notulaTeks ? (
                <div className="rounded-xl border border-[#07525E]/12 bg-white/90 p-5 dark:border-[#38C6D9]/15 dark:bg-[#0B1C22]">
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-[#0F2429] dark:text-[#EAF4F6]">
                    {viewNotulaMsy.notulaTeks}
                  </pre>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-[#526A70] dark:text-[#93B1B9]">
                  Belum ada file atau teks notula yang tersimpan.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL LIHAT DOKUMENTASI FOTO */}
      {viewDokumentasiMsy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181D]/70 p-3 backdrop-blur-md sm:p-6"
          onClick={() => setViewDokumentasiMsy(null)}
        >
          <div
            className="glass-surface-strong flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 px-5 py-4 dark:border-[#38C6D9]/15">
              <div>
                <div className="text-[11px] font-semibold text-[#D88B15]">
                  Dokumentasi Musyawarah &middot; {formatTanggalIndonesia(viewDokumentasiMsy.tanggal)}
                </div>
                <h2 className="mt-0.5 text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  {viewDokumentasiMsy.dokumentasiFileName || viewDokumentasiMsy.judul}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {viewDokumentasiMsy.dokumentasiFileUrl && (
                  <a
                    href={viewDokumentasiMsy.dokumentasiFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#D88B15] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#B46E09]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Buka di Google Drive</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setViewDokumentasiMsy(null)}
                  className="cursor-pointer rounded-xl p-1.5 text-[#526A70] hover:bg-[#07525E]/10 dark:text-[#93B1B9]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 text-center">
              {getDriveImagePreviewUrl(viewDokumentasiMsy) ? (
                <img
                  src={getDriveImagePreviewUrl(viewDokumentasiMsy)}
                  alt={viewDokumentasiMsy.dokumentasiFileName || viewDokumentasiMsy.judul}
                  className="mx-auto max-h-[68vh] w-auto rounded-xl border border-[#07525E]/15 object-contain shadow-md dark:border-[#38C6D9]/20"
                />
              ) : (
                <div className="py-12 text-xs text-[#526A70] dark:text-[#93B1B9]">
                  Pratinjau gambar tidak tersedia. Klik &ldquo;Buka di Google Drive&rdquo; di atas.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL LEMBAR PRESENSI CEPAT */}
      {activePresensiMsy && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181D]/60 p-3 backdrop-blur-md sm:p-5"
          onClick={() => !savingPresensi && setActivePresensiMsyId(null)}
        >
          <div
            className="glass-surface-strong flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#07525E]/10 px-5 py-4 dark:border-[#38C6D9]/15">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      activePresensiMsy.jenis === 'Pleno'
                        ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                    }`}
                  >
                    {activePresensiMsy.jenis === 'Pleno'
                      ? `Musyawarah Pleno Ke-${activePresensiMsy.musyawarahKe || 1}`
                      : `Musyawarah Unit Ke-${activePresensiMsy.musyawarahKe || 1}`}
                  </span>
                  <span className="text-xs font-semibold text-[#526A70] dark:text-[#93B1B9]">
                    {formatTanggalIndonesia(activePresensiMsy.tanggal)}
                  </span>
                </div>
                <h2 className="mt-1 text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  {activePresensiMsy.judul}
                </h2>
              </div>

              <button
                type="button"
                disabled={savingPresensi}
                onClick={() => setActivePresensiMsyId(null)}
                className="cursor-pointer rounded-xl p-1.5 text-[#526A70] hover:bg-[#07525E]/10 dark:text-[#93B1B9]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#07525E]/10 bg-[#F4FAFB]/80 px-5 py-3 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
              <div className="relative min-w-[210px] flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#6B8187]" />
                <input
                  type="text"
                  value={presensiSearch}
                  onChange={(e) => setPresensiSearch(e.target.value)}
                  placeholder="Cari nama pengurus..."
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white py-2 pr-3 pl-9 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#EAF4F6]"
                />
              </div>

              {canManage && (
                <div className="flex flex-wrap items-center gap-2">
                  {activePresensiMsy.jenis === 'Unit' && (
                    <button
                      type="button"
                      onClick={() => setShowAddExtraInSheet((v) => !v)}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#D88B15]/30 bg-[#FEF6E7] px-3 py-2 text-xs font-semibold text-[#9A5E08] hover:bg-[#FDEBC8] dark:bg-[#2E210C] dark:text-[#F0B24A]"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Peserta Lintas Unit ({draftExtraIds.length})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleMarkAllSheetHadir}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-emerald-600/25 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    <span>Tandai Semua Hadir</span>
                  </button>
                </div>
              )}
            </div>

            {canManage && activePresensiMsy.jenis === 'Unit' && showAddExtraInSheet && (
              <div className="border-b border-[#D88B15]/20 bg-[#FEFBF3] px-5 py-3 dark:bg-[#1E1A11]">
                <input
                  type="text"
                  value={extraSearchSheet}
                  onChange={(e) => setExtraSearchSheet(e.target.value)}
                  placeholder="Cari pengurus dari PI atau unit lain untuk ditambahkan..."
                  className="w-full rounded-lg border border-[#07525E]/15 bg-white px-3 py-1.5 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6]"
                />
                <div className="mt-2 grid max-h-32 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {candidateExtrasForSheet.map((p) => {
                    const checked = draftExtraIds.includes(p.id);
                    const uKode = unitMap.get(p.unitId)?.kodeUnit || '';
                    return (
                      <label
                        key={p.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#07525E]/12 bg-white/85 px-2.5 py-1.5 text-[11px] dark:border-[#38C6D9]/15 dark:bg-[#0F242B]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleExtraParticipantInSheet(p.id)}
                          className="h-3.5 w-3.5 accent-[#0C7A89]"
                        />
                        <span className="truncate font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                          {p.namaLengkap}
                        </span>
                        <span className="ml-auto text-[10px] text-[#6B8187]">{uKode}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              <div className="divide-y divide-[#07525E]/8 dark:divide-[#38C6D9]/10">
                {filteredSheetParticipants.map(({ pengurus, sumber }, idx) => {
                  const draft = draftEntries[pengurus.id] || {
                    status: 'Hadir' as PresensiStatus,
                    keterangan: '',
                  };
                  const uKode = unitMap.get(pengurus.unitId)?.kodeUnit || pengurus.namaUnit;
                  return (
                    <div
                      key={pengurus.id}
                      className={`flex flex-col gap-2.5 px-5 py-3 lg:flex-row lg:items-center lg:justify-between ${
                        idx % 2 === 1
                          ? 'bg-[#F4FAFB]/75 dark:bg-[#0E242B]/65'
                          : 'bg-transparent'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-[#6B8187] tabular-nums">
                            {idx + 1}.
                          </span>
                          <span className="text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                            {pengurus.namaLengkap}
                          </span>
                          <span className="rounded bg-[#07525E]/8 px-1.5 py-0.5 text-[10px] font-semibold text-[#355158] dark:bg-[#38C6D9]/15 dark:text-[#9FC1CA]">
                            {uKode}
                          </span>
                          {sumber === 'Tambahan' && (
                            <span className="rounded bg-[#D88B15]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#9A5E08] dark:text-[#F0B24A]">
                              Tambahan
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#93B1B9]">
                          {pengurus.amanah}
                        </div>
                      </div>

                      {canManage ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {PRESENSI_STATUSES.map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() =>
                                setDraftEntries((prev) => ({
                                  ...prev,
                                  [pengurus.id]: {
                                    status: st,
                                    keterangan: prev[pengurus.id]?.keterangan || '',
                                  },
                                }))
                              }
                              className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                                draft.status === st
                                  ? getStatusActiveButtonClass(st)
                                  : 'border-[#07525E]/15 bg-white text-[#4A646B] hover:border-[#0C7A89]/40 dark:border-[#38C6D9]/20 dark:bg-[#0D2128] dark:text-[#A5C5CE]'
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span
                          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${getStatusBadgeClass(draft.status)}`}
                        >
                          {draft.status}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#07525E]/10 px-5 py-3.5 dark:border-[#38C6D9]/15">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#526A70] dark:text-[#93B1B9]">
                <Users className="h-4 w-4 text-[#0C7A89] dark:text-[#38C6D9]" />
                <span>Total {activeSheetParticipants.length} peserta</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActivePresensiMsyId(null)}
                  className="cursor-pointer rounded-xl border border-[#07525E]/15 px-4 py-2 text-xs font-semibold text-[#526A70] hover:bg-[#07525E]/5 dark:border-[#38C6D9]/20 dark:text-[#93B1B9]"
                >
                  Tutup
                </button>
                {canManage && (
                  <button
                    type="button"
                    disabled={savingPresensi}
                    onClick={() => void handleSavePresensiSheet()}
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                  >
                    {savingPresensi && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{savingPresensi ? 'Menyimpan...' : 'Simpan Presensi'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RIWAYAT KEHADIRAN 1 PENGURUS */}
      {detailPengurusRow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181D]/60 p-3 backdrop-blur-md sm:p-5"
          onClick={() => setDetailPengurusHistoryId(null)}
        >
          <div
            className="glass-surface-strong flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#07525E]/10 px-5 py-4 dark:border-[#38C6D9]/15">
              <div>
                <h2 className="text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  {detailPengurusRow.pengurus.namaLengkap}
                </h2>
                <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#93B1B9]">
                  {detailPengurusRow.unitKode} &middot; {detailPengurusRow.pengurus.amanah} &middot;
                  Kehadiran {formatPct(detailPengurusRow.hadir, detailPengurusRow.totalUndangan)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailPengurusHistoryId(null)}
                className="cursor-pointer rounded-xl p-1.5 text-[#526A70] hover:bg-[#07525E]/10 dark:text-[#93B1B9]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2 border-b border-[#07525E]/10 bg-[#F4FAFB] px-5 py-3 text-center text-xs dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
              <div>
                <div className="text-[10px] font-semibold text-[#526A70] dark:text-[#93B1B9]">Hadir</div>
                <div className="font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                  {detailPengurusRow.hadir}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
                  Izin Sebelum
                </div>
                <div className="font-bold text-[#0C7A89] tabular-nums dark:text-[#38C6D9]">
                  {detailPengurusRow.izinSebelum}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
                  Izin Setelah
                </div>
                <div className="font-bold text-[#B46E09] tabular-nums dark:text-[#F0A93B]">
                  {detailPengurusRow.izinSetelah}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
                  Tidak Hadir
                </div>
                <div className="font-bold text-rose-600 tabular-nums dark:text-rose-400">
                  {detailPengurusRow.tidakHadir}
                </div>
              </div>
            </div>

            <div className="flex-1 divide-y divide-[#07525E]/8 overflow-y-auto dark:divide-[#38C6D9]/10">
              {detailPengurusRow.history.length === 0 ? (
                <div className="px-5 py-10 text-center text-xs text-[#526A70] dark:text-[#93B1B9]">
                  Belum ada riwayat musyawarah pada periode ini.
                </div>
              ) : (
                detailPengurusRow.history.map((h) => (
                  <div
                    key={h.musyawarah.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#07525E] dark:text-[#E6F4F7]">
                        {h.musyawarah.judul}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#93B1B9]">
                        {formatTanggalIndonesia(h.musyawarah.tanggal)} &middot; {h.musyawarah.jenis}{' '}
                        Ke-{h.musyawarah.musyawarahKe || 1}
                        {h.sumber === 'Tambahan' ? ' · Peserta Tambahan' : ''}
                      </div>
                    </div>
                    <span
                      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                        h.status === 'Belum Diisi'
                          ? 'border-[#07525E]/15 text-[#6B8187]'
                          : getStatusBadgeClass(h.status)
                      }`}
                    >
                      {h.status === 'Belum Diisi' ? 'Belum Diisi' : getStatusShortLabel(h.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI HAPUS */}
      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181D]/60 p-4 backdrop-blur-md"
          onClick={() => setConfirmDeleteId(null)}
        >
          <div
            className="glass-surface-strong w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-[#07525E] dark:text-[#E6F4F7]">
              Hapus Agenda Musyawarah?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-[#526A70] dark:text-[#93B1B9]">
              Data musyawarah beserta catatan presensinya akan dihapus dari daftar. File yang sudah
              tersimpan di Google Drive tetap aman.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="cursor-pointer rounded-xl border border-[#07525E]/15 px-3.5 py-2 text-xs font-semibold text-[#526A70] dark:border-[#38C6D9]/20 dark:text-[#93B1B9]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteMusyawarah(confirmDeleteId)}
                className="cursor-pointer rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
