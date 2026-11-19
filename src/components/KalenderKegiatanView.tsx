import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Grid3X3,
  Image as ImageIcon,
  List,
  Search,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  KegiatanPolaJadwal,
  KegiatanRpkaItem,
  MusyawarahItem,
  PresensiItem,
  ProgramKerjaItem,
  UnitItem,
} from '../types/org';
import {
  BULAN_INDONESIA,
  BULAN_SINGKAT,
  expandKegiatanCalendarOccurrences,
  formatSpanReadable,
  formatTanggalIndonesia,
  formatUnitShortLabel,
  normalizePresensiStatus,
  parseIsoDateParts,
  resolveJenisKegiatan,
  resolvePolaJadwal,
  type CalendarOccurrence,
} from '../utils/scheduleParser';

interface KalenderKegiatanViewProps {
  prokerList: ProgramKerjaItem[];
  kegiatanList: KegiatanRpkaItem[];
  musyawarahList: MusyawarahItem[];
  presensiList: PresensiItem[];
  units: UnitItem[];
}

type CalendarDisplayMode = 'bulanan' | 'matriks' | 'agenda';
type CalendarCategory = 'Event' | 'Monev' | 'Musyawarah Pleno' | 'Musyawarah Unit';
type CalendarCategoryFilter =
  | 'ALL'
  | 'Event'
  | 'Monev'
  | 'MUSYAWARAH_ALL'
  | 'Musyawarah Pleno'
  | 'Musyawarah Unit';

interface UnifiedCalendarEntry {
  key: string;
  source: 'kegiatan' | 'musyawarah';
  category: CalendarCategory;
  title: string;
  subtitle: string;
  code: string;
  unitLabel: string;
  date: string; // YYYY-MM-DD (actual marked date on calendar)
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  dateNote: string; // e.g., "Hari ke-1 (1–30 Apr 2027)" or "Rutin Pekanan (#3)"
  tempat: string;
  kegiatan?: KegiatanRpkaItem;
  kegiatanOccurrence?: CalendarOccurrence;
  kegiatanPola?: KegiatanPolaJadwal;
  musyawarah?: MusyawarahItem;
}

const HARI_HEADER = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function formatRupiah(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(safe);
}

function getCategoryStyles(category: CalendarCategory): {
  chip: string;
  text: string;
  solidBg: string;
  softBg: string;
  dot: string;
} {
  switch (category) {
    case 'Event':
      return {
        chip: 'border-[#0C7A89]/30 bg-[#EBF5F8] text-[#07525E] hover:bg-[#D8EEF3] dark:border-[#38C6D9]/35 dark:bg-[#11313B] dark:text-[#DDF4F8] dark:hover:bg-[#17414E]',
        text: 'text-[#0C7A89] dark:text-[#38C6D9]',
        solidBg: 'bg-[#0C7A89] text-white',
        softBg: 'bg-[#0C7A89]/18 text-[#07525E] dark:bg-[#38C6D9]/22 dark:text-[#DDF4F8]',
        dot: 'bg-[#0C7A89] dark:bg-[#38C6D9]',
      };
    case 'Monev':
      return {
        chip: 'border-[#D88B15]/35 bg-[#FFF8EB] text-[#8E5606] hover:bg-[#FEECC8] dark:border-[#F0A93B]/35 dark:bg-[#2F200A] dark:text-[#FAD796] dark:hover:bg-[#3F2C0E]',
        text: 'text-[#B46E09] dark:text-[#F0A93B]',
        solidBg: 'bg-[#D88B15] text-white',
        softBg: 'bg-[#D88B15]/20 text-[#8E5606] dark:bg-[#F0A93B]/25 dark:text-[#FAD796]',
        dot: 'bg-[#D88B15] dark:bg-[#F0A93B]',
      };
    case 'Musyawarah Pleno':
      return {
        chip: 'border-indigo-500/35 bg-indigo-50 text-indigo-900 hover:bg-indigo-100 dark:border-indigo-400/35 dark:bg-indigo-950/75 dark:text-indigo-200 dark:hover:bg-indigo-900/75',
        text: 'text-indigo-700 dark:text-indigo-300',
        solidBg: 'bg-indigo-600 text-white',
        softBg: 'bg-indigo-500/20 text-indigo-800 dark:bg-indigo-400/25 dark:text-indigo-200',
        dot: 'bg-indigo-600 dark:bg-indigo-400',
      };
    case 'Musyawarah Unit':
      return {
        chip: 'border-emerald-500/35 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-400/35 dark:bg-emerald-950/75 dark:text-emerald-200 dark:hover:bg-emerald-900/75',
        text: 'text-emerald-700 dark:text-emerald-300',
        solidBg: 'bg-emerald-600 text-white',
        softBg: 'bg-emerald-500/20 text-emerald-800 dark:bg-emerald-400/25 dark:text-emerald-200',
        dot: 'bg-emerald-600 dark:bg-emerald-400',
      };
  }
}

export function KalenderKegiatanView({
  prokerList,
  kegiatanList,
  musyawarahList,
  presensiList,
  units,
}: KalenderKegiatanViewProps) {
  const [displayMode, setDisplayMode] = useState<CalendarDisplayMode>('bulanan');
  const [selectedYear, setSelectedYear] = useState<number>(2027);
  const [selectedMonth, setSelectedMonth] = useState<number>(0); // 0 = Semua Bulan
  const [calendarGridMonth, setCalendarGridMonth] = useState<number>(1); // 1-12
  const [filterCategory, setFilterCategory] = useState<CalendarCategoryFilter>('ALL');
  const [filterProker, setFilterProker] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailEntry, setDetailEntry] = useState<UnifiedCalendarEntry | null>(null);

  const unitMap = useMemo(() => {
    const map = new Map<string, UnitItem>();
    units.forEach((u) => map.set(u.id, u));
    return map;
  }, [units]);

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

  const presensiByMsy = useMemo(() => {
    const map = new Map<string, PresensiItem[]>();
    presensiList.forEach((p) => {
      const list = map.get(p.musyawarahId);
      if (list) list.push(p);
      else map.set(p.musyawarahId, [p]);
    });
    return map;
  }, [presensiList]);

  // Gabungkan seluruh kejadian Kegiatan RPKA (hari ke-1 untuk non-berulang, setiap tanggal untuk berulang) + Musyawarah (Pleno & Unit)
  const allEntries = useMemo<UnifiedCalendarEntry[]>(() => {
    const result: UnifiedCalendarEntry[] = [];

    kegiatanList.forEach((item) => {
      const jenis = resolveJenisKegiatan(item);
      const pola = resolvePolaJadwal(item);
      const unitKode = item.unitPj || unitCodeByProker.get(item.kodeProker) || item.kodeProker;
      const occurrences = expandKegiatanCalendarOccurrences(item);

      occurrences.forEach((occ, idx) => {
        let dateNote = 'Pelaksanaan 1 hari';
        if (occ.isRecurring) {
          const polaLabel =
            occ.pola === 'Pekanan'
              ? 'Pekanan'
              : occ.pola === 'DwiPekanan'
                ? '2 Pekanan'
                : 'Bulanan';
          dateNote = `Berulang ${polaLabel} · Sesi #${occ.sequenceNumber}`;
        } else if (occ.span.durationDays > 1) {
          dateNote = `Hari ke-1 dari ${occ.span.durationDays} hari (${formatSpanReadable(occ.span)})`;
        }

        result.push({
          key: `keg-${item.kodeKegiatan}-${occ.date}-${idx}`,
          source: 'kegiatan',
          category: jenis,
          title: item.namaKegiatan,
          subtitle: item.namaProker,
          code: item.kodeKegiatan,
          unitLabel: unitKode,
          date: occ.date,
          year: occ.year,
          month: occ.month,
          day: occ.day,
          dateNote,
          tempat: item.tempat || '-',
          kegiatan: item,
          kegiatanOccurrence: occ,
          kegiatanPola: pola,
        });
      });
    });

    musyawarahList.forEach((msy) => {
      const parts = parseIsoDateParts(msy.tanggal);
      if (!parts) return;
      const unitObj = msy.unitId ? unitMap.get(msy.unitId) : undefined;
      const unitShort = msy.jenis === 'Unit' ? formatUnitShortLabel(unitObj) : 'Seluruh Pengurus';
      const category: CalendarCategory =
        msy.jenis === 'Pleno' ? 'Musyawarah Pleno' : 'Musyawarah Unit';
      const keLabel = `Ke-${msy.musyawarahKe || 1}`;
      const displayTitle =
        msy.judul?.trim() ||
        (msy.jenis === 'Pleno'
          ? `Musyawarah Pleno ${keLabel}`
          : `Musyawarah ${unitShort} ${keLabel}`);

      result.push({
        key: `msy-${msy.id}`,
        source: 'musyawarah',
        category,
        title: displayTitle,
        subtitle:
          msy.jenis === 'Pleno'
            ? `Musyawarah Pleno ${keLabel} · Seluruh Pengurus`
            : `Musyawarah ${unitShort} ${keLabel}`,
        code: `${msy.jenis === 'Pleno' ? 'PLENO' : unitShort.toUpperCase()} #${msy.musyawarahKe || 1}`,
        unitLabel: unitShort,
        date: msy.tanggal,
        year: parts.y,
        month: parts.m,
        day: parts.d,
        dateNote: `Musyawarah ${msy.jenis} ${keLabel}`,
        tempat: msy.tempat || 'Online',
        musyawarah: msy,
      });
    });

    return result.sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return a.title.localeCompare(b.title, 'id');
    });
  }, [kegiatanList, musyawarahList, unitCodeByProker, unitMap]);

  // Daftar tahun yang tersedia
  const availableYears = useMemo(() => {
    const set = new Set<number>([2026, 2027, new Date().getFullYear()]);
    allEntries.forEach((e) => set.add(e.year));
    return Array.from(set).sort((a, b) => a - b);
  }, [allEntries]);

  // Filter dasar (Kategori, Proker, Pencarian, Tahun)
  const yearFilteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allEntries.filter((entry) => {
      if (entry.year !== selectedYear) return false;
      if (filterCategory === 'Event' && entry.category !== 'Event') return false;
      if (filterCategory === 'Monev' && entry.category !== 'Monev') return false;
      if (
        filterCategory === 'MUSYAWARAH_ALL' &&
        entry.source !== 'musyawarah'
      ) {
        return false;
      }
      if (
        filterCategory === 'Musyawarah Pleno' &&
        entry.category !== 'Musyawarah Pleno'
      ) {
        return false;
      }
      if (
        filterCategory === 'Musyawarah Unit' &&
        entry.category !== 'Musyawarah Unit'
      ) {
        return false;
      }
      if (filterProker !== 'ALL') {
        if (entry.source !== 'kegiatan' || entry.kegiatan?.kodeProker !== filterProker) {
          return false;
        }
      }
      if (q) {
        const hay = `${entry.code} ${entry.title} ${entry.subtitle} ${entry.category} ${entry.unitLabel} ${entry.tempat} ${entry.date}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allEntries, selectedYear, filterCategory, filterProker, searchQuery]);

  // Jumlah penanda per bulan
  const monthCounts = useMemo(() => {
    const counts: number[] = Array(12).fill(0);
    yearFilteredEntries.forEach((e) => {
      if (e.month >= 1 && e.month <= 12) {
        counts[e.month - 1] += 1;
      }
    });
    return counts;
  }, [yearFilteredEntries]);

  const activeGridMonth = selectedMonth > 0 ? selectedMonth : calendarGridMonth;

  // KPI Ringkas
  const kpi = useMemo(() => {
    const scoped =
      displayMode === 'bulanan'
        ? yearFilteredEntries.filter((e) => e.month === activeGridMonth)
        : selectedMonth > 0
          ? yearFilteredEntries.filter((e) => e.month === selectedMonth)
          : yearFilteredEntries;

    const eventCount = scoped.filter((e) => e.category === 'Event').length;
    const monevCount = scoped.filter((e) => e.category === 'Monev').length;
    const plenoCount = scoped.filter((e) => e.category === 'Musyawarah Pleno').length;
    const unitMsyCount = scoped.filter((e) => e.category === 'Musyawarah Unit').length;

    return {
      total: scoped.length,
      eventCount,
      monevCount,
      plenoCount,
      unitMsyCount,
    };
  }, [yearFilteredEntries, displayMode, activeGridMonth, selectedMonth]);

  // Grid Kalender Bulanan (1–31)
  const calendarCells = useMemo(() => {
    const firstDayOfWeek = new Date(selectedYear, activeGridMonth - 1, 1).getDay();
    const daysInMonth = new Date(selectedYear, activeGridMonth, 0).getDate();
    const cells: { day: number | null; items: UnifiedCalendarEntry[] }[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: null, items: [] });
    }

    const monthItems = yearFilteredEntries.filter((e) => e.month === activeGridMonth);
    for (let day = 1; day <= daysInMonth; day++) {
      const dayItems = monthItems.filter((e) => e.day === day);
      cells.push({ day, items: dayItems });
    }

    return cells;
  }, [yearFilteredEntries, selectedYear, activeGridMonth]);

  // Daftar Matriks 12 Bulan (dikelompokkan per item unik: kegiatan atau musyawarah)
  const matrixRows = useMemo(() => {
    const map = new Map<
      string,
      {
        rowKey: string;
        category: CalendarCategory;
        code: string;
        title: string;
        unitLabel: string;
        entriesByMonth: Map<number, UnifiedCalendarEntry[]>;
        sampleEntry: UnifiedCalendarEntry;
      }
    >();

    yearFilteredEntries.forEach((entry) => {
      const rowKey =
        entry.source === 'kegiatan' && entry.kegiatan
          ? `keg-${entry.kegiatan.kodeKegiatan}`
          : entry.key;

      let group = map.get(rowKey);
      if (!group) {
        group = {
          rowKey,
          category: entry.category,
          code: entry.code,
          title: entry.title,
          unitLabel: entry.unitLabel,
          entriesByMonth: new Map(),
          sampleEntry: entry,
        };
        map.set(rowKey, group);
      }
      const list = group.entriesByMonth.get(entry.month);
      if (list) list.push(entry);
      else group.entriesByMonth.set(entry.month, [entry]);
    });

    return Array.from(map.values());
  }, [yearFilteredEntries]);

  // Daftar Agenda Kronologis
  const agendaRows = useMemo(() => {
    return selectedMonth > 0
      ? yearFilteredEntries.filter((e) => e.month === selectedMonth)
      : yearFilteredEntries;
  }, [yearFilteredEntries, selectedMonth]);

  const handleSelectMonthFilter = (m: number) => {
    setSelectedMonth(m);
    if (m > 0) {
      setCalendarGridMonth(m);
    }
  };

  const handleShiftMonth = (delta: number) => {
    let nextMonth = activeGridMonth + delta;
    let nextYear = selectedYear;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setSelectedYear(nextYear);
    setCalendarGridMonth(nextMonth);
    if (selectedMonth > 0) {
      setSelectedMonth(nextMonth);
    }
  };

  const detailMsyStats = useMemo(() => {
    if (!detailEntry?.musyawarah) return null;
    const entries = presensiByMsy.get(detailEntry.musyawarah.id) || [];
    let hadir = 0;
    let tidakHadir = 0;
    let izinSebelum = 0;
    let izinSetelah = 0;
    entries.forEach((e) => {
      const st = normalizePresensiStatus(e.status);
      if (st === 'Hadir') hadir += 1;
      else if (st === 'Tidak Hadir') tidakHadir += 1;
      else if (st === 'Izin Sebelum Rapat') izinSebelum += 1;
      else izinSetelah += 1;
    });
    return {
      total: entries.length,
      hadir,
      tidakHadir,
      izinSebelum,
      izinSetelah,
    };
  }, [detailEntry, presensiByMsy]);

  return (
    <section className="duwd-container px-2 py-6 sm:px-4 lg:py-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold text-[#0C7A89] dark:text-[#38C6D9]">
            Sinkronisasi Jadwal RPKA &amp; Musyawarah &middot; DUWD DPP Wahdah Islamiyah
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] dark:text-[#E6F4F7] sm:text-3xl">
            Kalender Kegiatan &amp; Musyawarah
          </h1>
          <p className="mt-1 text-sm text-[#526A70] dark:text-[#93B1B9]">
            Kegiatan multi-hari ditandai pada hari pertamanya saja; kegiatan berulang (pekanan/bulanan) ditandai tiap tanggalnya, terintegrasi dengan Musyawarah Pleno &amp; Unit.
          </p>
        </div>

        {/* Mode Tampilan */}
        <div className="inline-flex flex-wrap gap-1 rounded-xl bg-[#EBF5F8]/90 p-1 dark:bg-[#102A32]">
          <button
            type="button"
            onClick={() => setDisplayMode('bulanan')}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              displayMode === 'bulanan'
                ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#173944] dark:text-[#E6F4F7]'
                : 'text-[#526A70] hover:text-[#07525E] dark:text-[#93B1B9] dark:hover:text-[#E6F4F7]'
            }`}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            <span>Kalender Bulanan</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('matriks')}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              displayMode === 'matriks'
                ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#173944] dark:text-[#E6F4F7]'
                : 'text-[#526A70] hover:text-[#07525E] dark:text-[#93B1B9] dark:hover:text-[#E6F4F7]'
            }`}
          >
            <Grid3X3 className="h-3.5 w-3.5" />
            <span>Matriks 12 Bulan</span>
          </button>

          <button
            type="button"
            onClick={() => setDisplayMode('agenda')}
            className={`inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
              displayMode === 'agenda'
                ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#173944] dark:text-[#E6F4F7]'
                : 'text-[#526A70] hover:text-[#07525E] dark:text-[#93B1B9] dark:hover:text-[#E6F4F7]'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            <span>Daftar Agenda</span>
          </button>
        </div>
      </div>

      {/* KPI Strip — 4 Kategori Berbeda Warna */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="glass-surface px-4 py-3.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#0C7A89] dark:bg-[#38C6D9]" />
            <span>Kegiatan Event</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-[#0C7A89] dark:text-[#38C6D9] tabular-nums">
            {kpi.eventCount}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#84A4AC]">
            Warna Teal &middot; Agenda utama &amp; forum
          </div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#D88B15] dark:bg-[#F0A93B]" />
            <span>Kegiatan Monev</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-[#B46E09] dark:text-[#F0A93B] tabular-nums">
            {kpi.monevCount}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#84A4AC]">
            Warna Amber &middot; Monitoring &amp; evaluasi
          </div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
            <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            <span>Musyawarah Pleno</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
            {kpi.plenoCount}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#84A4AC]">
            Warna Indigo &middot; Seluruh pengurus
          </div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#526A70] dark:text-[#93B1B9]">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
            <span>Musyawarah Unit</span>
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
            {kpi.unitMsyCount}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187] dark:text-[#84A4AC]">
            Warna Hijau &middot; PI hingga Unit 5
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mt-5 glass-surface p-4 space-y-3.5">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-12">
          <div className="relative lg:col-span-4">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B8187] dark:text-[#84A4AC]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kegiatan, musyawarah, unit, tempat..."
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2.5 pr-4 pl-10 text-xs text-[#0F2429] placeholder:text-[#7D9197] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#EAF4F6] dark:placeholder:text-[#6E8E97]"
            />
          </div>

          <div className="lg:col-span-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Filter Tahun"
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  Tahun {yr}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={selectedMonth}
              onChange={(e) => handleSelectMonthFilter(Number(e.target.value))}
              aria-label="Filter Bulan"
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]"
            >
              <option value={0}>Semua Bulan</option>
              {BULAN_INDONESIA.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name} ({monthCounts[i]})
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as CalendarCategoryFilter)}
              aria-label="Filter Jenis Kegiatan dan Musyawarah"
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]"
            >
              <option value="ALL">Semua Kategori</option>
              <option value="Event">Event Saja</option>
              <option value="Monev">Monev Saja</option>
              <option value="MUSYAWARAH_ALL">Semua Musyawarah</option>
              <option value="Musyawarah Pleno">Musyawarah Pleno</option>
              <option value="Musyawarah Unit">Musyawarah Unit</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <select
              value={filterProker}
              onChange={(e) => setFilterProker(e.target.value)}
              aria-label="Filter Program Kerja"
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none dark:border-[#38C6D9]/20 dark:bg-[#0B1C22] dark:text-[#D9EEF2]"
            >
              <option value="ALL">Semua Program</option>
              {prokerList.map((p) => (
                <option key={p.kodeProker} value={p.kodeProker}>
                  {p.kodeProker} · {unitCodeByProker.get(p.kodeProker)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Strip Pilih Bulan Cepat */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleSelectMonthFilter(0)}
            className={`cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
              selectedMonth === 0 && displayMode !== 'bulanan'
                ? 'bg-[#07525E] text-white'
                : 'bg-[#EBF5F8]/80 text-[#3D575E] hover:bg-[#DCEEF4] dark:bg-[#102A32] dark:text-[#9FC1CA] dark:hover:bg-[#173944]'
            }`}
          >
            Semua
          </button>
          {BULAN_SINGKAT.map((shortName, idx) => {
            const mNum = idx + 1;
            const isActive =
              displayMode === 'bulanan' ? activeGridMonth === mNum : selectedMonth === mNum;
            return (
              <button
                key={shortName}
                type="button"
                onClick={() => handleSelectMonthFilter(mNum)}
                className={`cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors tabular-nums ${
                  isActive
                    ? 'bg-[#0C7A89] text-white'
                    : 'bg-[#EBF5F8]/80 text-[#3D575E] hover:bg-[#DCEEF4] dark:bg-[#102A32] dark:text-[#9FC1CA] dark:hover:bg-[#173944]'
                }`}
              >
                {shortName} ({monthCounts[idx]})
              </button>
            );
          })}
        </div>
      </div>

      {/* MODE 1: KALENDER BULANAN (GRID 1-31) */}
      {displayMode === 'bulanan' && (
        <div className="mt-5 glass-surface-strong overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 bg-[#F4FAFB] px-5 py-3.5 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleShiftMonth(-1)}
                aria-label="Bulan sebelumnya"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#07525E]/15 bg-white text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#D9EEF2]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h2 className="min-w-[165px] text-center text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                {BULAN_INDONESIA[activeGridMonth - 1]} {selectedYear}
              </h2>
              <button
                type="button"
                onClick={() => handleShiftMonth(1)}
                aria-label="Bulan berikutnya"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-[#07525E]/15 bg-white text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#D9EEF2]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Legenda 4 Warna */}
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 text-[#0C7A89] dark:text-[#38C6D9]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0C7A89] dark:bg-[#38C6D9]" />
                Event
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#B46E09] dark:text-[#F0A93B]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#D88B15] dark:bg-[#F0A93B]" />
                Monev
              </span>
              <span className="inline-flex items-center gap-1.5 text-indigo-700 dark:text-indigo-300">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                Musyawarah Pleno
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                Musyawarah Unit
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 border-b border-[#07525E]/10 bg-[#F8FBFC] text-center text-[11px] font-bold text-[#526A70] uppercase dark:border-[#38C6D9]/15 dark:bg-[#0C2128] dark:text-[#93B1B9]">
                {HARI_HEADER.map((h) => (
                  <div key={h} className="py-2.5">
                    {h}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 divide-x divide-y divide-[#07525E]/10 dark:divide-[#38C6D9]/12">
                {calendarCells.map((cell, idx) => (
                  <div
                    key={idx}
                    className={`min-h-[118px] p-2 ${
                      cell.day === null
                        ? 'bg-[#F4FAFB]/60 dark:bg-[#09181D]/60'
                        : 'bg-white/75 dark:bg-[#0D2127]/65'
                    }`}
                  >
                    {cell.day !== null && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-medium text-[#6B8187] dark:text-[#7D9CA4]">
                            {cell.items.length > 0 ? `${cell.items.length} agenda` : ''}
                          </span>
                          <span className="font-mono text-xs font-bold text-[#526A70] dark:text-[#93B1B9] tabular-nums">
                            {cell.day}
                          </span>
                        </div>
                        <div className="mt-1.5 space-y-1">
                          {cell.items.map((entry) => {
                            const styles = getCategoryStyles(entry.category);
                            return (
                              <button
                                key={entry.key}
                                type="button"
                                onClick={() => setDetailEntry(entry)}
                                title={`${entry.category}: ${entry.title} — ${entry.dateNote}`}
                                className={`block w-full cursor-pointer rounded-lg border px-2 py-1 text-left text-[11px] font-semibold leading-snug transition-colors ${styles.chip}`}
                              >
                                <div className="truncate">{entry.title}</div>
                                <div className="truncate text-[9.5px] font-medium opacity-80">
                                  {entry.source === 'musyawarah'
                                    ? entry.category === 'Musyawarah Pleno'
                                      ? `Pleno Ke-${entry.musyawarah?.musyawarahKe || 1}`
                                      : `${entry.unitLabel} Ke-${entry.musyawarah?.musyawarahKe || 1}`
                                    : entry.kegiatanOccurrence?.isRecurring
                                      ? `${entry.category} · Rutin #${entry.kegiatanOccurrence.sequenceNumber}`
                                      : entry.kegiatanOccurrence && entry.kegiatanOccurrence.span.durationDays > 1
                                        ? `${entry.category} · Hari 1/${entry.kegiatanOccurrence.span.durationDays}`
                                        : entry.category}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: MATRIKS 12 BULAN (JAN–DES) */}
      {displayMode === 'matriks' && (
        <div className="mt-5 glass-surface-strong overflow-hidden">
          {matrixRows.length === 0 ? (
            <div className="px-6 py-14 text-center text-xs text-[#526A70] dark:text-[#93B1B9]">
              Belum ada kegiatan atau musyawarah terjadwal pada tahun {selectedYear} untuk filter ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="duwd-zebra-table w-full min-w-[1040px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold text-[#355158] uppercase dark:border-[#38C6D9]/15 dark:bg-[#0B1E24] dark:text-[#9FC1CA]">
                    <th className="w-[300px] px-4 py-3.5">Agenda &amp; Kategori</th>
                    {BULAN_SINGKAT.map((b, i) => (
                      <th key={b} className="w-[56px] px-2 py-3.5 text-center">
                        <div>{b}</div>
                        <div className="mt-0.5 text-[10px] font-normal opacity-75 tabular-nums">
                          ({monthCounts[i]})
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#07525E]/8 dark:divide-[#38C6D9]/10">
                  {matrixRows.map((row) => {
                    const styles = getCategoryStyles(row.category);
                    return (
                      <tr
                        key={row.rowKey}
                        onClick={() => setDetailEntry(row.sampleEntry)}
                        className="cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="font-mono font-bold text-[#07525E] dark:text-[#D9EEF2]">
                              {row.code}
                            </span>
                            <span aria-hidden="true">&middot;</span>
                            <span className={`font-bold ${styles.text}`}>
                              {row.category}
                            </span>
                            <span aria-hidden="true">&middot;</span>
                            <span className="text-[#526A70] dark:text-[#93B1B9]">
                              {row.unitLabel}
                            </span>
                          </div>
                          <div className="mt-0.5 font-semibold text-[#0F2429] dark:text-[#EAF4F6]">
                            {row.title}
                          </div>
                        </td>
                        {BULAN_SINGKAT.map((b, mIdx) => {
                          const mNum = mIdx + 1;
                          const hits = row.entriesByMonth.get(mNum) || [];
                          return (
                            <td key={b} className="px-1.5 py-2 text-center">
                              {hits.length > 0 ? (
                                <div
                                  title={hits
                                    .map((h) => `${formatTanggalIndonesia(h.date)} (${h.dateNote})`)
                                    .join(', ')}
                                  className={`mx-auto flex h-7 w-full items-center justify-center rounded-md text-[10px] font-bold tabular-nums ${styles.solidBg}`}
                                >
                                  {hits.length === 1 ? hits[0].day : `${hits.length}x`}
                                </div>
                              ) : (
                                <span className="text-[#526A70]/25 dark:text-white/15">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODE 3: DAFTAR AGENDA KRONOLOGIS */}
      {displayMode === 'agenda' && (
        <div className="mt-5 glass-surface-strong overflow-hidden">
          {agendaRows.length === 0 ? (
            <div className="px-6 py-14 text-center text-xs text-[#526A70] dark:text-[#93B1B9]">
              Tidak ada kegiatan atau musyawarah terjadwal untuk kombinasi filter bulan, tahun, dan kategori ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="duwd-zebra-table w-full min-w-[880px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold text-[#355158] uppercase dark:border-[#38C6D9]/15 dark:bg-[#0B1E24] dark:text-[#9FC1CA]">
                    <th className="w-[195px] px-4 py-3.5">Tanggal Ditandai</th>
                    <th className="w-[150px] px-4 py-3.5">Kategori</th>
                    <th className="px-4 py-3.5">Agenda Kegiatan / Musyawarah</th>
                    <th className="w-[140px] px-4 py-3.5">Tempat</th>
                    <th className="w-[125px] px-4 py-3.5">Unit / Lingkup</th>
                    <th className="w-[95px] px-4 py-3.5 text-right">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#07525E]/8 dark:divide-[#38C6D9]/10">
                  {agendaRows.map((entry) => {
                    const styles = getCategoryStyles(entry.category);
                    return (
                      <tr key={entry.key} className="align-top transition-colors">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7] tabular-nums">
                            {formatTanggalIndonesia(entry.date)}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#93B1B9]">
                            {entry.dateNote}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 font-bold ${styles.text}`}>
                            <span className={`h-2 w-2 rounded-full ${styles.dot}`} />
                            <span>{entry.category}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="text-[13px] font-bold text-[#0F2429] dark:text-[#EAF4F6]">
                            {entry.title}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#93B1B9]">
                            <span className="font-mono">{entry.code}</span> &middot; {entry.subtitle}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-[#355158] dark:text-[#B5CDD2]">
                          {entry.tempat}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-[#07525E] dark:text-[#D9EEF2]">
                          {entry.unitLabel}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => setDetailEntry(entry)}
                            className="cursor-pointer rounded-lg border border-[#07525E]/15 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#38C6D9]/20 dark:bg-[#0F242B] dark:text-[#D9EEF2] dark:hover:bg-[#173944]"
                          >
                            Detail
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Detail Kegiatan / Musyawarah */}
      {detailEntry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="kalender-detail-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#042D35]/55 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong relative max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
            <button
              type="button"
              onClick={() => setDetailEntry(null)}
              aria-label="Tutup detail"
              className="absolute top-4 right-4 cursor-pointer rounded-lg p-1.5 text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#93B1B9] dark:hover:bg-[#173944]"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono font-bold text-[#0C7A89] dark:text-[#38C6D9]">
                {detailEntry.code}
              </span>
              <span aria-hidden="true" className="text-[#526A70]">&middot;</span>
              <span className={`font-bold ${getCategoryStyles(detailEntry.category).text}`}>
                {detailEntry.category}
              </span>
              <span aria-hidden="true" className="text-[#526A70]">&middot;</span>
              <span className="font-semibold text-[#526A70] dark:text-[#93B1B9]">
                {detailEntry.unitLabel}
              </span>
            </div>

            <h2
              id="kalender-detail-title"
              className="mt-1 pr-8 text-lg font-bold text-[#07525E] dark:text-[#E6F4F7]"
            >
              {detailEntry.title}
            </h2>
            <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#93B1B9]">
              {detailEntry.subtitle}
            </p>

            {/* Konten Detail Kegiatan RPKA */}
            {detailEntry.source === 'kegiatan' && detailEntry.kegiatan && (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 sm:col-span-2 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
                    <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">Tujuan</div>
                    <p className="mt-1 leading-relaxed text-[#355158] dark:text-[#B5CDD2]">
                      {detailEntry.kegiatan.tujuan}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
                    <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">Sasaran</div>
                    <p className="mt-1 text-[#355158] dark:text-[#B5CDD2]">
                      {detailEntry.kegiatan.sasaran}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
                    <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">Indikator</div>
                    <p className="mt-1 text-[#355158] dark:text-[#B5CDD2]">
                      {detailEntry.kegiatan.indikator}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
                    <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">Tempat</div>
                    <p className="mt-1 text-[#355158] dark:text-[#B5CDD2]">
                      {detailEntry.kegiatan.tempat}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
                    <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                      Jadwal Pelaksanaan
                    </div>
                    <p className="mt-1 text-[#355158] dark:text-[#B5CDD2]">
                      {detailEntry.kegiatan.waktu}
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-[#0C7A89] dark:text-[#38C6D9]">
                      {detailEntry.dateNote}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#07525E]/10 bg-[#ECF6F2] p-3.5 dark:border-emerald-500/20 dark:bg-[#0E2B26]">
                    <div className="font-semibold text-emerald-900 dark:text-emerald-300">
                      Rencana Pendapatan
                    </div>
                    <p className="mt-1 font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {formatRupiah(detailEntry.kegiatan.pendapatan)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#D88B15]/20 bg-[#FFF9EE] p-3.5 dark:border-[#F0A93B]/25 dark:bg-[#2F210A]">
                    <div className="font-semibold text-[#9A6008] dark:text-[#FAD48E]">
                      Rencana Belanja
                    </div>
                    <p className="mt-1 font-mono text-sm font-bold text-[#9A6008] dark:text-[#F0A93B] tabular-nums">
                      {formatRupiah(detailEntry.kegiatan.belanja)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between gap-2">
                  {detailEntry.kegiatan.tautanDrive ? (
                    <a
                      href={detailEntry.kegiatan.tautanDrive}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0C7A89] hover:underline dark:text-[#38C6D9]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Buka Berkas Google Drive</span>
                    </a>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={() => setDetailEntry(null)}
                    className="cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Tutup
                  </button>
                </div>
              </>
            )}

            {/* Konten Detail Musyawarah */}
            {detailEntry.source === 'musyawarah' && detailEntry.musyawarah && (
              <>
                <div className="mt-4 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                  <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
                    <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                      Tanggal Pelaksanaan
                    </div>
                    <p className="mt-1 font-semibold text-[#355158] dark:text-[#D9EEF2]">
                      {formatTanggalIndonesia(detailEntry.musyawarah.tanggal)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
                    <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                      Musyawarah Ke &amp; Lingkup
                    </div>
                    <p className="mt-1 text-[#355158] dark:text-[#D9EEF2]">
                      Musyawarah {detailEntry.musyawarah.jenis} Ke-
                      {detailEntry.musyawarah.musyawarahKe || 1} ({detailEntry.unitLabel})
                    </p>
                  </div>
                  {detailMsyStats && (
                    <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 sm:col-span-2 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
                      <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                        Ringkasan Presensi ({detailMsyStats.total} Peserta Tercatat)
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg bg-emerald-50 px-2.5 py-2 dark:bg-emerald-950/50">
                          <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            Hadir
                          </div>
                          <div className="font-mono text-sm font-bold text-emerald-800 dark:text-emerald-200 tabular-nums">
                            {detailMsyStats.hadir}
                          </div>
                        </div>
                        <div className="rounded-lg bg-red-50 px-2.5 py-2 dark:bg-red-950/50">
                          <div className="text-[10px] font-semibold text-red-700 dark:text-red-300">
                            Tidak Hadir
                          </div>
                          <div className="font-mono text-sm font-bold text-red-800 dark:text-red-200 tabular-nums">
                            {detailMsyStats.tidakHadir}
                          </div>
                        </div>
                        <div className="rounded-lg bg-[#EBF5F8] px-2.5 py-2 dark:bg-[#10323C]">
                          <div className="text-[10px] font-semibold text-[#0C7A89] dark:text-[#38C6D9]">
                            Izin Sebelum Rapat
                          </div>
                          <div className="font-mono text-sm font-bold text-[#07525E] dark:text-[#E6F4F7] tabular-nums">
                            {detailMsyStats.izinSebelum}
                          </div>
                        </div>
                        <div className="rounded-lg bg-[#FFF8EB] px-2.5 py-2 dark:bg-[#2F200A]">
                          <div className="text-[10px] font-semibold text-[#B46E09] dark:text-[#F0A93B]">
                            Izin Setelah Rapat
                          </div>
                          <div className="font-mono text-sm font-bold text-[#8E5606] dark:text-[#FAD796] tabular-nums">
                            {detailMsyStats.izinSetelah}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {detailEntry.musyawarah.notulaTeks && (
                    <div className="rounded-xl border border-[#07525E]/10 bg-white/80 p-3.5 sm:col-span-2 dark:border-[#38C6D9]/15 dark:bg-[#0B1E24]">
                      <div className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                        Ringkasan Notula
                      </div>
                      <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed text-[#355158] dark:text-[#B5CDD2]">
                        {detailEntry.musyawarah.notulaTeks}
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {(detailEntry.musyawarah.notulaFileUrl || detailEntry.musyawarah.tautanDrive) && (
                      <a
                        href={
                          detailEntry.musyawarah.notulaFileUrl ||
                          detailEntry.musyawarah.tautanDrive
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#0C7A89]/25 bg-[#EBF5F8] px-3 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4] dark:border-[#38C6D9]/30 dark:bg-[#10323C] dark:text-[#E6F4F7]"
                      >
                        <FileText className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#38C6D9]" />
                        <span>Buka Notula (Drive)</span>
                      </a>
                    )}
                    {detailEntry.musyawarah.dokumentasiFileUrl && (
                      <a
                        href={detailEntry.musyawarah.dokumentasiFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/25 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-400/30 dark:bg-emerald-950/60 dark:text-emerald-200"
                      >
                        <ImageIcon className="h-3.5 w-3.5" />
                        <span>Buka Dokumentasi (Drive)</span>
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailEntry(null)}
                    className="cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white"
                  >
                    Tutup
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
