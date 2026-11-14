export type UserRole = 'publik' | 'admin' | 'superadmin';

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
  tautanDrive?: string;
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

export type StatusTerbentuk = 'Sudah Terbentuk' | 'Persiapan' | 'Belum Terbentuk';

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
