import React from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import CameraScanner from './components/CameraScanner';
import ManualInput from './components/ManualInput';
import HistoryList from './components/HistoryList';
import QRCodeViewer from './components/QRCodeViewer';
import SettingsDialog from './components/SettingsDialog';
import { useAppStore } from './store/useAppStore';
import { useOCR } from './hooks/useOCR';
import { Camera, Keyboard, History } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function App() {
  const { 
    theme, 
    isScanning,
    setIsScanning
  } = useAppStore();

  const [activeTab, setActiveTab] = React.useState<'camera' | 'manual' | 'history'>('manual');
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  
  // OCR hooks mapping to system headers
  const { ocrState, ocrStatusText } = useOCR();

  const cameraStatusText = isScanning ? 'CAM: ON' : 'CAM: OFF';

  // Synchronize camera state on tab changes to conserve resources
  const handleTabChange = (tab: 'camera' | 'manual' | 'history') => {
    setActiveTab(tab);
    if (tab === 'camera') {
      setIsScanning(true);
    } else {
      setIsScanning(false);
    }
  };

  // Toggle Dark Mode globally
  React.useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Handle toast timers
  React.useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage('');
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleShowToast = (msg: string) => {
    setToastMessage(msg);
  };

  return (
    <div className="min-h-screen bg-warehouse-bg text-warehouse-text flex flex-col font-sans transition-colors duration-200">
      <div className="app-container flex-grow flex flex-col">
        {/* Header */}
        <Header 
          cameraActive={isScanning}
          cameraStatusText={cameraStatusText}
          ocrState={ocrState}
          ocrStatusText={ocrStatusText}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Main Workspace */}
        <main className="app-main flex-grow mt-6">
          {/* Inputs & Settings */}
          <section className="input-panel card">
            <div className="tab-headers">
              <button
                onClick={() => handleTabChange('camera')}
                className={`tab-btn ${activeTab === 'camera' ? 'active' : ''}`}
              >
                <Camera size={16} className="tab-icon" />
                <span>📷 SCAN CODE</span>
              </button>
              <button
                onClick={() => handleTabChange('manual')}
                className={`tab-btn ${activeTab === 'manual' ? 'active' : ''}`}
              >
                <Keyboard size={16} className="tab-icon" />
                <span>⌨ MANUAL ENTRY</span>
              </button>
              <button
                onClick={() => handleTabChange('history')}
                className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
              >
                <History size={16} className="tab-icon" />
                <span>📋 LOG HISTORY</span>
              </button>
            </div>

            {/* Slider Transitions */}
            <div className="flex-grow p-6 relative flex flex-col min-h-[380px] overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15, ease: 'easeInOut' }}
                  className="flex-grow flex flex-col"
                >
                  {activeTab === 'camera' && (
                    <CameraScanner onShowToast={handleShowToast} />
                  )}
                  {activeTab === 'manual' && (
                    <ManualInput />
                  )}
                  {activeTab === 'history' && (
                    <HistoryList onShowToast={handleShowToast} />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          {/* QRCode output sticker (always visible) */}
          <section className="output-panel card">
            <QRCodeViewer onShowToast={handleShowToast} />
          </section>
        </main>

        {/* Footer */}
        <Footer />
      </div>

      {/* Settings Dialog Modals */}
      <SettingsDialog 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Notifications */}
      <div 
        className={`toast-notification ${toastMessage ? '' : 'hidden'}`}
      >
        {toastMessage}
      </div>
    </div>
  );
}
