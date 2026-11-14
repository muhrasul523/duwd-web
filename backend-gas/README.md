# Backend Google Apps Script — DUWD DPP WI

File `/backend-gas/Code.gs` dirancang untuk dipasang langsung di dalam **Google Spreadsheet yang sudah Anda buat** (Container-bound Script).

## Langkah Pemasangan
1. Buka Google Spreadsheet Anda.
2. Klik menu **Extensions (Ekstensi)** > **Apps Script**.
3. Hapus isi bawaan `Code.gs`, lalu salin-tempel seluruh isi file `/backend-gas/Code.gs`.
4. Simpan (**Ctrl + S**).
5. Di toolbar atas editor Apps Script, pilih fungsi **`setupDatabase`** lalu klik **Run** (cukup 1 kali).
   - Skrip otomatis membuat 4 tab sheet:
     - `UNIT` (Daftar unit/bidang internal DUWD)
     - `PENGURUS` (Nama Lengkap, Nama Panggilan, WhatsApp `628...`, Unit)
     - `PENGATURAN` (PIN Super Admin, PIN Admin, Nama Aplikasi, Logo)
     - `SYSTEM_LOGS` (Catatan aktivitas otomatis)
6. Klik **Deploy** > **New deployment** > pilih jenis **Web app**:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
7. Salin **Web app URL** (berakhiran `/exec`), lalu tempelkan di menu **Super Admin > Pengaturan & Koneksi** pada aplikasi web.

## PIN Bawaan (Dapat Diubah Kapan Saja)
- **Super Admin PIN:** `duwd-super-2026`
- **Admin PIN:** `duwd-admin-2026`
