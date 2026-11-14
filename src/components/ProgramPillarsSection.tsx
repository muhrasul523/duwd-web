import { ArrowUpRight, CalendarClock, Compass, FolderArchive, Users } from 'lucide-react';

export type WorkspaceShortcut = '4m' | 'wilayah' | 'kader' | 'arsip' | 'khidmat';

interface ProgramPillarsSectionProps {
  onSelectShortcut: (target: WorkspaceShortcut) => void;
}

const PILLARS: {
  number: string;
  title: string;
  subtitle: string;
  description: string;
  actionLabel: string;
  target: WorkspaceShortcut;
  spanClass: string;
  icon: typeof Compass;
  accentTint: string;
}[] = [
  {
    number: '01.',
    title: 'Akselerasi DPW & DPD',
    subtitle: 'Konsolidasi Struktur · 38 Wilayah Nasional',
    description:
      'Pemantauan status konsolidasi Dewan Pengurus Wilayah dan Daerah, kelengkapan kepengurusan, serta tingkat kesiapan pelaksanaan musyawarah secara real-time.',
    actionLabel: 'Lihat Direktori Wilayah',
    target: 'wilayah',
    spanClass: 'lg:col-span-7',
    icon: Compass,
    accentTint: 'from-[#EBF5F8] to-[#FFFFFF]/80',
  },
  {
    number: '02.',
    title: 'Manajemen 4M',
    subtitle: 'Muswil · Mukerwil · Musda · Mukerda',
    description:
      'Penjadwalan terpadu agenda Musyawarah Wilayah, Musyawarah Kerja Wilayah, Musyawarah Daerah, dan Mukerda lengkap dengan progres kesiapan panitia dan tautan SK.',
    actionLabel: 'Kelola Jadwal 4M',
    target: '4m',
    spanClass: 'lg:col-span-5',
    icon: CalendarClock,
    accentTint: 'from-[#FFF8EC] to-[#FFFFFF]/85',
  },
  {
    number: '03.',
    title: 'Database & Levelisasi Kader',
    subtitle: "Ta'rif · Takwin · Tanfidz · Murabbi",
    description:
      'Rekapitulasi distribusi kader aktif per jenjang pembinaan di setiap DPW dengan angka tabular terstruktur untuk perencanaan dakwah dan kaderisasi 2030.',
    actionLabel: 'Buka Data Levelisasi',
    target: 'kader',
    spanClass: 'lg:col-span-5',
    icon: Users,
    accentTint: 'from-[#ECF6F2] to-[#FFFFFF]/85',
  },
  {
    number: '04.',
    title: 'Arsip Google Drive & Layanan Khidmat',
    subtitle: 'PDF · PPT · DOCX · Media · Pengajuan Online',
    description:
      'Manajemen tautan dinamis Google Drive untuk pedoman organisasi, materi persidangan, audio taujih, hingga saluran pengajuan administrasi resmi ke DPP.',
    actionLabel: 'Akses Arsip Drive',
    target: 'arsip',
    spanClass: 'lg:col-span-7',
    icon: FolderArchive,
    accentTint: 'from-[#EBF5F8] via-[#ECF6F2]/70 to-[#FFFFFF]/85',
  },
];

export function ProgramPillarsSection({ onSelectShortcut }: ProgramPillarsSectionProps) {
  return (
    <section id="program" className="px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[13px] font-semibold text-[#0C7A89]">
              Arsitektur Program Departemen
            </p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] sm:text-3xl [text-wrap:balance]">
              Empat Pilar Tata Kelola Wilayah dan Daerah
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-[#526A70]">
            Setiap kartu terhubung langsung dengan modul kerja interaktif dan skrip backend Google Apps Script di repositori proyek.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.number}
                className={`${pillar.spanClass} glass-surface bg-gradient-to-br ${pillar.accentTint} flex flex-col justify-between p-6 transition-transform duration-200 hover:-translate-y-0.5 sm:p-7`}
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <div className="text-xs font-medium text-[#526A70]">
                      {pillar.subtitle}
                    </div>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#07525E]/8 text-[#0C7A89]">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>

                  <h3 className="mt-4 text-xl font-bold tracking-tight text-[#07525E]">
                    <span className="mr-2 text-[#D88B15] tabular-nums">{pillar.number}</span>
                    {pillar.title}
                  </h3>

                  <p className="mt-2.5 text-sm leading-relaxed text-[#3D575E]">
                    {pillar.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#07525E]/10">
                  <button
                    type="button"
                    onClick={() => onSelectShortcut(pillar.target)}
                    className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-[#0C7A89] transition-colors duration-150 hover:text-[#07525E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0C7A89]"
                  >
                    <span>{pillar.actionLabel}</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
