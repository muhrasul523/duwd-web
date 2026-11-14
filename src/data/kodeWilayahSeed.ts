import type { KodeWilayahItem } from '../types/org';

/**
 * Data awal 38 Provinsi Indonesia lengkap dengan Kode Wilayah resmi (11-96)
 * dan pengelompokan Pulau untuk pengurutan & pemfilteran konsisten.
 * Data lengkap hingga Kab/Kota, Kecamatan, dan Kelurahan/Desa disinkronkan
 * dari sheet KODE_WILAYAH pada Spreadsheet #2.
 */
export const STARTER_KODE_WILAYAH: KodeWilayahItem[] = [
  { kodeWilayah: '11', tingkat: 'Provinsi', pulau: 'Sumatera', kodeProvinsi: '11', namaProvinsi: 'Aceh' },
  { kodeWilayah: '12', tingkat: 'Provinsi', pulau: 'Sumatera', kodeProvinsi: '12', namaProvinsi: 'Sumatera Utara' },
  { kodeWilayah: '13', tingkat: 'Provinsi', pulau: 'Sumatera', kodeProvinsi: '13', namaProvinsi: 'Sumatera Barat' },
  { kodeWilayah: '14', tingkat: 'Provinsi', pulau: 'Sumatera', kodeProvinsi: '14', namaProvinsi: 'Riau' },
  { kodeWilayah: '15', tingkat: 'Provinsi', pulau: 'Sumatera', kodeProvinsi: '15', namaProvinsi: 'Jambi' },
  { kodeWilayah: '16', tingkat: 'Provinsi', pulau: 'Sumatera', kodeProvinsi: '16', namaProvinsi: 'Sumatera Selatan' },
  { kodeWilayah: '17', tingkat: 'Provinsi', pulau: 'Sumatera', kodeProvinsi: '17', namaProvinsi: 'Bengkulu' },
  { kodeWilayah: '18', tingkat: 'Provinsi', pulau: 'Sumatera', kodeProvinsi: '18', namaProvinsi: 'Lampung' },
  { kodeWilayah: '19', tingkat: 'Provinsi', pulau: 'Sumatera', kodeProvinsi: '19', namaProvinsi: 'Kepulauan Bangka Belitung' },
  { kodeWilayah: '21', tingkat: 'Provinsi', pulau: 'Sumatera', kodeProvinsi: '21', namaProvinsi: 'Kepulauan Riau' },

  { kodeWilayah: '31', tingkat: 'Provinsi', pulau: 'Jawa', kodeProvinsi: '31', namaProvinsi: 'DKI Jakarta' },
  { kodeWilayah: '32', tingkat: 'Provinsi', pulau: 'Jawa', kodeProvinsi: '32', namaProvinsi: 'Jawa Barat' },
  { kodeWilayah: '33', tingkat: 'Provinsi', pulau: 'Jawa', kodeProvinsi: '33', namaProvinsi: 'Jawa Tengah' },
  { kodeWilayah: '34', tingkat: 'Provinsi', pulau: 'Jawa', kodeProvinsi: '34', namaProvinsi: 'DI Yogyakarta' },
  { kodeWilayah: '35', tingkat: 'Provinsi', pulau: 'Jawa', kodeProvinsi: '35', namaProvinsi: 'Jawa Timur' },
  { kodeWilayah: '36', tingkat: 'Provinsi', pulau: 'Jawa', kodeProvinsi: '36', namaProvinsi: 'Banten' },

  { kodeWilayah: '51', tingkat: 'Provinsi', pulau: 'Bali & Nusa Tenggara', kodeProvinsi: '51', namaProvinsi: 'Bali' },
  { kodeWilayah: '52', tingkat: 'Provinsi', pulau: 'Bali & Nusa Tenggara', kodeProvinsi: '52', namaProvinsi: 'Nusa Tenggara Barat' },
  { kodeWilayah: '53', tingkat: 'Provinsi', pulau: 'Bali & Nusa Tenggara', kodeProvinsi: '53', namaProvinsi: 'Nusa Tenggara Timur' },

  { kodeWilayah: '61', tingkat: 'Provinsi', pulau: 'Kalimantan', kodeProvinsi: '61', namaProvinsi: 'Kalimantan Barat' },
  { kodeWilayah: '62', tingkat: 'Provinsi', pulau: 'Kalimantan', kodeProvinsi: '62', namaProvinsi: 'Kalimantan Tengah' },
  { kodeWilayah: '63', tingkat: 'Provinsi', pulau: 'Kalimantan', kodeProvinsi: '63', namaProvinsi: 'Kalimantan Selatan' },
  { kodeWilayah: '64', tingkat: 'Provinsi', pulau: 'Kalimantan', kodeProvinsi: '64', namaProvinsi: 'Kalimantan Timur' },
  { kodeWilayah: '65', tingkat: 'Provinsi', pulau: 'Kalimantan', kodeProvinsi: '65', namaProvinsi: 'Kalimantan Utara' },

  { kodeWilayah: '71', tingkat: 'Provinsi', pulau: 'Sulawesi', kodeProvinsi: '71', namaProvinsi: 'Sulawesi Utara' },
  { kodeWilayah: '72', tingkat: 'Provinsi', pulau: 'Sulawesi', kodeProvinsi: '72', namaProvinsi: 'Sulawesi Tengah' },
  { kodeWilayah: '73', tingkat: 'Provinsi', pulau: 'Sulawesi', kodeProvinsi: '73', namaProvinsi: 'Sulawesi Selatan' },
  { kodeWilayah: '74', tingkat: 'Provinsi', pulau: 'Sulawesi', kodeProvinsi: '74', namaProvinsi: 'Sulawesi Tenggara' },
  { kodeWilayah: '75', tingkat: 'Provinsi', pulau: 'Sulawesi', kodeProvinsi: '75', namaProvinsi: 'Gorontalo' },
  { kodeWilayah: '76', tingkat: 'Provinsi', pulau: 'Sulawesi', kodeProvinsi: '76', namaProvinsi: 'Sulawesi Barat' },

  { kodeWilayah: '81', tingkat: 'Provinsi', pulau: 'Maluku', kodeProvinsi: '81', namaProvinsi: 'Maluku' },
  { kodeWilayah: '82', tingkat: 'Provinsi', pulau: 'Maluku', kodeProvinsi: '82', namaProvinsi: 'Maluku Utara' },

  { kodeWilayah: '91', tingkat: 'Provinsi', pulau: 'Papua', kodeProvinsi: '91', namaProvinsi: 'Papua' },
  { kodeWilayah: '92', tingkat: 'Provinsi', pulau: 'Papua', kodeProvinsi: '92', namaProvinsi: 'Papua Barat' },
  { kodeWilayah: '93', tingkat: 'Provinsi', pulau: 'Papua', kodeProvinsi: '93', namaProvinsi: 'Papua Selatan' },
  { kodeWilayah: '94', tingkat: 'Provinsi', pulau: 'Papua', kodeProvinsi: '94', namaProvinsi: 'Papua Tengah' },
  { kodeWilayah: '95', tingkat: 'Provinsi', pulau: 'Papua', kodeProvinsi: '95', namaProvinsi: 'Papua Pegunungan' },
  { kodeWilayah: '96', tingkat: 'Provinsi', pulau: 'Papua', kodeProvinsi: '96', namaProvinsi: 'Papua Barat Daya' },
];
