import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="flex flex-col sm:flex-row justify-between items-center py-5 border-t border-warehouse-border mt-8 text-xs text-warehouse-muted gap-3 text-center font-mono">
      <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-3">
        <span>BinScan Utility PWA &bull; Powered by Tesseract.js</span>
        <span className="hidden sm:block text-warehouse-border">&bull;</span>
        <span className="text-accent-amber font-bold tracking-wider">DEVELOPED BY MEET SHELADIYA</span>
      </div>
      <span className="flex items-center gap-1.5 text-accent-teal font-semibold uppercase tracking-wider">
        <ShieldCheck size={14} />
        100% Client-Side Secured
      </span>
    </footer>
  );
}
