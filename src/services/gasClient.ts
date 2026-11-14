import { buildDriveAccessLinks, loadGasConfig } from '../config/driveConfig';
import type {
  Agenda4MItem,
  DriveAsset,
  DriveFileFormat,
  GasApiResponse,
  KhidmatPayload,
  KhidmatReceipt,
} from '../types/duwd';

function buildQueryUrl(baseUrl: string, params: Record<string, string>): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });
  return url.toString();
}

export async function pingGasBackend(customUrl?: string): Promise<GasApiResponse> {
  const config = loadGasConfig();
  const endpoint = (customUrl ?? config.webAppUrl).trim();

  if (!endpoint) {
    return {
      ok: false,
      error: 'URL Web App Google Apps Script belum diatur.',
    };
  }

  try {
    const response = await fetch(buildQueryUrl(endpoint, { action: 'ping' }), {
      method: 'GET',
    });
    const json = (await response.json()) as GasApiResponse;
    return json;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Gagal menghubungi endpoint Google Apps Script.',
    };
  }
}

export async function postToGas<T>(
  action: string,
  payload: Record<string, unknown>,
): Promise<GasApiResponse<T>> {
  const config = loadGasConfig();
  const endpoint = config.webAppUrl.trim();

  if (!endpoint) {
    return {
      ok: false,
      error: 'Endpoint GAS belum terhubung (mode lokal aktif).',
    };
  }

  try {
    // Menggunakan text/plain;charset=utf-8 mencegah preflight CORS OPTIONS di Google Apps Script
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify({
        action,
        token: config.apiToken || undefined,
        payload,
      }),
    });
    return (await response.json()) as GasApiResponse<T>;
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi gangguan jaringan saat mengirim data ke Google Apps Script.',
    };
  }
}

export async function submitKhidmatRequest(
  form: KhidmatPayload,
): Promise<{ receipt: KhidmatReceipt; syncedToGas: boolean }> {
  const remote = await postToGas<Record<string, string>>('createKhidmat', {
    ...form,
  });

  if (remote.ok && remote.ticketId) {
    return {
      syncedToGas: true,
      receipt: {
        ticketId: remote.ticketId,
        tanggalMasuk: new Date().toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        nama: form.nama,
        asalUnit: form.asalUnit,
        kategori: form.kategori,
        perihal: form.perihal,
        status: 'Terkirim ke Google Sheets',
      },
    };
  }

  const localTicket = `KHD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(
    1000 + Math.random() * 9000,
  )}`;

  return {
    syncedToGas: false,
    receipt: {
      ticketId: localTicket,
      tanggalMasuk: new Date().toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      nama: form.nama,
      asalUnit: form.asalUnit,
      kategori: form.kategori,
      perihal: form.perihal,
      status: 'Tersimpan di Antrean Lokal (Siap Sinkron GAS)',
    },
  };
}

export async function registerDriveLinkAsset(input: {
  judul: string;
  driveUrl: string;
  kategori: string;
  format: DriveFileFormat;
  dpw: string;
}): Promise<{ asset: DriveAsset; syncedToGas: boolean }> {
  const links = buildDriveAccessLinks(input.driveUrl);
  const remote = await postToGas<Record<string, string>>('registerDriveLink', {
    judul: input.judul,
    driveUrl: input.driveUrl,
    kategori: input.kategori,
    format: input.format,
    dpw: input.dpw,
  });

  const id =
    remote.ok && remote.data?.ID_Arsip
      ? remote.data.ID_Arsip
      : `ARS-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    syncedToGas: Boolean(remote.ok),
    asset: {
      id,
      driveFileId: links.fileId || 'EXTERNAL-LINK',
      judul: input.judul.trim(),
      kategori: input.kategori,
      format: input.format,
      unitDpw: input.dpw.trim() || 'DPP DUWD',
      ukuranTeks: remote.ok && remote.data?.Ukuran_Teks ? remote.data.Ukuran_Teks : 'Tautan Cloud',
      urlAsli: links.viewUrl,
      urlPratinjau: links.previewUrl,
      urlUnduh: links.downloadUrl || links.viewUrl,
      diunggahPada: new Date().toISOString().slice(0, 10),
    },
  };
}

export async function saveAgenda4MItem(
  item: Omit<Agenda4MItem, 'id'>,
): Promise<{ agenda: Agenda4MItem; syncedToGas: boolean }> {
  const remote = await postToGas<Record<string, string>>('upsert4M', {
    jenis: item.jenis,
    judul: item.judul,
    wilayah: item.wilayah,
    tanggalPelaksanaan: item.tanggalPelaksanaan,
    lokasi: item.lokasi,
    status: item.status,
    progres: item.progresPersen,
    skDriveUrl: item.skDriveUrl || '',
  });

  const agendaId =
    remote.ok && remote.data?.ID_Agenda
      ? remote.data.ID_Agenda
      : `4M-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    syncedToGas: Boolean(remote.ok),
    agenda: {
      id: agendaId,
      ...item,
    },
  };
}
