# Backend Google Apps Script (GAS) — duwd.web.id

Folder `/backend-gas/` berisi skrip backend terpusat untuk portal **Departemen Urusan Wilayah dan Daerah (DUWD) DPP Wahdah Islamiyah** yang di-deploy sebagai **Google Apps Script Web App**, terhubung ke **Google Sheets** dan **Google Drive**.

## Struktur Modul
1. `code.js` — Router Web App (`doGet` & `doPost`), validasi token opsional, pencatat log otomatis (`SYSTEM_LOGS`), dan fungsi inisialisasi struktur (`initializeDUWDStructure`).
2. `sheet-handler.js` — Operasi baca/tulis Google Sheets, pencarian & filter multi-kriteria (`dpw`, `status`, `jenis`, `kategori`, `search`), serta agregasi KPI.
3. `drive-connector.js` — Ekstraktor Google Drive File ID dinamis, generator URL pratinjau/unduh aman untuk semua jenis berkas (`PDF`, `PPT`, `DOCX`, `Gambar`, `Audio MP3`, `Video MP4`, `Arsip ZIP`), pemindai folder rekursif, dan pengunggah base64.

## Langkah Deploy ke Google Apps Script
1. Buka [script.google.com](https://script.google.com) dan buat proyek baru bernama **DUWD Wahdah Islamiyah API**.
2. Buat 3 file skrip di editor Apps Script (`Code.gs`, `sheet-handler.gs`, `drive-connector.gs`) lalu salin isi masing-masing file dari folder `/backend-gas/`.
3. Jalankan fungsi `initializeDUWDStructure()` satu kali dari menu **Run** di editor Apps Script. Skrip otomatis membuat Google Spreadsheet induk (6 tab lengkap) dan Folder Google Drive beserta 5 subfoldernya, lalu menyimpannya ke `ScriptProperties`.
4. Klik **Deploy > New deployment > Web app**:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
5. Salin **Web App URL** (`https://script.google.com/macros/s/.../exec`), lalu tempelkan ke menu **Backend GAS** di portal web `duwd.web.id` atau atur pada `VITE_GAS_WEBAPP_URL` saat build statis ke GitHub Pages.
