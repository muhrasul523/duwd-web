import {
  AlertTriangle,
  Building2,
  Check,
  Download,
  ExternalLink,
  MapPin,
  MessageCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  deleteDpdRecord,
  deleteDpwRecord,
  fetchWilayahChildren,
  importKodeWilayahBatch,
  saveDpdRecord,
  saveDpwRecord,
} from '../services/orgService';
import type {
  DpdItem,
  DpwItem,
  KodeWilayahItem,
  StatusTerbentuk,
  TingkatWilayah,
  UserRole,
} from '../types/org';
import {
  buildWhatsAppLink,
  isValidWhatsApp,
  normalizeWhatsApp,
} from '../utils/whatsapp';
import { WhatsAppInput } from './WhatsAppInput';

interface DpwDpdViewProps {
  role: UserRole;
  activePin: string;
  webAppUrl: string;
  wilayahConnected: boolean;
  kodeWilayahList: KodeWilayahItem[];
  dpwList: DpwItem[];
  dpdList: DpdItem[];
  syncing: boolean;
  onRefresh: () => void;
  onSaveDpw: (item: DpwItem) => void;
  onDeleteDpw: (id: string) => void;
  onSaveDpd: (item: DpdItem) => void;
  onDeleteDpd: (id: string) => void;
  onImportedKodeWilayah: (rows: KodeWilayahItem[]) => void;
}

type SubTab = 'dpw' | 'dpd' | 'wilayah';

const STATUS_TERBENTUK_OPTIONS: StatusTerbentuk[] = [
  'Sudah Terbentuk',
  'Persiapan',
  'Belum Terbentuk',
];

function compareKode(a: string, b: string): number {
  return String(a || '').localeCompare(String(b || ''), 'id', { numeric: true });
}

function getStatusColor(status: StatusTerbentuk): string {
  switch (status) {
    case 'Sudah Terbentuk':
      return 'text-emerald-700 font-semibold';
    case 'Persiapan':
      return 'text-[#9A6008] font-semibold';
    default:
      return 'text-[#6B8187] font-medium';
  }
}

function escapeCsvCell(val: string | undefined): string {
  const s = String(val ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current.trim());
  return out;
}

function inferTingkat(kode: string, rawTingkat?: string): TingkatWilayah {
  const clean = (rawTingkat || '').trim().toLowerCase();
  if (clean.includes('pulau')) return 'Pulau';
  if (clean.includes('prov')) return 'Provinsi';
  if (clean.includes('kab') || clean.includes('kota')) return 'KabKota';
  if (clean.includes('kec')) return 'Kecamatan';
  if (clean.includes('kel') || clean.includes('desa')) return 'KelDesa';

  const segs = kode.split('.').filter(Boolean).length;
  if (kode.toUpperCase().startsWith('P-')) return 'Pulau';
  if (segs <= 1) return 'Provinsi';
  if (segs === 2) return 'KabKota';
  if (segs === 3) return 'Kecamatan';
  return 'KelDesa';
}

export function DpwDpdView({
  role,
  activePin,
  webAppUrl,
  wilayahConnected,
  kodeWilayahList,
  dpwList,
  dpdList,
  syncing,
  onRefresh,
  onSaveDpw,
  onDeleteDpw,
  onSaveDpd,
  onDeleteDpd,
  onImportedKodeWilayah,
}: DpwDpdViewProps) {
  const canEdit = role === 'superadmin';

  const [subTab, setSubTab] = useState<SubTab>('dpw');
  const [filterPulau, setFilterPulau] = useState('ALL');
  const [filterProvinsi, setFilterProvinsi] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | StatusTerbentuk>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [notice, setNotice] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  // Konfirmasi hapus
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Modal Form DPW
  const [dpwFormOpen, setDpwFormOpen] = useState(false);
  const [editingDpw, setEditingDpw] = useState<DpwItem | null>(null);
  const [dpwKode, setDpwKode] = useState('');
  const [dpwPulau, setDpwPulau] = useState('');
  const [dpwProvinsi, setDpwProvinsi] = useState('');
  const [dpwNama, setDpwNama] = useState('');
  const [dpwStatus, setDpwStatus] = useState<StatusTerbentuk>('Sudah Terbentuk');
  const [dpwKetuaNama, setDpwKetuaNama] = useState('');
  const [dpwKetuaWa, setDpwKetuaWa] = useState('');
  const [dpwSekNama, setDpwSekNama] = useState('');
  const [dpwSekWa, setDpwSekWa] = useState('');
  const [dpwAlamat, setDpwAlamat] = useState('');
  const [dpwDrive, setDpwDrive] = useState('');
  const [dpwSaving, setDpwSaving] = useState(false);
  const [dpwFormErr, setDpwFormErr] = useState('');

  // Modal Form DPD
  const [dpdFormOpen, setDpdFormOpen] = useState(false);
  const [editingDpd, setEditingDpd] = useState<DpdItem | null>(null);
  const [dpdKodeProv, setDpdKodeProv] = useState('');
  const [dpdKode, setDpdKode] = useState('');
  const [dpdPulau, setDpdPulau] = useState('');
  const [dpdNamaProv, setDpdNamaProv] = useState('');
  const [dpdKabKota, setDpdKabKota] = useState('');
  const [dpdNama, setDpdNama] = useState('');
  const [dpdStatus, setDpdStatus] = useState<StatusTerbentuk>('Sudah Terbentuk');
  const [dpdKetuaNama, setDpdKetuaNama] = useState('');
  const [dpdKetuaWa, setDpdKetuaWa] = useState('');
  const [dpdSekNama, setDpdSekNama] = useState('');
  const [dpdSekWa, setDpdSekWa] = useState('');
  const [dpdAlamat, setDpdAlamat] = useState('');
  const [dpdDrive, setDpdDrive] = useState('');
  const [dpdSaving, setDpdSaving] = useState(false);
  const [dpdFormErr, setDpdFormErr] = useState('');

  // Referensi Wilayah on-demand children + CSV import
  const [childrenRows, setChildrenRows] = useState<KodeWilayahItem[]>([]);
  const [loadingChildren, setLoadingChildren] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);

  const provinces = useMemo(
    () =>
      kodeWilayahList
        .filter((k) => k.tingkat === 'Provinsi')
        .sort((a, b) => compareKode(a.kodeWilayah, b.kodeWilayah)),
    [kodeWilayahList],
  );

  const regencies = useMemo(
    () =>
      kodeWilayahList
        .filter((k) => k.tingkat === 'KabKota')
        .sort((a, b) => compareKode(a.kodeWilayah, b.kodeWilayah)),
    [kodeWilayahList],
  );

  const pulauList = useMemo(() => {
    const set = new Set<string>();
    provinces.forEach((p) => {
      if (p.pulau) set.add(p.pulau);
    });
    dpwList.forEach((d) => {
      if (d.pulau) set.add(d.pulau);
    });
    return Array.from(set);
  }, [provinces, dpwList]);

  const filteredDpw = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dpwList
      .filter((item) => {
        if (filterPulau !== 'ALL' && item.pulau !== filterPulau) return false;
        if (filterStatus !== 'ALL' && item.statusTerbentuk !== filterStatus) return false;
        if (q) {
          const hay = [
            item.kodeWilayah,
            item.pulau,
            item.namaProvinsi,
            item.namaDpw,
            item.ketuaNama,
            item.ketuaWa,
            item.sekretarisNama,
            item.sekretarisWa,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => compareKode(a.kodeWilayah, b.kodeWilayah));
  }, [dpwList, filterPulau, filterStatus, searchQuery]);

  const filteredDpd = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dpdList
      .filter((item) => {
        if (filterPulau !== 'ALL' && item.pulau !== filterPulau) return false;
        if (filterProvinsi !== 'ALL' && item.kodeProvinsi !== filterProvinsi) return false;
        if (filterStatus !== 'ALL' && item.statusTerbentuk !== filterStatus) return false;
        if (q) {
          const hay = [
            item.kodeWilayah,
            item.kodeProvinsi,
            item.pulau,
            item.namaProvinsi,
            item.namaKabKota,
            item.namaDpd,
            item.ketuaNama,
            item.ketuaWa,
            item.sekretarisNama,
            item.sekretarisWa,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => compareKode(a.kodeWilayah, b.kodeWilayah));
  }, [dpdList, filterPulau, filterProvinsi, filterStatus, searchQuery]);

  const filteredWilayahRows = useMemo(() => {
    const source = childrenRows.length > 0 ? childrenRows : kodeWilayahList;
    const q = searchQuery.trim().toLowerCase();
    return source
      .filter((item) => {
        if (filterPulau !== 'ALL' && item.pulau !== filterPulau) return false;
        if (filterProvinsi !== 'ALL' && item.kodeProvinsi !== filterProvinsi) return false;
        if (q) {
          const hay = [
            item.kodeWilayah,
            item.tingkat,
            item.pulau,
            item.namaProvinsi,
            item.namaKabKota,
            item.namaKecamatan,
            item.namaKelDesa,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => compareKode(a.kodeWilayah, b.kodeWilayah));
  }, [childrenRows, kodeWilayahList, filterPulau, filterProvinsi, searchQuery]);

  const dpwTerbentukCount = useMemo(
    () => dpwList.filter((d) => d.statusTerbentuk === 'Sudah Terbentuk').length,
    [dpwList],
  );
  const dpdTerbentukCount = useMemo(
    () => dpdList.filter((d) => d.statusTerbentuk === 'Sudah Terbentuk').length,
    [dpdList],
  );

  // Handlers DPW
  const openCreateDpw = () => {
    const firstProv = provinces[0];
    setEditingDpw(null);
    setDpwKode(firstProv?.kodeWilayah || '');
    setDpwPulau(firstProv?.pulau || '');
    setDpwProvinsi(firstProv?.namaProvinsi || '');
    setDpwNama(firstProv ? `DPW Wahdah Islamiyah ${firstProv.namaProvinsi}` : '');
    setDpwStatus('Sudah Terbentuk');
    setDpwKetuaNama('');
    setDpwKetuaWa('');
    setDpwSekNama('');
    setDpwSekWa('');
    setDpwAlamat('');
    setDpwDrive('');
    setDpwFormErr('');
    setDpwFormOpen(true);
  };

  const openEditDpw = (item: DpwItem) => {
    setEditingDpw(item);
    setDpwKode(item.kodeWilayah);
    setDpwPulau(item.pulau);
    setDpwProvinsi(item.namaProvinsi);
    setDpwNama(item.namaDpw);
    setDpwStatus(item.statusTerbentuk || 'Sudah Terbentuk');
    setDpwKetuaNama(item.ketuaNama);
    setDpwKetuaWa(item.ketuaWa);
    setDpwSekNama(item.sekretarisNama);
    setDpwSekWa(item.sekretarisWa);
    setDpwAlamat(item.alamatKantor || '');
    setDpwDrive(item.tautanDrive || '');
    setDpwFormErr('');
    setDpwFormOpen(true);
  };

  const handleSelectDpwProvince = (kodeProv: string) => {
    setDpwKode(kodeProv);
    const prov = provinces.find((p) => p.kodeWilayah === kodeProv);
    if (prov) {
      setDpwPulau(prov.pulau);
      setDpwProvinsi(prov.namaProvinsi);
      if (!editingDpw) {
        setDpwNama(`DPW Wahdah Islamiyah ${prov.namaProvinsi}`);
      }
    }
  };

  const handleSubmitDpw = async (e: React.FormEvent) => {
    e.preventDefault();
    setDpwFormErr('');

    if (!dpwKode.trim() || !dpwProvinsi.trim() || !dpwNama.trim()) {
      setDpwFormErr('Kode wilayah, provinsi, dan nama DPW wajib diisi.');
      return;
    }

    const cleanKetuaWa = dpwKetuaWa.trim() ? normalizeWhatsApp(dpwKetuaWa) : '';
    const cleanSekWa = dpwSekWa.trim() ? normalizeWhatsApp(dpwSekWa) : '';

    if (cleanKetuaWa && !isValidWhatsApp(cleanKetuaWa)) {
      setDpwFormErr('Nomor WhatsApp Ketua tidak valid (harus angka diawali 08 atau 628).');
      return;
    }
    if (cleanSekWa && !isValidWhatsApp(cleanSekWa)) {
      setDpwFormErr('Nomor WhatsApp Sekretaris tidak valid (harus angka diawali 08 atau 628).');
      return;
    }

    setDpwSaving(true);
    try {
      const res = await saveDpwRecord(
        {
          id: editingDpw?.id,
          kodeWilayah: dpwKode.trim(),
          pulau: dpwPulau.trim(),
          namaDpw: dpwNama.trim(),
          namaProvinsi: dpwProvinsi.trim(),
          statusTerbentuk: dpwStatus,
          ketuaNama: dpwKetuaNama.trim(),
          ketuaWa: cleanKetuaWa,
          sekretarisNama: dpwSekNama.trim(),
          sekretarisWa: cleanSekWa,
          alamatKantor: dpwAlamat.trim(),
          tautanDrive: dpwDrive.trim(),
        },
        activePin,
        webAppUrl,
      );

      if (res.ok && res.item) {
        onSaveDpw(res.item);
        setDpwFormOpen(false);
        setNotice(
          res.synced
            ? `"${res.item.namaDpw}" berhasil disimpan ke Spreadsheet #2 (tab DPW).`
            : `"${res.item.namaDpw}" disimpan di browser lokal.`,
        );
        window.setTimeout(() => setNotice(''), 4000);
      } else {
        setDpwFormErr(res.error || 'Gagal menyimpan data DPW.');
      }
    } finally {
      setDpwSaving(false);
    }
  };

  // Handlers DPD
  const openCreateDpd = () => {
    const defaultProv =
      filterProvinsi !== 'ALL'
        ? provinces.find((p) => p.kodeWilayah === filterProvinsi) || provinces[0]
        : provinces[0];
    setEditingDpd(null);
    setDpdKodeProv(defaultProv?.kodeWilayah || '');
    setDpdNamaProv(defaultProv?.namaProvinsi || '');
    setDpdPulau(defaultProv?.pulau || '');
    setDpdKode(defaultProv ? `${defaultProv.kodeWilayah}.01` : '');
    setDpdKabKota('');
    setDpdNama('');
    setDpdStatus('Sudah Terbentuk');
    setDpdKetuaNama('');
    setDpdKetuaWa('');
    setDpdSekNama('');
    setDpdSekWa('');
    setDpdAlamat('');
    setDpdDrive('');
    setDpdFormErr('');
    setDpdFormOpen(true);
  };

  const openEditDpd = (item: DpdItem) => {
    setEditingDpd(item);
    setDpdKodeProv(item.kodeProvinsi || item.kodeWilayah.split('.')[0] || '');
    setDpdKode(item.kodeWilayah);
    setDpdPulau(item.pulau);
    setDpdNamaProv(item.namaProvinsi);
    setDpdKabKota(item.namaKabKota);
    setDpdNama(item.namaDpd);
    setDpdStatus(item.statusTerbentuk || 'Sudah Terbentuk');
    setDpdKetuaNama(item.ketuaNama);
    setDpdKetuaWa(item.ketuaWa);
    setDpdSekNama(item.sekretarisNama);
    setDpdSekWa(item.sekretarisWa);
    setDpdAlamat(item.alamatKantor || '');
    setDpdDrive(item.tautanDrive || '');
    setDpdFormErr('');
    setDpdFormOpen(true);
  };

  const dpdRegencyOptions = useMemo(
    () => regencies.filter((r) => !dpdKodeProv || r.kodeProvinsi === dpdKodeProv),
    [regencies, dpdKodeProv],
  );

  const handleSelectDpdProvince = (kodeProv: string) => {
    setDpdKodeProv(kodeProv);
    const prov = provinces.find((p) => p.kodeWilayah === kodeProv);
    if (prov) {
      setDpdNamaProv(prov.namaProvinsi);
      setDpdPulau(prov.pulau);
      if (!editingDpd) {
        const firstKab = regencies.find((r) => r.kodeProvinsi === kodeProv);
        if (firstKab) {
          setDpdKode(firstKab.kodeWilayah);
          setDpdKabKota(firstKab.namaKabKota || '');
          setDpdNama(`DPD Wahdah Islamiyah ${firstKab.namaKabKota || ''}`);
        } else {
          setDpdKode(`${kodeProv}.01`);
          setDpdKabKota('');
          setDpdNama('');
        }
      }
    }
  };

  const handleSelectDpdKabKota = (kodeKab: string) => {
    setDpdKode(kodeKab);
    const kab = regencies.find((r) => r.kodeWilayah === kodeKab);
    if (kab) {
      setDpdKabKota(kab.namaKabKota || '');
      if (!editingDpd) {
        setDpdNama(`DPD Wahdah Islamiyah ${kab.namaKabKota || ''}`);
      }
    }
  };

  const handleSubmitDpd = async (e: React.FormEvent) => {
    e.preventDefault();
    setDpdFormErr('');

    if (!dpdKode.trim() || !dpdKabKota.trim() || !dpdNama.trim()) {
      setDpdFormErr('Kode wilayah, nama Kab/Kota, dan nama DPD wajib diisi.');
      return;
    }

    const cleanKetuaWa = dpdKetuaWa.trim() ? normalizeWhatsApp(dpdKetuaWa) : '';
    const cleanSekWa = dpdSekWa.trim() ? normalizeWhatsApp(dpdSekWa) : '';

    if (cleanKetuaWa && !isValidWhatsApp(cleanKetuaWa)) {
      setDpdFormErr('Nomor WhatsApp Ketua tidak valid (harus angka diawali 08 atau 628).');
      return;
    }
    if (cleanSekWa && !isValidWhatsApp(cleanSekWa)) {
      setDpdFormErr('Nomor WhatsApp Sekretaris tidak valid (harus angka diawali 08 atau 628).');
      return;
    }

    setDpdSaving(true);
    try {
      const res = await saveDpdRecord(
        {
          id: editingDpd?.id,
          kodeWilayah: dpdKode.trim(),
          kodeProvinsi: dpdKodeProv.trim() || dpdKode.trim().split('.')[0] || '',
          pulau: dpdPulau.trim(),
          namaProvinsi: dpdNamaProv.trim(),
          namaDpd: dpdNama.trim(),
          namaKabKota: dpdKabKota.trim(),
          statusTerbentuk: dpdStatus,
          ketuaNama: dpdKetuaNama.trim(),
          ketuaWa: cleanKetuaWa,
          sekretarisNama: dpdSekNama.trim(),
          sekretarisWa: cleanSekWa,
          alamatKantor: dpdAlamat.trim(),
          tautanDrive: dpdDrive.trim(),
        },
        activePin,
        webAppUrl,
      );

      if (res.ok && res.item) {
        onSaveDpd(res.item);
        setDpdFormOpen(false);
        setNotice(
          res.synced
            ? `"${res.item.namaDpd}" berhasil disimpan ke Spreadsheet #2 (tab DPD).`
            : `"${res.item.namaDpd}" disimpan di browser lokal.`,
        );
        window.setTimeout(() => setNotice(''), 4000);
      } else {
        setDpdFormErr(res.error || 'Gagal menyimpan data DPD.');
      }
    } finally {
      setDpdSaving(false);
    }
  };

  const handleDeleteRecord = async (type: 'dpw' | 'dpd', id: string) => {
    setErrorBanner('');
    const res =
      type === 'dpw'
        ? await deleteDpwRecord(id, activePin, webAppUrl)
        : await deleteDpdRecord(id, activePin, webAppUrl);

    if (res.ok) {
      if (type === 'dpw') onDeleteDpw(id);
      else onDeleteDpd(id);
      setConfirmDeleteId(null);
      setNotice(
        res.synced
          ? `Data ${type.toUpperCase()} dihapus dari Spreadsheet #2.`
          : `Data ${type.toUpperCase()} dihapus dari daftar lokal.`,
      );
      window.setTimeout(() => setNotice(''), 3500);
    } else {
      setErrorBanner(res.error || `Gagal menghapus data ${type.toUpperCase()}.`);
    }
  };

  const handleLoadChildren = async () => {
    if (!webAppUrl.trim() || filterProvinsi === 'ALL') return;
    setLoadingChildren(true);
    setErrorBanner('');
    try {
      const res = await fetchWilayahChildren(webAppUrl, {
        kodeProvinsi: filterProvinsi,
      });
      if (res.ok) {
        setChildrenRows(res.data);
        setNotice(`Memuat ${res.data.length} baris detail kode wilayah dari Spreadsheet #2.`);
      } else {
        setErrorBanner(res.error || 'Gagal memuat detail wilayah.');
      }
    } finally {
      setLoadingChildren(false);
    }
  };

  const handleCsvFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImportingCsv(true);
    setErrorBanner('');
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        setErrorBanner('File CSV kosong atau tidak memiliki baris data.');
        return;
      }

      const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
      const headers = splitCsvLine(lines[0], delimiter).map((h) =>
        h.toLowerCase().replace(/[^a-z0-9]/g, ''),
      );

      const findIdx = (candidates: string[]) =>
        headers.findIndex((h) => candidates.some((c) => h.includes(c)));

      const idxKode = findIdx(['kodewilayah', 'kode', 'code']);
      const idxTingkat = findIdx(['tingkat', 'level']);
      const idxPulau = findIdx(['pulau', 'island', 'region']);
      const idxKodeProv = findIdx(['kodeprov']);
      const idxNamaProv = findIdx(['namaprov', 'provinsi']);
      const idxKodeKab = findIdx(['kodekab', 'kodekota']);
      const idxNamaKab = findIdx(['namakab', 'kabkota', 'kabupaten', 'kota']);
      const idxKodeKec = findIdx(['kodekec']);
      const idxNamaKec = findIdx(['namakec', 'kecamatan']);
      const idxNamaDesa = findIdx(['keldesa', 'kelurahan', 'desa']);
      const idxParent = findIdx(['parent']);

      const parsedRows: KodeWilayahItem[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i], delimiter);
        const kode = idxKode >= 0 ? cols[idxKode] || '' : cols[0] || '';
        if (!kode) continue;
        const tingkat = inferTingkat(kode, idxTingkat >= 0 ? cols[idxTingkat] : undefined);
        const segs = kode.split('.').filter(Boolean);
        parsedRows.push({
          kodeWilayah: kode,
          tingkat,
          pulau: idxPulau >= 0 ? cols[idxPulau] || '' : '',
          kodeProvinsi: idxKodeProv >= 0 ? cols[idxKodeProv] || segs[0] || '' : segs[0] || '',
          namaProvinsi: idxNamaProv >= 0 ? cols[idxNamaProv] || '' : '',
          kodeKabKota:
            idxKodeKab >= 0
              ? cols[idxKodeKab] || ''
              : segs.length >= 2
                ? segs.slice(0, 2).join('.')
                : '',
          namaKabKota: idxNamaKab >= 0 ? cols[idxNamaKab] || '' : '',
          kodeKecamatan:
            idxKodeKec >= 0
              ? cols[idxKodeKec] || ''
              : segs.length >= 3
                ? segs.slice(0, 3).join('.')
                : '',
          namaKecamatan: idxNamaKec >= 0 ? cols[idxNamaKec] || '' : '',
          namaKelDesa: idxNamaDesa >= 0 ? cols[idxNamaDesa] || '' : '',
          parentKode:
            idxParent >= 0
              ? cols[idxParent] || ''
              : segs.length > 1
                ? segs.slice(0, segs.length - 1).join('.')
                : '',
        });
      }

      if (parsedRows.length === 0) {
        setErrorBanner('Tidak ada baris kode wilayah valid yang terbaca dari CSV.');
        return;
      }

      // Kirim dalam batch 400 baris agar aman terhadap batas payload Apps Script
      const BATCH_SIZE = 400;
      for (let start = 0; start < parsedRows.length; start += BATCH_SIZE) {
        const slice = parsedRows.slice(start, start + BATCH_SIZE);
        const res = await importKodeWilayahBatch(
          slice,
          start === 0,
          activePin,
          webAppUrl,
        );
        if (!res.ok) {
          setErrorBanner(res.error || 'Gagal mengunggah batch CSV ke Spreadsheet #2.');
          return;
        }
      }

      const summaryRows = parsedRows.filter(
        (r) => r.tingkat === 'Pulau' || r.tingkat === 'Provinsi' || r.tingkat === 'KabKota',
      );
      if (summaryRows.length > 0) {
        onImportedKodeWilayah(summaryRows);
      }
      setNotice(`Berhasil mengimpor ${parsedRows.length} baris kode wilayah ke Spreadsheet #2.`);
    } finally {
      setImportingCsv(false);
    }
  };

  const handleExportCsv = () => {
    if (subTab === 'dpw') {
      const headers = [
        'Kode Wilayah',
        'Pulau',
        'Provinsi',
        'Nama DPW',
        'Status',
        'Ketua',
        'WA Ketua',
        'Sekretaris',
        'WA Sekretaris',
        'Alamat Kantor',
      ];
      const lines = [
        headers.map(escapeCsvCell).join(','),
        ...filteredDpw.map((d) =>
          [
            d.kodeWilayah,
            d.pulau,
            d.namaProvinsi,
            d.namaDpw,
            d.statusTerbentuk,
            d.ketuaNama,
            d.ketuaWa,
            d.sekretarisNama,
            d.sekretarisWa,
            d.alamatKantor,
          ]
            .map(escapeCsvCell)
            .join(','),
        ),
      ];
      const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
        type: 'text/csv;charset=utf-8;',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'DPW_DUWD_WI.csv';
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const headers = [
      'Kode Wilayah',
      'Kode Provinsi',
      'Pulau',
      'Provinsi',
      'Kabupaten/Kota',
      'Nama DPD',
      'Status',
      'Ketua',
      'WA Ketua',
      'Sekretaris',
      'WA Sekretaris',
      'Alamat Kantor',
    ];
    const lines = [
      headers.map(escapeCsvCell).join(','),
      ...filteredDpd.map((d) =>
        [
          d.kodeWilayah,
          d.kodeProvinsi,
          d.pulau,
          d.namaProvinsi,
          d.namaKabKota,
          d.namaDpd,
          d.statusTerbentuk,
          d.ketuaNama,
          d.ketuaWa,
          d.sekretarisNama,
          d.sekretarisWa,
          d.alamatKantor,
        ]
          .map(escapeCsvCell)
          .join(','),
      ),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DPD_DUWD_WI.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 lg:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#0C7A89]">
            Konsolidasi Wilayah &amp; Daerah &middot; Berbasis Kode Wilayah
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] sm:text-3xl">
            Direktori &amp; Pengaturan DPW / DPD
          </h1>
          <p className="mt-1 text-sm text-[#526A70]">
            Pemetaan DPW dan DPD terbentuk beserta Ketua, Sekretaris, dan nomor WhatsApp terverifikasi (Spreadsheet #2).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {subTab !== 'wilayah' && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white"
            >
              <Download className="h-3.5 w-3.5 text-[#0C7A89]" />
              <span>Unduh CSV</span>
            </button>
          )}

          {webAppUrl.trim() && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={syncing}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan Sheet'}</span>
            </button>
          )}

          {canEdit && subTab === 'dpw' && (
            <button
              type="button"
              onClick={openCreateDpw}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:-translate-y-0.5 transition-transform"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah DPW</span>
            </button>
          )}

          {canEdit && subTab === 'dpd' && (
            <button
              type="button"
              onClick={openCreateDpd}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:-translate-y-0.5 transition-transform"
            >
              <Plus className="h-4 w-4" />
              <span>Tambah DPD</span>
            </button>
          )}
        </div>
      </div>

      {/* Warning jika Spreadsheet #2 belum tersambung */}
      {(!webAppUrl.trim() || !wilayahConnected) && (
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#D88B15]/35 bg-[#FFF9EE] px-4 py-3 text-xs text-[#7D4D06]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#D88B15]" />
          <div>
            <span className="font-bold">Perhatian Koneksi Spreadsheet #2:</span>{' '}
            {!webAppUrl.trim()
              ? 'URL Web App Google Apps Script (/exec) belum diatur. Perubahan tidak akan tersimpan ke Google Spreadsheet sebelum ditautkan di menu Pengaturan & GAS.'
              : 'Spreadsheet #2 (Wilayah & DPW-DPD) belum ditautkan atau belum diberi akses. Buka menu Pengaturan & GAS untuk menempelkan ID/Link Spreadsheet baru agar setiap perubahan langsung tersimpan ke Google Sheet.'}
          </div>
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70]">DPW Terbentuk</div>
          <div className="mt-1 text-2xl font-bold text-[#07525E] tabular-nums">
            {dpwTerbentukCount}
            <span className="ml-1 text-sm font-medium text-[#6B8187]">
              / {provinces.length || 38}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187]">Tingkat Provinsi</div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70]">DPD Terbentuk</div>
          <div className="mt-1 text-2xl font-bold text-[#0C7A89] tabular-nums">
            {dpdTerbentukCount}
            <span className="ml-1 text-sm font-medium text-[#6B8187]">
              / {dpdList.length}
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187]">Tingkat Kab/Kota</div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70]">Referensi Kode Wilayah</div>
          <div className="mt-1 text-2xl font-bold text-[#07525E] tabular-nums">
            {kodeWilayahList.length}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187]">
            {pulauList.length} Pulau &middot; {provinces.length} Prov
          </div>
        </div>

        <div className="glass-surface px-4 py-3.5">
          <div className="text-[11px] font-semibold text-[#526A70]">Spreadsheet Wilayah (#2)</div>
          <div
            className={`mt-1 text-base font-bold ${
              wilayahConnected ? 'text-emerald-700' : 'text-[#9A6008]'
            }`}
          >
            {wilayahConnected ? 'Terhubung' : 'Belum Ditautkan'}
          </div>
          <div className="mt-0.5 text-[11px] text-[#6B8187]">
            {wilayahConnected ? 'Sinkron via Apps Script' : 'Atur di Pengaturan & GAS'}
          </div>
        </div>
      </div>

      {notice && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#0C7A89]/25 bg-[#ECF6F2] px-4 py-2.5 text-xs font-medium text-[#07525E]">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="cursor-pointer text-[#526A70]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner('')}
            className="cursor-pointer text-amber-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sub-navigation + Filter Bar */}
      <div className="mt-5 glass-surface p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-xl bg-[#EBF5F8]/85 p-1">
            <button
              type="button"
              onClick={() => setSubTab('dpw')}
              className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                subTab === 'dpw'
                  ? 'bg-white text-[#07525E] shadow-xs'
                  : 'text-[#526A70] hover:text-[#07525E]'
              }`}
            >
              DPW (Wilayah / Provinsi) &middot; {dpwList.length}
            </button>
            <button
              type="button"
              onClick={() => setSubTab('dpd')}
              className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                subTab === 'dpd'
                  ? 'bg-white text-[#07525E] shadow-xs'
                  : 'text-[#526A70] hover:text-[#07525E]'
              }`}
            >
              DPD (Daerah / Kab-Kota) &middot; {dpdList.length}
            </button>
            <button
              type="button"
              onClick={() => setSubTab('wilayah')}
              className={`cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
                subTab === 'wilayah'
                  ? 'bg-white text-[#07525E] shadow-xs'
                  : 'text-[#526A70] hover:text-[#07525E]'
              }`}
            >
              Referensi Kode Wilayah
            </button>
          </div>

          {canEdit && subTab === 'wilayah' && (
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#EBF5F8] px-3.5 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4]">
              <Upload className="h-3.5 w-3.5 text-[#0C7A89]" />
              <span>
                {importingCsv ? 'Mengimpor...' : 'Impor CSV Kode Wilayah ke Sheet #2'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={importingCsv}
                onChange={handleCsvFileUpload}
                className="sr-only"
              />
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
          <div className="relative sm:col-span-5">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#6B8187]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode wilayah, nama wilayah, ketua, sekretaris, WA..."
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2.5 pr-4 pl-10 text-xs text-[#0F2429] placeholder:text-[#7D9197] focus:border-[#0C7A89] focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <select
              value={filterPulau}
              onChange={(e) => {
                setFilterPulau(e.target.value);
                setFilterProvinsi('ALL');
                setChildrenRows([]);
              }}
              aria-label="Filter Pulau"
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none"
            >
              <option value="ALL">Semua Pulau</option>
              {pulauList.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {subTab !== 'dpw' && (
            <div className="sm:col-span-3">
              <select
                value={filterProvinsi}
                onChange={(e) => {
                  setFilterProvinsi(e.target.value);
                  setChildrenRows([]);
                }}
                aria-label="Filter Provinsi"
                className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none"
              >
                <option value="ALL">Semua Provinsi</option>
                {provinces
                  .filter((p) => filterPulau === 'ALL' || p.pulau === filterPulau)
                  .map((p) => (
                    <option key={p.kodeWilayah} value={p.kodeWilayah}>
                      {p.kodeWilayah} — {p.namaProvinsi}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {subTab !== 'wilayah' ? (
            <div className={subTab === 'dpw' ? 'sm:col-span-5' : 'sm:col-span-2'}>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'ALL' | StatusTerbentuk)}
                aria-label="Filter Status Terbentuk"
                className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#07525E] focus:border-[#0C7A89] focus:outline-none"
              >
                <option value="ALL">Semua Status</option>
                {STATUS_TERBENTUK_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <button
                type="button"
                disabled={loadingChildren || filterProvinsi === 'ALL' || !wilayahConnected}
                onClick={() => void handleLoadChildren()}
                className="w-full cursor-pointer rounded-xl border border-[#0C7A89]/25 bg-[#EBF5F8] px-3 py-2.5 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingChildren ? 'Memuat...' : 'Muat Kec/Desa'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: DPW */}
      {subTab === 'dpw' && (
        <div className="mt-5 glass-surface-strong overflow-hidden">
          {filteredDpw.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF5F8] text-[#0C7A89]">
                <Building2 className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-base font-bold text-[#07525E]">
                Belum Ada Data DPW
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#526A70]">
                {canEdit
                  ? 'Tambahkan DPW beserta kode wilayah provinsi, nama Ketua, Sekretaris, dan nomor WhatsApp-nya.'
                  : 'Data DPW akan tampil di sini setelah diinput oleh Super Admin.'}
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={openCreateDpw}
                  className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#07525E] px-4 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah DPW Pertama</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold tracking-wide text-[#355158] uppercase">
                    <th className="px-4 py-3.5">Kode</th>
                    <th className="px-4 py-3.5">Pulau &amp; Provinsi</th>
                    <th className="px-4 py-3.5">Nama DPW &amp; Status</th>
                    <th className="px-4 py-3.5">Ketua DPW</th>
                    <th className="px-4 py-3.5">Sekretaris DPW</th>
                    {canEdit && <th className="px-4 py-3.5 text-right">Kelola</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#07525E]/8">
                  {filteredDpw.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-white/75">
                      <td className="px-4 py-3.5 font-mono font-bold text-[#07525E] tabular-nums">
                        {item.kodeWilayah}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#0F2429]">{item.namaProvinsi}</div>
                        <div className="mt-0.5 text-[11px] text-[#526A70]">{item.pulau || '-'}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#07525E]">{item.namaDpw}</div>
                        <div className={`mt-0.5 text-[11px] ${getStatusColor(item.statusTerbentuk)}`}>
                          {item.statusTerbentuk}
                        </div>
                        {item.tautanDrive && (
                          <a
                            href={item.tautanDrive}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0C7A89] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Drive SK</span>
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#0F2429]">
                          {item.ketuaNama || '-'}
                        </div>
                        {item.ketuaWa ? (
                          <a
                            href={buildWhatsAppLink(item.ketuaWa)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#0C7A89] hover:underline tabular-nums"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
                            <span>{item.ketuaWa}</span>
                          </a>
                        ) : (
                          <div className="mt-0.5 text-[11px] text-[#7D9197]">WA belum diisi</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#0F2429]">
                          {item.sekretarisNama || '-'}
                        </div>
                        {item.sekretarisWa ? (
                          <a
                            href={buildWhatsAppLink(item.sekretarisWa)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#0C7A89] hover:underline tabular-nums"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
                            <span>{item.sekretarisWa}</span>
                          </a>
                        ) : (
                          <div className="mt-0.5 text-[11px] text-[#7D9197]">WA belum diisi</div>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {confirmDeleteId === item.id ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleDeleteRecord('dpw', item.id)}
                                className="cursor-pointer rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                              >
                                Hapus?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="cursor-pointer text-[11px] text-[#526A70]"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditDpw(item)}
                                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[#0C7A89] hover:text-[#07525E]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[#526A70] hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DPD */}
      {subTab === 'dpd' && (
        <div className="mt-5 glass-surface-strong overflow-hidden">
          {filteredDpd.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EBF5F8] text-[#0C7A89]">
                <MapPin className="h-6 w-6" />
              </div>
              <h2 className="mt-3 text-base font-bold text-[#07525E]">
                Belum Ada Data DPD
              </h2>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#526A70]">
                {canEdit
                  ? 'Tambahkan DPD per Kabupaten/Kota sesuai kode wilayah beserta Ketua, Sekretaris, dan nomor WhatsApp.'
                  : 'Data DPD akan tampil di sini setelah diinput oleh Super Admin.'}
              </p>
              {canEdit && (
                <button
                  type="button"
                  onClick={openCreateDpd}
                  className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#07525E] px-4 py-2 text-xs font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  <span>Tambah DPD Pertama</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold tracking-wide text-[#355158] uppercase">
                    <th className="px-4 py-3.5">Kode</th>
                    <th className="px-4 py-3.5">Provinsi &amp; Kab/Kota</th>
                    <th className="px-4 py-3.5">Nama DPD &amp; Status</th>
                    <th className="px-4 py-3.5">Ketua DPD</th>
                    <th className="px-4 py-3.5">Sekretaris DPD</th>
                    {canEdit && <th className="px-4 py-3.5 text-right">Kelola</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#07525E]/8">
                  {filteredDpd.map((item) => (
                    <tr key={item.id} className="align-top hover:bg-white/75">
                      <td className="px-4 py-3.5 font-mono font-bold text-[#07525E] tabular-nums">
                        {item.kodeWilayah}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#0F2429]">{item.namaKabKota}</div>
                        <div className="mt-0.5 text-[11px] text-[#526A70]">
                          {item.namaProvinsi}
                          {item.pulau ? ` · ${item.pulau}` : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-[#07525E]">{item.namaDpd}</div>
                        <div className={`mt-0.5 text-[11px] ${getStatusColor(item.statusTerbentuk)}`}>
                          {item.statusTerbentuk}
                        </div>
                        {item.tautanDrive && (
                          <a
                            href={item.tautanDrive}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-[#0C7A89] hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>Drive SK</span>
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#0F2429]">
                          {item.ketuaNama || '-'}
                        </div>
                        {item.ketuaWa ? (
                          <a
                            href={buildWhatsAppLink(item.ketuaWa)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#0C7A89] hover:underline tabular-nums"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
                            <span>{item.ketuaWa}</span>
                          </a>
                        ) : (
                          <div className="mt-0.5 text-[11px] text-[#7D9197]">WA belum diisi</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-[#0F2429]">
                          {item.sekretarisNama || '-'}
                        </div>
                        {item.sekretarisWa ? (
                          <a
                            href={buildWhatsAppLink(item.sekretarisWa)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-[#0C7A89] hover:underline tabular-nums"
                          >
                            <MessageCircle className="h-3.5 w-3.5 text-emerald-700" />
                            <span>{item.sekretarisWa}</span>
                          </a>
                        ) : (
                          <div className="mt-0.5 text-[11px] text-[#7D9197]">WA belum diisi</div>
                        )}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {confirmDeleteId === item.id ? (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleDeleteRecord('dpd', item.id)}
                                className="cursor-pointer rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                              >
                                Hapus?
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="cursor-pointer text-[11px] text-[#526A70]"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => openEditDpd(item)}
                                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[#0C7A89] hover:text-[#07525E]"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="inline-flex cursor-pointer items-center gap-1 font-semibold text-[#526A70] hover:text-red-700"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REFERENSI KODE WILAYAH */}
      {subTab === 'wilayah' && (
        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-[#0C7A89]/15 bg-[#F4FAFB] px-4 py-3 text-xs leading-relaxed text-[#355158]">
            <span className="font-bold text-[#07525E]">Format Sheet KODE_WILAYAH (Spreadsheet #2):</span>{' '}
            Gunakan kolom{' '}
            <span className="font-mono text-[11px]">
              Kode_Wilayah, Tingkat, Pulau, Kode_Provinsi, Nama_Provinsi, Kode_KabKota, Nama_KabKota, Kode_Kecamatan, Nama_Kecamatan, Nama_KelDesa, Parent_Kode
            </span>
            . Pilih Provinsi di filter lalu klik <strong>Muat Kec/Desa</strong> untuk menelusuri seluruh level kecamatan hingga kelurahan/desa dari Spreadsheet #2.
          </div>

          <div className="glass-surface-strong overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[780px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#07525E]/10 bg-[#F4FAFB] text-[11px] font-bold tracking-wide text-[#355158] uppercase">
                    <th className="px-4 py-3">Kode Wilayah</th>
                    <th className="px-4 py-3">Tingkat</th>
                    <th className="px-4 py-3">Pulau</th>
                    <th className="px-4 py-3">Provinsi</th>
                    <th className="px-4 py-3">Kabupaten / Kota</th>
                    <th className="px-4 py-3">Kecamatan</th>
                    <th className="px-4 py-3">Kelurahan / Desa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#07525E]/8">
                  {filteredWilayahRows.slice(0, 300).map((row) => (
                    <tr key={`${row.tingkat}-${row.kodeWilayah}`} className="hover:bg-white/75">
                      <td className="px-4 py-2.5 font-mono font-bold text-[#07525E] tabular-nums">
                        {row.kodeWilayah}
                      </td>
                      <td className="px-4 py-2.5 font-semibold text-[#0C7A89]">{row.tingkat}</td>
                      <td className="px-4 py-2.5 text-[#355158]">{row.pulau || '-'}</td>
                      <td className="px-4 py-2.5 font-medium text-[#0F2429]">
                        {row.namaProvinsi || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-[#355158]">{row.namaKabKota || '-'}</td>
                      <td className="px-4 py-2.5 text-[#355158]">{row.namaKecamatan || '-'}</td>
                      <td className="px-4 py-2.5 text-[#355158]">{row.namaKelDesa || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredWilayahRows.length > 300 && (
              <div className="border-t border-[#07525E]/10 bg-[#F4FAFB] px-4 py-2.5 text-[11px] text-[#526A70]">
                Menampilkan 300 dari {filteredWilayahRows.length} baris. Gunakan pencarian atau filter Provinsi untuk mempersempit hasil.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL FORM DPW */}
      {dpwFormOpen && canEdit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072B31]/45 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong relative max-h-[92vh] w-full max-w-xl overflow-y-auto bg-white p-6">
            <button
              type="button"
              onClick={() => setDpwFormOpen(false)}
              className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-[#526A70] hover:bg-[#EBF5F8]"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-lg font-bold text-[#07525E]">
              {editingDpw ? 'Edit Data DPW' : 'Tambah Data DPW'}
            </h2>
            <p className="mt-0.5 text-xs text-[#526A70]">
              Nomor WhatsApp hanya menerima angka dan otomatis mengubah 08 menjadi 628.
            </p>

            <form onSubmit={handleSubmitDpw} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Pilih Provinsi (Kode Wilayah) *
                  </label>
                  <select
                    value={dpwKode}
                    onChange={(e) => handleSelectDpwProvince(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  >
                    {provinces.map((p) => (
                      <option key={p.kodeWilayah} value={p.kodeWilayah}>
                        {p.kodeWilayah} — {p.namaProvinsi} ({p.pulau})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Kode Wilayah *
                  </label>
                  <input
                    type="text"
                    required
                    value={dpwKode}
                    onChange={(e) => setDpwKode(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Nama DPW *
                  </label>
                  <input
                    type="text"
                    required
                    value={dpwNama}
                    onChange={(e) => setDpwNama(e.target.value)}
                    placeholder="DPW Wahdah Islamiyah ..."
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Status Pembentukan *
                  </label>
                  <select
                    value={dpwStatus}
                    onChange={(e) => setDpwStatus(e.target.value as StatusTerbentuk)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  >
                    {STATUS_TERBENTUK_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Nama Ketua DPW
                  </label>
                  <input
                    type="text"
                    value={dpwKetuaNama}
                    onChange={(e) => setDpwKetuaNama(e.target.value)}
                    placeholder="Nama lengkap Ketua"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    WhatsApp Ketua (Angka Saja, 08 &rarr; 628)
                  </label>
                  <WhatsAppInput
                    value={dpwKetuaWa}
                    onChange={setDpwKetuaWa}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Nama Sekretaris DPW
                  </label>
                  <input
                    type="text"
                    value={dpwSekNama}
                    onChange={(e) => setDpwSekNama(e.target.value)}
                    placeholder="Nama lengkap Sekretaris"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    WhatsApp Sekretaris (Angka Saja, 08 &rarr; 628)
                  </label>
                  <WhatsAppInput
                    value={dpwSekWa}
                    onChange={setDpwSekWa}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Alamat Kantor / Sekretariat (Opsional)
                  </label>
                  <input
                    type="text"
                    value={dpwAlamat}
                    onChange={(e) => setDpwAlamat(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Tautan Google Drive SK (Opsional)
                  </label>
                  <input
                    type="url"
                    value={dpwDrive}
                    onChange={(e) => setDpwDrive(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              {dpwFormErr && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {dpwFormErr}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDpwFormOpen(false)}
                  className="cursor-pointer rounded-xl border border-[#07525E]/15 px-4 py-2 text-xs font-semibold text-[#526A70]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={dpwSaving}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{dpwSaving ? 'Menyimpan...' : 'Simpan DPW'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FORM DPD */}
      {dpdFormOpen && canEdit && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072B31]/45 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong relative max-h-[92vh] w-full max-w-xl overflow-y-auto bg-white p-6">
            <button
              type="button"
              onClick={() => setDpdFormOpen(false)}
              className="absolute top-4 right-4 cursor-pointer rounded-lg p-1 text-[#526A70] hover:bg-[#EBF5F8]"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-lg font-bold text-[#07525E]">
              {editingDpd ? 'Edit Data DPD' : 'Tambah Data DPD'}
            </h2>
            <p className="mt-0.5 text-xs text-[#526A70]">
              Nomor WhatsApp hanya menerima angka dan otomatis mengubah 08 menjadi 628.
            </p>

            <form onSubmit={handleSubmitDpd} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Provinsi *
                  </label>
                  <select
                    value={dpdKodeProv}
                    onChange={(e) => handleSelectDpdProvince(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  >
                    {provinces.map((p) => (
                      <option key={p.kodeWilayah} value={p.kodeWilayah}>
                        {p.kodeWilayah} — {p.namaProvinsi}
                      </option>
                    ))}
                  </select>
                </div>

                {dpdRegencyOptions.length > 0 ? (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#355158]">
                      Pilih Kab/Kota (Kode Wilayah)
                    </label>
                    <select
                      value={dpdKode}
                      onChange={(e) => handleSelectDpdKabKota(e.target.value)}
                      className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                    >
                      <option value="">-- Pilih / Isi Manual --</option>
                      {dpdRegencyOptions.map((r) => (
                        <option key={r.kodeWilayah} value={r.kodeWilayah}>
                          {r.kodeWilayah} — {r.namaKabKota}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-[#355158]">
                      Kode Wilayah Kab/Kota *
                    </label>
                    <input
                      type="text"
                      required
                      value={dpdKode}
                      onChange={(e) => setDpdKode(e.target.value)}
                      placeholder="Contoh: 73.71"
                      className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Kode Wilayah *
                  </label>
                  <input
                    type="text"
                    required
                    value={dpdKode}
                    onChange={(e) => setDpdKode(e.target.value)}
                    placeholder="73.71"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Nama Kabupaten / Kota *
                  </label>
                  <input
                    type="text"
                    required
                    value={dpdKabKota}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDpdKabKota(val);
                      if (!editingDpd && !dpdNama) {
                        setDpdNama(`DPD Wahdah Islamiyah ${val}`);
                      }
                    }}
                    placeholder="Contoh: Kota Makassar"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Nama DPD *
                  </label>
                  <input
                    type="text"
                    required
                    value={dpdNama}
                    onChange={(e) => setDpdNama(e.target.value)}
                    placeholder="DPD Wahdah Islamiyah ..."
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Status Pembentukan *
                  </label>
                  <select
                    value={dpdStatus}
                    onChange={(e) => setDpdStatus(e.target.value as StatusTerbentuk)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  >
                    {STATUS_TERBENTUK_OPTIONS.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Nama Ketua DPD
                  </label>
                  <input
                    type="text"
                    value={dpdKetuaNama}
                    onChange={(e) => setDpdKetuaNama(e.target.value)}
                    placeholder="Nama lengkap Ketua"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    WhatsApp Ketua (Angka Saja, 08 &rarr; 628)
                  </label>
                  <WhatsAppInput
                    value={dpdKetuaWa}
                    onChange={setDpdKetuaWa}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Nama Sekretaris DPD
                  </label>
                  <input
                    type="text"
                    value={dpdSekNama}
                    onChange={(e) => setDpdSekNama(e.target.value)}
                    placeholder="Nama lengkap Sekretaris"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    WhatsApp Sekretaris (Angka Saja, 08 &rarr; 628)
                  </label>
                  <WhatsAppInput
                    value={dpdSekWa}
                    onChange={setDpdSekWa}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] tabular-nums focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Alamat Kantor / Sekretariat (Opsional)
                  </label>
                  <input
                    type="text"
                    value={dpdAlamat}
                    onChange={(e) => setDpdAlamat(e.target.value)}
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158]">
                    Tautan Google Drive SK (Opsional)
                  </label>
                  <input
                    type="url"
                    value={dpdDrive}
                    onChange={(e) => setDpdDrive(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none"
                  />
                </div>
              </div>

              {dpdFormErr && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                  {dpdFormErr}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDpdFormOpen(false)}
                  className="cursor-pointer rounded-xl border border-[#07525E]/15 px-4 py-2 text-xs font-semibold text-[#526A70]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={dpdSaving}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{dpdSaving ? 'Menyimpan...' : 'Simpan DPD'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
