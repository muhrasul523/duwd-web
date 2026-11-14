import type { DriveFileFormat, GasEndpointConfig } from '../types/duwd';

const GAS_CONFIG_STORAGE_KEY = 'duwd_gas_endpoint_config_v1';

export const DEFAULT_GAS_CONFIG: GasEndpointConfig = {
  webAppUrl: (import.meta.env.VITE_GAS_WEBAPP_URL as string | undefined) || '',
  driveRootFolderUrl:
    (import.meta.env.VITE_DUWD_DRIVE_ROOT_URL as string | undefined) ||
    'https://drive.google.com/drive/folders/DUWD-DPP-WAHDAH-2030',
  apiToken: '',
};

export function loadGasConfig(): GasEndpointConfig {
  try {
    const raw = window.localStorage.getItem(GAS_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_GAS_CONFIG;
    const parsed = JSON.parse(raw) as Partial<GasEndpointConfig>;
    return {
      webAppUrl: parsed.webAppUrl ?? DEFAULT_GAS_CONFIG.webAppUrl,
      driveRootFolderUrl: parsed.driveRootFolderUrl ?? DEFAULT_GAS_CONFIG.driveRootFolderUrl,
      apiToken: parsed.apiToken ?? DEFAULT_GAS_CONFIG.apiToken,
    };
  } catch {
    return DEFAULT_GAS_CONFIG;
  }
}

export function saveGasConfig(config: GasEndpointConfig): void {
  try {
    window.localStorage.setItem(GAS_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors in restricted iframe environments
  }
}

/**
 * Mengekstrak Google Drive File ID atau Folder ID dari berbagai bentuk tautan Drive/Docs.
 */
export function extractGoogleDriveId(urlOrId: string): string {
  const clean = urlOrId.trim();
  if (!clean) return '';

  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{12,})/,
    /\/folders\/([a-zA-Z0-9_-]{12,})/,
    /[?&]id=([a-zA-Z0-9_-]{12,})/,
    /^([a-zA-Z0-9_-]{12,})$/,
  ];

  for (const regex of patterns) {
    const match = clean.match(regex);
    if (match?.[1]) {
      return match[1];
    }
  }
  return '';
}

/**
 * Menghasilkan URL tampilan, URL embed pratinjau iframe, dan URL unduhan langsung Google Drive.
 */
export function buildDriveAccessLinks(urlOrId: string): {
  fileId: string;
  viewUrl: string;
  previewUrl: string;
  downloadUrl: string;
  isFolder: boolean;
} {
  const isFolder = urlOrId.includes('/folders/');
  const fileId = extractGoogleDriveId(urlOrId);

  if (!fileId) {
    return {
      fileId: '',
      viewUrl: urlOrId.trim(),
      previewUrl: '',
      downloadUrl: '',
      isFolder: false,
    };
  }

  if (isFolder) {
    return {
      fileId,
      viewUrl: `https://drive.google.com/drive/folders/${fileId}?usp=sharing`,
      previewUrl: `https://drive.google.com/embeddedfolderview?id=${fileId}#list`,
      downloadUrl: `https://drive.google.com/drive/folders/${fileId}?usp=sharing`,
      isFolder: true,
    };
  }

  return {
    fileId,
    viewUrl: `https://drive.google.com/file/d/${fileId}/view?usp=sharing`,
    previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
    downloadUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    isFolder: false,
  };
}

export const DRIVE_FORMAT_OPTIONS: DriveFileFormat[] = [
  'PDF',
  'PPT',
  'DOCX',
  'Gambar',
  'Audio',
  'Video',
  'Arsip',
];

export const DRIVE_CATEGORY_OPTIONS: string[] = [
  'Pedoman & Tata Kelola',
  'Materi Muswil & Mukerwil',
  'Template Administrasi 4M',
  'Dokumentasi Visual & Infografis',
  'Taujih & Audio Rapat',
  'Arsip Terkompresi',
];
