/**
 * Menormalkan nomor WhatsApp secara otomatis:
 * - "0812-3456-7890" -> "6281234567890"
 * - "+62 812 3456"   -> "628123456"
 * - "8123456789"     -> "628123456789"
 */
export function normalizeWhatsApp(raw: string): string {
  let digits = raw.replace(/[^\d]/g, '');
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
 * Memperbarui favicon browser secara dinamis setiap kali logo diganti.
 */
export function applyBrowserFavicon(logoUrl: string): void {
  const href = logoUrl.trim() || '/logo-wi.svg';
  let link = document.getElementById('app-favicon') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = 'app-favicon';
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = href;
}
