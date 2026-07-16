export const WAREHOUSE_CODE_REGEX = /^[A-Z][0-9]-[A-Z][0-9]{2}-[0-9]{3}-[0-9]{2}-[A-Z]$/;
export const CHILLER_CODE_REGEX = /^CR[0-9]{2}-[0-9]{3}-[0-9]{2}-[A-Z]$/;
export const FROZEN_CODE_REGEX = /^FR[0-9]{2}-[0-9]{3}-[0-9]{2}-[A-Z]$/;

// OCR confusion map: characters that Tesseract commonly misreads
const DIGIT_FIXES: Record<string, string> = { O: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6', Q: '0' };
const LETTER_FIXES: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G' };

// Segment templates for standard rack format: F0-A02-013-03-B
const SEG_PATTERNS: ('L' | 'D')[][] = [
  ['L', 'D'],
  ['L', 'D', 'D'],
  ['D', 'D', 'D'],
  ['D', 'D'],
  ['L'],
];

// Segment templates for 4-segment formats: CR01-001-01-A / FR01-001-01-A
const FOUR_SEG_PATTERNS: ('L' | 'D')[][] = [
  ['L', 'L', 'D', 'D'],
  ['D', 'D', 'D'],
  ['D', 'D'],
  ['L'],
];

/**
 * Tries to auto-correct a raw OCR result to a valid warehouse, chiller, or frozen code
 * by fixing common character confusions at each positional slot.
 * Returns the corrected code if it passes validation, otherwise null.
 */
export function normalizeWarehouseCode(raw: string): string | null {
  const s = raw.trim().toUpperCase();
  if (s.length === 0) return null;

  // Strategy A: hyphens present — direct split on '-'
  if (s.includes('-')) {
    const parts = s.split('-');
    if (parts.length === 5) {
      const corrected = tryFixSegments(parts);
      if (corrected) return corrected;
    } else if (parts.length === 4) {
      if (parts[0].startsWith('C') || parts[0].startsWith('R')) {
        const corrected = tryFixFourSegments(parts, CHILLER_CODE_REGEX);
        if (corrected) return corrected;
      }
      if (parts[0].startsWith('F') || parts[0].startsWith('R') || (parts[0].length === 4 && !/[A-Z]/.test(parts[0].slice(2)))) {
        const corrected = tryFixFourSegments(parts, FROZEN_CODE_REGEX);
        if (corrected) return corrected;
      }
    }
  }

  // Strategy B: separators are spaces/dots/other non-alphanumeric chars
  const spaceParts = s.split(/[^A-Z0-9]+/).filter(p => p.length > 0);
  if (spaceParts.length === 5) {
    const corrected = tryFixSegments(spaceParts);
    if (corrected) return corrected;
  } else if (spaceParts.length === 4) {
    if (spaceParts[0].startsWith('C') || spaceParts[0].startsWith('R')) {
      const corrected = tryFixFourSegments(spaceParts, CHILLER_CODE_REGEX);
      if (corrected) return corrected;
    }
    if (spaceParts[0].startsWith('F') || spaceParts[0].startsWith('R') || (spaceParts[0].length === 4 && !/[A-Z]/.test(spaceParts[0].slice(2)))) {
      const corrected = tryFixFourSegments(spaceParts, FROZEN_CODE_REGEX);
      if (corrected) return corrected;
    }
  }

  // Strategy C: no separators at all — try to slice at known lengths
  const stripped = s.replace(/[^A-Z0-9]/g, '');
  if (stripped.startsWith('CR') || stripped.startsWith('C8') || stripped.startsWith('C0')) {
    if (stripped.length === 10) {
      const parts = [
        stripped.slice(0, 4),
        stripped.slice(4, 7),
        stripped.slice(7, 9),
        stripped.slice(9, 10),
      ];
      const corrected = tryFixFourSegments(parts, CHILLER_CODE_REGEX);
      if (corrected) return corrected;
    }
  } else if (stripped.startsWith('FR') || stripped.startsWith('F8') || stripped.startsWith('F0')) {
    if (stripped.length === 10) {
      const parts = [
        stripped.slice(0, 4),
        stripped.slice(4, 7),
        stripped.slice(7, 9),
        stripped.slice(9, 10),
      ];
      const corrected = tryFixFourSegments(parts, FROZEN_CODE_REGEX);
      if (corrected) return corrected;
    }
  } else if (stripped.length === 11) {
    const parts = [
      stripped.slice(0, 2),
      stripped.slice(2, 5),
      stripped.slice(5, 8),
      stripped.slice(8, 10),
      stripped.slice(10, 11),
    ];
    const corrected = tryFixSegments(parts);
    if (corrected) return corrected;
  }

  return null;
}

function tryFixSegments(parts: string[]): string | null {
  if (parts.length !== 5) return null;
  const segs: string[] = [];
  for (let i = 0; i < 5; i++) {
    const fixed = fixChars(parts[i], SEG_PATTERNS[i]);
    if (!fixed) return null;
    segs.push(fixed);
  }
  const candidate = segs.join('-');
  return WAREHOUSE_CODE_REGEX.test(candidate) ? candidate : null;
}

function tryFixFourSegments(parts: string[], regex: RegExp): string | null {
  if (parts.length !== 4) return null;
  const segs: string[] = [];
  for (let i = 0; i < 4; i++) {
    const fixed = fixChars(parts[i], FOUR_SEG_PATTERNS[i]);
    if (!fixed) return null;
    segs.push(fixed);
  }
  const candidate = segs.join('-');
  return regex.test(candidate) ? candidate : null;
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

/**
 * Extract all candidate warehouse codes from raw OCR text using multiple strategies.
 * Returns array of unique valid codes.
 */
export function extractWarehouseCodes(rawOcrText: string): string[] {
  const s = rawOcrText.toUpperCase();
  const found = new Set<string>();

  // Strategy 1: hyphen-separated segments (standard / chiller / frozen)
  const hyphenRe = /[A-Z0-9]{1,5}(?:-[A-Z0-9]{1,5}){2,7}/g;
  for (const m of s.matchAll(hyphenRe)) {
    if (validateWarehouseCode(m[0])) { found.add(m[0]); continue; }
    const n = normalizeWarehouseCode(m[0]);
    if (n) found.add(n);
  }

  // Strategy 2: space-separated segments (standard rack)
  // Pattern: 2chars SEP 3chars SEP 3chars SEP 2chars SEP 1char
  const spacedRe = /([A-Z0-9]{2})[^A-Z0-9]{1,3}([A-Z0-9]{3})[^A-Z0-9]{1,3}([A-Z0-9]{3})[^A-Z0-9]{1,3}([A-Z0-9]{2})[^A-Z0-9]{1,3}([A-Z0-9]{1})(?![A-Z0-9])/g;
  for (const m of s.matchAll(spacedRe)) {
    const candidate = `${m[1]}-${m[2]}-${m[3]}-${m[4]}-${m[5]}`;
    if (validateWarehouseCode(candidate)) { found.add(candidate); continue; }
    const n = normalizeWarehouseCode(candidate);
    if (n) found.add(n);
  }

  // Strategy 2b: space-separated segments (chiller/frozen 4-segment formats)
  // Pattern: CR01/FR01 (4chars) SEP 3digits SEP 2digits SEP 1char
  const fourSegSpacedRe = /(CR[0-9]{2}|FR[0-9]{2}|C8[0-9]{2}|F8[0-9]{2})[^A-Z0-9]{1,3}([A-Z0-9]{3})[^A-Z0-9]{1,3}([A-Z0-9]{2})[^A-Z0-9]{1,3}([A-Z0-9]{1})(?![A-Z0-9])/g;
  for (const m of s.matchAll(fourSegSpacedRe)) {
    const candidate = `${m[1]}-${m[2]}-${m[3]}-${m[4]}`;
    if (validateWarehouseCode(candidate)) { found.add(candidate); continue; }
    const n = normalizeWarehouseCode(candidate);
    if (n) found.add(n);
  }

  // Strategy 3: 11 consecutive alphanumeric chars sliced at known boundaries (standard rack)
  const denseRe = /(?<![A-Z0-9])([A-Z0-9]{11})(?![A-Z0-9])/g;
  for (const m of s.matchAll(denseRe)) {
    const n = normalizeWarehouseCode(m[1]);
    if (n) found.add(n);
  }

  // Strategy 3b: dense chiller/frozen room alphanumeric string (10 characters starting with CR or FR)
  const denseFourSegRe = /(?<![A-Z0-9])((?:CR|FR|C8|F8)[A-Z0-9]{8})(?![A-Z0-9])/g;
  for (const m of s.matchAll(denseFourSegRe)) {
    const n = normalizeWarehouseCode(m[1]);
    if (n) found.add(n);
  }

  return Array.from(found);
}

export const validateWarehouseCode = (code: string): boolean => {
  const clean = code.trim().toUpperCase();
  return WAREHOUSE_CODE_REGEX.test(clean) || CHILLER_CODE_REGEX.test(clean) || FROZEN_CODE_REGEX.test(clean);
};
