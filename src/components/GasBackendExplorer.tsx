import { Check, CheckCircle2, Code2, Copy, Link, RefreshCw, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import codeJsRaw from '../../backend-gas/code.js?raw';
import driveConnectorJsRaw from '../../backend-gas/drive-connector.js?raw';
import readmeGasRaw from '../../backend-gas/README.md?raw';
import sheetHandlerJsRaw from '../../backend-gas/sheet-handler.js?raw';
import { loadGasConfig, saveGasConfig } from '../config/driveConfig';
import { pingGasBackend } from '../services/gasClient';

type GasFileKey = 'code' | 'sheet' | 'drive' | 'readme';

const GAS_FILES: { key: GasFileKey; label: string; path: string; content: string }[] = [
  { key: 'code', label: 'code.js', path: '/backend-gas/code.js', content: codeJsRaw },
  {
    key: 'sheet',
    label: 'sheet-handler.js',
    path: '/backend-gas/sheet-handler.js',
    content: sheetHandlerJsRaw,
  },
  {
    key: 'drive',
    label: 'drive-connector.js',
    path: '/backend-gas/drive-connector.js',
    content: driveConnectorJsRaw,
  },
  { key: 'readme', label: 'README.md', path: '/backend-gas/README.md', content: readmeGasRaw },
];

export function GasBackendExplorer() {
  const initialConfig = loadGasConfig();
  const [webAppUrl, setWebAppUrl] = useState(initialConfig.webAppUrl);
  const [driveRootFolderUrl, setDriveRootFolderUrl] = useState(initialConfig.driveRootFolderUrl);
  const [apiToken, setApiToken] = useState(initialConfig.apiToken);
  const [activeTab, setActiveTab] = useState<GasFileKey>('code');
  const [copiedKey, setCopiedKey] = useState<GasFileKey | null>(null);
  const [testing, setTesting] = useState(false);
  const [connectionState, setConnectionState] = useState<{
    status: 'idle' | 'ok' | 'error';
    message: string;
  }>({ status: 'idle', message: '' });

  const currentFile = GAS_FILES.find((f) => f.key === activeTab) || GAS_FILES[0];

  const handleSaveAndTest = async (e: React.FormEvent) => {
    e.preventDefault();
    saveGasConfig({
      webAppUrl: webAppUrl.trim(),
      driveRootFolderUrl: driveRootFolderUrl.trim(),
      apiToken: apiToken.trim(),
    });

    if (!webAppUrl.trim()) {
      setConnectionState({
        status: 'error',
        message: 'Konfigurasi disimpan. Masukkan URL Web App Google Apps Script untuk menguji koneksi live.',
      });
      return;
    }

    setTesting(true);
    const res = await pingGasBackend(webAppUrl.trim());
    setTesting(false);

    if (res.ok) {
      setConnectionState({
        status: 'ok',
        message: res.message || 'Koneksi Web App Google Apps Script berhasil.',
      });
    } else {
      setConnectionState({
        status: 'error',
        message: res.error || 'Tidak dapat terhubung ke endpoint Google Apps Script.',
      });
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentFile.content);
      setCopiedKey(currentFile.key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <section id="backend-gas" className="px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-[13px] font-semibold text-[#0C7A89]">
              Arsitektur Serverless Terintegrasi
            </p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] sm:text-3xl">
              Konfigurasi &amp; Kode Sumber Google Apps Script
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[#526A70]">
              Seluruh skrip backend tersedia di direktori{' '}
              <span className="font-mono text-xs font-semibold text-[#07525E]">/backend-gas/</span>{' '}
              untuk disalin langsung ke Editor Google Apps Script dan dihubungkan dengan GitHub Pages.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Endpoint Config Card */}
          <form
            onSubmit={handleSaveAndTest}
            className="glass-surface-strong flex flex-col justify-between p-6 lg:col-span-5"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-2.5 border-b border-[#07525E]/10 pb-3">
                <Link className="h-4.5 w-4.5 text-[#0C7A89]" />
                <h3 className="text-base font-bold text-[#07525E]">
                  Koneksi Web App GAS &amp; Drive Root
                </h3>
              </div>

              <div>
                <label
                  htmlFor="gas-webapp-url"
                  className="mb-1 block text-xs font-semibold text-[#355158]"
                >
                  URL Web App Google Apps Script (/exec)
                </label>
                <input
                  id="gas-webapp-url"
                  type="url"
                  value={webAppUrl}
                  onChange={(e) => setWebAppUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3.5 py-2.5 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="drive-root-url"
                  className="mb-1 block text-xs font-semibold text-[#355158]"
                >
                  URL Folder Induk Google Drive DUWD
                </label>
                <input
                  id="drive-root-url"
                  type="url"
                  value={driveRootFolderUrl}
                  onChange={(e) => setDriveRootFolderUrl(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/..."
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3.5 py-2.5 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="gas-api-token"
                  className="mb-1 block text-xs font-semibold text-[#355158]"
                >
                  API Token Opsional (POST Guard)
                </label>
                <input
                  id="gas-api-token"
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder="Kosongkan jika mode terbuka internal"
                  className="w-full rounded-xl border border-[#07525E]/15 bg-white px-3.5 py-2.5 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                />
              </div>

              {connectionState.status !== 'idle' && (
                <div
                  className={`flex items-start gap-2 rounded-xl px-3.5 py-3 text-xs font-medium ${
                    connectionState.status === 'ok'
                      ? 'border border-emerald-600/20 bg-[#ECF6F2] text-emerald-900'
                      : 'border border-amber-500/25 bg-amber-50 text-amber-900'
                  }`}
                >
                  {connectionState.status === 'ok' ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                  )}
                  <span>{connectionState.message}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-[#07525E]/10">
              <button
                type="submit"
                disabled={testing}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#07525E] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0C7A89] disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Menguji Koneksi...' : 'Simpan & Uji Koneksi GAS'}</span>
              </button>
            </div>
          </form>

          {/* Code Viewer Card */}
          <div className="glass-surface-strong flex flex-col overflow-hidden lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 bg-[#F4FAFB] px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-1">
                {GAS_FILES.map((file) => (
                  <button
                    key={file.key}
                    type="button"
                    onClick={() => setActiveTab(file.key)}
                    className={`cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-colors ${
                      activeTab === file.key
                        ? 'bg-[#07525E] text-white'
                        : 'text-[#355158] hover:bg-white'
                    }`}
                  >
                    {file.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#07525E]/15 bg-white px-3 py-1.5 text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8]"
              >
                {copiedKey === currentFile.key ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700" />
                    <span className="text-emerald-700">Kode Disalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Salin Kode</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-center justify-between border-b border-[#07525E]/8 bg-white/80 px-5 py-2 text-[11px] font-mono text-[#526A70]">
              <span className="inline-flex items-center gap-1.5">
                <Code2 className="h-3.5 w-3.5 text-[#0C7A89]" />
                <span>{currentFile.path}</span>
              </span>
              <span className="tabular-nums">{currentFile.content.split('\n').length} baris</span>
            </div>

            <pre className="max-h-[420px] overflow-auto bg-[#062E36] p-5 font-mono text-[12px] leading-relaxed text-[#E3F3F5]">
              <code>{currentFile.content}</code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
