export type UserRole = 'publik' | 'admin' | 'superadmin';

export type ThemePreference = 'system' | 'light' | 'dark';

export type ViewportMode = 'desktop' | 'tablet' | 'mobile';

export interface UnitItem {
  id: string;
  kodeUnit: string;
  namaUnit: string;
  urutan: number;
  aktif: boolean;
}

export interface PengurusItem {
  id: string;
  namaLengkap: string;
  namaPanggilan: string;
  whatsapp: string;
  unitId: string;
  namaUnit: string;
  amanah: string;
  dibuatPada: string;
  diperbaruiPada: string;
}

export interface ProgramKerjaItem {
  kodeProker: string;
  namaProker: string;
  tahun: string;
  unitPj?: string;
}

export type KegiatanStatus = 'Rencana' | 'Berjalan' | 'Terlaksana';

export type KegiatanJenis = 'Event' | 'Monev';

export type KegiatanPolaJadwal = 'Tunggal' | 'Pekanan' | 'DwiPekanan' | 'Bulanan';

export interface KegiatanRpkaItem {
  kodeKegiatan: string;
  kodeProker: string;
  namaProker: string;
  namaKegiatan: string;
  tujuan: string;
  sasaran: string;
  indikator: string;
  tempat: string;
  waktu: string;
  pendapatan: number;
  belanja: number;
  unitPj?: string;
  status?: KegiatanStatus;
  jenisKegiatan?: KegiatanJenis;
  polaJadwal?: KegiatanPolaJadwal;
  tautanDrive?: string;
}

export type JenisMusyawarah = 'Pleno' | 'Unit';

export type PresensiStatus =
  | 'Hadir'
  | 'Tidak Hadir'
  | 'Izin Sebelum Rapat'
  | 'Izin Setelah Rapat';

export type NotulaMode = 'file' | 'teks' | '';

export interface MusyawarahItem {
  id: string;
  judul: string;
  jenis: JenisMusyawarah;
  musyawarahKe: number; // 1 - 52
  unitId?: string;
  namaUnit?: string;
  tanggal: string; // YYYY-MM-DD
  waktuMulai?: string; // HH:mm (opsional)
  waktuSelesai?: string; // HH:mm (opsional)
  tempat?: string;
  pimpinanRapat?: string;
  notulaMode?: NotulaMode;
  notulaTeks?: string;
  notulaFileName?: string;
  notulaFileUrl?: string;
  notulaFileId?: string;
  dokumentasiFileName?: string;
  dokumentasiFileUrl?: string;
  dokumentasiFileId?: string;
  dokumentasiPreviewUrl?: string; // fallback preview lokal / thumbnail Drive
  notulensiRingkas?: string;
  tautanDrive?: string;
  pesertaTambahanIds: string[];
  dibuatPada?: string;
  diperbaruiPada?: string;
}

export interface PresensiItem {
  id: string;
  musyawarahId: string;
  pengurusId: string;
  namaLengkap: string;
  unitKode: string;
  amanah: string;
  sumberPeserta: 'Wajib' | 'Tambahan';
  status: PresensiStatus;
  keterangan?: string;
  diperbaruiPada?: string;
}

export type TingkatWilayah = 'Pulau' | 'Provinsi' | 'KabKota' | 'Kecamatan' | 'KelDesa';

export interface KodeWilayahItem {
  kodeWilayah: string;
  tingkat: TingkatWilayah;
  pulau: string;
  kodeProvinsi: string;
  namaProvinsi: string;
  kodeKabKota?: string;
  namaKabKota?: string;
  kodeKecamatan?: string;
  namaKecamatan?: string;
  namaKelDesa?: string;
  parentKode?: string;
}

export type StatusTerbentuk = 'Sudah Terbentuk' | 'Belum Terbentuk';

export type JenisLembaga = 'DPW' | 'DPD' | 'DPC' | 'DPR';

export interface DpwItem {
  id: string;
  kodeWilayah: string;
  pulau: string;
  namaDpw: string;
  namaProvinsi: string;
  statusTerbentuk: StatusTerbentuk;
  ketuaNama: string;
  ketuaWa: string;
  sekretarisNama: string;
  sekretarisWa: string;
  alamatKantor?: string;
  tautanDrive?: string;
  diperbaruiPada?: string;
}

export interface DpdItem {
  id: string;
  kodeWilayah: string;
  kodeProvinsi: string;
  pulau: string;
  namaProvinsi: string;
  namaDpd: string;
  namaKabKota: string;
  statusTerbentuk: StatusTerbentuk;
  ketuaNama: string;
  ketuaWa: string;
  sekretarisNama: string;
  sekretarisWa: string;
  alamatKantor?: string;
  tautanDrive?: string;
  diperbaruiPada?: string;
}

export interface DpcItem {
  id: string;
  kodeWilayah: string;
  kodeKabKota: string;
  kodeProvinsi: string;
  pulau: string;
  namaProvinsi: string;
  namaKabKota: string;
  namaKecamatan: string;
  namaDpc: string;
  statusTerbentuk: StatusTerbentuk;
  ketuaNama: string;
  ketuaWa: string;
  sekretarisNama: string;
  sekretarisWa: string;
  alamatKantor?: string;
  tautanDrive?: string;
  diperbaruiPada?: string;
}

export interface DprItem {
  id: string;
  kodeWilayah: string;
  kodeKecamatan: string;
  kodeKabKota: string;
  kodeProvinsi: string;
  pulau: string;
  namaProvinsi: string;
  namaKabKota: string;
  namaKecamatan: string;
  namaKelDesa: string;
  namaDpr: string;
  statusTerbentuk: StatusTerbentuk;
  ketuaNama: string;
  ketuaWa: string;
  sekretarisNama: string;
  sekretarisWa: string;
  alamatKantor?: string;
  tautanDrive?: string;
  diperbaruiPada?: string;
}

export interface KelembagaanUnifiedRow {
  jenis: JenisLembaga;
  id?: string;
  kodeWilayah: string;
  pulau: string;
  kodeProvinsi: string;
  namaProvinsi: string;
  kodeKabKota?: string;
  namaKabKota?: string;
  kodeKecamatan?: string;
  namaKecamatan?: string;
  namaKelDesa?: string;
  namaLembaga: string;
  namaWilayah: string;
  statusTerbentuk: StatusTerbentuk;
  ketuaNama: string;
  ketuaWa: string;
  sekretarisNama: string;
  sekretarisWa: string;
  alamatKantor?: string;
  tautanDrive?: string;
  diperbaruiPada?: string;
  hasSheetRecord: boolean;
}

export interface AppSettings {
  namaAplikasi: string;
  logoDataUrl: string;
  rpkaDriveUrl: string;
  wilayahSpreadsheetId: string;
  gasWebAppUrl: string;
}

export interface OrgDataset {
  units: UnitItem[];
  pengurus: PengurusItem[];
  proker: ProgramKerjaItem[];
  kegiatan: KegiatanRpkaItem[];
  musyawarah: MusyawarahItem[];
  presensi: PresensiItem[];
  kodeWilayah: KodeWilayahItem[];
  dpw: DpwItem[];
  dpd: DpdItem[];
  dpc: DpcItem[];
  dpr: DprItem[];
  wilayahConnected: boolean;
  settings: {
    namaAplikasi: string;
    logoDataUrl: string;
    rpkaDriveUrl: string;
    wilayahSpreadsheetId: string;
  };
}
