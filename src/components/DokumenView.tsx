import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  File as FileIcon,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  GripVertical,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DOKUMEN_DRIVE_ROOT_URL,
  deleteDokumenFileRecord,
  deleteDokumenKategoriRecord,
  deleteDokumenSubkategoriRecord,
  reorderDokumenKategoriRecords,
  saveDokumenFileRecord,
  saveDokumenKategoriRecord,
  saveDokumenSubkategoriRecord,
  trackDokumenStatRecord,
  uploadDokumenFileToDrive,
} from '../services/orgService';
import type {
  DokumenFileItem,
  DokumenKategoriItem,
  DokumenSubkategoriItem,
  UserRole,
} from '../types/org';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB batas aman unggah langsung via GAS

interface DokumenViewProps {
  role: UserRole;
  activePin: string;
  webAppUrl: string;
  syncing: boolean;
  onRefresh: () => void;
  kategoriList: DokumenKategoriItem[];
  subkategoriList: DokumenSubkategoriItem[];
  fileList: DokumenFileItem[];
  onSaveKategori: (item: DokumenKategoriItem) => void;
  onReorderKategori: (reordered: DokumenKategoriItem[]) => void;
  onDeleteKategori: (id: string) => void;
  onSaveSubkategori: (item: DokumenSubkategoriItem, oldName?: string) => void;
  onDeleteSubkategori: (item: DokumenSubkategoriItem) => void;
  onSaveFiles: (
    items: DokumenFileItem[],
    updatedCategoryFolder?: {
      kategoriId: string;
      folderId?: string;
      folderUrl?: string;
      tanggalUpdate?: string;
    },
  ) => void;
  onDeleteFile: (id: string) => void;
  onTrackStat: (
    id: string,
    metric: 'view' | 'download',
    syncedCounts?: { jumlahDilihat?: number; jumlahDiunduh?: number },
  ) => void;
}

interface QueuedUploadFile {
  localId: string;
  file: File;
  judulDokumen: string;
  ext: string;
  isZip: boolean;
}

type AddActionMode = 'subkategori' | 'file' | 'link';
type StatsSortBy = 'views' | 'downloads' | 'recent';

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateId(isoDate?: string): string {
  if (!isoDate) return '-';
  const clean = isoDate.trim().slice(0, 10);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'Mei',
    'Jun',
    'Jul',
    'Agu',
    'Sep',
    'Okt',
    'Nov',
    'Des',
  ];
  const monthIdx = Number(match[2]) - 1;
  const day = Number(match[3]);
  return `${day} ${months[monthIdx] || match[2]} ${match[1]}`;
}

function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2).replace('.', ',')} MB`;
}

function extractExtension(fileName: string): string {
  const match = fileName.trim().match(/\.([a-zA-Z0-9]+)$/);
  return match?.[1] ? match[1].toLowerCase() : 'file';
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
}

function extractDriveFileIdFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return '';
  const dMatch = trimmed.match(
    /\/(?:file\/d|document\/d|spreadsheets\/d|presentation\/d)\/([a-zA-Z0-9_-]+)/,
  );
  if (dMatch?.[1]) return dMatch[1];
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return idMatch?.[1] || '';
}

function isLinkDocument(item: DokumenFileItem): boolean {
  if (item.tipeItem === 'link') return true;
  if (item.tipeItem === 'file') return false;
  return !item.driveFileId && (item.ekstensi || '').toLowerCase() === 'link';
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(new Error(`Gagal membaca berkas ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function getDirectDownloadUrl(item: DokumenFileItem): string {
  const fileId = item.driveFileId || extractDriveFileIdFromUrl(item.driveFileUrl);
  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return item.driveFileUrl || DOKUMEN_DRIVE_ROOT_URL;
}

function getPreviewIframeUrl(item: DokumenFileItem): string {
  const fileId = item.driveFileId || extractDriveFileIdFromUrl(item.driveFileUrl);
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
  return '';
}

function renderFileIcon(item: DokumenFileItem) {
  if (isLinkDocument(item)) {
    return <Link2 className="h-4 w-4 shrink-0 text-[#0C7A89] dark:text-[#3EC1D3]" />;
  }
  const ext = (item.ekstensi || '').toLowerCase();
  if (ext === 'pdf') return <FileText className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />;
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) {
    return <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
  }
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) {
    return <FileText className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />;
  }
  if (['ppt', 'pptx', 'odp'].includes(ext)) {
    return <FileText className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />;
  }
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) {
    return <FileImage className="h-4 w-4 shrink-0 text-teal-600 dark:text-teal-400" />;
  }
  if (['zip', 'rar', '7z'].includes(ext)) {
    return <FileArchive className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />;
  }
  return <FileIcon className="h-4 w-4 shrink-0 text-[#526A70] dark:text-[#8DA8B0]" />;
}

export function DokumenView({
  role,
  activePin,
  webAppUrl,
  syncing,
  onRefresh,
  kategoriList,
  subkategoriList,
  fileList,
  onSaveKategori,
  onReorderKategori,
  onDeleteKategori,
  onSaveSubkategori,
  onDeleteSubkategori,
  onSaveFiles,
  onDeleteFile,
  onTrackStat,
}: DokumenViewProps) {
  const isSuperAdmin = role === 'superadmin';
  const isAdminOrSuperAdmin = role === 'admin' || role === 'superadmin';

  // Search & View tab (Admin can toggle Statistik panel)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategoriFilter, setSelectedKategoriFilter] = useState<string>('semua');
  const [showStatsPanel, setShowStatsPanel] = useState(false);
  const [statsSortBy, setStatsSortBy] = useState<StatsSortBy>('views');

  // Expand state: DEFAULT COLLAPSED (bersih: tampilkan Kategori & Subkategori saja, klik baru muncul di bawahnya!)
  const [expandedSubKeys, setExpandedSubKeys] = useState<Record<string, boolean>>({});
  const [expandedDirectKatIds, setExpandedDirectKatIds] = useState<Record<string, boolean>>({});

  // Reordering feedback
  const [reordering, setReordering] = useState(false);

  // Inline notification
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ---- MODAL 1: TAMBAH / EDIT KATEGORI ----
  const NEW_KATEGORI_DRAFT_ID = '__NEW_KATEGORI_DRAFT__';
  const [kategoriModalOpen, setKategoriModalOpen] = useState(false);
  const [editingKategori, setEditingKategori] = useState<DokumenKategoriItem | null>(null);
  const [katNama, setKatNama] = useState('');
  const [katDeskripsi, setKatDeskripsi] = useState('');
  const [katDraftOrderIds, setKatDraftOrderIds] = useState<string[]>([]);
  const [katDraggingId, setKatDraggingId] = useState<string | null>(null);
  const [katTanggalUpdate, setKatTanggalUpdate] = useState(getTodayIsoDate());
  const [katSaving, setKatSaving] = useState(false);
  const [katError, setKatError] = useState('');

  // ---- MODAL 2: TAMBAH DOKUMEN / SUBKATEGORI / LINK (PILIH KATEGORI DULU) ----
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addKategoriId, setAddKategoriId] = useState('');
  const [addMode, setAddMode] = useState<AddActionMode>('file');
  const [addSubkategoriNama, setAddSubkategoriNama] = useState('');
  const [addTargetSubkategori, setAddTargetSubkategori] = useState('');
  const [addTanggalUpdate, setAddTanggalUpdate] = useState(getTodayIsoDate());
  const [addKeterangan, setAddKeterangan] = useState('');
  const [uploadQueue, setUploadQueue] = useState<QueuedUploadFile[]>([]);
  const [extractZip, setExtractZip] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [linkJudul, setLinkJudul] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [addProgress, setAddProgress] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ---- MODAL 3: EDIT SUBKATEGORI ----
  const [editingSubkategori, setEditingSubkategori] = useState<DokumenSubkategoriItem | null>(null);
  const [editSubNama, setEditSubNama] = useState('');
  const [editSubUrutan, setEditSubUrutan] = useState<number>(1);
  const [editSubTanggal, setEditSubTanggal] = useState(getTodayIsoDate());
  const [editSubSaving, setEditSubSaving] = useState(false);
  const [editSubError, setEditSubError] = useState('');

  // ---- MODAL 4: EDIT FILE / LINK ----
  const [editingFile, setEditingFile] = useState<DokumenFileItem | null>(null);
  const [editFileKategoriId, setEditFileKategoriId] = useState('');
  const [editFileSubfolder, setEditFileSubfolder] = useState('');
  const [editFileJudul, setEditFileJudul] = useState('');
  const [editFileTanggal, setEditFileTanggal] = useState(getTodayIsoDate());
  const [editFileKeterangan, setEditFileKeterangan] = useState('');
  const [editFileUrl, setEditFileUrl] = useState('');
  const [editReplacementFile, setEditReplacementFile] = useState<File | null>(null);
  const [editReplacementDrag, setEditReplacementDrag] = useState(false);
  const [editFileSaving, setEditFileSaving] = useState(false);
  const [editFileError, setEditFileError] = useState('');
  const replaceInputRef = useRef<HTMLInputElement | null>(null);

  // ---- MODAL 5: PREVIEW & MODAL 6: KONFIRMASI HAPUS ----
  const [previewFile, setPreviewFile] = useState<DokumenFileItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<
    | { kind: 'kategori'; item: DokumenKategoriItem; docCount: number }
    | { kind: 'subkategori'; item: DokumenSubkategoriItem; docCount: number }
    | { kind: 'file'; item: DokumenFileItem }
    | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  // Reset stats panel if user logs out back to publik
  useEffect(() => {
    if (!isAdminOrSuperAdmin && showStatsPanel) {
      setShowStatsPanel(false);
    }
  }, [isAdminOrSuperAdmin, showStatsPanel]);

  // Escape closes modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (deleteConfirm && !deleting) setDeleteConfirm(null);
      else if (previewFile) setPreviewFile(null);
      else if (editingFile && !editFileSaving) setEditingFile(null);
      else if (editingSubkategori && !editSubSaving) setEditingSubkategori(null);
      else if (addModalOpen && !addSaving) setAddModalOpen(false);
      else if (kategoriModalOpen && !katSaving) setKategoriModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    deleteConfirm,
    deleting,
    previewFile,
    editingFile,
    editFileSaving,
    editingSubkategori,
    editSubSaving,
    addModalOpen,
    addSaving,
    kategoriModalOpen,
    katSaving,
  ]);

  // Sorted categories (respecting Urutan)
  const sortedKategori = useMemo(() => {
    return [...kategoriList].sort((a, b) => {
      const diff = (Number(a.urutan) || 999) - (Number(b.urutan) || 999);
      if (diff !== 0) return diff;
      return a.namaKategori.localeCompare(b.namaKategori, 'id');
    });
  }, [kategoriList]);

  // Build unified category tree (combining explicit subkategori rows + any legacy file subfolder strings)
  const categoryTree = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return sortedKategori
      .filter((kat) =>
        selectedKategoriFilter === 'semua' ? true : kat.id === selectedKategoriFilter,
      )
      .map((kat) => {
        const allFilesInKat = fileList.filter((f) => f.kategoriId === kat.id);
        const explicitSubs = subkategoriList
          .filter((s) => s.kategoriId === kat.id)
          .sort((a, b) => {
            const diff = (Number(a.urutan) || 999) - (Number(b.urutan) || 999);
            if (diff !== 0) return diff;
            return a.namaSubkategori.localeCompare(b.namaSubkategori, 'id');
          });

        // Merge legacy subfolder names from files if not already in explicitSubs
        const subMap = new Map<
          string,
          {
            record: DokumenSubkategoriItem | null;
            name: string;
            key: string;
            allItems: DokumenFileItem[];
          }
        >();

        explicitSubs.forEach((sub) => {
          const norm = sub.namaSubkategori.trim().toLowerCase();
          subMap.set(norm, {
            record: sub,
            name: sub.namaSubkategori.trim(),
            key: `${kat.id}::${norm}`,
            allItems: [],
          });
        });

        const allDirectFiles: DokumenFileItem[] = [];

        allFilesInKat.forEach((f) => {
          const subName = (f.subfolder || '').trim();
          if (!subName) {
            allDirectFiles.push(f);
            return;
          }
          const norm = subName.toLowerCase();
          if (!subMap.has(norm)) {
            subMap.set(norm, {
              record: null,
              name: subName,
              key: `${kat.id}::${norm}`,
              allItems: [],
            });
          }
          subMap.get(norm)!.allItems.push(f);
        });

        const katMatchesQuery =
          !query ||
          kat.namaKategori.toLowerCase().includes(query) ||
          (kat.deskripsi || '').toLowerCase().includes(query);

        const matchesFileQuery = (f: DokumenFileItem): boolean => {
          if (!query || katMatchesQuery) return true;
          return (
            f.judulDokumen.toLowerCase().includes(query) ||
            (f.subfolder || '').toLowerCase().includes(query) ||
            (f.ekstensi || '').toLowerCase().includes(query) ||
            (f.keterangan || '').toLowerCase().includes(query) ||
            (f.namaFileDrive || '').toLowerCase().includes(query)
          );
        };

        const filteredDirectFiles = allDirectFiles
          .filter(matchesFileQuery)
          .sort((a, b) => a.judulDokumen.localeCompare(b.judulDokumen, 'id'));

        const subcategories = Array.from(subMap.values())
          .map((subEntry) => {
            const subMatchesQuery = !query || katMatchesQuery || subEntry.name.toLowerCase().includes(query);
            const filteredItems = (subMatchesQuery
              ? subEntry.allItems
              : subEntry.allItems.filter(matchesFileQuery)
            ).sort((a, b) => a.judulDokumen.localeCompare(b.judulDokumen, 'id'));

            let latestUpdate = subEntry.record?.tanggalUpdate || '';
            let driveFolderUrl = subEntry.record?.driveFolderUrl || '';
            subEntry.allItems.forEach((it) => {
              if (it.tanggalUpdate && it.tanggalUpdate > latestUpdate) latestUpdate = it.tanggalUpdate;
              if (!driveFolderUrl && it.driveFolderUrl) driveFolderUrl = it.driveFolderUrl;
            });

            return {
              ...subEntry,
              filteredItems,
              totalCount: subEntry.allItems.length,
              latestUpdate,
              driveFolderUrl,
              visible: !query || subMatchesQuery || filteredItems.length > 0,
            };
          })
          .filter((s) => s.visible);

        let latestCatUpdate = kat.tanggalUpdate || '';
        allFilesInKat.forEach((f) => {
          if (f.tanggalUpdate && f.tanggalUpdate > latestCatUpdate) {
            latestCatUpdate = f.tanggalUpdate;
          }
        });

        const totalDocsInKat = allFilesInKat.length;
        const hasVisibleContent =
          !query || katMatchesQuery || filteredDirectFiles.length > 0 || subcategories.length > 0;

        return {
          kategori: kat,
          totalDocsInKat,
          totalSubcategories: subMap.size,
          allDirectCount: allDirectFiles.length,
          directFiles: filteredDirectFiles,
          subcategories,
          latestCatUpdate,
          hasVisibleContent,
        };
      })
      .filter((entry) => entry.hasVisibleContent);
  }, [sortedKategori, subkategoriList, fileList, searchQuery, selectedKategoriFilter]);

  // Overall stats (Admin sees views & downloads too)
  const overallStats = useMemo(() => {
    let totalViews = 0;
    let totalDownloads = 0;
    let latestDate = '';
    kategoriList.forEach((k) => {
      if (k.tanggalUpdate && k.tanggalUpdate > latestDate) latestDate = k.tanggalUpdate;
    });
    fileList.forEach((f) => {
      totalViews += Number(f.jumlahDilihat || 0);
      totalDownloads += Number(f.jumlahDiunduh || 0);
      if (f.tanggalUpdate && f.tanggalUpdate > latestDate) latestDate = f.tanggalUpdate;
    });
    return {
      totalKategori: kategoriList.length,
      totalSubkategori: subkategoriList.length,
      totalDokumen: fileList.length,
      totalViews,
      totalDownloads,
      latestDate,
    };
  }, [kategoriList, subkategoriList, fileList]);

  // Sorted list for Admin Statistics Panel
  const sortedStatsFiles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = fileList.filter((f) => {
      if (selectedKategoriFilter !== 'semua' && f.kategoriId !== selectedKategoriFilter) {
        return false;
      }
      if (!query) return true;
      return (
        f.judulDokumen.toLowerCase().includes(query) ||
        f.namaKategori.toLowerCase().includes(query) ||
        (f.subfolder || '').toLowerCase().includes(query)
      );
    });
    return [...list].sort((a, b) => {
      if (statsSortBy === 'views') {
        const diff = (b.jumlahDilihat || 0) - (a.jumlahDilihat || 0);
        if (diff !== 0) return diff;
        return (b.jumlahDiunduh || 0) - (a.jumlahDiunduh || 0);
      }
      if (statsSortBy === 'downloads') {
        const diff = (b.jumlahDiunduh || 0) - (a.jumlahDiunduh || 0);
        if (diff !== 0) return diff;
        return (b.jumlahDilihat || 0) - (a.jumlahDilihat || 0);
      }
      return (b.tanggalUpdate || '').localeCompare(a.tanggalUpdate || '');
    });
  }, [fileList, searchQuery, selectedKategoriFilter, statsSortBy]);

  // Available subcategories for selected category in Add / Edit modals
  const subkategoriOptionsForAdd = useMemo(() => {
    if (!addKategoriId) return [];
    const set = new Set<string>();
    subkategoriList
      .filter((s) => s.kategoriId === addKategoriId)
      .sort((a, b) => (a.urutan || 0) - (b.urutan || 0))
      .forEach((s) => set.add(s.namaSubkategori.trim()));
    fileList
      .filter((f) => f.kategoriId === addKategoriId && f.subfolder.trim())
      .forEach((f) => set.add(f.subfolder.trim()));
    return Array.from(set);
  }, [addKategoriId, subkategoriList, fileList]);

  const subkategoriOptionsForEdit = useMemo(() => {
    if (!editFileKategoriId) return [];
    const set = new Set<string>();
    subkategoriList
      .filter((s) => s.kategoriId === editFileKategoriId)
      .forEach((s) => set.add(s.namaSubkategori.trim()));
    fileList
      .filter((f) => f.kategoriId === editFileKategoriId && f.subfolder.trim())
      .forEach((f) => set.add(f.subfolder.trim()));
    return Array.from(set);
  }, [editFileKategoriId, subkategoriList, fileList]);

  const hasZipInQueue = useMemo(() => uploadQueue.some((q) => q.isZip), [uploadQueue]);
  const isSearchActive = Boolean(searchQuery.trim());

  // ---- VIEW / DOWNLOAD TRACKING ----
  const triggerTrackStat = (item: DokumenFileItem, metric: 'view' | 'download') => {
    // Optimistic update immediately
    onTrackStat(item.id, metric);
    // Sync to Google Sheets in background
    void trackDokumenStatRecord(item.id, metric, webAppUrl).then((res) => {
      if (res.ok) {
        onTrackStat(item.id, metric, {
          jumlahDilihat: res.jumlahDilihat,
          jumlahDiunduh: res.jumlahDiunduh,
        });
      }
    });
  };

  const handleOpenPreview = (item: DokumenFileItem) => {
    triggerTrackStat(item, 'view');
    setPreviewFile(item);
  };

  // ---- REORDER KATEGORI (UP / DOWN) ----
  const handleMoveKategori = async (kategoriId: string, direction: 'up' | 'down') => {
    const idx = sortedKategori.findIndex((k) => k.id === kategoriId);
    if (idx === -1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sortedKategori.length) return;

    const reordered = [...sortedKategori];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(swapIdx, 0, moved);

    const normalized = reordered.map((k, i) => ({
      ...k,
      urutan: i + 1,
    }));

    onReorderKategori(normalized);
    setReordering(true);
    try {
      const res = await reorderDokumenKategoriRecords(
        normalized.map((k) => ({ id: k.id, urutan: k.urutan })),
        activePin,
        webAppUrl,
      );
      if (!res.ok) {
        setNotice({ type: 'error', text: res.error || 'Gagal menyimpan urutan kategori.' });
      }
    } finally {
      setReordering(false);
    }
  };

  // ---- MODAL 1: KATEGORI HANDLERS ----
  const openCreateKategoriModal = () => {
    setEditingKategori(null);
    setKatNama('');
    setKatDeskripsi('');
    setKatDraftOrderIds([...sortedKategori.map((k) => k.id), NEW_KATEGORI_DRAFT_ID]);
    setKatDraggingId(null);
    setKatTanggalUpdate(getTodayIsoDate());
    setKatError('');
    setKategoriModalOpen(true);
  };

  const openEditKategoriModal = (kat: DokumenKategoriItem) => {
    setEditingKategori(kat);
    setKatNama(kat.namaKategori);
    setKatDeskripsi(kat.deskripsi || '');
    setKatDraftOrderIds(sortedKategori.map((k) => k.id));
    setKatDraggingId(null);
    setKatTanggalUpdate(kat.tanggalUpdate || getTodayIsoDate());
    setKatError('');
    setKategoriModalOpen(true);
  };

  const moveDraftKategoriByStep = (targetId: string, direction: 'up' | 'down') => {
    setKatDraftOrderIds((prev) => {
      const idx = prev.indexOf(targetId);
      if (idx === -1) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(idx, 1);
      next.splice(swapIdx, 0, moved);
      return next;
    });
  };

  const reorderDraftKategoriByDrop = (dragId: string, dropTargetId: string) => {
    if (!dragId || !dropTargetId || dragId === dropTargetId) return;
    setKatDraftOrderIds((prev) => {
      const fromIdx = prev.indexOf(dragId);
      const toIdx = prev.indexOf(dropTargetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  };

  const handleSubmitKategori = async (e: FormEvent) => {
    e.preventDefault();
    if (!katNama.trim()) {
      setKatError('Nama kategori wajib diisi.');
      return;
    }
    setKatSaving(true);
    setKatError('');
    try {
      const activeKey = editingKategori?.id || NEW_KATEGORI_DRAFT_ID;
      const orderIdx = katDraftOrderIds.indexOf(activeKey);
      const computedUrutan = orderIdx >= 0 ? orderIdx + 1 : sortedKategori.length + 1;

      const res = await saveDokumenKategoriRecord(
        {
          id: editingKategori?.id,
          namaKategori: katNama.trim(),
          deskripsi: katDeskripsi.trim(),
          urutan: computedUrutan,
          tanggalUpdate: katTanggalUpdate || getTodayIsoDate(),
          driveFolderId: editingKategori?.driveFolderId,
          driveFolderUrl: editingKategori?.driveFolderUrl,
          dibuatPada: editingKategori?.dibuatPada,
        },
        activePin,
        webAppUrl,
      );
      if (!res.ok || !res.item) {
        setKatError(res.error || 'Gagal menyimpan kategori.');
        return;
      }

      const savedItem = res.item;
      onSaveKategori(savedItem);

      // Normalisasi urutan seluruh kategori menjadi 1..N (dijamin unik, tidak ada nomor ganda)
      const byId = new Map<string, DokumenKategoriItem>(
        sortedKategori.map((k) => [k.id, k]),
      );
      byId.set(savedItem.id, savedItem);

      const resolvedIds = (katDraftOrderIds.length > 0 ? katDraftOrderIds : [savedItem.id])
        .map((id) => (id === NEW_KATEGORI_DRAFT_ID ? savedItem.id : id))
        .filter((id, idx, arr) => byId.has(id) && arr.indexOf(id) === idx);

      byId.forEach((_, id) => {
        if (!resolvedIds.includes(id)) resolvedIds.push(id);
      });

      const normalizedList: DokumenKategoriItem[] = resolvedIds.map((id, idx) => ({
        ...byId.get(id)!,
        urutan: idx + 1,
      }));

      onReorderKategori(normalizedList);

      if (normalizedList.length > 1) {
        void reorderDokumenKategoriRecords(
          normalizedList.map((k) => ({ id: k.id, urutan: k.urutan })),
          activePin,
          webAppUrl,
        );
      }

      setKategoriModalOpen(false);
      setNotice({
        type: 'success',
        text: editingKategori
          ? `Kategori "${savedItem.namaKategori}" dan urutannya berhasil diperbarui.`
          : `Kategori "${savedItem.namaKategori}" berhasil dibuat beserta foldernya di Google Drive.`,
      });
    } finally {
      setKatSaving(false);
    }
  };

  // ---- MODAL 2: TAMBAH SUBKATEGORI / FILE / LINK (PILIH KATEGORI DULU) ----
  const openAddModal = (
    presetKategoriId?: string,
    presetMode: AddActionMode = 'file',
    presetSubkategori = '',
  ) => {
    if (sortedKategori.length === 0) {
      setNotice({
        type: 'error',
        text: 'Buat minimal satu Kategori terlebih dahulu sebelum menambahkan subkategori, file, atau link.',
      });
      openCreateKategoriModal();
      return;
    }
    setAddKategoriId(presetKategoriId || sortedKategori[0].id);
    setAddMode(presetMode);
    setAddSubkategoriNama('');
    setAddTargetSubkategori(presetSubkategori);
    setAddTanggalUpdate(getTodayIsoDate());
    setAddKeterangan('');
    setUploadQueue([]);
    setExtractZip(true);
    setLinkJudul('');
    setLinkUrl('');
    setAddProgress('');
    setAddError('');
    setAddModalOpen(true);
  };

  const appendFilesToQueue = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const oversized: string[] = [];
    const accepted: QueuedUploadFile[] = [];

    incoming.forEach((file) => {
      if (file.size > MAX_UPLOAD_BYTES) {
        oversized.push(`${file.name} (${formatFileSize(file.size)})`);
        return;
      }
      const ext = extractExtension(file.name);
      accepted.push({
        localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        judulDokumen: stripExtension(file.name) || file.name,
        ext,
        isZip:
          ext === 'zip' ||
          file.type === 'application/zip' ||
          file.type === 'application/x-zip-compressed',
      });
    });

    if (oversized.length > 0) {
      setAddError(
        `Berkas melebihi batas unggah langsung 25 MB: ${oversized.join(', ')}. Untuk file berukuran besar, unggah langsung ke Google Drive lalu gunakan opsi "Input Link Saja".`,
      );
    } else {
      setAddError('');
    }

    if (accepted.length > 0) {
      setUploadQueue((prev) => [...prev, ...accepted]);
    }
  };

  const handleDropZone = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      appendFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleSubmitAdd = async (e: FormEvent) => {
    e.preventDefault();
    setAddError('');

    const targetKat = sortedKategori.find((k) => k.id === addKategoriId);
    if (!targetKat) {
      setAddError('Pilih Kategori terlebih dahulu.');
      return;
    }

    const tanggal = addTanggalUpdate || getTodayIsoDate();

    // OPSI 1: TAMBAH SUBKATEGORI (+ opsional unggah file/ZIP sekaligus)
    if (addMode === 'subkategori') {
      const subName = addSubkategoriNama.trim();
      if (!subName) {
        setAddError('Nama subkategori wajib diisi.');
        return;
      }
      setAddSaving(true);
      try {
        setAddProgress(`Membuat subkategori "${subName}" di Google Drive...`);
        const existingCount = subkategoriList.filter((s) => s.kategoriId === targetKat.id).length;
        const subRes = await saveDokumenSubkategoriRecord(
          {
            kategoriId: targetKat.id,
            namaKategori: targetKat.namaKategori,
            namaSubkategori: subName,
            urutan: existingCount + 1,
            tanggalUpdate: tanggal,
          },
          activePin,
          webAppUrl,
        );
        if (!subRes.ok || !subRes.item) {
          setAddError(subRes.error || 'Gagal membuat subkategori.');
          return;
        }
        onSaveSubkategori(subRes.item);

        // Jika pengguna sekaligus menyeret file/ZIP ke dalam subkategori baru ini
        if (uploadQueue.length > 0) {
          const savedFiles: DokumenFileItem[] = [];
          let latestCatFolderId = targetKat.driveFolderId;
          let latestCatFolderUrl = targetKat.driveFolderUrl;

          for (let i = 0; i < uploadQueue.length; i++) {
            const entry = uploadQueue[i];
            setAddProgress(
              `Mengunggah ${i + 1} dari ${uploadQueue.length}: ${entry.file.name}...`,
            );
            const base64Data = await readFileAsBase64(entry.file);
            const upRes = await uploadDokumenFileToDrive(
              {
                kategoriId: targetKat.id,
                namaKategori: targetKat.namaKategori,
                subfolder: subName,
                judulDokumen: entry.judulDokumen.trim() || stripExtension(entry.file.name),
                originalFileName: entry.file.name,
                mimeType: entry.file.type || 'application/octet-stream',
                ukuranBytes: entry.file.size,
                base64Data,
                extractZip: entry.isZip && extractZip,
                tanggalUpdate: tanggal,
                keterangan: addKeterangan.trim(),
              },
              activePin,
              webAppUrl,
            );
            if (!upRes.ok || !upRes.items) {
              setAddError(
                `Subkategori sudah dibuat, namun unggah "${entry.file.name}" gagal: ${upRes.error || 'Kesalahan unggah.'}`,
              );
              if (savedFiles.length > 0) {
                onSaveFiles(savedFiles, {
                  kategoriId: targetKat.id,
                  folderId: latestCatFolderId,
                  folderUrl: latestCatFolderUrl,
                  tanggalUpdate: tanggal,
                });
              }
              return;
            }
            savedFiles.push(...upRes.items);
            if (upRes.categoryFolderId) latestCatFolderId = upRes.categoryFolderId;
            if (upRes.categoryFolderUrl) latestCatFolderUrl = upRes.categoryFolderUrl;
          }

          onSaveFiles(savedFiles, {
            kategoriId: targetKat.id,
            folderId: latestCatFolderId,
            folderUrl: latestCatFolderUrl,
            tanggalUpdate: tanggal,
          });
          setNotice({
            type: 'success',
            text: `Subkategori "${subName}" dan ${savedFiles.length} dokumen berhasil ditambahkan ke "${targetKat.namaKategori}".`,
          });
        } else {
          setNotice({
            type: 'success',
            text: `Subkategori "${subName}" berhasil ditambahkan ke "${targetKat.namaKategori}".`,
          });
        }

        setAddModalOpen(false);
      } catch (err) {
        setAddError(err instanceof Error ? err.message : 'Gagal menyimpan subkategori.');
      } finally {
        setAddSaving(false);
        setAddProgress('');
      }
      return;
    }

    // OPSI 2: TAMBAH FILE LANGSUNG (ke Kategori atau ke Subkategori pilihan)
    if (addMode === 'file') {
      if (uploadQueue.length === 0) {
        setAddError('Seret atau pilih minimal satu file untuk diunggah.');
        return;
      }
      setAddSaving(true);
      try {
        const savedAll: DokumenFileItem[] = [];
        let latestCatFolderId = targetKat.driveFolderId;
        let latestCatFolderUrl = targetKat.driveFolderUrl;

        for (let i = 0; i < uploadQueue.length; i++) {
          const entry = uploadQueue[i];
          setAddProgress(
            `Mengunggah ${i + 1} dari ${uploadQueue.length}: ${entry.file.name}${
              entry.isZip && extractZip ? ' (ekstrak ZIP ke Drive...)' : ''
            }`,
          );
          const base64Data = await readFileAsBase64(entry.file);
          const upRes = await uploadDokumenFileToDrive(
            {
              kategoriId: targetKat.id,
              namaKategori: targetKat.namaKategori,
              subfolder: addTargetSubkategori.trim(),
              judulDokumen: entry.judulDokumen.trim() || stripExtension(entry.file.name),
              originalFileName: entry.file.name,
              mimeType: entry.file.type || 'application/octet-stream',
              ukuranBytes: entry.file.size,
              base64Data,
              extractZip: entry.isZip && extractZip,
              tanggalUpdate: tanggal,
              keterangan: addKeterangan.trim(),
            },
            activePin,
            webAppUrl,
          );
          if (!upRes.ok || !upRes.items) {
            setAddError(
              `Gagal mengunggah "${entry.file.name}": ${upRes.error || 'Terjadi kesalahan.'}`,
            );
            if (savedAll.length > 0) {
              onSaveFiles(savedAll, {
                kategoriId: targetKat.id,
                folderId: latestCatFolderId,
                folderUrl: latestCatFolderUrl,
                tanggalUpdate: tanggal,
              });
            }
            return;
          }
          savedAll.push(...upRes.items);
          if (upRes.categoryFolderId) latestCatFolderId = upRes.categoryFolderId;
          if (upRes.categoryFolderUrl) latestCatFolderUrl = upRes.categoryFolderUrl;
        }

        onSaveFiles(savedAll, {
          kategoriId: targetKat.id,
          folderId: latestCatFolderId,
          folderUrl: latestCatFolderUrl,
          tanggalUpdate: tanggal,
        });

        // Auto-expand lokasi tempat file baru diunggah agar langsung terlihat
        if (addTargetSubkategori.trim()) {
          setExpandedSubKeys((prev) => ({
            ...prev,
            [`${targetKat.id}::${addTargetSubkategori.trim().toLowerCase()}`]: true,
          }));
        } else {
          setExpandedDirectKatIds((prev) => ({ ...prev, [targetKat.id]: true }));
        }

        setAddModalOpen(false);
        setNotice({
          type: 'success',
          text: `${savedAll.length} file berhasil diunggah ke "${targetKat.namaKategori}"${
            addTargetSubkategori.trim() ? ` / ${addTargetSubkategori.trim()}` : ''
          }.`,
        });
      } catch (err) {
        setAddError(err instanceof Error ? err.message : 'Gagal mengunggah file.');
      } finally {
        setAddSaving(false);
        setAddProgress('');
      }
      return;
    }

    // OPSI 3: INPUT LINK SAJA (langsung diarahkan ke tab baru sesuai URL)
    const cleanJudul = linkJudul.trim();
    const cleanUrl = linkUrl.trim();
    if (!cleanJudul) {
      setAddError('Judul link dokumen wajib diisi.');
      return;
    }
    if (!cleanUrl || !/^https?:\/\//i.test(cleanUrl)) {
      setAddError('Masukkan alamat link yang valid diawali https:// atau http://');
      return;
    }

    setAddSaving(true);
    try {
      setAddProgress('Menyimpan tautan dokumen...');
      const extractedDriveId = extractDriveFileIdFromUrl(cleanUrl);
      const res = await saveDokumenFileRecord(
        {
          kategoriId: targetKat.id,
          namaKategori: targetKat.namaKategori,
          subfolder: addTargetSubkategori.trim(),
          judulDokumen: cleanJudul,
          tipeItem: 'link',
          namaFileDrive: cleanJudul,
          ekstensi: 'link',
          driveFileId: extractedDriveId,
          driveFileUrl: cleanUrl,
          driveFolderId: targetKat.driveFolderId || '',
          driveFolderUrl: targetKat.driveFolderUrl || DOKUMEN_DRIVE_ROOT_URL,
          tanggalUpdate: tanggal,
          keterangan: addKeterangan.trim(),
        },
        activePin,
        webAppUrl,
      );

      if (!res.ok || !res.item) {
        setAddError(res.error || 'Gagal menyimpan tautan dokumen.');
        return;
      }

      onSaveFiles([res.item], {
        kategoriId: targetKat.id,
        tanggalUpdate: tanggal,
      });

      if (addTargetSubkategori.trim()) {
        setExpandedSubKeys((prev) => ({
          ...prev,
          [`${targetKat.id}::${addTargetSubkategori.trim().toLowerCase()}`]: true,
        }));
      } else {
        setExpandedDirectKatIds((prev) => ({ ...prev, [targetKat.id]: true }));
      }

      setAddModalOpen(false);
      setNotice({
        type: 'success',
        text: `Link "${res.item.judulDokumen}" berhasil ditambahkan ke "${targetKat.namaKategori}".`,
      });
    } finally {
      setAddSaving(false);
      setAddProgress('');
    }
  };

  // ---- MODAL 3: EDIT SUBKATEGORI ----
  const openEditSubkategoriModal = (sub: DokumenSubkategoriItem) => {
    setEditingSubkategori(sub);
    setEditSubNama(sub.namaSubkategori);
    setEditSubUrutan(Number(sub.urutan) || 1);
    setEditSubTanggal(sub.tanggalUpdate || getTodayIsoDate());
    setEditSubError('');
  };

  const handleSubmitEditSubkategori = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingSubkategori) return;
    if (!editSubNama.trim()) {
      setEditSubError('Nama subkategori wajib diisi.');
      return;
    }
    setEditSubSaving(true);
    setEditSubError('');
    try {
      const oldName = editingSubkategori.namaSubkategori;
      const res = await saveDokumenSubkategoriRecord(
        {
          id: editingSubkategori.id,
          kategoriId: editingSubkategori.kategoriId,
          namaKategori: editingSubkategori.namaKategori,
          namaSubkategori: editSubNama.trim(),
          urutan: Math.max(1, Number(editSubUrutan) || 1),
          tanggalUpdate: editSubTanggal || getTodayIsoDate(),
          driveFolderId: editingSubkategori.driveFolderId,
          driveFolderUrl: editingSubkategori.driveFolderUrl,
          dibuatPada: editingSubkategori.dibuatPada,
        },
        activePin,
        webAppUrl,
      );
      if (!res.ok || !res.item) {
        setEditSubError(res.error || 'Gagal memperbarui subkategori.');
        return;
      }
      onSaveSubkategori(res.item, oldName);
      setEditingSubkategori(null);
      setNotice({
        type: 'success',
        text: `Subkategori "${res.item.namaSubkategori}" berhasil diperbarui.`,
      });
    } finally {
      setEditSubSaving(false);
    }
  };

  // ---- MODAL 4: EDIT FILE / LINK ----
  const openEditFileModal = (item: DokumenFileItem) => {
    setEditingFile(item);
    setEditFileKategoriId(item.kategoriId);
    setEditFileSubfolder(item.subfolder || '');
    setEditFileJudul(item.judulDokumen);
    setEditFileTanggal(item.tanggalUpdate || getTodayIsoDate());
    setEditFileKeterangan(item.keterangan || '');
    setEditFileUrl(item.driveFileUrl || '');
    setEditReplacementFile(null);
    setEditFileError('');
  };

  const handleSubmitEditFile = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingFile) return;
    if (!editFileJudul.trim()) {
      setEditFileError('Judul dokumen wajib diisi.');
      return;
    }
    const targetKat = sortedKategori.find((k) => k.id === editFileKategoriId);
    if (!targetKat) {
      setEditFileError('Pilih kategori yang valid.');
      return;
    }

    setEditFileSaving(true);
    setEditFileError('');
    try {
      if (editReplacementFile) {
        if (editReplacementFile.size > MAX_UPLOAD_BYTES) {
          setEditFileError('File pengganti melebihi batas 25 MB.');
          return;
        }
        const base64Data = await readFileAsBase64(editReplacementFile);
        const res = await uploadDokumenFileToDrive(
          {
            kategoriId: targetKat.id,
            namaKategori: targetKat.namaKategori,
            subfolder: editFileSubfolder.trim(),
            judulDokumen: editFileJudul.trim(),
            originalFileName: editReplacementFile.name,
            mimeType: editReplacementFile.type || 'application/octet-stream',
            ukuranBytes: editReplacementFile.size,
            base64Data,
            extractZip: false,
            tanggalUpdate: editFileTanggal || getTodayIsoDate(),
            keterangan: editFileKeterangan.trim(),
            replaceDokumenId: editingFile.id,
          },
          activePin,
          webAppUrl,
        );
        if (!res.ok || !res.items || res.items.length === 0) {
          setEditFileError(res.error || 'Gagal mengganti berkas.');
          return;
        }
        onSaveFiles(res.items, {
          kategoriId: targetKat.id,
          folderId: res.categoryFolderId,
          folderUrl: res.categoryFolderUrl,
          tanggalUpdate: editFileTanggal || getTodayIsoDate(),
        });
        setEditingFile(null);
        setNotice({
          type: 'success',
          text: `File "${editFileJudul.trim()}" berhasil diganti di Google Drive.`,
        });
        return;
      }

      const isLink = isLinkDocument(editingFile);
      const nextUrl = editFileUrl.trim() || editingFile.driveFileUrl;
      const res = await saveDokumenFileRecord(
        {
          id: editingFile.id,
          kategoriId: targetKat.id,
          namaKategori: targetKat.namaKategori,
          subfolder: editFileSubfolder.trim(),
          judulDokumen: editFileJudul.trim(),
          tipeItem: isLink ? 'link' : 'file',
          namaFileDrive: isLink ? editFileJudul.trim() : editingFile.namaFileDrive,
          ekstensi: editingFile.ekstensi,
          mimeType: editingFile.mimeType,
          ukuranBytes: editingFile.ukuranBytes,
          driveFileId: isLink
            ? extractDriveFileIdFromUrl(nextUrl)
            : editingFile.driveFileId || extractDriveFileIdFromUrl(nextUrl),
          driveFileUrl: nextUrl,
          driveFolderId: editingFile.driveFolderId,
          driveFolderUrl: editingFile.driveFolderUrl,
          tanggalUpdate: editFileTanggal || getTodayIsoDate(),
          keterangan: editFileKeterangan.trim(),
          jumlahDilihat: editingFile.jumlahDilihat || 0,
          jumlahDiunduh: editingFile.jumlahDiunduh || 0,
          dibuatPada: editingFile.dibuatPada,
        },
        activePin,
        webAppUrl,
      );
      if (!res.ok || !res.item) {
        setEditFileError(res.error || 'Gagal memperbarui dokumen.');
        return;
      }
      onSaveFiles([res.item], {
        kategoriId: targetKat.id,
        tanggalUpdate: editFileTanggal || getTodayIsoDate(),
      });
      setEditingFile(null);
      setNotice({
        type: 'success',
        text: `Dokumen "${res.item.judulDokumen}" berhasil diperbarui.`,
      });
    } finally {
      setEditFileSaving(false);
    }
  };

  // ---- DELETE HANDLER ----
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      if (deleteConfirm.kind === 'kategori') {
        const res = await deleteDokumenKategoriRecord(deleteConfirm.item.id, activePin, webAppUrl);
        if (!res.ok) {
          setNotice({ type: 'error', text: res.error || 'Gagal menghapus kategori.' });
          return;
        }
        onDeleteKategori(deleteConfirm.item.id);
        setNotice({
          type: 'success',
          text: `Kategori "${deleteConfirm.item.namaKategori}" berhasil dihapus.`,
        });
      } else if (deleteConfirm.kind === 'subkategori') {
        const res = await deleteDokumenSubkategoriRecord(
          deleteConfirm.item.id,
          activePin,
          webAppUrl,
        );
        if (!res.ok) {
          setNotice({ type: 'error', text: res.error || 'Gagal menghapus subkategori.' });
          return;
        }
        onDeleteSubkategori(deleteConfirm.item);
        setNotice({
          type: 'success',
          text: `Subkategori "${deleteConfirm.item.namaSubkategori}" berhasil dihapus.`,
        });
      } else {
        const res = await deleteDokumenFileRecord(deleteConfirm.item.id, activePin, webAppUrl);
        if (!res.ok) {
          setNotice({ type: 'error', text: res.error || 'Gagal menghapus dokumen.' });
          return;
        }
        onDeleteFile(deleteConfirm.item.id);
        setNotice({
          type: 'success',
          text: `Dokumen "${deleteConfirm.item.judulDokumen}" berhasil dihapus.`,
        });
      }
      setDeleteConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  // ---- REUSABLE DOCUMENT LIST RENDERER ----
  const renderDocumentList = (items: DokumenFileItem[]) => {
    if (items.length === 0) {
      return (
        <div className="px-4 py-4 text-xs text-[#526A70] dark:text-[#8DA8B0]">
          Belum ada dokumen di bagian ini.
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="duwd-zebra-table w-full min-w-[600px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[#07525E]/10 text-[11px] font-bold uppercase tracking-wider text-[#4A646B] dark:border-[#3EC1D3]/15 dark:text-[#8DA8B0]">
              <th className="w-10 px-3 py-2 text-center">No</th>
              <th className="px-3 py-2">Dokumen</th>
              <th className="w-28 px-3 py-2">Update</th>
              {isAdminOrSuperAdmin && (
                <th className="w-36 px-3 py-2 text-center">Dilihat / Unduh</th>
              )}
              <th className="w-48 px-3 py-2 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const isLink = isLinkDocument(item);
              const sizeLabel = formatFileSize(item.ukuranBytes);
              const extLabel = isLink ? 'LINK' : (item.ekstensi || 'FILE').toUpperCase();
              const hasPreview = !isLink && Boolean(getPreviewIframeUrl(item));
              const hasDownloadableFile =
                !isLink || Boolean(item.driveFileId || extractDriveFileIdFromUrl(item.driveFileUrl));

              return (
                <tr
                  key={item.id}
                  className="border-b border-[#07525E]/8 last:border-b-0 dark:border-[#3EC1D3]/10"
                >
                  <td className="px-3 py-2.5 text-center font-mono text-[11px] font-semibold text-[#526A70] tabular-nums dark:text-[#8DA8B0]">
                    {idx + 1}
                  </td>
                  <td className="min-w-0 px-3 py-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5 shrink-0">{renderFileIcon(item)}</div>
                      <div className="min-w-0 flex-1">
                        {isLink ? (
                          <a
                            href={item.driveFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => triggerTrackStat(item, 'view')}
                            className="inline-flex items-center gap-1 font-semibold text-[#07525E] break-words hover:text-[#0C7A89] hover:underline dark:text-[#E6F4F7] dark:hover:text-[#3EC1D3]"
                          >
                            <span>{item.judulDokumen}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-75" />
                          </a>
                        ) : (
                          <div className="font-semibold text-[#0F2429] break-words dark:text-[#E6F4F7]">
                            {item.judulDokumen}
                          </div>
                        )}
                        <div className="mt-0.5 text-[11px] text-[#526A70] tabular-nums dark:text-[#8DA8B0]">
                          <span className="font-bold text-[#0C7A89] dark:text-[#3EC1D3]">
                            {extLabel}
                          </span>
                          {sizeLabel ? ` · ${sizeLabel}` : ''}
                          {item.keterangan ? ` · ${item.keterangan}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-[#3D575E] tabular-nums dark:text-[#A9C2C9]">
                    {formatDateId(item.tanggalUpdate)}
                  </td>

                  {/* Statistik Dilihat & Diunduh — KHUSUS Admin & Super Admin */}
                  {isAdminOrSuperAdmin && (
                    <td className="px-3 py-2.5 text-center font-mono text-[11px] tabular-nums">
                      <span
                        title="Jumlah kali dilihat"
                        className="inline-flex items-center gap-1 font-semibold text-[#07525E] dark:text-[#E6F4F7]"
                      >
                        <Eye className="h-3 w-3 text-[#0C7A89] dark:text-[#3EC1D3]" />
                        {item.jumlahDilihat || 0}
                      </span>
                      <span className="mx-1.5 text-[#9BB5BC]">·</span>
                      <span
                        title="Jumlah kali diunduh"
                        className="inline-flex items-center gap-1 font-semibold text-[#07525E] dark:text-[#E6F4F7]"
                      >
                        <Download className="h-3 w-3 text-[#D88B15] dark:text-[#F0B243]" />
                        {item.jumlahDiunduh || 0}
                      </span>
                    </td>
                  )}

                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Tombol LIHAT (atau buka tab baru langsung jika Input Link) */}
                      {isLink ? (
                        <a
                          href={item.driveFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => triggerTrackStat(item, 'view')}
                          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-[#0C7A89] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#07525E]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>Lihat</span>
                        </a>
                      ) : hasPreview ? (
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(item)}
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-[#0C7A89]/25 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#07525E] transition-colors hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/30 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
                          <span>Lihat</span>
                        </button>
                      ) : (
                        <a
                          href={item.driveFileUrl || DOKUMEN_DRIVE_ROOT_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => triggerTrackStat(item, 'view')}
                          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#0C7A89]/25 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#07525E] transition-colors hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/30 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
                        >
                          <Eye className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
                          <span>Lihat</span>
                        </a>
                      )}

                      {/* Tombol DOWNLOAD */}
                      {hasDownloadableFile && (
                        <a
                          href={getDirectDownloadUrl(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => triggerTrackStat(item, 'download')}
                          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg bg-[#0C7A89] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-[#07525E]"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>Download</span>
                        </a>
                      )}

                      {/* Tombol Edit & Hapus — KHUSUS Super Admin */}
                      {isSuperAdmin && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditFileModal(item)}
                            title="Edit dokumen"
                            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#07525E]/15 bg-white/90 text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#3EC1D3] dark:hover:bg-[#13424F]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ kind: 'file', item })}
                            title="Hapus dokumen"
                            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-rose-500/20 bg-rose-50/80 text-rose-600 hover:bg-rose-100 dark:border-rose-400/25 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <section className="duwd-container px-2 py-6 sm:px-4">
      {/* Header Row */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#0C7A89] dark:text-[#3EC1D3]">
            Arsip &amp; Panduan Resmi · DUWD DPP Wahdah Islamiyah
          </div>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-[#07525E] dark:text-[#E6F4F7] sm:text-3xl">
            Pusat Dokumen
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#4A646B] dark:text-[#9BB5BC] sm:text-sm">
            Pilih kategori dan klik subkategori untuk melihat atau mengunduh dokumen resmi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdminOrSuperAdmin && (
            <button
              type="button"
              onClick={() => setShowStatsPanel((prev) => !prev)}
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${
                showStatsPanel
                  ? 'border-[#0C7A89] bg-[#0C7A89] text-white'
                  : 'border-[#07525E]/18 bg-white/85 text-[#07525E] hover:bg-white dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>{showStatsPanel ? 'Kembali ke Daftar' : 'Rekap Statistik'}</span>
            </button>
          )}

          {isSuperAdmin && (
            <a
              href={DOKUMEN_DRIVE_ROOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#07525E]/18 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#07525E] transition-colors hover:bg-white dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
              <span>Google Drive</span>
            </a>
          )}

          <button
            type="button"
            onClick={onRefresh}
            disabled={syncing}
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#07525E]/18 bg-white/85 px-3.5 py-2 text-xs font-semibold text-[#07525E] transition-colors hover:bg-white disabled:opacity-60 dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7] dark:hover:bg-[#13424F]"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3] ${syncing ? 'animate-spin' : ''}`}
            />
            <span>{syncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
          </button>

          {isSuperAdmin && (
            <>
              <button
                type="button"
                onClick={openCreateKategoriModal}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#0C7A89]/35 bg-[#EBF5F8] px-3.5 py-2 text-xs font-semibold text-[#07525E] transition-colors hover:bg-[#DCEFF4] dark:border-[#3EC1D3]/35 dark:bg-[#113540] dark:text-[#E6F4F7] dark:hover:bg-[#174654]"
              >
                <FolderPlus className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
                <span>Tambah Kategori</span>
              </button>

              <button
                type="button"
                onClick={() => openAddModal()}
                className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-4 py-2 text-xs font-semibold text-white shadow-sm transition-transform duration-150 hover:-translate-y-0.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Tambah Dokumen</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Inline Feedback Notice */}
      {notice && (
        <div
          className={`mt-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-medium ${
            notice.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-50/90 text-emerald-900 dark:border-emerald-400/25 dark:bg-emerald-950/50 dark:text-emerald-200'
              : 'border-rose-500/30 bg-rose-50/90 text-rose-900 dark:border-rose-400/25 dark:bg-rose-950/50 dark:text-rose-200'
          }`}
        >
          <div className="flex items-start gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            )}
            <span className="break-words">{notice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Tutup pesan"
            className="shrink-0 cursor-pointer opacity-75 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Strip — Ringkas & Informatif (Admin mendapat info Total Dilihat & Diunduh) */}
      <div
        className={`mt-5 grid grid-cols-2 gap-3 ${
          isAdminOrSuperAdmin ? 'lg:grid-cols-4' : 'sm:grid-cols-3'
        }`}
      >
        <div className="glass-surface rounded-2xl p-4">
          <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#8DA8B0]">
            Total Kategori
          </div>
          <div className="mt-1 text-2xl font-extrabold text-[#07525E] tabular-nums dark:text-[#E6F4F7]">
            {overallStats.totalKategori}
          </div>
        </div>

        <div className="glass-surface rounded-2xl p-4">
          <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#8DA8B0]">
            Total Dokumen
          </div>
          <div className="mt-1 text-2xl font-extrabold text-[#0C7A89] tabular-nums dark:text-[#3EC1D3]">
            {overallStats.totalDokumen}
          </div>
        </div>

        {isAdminOrSuperAdmin ? (
          <>
            <div className="glass-surface rounded-2xl p-4">
              <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#8DA8B0]">
                Total Dilihat (Admin)
              </div>
              <div className="mt-1 text-2xl font-extrabold text-[#07525E] tabular-nums dark:text-[#E6F4F7]">
                {overallStats.totalViews.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="glass-surface rounded-2xl p-4">
              <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#8DA8B0]">
                Total Diunduh (Admin)
              </div>
              <div className="mt-1 text-2xl font-extrabold text-[#D88B15] tabular-nums dark:text-[#F0B243]">
                {overallStats.totalDownloads.toLocaleString('id-ID')}
              </div>
            </div>
          </>
        ) : (
          <div className="glass-surface col-span-2 rounded-2xl p-4 sm:col-span-1">
            <div className="text-[11px] font-semibold text-[#526A70] dark:text-[#8DA8B0]">
              Pembaruan Terakhir
            </div>
            <div className="mt-1 text-lg font-extrabold text-[#D88B15] tabular-nums dark:text-[#F0B243] sm:text-xl">
              {formatDateId(overallStats.latestDate)}
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter Bar */}
      <div className="glass-surface mt-5 rounded-2xl p-3.5 sm:p-4">
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
          <div className="relative md:col-span-8">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#526A70] dark:text-[#8DA8B0]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kategori, subkategori, atau nama dokumen..."
              className="w-full rounded-xl border border-[#07525E]/15 bg-white/90 py-2.5 pr-9 pl-10 text-xs font-medium text-[#0F2429] placeholder:text-[#6B848A] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/20 dark:bg-[#0A2027] dark:text-[#E6F4F7] dark:placeholder:text-[#6C8A93]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                className="absolute top-1/2 right-2.5 -translate-y-1/2 cursor-pointer rounded-md p-1 text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#8DA8B0] dark:hover:bg-[#13424F]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-4">
            <select
              aria-label="Filter kategori"
              value={selectedKategoriFilter}
              onChange={(e) => setSelectedKategoriFilter(e.target.value)}
              className="w-full cursor-pointer rounded-xl border border-[#07525E]/15 bg-white/90 px-3 py-2.5 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/20 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
            >
              <option value="semua">Semua Kategori ({sortedKategori.length})</option>
              {sortedKategori.map((kat) => (
                <option key={kat.id} value={kat.id}>
                  {kat.namaKategori}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* PANEL REKAP STATISTIK — KHUSUS ADMIN & SUPER ADMIN                  */}
      {/* =================================================================== */}
      {isAdminOrSuperAdmin && showStatsPanel ? (
        <div className="glass-surface mt-5 overflow-hidden rounded-2xl">
          <div className="flex flex-col gap-3 border-b border-[#07525E]/10 bg-white/55 px-4 py-3.5 dark:border-[#3EC1D3]/12 dark:bg-[#0C2730]/65 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-extrabold text-[#07525E] dark:text-[#E6F4F7] sm:text-base">
                Rekap Statistik Lihat &amp; Download Dokumen
              </h2>
              <p className="text-xs text-[#526A70] dark:text-[#8DA8B0]">
                Khusus pengelola — pantau dokumen yang paling sering dilihat dan diunduh.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-[#526A70] dark:text-[#8DA8B0]">
                Urutkan:
              </span>
              <select
                value={statsSortBy}
                onChange={(e) => setStatsSortBy(e.target.value as StatsSortBy)}
                className="cursor-pointer rounded-xl border border-[#07525E]/18 bg-white px-3 py-1.5 text-xs font-semibold text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
              >
                <option value="views">Paling Banyak Dilihat</option>
                <option value="downloads">Paling Banyak Diunduh</option>
                <option value="recent">Update Terbaru</option>
              </select>
            </div>
          </div>

          {sortedStatsFiles.length === 0 ? (
            <div className="px-6 py-10 text-center text-xs text-[#526A70] dark:text-[#8DA8B0]">
              Belum ada dokumen yang tercatat.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="duwd-zebra-table w-full min-w-[680px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#07525E]/12 text-[11px] font-bold uppercase tracking-wider text-[#4A646B] dark:border-[#3EC1D3]/15 dark:text-[#8DA8B0]">
                    <th className="w-11 px-3 py-2.5 text-center">No</th>
                    <th className="px-3 py-2.5">Nama Dokumen</th>
                    <th className="w-56 px-3 py-2.5">Kategori / Subkategori</th>
                    <th className="w-28 px-3 py-2.5 text-right">Dilihat</th>
                    <th className="w-28 px-3 py-2.5 text-right">Diunduh</th>
                    <th className="w-28 px-3 py-2.5 text-right">Update</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedStatsFiles.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="border-b border-[#07525E]/8 last:border-b-0 dark:border-[#3EC1D3]/10"
                    >
                      <td className="px-3 py-2.5 text-center font-mono text-[11px] font-semibold text-[#526A70] tabular-nums dark:text-[#8DA8B0]">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {renderFileIcon(item)}
                          <span className="font-semibold text-[#0F2429] break-words dark:text-[#E6F4F7]">
                            {item.judulDokumen}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-[#3D575E] break-words dark:text-[#A9C2C9]">
                        <span className="font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                          {item.namaKategori}
                        </span>
                        {item.subfolder ? ` · ${item.subfolder}` : ''}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-[#0C7A89] tabular-nums dark:text-[#3EC1D3]">
                        {(item.jumlahDilihat || 0).toLocaleString('id-ID')}x
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-xs font-bold text-[#D88B15] tabular-nums dark:text-[#F0B243]">
                        {(item.jumlahDiunduh || 0).toLocaleString('id-ID')}x
                      </td>
                      <td className="px-3 py-2.5 text-right text-[11px] text-[#526A70] tabular-nums dark:text-[#8DA8B0]">
                        {formatDateId(item.tanggalUpdate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* ================================================================= */
        /* DAFTAR KATEGORI & SUBKATEGORI (RINGKAS — KLIK MUNCUL DI BAWAHNYA) */
        /* ================================================================= */
        <div className="mt-5 space-y-4">
          {sortedKategori.length === 0 ? (
            <div className="glass-surface rounded-3xl px-6 py-12 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#EBF5F8] text-[#0C7A89] dark:bg-[#113540] dark:text-[#3EC1D3]">
                <FolderOpen className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-base font-bold text-[#07525E] dark:text-[#E6F4F7]">
                Belum Ada Kategori Dokumen
              </h2>
              <p className="mx-auto mt-1.5 max-w-lg text-xs leading-relaxed text-[#526A70] dark:text-[#8DA8B0]">
                Mulai dengan membuat kategori terlebih dahulu. Setelah kategori dibuat, Anda dapat
                menambahkan subkategori, mengunggah file langsung, atau memasukkan link dokumen.
              </p>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={openCreateKategoriModal}
                  className="mt-5 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2.5 text-xs font-semibold text-white shadow-sm"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>Tambah Kategori Pertama</span>
                </button>
              )}
            </div>
          ) : categoryTree.length === 0 ? (
            <div className="glass-surface rounded-2xl px-6 py-10 text-center">
              <p className="text-sm font-bold text-[#07525E] dark:text-[#E6F4F7]">
                Tidak ada dokumen yang cocok dengan pencarian
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedKategoriFilter('semua');
                }}
                className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-[#07525E]/20 bg-white px-4 py-2 text-xs font-semibold text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
              >
                Tampilkan Semua
              </button>
            </div>
          ) : (
            categoryTree.map((entry) => {
              const {
                kategori,
                totalDocsInKat,
                totalSubcategories,
                directFiles,
                subcategories,
                latestCatUpdate,
              } = entry;

              const sortedIdx = sortedKategori.findIndex((k) => k.id === kategori.id);
              const canMoveUp = sortedIdx > 0;
              const canMoveDown = sortedIdx >= 0 && sortedIdx < sortedKategori.length - 1;
              const hasDirectFiles = directFiles.length > 0;
              const hasSubcategories = subcategories.length > 0;
              const directExpanded = isSearchActive || Boolean(expandedDirectKatIds[kategori.id]);

              return (
                <div
                  key={kategori.id}
                  className="glass-surface overflow-hidden rounded-2xl"
                >
                  {/* Header Kategori (Tanpa Indeks Huruf A/B/C) */}
                  <div className="flex flex-col gap-3 border-b border-[#07525E]/10 bg-white/60 px-4 py-3.5 dark:border-[#3EC1D3]/12 dark:bg-[#0C2730]/70 sm:flex-row sm:items-center sm:justify-between">
                    <div
                      onClick={() => {
                        if (hasDirectFiles && !hasSubcategories) {
                          setExpandedDirectKatIds((prev) => ({
                            ...prev,
                            [kategori.id]: !prev[kategori.id],
                          }));
                        }
                      }}
                      className={`flex min-w-0 flex-1 items-start gap-3 ${
                        hasDirectFiles && !hasSubcategories ? 'cursor-pointer' : ''
                      }`}
                    >
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EBF5F8] text-[#0C7A89] dark:bg-[#113540] dark:text-[#3EC1D3]">
                        <FolderOpen className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-sm font-extrabold text-[#07525E] break-words dark:text-[#E6F4F7] sm:text-base">
                            {kategori.namaKategori}
                          </h2>
                          {hasDirectFiles && !hasSubcategories && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#0C7A89] dark:text-[#3EC1D3]">
                              {directExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </span>
                          )}
                        </div>
                        {kategori.deskripsi && (
                          <p className="mt-0.5 text-xs text-[#4A646B] break-words dark:text-[#9BB5BC]">
                            {kategori.deskripsi}
                          </p>
                        )}
                        <div className="mt-1 text-[11px] font-semibold text-[#526A70] tabular-nums dark:text-[#8DA8B0]">
                          <span className="font-bold text-[#07525E] dark:text-[#3EC1D3]">
                            {totalDocsInKat} Dokumen
                          </span>
                          {totalSubcategories > 0 ? ` · ${totalSubcategories} Subkategori` : ''}
                          {latestCatUpdate ? ` · Diperbarui ${formatDateId(latestCatUpdate)}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* Aksi Kategori (Super Admin: Urutkan ↑↓, + Tambah, Edit, Hapus) */}
                    <div className="flex flex-wrap items-center gap-1.5 sm:shrink-0">
                      {hasDirectFiles && !hasSubcategories && (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDirectKatIds((prev) => ({
                              ...prev,
                              [kategori.id]: !prev[kategori.id],
                            }))
                          }
                          className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-[#0C7A89]/25 bg-white/90 px-2.5 py-1.5 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/30 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                        >
                          <span>{directExpanded ? 'Tutup Daftar' : 'Lihat Dokumen'}</span>
                          {directExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                      )}

                      {isSuperAdmin && (
                        <>
                          <div className="inline-flex items-center overflow-hidden rounded-lg border border-[#07525E]/15 bg-white/85 dark:border-[#3EC1D3]/20 dark:bg-[#0D2B33]">
                            <button
                              type="button"
                              disabled={!canMoveUp || reordering}
                              onClick={() => handleMoveKategori(kategori.id, 'up')}
                              title="Geser kategori ke atas"
                              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center text-[#07525E] hover:bg-[#EBF5F8] disabled:cursor-not-allowed disabled:opacity-35 dark:text-[#3EC1D3] dark:hover:bg-[#13424F]"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              disabled={!canMoveDown || reordering}
                              onClick={() => handleMoveKategori(kategori.id, 'down')}
                              title="Geser kategori ke bawah"
                              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center border-l border-[#07525E]/12 text-[#07525E] hover:bg-[#EBF5F8] disabled:cursor-not-allowed disabled:opacity-35 dark:border-[#3EC1D3]/15 dark:text-[#3EC1D3] dark:hover:bg-[#13424F]"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => openAddModal(kategori.id, 'file')}
                            className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg bg-[#0C7A89] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#07525E]"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Tambah</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditKategoriModal(kategori)}
                            title="Edit kategori & urutan"
                            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#07525E]/15 bg-white/85 text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/20 dark:bg-[#0D2B33] dark:text-[#3EC1D3] dark:hover:bg-[#13424F]"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({
                                kind: 'kategori',
                                item: kategori,
                                docCount: totalDocsInKat,
                              })
                            }
                            title="Hapus kategori"
                            className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-rose-500/20 bg-rose-50/80 text-rose-600 hover:bg-rose-100 dark:border-rose-400/25 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/70"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Isi Kategori: Daftar Subkategori (Collapsed by default) & Dokumen Langsung */}
                  <div className="divide-y divide-[#07525E]/10 dark:divide-[#3EC1D3]/12">
                    {/* Daftar Subkategori: Klik untuk memunculkan dokumen di bawahnya */}
                    {subcategories.map((sub) => {
                      const isOpen = isSearchActive || Boolean(expandedSubKeys[sub.key]);
                      return (
                        <div key={sub.key} className="bg-white/40 dark:bg-[#092028]/45">
                          <div className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-[#F2F8FA]/80 dark:hover:bg-[#0E2D37]/70 sm:flex-row sm:items-center sm:justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSubKeys((prev) => ({
                                  ...prev,
                                  [sub.key]: !prev[sub.key],
                                }))
                              }
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 text-left"
                            >
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4 shrink-0 text-[#0C7A89] dark:text-[#3EC1D3]" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 text-[#526A70] dark:text-[#8DA8B0]" />
                              )}
                              {isOpen ? (
                                <FolderOpen className="h-4 w-4 shrink-0 text-[#D88B15] dark:text-[#F0B243]" />
                              ) : (
                                <Folder className="h-4 w-4 shrink-0 text-[#D88B15] dark:text-[#F0B243]" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-bold text-[#07525E] break-words dark:text-[#E6F4F7] sm:text-[13px]">
                                  {sub.name}
                                </div>
                                <div className="text-[11px] text-[#526A70] tabular-nums dark:text-[#8DA8B0]">
                                  {sub.totalCount} dokumen
                                  {sub.latestUpdate
                                    ? ` · Diperbarui ${formatDateId(sub.latestUpdate)}`
                                    : ''}
                                </div>
                              </div>
                            </button>

                            {isSuperAdmin && (
                              <div className="flex items-center gap-1.5 pl-6 sm:shrink-0 sm:pl-0">
                                <button
                                  type="button"
                                  onClick={() => openAddModal(kategori.id, 'file', sub.name)}
                                  className="inline-flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap rounded-lg border border-[#0C7A89]/30 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/30 dark:bg-[#0D2B33] dark:text-[#3EC1D3]"
                                >
                                  <Plus className="h-3 w-3" />
                                  <span>File / Link</span>
                                </button>
                                {sub.record && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => openEditSubkategoriModal(sub.record!)}
                                      title="Edit subkategori"
                                      className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-[#07525E]/15 bg-white/90 text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/20 dark:bg-[#0D2B33] dark:text-[#3EC1D3]"
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDeleteConfirm({
                                          kind: 'subkategori',
                                          item: sub.record!,
                                          docCount: sub.totalCount,
                                        })
                                      }
                                      title="Hapus subkategori"
                                      className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-rose-500/20 bg-rose-50/80 text-rose-600 hover:bg-rose-100 dark:border-rose-400/25 dark:bg-rose-950/40 dark:text-rose-300"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Daftar Dokumen muncul tepat di bawah subkategori saat diklik */}
                          {isOpen && (
                            <div className="border-t border-[#07525E]/10 bg-white/80 dark:border-[#3EC1D3]/12 dark:bg-[#0A222A]/85">
                              {renderDocumentList(sub.filteredItems)}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Dokumen Langsung (tanpa subkategori) */}
                    {hasDirectFiles && hasSubcategories && (
                      <div className="bg-white/40 dark:bg-[#092028]/45">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedDirectKatIds((prev) => ({
                              ...prev,
                              [kategori.id]: !prev[kategori.id],
                            }))
                          }
                          className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-[#F2F8FA]/80 dark:hover:bg-[#0E2D37]/70"
                        >
                          {directExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-[#0C7A89] dark:text-[#3EC1D3]" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-[#526A70] dark:text-[#8DA8B0]" />
                          )}
                          <FileText className="h-4 w-4 shrink-0 text-[#0C7A89] dark:text-[#3EC1D3]" />
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-[#07525E] dark:text-[#E6F4F7] sm:text-[13px]">
                              Dokumen Utama
                            </div>
                            <div className="text-[11px] text-[#526A70] tabular-nums dark:text-[#8DA8B0]">
                              {directFiles.length} dokumen langsung di kategori ini
                            </div>
                          </div>
                        </button>
                        {directExpanded && (
                          <div className="border-t border-[#07525E]/10 bg-white/80 dark:border-[#3EC1D3]/12 dark:bg-[#0A222A]/85">
                            {renderDocumentList(directFiles)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Jika Kategori HANYA punya dokumen langsung (tanpa subkategori), tampil saat kategori diklik */}
                    {hasDirectFiles && !hasSubcategories && directExpanded && (
                      <div className="bg-white/80 dark:bg-[#0A222A]/85">
                        {renderDocumentList(directFiles)}
                      </div>
                    )}

                    {/* Jika Kategori benar-benar kosong */}
                    {!hasSubcategories && !hasDirectFiles && (
                      <div className="flex flex-col items-start justify-between gap-2 px-4 py-3 text-xs text-[#526A70] dark:text-[#8DA8B0] sm:flex-row sm:items-center">
                        <span>Belum ada subkategori atau dokumen di kategori ini.</span>
                        {isSuperAdmin && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openAddModal(kategori.id, 'subkategori')}
                              className="cursor-pointer rounded-lg border border-[#07525E]/18 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                            >
                              + Subkategori
                            </button>
                            <button
                              type="button"
                              onClick={() => openAddModal(kategori.id, 'file')}
                              className="cursor-pointer rounded-lg border border-[#07525E]/18 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                            >
                              + File Langsung
                            </button>
                            <button
                              type="button"
                              onClick={() => openAddModal(kategori.id, 'link')}
                              className="cursor-pointer rounded-lg border border-[#07525E]/18 bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                            >
                              + Input Link
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 1: TAMBAH / EDIT KATEGORI                                     */}
      {/* =================================================================== */}
      {kategoriModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingKategori ? 'Edit Kategori' : 'Tambah Kategori'}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181E]/55 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-[#07525E]/10 pb-3.5 dark:border-[#3EC1D3]/15">
              <div>
                <h2 className="text-base font-extrabold text-[#07525E] dark:text-[#E6F4F7]">
                  {editingKategori ? 'Edit Kategori Dokumen' : 'Tambah Kategori Baru'}
                </h2>
                <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#8DA8B0]">
                  Folder kategori otomatis dibuat dan dirapikan di Google Drive.
                </p>
              </div>
              <button
                type="button"
                disabled={katSaving}
                onClick={() => setKategoriModalOpen(false)}
                aria-label="Tutup"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC] dark:hover:bg-[#13424F]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitKategori} className="mt-4 space-y-4">
              {katError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/60 dark:text-rose-200">
                  {katError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  Nama Kategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={katNama}
                  onChange={(e) => setKatNama(e.target.value)}
                  placeholder="Contoh: Hasil Muktamar V, Panduan 4M, Buku Pintar Dai Utusan"
                  className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  Deskripsi Singkat (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={katDeskripsi}
                  onChange={(e) => setKatDeskripsi(e.target.value)}
                  placeholder="Keterangan singkat kategori dokumen..."
                  className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2 text-xs font-medium text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  Tanggal Update
                </label>
                <input
                  type="date"
                  value={katTanggalUpdate}
                  onChange={(e) => setKatTanggalUpdate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                />
              </div>

              {/* Atur Posisi / Urutan Kategori dengan Seret atau Panah Atas-Bawah */}
              {katDraftOrderIds.length > 1 && (
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                      Urutan Tampilan Kategori
                    </label>
                    <span className="text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                      Seret atau tekan panah ↑ ↓
                    </span>
                  </div>

                  <div className="mt-1.5 max-h-56 space-y-1.5 overflow-y-auto rounded-2xl border border-[#07525E]/15 bg-[#F4F9FA]/80 p-2 dark:border-[#3EC1D3]/20 dark:bg-[#081D24]/80">
                    {katDraftOrderIds.map((itemId, idx) => {
                      const isCurrent =
                        itemId === (editingKategori?.id || NEW_KATEGORI_DRAFT_ID);
                      const existingItem = sortedKategori.find((k) => k.id === itemId);
                      const displayName = isCurrent
                        ? katNama.trim() ||
                          existingItem?.namaKategori ||
                          'Kategori Baru (isi nama di atas)'
                        : existingItem?.namaKategori || 'Kategori';
                      const isDragging = katDraggingId === itemId;

                      return (
                        <div
                          key={itemId}
                          draggable={!katSaving}
                          onDragStart={() => setKatDraggingId(itemId)}
                          onDragOver={(ev) => {
                            ev.preventDefault();
                            if (katDraggingId && katDraggingId !== itemId) {
                              reorderDraftKategoriByDrop(katDraggingId, itemId);
                            }
                          }}
                          onDragEnd={() => setKatDraggingId(null)}
                          className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs transition-colors ${
                            isCurrent
                              ? 'border-[#0C7A89] bg-[#EBF5F8] font-bold text-[#07525E] dark:border-[#3EC1D3] dark:bg-[#13424F] dark:text-[#E6F4F7]'
                              : 'border-[#07525E]/12 bg-white/90 font-medium text-[#355158] dark:border-[#3EC1D3]/15 dark:bg-[#0D2B33] dark:text-[#B5CDD2]'
                          } ${isDragging ? 'opacity-60' : 'cursor-grab active:cursor-grabbing'}`}
                        >
                          <GripVertical className="h-4 w-4 shrink-0 text-[#6B848A] dark:text-[#7DA0AA]" />
                          <span className="min-w-0 flex-1 truncate">
                            {displayName}
                          </span>
                          {isCurrent && (
                            <span className="shrink-0 text-[10px] font-bold text-[#0C7A89] dark:text-[#3EC1D3]">
                              Sedang diatur
                            </span>
                          )}
                          <div className="inline-flex shrink-0 items-center overflow-hidden rounded-lg border border-[#07525E]/15 bg-white dark:border-[#3EC1D3]/20 dark:bg-[#0A222A]">
                            <button
                              type="button"
                              disabled={idx === 0 || katSaving}
                              onClick={() => moveDraftKategoriByStep(itemId, 'up')}
                              aria-label="Geser ke atas"
                              title="Geser ke atas"
                              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center text-[#07525E] hover:bg-[#EBF5F8] disabled:cursor-not-allowed disabled:opacity-30 dark:text-[#3EC1D3] dark:hover:bg-[#13424F]"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === katDraftOrderIds.length - 1 || katSaving}
                              onClick={() => moveDraftKategoriByStep(itemId, 'down')}
                              aria-label="Geser ke bawah"
                              title="Geser ke bawah"
                              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center border-l border-[#07525E]/12 text-[#07525E] hover:bg-[#EBF5F8] disabled:cursor-not-allowed disabled:opacity-30 dark:border-[#3EC1D3]/15 dark:text-[#3EC1D3] dark:hover:bg-[#13424F]"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
                <button
                  type="button"
                  disabled={katSaving}
                  onClick={() => setKategoriModalOpen(false)}
                  className="cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-4 py-2 text-xs font-semibold text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={katSaving}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  {katSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{katSaving ? 'Menyimpan...' : 'Simpan Kategori'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: TAMBAH DOKUMEN (PILIH KATEGORI DULU -> 3 OPSI JELAS)       */}
      {/* =================================================================== */}
      {addModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tambah Dokumen atau Subkategori"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181E]/55 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-[#07525E]/10 pb-3.5 dark:border-[#3EC1D3]/15">
              <div>
                <h2 className="text-base font-extrabold text-[#07525E] dark:text-[#E6F4F7]">
                  Tambah Isi Dokumen
                </h2>
                <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#8DA8B0]">
                  Pilih kategori terlebih dahulu, lalu pilih tambah subkategori, unggah file, atau input link.
                </p>
              </div>
              <button
                type="button"
                disabled={addSaving}
                onClick={() => setAddModalOpen(false)}
                aria-label="Tutup"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC] dark:hover:bg-[#13424F]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdd} className="mt-4 space-y-4">
              {addError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/60 dark:text-rose-200">
                  {addError}
                </div>
              )}

              {/* LANGKAH 1: WAJIB PILIH KATEGORI DULU */}
              <div>
                <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  1. Pilih Kategori <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  disabled={addSaving}
                  value={addKategoriId}
                  onChange={(e) => {
                    setAddKategoriId(e.target.value);
                    setAddTargetSubkategori('');
                  }}
                  className="mt-1.5 w-full cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                >
                  {sortedKategori.map((kat) => (
                    <option key={kat.id} value={kat.id}>
                      {kat.namaKategori}
                    </option>
                  ))}
                </select>
              </div>

              {/* LANGKAH 2: PILIH OPSI (SUBKATEGORI / FILE LANGSUNG / INPUT LINK) */}
              <div>
                <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  2. Pilih Jenis Penambahan
                </label>
                <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={addSaving}
                    onClick={() => {
                      setAddMode('subkategori');
                      setAddError('');
                    }}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                      addMode === 'subkategori'
                        ? 'border-[#0C7A89] bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3] dark:bg-[#13424F] dark:text-[#E6F4F7]'
                        : 'border-[#07525E]/15 bg-white/80 text-[#4A646B] hover:bg-[#F5FAFB] dark:border-[#3EC1D3]/20 dark:bg-[#0B222A] dark:text-[#9BB5BC]'
                    }`}
                  >
                    <FolderPlus className="h-4 w-4 shrink-0 text-[#D88B15] dark:text-[#F0B243]" />
                    <div className="min-w-0">
                      <div>Tambah Subkategori</div>
                      <div className="text-[10px] font-normal opacity-80">Folder di dalam kategori</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={addSaving}
                    onClick={() => {
                      setAddMode('file');
                      setAddError('');
                    }}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                      addMode === 'file'
                        ? 'border-[#0C7A89] bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3] dark:bg-[#13424F] dark:text-[#E6F4F7]'
                        : 'border-[#07525E]/15 bg-white/80 text-[#4A646B] hover:bg-[#F5FAFB] dark:border-[#3EC1D3]/20 dark:bg-[#0B222A] dark:text-[#9BB5BC]'
                    }`}
                  >
                    <Upload className="h-4 w-4 shrink-0 text-[#0C7A89] dark:text-[#3EC1D3]" />
                    <div className="min-w-0">
                      <div>Unggah File / ZIP</div>
                      <div className="text-[10px] font-normal opacity-80">Simpan ke Google Drive</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={addSaving}
                    onClick={() => {
                      setAddMode('link');
                      setAddError('');
                    }}
                    className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                      addMode === 'link'
                        ? 'border-[#0C7A89] bg-[#EBF5F8] text-[#07525E] dark:border-[#3EC1D3] dark:bg-[#13424F] dark:text-[#E6F4F7]'
                        : 'border-[#07525E]/15 bg-white/80 text-[#4A646B] hover:bg-[#F5FAFB] dark:border-[#3EC1D3]/20 dark:bg-[#0B222A] dark:text-[#9BB5BC]'
                    }`}
                  >
                    <Link2 className="h-4 w-4 shrink-0 text-[#0C7A89] dark:text-[#3EC1D3]" />
                    <div className="min-w-0">
                      <div>Input Link Saja</div>
                      <div className="text-[10px] font-normal opacity-80">Buka tab baru langsung</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* FORM KHUSUS OPSI 1: TAMBAH SUBKATEGORI */}
              {addMode === 'subkategori' && (
                <div className="space-y-3 rounded-2xl border border-[#07525E]/12 bg-white/65 p-4 dark:border-[#3EC1D3]/18 dark:bg-[#0B222A]/65">
                  <div>
                    <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                      Nama Subkategori <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={addSubkategoriNama}
                      onChange={(e) => setAddSubkategoriNama(e.target.value)}
                      placeholder="Contoh: Muswil, Mukerwil, Musda, Mukerda"
                      className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                    />
                  </div>
                  <div className="text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                    Opsional: Anda bisa langsung menyeret file atau arsip ZIP di bawah ini untuk langsung mengisi subkategori, atau biarkan kosong untuk membuat subkategorinya saja dulu.
                  </div>
                </div>
              )}

              {/* PENEMPATAN SUBKATEGORI UNTUK OPSI FILE / LINK */}
              {addMode !== 'subkategori' && subkategoriOptionsForAdd.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Penempatan di dalam Kategori
                  </label>
                  <select
                    value={addTargetSubkategori}
                    onChange={(e) => setAddTargetSubkategori(e.target.value)}
                    className="mt-1.5 w-full cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                  >
                    <option value="">Langsung di bawah Kategori (tanpa subkategori)</option>
                    {subkategoriOptionsForAdd.map((subName) => (
                      <option key={subName} value={subName}>
                        Masuk ke Subkategori: {subName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* AREA DRAG & DROP FILE (UNTUK OPSI FILE & OPSIONAL DI SUBKATEGORI) */}
              {(addMode === 'file' || addMode === 'subkategori') && (
                <>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={handleDropZone}
                    onClick={() => fileInputRef.current?.click()}
                    className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${
                      dragActive
                        ? 'border-[#0C7A89] bg-[#EBF5F8] dark:border-[#3EC1D3] dark:bg-[#13424F]/60'
                        : 'border-[#07525E]/25 bg-white/60 hover:border-[#0C7A89] hover:bg-[#F5FAFB] dark:border-[#3EC1D3]/25 dark:bg-[#0A2027]/60 dark:hover:bg-[#0E2C36]'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files) {
                          appendFilesToQueue(e.target.files);
                          e.target.value = '';
                        }
                      }}
                    />
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EBF5F8] text-[#0C7A89] dark:bg-[#113540] dark:text-[#3EC1D3]">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="mt-2 text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                      {addMode === 'subkategori'
                        ? 'Opsional: Seret file / ZIP ke sini untuk langsung mengisi subkategori'
                        : 'Seret & lepaskan file di sini, atau klik untuk memilih berkas'}
                    </div>
                    <div className="mt-1 text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                      Mendukung PDF, Excel, Word, PPT, Gambar, dan ZIP (maks 25 MB/file)
                    </div>
                  </div>

                  {hasZipInQueue && (
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-[#0C7A89]/25 bg-[#EBF5F8]/70 p-3 text-xs dark:border-[#3EC1D3]/25 dark:bg-[#113540]/60">
                      <input
                        type="checkbox"
                        checked={extractZip}
                        onChange={(e) => setExtractZip(e.target.checked)}
                        className="mt-0.5 h-4 w-4 accent-[#0C7A89]"
                      />
                      <div>
                        <div className="font-bold text-[#07525E] dark:text-[#E6F4F7]">
                          Ekstrak otomatis isi file ZIP ke folder Google Drive
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#456168] dark:text-[#9BB5BC]">
                          Seluruh berkas di dalam arsip ZIP akan diekstrak dan dinamai ulang secara rapi.
                        </div>
                      </div>
                    </label>
                  )}

                  {uploadQueue.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                        <span>File Siap Diunggah ({uploadQueue.length})</span>
                        <button
                          type="button"
                          onClick={() => setUploadQueue([])}
                          className="cursor-pointer text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
                        >
                          Kosongkan
                        </button>
                      </div>
                      <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                        {uploadQueue.map((entry) => (
                          <div
                            key={entry.localId}
                            className="flex items-center gap-2 rounded-xl border border-[#07525E]/12 bg-white/90 p-2 dark:border-[#3EC1D3]/18 dark:bg-[#0C252E]"
                          >
                            <div className="min-w-0 flex-1">
                              <input
                                type="text"
                                value={entry.judulDokumen}
                                onChange={(e) =>
                                  setUploadQueue((prev) =>
                                    prev.map((q) =>
                                      q.localId === entry.localId
                                        ? { ...q, judulDokumen: e.target.value }
                                        : q,
                                    ),
                                  )
                                }
                                placeholder="Judul dokumen"
                                className="w-full rounded-lg border border-[#07525E]/15 bg-white px-2.5 py-1 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/20 dark:bg-[#091D23] dark:text-[#E6F4F7]"
                              />
                              <div className="mt-0.5 truncate text-[10px] text-[#526A70] dark:text-[#8DA8B0]">
                                {entry.file.name} · {entry.ext.toUpperCase()} ·{' '}
                                {formatFileSize(entry.file.size)}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={addSaving}
                              onClick={() =>
                                setUploadQueue((prev) =>
                                  prev.filter((q) => q.localId !== entry.localId),
                                )
                              }
                              aria-label="Hapus dari daftar"
                              className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/50"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* FORM KHUSUS OPSI 3: INPUT LINK SAJA */}
              {addMode === 'link' && (
                <div className="space-y-3 rounded-2xl border border-[#07525E]/12 bg-white/65 p-4 dark:border-[#3EC1D3]/18 dark:bg-[#0B222A]/65">
                  <div>
                    <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                      Judul Dokumen / Tautan <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={linkJudul}
                      onChange={(e) => setLinkJudul(e.target.value)}
                      placeholder="Contoh: Panduan Pengurusan SKKO"
                      className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                      Alamat Link (URL) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="url"
                      required
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      placeholder="https://drive.google.com/... atau https://..."
                      className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                    />
                    <div className="mt-1 text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                      Saat diklik pengguna, link ini akan langsung dibuka di tab baru.
                    </div>
                  </div>
                </div>
              )}

              {/* TANGGAL UPDATE & KETERANGAN */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Tanggal Update
                  </label>
                  <input
                    type="date"
                    value={addTanggalUpdate}
                    onChange={(e) => setAddTanggalUpdate(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Keterangan Singkat (Opsional)
                  </label>
                  <input
                    type="text"
                    value={addKeterangan}
                    onChange={(e) => setAddKeterangan(e.target.value)}
                    placeholder="Contoh: Edisi revisi 2027"
                    className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                  />
                </div>
              </div>

              {addSaving && addProgress && (
                <div className="flex items-center gap-2.5 rounded-xl border border-[#0C7A89]/25 bg-[#EBF5F8] px-3.5 py-2.5 text-xs font-semibold text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#113540] dark:text-[#E6F4F7]">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0C7A89] dark:text-[#3EC1D3]" />
                  <span className="break-words">{addProgress}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
                <button
                  type="button"
                  disabled={addSaving}
                  onClick={() => setAddModalOpen(false)}
                  className="cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-4 py-2 text-xs font-semibold text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={addSaving}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  {addSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>
                    {addSaving
                      ? 'Menyimpan...'
                      : addMode === 'subkategori'
                        ? 'Simpan Subkategori'
                        : addMode === 'link'
                          ? 'Simpan Link'
                          : `Unggah File${uploadQueue.length > 0 ? ` (${uploadQueue.length})` : ''}`}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: EDIT SUBKATEGORI                                           */}
      {/* =================================================================== */}
      {editingSubkategori && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Subkategori"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181E]/55 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong w-full max-w-md rounded-3xl p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-[#07525E]/10 pb-3 dark:border-[#3EC1D3]/15">
              <div>
                <h2 className="text-base font-extrabold text-[#07525E] dark:text-[#E6F4F7]">
                  Edit Subkategori
                </h2>
                <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#8DA8B0]">
                  Kategori: {editingSubkategori.namaKategori}
                </p>
              </div>
              <button
                type="button"
                disabled={editSubSaving}
                onClick={() => setEditingSubkategori(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditSubkategori} className="mt-4 space-y-4">
              {editSubError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/60 dark:text-rose-200">
                  {editSubError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  Nama Subkategori <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editSubNama}
                  onChange={(e) => setEditSubNama(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Urutan
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={editSubUrutan}
                    onChange={(e) => setEditSubUrutan(Number(e.target.value) || 1)}
                    className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 font-mono text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Tanggal Update
                  </label>
                  <input
                    type="date"
                    value={editSubTanggal}
                    onChange={(e) => setEditSubTanggal(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
                <button
                  type="button"
                  disabled={editSubSaving}
                  onClick={() => setEditingSubkategori(null)}
                  className="cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-4 py-2 text-xs font-semibold text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSubSaving}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  {editSubSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editSubSaving ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 4: EDIT FILE / LINK                                           */}
      {/* =================================================================== */}
      {editingFile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit Dokumen"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181E]/55 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3 border-b border-[#07525E]/10 pb-3.5 dark:border-[#3EC1D3]/15">
              <div>
                <h2 className="text-base font-extrabold text-[#07525E] dark:text-[#E6F4F7]">
                  Edit Dokumen
                </h2>
                <p className="mt-0.5 text-xs text-[#526A70] dark:text-[#8DA8B0]">
                  Perubahan kategori, subkategori, atau judul otomatis disinkronkan dengan Google Drive.
                </p>
              </div>
              <button
                type="button"
                disabled={editFileSaving}
                onClick={() => setEditingFile(null)}
                aria-label="Tutup"
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditFile} className="mt-4 space-y-4">
              {editFileError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800 dark:border-rose-400/30 dark:bg-rose-950/60 dark:text-rose-200">
                  {editFileError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                  Judul Dokumen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editFileJudul}
                  onChange={(e) => setEditFileJudul(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Kategori
                  </label>
                  <select
                    value={editFileKategoriId}
                    onChange={(e) => {
                      setEditFileKategoriId(e.target.value);
                      setEditFileSubfolder('');
                    }}
                    className="mt-1.5 w-full cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-3 py-2.5 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                  >
                    {sortedKategori.map((kat) => (
                      <option key={kat.id} value={kat.id}>
                        {kat.namaKategori}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Subkategori (Opsional)
                  </label>
                  <select
                    value={editFileSubfolder}
                    onChange={(e) => setEditFileSubfolder(e.target.value)}
                    className="mt-1.5 w-full cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-3 py-2.5 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                  >
                    <option value="">Langsung di bawah Kategori</option>
                    {subkategoriOptionsForEdit.map((subName) => (
                      <option key={subName} value={subName}>
                        {subName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Tanggal Update
                  </label>
                  <input
                    type="date"
                    value={editFileTanggal}
                    onChange={(e) => setEditFileTanggal(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-semibold text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Keterangan
                  </label>
                  <input
                    type="text"
                    value={editFileKeterangan}
                    onChange={(e) => setEditFileKeterangan(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                  />
                </div>
              </div>

              {isLinkDocument(editingFile) ? (
                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Alamat Link (URL)
                  </label>
                  <input
                    type="url"
                    required
                    value={editFileUrl}
                    onChange={(e) => setEditFileUrl(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[#07525E]/20 bg-white px-3.5 py-2.5 text-xs font-medium text-[#0F2429] focus:border-[#0C7A89] focus:outline-none dark:border-[#3EC1D3]/25 dark:bg-[#0A2027] dark:text-[#E6F4F7]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-[#07525E] dark:text-[#E6F4F7]">
                    Ganti File Versi Baru (Opsional)
                  </label>
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setEditReplacementDrag(true);
                    }}
                    onDragLeave={() => setEditReplacementDrag(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setEditReplacementDrag(false);
                      if (e.dataTransfer.files?.[0]) {
                        setEditReplacementFile(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => replaceInputRef.current?.click()}
                    className={`mt-1.5 cursor-pointer rounded-xl border border-dashed p-3.5 text-center text-xs transition-colors ${
                      editReplacementDrag
                        ? 'border-[#0C7A89] bg-[#EBF5F8] dark:border-[#3EC1D3] dark:bg-[#13424F]/50'
                        : 'border-[#07525E]/25 bg-white/60 hover:border-[#0C7A89] dark:border-[#3EC1D3]/25 dark:bg-[#0A2027]/60'
                    }`}
                  >
                    <input
                      ref={replaceInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setEditReplacementFile(e.target.files[0]);
                          e.target.value = '';
                        }
                      }}
                    />
                    {editReplacementFile ? (
                      <div className="flex items-center justify-between gap-2 text-left">
                        <span className="truncate font-semibold text-[#07525E] dark:text-[#E6F4F7]">
                          File baru: {editReplacementFile.name} (
                          {formatFileSize(editReplacementFile.size)})
                        </span>
                        <button
                          type="button"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setEditReplacementFile(null);
                          }}
                          className="shrink-0 cursor-pointer text-rose-600 dark:text-rose-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-[#526A70] dark:text-[#8DA8B0]">
                        Seret file versi baru ke sini atau klik untuk mengganti file lama
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-[#07525E]/10 pt-4 dark:border-[#3EC1D3]/15">
                <button
                  type="button"
                  disabled={editFileSaving}
                  onClick={() => setEditingFile(null)}
                  className="cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-4 py-2 text-xs font-semibold text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editFileSaving}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#0C7A89] to-[#07525E] px-5 py-2 text-xs font-semibold text-white shadow-sm disabled:opacity-60"
                >
                  {editFileSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editFileSaving ? 'Menyimpan...' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 5: PRATINJAU DOKUMEN (IN-APP PREVIEW)                         */}
      {/* =================================================================== */}
      {previewFile && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Pratinjau ${previewFile.judulDokumen}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181E]/65 p-3 backdrop-blur-sm sm:p-5"
        >
          <div className="glass-surface-strong flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#07525E]/10 px-4 py-3 dark:border-[#3EC1D3]/15 sm:px-5">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                {renderFileIcon(previewFile)}
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-extrabold text-[#07525E] dark:text-[#E6F4F7]">
                    {previewFile.judulDokumen}
                  </h3>
                  <div className="truncate text-[11px] text-[#526A70] dark:text-[#8DA8B0]">
                    {previewFile.namaKategori}
                    {previewFile.subfolder ? ` · ${previewFile.subfolder}` : ''} · Update{' '}
                    {formatDateId(previewFile.tanggalUpdate)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={previewFile.driveFileUrl || DOKUMEN_DRIVE_ROOT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl border border-[#07525E]/20 bg-white px-3 py-1.5 text-xs font-semibold text-[#07525E] hover:bg-[#EBF5F8] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-[#0C7A89] dark:text-[#3EC1D3]" />
                  <span>Tab Baru</span>
                </a>
                <a
                  href={getDirectDownloadUrl(previewFile)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => triggerTrackStat(previewFile, 'download')}
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-xl bg-[#0C7A89] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#07525E]"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  aria-label="Tutup pratinjau"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-xl text-[#526A70] hover:bg-[#EBF5F8] dark:text-[#9BB5BC]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 bg-[#F4F8FA] dark:bg-[#081920]">
              <iframe
                title={previewFile.judulDokumen}
                src={getPreviewIframeUrl(previewFile)}
                className="h-full w-full border-0"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 6: KONFIRMASI HAPUS                                           */}
      {/* =================================================================== */}
      {deleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi Hapus"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#06181E]/55 p-4 backdrop-blur-sm"
        >
          <div className="glass-surface-strong w-full max-w-md rounded-3xl p-5 shadow-2xl sm:p-6">
            <h3 className="text-base font-extrabold text-rose-700 dark:text-rose-300">
              {deleteConfirm.kind === 'kategori'
                ? 'Hapus Kategori?'
                : deleteConfirm.kind === 'subkategori'
                  ? 'Hapus Subkategori?'
                  : 'Hapus Dokumen?'}
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-[#3D575E] dark:text-[#A9C2C9]">
              {deleteConfirm.kind === 'kategori' ? (
                <>
                  Kategori <strong className="text-[#07525E] dark:text-[#E6F4F7]">"{deleteConfirm.item.namaKategori}"</strong>
                  {deleteConfirm.docCount > 0
                    ? ` beserta ${deleteConfirm.docCount} dokumen di dalamnya`
                    : ''}{' '}
                  akan dihapus dan folder terkait di Google Drive dipindahkan ke Sampah.
                </>
              ) : deleteConfirm.kind === 'subkategori' ? (
                <>
                  Subkategori <strong className="text-[#07525E] dark:text-[#E6F4F7]">"{deleteConfirm.item.namaSubkategori}"</strong>
                  {deleteConfirm.docCount > 0
                    ? ` beserta ${deleteConfirm.docCount} dokumen di dalamnya`
                    : ''}{' '}
                  akan dihapus dan folder terkait di Google Drive dipindahkan ke Sampah.
                </>
              ) : (
                <>
                  Dokumen <strong className="text-[#07525E] dark:text-[#E6F4F7]">"{deleteConfirm.item.judulDokumen}"</strong>{' '}
                  akan dihapus dari daftar.
                </>
              )}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirm(null)}
                className="cursor-pointer rounded-xl border border-[#07525E]/20 bg-white px-4 py-2 text-xs font-semibold text-[#07525E] dark:border-[#3EC1D3]/25 dark:bg-[#0D2B33] dark:text-[#E6F4F7]"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{deleting ? 'Menghapus...' : 'Ya, Hapus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
