import React from 'react';
import { X, ChevronDown } from 'lucide-react';

interface CustomSelectProps {
  label: string;
  value: string;
  options: string[];
  onChange: (val: string) => void;
}

export default function CustomSelect({ label, value, options, onChange }: CustomSelectProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-mono font-bold text-warehouse-muted tracking-wider uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="dropdown-select font-mono text-left flex items-center justify-between"
          style={{ backgroundImage: 'none', paddingRight: '14px' }}
        >
          <span>{value}</span>
          <ChevronDown size={14} className="text-warehouse-muted shrink-0 ml-2" />
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end sm:justify-center items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-warehouse-card border border-warehouse-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-sticker-appear">
            <div className="flex justify-between items-center p-4 border-b border-warehouse-border bg-warehouse-panel shrink-0">
              <span className="font-mono font-bold text-accent-amber tracking-wider uppercase text-sm">SELECT {label}</span>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-warehouse-border/50 text-warehouse-muted hover:text-warehouse-text rounded-full transition cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-2 flex flex-col gap-1 font-mono pb-safe-bottom">
              {options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => {
                    onChange(opt);
                    setIsOpen(false);
                  }}
                  className={`py-3.5 px-4 rounded-xl text-left font-bold transition flex justify-between items-center cursor-pointer ${
                    value === opt 
                      ? 'bg-accent-teal/10 text-accent-teal' 
                      : 'hover:bg-warehouse-panel text-warehouse-text'
                  }`}
                >
                  {opt}
                  {value === opt && <span className="w-2.5 h-2.5 rounded-full bg-accent-teal shadow-[0_0_8px_#06b6d4]"></span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
