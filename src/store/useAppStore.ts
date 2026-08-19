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

export interface BatchCodeItem {
  id: string;
  code: string;
  type: 'CASE' | 'TEMP';
  qrData?: string;
  detectedAt: number;
}

export interface HistoryItem {
  id: string;
  text: string;
  timestamp: string;
  isFavorite: boolean;
  isBatch?: boolean;
  batchCodes?: { code: string; type: 'CASE' | 'TEMP' }[];
  caseCount?: number;
  tempCount?: number;
}

interface AppState {
  theme: 'dark' | 'light';
  settings: AppSettings;
  history: HistoryItem[];
  activeCode: string;
  isScanning: boolean;
  
  // Batch State
  batchItems: BatchCodeItem[];
  ignoredBatchCodes: string[];
  autoGenerateBatchQr: boolean;
  
  toggleTheme: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setActiveCode: (code: string) => void;
  setIsScanning: (scanning: boolean) => void;
  
  // Batch Actions
  addBatchCodes: (codes: { code: string; type: 'CASE' | 'TEMP' }[]) => boolean;
  addIgnoredBatchCodes: (codes: string[]) => void;
  deleteBatchItem: (id: string) => void;
  clearBatchItems: () => void;
  setAutoGenerateBatchQr: (auto: boolean) => void;
  addBatchToHistory: (items: BatchCodeItem[]) => void;
  
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
      isScanning: false,
      
      batchItems: [],
      ignoredBatchCodes: [],
      autoGenerateBatchQr: true,
      
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      updateSettings: (newSettings) => set((state) => ({ settings: { ...state.settings, ...newSettings } })),
      setActiveCode: (code) => set({ activeCode: code }),
      setIsScanning: (scanning) => set({ isScanning: scanning }),
      
      setAutoGenerateBatchQr: (auto) => set({ autoGenerateBatchQr: auto }),
      
      addBatchCodes: (codes) => {
        let addedNew = false;
        set((state) => {
          const existingCodes = new Set(state.batchItems.map(item => item.code));
          const newItems: BatchCodeItem[] = [];

          for (const item of codes) {
            const cleanCode = item.code.trim().toUpperCase();
            if (!existingCodes.has(cleanCode)) {
              existingCodes.add(cleanCode);
              addedNew = true;
              newItems.push({
                id: typeof crypto !== 'undefined' && crypto.randomUUID 
                  ? crypto.randomUUID() 
                  : Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
                code: cleanCode,
                type: item.type,
                detectedAt: Date.now()
              });
            }
          }

          if (!addedNew) return state;
          return { batchItems: [...state.batchItems, ...newItems] };
        });
        return addedNew;
      },

      addIgnoredBatchCodes: (codes) => set((state) => {
        const existing = new Set(state.ignoredBatchCodes);
        codes.forEach(c => existing.add(c));
        return { ignoredBatchCodes: Array.from(existing) };
      }),

      deleteBatchItem: (id) => set((state) => ({
        batchItems: state.batchItems.filter(item => item.id !== id)
      })),

      clearBatchItems: () => set({ batchItems: [], ignoredBatchCodes: [] }),

      addBatchToHistory: (items) => set((state) => {
        if (items.length === 0) return state;
        const caseCount = items.filter(i => i.type === 'CASE').length;
        const tempCount = items.filter(i => i.type === 'TEMP').length;
        
        const newItem: HistoryItem = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          text: `Batch (${items.length} codes: ${caseCount} CASE, ${tempCount} TEMP)`,
          timestamp: new Date().toISOString(),
          isFavorite: false,
          isBatch: true,
          batchCodes: items.map(i => ({ code: i.code, type: i.type })),
          caseCount,
          tempCount
        };

        const updated = [newItem, ...state.history].slice(0, 100);
        return { history: updated };
      }),
      
      addToHistory: (code) => set((state) => {
        const clean = code.trim().toUpperCase();
        const filtered = state.history.filter(item => item.text !== clean);
        
        const newItem: HistoryItem = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          text: clean,
          timestamp: new Date().toISOString(),
          isFavorite: false
        };
        
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
        history: state.history,
        batchItems: state.batchItems,
        autoGenerateBatchQr: state.autoGenerateBatchQr
      })
    }
  )
);

