/**
 * ============================================================================
 * DUWD DPP WI — GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * Aplikasi : Pendataan Pengurus Internal & Unit DUWD DPP Wahdah Islamiyah
 * Domain   : duwd.web.id
 *
 * CARA PASANG KE SPREADSHEET YANG SUDAH ANDA BUAT:
 * 1. Buka Google Spreadsheet yang sudah Anda buat.
 * 2. Klik menu: Extensions (Ekstensi) -> Apps Script.
 * 3. Hapus semua kode bawaan di file Code.gs, lalu tempel SEMUA kode ini.
 * 4. Tekan Ctrl+S (Simpan).
 * 5. Pilih fungsi "setupDatabase" di toolbar atas, lalu klik "Run" (1x saja).
 *    (Atau refresh Spreadsheet Anda, nanti muncul menu "DUWD DPP WI" -> "Setup Database").
 * 6. Klik "Deploy" -> "New deployment" -> Type: "Web app":
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Salin Web app URL (/exec) dan tempelkan di menu Super Admin aplikasi web.
 * ============================================================================
 */

const SHEETS = {
  PENGURUS: 'PENGURUS',
  UNIT: 'UNIT',
  PROGRAM_KERJA: 'PROGRAM_KERJA',
  KEGIATAN_RPKA: 'KEGIATAN_RPKA',
  PENGATURAN: 'PENGATURAN',
  LOGS: 'SYSTEM_LOGS'
};

/**
 * Menambahkan menu khusus di Google Spreadsheet agar mudah menjalankan setup ulang.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DUWD DPP WI')
    .addItem('Setup Database / Buat Sheet Awal', 'setupDatabase')
    .addToUi();
}

/**
 * Mengambil Spreadsheet yang terhubung (Container-bound).
 */
function getSpreadsheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Skrip ini harus dijalankan dari dalam Google Spreadsheet (Extensions > Apps Script).');
  }
  return ss;
}

/**
 * SETUP DATABASE: Membuat tab UNIT, PENGURUS, PENGATURAN, dan SYSTEM_LOGS
 * beserta header rapi dan daftar Unit awal jika masih kosong.
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
      headers: ['Kode_Kegiatan', 'Kode_Proker', 'Nama_Proker', 'Nama_Kegiatan', 'Tujuan', 'Sasaran', 'Indikator', 'Tempat', 'Waktu', 'Pendapatan', 'Belanja', 'Unit_PJ', 'Status_Pelaksanaan', 'Tautan_Drive']
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

  // Seed daftar unit awal jika sheet UNIT masih hanya berisi header
  const unitSheet = ss.getSheetByName(SHEETS.UNIT);
  if (unitSheet.getLastRow() <= 1) {
    const starterUnits = [
      ['UNIT-01', 'PI', 'Pengurus Inti (PI)', 1, 'Ya'],
      ['UNIT-02', 'WILAYAH', 'Bidang Pembinaan Wilayah', 2, 'Ya'],
      ['UNIT-03', 'DAERAH', 'Bidang Konsolidasi Daerah', 3, 'Ya'],
      ['UNIT-04', 'KADER', 'Bidang Kaderisasi & Levelisasi', 4, 'Ya'],
      ['UNIT-05', 'ADMIN-IT', 'Bidang Administrasi & Digitalisasi', 5, 'Ya']
    ];
    unitSheet.getRange(2, 1, starterUnits.length, 5).setValues(starterUnits);
  }

  // Seed 5 Program Kerja RPKA 2027 jika kosong
  const prokerSheet = ss.getSheetByName(SHEETS.PROGRAM_KERJA);
  if (prokerSheet.getLastRow() <= 1) {
    const starterProker = getStarterProkerRows_();
    prokerSheet.getRange(2, 1, starterProker.length, 4).setValues(starterProker);
  }

  // Seed 37 Kegiatan RPKA 2027 jika kosong
  const kegSheet = ss.getSheetByName(SHEETS.KEGIATAN_RPKA);
  if (kegSheet.getLastRow() <= 1) {
    const starterKegiatan = getStarterKegiatanRows_();
    kegSheet.getRange(2, 1, starterKegiatan.length, 14).setValues(starterKegiatan);
    kegSheet.getRange(2, 10, starterKegiatan.length, 2).setNumberFormat('#,##0');
  }

  // Seed pengaturan awal jika sheet PENGATURAN masih kosong
  const settingsSheet = ss.getSheetByName(SHEETS.PENGATURAN);
  if (settingsSheet.getLastRow() <= 1) {
    const defaultSettings = [
      ['NAMA_APLIKASI', 'DUWD DPP WI', 'Judul utama aplikasi dan preview'],
      ['SUPERADMIN_PIN', 'duwd-super-2026', 'PIN akses Super Admin'],
      ['ADMIN_PIN', 'duwd-admin-2026', 'PIN akses Admin Pengurus DUWD'],
      ['LOGO_DATA_URL', '', 'URL atau Data URL logo Wahdah Islamiyah'],
      ['RPKA_DRIVE_URL', '', 'Link Google Drive file PDF asli RPKA DUWD 2027']
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 3).setValues(defaultSettings);
  }

  writeLog_('SUPERADMIN', 'setupDatabase', 'Struktur sheet UNIT, PENGURUS, PROGRAM_KERJA, KEGIATAN_RPKA, PENGATURAN, dan SYSTEM_LOGS siap digunakan.');
}

/**
 * HTTP GET Handler:
 * - ?action=ping
 * - ?action=getAllData  (Publik: mengambil unit, daftar pengurus, namaAplikasi, logoUrl)
 * - ?action=verifyPin&pin=...
 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = String(params.action || 'getAllData').trim();

  try {
    if (action === 'ping') {
      return jsonOut_({
        ok: true,
        message: 'Koneksi ke Spreadsheet DUWD DPP WI berhasil.',
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
          tautanDrive: String(k.Tautan_Drive || '')
        };
      });

      const settingsMap = getSettingsMap_();

      return jsonOut_({
        ok: true,
        data: {
          units: units,
          pengurus: pengurus,
          proker: proker,
          kegiatan: kegiatan,
          settings: {
            namaAplikasi: settingsMap.NAMA_APLIKASI || 'DUWD DPP WI',
            logoDataUrl: settingsMap.LOGO_DATA_URL || '',
            rpkaDriveUrl: settingsMap.RPKA_DRIVE_URL || ''
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
 * Payload JSON: { action, pin, payload }
 * Actions:
 * - savePengurus (Admin & Super Admin)
 * - deletePengurus (Admin & Super Admin)
 * - saveUnit (Super Admin only)
 * - deleteUnit (Super Admin only)
 * - updateSettings (Super Admin only)
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

  try {
    const role = resolveRoleByPin_(pin);
    if (!role) {
      return jsonOut_({ ok: false, error: 'Akses ditolak. PIN Admin atau Super Admin tidak valid.' });
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

      const updated = isEdit ? updateRowById_(SHEETS.PENGURUS, 'ID_Pengurus', idPengurus, rowObj) : false;
      if (!updated) {
        appendRow_(SHEETS.PENGURUS, rowObj);
      }

      writeLog_(role.toUpperCase(), isEdit ? 'updatePengurus' : 'createPengurus', idPengurus + ' — ' + namaLengkap + ' (' + amanah + ')');

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
      const deleted = deleteRowById_(SHEETS.PENGURUS, 'ID_Pengurus', id);
      writeLog_(role.toUpperCase(), 'deletePengurus', id + ' (deleted=' + deleted + ')');
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
        Tautan_Drive: String(payload.tautanDrive || '').trim()
      };
      const updated = updateRowById_(SHEETS.KEGIATAN_RPKA, 'Kode_Kegiatan', kodeKegiatan, rowObj);
      if (!updated) {
        appendRow_(SHEETS.KEGIATAN_RPKA, rowObj);
      }
      writeLog_(role.toUpperCase(), 'saveKegiatan', kodeKegiatan + ' — ' + namaKegiatan);
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
          tautanDrive: rowObj.Tautan_Drive
        }
      });
    }

    if (action === 'deleteKegiatan') {
      const kode = String(payload.kodeKegiatan || '').trim();
      if (!kode) return jsonOut_({ ok: false, error: 'Kode kegiatan wajib diisi.' });
      const deleted = deleteRowById_(SHEETS.KEGIATAN_RPKA, 'Kode_Kegiatan', kode);
      writeLog_(role.toUpperCase(), 'deleteKegiatan', kode + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Kegiatan tidak ditemukan.' });
    }

    // Semua action berikut khusus SUPER ADMIN
    if (role !== 'superadmin') {
      return jsonOut_({ ok: false, error: 'Fitur ini hanya dapat diubah oleh Super Admin.' });
    }

    if (action === 'saveUnit') {
      const namaUnit = String(payload.namaUnit || '').trim();
      const kodeUnit = String(payload.kodeUnit || '').trim().toUpperCase();
      if (!namaUnit || !kodeUnit) {
        return jsonOut_({ ok: false, error: 'Kode unit dan nama unit wajib diisi.' });
      }

      const isEdit = Boolean(payload.id);
      const idUnit = isEdit ? String(payload.id).trim() : generateId_('UNIT');
      const urutan = Number(payload.urutan || 99);
      const aktif = payload.aktif === false ? 'Tidak' : 'Ya';

      const rowObj = {
        ID_Unit: idUnit,
        Kode_Unit: kodeUnit,
        Nama_Unit: namaUnit,
        Urutan: urutan,
        Aktif: aktif
      };

      const updated = isEdit ? updateRowById_(SHEETS.UNIT, 'ID_Unit', idUnit, rowObj) : false;
      if (!updated) {
        appendRow_(SHEETS.UNIT, rowObj);
      } else {
        cascadeUnitNameToPengurus_(idUnit, namaUnit);
      }

      writeLog_('SUPERADMIN', isEdit ? 'updateUnit' : 'createUnit', idUnit + ' — ' + namaUnit);

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
      const deleted = deleteRowById_(SHEETS.UNIT, 'ID_Unit', id);
      writeLog_('SUPERADMIN', 'deleteUnit', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Unit tidak ditemukan.' });
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

/**
 * Menormalkan nomor WhatsApp: 08... otomatis diubah menjadi 628...
 */
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

function appendRow_(sheetName, rowObj) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
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

function updateRowById_(sheetName, idCol, idVal, rowObj) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
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

function deleteRowById_(sheetName, idCol, idVal) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = getSpreadsheet_();
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
    appendRow_(SHEETS.LOGS, {
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

function getStarterProkerRows_() {
  return [
    ['10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', '2027', 'Bidang Pembinaan Wilayah'],
    ['10002', 'PENINGKATAN KUALITAS KELEMBAGAAN DPW DPD', '2027', 'Bidang Konsolidasi Daerah'],
    ['10003', 'PENINGKATAN KUALITAS PENGURUS DPW DAN DPD', '2027', 'Bidang Kaderisasi & Levelisasi'],
    ['10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', '2027', 'Bidang Pembinaan Wilayah'],
    ['10005', 'PENINGKATAN KINERJA, MUTU, DAN INOVASI INTERNAL', '2027', 'Bidang Administrasi & Digitalisasi']
  ];
}

function getStarterKegiatanRows_() {
  return [
    ['10001.00001', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Akselerasi Pembentukan DPD', 'Memaksimalkan kesiapan real semua unsur di kabupaten/kota yang menjadi target pembentukan DPD', 'Calon DPD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 128975000, '', 'Rencana', ''],
    ['10001.00002', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Orientasi Dai Utusan', 'Memberikan wawasan dan ilmu kepada calon dai yang menunjang kinerja dai di tempat tugas', 'Calon Dai utusan', '1 kali', 'Makassar', '2026-08-15 - 2026-08-15', 20000000, 10325000, '', 'Rencana', ''],
    ['10001.00003', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Penempatan dan pemberangkatan Dai Utusan', 'Menjaga keberlangsungan dakwah di daerah', 'Dai Utusan', '1 kali', 'Online', '2027-09-01 - 2027-10-31', 1000000000, 898575000, '', 'Rencana', ''],
    ['10001.00004', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Pengontrolan dan Evaluasi Dai Utusan', 'Menjaga dai agar tetap semangat menjalankan amanah di tempat tugas serta sebagai wadah problem solving dai utusan', 'Dai utusan', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 109000000, 6002400000, '', 'Rencana', ''],
    ['10001.00005', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Liqa Maftuh Dai Utusan', 'Mendengarkan aspirasi dari DPD/DPW, memberikan penguatan dan arahan untuk menjaga soliditas serta pengembangan kapasitas DPD/DPW', 'Dai utusan', '2 kali', 'Online', '2027-02-01 - 2027-02-01, 2027-10-01 - 2027-10-01', 0, 2800000, '', 'Rencana', ''],
    ['10001.00006', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Khidmah DPW DPD', 'Memberikan pelayanan kepada DPW/DPD sesuai dengan kebutuhan', 'DPW/DPD', '12 kali', 'Makassar', '2027-01-01 - 2027-11-30', 0, 14000000, '', 'Rencana', ''],
    ['10001.00007', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Kunjungan Unsur PH DPP', 'Memberikan penguatan, motivasi dan arahan untuk menjaga soliditas dalam pengembangan kapasitas DPW/DPD', 'DPW/DPD', '1 kali', 'Menyesuaikan', '2027-01-01 - 2027-11-30', 0, 134407000, '', 'Rencana', ''],
    ['10001.00008', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Koordinasi Pendampingan 4M (MUSWIL, MUKERWIL, MUSDA dan MUKERDA)', 'Memberikan arahan dan penguatan demi kesuksesan pelaksanaan kegiatan 4M', 'DPW/DPD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 350000, '', 'Rencana', ''],
    ['10001.00009', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Monev Musyrif DPW', 'Menjaga kestabilan semangat musyrif dan asisten musyrif', 'Musyrif DPW', '12 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 14400000, '', 'Rencana', ''],
    ['10001.00010', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Monev DUDC DPW', 'Mengontrol dan mengevaluasi kinerja DPW/DPD dalam pembentukan cabang', 'DUDC DPW', '12 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 6600000, '', 'Rencana', ''],
    ['10001.00011', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Monev Persaudaraan DPW DPD', 'Mengontrol dan mengevaluasi keberlangsungan persaudaraan DPW/DPD', 'DPW/DPD', '12 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 6000000, '', 'Rencana', ''],
    ['10001.00012', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Koordinasi Sharing Inspirasi Lintas DPW DPD', 'Menumbuhkan semangat kolaborasi dan sinergitas dalam melakukan akselerasi pencapaian visi bersama', 'DPW/DPD', '12 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 800000, '', 'Rencana', ''],
    ['10001.00013', '10001', 'PENDIRIAN DAN PEMBINAAN DPW DPD', 'Monev Persaudaraan Dai Utusan', 'Menjaga dai agar tetap semangat menjalankan amanah di tempat tugas, serta sebagai wadah untuk menguatkan dan menjaga ukhuwah di antara dai', 'Dai utusan', '12 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 2400000, '', 'Rencana', ''],
    ['10002.00001', '10002', 'PENINGKATAN KUALITAS KELEMBAGAAN DPW DPD', 'Kelas Akselerasi DPW DPD', 'Menambah wawasan dan sebagai wadah berbagi inspirasi dan motivasi sesama DPW dan DPD', 'DPW DPD', '2 kali', 'Online', '2027-04-01 - 2027-04-30, 2027-09-01 - 2027-09-30', 0, 8250000, '', 'Rencana', ''],
    ['10002.00002', '10002', 'PENINGKATAN KUALITAS KELEMBAGAAN DPW DPD', 'Tata Kelola Kelembagaan dan Persaudaraan Award DPW DPD', 'Meningkatkan motivasi dan mutu tata kelola kelembagaan DPW dan DPD dan menguatkan ukhuwah antar DPW dan DPD', 'DPW dan DPD', '1 kali', 'Menyesuaikan Mukernas', '2027-11-01 - 2027-11-01', 30000000, 30625000, '', 'Rencana', ''],
    ['10002.00003', '10002', 'PENINGKATAN KUALITAS KELEMBAGAAN DPW DPD', 'Pekan Pendalaman Dokumen Organisasi', 'Mendorong peningkatan kapasitas dan Kinerja Organisasi melalui pendalaman dokumen Organisasi', 'DPW dan DPD', '1 kali', 'Online', '2027-09-15 - 2027-09-15', 0, 6375000, '', 'Rencana', ''],
    ['10002.00004', '10002', 'PENINGKATAN KUALITAS KELEMBAGAAN DPW DPD', 'Levelisasi DPW DPD', 'Untuk mengetahui kondisi atau level setiap DPW dan DPD serta memberikan perlakuan sesuai dengan levelnya masing-masing', 'DPW dan DPD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 1750000, '', 'Rencana', ''],
    ['10003.00001', '10003', 'PENINGKATAN KUALITAS PENGURUS DPW DAN DPD', 'TOT Upgrading Pengurus DPW dan DPD', 'Melahirkan trainer dan meningkatkan kualitas pengurus DPW dan DPD', 'Utusan DPW yang belum memiliki trainer dan pengurus DPW/DPD', '1 kali', 'Online', '2027-03-21 - 2027-03-21', 8500000, 10130000, '', 'Rencana', ''],
    ['10003.00002', '10003', 'PENINGKATAN KUALITAS PENGURUS DPW DAN DPD', 'Kajian Wawasan Tematik Pengurus DPW dan DPD', 'Meningkatkan kualitas pengurus dari segi wawasan untuk menunjang kinerja/pelaksanaan amanah pengurus', 'DPW dan DPD', '2 kali', 'Online', '2027-04-01 - 2027-04-01, 2027-06-01 - 2027-06-01', 0, 2100000, '', 'Rencana', ''],
    ['10003.00003', '10003', 'PENINGKATAN KUALITAS PENGURUS DPW DAN DPD', 'Majelis Kepemimpinan', 'Meningkatkan kehadiran pimpinan atau rasa kebersamaan antara ketua dan pengurus DPW/DPD dengan pimpinan DPP', 'Ketua DPW dan DPD serta 3-5 orang PH yang direkomendasikan', '1 kali', 'Online', '2027-05-14 - 2027-05-14', 0, 1250000, '', 'Rencana', ''],
    ['10003.00004', '10003', 'PENINGKATAN KUALITAS PENGURUS DPW DAN DPD', 'Sekolah Kepemimpinan', 'Meningkatkan kemampuan kepemimpinan para pengurus inti dan ketua departemen setiap DPW', 'DPW DPD', '2 kali', 'Online', '2027-07-09 - 2027-07-09, 2027-10-15 - 2027-10-15', 17500000, 9350000, '', 'Rencana', ''],
    ['10004.00001', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Rapat Khusus DUWD DPP dengan DPW', 'Memberikan arahan untuk mewujudkan target target strategis DPW dan Visi 2030 WI', 'DPW', '2 kali', 'Online', '2027-01-03 - 2027-01-03, 2027-08-29 - 2027-08-29', 0, 1050000, '', 'Rencana', ''],
    ['10004.00002', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Level DPW DPD', 'Mengontrol pengawalan DPW dan DPD untuk peningkatan level', 'DPW dan DPD', '12 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 400000, '', 'Rencana', ''],
    ['10004.00003', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Pelaksanaan Pekan Pendalaman Dokumen Organisasi', 'Mengontrol pelaksanaan Pekan Evaluasi Pendalaman Dokumen Organisasi', 'DPW dan DPD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 13200000, '', 'Rencana', ''],
    ['10004.00004', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Pelaksanaan Tata Kelola Kelembagaan Award di DPW', 'Mengontrol pelaksanaan tata kelola kelembagaan award di tingkat wilayah', 'DPW DPD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 13200000, '', 'Rencana', ''],
    ['10004.00005', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Pelaksanaan Upgrading Pengurus DPW DPD', 'Meningkatkan kualitas pengurus DPW dan DPD', 'DPW/DPD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 13200000, '', 'Rencana', ''],
    ['10004.00006', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Pelaksanaan Pengajian Pengurus DPW DPD', 'Meningkatkan kualitas pengurus dari sisi ruhiyah untuk menunjang kinerja/pelaksanaan amanah pengurus', 'DPW/DPD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 13200000, '', 'Rencana', ''],
    ['10004.00007', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Pengurusan SKKO DPW DPD', 'Meningkatkan kepercayaan masyarakat dan pemerintah terhadap DPD dan DPW', 'DPD dan DPW', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 13200000, '', 'Rencana', ''],
    ['10004.00008', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Pendampingan Pengadaan Kantor oleh DPW DPD', 'Mengontrol pelaksanaan pengadaan kantor DPW dan DPD', 'DPW dan DPD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 13200000, '', 'Rencana', ''],
    ['10004.00009', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Pengadaan Staf Administrasi Sekretariat di DPW DPD', 'Meningkatkan tata kelola kelembagaan DPD dan DPW', 'DPW dan DPD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 24000000, '', 'Rencana', ''],
    ['10004.00010', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Penerapan Standar Tata Kelola Kelembagaan di DPW DPD', 'Memberikan acuan kerja yang dapat menunjang tata kelola kelembagaan yang efektif dan efisien', 'DPW dan DPD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 13200000, '', 'Rencana', ''],
    ['10004.00011', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Kepanitiaan Amaliah Ramadan di DPW DPD', 'Memastikan program Amaliah Ramadan terlaksana secara optimal dan meningkatkan kualitas tata kelola kepanitiaan', 'DPD dan DPW', '1 kali', 'Online', '2027-01-01 - 2027-03-15', 0, 2200000, '', 'Rencana', ''],
    ['10004.00012', '10004', 'MONITORING DAN EVALUASI KINERJA DPW DPD', 'Monev Kepanitiaan Zulhijah di DPW DPD', 'Memastikan program Amaliah Ramadan terlaksana secara optimal dan meningkatkan kualitas tata kelola kepanitiaan (catatan: konteks operasional adalah kepanitiaan Zulhijah/Qurban)', 'DPD dan DPW', '1 kali', 'Online', '2027-04-01 - 2027-05-31', 0, 2200000, '', 'Rencana', ''],
    ['10005.00001', '10005', 'PENINGKATAN KINERJA, MUTU, DAN INOVASI INTERNAL', 'Kajian kelembagaan pengurus DUWD', 'Meningkatkan pemahaman pengurus DUWD terhadap AD ART, Renstra, Manajemen Lembaga, dan apa yang terkait dengan itu', 'Pengurus DUWD', '2 kali', 'Online', '2027-04-17 - 2027-04-17, 2027-10-09 - 2027-10-09', 0, 1100000, '', 'Rencana', ''],
    ['10005.00002', '10005', 'PENINGKATAN KINERJA, MUTU, DAN INOVASI INTERNAL', 'Pengembangan system database online lingkup kerja DUWD', 'Untuk memudahkan dalam pendataan, pengolahan perkembagan, dan penggunaan data DPW dan DPD khususnya dalam hal pencapaian Visi 2030', 'Data lingkup kerja DUWD', '1 kali', 'Online', '2027-01-01 - 2027-11-30', 0, 18125000, '', 'Rencana', ''],
    ['10005.00003', '10005', 'PENINGKATAN KINERJA, MUTU, DAN INOVASI INTERNAL', 'Pembuatan panduan kelembagaan DPW/DPD pada lingkup kerja DUWD', 'Untuk menyeragamkan panduan kelembagaan yang bisa digunakan secara seragam untuk DPW/DPD', 'Data lingkup kerja DUWD', '1 kali', 'Makassar', '2027-01-01 - 2027-11-30', 0, 3200000, '', 'Rencana', ''],
    ['10005.00004', '10005', 'PENINGKATAN KINERJA, MUTU, DAN INOVASI INTERNAL', 'Musyawarah Departemen', 'Mengevaluasi dan menyelaraskan program kerja departemen serta merumuskan langkah strategis yang terukur untuk meningkatkan efektivitas pelaksanaan program DUWD', 'Pengurus DUWD', '40 kali', 'Hybrid', '2027-01-01 - 2027-11-30', 0, 3120000, '', 'Rencana', '']
  ];
}
