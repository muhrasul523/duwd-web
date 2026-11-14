import {
  AlertCircle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  Download,
  ImagePlus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import gasCodeRaw from '../../backend-gas/Code.gs?raw';
import defaultLogoWi from '../assets/logo-wi.png';
import {
  extractSpreadsheetId,
  saveAppSettings,
  saveGasWebAppUrl,
  setupWilayahSpreadsheetRemote,
  testGasConnection,
} from '../services/orgService';
import { processLogoFileToDataUrl } from '../utils/whatsapp';

interface SuperAdminSettingsProps {
  activePin: string;
  namaAplikasi: string;
  logoDataUrl: string;
  rpkaDriveUrl: string;
  wilayahSpreadsheetId: string;
  webAppUrl: string;
  onUpdateSettingsState: (next: {
    namaAplikasi: string;
    logoDataUrl: string;
    rpkaDriveUrl: string;
    wilayahSpreadsheetId: string;
    webAppUrl: string;
  }) => void;
  onSyncFromSheet: () => Promise<void>;
}

export function SuperAdminSettings({
  activePin,
  namaAplikasi: initialName,
  logoDataUrl: initialLogo,
  rpkaDriveUrl: initialRpkaDriveUrl,
  wilayahSpreadsheetId: initialWilayahId,
  webAppUrl: initialGasUrl,
  onUpdateSettingsState,
  onSyncFromSheet,
}: SuperAdminSettingsProps) {
  const [namaAplikasi, setNamaAplikasi] = useState(initialName);
  const [logoDataUrl, setLogoDataUrl] = useState(initialLogo);
  const [rpkaDriveUrl, setRpkaDriveUrl] = useState(initialRpkaDriveUrl);
  const [wilayahSpreadsheetId, setWilayahSpreadsheetId] = useState(initialWilayahId);
  const [webAppUrl, setWebAppUrl] = useState(initialGasUrl);
  const [adminPin, setAdminPin] = useState('');
  const [superAdminPin, setSuperAdminPin] = useState('');

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingUpWilayah, setSettingUpWilayah] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testingGas, setTestingGas] = useState(false);
  const [gasStatus, setGasStatus] = useState<{ status: 'idle' | 'ok' | 'error'; text: string }>({
    status: 'idle',
    text: '',
  });
  const [copiedCode, setCopiedCode] = useState(false);

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processLogoFileToDataUrl(file, 256);
      setLogoDataUrl(dataUrl);
      onUpdateSettingsState({
        namaAplikasi,
        logoDataUrl: dataUrl,
        rpkaDriveUrl,
        wilayahSpreadsheetId,
        webAppUrl,
      });
      setSettingsMsg({
        ok: true,
        text: 'Logo diperbarui di aplikasi & favicon browser. Klik "Simpan Pengaturan" untuk menyimpan permanen ke Spreadsheet.',
      });
    } catch (err) {
      setSettingsMsg({
        ok: false,
        text: err instanceof Error ? err.message : 'Gagal memproses file logo.',
      });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    const cleanWilayahId = extractSpreadsheetId(wilayahSpreadsheetId);
    setWilayahSpreadsheetId(cleanWilayahId);

    try {
      saveGasWebAppUrl(webAppUrl);
      const res = await saveAppSettings(
        {
          namaAplikasi,
          logoDataUrl,
          rpkaDriveUrl,
          wilayahSpreadsheetId: cleanWilayahId,
          adminPin: adminPin.trim() || undefined,
          superAdminPin: superAdminPin.trim() || undefined,
        },
        activePin,
        webAppUrl,
      );

      if (!res.ok) {
        setSettingsMsg({
          ok: false,
          text: res.error || 'Gagal menyimpan pengaturan ke Spreadsheet.',
        });
        return;
      }

      onUpdateSettingsState({
        namaAplikasi: namaAplikasi.trim() || 'DUWD DPP WI',
        logoDataUrl,
        rpkaDriveUrl: rpkaDriveUrl.trim(),
        wilayahSpreadsheetId: cleanWilayahId,
        webAppUrl: webAppUrl.trim(),
      });
      setAdminPin('');
      setSuperAdminPin('');
      setSettingsMsg({
        ok: true,
        text: res.synced
          ? 'Pengaturan, logo, link Drive RPKA, ID Spreadsheet #2, dan PIN tersimpan ke sheet PENGATURAN.'
          : 'Pengaturan disimpan di browser lokal (isi URL Web App GAS agar tersimpan permanen ke Spreadsheet).',
      });
      if (res.synced) {
        await onSyncFromSheet();
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestAndSyncGas = async () => {
    saveGasWebAppUrl(webAppUrl);
    const cleanWilayahId = extractSpreadsheetId(wilayahSpreadsheetId);
    onUpdateSettingsState({
      namaAplikasi,
      logoDataUrl,
      rpkaDriveUrl,
      wilayahSpreadsheetId: cleanWilayahId,
      webAppUrl: webAppUrl.trim(),
    });

    setTestingGas(true);
    const res = await testGasConnection(webAppUrl);
    setTestingGas(false);

    if (res.ok) {
      setGasStatus({ status: 'ok', text: res.message });
      await onSyncFromSheet();
    } else {
      setGasStatus({ status: 'error', text: res.message });
    }
  };

  const handleSetupWilayahSheet = async () => {
    const cleanId = extractSpreadsheetId(wilayahSpreadsheetId);
    if (!cleanId) {
      setSettingsMsg({
        ok: false,
        text: 'Tempelkan ID atau URL Google Spreadsheet #2 terlebih dahulu.',
      });
      return;
    }
    setSettingUpWilayah(true);
    setSettingsMsg(null);
    try {
      const res = await setupWilayahSpreadsheetRemote(cleanId, activePin, webAppUrl);
      if (res.ok) {
        setWilayahSpreadsheetId(cleanId);
        onUpdateSettingsState({
          namaAplikasi,
          logoDataUrl,
          rpkaDriveUrl,
          wilayahSpreadsheetId: cleanId,
          webAppUrl,
        });
        setSettingsMsg({
          ok: true,
          text:
            res.message ||
            'Spreadsheet #2 berhasil disiapkan (tab DPW, DPD, DPC, dan DPR).',
        });
        await onSyncFromSheet();
      } else {
        setSettingsMsg({
          ok: false,
          text: res.error || 'Gagal menyiapkan Spreadsheet #2.',
        });
      }
    } finally {
      setSettingUpWilayah(false);
    }
  };

  const handleCopyGasCode = async () => {
    try {
      await navigator.clipboard.writeText(gasCodeRaw);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      setCopiedCode(false);
    }
  };

  return (
    <section className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 lg:py-10">
      <div>
        <p className="text-xs font-semibold text-[#0C7A89]">
          Khusus Super Admin &middot; Identitas, Logo &amp; Koneksi 2 Spreadsheet
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] sm:text-3xl">
          Pengaturan Aplikasi &amp; Backend Apps Script
        </h1>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Logo Wahdah Islamiyah + Settings + Dual Spreadsheet + PINs */}
        <form
          onSubmit={handleSaveSettings}
          className="glass-surface-strong flex flex-col justify-between p-6 lg:col-span-5"
        >
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#07525E]">
                Logo Wahdah Islamiyah Global &amp; Favicon
              </h2>
              <p className="mt-1 text-xs text-[#526A70]">
                Logo ini digunakan secara global di seluruh halaman portal dan semua menu (header, favicon browser, dan pengaturan induk).
              </p>

              <div className="mt-3 flex items-center gap-4">
                <img
                  src={logoDataUrl || defaultLogoWi}
                  alt="Preview Logo Wahdah Islamiyah"
                  onError={(e) => {
                    if (e.currentTarget.src !== defaultLogoWi) {
                      e.currentTarget.src = defaultLogoWi;
                    }
                  }}
                  className="h-16 w-16 rounded-2xl border border-[#07525E]/15 bg-white object-contain p-1.5"
                />

                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#EBF5F8] px-3.5 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4]">
                    <ImagePlus className="h-3.5 w-3.5 text-[#0C7A89]" />
                    <span>Upload Logo</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      onChange={handleLogoFileChange}
                      className="sr-only"
                    />
                  </label>

                  {logoDataUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setLogoDataUrl('');
                        onUpdateSettingsState({
                          namaAplikasi,
                          logoDataUrl: '',
                          rpkaDriveUrl,
                          wilayahSpreadsheetId,
                          webAppUrl,
                        });
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#07525E]/15 px-3 py-2 text-xs font-medium text-[#526A70] hover:bg-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-[#0C7A89]/15 bg-[#F4FAFB] p-3 text-[11px] leading-relaxed text-[#355158]">
                <span className="font-bold text-[#07525E]">Catatan Favicon &amp; Preview Link WhatsApp:</span>{' '}
                Logo Wahdah Islamiyah sudah tertanam langsung di aplikasi. File{' '}
                <span className="font-mono font-semibold text-[#07525E]">/favicon.ico</span>,{' '}
                <span className="font-mono font-semibold text-[#07525E]">/favicon.png</span>, dan{' '}
                <span className="font-mono font-semibold text-[#07525E]">/og-preview.jpg</span> (600&times;600 px) tersedia di{' '}
                <span className="font-mono">/public/</span> untuk domain <span className="font-mono">duwd.web.id</span>.
                {logoDataUrl && logoDataUrl.startsWith('data:image/png') && (
                  <div className="mt-2">
                    <a
                      href={logoDataUrl}
                      download="logo-wi.png"
                      className="inline-flex items-center gap-1 font-semibold text-[#0C7A89] hover:underline"
                    >
                      <Download className="h-3 w-3" />
                      <span>Unduh hasil konversi sebagai logo-wi.png</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[#07525E]/10 pt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158]">
                  Judul Aplikasi
                </label>
                <input
                  type="text"
                  value={namaAplikasi}
                  onChange={(e) => setNamaAplikasi(e.target.value)}
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158]">
                  Tautan Google Drive PDF RPKA 2027 (Opsional)
                </label>
                <input
                  type="url"
                  value={rpkaDriveUrl}
                  onChange={(e) => setRpkaDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158]">
                  URL Web App Google Apps Script (/exec — Spreadsheet #1 Induk)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webAppUrl}
                    onChange={(e) => setWebAppUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleTestAndSyncGas}
                    disabled={testingGas}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-[#0C7A89]/30 bg-[#EBF5F8] px-3 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4]"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${testingGas ? 'animate-spin' : ''}`} />
                    <span>Uji</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158]">
                  ID / Link Google Spreadsheet #2 (DPW, DPD, DPC &amp; DPR)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={wilayahSpreadsheetId}
                    onChange={(e) => setWilayahSpreadsheetId(e.target.value)}
                    placeholder="Tempel ID atau URL https://docs.google.com/spreadsheets/d/..."
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSetupWilayahSheet}
                    disabled={settingUpWilayah}
                    title="Buat tab DPW, DPD, DPC, dan DPR otomatis di Spreadsheet #2"
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-[#D88B15]/35 bg-[#FFF9EE] px-3 py-2 text-xs font-semibold text-[#9A6008] hover:bg-[#FEF1D8] disabled:opacity-60"
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>{settingUpWilayah ? 'Menyiapkan...' : 'Siapkan Tab'}</span>
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[#526A70]">
                  Buat 1 Google Spreadsheet baru, pastikan akun Google pemilik skrip menjadi Editor, lalu tempel URL/ID-nya di sini dan klik <strong>Siapkan Tab</strong>.
                </p>
              </div>

              {gasStatus.status !== 'idle' && (
                <div
                  className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${
                    gasStatus.status === 'ok'
                      ? 'bg-[#ECF6F2] text-emerald-900'
                      : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  {gasStatus.status === 'ok' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  )}
                  <span>{gasStatus.text}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Ubah PIN Admin
                  </label>
                  <input
                    type="password"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Opsional (min 4)"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Ubah PIN Super Admin
                  </label>
                  <input
                    type="password"
                    value={superAdminPin}
                    onChange={(e) => setSuperAdminPin(e.target.value)}
                    placeholder="Opsional (min 4)"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {settingsMsg && (
              <div
                className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                  settingsMsg.ok
                    ? 'border-[#0C7A89]/20 bg-[#ECF6F2] text-[#07525E]'
                    : 'border-amber-500/30 bg-amber-50 text-amber-900'
                }`}
              >
                {settingsMsg.text}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-[#07525E]/10 pt-4">
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
            >
              {savingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>

        {/* Right: Copy-paste Code.gs for Spreadsheet #1 (with Hybrid openById for Spreadsheet #2) */}
        <div className="glass-surface-strong flex flex-col overflow-hidden lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 bg-[#F4FAFB] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#0C7A89]" />
              <div>
                <h2 className="text-sm font-bold text-[#07525E]">
                  Kode Backend Hybrid (/backend-gas/Code.gs)
                </h2>
                <p className="text-[11px] text-[#526A70]">
                  Tempel ke Apps Script Spreadsheet #1 &rarr; Run <span className="font-mono">setupDatabase</span> &rarr; Deploy <span className="font-mono">New version</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyGasCode}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#07525E]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8]"
            >
              {copiedCode ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700" />
                  <span className="text-emerald-700">Kode Tersalin</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Salin Code.gs</span>
                </>
              )}
            </button>
          </div>

          <pre className="max-h-[580px] flex-1 overflow-auto bg-[#062E36] p-5 font-mono text-[12px] leading-relaxed text-[#E3F3F5]">
            <code>{gasCodeRaw}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
