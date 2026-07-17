export const WAREHOUSE_CODE_REGEX = /^F0-[A-Z][0-9]{2}-[0-9]{3}-[0-9]{2}-[A-Z]$/;
export const CHILLER_CODE_REGEX = /^F0-CR[0-9]{2}-[0-9]{3}-[0-9]{2}-[A-Z]$/;
export const FROZEN_CODE_REGEX = /^F0-FR[0-9]{2}-[0-9]{3}-[0-9]{2}-[A-Z]$/;
export const FNV_CODE_REGEX = /^F0-FV[0-9]{2}-[0-9]{3}-[0-9]{2}-[A-Z]$/;

// Internal regex that accepts any valid code format
export const ALL_CODE_REGEX = /^F0-([A-Z][0-9]{2}|CR[0-9]{2}|FR[0-9]{2}|FV[0-9]{2})-[0-9]{3}-[0-9]{2}-[A-Z]$/;

export function validateWarehouseCode(code: string): boolean {
  return ALL_CODE_REGEX.test(code);
}

// OCR confusion map: characters that Tesseract commonly misreads
const DIGIT_FIXES: Record<string, string> = { O: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6', Q: '0' };
const LETTER_FIXES: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G' };

export function normalizeWarehouseCode(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (s.length === 0) return null;

  // Strategy A: hyphens present — direct split on '-'
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length === 5) {
      const corrected = tryFixSegments(parts);
      if (corrected) return corrected;
    }
  }

  // Strategy B: separators are spaces/dots/other non-alphanumeric chars
  const spaceParts = s.split(/[^A-Z0-9]+/).filter(p => p.length > 0);
  if (spaceParts.length === 5) {
    const corrected = tryFixSegments(spaceParts);
    if (corrected) return corrected;
  }

  // Strategy C: no separators at all — try to slice at known lengths
  const stripped = s.replace(/[^A-Z0-9]/g, '');
  if (stripped.length === 11 || stripped.length === 12) {
    const seg2Len = stripped.length === 11 ? 3 : 4;
    const parts = [
      stripped.slice(0, 2),
      stripped.slice(2, 2 + seg2Len),
      stripped.slice(2 + seg2Len, 5 + seg2Len),
      stripped.slice(5 + seg2Len, 7 + seg2Len),
      stripped.slice(7 + seg2Len, 8 + seg2Len),
    ];
    const corrected = tryFixSegments(parts);
    if (corrected) return corrected;
  }

  return null;
}

function tryFixSegments(parts: string[]): string | null {
  if (parts.length !== 5) return null;
  const segs: string[] = [];
  
  segs.push(fixChars(parts[0], ['L', 'D']) || '');
  
  const part1 = parts[1];
  const seg1Pattern: ('L'|'D')[] = part1.length === 4 ? ['L', 'L', 'D', 'D'] : ['L', 'D', 'D'];
  segs.push(fixChars(part1, seg1Pattern) || '');
  
  segs.push(fixChars(parts[2], ['D', 'D', 'D']) || '');
  segs.push(fixChars(parts[3], ['D', 'D']) || '');
  segs.push(fixChars(parts[4], ['L']) || '');

  if (segs.some(s => s === '')) return null;

  const candidate = segs.join('-');
  return ALL_CODE_REGEX.test(candidate) ? candidate : null;
}

function fixChars(segment: string, pattern: ('L' | 'D')[]): string | null {
  if (segment.length !== pattern.length) return null;
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = segment[i];
    if (pattern[i] === 'D') {
      const fixed = /[0-9]/.test(ch) ? ch : DIGIT_FIXES[ch];
      if (!fixed) return null;
      out += fixed;
    } else {
      const fixed = /[A-Z]/.test(ch) ? ch : LETTER_FIXES[ch];
      if (!fixed) return null;
      out += fixed;
    }
  }
  return out;
}

export function extractWarehouseCodes(rawOcrText: string): string[] {
  const s = rawOcrText.toUpperCase();
  const found = new Set<string>();

  // Use a generic pattern matching 5 segments
  const hyphenRe = /[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5}){4}/g;
  for (const m of s.matchAll(hyphenRe)) {
    const fixed = normalizeWarehouseCode(m[0]);
    if (fixed) found.add(fixed);
  }

  // Also try continuous lines stripping spaces
  const lines = s.split('\n');
  for (const line of lines) {
    const stripped = line.replace(/[^A-Z0-9]/g, '');
    const fixed = normalizeWarehouseCode(stripped);
    if (fixed) found.add(fixed);
  }

  return Array.from(found);
}
