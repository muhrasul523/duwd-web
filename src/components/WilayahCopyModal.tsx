import { Check, Copy, FileText, SlidersHorizontal, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { KelembagaanUnifiedRow } from '../types/org';

export type CopyFormatMode =
  | 'ketua_sekretaris'
  | 'ketua_saja'
  | 'sekretaris_saja'
  | 'nama_saja'
  | 'lengkap'
  | 'wa_saja'
  | 'tsv_tabel';

interface WilayahCopyModalProps {
  title: string;
  subtitle?: string;
  rows: KelembagaanUnifiedRow[];
  initialMode?: CopyFormatMode;
  defaultIncludeWi?: boolean;
  defaultGroupByParent?: boolean;
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

export function formatEntityDisplayName(
  row: KelembagaanUnifiedRow,
  includeWi = false,
): string {
  const baseWilayah = row.namaWilayah || row.namaLembaga;
  if (row.statusTerbentuk === 'Sudah Terbentuk') {
    return includeWi
      ? `${row.jenis} Wahdah Islamiyah ${baseWilayah}`
      : `${row.jenis} ${baseWilayah}`;
  }
  return baseWilayah;
}

function getParentGroupHeading(row: KelembagaanUnifiedRow): string {
  if (row.jenis === 'DPW') {
    return row.pulau ? `Pulau ${row.pulau}` : 'Lainnya';
  }
  if (row.jenis === 'DPD') {
    return row.namaProvinsi ? `Provinsi ${row.namaProvinsi}` : 'Lainnya';
  }
  if (row.jenis === 'DPC') {
    return row.namaKabKota || 'Lainnya';
  }
  return row.namaKecamatan ? `Kec. ${row.namaKecamatan}` : 'Lainnya';
}

function formatSingleRowLines(
  row: KelembagaanUnifiedRow,
  mode: CopyFormatMode,
  indexInList: number,
  options: {
    includeKode: boolean;
    includeNumbering: boolean;
    includeWi: boolean;
  },
): string {
  const { includeKode, includeNumbering, includeWi } = options;
  const prefix = includeNumbering ? `${indexInList + 1}. ` : '';
  const kodePrefix = includeKode ? `[${row.kodeWilayah}] ` : '';
  const displayName = formatEntityDisplayName(row, includeWi);

  const ketuaText = row.ketuaNama
    ? `${row.ketuaNama}${row.ketuaWa ? ` (${row.ketuaWa})` : ''}`
    : row.ketuaWa || '-';
  const sekText = row.sekretarisNama
    ? `${row.sekretarisNama}${row.sekretarisWa ? ` (${row.sekretarisWa})` : ''}`
    : row.sekretarisWa || '-';

  if (mode === 'nama_saja') {
    return `${prefix}${kodePrefix}${displayName}`;
  }

  if (mode === 'ketua_saja') {
    return `${prefix}${kodePrefix}${displayName}\n   Ketua: ${ketuaText}`;
  }

  if (mode === 'sekretaris_saja') {
    return `${prefix}${kodePrefix}${displayName}\n   Sekretaris: ${sekText}`;
  }

  if (mode === 'ketua_sekretaris') {
    return `${prefix}${kodePrefix}${displayName}\n   Ketua: ${ketuaText}\n   Sekretaris: ${sekText}`;
  }

  // mode === 'lengkap'
  const wilayahTrail = [
    row.pulau,
    row.namaProvinsi,
    row.namaKabKota,
    row.namaKecamatan,
    row.namaKelDesa,
  ]
    .filter(Boolean)
    .join(' / ');
  const parts = [
    `${prefix}${kodePrefix}${displayName}`,
    `   Wilayah: ${wilayahTrail}`,
    `   Status: ${row.statusTerbentuk}`,
    `   Ketua: ${ketuaText}`,
    `   Sekretaris: ${sekText}`,
  ];
  if (row.alamatKantor) parts.push(`   Alamat: ${row.alamatKantor}`);
  if (row.tautanDrive) parts.push(`   Drive SK: ${row.tautanDrive}`);
  return parts.join('\n');
}

export function formatKelembagaanRowsText(
  rows: KelembagaanUnifiedRow[],
  mode: CopyFormatMode,
  options: {
    includeKode?: boolean;
    includeNumbering?: boolean;
    includeWi?: boolean;
    groupByParent?: boolean;
    headerTitle?: string;
  } = {},
): string {
  const {
    includeKode = false,
    includeNumbering = true,
    includeWi = false,
    groupByParent = true,
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
      'Nama',
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
        formatEntityDisplayName(r, includeWi),
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
      const entityLabel = formatEntityDisplayName(r, includeWi);
      if (r.ketuaWa && !waSet.has(r.ketuaWa)) {
        waSet.add(r.ketuaWa);
        lines.push(`${r.ketuaWa} (${r.ketuaNama || 'Ketua'} - ${entityLabel})`);
      }
      if (r.sekretarisWa && !waSet.has(r.sekretarisWa)) {
        waSet.add(r.sekretarisWa);
        lines.push(`${r.sekretarisWa} (${r.sekretarisNama || 'Sekretaris'} - ${entityLabel})`);
      }
    });
    return lines.join('\n');
  }

  const shouldGroup = groupByParent && rows.length > 1;
  let bodyText = '';

  if (shouldGroup) {
    const groups = new Map<string, KelembagaanUnifiedRow[]>();
    rows.forEach((r) => {
      const heading = getParentGroupHeading(r);
      const list = groups.get(heading);
      if (list) list.push(r);
      else groups.set(heading, [r]);
    });

    const sections: string[] = [];
    groups.forEach((groupRows, heading) => {
      const itemLines = groupRows.map((row, idx) =>
        formatSingleRowLines(row, mode, idx, {
          includeKode,
          includeNumbering,
          includeWi,
        }),
      );
      sections.push(`${heading}\n${itemLines.join('\n')}`);
    });
    bodyText = sections.join('\n\n');
  } else {
    bodyText = rows
      .map((row, idx) =>
        formatSingleRowLines(row, mode, idx, {
          includeKode,
          includeNumbering,
          includeWi,
        }),
      )
      .join('\n');
  }

  if (headerTitle.trim()) {
    return `${headerTitle.trim()}\n\n${bodyText}`;
  }
  return bodyText;
}

export function WilayahCopyModal({
  title,
  subtitle,
  rows,
  initialMode = 'ketua_sekretaris',
  defaultIncludeWi = false,
  defaultGroupByParent = true,
  onClose,
}: WilayahCopyModalProps) {
  const [mode, setMode] = useState<CopyFormatMode>(initialMode);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [groupByParent, setGroupByParent] = useState(defaultGroupByParent);
  const [includeWi, setIncludeWi] = useState(defaultIncludeWi);
  const [includeNumbering, setIncludeNumbering] = useState(true);
  const [includeKode, setIncludeKode] = useState(false);
  const [copied, setCopied] = useState(false);

  const generatedText = useMemo(
    () =>
      formatKelembagaanRowsText(rows, mode, {
        includeKode,
        includeNumbering,
        includeWi,
        groupByParent,
        headerTitle: mode === 'tsv_tabel' || mode === 'wa_saja' ? '' : title,
      }),
    [rows, mode, includeKode, includeNumbering, includeWi, groupByParent, title],
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#072B31]/50 p-4 backdrop-blur-sm dark:bg-black/70"
    >
      <div className="glass-surface-strong relative flex max-h-[90vh] w-full max-w-2xl flex-col bg-white p-6 dark:bg-[#0B2229]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup dialog salin"
          className="absolute top-4 right-4 cursor-pointer rounded-lg p-1.5 text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EBF5F8] text-[#0C7A89] dark:bg-[#113540] dark:text-[#3EC1D3]">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2
              id="copy-modal-title"
              className="text-base font-bold text-[#07525E] dark:text-[#E6F4F7]"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#9BB5BC]">
              {subtitle ||
                `${rows.length.toLocaleString('id-ID')} data terpilih siap disalin ke WhatsApp, dokumen, atau Excel.`}
            </p>
          </div>
        </div>

        {/* Mode selector */}
        <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl bg-[#EBF5F8]/80 p-1.5 dark:bg-[#0D2A33]">
          {MODE_LABELS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className={`shrink-0 cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                mode === item.id
                  ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                  : 'text-[#526A70] hover:text-[#07525E] dark:text-[#9BB5BC] dark:hover:text-[#E6F4F7]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Quick Toggles + Tombol Pengaturan */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-xs text-[#355158] dark:text-[#B4CCD3]">
            <button
              type="button"
              onClick={() => setIncludeWi((prev) => !prev)}
              className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                includeWi
                  ? 'border-[#0C7A89]/40 bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3]/45 dark:bg-[#113540] dark:text-[#3EC1D3]'
                  : 'border-[#07525E]/15 bg-white text-[#526A70] hover:text-[#07525E] dark:border-[#3EC1D3]/20 dark:bg-[#071A20] dark:text-[#9BB5BC] dark:hover:text-[#E6F4F7]'
              }`}
            >
              <span>{includeWi ? '✓ ' : ''}Sertakan "Wahdah Islamiyah"</span>
            </button>

            {mode !== 'tsv_tabel' && mode !== 'wa_saja' && (
              <button
                type="button"
                onClick={() => setGroupByParent((prev) => !prev)}
                className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  groupByParent
                    ? 'border-[#0C7A89]/40 bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3]/45 dark:bg-[#113540] dark:text-[#3EC1D3]'
                    : 'border-[#07525E]/15 bg-white text-[#526A70] hover:text-[#07525E] dark:border-[#3EC1D3]/20 dark:bg-[#071A20] dark:text-[#9BB5BC] dark:hover:text-[#E6F4F7]'
                }`}
              >
                <span>{groupByParent ? '✓ ' : ''}Kelompokkan per Induk</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setSettingsOpen((prev) => !prev)}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              settingsOpen
                ? 'border-[#0C7A89] bg-[#07525E] text-white dark:border-[#3EC1D3] dark:bg-[#0C7A89]'
                : 'border-[#07525E]/15 bg-white text-[#07525E] hover:bg-[#F4FAFB] dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7] dark:hover:bg-[#113540]'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Pengaturan</span>
          </button>
        </div>

        {/* Panel Pengaturan Detail */}
        {settingsOpen && (
          <div className="mt-2.5 rounded-xl border border-[#07525E]/12 bg-[#F4FAFB] p-3 text-xs text-[#355158] dark:border-[#3EC1D3]/20 dark:bg-[#0D2A33] dark:text-[#B4CCD3]">
            <div className="font-bold text-[#07525E] dark:text-[#E6F4F7]">Pengaturan Format Salin</div>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              {mode !== 'tsv_tabel' && mode !== 'wa_saja' && (
                <>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                    <input
                      type="checkbox"
                      checked={groupByParent}
                      onChange={(e) => setGroupByParent(e.target.checked)}
                      className="rounded border-[#07525E]/30 accent-[#0C7A89]"
                    />
                    <span>Kelompokkan per Induk (Pulau/Prov/Kab/Kec)</span>
                  </label>
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
                </>
              )}
              <label className="inline-flex cursor-pointer items-center gap-1.5 font-medium">
                <input
                  type="checkbox"
                  checked={includeWi}
                  onChange={(e) => setIncludeWi(e.target.checked)}
                  className="rounded border-[#07525E]/30 accent-[#0C7A89]"
                />
                <span>Tampilkan kata "Wahdah Islamiyah"</span>
              </label>
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="mt-3 flex-1 overflow-hidden">
          <textarea
            readOnly
            value={generatedText}
            rows={12}
            className="h-64 w-full resize-none rounded-xl border border-[#07525E]/15 bg-[#F8FBFC] p-3.5 font-mono text-xs leading-relaxed text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/20 dark:bg-[#071A20] dark:text-[#E6F4F7]"
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#07525E]/10 pt-3.5 dark:border-[#3EC1D3]/15">
          <span className="text-xs font-medium text-[#526A70] tabular-nums dark:text-[#9BB5BC]">
            Total {rows.length.toLocaleString('id-ID')} entri ·{' '}
            {generatedText.length.toLocaleString('id-ID')} karakter
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-[#526A70] hover:bg-[#F4FAFB] dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
            >
              Tutup
            </button>
            <button
              type="button"
              disabled={!generatedText}
              onClick={() => void handleCopy()}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-50"
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
