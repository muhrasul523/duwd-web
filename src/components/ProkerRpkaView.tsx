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
} from '../services/orgService';
import type {
  KegiatanRpkaItem,
  KegiatanStatus,
  ProgramKerjaItem,
  UnitItem,
  UserRole,
} from '../types/org';

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
      return 'text-emerald-700 font-semibold';
    case 'Berjalan':
      return 'text-[#0C7A89] font-semibold';
    default:
      return 'text-[#9A6008] font-semibold';
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

  const [selectedProkerKode, setSelectedProkerKode] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | KegiatanStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState('');

  // Modal Detail
  const [detailItem, setDetailItem] = useState<KegiatanRpkaItem | null>(null);

  // Modal Form Tambah / Edit
  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [kodeKegiatan, setKodeKegiatan] = useState('');
  const [kodeProker, setKodeProker] = useState('');
  const [namaKegiatan, setNamaKegiatan] = useState('');
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

  const filteredKegiatan = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return kegiatanList
      .filter((item) => {
        if (selectedProkerKode !== 'ALL' && item.kodeProker !== selectedProkerKode) {
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
  }, [kegiatanList, selectedProkerKode, selectedStatus, searchQuery]);

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
    <section className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 lg:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#0C7A89]">
            RPKA Tahun Anggaran 2027 &middot; Departemen Urusan Wilayah dan Daerah
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] sm:text-3xl">
            Program Kerja &amp; Kegiatan DUWD
          </h1>
          <p className="mt-1 text-sm text-[#526A70]">
            Rekap resmi 5 program kerja dan rincian kegiatan, indikator capaian, jadwal, serta rencana anggaran.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {rpkaDriveUrl.trim() && (
            <a
              href={rpkaDriveUrl.trim()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#D88B15]/30 bg-[#FFF9EE] px-3.5 py-2.5 text-xs font-semibold text-[#9A6008] transition-colors hover:bg-[#FEF1D8]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Dokumen PDF RPKA (Drive)</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white"
          >
            <Download className="h-3.5 w-3.5 text-[#0C7A89]" />
            <span>Unduh CSV</span>
          </button>

          {webAppUrl.trim() && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={syncing}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-60"
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
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70]">Program Kerja</div>
          <div className="mt-1 text-2xl font-bold text-[#07525E] tabular-nums">
            {prokerList.length}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187]">Program induk 2027</div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70]">Jumlah Kegiatan</div>
          <div className="mt-1 text-2xl font-bold text-[#0C7A89] tabular-nums">
            {filteredKegiatan.length}
            {filteredKegiatan.length !== kegiatanList.length && (
              <span className="ml-1 text-sm font-medium text-[#6B8187]">
                / {kegiatanList.length}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187]">Sesuai filter aktif</div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70]">Rencana Pendapatan</div>
          <div className="mt-1 text-base font-bold text-emerald-700 tabular-nums sm:text-lg">
            {formatRupiah(totals.pendapatan)}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187]">Akumulasi filter aktif</div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70]">Rencana Belanja</div>
          <div className="mt-1 text-base font-bold text-[#9A6008] tabular-nums sm:text-lg">
            {formatRupiah(totals.belanja)}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187]">Akumulasi filter aktif</div>
        </div>
      </div>

      {notice && (
        <div className="mt-4 rounded-xl border border-[#0C7A89]/25 bg-[#ECF6F2] px-4 py-2.5 text-xs font-medium text-[#07525E]">
          {notice}
        </div>
      )}

      {/* Program Kerja Filter Tabs + Search */}
      <div className="mt-5 glass-surface p-4 space-y-3.5">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedProkerKode('ALL')}
            className={`cursor-pointer rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors ${
              selectedProkerKode === 'ALL'
                ? 'bg-[#07525E] text-white'
                : 'bg-white/80 text-[#3D575E] hover:bg-white'
            }`}
          >
            Semua Program ({kegiatanList.length})
          </button>

          {prokerList.map((proker) => {
            const count = prokerCounts.get(proker.kodeProker) || 0;
            const active = selectedProkerKode === proker.kodeProker;
            const shortUnit = unitCodeByProker.get(proker.kodeProker) || proker.unitPj || proker.kodeProker;
            return (
              <button
                key={proker.kodeProker}
                type="button"
                onClick={() => setSelectedProkerKode(proker.kodeProker)}
                title={`${proker.kodeProker} — ${proker.namaProker}`}
                className={`cursor-pointer rounded-xl px-3.5 py-2 text-left text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-[#0C7A89] text-white'
                    : 'bg-white/80 text-[#3D575E] hover:bg-white'
                }`}
              >
                <span className="font-mono">{proker.kodeProker}</span> &middot;{' '}
                <span>{shortUnit}</span>{' '}
                <span className={active ? 'text-white/80' : 'text-[#6B8187]'}>
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Program Banner */}
        {selectedProkerKode !== 'ALL' && prokerMap.get(selectedProkerKode) && (
          <div className="rounded-xl border border-[#0C7A89]/15 bg-[#F4FAFB] px-3.5 py-2.5 text-xs text-[#355158]">
            <span className="font-mono font-bold text-[#07525E]">
              Program {selectedProkerKode} ({unitCodeByProker.get(selectedProkerKode)}):
            </span>{' '}
            <span className="font-semibold text-[#07525E]">
              {prokerMap.get(selectedProkerKode)?.namaProker}
            </span>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B8187]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode, nama kegiatan, tujuan, sasaran, tempat, atau waktu..."
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2.5 pr-4 pl-10 text-sm text-[#0F2429] placeholder:text-[#7D9197] focus:border-[#0C7A89] focus:outline-none"
            />
          </div>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as 'ALL' | KegiatanStatus)}
            aria-label="Filter status kegiatan"
            className="rounded-xl border border-[#07525E]/15 bg-white/90 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none"
          >
            <option value="ALL">Semua Status</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="mt-5 glass-surface-strong overflow-hidden">
        {filteredKegiatan.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF5F8] text-[#0C7A89]">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <h2 className="mt-3 text-base font-bold text-[#07525E]">
              Tidak ada kegiatan ditemukan
            </h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[#526A70]">
              Ubah kata kunci pencarian atau pilih tab program kerja lain.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold tracking-wide text-[#355158] uppercase">
                  <th className="px-4 py-3.5 w-[118px]">Kode</th>
                  <th className="px-4 py-3.5 w-[230px]">Program &amp; Kegiatan</th>
                  <th className="px-4 py-3.5 w-[220px]">Tujuan &amp; Sasaran</th>
                  <th className="px-4 py-3.5 w-[180px]">Indikator</th>
                  <th className="px-4 py-3.5 w-[160px]">Tempat &amp; Waktu</th>
                  <th className="px-4 py-3.5 text-right w-[130px]">Pendapatan</th>
                  <th className="px-4 py-3.5 text-right w-[130px]">Belanja</th>
                  <th className="px-4 py-3.5 text-right w-[130px]">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#07525E]/8 text-xs">
                {filteredKegiatan.map((item) => (
                  <tr
                    key={item.kodeKegiatan}
                    className="align-top transition-colors hover:bg-white/75"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-mono font-bold text-[#07525E]">
                        {item.kodeKegiatan}
                      </div>
                      <div className={`mt-1 text-[11px] ${getStatusTextClass(item.status)}`}>
                        {item.status || 'Rencana'}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div
                        title={item.namaProker}
                        className="text-[11px] font-semibold text-[#0C7A89]"
                      >
                        <span className="font-mono">{item.kodeProker}</span> &middot;{' '}
                        {unitCodeByProker.get(item.kodeProker) || item.namaProker}
                      </div>
                      <div className="mt-1 text-[13px] font-bold leading-snug text-[#0F2429]">
                        {item.namaKegiatan}
                      </div>
                      {(item.unitPj || item.tautanDrive) && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[#0C7A89]">
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

                    <td className="px-4 py-3.5 text-[#355158] leading-relaxed">
                      <div>
                        <span className="font-semibold text-[#07525E]">Tujuan:</span>{' '}
                        {item.tujuan}
                      </div>
                      <div className="mt-1.5">
                        <span className="font-semibold text-[#07525E]">Sasaran:</span>{' '}
                        {item.sasaran}
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-[#355158] leading-relaxed">
                      {item.indikator}
                    </td>

                    <td className="px-4 py-3.5 text-[#355158] leading-relaxed">
                      <div className="font-semibold text-[#0F2429]">{item.tempat}</div>
                      <div className="mt-1 text-[#526A70]">{item.waktu}</div>
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-emerald-700 tabular-nums whitespace-nowrap">
                      {formatRupiah(item.pendapatan)}
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-semibold text-[#9A6008] tabular-nums whitespace-nowrap">
                      {formatRupiah(item.belanja)}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailItem(item)}
                          title="Lihat detail lengkap"
                          className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#07525E]/15 bg-white text-[#07525E] hover:bg-[#EBF5F8]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title="Edit kegiatan"
                              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#07525E]/15 bg-white text-[#07525E] hover:bg-[#EBF5F8]"
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
                                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>

              <tfoot>
                <tr className="border-t border-[#07525E]/15 bg-[#F4FAFB] text-xs font-bold text-[#07525E]">
                  <td colSpan={5} className="px-4 py-3.5 text-right">
                    Total ({filteredKegiatan.length} Kegiatan):
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-emerald-700 tabular-nums whitespace-nowrap">
                    {formatRupiah(totals.pendapatan)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-mono text-[#9A6008] tabular-nums whitespace-nowrap">
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072B31]/45 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong relative max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              aria-label="Tutup detail"
              className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#526A70] hover:bg-[#EBF5F8]"
            >
              <X className="h-4 w-4" />
            </button>

            <p className="font-mono text-xs font-bold text-[#0C7A89]">
              {detailItem.kodeKegiatan} &middot; Program {detailItem.kodeProker}
            </p>
            <h2
              id="detail-kegiatan-title"
              className="mt-1 pr-8 text-lg font-bold text-[#07525E]"
            >
              {detailItem.namaKegiatan}
            </h2>
            <p className="mt-0.5 text-xs text-[#526A70]">{detailItem.namaProker}</p>

            <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 sm:col-span-2">
                <div className="font-semibold text-[#07525E]">Tujuan Kegiatan</div>
                <p className="mt-1 leading-relaxed text-[#355158]">{detailItem.tujuan}</p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5">
                <div className="font-semibold text-[#07525E]">Sasaran</div>
                <p className="mt-1 leading-relaxed text-[#355158]">{detailItem.sasaran}</p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5">
                <div className="font-semibold text-[#07525E]">Indikator Kinerja</div>
                <p className="mt-1 leading-relaxed text-[#355158]">{detailItem.indikator}</p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5">
                <div className="font-semibold text-[#07525E]">Tempat Pelaksanaan</div>
                <p className="mt-1 text-[#355158]">{detailItem.tempat}</p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5">
                <div className="font-semibold text-[#07525E]">Waktu Pelaksanaan</div>
                <p className="mt-1 text-[#355158]">{detailItem.waktu}</p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-[#ECF6F2] p-3.5">
                <div className="font-semibold text-emerald-900">Rencana Pendapatan</div>
                <p className="mt-1 font-mono text-base font-bold text-emerald-700 tabular-nums">
                  {formatRupiah(detailItem.pendapatan)}
                </p>
              </div>

              <div className="rounded-xl border border-[#D88B15]/20 bg-[#FFF9EE] p-3.5">
                <div className="font-semibold text-[#9A6008]">Rencana Belanja</div>
                <p className="mt-1 font-mono text-base font-bold text-[#9A6008] tabular-nums">
                  {formatRupiah(detailItem.belanja)}
                </p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5">
                <div className="font-semibold text-[#07525E]">Status &amp; Unit PJ</div>
                <p className="mt-1 text-[#355158]">
                  <span className={getStatusTextClass(detailItem.status)}>
                    {detailItem.status || 'Rencana'}
                  </span>
                  {' · '}
                  <span>{detailItem.unitPj || 'Belum ditentukan'}</span>
                </p>
              </div>

              <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5">
                <div className="font-semibold text-[#07525E]">Berkas Google Drive</div>
                {detailItem.tautanDrive ? (
                  <a
                    href={detailItem.tautanDrive}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1.5 font-semibold text-[#0C7A89] hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>Buka Folder / Berkas Drive</span>
                  </a>
                ) : (
                  <p className="mt-1 text-[#6B8187]">Belum ditautkan</p>
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
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/18 bg-white px-4 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8]"
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

      {/* Modal Tambah / Edit Kegiatan (Admin & Super Admin) */}
      {formOpen && canEdit && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="form-kegiatan-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072B31]/45 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong relative max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              aria-label="Tutup form"
              className="absolute top-4 right-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[#526A70] hover:bg-[#EBF5F8]"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 id="form-kegiatan-title" className="text-lg font-bold text-[#07525E]">
              {isEditing ? 'Edit Kegiatan RPKA 2027' : 'Tambah Kegiatan RPKA 2027'}
            </h2>
            <p className="mt-0.5 text-xs text-[#526A70]">
              Perubahan langsung tersinkron ke sheet <span className="font-mono">KEGIATAN_RPKA</span>.
            </p>

            <form onSubmit={handleSubmitForm} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Program Kerja *
                  </label>
                  <select
                    value={kodeProker}
                    onChange={(e) => handleProkerSelectChange(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  >
                    {prokerList.map((p) => (
                      <option key={p.kodeProker} value={p.kodeProker}>
                        {p.kodeProker} — {p.namaProker}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Kode Kegiatan *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isEditing}
                    value={kodeKegiatan}
                    onChange={(e) => setKodeKegiatan(e.target.value)}
                    placeholder="10001.00001"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] disabled:bg-slate-100 focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158]">
                  Nama Kegiatan *
                </label>
                <input
                  type="text"
                  required
                  value={namaKegiatan}
                  onChange={(e) => setNamaKegiatan(e.target.value)}
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Tujuan
                  </label>
                  <textarea
                    rows={3}
                    value={tujuan}
                    onChange={(e) => setTujuan(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Sasaran
                  </label>
                  <textarea
                    rows={3}
                    value={sasaran}
                    onChange={(e) => setSasaran(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158]">
                  Indikator Kinerja
                </label>
                <textarea
                  rows={2}
                  value={indikator}
                  onChange={(e) => setIndikator(e.target.value)}
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Tempat Pelaksanaan
                  </label>
                  <input
                    type="text"
                    value={tempat}
                    onChange={(e) => setTempat(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Waktu Pelaksanaan
                  </label>
                  <input
                    type="text"
                    value={waktu}
                    onChange={(e) => setWaktu(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Pendapatan (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pendapatanStr}
                    onChange={(e) => setPendapatanStr(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Belanja (Rp)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={belanjaStr}
                    onChange={(e) => setBelanjaStr(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Unit PJ
                  </label>
                  <select
                    value={unitPj}
                    onChange={(e) => setUnitPj(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
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
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as KegiatanStatus)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
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
                <label className="mb-1 block text-xs font-semibold text-[#355158]">
                  Tautan Google Drive Berkas Kegiatan (Opsional)
                </label>
                <input
                  type="url"
                  value={tautanDrive}
                  onChange={(e) => setTautanDrive(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              {formError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {formError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="cursor-pointer rounded-xl border border-[#07525E]/15 px-4 py-2 text-xs font-semibold text-[#526A70] hover:bg-white"
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
