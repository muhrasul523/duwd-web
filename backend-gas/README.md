# Backend Google Apps Script — DUWD DPP WI (Arsitektur 2 Spreadsheet + Drive Upload)

File `/backend-gas/Code.gs` menggunakan **arsitektur Hybrid Multi-Spreadsheet** dengan 1 URL Web App (`/exec`) yang sama serta integrasi **Google Drive & Google Docs** untuk arsip notula (termasuk konversi otomatis teks notula menjadi file PDF) dan dokumentasi foto musyawarah:

1. **Spreadsheet #1 (Induk — tempat `Code.gs` dipasang):**
   - `UNIT` (Unit 0 `PI` tanpa Proker, Unit 1–5 terhubung ke Proker `10001`–`10005`)
   - `PENGURUS` (Nama Lengkap, Nama Panggilan, WhatsApp `628...`, Unit, Amanah)
   - `PROGRAM_KERJA` (5 Program Kerja Induk DUWD 2027)
   - `KEGIATAN_RPKA` (37 Kegiatan RPKA 2027 beserta kolom `Jenis_Kegiatan`: `Event`/`Monev` dan `Pola_Jadwal`: `Tunggal`/`Pekanan`/`DwiPekanan`/`Bulanan`)
   - `MUSYAWARAH` (Daftar Musyawarah Pleno & Unit ke 1–52, tanggal, notula teks/file Drive, dokumentasi foto Drive, peserta tambahan dari PI/unit lain)
   - `PRESENSI_MUSYAWARAH` (Rincian status kehadiran setiap pengurus: `Hadir`, `Tidak Hadir`, `Izin Sebelum Rapat`, `Izin Setelah Rapat`)
   - `PENGATURAN` (PIN Super Admin, PIN Admin, Nama Aplikasi, Logo, Link Drive RPKA, ID Spreadsheet #2, ID Folder Drive Musyawarah)
   - `SYSTEM_LOGS` (Catatan aktivitas otomatis)

2. **Google Drive Folder Musyawarah (`1Ua_AgStLPfpH5xfFIfqXZkOVwJgCLG98`):**
   - Menyimpan file notula (upload PDF/Word atau otomatis dikonversi dari teks notula -> Google Docs -> PDF) dan foto dokumentasi (JPG/PNG) dengan format nama resmi:
     `{jenis musyawarah} {musyawarah ke} {tanggal, format 5 Nov 2026}`

3. **Spreadsheet #2 (Kelembagaan Wilayah & Daerah — dibuka otomatis via `SpreadsheetApp.openById`):**
   - `DPW`, `DPD`, `DPC`, `DPR`

## Langkah Pemasangan Awal, Otorisasi Drive & Pembaruan
1. Buka Google Spreadsheet Induk (#1) > **Extensions** > **Apps Script**.
2. Tempel seluruh isi `/backend-gas/Code.gs` lalu simpan (**Ctrl + S**).
3. Jalankan fungsi **`setupDatabase`** (1 kali).
4. **Otorisasi Google Drive & Google Docs (Wajib untuk Upload Notula/Dokumentasi):**
   - Pastikan akun Google pemilik Apps Script memiliki akses **Editor** pada folder Google Drive tujuan (`https://drive.google.com/drive/folders/1Ua_AgStLPfpH5xfFIfqXZkOVwJgCLG98`).
   - Di editor Apps Script, pilih fungsi **`otorisasiGoogleDrive`** lalu klik **Run** (atau dari menu Spreadsheet: **DUWD DPP WI > Otorisasi Drive & Docs (Upload Musyawarah)**).
   - Klik **Review Permissions** -> pilih akun Google Anda -> **Advanced** -> **Go to ... (unsafe)** -> **Allow**.
5. **Deployment:**
   - Pemasangan pertama: **Deploy > New deployment > Web app** (`Execute as: Me`, `Who has access: Anyone`).
   - Setiap ada perubahan kode `Code.gs`: **Deploy > Manage deployments > ikon Pensil (Edit) > Version: New version > Deploy** (URL `/exec` tetap sama).
