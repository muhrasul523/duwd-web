import {
  Check,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  deleteKegiatanRecord,
  saveKegiatanRecord,
  updateKegiatanJenisRecord,
} from '../services/orgService';
import type {
  KegiatanJenis,
  KegiatanPolaJadwal,
  KegiatanRpkaItem,
  KegiatanStatus,
  ProgramKerjaItem,
  UnitItem,
  UserRole,
} from '../types/org';
import { resolveJenisKegiatan, resolvePolaJadwal } from '../utils/scheduleParser';

interface ProkerRpkaViewProps {
  role: UserRole;
  activePin: string;
  webAppUrl: string;
  prokerList: ProgramKerjaItem[];
  kegiatanList: KegiatanRpkaItem[];
  units: UnitItem[];
  rpkaDriveUrl: string;
  syncing: boolean;
  onRefresh: () => void;
  onSaveKegiatan: (item: KegiatanRpkaItem) => void;
  onDeleteKegiatan: (kodeKegiatan: string) => void;
}

const STATUS_OPTIONS: KegiatanStatus[] = ['Rencana', 'Berjalan', 'Terlaksana'];
const JENIS_OPTIONS: KegiatanJenis[] = ['Event', 'Monev'];
const POLA_JADWAL_OPTIONS: { value: KegiatanPolaJadwal; label: string }[] = [
  { value: 'Tunggal', label: 'Tunggal / Hari Pertama Saja (Default)' },
  { value: 'Pekanan', label: 'Berulang Setiap Pekan (+7 hari)' },
  { value: 'DwiPekanan', label: 'Berulang Setiap 2 Pekan (+14 hari)' },
  { value: 'Bulanan', label: 'Berulang Setiap Bulan' },
];

function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safe);
}

function getStatusTextClass(status?: KegiatanStatus): string {
  switch (status) {
    case 'Terlaksana':
      return 'text-emerald-700 font-semibold dark:text-emerald-400';
    case 'Berjalan':
      return 'text-[#0C7A89] font-semibold dark:text-[#3EC1D3]';
    default:
      return 'text-[#9A6008] font-semibold dark:text-[#F0B243]';
  }
}

function escapeCsvCell(value: string | number | undefined): string {
  const str = String(value ?? '');
  if (str.includes('"') || str.includes(',') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ProkerRpkaView({
  role,
  activePin,
  webAppUrl,
  prokerList,
  kegiatanList,
  units,
  rpkaDriveUrl,
  syncing,
  onRefresh,
  onSaveKegiatan,
  onDeleteKegiatan,
}: ProkerRpkaViewProps) {
  const canEdit = role === 'superadmin';
  const canToggleJenis = role === 'superadmin' || role === 'admin';

  const [selectedProkerKode, setSelectedProkerKode] = useState<string>('ALL');
  const [selectedJenis, setSelectedJenis] = useState<'ALL' | KegiatanJenis>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | KegiatanStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [togglingJenisKode, setTogglingJenisKode] = useState<string | null>(null);

  // Modal Detail
  const [detailItem, setDetailItem] = useState<KegiatanRpkaItem | null>(null);

  // Modal Form Tambah / Edit
  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [kodeKegiatan, setKodeKegiatan] = useState('');
  const [kodeProker, setKodeProker] = useState('');
  const [namaKegiatan, setNamaKegiatan] = useState('');
  const [jenisKegiatan, setJenisKegiatan] = useState<KegiatanJenis>('Event');
  const [polaJadwal, setPolaJadwal] = useState<KegiatanPolaJadwal>('Tunggal');
  const [tujuan, setTujuan] = useState('');
  const [sasaran, setSasaran] = useState('');
  const [indikator, setIndikator] = useState('');
  const [tempat, setTempat] = useState('');
  const [waktu, setWaktu] = useState('');
  const [pendapatanStr, setPendapatanStr] = useState('0');
  const [belanjaStr, setBelanjaStr] = useState('0');
  const [unitPj, setUnitPj] = useState('');
  const [status, setStatus] = useState<KegiatanStatus>('Rencana');
  const [tautanDrive, setTautanDrive] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Konfirmasi hapus
  const [confirmDeleteKode, setConfirmDeleteKode] = useState<string | null>(null);

  const activeUnits = useMemo(
    () => units.filter((u) => u.aktif).sort((a, b) => a.urutan - b.urutan),
    [units],
  );

  const prokerMap = useMemo(() => {
    const map = new Map<string, ProgramKerjaItem>();
    prokerList.forEach((p) => map.set(p.kodeProker, p));
    return map;
  }, [prokerList]);

  const unitCodeByProker = useMemo(() => {
    const map = new Map<string, string>();
    prokerList.forEach((p) => {
      const idx = Number(p.kodeProker.slice(-1));
      const matchedUnit = Number.isFinite(idx)
        ? units.find((u) => u.urutan === idx)
        : undefined;
      map.set(p.kodeProker, matchedUnit?.kodeUnit || p.unitPj || p.kodeProker);
    });
    return map;
  }, [prokerList, units]);

  const jenisCounts = useMemo(() => {
    let eventCount = 0;
    let monevCount = 0;
    kegiatanList.forEach((k) => {
      if (selectedProkerKode !== 'ALL' && k.kodeProker !== selectedProkerKode) return;
      if (resolveJenisKegiatan(k) === 'Monev') monevCount += 1;
      else eventCount += 1;
    });
    return { eventCount, monevCount, total: eventCount + monevCount };
  }, [kegiatanList, selectedProkerKode]);

  const filteredKegiatan = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return kegiatanList
      .filter((item) => {
        if (selectedProkerKode !== 'ALL' && item.kodeProker !== selectedProkerKode) {
          return false;
        }
        const resolvedJenis = resolveJenisKegiatan(item);
        if (selectedJenis !== 'ALL' && resolvedJenis !== selectedJenis) {
          return false;
        }
        const itemStatus: KegiatanStatus = item.status || 'Rencana';
        if (selectedStatus !== 'ALL' && itemStatus !== selectedStatus) {
          return false;
        }
        if (q) {
          const hay = [
            item.kodeKegiatan,
            item.kodeProker,
            item.namaProker,
            item.namaKegiatan,
            resolvedJenis,
            item.tujuan,
            item.sasaran,
            item.indikator,
            item.tempat,
            item.waktu,
            item.unitPj || '',
          ]
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        }
        return true;
      })
      .sort((a, b) => a.kodeKegiatan.localeCompare(b.kodeKegiatan, 'id'));
  }, [kegiatanList, selectedProkerKode, selectedJenis, selectedStatus, searchQuery]);

  const totals = useMemo(() => {
    return filteredKegiatan.reduce(
      (acc, item) => {
        acc.pendapatan += Number(item.pendapatan) || 0;
        acc.belanja += Number(item.belanja) || 0;
        return acc;
      },
      { pendapatan: 0, belanja: 0 },
    );
  }, [filteredKegiatan]);

  const prokerCounts = useMemo(() => {
    const map = new Map<string, number>();
    kegiatanList.forEach((k) => {
      map.set(k.kodeProker, (map.get(k.kodeProker) || 0) + 1);
    });
    return map;
  }, [kegiatanList]);

  const suggestNextKodeKegiatan = (prokerCode: string): string => {
    const existing = kegiatanList.filter((k) => k.kodeProker === prokerCode);
    let maxSeq = 0;
    existing.forEach((k) => {
      const parts = k.kodeKegiatan.split('.');
      const num = Number(parts[1] || '0');
      if (Number.isFinite(num) && num > maxSeq) maxSeq = num;
    });
    return `${prokerCode}.${String(maxSeq + 1).padStart(5, '0')}`;
  };

  const openAddModal = () => {
    const defaultProker =
      selectedProkerKode !== 'ALL'
        ? selectedProkerKode
        : prokerList[0]?.kodeProker || '10001';
    setIsEditing(false);
    setKodeProker(defaultProker);
    setKodeKegiatan(suggestNextKodeKegiatan(defaultProker));
    setNamaKegiatan('');
    setJenisKegiatan(selectedJenis === 'Monev' ? 'Monev' : 'Event');
    setPolaJadwal('Tunggal');
    setTujuan('');
    setSasaran('');
    setIndikator('');
    setTempat('');
    setWaktu('');
    setPendapatanStr('0');
    setBelanjaStr('0');
    setUnitPj('');
    setStatus('Rencana');
    setTautanDrive('');
    setFormError('');
    setFormOpen(true);
  };

  const openEditModal = (item: KegiatanRpkaItem) => {
    setIsEditing(true);
    setKodeKegiatan(item.kodeKegiatan);
    setKodeProker(item.kodeProker);
    setNamaKegiatan(item.namaKegiatan);
    setJenisKegiatan(resolveJenisKegiatan(item));
    setPolaJadwal(resolvePolaJadwal(item));
    setTujuan(item.tujuan);
    setSasaran(item.sasaran);
    setIndikator(item.indikator);
    setTempat(item.tempat);
    setWaktu(item.waktu);
    setPendapatanStr(String(item.pendapatan || 0));
    setBelanjaStr(String(item.belanja || 0));
    setUnitPj(item.unitPj || '');
    setStatus(item.status || 'Rencana');
    setTautanDrive(item.tautanDrive || '');
    setFormError('');
    setFormOpen(true);
  };

  const handleProkerSelectChange = (nextProker: string) => {
    setKodeProker(nextProker);
    if (!isEditing) {
      setKodeKegiatan(suggestNextKodeKegiatan(nextProker));
    }
  };

  const handleSetJenis = async (item: KegiatanRpkaItem, nextJenis: KegiatanJenis) => {
    if (!canToggleJenis) return;
    if (resolveJenisKegiatan(item) === nextJenis) return;
    setTogglingJenisKode(item.kodeKegiatan);
    try {
      const res = await updateKegiatanJenisRecord(item, nextJenis, activePin, webAppUrl);
      if (res.ok && res.item) {
        onSaveKegiatan(res.item);
        if (detailItem && detailItem.kodeKegiatan === item.kodeKegiatan) {
          setDetailItem(res.item);
        }
        setNotice(
          res.synced
            ? `"${item.namaKegiatan}" ditandai sebagai ${nextJenis} (tersinkron ke Sheet).`
            : `"${item.namaKegiatan}" ditandai sebagai ${nextJenis} (disimpan lokal).`,
        );
        window.setTimeout(() => setNotice(''), 3500);
      } else {
        setNotice(res.error || 'Gagal memperbarui sifat kegiatan.');
        window.setTimeout(() => setNotice(''), 4500);
      }
    } finally {
      setTogglingJenisKode(null);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanKode = kodeKegiatan.trim();
    const cleanNama = namaKegiatan.trim();
    const cleanProker = kodeProker.trim();

    if (!cleanKode || !cleanProker || !cleanNama) {
      setFormError('Kode kegiatan, program kerja, dan nama kegiatan wajib diisi.');
      return;
    }

    if (!isEditing && kegiatanList.some((k) => k.kodeKegiatan === cleanKode)) {
      setFormError(`Kode kegiatan ${cleanKode} sudah ada.`);
      return;
    }

    const prokerObj = prokerMap.get(cleanProker);
    const payload: KegiatanRpkaItem = {
      kodeKegiatan: cleanKode,
      kodeProker: cleanProker,
      namaProker: prokerObj?.namaProker || cleanProker,
      namaKegiatan: cleanNama,
      jenisKegiatan,
      polaJadwal,
      tujuan: tujuan.trim() || '-',
      sasaran: sasaran.trim() || '-',
      indikator: indikator.trim() || '-',
      tempat: tempat.trim() || '-',
      waktu: waktu.trim() || '-',
      pendapatan: Math.max(0, Number(pendapatanStr.replace(/\D/g, '')) || 0),
      belanja: Math.max(0, Number(belanjaStr.replace(/\D/g, '')) || 0),
      unitPj: unitPj.trim(),
      status,
      tautanDrive: tautanDrive.trim(),
    };

    setSaving(true);
    try {
      const res = await saveKegiatanRecord(payload, activePin, webAppUrl);
      if (res.ok && res.item) {
        onSaveKegiatan(res.item);
        setFormOpen(false);
        setNotice(
          res.synced
            ? `Kegiatan "${res.item.namaKegiatan}" berhasil disimpan ke Google Sheet KEGIATAN_RPKA.`
            : `Kegiatan "${res.item.namaKegiatan}" disimpan di browser lokal.`,
        );
        window.setTimeout(() => setNotice(''), 4000);
      } else {
        setFormError(res.error || 'Gagal menyimpan kegiatan.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async (kode: string) => {
    const res = await deleteKegiatanRecord(kode, activePin, webAppUrl);
    if (res.ok) {
      onDeleteKegiatan(kode);
      setConfirmDeleteKode(null);
      setNotice(
        res.synced
          ? `Kegiatan ${kode} dihapus dari Google Sheet KEGIATAN_RPKA.`
          : `Kegiatan ${kode} dihapus dari daftar.`,
      );
      window.setTimeout(() => setNotice(''), 3500);
    } else {
      setConfirmDeleteKode(null);
      setNotice(res.error || `Gagal menghapus kegiatan ${kode}.`);
      window.setTimeout(() => setNotice(''), 5000);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Kode Kegiatan',
      'Kode Program Kerja',
      'Nama Program Kerja',
      'Nama Kegiatan',
      'Jenis Kegiatan',
      'Tujuan',
      'Sasaran',
      'Indikator',
      'Tempat',
      'Waktu',
      'Pendapatan (Rp)',
      'Belanja (Rp)',
      'Unit Penanggung Jawab',
      'Status',
      'Tautan Google Drive',
    ];
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...filteredKegiatan.map((item) =>
        [
          item.kodeKegiatan,
          item.kodeProker,
          item.namaProker,
          item.namaKegiatan,
          resolveJenisKegiatan(item),
          item.tujuan,
          item.sasaran,
          item.indikator,
          item.tempat,
          item.waktu,
          item.pendapatan,
          item.belanja,
          item.unitPj || '',
          item.status || 'Rencana',
          item.tautanDrive || '',
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
    link.download = `RPKA_DUWD_2027_${selectedProkerKode === 'ALL' ? 'SEMUA' : selectedProkerKode}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="duwd-container px-2 py-7 sm:px-4 lg:py-9">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
            RPKA Tahun Anggaran 2027 &middot; Departemen Urusan Wilayah dan Daerah
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] dark:text-[#E6F4F7] sm:text-3xl">
            Program Kerja &amp; Kegiatan DUWD
          </h1>
          <p className="mt-1 text-sm text-[#526A70] dark:text-[#9BB5BC]">
            Rekap resmi 5 program kerja, klasifikasi kegiatan Event &amp; Monev, jadwal, serta rencana anggaran.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {rpkaDriveUrl.trim() && (
            <a
              href={rpkaDriveUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D88B15]/30 bg-[#FFF9EE] px-3.5 py-2.5 text-xs font-semibold text-[#9A6008] transition-colors hover:bg-[#FEF1D8] dark:border-[#F0B243]/30 dark:bg-[#2A2010] dark:text-[#F0B243] dark:hover:bg-[#362914]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Dokumen PDF RPKA (Drive)</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
          >
            <Download className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
            <span>Unduh CSV</span>
          </button>

          {webAppUrl.trim() && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={syncing}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-60 dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#113540]"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Menyinkronkan...' : 'Segarkan'}</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah Kegiatan</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Strip */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#9BB5BC]">
            Program Kerja
          </div>
          <div className="mt-1 text-2xl font-bold text-[#07525E] tabular-nums dark:text-[#E6F4F7]">
            {prokerList.length}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#8DA8B0]">
            Program induk 2027
          </div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#9BB5BC]">
            Jumlah Kegiatan
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0C7A89] tabular-nums dark:text-[#3EC1D3]">
            {filteredKegiatan.length}
            {filteredKegiatan.length !== kegiatanList.length && (
              <span className="ml-1 text-sm font-medium text-[#6B8187] dark:text-[#8DA8B0]">
                / {kegiatanList.length}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] tabular-nums dark:text-[#8DA8B0]">
            Event: {jenisCounts.eventCount} &middot; Monev: {jenisCounts.monevCount}
          </div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#9BB5BC]">
            Rencana Pendapatan
          </div>
          <div className="mt-1 text-base font-bold text-emerald-700 tabular-nums dark:text-emerald-400 sm:text-lg">
            {formatRupiah(totals.pendapatan)}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#8DA8B0]">
            Akumulasi filter aktif
          </div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#9BB5BC]">
            Rencana Belanja
          </div>
          <div className="mt-1 text-base font-bold text-[#9A6008] tabular-nums dark:text-[#F0B243] sm:text-lg">
            {formatRupiah(totals.belanja)}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#8DA8B0]">
            Akumulasi filter aktif
          </div>
        </div>
      </div>

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

      {/* Program Kerja Filter Tabs + Event/Monev Filter + Search */}
      <div className="mt-5 glass-surface space-y-3.5 p-4">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedProkerKode('ALL')}
            className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              selectedProkerKode === 'ALL'
                ? 'bg-[#07525E] text-white dark:bg-[#0C7A89]'
                : 'bg-white/80 text-[#3D575E] hover:bg-white dark:bg-[#0D2A33] dark:text-[#A9C2C9] dark:hover:bg-[#113540]'
            }`}
          >
            Semua Program ({kegiatanList.length})
          </button>

          {prokerList.map((proker) => {
            const count = prokerCounts.get(proker.kodeProker) || 0;
            const active = selectedProkerKode === proker.kodeProker;
            const shortUnit =
              unitCodeByProker.get(proker.kodeProker) || proker.unitPj || proker.kodeProker;
            return (
              <button
                key={proker.kodeProker}
                type="button"
                onClick={() => setSelectedProkerKode(proker.kodeProker)}
                title={`${proker.kodeProker} — ${proker.namaProker}`}
                className={`cursor-pointer rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#0C7A89] text-white'
                    : 'bg-white/80 text-[#3D575E] hover:bg-white dark:bg-[#0D2A33] dark:text-[#A9C2C9] dark:hover:bg-[#113540]'
                }`}
              >
                <span className="font-mono">{proker.kodeProker}</span> &middot;{' '}
                <span>{shortUnit}</span>{' '}
                <span className={active ? 'text-white/80' : 'text-[#6B8187] dark:text-[#7D9CA4]'}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Program Banner */}
        {selectedProkerKode !== 'ALL' && prokerMap.get(selectedProkerKode) && (
          <div className="rounded-xl border border-[#0C7A89]/15 bg-[#F4FAFB] px-3.5 py-2.5 text-xs text-[#355158] dark:border-[#3EC1D3]/20 dark:bg-[#0D2A33] dark:text-[#B4CCD3]">
            <span className="font-mono font-bold text-[#07525E] dark:text-[#3EC1D3]">
              Program {selectedProkerKode} ({unitCodeByProker.get(selectedProkerKode)}):
            </span>{' '}
            <span className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
              {prokerMap.get(selectedProkerKode)?.namaProker}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B8187] dark:text-[#8DA8B0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode, nama kegiatan, Event/Monev, tujuan, sasaran, tempat, atau waktu..."
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2.5 pr-4 pl-10 text-sm text-[#0F2429] placeholder:text-[#7D9197] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7] dark:placeholder:text-[#6D8B94] dark:focus:border-[#3EC1D3]"
            />
          </div>

          {/* Filter Event vs Monev */}
          <div
            role="group"
            aria-label="Filter sifat kegiatan Event atau Monev"
            className="inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#EBF5F8]/85 p-1 dark:bg-[#0D2A33]"
          >
            <button
              type="button"
              onClick={() => setSelectedJenis('ALL')}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedJenis === 'ALL'
                  ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                  : 'text-[#526A70] hover:text-[#07525E] dark:text-[#9BB5BC] dark:hover:text-[#E6F4F7]'
              }`}
            >
              Semua ({jenisCounts.total})
            </button>
            <button
              type="button"
              onClick={() => setSelectedJenis('Event')}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedJenis === 'Event'
                  ? 'bg-[#0C7A89] text-white shadow-xs'
                  : 'text-[#526A70] hover:text-[#0C7A89] dark:text-[#9BB5BC] dark:hover:text-[#3EC1D3]'
              }`}
            >
              Event ({jenisCounts.eventCount})
            </button>
            <button
              type="button"
              onClick={() => setSelectedJenis('Monev')}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedJenis === 'Monev'
                  ? 'bg-[#D88B15] text-white shadow-xs'
                  : 'text-[#526A70] hover:text-[#9A6008] dark:text-[#9BB5BC] dark:hover:text-[#F0B243]'
              }`}
            >
              Monev ({jenisCounts.monevCount})
            </button>
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'ALL' | KegiatanStatus)}
            aria-label="Filter status kegiatan"
            className="rounded-xl border border-[#07525E]/15 bg-white/90 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
          >
            <option value="ALL">Semua Status</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>

        <p className="text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
          {canToggleJenis ? (
            <>
              Cara ubah Event/Monev: klik langsung sakelar <strong>Event | Monev</strong> di kolom <strong>Kode &amp; Sifat</strong> pada setiap baris tabel{canEdit ? ' atau lewat tombol Edit (ikon pensil)' : ''}.
            </>
          ) : (
            <>
              Ingin mengubah klasifikasi <strong>Event / Monev</strong> tiap kegiatan? Klik <strong>Masuk Pengelola</strong> (Admin atau Super Admin) di kanan atas.
            </>
          )}
        </p>
      </div>

      {/* Main Table */}
      <div className="mt-5 glass-surface-strong overflow-hidden">
        {filteredKegiatan.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF5F8] text-[#0C7A89] dark:bg-[#113540] dark:text-[#3EC1D3]">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
              Tidak ada kegiatan ditemukan
            </h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[#526A70] dark:text-[#9BB5BC]">
              Ubah kata kunci pencarian, filter Event/Monev, atau pilih tab program kerja lain.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="duwd-zebra-table w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold tracking-wide text-[#355158] uppercase dark:border-[#3EC1D3]/15 dark:bg-[#0C2730] dark:text-[#9BB5BC]">
                  <th className="w-[152px] px-4 py-3.5">Kode &amp; Sifat</th>
                  <th className="w-[230px] px-4 py-3.5">Program &amp; Kegiatan</th>
                  <th className="w-[220px] px-4 py-3.5">Tujuan &amp; Sasaran</th>
                  <th className="w-[180px] px-4 py-3.5">Indikator</th>
                  <th className="w-[165px] px-4 py-3.5">Tempat &amp; Waktu</th>
                  <th className="w-[130px] px-4 py-3.5 text-right">Pendapatan</th>
                  <th className="w-[130px] px-4 py-3.5 text-right">Belanja</th>
                  <th className="w-[130px] px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#07525E]/8 text-xs dark:divide-[#3EC1D3]/10">
                {filteredKegiatan.map((item) => {
                  const jenis = resolveJenisKegiatan(item);
                  const pola = resolvePolaJadwal(item);
                  const isMonev = jenis === 'Monev';
                  const isToggling = togglingJenisKode === item.kodeKegiatan;

                  return (
                    <tr key={item.kodeKegiatan} className="align-top">
                      <td className="px-4 py-3.5">
                        <div className="font-mono font-bold text-[#07525E] dark:text-[#E6F4F7]">
                          {item.kodeKegiatan}
                        </div>
                        <div className="mt-1.5">
                          {canToggleJenis ? (
                            <div
                              role="group"
                              aria-label={`Pilih sifat kegiatan ${item.namaKegiatan}`}
                              className="inline-flex rounded-lg border border-[#07525E]/15 bg-[#F4FAFB] p-0.5 dark:border-[#3EC1D3]/20 dark:bg-[#081A20]"
                            >
                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={() => void handleSetJenis(item, 'Event')}
                                className={`cursor-pointer rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                                  !isMonev
                                    ? 'bg-[#0C7A89] text-white shadow-xs'
                                    : 'text-[#526A70] hover:text-[#0C7A89] dark:text-[#8DA8B0] dark:hover:text-[#3EC1D3]'
                                }`}
                              >
                                Event
                              </button>
                              <button
                                type="button"
                                disabled={isToggling}
                                onClick={() => void handleSetJenis(item, 'Monev')}
                                className={`cursor-pointer rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors disabled:opacity-50 ${
                                  isMonev
                                    ? 'bg-[#D88B15] text-white shadow-xs'
                                    : 'text-[#526A70] hover:text-[#9A6008] dark:text-[#8DA8B0] dark:hover:text-[#F0B243]'
                                }`}
                              >
                                Monev
                              </button>
                            </div>
                          ) : (
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                                isMonev
                                  ? 'border-[#D88B15]/35 bg-[#FFF6E5] text-[#9A6008] dark:border-[#F0B243]/35 dark:bg-[#2A2010] dark:text-[#F0B243]'
                                  : 'border-[#0C7A89]/30 bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3]/35 dark:bg-[#10323C] dark:text-[#3EC1D3]'
                              }`}
                            >
                              {jenis}
                            </span>
                          )}
                        </div>
                        <div className={`mt-1 text-[11px] ${getStatusTextClass(item.status)}`}>
                          {item.status || 'Rencana'}
                        </div>
                        {pola !== 'Tunggal' && (
                          <div className="mt-0.5 text-[10px] font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
                            Rutin: {pola === 'DwiPekanan' ? '2 Pekanan' : pola}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div
                          title={item.namaProker}
                          className="text-[11px] font-semibold text-[#0C7A89] dark:text-[#3EC1D3]"
                        >
                          <span className="font-mono">{item.kodeProker}</span> &middot;{' '}
                          {unitCodeByProker.get(item.kodeProker) || item.namaProker}
                        </div>
                        <div className="mt-1 text-[13px] font-bold leading-snug text-[#0F2429] dark:text-[#E6F4F7]">
                          {item.namaKegiatan}
                        </div>
                        {(item.unitPj || item.tautanDrive) && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#0C7A89] dark:text-[#3EC1D3]">
                            {item.unitPj && <span>PJ: {item.unitPj}</span>}
                            {item.tautanDrive && (
                              <a
                                href={item.tautanDrive}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 font-semibold hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span>Drive</span>
                              </a>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 leading-relaxed text-[#355158] dark:text-[#B4CCD3]">
                        <div>
                          <span className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                            Tujuan:
                          </span>{' '}
                          {item.tujuan}
                        </div>
                        <div className="mt-1.5">
                          <span className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                            Sasaran:
                          </span>{' '}
                          {item.sasaran}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 leading-relaxed text-[#355158] dark:text-[#B4CCD3]">
                        {item.indikator}
                      </td>

                      <td className="px-4 py-3.5 leading-relaxed text-[#355158] dark:text-[#B4CCD3]">
                        <div className="font-semibold text-[#0F2429] dark:text-[#E6F4F7]">
                          {item.tempat}
                        </div>
                        <div className="mt-1 text-[#526A70] dark:text-[#9BB5BC]">{item.waktu}</div>
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-semibold whitespace-nowrap text-emerald-700 tabular-nums dark:text-emerald-400">
                        {formatRupiah(item.pendapatan)}
                      </td>

                      <td className="px-4 py-3.5 text-right font-mono font-semibold whitespace-nowrap text-[#9A6008] tabular-nums dark:text-[#F0B243]">
                        {formatRupiah(item.belanja)}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDetailItem(item)}
                            title="Lihat detail lengkap"
                            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#07525E]/15 bg-white text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {canEdit && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditModal(item)}
                                title="Edit kegiatan"
                                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#07525E]/15 bg-white text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>

                              {confirmDeleteKode === item.kodeKegiatan ? (
                                <button
                                  type="button"
                                  onClick={() => void handleConfirmDelete(item.kodeKegiatan)}
                                  className="inline-flex h-8 cursor-pointer items-center rounded-lg bg-red-600 px-2.5 text-[11px] font-semibold text-white hover:bg-red-700"
                                >
                                  Hapus?
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKode(item.kodeKegiatan)}
                                  title="Hapus kegiatan"
                                  className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:bg-[#0D2B33] dark:text-red-400 dark:hover:bg-red-950/60"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="border-t border-[#07525E]/15 bg-[#F4FAFB] text-xs font-bold text-[#07525E] dark:border-[#3EC1D3]/20 dark:bg-[#0C2730] dark:text-[#E6F4F7]">
                  <td colSpan={5} className="px-4 py-3.5 text-right">
                    Total ({filteredKegiatan.length} Kegiatan):
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono whitespace-nowrap text-emerald-700 tabular-nums dark:text-emerald-400">
                    {formatRupiah(totals.pendapatan)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono whitespace-nowrap text-[#9A6008] tabular-nums dark:text-[#F0B243]">
                    {formatRupiah(totals.belanja)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Modal Detail Kegiatan */}
      {detailItem && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="detail-kegiatan-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072B31]/50 p-4 backdrop-blur-sm dark:bg-black/70"
        >
          <div className="glass-surface-strong relative max-h-[90vh] w-full max-w-2xl overflow-y-auto bg-white p-6 dark:bg-[#0B2229]">
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              aria-label="Tutup detail"
              className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-xs font-bold text-[#0C7A89] dark:text-[#3EC1D3]">
                {detailItem.kodeKegiatan} &middot; Program {detailItem.kodeProker}
              </p>
              {canToggleJenis ? (
                <div className="inline-flex rounded-lg border border-[#07525E]/15 bg-[#F4FAFB] p-0.5 dark:border-[#3EC1D3]/20 dark:bg-[#081A20]">
                  <button
                    type="button"
                    onClick={() => void handleSetJenis(detailItem, 'Event')}
                    className={`cursor-pointer rounded-md px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                      resolveJenisKegiatan(detailItem) === 'Event'
                        ? 'bg-[#0C7A89] text-white'
                        : 'text-[#526A70] hover:text-[#0C7A89] dark:text-[#8DA8B0]'
                    }`}
                  >
                    Event
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSetJenis(detailItem, 'Monev')}
                    className={`cursor-pointer rounded-md px-2.5 py-0.5 text-[11px] font-bold transition-colors ${
                      resolveJenisKegiatan(detailItem) === 'Monev'
                        ? 'bg-[#D88B15] text-white'
                        : 'text-[#526A70] hover:text-[#9A6008] dark:text-[#8DA8B0]'
                    }`}
                  >
                    Monev
                  </button>
                </div>
              ) : (
                <span
                  className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                    resolveJenisKegiatan(detailItem) === 'Monev'
                      ? 'border-[#D88B15]/35 bg-[#FFF6E5] text-[#9A6008] dark:border-[#F0B243]/35 dark:bg-[#2A2010] dark:text-[#F0B243]'
                      : 'border-[#0C7A89]/30 bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3]/35 dark:bg-[#10323C] dark:text-[#3EC1D3]'
                  }`}
                >
                  {resolveJenisKegiatan(detailItem)}
                </span>
              )}
            </div>
            <h2
              id="detail-kegiatan-title"
              className="mt-1.5 pr-8 text-lg font-bold text-[#07525E] dark:text-[#E6F4F7]"
            >
              {detailItem.namaKegiatan}
            </h2>
            <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#9BB5BC]">
              {detailItem.namaProker}
            </p>

            <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#3EC1D3]/15 dark:bg-[#0D2A33] sm:col-span-2">
                <div className="font-semibold text-[#07525E] dark:text-[#3EC1D3]">
                  Tujuan Kegiatan
                </div>
                <p className="mt-1 leading-relaxed text-[#355158] dark:text-[#D1E5EA]">
                  {detailItem.tujuan}
                </p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#3EC1D3]/15 dark:bg-[#0D2A33]">
                <div className="font-semibold text-[#07525E] dark:text-[#3EC1D3]">Sasaran</div>
                <p className="mt-1 leading-relaxed text-[#355158] dark:text-[#D1E5EA]">
                  {detailItem.sasaran}
                </p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#3EC1D3]/15 dark:bg-[#0D2A33]">
                <div className="font-semibold text-[#07525E] dark:text-[#3EC1D3]">
                  Indikator Kinerja
                </div>
                <p className="mt-1 leading-relaxed text-[#355158] dark:text-[#D1E5EA]">
                  {detailItem.indikator}
                </p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#3EC1D3]/15 dark:bg-[#0D2A33]">
                <div className="font-semibold text-[#07525E] dark:text-[#3EC1D3]">
                  Tempat Pelaksanaan
                </div>
                <p className="mt-1 text-[#355158] dark:text-[#D1E5EA]">{detailItem.tempat}</p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#3EC1D3]/15 dark:bg-[#0D2A33]">
                <div className="font-semibold text-[#07525E] dark:text-[#3EC1D3]">
                  Waktu Pelaksanaan
                </div>
                <p className="mt-1 text-[#355158] dark:text-[#D1E5EA]">{detailItem.waktu}</p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-[#ECF6F2] p-3.5 dark:border-emerald-400/20 dark:bg-emerald-950/40">
                <div className="font-semibold text-emerald-900 dark:text-emerald-300">
                  Rencana Pendapatan
                </div>
                <p className="mt-1 font-mono text-base font-bold text-emerald-700 tabular-nums dark:text-emerald-400">
                  {formatRupiah(detailItem.pendapatan)}
                </p>
              </div>

              <div className="rounded-xl border border-[#D88B15]/20 bg-[#FFF9EE] p-3.5 dark:border-[#F0B243]/25 dark:bg-[#2A2010]">
                <div className="font-semibold text-[#9A6008] dark:text-[#F0B243]">
                  Rencana Belanja
                </div>
                <p className="mt-1 font-mono text-base font-bold text-[#9A6008] tabular-nums dark:text-[#F0B243]">
                  {formatRupiah(detailItem.belanja)}
                </p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#3EC1D3]/15 dark:bg-[#0D2A33]">
                <div className="font-semibold text-[#07525E] dark:text-[#3EC1D3]">
                  Status &amp; Unit PJ
                </div>
                <p className="mt-1 text-[#355158] dark:text-[#D1E5EA]">
                  <span className={getStatusTextClass(detailItem.status)}>
                    {detailItem.status || 'Rencana'}
                  </span>
                  {' · '}
                  <span>{detailItem.unitPj || 'Belum ditentukan'}</span>
                </p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#3EC1D3]/15 dark:bg-[#0D2A33]">
                <div className="font-semibold text-[#07525E] dark:text-[#3EC1D3]">
                  Berkas Google Drive
                </div>
                {detailItem.tautanDrive ? (
                  <a
                    href={detailItem.tautanDrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#0C7A89] hover:underline dark:text-[#3EC1D3]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Buka Folder / Berkas Drive</span>
                  </a>
                ) : (
                  <p className="mt-1 text-[#6B8187] dark:text-[#8DA8B0]">Belum ditautkan</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    const target = detailItem;
                    setDetailItem(null);
                    openEditModal(target);
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/18 bg-white px-4 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span>Edit Kegiatan</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tambah / Edit Kegiatan */}
      {formOpen && canEdit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-kegiatan-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072B31]/50 p-4 backdrop-blur-sm dark:bg-black/70"
        >
          <div className="glass-surface-strong relative max-h-[92vh] w-full max-w-2xl overflow-y-auto bg-white p-6 dark:bg-[#0B2229]">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Tutup form"
              className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
            >
              <X className="h-4 w-4" />
            </button>

            <h2
              id="form-kegiatan-title"
              className="text-lg font-bold text-[#07525E] dark:text-[#E6F4F7]"
            >
              {isEditing ? 'Edit Kegiatan RPKA 2027' : 'Tambah Kegiatan RPKA 2027'}
            </h2>
            <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#9BB5BC]">
              Perubahan langsung tersinkron ke sheet <span className="font-mono">KEGIATAN_RPKA</span>.
            </p>

            <form onSubmit={handleSubmitForm} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Program Kerja *
                  </label>
                  <select
                    value={kodeProker}
                    onChange={(e) => handleProkerSelectChange(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  >
                    {prokerList.map((p) => (
                      <option key={p.kodeProker} value={p.kodeProker}>
                        {p.kodeProker} — {p.namaProker}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Kode Kegiatan *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={kodeKegiatan}
                    onChange={(e) => setKodeKegiatan(e.target.value)}
                    placeholder="10001.00001"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none disabled:bg-slate-100 dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7] dark:disabled:bg-[#0D2A33]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Nama Kegiatan *
                  </label>
                  <input
                    type="text"
                    required
                    value={namaKegiatan}
                    onChange={(e) => setNamaKegiatan(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Sifat Kegiatan *
                  </label>
                  <select
                    value={jenisKegiatan}
                    onChange={(e) => setJenisKegiatan(e.target.value as KegiatanJenis)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  >
                    {JENIS_OPTIONS.map((j) => (
                      <option key={j} value={j}>
                        {j}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Tujuan
                  </label>
                  <textarea
                    rows={3}
                    value={tujuan}
                    onChange={(e) => setTujuan(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Sasaran
                  </label>
                  <textarea
                    rows={3}
                    value={sasaran}
                    onChange={(e) => setSasaran(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Indikator Kinerja
                </label>
                <textarea
                  rows={2}
                  value={indikator}
                  onChange={(e) => setIndikator(e.target.value)}
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Tempat Pelaksanaan
                  </label>
                  <input
                    type="text"
                    value={tempat}
                    onChange={(e) => setTempat(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Waktu Pelaksanaan
                  </label>
                  <input
                    type="text"
                    value={waktu}
                    onChange={(e) => setWaktu(e.target.value)}
                    placeholder="Contoh: 2027-05-15 - 2027-05-17"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Pola Tanda Kalender
                  </label>
                  <select
                    value={polaJadwal}
                    onChange={(e) => setPolaJadwal(e.target.value as KegiatanPolaJadwal)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  >
                    {POLA_JADWAL_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Pendapatan (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pendapatanStr}
                    onChange={(e) => setPendapatanStr(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Belanja (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={belanjaStr}
                    onChange={(e) => setBelanjaStr(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Unit PJ
                  </label>
                  <select
                    value={unitPj}
                    onChange={(e) => setUnitPj(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  >
                    <option value="">-- Pilih Unit --</option>
                    {activeUnits
                      .filter((u) => u.urutan > 0)
                      .map((u) => (
                        <option key={u.id} value={u.kodeUnit}>
                          {u.kodeUnit}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as KegiatanStatus)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  >
                    {STATUS_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Tautan Google Drive Berkas Kegiatan (Opsional)
                </label>
                <input
                  type="url"
                  value={tautanDrive}
                  onChange={(e) => setTautanDrive(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:border-red-500/30 dark:bg-red-950/60 dark:text-red-300">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="cursor-pointer rounded-xl border border-[#07525E]/15 px-4 py-2 text-xs font-semibold text-[#526A70] hover:bg-white dark:border-[#3EC1D3]/25 dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{saving ? 'Menyimpan...' : 'Simpan Kegiatan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
