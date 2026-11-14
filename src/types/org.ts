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
  dibuatPada: string;
  diperbaruiPada: string;
}

export interface AppSettings {
  namaAplikasi: string;
  logoDataUrl: string;
  gasWebAppUrl: string;
}

export interface OrgDataset {
  units: UnitItem[];
  pengurus: PengurusItem[];
  settings: {
    namaAplikasi: string;
    logoDataUrl: string;
  };
}
