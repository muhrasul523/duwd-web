import { Check, Copy, FileText, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { KelembagaanUnifiedRow } from '../types/org';

export type CopyFormatMode =
  | 'nama_saja'
  | 'ketua_saja'
  | 'sekretaris_saja'
  | 'ketua_sekretaris'
  | 'lengkap'
  | 'wa_saja'
  | 'tsv_tabel';

interface WilayahCopyModalProps {
  title: string;
  subtitle?: string;
  rows: KelembagaanUnifiedRow[];
  initialMode?: CopyFormatMode;
  onClose: () => void;
}

const MODE_LABELS: { id: CopyFormatMode; label: string }[] = [
  { id: 'ketua_sekretaris', label: 'Ketua & Sekretaris' },
  { id: 'ketua_saja', label: 'Ketua Saja' },
  { id: 'sekretaris_saja', label: 'Sekretaris Saja' },
  { id: 'nama_saja', label: 'Daftar Nama Saja' },
  { id: 'lengkap', label: 'Info Lengkap' },
  { id: 'wa_saja', label: 'Nomor WA Saja' },
  { id: 'tsv_tabel', label: 'Tabel Excel (TSV)' },
];

export function formatKelembagaanRowsText(
  rows: KelembagaanUnifiedRow[],
  mode: CopyFormatMode,
  options: {
    includeKode?: boolean;
    includeStatus?: boolean;
    includeNumbering?: boolean;
    headerTitle?: string;
  } = {},
): string {
  const {
    includeKode = true,
    includeStatus = true,
    includeNumbering = true,
    headerTitle = '',
  } = options;

  if (rows.length === 0) return '';

  if (mode === 'tsv_tabel') {
    const header = [
      'Kode Wilayah',
      'Tingkat',
      'Pulau',
      'Provinsi',
      'Kab/Kota',
      'Kecamatan',
      'Kel/Desa',
      'Nama Lembaga',
      'Status Terbentuk',
      'Ketua',
      'WA Ketua',
      'Sekretaris',
      'WA Sekretaris',
      'Alamat Kantor',
      'Tautan Drive',
    ].join('\t');
    const body = rows.map((r) =>
      [
        r.kodeWilayah,
        r.jenis,
        r.pulau,
        r.namaProvinsi,
        r.namaKabKota || '',
        r.namaKecamatan || '',
        r.namaKelDesa || '',
        r.namaLembaga,
        r.statusTerbentuk,
        r.ketuaNama,
        r.ketuaWa,
        r.sekretarisNama,
        r.sekretarisWa,
        r.alamatKantor || '',
        r.tautanDrive || '',
      ]
        .map((c) => String(c || '').replace(/[\t\r\n]+/g, ' '))
        .join('\t'),
    );
    return [header, ...body].join('\n');
  }

  if (mode === 'wa_saja') {
    const waSet = new Set<string>();
    const lines: string[] = [];
    rows.forEach((r) => {
      if (r.ketuaWa && !waSet.has(r.ketuaWa)) {
        waSet.add(r.ketuaWa);
        lines.push(`${r.ketuaWa} (${r.ketuaNama || 'Ketua'} - ${r.namaLembaga})`);
      }
      if (r.sekretarisWa && !waSet.has(r.sekretarisWa)) {
        waSet.add(r.sekretarisWa);
        lines.push(`${r.sekretarisWa} (${r.sekretarisNama || 'Sekretaris'} - ${r.namaLembaga})`);
      }
    });
    return lines.join('\n');
  }

  const lines = rows.map((r, idx) => {
    const prefix = includeNumbering ? `${idx + 1}. ` : '';
    const kodePrefix = includeKode ? `[${r.kodeWilayah}] ` : '';
    const statusSuffix = includeStatus ? ` (${r.statusTerbentuk})` : '';
    const ketuaText = r.ketuaNama
      ? `${r.ketuaNama}${r.ketuaWa ? ` (${r.ketuaWa})` : ''}`
      : r.ketuaWa || '-';
    const sekText = r.sekretarisNama
      ? `${r.sekretarisNama}${r.sekretarisWa ? ` (${r.sekretarisWa})` : ''}`
      : r.sekretarisWa || '-';

    if (mode === 'nama_saja') {
      return `${prefix}${kodePrefix}${r.namaLembaga}${statusSuffix}`;
    }

    if (mode === 'ketua_saja') {
      return `${prefix}${kodePrefix}${r.namaLembaga}${statusSuffix} — Ketua: ${ketuaText}`;
    }

    if (mode === 'sekretaris_saja') {
      return `${prefix}${kodePrefix}${r.namaLembaga}${statusSuffix} — Sekretaris: ${sekText}`;
    }

    if (mode === 'ketua_sekretaris') {
      return `${prefix}${kodePrefix}${r.namaLembaga}${statusSuffix}\n   Ketua: ${ketuaText}\n   Sekretaris: ${sekText}`;
    }

    // mode === 'lengkap'
    const wilayahTrail = [r.pulau, r.namaProvinsi, r.namaKabKota, r.namaKecamatan, r.namaKelDesa]
      .filter(Boolean)
      .join(' / ');
    const parts = [
      `${prefix}${kodePrefix}${r.namaLembaga} [${r.jenis}]${statusSuffix}`,
      `   Wilayah: ${wilayahTrail}`,
      `   Ketua: ${ketuaText}`,
      `   Sekretaris: ${sekText}`,
    ];
    if (r.alamatKantor) parts.push(`   Alamat: ${r.alamatKantor}`);
    if (r.tautanDrive) parts.push(`   Drive SK: ${r.tautanDrive}`);
    return parts.join('\n');
  });

  if (headerTitle.trim()) {
    return `${headerTitle.trim()}\n${lines.join('\n')}`;
  }
  return lines.join('\n');
}

export function WilayahCopyModal({
  title,
  subtitle,
  rows,
  initialMode = 'ketua_sekretaris',
  onClose,
}: WilayahCopyModalProps) {
  const [mode, setMode] = useState<CopyFormatMode>(initialMode);
  const [includeKode, setIncludeKode] = useState(true);
  const [includeStatus, setIncludeStatus] = useState(true);
  const [includeNumbering, setIncludeNumbering] = useState(true);
  const [copied, setCopied] = useState(false);

  const generatedText = useMemo(
    () =>
      formatKelembagaanRowsText(rows, mode, {
        includeKode,
        includeStatus,
        includeNumbering,
        headerTitle: mode === 'tsv_tabel' || mode === 'wa_saja' ? '' : title,
      }),
    [rows, mode, includeKode, includeStatus, includeNumbering, title],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generatedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#072B31]/45 p-4 backdrop-blur-sm"
    >
      <div className="glass-surface-strong relative flex max-h-[90vh] w-full max-w-2xl flex-col bg-white p-6">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup dialog salin"
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1.5 text-[#526A70] hover:bg-[#EBF5F8]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EBF5F8] text-[#0C7A89]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 id="copy-modal-title" className="text-base font-bold text-[#07525E]">
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-[#526A70]">
              {subtitle || `${rows.length} data terpilih siap disalin ke WhatsApp, dokumen, atau Excel.`}
            </p>
          </div>
        </div>

        {/* Mode selector */}
        <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl bg-[#EBF5F8]/80 p-1.5">
          {MODE_LABELS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === item.id
                  ? 'bg-white text-[#07525E] shadow-xs'
                  : 'text-[#526A70] hover:text-[#07525E]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Options */}
        {mode !== 'tsv_tabel' && mode !== 'wa_saja' && (
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-[#355158]">
            <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
              <input
                type="checkbox"
                checked={includeNumbering}
                onChange={(e) => setIncludeNumbering(e.target.checked)}
                className="rounded border-[#07525E]/30 accent-[#0C7A89]"
              />
              <span>Nomor urut</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
              <input
                type="checkbox"
                checked={includeKode}
                onChange={(e) => setIncludeKode(e.target.checked)}
                className="rounded border-[#07525E]/30 accent-[#0C7A89]"
              />
              <span>Kode wilayah</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
              <input
                type="checkbox"
                checked={includeStatus}
                onChange={(e) => setIncludeStatus(e.target.checked)}
                className="rounded border-[#07525E]/30 accent-[#0C7A89]"
              />
              <span>Status terbentuk</span>
            </label>
          </div>
        )}

        {/* Preview */}
        <div className="mt-3 flex-1 overflow-hidden">
          <textarea
            readOnly
            value={generatedText}
            rows={12}
            className="h-64 w-full resize-none rounded-xl border border-[#07525E]/15 bg-[#F8FBFC] p-3.5 font-mono text-xs leading-relaxed text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#07525E]/10 pt-3.5">
          <span className="text-xs font-medium text-[#526A70] tabular-nums">
            Total {rows.length} entri · {generatedText.length} karakter
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-[#526A70] hover:bg-[#F4FAFB]"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={!generatedText}
              onClick={() => void handleCopy()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Berhasil Disalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Teks</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
