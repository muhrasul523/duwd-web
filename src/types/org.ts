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

export interface AppSettings {
  namaAplikasi: string;
  logoDataUrl: string;
  rpkaDriveUrl: string;
  gasWebAppUrl: string;
}

export interface OrgDataset {
  units: UnitItem[];
  pengurus: PengurusItem[];
  proker: ProgramKerjaItem[];
  kegiatan: KegiatanRpkaItem[];
  settings: {
    namaAplikasi: string;
    logoDataUrl: string;
    rpkaDriveUrl: string;
  };
}
