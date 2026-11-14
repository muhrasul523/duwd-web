import { useState } from 'react';
import { DriveArchiveHub } from './components/DriveArchiveHub';
import { Footer } from './components/Footer';
import { GasBackendExplorer } from './components/GasBackendExplorer';
import { GovernanceWorkspace, type GovernanceTab } from './components/GovernanceWorkspace';
import { HeroSection } from './components/HeroSection';
import { KhidmatFormSection } from './components/KhidmatFormSection';
import { Navbar } from './components/Navbar';
import { ProgramPillarsSection, type WorkspaceShortcut } from './components/ProgramPillarsSection';
import {
  SEED_AGENDA_4M,
  SEED_CADRE_LEVELS,
  SEED_DRIVE_ASSETS,
  SEED_REGIONS,
} from './data/duwdSeedData';
import type { Agenda4MItem, DriveAsset } from './types/duwd';

export default function App() {
  const [governanceTab, setGovernanceTab] = useState<GovernanceTab>('4m');
  const [agendas, setAgendas] = useState<Agenda4MItem[]>(SEED_AGENDA_4M);
  const [driveAssets, setDriveAssets] = useState<DriveAsset[]>(SEED_DRIVE_ASSETS);

  const scrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePillarShortcut = (target: WorkspaceShortcut) => {
    if (target === '4m' || target === 'wilayah' || target === 'kader') {
      setGovernanceTab(target);
      scrollToSection('tata-kelola');
      return;
    }
    if (target === 'arsip') {
      scrollToSection('arsip-drive');
      return;
    }
    scrollToSection('layanan-khidmat');
  };

  const handleAddAgenda = (newItem: Agenda4MItem) => {
    setAgendas((prev) => [newItem, ...prev]);
  };

  const handleAddDriveAsset = (newAsset: DriveAsset) => {
    setDriveAssets((prev) => [newAsset, ...prev]);
  };

  return (
    <div className="min-h-screen duwd-ambient-bg text-[#0F2429]">
      <Navbar onNavigate={scrollToSection} />

      <main>
        <HeroSection
          totalDpw={38}
          totalDpd={412}
          totalAgenda4M={124 + (agendas.length - SEED_AGENDA_4M.length)}
          totalArsipDrive={1840 + (driveAssets.length - SEED_DRIVE_ASSETS.length)}
          onExploreGovernance={() => scrollToSection('tata-kelola')}
          onExploreDrive={() => scrollToSection('arsip-drive')}
        />

        <ProgramPillarsSection onSelectShortcut={handlePillarShortcut} />

        <GovernanceWorkspace
          activeTab={governanceTab}
          onChangeTab={setGovernanceTab}
          regions={SEED_REGIONS}
          agendas={agendas}
          onAddAgenda={handleAddAgenda}
          cadres={SEED_CADRE_LEVELS}
        />

        <DriveArchiveHub
          assets={driveAssets}
          onAddAsset={handleAddDriveAsset}
        />

        <KhidmatFormSection />

        <GasBackendExplorer />
      </main>

      <Footer onNavigate={scrollToSection} />
    </div>
  );
}
