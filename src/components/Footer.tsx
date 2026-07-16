import { ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="flex flex-col sm:flex-row justify-between items-center py-5 border-t border-warehouse-border mt-8 text-xs text-warehouse-muted gap-2 text-center font-mono">
      <span>BinScan Utility PWA &bull; Powered by Tesseract.js & ZXing Browser</span>
      <span className="flex items-center gap-1.5 text-accent-teal font-semibold uppercase tracking-wider">
        <ShieldCheck size={14} />
        100% Client-Side Secured
      </span>
    </footer>
  );
}
