import React from 'react';
import { ScanLine, Wifi, WifiOff, Sun, Moon, Settings } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface HeaderProps {
  cameraActive: boolean;
  cameraStatusText: string;
  ocrState: 'uninitialized' | 'initializing' | 'ready' | 'error';
  ocrStatusText: string;
  onOpenSettings: () => void;
}

export default function Header({ 
  cameraActive, 
  cameraStatusText, 
  ocrState, 
  ocrStatusText,
  onOpenSettings 
}: HeaderProps) {
  const { theme, toggleTheme } = useAppStore();
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <header className="flex flex-col sm:flex-row justify-between items-center py-4 border-b border-warehouse-border gap-4">
      <div className="flex items-center gap-3">
        <ScanLine className="text-accent-amber" size={28} />
        <div>
          <h1 className="text-xl font-extrabold tracking-wider text-warehouse-text">
            BIN<span className="text-accent-amber">SCAN</span>
          </h1>
          <p className="text-xs text-warehouse-muted font-mono font-semibold uppercase tracking-widest">meetonweb</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Connection Status */}
        <div className="flex items-center gap-1.5 bg-warehouse-card border border-warehouse-border px-3 py-1.5 rounded-full text-xs font-mono text-warehouse-muted">
          {isOnline ? (
            <>
              <Wifi size={13} className="text-accent-teal" />
              <span>ONLINE</span>
            </>
          ) : (
            <>
              <WifiOff size={13} className="text-accent-red" />
              <span className="text-accent-red font-bold">OFFLINE</span>
            </>
          )}
        </div>

        {/* Camera Status */}
        <div className="flex items-center gap-1.5 bg-warehouse-card border border-warehouse-border px-3 py-1.5 rounded-full text-xs font-mono text-warehouse-muted">
          <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-accent-teal shadow-[0_0_8px_#06b6d4]' : 'bg-slate-500'}`}></span>
          <span>{cameraStatusText}</span>
        </div>

        {/* OCR Status */}
        <div className="flex items-center gap-1.5 bg-warehouse-card border border-warehouse-border px-3 py-1.5 rounded-full text-xs font-mono text-warehouse-muted">
          <span className={`w-2 h-2 rounded-full ${
            ocrState === 'initializing' ? 'bg-accent-amber animate-pulse' : 
            ocrState === 'ready' ? 'bg-accent-teal shadow-[0_0_8px_#06b6d4]' : 'bg-slate-500'
          }`}></span>
          <span>{ocrStatusText}</span>
        </div>

        {/* Settings button */}
        <button 
          onClick={onOpenSettings}
          className="p-2 bg-warehouse-card border border-warehouse-border hover:border-warehouse-border-focus hover:text-accent-amber transition rounded-full text-warehouse-muted"
          title="Open Settings"
        >
          <Settings size={15} />
        </button>

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="p-2 bg-warehouse-card border border-warehouse-border hover:border-warehouse-border-focus hover:text-accent-amber transition rounded-full text-warehouse-muted"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}
