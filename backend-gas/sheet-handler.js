/**
 * ============================================================================
 * DUWD DPP WAHDAH ISLAMIYAH — GOOGLE SHEETS HANDLER (sheet-handler.js)
 * Modul : Pembacaan data dinamis, filter multi-kriteria, tulis/update baris,
 *         serta agregasi ringkasan tata kelola wilayah & levelisasi kader.
 * ============================================================================
 */

/**
 * Membuka Spreadsheet induk berdasarkan konfigurasi aktif.
 * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
 */
function getMasterSpreadsheet_() {
  const cfg = getRuntimeConfig_();
  if (!cfg.spreadsheetId || cfg.spreadsheetId === 'GANTI_DENGAN_ID_SPREADSHEET_ANDA') {
    throw new Error('SPREADSHEET_ID belum dikonfigurasi. Jalankan initializeDUWDStructure() atau atur Script Properties.');
  }
  return SpreadsheetApp.openById(cfg.spreadsheetId);
}

/**
 * Mengambil object Sheet secara aman beserta validasi eksistensi.
 * @param {string} sheetName
 * @return {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheetByNameSafe(sheetName) {
  const ss = getMasterSpreadsheet_();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Tab sheet "' + sheetName + '" tidak ditemukan. Jalankan initializeDUWDStructure().');
  }
  return sheet;
}

/**
 * Membaca seluruh baris dari sebuah sheet sebagai array objek, dengan filter multi-kriteria.
 * @param {string} sheetName
 * @param {Object} [filters] - { dpw, status, jenis, kategori, search }
 * @return {Array<Object>}
 */
function readSheetRows(sheetName, filters) {
  const sheet = getSheetByNameSafe(sheetName);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow <= 1 || lastCol === 0) {
    return [];
  }

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0].map(function (h) {
    return String(h).trim();
  });

  const records = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const isEmptyRow = row.every(function (cell) {
      return cell === '' || cell === null || cell === undefined;
    });
    if (isEmptyRow) continue;

    const item = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c] || ('col_' + c);
      item[key] = row[c];
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
    const joinedText = Object.keys(rec)
      .map(function (k) { return String(rec[k] || ''); })
      .join(' ')
      .toLowerCase();

    if (dpwQuery) {
      const dpwField = String(rec.Nama_DPW || rec.Wilayah_Daerah || rec.Unit_DPW || rec.Asal_DPW_DPD || '').toLowerCase();
      if (dpwField.indexOf(dpwQuery) === -1) return false;
    }

    if (statusQuery) {
      const statusField = String(rec.Status || rec.Status_Konsolidasi || '').toLowerCase();
      if (statusField !== statusQuery) return false;
    }

    if (jenisQuery) {
      const jenisField = String(rec.Jenis_4M || '').toLowerCase();
      if (jenisField !== jenisQuery) return false;
    }

    if (kategoriQuery) {
      const katField = String(rec.Kategori || rec.Kategori_Layanan || rec.Format_Berkas || '').toLowerCase();
      if (katField.indexOf(kategoriQuery) === -1) return false;
    }

    if (searchQuery && joinedText.indexOf(searchQuery) === -1) {
      return false;
    }

    return true;
  });
}

/**
 * Menambahkan satu baris baru ke Google Sheet dengan pemetaan nama kolom header secara dinamis.
 * @param {string} sheetName
 * @param {Object} rowObject
 * @return {Object} Data yang berhasil ditulis
 */
function appendSheetRow(sheetName, rowObject) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSheetByNameSafe(sheetName);
    const lastCol = sheet.getLastColumn();
    if (lastCol === 0) {
      throw new Error('Sheet "' + sheetName + '" belum memiliki header kolom.');
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
      return String(h).trim();
    });

    const rowArray = headers.map(function (header) {
      return rowObject.hasOwnProperty(header) ? rowObject[header] : '';
    });

    sheet.appendRow(rowArray);
    return rowObject;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Memperbarui baris pada Google Sheet berdasarkan nilai kunci ID pada kolom tertentu.
 * @param {string} sheetName
 * @param {string} idColumn
 * @param {string} idValue
 * @param {Object} updates
 * @return {boolean} true jika baris ditemukan dan diperbarui
 */
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
        const updatedRow = headers.map(function (h, c) {
          return updates.hasOwnProperty(h) ? updates[h] : data[r][c];
        });
        sheet.getRange(r + 1, 1, 1, lastCol).setValues([updatedRow]);
        return true;
      }
    }
    return false;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menghitung ringkasan KPI tata kelola wilayah/daerah, agenda 4M, dan total kader terlevelisasi.
 * @return {Object}
 */
function computeGovernanceSummary() {
  const dpwRows = readSheetRows(DUWD_CONFIG.SHEETS.DPW_DPD);
  const agendaRows = readSheetRows(DUWD_CONFIG.SHEETS.AGENDA_4M);
  const kaderRows = readSheetRows(DUWD_CONFIG.SHEETS.KADER_LEVEL);
  const driveRows = readSheetRows(DUWD_CONFIG.SHEETS.ARSIP_DRIVE);

  let totalDpd = 0;
  dpwRows.forEach(function (row) {
    totalDpd += Number(row.Jumlah_DPD || 0);
  });

  let totalKader = 0;
  kaderRows.forEach(function (row) {
    totalKader += Number(row.Total_Aktif || 0);
  });

  return {
    totalDpw: dpwRows.length,
    totalDpd: totalDpd,
    totalAgenda4M: agendaRows.length,
    totalKaderAktif: totalKader,
    totalArsipDrive: driveRows.length
  };
}
