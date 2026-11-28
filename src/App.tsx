import { AlertTriangle, X } from 'lucide-react';
import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { BroadcastView } from './components/BroadcastView';
import { DokumenView } from './components/DokumenView';
import { DpwDpdView } from './components/DpwDpdView';
import { KalenderKegiatanView } from './components/KalenderKegiatanView';
import { LoginModal } from './components/LoginModal';
import { MusyawarahView } from './components/MusyawarahView';
import { PendataanPengurusView } from './components/PendataanPengurusView';
import { PengurusDirectory } from './components/PengurusDirectory';
import { ProkerRpkaView } from './components/ProkerRpkaView';
import { SuperAdminSettings } from './components/SuperAdminSettings';
import { TopBar, type ActiveView } from './components/TopBar';
import { UnitManager } from './components/UnitManager';
import {
  DEFAULT_BROADCAST_CONFIG,
  fetchAllOrgData,
  fetchPrivatePengurusAndBroadcast,
  loadLocalBroadcastQueue,
  loadLocalDokumenFile,
  loadLocalDokumenKategori,
  loadLocalDokumenSubkategori,
  loadLocalDpc,
  loadLocalDpd,
  loadLocalDpr,
  loadLocalDpw,
  loadLocalKegiatan,
  loadLocalKodeWilayah,
  loadLocalMusyawarah,
  loadLocalPengurus,
  loadLocalPresensi,
  loadLocalProker,
  loadLocalSettings,
  loadLocalUnits,
  loadLocalWaGroups,
  saveLocalBroadcastQueue,
  saveLocalDokumenFile,
  saveLocalDokumenKategori,
  saveLocalDokumenSubkategori,
  saveLocalDpc,
  saveLocalDpd,
  saveLocalDpr,
  saveLocalDpw,
  saveLocalKegiatan,
  saveLocalKodeWilayah,
  saveLocalMusyawarah,
  saveLocalPengurus,
  saveLocalPresensi,
  saveLocalUnits,
  saveLocalWaGroups,
} from './services/orgService';
import type {
  BroadcastConfigStatus,
  BroadcastItem,
  DokumenFileItem,
  DokumenKategoriItem,
  DokumenSubkategoriItem,
  DpcItem,
  DpdItem,
  DprItem,
  DpwItem,
  KegiatanRpkaItem,
  KodeWilayahItem,
  MusyawarahItem,
  PengurusItem,
  PresensiItem,
  ProgramKerjaItem,
  ThemePreference,
  UnitItem,
  UserRole,
  ViewportMode,
  WaGroupItem,
} from './types/org';
import { applyBrowserFavicon } from './utils/whatsapp';

const THEME_STORAGE_KEY = 'duwd_theme_pref_v1';
const VIEWPORT_STORAGE_KEY = 'duwd_viewport_mode_v1';
const WIDTH_PCT_STORAGE_KEY = 'duwd_screen_width_pct_v1';

function loadInitialTheme(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // ignore
  }
  return 'system';
}

function loadInitialViewport(): ViewportMode {
  try {
    const raw = localStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (raw === 'desktop' || raw === 'tablet' || raw === 'mobile') return raw;
  } catch {
    // ignore
  }
  return 'desktop';
}

function loadInitialScreenWidthPct(): number {
  try {
    const raw = Number(localStorage.getItem(WIDTH_PCT_STORAGE_KEY));
    if (Number.isFinite(raw) && raw >= 60 && raw <= 100) return Math.round(raw);
  } catch {
    // ignore
  }
  return 95;
}

function isPendataanLocation(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '').toLowerCase();
  const hash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '').toLowerCase();
  return path.endsWith('/data-pengurus') || hash === '/data-pengurus' || hash === 'data-pengurus';
}

export default function App() {
  const initialSettings = loadLocalSettings();

  const [isPendataanRoute, setIsPendataanRoute] = useState<boolean>(() => isPendataanLocation());
  const [role, setRole] = useState<UserRole>('publik');
  const [activePin, setActivePin] = useState('');
  const [activeView, setActiveView] = useState<ActiveView>('direktori');
  const [loginOpen, setLoginOpen] = useState(false);

  // Theme (default: system) & Viewport preview (default: desktop 95% layar)
  const [themePref, setThemePref] = useState<ThemePreference>(loadInitialTheme);
  const [viewportMode, setViewportMode] = useState<ViewportMode>(loadInitialViewport);
  const [screenWidthPct, setScreenWidthPct] = useState<number>(loadInitialScreenWidthPct);

  const [namaAplikasi, setNamaAplikasi] = useState(initialSettings.namaAplikasi);
  const [logoDataUrl, setLogoDataUrl] = useState(initialSettings.logoDataUrl);
  const [rpkaDriveUrl, setRpkaDriveUrl] = useState(initialSettings.rpkaDriveUrl);
  const [wilayahSpreadsheetId, setWilayahSpreadsheetId] = useState(
    initialSettings.wilayahSpreadsheetId,
  );
  const [webAppUrl, setWebAppUrl] = useState(initialSettings.gasWebAppUrl);
  const [wilayahConnected, setWilayahConnected] = useState(false);
  const [syncError, setSyncError] = useState('');

  const [units, setUnits] = useState<UnitItem[]>(() => loadLocalUnits());
  const [pengurusList, setPengurusList] = useState<PengurusItem[]>(() => loadLocalPengurus());
  const [prokerList, setProkerList] = useState<ProgramKerjaItem[]>(() => loadLocalProker());
  const [kegiatanList, setKegiatanList] = useState<KegiatanRpkaItem[]>(() => loadLocalKegiatan());
  const [musyawarahList, setMusyawarahList] = useState<MusyawarahItem[]>(() =>
    loadLocalMusyawarah(),
  );
  const [presensiList, setPresensiList] = useState<PresensiItem[]>(() => loadLocalPresensi());
  const [kodeWilayahList, setKodeWilayahList] = useState<KodeWilayahItem[]>(() =>
    loadLocalKodeWilayah(),
  );
  const [dpwList, setDpwList] = useState<DpwItem[]>(() => loadLocalDpw());
  const [dpdList, setDpdList] = useState<DpdItem[]>(() => loadLocalDpd());
  const [dpcList, setDpcList] = useState<DpcItem[]>(() => loadLocalDpc());
  const [dprList, setDprList] = useState<DprItem[]>(() => loadLocalDpr());
  const [dokumenKategoriList, setDokumenKategoriList] = useState<DokumenKategoriItem[]>(() =>
    loadLocalDokumenKategori(),
  );
  const [dokumenSubkategoriList, setDokumenSubkategoriList] = useState<DokumenSubkategoriItem[]>(
    () => loadLocalDokumenSubkategori(),
  );
  const [dokumenFileList, setDokumenFileList] = useState<DokumenFileItem[]>(() =>
    loadLocalDokumenFile(),
  );
  const [waGroups, setWaGroups] = useState<WaGroupItem[]>(() => loadLocalWaGroups());
  const [broadcastQueue, setBroadcastQueue] = useState<BroadcastItem[]>(() =>
    loadLocalBroadcastQueue(),
  );
  const [broadcastConfig, setBroadcastConfig] = useState<BroadcastConfigStatus>(
    DEFAULT_BROADCAST_CONFIG,
  );
  const [loadingBroadcastData, setLoadingBroadcastData] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Deteksi perubahan URL browser (/data-pengurus)
  useEffect(() => {
    const syncRoute = () => setIsPendataanRoute(isPendataanLocation());
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const navigateToPendataan = () => {
    try {
      window.history.pushState({}, '', '/data-pengurus');
    } catch {
      window.location.hash = '#/data-pengurus';
    }
    setIsPendataanRoute(true);
  };

  const navigateBackToPortal = () => {
    try {
      window.history.pushState({}, '', '/');
    } catch {
      window.location.hash = '';
    }
    setIsPendataanRoute(false);
  };

  // Apply Dark / Light / System preference to <html>
  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themePref);
    } catch {
      // ignore
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => {
      const shouldBeDark =
        themePref === 'dark' || (themePref === 'system' && mediaQuery.matches);
      document.documentElement.classList.toggle('dark', shouldBeDark);
      document.documentElement.style.colorScheme = shouldBeDark ? 'dark' : 'light';
    };

    applyTheme();

    if (themePref === 'system') {
      mediaQuery.addEventListener('change', applyTheme);
      return () => mediaQuery.removeEventListener('change', applyTheme);
    }
    return undefined;
  }, [themePref]);

  // Persist viewport mode & desktop screen width percentage
  useEffect(() => {
    try {
      localStorage.setItem(VIEWPORT_STORAGE_KEY, viewportMode);
    } catch {
      // ignore
    }
  }, [viewportMode]);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_PCT_STORAGE_KEY, String(screenWidthPct));
    } catch {
      // ignore
    }
  }, [screenWidthPct]);

  useEffect(() => {
    applyBrowserFavicon(logoDataUrl);
  }, [logoDataUrl]);

  useEffect(() => {
    document.title = namaAplikasi || 'DUWD DPP WI';
  }, [namaAplikasi]);

  const syncFromSheet = useCallback(async () => {
    if (!webAppUrl.trim()) return;
    setSyncing(true);
    setSyncError('');
    try {
      const { dataset, synced, error } = await fetchAllOrgData(webAppUrl);
      if (synced) {
        setUnits(dataset.units);
        setPengurusList(dataset.pengurus);
        setProkerList(dataset.proker);
        setKegiatanList(dataset.kegiatan);
        setMusyawarahList(dataset.musyawarah);
        setPresensiList(dataset.presensi);
        setKodeWilayahList(dataset.kodeWilayah);
        setDpwList(dataset.dpw);
        setDpdList(dataset.dpd);
        setDpcList(dataset.dpc);
        setDprList(dataset.dpr);
        setDokumenKategoriList(dataset.dokumenKategori);
        setDokumenSubkategoriList(dataset.dokumenSubkategori);
        setDokumenFileList(dataset.dokumenFile);
        setWilayahConnected(dataset.wilayahConnected);

        if (dataset.settings.namaAplikasi) {
          setNamaAplikasi(dataset.settings.namaAplikasi);
        }
        if (dataset.settings.logoDataUrl) {
          setLogoDataUrl(dataset.settings.logoDataUrl);
        }
        if (dataset.settings.rpkaDriveUrl !== undefined) {
          setRpkaDriveUrl(dataset.settings.rpkaDriveUrl);
        }
        if (dataset.settings.wilayahSpreadsheetId !== undefined) {
          setWilayahSpreadsheetId(dataset.settings.wilayahSpreadsheetId);
        }
      } else if (error) {
        setSyncError(error);
      }
    } finally {
      setSyncing(false);
    }
  }, [webAppUrl]);

  const syncPrivateAndBroadcast = useCallback(
    async (pinOverride?: string) => {
      const effectivePin = (pinOverride ?? activePin).trim();
      if (!effectivePin) return;
      setLoadingBroadcastData(true);
      try {
        const res = await fetchPrivatePengurusAndBroadcast(effectivePin, webAppUrl);
        if (res.ok) {
          if (res.pengurus && res.pengurus.length > 0) {
            setPengurusList(res.pengurus);
          }
          setWaGroups(res.waGroups);
          setBroadcastQueue(res.broadcastQueue);
          setBroadcastConfig(res.broadcastConfig);
        }
      } finally {
        setLoadingBroadcastData(false);
      }
    },
    [activePin, webAppUrl],
  );

  useEffect(() => {
    void syncFromSheet();
  }, [syncFromSheet]);

  useEffect(() => {
    if ((role === 'admin' || role === 'superadmin') && activePin) {
      void syncPrivateAndBroadcast(activePin);
    }
  }, [role, activePin, syncPrivateAndBroadcast]);

  const handleLoginSuccess = (nextRole: UserRole, pin: string) => {
    setRole(nextRole);
    setActivePin(pin);
    setLoginOpen(false);
  };

  const handleLogout = () => {
    setRole('publik');
    setActivePin('');
    // Hapus data privat email & rekening dari state publik saat keluar
    setPengurusList((prev) =>
      prev.map((p) => ({
        ...p,
        email: undefined,
        namaBank: undefined,
        nomorRekening: undefined,
        namaPemilikRekening: undefined,
      })),
    );
    if (activeView === 'unit' || activeView === 'pengaturan' || activeView === 'broadcast') {
      setActiveView('direktori');
    }
  };

  const handleSavePengurus = (saved: PengurusItem) => {
    setPengurusList((prev) => {
      const exists = prev.some((p) => p.id === saved.id);
      const next = exists
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [...prev, saved];
      saveLocalPengurus(next);
      return next;
    });
  };

  const handleDeletePengurus = (id: string) => {
    setPengurusList((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveLocalPengurus(next);
      return next;
    });
  };

  const handleSaveKegiatan = (saved: KegiatanRpkaItem) => {
    setKegiatanList((prev) => {
      const exists = prev.some((k) => k.kodeKegiatan === saved.kodeKegiatan);
      const next = exists
        ? prev.map((k) => (k.kodeKegiatan === saved.kodeKegiatan ? saved : k))
        : [...prev, saved];
      saveLocalKegiatan(next);
      return next;
    });
  };

  const handleDeleteKegiatan = (kodeKegiatan: string) => {
    setKegiatanList((prev) => {
      const next = prev.filter((k) => k.kodeKegiatan !== kodeKegiatan);
      saveLocalKegiatan(next);
      return next;
    });
  };

  const handleSaveMusyawarah = (saved: MusyawarahItem) => {
    setMusyawarahList((prev) => {
      const exists = prev.some((m) => m.id === saved.id);
      const next = exists
        ? prev.map((m) => (m.id === saved.id ? saved : m))
        : [...prev, saved];
      saveLocalMusyawarah(next);
      return next;
    });
  };

  const handleDeleteMusyawarah = (id: string) => {
    setMusyawarahList((prev) => {
      const next = prev.filter((m) => m.id !== id);
      saveLocalMusyawarah(next);
      return next;
    });
    setPresensiList((prev) => {
      const next = prev.filter((p) => p.musyawarahId !== id);
      saveLocalPresensi(next);
      return next;
    });
  };

  const handleSavePresensiBatch = (musyawarahId: string, items: PresensiItem[]) => {
    setPresensiList((prev) => {
      const others = prev.filter((p) => p.musyawarahId !== musyawarahId);
      const next = [...others, ...items];
      saveLocalPresensi(next);
      return next;
    });
  };

  const handleSaveUnit = (savedUnit: UnitItem) => {
    setUnits((prev) => {
      const exists = prev.some((u) => u.id === savedUnit.id);
      const next = exists
        ? prev.map((u) => (u.id === savedUnit.id ? savedUnit : u))
        : [...prev, savedUnit];
      saveLocalUnits(next);
      return next;
    });
    setPengurusList((prev) => {
      const next = prev.map((p) =>
        p.unitId === savedUnit.id ? { ...p, namaUnit: savedUnit.namaUnit } : p,
      );
      saveLocalPengurus(next);
      return next;
    });
  };

  const handleDeleteUnit = (id: string) => {
    setUnits((prev) => {
      const next = prev.filter((u) => u.id !== id);
      saveLocalUnits(next);
      return next;
    });
  };

  const handleSaveDpw = (saved: DpwItem) => {
    setDpwList((prev) => {
      const exists = prev.some((d) => d.id === saved.id || d.kodeWilayah === saved.kodeWilayah);
      const next = exists
        ? prev.map((d) =>
            d.id === saved.id || d.kodeWilayah === saved.kodeWilayah ? saved : d,
          )
        : [...prev, saved];
      saveLocalDpw(next);
      return next;
    });
  };

  const handleDeleteDpw = (id: string) => {
    setDpwList((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveLocalDpw(next);
      return next;
    });
  };

  const handleSaveDpd = (saved: DpdItem) => {
    setDpdList((prev) => {
      const exists = prev.some((d) => d.id === saved.id || d.kodeWilayah === saved.kodeWilayah);
      const next = exists
        ? prev.map((d) =>
            d.id === saved.id || d.kodeWilayah === saved.kodeWilayah ? saved : d,
          )
        : [...prev, saved];
      saveLocalDpd(next);
      return next;
    });
  };

  const handleDeleteDpd = (id: string) => {
    setDpdList((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveLocalDpd(next);
      return next;
    });
  };

  const handleSaveDpc = (saved: DpcItem) => {
    setDpcList((prev) => {
      const exists = prev.some((d) => d.id === saved.id || d.kodeWilayah === saved.kodeWilayah);
      const next = exists
        ? prev.map((d) =>
            d.id === saved.id || d.kodeWilayah === saved.kodeWilayah ? saved : d,
          )
        : [...prev, saved];
      saveLocalDpc(next);
      return next;
    });
  };

  const handleDeleteDpc = (id: string) => {
    setDpcList((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveLocalDpc(next);
      return next;
    });
  };

  const handleSaveDpr = (saved: DprItem) => {
    setDprList((prev) => {
      const exists = prev.some((d) => d.id === saved.id || d.kodeWilayah === saved.kodeWilayah);
      const next = exists
        ? prev.map((d) =>
            d.id === saved.id || d.kodeWilayah === saved.kodeWilayah ? saved : d,
          )
        : [...prev, saved];
      saveLocalDpr(next);
      return next;
    });
  };

  const handleDeleteDpr = (id: string) => {
    setDprList((prev) => {
      const next = prev.filter((d) => d.id !== id);
      saveLocalDpr(next);
      return next;
    });
  };

  const handleImportedKodeWilayah = (rows: KodeWilayahItem[]) => {
    setKodeWilayahList(rows);
    saveLocalKodeWilayah(rows);
  };

  const handleSaveDokumenKategori = (saved: DokumenKategoriItem) => {
    setDokumenKategoriList((prev) => {
      const exists = prev.some((k) => k.id === saved.id);
      const next = exists
        ? prev.map((k) => (k.id === saved.id ? saved : k))
        : [...prev, saved];
      saveLocalDokumenKategori(next);
      return next;
    });
    setDokumenSubkategoriList((prev) => {
      const next = prev.map((s) =>
        s.kategoriId === saved.id ? { ...s, namaKategori: saved.namaKategori } : s,
      );
      saveLocalDokumenSubkategori(next);
      return next;
    });
    setDokumenFileList((prev) => {
      const next = prev.map((f) =>
        f.kategoriId === saved.id ? { ...f, namaKategori: saved.namaKategori } : f,
      );
      saveLocalDokumenFile(next);
      return next;
    });
  };

  const handleReorderDokumenKategori = (reordered: DokumenKategoriItem[]) => {
    setDokumenKategoriList(reordered);
    saveLocalDokumenKategori(reordered);
  };

  const handleDeleteDokumenKategori = (id: string) => {
    setDokumenKategoriList((prev) => {
      const next = prev.filter((k) => k.id !== id);
      saveLocalDokumenKategori(next);
      return next;
    });
    setDokumenSubkategoriList((prev) => {
      const next = prev.filter((s) => s.kategoriId !== id);
      saveLocalDokumenSubkategori(next);
      return next;
    });
    setDokumenFileList((prev) => {
      const next = prev.filter((f) => f.kategoriId !== id);
      saveLocalDokumenFile(next);
      return next;
    });
  };

  const handleSaveDokumenSubkategori = (saved: DokumenSubkategoriItem, oldName?: string) => {
    setDokumenSubkategoriList((prev) => {
      const exists = prev.some((s) => s.id === saved.id);
      const next = exists
        ? prev.map((s) => (s.id === saved.id ? saved : s))
        : [...prev, saved];
      saveLocalDokumenSubkategori(next);
      return next;
    });
    if (oldName && oldName !== saved.namaSubkategori) {
      setDokumenFileList((prev) => {
        const next = prev.map((f) =>
          f.kategoriId === saved.kategoriId &&
          f.subfolder.trim().toLowerCase() === oldName.trim().toLowerCase()
            ? { ...f, subfolder: saved.namaSubkategori }
            : f,
        );
        saveLocalDokumenFile(next);
        return next;
      });
    }
  };

  const handleDeleteDokumenSubkategori = (sub: DokumenSubkategoriItem) => {
    setDokumenSubkategoriList((prev) => {
      const next = prev.filter((s) => s.id !== sub.id);
      saveLocalDokumenSubkategori(next);
      return next;
    });
    setDokumenFileList((prev) => {
      const next = prev.filter(
        (f) =>
          !(
            f.kategoriId === sub.kategoriId &&
            f.subfolder.trim().toLowerCase() === sub.namaSubkategori.trim().toLowerCase()
          ),
      );
      saveLocalDokumenFile(next);
      return next;
    });
  };

  const handleSaveDokumenFiles = (
    items: DokumenFileItem[],
    updatedCategoryFolder?: {
      kategoriId: string;
      folderId?: string;
      folderUrl?: string;
      tanggalUpdate?: string;
    },
  ) => {
    setDokumenFileList((prev) => {
      const byId = new Map(prev.map((f) => [f.id, f]));
      items.forEach((item) => {
        byId.set(item.id, item);
      });
      const next = Array.from(byId.values());
      saveLocalDokumenFile(next);
      return next;
    });

    // Pastikan subfolder baru (misal dari ekstrak ZIP) terdaftar di daftar subkategori lokal
    setDokumenSubkategoriList((prev) => {
      const next = [...prev];
      let changed = false;
      items.forEach((item) => {
        const cleanSub = (item.subfolder || '').trim();
        if (!cleanSub) return;
        const exists = next.some(
          (s) =>
            s.kategoriId === item.kategoriId &&
            s.namaSubkategori.trim().toLowerCase() === cleanSub.toLowerCase(),
        );
        if (!exists) {
          const countInKat = next.filter((s) => s.kategoriId === item.kategoriId).length;
          next.push({
            id: `SUB-${Date.now().toString().slice(-5)}-${Math.floor(Math.random() * 90 + 10)}`,
            kategoriId: item.kategoriId,
            namaKategori: item.namaKategori,
            namaSubkategori: cleanSub,
            urutan: countInKat + 1,
            driveFolderId: item.driveFolderId || '',
            driveFolderUrl: item.driveFolderUrl || '',
            tanggalUpdate: item.tanggalUpdate,
          });
          changed = true;
        }
      });
      if (changed) {
        saveLocalDokumenSubkategori(next);
        return next;
      }
      return prev;
    });

    if (updatedCategoryFolder) {
      setDokumenKategoriList((prev) => {
        const next = prev.map((k) => {
          if (k.id !== updatedCategoryFolder.kategoriId) return k;
          return {
            ...k,
            driveFolderId: updatedCategoryFolder.folderId || k.driveFolderId,
            driveFolderUrl: updatedCategoryFolder.folderUrl || k.driveFolderUrl,
            tanggalUpdate: updatedCategoryFolder.tanggalUpdate || k.tanggalUpdate,
          };
        });
        saveLocalDokumenKategori(next);
        return next;
      });
    }
  };

  const handleDeleteDokumenFile = (id: string) => {
    setDokumenFileList((prev) => {
      const next = prev.filter((f) => f.id !== id);
      saveLocalDokumenFile(next);
      return next;
    });
  };

  const handleTrackDokumenStat = (
    id: string,
    metric: 'view' | 'download',
    syncedCounts?: { jumlahDilihat?: number; jumlahDiunduh?: number },
  ) => {
    setDokumenFileList((prev) => {
      const next = prev.map((f) => {
        if (f.id !== id) return f;
        if (syncedCounts) {
          return {
            ...f,
            jumlahDilihat: syncedCounts.jumlahDilihat ?? f.jumlahDilihat ?? 0,
            jumlahDiunduh: syncedCounts.jumlahDiunduh ?? f.jumlahDiunduh ?? 0,
          };
        }
        return {
          ...f,
          jumlahDilihat: metric === 'view' ? (f.jumlahDilihat || 0) + 1 : (f.jumlahDilihat || 0),
          jumlahDiunduh:
            metric === 'download' ? (f.jumlahDiunduh || 0) + 1 : (f.jumlahDiunduh || 0),
        };
      });
      saveLocalDokumenFile(next);
      return next;
    });
  };

  if (isPendataanRoute) {
    return (
      <PendataanPengurusView
        namaAplikasi={namaAplikasi}
        logoUrl={logoDataUrl}
        webAppUrl={webAppUrl}
        themePref={themePref}
        onChangeThemePref={setThemePref}
        onBackToPortal={navigateBackToPortal}
      />
    );
  }

  return (
    <div
      id="top"
      className="min-h-screen duwd-ambient-bg text-[#0F2429] transition-colors duration-200 dark:text-[#E6F4F7]"
    >
      <div
        data-viewport={viewportMode}
        style={{ '--duwd-container-width': `${screenWidthPct}%` } as CSSProperties}
        className="duwd-viewport-shell flex min-h-screen flex-col"
      >
        <TopBar
          namaAplikasi={namaAplikasi}
          logoUrl={logoDataUrl}
          role={role}
          activeView={activeView}
          viewportMode={viewportMode}
          screenWidthPct={screenWidthPct}
          themePref={themePref}
          onChangeViewportMode={setViewportMode}
          onChangeScreenWidthPct={setScreenWidthPct}
          onChangeThemePref={setThemePref}
          onChangeView={setActiveView}
          onOpenLogin={() => setLoginOpen(true)}
          onLogout={handleLogout}
        />

        {syncError && (
          <div className="duwd-container mt-4 px-2 sm:px-4">
            <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/60 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                <span>Sinkronisasi Spreadsheet gagal: {syncError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSyncError('')}
                className="cursor-pointer text-amber-700 dark:text-amber-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <main className="flex-1">
          {activeView === 'direktori' && (
            <PengurusDirectory
              role={role}
              activePin={activePin}
              webAppUrl={webAppUrl}
              units={units}
              pengurusList={pengurusList}
              syncing={syncing}
              onRefresh={async () => {
                await syncFromSheet();
                if ((role === 'admin' || role === 'superadmin') && activePin) {
                  await syncPrivateAndBroadcast(activePin);
                }
              }}
              onSaveSuccess={handleSavePengurus}
              onDeleteSuccess={handleDeletePengurus}
              onOpenPendataanPage={navigateToPendataan}
            />
          )}

          {activeView === 'proker' && (
            <ProkerRpkaView
              role={role}
              activePin={activePin}
              webAppUrl={webAppUrl}
              prokerList={prokerList}
              kegiatanList={kegiatanList}
              units={units}
              rpkaDriveUrl={rpkaDriveUrl}
              syncing={syncing}
              onRefresh={syncFromSheet}
              onSaveKegiatan={handleSaveKegiatan}
              onDeleteKegiatan={handleDeleteKegiatan}
            />
          )}

          {activeView === 'kalender' && (
            <KalenderKegiatanView
              prokerList={prokerList}
              kegiatanList={kegiatanList}
              musyawarahList={musyawarahList}
              presensiList={presensiList}
              units={units}
            />
          )}

          {activeView === 'musyawarah' && (
            <MusyawarahView
              role={role}
              activePin={activePin}
              webAppUrl={webAppUrl}
              units={units}
              pengurusList={pengurusList}
              musyawarahList={musyawarahList}
              presensiList={presensiList}
              syncing={syncing}
              onRefresh={syncFromSheet}
              onSaveMusyawarah={handleSaveMusyawarah}
              onDeleteMusyawarah={handleDeleteMusyawarah}
              onSavePresensiBatch={handleSavePresensiBatch}
            />
          )}

          {activeView === 'dpw_dpd' && (
            <DpwDpdView
              role={role}
              activePin={activePin}
              webAppUrl={webAppUrl}
              wilayahConnected={wilayahConnected}
              kodeWilayahList={kodeWilayahList}
              dpwList={dpwList}
              dpdList={dpdList}
              dpcList={dpcList}
              dprList={dprList}
              syncing={syncing}
              onRefresh={syncFromSheet}
              onSaveDpw={handleSaveDpw}
              onDeleteDpw={handleDeleteDpw}
              onSaveDpd={handleSaveDpd}
              onDeleteDpd={handleDeleteDpd}
              onSaveDpc={handleSaveDpc}
              onDeleteDpc={handleDeleteDpc}
              onSaveDpr={handleSaveDpr}
              onDeleteDpr={handleDeleteDpr}
              onImportedKodeWilayah={handleImportedKodeWilayah}
            />
          )}

          {activeView === 'dokumen' && (
            <DokumenView
              role={role}
              activePin={activePin}
              webAppUrl={webAppUrl}
              syncing={syncing}
              onRefresh={syncFromSheet}
              kategoriList={dokumenKategoriList}
              subkategoriList={dokumenSubkategoriList}
              fileList={dokumenFileList}
              onSaveKategori={handleSaveDokumenKategori}
              onReorderKategori={handleReorderDokumenKategori}
              onDeleteKategori={handleDeleteDokumenKategori}
              onSaveSubkategori={handleSaveDokumenSubkategori}
              onDeleteSubkategori={handleDeleteDokumenSubkategori}
              onSaveFiles={handleSaveDokumenFiles}
              onDeleteFile={handleDeleteDokumenFile}
              onTrackStat={handleTrackDokumenStat}
            />
          )}

          {activeView === 'broadcast' && (role === 'admin' || role === 'superadmin') && (
            <BroadcastView
              role={role}
              activePin={activePin}
              webAppUrl={webAppUrl}
              units={units}
              pengurusList={pengurusList}
              waGroups={waGroups}
              broadcastQueue={broadcastQueue}
              broadcastConfig={broadcastConfig}
              loadingData={loadingBroadcastData}
              onRefreshBroadcastData={() => syncPrivateAndBroadcast()}
              onUpdateWaGroups={(next) => {
                setWaGroups(next);
                saveLocalWaGroups(next);
              }}
              onUpdateBroadcastQueue={(next) => {
                setBroadcastQueue(next);
                saveLocalBroadcastQueue(next);
              }}
              onUpdateBroadcastConfig={setBroadcastConfig}
            />
          )}

          {activeView === 'unit' && role === 'superadmin' && (
            <UnitManager
              activePin={activePin}
              webAppUrl={webAppUrl}
              units={units}
              onSaveUnit={handleSaveUnit}
              onDeleteUnit={handleDeleteUnit}
            />
          )}

          {activeView === 'pengaturan' && role === 'superadmin' && (
            <SuperAdminSettings
              activePin={activePin}
              namaAplikasi={namaAplikasi}
              logoDataUrl={logoDataUrl}
              rpkaDriveUrl={rpkaDriveUrl}
              wilayahSpreadsheetId={wilayahSpreadsheetId}
              webAppUrl={webAppUrl}
              broadcastConfig={broadcastConfig}
              onUpdateBroadcastConfig={setBroadcastConfig}
              onUpdateSettingsState={(next) => {
                setNamaAplikasi(next.namaAplikasi);
                setLogoDataUrl(next.logoDataUrl);
                setRpkaDriveUrl(next.rpkaDriveUrl);
                setWilayahSpreadsheetId(next.wilayahSpreadsheetId);
                setWebAppUrl(next.webAppUrl);
              }}
              onSyncFromSheet={async () => {
                await syncFromSheet();
                await syncPrivateAndBroadcast();
              }}
            />
          )}
        </main>

        <footer className="border-t border-[#07525E]/10 bg-white/60 px-2 py-5 backdrop-blur-md dark:border-[#3EC1D3]/15 dark:bg-[#081A20]/75 sm:px-4">
          <div className="duwd-container flex flex-col justify-between gap-2 text-xs text-[#526A70] dark:text-[#8DA8B0] sm:flex-row sm:items-center">
            <div>
              &copy; 2027 Departemen Urusan Wilayah dan Daerah &middot; DPP Wahdah Islamiyah
            </div>
            <div className="font-mono">duwd.web.id</div>
          </div>
        </footer>

        {loginOpen && (
          <LoginModal
            webAppUrl={webAppUrl}
            onClose={() => setLoginOpen(false)}
            onSuccess={handleLoginSuccess}
          />
        )}
      </div>
    </div>
  );
}
