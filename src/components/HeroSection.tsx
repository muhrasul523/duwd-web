import { ArrowRight, FolderKanban } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import heroPavilionImg from '../assets/images/hero_duwd_pavilion_1794631831942.jpg';

interface HeroSectionProps {
  totalDpw: number;
  totalDpd: number;
  totalAgenda4M: number;
  totalArsipDrive: number;
  onExploreGovernance: () => void;
  onExploreDrive: () => void;
}

export function HeroSection({
  totalDpw,
  totalDpd,
  totalAgenda4M,
  totalArsipDrive,
  onExploreGovernance,
  onExploreDrive,
}: HeroSectionProps) {
  const [imageError, setImageError] = useState(false);

  const metrics = [
    {
      value: `${totalDpw} DPW`,
      label: 'Struktur Tingkat Wilayah',
      context: 'Terkonsolidasi Nasional',
    },
    {
      value: `${totalDpd} DPD`,
      label: 'Dewan Pengurus Daerah',
      context: 'Pelaporan Berkala Aktif',
    },
    {
      value: `${totalAgenda4M} Agenda`,
      label: 'Siklus 4M Periode 2026',
      context: 'Muswil · Mukerwil · Musda · Mukerda',
    },
    {
      value: `${totalArsipDrive} Berkas`,
      label: 'Repositori Google Drive',
      context: 'PDF · PPT · DOCX · Media',
    },
  ];

  return (
    <section id="beranda" className="px-4 pt-10 pb-12 sm:px-6 lg:pt-14 lg:pb-16">
      <div className="mx-auto max-w-[1200px]">
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Narrative Column */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-center lg:col-span-6"
          >
            <p className="mb-4 text-[13px] font-semibold tracking-wide text-[#0C7A89]">
              Departemen Urusan Wilayah dan Daerah · DPP Wahdah Islamiyah
            </p>

            <h1
              className="font-bold tracking-tight text-[#07525E] [text-wrap:balance]"
              style={{
                fontSize: 'clamp(2rem, 3.6vw, 3.15rem)',
                lineHeight: 1.14,
              }}
            >
              Transformasi Digital &amp; Penguatan Tata Kelola Wilayah dan Daerah Menuju Visi Organisasi 2030.
            </h1>

            <p className="mt-5 max-w-[60ch] text-[15px] leading-relaxed text-[#3D575E] sm:text-base">
              Portal resmi duwd.web.id menghimpun monitoring kinerja DPW dan DPD, manajemen kalender 4M, pemetaan levelisasi kader, serta repositori tautan Google Drive dalam satu ekosistem serverless terpadu.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                type="button"
                onClick={onExploreGovernance}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-2xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-6 py-3 text-sm font-semibold text-white shadow-md transition-transform duration-150 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0C7A89]"
              >
                <span>Buka Konsol Tata Kelola</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onExploreDrive}
                className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap shrink-0 rounded-2xl border border-[#0C7A89]/25 bg-white/75 px-5 py-3 text-sm font-semibold text-[#07525E] backdrop-blur-md transition-colors duration-150 hover:border-[#0C7A89]/45 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0C7A89]"
              >
                <FolderKanban className="h-4 w-4 text-[#D88B15]" />
                <span>Repositori Drive</span>
              </button>
            </div>
          </motion.div>

          {/* Right Architectural Showcase Column */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6"
          >
            <div className="relative h-full min-h-[280px] overflow-hidden rounded-2xl border border-[#0C7A89]/15 bg-[#07525E] shadow-[0_20px_48px_-16px_rgba(7,82,94,0.22)] lg:min-h-[410px]">
              {!imageError ? (
                <img
                  src={heroPavilionImg}
                  alt="Paviliun arsitektur geometris Islam modern dengan kaca buram dan aksen warna deep cyan serta amber gold"
                  referrerPolicy="no-referrer"
                  onError={() => setImageError(true)}
                  className="h-full w-full object-cover lg:h-full"
                />
              ) : (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center bg-gradient-to-br from-[#07525E] via-[#0C7A89] to-[#0E6A5E] p-8 text-center text-white">
                  <div className="h-20 w-20 rounded-2xl border border-white/25 bg-white/10" />
                  <p className="mt-4 text-sm font-semibold">
                    Arsitektur Tata Kelola Wilayah &amp; Daerah
                  </p>
                </div>
              )}

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#042D35]/90 via-[#042D35]/50 to-transparent p-5 sm:p-6">
                <p className="text-xs font-medium text-[#F5C56B]">
                  duwd.web.id · Ekosistem Digital Khidmat Struktural
                </p>
                <p className="mt-1 text-sm font-semibold text-white">
                  Integrasi GitHub Pages, Google Apps Script, Sheets &amp; Drive Terpusat
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Full-Width 4-Column KPI Strip below Hero Split */}
        <div className="mt-8 grid grid-cols-1 divide-y divide-[#07525E]/10 glass-surface sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
          {metrics.map((item) => (
            <div key={item.label} className="px-6 py-5">
              <div className="tabular-nums text-2xl font-bold tracking-tight text-[#07525E]">
                {item.value}
              </div>
              <div className="mt-1 text-sm font-semibold text-[#0F2429]">
                {item.label}
              </div>
              <div className="mt-0.5 text-xs text-[#526A70]">{item.context}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
