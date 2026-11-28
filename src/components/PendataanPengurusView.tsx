import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Mail,
  MessageCircle,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  UserCheck,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import defaultLogoWi from '../assets/logo-wi.png';
import { lookupPengurusByWa, submitPendataanPengurus } from '../services/orgService';
import type { PendataanLookupResult, ThemePreference } from '../types/org';
import { normalizeWhatsApp } from '../utils/whatsapp';
import { WhatsAppInput } from './WhatsAppInput';

interface PendataanPengurusViewProps {
  namaAplikasi: string;
  logoUrl: string;
  webAppUrl: string;
  themePref: ThemePreference;
  onChangeThemePref: (pref: ThemePreference) => void;
  onBackToPortal: () => void;
}

const BANK_OPTIONS = [
  'BSI (Bank Syariah Indonesia)',
  'BNI',
  'BRI',
  'Bank Muamalat',
  'BCA',
  'Bank Mandiri',
  'BTN',
  'CIMB Niaga',
  'Bank Sulselbar',
  'Bank Mega Syariah',
  'Bank Syariah Bukopin',
  'Bank Permata',
  'Bank Danamon',
  'Bank Panin',
  'SeaBank',
  'Bank Jago',
] as const;

const ADMIN_DUWD_WA_NUMBER = '6281243086242';
const ADMIN_DUWD_WA_DISPLAY = '0812 4308 6242';

function matchBankPreset(savedBank?: string): { selectVal: string; customVal: string } {
  const clean = (savedBank || '').trim();
  if (!clean) return { selectVal: '', customVal: '' };
  const exact = BANK_OPTIONS.find((b) => b.toLowerCase() === clean.toLowerCase());
  if (exact) return { selectVal: exact, customVal: '' };
  // Cocokkan singkatan umum seperti "BSI" atau "Muamalat"
  const upper = clean.toUpperCase();
  if (upper === 'BSI') return { selectVal: 'BSI (Bank Syariah Indonesia)', customVal: '' };
  if (upper === 'MUAMALAT') return { selectVal: 'Bank Muamalat', customVal: '' };
  if (upper === 'MANDIRI') return { selectVal: 'Bank Mandiri', customVal: '' };
  return { selectVal: 'LAINNYA', customVal: clean };
}

export function PendataanPengurusView({
  namaAplikasi,
  logoUrl,
  webAppUrl,
  themePref,
  onChangeThemePref,
  onBackToPortal,
}: PendataanPengurusViewProps) {
  const [step, setStep] = useState<'verify' | 'form' | 'success'>('verify');
  const [waInput, setWaInput] = useState('');
  const [checkingWa, setCheckingWa] = useState(false);
  const [notFoundWa, setNotFoundWa] = useState(false);
  const [verifyError, setVerifyError] = useState('');

  const [pengurus, setPengurus] = useState<PendataanLookupResult | null>(null);
  const [email, setEmail] = useState('');
  const [bankSelect, setBankSelect] = useState('');
  const [bankCustom, setBankCustom] = useState('');
  const [nomorRekening, setNomorRekening] = useState('');
  const [namaPemilik, setNamaPemilik] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copiedAdminWa, setCopiedAdminWa] = useState(false);

  const isDarkActive = useMemo(() => {
    if (themePref === 'dark') return true;
    if (themePref === 'light') return false;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }, [themePref]);

  const handleToggleTheme = () => {
    onChangeThemePref(isDarkActive ? 'light' : 'dark');
  };

  const handleCheckWa = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyError('');
    setNotFoundWa(false);

    const normalized = normalizeWhatsApp(waInput);
    if (!normalized || normalized.length < 9) {
      setVerifyError('Masukkan nomor WhatsApp Anda terlebih dahulu.');
      return;
    }

    setCheckingWa(true);
    try {
      const res = await lookupPengurusByWa(normalized, webAppUrl);
      if (!res.ok) {
        setVerifyError(res.error || 'Gagal memeriksa data pengurus. Silakan coba lagi.');
        return;
      }
      if (!res.found || !res.pengurus) {
        setNotFoundWa(true);
        return;
      }

      const found = res.pengurus;
      setPengurus(found);
      setEmail(found.email || '');
      const bankPreset = matchBankPreset(found.namaBank);
      setBankSelect(bankPreset.selectVal);
      setBankCustom(bankPreset.customVal);
      setNomorRekening((found.nomorRekening || '').replace(/\D/g, ''));
      setNamaPemilik((found.namaPemilikRekening || found.namaLengkap || '').toUpperCase());
      setFormError('');
      setStep('form');
    } finally {
      setCheckingWa(false);
    }
  };

  const handleSubmitPendataan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pengurus) return;
    setFormError('');

    const cleanEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail)) {
      setFormError('Format alamat email belum valid. Contoh: nama@domain.com');
      return;
    }

    const finalBank = bankSelect === 'LAINNYA' ? bankCustom.trim() : bankSelect.trim();
    if (!finalBank) {
      setFormError('Pilih atau tuliskan nama bank terlebih dahulu.');
      return;
    }

    const cleanRek = nomorRekening.replace(/\D/g, '');
    if (cleanRek.length < 5) {
      setFormError('Nomor rekening belum valid, silakan periksa kembali.');
      return;
    }

    const cleanPemilik = namaPemilik.trim().toUpperCase();
    if (cleanPemilik.length < 2) {
      setFormError('Nama pemilik rekening wajib diisi.');
      return;
    }

    setSaving(true);
    try {
      const res = await submitPendataanPengurus(
        {
          id: pengurus.id,
          whatsapp: pengurus.whatsapp,
          email: cleanEmail,
          namaBank: finalBank,
          nomorRekening: cleanRek,
          namaPemilikRekening: cleanPemilik,
        },
        webAppUrl,
      );

      if (!res.ok || !res.pengurus) {
        setFormError(res.error || 'Gagal menyimpan data pendataan.');
        return;
      }

      setPengurus(res.pengurus);
      setStep('success');
    } finally {
      setSaving(false);
    }
  };

  const confirmationWaLink = useMemo(() => {
    if (!pengurus) return `https://wa.me/${ADMIN_DUWD_WA_NUMBER}`;
    const unitLabel = pengurus.kodeUnit
      ? `${pengurus.kodeUnit} — ${pengurus.namaUnit}`
      : pengurus.namaUnit;
    const msg = [
      'Assalamu\'alaikum warahmatullahi wabarakatuh.',
      'Konfirmasi Pendataan Pengurus DUWD DPP WI (Email & Nomor Rekening):',
      '',
      `Nama: ${pengurus.namaLengkap}`,
      `Amanah: ${pengurus.amanah}`,
      `Unit: ${unitLabel}`,
      '',
      `Data telah saya kirimkan melalui duwd.web.id/data-pengurus dan saya siap menyimpan nomor resmi Admin DUWD DPP WI (${ADMIN_DUWD_WA_DISPLAY}).`,
      'Jazakumullahu khairan.',
    ].join('\n');
    return `https://wa.me/${ADMIN_DUWD_WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  }, [pengurus]);

  const handleCopyAdminWa = async () => {
    try {
      await navigator.clipboard.writeText(ADMIN_DUWD_WA_DISPLAY.replace(/\s+/g, ''));
      setCopiedAdminWa(true);
      window.setTimeout(() => setCopiedAdminWa(false), 1800);
    } catch {
      setCopiedAdminWa(false);
    }
  };

  return (
    <div className="min-h-screen duwd-ambient-bg text-[#0F2429] transition-colors duration-200 dark:text-[#E6F4F7]">
      {/* Top Minimal Header */}
      <header className="sticky top-0 z-30 glass-nav">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2.5">
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
            <div className="leading-tight">
              <div className="text-sm font-bold text-[#07525E] dark:text-[#E6F4F7]">
                {namaAplikasi || 'DUWD DPP WI'}
              </div>
              <div className="text-[11px] font-medium text-[#526A70] dark:text-[#9BB5BC]">
                Pendataan Pengurus Internal
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleTheme}
              aria-label="Ubah tema gelap atau terang"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-[#07525E]/15 bg-white/85 text-[#07525E] hover:bg-white dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
            >
              {isDarkActive ? (
                <Sun className="h-4 w-4 text-[#F0B243]" />
              ) : (
                <Moon className="h-4 w-4 text-[#0C7A89]" />
              )}
            </button>
            <button
              type="button"
              onClick={onBackToPortal}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/15 bg-white/85 px-3 text-xs font-semibold text-[#07525E] hover:bg-white dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Portal</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
        {/* Title Banner */}
        <div className="text-center">
          <p className="text-xs font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
            Departemen Urusan Wilayah dan Daerah &middot; DPP Wahdah Islamiyah
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] dark:text-[#E6F4F7] sm:text-3xl">
            Pendataan Email &amp; Rekening Pengurus
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-[#526A70] dark:text-[#9BB5BC]">
            Halaman resmi pemutakhiran data alamat email dan rekening bagi Pengurus DUWD DPP Wahdah Islamiyah.
          </p>
        </div>

        {/* STEP 1: Verifikasi Nomor WA */}
        {step === 'verify' && (
          <div className="mt-6 glass-surface-strong p-6 sm:p-7">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EBF5F8] text-[#0C7A89] dark:bg-[#113540] dark:text-[#3EC1D3]">
                <Phone className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  Verifikasi Nomor WhatsApp Pengurus
                </h2>
                <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#9BB5BC]">
                  Masukkan nomor WhatsApp Anda yang terdaftar di struktur kepengurusan DUWD DPP WI.
                </p>
              </div>
            </div>

            <form onSubmit={handleCheckWa} className="mt-5 space-y-4">
              {verifyError && (
                <div className="rounded-xl border border-amber-500/35 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/60 dark:text-amber-200">
                  {verifyError}
                </div>
              )}

              <div>
                <label
                  htmlFor="pendataan-wa"
                  className="mb-1.5 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]"
                >
                  Nomor WhatsApp
                </label>
                <WhatsAppInput
                  id="pendataan-wa"
                  required
                  value={waInput}
                  onChange={(val) => {
                    setWaInput(val);
                    if (notFoundWa) setNotFoundWa(false);
                    if (verifyError) setVerifyError('');
                  }}
                  placeholder="Contoh: 081234567890"
                />
              </div>

              <button
                type="submit"
                disabled={checkingWa}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{checkingWa ? 'Memeriksa Data Pengurus...' : 'Cek & Lanjutkan'}</span>
              </button>
            </form>

            {notFoundWa && (
              <div className="mt-5 rounded-xl border border-amber-500/40 bg-amber-50/95 p-4 text-xs leading-relaxed text-amber-950 dark:border-amber-400/35 dark:bg-amber-950/60 dark:text-amber-100">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                  <div>
                    <p className="font-bold">Nomor WhatsApp Belum Terdaftar sebagai Pengurus</p>
                    <p className="mt-1">
                      Nomor <span className="font-mono font-semibold">{normalizeWhatsApp(waInput)}</span> tidak ditemukan pada daftar Pengurus DUWD DPP Wahdah Islamiyah.
                    </p>
                    <p className="mt-1.5 font-medium">
                      Apabila Anda merupakan pengurus aktif DUWD atau menggunakan nomor WhatsApp baru, harap koordinasikan dengan{' '}
                      <strong className="underline">Sekretaris DUWD (Muh. Rasul Ramli)</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Identitas Read-Only + Form Pendataan */}
        {step === 'form' && pengurus && (
          <div className="mt-6 space-y-5">
            {/* Read-only Identity Card */}
            <div className="glass-surface-strong p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3 border-b border-[#07525E]/10 pb-3.5 dark:border-[#3EC1D3]/15">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#07525E] dark:text-[#E6F4F7]">
                      Terverifikasi sebagai Pengurus DUWD
                    </h2>
                    <p className="text-[11px] text-[#526A70] dark:text-[#9BB5BC]">
                      Data kepengurusan berikut bersifat hanya-baca (otomatis dari sistem).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setStep('verify');
                    setPengurus(null);
                  }}
                  className="shrink-0 cursor-pointer rounded-lg border border-[#07525E]/15 px-2.5 py-1 text-[11px] font-semibold text-[#526A70] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
                >
                  Ganti WA
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-[#F4FAFB] px-3.5 py-2.5 dark:bg-[#0B232B]">
                  <div className="text-[11px] font-medium text-[#526A70] dark:text-[#8DA8B0]">
                    Nama Lengkap
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    {pengurus.namaLengkap}
                  </div>
                </div>

                <div className="rounded-xl bg-[#F4FAFB] px-3.5 py-2.5 dark:bg-[#0B232B]">
                  <div className="text-[11px] font-medium text-[#526A70] dark:text-[#8DA8B0]">
                    Amanah
                  </div>
                  <div className="mt-0.5 text-sm font-bold text-[#0C7A89] dark:text-[#3EC1D3]">
                    {pengurus.amanah || '-'}
                  </div>
                </div>

                <div className="rounded-xl bg-[#F4FAFB] px-3.5 py-2.5 dark:bg-[#0B232B] sm:col-span-2">
                  <div className="text-[11px] font-medium text-[#526A70] dark:text-[#8DA8B0]">
                    Unit Kepengurusan
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-[#0F2429] dark:text-[#E6F4F7]">
                    {pengurus.kodeUnit
                      ? `${pengurus.kodeUnit} — ${pengurus.namaUnit}`
                      : pengurus.namaUnit}
                  </div>
                </div>
              </div>
            </div>

            {/* Form Input Email & Rekening */}
            <form onSubmit={handleSubmitPendataan} className="glass-surface-strong p-6 sm:p-7">
              <h2 className="text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                Formulir Email &amp; Nomor Rekening
              </h2>
              <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#9BB5BC]">
                Silakan lengkapi alamat email aktif dan data rekening Anda dengan benar.
              </p>

              {formError && (
                <div className="mt-4 rounded-xl border border-amber-500/35 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/60 dark:text-amber-200">
                  {formError}
                </div>
              )}

              <div className="mt-5 space-y-4">
                {/* Email */}
                <div>
                  <label
                    htmlFor="pendataan-email"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]"
                  >
                    <Mail className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
                    <span>Alamat Email Aktif</span>
                  </label>
                  <input
                    id="pendataan-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@gmail.com"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>

                {/* Pilih Bank */}
                <div>
                  <label
                    htmlFor="pendataan-bank"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]"
                  >
                    <Building2 className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
                    <span>Nama Bank</span>
                  </label>
                  <select
                    id="pendataan-bank"
                    required
                    value={bankSelect}
                    onChange={(e) => setBankSelect(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  >
                    <option value="">-- Pilih Bank --</option>
                    {BANK_OPTIONS.map((bank) => (
                      <option key={bank} value={bank}>
                        {bank}
                      </option>
                    ))}
                    <option value="LAINNYA">Lainnya (Isi Manual)</option>
                  </select>
                </div>

                {bankSelect === 'LAINNYA' && (
                  <div>
                    <label
                      htmlFor="pendataan-bank-custom"
                      className="mb-1.5 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]"
                    >
                      Tulis Nama Bank
                    </label>
                    <input
                      id="pendataan-bank-custom"
                      type="text"
                      required
                      value={bankCustom}
                      onChange={(e) => setBankCustom(e.target.value)}
                      placeholder="Contoh: Bank BPD Kaltim"
                      className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                    />
                  </div>
                )}

                {/* Nomor Rekening (silent digits-only, min 5 digits on submit, no hint text) */}
                <div>
                  <label
                    htmlFor="pendataan-norek"
                    className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]"
                  >
                    <CreditCard className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
                    <span>Nomor Rekening</span>
                  </label>
                  <input
                    id="pendataan-norek"
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    required
                    value={nomorRekening}
                    onChange={(e) => setNomorRekening(e.target.value.replace(/\D/g, ''))}
                    placeholder="Masukkan nomor rekening"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 font-mono text-sm text-[#0F2429] tracking-wide focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>

                {/* Nama Pemilik Rekening (Auto CAPSLOCK) */}
                <div>
                  <label
                    htmlFor="pendataan-pemilik"
                    className="mb-1.5 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]"
                  >
                    Nama Pemilik Rekening
                  </label>
                  <input
                    id="pendataan-pemilik"
                    type="text"
                    required
                    value={namaPemilik}
                    onChange={(e) => setNamaPemilik(e.target.value.toUpperCase())}
                    placeholder="NAMA SESUAI BUKU REKENING"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm font-semibold uppercase text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>
              </div>

              <div className="mt-6 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{saving ? 'Menyimpan Data...' : 'Simpan Data Pengurus'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: Berhasil Simpan & Arahan Konfirmasi WA Admin DUWD */}
        {step === 'success' && pengurus && (
          <div className="mt-6 glass-surface-strong p-6 sm:p-7">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h2 className="mt-3.5 text-lg font-bold text-[#07525E] dark:text-[#E6F4F7]">
                Alhamdulillah, Data Berhasil Disimpan
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#526A70] dark:text-[#9BB5BC]">
                Data email dan rekening Anda telah tercatat di database DUWD DPP Wahdah Islamiyah.
              </p>
            </div>

            {/* Ringkasan Tersimpan */}
            <div className="mt-5 rounded-xl border border-[#07525E]/12 bg-[#F4FAFB] p-4 text-xs dark:border-[#3EC1D3]/20 dark:bg-[#0B232B]">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-[#526A70] dark:text-[#8DA8B0]">Nama:</span>
                  <div className="font-bold text-[#07525E] dark:text-[#E6F4F7]">{pengurus.namaLengkap}</div>
                </div>
                <div>
                  <span className="text-[#526A70] dark:text-[#8DA8B0]">Amanah &amp; Unit:</span>
                  <div className="font-semibold text-[#0F2429] dark:text-[#E6F4F7]">
                    {pengurus.amanah} &middot; {pengurus.kodeUnit || pengurus.namaUnit}
                  </div>
                </div>
                <div>
                  <span className="text-[#526A70] dark:text-[#8DA8B0]">Email:</span>
                  <div className="font-mono font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
                    {pengurus.email}
                  </div>
                </div>
                <div>
                  <span className="text-[#526A70] dark:text-[#8DA8B0]">Rekening:</span>
                  <div className="font-semibold text-[#0F2429] dark:text-[#E6F4F7]">
                    {pengurus.namaBank} &middot;{' '}
                    <span className="font-mono">{pengurus.nomorRekening}</span>
                  </div>
                  <div className="text-[11px] font-bold uppercase text-[#355158] dark:text-[#B4CCD3]">
                    a.n. {pengurus.namaPemilikRekening}
                  </div>
                </div>
              </div>
            </div>

            {/* Arahan Konfirmasi & Save Nomor Admin DUWD */}
            <div className="mt-5 rounded-xl border border-emerald-600/25 bg-emerald-50/90 p-4 text-xs leading-relaxed text-emerald-950 dark:border-emerald-400/25 dark:bg-emerald-950/50 dark:text-emerald-100">
              <p className="font-bold text-emerald-900 dark:text-emerald-200">
                Langkah Terakhir — Konfirmasi &amp; Simpan Nomor Admin DUWD DPP WI
              </p>
              <p className="mt-1.5">
                Silakan klik tombol di bawah untuk mengirim pesan konfirmasi ke WhatsApp resmi{' '}
                <strong>Admin DUWD DPP WI</strong>, dan mohon untuk{' '}
                <strong>menyimpan (save) nomor resmi DUWD DPP WI</strong> berikut agar seluruh informasi dan broadcast resmi departemen dapat diterima dengan lancar:
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-600/20 bg-white/90 px-3.5 py-2.5 dark:border-emerald-400/20 dark:bg-[#081F24]">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#526A70] dark:text-[#8DA8B0]">
                    Nomor Resmi Admin DUWD DPP WI
                  </div>
                  <div className="font-mono text-base font-bold text-[#07525E] dark:text-[#3EC1D3]">
                    {ADMIN_DUWD_WA_DISPLAY}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyAdminWa}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#07525E]/15 bg-[#F4FAFB] px-3 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                >
                  {copiedAdminWa ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Salin Nomor</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
              <a
                href={confirmationWaLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Konfirmasi ke WhatsApp DUWD</span>
              </a>
              <button
                type="button"
                onClick={() => setStep('form')}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-[#07525E]/18 bg-white px-4 py-3 text-xs font-semibold text-[#07525E] hover:bg-[#F4FAFB] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
              >
                Ubah Data
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
