import type {
  JenisMusyawarah,
  KegiatanJenis,
  KegiatanPolaJadwal,
  KegiatanRpkaItem,
  PresensiStatus,
  UnitItem,
} from '../types/org';

export interface ScheduleSpan {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startYear: number;
  startMonth: number; // 1-12
  startDay: number; // 1-31
  endYear: number;
  endMonth: number; // 1-12
  endDay: number; // 1-31
  durationDays: number;
  isLongRunning: boolean;
}

export interface CalendarOccurrence {
  date: string; // YYYY-MM-DD
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  span: ScheduleSpan;
  isRecurring: boolean;
  pola: KegiatanPolaJadwal;
  sequenceNumber: number;
}

export const BULAN_INDONESIA = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const BULAN_SINGKAT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

export const MUSYAWARAH_DRIVE_FOLDER_ID = '1Ua_AgStLPfpH5xfFIfqXZkOVwJgCLG98';
export const MUSYAWARAH_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1Ua_AgStLPfpH5xfFIfqXZkOVwJgCLG98?usp=drive_link';

/**
 * Normalisasi status presensi musyawarah (4 status resmi tanpa Sakit & Alpa).
 */
export function normalizePresensiStatus(raw?: string): PresensiStatus {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'hadir') return 'Hadir';
  if (val === 'izin sebelum rapat' || val === 'izin' || val === 'sakit') {
    return 'Izin Sebelum Rapat';
  }
  if (val === 'izin setelah rapat') {
    return 'Izin Setelah Rapat';
  }
  if (val === 'tidak hadir' || val === 'tanpa keterangan' || val === 'alpa') {
    return 'Tidak Hadir';
  }
  return 'Hadir';
}

/**
 * Menentukan jenis kegiatan (Monev vs Event) secara konsisten.
 */
export function resolveJenisKegiatan(
  item: Pick<KegiatanRpkaItem, 'jenisKegiatan' | 'namaKegiatan' | 'kodeProker'>,
): KegiatanJenis {
  if (item.jenisKegiatan === 'Monev' || item.jenisKegiatan === 'Event') {
    return item.jenisKegiatan;
  }
  const nama = (item.namaKegiatan || '').toLowerCase();
  if (
    nama.includes('monev') ||
    nama.includes('monitoring') ||
    nama.includes('pengontrolan dan evaluasi')
  ) {
    return 'Monev';
  }
  return 'Event';
}

/**
 * Menentukan pola pengulangan jadwal (Tunggal, Pekanan, DwiPekanan, Bulanan).
 */
export function resolvePolaJadwal(
  item: Pick<KegiatanRpkaItem, 'polaJadwal' | 'waktu'>,
): KegiatanPolaJadwal {
  if (
    item.polaJadwal === 'Tunggal' ||
    item.polaJadwal === 'Pekanan' ||
    item.polaJadwal === 'DwiPekanan' ||
    item.polaJadwal === 'Bulanan'
  ) {
    return item.polaJadwal;
  }
  const w = (item.waktu || '').toLowerCase();
  if (w.includes('2 pekan') || w.includes('dwi pekan') || w.includes('dwipekanan')) {
    return 'DwiPekanan';
  }
  if (
    w.includes('setiap pekan') ||
    w.includes('tiap pekan') ||
    w.includes('pekanan') ||
    w.includes('mingguan') ||
    w.includes('weekly')
  ) {
    return 'Pekanan';
  }
  if (
    w.includes('setiap bulan') ||
    w.includes('tiap bulan') ||
    w.includes('bulanan') ||
    w.includes('monthly')
  ) {
    return 'Bulanan';
  }
  return 'Tunggal';
}

export function parseIsoDateParts(iso: string): { y: number; m: number; d: number } | null {
  const match = (iso || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function toIsoDate(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function diffDays(a: { y: number; m: number; d: number }, b: { y: number; m: number; d: number }): number {
  const msA = Date.UTC(a.y, a.m - 1, a.d);
  const msB = Date.UTC(b.y, b.m - 1, b.d);
  return Math.max(1, Math.round((msB - msA) / 86400000) + 1);
}

/**
 * Mengurai string waktu pelaksanaan seperti:
 * - "2027-03-21 - 2027-03-21"
 * - "2027-02-01 - 2027-02-01, 2027-10-01 - 2027-10-01"
 * - "2027-01-01 - 2027-11-30"
 */
export function parseKegiatanSpans(waktuRaw: string): ScheduleSpan[] {
  const raw = (waktuRaw || '').trim();
  if (!raw || raw === '-') return [];

  const segments = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const spans: ScheduleSpan[] = [];

  segments.forEach((seg) => {
    const dates = seg.match(/\d{4}-\d{2}-\d{2}/g);
    if (!dates || dates.length === 0) return;

    const startStr = dates[0];
    const endStr = dates[1] || dates[0];
    const s = parseIsoDateParts(startStr);
    const e = parseIsoDateParts(endStr);
    if (!s || !e) return;

    const startMs = Date.UTC(s.y, s.m - 1, s.d);
    const endMs = Date.UTC(e.y, e.m - 1, e.d);
    const orderedStart = startMs <= endMs ? s : e;
    const orderedEnd = startMs <= endMs ? e : s;
    const orderedStartStr = startMs <= endMs ? startStr : endStr;
    const orderedEndStr = startMs <= endMs ? endStr : startStr;
    const durationDays = diffDays(orderedStart, orderedEnd);

    spans.push({
      startDate: orderedStartStr,
      endDate: orderedEndStr,
      startYear: orderedStart.y,
      startMonth: orderedStart.m,
      startDay: orderedStart.d,
      endYear: orderedEnd.y,
      endMonth: orderedEnd.m,
      endDay: orderedEnd.d,
      durationDays,
      isLongRunning: durationDays > 45,
    });
  });

  return spans;
}

/**
 * Menghasilkan daftar tanggal aktual yang ditandai di kalender:
 * - Kegiatan non-berulang (Tunggal): walau berlangsung 2 hari atau lebih, HANYA hari pertamanya (startDate) yang ditandai di kalender.
 * - Kegiatan berulang (Pekanan / DwiPekanan / Bulanan): ditandai satu per satu di setiap tanggal kejadiannya hingga endDate.
 */
export function expandKegiatanCalendarOccurrences(
  item: Pick<KegiatanRpkaItem, 'waktu' | 'polaJadwal'>,
): CalendarOccurrence[] {
  const spans = parseKegiatanSpans(item.waktu);
  const pola = resolvePolaJadwal(item);
  const occurrences: CalendarOccurrence[] = [];
  let seq = 0;

  spans.forEach((span) => {
    if (pola === 'Tunggal') {
      seq += 1;
      occurrences.push({
        date: span.startDate,
        year: span.startYear,
        month: span.startMonth,
        day: span.startDay,
        span,
        isRecurring: false,
        pola,
        sequenceNumber: seq,
      });
      return;
    }

    const startMs = Date.UTC(span.startYear, span.startMonth - 1, span.startDay);
    const endMs = Date.UTC(span.endYear, span.endMonth - 1, span.endDay);

    if (pola === 'Pekanan' || pola === 'DwiPekanan') {
      const stepDays = pola === 'Pekanan' ? 7 : 14;
      let cursorMs = startMs;
      let guard = 0;
      while (cursorMs <= endMs && guard < 120) {
        const dt = new Date(cursorMs);
        const y = dt.getUTCFullYear();
        const m = dt.getUTCMonth() + 1;
        const d = dt.getUTCDate();
        seq += 1;
        occurrences.push({
          date: toIsoDate(y, m, d),
          year: y,
          month: m,
          day: d,
          span,
          isRecurring: true,
          pola,
          sequenceNumber: seq,
        });
        cursorMs += stepDays * 86400000;
        guard += 1;
      }
      return;
    }

    if (pola === 'Bulanan') {
      let y = span.startYear;
      let m = span.startMonth;
      let guard = 0;
      while (guard < 60) {
        const daysInTargetMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const d = Math.min(span.startDay, daysInTargetMonth);
        const cursorMs = Date.UTC(y, m - 1, d);
        if (cursorMs > endMs) break;
        seq += 1;
        occurrences.push({
          date: toIsoDate(y, m, d),
          year: y,
          month: m,
          day: d,
          span,
          isRecurring: true,
          pola,
          sequenceNumber: seq,
        });
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
        guard += 1;
      }
    }
  });

  return occurrences;
}

export function spanOverlapsMonth(span: ScheduleSpan, year: number, month1To12: number): boolean {
  const spanStart = Date.UTC(span.startYear, span.startMonth - 1, span.startDay);
  const spanEnd = Date.UTC(span.endYear, span.endMonth - 1, span.endDay);
  const monthStart = Date.UTC(year, month1To12 - 1, 1);
  const monthEnd = Date.UTC(year, month1To12, 0);
  return spanStart <= monthEnd && spanEnd >= monthStart;
}

export function spanOverlapsYear(span: ScheduleSpan, year: number): boolean {
  return span.startYear <= year && span.endYear >= year;
}

export function spanContainsDate(span: ScheduleSpan, year: number, month1To12: number, day: number): boolean {
  const target = Date.UTC(year, month1To12 - 1, day);
  const spanStart = Date.UTC(span.startYear, span.startMonth - 1, span.startDay);
  const spanEnd = Date.UTC(span.endYear, span.endMonth - 1, span.endDay);
  return target >= spanStart && target <= spanEnd;
}

export function formatTanggalIndonesia(isoDate: string): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return isoDate || '-';
  return `${parts.d} ${BULAN_INDONESIA[parts.m - 1]} ${parts.y}`;
}

/**
 * Format tanggal untuk nama file Google Drive: "5 Nov 2026"
 */
export function formatTanggalFileDrive(isoDate: string): string {
  const parts = parseIsoDateParts(isoDate);
  if (!parts) return isoDate || 'Tanggal';
  return `${parts.d} ${BULAN_SINGKAT[parts.m - 1]} ${parts.y}`;
}

/**
 * Label singkat unit untuk judul & nama file musyawarah (PI, Unit 1, Unit 2, ..., Unit 5).
 */
export function formatUnitShortLabel(unit?: UnitItem | null): string {
  if (!unit) return 'Unit';
  if (unit.urutan === 0 || unit.kodeUnit.toUpperCase() === 'PI') {
    return 'PI';
  }
  return `Unit ${unit.urutan} ${unit.kodeUnit}`;
}

/**
 * Format resmi nama file Google Drive:
 * "{jenis musyawarah} {musyawarah ke} {tanggal, format 5 Nov 2026}"
 * Contoh:
 * - "Musyawarah Pleno 3 5 Nov 2026"
 * - "Musyawarah Unit PI 2 5 Nov 2026"
 * - "Musyawarah Unit 1 4 5 Nov 2026"
 */
export function buildMusyawarahFileBaseName(params: {
  jenis: JenisMusyawarah;
  musyawarahKe: number;
  tanggal: string;
  unit?: UnitItem | null;
}): string {
  const ke = Math.min(52, Math.max(1, Math.round(Number(params.musyawarahKe) || 1)));
  const tgl = formatTanggalFileDrive(params.tanggal);
  if (params.jenis === 'Pleno') {
    return `Musyawarah Pleno ${ke} ${tgl}`;
  }
  const unitTag = params.unit
    ? params.unit.urutan === 0 || params.unit.kodeUnit.toUpperCase() === 'PI'
      ? 'Unit PI'
      : `Unit ${params.unit.urutan}`
    : 'Unit';
  return `Musyawarah ${unitTag} ${ke} ${tgl}`;
}

export function formatSpanReadable(span: ScheduleSpan): string {
  if (span.startDate === span.endDate) {
    return formatTanggalIndonesia(span.startDate);
  }
  if (span.startYear === span.endYear && span.startMonth === span.endMonth) {
    return `${span.startDay}–${span.endDay} ${BULAN_INDONESIA[span.startMonth - 1]} ${span.startYear}`;
  }
  if (span.startYear === span.endYear) {
    return `${span.startDay} ${BULAN_SINGKAT[span.startMonth - 1]} – ${span.endDay} ${BULAN_SINGKAT[span.endMonth - 1]} ${span.startYear}`;
  }
  return `${formatTanggalIndonesia(span.startDate)} – ${formatTanggalIndonesia(span.endDate)}`;
}
