import { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Download, 
  Printer, 
  FileText, 
  Trash2, 
  Copy, 
  Check, 
  Grid, 
  List, 
  Save, 
  Package, 
  AlertCircle 
} from 'lucide-react';
import { useAppStore, type BatchCodeItem } from '../store/useAppStore';
import { 
  generateQRDataUrl, 
  downloadSingleBatchQR, 
  downloadBatchZIP, 
  downloadBatchPDF, 
  printBatchLabels 
} from '../utils/batchQr';

interface BatchCodeListProps {
  onShowToast?: (msg: string) => void;
}

export default function BatchCodeList({ onShowToast }: BatchCodeListProps) {
  const { 
    batchItems, 
    deleteBatchItem, 
    clearBatchItems, 
    addBatchToHistory,
    ignoredBatchCodes
  } = useAppStore();

  const [filter, setFilter] = useState<'ALL' | 'CASE' | 'TEMP'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('cards');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Progress state for ZIP generation
  const [zipProgress, setZipProgress] = useState<string | null>(null);

  // Clear confirmation modal state
  const [showClearModal, setShowClearModal] = useState(false);

  // Map of generated QR Data URLs for fast rendering
  const [qrMap, setQrMap] = useState<Record<string, string>>({});

  // Generate QR data URLs asynchronously
  useEffect(() => {
    let isMounted = true;

    async function loadQRs() {
      const newEntries: Record<string, string> = {};

      for (const item of batchItems) {
        if (!qrMap[item.id]) {
          try {
            const url = await generateQRDataUrl(item.code);
            if (isMounted) {
              newEntries[item.id] = url;
            }
          } catch (err) {
            console.error("Failed QR generation for item:", item.code, err);
          }
        }
      }

      if (Object.keys(newEntries).length > 0 && isMounted) {
        setQrMap(prev => ({ ...prev, ...newEntries }));
      }
    }

    if (batchItems.length > 0) {
      loadQRs();
    }
  }, [batchItems, qrMap]);

  // Counts
  const totalCount = batchItems.length;
  const caseCount = useMemo(() => batchItems.filter(i => i.type === 'CASE').length, [batchItems]);
  const tempCount = useMemo(() => batchItems.filter(i => i.type === 'TEMP').length, [batchItems]);

  // Filtered & Searched List
  const filteredItems = useMemo(() => {
    return batchItems.filter(item => {
      // Type Filter
      if (filter === 'CASE' && item.type !== 'CASE') return false;
      if (filter === 'TEMP' && item.type !== 'TEMP') return false;
      // Search Query
      if (searchQuery.trim()) {
        return item.code.toLowerCase().includes(searchQuery.trim().toLowerCase());
      }
      return true;
    });
  }, [batchItems, filter, searchQuery]);

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    if (onShowToast) onShowToast(`Copied: ${code}`);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDownloadSingle = async (code: string) => {
    await downloadSingleBatchQR(code);
    if (onShowToast) onShowToast(`Downloaded ${code}.png`);
  };

  const handlePrintSingle = async (item: BatchCodeItem) => {
    await printBatchLabels([item]);
  };

  const handleDownloadAllZip = async () => {
    if (filteredItems.length === 0) return;
    try {
      setZipProgress(`Preparing...`);
      await downloadBatchZIP(
        filteredItems.map(item => ({ ...item, qrData: qrMap[item.id] })),
        (current, total) => {
          setZipProgress(`Generating ${current} / ${total}`);
        }
      );
      setZipProgress(`DOWNLOAD COMPLETE`);
      if (onShowToast) onShowToast(`Downloaded ZIP with ${filteredItems.length} codes`);
    } catch (err) {
      console.error("ZIP download error:", err);
      if (onShowToast) onShowToast(`ZIP download error`);
    } finally {
      setTimeout(() => setZipProgress(null), 2500);
    }
  };

  const handleDownloadPDF = async () => {
    if (filteredItems.length === 0) return;
    try {
      await downloadBatchPDF(
        filteredItems.map(item => ({ ...item, qrData: qrMap[item.id] }))
      );
      if (onShowToast) onShowToast(`Downloaded PDF with ${filteredItems.length} labels`);
    } catch (err) {
      console.error("PDF download error:", err);
    }
  };

  const handlePrintAll = async () => {
    if (filteredItems.length === 0) return;
    await printBatchLabels(
      filteredItems.map(item => ({ ...item, qrData: qrMap[item.id] }))
    );
  };

  const handleSaveToHistory = () => {
    if (batchItems.length === 0) return;
    addBatchToHistory(batchItems);
    if (onShowToast) onShowToast(`Saved batch (${batchItems.length} codes) to History`);
  };

  const handleConfirmClearAll = () => {
    clearBatchItems();
    setShowClearModal(false);
    if (onShowToast) onShowToast(`Cleared batch list`);
  };

  if (totalCount === 0) {
    return (
      <div className="bg-warehouse-card border border-warehouse-border rounded-xl p-8 text-center flex flex-col items-center justify-center gap-3">
        <Package size={40} className="text-warehouse-muted opacity-40" />
        <h3 className="text-base font-bold text-warehouse-text tracking-wide">
          NO BATCH SCAN RESULTS YET
        </h3>
        <p className="text-xs text-warehouse-muted max-w-xs">
          Use <span className="text-accent-amber font-mono font-bold">SCAN LIST</span> or <span className="text-accent-teal font-mono font-bold">MANUAL LIST</span> above to detect warehouse codes.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mt-6">
      {/* Header bar & counters */}
      <div className="bg-warehouse-panel border border-warehouse-border rounded-xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-base font-extrabold tracking-wider text-warehouse-text uppercase flex items-center gap-2">
            <span>BATCH RESULTS</span>
            <span className="text-xs px-2 py-0.5 bg-accent-amber/20 text-accent-amber border border-accent-amber/30 rounded-full font-mono">
              {totalCount} CODES
            </span>
          </h2>
          <p className="text-xs text-warehouse-muted font-mono mt-0.5">
            CASE: <span className="text-accent-amber font-bold">{caseCount}</span> | TEMP: <span className="text-accent-teal font-bold">{tempCount}</span>
            {ignoredBatchCodes.length > 0 && (
              <span className="text-warehouse-muted"> | Ignored PERM: <span className="text-accent-red font-bold">{ignoredBatchCodes.length}</span></span>
            )}
          </p>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleSaveToHistory}
            className="px-3 py-1.5 bg-warehouse-card hover:bg-warehouse-border border border-warehouse-border rounded-lg text-xs font-mono font-bold text-warehouse-text flex items-center gap-1.5 transition"
            title="Save to History"
          >
            <Save size={13} className="text-accent-teal" />
            <span>SAVE</span>
          </button>

          <button
            onClick={() => setShowClearModal(true)}
            className="px-3 py-1.5 bg-warehouse-card hover:bg-accent-red/20 border border-warehouse-border hover:border-accent-red/40 rounded-lg text-xs font-mono font-bold text-accent-red flex items-center gap-1.5 transition"
            title="Clear all codes"
          >
            <Trash2 size={13} />
            <span>CLEAR</span>
          </button>

          <div className="flex bg-warehouse-card border border-warehouse-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded transition ${viewMode === 'cards' ? 'bg-accent-amber text-slate-950' : 'text-warehouse-muted hover:text-warehouse-text'}`}
              title="Card View"
            >
              <Grid size={14} />
            </button>
            <button
              onClick={() => setViewMode('compact')}
              className={`p-1.5 rounded transition ${viewMode === 'compact' ? 'bg-accent-amber text-slate-950' : 'text-warehouse-muted hover:text-warehouse-text'}`}
              title="Compact View"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Category Filters */}
        <div className="flex bg-warehouse-panel border border-warehouse-border rounded-lg p-1">
          <button
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 text-xs font-mono font-bold rounded transition ${filter === 'ALL' ? 'bg-warehouse-card text-accent-amber border border-warehouse-border' : 'text-warehouse-muted hover:text-warehouse-text'}`}
          >
            ALL ({totalCount})
          </button>
          <button
            onClick={() => setFilter('CASE')}
            className={`px-3 py-1 text-xs font-mono font-bold rounded transition ${filter === 'CASE' ? 'bg-warehouse-card text-accent-amber border border-warehouse-border' : 'text-warehouse-muted hover:text-warehouse-text'}`}
          >
            CASE ({caseCount})
          </button>
          <button
            onClick={() => setFilter('TEMP')}
            className={`px-3 py-1 text-xs font-mono font-bold rounded transition ${filter === 'TEMP' ? 'bg-warehouse-card text-accent-teal border border-warehouse-border' : 'text-warehouse-muted hover:text-warehouse-text'}`}
          >
            TEMP ({tempCount})
          </button>
        </div>

        {/* Live Search */}
        <div className="relative flex-grow sm:max-w-xs">
          <Search size={14} className="absolute left-3 top-2.5 text-warehouse-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scanned codes..."
            className="w-full bg-warehouse-card border border-warehouse-border focus:border-accent-amber rounded-lg pl-9 pr-3 py-1.5 text-xs font-mono text-warehouse-text outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-xs text-warehouse-muted hover:text-warehouse-text"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Exporters Toolbar */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={handleDownloadAllZip}
          disabled={filteredItems.length === 0}
          className="btn btn-primary py-2.5 text-xs font-bold font-mono tracking-wider flex items-center justify-center gap-1.5"
        >
          <Download size={14} />
          <span>{zipProgress || `DOWNLOAD ALL (${filteredItems.length})`}</span>
        </button>

        <button
          onClick={handleDownloadPDF}
          disabled={filteredItems.length === 0}
          className="btn btn-accent py-2.5 text-xs font-bold font-mono tracking-wider flex items-center justify-center gap-1.5"
        >
          <FileText size={14} />
          <span>PDF LABELS</span>
        </button>

        <button
          onClick={handlePrintAll}
          disabled={filteredItems.length === 0}
          className="btn btn-outline py-2.5 text-xs font-bold font-mono tracking-wider flex items-center justify-center gap-1.5"
        >
          <Printer size={14} />
          <span>PRINT ALL</span>
        </button>
      </div>

      {/* Code List Display */}
      {filteredItems.length === 0 ? (
        <div className="bg-warehouse-card border border-warehouse-border rounded-xl p-6 text-center text-xs text-warehouse-muted font-mono">
          No codes matching "{searchQuery}"
        </div>
      ) : viewMode === 'cards' ? (
        /* CARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const qrUrl = qrMap[item.id];
            const isCase = item.type === 'CASE';

            return (
              <div 
                key={item.id}
                className="bg-warehouse-card border border-warehouse-border hover:border-warehouse-border-focus rounded-xl p-4 flex flex-col justify-between transition gap-3"
              >
                {/* Header */}
                <div className="flex justify-between items-center">
                  <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-extrabold uppercase border ${
                    isCase ? 'bg-amber-500/10 text-accent-amber border-amber-500/30' : 'bg-cyan-500/10 text-accent-teal border-cyan-500/30'
                  }`}>
                    {item.type}
                  </span>

                  <button
                    onClick={() => deleteBatchItem(item.id)}
                    className="text-warehouse-muted hover:text-accent-red transition p-1"
                    title="Delete item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Code Text */}
                <div className="text-center font-mono font-bold text-sm tracking-wider text-warehouse-text bg-warehouse-panel border border-warehouse-border py-1.5 px-2 rounded">
                  {item.code}
                </div>

                {/* QR Preview */}
                <div className="bg-white p-3 rounded-lg flex items-center justify-center aspect-square max-w-[180px] mx-auto border border-warehouse-border">
                  {qrUrl ? (
                    <img src={qrUrl} alt={item.code} className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-slate-400 text-xs font-mono animate-pulse">Generating...</div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-warehouse-border">
                  <button
                    onClick={() => handleDownloadSingle(item.code)}
                    className="py-1.5 px-2 bg-warehouse-panel hover:bg-warehouse-border text-warehouse-text rounded text-xs font-mono font-bold flex items-center justify-center gap-1 transition"
                  >
                    <Download size={12} />
                    <span>DL</span>
                  </button>

                  <button
                    onClick={() => handleCopyCode(item.id, item.code)}
                    className="py-1.5 px-2 bg-warehouse-panel hover:bg-warehouse-border text-warehouse-text rounded text-xs font-mono font-bold flex items-center justify-center gap-1 transition"
                  >
                    {copiedId === item.id ? <Check size={12} className="text-accent-teal" /> : <Copy size={12} />}
                    <span>{copiedId === item.id ? 'COPIED' : 'COPY'}</span>
                  </button>

                  <button
                    onClick={() => handlePrintSingle(item)}
                    className="py-1.5 px-2 bg-warehouse-panel hover:bg-warehouse-border text-warehouse-text rounded text-xs font-mono font-bold flex items-center justify-center gap-1 transition"
                  >
                    <Printer size={12} />
                    <span>PRINT</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* COMPACT LIST VIEW */
        <div className="bg-warehouse-card border border-warehouse-border rounded-xl divide-y divide-warehouse-border overflow-hidden">
          <div className="bg-warehouse-panel px-4 py-2 text-xs font-mono font-bold text-warehouse-muted grid grid-cols-12 gap-2">
            <span className="col-span-1">#</span>
            <span className="col-span-5">CODE</span>
            <span className="col-span-2">TYPE</span>
            <span className="col-span-4 text-right">ACTIONS</span>
          </div>

          <div className="max-h-[500px] overflow-y-auto divide-y divide-warehouse-border">
            {filteredItems.map((item, idx) => (
              <div 
                key={item.id}
                className="px-4 py-2.5 text-xs font-mono grid grid-cols-12 gap-2 items-center hover:bg-warehouse-panel/50 transition"
              >
                <span className="col-span-1 text-warehouse-muted font-bold">
                  {String(idx + 1).padStart(2, '0')}
                </span>

                <span className="col-span-5 font-bold text-warehouse-text tracking-wide truncate">
                  {item.code}
                </span>

                <span className="col-span-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                    item.type === 'CASE' ? 'bg-amber-500/10 text-accent-amber border border-amber-500/30' : 'bg-cyan-500/10 text-accent-teal border border-cyan-500/30'
                  }`}>
                    {item.type}
                  </span>
                </span>

                <div className="col-span-4 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => handleDownloadSingle(item.code)}
                    className="p-1.5 hover:bg-warehouse-panel rounded text-warehouse-muted hover:text-accent-amber transition"
                    title="Download PNG"
                  >
                    <Download size={13} />
                  </button>

                  <button
                    onClick={() => handleCopyCode(item.id, item.code)}
                    className="p-1.5 hover:bg-warehouse-panel rounded text-warehouse-muted hover:text-accent-teal transition"
                    title="Copy code"
                  >
                    {copiedId === item.id ? <Check size={13} className="text-accent-teal" /> : <Copy size={13} />}
                  </button>

                  <button
                    onClick={() => handlePrintSingle(item)}
                    className="p-1.5 hover:bg-warehouse-panel rounded text-warehouse-muted hover:text-warehouse-text transition"
                    title="Print label"
                  >
                    <Printer size={13} />
                  </button>

                  <button
                    onClick={() => deleteBatchItem(item.id)}
                    className="p-1.5 hover:bg-warehouse-panel rounded text-warehouse-muted hover:text-accent-red transition"
                    title="Delete item"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clear All Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-warehouse-card border border-warehouse-border rounded-xl p-6 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-3 text-accent-red">
              <AlertCircle size={24} />
              <h3 className="text-base font-bold uppercase text-warehouse-text">
                Clear all codes?
              </h3>
            </div>

            <p className="text-xs text-warehouse-muted font-mono leading-relaxed">
              This will remove all <span className="text-warehouse-text font-bold">{totalCount} scanned codes</span> from the current batch list.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowClearModal(false)}
                className="btn btn-outline flex-1 py-2 text-xs uppercase"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmClearAll}
                className="btn btn-danger flex-1 py-2 text-xs uppercase"
              >
                Confirm Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
