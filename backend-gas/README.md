# Backend Google Apps Script — DUWD DPP WI

File `/backend-gas/Code.gs` dirancang untuk dipasang langsung di dalam **Google Spreadsheet yang sudah Anda buat** (Container-bound Script).

## Langkah Pemasangan
1. Buka Google Spreadsheet Anda.
2. Klik menu **Extensions (Ekstensi)** > **Apps Script**.
3. Hapus isi bawaan `Code.gs`, lalu salin-tempel seluruh isi file `/backend-gas/Code.gs`.
4. Simpan (**Ctrl + S**).
5. Di toolbar atas editor Apps Script, pilih fungsi **`setupDatabase`** lalu klik **Run** (cukup 1 kali — aman dijalankan ulang saat ada pembaruan modul).
   - Skrip otomatis membuat / memperbarui 6 tab sheet:
     - `UNIT` (Unit 0 `PI` tanpa Proker, dan Unit 1–5 yang terhubung ke Proker `10001`–`10005`)
     - `PENGURUS` (Nama Lengkap, Nama Panggilan, WhatsApp `628...`, Unit, Amanah)
     - `PROGRAM_KERJA` (5 Program Kerja Induk DUWD 2027 beserta kode)
     - `KEGIATAN_RPKA` (37 Kegiatan RPKA 2027 lengkap dengan Tujuan, Sasaran, Indikator, Tempat, Waktu, Pendapatan, Belanja, Unit PJ, Status, Tautan Drive)
     - `PENGATURAN` (PIN Super Admin, PIN Admin, Nama Aplikasi, Logo, Link Drive RPKA)
     - `SYSTEM_LOGS` (Catatan aktivitas otomatis)
   - Jika sheet `UNIT` dan `PROGRAM_KERJA` sudah terisi data lama dan ingin disesuaikan ke pemetaan Unit 0–5 (`PI`, `EKSPANSI`, `KELEMBAGAAN`, `KEPENGURUSAN`, `MONEV`, `INOVASI`), jalankan fungsi **`sinkronUnitDanProkerRPKA`** 1 kali dari menu **DUWD DPP WI** di Google Sheet.
6. Klik **Deploy** > **New deployment** > pilih jenis **Web app**:
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
7. Salin **Web app URL** (berakhiran `/exec`), lalu tempelkan di menu **Super Admin > Pengaturan & GAS** pada aplikasi web.

## Hak Akses Saat Ini
- **Publik & Admin:** Akses lihat direktori Pengurus dan Program Kerja 2027.
- **Super Admin:** Akses penuh untuk tambah/edit/hapus Pengurus, Kegiatan/Proker, Unit, serta Pengaturan & GAS.

## PIN Bawaan (Dapat Diubah Kapan Saja)
- **Super Admin PIN:** `duwd-super-2026`
- **Admin PIN:** `duwd-admin-2026`
