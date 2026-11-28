import {
  AlertCircle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Database,
  Download,
  ImagePlus,
  KeyRound,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import gasCodeRaw from '../../backend-gas/Code.gs?raw';
import defaultLogoWi from '../assets/logo-wi.png';
import {
  extractSpreadsheetId,
  saveAppSettings,
  saveBroadcastConfigRecord,
  saveGasWebAppUrl,
  setupWilayahSpreadsheetRemote,
  testGasConnection,
} from '../services/orgService';
import type { BroadcastConfigStatus } from '../types/org';
import { processLogoFileToDataUrl } from '../utils/whatsapp';

interface SuperAdminSettingsProps {
  activePin: string;
  namaAplikasi: string;
  logoDataUrl: string;
  rpkaDriveUrl: string;
  wilayahSpreadsheetId: string;
  webAppUrl: string;
  broadcastConfig: BroadcastConfigStatus;
  onUpdateBroadcastConfig: (config: BroadcastConfigStatus) => void;
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
  broadcastConfig,
  onUpdateBroadcastConfig,
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

  // Pengaturan Broadcast (ReChat API Key disimpan aman di GAS Script Properties)
  const [rechatApiKey, setRechatApiKey] = useState('');
  const [rechatApiUrl, setRechatApiUrl] = useState(
    broadcastConfig.rechatApiUrl || 'https://www.rechat.id/api/v1/messages',
  );
  const [emailAlias, setEmailAlias] = useState(
    broadcastConfig.emailAlias || 'dppwiduwd@gmail.com',
  );
  const [emailSenderName, setEmailSenderName] = useState(
    broadcastConfig.emailSenderName || 'DUWD DPP Wahdah Islamiyah',
  );

  useEffect(() => {
    setRechatApiUrl(broadcastConfig.rechatApiUrl || 'https://www.rechat.id/api/v1/messages');
    setEmailAlias(broadcastConfig.emailAlias || 'dppwiduwd@gmail.com');
    setEmailSenderName(broadcastConfig.emailSenderName || 'DUWD DPP Wahdah Islamiyah');
  }, [broadcastConfig]);

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

      if (webAppUrl.trim()) {
        const bcRes = await saveBroadcastConfigRecord(
          {
            rechatApiKey: rechatApiKey.trim() || undefined,
            rechatApiUrl: rechatApiUrl.trim(),
            emailAlias: emailAlias.trim(),
            emailSenderName: emailSenderName.trim(),
          },
          activePin,
          webAppUrl,
        );
        if (bcRes.ok && bcRes.broadcastConfig) {
          onUpdateBroadcastConfig(bcRes.broadcastConfig);
          setRechatApiKey('');
        }
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
          ? 'Pengaturan aplikasi, logo, Spreadsheet #2, PIN, serta konfigurasi Broadcast ReChat & Email berhasil disimpan.'
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
    <section className="duwd-container px-2 py-7 sm:px-4 lg:py-9">
      <div>
        <p className="text-xs font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
          Khusus Super Admin &middot; Identitas, Logo &amp; Koneksi 2 Spreadsheet
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] dark:text-[#E6F4F7] sm:text-3xl">
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
              <h2 className="text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                Logo Wahdah Islamiyah Global &amp; Favicon
              </h2>
              <p className="mt-1 text-xs text-[#526A70] dark:text-[#9BB5BC]">
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
                  className="h-16 w-16 rounded-2xl border border-[#07525E]/15 bg-white object-contain p-1.5 dark:border-[#3EC1D3]/25"
                />

                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#EBF5F8] px-3.5 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4] dark:bg-[#113540] dark:text-[#E6F4F7] dark:hover:bg-[#164452]">
                    <ImagePlus className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
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
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#07525E]/15 px-3 py-2 text-xs font-medium text-[#526A70] hover:bg-white dark:border-[#3EC1D3]/25 dark:text-[#9BB5BC] dark:hover:bg-[#113540]"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-3 rounded-xl border border-[#0C7A89]/15 bg-[#F4FAFB] p-3 text-[11px] leading-relaxed text-[#355158] dark:border-[#3EC1D3]/20 dark:bg-[#0D2A33] dark:text-[#B4CCD3]">
                <span className="font-bold text-[#07525E] dark:text-[#3EC1D3]">
                  Catatan Favicon &amp; Preview Link WhatsApp:
                </span>{' '}
                Banner preview link WhatsApp (<span className="font-mono font-semibold text-[#07525E] dark:text-[#E6F4F7]">/og-preview.jpg</span>, 1200&times;630 px) telah dilengkapi logo Wahdah Islamiyah dan teks resmi <em>DEPARTEMEN URUSAN WILAYAH DAN DAERAH · DEWAN PIMPINAN PUSAT · WAHDAH ISLAMIYAH · 2027</em>.
                {logoDataUrl && logoDataUrl.startsWith('data:image/png') && (
                  <div className="mt-2">
                    <a
                      href={logoDataUrl}
                      download="logo-wi.png"
                      className="inline-flex items-center gap-1 font-semibold text-[#0C7A89] hover:underline dark:text-[#3EC1D3]"
                    >
                      <Download className="h-3 w-3" />
                      <span>Unduh hasil konversi sebagai logo-wi.png</span>
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3.5 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Judul Aplikasi
                </label>
                <input
                  type="text"
                  value={namaAplikasi}
                  onChange={(e) => setNamaAplikasi(e.target.value)}
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Tautan Google Drive PDF RPKA 2027 (Opsional)
                </label>
                <input
                  type="url"
                  value={rpkaDriveUrl}
                  onChange={(e) => setRpkaDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  URL Web App Google Apps Script (/exec — Spreadsheet #1 Induk)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={webAppUrl}
                    onChange={(e) => setWebAppUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                  <button
                    type="button"
                    onClick={handleTestAndSyncGas}
                    disabled={testingGas}
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-[#0C7A89]/30 bg-[#EBF5F8] px-3 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4] dark:border-[#3EC1D3]/30 dark:bg-[#113540] dark:text-[#E6F4F7] dark:hover:bg-[#164452]"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${testingGas ? 'animate-spin' : ''}`} />
                    <span>Uji</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  ID / Link Google Spreadsheet #2 (DPW, DPD, DPC &amp; DPR)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={wilayahSpreadsheetId}
                    onChange={(e) => setWilayahSpreadsheetId(e.target.value)}
                    placeholder="Tempel ID atau URL https://docs.google.com/spreadsheets/d/..."
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                  <button
                    type="button"
                    onClick={handleSetupWilayahSheet}
                    disabled={settingUpWilayah}
                    title="Buat tab DPW, DPD, DPC, dan DPR otomatis di Spreadsheet #2"
                    className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-xl border border-[#D88B15]/35 bg-[#FFF9EE] px-3 py-2 text-xs font-semibold text-[#9A6008] hover:bg-[#FEF1D8] disabled:opacity-60 dark:border-[#F0B243]/35 dark:bg-[#2A2010] dark:text-[#F0B243] dark:hover:bg-[#3A2D16]"
                  >
                    <Database className="h-3.5 w-3.5" />
                    <span>{settingUpWilayah ? 'Menyiapkan...' : 'Siapkan Tab'}</span>
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-[#526A70] dark:text-[#9BB5BC]">
                  Buat 1 Google Spreadsheet baru, pastikan akun Google pemilik skrip menjadi Editor, lalu tempel URL/ID-nya di sini dan klik <strong>Siapkan Tab</strong>.
                </p>
              </div>

              {gasStatus.status !== 'idle' && (
                <div
                  className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs font-medium ${
                    gasStatus.status === 'ok'
                      ? 'bg-[#ECF6F2] text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200'
                      : 'bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                  }`}
                >
                  {gasStatus.status === 'ok' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                  )}
                  <span>{gasStatus.text}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Ubah PIN Admin
                  </label>
                  <input
                    type="password"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    placeholder="Opsional (min 4)"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Ubah PIN Super Admin
                  </label>
                  <input
                    type="password"
                    value={superAdminPin}
                    onChange={(e) => setSuperAdminPin(e.target.value)}
                    placeholder="Opsional (min 4)"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>
              </div>

              {/* Konfigurasi Broadcast ReChat & Email Alias */}
              <div className="space-y-3 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#07525E] dark:text-[#3EC1D3]">
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Gateway Broadcast (ReChat WA &amp; Alias Email)</span>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    ReChat / MiPOS API Key {broadcastConfig.rechatConfigured ? `(Aktif: ${broadcastConfig.rechatKeyMasked})` : ''}
                  </label>
                  <input
                    type="password"
                    value={rechatApiKey}
                    onChange={(e) => setRechatApiKey(e.target.value)}
                    placeholder={
                      broadcastConfig.rechatConfigured
                        ? 'Kosongkan jika tidak ingin mengganti API Key'
                        : 'Tempel API Key ReChat perangkat DUWD'
                    }
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                  <p className="mt-1 text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                    Disimpan aman di Script Properties Apps Script (tidak pernah disimpan di kode publik).
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                      Alias Email Pengirim
                    </label>
                    <input
                      type="email"
                      value={emailAlias}
                      onChange={(e) => setEmailAlias(e.target.value)}
                      placeholder="dppwiduwd@gmail.com"
                      className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                      Nama Pengirim Email
                    </label>
                    <input
                      type="text"
                      value={emailSenderName}
                      onChange={(e) => setEmailSenderName(e.target.value)}
                      placeholder="DUWD DPP Wahdah Islamiyah"
                      className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {settingsMsg && (
              <div
                className={`rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
                  settingsMsg.ok
                    ? 'border-[#0C7A89]/20 bg-[#ECF6F2] text-[#07525E] dark:border-[#3EC1D3]/30 dark:bg-[#0D2E36] dark:text-[#BCEAF0]'
                    : 'border-amber-500/30 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/60 dark:text-amber-200'
                }`}
              >
                {settingsMsg.text}
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
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
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 bg-[#F4FAFB] px-5 py-3.5 dark:border-[#3EC1D3]/15 dark:bg-[#0C2730]">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#0C7A89] dark:text-[#3EC1D3]" />
              <div>
                <h2 className="text-sm font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  Kode Backend Hybrid (/backend-gas/Code.gs)
                </h2>
                <p className="text-[11px] text-[#526A70] dark:text-[#9BB5BC]">
                  Tempel ke Apps Script Spreadsheet #1 &rarr; Run <span className="font-mono">setupDatabase</span> &rarr; Deploy <span className="font-mono">New version</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyGasCode}
              className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#07525E]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
            >
              {copiedCode ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-400">Kode Tersalin</span>
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
