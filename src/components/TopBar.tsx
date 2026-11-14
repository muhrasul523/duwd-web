import { LogIn, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import defaultLogoWi from '../assets/logo-wi.png';
import type { UserRole } from '../types/org';

export type ActiveView = 'direktori' | 'proker' | 'dpw_dpd' | 'unit' | 'pengaturan';

interface TopBarProps {
  namaAplikasi: string;
  logoUrl: string;
  role: UserRole;
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export function TopBar({
  namaAplikasi,
  logoUrl,
  role,
  activeView,
  onChangeView,
  onOpenLogin,
  onLogout,
}: TopBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems: { id: ActiveView; label: string; visible: boolean }[] = [
    { id: 'direktori', label: 'Daftar Pengurus', visible: true },
    { id: 'proker', label: 'Program Kerja 2027', visible: true },
    { id: 'dpw_dpd', label: 'Wilayah & Lembaga', visible: true },
    { id: 'unit', label: 'Kelola Unit', visible: role === 'superadmin' },
    { id: 'pengaturan', label: 'Pengaturan & GAS', visible: role === 'superadmin' },
  ];

  const visibleNav = navItems.filter((item) => item.visible);

  const handleSelectView = (view: ActiveView) => {
    setMobileOpen(false);
    onChangeView(view);
  };

  return (
    <header className="sticky top-0 z-40 glass-nav">
      <div className="mx-auto flex max-w-[1160px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Logo Wahdah Islamiyah + Single-Line Brand Title */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            handleSelectView('direktori');
          }}
          className="flex items-center gap-3 whitespace-nowrap shrink-0 text-[#07525E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0C7A89]"
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
            className="h-9 w-9 shrink-0 rounded-xl object-contain bg-white/90 p-0.5 border border-[#07525E]/10"
          />
          <span className="text-[15px] font-bold tracking-tight sm:text-base">
            {namaAplikasi || 'DUWD DPP WI'}
          </span>
        </a>

        {/* Zone 2: Navigation Links */}
        <nav aria-label="Navigasi utama" className="hidden items-center gap-6 md:flex">
          {visibleNav.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectView(item.id)}
                className={`cursor-pointer whitespace-nowrap shrink-0 text-[13px] font-semibold transition-colors duration-150 ${
                  isActive
                    ? 'text-[#0C7A89] underline decoration-2 underline-offset-8'
                    : 'text-[#3D575E] hover:text-[#07525E]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Role Action */}
        <div className="flex items-center gap-2 shrink-0">
          {role === 'publik' ? (
            <button
              type="button"
              onClick={onOpenLogin}
              className="hidden cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 sm:inline-flex"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Masuk Pengelola</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onLogout}
              className="hidden cursor-pointer items-center gap-1.5 whitespace-nowrap shrink-0 rounded-xl border border-[#07525E]/20 bg-white/85 px-4 py-2 text-[13px] font-semibold text-[#07525E] transition-colors hover:bg-white sm:inline-flex"
            >
              <LogOut className="h-3.5 w-3.5 text-[#D88B15]" />
              <span>
                Keluar ({role === 'superadmin' ? 'Super Admin' : 'Admin'})
              </span>
            </button>
          )}

          <button
            type="button"
            aria-label={mobileOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-[#07525E]/15 bg-white/80 text-[#07525E] md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#07525E]/10 bg-white/95 px-4 py-4 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-2">
            {visibleNav.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectView(item.id)}
                className={`w-full cursor-pointer rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${
                  activeView === item.id
                    ? 'bg-[#EBF5F8] text-[#07525E]'
                    : 'text-[#3D575E] hover:bg-[#F6FAFB]'
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
                className="mt-1 w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-sm font-semibold text-white"
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
                className="mt-1 w-full cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-4 py-2.5 text-sm font-semibold text-[#07525E]"
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
