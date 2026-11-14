import {
  AlertCircle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ImagePlus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useState } from 'react';
import gasCodeRaw from '../../backend-gas/Code.gs?raw';
import {
  saveAppSettings,
  saveGasWebAppUrl,
  testGasConnection,
} from '../services/orgService';
import { processLogoFileToDataUrl } from '../utils/whatsapp';

interface SuperAdminSettingsProps {
  activePin: string;
  namaAplikasi: string;
  logoDataUrl: string;
  webAppUrl: string;
  onUpdateSettingsState: (next: {
    namaAplikasi: string;
    logoDataUrl: string;
    webAppUrl: string;
  }) => void;
  onSyncFromSheet: () => Promise<void>;
}

export function SuperAdminSettings({
  activePin,
  namaAplikasi: initialName,
  logoDataUrl: initialLogo,
  webAppUrl: initialGasUrl,
  onUpdateSettingsState,
  onSyncFromSheet,
}: SuperAdminSettingsProps) {
  const [namaAplikasi, setNamaAplikasi] = useState(initialName);
  const [logoDataUrl, setLogoDataUrl] = useState(initialLogo);
  const [webAppUrl, setWebAppUrl] = useState(initialGasUrl);
  const [adminPin, setAdminPin] = useState('');
  const [superAdminPin, setSuperAdminPin] = useState('');

  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');
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
        webAppUrl,
      });
      setSettingsMsg('Logo diperbarui di aplikasi & favicon browser. Klik "Simpan Pengaturan" untuk menyimpan ke Spreadsheet.');
    } catch (err) {
      setSettingsMsg(err instanceof Error ? err.message : 'Gagal memproses file logo.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      saveGasWebAppUrl(webAppUrl);
      const res = await saveAppSettings(
        {
          namaAplikasi,
          logoDataUrl,
          adminPin: adminPin.trim() || undefined,
          superAdminPin: superAdminPin.trim() || undefined,
        },
        activePin,
        webAppUrl,
      );

      onUpdateSettingsState({
        namaAplikasi: namaAplikasi.trim() || 'DUWD DPP WI',
        logoDataUrl,
        webAppUrl: webAppUrl.trim(),
      });
      setAdminPin('');
      setSuperAdminPin('');
      setSettingsMsg(
        res.synced
          ? 'Pengaturan, logo, dan PIN tersimpan ke sheet PENGATURAN.'
          : 'Pengaturan disimpan di browser lokal.',
      );
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTestAndSyncGas = async () => {
    saveGasWebAppUrl(webAppUrl);
    onUpdateSettingsState({ namaAplikasi, logoDataUrl, webAppUrl: webAppUrl.trim() });

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
          Khusus Super Admin · Identitas, Logo &amp; Spreadsheet
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] sm:text-3xl">
          Pengaturan Aplikasi &amp; Backend Apps Script
        </h1>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Logo Wahdah Islamiyah + Settings + PINs */}
        <form
          onSubmit={handleSaveSettings}
          className="glass-surface-strong flex flex-col justify-between p-6 lg:col-span-5"
        >
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-bold text-[#07525E]">
                Logo Wahdah Islamiyah &amp; Favicon
              </h2>
              <p className="mt-1 text-xs text-[#526A70]">
                Unggah logo resmi (PNG/JPG/SVG) untuk mengganti logo di header dan favicon tab browser secara langsung.
              </p>

              <div className="mt-3 flex items-center gap-4">
                <img
                  src={logoDataUrl || '/logo-wi.svg'}
                  alt="Preview Logo Wahdah Islamiyah"
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
                        onUpdateSettingsState({ namaAplikasi, logoDataUrl: '', webAppUrl });
                      }}
                      className="inline-flex cursor-pointer items-center gap-1 rounded-xl border border-[#07525E]/15 px-3 py-2 text-xs font-medium text-[#526A70] hover:bg-white"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Reset</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Note khusus WhatsApp Link Preview */}
              <div className="mt-3 rounded-xl border border-[#0C7A89]/15 bg-[#F4FAFB] p-3 text-[11px] leading-relaxed text-[#355158]">
                <span className="font-bold text-[#07525E]">Catatan Preview Link WhatsApp:</span>{' '}
                WhatsApp hanya membaca gambar statis dari server. Pastikan Anda juga menyimpan file logo bernama{' '}
                <span className="font-mono font-semibold text-[#07525E]">logo-wi.png</span> di folder{' '}
                <span className="font-mono font-semibold text-[#07525E]">/public/logo-wi.png</span> pada repositori GitHub sebelum deploy ke{' '}
                <span className="font-mono">duwd.web.id</span>.
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
                  URL Web App Google Apps Script (/exec)
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
              <div className="rounded-xl border border-[#0C7A89]/20 bg-[#ECF6F2] px-3.5 py-2.5 text-xs font-medium text-[#07525E]">
                {settingsMsg}
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

        {/* Right: Copy-paste Code.gs for their existing Spreadsheet */}
        <div className="glass-surface-strong flex flex-col overflow-hidden lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 bg-[#F4FAFB] px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-[#0C7A89]" />
              <div>
                <h2 className="text-sm font-bold text-[#07525E]">
                  Kode Backend Spreadsheet (/backend-gas/Code.gs)
                </h2>
                <p className="text-[11px] text-[#526A70]">
                  Buka Spreadsheet Anda &rarr; Extensions &rarr; Apps Script &rarr; Tempel &rarr; Run <span className="font-mono">setupDatabase</span>
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

          <pre className="max-h-[520px] flex-1 overflow-auto bg-[#062E36] p-5 font-mono text-[12px] leading-relaxed text-[#E3F3F5]">
            <code>{gasCodeRaw}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
