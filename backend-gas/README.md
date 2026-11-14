# Backend Google Apps Script — DUWD DPP WI (Arsitektur 2 Spreadsheet)

File `/backend-gas/Code.gs` menggunakan **arsitektur Hybrid Multi-Spreadsheet** dengan 1 URL Web App (`/exec`) yang sama:

1. **Spreadsheet #1 (Induk — tempat `Code.gs` dipasang):**
   - `UNIT` (Unit 0 `PI` tanpa Proker, Unit 1–5 terhubung ke Proker `10001`–`10005`)
   - `PENGURUS` (Nama Lengkap, Nama Panggilan, WhatsApp `628...`, Unit, Amanah)
   - `PROGRAM_KERJA` (5 Program Kerja Induk DUWD 2027)
   - `KEGIATAN_RPKA` (37 Kegiatan RPKA 2027)
   - `PENGATURAN` (PIN Super Admin, PIN Admin, Nama Aplikasi, Logo, Link Drive RPKA, ID Spreadsheet #2)
   - `SYSTEM_LOGS` (Catatan aktivitas otomatis)

2. **Spreadsheet #2 (Wilayah & DPW-DPD — dibuka otomatis via `SpreadsheetApp.openById`):**
   - `KODE_WILAYAH` (Kode Wilayah Pulau, Provinsi, Kabupaten/Kota, Kecamatan, Kelurahan/Desa)
   - `DPW` (Data DPW per Kode Provinsi, Status Terbentuk, Ketua & WA, Sekretaris & WA, Alamat, Link Drive)
   - `DPD` (Data DPD per Kode Kab/Kota, Status Terbentuk, Ketua & WA, Sekretaris & WA, Alamat, Link Drive)

## Langkah Pemasangan Awal & Pembaruan
1. Buka Google Spreadsheet Induk (#1) > **Extensions** > **Apps Script**.
2. Tempel seluruh isi `/backend-gas/Code.gs` lalu simpan (**Ctrl + S**).
3. Jalankan fungsi **`setupDatabase`** (1 kali).
4. **Deployment:**
   - Pemasangan pertama: **Deploy > New deployment > Web app** (`Execute as: Me`, `Who has access: Anyone`).
   - Setiap ada perubahan kode `Code.gs`: **Deploy > Manage deployments > ikon Pensil (Edit) > Version: New version > Deploy** (URL `/exec` tetap sama).
5. **Menghubungkan Spreadsheet #2 (Wilayah & DPW-DPD):**
   - Buat 1 Google Spreadsheet baru di Google Drive (dengan akun Google yang sama).
   - Salin URL atau ID Spreadsheet #2 tersebut, tempelkan di menu aplikasi web **Pengaturan & GAS > ID / Link Google Spreadsheet #2**, lalu klik **Siapkan Tab** dan **Simpan Pengaturan**.
