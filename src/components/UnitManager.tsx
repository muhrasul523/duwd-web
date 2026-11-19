import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { deleteUnitRecord, saveUnitRecord } from '../services/orgService';
import type { UnitItem } from '../types/org';

interface UnitManagerProps {
  activePin: string;
  webAppUrl: string;
  units: UnitItem[];
  onSaveUnit: (unit: UnitItem) => void;
  onDeleteUnit: (id: string) => void;
}

export function UnitManager({
  activePin,
  webAppUrl,
  units,
  onSaveUnit,
  onDeleteUnit,
}: UnitManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<UnitItem | null>(null);
  const [kodeUnit, setKodeUnit] = useState('');
  const [namaUnit, setNamaUnit] = useState('');
  const [urutan, setUrutan] = useState(units.length + 1);
  const [aktif, setAktif] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const sortedUnits = [...units].sort((a, b) => a.urutan - b.urutan);

  const openCreate = () => {
    setEditing(null);
    setKodeUnit('');
    setNamaUnit('');
    setUrutan(units.length + 1);
    setAktif(true);
    setError('');
    setFormOpen(true);
  };

  const openEdit = (u: UnitItem) => {
    setEditing(u);
    setKodeUnit(u.kodeUnit);
    setNamaUnit(u.namaUnit);
    setUrutan(u.urutan);
    setAktif(u.aktif);
    setError('');
    setFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!kodeUnit.trim() || !namaUnit.trim()) {
      setError('Kode unit dan nama unit wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const res = await saveUnitRecord(
        {
          id: editing?.id,
          kodeUnit: kodeUnit.trim().toUpperCase(),
          namaUnit: namaUnit.trim(),
          urutan: Number(urutan) || 1,
          aktif,
        },
        activePin,
        webAppUrl,
      );

      if (res.ok && res.item) {
        onSaveUnit(res.item);
        setNotice(
          res.synced
            ? `Unit "${res.item.namaUnit}" tersimpan ke sheet UNIT.`
            : `Unit "${res.item.namaUnit}" disimpan secara lokal.`,
        );
        setFormOpen(false);
      } else {
        setError(res.error || 'Gagal menyimpan unit.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await deleteUnitRecord(id, activePin, webAppUrl);
    if (res.ok) {
      onDeleteUnit(id);
      setNotice(res.synced ? 'Unit dihapus dari sheet UNIT.' : 'Unit dihapus dari daftar lokal.');
    } else {
      setNotice(res.error || 'Gagal menghapus unit.');
    }
  };

  return (
    <section className="duwd-container px-2 py-7 sm:px-4 lg:py-9">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
            Khusus Super Admin · Sheet UNIT
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] dark:text-[#E6F4F7] sm:text-3xl">
            Kelola Daftar Unit Internal DUWD
          </h1>
          <p className="mt-1 text-xs text-[#526A70] dark:text-[#9BB5BC]">
            Unit 0 (<span className="font-mono font-semibold">PI</span>) adalah Pengurus Inti tanpa Program Kerja. Unit 1–5 terhubung langsung ke Program Kerja <span className="font-mono font-semibold">10001–10005</span>, dan aplikasi menampilkan <span className="font-semibold">Kode Unit (1 kata)</span> agar ringkas.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Tambah Unit Baru</span>
        </button>
      </div>

      {notice && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#0C7A89]/20 bg-[#ECF6F2] px-4 py-2.5 text-xs font-medium text-[#07525E] dark:border-[#3EC1D3]/30 dark:bg-[#0D2E36] dark:text-[#BCEAF0]">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Tutup pemberitahuan"
            onClick={() => setNotice('')}
            className="cursor-pointer text-[#526A70] dark:text-[#9BB5BC]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-6 glass-surface-strong overflow-hidden">
        <div className="overflow-x-auto">
          <table className="duwd-zebra-table w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#07525E]/10 bg-[#F8FBFC] text-xs font-semibold text-[#526A70] dark:border-[#3EC1D3]/15 dark:bg-[#0C2730] dark:text-[#9BB5BC]">
                <th className="px-6 py-3.5">Urutan</th>
                <th className="px-4 py-3.5">Kode Unit</th>
                <th className="px-4 py-3.5">Nama Unit</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#07525E]/8 dark:divide-[#3EC1D3]/10">
              {sortedUnits.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-4 font-mono text-xs text-[#526A70] tabular-nums dark:text-[#8DA8B0]">
                    {u.urutan}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs font-bold text-[#0C7A89] dark:text-[#3EC1D3]">
                    {u.kodeUnit}
                  </td>
                  <td className="px-4 py-4 font-semibold text-[#0F2429] dark:text-[#E6F4F7]">
                    {u.namaUnit}
                  </td>
                  <td className="px-4 py-4 text-xs font-semibold text-[#07525E] dark:text-[#B4CCD3]">
                    {u.aktif ? 'Aktif' : 'Nonaktif'}
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#0C7A89] hover:text-[#07525E] dark:text-[#3EC1D3] dark:hover:text-[#7CE0ED]"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(u.id)}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#526A70] hover:text-red-700 dark:text-[#9BB5BC] dark:hover:text-red-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Hapus</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {formOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unit-form-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#042D35]/50 p-4 backdrop-blur-sm dark:bg-black/70"
        >
          <div className="glass-surface-strong w-full max-w-md bg-white p-6 dark:bg-[#0B2229]">
            <div className="flex items-center justify-between border-b border-[#07525E]/10 pb-3 dark:border-[#3EC1D3]/15">
              <h2
                id="unit-form-title"
                className="text-base font-bold text-[#07525E] dark:text-[#E6F4F7]"
              >
                {editing ? 'Edit Unit DUWD' : 'Tambah Unit Baru'}
              </h2>
              <button
                type="button"
                aria-label="Tutup form unit"
                onClick={() => setFormOpen(false)}
                className="cursor-pointer rounded-xl p-1 text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {error && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/60 dark:text-amber-200">
                  {error}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Kode Unit (1 Kata — Ditampilkan di Aplikasi)
                </label>
                <input
                  type="text"
                  required
                  value={kodeUnit}
                  onChange={(e) => setKodeUnit(e.target.value)}
                  placeholder="Contoh: EKSPANSI"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 font-mono text-sm uppercase text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Nama Unit / Nama Program Kerja
                </label>
                <input
                  type="text"
                  required
                  value={namaUnit}
                  onChange={(e) => setNamaUnit(e.target.value)}
                  placeholder="Contoh: PENDIRIAN DAN PEMBINAAN DPW DPD"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Urutan Tampil (0 = PI, 1–5 = Proker)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={urutan}
                    onChange={(e) => setUrutan(Number(e.target.value))}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Status
                  </label>
                  <select
                    value={aktif ? 'Ya' : 'Tidak'}
                    onChange={(e) => setAktif(e.target.value === 'Ya')}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  >
                    <option value="Ya">Aktif</option>
                    <option value="Tidak">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#07525E]/10 pt-3 dark:border-[#3EC1D3]/15">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-[#526A70] dark:text-[#9BB5BC]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="cursor-pointer rounded-xl bg-[#07525E] px-5 py-2 text-xs font-semibold text-white hover:bg-[#0C7A89] disabled:opacity-60"
                >
                  {saving ? 'Menyimpan...' : 'Simpan Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
