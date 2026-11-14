# Portal DUWD Wahdah Islamiyah (`duwd.web.id`)

Aplikasi web portal dan konsol tata kelola **Departemen Urusan Wilayah dan Daerah (DUWD) DPP Wahdah Islamiyah** dengan arsitektur frontend statis untuk **GitHub Pages** dan backend serverless **Google Apps Script (GAS)** terintegrasi **Google Sheets** serta **Google Drive**.

## Struktur Direktori
- `/` & `/src/` — Antarmuka frontend statis (React + Vite + Tailwind CSS v4 + tipografi Montserrat)
- `/backend-gas/` — Modul sumber Google Apps Script siap salin:
  - `code.js` (`doGet`, `doPost`, router API, logger otomatis, dan inisialisasi struktur sheet/folder)
  - `sheet-handler.js` (pembacaan Google Sheets, filter multi-kriteria, tulis/update baris)
  - `drive-connector.js` (ekstraksi Google Drive File ID dinamis, generator URL pratinjau/unduh, sinkronisasi folder Drive lintas format PDF, PPT, DOCX, Gambar, Audio, Video, Arsip)
- `/assets/` — Aset grafis vektor geometris Syar'i-compliant (`logo-duwd.svg`)
- `/public/CNAME` — Konfigurasi custom domain GitHub Pages (`duwd.web.id`)

## Build & Deploy Statis (GitHub Pages)
1. Jalankan `npm install` lalu `npm run build`.
2. Publikasikan folder `dist/` ke GitHub Pages pada branch `gh-pages` atau melalui GitHub Actions.
3. Siapkan backend di Google Apps Script mengikuti panduan di `/backend-gas/README.md`, lalu tempelkan URL Web App `/exec` pada bagian **Backend GAS** di portal atau melalui variabel `VITE_GAS_WEBAPP_URL`.
