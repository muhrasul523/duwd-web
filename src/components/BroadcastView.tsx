import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  ImagePlus,
  KeyRound,
  Mail,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Trash2,
  Upload,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import {
  cancelScheduledBroadcastRecord,
  deleteBroadcastItemRecord,
  deleteWaGroupRecord,
  installBroadcastTriggerRemote,
  runDueBroadcastsNowRecord,
  saveBroadcastConfigRecord,
  saveWaGroupRecord,
  sendOrScheduleBroadcastRecord,
} from '../services/orgService';
import type {
  BroadcastChannel,
  BroadcastConfigStatus,
  BroadcastItem,
  BroadcastModeKirim,
  PengurusItem,
  UnitItem,
  UserRole,
  WaGroupItem,
} from '../types/org';

interface BroadcastViewProps {
  role: UserRole;
  activePin: string;
  webAppUrl: string;
  units: UnitItem[];
  pengurusList: PengurusItem[];
  waGroups: WaGroupItem[];
  broadcastQueue: BroadcastItem[];
  broadcastConfig: BroadcastConfigStatus;
  loadingData: boolean;
  onRefreshBroadcastData: () => Promise<void>;
  onUpdateWaGroups: (groups: WaGroupItem[]) => void;
  onUpdateBroadcastQueue: (items: BroadcastItem[]) => void;
  onUpdateBroadcastConfig: (config: BroadcastConfigStatus) => void;
}

type BroadcastSubTab = 'compose' | 'groups' | 'history';

function readFileAsDataUrl(file: File): Promise<{ base64: string; dataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
      resolve({ base64, dataUrl, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error('Gagal membaca file foto.'));
    reader.readAsDataURL(file);
  });
}

async function prepareBroadcastPhoto(file: File): Promise<{
  base64: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
}> {
  const raw = await readFileAsDataUrl(file);
  // Jika sudah ringan (< 1.2 MB), langsung gunakan tanpa kompresi ulang
  if (file.size <= 1.2 * 1024 * 1024) {
    return {
      base64: raw.base64,
      dataUrl: raw.dataUrl,
      mimeType: raw.mimeType,
      fileName: file.name,
    };
  }

  // Optimalkan ukuran agar pengiriman langsung cepat dan aman di Google Apps Script
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1440;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.max(1, Math.round(w * ratio));
          h = Math.max(1, Math.round(h * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ base64: raw.base64, dataUrl: raw.dataUrl, mimeType: raw.mimeType, fileName: file.name });
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const outMime = 'image/jpeg';
        const outDataUrl = canvas.toDataURL(outMime, 0.84);
        const commaIdx = outDataUrl.indexOf(',');
        const outBase64 = commaIdx >= 0 ? outDataUrl.slice(commaIdx + 1) : outDataUrl;
        const baseName = file.name.replace(/\.[^.]+$/, '') || 'lampiran';
        resolve({
          base64: outBase64,
          dataUrl: outDataUrl,
          mimeType: outMime,
          fileName: `${baseName}.jpg`,
        });
      } catch {
        resolve({ base64: raw.base64, dataUrl: raw.dataUrl, mimeType: raw.mimeType, fileName: file.name });
      }
    };
    img.onerror = () => {
      resolve({ base64: raw.base64, dataUrl: raw.dataUrl, mimeType: raw.mimeType, fileName: file.name });
    };
    img.src = raw.dataUrl;
  });
}

function formatDurationEstimate(totalSeconds: number): string {
  if (totalSeconds <= 0) return 'Langsung (tanpa jeda)';
  if (totalSeconds < 60) return `± ${totalSeconds} detik`;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins < 60) {
    return secs > 0 ? `± ${mins} menit ${secs} detik` : `± ${mins} menit`;
  }
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `± ${hrs} jam ${remMins} menit` : `± ${hrs} jam`;
}

const DELAY_PRESETS = [0, 1, 5, 10, 30, 60];

function getDefaultScheduleDateTime(): { date: string; time: string } {
  const next = new Date(Date.now() + 30 * 60 * 1000);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  const hh = String(next.getHours()).padStart(2, '0');
  const mm = String(next.getMinutes()).padStart(2, '0');
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
}

export function BroadcastView({
  role,
  activePin,
  webAppUrl,
  units,
  pengurusList,
  waGroups,
  broadcastQueue,
  broadcastConfig,
  loadingData,
  onRefreshBroadcastData,
  onUpdateWaGroups,
  onUpdateBroadcastQueue,
  onUpdateBroadcastConfig,
}: BroadcastViewProps) {
  const isSuperAdmin = role === 'superadmin';
  const [subTab, setSubTab] = useState<BroadcastSubTab>('compose');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Compose State
  const [judul, setJudul] = useState('');
  const [channel, setChannel] = useState<BroadcastChannel>('wa');
  const [targetPersonalMode, setTargetPersonalMode] = useState<'all' | 'custom' | 'none'>('all');
  const [filterUnitId, setFilterUnitId] = useState<string>('ALL');
  const [pengurusSearch, setPengurusSearch] = useState('');
  const [selectedPengurusIds, setSelectedPengurusIds] = useState<string[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);

  const [pesanWa, setPesanWa] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [sameBodyAsWa, setSameBodyAsWa] = useState(true);
  const [emailBody, setEmailBody] = useState('');

  // Image Attachment
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [photoName, setPhotoName] = useState('');
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Schedule & Delay
  const [modeKirim, setModeKirim] = useState<BroadcastModeKirim>('segera');
  const initialSched = useMemo(() => getDefaultScheduleDateTime(), []);
  const [scheduleDate, setScheduleDate] = useState(initialSched.date);
  const [scheduleTime, setScheduleTime] = useState(initialSched.time);
  const [delayDetik, setDelayDetik] = useState<number>(5);
  const [submittingBroadcast, setSubmittingBroadcast] = useState(false);

  // WA Groups CRUD modal
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<WaGroupItem | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupIdInput, setGroupIdInput] = useState('');
  const [groupDescInput, setGroupDescInput] = useState('');
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');

  // Broadcast Config Modal (Super Admin)
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [cfgRechatKey, setCfgRechatKey] = useState('');
  const [cfgRechatUrl, setCfgRechatUrl] = useState(
    broadcastConfig.rechatApiUrl || 'https://www.rechat.id/api/v1/messages',
  );
  const [cfgEmailAlias, setCfgEmailAlias] = useState(
    broadcastConfig.emailAlias || 'dppwiduwd@gmail.com',
  );
  const [cfgEmailSenderName, setCfgEmailSenderName] = useState(
    broadcastConfig.emailSenderName || 'DUWD DPP Wahdah Islamiyah',
  );
  const [savingConfig, setSavingConfig] = useState(false);
  const [installingTrigger, setInstallingTrigger] = useState(false);

  // History filter & actions
  const [historyFilter, setHistoryFilter] = useState<string>('ALL');
  const [runningDue, setRunningDue] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const unitById = useMemo(() => {
    const map = new Map<string, UnitItem>();
    units.forEach((u) => map.set(u.id, u));
    return map;
  }, [units]);

  const activeUnits = useMemo(
    () => units.filter((u) => u.aktif).sort((a, b) => a.urutan - b.urutan),
    [units],
  );

  const filteredPengurusForPicker = useMemo(() => {
    const q = pengurusSearch.trim().toLowerCase();
    return pengurusList.filter((p) => {
      if (filterUnitId !== 'ALL' && p.unitId !== filterUnitId) return false;
      if (q) {
        const uKode = unitById.get(p.unitId)?.kodeUnit || '';
        const text = `${p.namaLengkap} ${p.namaPanggilan} ${uKode} ${p.namaUnit} ${p.amanah} ${p.whatsapp} ${p.email || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [pengurusList, filterUnitId, pengurusSearch, unitById]);

  const effectivePengurusIds = useMemo(() => {
    if (targetPersonalMode === 'none') return [];
    if (targetPersonalMode === 'all') return pengurusList.map((p) => p.id);
    return selectedPengurusIds;
  }, [targetPersonalMode, pengurusList, selectedPengurusIds]);

  const effectivePengurusObjects = useMemo(() => {
    const set = new Set(effectivePengurusIds);
    return pengurusList.filter((p) => set.has(p.id));
  }, [effectivePengurusIds, pengurusList]);

  const effectiveGroupIds = useMemo(() => {
    if (channel === 'email') return [];
    return selectedGroupIds;
  }, [channel, selectedGroupIds]);

  const targetCounts = useMemo(() => {
    const waPersonal = effectivePengurusObjects.filter((p) => (p.whatsapp || '').length >= 9).length;
    const emailPersonal = effectivePengurusObjects.filter((p) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((p.email || '').trim()),
    ).length;
    const groupsCount = effectiveGroupIds.length;
    const totalDispatchMessages =
      (channel === 'wa' || channel === 'both' ? waPersonal + groupsCount : 0) +
      (channel === 'email' || channel === 'both' ? emailPersonal : 0);
    const estimatedSeconds =
      totalDispatchMessages > 1 ? (totalDispatchMessages - 1) * Math.max(0, delayDetik) : 0;
    return {
      totalPersonal: effectivePengurusObjects.length,
      waPersonal,
      emailPersonal,
      groupsCount,
      totalDispatchMessages,
      estimatedSeconds,
    };
  }, [effectivePengurusObjects, effectiveGroupIds, channel, delayDetik]);

  const togglePengurusSelection = (id: string) => {
    setTargetPersonalMode('custom');
    setSelectedPengurusIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAllFilteredPengurus = () => {
    setTargetPersonalMode('custom');
    const filteredIds = filteredPengurusForPicker.map((p) => p.id);
    setSelectedPengurusIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
  };

  const clearSelectedPengurus = () => {
    setTargetPersonalMode('custom');
    setSelectedPengurusIds([]);
  };

  const toggleGroupSelection = (id: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handlePhotoChange = async (file: File | null) => {
    if (!file) {
      setPhotoFile(null);
      setPhotoPreviewUrl('');
      setPhotoName('');
      return;
    }
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      setNotice({ ok: false, text: 'Format foto harus JPG, PNG, atau WebP.' });
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setNotice({ ok: false, text: 'Ukuran foto maksimal 8 MB.' });
      return;
    }
    try {
      const { dataUrl } = await readFileAsDataUrl(file);
      setPhotoFile(file);
      setPhotoPreviewUrl(dataUrl);
      setPhotoName(file.name);
      setNotice(null);
    } catch (err) {
      setNotice({
        ok: false,
        text: err instanceof Error ? err.message : 'Gagal membaca file gambar.',
      });
    }
  };

  const insertVariable = (token: string, target: 'wa' | 'email') => {
    if (target === 'wa') {
      setPesanWa((prev) => (prev ? `${prev}${prev.endsWith(' ') ? '' : ' '}${token}` : token));
    } else {
      setEmailBody((prev) => (prev ? `${prev}${prev.endsWith(' ') ? '' : ' '}${token}` : token));
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!webAppUrl.trim()) {
      setNotice({
        ok: false,
        text: 'URL Web App Google Apps Script belum terhubung. Hubungkan terlebih dahulu di menu Pengaturan.',
      });
      return;
    }

    const totalTargets = effectivePengurusIds.length + effectiveGroupIds.length;
    if (totalTargets === 0) {
      setNotice({
        ok: false,
        text: 'Pilih minimal 1 target pengurus atau grup WhatsApp terlebih dahulu.',
      });
      return;
    }

    const needWa = channel === 'wa' || channel === 'both';
    const needEmail = channel === 'email' || channel === 'both';
    const finalEmailBody = channel === 'both' && sameBodyAsWa ? pesanWa : emailBody;

    if (needWa && !pesanWa.trim() && !photoFile) {
      setNotice({ ok: false, text: 'Isi pesan WhatsApp atau lampirkan foto terlebih dahulu.' });
      return;
    }
    if (needEmail && (!emailSubject.trim() || (!finalEmailBody.trim() && !photoFile))) {
      setNotice({ ok: false, text: 'Subjek dan isi email wajib diisi.' });
      return;
    }
    if (needEmail && targetCounts.emailPersonal === 0) {
      setNotice({
        ok: false,
        text: 'Belum ada pengurus terpilih yang memiliki alamat email. Arahkan pengurus mengisi melalui duwd.web.id/data-pengurus.',
      });
      return;
    }
    if (needWa && !broadcastConfig.rechatConfigured) {
      setNotice({
        ok: false,
        text: 'API Key ReChat belum disimpan di Pengaturan Broadcast. Super Admin perlu memasukkannya terlebih dahulu.',
      });
      return;
    }

    const jadwalKirim = modeKirim === 'terjadwal' ? `${scheduleDate} ${scheduleTime}` : '';
    if (modeKirim === 'terjadwal' && (!scheduleDate || !scheduleTime)) {
      setNotice({ ok: false, text: 'Tentukan tanggal dan jam pengiriman terjadwal.' });
      return;
    }

    setSubmittingBroadcast(true);
    try {
      let imageBase64 = '';
      let imageMimeType = '';
      let imageFileName = '';

      if (photoFile) {
        const prepared = await prepareBroadcastPhoto(photoFile);
        imageBase64 = prepared.base64;
        imageMimeType = prepared.mimeType;
        imageFileName = prepared.fileName;
      }

      const summaryParts: string[] = [];
      if (effectivePengurusIds.length > 0) {
        summaryParts.push(
          targetPersonalMode === 'all'
            ? `Semua Pengurus (${effectivePengurusIds.length})`
            : `${effectivePengurusIds.length} Pengurus`,
        );
      }
      if (effectiveGroupIds.length > 0) {
        summaryParts.push(`${effectiveGroupIds.length} Grup WA`);
      }

      const safeDelay = Math.min(300, Math.max(0, Math.round(Number(delayDetik) || 0)));

      const res = await sendOrScheduleBroadcastRecord(
        {
          judul: judul.trim() || emailSubject.trim() || 'Broadcast DUWD DPP WI',
          channel,
          targetPengurusIds: effectivePengurusIds,
          targetGroupIds: effectiveGroupIds,
          targetSummary: summaryParts.join(' + '),
          pesanWa: pesanWa.trim(),
          emailSubject: emailSubject.trim() || judul.trim() || 'Informasi DUWD DPP WI',
          emailBody: finalEmailBody.trim(),
          imageBase64: imageBase64 || undefined,
          imageMimeType: imageMimeType || undefined,
          imageName: imageFileName || undefined,
          modeKirim,
          jadwalKirim,
          delayDetik: safeDelay,
        },
        activePin,
        webAppUrl,
      );

      if (!res.ok || !res.item) {
        setNotice({ ok: false, text: res.error || 'Gagal memproses Broadcast.' });
        return;
      }

      onUpdateBroadcastQueue([res.item, ...broadcastQueue]);
      setNotice({
        ok: true,
        text:
          res.message ||
          (modeKirim === 'terjadwal'
            ? `Broadcast dijadwalkan pada ${jadwalKirim} WITA (jeda ${safeDelay} detik/pesan).`
            : res.item.status === 'Diproses'
              ? `Pengiriman dimulai (${res.item.totalTerkirim}/${res.item.totalTarget}) dan sisa pesan dilanjutkan otomatis sesuai jeda ${safeDelay} detik.`
              : 'Broadcast selesai dikirim.'),
      });

      // Reset form compose
      setJudul('');
      setPesanWa('');
      setEmailSubject('');
      setEmailBody('');
      setPhotoFile(null);
      setPhotoPreviewUrl('');
      setPhotoName('');
      if (photoInputRef.current) photoInputRef.current.value = '';
      setSubTab('history');
    } finally {
      setSubmittingBroadcast(false);
    }
  };

  // WA Group CRUD handlers
  const openCreateGroupModal = () => {
    setEditingGroup(null);
    setGroupNameInput('');
    setGroupIdInput('');
    setGroupDescInput('');
    setGroupError('');
    setGroupModalOpen(true);
  };

  const openEditGroupModal = (g: WaGroupItem) => {
    setEditingGroup(g);
    setGroupNameInput(g.namaGrup);
    setGroupIdInput(g.groupId);
    setGroupDescInput(g.keterangan || '');
    setGroupError('');
    setGroupModalOpen(true);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setGroupError('');
    if (!groupNameInput.trim()) {
      setGroupError('Nama grup wajib diisi.');
      return;
    }
    if (!groupIdInput.trim()) {
      setGroupError('ID Grup WhatsApp (contoh: 120363xxxx@g.us) wajib diisi.');
      return;
    }

    setSavingGroup(true);
    try {
      const res = await saveWaGroupRecord(
        {
          id: editingGroup?.id,
          namaGrup: groupNameInput.trim(),
          groupId: groupIdInput.trim(),
          keterangan: groupDescInput.trim(),
          dibuatPada: editingGroup?.dibuatPada,
        },
        activePin,
        webAppUrl,
      );
      if (!res.ok || !res.item) {
        setGroupError(res.error || 'Gagal menyimpan grup WhatsApp.');
        return;
      }
      const exists = waGroups.some((g) => g.id === res.item!.id);
      const next = exists
        ? waGroups.map((g) => (g.id === res.item!.id ? res.item! : g))
        : [...waGroups, res.item!];
      onUpdateWaGroups(next);
      setGroupModalOpen(false);
      setNotice({
        ok: true,
        text: `Grup WhatsApp "${res.item.namaGrup}" berhasil disimpan.`,
      });
    } finally {
      setSavingGroup(false);
    }
  };

  const handleDeleteGroup = async (group: WaGroupItem) => {
    const res = await deleteWaGroupRecord(group.id, activePin, webAppUrl);
    if (res.ok) {
      onUpdateWaGroups(waGroups.filter((g) => g.id !== group.id));
      setSelectedGroupIds((prev) => prev.filter((x) => x !== group.id));
      setNotice({ ok: true, text: `Grup "${group.namaGrup}" telah dihapus.` });
    } else {
      setNotice({ ok: false, text: res.error || 'Gagal menghapus grup WhatsApp.' });
    }
  };

  // Config Modal handlers (Super Admin)
  const openConfigModal = () => {
    setCfgRechatKey('');
    setCfgRechatUrl(broadcastConfig.rechatApiUrl || 'https://www.rechat.id/api/v1/messages');
    setCfgEmailAlias(broadcastConfig.emailAlias || 'dppwiduwd@gmail.com');
    setCfgEmailSenderName(broadcastConfig.emailSenderName || 'DUWD DPP Wahdah Islamiyah');
    setConfigModalOpen(true);
  };

  const handleSaveBroadcastConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      const res = await saveBroadcastConfigRecord(
        {
          rechatApiKey: cfgRechatKey.trim() || undefined,
          rechatApiUrl: cfgRechatUrl.trim(),
          emailAlias: cfgEmailAlias.trim(),
          emailSenderName: cfgEmailSenderName.trim(),
        },
        activePin,
        webAppUrl,
      );
      if (res.ok) {
        if (res.broadcastConfig) {
          onUpdateBroadcastConfig(res.broadcastConfig);
        }
        setConfigModalOpen(false);
        setCfgRechatKey('');
        setNotice({
          ok: true,
          text: res.message || 'Konfigurasi Broadcast tersimpan aman di Google Apps Script.',
        });
      } else {
        setNotice({ ok: false, text: res.error || 'Gagal menyimpan konfigurasi.' });
      }
    } finally {
      setSavingConfig(false);
    }
  };

  const handleInstallTrigger = async () => {
    setInstallingTrigger(true);
    try {
      const res = await installBroadcastTriggerRemote(activePin, webAppUrl);
      if (res.ok) {
        onUpdateBroadcastConfig({
          ...broadcastConfig,
          triggerActive: Boolean(res.triggerActive),
        });
        setNotice({ ok: true, text: res.message || 'Jadwal otomatis aktif.' });
      } else {
        setNotice({ ok: false, text: res.error || 'Gagal mengaktifkan trigger otomatis.' });
      }
    } finally {
      setInstallingTrigger(false);
    }
  };

  const handleRunDueNow = async () => {
    setRunningDue(true);
    try {
      const res = await runDueBroadcastsNowRecord(activePin, webAppUrl);
      if (res.ok) {
        setNotice({ ok: true, text: res.message || 'Pemeriksaan antrean selesai.' });
        await onRefreshBroadcastData();
      } else {
        setNotice({ ok: false, text: res.error || 'Gagal menjalankan antrean.' });
      }
    } finally {
      setRunningDue(false);
    }
  };

  const handleCancelScheduled = async (id: string) => {
    const res = await cancelScheduledBroadcastRecord(id, activePin, webAppUrl);
    if (res.ok && res.item) {
      onUpdateBroadcastQueue(broadcastQueue.map((b) => (b.id === id ? res.item! : b)));
      setNotice({ ok: true, text: 'Broadcast terjadwal berhasil dibatalkan.' });
    } else {
      setNotice({ ok: false, text: res.error || 'Gagal membatalkan jadwal.' });
    }
  };

  const handleDeleteHistory = async (id: string) => {
    const res = await deleteBroadcastItemRecord(id, activePin, webAppUrl);
    if (res.ok) {
      onUpdateBroadcastQueue(broadcastQueue.filter((b) => b.id !== id));
      setNotice({ ok: true, text: 'Riwayat broadcast dihapus.' });
    } else {
      setNotice({ ok: false, text: res.error || 'Gagal menghapus riwayat.' });
    }
  };

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'ALL') return broadcastQueue;
    return broadcastQueue.filter((item) => item.status === historyFilter);
  }, [broadcastQueue, historyFilter]);

  const emailAliasVerified = useMemo(() => {
    const target = (broadcastConfig.emailAlias || 'dppwiduwd@gmail.com').toLowerCase();
    return (broadcastConfig.availableEmailAliases || []).some(
      (a) => a.trim().toLowerCase() === target,
    );
  }, [broadcastConfig]);

  return (
    <section className="duwd-container px-2 py-7 sm:px-4 lg:py-9">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
            Pusat Komunikasi Internal &middot; WhatsApp ReChat &amp; Email Alias
          </p>
          <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-[#07525E] dark:text-[#E6F4F7] sm:text-3xl">
            Broadcast Pengurus &amp; Grup WhatsApp
          </h1>
          <p className="mt-1.5 text-xs text-[#526A70] dark:text-[#9BB5BC]">
            Kirim pesan teks atau foto segera maupun terjadwal ke seluruh pengurus, pengurus pilihan, dan grup WhatsApp DUWD.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void onRefreshBroadcastData()}
            disabled={loadingData}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/15 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#07525E] hover:bg-white disabled:opacity-60 dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            <span>{loadingData ? 'Memuat...' : 'Sinkronkan'}</span>
          </button>

          {isSuperAdmin && (
            <button
              type="button"
              onClick={openConfigModal}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#0C7A89]/30 bg-[#EBF5F8] px-3.5 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4] dark:border-[#3EC1D3]/30 dark:bg-[#113540] dark:text-[#E6F4F7]"
            >
              <Settings2 className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
              <span>Konfigurasi ReChat &amp; Email</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Strip */}
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="glass-surface flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#8DA8B0]">
              Gateway WhatsApp (ReChat / MiPOS)
            </div>
            <div className="mt-0.5 truncate text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
              {broadcastConfig.rechatConfigured
                ? `Terhubung (${broadcastConfig.rechatKeyMasked})`
                : 'API Key Belum Disimpan'}
            </div>
          </div>
          {broadcastConfig.rechatConfigured ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          )}
        </div>

        <div className="glass-surface flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#8DA8B0]">
              Alias Pengirim Email
            </div>
            <div className="mt-0.5 truncate font-mono text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
              {broadcastConfig.emailAlias || 'dppwiduwd@gmail.com'}
            </div>
            <div className="text-[10px] text-[#526A70] dark:text-[#8DA8B0]">
              {emailAliasVerified
                ? 'Alias terverifikasi di Gmail'
                : 'Pastikan alias aktif di Gmail "Send mail as"'}
            </div>
          </div>
          <Mail
            className={`h-5 w-5 shrink-0 ${
              emailAliasVerified
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-[#0C7A89] dark:text-[#3EC1D3]'
            }`}
          />
        </div>

        <div className="glass-surface flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#8DA8B0]">
              Penjadwal Otomatis (Trigger 5 Menit)
            </div>
            <div className="mt-0.5 text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
              {broadcastConfig.triggerActive ? 'Aktif Otomatis (WITA)' : 'Belum Diaktifkan'}
            </div>
          </div>
          {broadcastConfig.triggerActive ? (
            <Clock className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <button
              type="button"
              onClick={handleInstallTrigger}
              disabled={installingTrigger || !webAppUrl}
              className="shrink-0 cursor-pointer rounded-lg bg-[#07525E] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#0C7A89] disabled:opacity-60"
            >
              {installingTrigger ? 'Memasang...' : 'Aktifkan'}
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div
          className={`mt-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium ${
            notice.ok
              ? 'border-[#0C7A89]/25 bg-[#ECF6F2] text-[#07525E] dark:border-[#3EC1D3]/30 dark:bg-[#0D2E36] dark:text-[#BCEAF0]'
              : 'border-amber-500/35 bg-amber-50 text-amber-900 dark:border-amber-400/30 dark:bg-amber-950/60 dark:text-amber-200'
          }`}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="cursor-pointer opacity-75 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Sub-navigation Tabs */}
      <div className="mt-5 inline-flex flex-wrap items-center gap-1 rounded-xl bg-[#EBF5F8]/90 p-1 dark:bg-[#0D2A33]">
        <button
          type="button"
          onClick={() => setSubTab('compose')}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            subTab === 'compose'
              ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
              : 'text-[#526A70] hover:text-[#07525E] dark:text-[#9BB5BC]'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          <span>Kirim / Jadwalkan</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('groups')}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            subTab === 'groups'
              ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
              : 'text-[#526A70] hover:text-[#07525E] dark:text-[#9BB5BC]'
          }`}
        >
          <Users className="h-3.5 w-3.5" />
          <span>Grup WhatsApp ({waGroups.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab('history')}
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            subTab === 'history'
              ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
              : 'text-[#526A70] hover:text-[#07525E] dark:text-[#9BB5BC]'
          }`}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          <span>
            Riwayat &amp; Antrean ({broadcastQueue.length})
          </span>
        </button>
      </div>

      {/* TAB 1: COMPOSE BROADCAST */}
      {subTab === 'compose' && (
        <form onSubmit={handleSendBroadcast} className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Pesan, Kanal, Lampiran Foto, Waktu */}
          <div className="glass-surface-strong space-y-5 p-6 lg:col-span-7">
            {/* Kanal */}
            <div>
              <label className="mb-2 block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                1. Pilih Kanal Pengiriman
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  {
                    id: 'wa' as BroadcastChannel,
                    label: 'WhatsApp Saja',
                    sub: 'Via ReChat (DUWD)',
                    icon: MessageSquare,
                  },
                  {
                    id: 'email' as BroadcastChannel,
                    label: 'Email Saja',
                    sub: broadcastConfig.emailAlias || 'dppwiduwd@gmail.com',
                    icon: Mail,
                  },
                  {
                    id: 'both' as BroadcastChannel,
                    label: 'WA & Email',
                    sub: 'Kirim keduanya',
                    icon: Send,
                  },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = channel === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setChannel(opt.id)}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                        active
                          ? 'border-[#0C7A89] bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3] dark:bg-[#123A46] dark:text-[#E6F4F7]'
                          : 'border-[#07525E]/15 bg-white/80 text-[#355158] hover:bg-white dark:border-[#3EC1D3]/20 dark:bg-[#0A2027] dark:text-[#A9C2C9]'
                      }`}
                    >
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#0C7A89] dark:text-[#3EC1D3]" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold">{opt.label}</div>
                        <div className="truncate text-[10px] opacity-80">{opt.sub}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Judul & Subjek */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Label / Judul Broadcast (Internal)
                </label>
                <input
                  type="text"
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Contoh: Undangan Musyawarah Pleno #12"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              {(channel === 'email' || channel === 'both') && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Subjek Email *
                  </label>
                  <input
                    type="text"
                    required
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    placeholder="Contoh: [DUWD DPP WI] Undangan Rapat Pleno"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>
              )}
            </div>

            {/* Pesan WA */}
            {(channel === 'wa' || channel === 'both') && (
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Isi Pesan WhatsApp {photoFile ? '(Caption Foto)' : '*'}
                  </label>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-[#526A70] dark:text-[#8DA8B0]">Sisip:</span>
                    {['{nama}', '{panggilan}', '{unit}', '{amanah}'].map((tok) => (
                      <button
                        key={tok}
                        type="button"
                        onClick={() => insertVariable(tok, 'wa')}
                        className="cursor-pointer rounded-md border border-[#07525E]/15 bg-[#F4FAFB] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#3EC1D3]"
                      >
                        {tok}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={6}
                  value={pesanWa}
                  onChange={(e) => setPesanWa(e.target.value)}
                  placeholder="Assalamu'alaikum warahmatullahi wabarakatuh {panggilan}, ..."
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>
            )}

            {/* Pesan Email */}
            {(channel === 'email' || channel === 'both') && (
              <div>
                {channel === 'both' && (
                  <label className="mb-2 inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                    <input
                      type="checkbox"
                      checked={sameBodyAsWa}
                      onChange={(e) => setSameBodyAsWa(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#0C7A89]"
                    />
                    <span>Gunakan isi teks yang sama dengan pesan WhatsApp</span>
                  </label>
                )}

                {(channel === 'email' || !sameBodyAsWa) && (
                  <>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                        Isi Pesan Email *
                      </label>
                      <div className="flex flex-wrap items-center gap-1">
                        {['{nama}', '{panggilan}', '{unit}', '{amanah}'].map((tok) => (
                          <button
                            key={tok}
                            type="button"
                            onClick={() => insertVariable(tok, 'email')}
                            className="cursor-pointer rounded-md border border-[#07525E]/15 bg-[#F4FAFB] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#3EC1D3]"
                          >
                            {tok}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      rows={6}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Tuliskan isi email resmi DUWD DPP WI..."
                      className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                    />
                  </>
                )}
              </div>
            )}

            {/* Lampiran Foto */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                Lampirkan Foto / Poster (Opsional — JPG, PNG, WebP)
              </label>
              {photoPreviewUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-[#0C7A89]/25 bg-[#F4FAFB] p-3 dark:border-[#3EC1D3]/25 dark:bg-[#0B232B]">
                  <img
                    src={photoPreviewUrl}
                    alt="Preview lampiran broadcast"
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                      {photoName}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#526A70] dark:text-[#9BB5BC]">
                      Dikirim langsung sebagai gambar WA &amp; lampiran Email tanpa disimpan permanen di Google Drive.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      void handlePhotoChange(null);
                      if (photoInputRef.current) photoInputRef.current.value = '';
                    }}
                    className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:bg-[#10262D] dark:text-red-400"
                    title="Hapus foto"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.files?.[0] || null;
                    void handlePhotoChange(dropped);
                  }}
                  className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#07525E]/25 bg-[#F8FBFC] px-4 py-5 text-center dark:border-[#3EC1D3]/30 dark:bg-[#091E25]"
                >
                  <ImagePlus className="h-6 w-6 text-[#0C7A89] dark:text-[#3EC1D3]" />
                  <p className="mt-1.5 text-xs font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                    Seret foto ke sini atau pilih berkas
                  </p>
                  <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#EBF5F8] px-3 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-[#DCEEF4] dark:bg-[#113540] dark:text-[#E6F4F7]">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Pilih Foto</span>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => void handlePhotoChange(e.target.files?.[0] || null)}
                      className="sr-only"
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Waktu & Jeda Pengiriman */}
            <div className="space-y-4 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
              <div>
                <label className="mb-2 block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  2. Waktu Pengiriman
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setModeKirim('segera')}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                      modeKirim === 'segera'
                        ? 'border-[#0C7A89] bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3] dark:bg-[#123A46] dark:text-[#E6F4F7]'
                        : 'border-[#07525E]/15 bg-white text-[#526A70] dark:border-[#3EC1D3]/20 dark:bg-[#0A2027] dark:text-[#9BB5BC]'
                    }`}
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>Kirim Segera</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setModeKirim('terjadwal')}
                    className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                      modeKirim === 'terjadwal'
                        ? 'border-[#0C7A89] bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3] dark:bg-[#123A46] dark:text-[#E6F4F7]'
                        : 'border-[#07525E]/15 bg-white text-[#526A70] dark:border-[#3EC1D3]/20 dark:bg-[#0A2027] dark:text-[#9BB5BC]'
                    }`}
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    <span>Jadwalkan (WITA)</span>
                  </button>
                </div>

                {modeKirim === 'terjadwal' && (
                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-[#0C7A89]/20 bg-[#F4FAFB] p-3.5 dark:border-[#3EC1D3]/20 dark:bg-[#0B232B]">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#355158] dark:text-[#B4CCD3]">
                        Tanggal Kirim
                      </label>
                      <input
                        type="date"
                        required
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        className="w-full rounded-lg border border-[#07525E]/18 bg-white px-3 py-1.5 text-xs text-[#0F2429] dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-[#355158] dark:text-[#B4CCD3]">
                        Jam (WITA)
                      </label>
                      <input
                        type="time"
                        required
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full rounded-lg border border-[#07525E]/18 bg-white px-3 py-1.5 text-xs text-[#0F2429] dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Jeda / Delay Antar Pesan */}
              <div className="rounded-xl border border-[#07525E]/12 bg-[#F8FBFC] p-3.5 dark:border-[#3EC1D3]/20 dark:bg-[#0A2229]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    <Clock className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
                    <span>3. Jeda / Delay Antar Pesan</span>
                  </label>
                  <span className="font-mono text-[11px] font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
                    {targetCounts.totalDispatchMessages} pesan &middot;{' '}
                    {formatDurationEstimate(targetCounts.estimatedSeconds)}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {DELAY_PRESETS.map((sec) => {
                    const active = delayDetik === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setDelayDetik(sec)}
                        className={`cursor-pointer rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                          active
                            ? 'border-[#0C7A89] bg-[#07525E] text-white dark:border-[#3EC1D3] dark:bg-[#0C7A89]'
                            : 'border-[#07525E]/15 bg-white text-[#355158] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/20 dark:bg-[#071A20] dark:text-[#A9C2C9]'
                        }`}
                      >
                        {sec === 0 ? 'Tanpa Jeda' : `${sec} detik`}
                      </button>
                    );
                  })}

                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-[#526A70] dark:text-[#8DA8B0]">
                      Kustom:
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={300}
                      step={1}
                      value={delayDetik}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (Number.isNaN(val)) {
                          setDelayDetik(0);
                        } else {
                          setDelayDetik(Math.min(300, Math.max(0, Math.round(val))));
                        }
                      }}
                      className="w-16 rounded-lg border border-[#07525E]/20 bg-white px-2 py-1 text-center font-mono text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                    />
                    <span className="text-[11px] text-[#526A70] dark:text-[#8DA8B0]">detik</span>
                  </div>
                </div>

                {targetCounts.estimatedSeconds > 45 && (
                  <p className="mt-2 text-[11px] leading-relaxed text-[#526A70] dark:text-[#9BB5BC]">
                    Karena total durasi lebih dari 45 detik, pesan tahap awal dikirim segera lalu sisa antrean dilanjutkan otomatis di latar belakang sesuai jeda agar tidak terkena batas waktu server.
                  </p>
                )}
              </div>
            </div>

            {/* Submit Bar */}
            <div className="flex flex-col justify-between gap-3 border-t border-[#07525E]/10 pt-4 sm:flex-row sm:items-center dark:border-[#3EC1D3]/15">
              <div className="text-xs text-[#526A70] dark:text-[#9BB5BC]">
                Target aktif:{' '}
                {(channel === 'wa' || channel === 'both') && (
                  <strong className="text-[#07525E] dark:text-[#E6F4F7]">
                    {targetCounts.waPersonal} WA Personal + {targetCounts.groupsCount} Grup
                  </strong>
                )}
                {channel === 'both' && ' · '}
                {(channel === 'email' || channel === 'both') && (
                  <strong className="text-[#0C7A89] dark:text-[#3EC1D3]">
                    {targetCounts.emailPersonal} Email
                  </strong>
                )}
              </div>

              <button
                type="submit"
                disabled={submittingBroadcast}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2.5 text-xs font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5 disabled:opacity-60"
              >
                {modeKirim === 'terjadwal' ? (
                  <CalendarClock className="h-4 w-4" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                <span>
                  {submittingBroadcast
                    ? 'Memproses Broadcast...'
                    : modeKirim === 'terjadwal'
                      ? 'Simpan Jadwal Broadcast'
                      : 'Kirim Broadcast Sekarang'}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Target Picker (Personal Pengurus & Grup WA) */}
          <div className="space-y-5 lg:col-span-5">
            {/* Target Personal Pengurus */}
            <div className="glass-surface-strong p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  Target Personal Pengurus
                </h2>
                <span className="font-mono text-xs font-bold text-[#0C7A89] dark:text-[#3EC1D3]">
                  {effectivePengurusIds.length} dipilih
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-[#EBF5F8]/90 p-1 dark:bg-[#0D2A33]">
                <button
                  type="button"
                  onClick={() => setTargetPersonalMode('all')}
                  className={`cursor-pointer rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                    targetPersonalMode === 'all'
                      ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                      : 'text-[#526A70] dark:text-[#9BB5BC]'
                  }`}
                >
                  Semua ({pengurusList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTargetPersonalMode('custom')}
                  className={`cursor-pointer rounded-lg py-1.5 text-[11px] font-semibold transition-colors ${
                    targetPersonalMode === 'custom'
                      ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                      : 'text-[#526A70] dark:text-[#9BB5BC]'
                  }`}
                >
                  Pilih Tertentu
                </button>
                <button
                  type="button"
                  onClick={() => setTargetPersonalMode('none')}
                  disabled={channel === 'email'}
                  className={`cursor-pointer rounded-lg py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                    targetPersonalMode === 'none'
                      ? 'bg-white text-[#07525E] shadow-xs dark:bg-[#13424F] dark:text-[#E6F4F7]'
                      : 'text-[#526A70] dark:text-[#9BB5BC]'
                  }`}
                >
                  Grup Saja
                </button>
              </div>

              {targetPersonalMode === 'all' && (
                <p className="mt-3 rounded-xl bg-[#F4FAFB] px-3 py-2.5 text-xs text-[#355158] dark:bg-[#0B232B] dark:text-[#B4CCD3]">
                  Seluruh <strong>{pengurusList.length} pengurus</strong> menjadi target ({targetCounts.waPersonal} WA valid, {targetCounts.emailPersonal} email terdata).
                </p>
              )}

              {targetPersonalMode === 'none' && (
                <p className="mt-3 rounded-xl bg-[#F4FAFB] px-3 py-2.5 text-xs text-[#526A70] dark:bg-[#0B232B] dark:text-[#9BB5BC]">
                  Broadcast tidak dikirim ke personal pengurus. Pilih Grup WhatsApp di bawah.
                </p>
              )}

              {targetPersonalMode === 'custom' && (
                <div className="mt-3 space-y-2.5">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#526A70]" />
                      <input
                        type="text"
                        value={pengurusSearch}
                        onChange={(e) => setPengurusSearch(e.target.value)}
                        placeholder="Cari nama / amanah..."
                        className="w-full rounded-lg border border-[#07525E]/15 bg-white py-1.5 pr-2.5 pl-8 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                      />
                    </div>
                    <select
                      value={filterUnitId}
                      onChange={(e) => setFilterUnitId(e.target.value)}
                      className="rounded-lg border border-[#07525E]/15 bg-white px-2.5 py-1.5 text-xs text-[#0F2429] dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                    >
                      <option value="ALL">Semua Unit</option>
                      {activeUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.kodeUnit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <button
                      type="button"
                      onClick={selectAllFilteredPengurus}
                      className="cursor-pointer font-semibold text-[#0C7A89] hover:underline dark:text-[#3EC1D3]"
                    >
                      Pilih Semua ({filteredPengurusForPicker.length})
                    </button>
                    <button
                      type="button"
                      onClick={clearSelectedPengurus}
                      className="cursor-pointer font-semibold text-[#526A70] hover:underline dark:text-[#9BB5BC]"
                    >
                      Kosongkan Pilihan
                    </button>
                  </div>

                  <div className="max-h-60 space-y-1 overflow-y-auto rounded-xl border border-[#07525E]/12 bg-white/75 p-2 dark:border-[#3EC1D3]/18 dark:bg-[#081C22]">
                    {filteredPengurusForPicker.length === 0 ? (
                      <div className="py-6 text-center text-xs text-[#526A70] dark:text-[#8DA8B0]">
                        Tidak ada pengurus yang cocok.
                      </div>
                    ) : (
                      filteredPengurusForPicker.map((p) => {
                        const checked = selectedPengurusIds.includes(p.id);
                        const uKode = unitById.get(p.unitId)?.kodeUnit || p.namaUnit;
                        const hasEmail = Boolean(p.email && p.email.includes('@'));
                        return (
                          <label
                            key={p.id}
                            className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-xs transition-colors ${
                              checked
                                ? 'bg-[#EBF5F8] dark:bg-[#123A46]'
                                : 'hover:bg-[#F4FAFB] dark:hover:bg-[#0E2830]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePengurusSelection(p.id)}
                              className="mt-0.5 h-3.5 w-3.5 rounded accent-[#0C7A89]"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-semibold text-[#0F2429] dark:text-[#E6F4F7]">
                                {p.namaLengkap}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] text-[#526A70] dark:text-[#8DA8B0]">
                                <span>
                                  {uKode} &middot; {p.amanah}
                                </span>
                                <span className="font-mono">{p.whatsapp}</span>
                                <span
                                  className={
                                    hasEmail
                                      ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                                      : 'text-amber-700 dark:text-amber-400'
                                  }
                                >
                                  {hasEmail ? p.email : 'Email belum diisi'}
                                </span>
                              </div>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Target Grup WhatsApp */}
            {(channel === 'wa' || channel === 'both') && (
              <div className="glass-surface-strong p-5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-[#07525E] dark:text-[#E6F4F7]">
                      Target Grup WhatsApp
                    </h2>
                    <p className="text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                      Pilih 1 atau beberapa grup tujuan (ID <span className="font-mono">@g.us</span>).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={openCreateGroupModal}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#EBF5F8] px-2.5 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-[#DCEEF4] dark:bg-[#113540] dark:text-[#E6F4F7]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Tambah Grup</span>
                  </button>
                </div>

                {waGroups.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-dashed border-[#07525E]/20 px-4 py-5 text-center text-xs text-[#526A70] dark:border-[#3EC1D3]/25 dark:text-[#8DA8B0]">
                    Belum ada Grup WhatsApp tersimpan. Klik <strong>Tambah Grup</strong> untuk mendaftarkan nama &amp; ID grup.
                  </div>
                ) : (
                  <div className="mt-3 max-h-52 space-y-1.5 overflow-y-auto">
                    {waGroups.map((g) => {
                      const checked = selectedGroupIds.includes(g.id);
                      return (
                        <label
                          key={g.id}
                          className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2 text-xs transition-colors ${
                            checked
                              ? 'border-[#0C7A89] bg-[#EBF5F8] dark:border-[#3EC1D3] dark:bg-[#123A46]'
                              : 'border-[#07525E]/12 bg-white/80 hover:bg-white dark:border-[#3EC1D3]/18 dark:bg-[#091E25]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleGroupSelection(g.id)}
                            className="mt-0.5 h-3.5 w-3.5 rounded accent-[#0C7A89]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-[#07525E] dark:text-[#E6F4F7]">
                              {g.namaGrup}
                            </div>
                            <div className="truncate font-mono text-[10px] text-[#526A70] dark:text-[#8DA8B0]">
                              {g.groupId}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>
      )}

      {/* TAB 2: MANAJEMEN GRUP WHATSAPP */}
      {subTab === 'groups' && (
        <div className="mt-5 glass-surface-strong overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 px-5 py-4 dark:border-[#3EC1D3]/15">
            <div>
              <h2 className="text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                Daftar Grup WhatsApp Tujuan Broadcast
              </h2>
              <p className="text-xs text-[#526A70] dark:text-[#9BB5BC]">
                Simpan Nama Grup dan ID Grup WhatsApp (format <span className="font-mono">120363xxxx@g.us</span> dari ReChat).
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateGroupModal}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Tambah Grup WA</span>
            </button>
          </div>

          {waGroups.length === 0 ? (
            <div className="px-6 py-14 text-center text-xs text-[#526A70] dark:text-[#9BB5BC]">
              Belum ada grup WhatsApp yang didaftarkan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="duwd-zebra-table w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-[#07525E]/10 bg-[#F8FBFC] text-xs font-semibold text-[#526A70] dark:border-[#3EC1D3]/15 dark:bg-[#0C2730] dark:text-[#9BB5BC]">
                    <th className="px-5 py-3">No</th>
                    <th className="px-4 py-3">Nama Grup</th>
                    <th className="px-4 py-3">ID Grup WhatsApp</th>
                    <th className="px-4 py-3">Keterangan</th>
                    <th className="px-5 py-3 text-right">Kelola</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#07525E]/8 dark:divide-[#3EC1D3]/10">
                  {waGroups.map((g, idx) => (
                    <tr key={g.id}>
                      <td className="px-5 py-3.5 font-mono text-xs text-[#526A70]">{idx + 1}</td>
                      <td className="px-4 py-3.5 font-semibold text-[#0F2429] dark:text-[#E6F4F7]">
                        {g.namaGrup}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-[#0C7A89] dark:text-[#3EC1D3]">
                        {g.groupId}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-[#526A70] dark:text-[#9BB5BC]">
                        {g.keterangan || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => openEditGroupModal(g)}
                            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#0C7A89] hover:text-[#07525E] dark:text-[#3EC1D3]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDeleteGroup(g)}
                            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-[#526A70] hover:text-red-700 dark:text-[#9BB5BC] dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RIWAYAT & ANTREAN JADWAL */}
      {subTab === 'history' && (
        <div className="mt-5 glass-surface-strong overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 px-5 py-4 dark:border-[#3EC1D3]/15">
            <div className="flex flex-wrap items-center gap-1.5">
              {['ALL', 'Diproses', 'Terjadwal', 'Terkirim', 'Sebagian Gagal', 'Gagal', 'Dibatalkan'].map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setHistoryFilter(st)}
                    className={`cursor-pointer rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                      historyFilter === st
                        ? 'bg-[#07525E] text-white dark:bg-[#0C7A89]'
                        : 'bg-[#EBF5F8] text-[#355158] hover:bg-[#DCEEF4] dark:bg-[#0D2A33] dark:text-[#A9C2C9]'
                    }`}
                  >
                    {st === 'ALL' ? 'Semua' : st}
                  </button>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={handleRunDueNow}
              disabled={runningDue || !webAppUrl}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#0C7A89]/30 bg-[#EBF5F8] px-3.5 py-2 text-xs font-semibold text-[#07525E] hover:bg-[#DCEEF4] disabled:opacity-60 dark:border-[#3EC1D3]/30 dark:bg-[#113540] dark:text-[#E6F4F7]"
            >
              <Play className="h-3.5 w-3.5" />
              <span>{runningDue ? 'Memproses...' : 'Jalankan Antrean Sekarang'}</span>
            </button>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="px-6 py-14 text-center text-xs text-[#526A70] dark:text-[#9BB5BC]">
              Belum ada riwayat atau antrean broadcast pada filter ini.
            </div>
          ) : (
            <div className="divide-y divide-[#07525E]/10 dark:divide-[#3EC1D3]/12">
              {filteredHistory.map((item) => {
                const statusColor =
                  item.status === 'Terkirim'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300'
                    : item.status === 'Diproses'
                      ? 'bg-cyan-100 text-cyan-900 dark:bg-cyan-950/70 dark:text-cyan-200'
                      : item.status === 'Terjadwal'
                        ? 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300'
                        : item.status === 'Sebagian Gagal'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300'
                          : item.status === 'Dibatalkan'
                            ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'bg-red-100 text-red-800 dark:bg-red-950/70 dark:text-red-300';

                const processedPct =
                  item.totalTarget > 0
                    ? Math.min(
                        100,
                        Math.round(((item.totalTerkirim + item.totalGagal) / item.totalTarget) * 100),
                      )
                    : 0;

                return (
                  <div key={item.id} className="p-5">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${statusColor}`}
                          >
                            {item.status}
                          </span>
                          <span className="rounded-md bg-[#EBF5F8] px-2 py-0.5 text-[11px] font-semibold uppercase text-[#07525E] dark:bg-[#113540] dark:text-[#3EC1D3]">
                            {item.channel === 'both'
                              ? 'WA & Email'
                              : item.channel === 'email'
                                ? 'Email'
                                : 'WhatsApp'}
                          </span>
                          {typeof item.delayDetik === 'number' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-[#F4FAFB] px-2 py-0.5 font-mono text-[11px] font-semibold text-[#355158] dark:bg-[#0D2B33] dark:text-[#9BB5BC]">
                              <Clock className="h-3 w-3" />
                              <span>{item.delayDetik > 0 ? `Jeda ${item.delayDetik} dtk` : 'Tanpa jeda'}</span>
                            </span>
                          )}
                          {item.imageName && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                              <ImagePlus className="h-3 w-3" />
                              <span>Foto</span>
                            </span>
                          )}
                        </div>

                        <h3 className="mt-2 text-sm font-bold text-[#07525E] dark:text-[#E6F4F7]">
                          {item.judul}
                        </h3>

                        <p className="mt-1 line-clamp-2 text-xs text-[#355158] dark:text-[#B4CCD3]">
                          {item.pesanWa || item.emailBody}
                        </p>

                        {item.status === 'Diproses' && item.totalTarget > 0 && (
                          <div className="mt-2.5 max-w-md">
                            <div className="flex items-center justify-between text-[11px] font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
                              <span>Sedang mengirim bertahap sesuai jeda...</span>
                              <span className="font-mono">{processedPct}%</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#DCEEF4] dark:bg-[#10323C]">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#0C7A89] to-[#2BB6C6] transition-all duration-300"
                                style={{ width: `${processedPct}%` }}
                              />
                            </div>
                          </div>
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                          <span>Target: {item.targetSummary}</span>
                          <span>&middot;</span>
                          <span className="font-mono">
                            Terkirim: {item.totalTerkirim}/{item.totalTarget}
                            {item.totalGagal > 0 ? ` (Gagal: ${item.totalGagal})` : ''}
                          </span>
                          {item.jadwalKirim && (
                            <>
                              <span>&middot;</span>
                              <span className="font-mono font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
                                Jadwal: {item.jadwalKirim} WITA
                              </span>
                            </>
                          )}
                          {item.dikirimPada && (
                            <>
                              <span>&middot;</span>
                              <span className="font-mono">Selesai: {item.dikirimPada}</span>
                            </>
                          )}
                        </div>

                        {item.logHasil && (
                          <div className="mt-2">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedLogId((prev) => (prev === item.id ? null : item.id))
                              }
                              className="cursor-pointer text-[11px] font-semibold text-[#0C7A89] hover:underline dark:text-[#3EC1D3]"
                            >
                              {expandedLogId === item.id ? 'Sembunyikan Log' : 'Lihat Detail Log'}
                            </button>
                            {expandedLogId === item.id && (
                              <div className="mt-1.5 rounded-lg bg-[#F4FAFB] p-2.5 font-mono text-[11px] text-[#355158] dark:bg-[#081C22] dark:text-[#A9C2C9]">
                                {item.logHasil}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {(item.status === 'Terjadwal' || item.status === 'Diproses') && (
                          <button
                            type="button"
                            onClick={() => void handleCancelScheduled(item.id)}
                            className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-amber-500/35 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-400/30 dark:bg-amber-950/60 dark:text-amber-200"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            <span>Batalkan</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDeleteHistory(item.id)}
                          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[#07525E]/15 px-2.5 py-1.5 text-xs font-semibold text-[#526A70] hover:text-red-700 dark:border-[#3EC1D3]/20 dark:text-[#9BB5BC] dark:hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL TAMBAH / EDIT GRUP WA */}
      {groupModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#042D35]/50 p-4 backdrop-blur-sm dark:bg-black/70"
        >
          <div className="glass-surface-strong w-full max-w-md bg-white p-6 dark:bg-[#0B2229]">
            <div className="flex items-start justify-between gap-3 border-b border-[#07525E]/10 pb-3 dark:border-[#3EC1D3]/15">
              <div>
                <h2 className="text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  {editingGroup ? 'Edit Grup WhatsApp' : 'Tambah Grup WhatsApp'}
                </h2>
                <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#9BB5BC]">
                  Masukkan nama grup beserta ID Grup (<span className="font-mono">xxxx@g.us</span>).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGroupModalOpen(false)}
                className="cursor-pointer rounded-lg p-1 text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGroup} className="mt-4 space-y-4">
              {groupError && (
                <div className="rounded-xl border border-amber-500/35 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
                  {groupError}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Nama Grup *
                </label>
                <input
                  type="text"
                  required
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  placeholder="Contoh: Pengurus DUWD DPP WI"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  ID Grup WhatsApp *
                </label>
                <input
                  type="text"
                  required
                  value={groupIdInput}
                  onChange={(e) => setGroupIdInput(e.target.value)}
                  placeholder="Contoh: 120363123456789012@g.us"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Keterangan (Opsional)
                </label>
                <input
                  type="text"
                  value={groupDescInput}
                  onChange={(e) => setGroupDescInput(e.target.value)}
                  placeholder="Contoh: Grup koordinasi utama departemen"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-sm text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
                <button
                  type="button"
                  onClick={() => setGroupModalOpen(false)}
                  className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-[#526A70]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingGroup}
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {savingGroup ? 'Menyimpan...' : 'Simpan Grup'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KONFIGURASI RECHAT & EMAIL (KHUSUS SUPER ADMIN) */}
      {configModalOpen && isSuperAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#042D35]/50 p-4 backdrop-blur-sm dark:bg-black/70"
        >
          <div className="glass-surface-strong w-full max-w-lg bg-white p-6 dark:bg-[#0B2229]">
            <div className="flex items-start justify-between gap-3 border-b border-[#07525E]/10 pb-3 dark:border-[#3EC1D3]/15">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#0C7A89] dark:text-[#3EC1D3]" />
                <div>
                  <h2 className="text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Konfigurasi ReChat WA &amp; Alias Email
                  </h2>
                  <p className="text-xs text-[#526A70] dark:text-[#9BB5BC]">
                    API Key disimpan aman di Script Properties Apps Script (tidak tersimpan di GitHub).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfigModalOpen(false)}
                className="cursor-pointer rounded-lg p-1 text-[#526A70] hover:bg-[#EBF5F8]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBroadcastConfig} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  ReChat / MiPOS API Key {broadcastConfig.rechatConfigured ? '(Kosongkan jika tidak diganti)' : '*'}
                </label>
                <input
                  type="password"
                  value={cfgRechatKey}
                  onChange={(e) => setCfgRechatKey(e.target.value)}
                  placeholder={
                    broadcastConfig.rechatConfigured
                      ? `Tersimpan: ${broadcastConfig.rechatKeyMasked}`
                      : 'Tempel API Key perangkat DUWD dari ReChat'
                  }
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                  Endpoint ReChat API
                </label>
                <input
                  type="url"
                  value={cfgRechatUrl}
                  onChange={(e) => setCfgRechatUrl(e.target.value)}
                  placeholder="https://www.rechat.id/api/v1/messages"
                  className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                />
                <p className="mt-1 text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                  Menggunakan metode header <span className="font-mono">Authorization: Bearer</span> agar API Key tidak terekspos di URL.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Alias Email Pengirim
                  </label>
                  <input
                    type="email"
                    required
                    value={cfgEmailAlias}
                    onChange={(e) => setCfgEmailAlias(e.target.value)}
                    placeholder="dppwiduwd@gmail.com"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 font-mono text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-[#355158] dark:text-[#B4CCD3]">
                    Nama Pengirim Email
                  </label>
                  <input
                    type="text"
                    required
                    value={cfgEmailSenderName}
                    onChange={(e) => setCfgEmailSenderName(e.target.value)}
                    placeholder="DUWD DPP Wahdah Islamiyah"
                    className="w-full rounded-xl border border-[#07525E]/18 bg-white px-3.5 py-2 text-xs text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#071A20] dark:text-[#E6F4F7]"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
                <button
                  type="button"
                  onClick={() => setConfigModalOpen(false)}
                  className="cursor-pointer rounded-xl px-4 py-2 text-xs font-semibold text-[#526A70]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                >
                  {savingConfig ? 'Menyimpan...' : 'Simpan Konfigurasi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
