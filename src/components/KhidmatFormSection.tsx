import { CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';
import tessellationImg from '../assets/images/duwd_geometric_tessellation_1794631831529.jpg';
import { submitKhidmatRequest } from '../services/gasClient';
import type { KhidmatReceipt } from '../types/duwd';

const KHIDMAT_CATEGORIES = [
  'Penerbitan SK Pengurus DPW / DPD',
  'Konsultasi Pelaksanaan 4M (Muswil/Mukerwil/Musda/Mukerda)',
  'Sinkronisasi Database & Levelisasi Kader',
  'Pendampingan Pemekaran / Pembentukan DPD Baru',
  'Permintaan Akses Repositori Google Drive Resmi',
];

export function KhidmatFormSection() {
  const [nama, setNama] = useState('');
  const [asalUnit, setAsalUnit] = useState('');
  const [kontak, setKontak] = useState('');
  const [kategori, setKategori] = useState(KHIDMAT_CATEGORIES[0]);
  const [perihal, setPerihal] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [detail, setDetail] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{
    data: KhidmatReceipt;
    syncedToGas: boolean;
  } | null>(null);
  const [imageError, setImageError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (nama.trim().length < 3 || asalUnit.trim().length < 3 || kontak.trim().length < 6) {
      setErrorMsg('Mohon lengkapi nama pengurus, asal DPW/DPD, dan nomor WhatsApp/email aktif.');
      return;
    }

    if (perihal.trim().length < 5) {
      setErrorMsg('Mohon isi perihal permohonan secara jelas.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await submitKhidmatRequest({
        nama: nama.trim(),
        asalUnit: asalUnit.trim(),
        kontak: kontak.trim(),
        kategori,
        perihal: perihal.trim(),
        detail: detail.trim(),
        driveUrl: driveUrl.trim() || undefined,
      });

      setReceipt({ data: res.receipt, syncedToGas: res.syncedToGas });
      setNama('');
      setAsalUnit('');
      setKontak('');
      setPerihal('');
      setDriveUrl('');
      setDetail('');
    } catch {
      setErrorMsg('Gagal memproses pengajuan. Silakan coba kembali.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="layanan-khidmat" className="px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12">
          {/* Left Visual & Institutional Standard Card */}
          <div className="flex flex-col justify-between glass-surface overflow-hidden lg:col-span-5">
            <div className="relative h-64 w-full overflow-hidden bg-[#07525E] sm:h-72">
              {!imageError ? (
                <img
                  src={tessellationImg}
                  alt="Ornamen geometris abstrak tiga dimensi berwarna teal, deep cyan, hijau lembut, dan aksen emas hangat"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#07525E] to-[#0C7A89] text-sm font-semibold text-white">
                  Ornamen Geometris DUWD
                </div>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-between p-6 sm:p-7">
              <div>
                <p className="text-xs font-semibold text-[#0C7A89]">
                  Meja Layanan Khidmat Struktural
                </p>
                <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E]">
                  Pengajuan Administrasi &amp; Konsultasi DPW/DPD
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-[#3D575E]">
                  Setiap permohonan SK pengurus, konsultasi 4M, maupun validasi berkas wilayah dicatat ke sheet{' '}
                  <span className="font-mono text-xs font-semibold text-[#07525E]">KHIDMAT_MASUK</span>{' '}
                  beserta nomor tiket pelacakan otomatis.
                </p>
              </div>

              <div className="mt-6 space-y-2 border-t border-[#07525E]/10 pt-4 text-xs text-[#526A70]">
                <div>
                  <span className="font-semibold text-[#07525E]">Sekretariat Pusat:</span>{' '}
                  DPP Wahdah Islamiyah, Makassar &amp; Jakarta
                </div>
                <div>
                  <span className="font-semibold text-[#07525E]">Surel Resmi:</span>{' '}
                  sekretariat@duwd.web.id
                </div>
              </div>
            </div>
          </div>

          {/* Right Form Container */}
          <div className="glass-surface-strong p-6 sm:p-8 lg:col-span-7">
            {receipt ? (
              <div className="flex h-full flex-col justify-center py-6">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ECF6F2] text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-bold text-[#07525E]">
                  Permohonan Layanan Khidmat Tercatat
                </h3>
                <p className="mt-2 text-sm text-[#3D575E]">
                  {receipt.syncedToGas
                    ? 'Data telah diteruskan ke Google Apps Script Web App dan tersimpan di Google Sheets.'
                    : 'Permohonan dicatat dengan nomor tiket lokal. Hubungkan URL Google Apps Script pada menu Backend GAS untuk sinkronisasi otomatis ke Google Sheets.'}
                </p>

                <div className="mt-6 space-y-2.5 rounded-2xl border border-[#07525E]/12 bg-[#F6FAFB] p-5 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-[#526A70]">Nomor Tiket</span>
                    <span className="font-mono font-bold text-[#07525E]">{receipt.data.ticketId}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#526A70]">Nama Pengurus</span>
                    <span className="font-semibold text-[#0F2429]">{receipt.data.nama}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#526A70]">Unit Asal</span>
                    <span className="font-semibold text-[#0F2429]">{receipt.data.asalUnit}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#526A70]">Kategori</span>
                    <span className="font-medium text-[#0F2429]">{receipt.data.kategori}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-[#526A70]">Status</span>
                    <span className="font-semibold text-[#0C7A89]">{receipt.data.status}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setReceipt(null)}
                    className="cursor-pointer rounded-xl bg-[#07525E] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0C7A89]"
                  >
                    Buat Pengajuan Baru
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="border-b border-[#07525E]/10 pb-4">
                  <h3 className="text-lg font-bold text-[#07525E]">
                    Formulir Pengajuan Khidmat Wilayah &amp; Daerah
                  </h3>
                  <p className="mt-1 text-xs text-[#526A70]">
                    Lengkapi data pengurus dan lampirkan tautan Google Drive jika ada dokumen pendukung.
                  </p>
                </div>

                {errorMsg && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
                    {errorMsg}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="khidmat-nama"
                      className="mb-1.5 block text-xs font-semibold text-[#355158]"
                    >
                      Nama Lengkap Pengurus
                    </label>
                    <input
                      id="khidmat-nama"
                      type="text"
                      required
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      placeholder="Contoh: Ust. Muhammad Syukur"
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="khidmat-unit"
                      className="mb-1.5 block text-xs font-semibold text-[#355158]"
                    >
                      Asal DPW / DPD
                    </label>
                    <input
                      id="khidmat-unit"
                      type="text"
                      required
                      value={asalUnit}
                      onChange={(e) => setAsalUnit(e.target.value)}
                      placeholder="Contoh: DPD Kota Makassar"
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="khidmat-kontak"
                      className="mb-1.5 block text-xs font-semibold text-[#355158]"
                    >
                      Nomor WhatsApp atau Email
                    </label>
                    <input
                      id="khidmat-kontak"
                      type="text"
                      required
                      value={kontak}
                      onChange={(e) => setKontak(e.target.value)}
                      placeholder="0812-xxxx-xxxx / email@dpw.org"
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="khidmat-kategori"
                      className="mb-1.5 block text-xs font-semibold text-[#355158]"
                    >
                      Kategori Layanan
                    </label>
                    <select
                      id="khidmat-kategori"
                      value={kategori}
                      onChange={(e) => setKategori(e.target.value)}
                      className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                    >
                      {KHIDMAT_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="khidmat-perihal"
                    className="mb-1.5 block text-xs font-semibold text-[#355158]"
                  >
                    Perihal Permohonan
                  </label>
                  <input
                    id="khidmat-perihal"
                    type="text"
                    required
                    value={perihal}
                    onChange={(e) => setPerihal(e.target.value)}
                    placeholder="Contoh: Pengajuan SK Penetapan Pengurus DPD Masa Amanah 2026-2031"
                    className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="khidmat-drive"
                    className="mb-1.5 block text-xs font-semibold text-[#355158]"
                  >
                    Tautan Berkas Google Drive (Opsional)
                  </label>
                  <input
                    id="khidmat-drive"
                    type="url"
                    value={driveUrl}
                    onChange={(e) => setDriveUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3.5 py-2.5 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="khidmat-detail"
                    className="mb-1.5 block text-xs font-semibold text-[#355158]"
                  >
                    Ringkasan Permohonan
                  </label>
                  <textarea
                    id="khidmat-detail"
                    rows={3}
                    value={detail}
                    onChange={(e) => setDetail(e.target.value)}
                    placeholder="Tuliskan catatan tambahan atau jadwal koordinasi yang diharapkan..."
                    className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    <span>{submitting ? 'Mengirim Permohonan...' : 'Kirim Permohonan Khidmat'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
