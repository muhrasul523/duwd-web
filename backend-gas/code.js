/**
 * ============================================================================
 * DUWD DPP WAHDAH ISLAMIYAH — GOOGLE APPS SCRIPT MAIN ENTRYPOINT (code.js)
 * Domain  : duwd.web.id
 * Runtime : Google Apps Script (V8 Engine)
 * Modul   : Router Web App (doGet, doPost), Auth Guard, Audit Logger & Setup
 * ============================================================================
 */

const DUWD_CONFIG = {
  APP_NAME: 'DUWD DPP Wahdah Islamiyah API',
  DOMAIN: 'duwd.web.id',
  // Isi dengan ID Spreadsheet Google Sheets Anda atau atur via Script Properties (SPREADSHEET_ID)
  DEFAULT_SPREADSHEET_ID: 'GANTI_DENGAN_ID_SPREADSHEET_ANDA',
  // Isi dengan ID Folder Root Google Drive untuk Arsip DUWD atau atur via Script Properties (DRIVE_ROOT_FOLDER_ID)
  DEFAULT_DRIVE_ROOT_ID: 'GANTI_DENGAN_ID_FOLDER_DRIVE_ANDA',
  // Opsional: Token keamanan untuk request POST/write (kosongkan '' jika mode publik internal)
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

/**
 * Mengambil konfigurasi aktif dari PropertiesService (jika ada) atau fallback ke DUWD_CONFIG.
 * @return {Object} Konfigurasi aktif
 */
function getRuntimeConfig_() {
  const props = PropertiesService.getScriptProperties();
  return {
    spreadsheetId: props.getProperty('SPREADSHEET_ID') || DUWD_CONFIG.DEFAULT_SPREADSHEET_ID,
    driveRootId: props.getProperty('DRIVE_ROOT_FOLDER_ID') || DUWD_CONFIG.DEFAULT_DRIVE_ROOT_ID,
    apiToken: props.getProperty('API_SECRET_TOKEN') || DUWD_CONFIG.API_SECRET_TOKEN
  };
}

/**
 * HTTP GET Handler — Melayani pembacaan data, filter multi-kriteria, dan listing arsip Drive.
 * Contoh: ?action=listRecords&sheet=AGENDA_4M&jenis=Muswil&status=Terjadwal
 * @param {GoogleAppsScript.Events.DoGet} e
 * @return {GoogleAppsScript.Content.TextOutput}
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
        const filters = {
          kategori: params.kategori || '',
          format: params.format || '',
          dpw: params.dpw || '',
          search: params.search || ''
        };
        const includeLiveScan = params.liveScan === 'true';
        const files = listDriveRepositoryRecords(filters, includeLiveScan);
        return createJsonResponse_({
          ok: true,
          action: 'listDriveFiles',
          count: files.length,
          data: files
        });
      }

      case 'inspectDriveLink': {
        const rawUrl = String(params.url || '').trim();
        if (!rawUrl) {
          return createJsonResponse_({ ok: false, error: 'Parameter url wajib diisi.' });
        }
        const inspected = inspectDriveResourceByUrl(rawUrl);
        return createJsonResponse_({ ok: true, action: 'inspectDriveLink', data: inspected });
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
 * HTTP POST Handler — Menangani pengajuan khidmat, pembaruan jadwal 4M, dan registrasi link Drive.
 * Catatan: Frontend disarankan mengirim Content-Type 'text/plain;charset=utf-8' agar bebas preflight CORS.
 * @param {GoogleAppsScript.Events.DoPost} e
 * @return {GoogleAppsScript.Content.TextOutput}
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
            return createJsonResponse_({
              ok: false,
              error: 'Kolom wajib belum diisi: ' + field
            });
          }
        }

        const ticketId = generateTicketId_('KHD');
        const driveInfo = payload.driveUrl ? extractDriveFileId(payload.driveUrl) : '';
        const newRecord = {
          ID_Tiket: ticketId,
          Tanggal_Masuk: Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss'),
          Nama_Pengurus: String(payload.nama).trim(),
          Asal_DPW_DPD: String(payload.asalUnit).trim(),
          Kontak: String(payload.kontak).trim(),
          Kategori_Layanan: String(payload.kategori).trim(),
          Perihal: String(payload.perihal).trim(),
          Detail_Permohonan: String(payload.detail || '').trim(),
          Drive_File_ID: driveInfo,
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

        const registered = registerExternalDriveResource(payload);
        logActivity_(payload.actor || 'Admin DUWD', 'registerDriveLink', 'ARSIP_DRIVE', 'SUCCESS', registered.ID_Arsip + ' — ' + registered.Judul_Berkas);

        return createJsonResponse_({
          ok: true,
          action: 'registerDriveLink',
          data: registered,
          message: 'Tautan Google Drive berhasil diverifikasi dan didaftarkan ke arsip.'
        });
      }

      case 'uploadDriveFile': {
        if (!payload.base64Data || !payload.fileName) {
          return createJsonResponse_({
            ok: false,
            error: 'Data file base64 dan nama file wajib diisi.'
          });
        }
        const uploaded = uploadBase64FileToDrive(payload);
        logActivity_(payload.actor || 'Admin DUWD', 'uploadDriveFile', 'ARSIP_DRIVE', 'SUCCESS', uploaded.ID_Arsip);
        return createJsonResponse_({
          ok: true,
          action: 'uploadDriveFile',
          data: uploaded
        });
      }

      default:
        return createJsonResponse_({
          ok: false,
          error: 'Action POST tidak dikenali: ' + action
        });
    }
  } catch (err) {
    logActivity_(payload.nama || 'SYSTEM', 'doPost:' + action, 'API_ROUTER', 'ERROR', err.message);
    return createJsonResponse_({
      ok: false,
      action: action,
      error: err.message
    });
  }
}

/**
 * Helper: Membuat JSON output standar untuk Web App GAS.
 * @param {Object} data
 * @return {GoogleAppsScript.Content.TextOutput}
 */
function createJsonResponse_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Helper: Menghasilkan ID unik berformat PREFIX-YYYYMMDD-XXXX.
 * @param {string} prefix
 * @return {string}
 */
function generateTicketId_(prefix) {
  const datePart = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyyMMdd');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return prefix + '-' + datePart + '-' + randomPart;
}

/**
 * Helper: Pencatatan log otomatis ke sheet SYSTEM_LOGS.
 * @param {string} actor
 * @param {string} action
 * @param {string} moduleName
 * @param {string} status
 * @param {string} detail
 */
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
 * Jalankan fungsi ini SEKALI dari Editor Google Apps Script untuk membuat
 * struktur tab Google Sheets dan Folder Google Drive DUWD secara otomatis.
 */
function initializeDUWDStructure() {
  const cfg = getRuntimeConfig_();
  let ss;
  if (cfg.spreadsheetId && cfg.spreadsheetId !== 'GANTI_DENGAN_ID_SPREADSHEET_ANDA') {
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
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
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

  // Hapus Sheet1 bawaan jika kosong dan sheet lain sudah dibuat
  const defaultSheet = ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }

  let rootFolder;
  if (cfg.driveRootId && cfg.driveRootId !== 'GANTI_DENGAN_ID_FOLDER_DRIVE_ANDA') {
    rootFolder = DriveApp.getFolderById(cfg.driveRootId);
  } else {
    rootFolder = DriveApp.createFolder('DUWD_Wahdah_Islamiyah_Repository');
    PropertiesService.getScriptProperties().setProperty('DRIVE_ROOT_FOLDER_ID', rootFolder.getId());
  }

  const subFolders = ['01_Pedoman_PDF', '02_Materi_PPT', '03_Administrasi_DOCX', '04_Media_Audio_Video_Gambar', '05_Arsip_4M_ZIP'];
  subFolders.forEach(function (folderName) {
    const existing = rootFolder.getFoldersByName(folderName);
    if (!existing.hasNext()) {
      rootFolder.createFolder(folderName);
    }
  });

  logActivity_('ADMIN', 'initializeDUWDStructure', 'SETUP', 'SUCCESS', 'Spreadsheet ID: ' + ss.getId() + ' | Drive Root ID: ' + rootFolder.getId());
  Logger.log('Inisialisasi Selesai! Spreadsheet URL: ' + ss.getUrl());
  Logger.log('Drive Root URL: ' + rootFolder.getUrl());
}
