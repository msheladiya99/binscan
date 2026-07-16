export const WAREHOUSE_CODE_REGEX = /^[A-Z][0-9]-[A-Z][0-9]{2}-[0-9]{3}-[0-9]{2}-[A-Z]$/;

// OCR confusion map: characters that Tesseract commonly misreads
const DIGIT_FIXES: Record<string, string> = { O: '0', I: '1', L: '1', S: '5', B: '8', Z: '2', G: '6', Q: '0' };
const LETTER_FIXES: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G' };

/**
 * Tries to auto-correct a raw OCR result to a valid warehouse code by fixing
 * common character confusions at each positional slot:
 *   Slot format: [L][D]-[L][D][D]-[D][D][D]-[D][D]-[L]
 *   L = letter position, D = digit position
 * Returns the corrected code if it passes validation, otherwise null.
 */
export function normalizeWarehouseCode(raw: string): string | null {
  // Remove all whitespace, uppercase
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (s.length === 0) return null;

  // Must have 4 hyphens → 5 segments
  const parts = s.split('-');
  if (parts.length !== 5) return null;

  const [p0, p1, p2, p3, p4] = parts;

  // Fix each segment based on expected letter/digit positions
  // Seg 0: LD (1 letter + 1 digit)
  const s0 = fixChars(p0, ['L', 'D']);
  // Seg 1: LDD (1 letter + 2 digits)
  const s1 = fixChars(p1, ['L', 'D', 'D']);
  // Seg 2: DDD (3 digits)
  const s2 = fixChars(p2, ['D', 'D', 'D']);
  // Seg 3: DD (2 digits)
  const s3 = fixChars(p3, ['D', 'D']);
  // Seg 4: L (1 letter)
  const s4 = fixChars(p4, ['L']);

  if (!s0 || !s1 || !s2 || !s3 || !s4) return null;

  const candidate = `${s0}-${s1}-${s2}-${s3}-${s4}`;
  return WAREHOUSE_CODE_REGEX.test(candidate) ? candidate : null;
}

function fixChars(segment: string, pattern: ('L' | 'D')[]): string | null {
  if (segment.length !== pattern.length) return null;
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = segment[i];
    if (pattern[i] === 'D') {
      // Should be digit: fix common letter-for-digit mistakes
      const fixed = /[0-9]/.test(ch) ? ch : DIGIT_FIXES[ch];
      if (!fixed) return null;
      out += fixed;
    } else {
      // Should be letter: fix common digit-for-letter mistakes
      const fixed = /[A-Z]/.test(ch) ? ch : LETTER_FIXES[ch];
      if (!fixed) return null;
      out += fixed;
    }
  }
  return out;
}

export const validateWarehouseCode = (code: string): boolean => {
  return WAREHOUSE_CODE_REGEX.test(code.trim().toUpperCase());
};
