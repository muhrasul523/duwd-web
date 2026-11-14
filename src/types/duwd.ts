export type Agenda4MType = 'Muswil' | 'Mukerwil' | 'Musda' | 'Mukerda';

export type Agenda4MStatus = 'Terjadwal' | 'Persiapan' | 'Terlaksana';

export type ConsolidationStatus = 'Terkonsolidasi' | 'Pendampingan' | 'Pembentukan';

export type DriveFileFormat =
  | 'PDF'
  | 'PPT'
  | 'DOCX'
  | 'Gambar'
  | 'Audio'
  | 'Video'
  | 'Arsip';

export interface RegionRecord {
  kodeDpw: string;
  namaDpw: string;
  ketuaDpw: string;
  jumlahDpd: number;
  statusKonsolidasi: ConsolidationStatus;
  kesiapan4MPersen: number;
  kontakSekretariat: string;
}

export interface Agenda4MItem {
  id: string;
  jenis: Agenda4MType;
  judul: string;
  wilayah: string;
  tanggalPelaksanaan: string;
  lokasi: string;
  status: Agenda4MStatus;
  progresPersen: number;
  skDriveUrl?: string;
}

export interface CadreLevelRecord {
  kodeDpw: string;
  namaDpw: string;
  tarif: number;
  takwin: number;
  tanfidz: number;
  murabbi: number;
  totalAktif: number;
  periodeUpdate: string;
}

export interface DriveAsset {
  id: string;
  driveFileId: string;
  judul: string;
  kategori: string;
  format: DriveFileFormat;
  unitDpw: string;
  ukuranTeks: string;
  urlAsli: string;
  urlPratinjau: string;
  urlUnduh: string;
  diunggahPada: string;
}

export interface KhidmatPayload {
  nama: string;
  asalUnit: string;
  kontak: string;
  kategori: string;
  perihal: string;
  detail: string;
  driveUrl?: string;
}

export interface KhidmatReceipt {
  ticketId: string;
  tanggalMasuk: string;
  nama: string;
  asalUnit: string;
  kategori: string;
  perihal: string;
  status: string;
}

export interface GasEndpointConfig {
  webAppUrl: string;
  driveRootFolderUrl: string;
  apiToken: string;
}

export interface GasApiResponse<T = unknown> {
  ok: boolean;
  action?: string;
  data?: T;
  count?: number;
  ticketId?: string;
  message?: string;
  error?: string;
  timestamp?: string;
}
