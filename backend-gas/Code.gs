/**
 * ============================================================================
 * DUWD DPP WI — GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * Arsitektur Hybrid Multi-Spreadsheet:
 * - Spreadsheet #1 (Induk / Container-bound):
 *     UNIT, PENGURUS, PROGRAM_KERJA, KEGIATAN_RPKA, PENGATURAN, SYSTEM_LOGS
 * - Spreadsheet #2 (Wilayah & DPW-DPD — dibuka via openById):
 *     KODE_WILAYAH, DPW, DPD
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
  PENGATURAN: 'PENGATURAN',
  LOGS: 'SYSTEM_LOGS'
};

const WILAYAH_SHEETS = {
  KODE_WILAYAH: 'KODE_WILAYAH',
  DPW: 'DPW',
  DPD: 'DPD'
};

/**
 * Menambahkan menu khusus di Google Spreadsheet Induk.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('DUWD DPP WI')
    .addItem('Setup Database Induk', 'setupDatabase')
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
      ['WILAYAH_SPREADSHEET_ID', '', 'ID atau URL Google Spreadsheet #2 (Kode Wilayah, DPW, DPD)']
    ];
    settingsSheet.getRange(2, 1, defaultSettings.length, 3).setValues(defaultSettings);
  } else {
    ensureSettingKey_('WILAYAH_SPREADSHEET_ID', '', 'ID atau URL Google Spreadsheet #2 (Kode Wilayah, DPW, DPD)');
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
 * Menyiapkan 3 tab sheet pada Spreadsheet #2 (KODE_WILAYAH, DPW, DPD).
 */
function setupWilayahDatabase_(wSs) {
  const defs = [
    {
      name: WILAYAH_SHEETS.KODE_WILAYAH,
      headers: [
        'Kode_Wilayah',
        'Tingkat',
        'Pulau',
        'Kode_Provinsi',
        'Nama_Provinsi',
        'Kode_KabKota',
        'Nama_KabKota',
        'Kode_Kecamatan',
        'Nama_Kecamatan',
        'Nama_KelDesa',
        'Parent_Kode'
      ]
    },
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

  // Seed 38 Provinsi jika KODE_WILAYAH masih kosong
  const kwSheet = wSs.getSheetByName(WILAYAH_SHEETS.KODE_WILAYAH);
  if (kwSheet.getLastRow() <= 1) {
    const starterProvinces = getStarterProvinceRows_();
    kwSheet.getRange(2, 1, starterProvinces.length, 11).setValues(starterProvinces);
    // Pastikan kolom Kode_Wilayah & Kode_Provinsi berformat teks agar nol di depan tidak hilang
    kwSheet.getRange(2, 1, starterProvinces.length, 1).setNumberFormat('@');
    kwSheet.getRange(2, 4, starterProvinces.length, 1).setNumberFormat('@');
  }
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
      let wilayahRowsCount = 0;

      if (wilayahId) {
        try {
          const wSs = SpreadsheetApp.openById(wilayahId);
          wilayahConnected = true;
          wilayahName = wSs.getName();
          const dpwSh = wSs.getSheetByName(WILAYAH_SHEETS.DPW);
          const dpdSh = wSs.getSheetByName(WILAYAH_SHEETS.DPD);
          const kwSh = wSs.getSheetByName(WILAYAH_SHEETS.KODE_WILAYAH);
          dpwCount = dpwSh ? Math.max(0, dpwSh.getLastRow() - 1) : 0;
          dpdCount = dpdSh ? Math.max(0, dpdSh.getLastRow() - 1) : 0;
          wilayahRowsCount = kwSh ? Math.max(0, kwSh.getLastRow() - 1) : 0;
        } catch (wErr) {
          wilayahError = wErr.message;
        }
      }

      const msg = wilayahConnected
        ? 'Terhubung ke 2 Spreadsheet: "' + masterSs.getName() + '" & "' + wilayahName + '" (DPW: ' + dpwCount + ', DPD: ' + dpdCount + ', Wilayah: ' + wilayahRowsCount + ').'
        : wilayahId
          ? 'Spreadsheet Induk "' + masterSs.getName() + '" terhubung, tetapi Spreadsheet #2 gagal dibuka: ' + wilayahError
          : 'Spreadsheet Induk "' + masterSs.getName() + '" terhubung. Spreadsheet #2 (Wilayah & DPW-DPD) belum ditautkan.';

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

    if (action === 'getWilayahChildren') {
      const wSs = getWilayahSpreadsheetOrThrow_();
      const kwSheet = wSs.getSheetByName(WILAYAH_SHEETS.KODE_WILAYAH);
      if (!kwSheet) {
        return jsonOut_({ ok: true, data: [] });
      }
      const parentKode = String(params.parentKode || '').trim();
      const kodeProvinsi = String(params.kodeProvinsi || '').trim();
      const tingkatFilter = String(params.tingkat || '').trim();
      const allRows = readSheetObjects_(kwSheet);
      const result = [];
      for (let i = 0; i < allRows.length; i++) {
        const mapped = mapKodeWilayahRow_(allRows[i]);
        if (tingkatFilter && mapped.tingkat !== tingkatFilter) continue;
        if (parentKode && mapped.parentKode !== parentKode && !mapped.kodeWilayah.startsWith(parentKode + '.')) continue;
        if (kodeProvinsi && mapped.kodeProvinsi !== kodeProvinsi) continue;
        result.push(mapped);
        if (result.length >= 1500) break;
      }
      result.sort(compareKodeWilayah_);
      return jsonOut_({ ok: true, data: result });
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
      const wilayahId = extractSpreadsheetId_(settingsMap.WILAYAH_SPREADSHEET_ID || '');

      let wilayahConnected = false;
      let kodeWilayah = [];
      let dpw = [];
      let dpd = [];

      if (wilayahId) {
        try {
          const wSs = SpreadsheetApp.openById(wilayahId);
          wilayahConnected = true;

          const kwSheet = wSs.getSheetByName(WILAYAH_SHEETS.KODE_WILAYAH);
          if (kwSheet) {
            const rawKw = readSheetObjects_(kwSheet);
            for (let i = 0; i < rawKw.length; i++) {
              const item = mapKodeWilayahRow_(rawKw[i]);
              // Muat Pulau, Provinsi, dan KabKota saat getAllData agar cepat (~550 baris)
              if (item.tingkat === 'Pulau' || item.tingkat === 'Provinsi' || item.tingkat === 'KabKota') {
                kodeWilayah.push(item);
              }
            }
            kodeWilayah.sort(compareKodeWilayah_);
          }

          const dpwSheet = wSs.getSheetByName(WILAYAH_SHEETS.DPW);
          if (dpwSheet) {
            dpw = readSheetObjects_(dpwSheet).map(function (r) {
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
            }).sort(compareKodeWilayah_);
          }

          const dpdSheet = wSs.getSheetByName(WILAYAH_SHEETS.DPD);
          if (dpdSheet) {
            dpd = readSheetObjects_(dpdSheet).map(function (r) {
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
            }).sort(compareKodeWilayah_);
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
          kodeWilayah: kodeWilayah,
          dpw: dpw,
          dpd: dpd,
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

  try {
    const role = resolveRoleByPin_(pin);
    if (!role) {
      return jsonOut_({ ok: false, error: 'Akses ditolak. PIN tidak valid.' });
    }
    if (role !== 'superadmin') {
      return jsonOut_({
        ok: false,
        error: 'Saat ini hanya Super Admin yang memiliki akses untuk mengedit data pengurus, program kerja, unit, DPW/DPD, dan pengaturan.'
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
        Tautan_Drive: String(payload.tautanDrive || '').trim()
      };
      const ss = getSpreadsheet_();
      const updated = updateRowByIdInSs_(ss, SHEETS.KEGIATAN_RPKA, 'Kode_Kegiatan', kodeKegiatan, rowObj);
      if (!updated) {
        appendRowInSs_(ss, SHEETS.KEGIATAN_RPKA, rowObj);
      }
      writeLog_('SUPERADMIN', 'saveKegiatan', kodeKegiatan + ' — ' + namaKegiatan);
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
      const ss = getSpreadsheet_();
      const deleted = deleteRowByIdInSs_(ss, SHEETS.KEGIATAN_RPKA, 'Kode_Kegiatan', kode);
      writeLog_('SUPERADMIN', 'deleteKegiatan', kode + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Kegiatan tidak ditemukan.' });
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
        message: 'Tab KODE_WILAYAH, DPW, dan DPD berhasil disiapkan pada Spreadsheet "' + wSs.getName() + '".',
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
      const namaDpw = String(payload.namaDpw || '').trim();
      const namaProvinsi = String(payload.namaProvinsi || '').trim();
      if (!kodeWilayah || !namaDpw || !namaProvinsi) {
        return jsonOut_({ ok: false, error: 'Kode wilayah, nama provinsi, dan nama DPW wajib diisi.' });
      }

      const isEdit = Boolean(payload.id);
      const idDpw = isEdit ? String(payload.id).trim() : generateId_('DPW');
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');

      const rowObj = {
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

      const updated = isEdit ? updateRowByIdInSs_(wSs, WILAYAH_SHEETS.DPW, 'ID_DPW', idDpw, rowObj) : false;
      if (!updated) {
        appendRowInSs_(wSs, WILAYAH_SHEETS.DPW, rowObj);
      }

      writeLog_('SUPERADMIN', isEdit ? 'updateDpw' : 'createDpw', kodeWilayah + ' — ' + namaDpw);

      return jsonOut_({
        ok: true,
        data: {
          id: idDpw,
          kodeWilayah: rowObj.Kode_Wilayah,
          pulau: rowObj.Pulau,
          namaDpw: rowObj.Nama_DPW,
          namaProvinsi: rowObj.Nama_Provinsi,
          statusTerbentuk: rowObj.Status_Terbentuk,
          ketuaNama: rowObj.Ketua_Nama,
          ketuaWa: rowObj.Ketua_WA,
          sekretarisNama: rowObj.Sekretaris_Nama,
          sekretarisWa: rowObj.Sekretaris_WA,
          alamatKantor: rowObj.Alamat_Kantor,
          tautanDrive: rowObj.Tautan_Drive,
          diperbaruiPada: rowObj.Diperbarui_Pada
        }
      });
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
      const namaDpd = String(payload.namaDpd || '').trim();
      const namaKabKota = String(payload.namaKabKota || '').trim();
      if (!kodeWilayah || !namaDpd || !namaKabKota) {
        return jsonOut_({ ok: false, error: 'Kode wilayah, nama Kab/Kota, dan nama DPD wajib diisi.' });
      }

      const isEdit = Boolean(payload.id);
      const idDpd = isEdit ? String(payload.id).trim() : generateId_('DPD');
      const nowStr = Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss');
      const kodeProv = String(payload.kodeProvinsi || kodeWilayah.split('.')[0] || '').trim();

      const rowObj = {
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

      const updated = isEdit ? updateRowByIdInSs_(wSs, WILAYAH_SHEETS.DPD, 'ID_DPD', idDpd, rowObj) : false;
      if (!updated) {
        appendRowInSs_(wSs, WILAYAH_SHEETS.DPD, rowObj);
      }

      writeLog_('SUPERADMIN', isEdit ? 'updateDpd' : 'createDpd', kodeWilayah + ' — ' + namaDpd);

      return jsonOut_({
        ok: true,
        data: {
          id: idDpd,
          kodeWilayah: rowObj.Kode_Wilayah,
          kodeProvinsi: rowObj.Kode_Provinsi,
          pulau: rowObj.Pulau,
          namaProvinsi: rowObj.Nama_Provinsi,
          namaDpd: rowObj.Nama_DPD,
          namaKabKota: rowObj.Nama_KabKota,
          statusTerbentuk: rowObj.Status_Terbentuk,
          ketuaNama: rowObj.Ketua_Nama,
          ketuaWa: rowObj.Ketua_WA,
          sekretarisNama: rowObj.Sekretaris_Nama,
          sekretarisWa: rowObj.Sekretaris_WA,
          alamatKantor: rowObj.Alamat_Kantor,
          tautanDrive: rowObj.Tautan_Drive,
          diperbaruiPada: rowObj.Diperbarui_Pada
        }
      });
    }

    if (action === 'deleteDpd') {
      const id = String(payload.id || '').trim();
      if (!id) return jsonOut_({ ok: false, error: 'ID DPD wajib diisi.' });
      const wSs = getWilayahSpreadsheetOrThrow_();
      const deleted = deleteRowByIdInSs_(wSs, WILAYAH_SHEETS.DPD, 'ID_DPD', id);
      writeLog_('SUPERADMIN', 'deleteDpd', id + ' (deleted=' + deleted + ')');
      return jsonOut_({ ok: deleted, error: deleted ? undefined : 'Data DPD tidak ditemukan.' });
    }

    if (action === 'importKodeWilayah') {
      const wSs = getWilayahSpreadsheetOrThrow_();
      setupWilayahDatabase_(wSs);
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      const replaceAll = Boolean(payload.replaceAll);
      if (rows.length === 0) {
        return jsonOut_({ ok: false, error: 'Tidak ada baris kode wilayah yang dikirim.' });
      }

      const kwSheet = wSs.getSheetByName(WILAYAH_SHEETS.KODE_WILAYAH);
      const values = rows.map(function (r) {
        return [
          String(r.kodeWilayah || '').trim(),
          String(r.tingkat || '').trim(),
          String(r.pulau || '').trim(),
          String(r.kodeProvinsi || '').trim(),
          String(r.namaProvinsi || '').trim(),
          String(r.kodeKabKota || '').trim(),
          String(r.namaKabKota || '').trim(),
          String(r.kodeKecamatan || '').trim(),
          String(r.namaKecamatan || '').trim(),
          String(r.namaKelDesa || '').trim(),
          String(r.parentKode || '').trim()
        ];
      });

      const lock = LockService.getScriptLock();
      lock.waitLock(15000);
      try {
        if (replaceAll && kwSheet.getLastRow() > 1) {
          kwSheet.getRange(2, 1, kwSheet.getLastRow() - 1, 11).clearContent();
        }
        const startRow = replaceAll ? 2 : Math.max(2, kwSheet.getLastRow() + 1);
        kwSheet.getRange(startRow, 1, values.length, 11).setNumberFormat('@').setValues(values);
      } finally {
        lock.releaseLock();
      }

      writeLog_('SUPERADMIN', 'importKodeWilayah', 'Berhasil menulis ' + values.length + ' baris kode wilayah.');
      return jsonOut_({ ok: true, count: values.length });
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
