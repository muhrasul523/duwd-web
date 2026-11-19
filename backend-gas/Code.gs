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

/**
 * Menambahkan menu khusus di Google Spreadsheet Induk.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DUWD DPP WI')
    .addItem('Setup Database Induk', 'setupDatabase')
    .addItem('Otorisasi Drive & Docs (Upload Musyawarah)', 'otorisasiGoogleDrive')
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
      headers: ['ID_Pengurus', 'Nama_Lengkap', 'Nama_Panggilan', 'WhatsApp', 'ID_Unit', 'Nama_Unit', 'Amanah', 'Dibuat_Pada', 'Diperbarui_Pada']
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
      ['MUSYAWARAH_DRIVE_FOLDER_ID', DEFAULT_MUSYAWARAH_DRIVE_FOLDER_ID, 'ID Folder Google Drive penyimpanan Notula & Dokumentasi Musyawarah']
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 3).setValues(defaultSettings);
  } else {
    ensureSettingKey_('WILAYAH_SPREADSHEET_ID', '', 'ID atau URL Google Spreadsheet #2 (DPW, DPD, DPC, DPR)');
    ensureSettingKey_('MUSYAWARAH_DRIVE_FOLDER_ID', DEFAULT_MUSYAWARAH_DRIVE_FOLDER_ID, 'ID Folder Google Drive penyimpanan Notula & Dokumentasi Musyawarah');
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
 * Jalankan 1x dari editor Apps Script atau menu Spreadsheet "DUWD DPP WI > Otorisasi Drive & Docs"
 * agar izin Google Drive (upload notula/foto) dan Google Docs (konversi teks notula -> PDF) aktif.
 */
function otorisasiGoogleDrive() {
  const folder = getMusyawarahDriveFolder_();
  const testDoc = DocumentApp.create('DUWD_Test_Otorisasi_Sementara');
  const testId = testDoc.getId();
  testDoc.saveAndClose();
  const testFile = DriveApp.getFileById(testId);
  testFile.setTrashed(true);
  const msg = 'Otorisasi Google Drive & Google Docs BERHASIL untuk folder: "' + folder.getName() + '" (ID: ' + folder.getId() + ').';
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
        'Alamat_Kantor',
        'Tautan_Drive',
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
        'Alamat_Kantor',
        'Tautan_Drive',
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
        'Alamat_Kantor',
        'Tautan_Drive',
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
        'Alamat_Kantor',
        'Tautan_Drive',
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
        return {
          id: String(p.ID_Pengurus || ''),
          namaLengkap: String(p.Nama_Lengkap || ''),
          namaPanggilan: String(p.Nama_Panggilan || ''),
          whatsapp: normalizeWaNumber_(p.WhatsApp || ''),
          unitId: String(p.ID_Unit || ''),
          namaUnit: String(p.Nama_Unit || ''),
          amanah: String(p.Amanah || ''),
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
    uploadMusyawarahNotulaText: true
  };

  try {
    const role = resolveRoleByPin_(pin);
    if (!role) {
      return jsonOut_({ ok: false, error: 'Akses ditolak. PIN tidak valid.' });
    }
    if (role !== 'superadmin' && !(role === 'admin' && ADMIN_ALLOWED_ACTIONS[action])) {
      return jsonOut_({
        ok: false,
        error: 'Akses terbatas: Admin hanya dapat mengedit kontak DPW/DPD/DPC/DPR, menandai Event/Monev, serta mengelola musyawarah & presensi.'
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

      const unitMap = getUnitById_(unitId);
      const namaUnit = unitMap ? String(unitMap.Nama_Unit) : String(payload.namaUnit || '');
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');

      const isEdit = Boolean(payload.id);
      const idPengurus = isEdit ? String(payload.id).trim() : generateId_('PGR');

      const rowObj = {
        ID_Pengurus: idPengurus,
        Nama_Lengkap: namaLengkap,
        Nama_Panggilan: namaPanggilan,
        WhatsApp: whatsapp,
        ID_Unit: unitId,
        Nama_Unit: namaUnit,
        Amanah: amanah,
        Dibuat_Pada: isEdit ? String(payload.dibuatPada || nowStr) : nowStr,
        Diperbarui_Pada: nowStr
      };

      const ss = getSpreadsheet_();
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

      const existing = findRowInSs_(wSs, WILAYAH_SHEETS.DPW, payload.id ? 'ID_DPW' : 'Kode_Wilayah', payload.id || kodeWilayah)
        || findRowInSs_(wSs, WILAYAH_SHEETS.DPW, 'Kode_Wilayah', kodeWilayah);
      const existingId = existing ? String(existing.ID_DPW || '').trim() : '';
      const idDpw = existingId || (payload.id ? String(payload.id).trim() : generateId_('DPW'));
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');

      const rowObj = role === 'admin'
        ? {
            ID_DPW: idDpw,
            Kode_Wilayah: existing ? String(existing.Kode_Wilayah) : kodeWilayah,
            Pulau: existing ? String(existing.Pulau) : String(payload.pulau || '').trim(),
            Nama_DPW: existing ? String(existing.Nama_DPW) : namaDpw,
            Nama_Provinsi: existing ? String(existing.Nama_Provinsi) : namaProvinsi,
            Status_Terbentuk: existing ? String(existing.Status_Terbentuk || 'Belum Terbentuk') : 'Belum Terbentuk',
            Ketua_Nama: String(payload.ketuaNama || '').trim(),
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: String(payload.sekretarisNama || '').trim(),
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Alamat_Kantor: existing ? String(existing.Alamat_Kantor || '') : '',
            Tautan_Drive: existing ? String(existing.Tautan_Drive || '') : '',
            Diperbarui_Pada: nowStr
          }
        : {
            ID_DPW: idDpw,
            Kode_Wilayah: kodeWilayah,
            Pulau: String(payload.pulau || '').trim(),
            Nama_DPW: namaDpw,
            Nama_Provinsi: namaProvinsi,
            Status_Terbentuk: String(payload.statusTerbentuk || 'Sudah Terbentuk').trim(),
            Ketua_Nama: String(payload.ketuaNama || '').trim(),
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: String(payload.sekretarisNama || '').trim(),
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Alamat_Kantor: String(payload.alamatKantor || '').trim(),
            Tautan_Drive: String(payload.tautanDrive || '').trim(),
            Diperbarui_Pada: nowStr
          };

      const updated = existing
        ? updateRowByIdInSs_(
            wSs,
            WILAYAH_SHEETS.DPW,
            existingId ? 'ID_DPW' : 'Kode_Wilayah',
            existingId || kodeWilayah,
            rowObj
          )
        : false;
      if (!updated) {
        appendRowInSs_(wSs, WILAYAH_SHEETS.DPW, rowObj);
      }

      writeLog_(role.toUpperCase(), existing ? 'updateDpw' : 'createDpw', kodeWilayah + ' — ' + rowObj.Nama_DPW);
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
      const namaDpd = String(payload.namaDpd || ('DPD Wahdah Islamiyah ' + namaKabKota)).trim();
      if (!kodeWilayah || !namaKabKota) {
        return jsonOut_({ ok: false, error: 'Kode wilayah dan nama Kab/Kota wajib diisi.' });
      }

      const existing = findRowInSs_(wSs, WILAYAH_SHEETS.DPD, payload.id ? 'ID_DPD' : 'Kode_Wilayah', payload.id || kodeWilayah)
        || findRowInSs_(wSs, WILAYAH_SHEETS.DPD, 'Kode_Wilayah', kodeWilayah);
      const existingId = existing ? String(existing.ID_DPD || '').trim() : '';
      const idDpd = existingId || (payload.id ? String(payload.id).trim() : generateId_('DPD'));
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const kodeProv = String(payload.kodeProvinsi || kodeWilayah.split('.')[0] || '').trim();

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
            Ketua_Nama: String(payload.ketuaNama || '').trim(),
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: String(payload.sekretarisNama || '').trim(),
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Alamat_Kantor: existing ? String(existing.Alamat_Kantor || '') : '',
            Tautan_Drive: existing ? String(existing.Tautan_Drive || '') : '',
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
            Ketua_Nama: String(payload.ketuaNama || '').trim(),
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: String(payload.sekretarisNama || '').trim(),
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Alamat_Kantor: String(payload.alamatKantor || '').trim(),
            Tautan_Drive: String(payload.tautanDrive || '').trim(),
            Diperbarui_Pada: nowStr
          };

      const updated = existing
        ? updateRowByIdInSs_(
            wSs,
            WILAYAH_SHEETS.DPD,
            existingId ? 'ID_DPD' : 'Kode_Wilayah',
            existingId || kodeWilayah,
            rowObj
          )
        : false;
      if (!updated) {
        appendRowInSs_(wSs, WILAYAH_SHEETS.DPD, rowObj);
      }

      writeLog_(role.toUpperCase(), existing ? 'updateDpd' : 'createDpd', kodeWilayah + ' — ' + rowObj.Nama_DPD);
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
      const namaDpc = String(payload.namaDpc || ('DPC Wahdah Islamiyah ' + namaKecamatan)).trim();
      if (!kodeWilayah || !namaKecamatan) {
        return jsonOut_({ ok: false, error: 'Kode wilayah dan nama Kecamatan wajib diisi.' });
      }

      const existing = findRowInSs_(wSs, WILAYAH_SHEETS.DPC, payload.id ? 'ID_DPC' : 'Kode_Wilayah', payload.id || kodeWilayah)
        || findRowInSs_(wSs, WILAYAH_SHEETS.DPC, 'Kode_Wilayah', kodeWilayah);
      const existingId = existing ? String(existing.ID_DPC || '').trim() : '';
      const idDpc = existingId || (payload.id ? String(payload.id).trim() : generateId_('DPC'));
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const segs = kodeWilayah.split('.');
      const kodeKab = String(payload.kodeKabKota || segs.slice(0, 2).join('.') || '').trim();
      const kodeProv = String(payload.kodeProvinsi || segs[0] || '').trim();

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
            Ketua_Nama: String(payload.ketuaNama || '').trim(),
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: String(payload.sekretarisNama || '').trim(),
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Alamat_Kantor: existing ? String(existing.Alamat_Kantor || '') : '',
            Tautan_Drive: existing ? String(existing.Tautan_Drive || '') : '',
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
            Ketua_Nama: String(payload.ketuaNama || '').trim(),
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: String(payload.sekretarisNama || '').trim(),
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Alamat_Kantor: String(payload.alamatKantor || '').trim(),
            Tautan_Drive: String(payload.tautanDrive || '').trim(),
            Diperbarui_Pada: nowStr
          };

      const updated = existing
        ? updateRowByIdInSs_(
            wSs,
            WILAYAH_SHEETS.DPC,
            existingId ? 'ID_DPC' : 'Kode_Wilayah',
            existingId || kodeWilayah,
            rowObj
          )
        : false;
      if (!updated) {
        appendRowInSs_(wSs, WILAYAH_SHEETS.DPC, rowObj);
      }

      writeLog_(role.toUpperCase(), existing ? 'updateDpc' : 'createDpc', kodeWilayah + ' — ' + rowObj.Nama_DPC);
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
      const namaDpr = String(payload.namaDpr || ('DPR Wahdah Islamiyah ' + namaKelDesa)).trim();
      if (!kodeWilayah || !namaKelDesa) {
        return jsonOut_({ ok: false, error: 'Kode wilayah dan nama Kelurahan/Desa wajib diisi.' });
      }

      const existing = findRowInSs_(wSs, WILAYAH_SHEETS.DPR, payload.id ? 'ID_DPR' : 'Kode_Wilayah', payload.id || kodeWilayah)
        || findRowInSs_(wSs, WILAYAH_SHEETS.DPR, 'Kode_Wilayah', kodeWilayah);
      const existingId = existing ? String(existing.ID_DPR || '').trim() : '';
      const idDpr = existingId || (payload.id ? String(payload.id).trim() : generateId_('DPR'));
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const segs = kodeWilayah.split('.');
      const kodeKec = String(payload.kodeKecamatan || segs.slice(0, 3).join('.') || '').trim();
      const kodeKab = String(payload.kodeKabKota || segs.slice(0, 2).join('.') || '').trim();
      const kodeProv = String(payload.kodeProvinsi || segs[0] || '').trim();

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
            Ketua_Nama: String(payload.ketuaNama || '').trim(),
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: String(payload.sekretarisNama || '').trim(),
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Alamat_Kantor: existing ? String(existing.Alamat_Kantor || '') : '',
            Tautan_Drive: existing ? String(existing.Tautan_Drive || '') : '',
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
            Ketua_Nama: String(payload.ketuaNama || '').trim(),
            Ketua_WA: normalizeWaNumber_(payload.ketuaWa || ''),
            Sekretaris_Nama: String(payload.sekretarisNama || '').trim(),
            Sekretaris_WA: normalizeWaNumber_(payload.sekretarisWa || ''),
            Alamat_Kantor: String(payload.alamatKantor || '').trim(),
            Tautan_Drive: String(payload.tautanDrive || '').trim(),
            Diperbarui_Pada: nowStr
          };

      const updated = existing
        ? updateRowByIdInSs_(
            wSs,
            WILAYAH_SHEETS.DPR,
            existingId ? 'ID_DPR' : 'Kode_Wilayah',
            existingId || kodeWilayah,
            rowObj
          )
        : false;
      if (!updated) {
        appendRowInSs_(wSs, WILAYAH_SHEETS.DPR, rowObj);
      }

      writeLog_(role.toUpperCase(), existing ? 'updateDpr' : 'createDpr', kodeWilayah + ' — ' + rowObj.Nama_DPR);
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

