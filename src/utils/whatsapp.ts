import defaultLogoWi from '../assets/logo-wi.png';

/**
 * Menormalkan nomor WhatsApp secara otomatis:
 * - Menghapus semua karakter selain angka (spasi, tanda baca, huruf)
 * - "081234567890" -> "6281234567890"
 * - "81234567890"  -> "6281234567890"
 */
export function normalizeWhatsApp(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('08')) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith('0')) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith('8')) {
    digits = `62${digits}`;
  }
  return digits;
}

/**
 * Filter real-time saat mengetik / menempel di kolom input WhatsApp:
 * Hanya angka yang lolos; bila diawali "08" langsung menjadi "628".
 */
export function sanitizeWhatsAppTyping(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('08')) {
    return `628${digits.slice(2)}`;
  }
  return digits;
}

export function isValidWhatsApp(normalizedWa: string): boolean {
  return /^628\d{7,13}$/.test(normalizedWa);
}

export function buildWhatsAppLink(normalizedWa: string): string {
  const clean = normalizeWhatsApp(normalizedWa);
  return clean ? `https://wa.me/${clean}` : '#';
}

/**
 * Mengubah file gambar logo menjadi Data URL ringkas (maks 256x256 px)
 * agar ringan untuk favicon browser, state aplikasi, dan sel Google Sheets.
 */
export function processLogoFileToDataUrl(file: File, maxDim = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Gagal membaca file SVG.'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas tidak tersedia.'));
          return;
        }
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Format gambar logo tidak didukung.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

/**
 * Memperbarui tag favicon browser secara dinamis setiap kali logo kustom diunggah,
 * atau mempertahankan /logo_wi.png & /favicon.ico bawaan ketika logo kustom kosong.
 */
export function applyBrowserFavicon(logoUrl: string): void {
  const cleanUrl = logoUrl.trim();
  const isValidCustom =
    cleanUrl.startsWith('data:image/') ||
    cleanUrl.startsWith('/') ||
    cleanUrl.startsWith('https://') ||
    cleanUrl.startsWith('http://');

  const applyHref = (href: string, mimeType: string) => {
    let iconLink = document.querySelector<HTMLLinkElement>("link#app-favicon");
    if (!iconLink) {
      iconLink = document.createElement('link');
      iconLink.id = 'app-favicon';
      iconLink.rel = 'icon';
      document.head.appendChild(iconLink);
    }
    iconLink.type = mimeType;
    iconLink.href = href;

    const appleIcon = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    if (appleIcon) {
      appleIcon.href = href;
    }
  };

  if (!isValidCustom) {
    applyHref('/logo_wi.png?v=4', 'image/png');
    return;
  }

  let mimeType = 'image/png';
  if (cleanUrl.startsWith('data:image/svg+xml') || cleanUrl.endsWith('.svg')) {
    mimeType = 'image/svg+xml';
  } else if (
    cleanUrl.startsWith('data:image/jpeg') ||
    cleanUrl.endsWith('.jpg') ||
    cleanUrl.endsWith('.jpeg')
  ) {
    mimeType = 'image/jpeg';
  } else if (cleanUrl.startsWith('data:image/webp') || cleanUrl.endsWith('.webp')) {
    mimeType = 'image/webp';
  }

  if (cleanUrl.startsWith('data:image/')) {
    applyHref(cleanUrl, mimeType);
    return;
  }

  const probe = new Image();
  probe.onload = () => {
    applyHref(cleanUrl, mimeType);
  };
  probe.onerror = () => {
    applyHref(defaultLogoWi, 'image/png');
  };
  probe.src = cleanUrl;
}
