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
      headers: ['ID_Pengurus', 'Nama_Lengkap', 'Nama_Panggilan', 'WhatsApp', 'ID_Unit', 'Nama_Unit', 'Dibuat_Pada', 'Diperbarui_Pada']
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
    }
  });

  // Seed daftar unit awal jika sheet UNIT masih hanya berisi header
  const unitSheet = ss.getSheetByName(SHEETS.UNIT);
  if (unitSheet.getLastRow() <= 1) {
    const starterUnits = [
      ['UNIT-01', 'KETUA', 'Ketua Departemen', 1, 'Ya'],
      ['UNIT-02', 'SEKRETARIS', 'Sekretaris Departemen', 2, 'Ya'],
      ['UNIT-03', 'BENDAHARA', 'Bendahara', 3, 'Ya'],
      ['UNIT-04', 'WILAYAH', 'Bidang Pembinaan Wilayah', 4, 'Ya'],
      ['UNIT-05', 'DAERAH', 'Bidang Konsolidasi Daerah', 5, 'Ya'],
      ['UNIT-06', 'ADMIN-IT', 'Bidang Administrasi & Digitalisasi', 6, 'Ya']
    ];
    unitSheet.getRange(2, 1, starterUnits.length, 5).setValues(starterUnits);
  }

  // Seed pengaturan awal jika sheet PENGATURAN masih kosong
  const settingsSheet = ss.getSheetByName(SHEETS.PENGATURAN);
  if (settingsSheet.getLastRow() <= 1) {
    const defaultSettings = [
      ['NAMA_APLIKASI', 'DUWD DPP WI', 'Judul utama aplikasi dan preview'],
      ['SUPERADMIN_PIN', 'duwd-super-2026', 'PIN akses Super Admin (bisa diubah di sini atau dari web)'],
      ['ADMIN_PIN', 'duwd-admin-2026', 'PIN akses Admin Pengurus DUWD'],
      ['LOGO_DATA_URL', '', 'URL atau Data URL logo Wahdah Islamiyah']
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 3).setValues(defaultSettings);
  }

  writeLog_('SUPERADMIN', 'setupDatabase', 'Struktur sheet UNIT, PENGURUS, PENGATURAN, dan SYSTEM_LOGS siap digunakan.');
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
          dibuatPada: String(p.Dibuat_Pada || ''),
          diperbaruiPada: String(p.Diperbarui_Pada || '')
        };
      });

      const settingsMap = getSettingsMap_();

      return jsonOut_({
        ok: true,
        data: {
          units: units,
          pengurus: pengurus,
          settings: {
            namaAplikasi: settingsMap.NAMA_APLIKASI || 'DUWD DPP WI',
            logoDataUrl: settingsMap.LOGO_DATA_URL || ''
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

      if (!namaLengkap || !namaPanggilan || !whatsapp || !unitId) {
        return jsonOut_({
          ok: false,
          error: 'Nama lengkap, nama panggilan, nomor WhatsApp, dan unit wajib diisi.'
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
        Dibuat_Pada: isEdit ? String(payload.dibuatPada || nowStr) : nowStr,
        Diperbarui_Pada: nowStr
      };

      const updated = isEdit ? updateRowById_(SHEETS.PENGURUS, 'ID_Pengurus', idPengurus, rowObj) : false;
      if (!updated) {
        appendRow_(SHEETS.PENGURUS, rowObj);
      }

      writeLog_(role.toUpperCase(), isEdit ? 'updatePengurus' : 'createPengurus', idPengurus + ' — ' + namaLengkap);

      return jsonOut_({
        ok: true,
        data: {
          id: idPengurus,
          namaLengkap: namaLengkap,
          namaPanggilan: namaPanggilan,
          whatsapp: whatsapp,
          unitId: unitId,
          namaUnit: namaUnit,
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

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
