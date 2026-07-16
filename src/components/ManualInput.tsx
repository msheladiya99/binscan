import React from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, CheckCircle, X, Keyboard, Layers } from 'lucide-react';
import { validateWarehouseCode } from '../utils/regex';
import { useAppStore } from '../store/useAppStore';

export default function ManualInput() {
  const { setActiveCode, addToHistory } = useAppStore();
  const [entryMode, setEntryMode] = React.useState<'builder' | 'keyboard'>('builder');
  
  // Dropdown builder states
  const [builderType, setBuilderType] = React.useState<'standard' | 'chiller' | 'frozen'>('standard');
  const [selectedFloor, setSelectedFloor] = React.useState('F0');
  const [selectedAisle, setSelectedAisle] = React.useState('A01');
  const [selectedBay, setSelectedBay] = React.useState('001');
  const [selectedLevel, setSelectedLevel] = React.useState('01');
  const [selectedBin, setSelectedBin] = React.useState('A');

  const { register, watch, setValue } = useForm({
    defaultValues: {
      code: ''
    },
    mode: 'onChange'
  });

  const codeValue = watch('code');
  const [debouncedValue, setDebouncedValue] = React.useState('');

  // Auto-switch defaults when builderType changes
  React.useEffect(() => {
    if (builderType === 'standard') {
      setSelectedFloor('F0');
      setSelectedAisle('A01');
      setSelectedBay('001');
      setSelectedLevel('01');
    } else if (builderType === 'chiller') {
      setSelectedFloor('CR01');
      setSelectedAisle('001');
      setSelectedLevel('01');
    } else {
      setSelectedFloor('FR01');
      setSelectedAisle('001');
      setSelectedLevel('01');
    }
    setSelectedBin('A');
  }, [builderType]);

  // Synchronize builder dropdowns with generated code string
  React.useEffect(() => {
    if (entryMode === 'builder') {
      const code = builderType === 'standard'
        ? `${selectedFloor}-${selectedAisle}-${selectedBay}-${selectedLevel}-${selectedBin}`
        : builderType === 'chiller'
        ? `CR01-${selectedAisle}-${selectedLevel}-${selectedBin}`
        : `FR01-${selectedAisle}-${selectedLevel}-${selectedBin}`;
      setValue('code', code, { shouldValidate: true });
    }
  }, [entryMode, builderType, selectedFloor, selectedAisle, selectedBay, selectedLevel, selectedBin, setValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uppercased = e.target.value.toUpperCase().replace(/\s+/g, '');
    setValue('code', uppercased, { shouldValidate: true });
  };

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(codeValue);
    }, 200);
    return () => clearTimeout(handler);
  }, [codeValue]);

  // Push valid codes to QR viewer and storage
  React.useEffect(() => {
    const trimmed = debouncedValue.trim();
    if (trimmed && validateWarehouseCode(trimmed)) {
      setActiveCode(trimmed);
      addToHistory(trimmed);
    } else if (!trimmed) {
      setActiveCode('');
    }
  }, [debouncedValue, setActiveCode, addToHistory]);

  const isValid = codeValue && validateWarehouseCode(codeValue);
  const isInvalid = codeValue && !validateWarehouseCode(codeValue);

  // Generate selection lists
  const standardAisles = Array.from({ length: 15 }, (_, i) => `A${String(i + 1).padStart(2, '0')}`);
  const standardBays = Array.from({ length: 7 }, (_, i) => `00${i + 1}`);
  const standardLevels = Array.from({ length: 7 }, (_, i) => `0${i + 1}`);
  const binPositions = ['A', 'B', 'C'];

  const chillerAisles = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(3, '0'));
  const chillerLevels = Array.from({ length: 7 }, (_, i) => String(i + 1).padStart(2, '0'));
  const chillerBins = ['A', 'B', 'C', 'D', 'E', 'F'];

  const frozenAisles = Array.from({ length: 14 }, (_, i) => String(i + 1).padStart(3, '0'));
  const frozenLevels = Array.from({ length: 7 }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <div className="flex flex-col gap-4 py-2">
      {/* ── Mode selector tabs ── */}
      <div className="flex bg-warehouse-panel/40 p-1.5 rounded-lg border border-warehouse-border/60">
        <button
          type="button"
          onClick={() => setEntryMode('builder')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md font-mono text-xs font-bold cursor-pointer transition ${
            entryMode === 'builder' ? 'bg-accent-amber text-warehouse-bg shadow-sm' : 'text-warehouse-muted hover:text-warehouse-text'
          }`}
        >
          <Layers size={13} />
          SELECT BUILDER
        </button>
        <button
          type="button"
          onClick={() => setEntryMode('keyboard')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md font-mono text-xs font-bold cursor-pointer transition ${
            entryMode === 'keyboard' ? 'bg-accent-amber text-warehouse-bg shadow-sm' : 'text-warehouse-muted hover:text-warehouse-text'
          }`}
        >
          <Keyboard size={13} />
          KEYBOARD TYPE
        </button>
      </div>

      {/* ── Option A: Builder Selector grid ── */}
      {entryMode === 'builder' && (
        <div className="bg-warehouse-panel/20 border border-warehouse-border rounded-xl p-4 space-y-4">
          {/* Builder format switch */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setBuilderType('standard')}
              className={`flex-1 py-1.5 rounded font-sans text-xs font-bold border transition ${
                builderType === 'standard'
                  ? 'bg-accent-amber/10 border-accent-amber text-accent-amber'
                  : 'bg-transparent border-warehouse-border text-warehouse-muted hover:text-warehouse-text'
              }`}
            >
              Standard Rack
            </button>
            <button
              type="button"
              onClick={() => setBuilderType('chiller')}
              className={`flex-1 py-1.5 rounded font-sans text-xs font-bold border transition ${
                builderType === 'chiller'
                  ? 'bg-accent-teal/10 border-accent-teal text-accent-teal'
                  : 'bg-transparent border-warehouse-border text-warehouse-muted hover:text-warehouse-text'
              }`}
            >
              Chiller Room
            </button>
            <button
              type="button"
              onClick={() => setBuilderType('frozen')}
              className={`flex-1 py-1.5 rounded font-sans text-xs font-bold border transition ${
                builderType === 'frozen'
                  ? 'bg-accent-pink/10 border-accent-pink text-accent-pink'
                  : 'bg-transparent border-warehouse-border text-warehouse-muted hover:text-warehouse-text'
              }`}
            >
              Frozen Room
            </button>
          </div>

          {/* Select dropdowns grid */}
          <div className={`grid gap-3 ${builderType === 'standard' ? 'grid-cols-3 md:grid-cols-5' : 'grid-cols-2 md:grid-cols-4'}`}>
            {/* Floor/Zone prefix (locked) */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono font-bold text-warehouse-muted tracking-wider uppercase">
                {builderType === 'standard' ? 'Floor' : 'Zone'}
              </span>
              <div className="dropdown-select font-mono bg-warehouse-panel/40 flex items-center justify-start border border-warehouse-border text-warehouse-muted py-2 px-3 rounded-lg text-sm select-none font-semibold">
                {builderType === 'standard' ? 'F0' : builderType === 'chiller' ? 'CR01' : 'FR01'}
              </div>
            </div>

            {/* Aisle */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono font-bold text-warehouse-muted tracking-wider uppercase">
                {builderType === 'standard' ? 'Aisle' : builderType === 'chiller' ? 'Chiller' : 'FR Aisle'}
              </span>
              <select
                value={selectedAisle}
                onChange={(e) => setSelectedAisle(e.target.value)}
                className="dropdown-select font-mono"
              >
                {builderType === 'standard' && standardAisles.map(a => <option key={a} value={a}>{a}</option>)}
                {builderType === 'chiller' && chillerAisles.map(a => <option key={a} value={a}>{a}</option>)}
                {builderType === 'frozen' && frozenAisles.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Bay/Rack (not present in 4-segment Chiller/Frozen Room layouts) */}
            {builderType === 'standard' && (
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold text-warehouse-muted tracking-wider uppercase">Bay/Rack</span>
                <select
                  value={selectedBay}
                  onChange={(e) => setSelectedBay(e.target.value)}
                  className="dropdown-select font-mono"
                >
                  {standardBays.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            )}

            {/* Level */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-mono font-bold text-warehouse-muted tracking-wider uppercase">Level</span>
              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="dropdown-select font-mono"
              >
                {builderType === 'standard' && standardLevels.map(l => <option key={l} value={l}>{l}</option>)}
                {builderType === 'chiller' && chillerLevels.map(l => <option key={l} value={l}>{l}</option>)}
                {builderType === 'frozen' && frozenLevels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Bin */}
            <div className={`flex flex-col gap-1 ${builderType === 'standard' ? 'col-span-3 md:col-span-1' : 'col-span-2 md:col-span-1'}`}>
              <span className="text-[10px] font-mono font-bold text-warehouse-muted tracking-wider uppercase">Bin Pos</span>
              <select
                value={selectedBin}
                onChange={(e) => setSelectedBin(e.target.value)}
                className="dropdown-select font-mono"
              >
                {builderType === 'chiller'
                  ? chillerBins.map(b => <option key={b} value={b}>{b}</option>)
                  : binPositions.map(b => <option key={b} value={b}>{b}</option>)
                }
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Option B: Keyboard TextInput ── */}
      <div className="flex flex-col gap-2 font-sans">
        <label htmlFor="manual-input-field" className="text-xs font-mono font-bold text-accent-amber tracking-wider">
          {entryMode === 'builder' ? 'GENERATED LOCATION CODE' : 'LOCATION CODE INPUT'}
        </label>
        <div className="relative flex items-center">
          <input
            id="manual-input-field"
            type="text"
            placeholder="e.g. F0-A02-013-03-B, CR01-001-01-A, or FR01-001-01-A"
            {...register('code')}
            onChange={handleInputChange}
            disabled={entryMode === 'builder'}
            className={`w-full text-warehouse-text py-3.5 px-4 pr-12 rounded-lg font-mono text-base font-semibold outline-none transition ${
              entryMode === 'builder' ? 'bg-warehouse-panel/40 border-warehouse-border border text-warehouse-muted/80' : 'bg-warehouse-panel border-2 text-warehouse-text'
            } ${
              isValid ? 'border-accent-teal shadow-[0_0_8px_rgba(6,182,212,0.15)]' :
              isInvalid ? 'border-accent-red shadow-[0_0_8px_rgba(239,68,68,0.15)]' :
              entryMode === 'keyboard' ? 'border-warehouse-border focus:border-accent-amber focus:shadow-[0_0_8px_rgba(245,158,11,0.15)]' : ''
            }`}
            autoComplete="off"
            spellCheck="false"
          />
          {codeValue && entryMode === 'keyboard' && (
            <button
              type="button"
              onClick={() => { setValue('code', ''); setActiveCode(''); }}
              className="absolute right-4 text-warehouse-muted hover:text-warehouse-text transition cursor-pointer"
              title="Clear text"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Validation card info */}
      <div className="bg-warehouse-panel border border-warehouse-border rounded-lg p-4 font-sans text-xs space-y-3">
        <div className="flex items-start gap-2.5">
          {isValid ? (
            <CheckCircle size={16} className="text-accent-teal shrink-0 mt-0.5" />
          ) : isInvalid ? (
            <AlertCircle size={16} className="text-accent-red shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="text-warehouse-muted shrink-0 mt-0.5" />
          )}
          <div className="leading-relaxed">
            <span className="font-bold text-warehouse-text">Validation Format Status:</span>
            {isValid && <span className="text-accent-teal font-semibold font-mono block mt-1">MATCH FOUND: Valid Location Code</span>}
            {isInvalid && <span className="text-accent-red font-semibold font-mono block mt-1">ERROR: Expected F0-A00-000-00-C, CR01-000-00-A, or FR01-000-00-A</span>}
            {!codeValue && <span className="text-warehouse-muted block mt-1">Waiting for entry...</span>}
          </div>
        </div>
        
        <div className="text-warehouse-muted leading-relaxed font-sans border-t border-warehouse-border/50 pt-2.5 space-y-2 flex flex-col">
          <span className="font-semibold text-warehouse-text/90">Warehouse location formats:</span>
          
          <div className="flex items-start gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-amber mt-1.5 shrink-0" />
            <span className="text-[11px]">
              Standard Rack: <code className="mono-code font-mono text-[10px] text-warehouse-text px-1.5 py-0.5 bg-black/35 rounded">F0-A02-013-03-B</code>
            </span>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-teal mt-1.5 shrink-0" />
            <span className="text-[11px]">
              Chiller Room: <code className="mono-code font-mono text-[10px] text-warehouse-text px-1.5 py-0.5 bg-black/35 rounded">CR01-001-01-A</code> <span className="text-warehouse-muted/80">(Chiller 001 to 012)</span>
            </span>
          </div>
          
          <div className="flex items-start gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent-pink mt-1.5 shrink-0" />
            <span className="text-[11px]">
              Frozen Room: <code className="mono-code font-mono text-[10px] text-warehouse-text px-1.5 py-0.5 bg-black/35 rounded">FR01-001-01-A</code> <span className="text-warehouse-muted/80">(Frozen 001 to 014)</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
export type ManualInputProps = {};
