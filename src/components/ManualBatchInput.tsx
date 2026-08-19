import React, { useState } from 'react';
import { Clipboard, CheckCircle, AlertTriangle, Trash2, ArrowRight } from 'lucide-react';
import { extractCaseTempCodes } from '../utils/regex';
import { useAppStore } from '../store/useAppStore';

interface ManualBatchInputProps {
  onSuccess?: (msg: string) => void;
}

export default function ManualBatchInput({ onSuccess }: ManualBatchInputProps) {
  const [inputText, setInputText] = useState('');
  const [lastParseStats, setLastParseStats] = useState<{
    caseCount: number;
    tempCount: number;
    ignoredCount: number;
  } | null>(null);

  const { addBatchCodes, addIgnoredBatchCodes } = useAppStore();

  const handleProcessInput = (textToProcess: string) => {
    if (!textToProcess.trim()) return;

    const { validCodes, ignoredCodes } = extractCaseTempCodes(textToProcess);

    if (ignoredCodes.length > 0) {
      addIgnoredBatchCodes(ignoredCodes);
    }

    const caseCount = validCodes.filter(c => c.type === 'CASE').length;
    const tempCount = validCodes.filter(c => c.type === 'TEMP').length;

    if (validCodes.length > 0) {
      addBatchCodes(validCodes);
      setLastParseStats({
        caseCount,
        tempCount,
        ignoredCount: ignoredCodes.length
      });

      if (onSuccess) {
        onSuccess(`Processed ${validCodes.length} codes (${caseCount} CASE, ${tempCount} TEMP)`);
      }
    } else if (ignoredCodes.length > 0) {
      setLastParseStats({
        caseCount: 0,
        tempCount: 0,
        ignoredCount: ignoredCodes.length
      });
      if (onSuccess) {
        onSuccess(`0 valid CASE/TEMP codes found (${ignoredCodes.length} PERM code(s) ignored)`);
      }
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    handleProcessInput(val);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInputText(text);
        handleProcessInput(text);
      }
    } catch {
      // Clipboard permission fallback
    }
  };

  const handleLoadSample = () => {
    const sample = `4992_CASE_00501106
4992_CASE_00501103
4992_CASE_00486770
44_PERM_00131085
582_TEMP_03771296
582_TEMP_03776757
582_TEMP_03771795`;
    setInputText(sample);
    handleProcessInput(sample);
  };

  const handleClear = () => {
    setInputText('');
    setLastParseStats(null);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-warehouse-text tracking-wide uppercase">
            Paste / Type Codes
          </h3>
          <p className="text-xs text-warehouse-muted">
            Enter multi-line CASE or TEMP warehouse codes
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleLoadSample}
            className="px-2.5 py-1 text-xs font-mono font-semibold bg-warehouse-panel hover:bg-warehouse-border border border-warehouse-border rounded text-accent-amber transition"
          >
            LOAD SAMPLE
          </button>
          <button
            onClick={handlePasteClipboard}
            className="px-2.5 py-1 text-xs font-mono font-semibold bg-warehouse-panel hover:bg-warehouse-border border border-warehouse-border rounded text-accent-teal flex items-center gap-1 transition"
          >
            <Clipboard size={12} />
            PASTE
          </button>
        </div>
      </div>

      <div className="relative">
        <textarea
          value={inputText}
          onChange={handleTextareaChange}
          placeholder={`4992_CASE_00501106\n4992_CASE_00501103\n582_TEMP_03771296\n...`}
          rows={6}
          className="w-full bg-warehouse-bg border border-warehouse-border focus:border-accent-amber rounded-lg p-3 text-sm font-mono text-warehouse-text placeholder:text-warehouse-muted/50 outline-none transition resize-y"
        />

        {inputText && (
          <button
            onClick={handleClear}
            className="absolute top-2 right-2 p-1.5 bg-warehouse-card/80 hover:bg-warehouse-panel border border-warehouse-border rounded text-warehouse-muted hover:text-accent-red transition"
            title="Clear text"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {lastParseStats && (
        <div className="bg-warehouse-panel border border-warehouse-border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} className="text-accent-teal" />
            <span className="text-warehouse-text font-bold">
              Extracted: {lastParseStats.caseCount + lastParseStats.tempCount} unique
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-accent-amber font-semibold">CASE: {lastParseStats.caseCount}</span>
            <span className="text-accent-teal font-semibold">TEMP: {lastParseStats.tempCount}</span>
            {lastParseStats.ignoredCount > 0 && (
              <span className="text-warehouse-muted flex items-center gap-1 bg-warehouse-card border border-warehouse-border px-2 py-0.5 rounded">
                <AlertTriangle size={12} className="text-accent-red" />
                PERM Ignored: {lastParseStats.ignoredCount}
              </span>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => handleProcessInput(inputText)}
        disabled={!inputText.trim()}
        className="btn btn-primary w-full py-2.5 text-xs tracking-wider uppercase font-bold flex items-center justify-center gap-2"
      >
        <span>ADD ALL TO QR BATCH</span>
        <ArrowRight size={14} />
      </button>
    </div>
  );
}
