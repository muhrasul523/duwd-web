/**
 * ============================================================================
 * DUWD DPP WAHDAH ISLAMIYAH — GOOGLE APPS SCRIPT ALL-IN-ONE (Code.gs)
 * Domain : duwd.web.id
 * Cara Pakai:
 * 1. Buka https://script.google.com -> New project
 * 2. Hapus seluruh isi Code.gs bawaan, lalu tempel SEMUA kode di file ini.
 * 3. Simpan (Ctrl+S), pilih fungsi "initializeDUWDStructure" di toolbar atas,
 *    lalu klik "Run" (1x saja) untuk membuat Google Sheets otomatis.
 * 4. Klik "Deploy" -> "New deployment" -> Type: "Web app"
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Salin URL Web App (/exec) yang muncul, lalu tempel di menu Backend GAS
 *    pada website duwd.web.id.
 * ============================================================================
 */

const DUWD_CONFIG = {
  APP_NAME: 'DUWD DPP Wahdah Islamiyah API',
  DOMAIN: 'duwd.web.id',
  // Biarkan default jika ingin dibuat otomatis oleh initializeDUWDStructure()
  DEFAULT_SPREADSHEET_ID: '',
  // Opsional: isi nanti jika integrasi folder Google Drive sudah dibutuhkan
  DEFAULT_DRIVE_ROOT_ID: '',
  // Opsional: isi token rahasia jika ingin membatasi akses POST
  API_SECRET_TOKEN: '',
  SHEETS: {
    DPW_DPD: 'DPW_DPD',
    AGENDA_4M: 'AGENDA_4M',
    KADER_LEVEL: 'KADER_LEVEL',
    ARSIP_DRIVE: 'ARSIP_DRIVE',
    KHIDMAT_MASUK: 'KHIDMAT_MASUK',
    SYSTEM_LOGS: 'SYSTEM_LOGS'
  }
};

function getRuntimeConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || DUWD_CONFIG.DEFAULT_SPREADSHEET_ID,
    driveRootId: props.getProperty('DRIVE_ROOT_FOLDER_ID') || DUWD_CONFIG.DEFAULT_DRIVE_ROOT_ID,
    apiToken: props.getProperty('API_SECRET_TOKEN') || DUWD_CONFIG.API_SECRET_TOKEN
  };
}

/**
 * HTTP GET Handler — ping, overview, listRecords, listDriveFiles
 */
function doGet(e) {
  const params = (e && e.parameter) ? e.parameter : {};
  const action = String(params.action || 'ping').trim();

  try {
    switch (action) {
      case 'ping':
        return createJsonResponse_({
          ok: true,
          service: DUWD_CONFIG.APP_NAME,
          domain: DUWD_CONFIG.DOMAIN,
          timestamp: new Date().toISOString(),
          message: 'Koneksi Google Apps Script aktif dan siap melayani permintaan.'
        });

      case 'overview': {
        const summary = computeGovernanceSummary();
        return createJsonResponse_({
          ok: true,
          action: 'overview',
          data: summary,
          timestamp: new Date().toISOString()
        });
      }

      case 'listRecords': {
        const sheetKey = String(params.sheet || 'DPW_DPD').toUpperCase();
        const sheetName = DUWD_CONFIG.SHEETS[sheetKey] || DUWD_CONFIG.SHEETS.DPW_DPD;
        const filters = {
          dpw: params.dpw || '',
          status: params.status || '',
          jenis: params.jenis || '',
          kategori: params.kategori || '',
          search: params.search || ''
        };
        const rows = readSheetRows(sheetName, filters);
        return createJsonResponse_({
          ok: true,
          action: 'listRecords',
          sheet: sheetName,
          count: rows.length,
          data: rows
        });
      }

      case 'listDriveFiles': {
        const rows = readSheetRows(DUWD_CONFIG.SHEETS.ARSIP_DRIVE, {
          kategori: params.kategori || '',
          dpw: params.dpw || '',
          search: params.search || ''
        });
        return createJsonResponse_({
          ok: true,
          action: 'listDriveFiles',
          count: rows.length,
          data: rows
        });
      }

      default:
        return createJsonResponse_({
          ok: false,
          error: 'Action GET tidak dikenali: ' + action
        });
    }
  } catch (err) {
    logActivity_('SYSTEM', 'doGet:' + action, 'API_ROUTER', 'ERROR', err.message);
    return createJsonResponse_({
      ok: false,
      action: action,
      error: err.message
    });
  }
}

/**
 * HTTP POST Handler — createKhidmat, upsert4M, registerDriveLink
 */
function doPost(e) {
  let body = {};
  try {
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
  } catch (parseErr) {
    return createJsonResponse_({
      ok: false,
      error: 'Payload JSON tidak valid: ' + parseErr.message
    });
  }

  const action = String(body.action || '').trim();
  const payload = body.payload || {};
  const cfg = getRuntimeConfig_();

  if (cfg.apiToken && body.token !== cfg.apiToken) {
    logActivity_(payload.nama || 'ANON', 'doPost:' + action, 'AUTH', 'DENIED', 'Token tidak sesuai');
    return createJsonResponse_({ ok: false, error: 'Otorisasi token tidak valid.' });
  }

  try {
    switch (action) {
      case 'createKhidmat': {
        const requiredFields = ['nama', 'asalUnit', 'kontak', 'kategori', 'perihal'];
        for (let i = 0; i < requiredFields.length; i++) {
          const field = requiredFields[i];
          if (!payload[field] || String(payload[field]).trim() === '') {
            return createJsonResponse_({ ok: false, error: 'Kolom wajib belum diisi: ' + field });
          }
        }

        const ticketId = generateTicketId_('KHD');
        const driveId = payload.driveUrl ? extractDriveFileId(payload.driveUrl) : '';
        const newRecord = {
          ID_Tiket: ticketId,
          Tanggal_Masuk: Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss'),
          Nama_Pengurus: String(payload.nama).trim(),
          Asal_DPW_DPD: String(payload.asalUnit).trim(),
          Kontak: String(payload.kontak).trim(),
          Kategori_Layanan: String(payload.kategori).trim(),
          Perihal: String(payload.perihal).trim(),
          Detail_Permohonan: String(payload.detail || '').trim(),
          Drive_File_ID: driveId,
          Tautan_Lampiran: String(payload.driveUrl || '').trim(),
          Status: 'Diterima'
        };

        appendSheetRow(DUWD_CONFIG.SHEETS.KHIDMAT_MASUK, newRecord);
        logActivity_(newRecord.Nama_Pengurus, 'createKhidmat', 'KHIDMAT', 'SUCCESS', ticketId + ' — ' + newRecord.Asal_DPW_DPD);

        return createJsonResponse_({
          ok: true,
          action: 'createKhidmat',
          ticketId: ticketId,
          data: newRecord,
          message: 'Permohonan Layanan Khidmat berhasil dicatat dengan nomor tiket ' + ticketId
        });
      }

      case 'upsert4M': {
        if (!payload.jenis || !payload.wilayah || !payload.tanggalPelaksanaan) {
          return createJsonResponse_({
            ok: false,
            error: 'Data jenis 4M, wilayah/daerah, dan tanggal pelaksanaan wajib diisi.'
          });
        }

        const agendaId = payload.id || generateTicketId_('4M');
        const rowObj = {
          ID_Agenda: agendaId,
          Jenis_4M: String(payload.jenis).trim(),
          Nama_Kegiatan: String(payload.judul || (payload.jenis + ' ' + payload.wilayah)).trim(),
          Wilayah_Daerah: String(payload.wilayah).trim(),
          Tanggal_Pelaksanaan: String(payload.tanggalPelaksanaan).trim(),
          Lokasi: String(payload.lokasi || 'Daring / Hibrid').trim(),
          Status: String(payload.status || 'Persiapan').trim(),
          Progres_Persen: Number(payload.progres || 0),
          Tautan_SK_Drive: String(payload.skDriveUrl || '').trim(),
          Diperbarui_Pada: Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss')
        };

        const updated = payload.id
          ? updateSheetRowById(DUWD_CONFIG.SHEETS.AGENDA_4M, 'ID_Agenda', agendaId, rowObj)
          : false;

        if (!updated) {
          appendSheetRow(DUWD_CONFIG.SHEETS.AGENDA_4M, rowObj);
        }

        logActivity_(payload.actor || 'Admin DUWD', 'upsert4M', 'AGENDA_4M', 'SUCCESS', agendaId + ' (' + rowObj.Jenis_4M + ')');

        return createJsonResponse_({
          ok: true,
          action: 'upsert4M',
          data: rowObj,
          message: 'Agenda 4M berhasil disimpan.'
        });
      }

      case 'registerDriveLink': {
        if (!payload.driveUrl || !payload.judul) {
          return createJsonResponse_({
            ok: false,
            error: 'Judul berkas dan tautan Google Drive wajib disertakan.'
          });
        }

        const fileId = extractDriveFileId(payload.driveUrl);
        const arsipId = generateTicketId_('ARS');
        const links = buildDriveAccessLinks_(fileId);

        const record = {
          ID_Arsip: arsipId,
          Drive_File_ID: fileId || 'EXTERNAL',
          Judul_Berkas: String(payload.judul).trim(),
          Kategori: String(payload.kategori || 'Pedoman & Tata Kelola').trim(),
          Format_Berkas: String(payload.format || 'PDF').trim(),
          Unit_DPW: String(payload.dpw || 'DPP DUWD').trim(),
          Ukuran_Teks: 'Tautan Cloud',
          URL_Asli: links.viewUrl || String(payload.driveUrl).trim(),
          URL_Pratinjau: links.previewUrl,
          URL_Unduh: links.downloadUrl || String(payload.driveUrl).trim(),
          Diunggah_Pada: Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd')
        };

        appendSheetRow(DUWD_CONFIG.SHEETS.ARSIP_DRIVE, record);
        logActivity_(payload.actor || 'Admin DUWD', 'registerDriveLink', 'ARSIP_DRIVE', 'SUCCESS', arsipId + ' — ' + record.Judul_Berkas);

        return createJsonResponse_({
          ok: true,
          action: 'registerDriveLink',
          data: record,
          message: 'Tautan berkas berhasil disimpan ke sheet ARSIP_DRIVE.'
        });
      }

      default:
        return createJsonResponse_({ ok: false, error: 'Action POST tidak dikenali: ' + action });
    }
  } catch (err) {
    logActivity_(payload.nama || 'SYSTEM', 'doPost:' + action, 'API_ROUTER', 'ERROR', err.message);
    return createJsonResponse_({ ok: false, action: action, error: err.message });
  }
}

/* =========================== SHEET HELPERS =========================== */

function getMasterSpreadsheet_() {
  const cfg = getRuntimeConfig_();
  if (!cfg.spreadsheetId) {
    throw new Error('Spreadsheet belum dibuat. Jalankan fungsi initializeDUWDStructure() 1x dari editor Apps Script.');
  }
  return SpreadsheetApp.openById(cfg.spreadsheetId);
}

function getSheetByNameSafe(sheetName) {
  const ss = getMasterSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Tab sheet "' + sheetName + '" tidak ditemukan. Jalankan initializeDUWDStructure().');
  }
  return sheet;
}

function readSheetRows(sheetName, filters) {
  const sheet = getSheetByNameSafe(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function (h) { return String(h).trim(); });

  const records = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (row.every(function (cell) { return cell === '' || cell === null || cell === undefined; })) {
      continue;
    }
    const item = {};
    for (let c = 0; c < headers.length; c++) {
      item[headers[c] || ('col_' + c)] = row[c];
    }
    records.push(item);
  }

  if (!filters) return records;

  const dpwQuery = String(filters.dpw || '').trim().toLowerCase();
  const statusQuery = String(filters.status || '').trim().toLowerCase();
  const jenisQuery = String(filters.jenis || '').trim().toLowerCase();
  const kategoriQuery = String(filters.kategori || '').trim().toLowerCase();
  const searchQuery = String(filters.search || '').trim().toLowerCase();

  return records.filter(function (rec) {
    const joinedText = Object.keys(rec).map(function (k) { return String(rec[k] || ''); }).join(' ').toLowerCase();

    if (dpwQuery) {
      const dpwField = String(rec.Nama_DPW || rec.Wilayah_Daerah || rec.Unit_DPW || rec.Asal_DPW_DPD || '').toLowerCase();
      if (dpwField.indexOf(dpwQuery) === -1) return false;
    }
    if (statusQuery && String(rec.Status || rec.Status_Konsolidasi || '').toLowerCase() !== statusQuery) return false;
    if (jenisQuery && String(rec.Jenis_4M || '').toLowerCase() !== jenisQuery) return false;
    if (kategoriQuery) {
      const katField = String(rec.Kategori || rec.Kategori_Layanan || rec.Format_Berkas || '').toLowerCase();
      if (katField.indexOf(kategoriQuery) === -1) return false;
    }
    if (searchQuery && joinedText.indexOf(searchQuery) === -1) return false;

    return true;
  });
}

function appendSheetRow(sheetName, rowObject) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheetByNameSafe(sheetName);
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) throw new Error('Sheet "' + sheetName + '" belum memiliki header kolom.');
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    const rowArray = headers.map(function (header) { return rowObject.hasOwnProperty(header) ? rowObject[header] : ''; });
    sheet.appendRow(rowArray);
    return rowObject;
  } finally {
    lock.releaseLock();
  }
}

function updateSheetRowById(sheetName, idColumn, idValue, updates) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheetByNameSafe(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow <= 1) return false;
    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0].map(function (h) { return String(h).trim(); });
    const idColIndex = headers.indexOf(idColumn);
    if (idColIndex === -1) return false;
    for (let r = 1; r < data.length; r++) {
      if (String(data[r][idColIndex]).trim() === String(idValue).trim()) {
        const updatedRow = headers.map(function (h, c) { return updates.hasOwnProperty(h) ? updates[h] : data[r][c]; });
        sheet.getRange(r + 1, 1, 1, lastCol).setValues([updatedRow]);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

function computeGovernanceSummary() {
  const dpwRows = readSheetRows(DUWD_CONFIG.SHEETS.DPW_DPD);
  const agendaRows = readSheetRows(DUWD_CONFIG.SHEETS.AGENDA_4M);
  const kaderRows = readSheetRows(DUWD_CONFIG.SHEETS.KADER_LEVEL);
  const driveRows = readSheetRows(DUWD_CONFIG.SHEETS.ARSIP_DRIVE);
  let totalDpd = 0;
  dpwRows.forEach(function (row) { totalDpd += Number(row.Jumlah_DPD || 0); });
  let totalKader = 0;
  kaderRows.forEach(function (row) { totalKader += Number(row.Total_Aktif || 0); });
  return {
    totalDpw: dpwRows.length,
    totalDpd: totalDpd,
    totalAgenda4M: agendaRows.length,
    totalKaderAktif: totalKader,
    totalArsipDrive: driveRows.length
  };
}

/* =========================== DRIVE & UTILITY HELPERS =========================== */

function extractDriveFileId(urlOrId) {
  const raw = String(urlOrId || '').trim();
  if (!raw) return '';
  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{12,})/,
    /\/folders\/([a-zA-Z0-9_-]{12,})/,
    /[?&]id=([a-zA-Z0-9_-]{12,})/,
    /^([a-zA-Z0-9_-]{12,})$/
  ];
  for (let i = 0; i < patterns.length; i++) {
    const match = raw.match(patterns[i]);
    if (match && match[1]) return match[1];
  }
  return '';
}

function buildDriveAccessLinks_(fileId) {
  if (!fileId) return { viewUrl: '', previewUrl: '', downloadUrl: '' };
  return {
    viewUrl: 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing',
    previewUrl: 'https://drive.google.com/file/d/' + fileId + '/preview',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId
  };
}

function createJsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function generateTicketId_(prefix) {
  const datePart = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyyMMdd');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return prefix + '-' + datePart + '-' + randomPart;
}

function logActivity_(actor, action, moduleName, status, detail) {
  try {
    appendSheetRow(DUWD_CONFIG.SHEETS.SYSTEM_LOGS, {
      Timestamp: Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss'),
      Aktor: actor || 'SYSTEM',
      Aksi: action,
      Modul: moduleName,
      Status: status,
      Keterangan: detail || ''
    });
  } catch (ignoreErr) {
    Logger.log('[AUDIT_FALLBACK] ' + moduleName + ' | ' + action + ' | ' + status + ' | ' + detail);
  }
}

/**
 * Jalankan fungsi ini SEKALI di editor Apps Script untuk membuat
 * Google Spreadsheet Database Induk DUWD (6 tab otomatis).
 */
function initializeDUWDStructure() {
  const cfg = getRuntimeConfig_();
  let ss;
  if (cfg.spreadsheetId) {
    ss = SpreadsheetApp.openById(cfg.spreadsheetId);
  } else {
    ss = SpreadsheetApp.create('Database Induk DUWD Wahdah Islamiyah (duwd.web.id)');
    PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  }

  const schema = {
    DPW_DPD: ['Kode_DPW', 'Nama_DPW', 'Ketua_DPW', 'Jumlah_DPD', 'Status_Konsolidasi', 'Kesiapan_4M_Persen', 'Kontak_Sekretariat'],
    AGENDA_4M: ['ID_Agenda', 'Jenis_4M', 'Nama_Kegiatan', 'Wilayah_Daerah', 'Tanggal_Pelaksanaan', 'Lokasi', 'Status', 'Progres_Persen', 'Tautan_SK_Drive', 'Diperbarui_Pada'],
    KADER_LEVEL: ['Kode_DPW', 'Nama_DPW', 'Tarif', 'Takwin', 'Tanfidz', 'Murabbi', 'Total_Aktif', 'Periode_Update'],
    ARSIP_DRIVE: ['ID_Arsip', 'Drive_File_ID', 'Judul_Berkas', 'Kategori', 'Format_Berkas', 'Unit_DPW', 'Ukuran_Teks', 'URL_Asli', 'URL_Pratinjau', 'URL_Unduh', 'Diunggah_Pada'],
    KHIDMAT_MASUK: ['ID_Tiket', 'Tanggal_Masuk', 'Nama_Pengurus', 'Asal_DPW_DPD', 'Kontak', 'Kategori_Layanan', 'Perihal', 'Detail_Permohonan', 'Drive_File_ID', 'Tautan_Lampiran', 'Status'],
    SYSTEM_LOGS: ['Timestamp', 'Aktor', 'Aksi', 'Modul', 'Status', 'Keterangan']
  };

  Object.keys(schema).forEach(function (sheetName) {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) sheet = ss.insertSheet(sheetName);
    if (sheet.getLastRow() === 0) {
      const headers = schema[sheetName];
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight('bold')
        .setBackground('#07525E')
        .setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
    }
  });

  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }

  logActivity_('ADMIN', 'initializeDUWDStructure', 'SETUP', 'SUCCESS', 'Spreadsheet ID: ' + ss.getId());
  Logger.log('Berhasil! URL Google Sheets Anda: ' + ss.getUrl());
}
