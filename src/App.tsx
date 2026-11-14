import { AlertTriangle, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DpwDpdView } from './components/DpwDpdView';
import { LoginModal } from './components/LoginModal';
import { PengurusDirectory } from './components/PengurusDirectory';
import { ProkerRpkaView } from './components/ProkerRpkaView';
import { SuperAdminSettings } from './components/SuperAdminSettings';
import { TopBar, type ActiveView } from './components/TopBar';
import { UnitManager } from './components/UnitManager';
import {
  fetchAllOrgData,
  loadLocalDpc,
  loadLocalDpd,
  loadLocalDpr,
  loadLocalDpw,
  loadLocalKegiatan,
  loadLocalKodeWilayah,
  loadLocalPengurus,
  loadLocalProker,
  loadLocalSettings,
  loadLocalUnits,
  saveLocalDpc,
  saveLocalDpd,
  saveLocalDpr,
  saveLocalDpw,
  saveLocalKegiatan,
  saveLocalKodeWilayah,
  saveLocalPengurus,
  saveLocalUnits,
} from './services/orgService';
import type {
  DpcItem,
  DpdItem,
  DprItem,
  DpwItem,
  KegiatanRpkaItem,
  KodeWilayahItem,
  PengurusItem,
  ProgramKerjaItem,
  UnitItem,
  UserRole,
} from './types/org';
import { applyBrowserFavicon } from './utils/whatsapp';

export default function App() {
  const initialSettings = loadLocalSettings();

  const [role, setRole] = useState<UserRole>('publik');
  const [activePin, setActivePin] = useState('');
  const [activeView, setActiveView] = useState<ActiveView>('direktori');
  const [loginOpen, setLoginOpen] = useState(false);

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
  const [kodeWilayahList, setKodeWilayahList] = useState<KodeWilayahItem[]>(() =>
    loadLocalKodeWilayah(),
  );
  const [dpwList, setDpwList] = useState<DpwItem[]>(() => loadLocalDpw());
  const [dpdList, setDpdList] = useState<DpdItem[]>(() => loadLocalDpd());
  const [dpcList, setDpcList] = useState<DpcItem[]>(() => loadLocalDpc());
  const [dprList, setDprList] = useState<DprItem[]>(() => loadLocalDpr());
  const [syncing, setSyncing] = useState(false);

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
        setKodeWilayahList(dataset.kodeWilayah);
        setDpwList(dataset.dpw);
        setDpdList(dataset.dpd);
        setDpcList(dataset.dpc);
        setDprList(dataset.dpr);
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

  useEffect(() => {
    void syncFromSheet();
  }, [syncFromSheet]);

  const handleLoginSuccess = (nextRole: UserRole, pin: string) => {
    setRole(nextRole);
    setActivePin(pin);
    setLoginOpen(false);
  };

  const handleLogout = () => {
    setRole('publik');
    setActivePin('');
    if (activeView === 'unit' || activeView === 'pengaturan') {
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
      const exists = prev.some((d) => d.id === saved.id);
      const next = exists
        ? prev.map((d) => (d.id === saved.id ? saved : d))
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
      const exists = prev.some((d) => d.id === saved.id);
      const next = exists
        ? prev.map((d) => (d.id === saved.id ? saved : d))
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

  return (
    <div id="top" className="min-h-screen duwd-ambient-bg flex flex-col text-[#0F2429]">
      <TopBar
        namaAplikasi={namaAplikasi}
        logoUrl={logoDataUrl}
        role={role}
        activeView={activeView}
        onChangeView={setActiveView}
        onOpenLogin={() => setLoginOpen(true)}
        onLogout={handleLogout}
      />

      {syncError && (
        <div className="mx-auto mt-4 w-full max-w-[1160px] px-4 sm:px-6">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>Sinkronisasi Spreadsheet gagal: {syncError}</span>
            </div>
            <button
              type="button"
              onClick={() => setSyncError('')}
              className="cursor-pointer text-amber-700"
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
            onRefresh={syncFromSheet}
            onSaveSuccess={handleSavePengurus}
            onDeleteSuccess={handleDeletePengurus}
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
            onUpdateSettingsState={(next) => {
              setNamaAplikasi(next.namaAplikasi);
              setLogoDataUrl(next.logoDataUrl);
              setRpkaDriveUrl(next.rpkaDriveUrl);
              setWilayahSpreadsheetId(next.wilayahSpreadsheetId);
              setWebAppUrl(next.webAppUrl);
            }}
            onSyncFromSheet={syncFromSheet}
          />
        )}
      </main>

      <footer className="border-t border-[#07525E]/10 bg-white/60 px-4 py-5 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-[1160px] flex-col justify-between gap-2 text-xs text-[#526A70] sm:flex-row sm:items-center">
          <div>
            &copy; 2026 Departemen Urusan Wilayah dan Daerah &middot; DPP Wahdah Islamiyah
          </div>
          <div>duwd.web.id</div>
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
  );
}
