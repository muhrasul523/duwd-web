/**
 * ============================================================================
 * DUWD DPP WAHDAH ISLAMIYAH — GOOGLE DRIVE CONNECTOR (drive-connector.js)
 * Modul : Ekstraksi File ID dinamis, generator URL pratinjau/unduhan aman,
 *         sinkronisasi folder Google Drive, & registrasi semua jenis berkas
 *         (PDF, PPT, DOCX, Gambar, Audio MP3, Video MP4, Arsip ZIP).
 * ============================================================================
 */

/**
 * Mengekstrak Google Drive File ID atau Folder ID dari berbagai format tautan Google Drive.
 * Mendukung:
 * - https://drive.google.com/file/d/{ID}/view
 * - https://drive.google.com/open?id={ID}
 * - https://docs.google.com/presentation/d/{ID}/edit
 * - https://drive.google.com/drive/folders/{ID}
 * - ID mentah langsung (25+ karakter alfanumerik)
 *
 * @param {string} urlOrId
 * @return {string}
 */
function extractDriveFileId(urlOrId) {
  const raw = String(urlOrId || '').trim();
  if (!raw) return '';

  const patterns = [
    /\/d\/([a-zA-Z0-9_-]{20,})/,
    /\/folders\/([a-zA-Z0-9_-]{20,})/,
    /[?&]id=([a-zA-Z0-9_-]{20,})/,
    /^([a-zA-Z0-9_-]{20,})$/
  ];

  for (let i = 0; i < patterns.length; i++) {
    const match = raw.match(patterns[i]);
    if (match && match[1]) {
      return match[1];
    }
  }
  return '';
}

/**
 * Mengklasifikasikan format berkas dari MIME Type atau ekstensi file.
 * @param {string} mimeType
 * @param {string} fileName
 * @return {string} 'PDF' | 'PPT' | 'DOCX' | 'Gambar' | 'Audio' | 'Video' | 'Arsip'
 */
function classifyDriveFormat_(mimeType, fileName) {
  const mime = String(mimeType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();

  if (mime.indexOf('pdf') !== -1 || name.endsWith('.pdf')) return 'PDF';
  if (mime.indexOf('presentation') !== -1 || mime.indexOf('powerpoint') !== -1 || name.endsWith('.ppt') || name.endsWith('.pptx')) return 'PPT';
  if (mime.indexOf('wordprocessingml') !== -1 || mime.indexOf('msword') !== -1 || mime.indexOf('google-apps.document') !== -1 || name.endsWith('.doc') || name.endsWith('.docx')) return 'DOCX';
  if (mime.indexOf('image/') === 0 || /\.(png|jpe?g|webp|svg)$/.test(name)) return 'Gambar';
  if (mime.indexOf('audio/') === 0 || /\.(mp3|wav|m4a|ogg)$/.test(name)) return 'Audio';
  if (mime.indexOf('video/') === 0 || /\.(mp4|mov|webm|mkv)$/.test(name)) return 'Video';
  return 'Arsip';
}

/**
 * Memformat ukuran byte menjadi teks yang rapi (KB, MB, GB).
 * @param {number} bytes
 * @return {string}
 */
function formatBytesReadable_(bytes) {
  const size = Number(bytes || 0);
  if (size <= 0) return 'Tautan Cloud';
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
  return (size / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Menghasilkan set URL aman untuk tampilan web, iframe embed pratinjau, dan unduhan langsung.
 * @param {string} fileId
 * @return {Object}
 */
function buildDriveAccessLinks_(fileId) {
  if (!fileId) {
    return { viewUrl: '', previewUrl: '', downloadUrl: '' };
  }
  return {
    viewUrl: 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing',
    previewUrl: 'https://drive.google.com/file/d/' + fileId + '/preview',
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId
  };
}

/**
 * Menginspeksi berkas Google Drive secara langsung via DriveApp dari sebuah URL.
 * @param {string} rawUrl
 * @return {Object}
 */
function inspectDriveResourceByUrl(rawUrl) {
  const fileId = extractDriveFileId(rawUrl);
  if (!fileId) {
    throw new Error('Format tautan Google Drive tidak valid atau File ID tidak ditemukan.');
  }

  const links = buildDriveAccessLinks_(fileId);
  try {
    const file = DriveApp.getFileById(fileId);
    const mimeType = file.getMimeType();
    const fileName = file.getName();
    return {
      fileId: fileId,
      name: fileName,
      mimeType: mimeType,
      format: classifyDriveFormat_(mimeType, fileName),
      sizeText: formatBytesReadable_(file.getSize()),
      viewUrl: links.viewUrl,
      previewUrl: links.previewUrl,
      downloadUrl: links.downloadUrl,
      accessible: true
    };
  } catch (err) {
    return {
      fileId: fileId,
      name: '',
      mimeType: '',
      format: 'Arsip',
      sizeText: 'Eksternal / Terbatas',
      viewUrl: links.viewUrl,
      previewUrl: links.previewUrl,
      downloadUrl: links.downloadUrl,
      accessible: false,
      note: 'Berkas tidak dapat diakses langsung oleh akun skrip atau berupa folder/tautan eksternal.'
    };
  }
}

/**
 * Mengambil daftar berkas arsip dari sheet ARSIP_DRIVE, dan opsional menggabungkan scan folder Drive langsung.
 * @param {Object} filters
 * @param {boolean} includeLiveScan
 * @return {Array<Object>}
 */
function listDriveRepositoryRecords(filters, includeLiveScan) {
  const sheetRecords = readSheetRows(DUWD_CONFIG.SHEETS.ARSIP_DRIVE, {
    kategori: filters.kategori || '',
    dpw: filters.dpw || '',
    search: filters.search || ''
  });

  let results = sheetRecords;

  if (filters.format) {
    const fmt = String(filters.format).toLowerCase();
    results = results.filter(function (item) {
      return String(item.Format_Berkas || '').toLowerCase() === fmt;
    });
  }

  if (includeLiveScan) {
    const cfg = getRuntimeConfig_();
    if (cfg.driveRootId && cfg.driveRootId !== 'GANTI_DENGAN_ID_FOLDER_DRIVE_ANDA') {
      const liveFiles = scanDriveFolderRecursive_(cfg.driveRootId, 'Folder Induk DUWD');
      const existingIds = {};
      results.forEach(function (r) {
        existingIds[r.Drive_File_ID] = true;
      });
      liveFiles.forEach(function (lf) {
        if (!existingIds[lf.Drive_File_ID]) {
          results.push(lf);
        }
      });
    }
  }

  return results;
}

/**
 * Memindai folder Google Drive beserta subfolder untuk mengindeks seluruh berkas secara dinamis.
 * @param {string} folderId
 * @param {string} categoryLabel
 * @return {Array<Object>}
 */
function scanDriveFolderRecursive_(folderId, categoryLabel) {
  const folder = DriveApp.getFolderById(folderId);
  const collected = [];

  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    const fid = file.getId();
    const links = buildDriveAccessLinks_(fid);
    const mime = file.getMimeType();
    const name = file.getName();

    collected.push({
      ID_Arsip: 'DRV-' + fid.substring(0, 8).toUpperCase(),
      Drive_File_ID: fid,
      Judul_Berkas: name,
      Kategori: categoryLabel,
      Format_Berkas: classifyDriveFormat_(mime, name),
      Unit_DPW: 'DPP DUWD',
      Ukuran_Teks: formatBytesReadable_(file.getSize()),
      URL_Asli: links.viewUrl,
      URL_Pratinjau: links.previewUrl,
      URL_Unduh: links.downloadUrl,
      Diunggah_Pada: Utilities.formatDate(file.getLastUpdated(), 'Asia/Makassar', 'yyyy-MM-dd')
    });
  }

  const subFolders = folder.getFolders();
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    const subItems = scanDriveFolderRecursive_(sub.getId(), sub.getName());
    Array.prototype.push.apply(collected, subItems);
  }

  return collected;
}

/**
 * Mendaftarkan tautan Google Drive eksternal/terbaru ke tab ARSIP_DRIVE dengan parsing otomatis.
 * @param {Object} payload
 * @return {Object}
 */
function registerExternalDriveResource(payload) {
  const fileId = extractDriveFileId(payload.driveUrl);
  if (!fileId) {
    throw new Error('URL Google Drive tidak mengandung File ID yang valid.');
  }

  const inspected = inspectDriveResourceByUrl(payload.driveUrl);
  const format = payload.format || inspected.format || 'PDF';
  const arsipId = generateTicketId_('ARS');

  const record = {
    ID_Arsip: arsipId,
    Drive_File_ID: fileId,
    Judul_Berkas: String(payload.judul || inspected.name || 'Dokumen Arsip DUWD').trim(),
    Kategori: String(payload.kategori || 'Pedoman & Tata Kelola').trim(),
    Format_Berkas: format,
    Unit_DPW: String(payload.dpw || 'DPP Wahdah Islamiyah').trim(),
    Ukuran_Teks: inspected.sizeText,
    URL_Asli: inspected.viewUrl,
    URL_Pratinjau: inspected.previewUrl,
    URL_Unduh: inspected.downloadUrl,
    Diunggah_Pada: Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd')
  };

  appendSheetRow(DUWD_CONFIG.SHEETS.ARSIP_DRIVE, record);
  return record;
}

/**
 * Mengunggah file dari payload base64 langsung ke Folder Google Drive Root DUWD.
 * @param {Object} payload - { fileName, mimeType, base64Data, kategori, dpw }
 * @return {Object}
 */
function uploadBase64FileToDrive(payload) {
  const cfg = getRuntimeConfig_();
  if (!cfg.driveRootId || cfg.driveRootId === 'GANTI_DENGAN_ID_FOLDER_DRIVE_ANDA') {
    throw new Error('DRIVE_ROOT_FOLDER_ID belum diatur.');
  }

  const rootFolder = DriveApp.getFolderById(cfg.driveRootId);
  const decoded = Utilities.base64Decode(payload.base64Data);
  const blob = Utilities.newBlob(decoded, payload.mimeType || 'application/octet-stream', payload.fileName);
  const createdFile = rootFolder.createFile(blob);

  // Set akses agar pengurus pemilik tautan dapat melihat pratinjau tanpa kebocoran indeks publik
  createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = createdFile.getId();
  const links = buildDriveAccessLinks_(fileId);
  const arsipId = generateTicketId_('ARS');

  const record = {
    ID_Arsip: arsipId,
    Drive_File_ID: fileId,
    Judul_Berkas: String(payload.judul || payload.fileName).trim(),
    Kategori: String(payload.kategori || 'Unggahan Pengurus').trim(),
    Format_Berkas: classifyDriveFormat_(createdFile.getMimeType(), createdFile.getName()),
    Unit_DPW: String(payload.dpw || 'DPP DUWD').trim(),
    Ukuran_Teks: formatBytesReadable_(createdFile.getSize()),
    URL_Asli: links.viewUrl,
    URL_Pratinjau: links.previewUrl,
    URL_Unduh: links.downloadUrl,
    Diunggah_Pada: Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd')
  };

  appendSheetRow(DUWD_CONFIG.SHEETS.ARSIP_DRIVE, record);
  return record;
}
