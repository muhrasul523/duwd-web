interface FooterProps {
  onNavigate: (sectionId: string) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  return (
    <footer className="mt-8 border-t border-[#07525E]/12 bg-white/65 px-4 py-12 backdrop-blur-md sm:px-6">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="text-base font-bold tracking-tight text-[#07525E]">
              DUWD DPP Wahdah Islamiyah
            </div>
            <p className="mt-2.5 max-w-sm text-xs leading-relaxed text-[#526A70]">
              Departemen Urusan Wilayah dan Daerah — Dewan Pimpinan Pusat Wahdah Islamiyah. Portal resmi tata kelola organisasi, koordinasi 4M, dan arsip digital terpadu pada domain duwd.web.id.
            </p>
          </div>

          <div className="md:col-span-3">
            <div className="text-xs font-bold uppercase tracking-wider text-[#07525E]">
              Navigasi Portal
            </div>
            <ul className="mt-3 space-y-2 text-xs text-[#355158]">
              {[
                { id: 'beranda', label: 'Beranda Utama' },
                { id: 'program', label: 'Pilar Program DUWD' },
                { id: 'tata-kelola', label: 'Konsol 4M & Wilayah' },
                { id: 'arsip-drive', label: 'Repositori Google Drive' },
                { id: 'backend-gas', label: 'Dokumentasi Backend GAS' },
              ].map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(link.id);
                    }}
                    className="hover:text-[#0C7A89] hover:underline"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4">
            <div className="text-xs font-bold uppercase tracking-wider text-[#07525E]">
              Sekretariat &amp; Kontak Resmi
            </div>
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-[#355158]">
              <p>Jl. Antang Raya No. 48, Makassar, Sulawesi Selatan 90234</p>
              <p>Kantor Penghubung DPP: Tebet Timur Dalam, Jakarta Selatan</p>
              <p className="font-medium text-[#07525E]">
                sekretariat@duwd.web.id · duwd.web.id
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col justify-between gap-3 border-t border-[#07525E]/10 pt-6 text-xs text-[#526A70] sm:flex-row sm:items-center">
          <div>
            &copy; 2026 Departemen Urusan Wilayah dan Daerah DPP Wahdah Islamiyah. Seluruh hak cipta dilindungi.
          </div>
          <div>Menuju Visi Organisasi Wahdah Islamiyah 2030</div>
        </div>
      </div>
    </footer>
  );
}
