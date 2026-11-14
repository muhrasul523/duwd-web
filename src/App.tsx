import { useCallback, useEffect, useState } from 'react';
import { LoginModal } from './components/LoginModal';
import { PengurusDirectory } from './components/PengurusDirectory';
import { SuperAdminSettings } from './components/SuperAdminSettings';
import { TopBar, type ActiveView } from './components/TopBar';
import { UnitManager } from './components/UnitManager';
import {
  fetchAllOrgData,
  loadLocalPengurus,
  loadLocalSettings,
  loadLocalUnits,
  saveLocalPengurus,
  saveLocalUnits,
} from './services/orgService';
import type { PengurusItem, UnitItem, UserRole } from './types/org';
import { applyBrowserFavicon } from './utils/whatsapp';

export default function App() {
  const initialSettings = loadLocalSettings();

  const [role, setRole] = useState<UserRole>('publik');
  const [activePin, setActivePin] = useState('');
  const [activeView, setActiveView] = useState<ActiveView>('direktori');
  const [loginOpen, setLoginOpen] = useState(false);

  const [namaAplikasi, setNamaAplikasi] = useState(initialSettings.namaAplikasi);
  const [logoDataUrl, setLogoDataUrl] = useState(initialSettings.logoDataUrl);
  const [webAppUrl, setWebAppUrl] = useState(initialSettings.gasWebAppUrl);

  const [units, setUnits] = useState<UnitItem[]>(() => loadLocalUnits());
  const [pengurusList, setPengurusList] = useState<PengurusItem[]>(() => loadLocalPengurus());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    applyBrowserFavicon(logoDataUrl);
  }, [logoDataUrl]);

  useEffect(() => {
    document.title = `${namaAplikasi || 'DUWD DPP WI'} — Daftar Pengurus`;
  }, [namaAplikasi]);

  const syncFromSheet = useCallback(async () => {
    if (!webAppUrl.trim()) return;
    setSyncing(true);
    try {
      const { dataset, synced } = await fetchAllOrgData(webAppUrl);
      if (synced) {
        setUnits(dataset.units);
        setPengurusList(dataset.pengurus);
        if (dataset.settings.namaAplikasi) {
          setNamaAplikasi(dataset.settings.namaAplikasi);
        }
        if (dataset.settings.logoDataUrl) {
          setLogoDataUrl(dataset.settings.logoDataUrl);
        }
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
    setActiveView('direktori');
  };

  const handleLogout = () => {
    setRole('publik');
    setActivePin('');
    setActiveView('direktori');
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

  const handleSaveUnit = (savedUnit: UnitItem) => {
    setUnits((prev) => {
      const exists = prev.some((u) => u.id === savedUnit.id);
      const next = exists
        ? prev.map((u) => (u.id === savedUnit.id ? savedUnit : u))
        : [...prev, savedUnit];
      saveLocalUnits(next);
      return next;
    });
    // Perbarui nama unit pada daftar pengurus yang menggunakan unit ini
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
            webAppUrl={webAppUrl}
            onUpdateSettingsState={(next) => {
              setNamaAplikasi(next.namaAplikasi);
              setLogoDataUrl(next.logoDataUrl);
              setWebAppUrl(next.webAppUrl);
            }}
            onSyncFromSheet={syncFromSheet}
          />
        )}
      </main>

      <footer className="border-t border-[#07525E]/10 bg-white/60 px-4 py-5 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-[1160px] flex-col justify-between gap-2 text-xs text-[#526A70] sm:flex-row sm:items-center">
          <div>
            &copy; 2026 Departemen Urusan Wilayah dan Daerah · DPP Wahdah Islamiyah
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
