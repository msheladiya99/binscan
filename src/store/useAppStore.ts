import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppSettings {
  qrSize: 200 | 300 | 500 | 800;
  fgColor: string;
  bgColor: string;
  margin: number;
  errorCorrection: 'L' | 'M' | 'Q' | 'H';
  downloadFormat: 'png' | 'svg' | 'pdf';
  defaultCamera: 'user' | 'environment';
  autoFocus: boolean;
}

export interface HistoryItem {
  id: string;
  text: string;
  timestamp: string;
  isFavorite: boolean;
}

interface AppState {
  theme: 'dark' | 'light';
  settings: AppSettings;
  history: HistoryItem[];
  activeCode: string;
  isScanning: boolean;
  
  toggleTheme: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setActiveCode: (code: string) => void;
  setIsScanning: (scanning: boolean) => void;
  
  // History Actions
  addToHistory: (code: string) => void;
  toggleFavorite: (id: string) => void;
  deleteHistoryItem: (id: string) => void;
  clearHistory: () => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  qrSize: 300,
  fgColor: '#000000',
  bgColor: '#ffffff',
  margin: 2,
  errorCorrection: 'H',
  downloadFormat: 'png',
  defaultCamera: 'environment',
  autoFocus: true
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      settings: DEFAULT_SETTINGS,
      history: [],
      activeCode: '',
      isScanning: true, // starts scanning automatically on load
      
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      setActiveCode: (code) => set({ activeCode: code }),
      setIsScanning: (scanning) => set({ isScanning: scanning }),
      
      addToHistory: (code) => set((state) => {
        const clean = code.trim().toUpperCase();
        // Check if already exists in history to push to top
        const filtered = state.history.filter(item => item.text !== clean);
        
        const newItem: HistoryItem = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          text: clean,
          timestamp: new Date().toISOString(),
          isFavorite: false
        };
        
        // Maintain up to 100 history items
        const updated = [newItem, ...filtered].slice(0, 100);
        return { history: updated };
      }),
      
      toggleFavorite: (id) => set((state) => ({
        history: state.history.map(item => 
          item.id === id ? { ...item, isFavorite: !item.isFavorite } : item
        )
      })),
      
      deleteHistoryItem: (id) => set((state) => ({
        history: state.history.filter(item => item.id !== id)
      })),
      
      clearHistory: () => set({ history: [] })
    }),
    {
      name: 'warehouse-qr-scanner-storage',
      partialize: (state) => ({
        theme: state.theme,
        settings: state.settings,
        history: state.history
      })
    }
  )
);
