import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { normalizeCaseTempCode } from '../utils/regex';

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
        let lastAddedCode = '';
        set((state) => {
          // Normalize existing codes in set to prevent duplicate entries
          const existingCodes = new Set(
            state.batchItems.map(item => normalizeCaseTempCode(item.code) || item.code.trim().toUpperCase())
          );
          const newItems: BatchCodeItem[] = [];

          for (const item of codes) {
            const canonicalCode = normalizeCaseTempCode(item.code) || item.code.trim().toUpperCase();
            if (canonicalCode && !existingCodes.has(canonicalCode)) {
              existingCodes.add(canonicalCode);
              addedNew = true;
              lastAddedCode = canonicalCode;
              newItems.push({
                id: typeof crypto !== 'undefined' && crypto.randomUUID 
                  ? crypto.randomUUID() 
                  : Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
                code: canonicalCode,
                type: item.type,
                detectedAt: Date.now()
              });
            }
          }

          if (!addedNew) return state;

          // Deduplicate entire array as a safety guarantee
          const seen = new Set<string>();
          const dedupedBatchItems: BatchCodeItem[] = [];
          for (const item of [...state.batchItems, ...newItems]) {
            const norm = normalizeCaseTempCode(item.code) || item.code.trim().toUpperCase();
            if (norm && !seen.has(norm)) {
              seen.add(norm);
              dedupedBatchItems.push({ ...item, code: norm });
            }
          }

          return { 
            batchItems: dedupedBatchItems,
            activeCode: lastAddedCode || state.activeCode
          };
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

        // Deduplicate before saving to history
        const uniqueMap = new Map<string, 'CASE' | 'TEMP'>();
        for (const item of items) {
          const canonical = normalizeCaseTempCode(item.code) || item.code.trim().toUpperCase();
          if (canonical) {
            uniqueMap.set(canonical, item.type);
          }
        }
        const uniqueItems = Array.from(uniqueMap.entries()).map(([code, type]) => ({ code, type }));

        const caseCount = uniqueItems.filter(i => i.type === 'CASE').length;
        const tempCount = uniqueItems.filter(i => i.type === 'TEMP').length;
        
        const newItem: HistoryItem = {
          id: typeof crypto !== 'undefined' && crypto.randomUUID 
            ? crypto.randomUUID() 
            : Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
          text: `Batch (${uniqueItems.length} codes: ${caseCount} CASE, ${tempCount} TEMP)`,
          timestamp: new Date().toISOString(),
          isFavorite: false,
          isBatch: true,
          batchCodes: uniqueItems,
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

