import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  FolderPlus,
  Link2,
  Presentation,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  buildDriveAccessLinks,
  DRIVE_CATEGORY_OPTIONS,
  DRIVE_FORMAT_OPTIONS,
  loadGasConfig,
} from '../config/driveConfig';
import { registerDriveLinkAsset } from '../services/gasClient';
import type { DriveAsset, DriveFileFormat } from '../types/duwd';

interface DriveArchiveHubProps {
  assets: DriveAsset[];
  onAddAsset: (asset: DriveAsset) => void;
}

const FORMAT_TABS: ('Semua' | DriveFileFormat)[] = [
  'Semua',
  ...DRIVE_FORMAT_OPTIONS,
];

function getFormatIcon(format: DriveFileFormat) {
  switch (format) {
    case 'PDF':
      return FileText;
    case 'PPT':
      return Presentation;
    case 'DOCX':
      return FileSpreadsheet;
    case 'Gambar':
      return FileImage;
    case 'Audio':
      return FileAudio;
    case 'Video':
      return FileVideo;
    default:
      return FileArchive;
  }
}

export function DriveArchiveHub({ assets, onAddAsset }: DriveArchiveHubProps) {
  const [selectedFormat, setSelectedFormat] = useState<'Semua' | DriveFileFormat>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<DriveAsset | null>(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);

  // Register Drive Link Form State
  const [judul, setJudul] = useState('');
  const [driveUrl, setDriveUrl] = useState('');
  const [kategori, setKategori] = useState(DRIVE_CATEGORY_OPTIONS[0]);
  const [format, setFormat] = useState<DriveFileFormat>('PDF');
  const [dpw, setDpw] = useState('DPP DUWD');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const gasConfig = loadGasConfig();
  const parsedPreview = useMemo(() => buildDriveAccessLinks(driveUrl), [driveUrl]);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter((item) => {
      if (selectedFormat !== 'Semua' && item.format !== selectedFormat) {
        return false;
      }
      if (q) {
        const text = `${item.judul} ${item.kategori} ${item.unitDpw} ${item.format}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [assets, selectedFormat, searchQuery]);

  const handleCopyLink = async (asset: DriveAsset) => {
    try {
      await navigator.clipboard.writeText(asset.urlAsli);
      setCopiedId(asset.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setCopiedId(null);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!judul.trim() || !driveUrl.trim()) return;

    setSubmitting(true);
    setNotice('');
    try {
      const result = await registerDriveLinkAsset({
        judul: judul.trim(),
        driveUrl: driveUrl.trim(),
        kategori,
        format,
        dpw: dpw.trim(),
      });
      onAddAsset(result.asset);
      setNotice(
        result.syncedToGas
          ? 'Tautan Google Drive terverifikasi dan tersimpan ke Sheet ARSIP_DRIVE.'
          : 'Tautan Google Drive berhasil diparsing dan ditambahkan ke daftar repositori lokal.',
      );
      setJudul('');
      setDriveUrl('');
      setShowRegisterForm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="arsip-drive" className="px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-[13px] font-semibold text-[#0C7A89]">
              Integrasi Penyimpanan Google Drive &amp; Link Dinamis
            </p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] sm:text-3xl">
              Repositori Berkas Terpusat Lintas Format
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#526A70]">
              Mendukung PDF, PPT, DOCX, Gambar, Audio MP3, Video MP4, dan arsip terkompresi dengan ekstraksi ID File Google Drive otomatis untuk pratinjau maupun unduhan langsung.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {gasConfig.driveRootFolderUrl && (
              <a
                href={gasConfig.driveRootFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#0C7A89]/25 bg-white/80 px-4 py-2.5 text-xs font-semibold text-[#07525E] transition-colors hover:bg-white"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#0C7A89]" />
                <span>Buka Folder Induk Drive</span>
              </a>
            )}

            <button
              type="button"
              onClick={() => setShowRegisterForm((prev) => !prev)}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5"
            >
              {showRegisterForm ? <X className="h-3.5 w-3.5" /> : <FolderPlus className="h-3.5 w-3.5" />}
              <span>{showRegisterForm ? 'Tutup Form' : 'Daftarkan Link Drive'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Google Drive Link Registration Drawer */}
        {showRegisterForm && (
          <form
            onSubmit={handleRegisterSubmit}
            className="mt-6 glass-surface-strong p-6"
          >
            <div className="mb-4 flex items-center justify-between border-b border-[#07525E]/10 pb-3">
              <div>
                <h3 className="text-base font-bold text-[#07525E]">
                  Registrasi Tautan Google Drive Dinamis
                </h3>
                <p className="text-xs text-[#526A70]">
                  Tempelkan tautan Google Drive atau Docs/Slides apa saja; sistem mengekstrak File ID dan menyiapkan link pratinjau serta unduhan secara otomatis.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                  Judul Dokumen / Media
                </label>
                <input
                  type="text"
                  required
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Contoh: Panduan Teknis Musda DPD 2026"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                  Format Berkas
                </label>
                <select
                  value={format}
                  onChange={(e) => setFormat(e.target.value as DriveFileFormat)}
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                >
                  {DRIVE_FORMAT_OPTIONS.map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {fmt}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                  Tautan Google Drive (Share Link / File ID)
                </label>
                <input
                  type="text"
                  required
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/1AbCDefGhIJkLmNoPqRsTuVwXyZ/view?usp=sharing"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3.5 py-2.5 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                  Unit / DPW Pengunggah
                </label>
                <input
                  type="text"
                  value={dpw}
                  onChange={(e) => setDpw(e.target.value)}
                  placeholder="DPP DUWD / Nama DPW"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs font-semibold text-[#3D575E]">
                  Kategori Arsip
                </label>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                >
                  {DRIVE_CATEGORY_OPTIONS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full cursor-pointer rounded-xl bg-[#07525E] px-5 py-2.5 text-xs font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-60"
                >
                  {submitting ? 'Memproses...' : 'Simpan ke Repositori Drive'}
                </button>
              </div>
            </div>

            {driveUrl.trim() && (
              <div className="mt-4 rounded-xl border border-[#0C7A89]/15 bg-[#F4FAFB] p-3.5 text-xs text-[#355158]">
                <div className="flex flex-wrap items-center gap-2 font-semibold text-[#07525E]">
                  <Link2 className="h-3.5 w-3.5 text-[#0C7A89]" />
                  <span>
                    Hasil Ekstraksi Dinamis:{' '}
                    {parsedPreview.fileId ? (
                      <span className="font-mono text-[#0C7A89]">{parsedPreview.fileId}</span>
                    ) : (
                      <span className="text-[#D88B15]">Menunggu ID Drive valid (min. 12 karakter)</span>
                    )}
                  </span>
                </div>
                {parsedPreview.previewUrl && (
                  <p className="mt-1 truncate font-mono text-[11px] text-[#526A70]">
                    Pratinjau: {parsedPreview.previewUrl}
                  </p>
                )}
              </div>
            )}
          </form>
        )}

        {notice && (
          <div className="mt-4 rounded-xl border border-[#0C7A89]/20 bg-[#ECF6F2] px-4 py-3 text-xs font-medium text-[#07525E]">
            {notice}
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-[#07525E]/12 bg-white/75 p-1.5 backdrop-blur-md">
            {FORMAT_TABS.map((fmt) => {
              const active = selectedFormat === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setSelectedFormat(fmt)}
                  className={`cursor-pointer whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#07525E] text-white shadow-xs'
                      : 'text-[#526A70] hover:bg-[#EBF5F8] hover:text-[#07525E]'
                  }`}
                >
                  {fmt}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#526A70]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berkas, pedoman, DPW..."
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/85 py-2 pr-3.5 pl-10 text-sm text-[#0F2429] placeholder:text-[#738A90] focus:border-[#0C7A89] focus:outline-none"
            />
          </div>
        </div>

        {/* Repository Grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAssets.length === 0 ? (
            <div className="col-span-full glass-surface p-10 text-center text-sm text-[#526A70]">
              Tidak ada berkas Drive yang cocok dengan filter format &ldquo;{selectedFormat}&rdquo;.
            </div>
          ) : (
            filteredAssets.map((asset) => {
              const Icon = getFormatIcon(asset.format);
              const isCopied = copiedId === asset.id;

              return (
                <article
                  key={asset.id}
                  className="glass-surface flex flex-col justify-between p-5 transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-xs font-medium text-[#526A70]">
                        <span>{asset.format}</span>
                        <span aria-hidden="true" className="mx-1.5">·</span>
                        <span className="tabular-nums">{asset.ukuranTeks}</span>
                      </div>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF5F8] text-[#0C7A89]">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                    </div>

                    <h3 className="mt-3 line-clamp-2 text-[15px] font-bold leading-snug text-[#07525E]">
                      {asset.judul}
                    </h3>

                    <div className="mt-2.5 text-xs text-[#526A70]">
                      <span>{asset.kategori}</span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span>{asset.unitDpw}</span>
                      <span aria-hidden="true" className="mx-1.5">·</span>
                      <span className="tabular-nums">{asset.diunggahPada}</span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-2 border-t border-[#07525E]/10 pt-3.5">
                    <button
                      type="button"
                      onClick={() => setPreviewAsset(asset)}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-[#0C7A89] hover:text-[#07525E]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Pratinjau</span>
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleCopyLink(asset)}
                        className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-[#526A70] hover:text-[#07525E]"
                      >
                        {isCopied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-700" />
                            <span className="text-emerald-700">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>

                      <a
                        href={asset.urlUnduh || asset.urlAsli}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#07525E] hover:text-[#D88B15]"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>Unduh</span>
                      </a>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Pratinjau Google Drive */}
      {previewAsset && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="drive-preview-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#042D35]/55 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden bg-white">
            <div className="flex items-start justify-between gap-4 border-b border-[#07525E]/10 px-6 py-4">
              <div>
                <p className="text-xs font-medium text-[#0C7A89]">
                  {previewAsset.format} · {previewAsset.kategori} · {previewAsset.ukuranTeks}
                </p>
                <h3
                  id="drive-preview-title"
                  className="mt-1 text-base font-bold text-[#07525E]"
                >
                  {previewAsset.judul}
                </h3>
              </div>

              <button
                type="button"
                aria-label="Tutup pratinjau"
                onClick={() => setPreviewAsset(null)}
                className="cursor-pointer rounded-xl p-2 text-[#526A70] hover:bg-[#EBF5F8] hover:text-[#07525E]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="rounded-xl border border-[#07525E]/12 bg-[#F6FAFB] p-4 text-xs text-[#355158]">
                <div className="font-semibold text-[#07525E]">Tautan Dinamis Google Drive</div>
                <div className="mt-2 space-y-1.5 font-mono text-[11px] break-all">
                  <div>
                    <span className="font-semibold text-[#0C7A89]">File ID:</span>{' '}
                    {previewAsset.driveFileId}
                  </div>
                  <div>
                    <span className="font-semibold text-[#0C7A89]">Embed URL:</span>{' '}
                    {previewAsset.urlPratinjau}
                  </div>
                  <div>
                    <span className="font-semibold text-[#0C7A89]">Download URL:</span>{' '}
                    {previewAsset.urlUnduh}
                  </div>
                </div>
              </div>

              <div className="mt-4 overflow-hidden rounded-xl border border-[#07525E]/12 bg-white">
                {previewAsset.urlPratinjau &&
                !previewAsset.driveFileId.startsWith('1DUWD') ? (
                  <iframe
                    title={previewAsset.judul}
                    src={previewAsset.urlPratinjau}
                    className="h-[360px] w-full border-0"
                    allow="autoplay"
                  />
                ) : (
                  <div className="flex h-[240px] flex-col items-center justify-center bg-gradient-to-br from-[#F4FAFB] to-[#EBF5F8] px-6 text-center">
                    <p className="text-sm font-semibold text-[#07525E]">
                      Pratinjau Embed Aktif untuk File ID Google Drive Riil
                    </p>
                    <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#526A70]">
                      Untuk berkas sampel bawaan ini, silakan daftarkan tautan Google Drive organisasi Anda melalui tombol &ldquo;Daftarkan Link Drive&rdquo; atau hubungkan folder Drive pada backend GAS.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
                <a
                  href={previewAsset.urlAsli}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#0C7A89]/25 px-4 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Buka di Google Drive</span>
                </a>
                <a
                  href={previewAsset.urlUnduh}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#07525E] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0C7A89]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Unduh Berkas</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
