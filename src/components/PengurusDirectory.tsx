import {
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  deletePengurusRecord,
  savePengurusRecord,
} from '../services/orgService';
import type { PengurusItem, UnitItem, UserRole } from '../types/org';
import {
  buildWhatsAppLink,
  isValidWhatsApp,
  normalizeWhatsApp,
} from '../utils/whatsapp';

interface PengurusDirectoryProps {
  role: UserRole;
  activePin: string;
  webAppUrl: string;
  units: UnitItem[];
  pengurusList: PengurusItem[];
  syncing: boolean;
  onRefresh: () => void;
  onSaveSuccess: (item: PengurusItem) => void;
  onDeleteSuccess: (id: string) => void;
}

const PI_AMANAH_PRESETS = [
  'Ketua',
  'Wakil Ketua',
  'Sekretaris',
  'Wakil Sekretaris',
  'Bendahara',
  'Wakil Bendahara',
];

const UNIT_AMANAH_PRESETS = ['Ketua', 'Sekretaris', 'Anggota'];

const AMANAH_ORDER: Record<string, number> = {
  ketua: 1,
  'wakil ketua': 2,
  sekretaris: 3,
  'wakil sekretaris': 4,
  bendahara: 5,
  'wakil bendahara': 6,
  anggota: 7,
};

function isPiUnit(unit?: UnitItem): boolean {
  if (!unit) return false;
  const code = unit.kodeUnit.trim().toUpperCase();
  const name = unit.namaUnit.trim().toLowerCase();
  return code === 'PI' || name.includes('pengurus inti');
}

export function PengurusDirectory({
  role,
  activePin,
  webAppUrl,
  units,
  pengurusList,
  syncing,
  onRefresh,
  onSaveSuccess,
  onDeleteSuccess,
}: PengurusDirectoryProps) {
  const canEdit = role === 'admin' || role === 'superadmin';
  const activeUnits = useMemo(
    () => units.filter((u) => u.aktif).sort((a, b) => a.urutan - b.urutan),
    [units],
  );

  const [selectedUnitId, setSelectedUnitId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal Form Tambah / Edit Pengurus
  const [formOpen, setFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PengurusItem | null>(null);
  const [namaLengkap, setNamaLengkap] = useState('');
  const [namaPanggilan, setNamaPanggilan] = useState('');
  const [waRaw, setWaRaw] = useState('');
  const [unitId, setUnitId] = useState('');
  const [amanahSelect, setAmanahSelect] = useState('Ketua');
  const [amanahCustom, setAmanahCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const normalizedWaPreview = useMemo(() => normalizeWhatsApp(waRaw), [waRaw]);

  const selectedUnitObj = useMemo(
    () => units.find((u) => u.id === unitId),
    [units, unitId],
  );

  const amanahPresets = useMemo(
    () => (isPiUnit(selectedUnitObj) ? PI_AMANAH_PRESETS : UNIT_AMANAH_PRESETS),
    [selectedUnitObj],
  );

  const filteredPengurus = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const unitOrderMap = new Map<string, number>();
    units.forEach((u) => unitOrderMap.set(u.id, u.urutan));

    return pengurusList
      .filter((item) => {
        if (selectedUnitId !== 'ALL' && item.unitId !== selectedUnitId) {
          return false;
        }
        if (q) {
          const text = `${item.namaLengkap} ${item.namaPanggilan} ${item.namaUnit} ${item.amanah || ''} ${item.whatsapp}`.toLowerCase();
          if (!text.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const uA = unitOrderMap.get(a.unitId) ?? 999;
        const uB = unitOrderMap.get(b.unitId) ?? 999;
        if (uA !== uB) return uA - uB;
        const amA = AMANAH_ORDER[(a.amanah || '').trim().toLowerCase()] ?? 99;
        const amB = AMANAH_ORDER[(b.amanah || '').trim().toLowerCase()] ?? 99;
        if (amA !== amB) return amA - amB;
        return a.namaLengkap.localeCompare(b.namaLengkap, 'id');
      });
  }, [pengurusList, units, selectedUnitId, searchQuery]);

  const openCreateForm = () => {
    const defaultUnit = activeUnits[0];
    const presets = isPiUnit(defaultUnit) ? PI_AMANAH_PRESETS : UNIT_AMANAH_PRESETS;
    setEditingItem(null);
    setNamaLengkap('');
    setNamaPanggilan('');
    setWaRaw('');
    setUnitId(defaultUnit?.id || '');
    setAmanahSelect(presets[0]);
    setAmanahCustom('');
    setFormError('');
    setFormOpen(true);
  };

  const openEditForm = (item: PengurusItem) => {
    const targetUnit = units.find((u) => u.id === item.unitId) || activeUnits[0];
    const presets = isPiUnit(targetUnit) ? PI_AMANAH_PRESETS : UNIT_AMANAH_PRESETS;
    const currentAmanah = (item.amanah || '').trim();
    const isPreset = presets.includes(currentAmanah);

    setEditingItem(item);
    setNamaLengkap(item.namaLengkap);
    setNamaPanggilan(item.namaPanggilan);
    setWaRaw(item.whatsapp);
    setUnitId(targetUnit?.id || '');
    if (isPreset) {
      setAmanahSelect(currentAmanah);
      setAmanahCustom('');
    } else if (currentAmanah) {
      setAmanahSelect('LAINNYA');
      setAmanahCustom(currentAmanah);
    } else {
      setAmanahSelect(presets[0]);
      setAmanahCustom('');
    }
    setFormError('');
    setFormOpen(true);
  };

  const handleUnitChangeInForm = (nextUnitId: string) => {
    setUnitId(nextUnitId);
    const nextUnit = units.find((u) => u.id === nextUnitId);
    const nextPresets = isPiUnit(nextUnit) ? PI_AMANAH_PRESETS : UNIT_AMANAH_PRESETS;
    if (amanahSelect !== 'LAINNYA' && !nextPresets.includes(amanahSelect)) {
      setAmanahSelect(nextPresets[0]);
    }
  };

  const handleWaInputChange = (val: string) => {
    // Jika user mengetik atau paste diawali 08, langsung tampilkan normalisasi 628 secara halus
    if (val.startsWith('08')) {
      setWaRaw(`628${val.slice(2)}`);
      return;
    }
    setWaRaw(val);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (namaLengkap.trim().length < 2) {
      setFormError('Nama lengkap wajib diisi.');
      return;
    }
    if (namaPanggilan.trim().length < 2) {
      setFormError('Nama panggilan wajib diisi.');
      return;
    }
    const finalWa = normalizeWhatsApp(waRaw);
    if (!isValidWhatsApp(finalWa)) {
      setFormError('Masukkan nomor WhatsApp yang valid (contoh: 081234567890 atau 6281234567890).');
      return;
    }
    const chosenUnit = units.find((u) => u.id === unitId);
    if (!chosenUnit) {
      setFormError('Pilih unit kepengurusan terlebih dahulu.');
      return;
    }
    const finalAmanah =
      amanahSelect === 'LAINNYA' ? amanahCustom.trim() : amanahSelect.trim();
    if (!finalAmanah) {
      setFormError('Pilih atau tuliskan amanah kepengurusan.');
      return;
    }

    setSaving(true);
    try {
      const res = await savePengurusRecord(
        {
          id: editingItem?.id,
          namaLengkap: namaLengkap.trim(),
          namaPanggilan: namaPanggilan.trim(),
          whatsapp: finalWa,
          unitId: chosenUnit.id,
          namaUnit: chosenUnit.namaUnit,
          amanah: finalAmanah,
          dibuatPada: editingItem?.dibuatPada,
        },
        activePin,
        webAppUrl,
      );

      if (res.ok && res.item) {
        onSaveSuccess(res.item);
        setNotice(
          res.synced
            ? `Data "${res.item.namaLengkap}" tersimpan ke Google Spreadsheet.`
            : `Data "${res.item.namaLengkap}" tersimpan di sesi lokal (hubungkan Web App GAS untuk simpan permanen ke Spreadsheet).`,
        );
        setFormOpen(false);
      } else {
        setFormError(res.error || 'Gagal menyimpan data pengurus.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deletePengurusRecord(id, activePin, webAppUrl);
    if (res.ok) {
      onDeleteSuccess(id);
      setConfirmDeleteId(null);
      setNotice(
        res.synced
          ? 'Data pengurus dihapus dari Google Spreadsheet.'
          : 'Data pengurus dihapus dari daftar lokal.',
      );
    } else {
      setNotice(res.error || 'Gagal menghapus data.');
    }
  };

  return (
    <section className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 lg:py-10">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold text-[#0C7A89]">
            Departemen Urusan Wilayah dan Daerah · DPP Wahdah Islamiyah
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] sm:text-3xl">
            Daftar Pengurus Internal DUWD
          </h1>
          <p className="mt-1.5 text-xs font-medium text-[#526A70] tabular-nums">
            <span>{pengurusList.length} Pengurus Terdata</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span>{activeUnits.length} Unit Aktif</span>
            <span aria-hidden="true" className="mx-2">·</span>
            <span>
              Mode Akses:{' '}
              {role === 'superadmin'
                ? 'Super Admin'
                : role === 'admin'
                  ? 'Admin Pengurus'
                  : 'Publik'}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {webAppUrl && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={syncing}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Memuat...' : 'Sinkronkan Sheet'}</span>
            </button>
          )}

          {canEdit && (
            <button
              type="button"
              onClick={openCreateForm}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Tambah Pengurus</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#0C7A89]/20 bg-[#ECF6F2] px-4 py-2.5 text-xs font-medium text-[#07525E]">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice('')}
            className="cursor-pointer text-[#526A70] hover:text-[#07525E]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search & Unit Filter Bar */}
      <div className="mt-6 glass-surface-strong overflow-hidden">
        <div className="flex flex-col justify-between gap-3 border-b border-[#07525E]/10 px-5 py-4 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#526A70]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, panggilan, unit, amanah, WA..."
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2 pr-3.5 pl-10 text-sm text-[#0F2429] placeholder:text-[#738A90] focus:border-[#0C7A89] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-xl bg-[#EBF5F8]/80 p-1">
            <button
              type="button"
              onClick={() => setSelectedUnitId('ALL')}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedUnitId === 'ALL'
                  ? 'bg-white text-[#07525E] shadow-xs'
                  : 'text-[#526A70] hover:text-[#07525E]'
              }`}
            >
              Semua Unit
            </button>
            {activeUnits.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => setSelectedUnitId(u.id)}
                className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selectedUnitId === u.id
                    ? 'bg-white text-[#07525E] shadow-xs'
                    : 'text-[#526A70] hover:text-[#07525E]'
                }`}
              >
                {u.namaUnit}
              </button>
            ))}
          </div>
        </div>

        {/* Empty State vs Populated Table */}
        {filteredPengurus.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF5F8] text-[#0C7A89]">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-base font-bold text-[#07525E]">
              {pengurusList.length === 0
                ? 'Belum Ada Data Pengurus DUWD'
                : 'Data Tidak Ditemukan'}
            </h2>
            <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#526A70]">
              {pengurusList.length === 0
                ? canEdit
                  ? 'Mulai susun struktur internal DUWD DPP Wahdah Islamiyah dengan menambahkan pengurus pertama.'
                  : 'Daftar pengurus masih kosong. Masuk sebagai Admin atau Super Admin untuk mulai menginput data.'
                : 'Tidak ada data pengurus yang sesuai dengan filter unit atau kata kunci pencarian.'}
            </p>
            {canEdit && pengurusList.length === 0 && (
              <button
                type="button"
                onClick={openCreateForm}
                className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#07525E] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#0C7A89]"
              >
                <Plus className="h-4 w-4" />
                <span>Tambah Pengurus Pertama</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#07525E]/10 bg-[#F8FBFC] text-xs font-semibold text-[#526A70]">
                  <th className="px-6 py-3.5">No</th>
                  <th className="px-4 py-3.5">Nama Lengkap</th>
                  <th className="px-4 py-3.5">Nama Panggilan</th>
                  <th className="px-4 py-3.5">Unit</th>
                  <th className="px-4 py-3.5">Amanah</th>
                  <th className="px-4 py-3.5">WhatsApp</th>
                  {canEdit && <th className="px-6 py-3.5 text-right">Kelola</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#07525E]/8">
                {filteredPengurus.map((item, idx) => (
                  <tr key={item.id} className="transition-colors hover:bg-[#EBF5F8]/45">
                    <td className="px-6 py-4 font-mono text-xs text-[#526A70] tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-4 font-semibold text-[#0F2429]">
                      {item.namaLengkap}
                    </td>
                    <td className="px-4 py-4 text-[13px] text-[#355158]">
                      {item.namaPanggilan}
                    </td>
                    <td className="px-4 py-4 text-[13px] font-medium text-[#07525E]">
                      {item.namaUnit}
                    </td>
                    <td className="px-4 py-4 text-[13px] font-semibold text-[#0C7A89]">
                      {item.amanah || '-'}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <a
                        href={buildWhatsAppLink(item.whatsapp)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-[#0C7A89] hover:text-[#07525E] hover:underline tabular-nums"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
                        <span>{item.whatsapp}</span>
                      </a>
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        {confirmDeleteId === item.id ? (
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="cursor-pointer rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-red-700"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="cursor-pointer text-xs font-medium text-[#526A70] hover:text-[#07525E]"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openEditForm(item)}
                              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#0C7A89] hover:text-[#07525E]"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#526A70] hover:text-red-700"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span>Hapus</span>
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Pengurus */}
      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pengurus-form-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#042D35]/45 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong w-full max-w-lg bg-white p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-[#07525E]/10 pb-3.5">
              <div>
                <h2 id="pengurus-form-title" className="text-base font-bold text-[#07525E]">
                  {editingItem ? 'Edit Data Pengurus DUWD' : 'Tambah Pengurus DUWD'}
                </h2>
                <p className="mt-0.5 text-xs text-[#526A70]">
                  Nomor WhatsApp berawalan 08 otomatis dikonversi menjadi 628.
                </p>
              </div>
              <button
                type="button"
                aria-label="Tutup form pengurus"
                onClick={() => setFormOpen(false)}
                className="cursor-pointer rounded-xl p-1.5 text-[#526A70] hover:bg-[#EBF5F8]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="mt-5 space-y-4">
              {formError && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900">
                  {formError}
                </div>
              )}

              <div>
                <label
                  htmlFor="p-nama-lengkap"
                  className="mb-1 block text-xs font-semibold text-[#355158]"
                >
                  Nama Lengkap
                </label>
                <input
                  id="p-nama-lengkap"
                  type="text"
                  required
                  value={namaLengkap}
                  onChange={(e) => setNamaLengkap(e.target.value)}
                  placeholder="Contoh: Muhammad Rasul, S.Kom."
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="p-nama-panggilan"
                  className="mb-1 block text-xs font-semibold text-[#355158]"
                >
                  Nama Panggilan
                </label>
                <input
                  id="p-nama-panggilan"
                  type="text"
                  required
                  value={namaPanggilan}
                  onChange={(e) => setNamaPanggilan(e.target.value)}
                  placeholder="Contoh: Akh Rasul"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="p-whatsapp"
                  className="mb-1 block text-xs font-semibold text-[#355158]"
                >
                  Nomor WhatsApp (Otomatis 08 &rarr; 628)
                </label>
                <input
                  id="p-whatsapp"
                  type="tel"
                  required
                  value={waRaw}
                  onChange={(e) => handleWaInputChange(e.target.value)}
                  placeholder="081234567890"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 font-mono text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
                {normalizedWaPreview && (
                  <p className="mt-1 font-mono text-[11px] text-[#0C7A89]">
                    Format tersimpan: {normalizedWaPreview}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="p-unit"
                    className="mb-1 block text-xs font-semibold text-[#355158]"
                  >
                    Pilih Unit
                  </label>
                  <select
                    id="p-unit"
                    required
                    value={unitId}
                    onChange={(e) => handleUnitChangeInForm(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  >
                    {activeUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.namaUnit} ({u.kodeUnit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="p-amanah"
                    className="mb-1 block text-xs font-semibold text-[#355158]"
                  >
                    Pilih Amanah
                  </label>
                  <select
                    id="p-amanah"
                    required
                    value={amanahSelect}
                    onChange={(e) => setAmanahSelect(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  >
                    {amanahPresets.map((preset) => (
                      <option key={preset} value={preset}>
                        {preset}
                      </option>
                    ))}
                    <option value="LAINNYA">Lainnya (Isi Manual)</option>
                  </select>
                </div>
              </div>

              {amanahSelect === 'LAINNYA' && (
                <div>
                  <label
                    htmlFor="p-amanah-custom"
                    className="mb-1 block text-xs font-semibold text-[#355158]"
                  >
                    Tulis Nama Amanah
                  </label>
                  <input
                    id="p-amanah-custom"
                    type="text"
                    required
                    value={amanahCustom}
                    onChange={(e) => setAmanahCustom(e.target.value)}
                    placeholder="Contoh: Koordinator Wilayah Timur"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-[#07525E]/10 pt-4">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold text-[#526A70] hover:bg-[#F6FAFB]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : editingItem ? 'Simpan Perubahan' : 'Simpan Pengurus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
