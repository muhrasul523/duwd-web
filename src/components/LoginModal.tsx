import { Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { useState } from 'react';
import { authenticatePin } from '../services/orgService';
import type { UserRole } from '../types/org';

interface LoginModalProps {
  webAppUrl: string;
  onClose: () => void;
  onSuccess: (role: UserRole, pin: string) => void;
}

export function LoginModal({ webAppUrl, onClose, onSuccess }: LoginModalProps) {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authenticatePin(pin, webAppUrl);
      if (res.ok && res.role) {
        onSuccess(res.role, pin.trim());
      } else {
        setError(res.error || 'PIN tidak dikenali.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#042D35]/45 p-4 backdrop-blur-sm"
    >
      <div className="glass-surface-strong w-full max-w-md bg-white p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EBF5F8] text-[#0C7A89]">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 id="login-modal-title" className="text-base font-bold text-[#07525E]">
                Akses Pengelola DUWD
              </h2>
              <p className="text-xs text-[#526A70]">
                Masukkan PIN Admin atau Super Admin
              </p>
            </div>
          </div>

          <button
            type="button"
            aria-label="Tutup dialog masuk"
            onClick={onClose}
            className="cursor-pointer rounded-xl p-1.5 text-[#526A70] hover:bg-[#EBF5F8] hover:text-[#07525E]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="access-pin"
              className="mb-1.5 block text-xs font-semibold text-[#355158]"
            >
              PIN Akses
            </label>
            <div className="relative">
              <input
                id="access-pin"
                type={showPin ? 'text' : 'password'}
                required
                autoFocus
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Masukkan PIN akses..."
                className="w-full rounded-xl border border-[#07525E]/18 bg-white py-2.5 pr-11 pl-3.5 font-mono text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
              />
              <button
                type="button"
                aria-label={showPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                onClick={() => setShowPin((prev) => !prev)}
                className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-[#526A70] hover:text-[#07525E]"
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold text-[#526A70] hover:bg-[#F6FAFB]"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60"
            >
              {loading ? 'Memeriksa...' : 'Masuk'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
