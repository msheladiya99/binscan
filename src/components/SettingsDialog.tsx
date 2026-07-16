import React from 'react';
import { X, Save } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { AppSettings } from '../store/useAppStore';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsDialog({ isOpen, onClose }: SettingsDialogProps) {
  const { settings, updateSettings } = useAppStore();
  const [localSettings, setLocalSettings] = React.useState<AppSettings>(settings);

  React.useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-warehouse-card border border-warehouse-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden font-sans">
        <div className="flex justify-between items-center px-5 py-4 border-b border-warehouse-border bg-warehouse-panel">
          <h3 className="font-bold text-sm tracking-wider text-accent-amber font-mono">SCANNER SETTINGS</h3>
          <button onClick={onClose} className="text-warehouse-muted hover:text-warehouse-text">
            <X size={18} />
          </button>
        </div>
        
        <div className="p-6 space-y-5 overflow-y-auto max-h-[70vh]">
          {/* Default Camera */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono font-bold text-warehouse-muted">DEFAULT CAMERA DIRECTION</label>
            <select 
              value={localSettings.defaultCamera}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, defaultCamera: e.target.value as any }))}
              className="bg-warehouse-panel border-2 border-warehouse-border focus:border-accent-amber text-warehouse-text p-3 rounded-lg outline-none font-mono text-sm cursor-pointer"
            >
              <option value="environment">Rear Camera (Warehouse Scanner)</option>
              <option value="user">Front Camera (Selfie Mode)</option>
            </select>
          </div>

          {/* QR Size */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono font-bold text-warehouse-muted">QR RENDER SIZE (PX)</label>
            <div className="grid grid-cols-4 gap-2">
              {([200, 300, 500, 800] as const).map(size => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setLocalSettings(prev => ({ ...prev, qrSize: size }))}
                  className={`py-2 px-3 border-2 font-mono text-xs rounded-lg transition ${
                    localSettings.qrSize === size 
                      ? 'border-accent-amber bg-accent-amber/10 text-accent-amber font-bold' 
                      : 'border-warehouse-border bg-warehouse-panel text-warehouse-muted hover:border-warehouse-border-focus'
                  }`}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>

          {/* Error Correction */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono font-bold text-warehouse-muted">QR ERROR CORRECTION LEVEL</label>
            <div className="grid grid-cols-4 gap-2">
              {(['L', 'M', 'Q', 'H'] as const).map(level => {
                const labels = { L: 'L (7%)', M: 'M (15%)', Q: 'Q (25%)', H: 'H (30%)' };
                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLocalSettings(prev => ({ ...prev, errorCorrection: level }))}
                    className={`py-2 px-1 border-2 font-mono text-xs rounded-lg transition ${
                      localSettings.errorCorrection === level 
                        ? 'border-accent-amber bg-accent-amber/10 text-accent-amber font-bold' 
                        : 'border-warehouse-border bg-warehouse-panel text-warehouse-muted hover:border-warehouse-border-focus'
                    }`}
                    title={`Error correction level: ${labels[level]}`}
                  >
                    {level}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono font-bold text-warehouse-muted">FOREGROUND COLOR</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="color" 
                  value={localSettings.fgColor}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, fgColor: e.target.value }))}
                  className="bg-transparent h-10 w-12 border-0 cursor-pointer outline-none"
                />
                <span className="font-mono text-xs text-warehouse-text bg-warehouse-panel border border-warehouse-border px-2 py-1 rounded">{localSettings.fgColor.toUpperCase()}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-mono font-bold text-warehouse-muted">BACKGROUND COLOR</label>
              <div className="flex gap-2 items-center">
                <input 
                  type="color" 
                  value={localSettings.bgColor}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, bgColor: e.target.value }))}
                  className="bg-transparent h-10 w-12 border-0 cursor-pointer outline-none"
                />
                <span className="font-mono text-xs text-warehouse-text bg-warehouse-panel border border-warehouse-border px-2 py-1 rounded">{localSettings.bgColor.toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Margin */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono font-bold text-warehouse-muted">QR BORDER MARGIN (QUIET ZONE)</label>
            <select
              value={localSettings.margin}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, margin: parseInt(e.target.value, 10) }))}
              className="bg-warehouse-panel border-2 border-warehouse-border focus:border-accent-amber text-warehouse-text p-3 rounded-lg outline-none font-mono text-sm cursor-pointer"
            >
              <option value="0">No Border (0)</option>
              <option value="1">Minimal Border (1)</option>
              <option value="2">Medium Border (2)</option>
              <option value="4">Standard Border (4)</option>
            </select>
          </div>

          {/* Export Format */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-mono font-bold text-warehouse-muted">DEFAULT EXPORT FORMAT</label>
            <select
              value={localSettings.downloadFormat}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, downloadFormat: e.target.value as any }))}
              className="bg-warehouse-panel border-2 border-warehouse-border focus:border-accent-amber text-warehouse-text p-3 rounded-lg outline-none font-mono text-sm cursor-pointer"
            >
              <option value="png">PNG (Bitmap Image)</option>
              <option value="svg">SVG (Scalable Vector Graphic)</option>
              <option value="pdf">PDF (Printable A4 Sheet)</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-3 px-6 py-4 border-t border-warehouse-border bg-warehouse-panel justify-end">
          <button 
            onClick={onClose}
            className="btn btn-outline py-2.5 px-4 font-mono text-xs"
          >
            CANCEL
          </button>
          <button 
            onClick={handleSave}
            className="btn btn-primary py-2.5 px-4 font-mono text-xs flex items-center gap-1.5"
          >
            <Save size={14} />
            SAVE CHANGES
          </button>
        </div>
      </div>
    </div>
  );
}
