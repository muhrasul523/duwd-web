/**
 * ============================================================================
 * DUWD DPP WI — GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * Arsitektur Hybrid Multi-Spreadsheet:
 * - Spreadsheet #1 (Induk / Container-bound):
 *     UNIT, PENGURUS, PROGRAM_KERJA, KEGIATAN_RPKA, PENGATURAN, SYSTEM_LOGS
 * - Spreadsheet #2 (Wilayah & Kelembagaan — dibuka via openById):
 *     DPW, DPD, DPC, DPR
 *
 * Domain : duwd.web.id
 *
 * CATATAN DEPLOYMENT:
 * Setiap kali mengubah kode ini, lakukan:
 *   Deploy -> Manage deployments -> ikon Pensil (Edit) -> Version: New version -> Deploy
 * (URL Web App /exec tetap sama, tidak berubah).
 * ============================================================================
 */

const SHEETS = {
  PENGURUS: 'PENGURUS',
  UNIT: 'UNIT',
  PROGRAM_KERJA: 'PROGRAM_KERJA',
  KEGIATAN_RPKA: 'KEGIATAN_RPKA',
  MUSYAWARAH: 'MUSYAWARAH',
  PRESENSI_MUSYAWARAH: 'PRESENSI_MUSYAWARAH',
  DOKUMEN_KATEGORI: 'DOKUMEN_KATEGORI',
  DOKUMEN_SUBKATEGORI: 'DOKUMEN_SUBKATEGORI',
  DOKUMEN_FILE: 'DOKUMEN_FILE',
  GRUP_WA: 'GRUP_WA',
  BROADCAST_QUEUE: 'BROADCAST_QUEUE',
  PENGATURAN: 'PENGATURAN',
  LOGS: 'SYSTEM_LOGS'
};

const WILAYAH_SHEETS = {
  DPW: 'DPW',
  DPD: 'DPD',
  DPC: 'DPC',
  DPR: 'DPR'
};

const DEFAULT_MUSYAWARAH_DRIVE_FOLDER_ID = '1Ua_AgStLPfpH5xfFIfqXZkOVwJgCLG98';
const DEFAULT_DOKUMEN_DRIVE_FOLDER_ID = '10RCn0CcMmFWqraQqJP0k0KYBFwN6_xew';
const DEFAULT_RECHAT_API_URL = 'https://www.rechat.id/api/v1/messages';
const DEFAULT_EMAIL_ALIAS = 'dppwiduwd@gmail.com';
const DEFAULT_EMAIL_SENDER_NAME = 'DUWD DPP Wahdah Islamiyah';

/**
 * Menambahkan menu khusus di Google Spreadsheet Induk.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DUWD DPP WI')
    .addItem('Setup Database Induk', 'setupDatabase')
    .addItem('Otorisasi Drive, Docs, Gmail & Broadcast', 'otorisasiGoogleDrive')
    .addItem('Pasang Jadwal Otomatis Broadcast (5 Menit)', 'pasangTriggerBroadcast')
    .addItem('Jalankan Antrean Broadcast Sekarang', 'prosesJadwalBroadcast')
    .addItem('Sinkronkan Unit 0-5 & Proker 1-5', 'sinkronUnitDanProkerRPKA')
    .addItem('Setup Spreadsheet Wilayah (#2)', 'setupWilayahSpreadsheetManual')
    .addToUi();
}

function getSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Skrip ini harus dijalankan dari dalam Google Spreadsheet Induk (Extensions > Apps Script).');
  }
  return ss;
}

/**
 * Mengekstrak ID Spreadsheet dari ID langsung maupun URL Google Sheets lengkap.
 */
function extractSpreadsheetId_(raw) {
  const val = String(raw || '').trim();
  if (!val) return '';
  const match = val.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return val;
}

/**
 * SETUP DATABASE INDUK (Spreadsheet #1) + otomatis menyiapkan Spreadsheet #2 jika ID sudah diisi.
 */
function setupDatabase() {
  const ss = getSpreadsheet_();

  const definitions = [
    {
      name: SHEETS.UNIT,
      headers: ['ID_Unit', 'Kode_Unit', 'Nama_Unit', 'Urutan', 'Aktif']
    },
    {
      name: SHEETS.PENGURUS,
      headers: [
        'ID_Pengurus',
        'Nama_Lengkap',
        'Nama_Panggilan',
        'WhatsApp',
        'ID_Unit',
        'Nama_Unit',
        'Amanah',
        'Email',
        'Nama_Bank',
        'Nomor_Rekening',
        'Nama_Pemilik_Rekening',
        'Pendataan_Diperbarui_Pada',
        'Dibuat_Pada',
        'Diperbarui_Pada'
      ]
    },
    {
      name: SHEETS.PROGRAM_KERJA,
      headers: ['Kode_Proker', 'Nama_Proker', 'Tahun', 'Unit_PJ']
    },
    {
      name: SHEETS.KEGIATAN_RPKA,
      headers: ['Kode_Kegiatan', 'Kode_Proker', 'Nama_Proker', 'Nama_Kegiatan', 'Tujuan', 'Sasaran', 'Indikator', 'Tempat', 'Waktu', 'Pendapatan', 'Belanja', 'Unit_PJ', 'Status_Pelaksanaan', 'Jenis_Kegiatan', 'Pola_Jadwal', 'Tautan_Drive']
    },
    {
      name: SHEETS.MUSYAWARAH,
      headers: [
        'ID_Musyawarah',
        'Judul',
        'Jenis',
        'Musyawarah_Ke',
        'ID_Unit',
        'Nama_Unit',
        'Tanggal',
        'Waktu_Mulai',
        'Waktu_Selesai',
        'Tempat',
        'Pimpinan_Rapat',
        'Notula_Mode',
        'Notula_Teks',
        'Notula_File_Name',
        'Notula_File_URL',
        'Notula_File_ID',
        'Dokumentasi_File_Name',
        'Dokumentasi_File_URL',
        'Dokumentasi_File_ID',
        'Notulensi_Ringkas',
        'Tautan_Drive',
        'Peserta_Tambahan_IDs',
        'Dibuat_Pada',
        'Diperbarui_Pada'
      ]
    },
    {
      name: SHEETS.PRESENSI_MUSYAWARAH,
      headers: ['ID_Presensi', 'ID_Musyawarah', 'ID_Pengurus', 'Nama_Lengkap', 'Unit_Kode', 'Amanah', 'Sumber_Peserta', 'Status_Kehadiran', 'Keterangan', 'Diperbarui_Pada']
    },
    {
      name: SHEETS.DOKUMEN_KATEGORI,
      headers: [
        'ID_Kategori',
        'Nama_Kategori',
        'Deskripsi',
        'Urutan',
        'Drive_Folder_ID',
        'Drive_Folder_URL',
        'Tanggal_Update',
        'Dibuat_Pada',
        'Diperbarui_Pada'
      ]
    },
    {
      name: SHEETS.DOKUMEN_SUBKATEGORI,
      headers: [
        'ID_Subkategori',
        'ID_Kategori',
        'Nama_Kategori',
        'Nama_Subkategori',
        'Urutan',
        'Drive_Folder_ID',
        'Drive_Folder_URL',
        'Tanggal_Update',
        'Dibuat_Pada',
        'Diperbarui_Pada'
      ]
    },
    {
      name: SHEETS.DOKUMEN_FILE,
      headers: [
        'ID_Dokumen',
        'ID_Kategori',
        'Nama_Kategori',
        'Subfolder',
        'Judul_Dokumen',
        'Tipe_Item',
        'Nama_File_Drive',
        'Ekstensi',
        'Mime_Type',
        'Ukuran_Bytes',
        'Drive_File_ID',
        'Drive_File_URL',
        'Drive_Folder_ID',
        'Drive_Folder_URL',
        'Tanggal_Update',
        'Keterangan',
        'Jumlah_Dilihat',
        'Jumlah_Diunduh',
        'Dibuat_Pada',
        'Diperbarui_Pada'
      ]
    },
    {
      name: SHEETS.GRUP_WA,
      headers: ['ID_Grup', 'Nama_Grup', 'Group_ID_WA', 'Keterangan', 'Dibuat_Pada', 'Diperbarui_Pada']
    },
    {
      name: SHEETS.BROADCAST_QUEUE,
      headers: [
        'ID_Broadcast',
        'Judul',
        'Channel',
        'Target_Summary',
        'Target_Pengurus_IDs',
        'Target_Group_IDs',
        'Pesan_WA',
        'Email_Subject',
        'Email_Body',
        'Image_Drive_File_ID',
        'Image_URL',
        'Image_Name',
        'Mode_Kirim',
        'Jadwal_Kirim',
        'Status',
        'Total_Target',
        'Total_Terkirim',
        'Total_Gagal',
        'Log_Hasil',
        'Dibuat_Oleh',
        'Dibuat_Pada',
        'Dikirim_Pada'
      ]
    },
    {
      name: SHEETS.PENGATURAN,
      headers: ['Kunci', 'Nilai', 'Keterangan']
    },
    {
      name: SHEETS.LOGS,
      headers: ['Timestamp', 'Role', 'Aksi', 'Detail']
    }
  ];

  definitions.forEach(function (def) {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      sheet.getRange(1, 1, 1, def.headers.length)
        .setFontWeight('bold')
        .setBackground('#07525E')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    } else {
      ensureHeaderColumns_(sheet, def.headers);
    }
  });

  const unitSheet = ss.getSheetByName(SHEETS.UNIT);
  if (unitSheet.getLastRow() <= 1) {
    const starterUnits = getStarterUnitRows_();
    unitSheet.getRange(2, 1, starterUnits.length, 5).setValues(starterUnits);
  }

  const prokerSheet = ss.getSheetByName(SHEETS.PROGRAM_KERJA);
  if (prokerSheet.getLastRow() <= 1) {
    const starterProker = getStarterProkerRows_();
    prokerSheet.getRange(2, 1, starterProker.length, 4).setValues(starterProker);
  }

  const kegSheet = ss.getSheetByName(SHEETS.KEGIATAN_RPKA);
  if (kegSheet.getLastRow() > 1) {
    kegSheet.getRange(2, 10, kegSheet.getLastRow() - 1, 2).setNumberFormat('#,##0');
  }

  const settingsSheet = ss.getSheetByName(SHEETS.PENGATURAN);
  if (settingsSheet.getLastRow() <= 1) {
    const defaultSettings = [
      ['NAMA_APLIKASI', 'DUWD DPP WI', 'Judul utama aplikasi dan preview'],
      ['SUPERADMIN_PIN', 'duwd-super-2026', 'PIN akses Super Admin'],
      ['ADMIN_PIN', 'duwd-admin-2026', 'PIN akses Admin Pengurus DUWD'],
      ['LOGO_DATA_URL', '', 'URL atau Data URL logo Wahdah Islamiyah'],
      ['RPKA_DRIVE_URL', '', 'Link Google Drive file PDF asli RPKA DUWD 2027'],
      ['WILAYAH_SPREADSHEET_ID', '', 'ID atau URL Google Spreadsheet #2 (DPW, DPD, DPC, DPR)'],
      ['MUSYAWARAH_DRIVE_FOLDER_ID', DEFAULT_MUSYAWARAH_DRIVE_FOLDER_ID, 'ID Folder Google Drive penyimpanan Notula & Dokumentasi Musyawarah'],
      ['DOKUMEN_DRIVE_FOLDER_ID', DEFAULT_DOKUMEN_DRIVE_FOLDER_ID, 'ID Folder Google Drive penyimpanan Pusat Dokumen DUWD'],
      ['RECHAT_API_URL', DEFAULT_RECHAT_API_URL, 'Endpoint ReChat/MiPOS API (key disimpan aman di Script Properties)'],
      ['EMAIL_ALIAS_PENGIRIM', DEFAULT_EMAIL_ALIAS, 'Alias Gmail pengirim untuk Broadcast Email'],
      ['EMAIL_NAMA_PENGIRIM', DEFAULT_EMAIL_SENDER_NAME, 'Nama pengirim yang tampil pada Broadcast Email']
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 3).setValues(defaultSettings);
  } else {
    ensureSettingKey_('WILAYAH_SPREADSHEET_ID', '', 'ID atau URL Google Spreadsheet #2 (DPW, DPD, DPC, DPR)');
    ensureSettingKey_('MUSYAWARAH_DRIVE_FOLDER_ID', DEFAULT_MUSYAWARAH_DRIVE_FOLDER_ID, 'ID Folder Google Drive penyimpanan Notula & Dokumentasi Musyawarah');
    ensureSettingKey_('DOKUMEN_DRIVE_FOLDER_ID', DEFAULT_DOKUMEN_DRIVE_FOLDER_ID, 'ID Folder Google Drive penyimpanan Pusat Dokumen DUWD');
    ensureSettingKey_('RECHAT_API_URL', DEFAULT_RECHAT_API_URL, 'Endpoint ReChat/MiPOS API (key disimpan aman di Script Properties)');
    ensureSettingKey_('EMAIL_ALIAS_PENGIRIM', DEFAULT_EMAIL_ALIAS, 'Alias Gmail pengirim untuk Broadcast Email');
    ensureSettingKey_('EMAIL_NAMA_PENGIRIM', DEFAULT_EMAIL_SENDER_NAME, 'Nama pengirim yang tampil pada Broadcast Email');
  }

  // Jika ID Spreadsheet #2 sudah diisi di PENGATURAN, siapkan sheet-nya juga
  const settingsMap = getSettingsMap_();
  const wilayahId = extractSpreadsheetId_(settingsMap.WILAYAH_SPREADSHEET_ID || '');
  if (wilayahId) {
    try {
      const wSs = SpreadsheetApp.openById(wilayahId);
      setupWilayahDatabase_(wSs);
    } catch (ignore) {}
  }

  writeLog_('SUPERADMIN', 'setupDatabase', 'Struktur database Induk siap digunakan.');
}

/**
 * Jalankan 1x dari editor Apps Script atau menu Spreadsheet "DUWD DPP WI > Otorisasi Drive, Docs, Gmail & Broadcast"
 * agar izin Google Drive, Google Docs, Gmail Alias, dan UrlFetchApp (ReChat) aktif.
 */
function otorisasiGoogleDrive() {
  const msyFolder = getMusyawarahDriveFolder_();
  const dokFolder = getDokumenDriveFolder_();
  const testDoc = DocumentApp.create('DUWD_Test_Otorisasi_Sementara');
  const testId = testDoc.getId();
  testDoc.saveAndClose();
  const testFile = DriveApp.getFileById(testId);
  testFile.setTrashed(true);
  let aliasInfo = '';
  try {
    const aliases = GmailApp.getAliases();
    aliasInfo = aliases.length > 0 ? (' Alias Gmail terdeteksi: ' + aliases.join(', ') + '.') : ' Belum ada alias Gmail terverifikasi di akun ini.';
  } catch (gErr) {
    aliasInfo = ' (Peringatan Gmail: ' + gErr.message + ')';
  }
  try {
    UrlFetchApp.fetch('https://www.rechat.id', { method: 'get', muteHttpExceptions: true });
  } catch (ignore) {}
  const msg = 'Otorisasi Drive, Docs, Gmail & Broadcast BERHASIL untuk folder Musyawarah ("' + msyFolder.getName() + '") dan Dokumen ("' + dokFolder.getName() + '").' + aliasInfo;
  writeLog_('SUPERADMIN', 'otorisasiGoogleDrive', msg);
  try {
    SpreadsheetApp.getUi().alert('Otorisasi Berhasil', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (ignore) {}
  return msg;
}

function setupWilayahSpreadsheetManual() {
  const settingsMap = getSettingsMap_();
  const wilayahId = extractSpreadsheetId_(settingsMap.WILAYAH_SPREADSHEET_ID || '');
  if (!wilayahId) {
    throw new Error('Isi dulu nilai WILAYAH_SPREADSHEET_ID pada tab PENGATURAN (atau lewat menu Pengaturan & GAS di web).');
  }
  const wSs = SpreadsheetApp.openById(wilayahId);
  setupWilayahDatabase_(wSs);
}

/**
 * Menyiapkan tab sheet pada Spreadsheet #2 (DPW, DPD, DPC, DPR).
 * Catatan: Referensi 83.762 kode wilayah sudah tertanam langsung di aplikasi web sehingga tab KODE_WILAYAH tidak diperlukan.
 */
function setupWilayahDatabase_(wSs) {
  const defs = [
    {
      name: WILAYAH_SHEETS.DPW,
      headers: [
        'ID_DPW',
        'Kode_Wilayah',
        'Pulau',
        'Nama_DPW',
        'Nama_Provinsi',
        'Status_Terbentuk',
        'Ketua_Nama',
        'Ketua_WA',
        'Sekretaris_Nama',
        'Sekretaris_WA',
        'Diperbarui_Pada'
      ]
    },
    {
      name: WILAYAH_SHEETS.DPD,
      headers: [
        'ID_DPD',
        'Kode_Wilayah',
        'Kode_Provinsi',
        'Pulau',
        'Nama_Provinsi',
        'Nama_DPD',
        'Nama_KabKota',
        'Status_Terbentuk',
        'Ketua_Nama',
        'Ketua_WA',
        'Sekretaris_Nama',
        'Sekretaris_WA',
        'Diperbarui_Pada'
      ]
    },
    {
      name: WILAYAH_SHEETS.DPC,
      headers: [
        'ID_DPC',
        'Kode_Wilayah',
        'Kode_KabKota',
        'Kode_Provinsi',
        'Pulau',
        'Nama_Provinsi',
        'Nama_KabKota',
        'Nama_Kecamatan',
        'Nama_DPC',
        'Status_Terbentuk',
        'Ketua_Nama',
        'Ketua_WA',
        'Sekretaris_Nama',
        'Sekretaris_WA',
        'Diperbarui_Pada'
      ]
    },
    {
      name: WILAYAH_SHEETS.DPR,
      headers: [
        'ID_DPR',
        'Kode_Wilayah',
        'Kode_Kecamatan',
        'Kode_KabKota',
        'Kode_Provinsi',
        'Pulau',
        'Nama_Provinsi',
        'Nama_KabKota',
        'Nama_Kecamatan',
        'Nama_KelDesa',
        'Nama_DPR',
        'Status_Terbentuk',
        'Ketua_Nama',
        'Ketua_WA',
        'Sekretaris_Nama',
        'Sekretaris_WA',
        'Diperbarui_Pada'
      ]
    }
  ];

  defs.forEach(function (def) {
    let sheet = wSs.getSheetByName(def.name);
    if (!sheet) {
      sheet = wSs.insertSheet(def.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      sheet.getRange(1, 1, 1, def.headers.length)
        .setFontWeight('bold')
        .setBackground('#07525E')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    } else {
      ensureHeaderColumns_(sheet, def.headers);
    }
  });
}

function getWilayahSpreadsheetOrThrow_(optionalRawId) {
  const settingsMap = getSettingsMap_();
  const id = extractSpreadsheetId_(optionalRawId || settingsMap.WILAYAH_SPREADSHEET_ID || '');
  if (!id) {
    throw new Error('Spreadsheet Wilayah (#2) belum ditautkan. Isi ID / URL Spreadsheet Wilayah di menu Pengaturan & GAS.');
  }
  try {
    return SpreadsheetApp.openById(id);
  } catch (err) {
    throw new Error('Tidak dapat membuka Spreadsheet #2 (ID: ' + id + '). Pastikan akun Google pemilik Apps Script memiliki akses Editor ke Spreadsheet #2. Detail: ' + err.message);
  }
}

/**
 * HTTP GET Handler:
 * - ?action=ping
 * - ?action=verifyPin&pin=...
 * - ?action=getAllData
 * - ?action=getWilayahChildren&parentKode=...&tingkat=...
 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = String(params.action || 'getAllData').trim();

  try {
    if (action === 'ping') {
      const masterSs = getSpreadsheet_();
      const settingsMap = getSettingsMap_();
      const wilayahId = extractSpreadsheetId_(settingsMap.WILAYAH_SPREADSHEET_ID || '');

      let wilayahConnected = false;
      let wilayahName = '';
      let wilayahError = '';
      let dpwCount = 0;
      let dpdCount = 0;
      let dpcCount = 0;
      let dprCount = 0;

      if (wilayahId) {
        try {
          const wSs = SpreadsheetApp.openById(wilayahId);
          wilayahConnected = true;
          wilayahName = wSs.getName();
          const dpwSh = wSs.getSheetByName(WILAYAH_SHEETS.DPW);
          const dpdSh = wSs.getSheetByName(WILAYAH_SHEETS.DPD);
          const dpcSh = wSs.getSheetByName(WILAYAH_SHEETS.DPC);
          const dprSh = wSs.getSheetByName(WILAYAH_SHEETS.DPR);
          dpwCount = dpwSh ? Math.max(0, dpwSh.getLastRow() - 1) : 0;
          dpdCount = dpdSh ? Math.max(0, dpdSh.getLastRow() - 1) : 0;
          dpcCount = dpcSh ? Math.max(0, dpcSh.getLastRow() - 1) : 0;
          dprCount = dprSh ? Math.max(0, dprSh.getLastRow() - 1) : 0;
        } catch (wErr) {
          wilayahError = wErr.message;
        }
      }

      const msg = wilayahConnected
        ? 'Terhubung ke 2 Spreadsheet: "' + masterSs.getName() + '" & "' + wilayahName + '" (DPW: ' + dpwCount + ', DPD: ' + dpdCount + ', DPC: ' + dpcCount + ', DPR: ' + dprCount + ').'
        : wilayahId
          ? 'Spreadsheet Induk "' + masterSs.getName() + '" terhubung, tetapi Spreadsheet #2 gagal dibuka: ' + wilayahError
          : 'Spreadsheet Induk "' + masterSs.getName() + '" terhubung. Spreadsheet #2 (DPW, DPD, DPC, DPR) belum ditautkan.';

      return jsonOut_({
        ok: true,
        message: msg,
        masterName: masterSs.getName(),
        wilayahConnected: wilayahConnected,
        wilayahName: wilayahName,
        wilayahError: wilayahError,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'verifyPin') {
      const role = resolveRoleByPin_(params.pin || '');
      if (!role) {
        return jsonOut_({ ok: false, error: 'PIN akses tidak sesuai.' });
      }
      return jsonOut_({ ok: true, role: role });
    }

    if (action === 'checkDriveAuth') {
      try {
        const folder = getMusyawarahDriveFolder_();
        return jsonOut_({
          ok: true,
          message: 'Izin Google Drive aktif untuk folder "' + folder.getName() + '".',
          data: {
            authorized: true,
            folderId: folder.getId(),
            folderName: folder.getName(),
            folderUrl: folder.getUrl()
          }
        });
      } catch (dErr) {
        return jsonOut_({
          ok: false,
          error: 'Izin Google Drive belum aktif atau folder tidak dapat diakses: ' + dErr.message + '. Jalankan fungsi otorisasiGoogleDrive() di Apps Script lalu Deploy New Version.'
        });
      }
    }

    if (action === 'getWilayahChildren') {
      return jsonOut_({ ok: true, data: [] });
    }

    if (action === 'getAllData') {
      const units = readRows_(SHEETS.UNIT).map(function (u) {
        return {
          id: String(u.ID_Unit || ''),
          kodeUnit: String(u.Kode_Unit || ''),
          namaUnit: String(u.Nama_Unit || ''),
          urutan: Number(u.Urutan || 0),
          aktif: String(u.Aktif || 'Ya') !== 'Tidak'
        };
      }).sort(function (a, b) {
        return a.urutan - b.urutan;
      });

      const pengurus = readRows_(SHEETS.PENGURUS).map(function (p) {
        const hasEmail = Boolean(String(p.Email || '').trim());
        const hasRek = Boolean(String(p.Nomor_Rekening || '').trim());
        return {
          id: String(p.ID_Pengurus || ''),
          namaLengkap: String(p.Nama_Lengkap || ''),
          namaPanggilan: String(p.Nama_Panggilan || ''),
          whatsapp: normalizeWaNumber_(p.WhatsApp || ''),
          unitId: String(p.ID_Unit || ''),
          namaUnit: String(p.Nama_Unit || ''),
          amanah: String(p.Amanah || ''),
          sudahPendataan: hasEmail && hasRek,
          pendataanDiperbaruiPada: String(p.Pendataan_Diperbarui_Pada || ''),
          dibuatPada: String(p.Dibuat_Pada || ''),
          diperbaruiPada: String(p.Diperbarui_Pada || '')
        };
      });

      const proker = readRows_(SHEETS.PROGRAM_KERJA).map(function (pr) {
        return {
          kodeProker: String(pr.Kode_Proker || ''),
          namaProker: String(pr.Nama_Proker || ''),
          tahun: String(pr.Tahun || '2027'),
          unitPj: String(pr.Unit_PJ || '')
        };
      });

      const kegiatan = readRows_(SHEETS.KEGIATAN_RPKA).map(function (k) {
        return {
          kodeKegiatan: String(k.Kode_Kegiatan || ''),
          kodeProker: String(k.Kode_Proker || ''),
          namaProker: String(k.Nama_Proker || ''),
          namaKegiatan: String(k.Nama_Kegiatan || ''),
          tujuan: String(k.Tujuan || ''),
          sasaran: String(k.Sasaran || ''),
          indikator: String(k.Indikator || ''),
          tempat: String(k.Tempat || ''),
          waktu: String(k.Waktu || ''),
          pendapatan: Number(k.Pendapatan || 0),
          belanja: Number(k.Belanja || 0),
          unitPj: String(k.Unit_PJ || ''),
          status: String(k.Status_Pelaksanaan || 'Rencana'),
          jenisKegiatan: String(k.Jenis_Kegiatan || ''),
          polaJadwal: String(k.Pola_Jadwal || ''),
          tautanDrive: String(k.Tautan_Drive || '')
        };
      });

      const musyawarah = readRowsOptional_(SHEETS.MUSYAWARAH).map(function (m) {
        const rawIds = String(m.Peserta_Tambahan_IDs || '').trim();
        const extraIds = rawIds
          ? rawIds.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
          : [];
        const dokId = String(m.Dokumentasi_File_ID || '').trim();
        return {
          id: String(m.ID_Musyawarah || ''),
          judul: String(m.Judul || ''),
          jenis: String(m.Jenis || 'Pleno') === 'Unit' ? 'Unit' : 'Pleno',
          musyawarahKe: Math.min(52, Math.max(1, Number(m.Musyawarah_Ke || 1))),
          unitId: String(m.ID_Unit || ''),
          namaUnit: String(m.Nama_Unit || ''),
          tanggal: formatDateCell_(m.Tanggal),
          waktuMulai: String(m.Waktu_Mulai || ''),
          waktuSelesai: String(m.Waktu_Selesai || ''),
          tempat: String(m.Tempat || ''),
          pimpinanRapat: String(m.Pimpinan_Rapat || ''),
          notulaMode: String(m.Notula_Mode || ''),
          notulaTeks: String(m.Notula_Teks || ''),
          notulaFileName: String(m.Notula_File_Name || ''),
          notulaFileUrl: String(m.Notula_File_URL || ''),
          notulaFileId: String(m.Notula_File_ID || ''),
          dokumentasiFileName: String(m.Dokumentasi_File_Name || ''),
          dokumentasiFileUrl: String(m.Dokumentasi_File_URL || ''),
          dokumentasiFileId: dokId,
          dokumentasiPreviewUrl: dokId ? ('https://drive.google.com/thumbnail?id=' + dokId + '&sz=w1200') : '',
          notulensiRingkas: String(m.Notulensi_Ringkas || ''),
          tautanDrive: String(m.Tautan_Drive || ''),
          pesertaTambahanIds: extraIds,
          dibuatPada: String(m.Dibuat_Pada || ''),
          diperbaruiPada: String(m.Diperbarui_Pada || '')
        };
      });

      const presensi = readRowsOptional_(SHEETS.PRESENSI_MUSYAWARAH).map(function (p) {
        return {
          id: String(p.ID_Presensi || ''),
          musyawarahId: String(p.ID_Musyawarah || ''),
          pengurusId: String(p.ID_Pengurus || ''),
          namaLengkap: String(p.Nama_Lengkap || ''),
          unitKode: String(p.Unit_Kode || ''),
          amanah: String(p.Amanah || ''),
          sumberPeserta: String(p.Sumber_Peserta || 'Wajib') === 'Tambahan' ? 'Tambahan' : 'Wajib',
          status: String(p.Status_Kehadiran || 'Hadir'),
          keterangan: String(p.Keterangan || ''),
          diperbaruiPada: String(p.Diperbarui_Pada || '')
        };
      });

      const dokumenKategori = readRowsOptional_(SHEETS.DOKUMEN_KATEGORI)
        .map(mapDokumenKategoriRow_)
        .sort(function (a, b) {
          return (a.urutan || 0) - (b.urutan || 0);
        });

      const dokumenSubkategori = readRowsOptional_(SHEETS.DOKUMEN_SUBKATEGORI)
        .map(mapDokumenSubkategoriRow_)
        .sort(function (a, b) {
          return (a.urutan || 0) - (b.urutan || 0);
        });

      const dokumenFile = readRowsOptional_(SHEETS.DOKUMEN_FILE).map(mapDokumenFileRow_);

      const settingsMap = getSettingsMap_();
      const wilayahId = extractSpreadsheetId_(settingsMap.WILAYAH_SPREADSHEET_ID || '');

      let wilayahConnected = false;
      let kodeWilayah = [];
      let dpw = [];
      let dpd = [];
      let dpc = [];
      let dpr = [];

      if (wilayahId) {
        try {
          const wSs = SpreadsheetApp.openById(wilayahId);
          wilayahConnected = true;

          const dpwSheet = wSs.getSheetByName(WILAYAH_SHEETS.DPW);
          if (dpwSheet) {
            dpw = readSheetObjects_(dpwSheet).map(mapDpwRow_).sort(compareKodeWilayah_);
          }

          const dpdSheet = wSs.getSheetByName(WILAYAH_SHEETS.DPD);
          if (dpdSheet) {
            dpd = readSheetObjects_(dpdSheet).map(mapDpdRow_).sort(compareKodeWilayah_);
          }

          const dpcSheet = wSs.getSheetByName(WILAYAH_SHEETS.DPC);
          if (dpcSheet) {
            dpc = readSheetObjects_(dpcSheet).map(mapDpcRow_).sort(compareKodeWilayah_);
          }

          const dprSheet = wSs.getSheetByName(WILAYAH_SHEETS.DPR);
          if (dprSheet) {
            dpr = readSheetObjects_(dprSheet).map(mapDprRow_).sort(compareKodeWilayah_);
          }
        } catch (ignore) {
          wilayahConnected = false;
        }
      }

      return jsonOut_({
        ok: true,
        data: {
          units: units,
          pengurus: pengurus,
          proker: proker,
          kegiatan: kegiatan,
          musyawarah: musyawarah,
          presensi: presensi,
          dokumenKategori: dokumenKategori,
          dokumenSubkategori: dokumenSubkategori,
          dokumenFile: dokumenFile,
          kodeWilayah: kodeWilayah,
          dpw: dpw,
          dpd: dpd,
          dpc: dpc,
          dpr: dpr,
          wilayahConnected: wilayahConnected,
          settings: {
            namaAplikasi: settingsMap.NAMA_APLIKASI || 'DUWD DPP WI',
            logoDataUrl: settingsMap.LOGO_DATA_URL || '',
            rpkaDriveUrl: settingsMap.RPKA_DRIVE_URL || '',
            wilayahSpreadsheetId: wilayahId
          }
        }
      });
    }

    return jsonOut_({ ok: false, error: 'Action GET tidak dikenali: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}

/**
 * HTTP POST Handler:
 * Seluruh aksi perubahan data saat ini dikunci khusus Super Admin.
 */
function doPost(e) {
  let body = {};
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : '{}');
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Format JSON tidak valid: ' + err.message });
  }

  const action = String(body.action || '').trim();
  const pin = String(body.pin || '').trim();
  const payload = body.payload || {};

  const ADMIN_ALLOWED_ACTIONS = {
    saveDpw: true,
    saveDpd: true,
    saveDpc: true,
    saveDpr: true,
    updateKegiatanJenis: true,
    saveMusyawarah: true,
    deleteMusyawarah: true,
    savePresensiBatch: true,
    uploadMusyawarahFile: true,
    uploadMusyawarahNotulaText: true,
    getPrivatePengurusAndBroadcast: true,
    saveWaGroup: true,
    deleteWaGroup: true,
    uploadBroadcastImage: true,
    sendOrScheduleBroadcast: true,
    cancelScheduledBroadcast: true,
    deleteBroadcastItem: true,
    runDueBroadcastsNow: true,
    installBroadcastTrigger: true
  };

  try {
    // Aksi publik tanpa PIN: mencatat statistik jumlah lihat & download dokumen
    if (action === 'trackDokumenStat') {
      const docId = String(payload.id || '').trim();
      const metric = String(payload.metric || '').trim().toLowerCase();
      if (!docId || (metric !== 'view' && metric !== 'download')) {
        return jsonOut_({ ok: false, error: 'Parameter statistik dokumen tidak valid.' });
      }
      const ss = getSpreadsheet_();
      ensureDokumenSheets_(ss);
      const result = incrementDokumenStatInSs_(ss, docId, metric);
      if (!result) {
        return jsonOut_({ ok: false, error: 'Dokumen tidak ditemukan.' });
      }
      return jsonOut_({ ok: true, data: result });
    }

    // Aksi publik tanpa PIN: deteksi pengurus berdasarkan nomor WA untuk halaman /data-pengurus
    if (action === 'lookupPengurusByWa') {
      const waTarget = normalizeWaNumber_(payload.whatsapp || '');
      if (!waTarget || waTarget.length < 9) {
        return jsonOut_({ ok: false, error: 'Masukkan nomor WhatsApp yang valid.' });
      }
      const ss = getSpreadsheet_();
      ensurePengurusPendataanColumns_(ss);
      const units = readRows_(SHEETS.UNIT);
      const unitCodeById = {};
      units.forEach(function (u) {
        unitCodeById[String(u.ID_Unit || '').trim()] = String(u.Kode_Unit || '').trim();
      });
      const rows = readRows_(SHEETS.PENGURUS);
      let matched = null;
      for (let i = 0; i < rows.length; i++) {
        if (normalizeWaNumber_(rows[i].WhatsApp || '') === waTarget) {
          matched = rows[i];
          break;
        }
      }
      if (!matched) {
        return jsonOut_({ ok: true, data: { found: false } });
      }
      const unitIdVal = String(matched.ID_Unit || '').trim();
      return jsonOut_({
        ok: true,
        data: {
          found: true,
          pengurus: {
            id: String(matched.ID_Pengurus || ''),
            namaLengkap: String(matched.Nama_Lengkap || ''),
            namaPanggilan: String(matched.Nama_Panggilan || ''),
            whatsapp: normalizeWaNumber_(matched.WhatsApp || ''),
            unitId: unitIdVal,
            namaUnit: String(matched.Nama_Unit || ''),
            kodeUnit: unitCodeById[unitIdVal] || '',
            amanah: String(matched.Amanah || ''),
            email: String(matched.Email || ''),
            namaBank: String(matched.Nama_Bank || ''),
            nomorRekening: String(matched.Nomor_Rekening || ''),
            namaPemilikRekening: String(matched.Nama_Pemilik_Rekening || ''),
            pendataanDiperbaruiPada: String(matched.Pendataan_Diperbarui_Pada || '')
          }
        }
      });
    }

    // Aksi publik terverifikasi ID + WA: simpan pendataan email & nomor rekening pengurus
    if (action === 'submitPendataanPengurus') {
      const idTarget = String(payload.id || '').trim();
      const waTarget = normalizeWaNumber_(payload.whatsapp || '');
      const emailVal = String(payload.email || '').trim().toLowerCase();
      const namaBankVal = String(payload.namaBank || '').trim();
      const nomorRekVal = String(payload.nomorRekening || '').replace(/[^\d]/g, '');
      const pemilikVal = String(payload.namaPemilikRekening || '').trim().toUpperCase();

      if (!idTarget || !waTarget) {
        return jsonOut_({ ok: false, error: 'Identitas pengurus tidak valid. Silakan verifikasi nomor WhatsApp kembali.' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailVal)) {
        return jsonOut_({ ok: false, error: 'Format alamat email belum valid.' });
      }
      if (!namaBankVal) {
        return jsonOut_({ ok: false, error: 'Pilih atau tuliskan nama bank terlebih dahulu.' });
      }
      if (!nomorRekVal || nomorRekVal.length < 5) {
        return jsonOut_({ ok: false, error: 'Nomor rekening belum valid, silakan periksa kembali.' });
      }
      if (!pemilikVal || pemilikVal.length < 2) {
        return jsonOut_({ ok: false, error: 'Nama pemilik rekening wajib diisi.' });
      }

      const ss = getSpreadsheet_();
      ensurePengurusPendataanColumns_(ss);
      const existing = findRowInSs_(ss, SHEETS.PENGURUS, 'ID_Pengurus', idTarget);
      if (!existing || normalizeWaNumber_(existing.WhatsApp || '') !== waTarget) {
        return jsonOut_({ ok: false, error: 'Data pengurus tidak cocok dengan nomor WhatsApp terdaftar.' });
      }

      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const updatePatch = {
        Email: emailVal,
        Nama_Bank: namaBankVal,
        Nomor_Rekening: "'" + nomorRekVal,
        Nama_Pemilik_Rekening: pemilikVal,
        Pendataan_Diperbarui_Pada: nowStr,
        Diperbarui_Pada: nowStr
      };
      const updated = updateRowByIdInSs_(ss, SHEETS.PENGURUS, 'ID_Pengurus', idTarget, updatePatch);
      if (!updated) {
        return jsonOut_({ ok: false, error: 'Gagal memperbarui data pendataan di Spreadsheet.' });
      }

      const units = readRows_(SHEETS.UNIT);
      const unitCodeById = {};
      units.forEach(function (u) {
        unitCodeById[String(u.ID_Unit || '').trim()] = String(u.Kode_Unit || '').trim();
      });
      const unitIdVal = String(existing.ID_Unit || '').trim();

      writeLog_('PENGURUS', 'submitPendataanPengurus', idTarget + ' — ' + String(existing.Nama_Lengkap || '') + ' (' + namaBankVal + ')');
      return jsonOut_({
        ok: true,
        data: {
          id: idTarget,
          namaLengkap: String(existing.Nama_Lengkap || ''),
          namaPanggilan: String(existing.Nama_Panggilan || ''),
          whatsapp: waTarget,
          unitId: unitIdVal,
          namaUnit: String(existing.Nama_Unit || ''),
          kodeUnit: unitCodeById[unitIdVal] || '',
          amanah: String(existing.Amanah || ''),
          email: emailVal,
          namaBank: namaBankVal,
          nomorRekening: nomorRekVal,
          namaPemilikRekening: pemilikVal,
          pendataanDiperbaruiPada: nowStr
        }
      });
    }

    const role = resolveRoleByPin_(pin);
    if (!role) {
      return jsonOut_({ ok: false, error: 'Akses ditolak. PIN tidak valid.' });
    }
    if (role !== 'superadmin' && !(role === 'admin' && ADMIN_ALLOWED_ACTIONS[action])) {
      return jsonOut_({
        ok: false,
        error: 'Akses terbatas: Admin hanya dapat mengedit kontak DPW/DPD/DPC/DPR, menandai Event/Monev, mengelola musyawarah & presensi, serta mengirim Broadcast.'
      });
    }

    if (action === 'savePengurus') {
      const namaLengkap = String(payload.namaLengkap || '').trim();
      const namaPanggilan = String(payload.namaPanggilan || '').trim();
      const whatsapp = normalizeWaNumber_(payload.whatsapp || '');
      const unitId = String(payload.unitId || '').trim();
      const amanah = String(payload.amanah || '').trim();

      if (!namaLengkap || !namaPanggilan || !whatsapp || !unitId || !amanah) {
        return jsonOut_({
          ok: false,
          error: 'Nama lengkap, nama panggilan, nomor WhatsApp, unit, dan amanah wajib diisi.'
        });
      }

      const ss = getSpreadsheet_();
      ensurePengurusPendataanColumns_(ss);
      const unitMap = getUnitById_(unitId);
      const namaUnit = unitMap ? String(unitMap.Nama_Unit) : String(payload.namaUnit || '');
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');

      const isEdit = Boolean(payload.id);
      const idPengurus = isEdit ? String(payload.id).trim() : generateId_('PGR');
      const existing = isEdit ? findRowInSs_(ss, SHEETS.PENGURUS, 'ID_Pengurus', idPengurus) : null;

      const emailFinal = payload.email !== undefined
        ? String(payload.email || '').trim().toLowerCase()
        : String((existing && existing.Email) || '').trim().toLowerCase();
      const bankFinal = payload.namaBank !== undefined
        ? String(payload.namaBank || '').trim()
        : String((existing && existing.Nama_Bank) || '').trim();
      const rekFinal = payload.nomorRekening !== undefined
        ? String(payload.nomorRekening || '').replace(/[^\d]/g, '')
        : String((existing && existing.Nomor_Rekening) || '').replace(/[^\d]/g, '');
      const pemilikFinal = payload.namaPemilikRekening !== undefined
        ? String(payload.namaPemilikRekening || '').trim().toUpperCase()
        : String((existing && existing.Nama_Pemilik_Rekening) || '').trim().toUpperCase();
      const pendataanUpdated = (payload.email !== undefined || payload.nomorRekening !== undefined) && (emailFinal || rekFinal)
        ? nowStr
        : String((existing && existing.Pendataan_Diperbarui_Pada) || '');

      const rowObj = {
        ID_Pengurus: idPengurus,
        Nama_Lengkap: namaLengkap,
        Nama_Panggilan: namaPanggilan,
        WhatsApp: whatsapp,
        ID_Unit: unitId,
        Nama_Unit: namaUnit,
        Amanah: amanah,
        Email: emailFinal,
        Nama_Bank: bankFinal,
        Nomor_Rekening: rekFinal ? ("'" + rekFinal) : '',
        Nama_Pemilik_Rekening: pemilikFinal,
        Pendataan_Diperbarui_Pada: pendataanUpdated,
        Dibuat_Pada: isEdit ? String(payload.dibuatPada || (existing && existing.Dibuat_Pada) || nowStr) : nowStr,
        Diperbarui_Pada: nowStr
      };

      const updated = isEdit ? updateRowByIdInSs_(ss, SHEETS.PENGURUS, 'ID_Pengurus', idPengurus, rowObj) : false;
      if (!updated) {
        appendRowInSs_(ss, SHEETS.PENGURUS, rowObj);
      }

      writeLog_('SUPERADMIN', isEdit ? 'updatePengurus' : 'createPengurus', idPengurus + ' — ' + namaLengkap + ' (' + amanah + ')');

      return jsonOut_({
        ok: true,
        data: {
          id: idPengurus,
          namaLengkap: namaLengkap,
          namaPanggilan: namaPanggilan,
          whatsapp: whatsapp,
          unitId: unitId,
          namaUnit: namaUnit,
          amanah: amanah,
          email: emailFinal,
          namaBank: bankFinal,
          nomorRekening: rekFinal,
          namaPemilikRekening: pemilikFinal,
          pendataanDiperbaruiPada: pendataanUpdated,
          sudahPendataan: Boolean(emailFinal && rekFinal),
          dibuatPada: rowObj.Dibuat_Pada,
          diperbaruiPada: rowObj.Diperbarui_Pada
        }
      });
    }

    if (action === 'deletePengurus') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID pengurus wajib diisi.' });
      const ss = getSpreadsheet_();
      const deleted = deleteRowByIdInSs_(ss, SHEETS.PENGURUS, 'ID_Pengurus', id);
      writeLog_('SUPERADMIN', 'deletePengurus', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Data pengurus tidak ditemukan.' });
    }

    if (action === 'saveKegiatan') {
      const kodeKegiatan = String(payload.kodeKegiatan || '').trim();
      const kodeProker = String(payload.kodeProker || '').trim();
      const namaKegiatan = String(payload.namaKegiatan || '').trim();
      if (!kodeKegiatan || !kodeProker || !namaKegiatan) {
        return jsonOut_({ ok: false, error: 'Kode kegiatan, kode program kerja, dan nama kegiatan wajib diisi.' });
      }
      const rowObj = {
        Kode_Kegiatan: kodeKegiatan,
        Kode_Proker: kodeProker,
        Nama_Proker: String(payload.namaProker || '').trim(),
        Nama_Kegiatan: namaKegiatan,
        Tujuan: String(payload.tujuan || '').trim(),
        Sasaran: String(payload.sasaran || '').trim(),
        Indikator: String(payload.indikator || '').trim(),
        Tempat: String(payload.tempat || '').trim(),
        Waktu: String(payload.waktu || '').trim(),
        Pendapatan: Number(payload.pendapatan || 0),
        Belanja: Number(payload.belanja || 0),
        Unit_PJ: String(payload.unitPj || '').trim(),
        Status_Pelaksanaan: String(payload.status || 'Rencana').trim(),
        Jenis_Kegiatan: String(payload.jenisKegiatan || 'Event').trim(),
        Pola_Jadwal: String(payload.polaJadwal || 'Tunggal').trim(),
        Tautan_Drive: String(payload.tautanDrive || '').trim()
      };
      const ss = getSpreadsheet_();
      const kegSheet = ss.getSheetByName(SHEETS.KEGIATAN_RPKA);
      if (kegSheet) {
        ensureHeaderColumns_(kegSheet, ['Jenis_Kegiatan', 'Pola_Jadwal']);
      }
      const updated = updateRowByIdInSs_(ss, SHEETS.KEGIATAN_RPKA, 'Kode_Kegiatan', kodeKegiatan, rowObj);
      if (!updated) {
        appendRowInSs_(ss, SHEETS.KEGIATAN_RPKA, rowObj);
      }
      writeLog_(role.toUpperCase(), 'saveKegiatan', kodeKegiatan + ' — ' + namaKegiatan + ' [' + rowObj.Jenis_Kegiatan + ' · ' + rowObj.Pola_Jadwal + ']');
      return jsonOut_({
        ok: true,
        data: {
          kodeKegiatan: rowObj.Kode_Kegiatan,
          kodeProker: rowObj.Kode_Proker,
          namaProker: rowObj.Nama_Proker,
          namaKegiatan: rowObj.Nama_Kegiatan,
          tujuan: rowObj.Tujuan,
          sasaran: rowObj.Sasaran,
          indikator: rowObj.Indikator,
          tempat: rowObj.Tempat,
          waktu: rowObj.Waktu,
          pendapatan: rowObj.Pendapatan,
          belanja: rowObj.Belanja,
          unitPj: rowObj.Unit_PJ,
          status: rowObj.Status_Pelaksanaan,
          jenisKegiatan: rowObj.Jenis_Kegiatan,
          polaJadwal: rowObj.Pola_Jadwal,
          tautanDrive: rowObj.Tautan_Drive
        }
      });
    }

    if (action === 'updateKegiatanJenis') {
      const kodeKegiatan = String(payload.kodeKegiatan || '').trim();
      const jenisKegiatan = String(payload.jenisKegiatan || 'Event').trim() === 'Monev' ? 'Monev' : 'Event';
      if (!kodeKegiatan) {
        return jsonOut_({ ok: false, error: 'Kode kegiatan wajib diisi.' });
      }
      const ss = getSpreadsheet_();
      const kegSheet = ss.getSheetByName(SHEETS.KEGIATAN_RPKA);
      if (kegSheet) {
        ensureHeaderColumns_(kegSheet, ['Jenis_Kegiatan', 'Pola_Jadwal']);
      }
      const existing = findRowInSs_(ss, SHEETS.KEGIATAN_RPKA, 'Kode_Kegiatan', kodeKegiatan);
      const itemFallback = payload.item || {};
      const rowObj = existing
        ? Object.assign({}, existing, { Jenis_Kegiatan: jenisKegiatan })
        : {
            Kode_Kegiatan: kodeKegiatan,
            Kode_Proker: String(itemFallback.kodeProker || '').trim(),
            Nama_Proker: String(itemFallback.namaProker || '').trim(),
            Nama_Kegiatan: String(itemFallback.namaKegiatan || '').trim(),
            Tujuan: String(itemFallback.tujuan || '').trim(),
            Sasaran: String(itemFallback.sasaran || '').trim(),
            Indikator: String(itemFallback.indikator || '').trim(),
            Tempat: String(itemFallback.tempat || '').trim(),
            Waktu: String(itemFallback.waktu || '').trim(),
            Pendapatan: Number(itemFallback.pendapatan || 0),
            Belanja: Number(itemFallback.belanja || 0),
            Unit_PJ: String(itemFallback.unitPj || '').trim(),
            Status_Pelaksanaan: String(itemFallback.status || 'Rencana').trim(),
            Jenis_Kegiatan: jenisKegiatan,
            Pola_Jadwal: String(itemFallback.polaJadwal || 'Tunggal').trim(),
            Tautan_Drive: String(itemFallback.tautanDrive || '').trim()
          };
      const updated = existing
        ? updateRowByIdInSs_(ss, SHEETS.KEGIATAN_RPKA, 'Kode_Kegiatan', kodeKegiatan, rowObj)
        : false;
      if (!updated) {
        appendRowInSs_(ss, SHEETS.KEGIATAN_RPKA, rowObj);
      }
      writeLog_(role.toUpperCase(), 'updateKegiatanJenis', kodeKegiatan + ' -> ' + jenisKegiatan);
      return jsonOut_({
        ok: true,
        data: {
          kodeKegiatan: String(rowObj.Kode_Kegiatan || kodeKegiatan),
          kodeProker: String(rowObj.Kode_Proker || ''),
          namaProker: String(rowObj.Nama_Proker || ''),
          namaKegiatan: String(rowObj.Nama_Kegiatan || ''),
          tujuan: String(rowObj.Tujuan || ''),
          sasaran: String(rowObj.Sasaran || ''),
          indikator: String(rowObj.Indikator || ''),
          tempat: String(rowObj.Tempat || ''),
          waktu: String(rowObj.Waktu || ''),
          pendapatan: Number(rowObj.Pendapatan || 0),
          belanja: Number(rowObj.Belanja || 0),
          unitPj: String(rowObj.Unit_PJ || ''),
          status: String(rowObj.Status_Pelaksanaan || 'Rencana'),
          jenisKegiatan: jenisKegiatan,
          polaJadwal: String(rowObj.Pola_Jadwal || 'Tunggal'),
          tautanDrive: String(rowObj.Tautan_Drive || '')
        }
      });
    }

    if (action === 'deleteKegiatan') {
      const kode = String(payload.kodeKegiatan || '').trim();
      if (!kode) return jsonOut_({ ok: false, error: 'Kode kegiatan wajib diisi.' });
      const ss = getSpreadsheet_();
      const deleted = deleteRowByIdInSs_(ss, SHEETS.KEGIATAN_RPKA, 'Kode_Kegiatan', kode);
      writeLog_('SUPERADMIN', 'deleteKegiatan', kode + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Kegiatan tidak ditemukan.' });
    }

    if (action === 'uploadMusyawarahFile') {
      const kind = String(payload.kind || '').trim(); // 'notula_file' | 'dokumentasi'
      const fileName = sanitizeDriveFileName_(payload.fileName || 'Berkas_Musyawarah');
      const mimeType = String(payload.mimeType || 'application/octet-stream').trim();
      const base64Data = String(payload.base64Data || '').trim();
      if (!base64Data) {
        return jsonOut_({ ok: false, error: 'Data berkas base64 kosong.' });
      }

      const lowerName = fileName.toLowerCase();
      if (kind === 'dokumentasi') {
        if (!/\.(jpg|jpeg|png)$/i.test(lowerName)) {
          return jsonOut_({ ok: false, error: 'File dokumentasi harus berupa gambar JPG atau PNG.' });
        }
      } else if (kind === 'notula_file') {
        if (!/\.(pdf|doc|docx)$/i.test(lowerName)) {
          return jsonOut_({ ok: false, error: 'File notula harus berupa PDF atau Word (.doc/.docx).' });
        }
      }

      const folder = getMusyawarahDriveFolder_();
      const bytes = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(bytes, mimeType, fileName);

      // Ganti berkas lama dengan nama yang persis sama di folder agar tidak menumpuk duplikat
      trashExistingFileByName_(folder, fileName);

      const savedFile = folder.createFile(blob);
      setDriveFilePublicViewSafe_(savedFile);
      const fileId = savedFile.getId();

      writeLog_(role.toUpperCase(), 'uploadMusyawarahFile', kind + ': ' + fileName + ' (' + fileId + ')');
      return jsonOut_({
        ok: true,
        data: {
          fileId: fileId,
          fileName: savedFile.getName(),
          url: savedFile.getUrl(),
          previewUrl: 'https://drive.google.com/file/d/' + fileId + '/preview',
          thumbnailUrl: kind === 'dokumentasi' ? ('https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1200') : ''
        }
      });
    }

    if (action === 'uploadMusyawarahNotulaText') {
      const baseFileName = sanitizeDriveFileName_(payload.baseFileName || 'Notula_Musyawarah');
      const pdfFileName = baseFileName + '.pdf';
      const notulaTeks = String(payload.notulaTeks || '').trim();
      if (!notulaTeks) {
        return jsonOut_({ ok: false, error: 'Isi teks notula masih kosong.' });
      }

      const folder = getMusyawarahDriveFolder_();
      const judul = String(payload.judul || baseFileName).trim();
      const jenisLabel = String(payload.jenis || 'Pleno') === 'Unit'
        ? ('Musyawarah Unit' + (payload.unitLabel ? ' (' + payload.unitLabel + ')' : ''))
        : 'Musyawarah Pleno';
      const musyawarahKe = Math.min(52, Math.max(1, Number(payload.musyawarahKe || 1)));
      const tanggalFormatted = String(payload.tanggalFormatted || '').trim();
      const presensiRingkasan = String(payload.presensiRingkasan || '').trim();

      // 1. Buat dokumen Word/Google Docs terlebih dahulu
      const doc = DocumentApp.create(baseFileName);
      const docId = doc.getId();
      try {
        const body = doc.getBody();
        body.setMarginTop(54);
        body.setMarginBottom(54);
        body.setMarginLeft(60);
        body.setMarginRight(60);

        const orgHeader = body.appendParagraph('DEPARTEMEN URUSAN WILAYAH DAN DAERAH');
        orgHeader.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        orgHeader.editAsText().setFontFamily('Arial').setFontSize(12).setBold(true).setForegroundColor('#07525E');

        const subHeader = body.appendParagraph('DEWAN PIMPINAN PUSAT WAHDAH ISLAMIYAH');
        subHeader.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        subHeader.editAsText().setFontFamily('Arial').setFontSize(10).setBold(true).setForegroundColor('#0C7A89');

        const docTitle = body.appendParagraph('NOTULA MUSYAWARAH');
        docTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
        docTitle.setSpacingBefore(10);
        docTitle.setSpacingAfter(8);
        docTitle.editAsText().setFontFamily('Arial').setFontSize(14).setBold(true).setForegroundColor('#0F2429');

        body.appendHorizontalRule();

        const metaLines = [
          'Agenda / Judul : ' + judul,
          'Jenis          : ' + jenisLabel,
          'Musyawarah Ke  : ' + musyawarahKe,
          'Tanggal        : ' + (tanggalFormatted || '-')
        ];
        if (presensiRingkasan) {
          metaLines.push('Kehadiran      : ' + presensiRingkasan);
        }
        metaLines.forEach(function (line) {
          const p = body.appendParagraph(line);
          p.setSpacingAfter(2);
          p.editAsText().setFontFamily('Arial').setFontSize(10).setForegroundColor('#233B41');
        });

        body.appendHorizontalRule();

        const isiHeader = body.appendParagraph('ISI NOTULA / KEPUTUSAN MUSYAWARAH');
        isiHeader.setSpacingBefore(10);
        isiHeader.setSpacingAfter(6);
        isiHeader.editAsText().setFontFamily('Arial').setFontSize(11).setBold(true).setForegroundColor('#07525E');

        const rawParagraphs = notulaTeks.replace(/\r\n/g, '\n').split('\n');
        rawParagraphs.forEach(function (line) {
          const p = body.appendParagraph(line);
          p.setSpacingAfter(4);
          p.setLineSpacing(1.25);
          p.editAsText().setFontFamily('Arial').setFontSize(10.5).setForegroundColor('#0F2429');
        });

        doc.saveAndClose();

        // 2. Konversi dokumen ke PDF dan simpan ke folder tujuan
        const tempDriveFile = DriveApp.getFileById(docId);
        const pdfBlob = tempDriveFile.getAs(MimeType.PDF).setName(pdfFileName);
        trashExistingFileByName_(folder, pdfFileName);
        const pdfFile = folder.createFile(pdfBlob);
        setDriveFilePublicViewSafe_(pdfFile);
        const pdfId = pdfFile.getId();

        // 3. Hapus dokumen sementara agar Drive tetap rapi
        tempDriveFile.setTrashed(true);

        writeLog_(role.toUpperCase(), 'uploadMusyawarahNotulaText', pdfFileName + ' (' + pdfId + ')');
        return jsonOut_({
          ok: true,
          data: {
            fileId: pdfId,
            fileName: pdfFile.getName(),
            url: pdfFile.getUrl(),
            previewUrl: 'https://drive.google.com/file/d/' + pdfId + '/preview'
          }
        });
      } catch (convErr) {
        try {
          DriveApp.getFileById(docId).setTrashed(true);
        } catch (ignore) {}
        throw convErr;
      }
    }

    if (action === 'saveMusyawarah') {
      const judul = String(payload.judul || '').trim();
      const tanggal = String(payload.tanggal || '').trim();
      const jenis = String(payload.jenis || 'Pleno').trim() === 'Unit' ? 'Unit' : 'Pleno';
      const musyawarahKe = Math.min(52, Math.max(1, Number(payload.musyawarahKe || 1)));
      if (!judul || !tanggal) {
        return jsonOut_({ ok: false, error: 'Judul dan tanggal musyawarah wajib diisi.' });
      }
      const ss = getSpreadsheet_();
      ensureMusyawarahSheets_(ss);
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const isEdit = Boolean(payload.id);
      const idMsy = isEdit ? String(payload.id).trim() : generateId_('MSY');
      const extraIdsArr = Array.isArray(payload.pesertaTambahanIds)
        ? payload.pesertaTambahanIds.map(function (x) { return String(x).trim(); }).filter(Boolean)
        : [];
      const dokId = String(payload.dokumentasiFileId || '').trim();
      const rowObj = {
        ID_Musyawarah: idMsy,
        Judul: judul,
        Jenis: jenis,
        Musyawarah_Ke: musyawarahKe,
        ID_Unit: jenis === 'Unit' ? String(payload.unitId || '').trim() : '',
        Nama_Unit: jenis === 'Unit' ? String(payload.namaUnit || '').trim() : '',
        Tanggal: tanggal,
        Waktu_Mulai: String(payload.waktuMulai || '').trim(),
        Waktu_Selesai: String(payload.waktuSelesai || '').trim(),
        Tempat: String(payload.tempat || 'Online').trim(),
        Pimpinan_Rapat: String(payload.pimpinanRapat || '').trim(),
        Notula_Mode: String(payload.notulaMode || '').trim(),
        Notula_Teks: String(payload.notulaTeks || '').trim(),
        Notula_File_Name: String(payload.notulaFileName || '').trim(),
        Notula_File_URL: String(payload.notulaFileUrl || '').trim(),
        Notula_File_ID: String(payload.notulaFileId || '').trim(),
        Dokumentasi_File_Name: String(payload.dokumentasiFileName || '').trim(),
        Dokumentasi_File_URL: String(payload.dokumentasiFileUrl || '').trim(),
        Dokumentasi_File_ID: dokId,
        Notulensi_Ringkas: String(payload.notulensiRingkas || '').trim(),
        Tautan_Drive: String(payload.tautanDrive || payload.notulaFileUrl || '').trim(),
        Peserta_Tambahan_IDs: extraIdsArr.join(','),
        Dibuat_Pada: isEdit ? String(payload.dibuatPada || nowStr) : nowStr,
        Diperbarui_Pada: nowStr
      };
      const updated = isEdit
        ? updateRowByIdInSs_(ss, SHEETS.MUSYAWARAH, 'ID_Musyawarah', idMsy, rowObj)
        : false;
      if (!updated) {
        appendRowInSs_(ss, SHEETS.MUSYAWARAH, rowObj);
      }
      writeLog_(role.toUpperCase(), isEdit ? 'updateMusyawarah' : 'createMusyawarah', idMsy + ' — ' + judul + ' (Ke-' + musyawarahKe + ')');
      return jsonOut_({
        ok: true,
        data: {
          id: idMsy,
          judul: rowObj.Judul,
          jenis: rowObj.Jenis,
          musyawarahKe: musyawarahKe,
          unitId: rowObj.ID_Unit,
          namaUnit: rowObj.Nama_Unit,
          tanggal: rowObj.Tanggal,
          waktuMulai: rowObj.Waktu_Mulai,
          waktuSelesai: rowObj.Waktu_Selesai,
          tempat: rowObj.Tempat,
          pimpinanRapat: rowObj.Pimpinan_Rapat,
          notulaMode: rowObj.Notula_Mode,
          notulaTeks: rowObj.Notula_Teks,
          notulaFileName: rowObj.Notula_File_Name,
          notulaFileUrl: rowObj.Notula_File_URL,
          notulaFileId: rowObj.Notula_File_ID,
          dokumentasiFileName: rowObj.Dokumentasi_File_Name,
          dokumentasiFileUrl: rowObj.Dokumentasi_File_URL,
          dokumentasiFileId: dokId,
          dokumentasiPreviewUrl: dokId ? ('https://drive.google.com/thumbnail?id=' + dokId + '&sz=w1200') : '',
          notulensiRingkas: rowObj.Notulensi_Ringkas,
          tautanDrive: rowObj.Tautan_Drive,
          pesertaTambahanIds: extraIdsArr,
          dibuatPada: rowObj.Dibuat_Pada,
          diperbaruiPada: rowObj.Diperbarui_Pada
        }
      });
    }

    if (action === 'deleteMusyawarah') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID musyawarah wajib diisi.' });
      const ss = getSpreadsheet_();
      const deleted = deleteRowByIdInSs_(ss, SHEETS.MUSYAWARAH, 'ID_Musyawarah', id);
      deleteRowsByColumnInSs_(ss, SHEETS.PRESENSI_MUSYAWARAH, 'ID_Musyawarah', id);
      writeLog_(role.toUpperCase(), 'deleteMusyawarah', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Musyawarah tidak ditemukan.' });
    }

    if (action === 'savePresensiBatch') {
      const musyawarahId = String(payload.musyawarahId || '').trim();
      const entries = Array.isArray(payload.entries) ? payload.entries : [];
      if (!musyawarahId) {
        return jsonOut_({ ok: false, error: 'ID musyawarah wajib diisi.' });
      }
      const ss = getSpreadsheet_();
      ensureMusyawarahSheets_(ss);
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      deleteRowsByColumnInSs_(ss, SHEETS.PRESENSI_MUSYAWARAH, 'ID_Musyawarah', musyawarahId);

      const savedList = [];
      const sheet = ss.getSheetByName(SHEETS.PRESENSI_MUSYAWARAH);
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) {
        return String(h).trim();
      });
      const rowsToInsert = [];

      entries.forEach(function (entry) {
        const pid = String(entry.pengurusId || '').trim();
        if (!pid) return;
        const idPres = musyawarahId + '__' + pid;
        const obj = {
          ID_Presensi: idPres,
          ID_Musyawarah: musyawarahId,
          ID_Pengurus: pid,
          Nama_Lengkap: String(entry.namaLengkap || '').trim(),
          Unit_Kode: String(entry.unitKode || '').trim(),
          Amanah: String(entry.amanah || '').trim(),
          Sumber_Peserta: String(entry.sumberPeserta || 'Wajib') === 'Tambahan' ? 'Tambahan' : 'Wajib',
          Status_Kehadiran: String(entry.status || 'Hadir').trim(),
          Keterangan: String(entry.keterangan || '').trim(),
          Diperbarui_Pada: nowStr
        };
        rowsToInsert.push(headers.map(function (h) { return obj.hasOwnProperty(h) ? obj[h] : ''; }));
        savedList.push({
          id: idPres,
          musyawarahId: musyawarahId,
          pengurusId: pid,
          namaLengkap: obj.Nama_Lengkap,
          unitKode: obj.Unit_Kode,
          amanah: obj.Amanah,
          sumberPeserta: obj.Sumber_Peserta,
          status: obj.Status_Kehadiran,
          keterangan: obj.Keterangan,
          diperbaruiPada: nowStr
        });
      });

      if (rowsToInsert.length > 0) {
        const lock = LockService.getScriptLock();
        lock.waitLock(10000);
        try {
          sheet.getRange(sheet.getLastRow() + 1, 1, rowsToInsert.length, headers.length).setValues(rowsToInsert);
        } finally {
          lock.releaseLock();
        }
      }

      writeLog_(role.toUpperCase(), 'savePresensiBatch', musyawarahId + ' (' + savedList.length + ' peserta)');
      return jsonOut_({ ok: true, data: savedList });
    }

    // =========================================================================
    // PUSAT DOKUMEN — KATEGORI, SUBFOLDER & UPLOAD GOOGLE DRIVE (TERMASUK ZIP)
    // =========================================================================
    if (action === 'saveDokumenKategori') {
      const namaKategori = String(payload.namaKategori || '').trim();
      if (!namaKategori) {
        return jsonOut_({ ok: false, error: 'Nama kategori dokumen wajib diisi.' });
      }
      const ss = getSpreadsheet_();
      ensureDokumenSheets_(ss);

      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const todayStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd');
      const isEdit = Boolean(payload.id);
      const idKat = isEdit ? String(payload.id).trim() : generateId_('KAT');
      const existing = isEdit ? findRowInSs_(ss, SHEETS.DOKUMEN_KATEGORI, 'ID_Kategori', idKat) : null;
      const cleanFolderName = sanitizeDriveFileName_(namaKategori);

      let driveFolderId = String(payload.driveFolderId || (existing ? existing.Drive_Folder_ID : '') || '').trim();
      let driveFolderUrl = String(payload.driveFolderUrl || (existing ? existing.Drive_Folder_URL : '') || '').trim();

      try {
        const rootFolder = getDokumenDriveFolder_();
        let catFolder = null;
        if (driveFolderId) {
          try {
            catFolder = DriveApp.getFolderById(driveFolderId);
            if (catFolder.getName() !== cleanFolderName) {
              catFolder.setName(cleanFolderName);
            }
          } catch (ignore) {
            catFolder = null;
          }
        }
        if (!catFolder) {
          catFolder = getOrCreateSubfolder_(rootFolder, cleanFolderName);
        }
        setDriveFilePublicViewSafe_(catFolder);
        driveFolderId = catFolder.getId();
        driveFolderUrl = catFolder.getUrl();
      } catch (driveErr) {
        return jsonOut_({
          ok: false,
          error: 'Gagal menyiapkan folder kategori di Google Drive: ' + driveErr.message
        });
      }

      const existingRows = readRowsOptional_(SHEETS.DOKUMEN_KATEGORI);
      const urutan = Number(payload.urutan || (existing ? existing.Urutan : existingRows.length + 1) || 1);
      const tanggalUpdate = String(payload.tanggalUpdate || todayStr).trim();

      const rowObj = {
        ID_Kategori: idKat,
        Nama_Kategori: namaKategori,
        Deskripsi: String(payload.deskripsi || '').trim(),
        Urutan: urutan,
        Drive_Folder_ID: driveFolderId,
        Drive_Folder_URL: driveFolderUrl,
        Tanggal_Update: tanggalUpdate,
        Dibuat_Pada: isEdit ? String(payload.dibuatPada || (existing ? existing.Dibuat_Pada : nowStr)) : nowStr,
        Diperbarui_Pada: nowStr
      };

      const updated = isEdit
        ? updateRowByIdInSs_(ss, SHEETS.DOKUMEN_KATEGORI, 'ID_Kategori', idKat, rowObj)
        : false;
      if (!updated) {
        appendRowInSs_(ss, SHEETS.DOKUMEN_KATEGORI, rowObj);
      } else {
        cascadeKategoriNameToFiles_(ss, idKat, namaKategori);
        cascadeKategoriNameToSubkategori_(ss, idKat, namaKategori);
      }

      writeLog_('SUPERADMIN', isEdit ? 'updateDokumenKategori' : 'createDokumenKategori', idKat + ' — ' + namaKategori);
      return jsonOut_({ ok: true, data: mapDokumenKategoriRow_(rowObj) });
    }

    if (action === 'reorderDokumenKategori') {
      const orders = Array.isArray(payload.orders) ? payload.orders : [];
      if (orders.length === 0) {
        return jsonOut_({ ok: false, error: 'Daftar urutan kategori kosong.' });
      }
      const ss = getSpreadsheet_();
      ensureDokumenSheets_(ss);
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      orders.forEach(function (entry) {
        if (entry && entry.id) {
          updateRowByIdInSs_(ss, SHEETS.DOKUMEN_KATEGORI, 'ID_Kategori', String(entry.id).trim(), {
            Urutan: Number(entry.urutan || 1),
            Diperbarui_Pada: nowStr
          });
        }
      });
      writeLog_('SUPERADMIN', 'reorderDokumenKategori', orders.length + ' kategori');
      return jsonOut_({ ok: true });
    }

    if (action === 'deleteDokumenKategori') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID kategori dokumen wajib diisi.' });
      const ss = getSpreadsheet_();
      ensureDokumenSheets_(ss);
      const existing = findRowInSs_(ss, SHEETS.DOKUMEN_KATEGORI, 'ID_Kategori', id);
      if (existing && existing.Drive_Folder_ID) {
        try {
          DriveApp.getFolderById(String(existing.Drive_Folder_ID).trim()).setTrashed(true);
        } catch (ignore) {}
      }
      const deleted = deleteRowByIdInSs_(ss, SHEETS.DOKUMEN_KATEGORI, 'ID_Kategori', id);
      deleteRowsByColumnInSs_(ss, SHEETS.DOKUMEN_SUBKATEGORI, 'ID_Kategori', id);
      deleteRowsByColumnInSs_(ss, SHEETS.DOKUMEN_FILE, 'ID_Kategori', id);
      writeLog_('SUPERADMIN', 'deleteDokumenKategori', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Kategori dokumen tidak ditemukan.' });
    }

    if (action === 'saveDokumenSubkategori') {
      const kategoriId = String(payload.kategoriId || '').trim();
      const namaSubkategori = String(payload.namaSubkategori || '').trim();
      if (!kategoriId || !namaSubkategori) {
        return jsonOut_({ ok: false, error: 'Kategori dan nama subkategori wajib diisi.' });
      }
      const ss = getSpreadsheet_();
      ensureDokumenSheets_(ss);

      const katRow = findRowInSs_(ss, SHEETS.DOKUMEN_KATEGORI, 'ID_Kategori', kategoriId);
      const namaKategori = String(payload.namaKategori || (katRow ? katRow.Nama_Kategori : '') || 'Dokumen').trim();
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const todayStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd');
      const isEdit = Boolean(payload.id);
      const idSub = isEdit ? String(payload.id).trim() : generateId_('SUB');
      const existing = isEdit ? findRowInSs_(ss, SHEETS.DOKUMEN_SUBKATEGORI, 'ID_Subkategori', idSub) : null;
      const oldSubName = existing ? String(existing.Nama_Subkategori || '').trim() : '';
      const cleanSubName = sanitizeDriveFileName_(namaSubkategori);

      let driveFolderId = String(payload.driveFolderId || (existing ? existing.Drive_Folder_ID : '') || '').trim();
      let driveFolderUrl = String(payload.driveFolderUrl || (existing ? existing.Drive_Folder_URL : '') || '').trim();

      try {
        const rootFolder = getDokumenDriveFolder_();
        let catFolder = null;
        if (katRow && katRow.Drive_Folder_ID) {
          try {
            catFolder = DriveApp.getFolderById(String(katRow.Drive_Folder_ID).trim());
          } catch (ignore) {
            catFolder = null;
          }
        }
        if (!catFolder) {
          catFolder = getOrCreateSubfolder_(rootFolder, sanitizeDriveFileName_(namaKategori));
          setDriveFilePublicViewSafe_(catFolder);
        }

        let subFolder = null;
        if (driveFolderId) {
          try {
            subFolder = DriveApp.getFolderById(driveFolderId);
            if (subFolder.getName() !== cleanSubName) {
              subFolder.setName(cleanSubName);
            }
          } catch (ignore) {
            subFolder = null;
          }
        }
        if (!subFolder) {
          subFolder = getOrCreateSubfolder_(catFolder, cleanSubName);
        }
        setDriveFilePublicViewSafe_(subFolder);
        driveFolderId = subFolder.getId();
        driveFolderUrl = subFolder.getUrl();
      } catch (driveErr) {
        return jsonOut_({
          ok: false,
          error: 'Gagal menyiapkan folder subkategori di Google Drive: ' + driveErr.message
        });
      }

      const existingSubs = readRowsOptional_(SHEETS.DOKUMEN_SUBKATEGORI).filter(function (r) {
        return String(r.ID_Kategori || '') === kategoriId;
      });
      const urutan = Number(payload.urutan || (existing ? existing.Urutan : existingSubs.length + 1) || 1);
      const tanggalUpdate = String(payload.tanggalUpdate || todayStr).trim();

      const rowObj = {
        ID_Subkategori: idSub,
        ID_Kategori: kategoriId,
        Nama_Kategori: namaKategori,
        Nama_Subkategori: namaSubkategori,
        Urutan: urutan,
        Drive_Folder_ID: driveFolderId,
        Drive_Folder_URL: driveFolderUrl,
        Tanggal_Update: tanggalUpdate,
        Dibuat_Pada: isEdit ? String(payload.dibuatPada || (existing ? existing.Dibuat_Pada : nowStr)) : nowStr,
        Diperbarui_Pada: nowStr
      };

      const updated = isEdit
        ? updateRowByIdInSs_(ss, SHEETS.DOKUMEN_SUBKATEGORI, 'ID_Subkategori', idSub, rowObj)
        : false;
      if (!updated) {
        appendRowInSs_(ss, SHEETS.DOKUMEN_SUBKATEGORI, rowObj);
      } else if (oldSubName && oldSubName !== namaSubkategori) {
        cascadeSubkategoriNameToFiles_(ss, kategoriId, oldSubName, namaSubkategori);
      }

      updateKategoriTanggalUpdate_(ss, kategoriId, tanggalUpdate, nowStr);
      writeLog_('SUPERADMIN', isEdit ? 'updateDokumenSubkategori' : 'createDokumenSubkategori', idSub + ' — ' + namaSubkategori);
      return jsonOut_({ ok: true, data: mapDokumenSubkategoriRow_(rowObj) });
    }

    if (action === 'deleteDokumenSubkategori') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID subkategori wajib diisi.' });
      const ss = getSpreadsheet_();
      ensureDokumenSheets_(ss);
      const existing = findRowInSs_(ss, SHEETS.DOKUMEN_SUBKATEGORI, 'ID_Subkategori', id);
      if (existing && existing.Drive_Folder_ID) {
        try {
          DriveApp.getFolderById(String(existing.Drive_Folder_ID).trim()).setTrashed(true);
        } catch (ignore) {}
      }
      const deleted = deleteRowByIdInSs_(ss, SHEETS.DOKUMEN_SUBKATEGORI, 'ID_Subkategori', id);
      if (existing) {
        deleteDokumenFilesBySubfolder_(ss, String(existing.ID_Kategori || ''), String(existing.Nama_Subkategori || ''));
      }
      writeLog_('SUPERADMIN', 'deleteDokumenSubkategori', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Subkategori tidak ditemukan.' });
    }

    if (action === 'uploadDokumenFile') {
      const kategoriId = String(payload.kategoriId || '').trim();
      const base64Data = String(payload.base64Data || '').trim();
      const originalFileName = String(payload.originalFileName || 'Dokumen').trim();
      const mimeType = String(payload.mimeType || 'application/octet-stream').trim();
      const extractZip = payload.extractZip !== false;
      const replaceDokumenId = String(payload.replaceDokumenId || '').trim();

      if (!kategoriId) {
        return jsonOut_({ ok: false, error: 'Kategori dokumen wajib dipilih terlebih dahulu.' });
      }
      if (!base64Data) {
        return jsonOut_({ ok: false, error: 'Data berkas unggahan kosong.' });
      }

      const ss = getSpreadsheet_();
      ensureDokumenSheets_(ss);

      const katRow = findRowInSs_(ss, SHEETS.DOKUMEN_KATEGORI, 'ID_Kategori', kategoriId);
      const namaKategori = String(payload.namaKategori || (katRow ? katRow.Nama_Kategori : '') || 'Dokumen').trim();
      const cleanKatName = sanitizeDriveFileName_(namaKategori);
      const rootFolder = getDokumenDriveFolder_();

      let catFolder = null;
      if (katRow && katRow.Drive_Folder_ID) {
        try {
          catFolder = DriveApp.getFolderById(String(katRow.Drive_Folder_ID).trim());
        } catch (ignore) {
          catFolder = null;
        }
      }
      if (!catFolder) {
        catFolder = getOrCreateSubfolder_(rootFolder, cleanKatName);
        setDriveFilePublicViewSafe_(catFolder);
        if (katRow) {
          updateRowByIdInSs_(ss, SHEETS.DOKUMEN_KATEGORI, 'ID_Kategori', kategoriId, {
            Drive_Folder_ID: catFolder.getId(),
            Drive_Folder_URL: catFolder.getUrl()
          });
        }
      }

      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const todayStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd');
      const tanggalUpdate = String(payload.tanggalUpdate || todayStr).trim();
      const keterangan = String(payload.keterangan || '').trim();
      const userSubfolder = sanitizeDriveFileName_(payload.subfolder || '');
      const bytes = Utilities.base64Decode(base64Data);
      const origExt = extractExtFromName_(originalFileName);
      const createdItems = [];

      if (extractZip && origExt === 'zip') {
        const zipBlob = Utilities.newBlob(bytes, 'application/zip', originalFileName);
        let unzipped = [];
        try {
          unzipped = Utilities.unzip(zipBlob);
        } catch (zipErr) {
          return jsonOut_({
            ok: false,
            error: 'Gagal mengekstrak arsip ZIP: ' + zipErr.message + '. Pastikan file ZIP tidak dipassword dan berformat standar.'
          });
        }

        const zipBaseSubfolder = sanitizeDriveFileName_(originalFileName.replace(/\.zip$/i, '')) || 'Paket Dokumen';
        const subfolderCache = {};

        for (let i = 0; i < unzipped.length; i++) {
          const entryBlob = unzipped[i];
          const rawEntryName = String(entryBlob.getName() || '').replace(/\\/g, '/');
          if (!rawEntryName || rawEntryName.endsWith('/')) continue;
          if (rawEntryName.indexOf('__MACOSX/') !== -1) continue;
          const parts = rawEntryName.split('/').filter(Boolean);
          const leafName = parts[parts.length - 1] || '';
          if (!leafName || leafName.indexOf('.') === 0 || leafName.toLowerCase() === 'thumbs.db') continue;

          // Tentukan subfolder: prioritas input user > folder di dalam ZIP > nama file ZIP
          let targetSubName = userSubfolder;
          if (!targetSubName) {
            if (parts.length >= 2) {
              targetSubName = sanitizeDriveFileName_(parts[parts.length - 2]);
            } else {
              targetSubName = zipBaseSubfolder;
            }
          }

          let targetFolder = catFolder;
          if (targetSubName) {
            if (!subfolderCache[targetSubName]) {
              const sub = getOrCreateSubfolder_(catFolder, targetSubName);
              setDriveFilePublicViewSafe_(sub);
              subfolderCache[targetSubName] = sub;
            }
            targetFolder = subfolderCache[targetSubName];
          }

          const entryExt = extractExtFromName_(leafName) || 'file';
          const entryTitle = sanitizeDriveFileName_(leafName.replace(/\.[^.]+$/, '')) || leafName;
          const driveFileName = buildDokumenDriveFileName_(namaKategori, targetSubName, entryTitle, entryExt);

          trashExistingFileByName_(targetFolder, driveFileName);
          const entryBytes = entryBlob.getBytes();
          const finalBlob = Utilities.newBlob(
            entryBytes,
            entryBlob.getContentType() || 'application/octet-stream',
            driveFileName
          );
          const savedFile = targetFolder.createFile(finalBlob);
          setDriveFilePublicViewSafe_(savedFile);

          const docId = generateId_('DOK');
          const rowObj = {
            ID_Dokumen: docId,
            ID_Kategori: kategoriId,
            Nama_Kategori: namaKategori,
            Subfolder: targetSubName,
            Judul_Dokumen: entryTitle,
            Tipe_Item: 'file',
            Nama_File_Drive: savedFile.getName(),
            Ekstensi: entryExt,
            Mime_Type: savedFile.getMimeType() || entryBlob.getContentType() || '',
            Ukuran_Bytes: savedFile.getSize() || entryBytes.length,
            Drive_File_ID: savedFile.getId(),
            Drive_File_URL: savedFile.getUrl(),
            Drive_Folder_ID: targetFolder.getId(),
            Drive_Folder_URL: targetFolder.getUrl(),
            Tanggal_Update: tanggalUpdate,
            Keterangan: keterangan,
            Jumlah_Dilihat: 0,
            Jumlah_Diunduh: 0,
            Dibuat_Pada: nowStr,
            Diperbarui_Pada: nowStr
          };
          if (targetSubName) {
            ensureSubkategoriRowExists_(ss, kategoriId, namaKategori, targetSubName, targetFolder.getId(), targetFolder.getUrl(), tanggalUpdate, nowStr);
          }
          appendRowInSs_(ss, SHEETS.DOKUMEN_FILE, rowObj);
          createdItems.push(mapDokumenFileRow_(rowObj));
        }

        if (createdItems.length === 0) {
          return jsonOut_({
            ok: false,
            error: 'Arsip ZIP tidak berisi file dokumen yang valid untuk diekstrak.'
          });
        }
      } else {
        let targetFolder = catFolder;
        if (userSubfolder) {
          targetFolder = getOrCreateSubfolder_(catFolder, userSubfolder);
          setDriveFilePublicViewSafe_(targetFolder);
          ensureSubkategoriRowExists_(ss, kategoriId, namaKategori, userSubfolder, targetFolder.getId(), targetFolder.getUrl(), tanggalUpdate, nowStr);
        }

        const ext = origExt || 'file';
        const judulDokumen = String(payload.judulDokumen || '').trim() ||
          sanitizeDriveFileName_(originalFileName.replace(/\.[^.]+$/, '')) ||
          'Dokumen';
        const driveFileName = buildDokumenDriveFileName_(namaKategori, userSubfolder, judulDokumen, ext);

        let prevViews = 0;
        let prevDownloads = 0;
        if (replaceDokumenId) {
          const prevDoc = findRowInSs_(ss, SHEETS.DOKUMEN_FILE, 'ID_Dokumen', replaceDokumenId);
          if (prevDoc) {
            prevViews = Number(prevDoc.Jumlah_Dilihat || 0);
            prevDownloads = Number(prevDoc.Jumlah_Diunduh || 0);
            if (prevDoc.Drive_File_ID) {
              try {
                DriveApp.getFileById(String(prevDoc.Drive_File_ID).trim()).setTrashed(true);
              } catch (ignore) {}
            }
          }
        }

        trashExistingFileByName_(targetFolder, driveFileName);
        const blob = Utilities.newBlob(bytes, mimeType, driveFileName);
        const savedFile = targetFolder.createFile(blob);
        setDriveFilePublicViewSafe_(savedFile);

        const docId = replaceDokumenId || generateId_('DOK');
        const rowObj = {
          ID_Dokumen: docId,
          ID_Kategori: kategoriId,
          Nama_Kategori: namaKategori,
          Subfolder: userSubfolder,
          Judul_Dokumen: judulDokumen,
          Tipe_Item: 'file',
          Nama_File_Drive: savedFile.getName(),
          Ekstensi: ext,
          Mime_Type: savedFile.getMimeType() || mimeType,
          Ukuran_Bytes: savedFile.getSize() || bytes.length,
          Drive_File_ID: savedFile.getId(),
          Drive_File_URL: savedFile.getUrl(),
          Drive_Folder_ID: targetFolder.getId(),
          Drive_Folder_URL: targetFolder.getUrl(),
          Tanggal_Update: tanggalUpdate,
          Keterangan: keterangan,
          Jumlah_Dilihat: prevViews,
          Jumlah_Diunduh: prevDownloads,
          Dibuat_Pada: nowStr,
          Diperbarui_Pada: nowStr
        };

        const updated = replaceDokumenId
          ? updateRowByIdInSs_(ss, SHEETS.DOKUMEN_FILE, 'ID_Dokumen', docId, rowObj)
          : false;
        if (!updated) {
          appendRowInSs_(ss, SHEETS.DOKUMEN_FILE, rowObj);
        }
        createdItems.push(mapDokumenFileRow_(rowObj));
      }

      updateKategoriTanggalUpdate_(ss, kategoriId, tanggalUpdate, nowStr);
      writeLog_('SUPERADMIN', 'uploadDokumenFile', namaKategori + ' (' + createdItems.length + ' file)');

      return jsonOut_({
        ok: true,
        data: {
          items: createdItems,
          extractedCount: createdItems.length,
          categoryFolderId: catFolder.getId(),
          categoryFolderUrl: catFolder.getUrl()
        }
      });
    }

    if (action === 'saveDokumenFile') {
      const kategoriId = String(payload.kategoriId || '').trim();
      const judulDokumen = String(payload.judulDokumen || '').trim();
      if (!kategoriId || !judulDokumen) {
        return jsonOut_({ ok: false, error: 'Kategori dan judul dokumen wajib diisi.' });
      }

      const ss = getSpreadsheet_();
      ensureDokumenSheets_(ss);

      const katRow = findRowInSs_(ss, SHEETS.DOKUMEN_KATEGORI, 'ID_Kategori', kategoriId);
      const namaKategori = String(payload.namaKategori || (katRow ? katRow.Nama_Kategori : '') || 'Dokumen').trim();
      const subfolder = sanitizeDriveFileName_(payload.subfolder || '');
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const todayStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd');
      const tanggalUpdate = String(payload.tanggalUpdate || todayStr).trim();
      const isEdit = Boolean(payload.id);
      const docId = isEdit ? String(payload.id).trim() : generateId_('DOK');
      const existing = isEdit ? findRowInSs_(ss, SHEETS.DOKUMEN_FILE, 'ID_Dokumen', docId) : null;

      let driveFileId = String(payload.driveFileId || (existing ? existing.Drive_File_ID : '') || '').trim();
      let driveFileUrl = String(payload.driveFileUrl || (existing ? existing.Drive_File_URL : '') || '').trim();
      let driveFolderId = String(payload.driveFolderId || (existing ? existing.Drive_Folder_ID : '') || '').trim();
      let driveFolderUrl = String(payload.driveFolderUrl || (existing ? existing.Drive_Folder_URL : '') || '').trim();
      const ext = String(payload.ekstensi || (existing ? existing.Ekstensi : '') || 'link').trim().toLowerCase();
      let namaFileDrive = String(payload.namaFileDrive || (existing ? existing.Nama_File_Drive : '') || judulDokumen).trim();

      // Jika file berada di Drive, otomatis rename & pindahkan folder bila kategori/subfolder/judul berubah
      if (driveFileId) {
        try {
          const driveFile = DriveApp.getFileById(driveFileId);
          const rootFolder = getDokumenDriveFolder_();
          let catFolder = null;
          if (katRow && katRow.Drive_Folder_ID) {
            try {
              catFolder = DriveApp.getFolderById(String(katRow.Drive_Folder_ID).trim());
            } catch (ignore) {
              catFolder = null;
            }
          }
          if (!catFolder) {
            catFolder = getOrCreateSubfolder_(rootFolder, sanitizeDriveFileName_(namaKategori));
            setDriveFilePublicViewSafe_(catFolder);
          }
          const targetFolder = subfolder ? getOrCreateSubfolder_(catFolder, subfolder) : catFolder;
          setDriveFilePublicViewSafe_(targetFolder);

          const formattedName = buildDokumenDriveFileName_(namaKategori, subfolder, judulDokumen, ext);
          if (driveFile.getName() !== formattedName) {
            driveFile.setName(formattedName);
          }
          if (driveFolderId !== targetFolder.getId()) {
            driveFile.moveTo(targetFolder);
          }
          namaFileDrive = driveFile.getName();
          driveFileUrl = driveFile.getUrl();
          driveFolderId = targetFolder.getId();
          driveFolderUrl = targetFolder.getUrl();
        } catch (ignore) {}
      } else if (!driveFileUrl) {
        return jsonOut_({ ok: false, error: 'Tautan Google Drive atau file unggahan wajib diisi.' });
      }

      const tipeItem = String(payload.tipeItem || (existing ? existing.Tipe_Item : '') || (driveFileId ? 'file' : 'link')).trim().toLowerCase() === 'link' ? 'link' : 'file';

      const rowObj = {
        ID_Dokumen: docId,
        ID_Kategori: kategoriId,
        Nama_Kategori: namaKategori,
        Subfolder: subfolder,
        Judul_Dokumen: judulDokumen,
        Tipe_Item: tipeItem,
        Nama_File_Drive: namaFileDrive,
        Ekstensi: ext,
        Mime_Type: String(payload.mimeType || (existing ? existing.Mime_Type : '') || ''),
        Ukuran_Bytes: Number(payload.ukuranBytes || (existing ? existing.Ukuran_Bytes : 0) || 0),
        Drive_File_ID: driveFileId,
        Drive_File_URL: driveFileUrl,
        Drive_Folder_ID: driveFolderId,
        Drive_Folder_URL: driveFolderUrl,
        Tanggal_Update: tanggalUpdate,
        Keterangan: String(payload.keterangan || '').trim(),
        Jumlah_Dilihat: Number(existing ? existing.Jumlah_Dilihat : (payload.jumlahDilihat || 0)) || 0,
        Jumlah_Diunduh: Number(existing ? existing.Jumlah_Diunduh : (payload.jumlahDiunduh || 0)) || 0,
        Dibuat_Pada: isEdit ? String(payload.dibuatPada || (existing ? existing.Dibuat_Pada : nowStr)) : nowStr,
        Diperbarui_Pada: nowStr
      };

      if (subfolder) {
        ensureSubkategoriRowExists_(ss, kategoriId, namaKategori, subfolder, driveFolderId, driveFolderUrl, tanggalUpdate, nowStr);
      }

      const updated = isEdit
        ? updateRowByIdInSs_(ss, SHEETS.DOKUMEN_FILE, 'ID_Dokumen', docId, rowObj)
        : false;
      if (!updated) {
        appendRowInSs_(ss, SHEETS.DOKUMEN_FILE, rowObj);
      }

      updateKategoriTanggalUpdate_(ss, kategoriId, tanggalUpdate, nowStr);
      writeLog_('SUPERADMIN', isEdit ? 'updateDokumenFile' : 'createDokumenFile', docId + ' — ' + judulDokumen);
      return jsonOut_({ ok: true, data: mapDokumenFileRow_(rowObj) });
    }

    if (action === 'deleteDokumenFile') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID dokumen wajib diisi.' });
      const ss = getSpreadsheet_();
      ensureDokumenSheets_(ss);
      const existing = findRowInSs_(ss, SHEETS.DOKUMEN_FILE, 'ID_Dokumen', id);
      if (existing && existing.Drive_File_ID) {
        try {
          DriveApp.getFileById(String(existing.Drive_File_ID).trim()).setTrashed(true);
        } catch (ignore) {}
      }
      const deleted = deleteRowByIdInSs_(ss, SHEETS.DOKUMEN_FILE, 'ID_Dokumen', id);
      writeLog_('SUPERADMIN', 'deleteDokumenFile', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Dokumen tidak ditemukan.' });
    }

    if (action === 'saveUnit') {
      const namaUnit = String(payload.namaUnit || '').trim();
      const kodeUnit = String(payload.kodeUnit || '').trim().toUpperCase();
      if (!namaUnit || !kodeUnit) {
        return jsonOut_({ ok: false, error: 'Kode unit dan nama unit wajib diisi.' });
      }

      const isEdit = Boolean(payload.id);
      const idUnit = isEdit ? String(payload.id).trim() : generateId_('UNIT');
      const urutan = Number(payload.urutan ?? 99);
      const aktif = payload.aktif === false ? 'Tidak' : 'Ya';

      const rowObj = {
        ID_Unit: idUnit,
        Kode_Unit: kodeUnit,
        Nama_Unit: namaUnit,
        Urutan: urutan,
        Aktif: aktif
      };

      const ss = getSpreadsheet_();
      const updated = isEdit ? updateRowByIdInSs_(ss, SHEETS.UNIT, 'ID_Unit', idUnit, rowObj) : false;
      if (!updated) {
        appendRowInSs_(ss, SHEETS.UNIT, rowObj);
      } else {
        cascadeUnitNameToPengurus_(idUnit, namaUnit);
      }

      writeLog_('SUPERADMIN', isEdit ? 'updateUnit' : 'createUnit', idUnit + ' — ' + kodeUnit);

      return jsonOut_({
        ok: true,
        data: {
          id: idUnit,
          kodeUnit: kodeUnit,
          namaUnit: namaUnit,
          urutan: urutan,
          aktif: aktif !== 'Tidak'
        }
      });
    }

    if (action === 'deleteUnit') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID unit wajib diisi.' });
      const ss = getSpreadsheet_();
      const deleted = deleteRowByIdInSs_(ss, SHEETS.UNIT, 'ID_Unit', id);
      writeLog_('SUPERADMIN', 'deleteUnit', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Unit tidak ditemukan.' });
    }

    if (action === 'setupWilayahSpreadsheet') {
      const rawId = String(payload.wilayahSpreadsheetId || '').trim();
      const cleanId = extractSpreadsheetId_(rawId);
      if (cleanId) {
        upsertSetting_('WILAYAH_SPREADSHEET_ID', cleanId);
      }
      const wSs = getWilayahSpreadsheetOrThrow_(cleanId);
      setupWilayahDatabase_(wSs);
      writeLog_('SUPERADMIN', 'setupWilayahSpreadsheet', 'Spreadsheet #2 "' + wSs.getName() + '" siap digunakan.');
      return jsonOut_({
        ok: true,
        message: 'Tab DPW, DPD, DPC, dan DPR berhasil disiapkan pada Spreadsheet "' + wSs.getName() + '".',
        data: {
          wilayahSpreadsheetId: wSs.getId(),
          wilayahName: wSs.getName()
        }
      });
    }

    if (action === 'saveDpw') {
      const wSs = getWilayahSpreadsheetOrThrow_();
      setupWilayahDatabase_(wSs);

      const kodeWilayah = String(payload.kodeWilayah || '').trim();
      const namaProvinsi = String(payload.namaProvinsi || '').trim();
      const namaDpw = String(payload.namaDpw || ('DPW ' + namaProvinsi)).trim();
      if (!kodeWilayah || !namaProvinsi) {
        return jsonOut_({ ok: false, error: 'Kode wilayah dan nama provinsi wajib diisi.' });
      }

      const existing = findRowInSs_(wSs, WILAYAH_SHEETS.DPW, 'Kode_Wilayah', kodeWilayah)
        || (payload.id ? findRowInSs_(wSs, WILAYAH_SHEETS.DPW, 'ID_DPW', payload.id) : null);
      const idDpw = buildLembagaId_('dpw', kodeWilayah);
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const ketuaNamaUp = String(payload.ketuaNama || '').trim().toUpperCase();
      const sekNamaUp = String(payload.sekretarisNama || '').trim().toUpperCase();

      const rowObj = role === 'admin'
        ? {
            ID_DPW: idDpw,
            Kode_Wilayah: existing ? String(existing.Kode_Wilayah) : kodeWilayah,
            Pulau: existing ? String(existing.Pulau) : String(payload.pulau || '').trim(),
            Nama_DPW: existing ? String(existing.Nama_DPW) : namaDpw,
            Nama_Provinsi: existing ? String(existing.Nama_Provinsi) : namaProvinsi,
            Status_Terbentuk: existing ? String(existing.Status_Terbentuk || 'Belum Terbentuk') : 'Belum Terbentuk',
            Ketua_Nama: ketuaNamaUp,
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: sekNamaUp,
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Diperbarui_Pada: nowStr
          }
        : {
            ID_DPW: idDpw,
            Kode_Wilayah: kodeWilayah,
            Pulau: String(payload.pulau || '').trim(),
            Nama_DPW: namaDpw,
            Nama_Provinsi: namaProvinsi,
            Status_Terbentuk: String(payload.statusTerbentuk || 'Sudah Terbentuk').trim(),
            Ketua_Nama: ketuaNamaUp,
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: sekNamaUp,
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Diperbarui_Pada: nowStr
          };

      const updated = existing
        ? (updateRowByIdInSs_(wSs, WILAYAH_SHEETS.DPW, 'Kode_Wilayah', kodeWilayah, rowObj)
          || (existing.ID_DPW ? updateRowByIdInSs_(wSs, WILAYAH_SHEETS.DPW, 'ID_DPW', String(existing.ID_DPW), rowObj) : false))
        : false;
      if (!updated) {
        appendRowInSs_(wSs, WILAYAH_SHEETS.DPW, rowObj);
      }

      writeLog_(role.toUpperCase(), existing ? 'updateDpw' : 'createDpw', idDpw + ' — ' + rowObj.Nama_DPW);
      return jsonOut_({ ok: true, data: mapDpwRow_(rowObj) });
    }

    if (action === 'deleteDpw') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID DPW wajib diisi.' });
      const wSs = getWilayahSpreadsheetOrThrow_();
      const deleted = deleteRowByIdInSs_(wSs, WILAYAH_SHEETS.DPW, 'ID_DPW', id);
      writeLog_('SUPERADMIN', 'deleteDpw', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Data DPW tidak ditemukan.' });
    }

    if (action === 'saveDpd') {
      const wSs = getWilayahSpreadsheetOrThrow_();
      setupWilayahDatabase_(wSs);

      const kodeWilayah = String(payload.kodeWilayah || '').trim();
      const namaKabKota = String(payload.namaKabKota || '').trim();
      const namaDpd = String(payload.namaDpd || ('DPD ' + namaKabKota)).trim();
      if (!kodeWilayah || !namaKabKota) {
        return jsonOut_({ ok: false, error: 'Kode wilayah dan nama Kab/Kota wajib diisi.' });
      }

      const existing = findRowInSs_(wSs, WILAYAH_SHEETS.DPD, 'Kode_Wilayah', kodeWilayah)
        || (payload.id ? findRowInSs_(wSs, WILAYAH_SHEETS.DPD, 'ID_DPD', payload.id) : null);
      const idDpd = buildLembagaId_('dpd', kodeWilayah);
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const kodeProv = String(payload.kodeProvinsi || kodeWilayah.split('.')[0] || '').trim();
      const ketuaNamaUp = String(payload.ketuaNama || '').trim().toUpperCase();
      const sekNamaUp = String(payload.sekretarisNama || '').trim().toUpperCase();

      const rowObj = role === 'admin'
        ? {
            ID_DPD: idDpd,
            Kode_Wilayah: existing ? String(existing.Kode_Wilayah) : kodeWilayah,
            Kode_Provinsi: existing ? String(existing.Kode_Provinsi) : kodeProv,
            Pulau: existing ? String(existing.Pulau) : String(payload.pulau || '').trim(),
            Nama_Provinsi: existing ? String(existing.Nama_Provinsi) : String(payload.namaProvinsi || '').trim(),
            Nama_DPD: existing ? String(existing.Nama_DPD) : namaDpd,
            Nama_KabKota: existing ? String(existing.Nama_KabKota) : namaKabKota,
            Status_Terbentuk: existing ? String(existing.Status_Terbentuk || 'Belum Terbentuk') : 'Belum Terbentuk',
            Ketua_Nama: ketuaNamaUp,
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: sekNamaUp,
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Diperbarui_Pada: nowStr
          }
        : {
            ID_DPD: idDpd,
            Kode_Wilayah: kodeWilayah,
            Kode_Provinsi: kodeProv,
            Pulau: String(payload.pulau || '').trim(),
            Nama_Provinsi: String(payload.namaProvinsi || '').trim(),
            Nama_DPD: namaDpd,
            Nama_KabKota: namaKabKota,
            Status_Terbentuk: String(payload.statusTerbentuk || 'Sudah Terbentuk').trim(),
            Ketua_Nama: ketuaNamaUp,
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: sekNamaUp,
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Diperbarui_Pada: nowStr
          };

      const updated = existing
        ? (updateRowByIdInSs_(wSs, WILAYAH_SHEETS.DPD, 'Kode_Wilayah', kodeWilayah, rowObj)
          || (existing.ID_DPD ? updateRowByIdInSs_(wSs, WILAYAH_SHEETS.DPD, 'ID_DPD', String(existing.ID_DPD), rowObj) : false))
        : false;
      if (!updated) {
        appendRowInSs_(wSs, WILAYAH_SHEETS.DPD, rowObj);
      }

      writeLog_(role.toUpperCase(), existing ? 'updateDpd' : 'createDpd', idDpd + ' — ' + rowObj.Nama_DPD);
      return jsonOut_({ ok: true, data: mapDpdRow_(rowObj) });
    }

    if (action === 'deleteDpd') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID DPD wajib diisi.' });
      const wSs = getWilayahSpreadsheetOrThrow_();
      const deleted = deleteRowByIdInSs_(wSs, WILAYAH_SHEETS.DPD, 'ID_DPD', id);
      writeLog_('SUPERADMIN', 'deleteDpd', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Data DPD tidak ditemukan.' });
    }

    if (action === 'saveDpc') {
      const wSs = getWilayahSpreadsheetOrThrow_();
      setupWilayahDatabase_(wSs);

      const kodeWilayah = String(payload.kodeWilayah || '').trim();
      const namaKecamatan = String(payload.namaKecamatan || '').trim();
      const namaDpc = String(payload.namaDpc || ('DPC ' + namaKecamatan)).trim();
      if (!kodeWilayah || !namaKecamatan) {
        return jsonOut_({ ok: false, error: 'Kode wilayah dan nama Kecamatan wajib diisi.' });
      }

      const existing = findRowInSs_(wSs, WILAYAH_SHEETS.DPC, 'Kode_Wilayah', kodeWilayah)
        || (payload.id ? findRowInSs_(wSs, WILAYAH_SHEETS.DPC, 'ID_DPC', payload.id) : null);
      const idDpc = buildLembagaId_('dpc', kodeWilayah);
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const segs = kodeWilayah.split('.');
      const kodeKab = String(payload.kodeKabKota || segs.slice(0, 2).join('.') || '').trim();
      const kodeProv = String(payload.kodeProvinsi || segs[0] || '').trim();
      const ketuaNamaUp = String(payload.ketuaNama || '').trim().toUpperCase();
      const sekNamaUp = String(payload.sekretarisNama || '').trim().toUpperCase();

      const rowObj = role === 'admin'
        ? {
            ID_DPC: idDpc,
            Kode_Wilayah: existing ? String(existing.Kode_Wilayah) : kodeWilayah,
            Kode_KabKota: existing ? String(existing.Kode_KabKota) : kodeKab,
            Kode_Provinsi: existing ? String(existing.Kode_Provinsi) : kodeProv,
            Pulau: existing ? String(existing.Pulau) : String(payload.pulau || '').trim(),
            Nama_Provinsi: existing ? String(existing.Nama_Provinsi) : String(payload.namaProvinsi || '').trim(),
            Nama_KabKota: existing ? String(existing.Nama_KabKota) : String(payload.namaKabKota || '').trim(),
            Nama_Kecamatan: existing ? String(existing.Nama_Kecamatan) : namaKecamatan,
            Nama_DPC: existing ? String(existing.Nama_DPC) : namaDpc,
            Status_Terbentuk: existing ? String(existing.Status_Terbentuk || 'Belum Terbentuk') : 'Belum Terbentuk',
            Ketua_Nama: ketuaNamaUp,
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: sekNamaUp,
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Diperbarui_Pada: nowStr
          }
        : {
            ID_DPC: idDpc,
            Kode_Wilayah: kodeWilayah,
            Kode_KabKota: kodeKab,
            Kode_Provinsi: kodeProv,
            Pulau: String(payload.pulau || '').trim(),
            Nama_Provinsi: String(payload.namaProvinsi || '').trim(),
            Nama_KabKota: String(payload.namaKabKota || '').trim(),
            Nama_Kecamatan: namaKecamatan,
            Nama_DPC: namaDpc,
            Status_Terbentuk: String(payload.statusTerbentuk || 'Sudah Terbentuk').trim(),
            Ketua_Nama: ketuaNamaUp,
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: sekNamaUp,
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Diperbarui_Pada: nowStr
          };

      const updated = existing
        ? (updateRowByIdInSs_(wSs, WILAYAH_SHEETS.DPC, 'Kode_Wilayah', kodeWilayah, rowObj)
          || (existing.ID_DPC ? updateRowByIdInSs_(wSs, WILAYAH_SHEETS.DPC, 'ID_DPC', String(existing.ID_DPC), rowObj) : false))
        : false;
      if (!updated) {
        appendRowInSs_(wSs, WILAYAH_SHEETS.DPC, rowObj);
      }

      writeLog_(role.toUpperCase(), existing ? 'updateDpc' : 'createDpc', idDpc + ' — ' + rowObj.Nama_DPC);
      return jsonOut_({ ok: true, data: mapDpcRow_(rowObj) });
    }

    if (action === 'deleteDpc') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID DPC wajib diisi.' });
      const wSs = getWilayahSpreadsheetOrThrow_();
      const deleted = deleteRowByIdInSs_(wSs, WILAYAH_SHEETS.DPC, 'ID_DPC', id);
      writeLog_('SUPERADMIN', 'deleteDpc', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Data DPC tidak ditemukan.' });
    }

    if (action === 'saveDpr') {
      const wSs = getWilayahSpreadsheetOrThrow_();
      setupWilayahDatabase_(wSs);

      const kodeWilayah = String(payload.kodeWilayah || '').trim();
      const namaKelDesa = String(payload.namaKelDesa || '').trim();
      const namaDpr = String(payload.namaDpr || ('DPR ' + namaKelDesa)).trim();
      if (!kodeWilayah || !namaKelDesa) {
        return jsonOut_({ ok: false, error: 'Kode wilayah dan nama Kelurahan/Desa wajib diisi.' });
      }

      const existing = findRowInSs_(wSs, WILAYAH_SHEETS.DPR, 'Kode_Wilayah', kodeWilayah)
        || (payload.id ? findRowInSs_(wSs, WILAYAH_SHEETS.DPR, 'ID_DPR', payload.id) : null);
      const idDpr = buildLembagaId_('dpr', kodeWilayah);
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const segs = kodeWilayah.split('.');
      const kodeKec = String(payload.kodeKecamatan || segs.slice(0, 3).join('.') || '').trim();
      const kodeKab = String(payload.kodeKabKota || segs.slice(0, 2).join('.') || '').trim();
      const kodeProv = String(payload.kodeProvinsi || segs[0] || '').trim();
      const ketuaNamaUp = String(payload.ketuaNama || '').trim().toUpperCase();
      const sekNamaUp = String(payload.sekretarisNama || '').trim().toUpperCase();

      const rowObj = role === 'admin'
        ? {
            ID_DPR: idDpr,
            Kode_Wilayah: existing ? String(existing.Kode_Wilayah) : kodeWilayah,
            Kode_Kecamatan: existing ? String(existing.Kode_Kecamatan) : kodeKec,
            Kode_KabKota: existing ? String(existing.Kode_KabKota) : kodeKab,
            Kode_Provinsi: existing ? String(existing.Kode_Provinsi) : kodeProv,
            Pulau: existing ? String(existing.Pulau) : String(payload.pulau || '').trim(),
            Nama_Provinsi: existing ? String(existing.Nama_Provinsi) : String(payload.namaProvinsi || '').trim(),
            Nama_KabKota: existing ? String(existing.Nama_KabKota) : String(payload.namaKabKota || '').trim(),
            Nama_Kecamatan: existing ? String(existing.Nama_Kecamatan) : String(payload.namaKecamatan || '').trim(),
            Nama_KelDesa: existing ? String(existing.Nama_KelDesa) : namaKelDesa,
            Nama_DPR: existing ? String(existing.Nama_DPR) : namaDpr,
            Status_Terbentuk: existing ? String(existing.Status_Terbentuk || 'Belum Terbentuk') : 'Belum Terbentuk',
            Ketua_Nama: ketuaNamaUp,
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: sekNamaUp,
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Diperbarui_Pada: nowStr
          }
        : {
            ID_DPR: idDpr,
            Kode_Wilayah: kodeWilayah,
            Kode_Kecamatan: kodeKec,
            Kode_KabKota: kodeKab,
            Kode_Provinsi: kodeProv,
            Pulau: String(payload.pulau || '').trim(),
            Nama_Provinsi: String(payload.namaProvinsi || '').trim(),
            Nama_KabKota: String(payload.namaKabKota || '').trim(),
            Nama_Kecamatan: String(payload.namaKecamatan || '').trim(),
            Nama_KelDesa: namaKelDesa,
            Nama_DPR: namaDpr,
            Status_Terbentuk: String(payload.statusTerbentuk || 'Sudah Terbentuk').trim(),
            Ketua_Nama: ketuaNamaUp,
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: sekNamaUp,
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Diperbarui_Pada: nowStr
          };

      const updated = existing
        ? (updateRowByIdInSs_(wSs, WILAYAH_SHEETS.DPR, 'Kode_Wilayah', kodeWilayah, rowObj)
          || (existing.ID_DPR ? updateRowByIdInSs_(wSs, WILAYAH_SHEETS.DPR, 'ID_DPR', String(existing.ID_DPR), rowObj) : false))
        : false;
      if (!updated) {
        appendRowInSs_(wSs, WILAYAH_SHEETS.DPR, rowObj);
      }

      writeLog_(role.toUpperCase(), existing ? 'updateDpr' : 'createDpr', idDpr + ' — ' + rowObj.Nama_DPR);
      return jsonOut_({ ok: true, data: mapDprRow_(rowObj) });
    }

    if (action === 'deleteDpr') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID DPR wajib diisi.' });
      const wSs = getWilayahSpreadsheetOrThrow_();
      const deleted = deleteRowByIdInSs_(wSs, WILAYAH_SHEETS.DPR, 'ID_DPR', id);
      writeLog_('SUPERADMIN', 'deleteDpr', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Data DPR tidak ditemukan.' });
    }

    if (action === 'updateSettings') {
      if (payload.namaAplikasi !== undefined) {
        upsertSetting_('NAMA_APLIKASI', String(payload.namaAplikasi).trim() || 'DUWD DPP WI');
      }
      if (payload.logoDataUrl !== undefined) {
        upsertSetting_('LOGO_DATA_URL', String(payload.logoDataUrl));
      }
      if (payload.rpkaDriveUrl !== undefined) {
        upsertSetting_('RPKA_DRIVE_URL', String(payload.rpkaDriveUrl).trim());
      }
      if (payload.wilayahSpreadsheetId !== undefined) {
        const cleanWilayahId = extractSpreadsheetId_(payload.wilayahSpreadsheetId);
        upsertSetting_('WILAYAH_SPREADSHEET_ID', cleanWilayahId);
        if (cleanWilayahId) {
          const wSs = SpreadsheetApp.openById(cleanWilayahId);
          setupWilayahDatabase_(wSs);
        }
      }
      if (payload.adminPin && String(payload.adminPin).trim().length >= 4) {
        upsertSetting_('ADMIN_PIN', String(payload.adminPin).trim());
      }
      if (payload.superAdminPin && String(payload.superAdminPin).trim().length >= 4) {
        upsertSetting_('SUPERADMIN_PIN', String(payload.superAdminPin).trim());
      }
      writeLog_('SUPERADMIN', 'updateSettings', 'Pengaturan aplikasi diperbarui');
      return jsonOut_({ ok: true, message: 'Pengaturan berhasil disimpan ke sheet PENGATURAN.' });
    }

    // =========================================================================
    // BROADCAST (WHATSAPP RECHAT & EMAIL ALIAS) + DATA PRIVAT PENGURUS
    // =========================================================================

    if (action === 'getPrivatePengurusAndBroadcast') {
      const ss = getSpreadsheet_();
      ensurePengurusPendataanColumns_(ss);
      ensureBroadcastSheets_(ss);

      const pengurusFull = readRows_(SHEETS.PENGURUS).map(function (p) {
        const emailVal = String(p.Email || '').trim();
        const rekVal = String(p.Nomor_Rekening || '').replace(/[^\d]/g, '');
        return {
          id: String(p.ID_Pengurus || ''),
          namaLengkap: String(p.Nama_Lengkap || ''),
          namaPanggilan: String(p.Nama_Panggilan || ''),
          whatsapp: normalizeWaNumber_(p.WhatsApp || ''),
          unitId: String(p.ID_Unit || ''),
          namaUnit: String(p.Nama_Unit || ''),
          amanah: String(p.Amanah || ''),
          email: emailVal,
          namaBank: String(p.Nama_Bank || '').trim(),
          nomorRekening: rekVal,
          namaPemilikRekening: String(p.Nama_Pemilik_Rekening || '').trim(),
          pendataanDiperbaruiPada: String(p.Pendataan_Diperbarui_Pada || ''),
          sudahPendataan: Boolean(emailVal && rekVal),
          dibuatPada: String(p.Dibuat_Pada || ''),
          diperbaruiPada: String(p.Diperbarui_Pada || '')
        };
      });

      const waGroups = readRowsOptional_(SHEETS.GRUP_WA).map(mapWaGroupRow_);
      const broadcastQueue = readRowsOptional_(SHEETS.BROADCAST_QUEUE)
        .map(mapBroadcastRow_)
        .sort(function (a, b) {
          return String(b.dibuatPada || '').localeCompare(String(a.dibuatPada || ''));
        });

      return jsonOut_({
        ok: true,
        data: {
          pengurus: pengurusFull,
          waGroups: waGroups,
          broadcastQueue: broadcastQueue,
          broadcastConfig: getBroadcastConfigStatus_()
        }
      });
    }

    if (action === 'saveBroadcastConfig') {
      const props = PropertiesService.getScriptProperties();
      if (payload.clearRechatApiKey) {
        props.deleteProperty('RECHAT_API_KEY');
      } else if (payload.rechatApiKey !== undefined && String(payload.rechatApiKey).trim()) {
        const cleanKey = extractRechatKey_(payload.rechatApiKey);
        if (!cleanKey) {
          return jsonOut_({ ok: false, error: 'API Key ReChat tidak valid.' });
        }
        props.setProperty('RECHAT_API_KEY', cleanKey);
      }

      if (payload.rechatApiUrl !== undefined) {
        const cleanUrl = sanitizeRechatApiUrl_(payload.rechatApiUrl);
        upsertSetting_('RECHAT_API_URL', cleanUrl);
      }
      if (payload.emailAlias !== undefined) {
        const cleanAlias = String(payload.emailAlias || '').trim().toLowerCase() || DEFAULT_EMAIL_ALIAS;
        upsertSetting_('EMAIL_ALIAS_PENGIRIM', cleanAlias);
      }
      if (payload.emailSenderName !== undefined) {
        const cleanSender = String(payload.emailSenderName || '').trim() || DEFAULT_EMAIL_SENDER_NAME;
        upsertSetting_('EMAIL_NAMA_PENGIRIM', cleanSender);
      }

      writeLog_('SUPERADMIN', 'saveBroadcastConfig', 'Konfigurasi ReChat WA & Alias Email diperbarui.');
      return jsonOut_({
        ok: true,
        message: 'Konfigurasi Broadcast tersimpan aman di Google Apps Script.',
        data: getBroadcastConfigStatus_()
      });
    }

    if (action === 'installBroadcastTrigger') {
      const msg = pasangTriggerBroadcast_internal_();
      writeLog_(role.toUpperCase(), 'installBroadcastTrigger', msg);
      return jsonOut_({
        ok: true,
        message: msg,
        data: { triggerActive: hasBroadcastTrigger_() }
      });
    }

    if (action === 'saveWaGroup') {
      const namaGrup = String(payload.namaGrup || '').trim();
      const groupId = String(payload.groupId || '').trim();
      const keterangan = String(payload.keterangan || '').trim();
      if (!namaGrup || !groupId) {
        return jsonOut_({ ok: false, error: 'Nama grup dan ID grup WhatsApp (xxxx@g.us) wajib diisi.' });
      }
      const ss = getSpreadsheet_();
      ensureBroadcastSheets_(ss);
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const isEdit = Boolean(payload.id);
      const idGrup = isEdit ? String(payload.id).trim() : generateId_('GRP');
      const rowObj = {
        ID_Grup: idGrup,
        Nama_Grup: namaGrup,
        Group_ID_WA: groupId,
        Keterangan: keterangan,
        Dibuat_Pada: isEdit ? String(payload.dibuatPada || nowStr) : nowStr,
        Diperbarui_Pada: nowStr
      };
      const updated = isEdit ? updateRowByIdInSs_(ss, SHEETS.GRUP_WA, 'ID_Grup', idGrup, rowObj) : false;
      if (!updated) {
        appendRowInSs_(ss, SHEETS.GRUP_WA, rowObj);
      }
      writeLog_(role.toUpperCase(), isEdit ? 'updateWaGroup' : 'createWaGroup', namaGrup + ' (' + groupId + ')');
      return jsonOut_({ ok: true, data: mapWaGroupRow_(rowObj) });
    }

    if (action === 'deleteWaGroup') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID grup wajib diisi.' });
      const ss = getSpreadsheet_();
      const deleted = deleteRowByIdInSs_(ss, SHEETS.GRUP_WA, 'ID_Grup', id);
      writeLog_(role.toUpperCase(), 'deleteWaGroup', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Grup WhatsApp tidak ditemukan.' });
    }

    if (action === 'uploadBroadcastImage') {
      // Tetap dipertahankan untuk kompatibilitas, menggunakan file sementara yang akan otomatis dihapus setelah kirim
      const fileName = sanitizeDriveFileName_(payload.fileName || 'Broadcast_Foto.jpg');
      const mimeType = String(payload.mimeType || 'image/jpeg').trim();
      const base64Data = String(payload.base64Data || '').trim();
      if (!base64Data) {
        return jsonOut_({ ok: false, error: 'Data gambar kosong.' });
      }
      if (!/\.(jpg|jpeg|png|webp)$/i.test(fileName.toLowerCase())) {
        return jsonOut_({ ok: false, error: 'Lampiran foto harus berformat JPG, PNG, atau WebP.' });
      }
      const tempMedia = createTempBroadcastMedia_(base64Data, mimeType, fileName, true);
      writeLog_(role.toUpperCase(), 'uploadBroadcastImage', 'Media sementara dibuat: ' + fileName);
      return jsonOut_({
        ok: true,
        data: {
          fileId: tempMedia.fileId,
          fileName: tempMedia.fileName,
          imageUrl: tempMedia.imageUrl,
          driveUrl: ''
        }
      });
    }

    if (action === 'sendOrScheduleBroadcast') {
      const judul = String(payload.judul || '').trim() || 'Broadcast DUWD DPP WI';
      const channel = String(payload.channel || 'wa').trim().toLowerCase();
      if (channel !== 'wa' && channel !== 'email' && channel !== 'both') {
        return jsonOut_({ ok: false, error: 'Kanal broadcast tidak valid.' });
      }
      const targetPengurusIds = Array.isArray(payload.targetPengurusIds)
        ? payload.targetPengurusIds.map(function (x) { return String(x).trim(); }).filter(Boolean)
        : [];
      const targetGroupIds = Array.isArray(payload.targetGroupIds)
        ? payload.targetGroupIds.map(function (x) { return String(x).trim(); }).filter(Boolean)
        : [];
      const pesanWa = String(payload.pesanWa || '').trim();
      const emailSubject = String(payload.emailSubject || judul).trim();
      const emailBody = String(payload.emailBody || pesanWa).trim();
      const imageBase64 = String(payload.imageBase64 || '').trim();
      const imageMimeType = String(payload.imageMimeType || 'image/jpeg').trim();
      let imageDriveFileId = String(payload.imageDriveFileId || '').trim();
      let imageUrl = String(payload.imageUrl || '').trim();
      let imageName = String(payload.imageName || '').trim();
      const modeKirim = String(payload.modeKirim || 'segera').trim().toLowerCase() === 'terjadwal' ? 'terjadwal' : 'segera';
      const jadwalKirim = String(payload.jadwalKirim || '').trim();
      const rawDelay = Number(payload.delayDetik);
      const delayDetik = isNaN(rawDelay) ? 5 : Math.min(300, Math.max(0, Math.round(rawDelay)));
      const hasPhoto = Boolean(imageBase64 || imageUrl || imageDriveFileId);

      if (targetPengurusIds.length === 0 && targetGroupIds.length === 0) {
        return jsonOut_({ ok: false, error: 'Pilih minimal 1 target pengurus atau grup WhatsApp.' });
      }
      if ((channel === 'wa' || channel === 'both') && !pesanWa && !hasPhoto) {
        return jsonOut_({ ok: false, error: 'Isi pesan WhatsApp atau lampirkan foto terlebih dahulu.' });
      }
      if ((channel === 'email' || channel === 'both') && (!emailSubject || (!emailBody && !hasPhoto))) {
        return jsonOut_({ ok: false, error: 'Subjek dan isi email wajib diisi.' });
      }
      if (modeKirim === 'terjadwal' && !/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(jadwalKirim)) {
        return jsonOut_({ ok: false, error: 'Format jadwal pengiriman tidak valid (gunakan tanggal & jam).' });
      }

      const ss = getSpreadsheet_();
      ensurePengurusPendataanColumns_(ss);
      ensureBroadcastSheets_(ss);

      // Hitung perkiraan jumlah pesan untuk menentukan apakah foto bisa langsung di memori (tanpa file sementara)
      const estDispatchCount =
        ((channel === 'wa' || channel === 'both') ? (targetPengurusIds.length + targetGroupIds.length) : 0) +
        ((channel === 'email' || channel === 'both') ? targetPengurusIds.length : 0);
      const estDurationSec = estDispatchCount > 1 ? (estDispatchCount - 1) * delayDetik : 0;

      // Foto tidak disimpan permanen di Google Drive:
      // - Untuk Email saja (kirim segera & selesai dalam 1 siklus): langsung Blob di memori (0 sentuhan Drive).
      // - Untuk WA (ReChat membutuhkan URL gambar publik sementara) atau jadwal/antrean panjang:
      //   buat file sementara di luar folder Dokumen dan hapus otomatis segera setelah selesai terkirim.
      let inlineBlob = null;
      if (imageBase64) {
        const cleanFileName = sanitizeDriveFileName_(imageName || 'Lampiran_Broadcast.jpg');
        imageName = cleanFileName;
        const needTempFile =
          modeKirim === 'terjadwal' ||
          channel === 'wa' ||
          channel === 'both' ||
          estDurationSec > 38;

        if (needTempFile) {
          const tempMedia = createTempBroadcastMedia_(
            imageBase64,
            imageMimeType,
            cleanFileName,
            channel === 'wa' || channel === 'both'
          );
          imageDriveFileId = tempMedia.fileId;
          imageUrl = tempMedia.imageUrl;
        } else {
          const bytes = Utilities.base64Decode(imageBase64);
          inlineBlob = Utilities.newBlob(bytes, imageMimeType, cleanFileName);
        }
      }

      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const bcId = generateId_('BRC');
      const normalizedJadwal = modeKirim === 'terjadwal' ? jadwalKirim.replace('T', ' ').slice(0, 16) : '';

      const rowObj = {
        ID_Broadcast: bcId,
        Judul: judul,
        Channel: channel,
        Target_Summary: String(payload.targetSummary || '').trim() || (targetPengurusIds.length + ' Pengurus, ' + targetGroupIds.length + ' Grup'),
        Target_Pengurus_IDs: targetPengurusIds.join(','),
        Target_Group_IDs: targetGroupIds.join(','),
        Pesan_WA: pesanWa,
        Email_Subject: emailSubject,
        Email_Body: emailBody,
        Image_Drive_File_ID: imageDriveFileId,
        Image_URL: imageUrl,
        Image_Name: imageName,
        Mode_Kirim: modeKirim,
        Jadwal_Kirim: normalizedJadwal,
        Delay_Detik: delayDetik,
        Progress_Json: '',
        Status: modeKirim === 'terjadwal' ? 'Terjadwal' : 'Diproses',
        Total_Target: estDispatchCount,
        Total_Terkirim: 0,
        Total_Gagal: 0,
        Log_Hasil: modeKirim === 'terjadwal'
          ? ('Dijadwalkan pada ' + normalizedJadwal + ' WITA (jeda ' + delayDetik + ' detik/pesan)')
          : '',
        Dibuat_Oleh: role === 'superadmin' ? 'Super Admin' : 'Admin',
        Dibuat_Pada: nowStr,
        Dikirim_Pada: ''
      };

      appendRowInSs_(ss, SHEETS.BROADCAST_QUEUE, rowObj);

      if (modeKirim === 'terjadwal') {
        try {
          if (!hasBroadcastTrigger_()) {
            pasangTriggerBroadcast_internal_();
          }
        } catch (ignore) {}
        writeLog_(role.toUpperCase(), 'scheduleBroadcast', bcId + ' — ' + judul + ' @ ' + normalizedJadwal + ' WITA (jeda ' + delayDetik + 's)');
        return jsonOut_({
          ok: true,
          message: 'Broadcast berhasil dijadwalkan pada ' + normalizedJadwal + ' WITA dengan jeda ' + delayDetik + ' detik antar pesan.',
          data: mapBroadcastRow_(rowObj)
        });
      }

      // Kirim segera: anggaran eksekusi interaktif 45 detik agar respons UI cepat;
      // jika masih ada sisa antrean (mis. jeda 60 detik x banyak target), otomatis dilanjutkan trigger latar belakang.
      const finalRow = executeBroadcastRow_(ss, rowObj, {
        maxRuntimeMs: 45000,
        inlineBlob: inlineBlob
      });

      const statusMsg = finalRow.Status === 'Diproses'
        ? ('Pengiriman berjalan: ' + finalRow.Total_Terkirim + '/' + finalRow.Total_Target + ' pesan terkirim. Sisa antrean dilanjutkan otomatis setiap ' + delayDetik + ' detik di latar belakang.')
        : ('Broadcast selesai diproses: ' + finalRow.Status + ' (' + finalRow.Total_Terkirim + ' terkirim, ' + finalRow.Total_Gagal + ' gagal).');

      writeLog_(role.toUpperCase(), 'sendBroadcast', bcId + ' — ' + finalRow.Status + ' (' + finalRow.Total_Terkirim + '/' + finalRow.Total_Target + ', jeda ' + delayDetik + 's)');
      return jsonOut_({
        ok: true,
        message: statusMsg,
        data: mapBroadcastRow_(finalRow)
      });
    }

    if (action === 'cancelScheduledBroadcast') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID broadcast wajib diisi.' });
      const ss = getSpreadsheet_();
      ensureBroadcastSheets_(ss);
      const existing = findRowInSs_(ss, SHEETS.BROADCAST_QUEUE, 'ID_Broadcast', id);
      if (!existing) return jsonOut_({ ok: false, error: 'Data broadcast tidak ditemukan.' });
      const st = String(existing.Status || '').trim();
      if (st !== 'Terjadwal' && st !== 'Diproses') {
        return jsonOut_({ ok: false, error: 'Hanya broadcast berstatus Terjadwal atau Diproses yang dapat dibatalkan.' });
      }
      if (existing.Image_Drive_File_ID) {
        trashTempBroadcastFileNow_(String(existing.Image_Drive_File_ID).trim());
      }
      const patch = {
        Status: 'Dibatalkan',
        Progress_Json: '',
        Image_Drive_File_ID: '',
        Image_URL: '',
        Log_Hasil: (existing.Log_Hasil ? String(existing.Log_Hasil) + ' | ' : '') + 'Dibatalkan oleh ' + (role === 'superadmin' ? 'Super Admin' : 'Admin')
      };
      updateRowByIdInSs_(ss, SHEETS.BROADCAST_QUEUE, 'ID_Broadcast', id, patch);
      syncContinuationTriggerState_(ss);
      const updated = Object.assign({}, existing, patch);
      writeLog_(role.toUpperCase(), 'cancelScheduledBroadcast', id);
      return jsonOut_({ ok: true, data: mapBroadcastRow_(updated) });
    }

    if (action === 'deleteBroadcastItem') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID broadcast wajib diisi.' });
      const ss = getSpreadsheet_();
      const existing = findRowInSs_(ss, SHEETS.BROADCAST_QUEUE, 'ID_Broadcast', id);
      if (existing && existing.Image_Drive_File_ID) {
        trashTempBroadcastFileNow_(String(existing.Image_Drive_File_ID).trim());
      }
      const deleted = deleteRowByIdInSs_(ss, SHEETS.BROADCAST_QUEUE, 'ID_Broadcast', id);
      syncContinuationTriggerState_(ss);
      writeLog_(role.toUpperCase(), 'deleteBroadcastItem', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Riwayat broadcast tidak ditemukan.' });
    }

    if (action === 'runDueBroadcastsNow') {
      const count = prosesJadwalBroadcast();
      return jsonOut_({
        ok: true,
        message: count > 0
          ? (count + ' antrean broadcast berhasil diproses/dilanjutkan.')
          : 'Tidak ada jadwal atau antrean broadcast yang perlu diproses saat ini.',
        data: { processed: count }
      });
    }

    return jsonOut_({ ok: false, error: 'Action POST tidak dikenali: ' + action });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}

/* =========================== HELPERS =========================== */

function normalizeWaNumber_(raw) {
  let digits = String(raw || '').replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.indexOf('08') === 0) {
    digits = '62' + digits.substring(1);
  } else if (digits.indexOf('0') === 0) {
    digits = '62' + digits.substring(1);
  } else if (digits.indexOf('8') === 0) {
    digits = '62' + digits;
  }
  return digits;
}

function mapKodeWilayahRow_(r) {
  const kode = String(r.Kode_Wilayah || r.Kode || '').trim();
  const segments = kode ? kode.split('.').filter(Boolean) : [];
  let tingkat = String(r.Tingkat || '').trim();
  if (!tingkat) {
    if (segments.length <= 1 && kode.indexOf('P-') === 0) tingkat = 'Pulau';
    else if (segments.length === 1) tingkat = 'Provinsi';
    else if (segments.length === 2) tingkat = 'KabKota';
    else if (segments.length === 3) tingkat = 'Kecamatan';
    else if (segments.length >= 4) tingkat = 'KelDesa';
    else tingkat = 'Provinsi';
  }
  const kodeProv = String(r.Kode_Provinsi || (segments[0] || '')).trim();
  const kodeKab = String(r.Kode_KabKota || (segments.length >= 2 ? segments.slice(0, 2).join('.') : '')).trim();
  const kodeKec = String(r.Kode_Kecamatan || (segments.length >= 3 ? segments.slice(0, 3).join('.') : '')).trim();
  const parentKode = String(r.Parent_Kode || (segments.length > 1 ? segments.slice(0, segments.length - 1).join('.') : '')).trim();

  return {
    kodeWilayah: kode,
    tingkat: tingkat,
    pulau: String(r.Pulau || '').trim(),
    kodeProvinsi: kodeProv,
    namaProvinsi: String(r.Nama_Provinsi || r.Provinsi || '').trim(),
    kodeKabKota: kodeKab,
    namaKabKota: String(r.Nama_KabKota || r.KabKota || '').trim(),
    kodeKecamatan: kodeKec,
    namaKecamatan: String(r.Nama_Kecamatan || r.Kecamatan || '').trim(),
    namaKelDesa: String(r.Nama_KelDesa || r.KelDesa || '').trim(),
    parentKode: parentKode
  };
}

function compareKodeWilayah_(a, b) {
  return String(a.kodeWilayah || '').localeCompare(String(b.kodeWilayah || ''), 'id', { numeric: true });
}

function getSettingsMap_() {
  const rows = readRows_(SHEETS.PENGATURAN);
  const map = {};
  rows.forEach(function (r) {
    const key = String(r.Kunci || '').trim();
    if (key) map[key] = String(r.Nilai || '');
  });
  return map;
}

function resolveRoleByPin_(inputPin) {
  const cleanPin = String(inputPin || '').trim();
  if (!cleanPin) return '';
  const map = getSettingsMap_();
  const superPin = map.SUPERADMIN_PIN || 'duwd-super-2026';
  const adminPin = map.ADMIN_PIN || 'duwd-admin-2026';
  if (cleanPin === superPin) return 'superadmin';
  if (cleanPin === adminPin) return 'admin';
  return '';
}

function getUnitById_(unitId) {
  const units = readRows_(SHEETS.UNIT);
  for (let i = 0; i < units.length; i++) {
    if (String(units[i].ID_Unit).trim() === String(unitId).trim()) {
      return units[i];
    }
  }
  return null;
}

function cascadeUnitNameToPengurus_(unitId, newUnitName) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEETS.PENGURUS);
  if (!sheet || sheet.getLastRow() <= 1) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function (h) { return String(h).trim(); });
  const idUnitIdx = headers.indexOf('ID_Unit');
  const namaUnitIdx = headers.indexOf('Nama_Unit');
  if (idUnitIdx === -1 || namaUnitIdx === -1) return;

  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idUnitIdx]).trim() === String(unitId).trim()) {
      sheet.getRange(r + 1, namaUnitIdx + 1).setValue(newUnitName);
    }
  }
}

function ensureSettingKey_(key, defaultValue, desc) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEETS.PENGATURAN);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      if (String(keys[i][0]).trim() === key) return;
    }
  }
  sheet.appendRow([key, defaultValue, desc || '']);
}

function upsertSetting_(key, value) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(SHEETS.PENGATURAN);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const data = sheet.getRange(1, 1, lastRow, 3).getValues();
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][0]).trim() === key) {
        sheet.getRange(r + 1, 2).setValue(value);
        return;
      }
    }
  }
  sheet.appendRow([key, value, 'Diperbarui dari web']);
}

function readRows_(sheetName) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Tab "' + sheetName + '" tidak ditemukan. Jalankan setupDatabase() terlebih dahulu.');
  }
  return readSheetObjects_(sheet);
}

function readSheetObjects_(sheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });
  const rows = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.every(function (cell) { return cell === '' || cell === null || cell === undefined; })) {
      continue;
    }
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = row[c];
    }
    rows.push(obj);
  }
  return rows;
}

function appendRowInSs_(ss, sheetName, rowObj) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ss.getSheetByName(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (h) {
      return String(h).trim();
    });
    const arr = headers.map(function (h) {
      return rowObj.hasOwnProperty(h) ? rowObj[h] : '';
    });
    sheet.appendRow(arr);
  } finally {
    lock.releaseLock();
  }
}

function updateRowByIdInSs_(ss, sheetName, idCol, idVal, rowObj) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) return false;
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(function (h) { return String(h).trim(); });
    const idIdx = headers.indexOf(idCol);
    if (idIdx === -1) return false;

    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idIdx]).trim() === String(idVal).trim()) {
        const updated = headers.map(function (h, c) {
          return rowObj.hasOwnProperty(h) ? rowObj[h] : data[r][c];
        });
        sheet.getRange(r + 1, 1, 1, headers.length).setValues([updated]);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

function mapDpwRow_(r) {
  return {
    id: String(r.ID_DPW || ''),
    kodeWilayah: String(r.Kode_Wilayah || ''),
    pulau: String(r.Pulau || ''),
    namaDpw: String(r.Nama_DPW || ''),
    namaProvinsi: String(r.Nama_Provinsi || ''),
    statusTerbentuk: String(r.Status_Terbentuk || 'Sudah Terbentuk'),
    ketuaNama: String(r.Ketua_Nama || ''),
    ketuaWa: normalizeWaNumber_(r.Ketua_WA || ''),
    sekretarisNama: String(r.Sekretaris_Nama || ''),
    sekretarisWa: normalizeWaNumber_(r.Sekretaris_WA || ''),
    alamatKantor: String(r.Alamat_Kantor || ''),
    tautanDrive: String(r.Tautan_Drive || ''),
    diperbaruiPada: String(r.Diperbarui_Pada || '')
  };
}

function mapDpdRow_(r) {
  return {
    id: String(r.ID_DPD || ''),
    kodeWilayah: String(r.Kode_Wilayah || ''),
    kodeProvinsi: String(r.Kode_Provinsi || ''),
    pulau: String(r.Pulau || ''),
    namaProvinsi: String(r.Nama_Provinsi || ''),
    namaDpd: String(r.Nama_DPD || ''),
    namaKabKota: String(r.Nama_KabKota || ''),
    statusTerbentuk: String(r.Status_Terbentuk || 'Sudah Terbentuk'),
    ketuaNama: String(r.Ketua_Nama || ''),
    ketuaWa: normalizeWaNumber_(r.Ketua_WA || ''),
    sekretarisNama: String(r.Sekretaris_Nama || ''),
    sekretarisWa: normalizeWaNumber_(r.Sekretaris_WA || ''),
    alamatKantor: String(r.Alamat_Kantor || ''),
    tautanDrive: String(r.Tautan_Drive || ''),
    diperbaruiPada: String(r.Diperbarui_Pada || '')
  };
}

function mapDpcRow_(r) {
  return {
    id: String(r.ID_DPC || ''),
    kodeWilayah: String(r.Kode_Wilayah || ''),
    kodeKabKota: String(r.Kode_KabKota || ''),
    kodeProvinsi: String(r.Kode_Provinsi || ''),
    pulau: String(r.Pulau || ''),
    namaProvinsi: String(r.Nama_Provinsi || ''),
    namaKabKota: String(r.Nama_KabKota || ''),
    namaKecamatan: String(r.Nama_Kecamatan || ''),
    namaDpc: String(r.Nama_DPC || ''),
    statusTerbentuk: String(r.Status_Terbentuk || 'Sudah Terbentuk'),
    ketuaNama: String(r.Ketua_Nama || ''),
    ketuaWa: normalizeWaNumber_(r.Ketua_WA || ''),
    sekretarisNama: String(r.Sekretaris_Nama || ''),
    sekretarisWa: normalizeWaNumber_(r.Sekretaris_WA || ''),
    alamatKantor: String(r.Alamat_Kantor || ''),
    tautanDrive: String(r.Tautan_Drive || ''),
    diperbaruiPada: String(r.Diperbarui_Pada || '')
  };
}

function mapDprRow_(r) {
  return {
    id: String(r.ID_DPR || ''),
    kodeWilayah: String(r.Kode_Wilayah || ''),
    kodeKecamatan: String(r.Kode_Kecamatan || ''),
    kodeKabKota: String(r.Kode_KabKota || ''),
    kodeProvinsi: String(r.Kode_Provinsi || ''),
    pulau: String(r.Pulau || ''),
    namaProvinsi: String(r.Nama_Provinsi || ''),
    namaKabKota: String(r.Nama_KabKota || ''),
    namaKecamatan: String(r.Nama_Kecamatan || ''),
    namaKelDesa: String(r.Nama_KelDesa || ''),
    namaDpr: String(r.Nama_DPR || ''),
    statusTerbentuk: String(r.Status_Terbentuk || 'Sudah Terbentuk'),
    ketuaNama: String(r.Ketua_Nama || ''),
    ketuaWa: normalizeWaNumber_(r.Ketua_WA || ''),
    sekretarisNama: String(r.Sekretaris_Nama || ''),
    sekretarisWa: normalizeWaNumber_(r.Sekretaris_WA || ''),
    alamatKantor: String(r.Alamat_Kantor || ''),
    tautanDrive: String(r.Tautan_Drive || ''),
    diperbaruiPada: String(r.Diperbarui_Pada || '')
  };
}

function findRowInSs_(ss, sheetName, colName, targetVal) {
  if (!targetVal) return null;
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() <= 1) return null;
  const rows = readSheetObjects_(sheet);
  const needle = String(targetVal).trim();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][colName] || '').trim() === needle) {
      return rows[i];
    }
  }
  return null;
}

function deleteRowByIdInSs_(ss, sheetName, idCol, idVal) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) return false;
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(function (h) { return String(h).trim(); });
    const idIdx = headers.indexOf(idCol);
    if (idIdx === -1) return false;

    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idIdx]).trim() === String(idVal).trim()) {
        sheet.deleteRow(r + 1);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

function writeLog_(role, action, detail) {
  try {
    appendRowInSs_(getSpreadsheet_(), SHEETS.LOGS, {
      Timestamp: Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss'),
      Role: role,
      Aksi: action,
      Detail: detail || ''
    });
  } catch (ignore) {}
}

function buildLembagaId_(prefix, kodeWilayah) {
  const cleanKode = String(kodeWilayah || '').replace(/[^0-9a-zA-Z]/g, '');
  if (!cleanKode) return generateId_(String(prefix || 'LMB').toUpperCase());
  return String(prefix || 'lmb').toLowerCase() + '-' + cleanKode;
}

function generateId_(prefix) {
  return prefix + '-' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyMMdd') + '-' + Math.floor(1000 + Math.random() * 9000);
}

function ensureHeaderColumns_(sheet, requiredHeaders) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return;
  const existing = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim();
  });
  requiredHeaders.forEach(function (header) {
    if (existing.indexOf(header) === -1) {
      const nextCol = sheet.getLastColumn() + 1;
      sheet.getRange(1, nextCol)
        .setValue(header)
        .setFontWeight('bold')
        .setBackground('#07525E')
        .setFontColor('#FFFFFF');
    }
  });
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getStarterUnitRows_() {
  return [
    ['UNIT-00', 'PI', 'Pengurus Inti', 0, 'Ya'],
    ['UNIT-01', 'EKSPANSI', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 1, 'Ya'],
    ['UNIT-02', 'KELEMBAGAAN', 'PENINGKATAN KUALITAS KELEMBAGAAN DPW DPD', 2, 'Ya'],
    ['UNIT-03', 'KEPENGURUSAN', 'PENINGKATAN KUALITAS PENGURUS DPW DAN DPD', 3, 'Ya'],
    ['UNIT-04', 'MONEV', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 4, 'Ya'],
    ['UNIT-05', 'INOVASI', 'PENINGKATAN KINERJA, MUTU, DAN INOVASI INTERNAL', 5, 'Ya']
  ];
}

function getStarterProkerRows_() {
  return [
    ['10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', '2027', 'EKSPANSI'],
    ['10002', 'PENINGKATAN KUALITAS KELEMBAGAAN DPW DPD', '2027', 'KELEMBAGAAN'],
    ['10003', 'PENINGKATAN KUALITAS PENGURUS DPW DAN DPD', '2027', 'KEPENGURUSAN'],
    ['10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', '2027', 'MONEV'],
    ['10005', 'PENINGKATAN KINERJA, MUTU, DAN INOVASI INTERNAL', '2027', 'INOVASI']
  ];
}

function getStarterProvinceRows_() {
  return [
    ['11', 'Provinsi', 'Sumatera', '11', 'Aceh', '', '', '', '', '', ''],
    ['12', 'Provinsi', 'Sumatera', '12', 'Sumatera Utara', '', '', '', '', '', ''],
    ['13', 'Provinsi', 'Sumatera', '13', 'Sumatera Barat', '', '', '', '', '', ''],
    ['14', 'Provinsi', 'Sumatera', '14', 'Riau', '', '', '', '', '', ''],
    ['15', 'Provinsi', 'Sumatera', '15', 'Jambi', '', '', '', '', '', ''],
    ['16', 'Provinsi', 'Sumatera', '16', 'Sumatera Selatan', '', '', '', '', '', ''],
    ['17', 'Provinsi', 'Sumatera', '17', 'Bengkulu', '', '', '', '', '', ''],
    ['18', 'Provinsi', 'Sumatera', '18', 'Lampung', '', '', '', '', '', ''],
    ['19', 'Provinsi', 'Sumatera', '19', 'Kepulauan Bangka Belitung', '', '', '', '', '', ''],
    ['21', 'Provinsi', 'Sumatera', '21', 'Kepulauan Riau', '', '', '', '', '', ''],
    ['31', 'Provinsi', 'Jawa', '31', 'DKI Jakarta', '', '', '', '', '', ''],
    ['32', 'Provinsi', 'Jawa', '32', 'Jawa Barat', '', '', '', '', '', ''],
    ['33', 'Provinsi', 'Jawa', '33', 'Jawa Tengah', '', '', '', '', '', ''],
    ['34', 'Provinsi', 'Jawa', '34', 'DI Yogyakarta', '', '', '', '', '', ''],
    ['35', 'Provinsi', 'Jawa', '35', 'Jawa Timur', '', '', '', '', '', ''],
    ['36', 'Provinsi', 'Jawa', '36', 'Banten', '', '', '', '', '', ''],
    ['51', 'Provinsi', 'Bali & Nusa Tenggara', '51', 'Bali', '', '', '', '', '', ''],
    ['52', 'Provinsi', 'Bali & Nusa Tenggara', '52', 'Nusa Tenggara Barat', '', '', '', '', '', ''],
    ['53', 'Provinsi', 'Bali & Nusa Tenggara', '53', 'Nusa Tenggara Timur', '', '', '', '', '', ''],
    ['61', 'Provinsi', 'Kalimantan', '61', 'Kalimantan Barat', '', '', '', '', '', ''],
    ['62', 'Provinsi', 'Kalimantan', '62', 'Kalimantan Tengah', '', '', '', '', '', ''],
    ['63', 'Provinsi', 'Kalimantan', '63', 'Kalimantan Selatan', '', '', '', '', '', ''],
    ['64', 'Provinsi', 'Kalimantan', '64', 'Kalimantan Timur', '', '', '', '', '', ''],
    ['65', 'Provinsi', 'Kalimantan', '65', 'Kalimantan Utara', '', '', '', '', '', ''],
    ['71', 'Provinsi', 'Sulawesi', '71', 'Sulawesi Utara', '', '', '', '', '', ''],
    ['72', 'Provinsi', 'Sulawesi', '72', 'Sulawesi Tengah', '', '', '', '', '', ''],
    ['73', 'Provinsi', 'Sulawesi', '73', 'Sulawesi Selatan', '', '', '', '', '', ''],
    ['74', 'Provinsi', 'Sulawesi', '74', 'Sulawesi Tenggara', '', '', '', '', '', ''],
    ['75', 'Provinsi', 'Sulawesi', '75', 'Gorontalo', '', '', '', '', '', ''],
    ['76', 'Provinsi', 'Sulawesi', '76', 'Sulawesi Barat', '', '', '', '', '', ''],
    ['81', 'Provinsi', 'Maluku', '81', 'Maluku', '', '', '', '', '', ''],
    ['82', 'Provinsi', 'Maluku', '82', 'Maluku Utara', '', '', '', '', '', ''],
    ['91', 'Provinsi', 'Papua', '91', 'Papua', '', '', '', '', '', ''],
    ['92', 'Provinsi', 'Papua', '92', 'Papua Barat', '', '', '', '', '', ''],
    ['93', 'Provinsi', 'Papua', '93', 'Papua Selatan', '', '', '', '', '', ''],
    ['94', 'Provinsi', 'Papua', '94', 'Papua Tengah', '', '', '', '', '', ''],
    ['95', 'Provinsi', 'Papua', '95', 'Papua Pegunungan', '', '', '', '', '', ''],
    ['96', 'Provinsi', 'Papua', '96', 'Papua Barat Daya', '', '', '', '', '', '']
  ];
}

function sinkronUnitDanProkerRPKA() {
  const ss = getSpreadsheet_();
  const unitSheet = ss.getSheetByName(SHEETS.UNIT);
  if (unitSheet) {
    const unitRows = getStarterUnitRows_();
    if (unitSheet.getLastRow() > 1) {
      unitSheet.getRange(2, 1, unitSheet.getLastRow() - 1, 5).clearContent();
    }
    unitSheet.getRange(2, 1, unitRows.length, 5).setValues(unitRows);
  }

  const prokerSheet = ss.getSheetByName(SHEETS.PROGRAM_KERJA);
  if (prokerSheet) {
    const prokerRows = getStarterProkerRows_();
    if (prokerSheet.getLastRow() > 1) {
      prokerSheet.getRange(2, 1, prokerSheet.getLastRow() - 1, 4).clearContent();
    }
    prokerSheet.getRange(2, 1, prokerRows.length, 4).setValues(prokerRows);
  }

  writeLog_('SUPERADMIN', 'sinkronUnitDanProkerRPKA', 'Sheet UNIT (0-5) dan PROGRAM_KERJA (10001-10005) disinkronkan.');
}

function readRowsOptional_(sheetName) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  return readSheetObjects_(sheet);
}

function formatDateCell_(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, 'Asia/Makassar', 'yyyy-MM-dd');
  }
  return String(val).trim();
}

function ensureMusyawarahSheets_(ss) {
  const defs = [
    {
      name: SHEETS.MUSYAWARAH,
      headers: [
        'ID_Musyawarah',
        'Judul',
        'Jenis',
        'Musyawarah_Ke',
        'ID_Unit',
        'Nama_Unit',
        'Tanggal',
        'Waktu_Mulai',
        'Waktu_Selesai',
        'Tempat',
        'Pimpinan_Rapat',
        'Notula_Mode',
        'Notula_Teks',
        'Notula_File_Name',
        'Notula_File_URL',
        'Notula_File_ID',
        'Dokumentasi_File_Name',
        'Dokumentasi_File_URL',
        'Dokumentasi_File_ID',
        'Notulensi_Ringkas',
        'Tautan_Drive',
        'Peserta_Tambahan_IDs',
        'Dibuat_Pada',
        'Diperbarui_Pada'
      ]
    },
    {
      name: SHEETS.PRESENSI_MUSYAWARAH,
      headers: ['ID_Presensi', 'ID_Musyawarah', 'ID_Pengurus', 'Nama_Lengkap', 'Unit_Kode', 'Amanah', 'Sumber_Peserta', 'Status_Kehadiran', 'Keterangan', 'Diperbarui_Pada']
    }
  ];
  defs.forEach(function (def) {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      sheet.getRange(1, 1, 1, def.headers.length)
        .setFontWeight('bold')
        .setBackground('#07525E')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    } else {
      ensureHeaderColumns_(sheet, def.headers);
    }
  });
}

function getMusyawarahDriveFolder_() {
  const settingsMap = getSettingsMap_();
  const raw = String(settingsMap.MUSYAWARAH_DRIVE_FOLDER_ID || DEFAULT_MUSYAWARAH_DRIVE_FOLDER_ID).trim();
  const folderMatch = raw.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  const folderId = (folderMatch && folderMatch[1]) ? folderMatch[1] : (raw || DEFAULT_MUSYAWARAH_DRIVE_FOLDER_ID);
  try {
    return DriveApp.getFolderById(folderId);
  } catch (err) {
    throw new Error('Tidak dapat mengakses folder Google Drive (ID: ' + folderId + '). Pastikan akun pemilik Apps Script memiliki akses Editor ke folder tersebut dan sudah menjalankan otorisasiGoogleDrive(). Detail: ' + err.message);
  }
}

function sanitizeDriveFileName_(name) {
  return String(name || 'Berkas_Musyawarah')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trashExistingFileByName_(folder, fileName) {
  try {
    const files = folder.getFilesByName(fileName);
    while (files.hasNext()) {
      const f = files.next();
      f.setTrashed(true);
    }
  } catch (ignore) {}
}

function setDriveFilePublicViewSafe_(file) {
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (ignore) {
    // Tetap aman jika kebijakan domain Workspace membatasi sharing publik
  }
}

function deleteRowsByColumnInSs_(ss, sheetName, colName, targetVal) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1) return 0;
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(function (h) { return String(h).trim(); });
    const colIdx = headers.indexOf(colName);
    if (colIdx === -1) return 0;
    let count = 0;
    for (let r = data.length - 1; r >= 1; r--) {
      if (String(data[r][colIdx]).trim() === String(targetVal).trim()) {
        sheet.deleteRow(r + 1);
        count++;
      }
    }
    return count;
  } finally {
    lock.releaseLock();
  }
}

function ensureDokumenSheets_(ss) {
  const defs = [
    {
      name: SHEETS.DOKUMEN_KATEGORI,
      headers: [
        'ID_Kategori',
        'Nama_Kategori',
        'Deskripsi',
        'Urutan',
        'Drive_Folder_ID',
        'Drive_Folder_URL',
        'Tanggal_Update',
        'Dibuat_Pada',
        'Diperbarui_Pada'
      ]
    },
    {
      name: SHEETS.DOKUMEN_SUBKATEGORI,
      headers: [
        'ID_Subkategori',
        'ID_Kategori',
        'Nama_Kategori',
        'Nama_Subkategori',
        'Urutan',
        'Drive_Folder_ID',
        'Drive_Folder_URL',
        'Tanggal_Update',
        'Dibuat_Pada',
        'Diperbarui_Pada'
      ]
    },
    {
      name: SHEETS.DOKUMEN_FILE,
      headers: [
        'ID_Dokumen',
        'ID_Kategori',
        'Nama_Kategori',
        'Subfolder',
        'Judul_Dokumen',
        'Tipe_Item',
        'Nama_File_Drive',
        'Ekstensi',
        'Mime_Type',
        'Ukuran_Bytes',
        'Drive_File_ID',
        'Drive_File_URL',
        'Drive_Folder_ID',
        'Drive_Folder_URL',
        'Tanggal_Update',
        'Keterangan',
        'Jumlah_Dilihat',
        'Jumlah_Diunduh',
        'Dibuat_Pada',
        'Diperbarui_Pada'
      ]
    }
  ];

  defs.forEach(function (def) {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      sheet.getRange(1, 1, 1, def.headers.length)
        .setFontWeight('bold')
        .setBackground('#07525E')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    } else {
      ensureHeaderColumns_(sheet, def.headers);
    }
  });
}

function getDokumenDriveFolder_() {
  const settingsMap = getSettingsMap_();
  const raw = String(settingsMap.DOKUMEN_DRIVE_FOLDER_ID || DEFAULT_DOKUMEN_DRIVE_FOLDER_ID).trim();
  const folderMatch = raw.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  const folderId = (folderMatch && folderMatch[1]) ? folderMatch[1] : (raw || DEFAULT_DOKUMEN_DRIVE_FOLDER_ID);
  try {
    return DriveApp.getFolderById(folderId);
  } catch (err) {
    throw new Error('Tidak dapat mengakses folder Google Drive Dokumen (ID: ' + folderId + '). Pastikan akun pemilik Apps Script memiliki akses Editor ke folder tersebut dan sudah menjalankan otorisasiGoogleDrive(). Detail: ' + err.message);
  }
}

function getOrCreateSubfolder_(parentFolder, folderName) {
  const clean = sanitizeDriveFileName_(folderName || 'Dokumen');
  const iter = parentFolder.getFoldersByName(clean);
  if (iter.hasNext()) {
    return iter.next();
  }
  return parentFolder.createFolder(clean);
}

function extractExtFromName_(fileName) {
  const match = String(fileName || '').match(/\.([a-zA-Z0-9]{1,10})$/);
  return match && match[1] ? match[1].toLowerCase() : '';
}

function buildDokumenDriveFileName_(namaKategori, subfolder, judulDokumen, ext) {
  const cleanKat = sanitizeDriveFileName_(namaKategori || '');
  const cleanSub = sanitizeDriveFileName_(subfolder || '');
  const cleanTitle = sanitizeDriveFileName_(judulDokumen || 'Dokumen');
  const cleanExt = String(ext || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  let base = cleanTitle;
  if (cleanSub) {
    base = cleanKat ? (cleanKat + ' - ' + cleanSub + ' - ' + cleanTitle) : (cleanSub + ' - ' + cleanTitle);
  } else if (cleanKat && cleanTitle.toLowerCase() !== cleanKat.toLowerCase()) {
    base = cleanKat + ' - ' + cleanTitle;
  }

  return cleanExt && cleanExt !== 'link' ? (base + '.' + cleanExt) : base;
}

function mapDokumenKategoriRow_(r) {
  return {
    id: String(r.ID_Kategori || ''),
    namaKategori: String(r.Nama_Kategori || ''),
    deskripsi: String(r.Deskripsi || ''),
    urutan: Number(r.Urutan || 1),
    driveFolderId: String(r.Drive_Folder_ID || ''),
    driveFolderUrl: String(r.Drive_Folder_URL || ''),
    tanggalUpdate: formatDateCell_(r.Tanggal_Update),
    dibuatPada: String(r.Dibuat_Pada || ''),
    diperbaruiPada: String(r.Diperbarui_Pada || '')
  };
}

function mapDokumenSubkategoriRow_(r) {
  return {
    id: String(r.ID_Subkategori || ''),
    kategoriId: String(r.ID_Kategori || ''),
    namaKategori: String(r.Nama_Kategori || ''),
    namaSubkategori: String(r.Nama_Subkategori || ''),
    urutan: Number(r.Urutan || 1),
    driveFolderId: String(r.Drive_Folder_ID || ''),
    driveFolderUrl: String(r.Drive_Folder_URL || ''),
    tanggalUpdate: formatDateCell_(r.Tanggal_Update),
    dibuatPada: String(r.Dibuat_Pada || ''),
    diperbaruiPada: String(r.Diperbarui_Pada || '')
  };
}

function mapDokumenFileRow_(r) {
  const driveFileId = String(r.Drive_File_ID || '');
  const rawTipe = String(r.Tipe_Item || '').trim().toLowerCase();
  const tipeItem = rawTipe === 'link' || (!rawTipe && !driveFileId && String(r.Ekstensi || '').toLowerCase() === 'link') ? 'link' : 'file';
  return {
    id: String(r.ID_Dokumen || ''),
    kategoriId: String(r.ID_Kategori || ''),
    namaKategori: String(r.Nama_Kategori || ''),
    subfolder: String(r.Subfolder || ''),
    judulDokumen: String(r.Judul_Dokumen || ''),
    tipeItem: tipeItem,
    namaFileDrive: String(r.Nama_File_Drive || ''),
    ekstensi: String(r.Ekstensi || '').toLowerCase(),
    mimeType: String(r.Mime_Type || ''),
    ukuranBytes: Number(r.Ukuran_Bytes || 0),
    driveFileId: driveFileId,
    driveFileUrl: String(r.Drive_File_URL || ''),
    driveFolderId: String(r.Drive_Folder_ID || ''),
    driveFolderUrl: String(r.Drive_Folder_URL || ''),
    tanggalUpdate: formatDateCell_(r.Tanggal_Update),
    keterangan: String(r.Keterangan || ''),
    jumlahDilihat: Number(r.Jumlah_Dilihat || 0),
    jumlahDiunduh: Number(r.Jumlah_Diunduh || 0),
    dibuatPada: String(r.Dibuat_Pada || ''),
    diperbaruiPada: String(r.Diperbarui_Pada || '')
  };
}

function ensureSubkategoriRowExists_(ss, kategoriId, namaKategori, namaSubkategori, driveFolderId, driveFolderUrl, tanggalUpdate, nowStr) {
  const cleanSub = String(namaSubkategori || '').trim();
  if (!cleanSub) return;
  const existingSubs = readRowsOptional_(SHEETS.DOKUMEN_SUBKATEGORI);
  const found = existingSubs.some(function (r) {
    return String(r.ID_Kategori || '').trim() === String(kategoriId).trim() &&
      String(r.Nama_Subkategori || '').trim().toLowerCase() === cleanSub.toLowerCase();
  });
  if (found) return;
  const countInKat = existingSubs.filter(function (r) {
    return String(r.ID_Kategori || '').trim() === String(kategoriId).trim();
  }).length;
  appendRowInSs_(ss, SHEETS.DOKUMEN_SUBKATEGORI, {
    ID_Subkategori: generateId_('SUB'),
    ID_Kategori: kategoriId,
    Nama_Kategori: namaKategori,
    Nama_Subkategori: cleanSub,
    Urutan: countInKat + 1,
    Drive_Folder_ID: driveFolderId || '',
    Drive_Folder_URL: driveFolderUrl || '',
    Tanggal_Update: tanggalUpdate,
    Dibuat_Pada: nowStr,
    Diperbarui_Pada: nowStr
  });
}

function cascadeKategoriNameToFiles_(ss, kategoriId, newNamaKategori) {
  const sheet = ss.getSheetByName(SHEETS.DOKUMEN_FILE);
  if (!sheet || sheet.getLastRow() <= 1) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function (h) { return String(h).trim(); });
  const idIdx = headers.indexOf('ID_Kategori');
  const namaIdx = headers.indexOf('Nama_Kategori');
  if (idIdx === -1 || namaIdx === -1) return;
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIdx]).trim() === String(kategoriId).trim()) {
      sheet.getRange(r + 1, namaIdx + 1).setValue(newNamaKategori);
    }
  }
}

function cascadeKategoriNameToSubkategori_(ss, kategoriId, newNamaKategori) {
  const sheet = ss.getSheetByName(SHEETS.DOKUMEN_SUBKATEGORI);
  if (!sheet || sheet.getLastRow() <= 1) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function (h) { return String(h).trim(); });
  const idIdx = headers.indexOf('ID_Kategori');
  const namaIdx = headers.indexOf('Nama_Kategori');
  if (idIdx === -1 || namaIdx === -1) return;
  for (let r = 1; r < data.length; r++) {
    if (String(data[r][idIdx]).trim() === String(kategoriId).trim()) {
      sheet.getRange(r + 1, namaIdx + 1).setValue(newNamaKategori);
    }
  }
}

function cascadeSubkategoriNameToFiles_(ss, kategoriId, oldSubName, newSubName) {
  const sheet = ss.getSheetByName(SHEETS.DOKUMEN_FILE);
  if (!sheet || sheet.getLastRow() <= 1) return;
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function (h) { return String(h).trim(); });
  const idIdx = headers.indexOf('ID_Kategori');
  const subIdx = headers.indexOf('Subfolder');
  if (idIdx === -1 || subIdx === -1) return;
  for (let r = 1; r < data.length; r++) {
    if (
      String(data[r][idIdx]).trim() === String(kategoriId).trim() &&
      String(data[r][subIdx]).trim().toLowerCase() === String(oldSubName).trim().toLowerCase()
    ) {
      sheet.getRange(r + 1, subIdx + 1).setValue(newSubName);
    }
  }
}

function deleteDokumenFilesBySubfolder_(ss, kategoriId, subName) {
  const sheet = ss.getSheetByName(SHEETS.DOKUMEN_FILE);
  if (!sheet || sheet.getLastRow() <= 1) return 0;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(function (h) { return String(h).trim(); });
    const idIdx = headers.indexOf('ID_Kategori');
    const subIdx = headers.indexOf('Subfolder');
    if (idIdx === -1 || subIdx === -1) return 0;
    let count = 0;
    for (let r = data.length - 1; r >= 1; r--) {
      if (
        String(data[r][idIdx]).trim() === String(kategoriId).trim() &&
        String(data[r][subIdx]).trim().toLowerCase() === String(subName).trim().toLowerCase()
      ) {
        sheet.deleteRow(r + 1);
        count++;
      }
    }
    return count;
  } finally {
    lock.releaseLock();
  }
}

function incrementDokumenStatInSs_(ss, docId, metric) {
  const sheet = ss.getSheetByName(SHEETS.DOKUMEN_FILE);
  if (!sheet || sheet.getLastRow() <= 1) return null;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const data = sheet.getDataRange().getValues();
    const headers = data[0].map(function (h) { return String(h).trim(); });
    const idIdx = headers.indexOf('ID_Dokumen');
    const viewIdx = headers.indexOf('Jumlah_Dilihat');
    const dlIdx = headers.indexOf('Jumlah_Diunduh');
    if (idIdx === -1 || viewIdx === -1 || dlIdx === -1) return null;

    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idIdx]).trim() === String(docId).trim()) {
        let views = Number(data[r][viewIdx] || 0);
        let downloads = Number(data[r][dlIdx] || 0);
        if (metric === 'view') {
          views += 1;
          sheet.getRange(r + 1, viewIdx + 1).setValue(views);
        } else {
          downloads += 1;
          sheet.getRange(r + 1, dlIdx + 1).setValue(downloads);
        }
        return {
          id: docId,
          jumlahDilihat: views,
          jumlahDiunduh: downloads
        };
      }
    }
    return null;
  } finally {
    lock.releaseLock();
  }
}

function updateKategoriTanggalUpdate_(ss, kategoriId, tanggalUpdate, nowStr) {
  try {
    updateRowByIdInSs_(ss, SHEETS.DOKUMEN_KATEGORI, 'ID_Kategori', kategoriId, {
      Tanggal_Update: tanggalUpdate,
      Diperbarui_Pada: nowStr
    });
  } catch (ignore) {}
}

// ============================================================================
// HELPER PENDATAAN PENGURUS & BROADCAST (WHATSAPP RECHAT + GMAIL ALIAS)
// ============================================================================

function ensurePengurusPendataanColumns_(ss) {
  const sheet = ss.getSheetByName(SHEETS.PENGURUS);
  if (!sheet || sheet.getLastRow() === 0) return;
  ensureHeaderColumns_(sheet, [
    'Email',
    'Nama_Bank',
    'Nomor_Rekening',
    'Nama_Pemilik_Rekening',
    'Pendataan_Diperbarui_Pada'
  ]);
}

function ensureBroadcastSheets_(ss) {
  const defs = [
    {
      name: SHEETS.GRUP_WA,
      headers: ['ID_Grup', 'Nama_Grup', 'Group_ID_WA', 'Keterangan', 'Dibuat_Pada', 'Diperbarui_Pada']
    },
    {
      name: SHEETS.BROADCAST_QUEUE,
      headers: [
        'ID_Broadcast',
        'Judul',
        'Channel',
        'Target_Summary',
        'Target_Pengurus_IDs',
        'Target_Group_IDs',
        'Pesan_WA',
        'Email_Subject',
        'Email_Body',
        'Image_Drive_File_ID',
        'Image_URL',
        'Image_Name',
        'Mode_Kirim',
        'Jadwal_Kirim',
        'Delay_Detik',
        'Progress_Json',
        'Status',
        'Total_Target',
        'Total_Terkirim',
        'Total_Gagal',
        'Log_Hasil',
        'Dibuat_Oleh',
        'Dibuat_Pada',
        'Dikirim_Pada'
      ]
    }
  ];

  defs.forEach(function (def) {
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      sheet.getRange(1, 1, 1, def.headers.length)
        .setFontWeight('bold')
        .setBackground('#07525E')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    } else {
      ensureHeaderColumns_(sheet, def.headers);
    }
  });
}

function extractRechatKey_(rawInput) {
  const val = String(rawInput || '').trim();
  if (!val) return '';
  // Jika pengguna menempel URL lengkap https://www.rechat.id/api/v1/<KEY>/messages, ekstrak key-nya saja
  const m = val.match(/\/api\/v1\/([^/\s]+)\/messages/i);
  if (m && m[1]) return m[1].trim();
  return val;
}

function sanitizeRechatApiUrl_(rawUrl) {
  const val = String(rawUrl || '').trim();
  if (!val) return DEFAULT_RECHAT_API_URL;
  // Normalisasi ke endpoint aman berbasis header Authorization jika URL menempelkan key
  if (/^https:\/\/www\.rechat\.id\/api\/v1\/[^/\s]+\/messages$/i.test(val)) {
    return DEFAULT_RECHAT_API_URL;
  }
  if (/^https:\/\//i.test(val)) return val;
  return DEFAULT_RECHAT_API_URL;
}

function maskSecret_(secret) {
  const s = String(secret || '').trim();
  if (!s) return '';
  if (s.length <= 10) return '********';
  return s.slice(0, 6) + '••••••••' + s.slice(-4);
}

function hasBroadcastTrigger_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    return triggers.some(function (t) {
      return t.getHandlerFunction() === 'prosesJadwalBroadcast';
    });
  } catch (ignore) {
    return false;
  }
}

function getBroadcastConfigStatus_() {
  const settingsMap = getSettingsMap_();
  const props = PropertiesService.getScriptProperties();
  const apiKey = String(props.getProperty('RECHAT_API_KEY') || '').trim();
  let aliases = [];
  try {
    aliases = GmailApp.getAliases() || [];
  } catch (ignore) {}
  return {
    rechatConfigured: Boolean(apiKey),
    rechatKeyMasked: maskSecret_(apiKey),
    rechatApiUrl: sanitizeRechatApiUrl_(settingsMap.RECHAT_API_URL || DEFAULT_RECHAT_API_URL),
    emailAlias: String(settingsMap.EMAIL_ALIAS_PENGIRIM || DEFAULT_EMAIL_ALIAS).trim() || DEFAULT_EMAIL_ALIAS,
    emailSenderName: String(settingsMap.EMAIL_NAMA_PENGIRIM || DEFAULT_EMAIL_SENDER_NAME).trim() || DEFAULT_EMAIL_SENDER_NAME,
    triggerActive: hasBroadcastTrigger_(),
    availableEmailAliases: aliases
  };
}

function mapWaGroupRow_(r) {
  return {
    id: String(r.ID_Grup || ''),
    namaGrup: String(r.Nama_Grup || ''),
    groupId: String(r.Group_ID_WA || ''),
    keterangan: String(r.Keterangan || ''),
    dibuatPada: String(r.Dibuat_Pada || ''),
    diperbaruiPada: String(r.Diperbarui_Pada || '')
  };
}

function mapBroadcastRow_(r) {
  const rawP = String(r.Target_Pengurus_IDs || '').trim();
  const rawG = String(r.Target_Group_IDs || '').trim();
  return {
    id: String(r.ID_Broadcast || ''),
    judul: String(r.Judul || ''),
    channel: String(r.Channel || 'wa'),
    targetSummary: String(r.Target_Summary || ''),
    targetPengurusIds: rawP ? rawP.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [],
    targetGroupIds: rawG ? rawG.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [],
    pesanWa: String(r.Pesan_WA || ''),
    emailSubject: String(r.Email_Subject || ''),
    emailBody: String(r.Email_Body || ''),
    imageDriveFileId: String(r.Image_Drive_File_ID || ''),
    imageUrl: String(r.Image_URL || ''),
    imageName: String(r.Image_Name || ''),
    modeKirim: String(r.Mode_Kirim || 'segera') === 'terjadwal' ? 'terjadwal' : 'segera',
    jadwalKirim: String(r.Jadwal_Kirim || ''),
    delayDetik: Number(r.Delay_Detik || 0),
    status: String(r.Status || 'Terjadwal'),
    totalTarget: Number(r.Total_Target || 0),
    totalTerkirim: Number(r.Total_Terkirim || 0),
    totalGagal: Number(r.Total_Gagal || 0),
    logHasil: String(r.Log_Hasil || ''),
    dibuatOleh: String(r.Dibuat_Oleh || ''),
    dibuatPada: String(r.Dibuat_Pada || ''),
    dikirimPada: String(r.Dikirim_Pada || '')
  };
}

function personalizeTemplate_(text, pengurusRow, unitCode) {
  let out = String(text || '');
  if (!pengurusRow) return out;
  out = out.replace(/\{nama\}/gi, String(pengurusRow.Nama_Lengkap || ''));
  out = out.replace(/\{panggilan\}/gi, String(pengurusRow.Nama_Panggilan || pengurusRow.Nama_Lengkap || ''));
  out = out.replace(/\{unit\}/gi, String(unitCode || pengurusRow.Nama_Unit || ''));
  out = out.replace(/\{amanah\}/gi, String(pengurusRow.Amanah || ''));
  return out;
}

function escapeHtmlEmail_(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

/**
 * Membuat file media sementara (di luar folder Dokumen) HANYA saat dibutuhkan untuk tautan gambar ReChat
 * atau menunggu jadwal kirim. File otomatis dihapus (trash) segera setelah pengiriman selesai.
 */
function createTempBroadcastMedia_(base64Data, mimeType, fileName, needPublicUrl) {
  const cleanName = '_TMP_BROADCAST_' + Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyyMMddHHmmss') + '_' + sanitizeDriveFileName_(fileName || 'foto.jpg');
  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', cleanName);
  const file = DriveApp.createFile(blob);
  if (needPublicUrl) {
    setDriveFilePublicViewSafe_(file);
  }
  const fileId = file.getId();
  return {
    fileId: fileId,
    fileName: fileName || cleanName,
    imageUrl: needPublicUrl ? ('https://lh3.googleusercontent.com/d/' + fileId) : ''
  };
}

function trashTempBroadcastFileNow_(fileId) {
  const cleanId = String(fileId || '').trim();
  if (!cleanId) return;
  try {
    DriveApp.getFileById(cleanId).setTrashed(true);
  } catch (ignore) {}
}

/**
 * Antrekan penghapusan otomatis file media sementara setelah jeda aman (mis. 10 menit agar ReChat selesai mengunduh gambar).
 */
function queueTempBroadcastFileCleanup_(fileId, delayMinutes) {
  const cleanId = String(fileId || '').trim();
  if (!cleanId) return;
  const mins = Math.max(1, Number(delayMinutes || 10));
  const deleteAfterMs = Date.now() + mins * 60 * 1000;
  const props = PropertiesService.getScriptProperties();
  let list = [];
  try {
    list = JSON.parse(props.getProperty('TEMP_BROADCAST_MEDIA_CLEANUP') || '[]');
    if (!Array.isArray(list)) list = [];
  } catch (ignore) {
    list = [];
  }
  if (!list.some(function (x) { return x && x.fileId === cleanId; })) {
    list.push({ fileId: cleanId, deleteAfterMs: deleteAfterMs });
    props.setProperty('TEMP_BROADCAST_MEDIA_CLEANUP', JSON.stringify(list));
  }
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const hasCleaner = triggers.some(function (t) {
      return t.getHandlerFunction() === 'bersihkanMediaSementaraBroadcast';
    });
    if (!hasCleaner) {
      ScriptApp.newTrigger('bersihkanMediaSementaraBroadcast')
        .timeBased()
        .after((mins + 1) * 60 * 1000)
        .create();
    }
  } catch (ignore) {}
}

function cleanupExpiredTempBroadcastMedia_() {
  const props = PropertiesService.getScriptProperties();
  let list = [];
  try {
    list = JSON.parse(props.getProperty('TEMP_BROADCAST_MEDIA_CLEANUP') || '[]');
    if (!Array.isArray(list)) list = [];
  } catch (ignore) {
    list = [];
  }
  if (list.length === 0) return 0;

  const nowMs = Date.now();
  const remaining = [];
  let deletedCount = 0;
  list.forEach(function (entry) {
    if (!entry || !entry.fileId) return;
    if (Number(entry.deleteAfterMs || 0) <= nowMs) {
      trashTempBroadcastFileNow_(entry.fileId);
      deletedCount += 1;
    } else {
      remaining.push(entry);
    }
  });
  props.setProperty('TEMP_BROADCAST_MEDIA_CLEANUP', JSON.stringify(remaining));
  return deletedCount;
}

function bersihkanMediaSementaraBroadcast() {
  cleanupExpiredTempBroadcastMedia_();
  const props = PropertiesService.getScriptProperties();
  let remaining = [];
  try {
    remaining = JSON.parse(props.getProperty('TEMP_BROADCAST_MEDIA_CLEANUP') || '[]');
    if (!Array.isArray(remaining)) remaining = [];
  } catch (ignore) {
    remaining = [];
  }
  // Hapus trigger pembersih lama, pasang lagi hanya jika masih ada media yang menunggu masa tenggang
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'bersihkanMediaSementaraBroadcast') {
        ScriptApp.deleteTrigger(t);
      }
    });
    if (remaining.length > 0) {
      ScriptApp.newTrigger('bersihkanMediaSementaraBroadcast')
        .timeBased()
        .after(10 * 60 * 1000)
        .create();
    }
  } catch (ignore) {}
}

function ensureContinuationTrigger_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const exists = triggers.some(function (t) {
      return t.getHandlerFunction() === 'lanjutkanAntreanBroadcast';
    });
    if (!exists) {
      ScriptApp.newTrigger('lanjutkanAntreanBroadcast')
        .timeBased()
        .everyMinutes(1)
        .create();
    }
  } catch (ignore) {}
}

function removeContinuationTrigger_() {
  try {
    ScriptApp.getProjectTriggers().forEach(function (t) {
      if (t.getHandlerFunction() === 'lanjutkanAntreanBroadcast') {
        ScriptApp.deleteTrigger(t);
      }
    });
  } catch (ignore) {}
}

function syncContinuationTriggerState_(ss) {
  try {
    const rows = readRowsOptional_(SHEETS.BROADCAST_QUEUE);
    const hasActive = rows.some(function (r) {
      return String(r.Status || '').trim() === 'Diproses';
    });
    if (hasActive) {
      ensureContinuationTrigger_();
    } else {
      removeContinuationTrigger_();
    }
  } catch (ignore) {}
}

function executeBroadcastRow_(ss, rowObj, options) {
  const opts = options || {};
  const maxRuntimeMs = Number(opts.maxRuntimeMs || 240000);
  const startedAt = Date.now();
  const channel = String(rowObj.Channel || 'wa').toLowerCase();
  const delayDetik = Math.min(300, Math.max(0, Math.round(Number(rowObj.Delay_Detik || 0))));

  const targetPIds = String(rowObj.Target_Pengurus_IDs || '')
    .split(',')
    .map(function (x) { return x.trim(); })
    .filter(Boolean);
  const targetGIds = String(rowObj.Target_Group_IDs || '')
    .split(',')
    .map(function (x) { return x.trim(); })
    .filter(Boolean);

  const allPengurus = readRows_(SHEETS.PENGURUS);
  const allUnits = readRows_(SHEETS.UNIT);
  const unitCodeById = {};
  allUnits.forEach(function (u) {
    unitCodeById[String(u.ID_Unit || '').trim()] = String(u.Kode_Unit || u.Nama_Unit || '').trim();
  });

  const pengurusById = {};
  allPengurus.forEach(function (p) {
    pengurusById[String(p.ID_Pengurus || '').trim()] = p;
  });

  const allGroups = readRowsOptional_(SHEETS.GRUP_WA);
  const groupById = {};
  allGroups.forEach(function (g) {
    groupById[String(g.ID_Grup || '').trim()] = g;
  });

  const selectedPengurus = targetPIds.map(function (id) { return pengurusById[id]; }).filter(Boolean);
  const selectedGroups = targetGIds.map(function (id) { return groupById[id]; }).filter(Boolean);

  const settingsMap = getSettingsMap_();
  const rechatApiUrl = sanitizeRechatApiUrl_(settingsMap.RECHAT_API_URL || DEFAULT_RECHAT_API_URL);
  const rechatApiKey = String(PropertiesService.getScriptProperties().getProperty('RECHAT_API_KEY') || '').trim();
  const emailAlias = String(settingsMap.EMAIL_ALIAS_PENGIRIM || DEFAULT_EMAIL_ALIAS).trim() || DEFAULT_EMAIL_ALIAS;
  const emailSenderName = String(settingsMap.EMAIL_NAMA_PENGIRIM || DEFAULT_EMAIL_SENDER_NAME).trim() || DEFAULT_EMAIL_SENDER_NAME;

  const imageUrl = String(rowObj.Image_URL || '').trim();
  const imageFileId = String(rowObj.Image_Drive_File_ID || '').trim();
  const pesanWaRaw = String(rowObj.Pesan_WA || '').trim();
  const emailSubjectRaw = String(rowObj.Email_Subject || rowObj.Judul || 'Informasi DUWD DPP WI').trim();
  const emailBodyRaw = String(rowObj.Email_Body || pesanWaRaw).trim();

  // Susun daftar tugas pengiriman secara deterministik agar bisa dilanjutkan dengan aman tanpa duplikasi
  const tasks = [];
  if (channel === 'wa' || channel === 'both') {
    selectedPengurus.forEach(function (p) {
      tasks.push({ kind: 'wa_personal', pengurus: p });
    });
    selectedGroups.forEach(function (g) {
      tasks.push({ kind: 'wa_group', group: g });
    });
  }
  if (channel === 'email' || channel === 'both') {
    selectedPengurus.forEach(function (p) {
      tasks.push({ kind: 'email', pengurus: p });
    });
  }

  // Muat progres terakhir bila ini adalah lanjutan antrean berjeda
  let progress = {
    nextIdx: 0,
    nextRunAtMs: 0,
    sent: 0,
    failed: 0,
    logs: []
  };
  if (rowObj.Progress_Json) {
    try {
      const parsed = JSON.parse(String(rowObj.Progress_Json));
      if (parsed && typeof parsed === 'object') {
        progress.nextIdx = Number(parsed.nextIdx || 0);
        progress.nextRunAtMs = Number(parsed.nextRunAtMs || 0);
        progress.sent = Number(parsed.sent || 0);
        progress.failed = Number(parsed.failed || 0);
        progress.logs = Array.isArray(parsed.logs) ? parsed.logs : [];
      }
    } catch (ignore) {}
  }

  const totalTarget = tasks.length;

  // Cek kesiapan alias Gmail & lampiran blob Email (jika kanal menyertakan email)
  let aliasReady = false;
  let emailAttachment = opts.inlineBlob || null;
  if (channel === 'email' || channel === 'both') {
    let availableAliases = [];
    try {
      availableAliases = GmailApp.getAliases() || [];
    } catch (ignore) {}
    const aliasLower = emailAlias.toLowerCase();
    aliasReady = availableAliases.some(function (a) {
      return String(a || '').trim().toLowerCase() === aliasLower;
    });
    if (!aliasReady && progress.nextIdx === 0 && selectedPengurus.length > 0) {
      progress.logs.push('Catatan Email: Alias "' + emailAlias + '" belum terdeteksi di Gmail "Send mail as", memakai alamat akun utama.');
    }
    if (!emailAttachment && imageFileId) {
      try {
        const tmpFile = DriveApp.getFileById(imageFileId);
        const origBlob = tmpFile.getBlob();
        if (rowObj.Image_Name) {
          origBlob.setName(String(rowObj.Image_Name));
        }
        emailAttachment = origBlob;
      } catch (attErr) {
        if (progress.nextIdx === 0) {
          progress.logs.push('Peringatan lampiran foto Email: ' + attErr.message);
        }
      }
    }
  }

  // Tunggu sisa jeda dari siklus sebelumnya bila perlu dan masih muat di anggaran waktu
  if (progress.nextRunAtMs > Date.now() && progress.nextIdx < totalTarget) {
    const remainingWait = progress.nextRunAtMs - Date.now();
    if (remainingWait + 4000 > maxRuntimeMs) {
      ensureContinuationTrigger_();
      return rowObj;
    }
    Utilities.sleep(remainingWait);
  }

  let sentInThisRun = 0;
  let pausedForLater = false;

  for (let idx = progress.nextIdx; idx < totalTarget; idx++) {
    // Jika bukan pengiriman pertama pada siklus ini dan jeda > 0, terapkan jeda antar pesan
    if (sentInThisRun > 0 && delayDetik > 0) {
      const waitMs = delayDetik * 1000;
      const elapsed = Date.now() - startedAt;
      if (elapsed + waitMs + 4000 > maxRuntimeMs) {
        progress.nextIdx = idx;
        progress.nextRunAtMs = Date.now() + waitMs;
        pausedForLater = true;
        break;
      }
      Utilities.sleep(waitMs);
    } else if (sentInThisRun > 0) {
      const elapsedNoDelay = Date.now() - startedAt;
      if (elapsedNoDelay + 4000 > maxRuntimeMs) {
        progress.nextIdx = idx;
        progress.nextRunAtMs = Date.now();
        pausedForLater = true;
        break;
      }
    }

    const task = tasks[idx];
    let didNetworkSend = false;

    if (task.kind === 'wa_personal') {
      const p = task.pengurus;
      const waNum = normalizeWaNumber_(p.WhatsApp || '');
      if (!waNum || waNum.length < 9) {
        progress.failed += 1;
        progress.logs.push('WA dilewati (' + String(p.Nama_Lengkap || '') + '): nomor tidak valid');
      } else if (!rechatApiKey) {
        progress.failed += 1;
        progress.logs.push('WA GAGAL (' + String(p.Nama_Lengkap || '') + '): API Key ReChat belum dikonfigurasi');
      } else {
        const unitCode = unitCodeById[String(p.ID_Unit || '').trim()] || String(p.Nama_Unit || '');
        const bodyText = personalizeTemplate_(pesanWaRaw, p, unitCode);
        const waPayload = imageUrl
          ? { recipient_type: 'individual', to: waNum, type: 'image', image: { link: imageUrl, caption: bodyText } }
          : { recipient_type: 'individual', to: waNum, type: 'text', text: { body: bodyText } };
        const sendRes = dispatchSingleRechatMessage_(rechatApiUrl, rechatApiKey, waPayload, String(p.Nama_Lengkap || waNum));
        didNetworkSend = true;
        if (sendRes.ok) {
          progress.sent += 1;
        } else {
          progress.failed += 1;
          progress.logs.push(sendRes.log);
        }
      }
    } else if (task.kind === 'wa_group') {
      const g = task.group;
      const gid = String(g.Group_ID_WA || '').trim();
      if (!gid) {
        progress.failed += 1;
        progress.logs.push('WA Grup dilewati (' + String(g.Nama_Grup || '') + '): ID grup kosong');
      } else if (!rechatApiKey) {
        progress.failed += 1;
        progress.logs.push('WA Grup GAGAL (' + String(g.Nama_Grup || '') + '): API Key ReChat belum dikonfigurasi');
      } else {
        const waPayload = imageUrl
          ? { recipient_type: 'group', to: gid, type: 'image', image: { link: imageUrl, caption: pesanWaRaw } }
          : { recipient_type: 'group', to: gid, type: 'text', text: { body: pesanWaRaw } };
        const sendRes = dispatchSingleRechatMessage_(rechatApiUrl, rechatApiKey, waPayload, 'Grup ' + String(g.Nama_Grup || gid));
        didNetworkSend = true;
        if (sendRes.ok) {
          progress.sent += 1;
        } else {
          progress.failed += 1;
          progress.logs.push(sendRes.log);
        }
      }
    } else if (task.kind === 'email') {
      const p = task.pengurus;
      const recipientEmail = String(p.Email || '').trim().toLowerCase();
      if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(recipientEmail)) {
        progress.failed += 1;
        progress.logs.push('Email dilewati (' + String(p.Nama_Lengkap || '') + '): belum mengisi email');
      } else {
        const unitCode = unitCodeById[String(p.ID_Unit || '').trim()] || String(p.Nama_Unit || '');
        const subjectFinal = personalizeTemplate_(emailSubjectRaw, p, unitCode);
        const bodyFinal = personalizeTemplate_(emailBodyRaw, p, unitCode);
        const htmlBody =
          '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#0F2429;max-width:640px;">' +
          '<div style="border-bottom:3px solid #0C7A89;padding-bottom:10px;margin-bottom:16px;">' +
          '<strong style="color:#07525E;font-size:15px;">' + escapeHtmlEmail_(emailSenderName) + '</strong><br>' +
          '<span style="color:#526A70;font-size:12px;">Departemen Urusan Wilayah dan Daerah &middot; DPP Wahdah Islamiyah</span>' +
          '</div>' +
          '<div>' + escapeHtmlEmail_(bodyFinal) + '</div>' +
          '<div style="margin-top:24px;padding-top:12px;border-top:1px solid #DCE8EC;font-size:11px;color:#526A70;">' +
          'Pesan resmi melalui portal DUWD DPP WI (duwd.web.id).' +
          '</div></div>';
        const mailOptions = {
          name: emailSenderName,
          htmlBody: htmlBody
        };
        if (aliasReady) {
          mailOptions.from = emailAlias;
        }
        if (emailAttachment) {
          mailOptions.attachments = [emailAttachment];
        }
        didNetworkSend = true;
        try {
          GmailApp.sendEmail(recipientEmail, subjectFinal, bodyFinal, mailOptions);
          progress.sent += 1;
        } catch (mailErr) {
          progress.failed += 1;
          progress.logs.push('Email GAGAL ke ' + recipientEmail + ': ' + mailErr.message);
        }
      }
    }

    progress.nextIdx = idx + 1;
    if (didNetworkSend) {
      sentInThisRun += 1;
    }

    // Simpan checkpoint berkala agar progres langsung terpantau & aman dari duplikasi
    if (didNetworkSend && (delayDetik >= 10 || sentInThisRun % 5 === 0) && progress.nextIdx < totalTarget) {
      updateRowByIdInSs_(ss, SHEETS.BROADCAST_QUEUE, 'ID_Broadcast', rowObj.ID_Broadcast, {
        Status: 'Diproses',
        Total_Target: totalTarget,
        Total_Terkirim: progress.sent,
        Total_Gagal: progress.failed,
        Progress_Json: JSON.stringify(progress),
        Log_Hasil: ('Sedang mengirim (' + progress.nextIdx + '/' + totalTarget + ', jeda ' + delayDetik + ' detik)' + (progress.logs.length ? ' | ' + progress.logs.join(' | ') : '')).slice(0, 45000)
      });
    }
  }

  if (pausedForLater && progress.nextIdx < totalTarget) {
    const pausePatch = {
      Status: 'Diproses',
      Total_Target: totalTarget,
      Total_Terkirim: progress.sent,
      Total_Gagal: progress.failed,
      Progress_Json: JSON.stringify(progress),
      Log_Hasil: ('Mengirim bertahap: ' + progress.nextIdx + '/' + totalTarget + ' diproses (jeda ' + delayDetik + ' detik/pesan)' + (progress.logs.length ? ' | ' + progress.logs.join(' | ') : '')).slice(0, 45000)
    };
    updateRowByIdInSs_(ss, SHEETS.BROADCAST_QUEUE, 'ID_Broadcast', rowObj.ID_Broadcast, pausePatch);
    ensureContinuationTrigger_();
    return Object.assign({}, rowObj, pausePatch);
  }

  // Semua tugas selesai!
  let finalStatus = 'Terkirim';
  if (progress.sent === 0 && progress.failed > 0) {
    finalStatus = 'Gagal';
  } else if (progress.sent > 0 && progress.failed > 0) {
    finalStatus = 'Sebagian Gagal';
  } else if (totalTarget === 0) {
    finalStatus = 'Gagal';
    progress.logs.push('Tidak ada target valid yang dapat dikirim.');
  }

  // Hapus file media sementara agar TIDAK tersimpan di Google Drive
  if (imageFileId) {
    if (channel === 'email') {
      trashTempBroadcastFileNow_(imageFileId);
    } else {
      // Beri jeda 10 menit agar antrean ReChat sempat mengunduh gambar, lalu otomatis dihapus
      queueTempBroadcastFileCleanup_(imageFileId, 10);
    }
  }

  const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
  const summaryLog = 'Selesai (jeda ' + delayDetik + ' detik/pesan): ' + progress.sent + ' terkirim, ' + progress.failed + ' gagal.' +
    (progress.logs.length ? ' | ' + progress.logs.join(' | ') : '');

  const patch = {
    Status: finalStatus,
    Total_Target: totalTarget,
    Total_Terkirim: progress.sent,
    Total_Gagal: progress.failed,
    Progress_Json: '',
    Image_Drive_File_ID: '',
    Image_URL: '',
    Log_Hasil: summaryLog.slice(0, 45000),
    Dikirim_Pada: nowStr
  };

  updateRowByIdInSs_(ss, SHEETS.BROADCAST_QUEUE, 'ID_Broadcast', rowObj.ID_Broadcast, patch);
  syncContinuationTriggerState_(ss);
  return Object.assign({}, rowObj, patch);
}

function dispatchSingleRechatMessage_(rechatApiUrl, rechatApiKey, messagePayload, label) {
  try {
    const resp = UrlFetchApp.fetch(rechatApiUrl, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + rechatApiKey
      },
      payload: JSON.stringify(messagePayload),
      muteHttpExceptions: true
    });
    const code = resp.getResponseCode();
    const txt = resp.getContentText();
    if (code >= 200 && code < 300) {
      return { ok: true, log: '' };
    }
    if (code === 429) {
      return { ok: false, log: 'WA GAGAL (' + label + ', HTTP 429): Kuota harian ReChat habis.' };
    }
    return { ok: false, log: 'WA GAGAL (' + label + ', HTTP ' + code + '): ' + txt.slice(0, 140) };
  } catch (err) {
    return { ok: false, log: 'WA ERROR (' + label + '): ' + err.message };
  }
}

/**
 * Trigger otomatis per 1 menit khusus melanjutkan broadcast berjeda panjang yang berstatus "Diproses".
 * Trigger ini otomatis dihapus segera setelah semua antrean "Diproses" selesai.
 */
function lanjutkanAntreanBroadcast() {
  return prosesJadwalBroadcast();
}

/**
 * Fungsi terjadwal (Time-driven Trigger setiap 5 menit) untuk memproses antrean Broadcast terjadwal (WITA)
 * serta melanjutkan antrean berjeda panjang dan membersihkan media sementara.
 */
function prosesJadwalBroadcast() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return 0;
  }
  try {
    cleanupExpiredTempBroadcastMedia_();
    const ss = getSpreadsheet_();
    ensureBroadcastSheets_(ss);
    const rows = readRowsOptional_(SHEETS.BROADCAST_QUEUE);
    const nowComparable = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm');
    const batchStartedAt = Date.now();
    const totalBudgetMs = 240000; // 4 menit (aman di bawah batas 6 menit GAS)
    let processed = 0;

    // 1. Prioritaskan melanjutkan antrean berstatus "Diproses" (broadcast berjeda panjang)
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (String(r.Status || '').trim() !== 'Diproses') continue;
      const remaining = totalBudgetMs - (Date.now() - batchStartedAt);
      if (remaining < 15000) break;
      executeBroadcastRow_(ss, r, { maxRuntimeMs: remaining });
      processed += 1;
    }

    // 2. Jalankan antrean "Terjadwal" yang sudah jatuh tempo (WITA)
    for (let j = 0; j < rows.length; j++) {
      const r = rows[j];
      if (String(r.Status || '').trim() !== 'Terjadwal') continue;
      const jadwal = String(r.Jadwal_Kirim || '').trim().replace('T', ' ').slice(0, 16);
      if (!jadwal || jadwal > nowComparable) continue;
      const remaining = totalBudgetMs - (Date.now() - batchStartedAt);
      if (remaining < 15000) break;

      updateRowByIdInSs_(ss, SHEETS.BROADCAST_QUEUE, 'ID_Broadcast', r.ID_Broadcast, {
        Status: 'Diproses'
      });
      r.Status = 'Diproses';
      executeBroadcastRow_(ss, r, { maxRuntimeMs: remaining });
      processed += 1;
    }

    syncContinuationTriggerState_(ss);
    if (processed > 0) {
      writeLog_('SYSTEM', 'prosesJadwalBroadcast', processed + ' antrean broadcast diproses/dilanjutkan.');
    }
    return processed;
  } finally {
    lock.releaseLock();
  }
}

function pasangTriggerBroadcast_internal_() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === 'prosesJadwalBroadcast') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('prosesJadwalBroadcast')
    .timeBased()
    .everyMinutes(5)
    .create();
  return 'Trigger otomatis Broadcast berhasil dipasang (berjalan setiap 5 menit).';
}

/**
 * Jalankan 1x dari menu Spreadsheet "DUWD DPP WI > Pasang Jadwal Otomatis Broadcast (5 Menit)".
 */
function pasangTriggerBroadcast() {
  const msg = pasangTriggerBroadcast_internal_();
  writeLog_('SUPERADMIN', 'pasangTriggerBroadcast', msg);
  try {
    SpreadsheetApp.getUi().alert('Jadwal Otomatis Aktif', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (ignore) {}
  return msg;
}



