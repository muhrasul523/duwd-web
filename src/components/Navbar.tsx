import { Menu, X } from 'lucide-react';
import { useState } from 'react';

interface NavbarProps {
  onNavigate: (sectionId: string) => void;
}

const NAV_LINKS = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'program', label: 'Program' },
  { id: 'tata-kelola', label: 'Tata Kelola' },
  { id: 'arsip-drive', label: 'Arsip Drive' },
  { id: 'backend-gas', label: 'Backend GAS' },
];

export function Navbar({ onNavigate }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLinkClick = (sectionId: string) => {
    setMobileOpen(false);
    onNavigate(sectionId);
  };

  return (
    <header className="sticky top-0 z-40 glass-nav">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
        {/* Zone 1: Single-line Brand Title */}
        <a
          href="#beranda"
          onClick={(e) => {
            e.preventDefault();
            handleLinkClick('beranda');
          }}
          className="flex items-center gap-2.5 whitespace-nowrap shrink-0 text-[#07525E] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0C7A89]"
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 64 64"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect width="64" height="64" rx="16" fill="#07525E" />
            <polygon
              points="32,12 46,18 52,32 46,46 32,52 18,46 12,32 18,18"
              stroke="rgba(255,255,255,0.38)"
              strokeWidth="2"
              fill="none"
            />
            <rect
              x="21"
              y="21"
              width="22"
              height="22"
              rx="3"
              transform="rotate(45 32 32)"
              stroke="#D88B15"
              strokeWidth="2.5"
              fill="rgba(12,122,137,0.35)"
            />
            <circle cx="32" cy="32" r="4.5" fill="#D88B15" />
          </svg>
          <span className="text-[15px] font-bold tracking-tight sm:text-base">
            DUWD Wahdah Islamiyah
          </span>
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Navigasi utama"
          className="hidden items-center gap-6 md:flex"
        >
          {NAV_LINKS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick(item.id);
              }}
              className="whitespace-nowrap shrink-0 text-[13px] font-medium text-[#355158] transition-colors duration-150 hover:text-[#0C7A89] hover:underline hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0C7A89]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Primary Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick('layanan-khidmat')}
            className="hidden cursor-pointer whitespace-nowrap shrink-0 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0C7A89] sm:inline-flex"
          >
            Layanan Khidmat
          </button>

          <button
            type="button"
            aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-[#0C7A89]/15 bg-white/80 text-[#07525E] md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[#07525E]/10 bg-white/95 px-4 py-4 backdrop-blur-md md:hidden">
          <nav className="flex flex-col gap-2" aria-label="Navigasi seluler">
            {NAV_LINKS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleLinkClick(item.id);
                }}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-[#0F2429] hover:bg-[#EBF5F8]"
              >
                {item.label}
              </a>
            ))}
            <button
              type="button"
              onClick={() => handleLinkClick('layanan-khidmat')}
              className="mt-2 w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-sm font-semibold text-white"
            >
              Layanan Khidmat
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
