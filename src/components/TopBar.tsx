import {
  Laptop,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  SlidersHorizontal,
  Smartphone,
  Sun,
  Tablet,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import defaultLogoWi from '../assets/logo-wi.png';
import type { ThemePreference, UserRole, ViewportMode } from '../types/org';

export type ActiveView =
  | 'direktori'
  | 'proker'
  | 'kalender'
  | 'musyawarah'
  | 'dpw_dpd'
  | 'dokumen'
  | 'broadcast'
  | 'unit'
  | 'pengaturan';

interface TopBarProps {
  namaAplikasi: string;
  logoUrl: string;
  role: UserRole;
  activeView: ActiveView;
  viewportMode: ViewportMode;
  screenWidthPct: number;
  themePref: ThemePreference;
  onChangeViewportMode: (mode: ViewportMode) => void;
  onChangeScreenWidthPct: (pct: number) => void;
  onChangeThemePref: (pref: ThemePreference) => void;
  onChangeView: (view: ActiveView) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

const WIDTH_PRESETS = [70, 80, 90, 95, 100] as const;

export function TopBar({
  namaAplikasi,
  logoUrl,
  role,
  activeView,
  viewportMode,
  screenWidthPct,
  themePref,
  onChangeViewportMode,
  onChangeScreenWidthPct,
  onChangeThemePref,
  onChangeView,
  onOpenLogin,
  onLogout,
}: TopBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [displayPopoverOpen, setDisplayPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!displayPopoverOpen) return undefined;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setDisplayPopoverOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDisplayPopoverOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [displayPopoverOpen]);

  const navItems: { id: ActiveView; label: string; visible: boolean }[] = [
    { id: 'direktori', label: 'Pengurus', visible: true },
    { id: 'proker', label: 'Program Kerja', visible: true },
    { id: 'kalender', label: 'Kalender', visible: true },
    { id: 'musyawarah', label: 'Musyawarah', visible: true },
    { id: 'dpw_dpd', label: 'DPW DPD', visible: true },
    { id: 'dokumen', label: 'Dokumen', visible: true },
    { id: 'broadcast', label: 'Broadcast', visible: role === 'admin' || role === 'superadmin' },
    { id: 'unit', label: 'Unit', visible: role === 'superadmin' },
    { id: 'pengaturan', label: 'Pengaturan', visible: role === 'superadmin' },
  ];

  const visibleNav = navItems.filter((item) => item.visible);
  const forceCompactNav = viewportMode === 'mobile';

  const handleSelectView = (view: ActiveView) => {
    setMobileOpen(false);
    setDisplayPopoverOpen(false);
    onChangeView(view);
  };

  return (
    <header className="sticky top-0 z-40 glass-nav">
      <div className="duwd-container flex items-center justify-between gap-3 px-2 py-3 sm:px-4">
        {/* Zone 1: Logo Wahdah Islamiyah + Single-Line Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleSelectView('direktori');
          }}
          className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-[#07525E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0C7A89] dark:text-[#E6F4F7]"
        >
          <img
            src={logoUrl || defaultLogoWi}
            alt="Logo Wahdah Islamiyah"
            referrerPolicy="no-referrer"
            onError={(e) => {
              if (e.currentTarget.src !== defaultLogoWi) {
                e.currentTarget.src = defaultLogoWi;
              }
            }}
            className="h-9 w-9 shrink-0 rounded-xl border border-[#07525E]/10 bg-white/95 object-contain p-0.5 dark:border-[#3EC1D3]/25"
          />
          <span className="text-[15px] font-bold tracking-tight sm:text-base">
            {namaAplikasi || 'DUWD DPP WI'}
          </span>
        </a>

        {/* Zone 2: Navigation Links */}
        {!forceCompactNav && (
          <nav
            aria-label="Navigasi utama"
            className="hidden items-center gap-5 overflow-x-auto lg:flex"
          >
            {visibleNav.map((item) => {
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectView(item.id)}
                  className={`shrink-0 cursor-pointer whitespace-nowrap py-1 text-[13px] font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'text-[#0C7A89] underline decoration-2 underline-offset-8 dark:text-[#3EC1D3]'
                      : 'text-[#3D575E] hover:text-[#07525E] dark:text-[#9BB5BC] dark:hover:text-[#E6F4F7]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        )}

        {/* Zone 3: Compact Display & Theme Popover + Primary Role Action */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Unified Display & Theme Popover Button */}
          <div ref={popoverRef} className="relative">
            <button
              type="button"
              onClick={() => setDisplayPopoverOpen((prev) => !prev)}
              aria-expanded={displayPopoverOpen}
              aria-haspopup="dialog"
              title="Pengaturan Tampilan Layar & Tema"
              className={`inline-flex h-10 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-[12px] font-semibold transition-colors ${
                displayPopoverOpen
                  ? 'border-[#0C7A89] bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3] dark:bg-[#13424F] dark:text-[#E6F4F7]'
                  : 'border-[#07525E]/15 bg-white/85 text-[#07525E] hover:bg-white dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#113540]'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
              {!forceCompactNav && <span className="hidden sm:inline">Tampilan</span>}
            </button>

            {displayPopoverOpen && (
              <div
                role="dialog"
                aria-label="Pengaturan Tampilan dan Tema"
                className="glass-surface-strong absolute top-12 right-0 z-50 w-[308px] max-w-[calc(100vw-24px)] p-4 shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-[#07525E]/10 pb-2.5 dark:border-[#3EC1D3]/15">
                  <div>
                    <div className="text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                      Tampilan &amp; Tema
                    </div>
                    <div className="text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                      Atur lebar layar, mode perangkat &amp; warna
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDisplayPopoverOpen(false)}
                    aria-label="Tutup pengaturan tampilan"
                    className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Mode Perangkat */}
                <div className="mt-3">
                  <div className="text-[11px] font-bold text-[#355158] dark:text-[#A9C2C9]">
                    Mode Layar
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-[#EBF5F8]/90 p-1 dark:bg-[#0B2027]">
                    <button
                      type="button"
                      onClick={() => onChangeViewportMode('desktop')}
                      className={`inline-flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                        viewportMode === 'desktop'
                          ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                          : 'text-[#526A70] hover:text-[#07525E] dark:text-[#8DA8B0] dark:hover:text-[#E6F4F7]'
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      <span>Desktop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeViewportMode('tablet')}
                      title="Pratinjau Tablet Lebar (1024px)"
                      className={`inline-flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                        viewportMode === 'tablet'
                          ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                          : 'text-[#526A70] hover:text-[#07525E] dark:text-[#8DA8B0] dark:hover:text-[#E6F4F7]'
                      }`}
                    >
                      <Tablet className="h-3.5 w-3.5" />
                      <span>Tablet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeViewportMode('mobile')}
                      title="Pratinjau Mobile (412px)"
                      className={`inline-flex cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                        viewportMode === 'mobile'
                          ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                          : 'text-[#526A70] hover:text-[#07525E] dark:text-[#8DA8B0] dark:hover:text-[#E6F4F7]'
                      }`}
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>Mobile</span>
                    </button>
                  </div>
                </div>

                {/* Pengaturan Persentase Lebar Layar Desktop */}
                <div className="mt-3.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-[#355158] dark:text-[#A9C2C9]">
                      Lebar Layar Desktop
                    </span>
                    <span className="font-mono font-bold text-[#0C7A89] tabular-nums dark:text-[#3EC1D3]">
                      {viewportMode === 'desktop'
                        ? `${screenWidthPct}%`
                        : viewportMode === 'tablet'
                          ? '1024px'
                          : '412px'}
                    </span>
                  </div>

                  <div className="mt-1.5 grid grid-cols-5 gap-1">
                    {WIDTH_PRESETS.map((pct) => {
                      const active = viewportMode === 'desktop' && screenWidthPct === pct;
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            onChangeViewportMode('desktop');
                            onChangeScreenWidthPct(pct);
                          }}
                          className={`cursor-pointer rounded-lg border py-1.5 font-mono text-[11px] font-semibold tabular-nums transition-colors ${
                            active
                              ? 'border-[#0C7A89] bg-[#0C7A89] text-white'
                              : 'border-[#07525E]/15 bg-white/85 text-[#355158] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/20 dark:bg-[#0D2B33] dark:text-[#B5CDD2] dark:hover:bg-[#13424F]'
                          }`}
                        >
                          {pct}%
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2.5 flex items-center gap-2">
                    <span className="font-mono text-[10px] text-[#526A70] dark:text-[#8DA8B0]">
                      60%
                    </span>
                    <input
                      type="range"
                      min={60}
                      max={100}
                      step={1}
                      value={screenWidthPct}
                      aria-label="Atur persentase lebar layar kustom"
                      onChange={(e) => {
                        onChangeViewportMode('desktop');
                        onChangeScreenWidthPct(Number(e.target.value));
                      }}
                      className="h-1.5 flex-1 cursor-pointer accent-[#0C7A89]"
                    />
                    <span className="font-mono text-[10px] text-[#526A70] dark:text-[#8DA8B0]">
                      100%
                    </span>
                  </div>
                </div>

                {/* Tema Gelap / Terang */}
                <div className="mt-3.5 border-t border-[#07525E]/10 pt-3 dark:border-[#3EC1D3]/15">
                  <div className="text-[11px] font-bold text-[#355158] dark:text-[#A9C2C9]">
                    Tema Warna
                  </div>
                  <div className="mt-1.5 grid grid-cols-3 gap-1 rounded-xl bg-[#EBF5F8]/90 p-1 dark:bg-[#0B2027]">
                    <button
                      type="button"
                      onClick={() => onChangeThemePref('system')}
                      className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                        themePref === 'system'
                          ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                          : 'text-[#526A70] hover:text-[#07525E] dark:text-[#8DA8B0] dark:hover:text-[#E6F4F7]'
                      }`}
                    >
                      <Laptop className="h-3.5 w-3.5" />
                      <span>Sistem</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeThemePref('light')}
                      className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                        themePref === 'light'
                          ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                          : 'text-[#526A70] hover:text-[#07525E] dark:text-[#8DA8B0] dark:hover:text-[#E6F4F7]'
                      }`}
                    >
                      <Sun className="h-3.5 w-3.5 text-[#D88B15]" />
                      <span>Terang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeThemePref('dark')}
                      className={`inline-flex cursor-pointer items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                        themePref === 'dark'
                          ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#3EC1D3]'
                          : 'text-[#526A70] hover:text-[#07525E] dark:text-[#8DA8B0] dark:hover:text-[#E6F4F7]'
                      }`}
                    >
                      <Moon className="h-3.5 w-3.5" />
                      <span>Gelap</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!forceCompactNav &&
            (role === 'publik' ? (
              <button
                type="button"
                onClick={onOpenLogin}
                className="hidden shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 sm:inline-flex"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Masuk Pengelola</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onLogout}
                className="hidden shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#07525E]/20 bg-white/85 px-4 py-2 text-[13px] font-semibold text-[#07525E] transition-colors hover:bg-white dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#113540] sm:inline-flex"
              >
                <LogOut className="h-3.5 w-3.5 text-[#D88B15] dark:text-[#F0B243]" />
                <span>
                  Keluar ({role === 'superadmin' ? 'Super Admin' : 'Admin'})
                </span>
              </button>
            ))}

          <button
            type="button"
            aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className={`inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-[#07525E]/15 bg-white/80 text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] ${
              forceCompactNav ? '' : 'lg:hidden'
            }`}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className={`border-t border-[#07525E]/10 bg-white/95 px-4 py-4 backdrop-blur-md dark:border-[#3EC1D3]/15 dark:bg-[#081C22]/95 ${
            forceCompactNav ? '' : 'lg:hidden'
          }`}
        >
          <div className="flex flex-col gap-1.5">
            {visibleNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectView(item.id)}
                className={`w-full cursor-pointer rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-colors ${
                  activeView === item.id
                    ? 'bg-[#EBF5F8] text-[#07525E] dark:bg-[#113540] dark:text-[#3EC1D3]'
                    : 'text-[#3D575E] hover:bg-[#F6FAFB] dark:text-[#A9C2C9] dark:hover:bg-[#0E2830]'
                }`}
              >
                {item.label}
              </button>
            ))}

            {role === 'publik' ? (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onOpenLogin();
                }}
                className="mt-2 w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-sm font-semibold text-white"
              >
                Masuk Admin / Super Admin
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  onLogout();
                }}
                className="mt-2 w-full cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
              >
                Keluar ({role === 'superadmin' ? 'Super Admin' : 'Admin'})
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
