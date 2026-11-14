import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { saveAgenda4MItem } from '../services/gasClient';
import type {
  Agenda4MItem,
  Agenda4MStatus,
  Agenda4MType,
  CadreLevelRecord,
  ConsolidationStatus,
  RegionRecord,
} from '../types/duwd';

export type GovernanceTab = '4m' | 'wilayah' | 'kader';

interface GovernanceWorkspaceProps {
  activeTab: GovernanceTab;
  onChangeTab: (tab: GovernanceTab) => void;
  regions: RegionRecord[];
  agendas: Agenda4MItem[];
  onAddAgenda: (item: Agenda4MItem) => void;
  cadres: CadreLevelRecord[];
}

const JENIS_4M_OPTIONS: ('Semua' | Agenda4MType)[] = [
  'Semua',
  'Muswil',
  'Mukerwil',
  'Musda',
  'Mukerda',
];

const CONSOLIDATION_FILTERS: ('Semua' | ConsolidationStatus)[] = [
  'Semua',
  'Terkonsolidasi',
  'Pendampingan',
  'Pembentukan',
];

export function GovernanceWorkspace({
  activeTab,
  onChangeTab,
  regions,
  agendas,
  onAddAgenda,
  cadres,
}: GovernanceWorkspaceProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [jenisFilter, setJenisFilter] = useState<'Semua' | Agenda4MType>('Semua');
  const [regionStatusFilter, setRegionStatusFilter] = useState<'Semua' | ConsolidationStatus>('Semua');
  const [showAddAgenda, setShowAddAgenda] = useState(false);
  const [savingAgenda, setSavingAgenda] = useState(false);
  const [agendaNotice, setAgendaNotice] = useState('');

  // Form Tambah Agenda 4M
  const [newJenis, setNewJenis] = useState<Agenda4MType>('Muswil');
  const [newJudul, setNewJudul] = useState('');
  const [newWilayah, setNewWilayah] = useState('DPW Sulawesi Selatan');
  const [newTanggal, setNewTanggal] = useState('2026-12-20');
  const [newLokasi, setNewLokasi] = useState('');
  const [newStatus, setNewStatus] = useState<Agenda4MStatus>('Persiapan');
  const [newProgres, setNewProgres] = useState(50);
  const [newSkUrl, setNewSkUrl] = useState('');

  const filteredAgendas = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return agendas.filter((item) => {
      if (jenisFilter !== 'Semua' && item.jenis !== jenisFilter) return false;
      if (q) {
        const text = `${item.judul} ${item.wilayah} ${item.lokasi} ${item.jenis}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [agendas, jenisFilter, searchQuery]);

  const filteredRegions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return regions.filter((reg) => {
      if (regionStatusFilter !== 'Semua' && reg.statusKonsolidasi !== regionStatusFilter) {
        return false;
      }
      if (q) {
        const text = `${reg.namaDpw} ${reg.ketuaDpw} ${reg.kodeDpw}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [regions, regionStatusFilter, searchQuery]);

  const filteredCadres = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cadres.filter((c) => {
      if (!q) return true;
      return `${c.namaDpw} ${c.kodeDpw}`.toLowerCase().includes(q);
    });
  }, [cadres, searchQuery]);

  const cadreTotals = useMemo(() => {
    return filteredCadres.reduce(
      (acc, row) => ({
        tarif: acc.tarif + row.tarif,
        takwin: acc.takwin + row.takwin,
        tanfidz: acc.tanfidz + row.tanfidz,
        murabbi: acc.murabbi + row.murabbi,
        totalAktif: acc.totalAktif + row.totalAktif,
      }),
      { tarif: 0, takwin: 0, tanfidz: 0, murabbi: 0, totalAktif: 0 },
    );
  }, [filteredCadres]);

  const handleCreateAgenda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newJudul.trim() || !newLokasi.trim()) return;

    setSavingAgenda(true);
    setAgendaNotice('');
    try {
      const result = await saveAgenda4MItem({
        jenis: newJenis,
        judul: newJudul.trim(),
        wilayah: newWilayah,
        tanggalPelaksanaan: newTanggal,
        lokasi: newLokasi.trim(),
        status: newStatus,
        progresPersen: Number(newProgres),
        skDriveUrl: newSkUrl.trim() || undefined,
      });
      onAddAgenda(result.agenda);
      setAgendaNotice(
        result.syncedToGas
          ? 'Agenda 4M berhasil disimpan ke Google Sheets.'
          : 'Agenda 4M ditambahkan ke sesi aktif (siap disinkronkan saat GAS terhubung).',
      );
      setNewJudul('');
      setNewLokasi('');
      setNewSkUrl('');
      setShowAddAgenda(false);
    } finally {
      setSavingAgenda(false);
    }
  };

  return (
    <section id="tata-kelola" className="px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-[1200px]">
        {/* Section Header + Segmented Controls */}
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-[13px] font-semibold text-[#0C7A89]">
              Konsol Operasional &amp; Monitoring
            </p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] sm:text-3xl">
              Pusat Data Wilayah, 4M, dan Levelisasi Kader
            </h2>
          </div>

          <div
            role="tablist"
            aria-label="Modul Tata Kelola"
            className="inline-flex flex-wrap items-center gap-1 rounded-2xl border border-[#07525E]/12 bg-white/75 p-1.5 backdrop-blur-md"
          >
            {[
              { id: '4m' as const, label: 'Manajemen 4M' },
              { id: 'wilayah' as const, label: 'Akselerasi DPW & DPD' },
              { id: 'kader' as const, label: 'Levelisasi Kader' },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => onChangeTab(tab.id)}
                  className={`cursor-pointer whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-150 sm:text-[13px] ${
                    active
                      ? 'bg-[#07525E] text-white shadow-sm'
                      : 'text-[#3D575E] hover:bg-[#EBF5F8] hover:text-[#07525E]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Frosted Glass Console Container */}
        <div className="mt-6 glass-surface-strong overflow-hidden">
          {/* Toolbar */}
          <div className="flex flex-col justify-between gap-4 border-b border-[#07525E]/10 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#526A70]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  activeTab === '4m'
                    ? 'Cari agenda Muswil, Musda, lokasi...'
                    : activeTab === 'wilayah'
                      ? 'Cari DPW atau nama ketua...'
                      : 'Cari DPW levelisasi kader...'
                }
                className="w-full rounded-xl border border-[#07525E]/15 bg-white/85 py-2 pr-3.5 pl-10 text-sm text-[#0F2429] placeholder:text-[#738A90] focus:border-[#0C7A89] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeTab === '4m' && (
                <>
                  <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#EBF5F8]/80 p-1">
                    {JENIS_4M_OPTIONS.map((jenis) => (
                      <button
                        key={jenis}
                        type="button"
                        onClick={() => setJenisFilter(jenis)}
                        className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                          jenisFilter === jenis
                            ? 'bg-white text-[#07525E] shadow-xs'
                            : 'text-[#526A70] hover:text-[#07525E]'
                        }`}
                      >
                        {jenis}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddAgenda((prev) => !prev)}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-[#0C7A89] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#07525E]"
                  >
                    {showAddAgenda ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    <span>{showAddAgenda ? 'Tutup Form' : 'Tambah Agenda 4M'}</span>
                  </button>
                </>
              )}

              {activeTab === 'wilayah' && (
                <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#EBF5F8]/80 p-1">
                  {CONSOLIDATION_FILTERS.map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setRegionStatusFilter(st)}
                      className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        regionStatusFilter === st
                          ? 'bg-white text-[#07525E] shadow-xs'
                          : 'text-[#526A70] hover:text-[#07525E]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === 'kader' && (
                <span className="text-xs font-medium text-[#526A70] tabular-nums">
                  {filteredCadres.length} DPW Tercatat · Pembaruan Berkala
                </span>
              )}
            </div>
          </div>

          {agendaNotice && (
            <div className="border-b border-[#0C7A89]/15 bg-[#ECF6F2] px-6 py-3 text-xs font-medium text-[#07525E]">
              {agendaNotice}
            </div>
          )}

          {/* Drawer Tambah Agenda 4M */}
          {activeTab === '4m' && showAddAgenda && (
            <form
              onSubmit={handleCreateAgenda}
              className="border-b border-[#07525E]/10 bg-[#F4FAFB] px-5 py-5 sm:px-6"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#07525E]">
                  Input Jadwal 4M Baru (Terhubung ke Sheet AGENDA_4M)
                </h3>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                    Jenis Agenda
                  </label>
                  <select
                    value={newJenis}
                    onChange={(e) => setNewJenis(e.target.value as Agenda4MType)}
                    className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  >
                    <option value="Muswil">Muswil</option>
                    <option value="Mukerwil">Mukerwil</option>
                    <option value="Musda">Musda</option>
                    <option value="Mukerda">Mukerda</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                    Wilayah / DPW
                  </label>
                  <select
                    value={newWilayah}
                    onChange={(e) => setNewWilayah(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  >
                    {regions.map((r) => (
                      <option key={r.kodeDpw} value={r.namaDpw}>
                        {r.namaDpw}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                    Tanggal Pelaksanaan
                  </label>
                  <input
                    type="date"
                    required
                    value={newTanggal}
                    onChange={(e) => setNewTanggal(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                    Status &amp; Progres (%)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as Agenda4MStatus)}
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white px-2.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                    >
                      <option value="Persiapan">Persiapan</option>
                      <option value="Terjadwal">Terjadwal</option>
                      <option value="Terlaksana">Terlaksana</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={newProgres}
                      onChange={(e) => setNewProgres(Number(e.target.value))}
                      className="w-20 rounded-xl border border-[#07525E]/15 bg-white px-2.5 py-2 text-sm text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                    Nama Kegiatan 4M
                  </label>
                  <input
                    type="text"
                    required
                    value={newJudul}
                    onChange={(e) => setNewJudul(e.target.value)}
                    placeholder="Contoh: Musyawarah Daerah IV DPD Kota Makassar"
                    className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                    Lokasi / Format
                  </label>
                  <input
                    type="text"
                    required
                    value={newLokasi}
                    onChange={(e) => setNewLokasi(e.target.value)}
                    placeholder="Gedung / Hibrid"
                    className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                    Link SK Google Drive (Opsional)
                  </label>
                  <input
                    type="url"
                    value={newSkUrl}
                    onChange={(e) => setNewSkUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddAgenda(false)}
                  className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-[#526A70] hover:bg-white"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAgenda}
                  className="cursor-pointer rounded-xl bg-[#07525E] px-5 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
                >
                  {savingAgenda ? 'Menyimpan...' : 'Simpan Agenda 4M'}
                </button>
              </div>
            </form>
          )}

          {/* TAB 1: MANAJEMEN 4M */}
          {activeTab === '4m' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#07525E]/10 bg-[#F8FBFC] text-xs font-semibold text-[#526A70]">
                    <th className="px-6 py-3.5">Kegiatan &amp; Jenis</th>
                    <th className="px-4 py-3.5">Wilayah</th>
                    <th className="px-4 py-3.5">Tanggal</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Kesiapan</th>
                    <th className="px-6 py-3.5 text-right">Berkas SK</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#07525E]/8">
                  {filteredAgendas.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-sm text-[#526A70]">
                        Tidak ada agenda 4M yang sesuai dengan kata kunci pencarian.
                      </td>
                    </tr>
                  ) : (
                    filteredAgendas.map((item) => (
                      <tr
                        key={item.id}
                        className="transition-colors hover:bg-[#EBF5F8]/45"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[#0F2429]">{item.judul}</div>
                          <div className="mt-0.5 text-xs text-[#526A70]">
                            <span>{item.jenis}</span>
                            <span aria-hidden="true" className="mx-1.5">·</span>
                            <span>{item.lokasi}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[13px] font-medium text-[#355158]">
                          {item.wilayah}
                        </td>
                        <td className="px-4 py-4 text-[13px] text-[#355158] tabular-nums whitespace-nowrap">
                          {item.tanggalPelaksanaan}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#07525E]">
                            {item.status === 'Terlaksana' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                            ) : item.status === 'Terjadwal' ? (
                              <ShieldCheck className="h-3.5 w-3.5 text-[#0C7A89]" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 text-[#D88B15]" />
                            )}
                            <span>{item.status}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums">
                          <div className="inline-flex items-center gap-2">
                            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#07525E]/10">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#0C7A89] to-[#D88B15]"
                                style={{ width: `${Math.min(100, item.progresPersen)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-[#07525E]">
                              {item.progresPersen}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {item.skDriveUrl ? (
                            <a
                              href={item.skDriveUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0C7A89] hover:text-[#07525E] hover:underline"
                            >
                              <span>Buka SK</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-xs text-[#738A90]">Belum ada</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 2: AKSELERASI DPW & DPD */}
          {activeTab === 'wilayah' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#07525E]/10 bg-[#F8FBFC] text-xs font-semibold text-[#526A70]">
                    <th className="px-6 py-3.5">Wilayah (DPW)</th>
                    <th className="px-4 py-3.5">Ketua DPW</th>
                    <th className="px-4 py-3.5 text-right">Jumlah DPD</th>
                    <th className="px-4 py-3.5">Status Konsolidasi</th>
                    <th className="px-6 py-3.5 text-right">Kesiapan 4M</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#07525E]/8">
                  {filteredRegions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-[#526A70]">
                        Tidak ditemukan data wilayah yang cocok.
                      </td>
                    </tr>
                  ) : (
                    filteredRegions.map((reg) => (
                      <tr
                        key={reg.kodeDpw}
                        className="transition-colors hover:bg-[#EBF5F8]/45"
                      >
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[#0F2429]">{reg.namaDpw}</div>
                          <div className="mt-0.5 text-xs text-[#526A70]">
                            <span className="font-mono">{reg.kodeDpw}</span>
                            <span aria-hidden="true" className="mx-1.5">·</span>
                            <span>{reg.kontakSekretariat}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-[13px] text-[#355158]">
                          {reg.ketuaDpw}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-[#07525E] tabular-nums">
                          {reg.jumlahDpd} DPD
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#07525E]">
                            {reg.statusKonsolidasi === 'Terkonsolidasi' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                            ) : reg.statusKonsolidasi === 'Pendampingan' ? (
                              <Clock className="h-3.5 w-3.5 text-[#D88B15]" />
                            ) : (
                              <ShieldCheck className="h-3.5 w-3.5 text-[#0C7A89]" />
                            )}
                            <span>{reg.statusKonsolidasi}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-[#07525E] tabular-nums">
                          {reg.kesiapan4MPersen}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 3: LEVELISASI KADER */}
          {activeTab === 'kader' && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#07525E]/10 bg-[#F8FBFC] text-xs font-semibold text-[#526A70]">
                    <th className="px-6 py-3.5">Wilayah (DPW)</th>
                    <th className="px-4 py-3.5 text-right">Ta&apos;rif</th>
                    <th className="px-4 py-3.5 text-right">Takwin</th>
                    <th className="px-4 py-3.5 text-right">Tanfidz</th>
                    <th className="px-4 py-3.5 text-right">Murabbi</th>
                    <th className="px-6 py-3.5 text-right">Total Aktif</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#07525E]/8">
                  {filteredCadres.map((row) => (
                    <tr
                      key={row.kodeDpw}
                      className="transition-colors hover:bg-[#EBF5F8]/45"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-[#0F2429]">{row.namaDpw}</div>
                        <div className="mt-0.5 text-xs text-[#526A70]">
                          <span className="font-mono">{row.kodeDpw}</span>
                          <span aria-hidden="true" className="mx-1.5">·</span>
                          <span>Update {row.periodeUpdate}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-[13px] text-[#355158] tabular-nums">
                        {row.tarif.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-[13px] text-[#355158] tabular-nums">
                        {row.takwin.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-[13px] text-[#355158] tabular-nums">
                        {row.tanfidz.toLocaleString('id-ID')}
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-[13px] text-[#355158] tabular-nums">
                        {row.murabbi.toLocaleString('id-ID')}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[13px] font-bold text-[#07525E] tabular-nums">
                        {row.totalAktif.toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#07525E]/15 bg-[#F2F8FA] font-bold text-[#07525E]">
                    <td className="px-6 py-3.5 text-xs uppercase tracking-wide">
                      Total Sampel Terpantau
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      {cadreTotals.tarif.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      {cadreTotals.takwin.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      {cadreTotals.tanfidz.toLocaleString('id-ID')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      {cadreTotals.murabbi.toLocaleString('id-ID')}
                    </td>
                    <td className="px-6 py-3.5 text-right font-mono text-sm tabular-nums">
                      {cadreTotals.totalAktif.toLocaleString('id-ID')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
