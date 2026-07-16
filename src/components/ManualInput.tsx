import React from 'react';
import { useForm } from 'react-hook-form';
import { AlertCircle, CheckCircle, X } from 'lucide-react';
import { validateWarehouseCode } from '../utils/regex';
import { useAppStore } from '../store/useAppStore';

export default function ManualInput() {
  const { setActiveCode, addToHistory } = useAppStore();
  const { register, watch, setValue } = useForm({
    defaultValues: {
      code: ''
    },
    mode: 'onChange'
  });

  const codeValue = watch('code');
  const [debouncedValue, setDebouncedValue] = React.useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uppercased = e.target.value.toUpperCase().replace(/\s+/g, '');
    setValue('code', uppercased, { shouldValidate: true });
  };

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(codeValue);
    }, 300);

    return () => clearTimeout(handler);
  }, [codeValue]);

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

  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex flex-col gap-2 font-sans">
        <label htmlFor="manual-input-field" className="text-xs font-mono font-bold text-accent-amber tracking-wider">
          LOCATION CODE INPUT
        </label>
        <div className="relative flex items-center">
          <input
            id="manual-input-field"
            type="text"
            placeholder="e.g. F0-A02-013-03-B"
            {...register('code')}
            onChange={handleInputChange}
            className={`w-full bg-warehouse-panel border-2 text-warehouse-text py-3.5 px-4 pr-12 rounded-lg font-mono text-base font-semibold outline-none transition ${
              isValid ? 'border-accent-teal shadow-[0_0_8px_rgba(6,182,212,0.15)]' :
              isInvalid ? 'border-accent-red shadow-[0_0_8px_rgba(239,68,68,0.15)]' :
              'border-warehouse-border focus:border-accent-amber focus:shadow-[0_0_8px_rgba(245,158,11,0.15)]'
            }`}
            autoComplete="off"
            spellCheck="false"
          />
          {codeValue && (
            <button
              type="button"
              onClick={() => { setValue('code', ''); setActiveCode(''); }}
              className="absolute right-4 text-warehouse-muted hover:text-warehouse-text transition"
              title="Clear text"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

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
            {isInvalid && <span className="text-accent-red font-semibold font-mono block mt-1">ERROR: Standard format is A0-B00-000-00-C</span>}
            {!codeValue && <span className="text-warehouse-muted block mt-1">Waiting for entry...</span>}
          </div>
        </div>
        
        <p className="text-warehouse-muted leading-relaxed font-sans border-t border-warehouse-border/50 pt-2.5">
          Warehouse rack labeling codes must strictly conform to:
          <code className="mono-code ml-1 font-mono text-[10px]">^[A-Z][0-9]-[A-Z][0-9]&#123;2&#125;-[0-9]&#123;3&#125;-[0-9]&#123;2&#125;-[A-Z]$</code>
        </p>
      </div>
    </div>
  );
}
export type ManualInputProps = {};
