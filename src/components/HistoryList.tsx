import React from 'react';
import QRCode from 'qrcode';
import { Search, Trash2, Star, Copy, Printer, Play, AlertCircle } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { printLabel } from '../utils/print';

interface HistoryListProps {
  onShowToast: (msg: string) => void;
}

export default function HistoryList({ onShowToast }: HistoryListProps) {
  const { 
    history, 
    toggleFavorite, 
    deleteHistoryItem, 
    clearHistory, 
    setActiveCode 
  } = useAppStore();

  const [search, setSearch] = React.useState('');
  const [filter, setFilter] = React.useState<'all' | 'favorites'>('all');

  const filteredHistory = React.useMemo(() => {
    return history.filter(item => {
      const matchesSearch = item.text.toLowerCase().includes(search.toLowerCase());
      const matchesFilter = filter === 'all' || item.isFavorite;
      return matchesSearch && matchesFilter;
    });
  }, [history, search, filter]);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => onShowToast("Code copied to clipboard!"))
      .catch(() => onShowToast("Failed to copy."));
  };

  const handlePrintItem = (text: string) => {
    const tempCanvas = document.createElement('canvas');
    QRCode.toCanvas(tempCanvas, text, { width: 256, margin: 1 }, (err) => {
      if (!err) {
        printLabel(text, tempCanvas);
      } else {
        console.error("Print QR render failed:", err);
        onShowToast("Failed to render QR for printing.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 font-sans h-full">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-grow flex items-center">
          <Search size={16} className="absolute left-3 text-warehouse-muted" />
          <input 
            type="text" 
            placeholder="Search history..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-warehouse-panel border border-warehouse-border text-warehouse-text py-2 px-3 pl-9 rounded-lg outline-none font-mono text-xs focus:border-accent-amber"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`py-2 px-3 border rounded-lg text-xs font-mono transition ${
              filter === 'all' 
                ? 'border-accent-amber bg-accent-amber/10 text-accent-amber font-bold' 
                : 'border-warehouse-border bg-warehouse-panel text-warehouse-muted hover:border-warehouse-border-focus'
            }`}
          >
            ALL ({history.length})
          </button>
          <button
            onClick={() => setFilter('favorites')}
            className={`py-2 px-3 border rounded-lg text-xs font-mono transition ${
              filter === 'favorites' 
                ? 'border-accent-amber bg-accent-amber/10 text-accent-amber font-bold' 
                : 'border-warehouse-border bg-warehouse-panel text-warehouse-muted hover:border-warehouse-border-focus'
            }`}
          >
            FAVORITES ({history.filter(i => i.isFavorite).length})
          </button>
        </div>
      </div>

      {/* History Log Items */}
      <div className="flex-grow overflow-y-auto max-h-[280px] border border-warehouse-border rounded-lg bg-warehouse-panel divide-y divide-warehouse-border">
        {filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-warehouse-muted gap-2">
            <AlertCircle size={24} />
            <span className="font-mono text-xs italic">No matching records found.</span>
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3.5 hover:bg-warehouse-card/30 transition gap-4">
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-mono font-bold text-warehouse-text text-sm truncate">{item.text}</span>
                <span className="font-mono text-[9px] text-warehouse-muted">
                  {new Date(item.timestamp).toLocaleString()}
                </span>
              </div>
              
              <div className="flex items-center gap-1 shrink-0">
                {/* Generate / Load QR */}
                <button
                  onClick={() => setActiveCode(item.text)}
                  className="p-1.5 hover:text-accent-teal hover:bg-warehouse-card transition rounded text-warehouse-muted"
                  title="Load and generate QR"
                >
                  <Play size={14} />
                </button>
                
                {/* Favorite */}
                <button
                  onClick={() => toggleFavorite(item.id)}
                  className={`p-1.5 transition rounded ${
                    item.isFavorite ? 'text-accent-amber hover:text-accent-amber/80' : 'text-warehouse-muted hover:text-accent-amber'
                  }`}
                  title="Toggle favorite"
                >
                  <Star size={14} fill={item.isFavorite ? "currentColor" : "none"} />
                </button>
                
                {/* Copy */}
                <button
                  onClick={() => handleCopyText(item.text)}
                  className="p-1.5 hover:text-accent-teal hover:bg-warehouse-card transition rounded text-warehouse-muted"
                  title="Copy text"
                >
                  <Copy size={14} />
                </button>

                {/* Print */}
                <button
                  onClick={() => handlePrintItem(item.text)}
                  className="p-1.5 hover:text-accent-teal hover:bg-warehouse-card transition rounded text-warehouse-muted"
                  title="Print label"
                >
                  <Printer size={14} />
                </button>

                {/* Delete */}
                <button
                  onClick={() => deleteHistoryItem(item.id)}
                  className="p-1.5 hover:text-accent-red hover:bg-warehouse-card transition rounded text-warehouse-muted"
                  title="Delete record"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Clear Button */}
      {history.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={clearHistory}
            className="flex items-center gap-1.5 font-mono text-[10px] text-accent-red hover:bg-accent-red/10 border border-transparent hover:border-accent-red/20 px-2.5 py-1.5 rounded transition font-bold cursor-pointer"
          >
            <Trash2 size={12} />
            CLEAR ALL RECORDS
          </button>
        </div>
      )}
    </div>
  );
}
export type HistoryListPropsType = {};
