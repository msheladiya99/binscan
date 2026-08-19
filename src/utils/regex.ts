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
export const CASE_CODE_REGEX = /^[0-9]+_CASE_[0-9]{8}$/;
export const TEMP_CODE_REGEX = /^[0-9]+_TEMP_[0-9]{8}$/;
export const PERM_CODE_REGEX = /^[0-9]+_PERM_[0-9]{8}$/;

export function validateCaseCode(code: string): boolean {
  return CASE_CODE_REGEX.test(code.trim().toUpperCase());
}

export function validateTempCode(code: string): boolean {
  return TEMP_CODE_REGEX.test(code.trim().toUpperCase());
}

export function validatePermCode(code: string): boolean {
  return PERM_CODE_REGEX.test(code.trim().toUpperCase());
}

/**
 * Normalizes a raw warehouse CASE/TEMP/PERM code string.
 * Trims whitespace, converts to uppercase, removes accidental internal spaces around underscores,
 * and corrects positional digit misreads (O->0, I->1, L->1, S->5, B->8).
 */
export function normalizeCaseTempCode(raw: string): string | null {
  if (!raw) return null;
  // Basic cleanup: trim, uppercase, collapse extra spaces around underscores
  let cleaned = raw.trim().toUpperCase().replace(/\s*_\s*/g, '_');
  
  // If it already matches perfectly
  if (CASE_CODE_REGEX.test(cleaned) || TEMP_CODE_REGEX.test(cleaned) || PERM_CODE_REGEX.test(cleaned)) {
    return cleaned;
  }

  // Attempt positional normalization: DIGITS_(CASE|TEMP|PERM)_8DIGITS
  const match = cleaned.match(/^([A-Z0-9]+)_(CASE|TEMP|PERM)_([A-Z0-9]+)$/);
  if (match) {
    const [, prefix, mode, suffix] = match;
    // Fix digits in prefix and suffix
    const fixedPrefix = fixDigitsOnly(prefix);
    const fixedSuffix = fixDigitsOnly(suffix);
    
    if (fixedPrefix && fixedSuffix && fixedSuffix.length === 8) {
      const candidate = `${fixedPrefix}_${mode}_${fixedSuffix}`;
      if (CASE_CODE_REGEX.test(candidate) || TEMP_CODE_REGEX.test(candidate) || PERM_CODE_REGEX.test(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function fixDigitsOnly(str: string): string | null {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (/[0-9]/.test(ch)) {
      out += ch;
    } else if (DIGIT_FIXES[ch]) {
      out += DIGIT_FIXES[ch];
    } else {
      return null;
    }
  }
  return out;
}

export interface ExtractedBatchResult {
  validCodes: { code: string; type: 'CASE' | 'TEMP' }[];
  ignoredCodes: string[];
}

/**
 * Extracts all visible candidate CASE, TEMP, and PERM codes from OCR text or multi-line string.
 * Multi-code detection support. Deduplicates results.
 */
export function extractCaseTempCodes(rawText: string): ExtractedBatchResult {
  if (!rawText) return { validCodes: [], ignoredCodes: [] };

  const validSet = new Map<string, 'CASE' | 'TEMP'>();
  const ignoredSet = new Set<string>();

  // 1. Process line by line and token by token after cleaning spaces around underscores
  const cleanedText = rawText.toUpperCase().replace(/\s*_\s*/g, '_');
  
  // Match potential candidate tokens containing _CASE_, _TEMP_, or _PERM_
  const candidateRegex = /[A-Z0-9]+_(?:CASE|TEMP|PERM)_[A-Z0-9]+/g;
  const matches = cleanedText.match(candidateRegex) || [];

  for (const m of matches) {
    const normalized = normalizeCaseTempCode(m);
    if (!normalized) continue;

    if (validateCaseCode(normalized)) {
      validSet.set(normalized, 'CASE');
    } else if (validateTempCode(normalized)) {
      validSet.set(normalized, 'TEMP');
    } else if (validatePermCode(normalized)) {
      ignoredSet.add(normalized);
    }
  }

  // 2. Also split by whitespace/newlines and test tokens directly in case regex missed surrounding boundaries
  const tokens = cleanedText.split(/[\s,;\r\n]+/);
  for (const token of tokens) {
    if (!token) continue;
    const normalized = normalizeCaseTempCode(token);
    if (!normalized) continue;

    if (validateCaseCode(normalized)) {
      validSet.set(normalized, 'CASE');
    } else if (validateTempCode(normalized)) {
      validSet.set(normalized, 'TEMP');
    } else if (validatePermCode(normalized)) {
      ignoredSet.add(normalized);
    }
  }

  const validCodes = Array.from(validSet.entries()).map(([code, type]) => ({ code, type }));
  const ignoredCodes = Array.from(ignoredSet);

  return { validCodes, ignoredCodes };
}
