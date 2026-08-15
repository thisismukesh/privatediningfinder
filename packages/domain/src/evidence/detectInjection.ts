const WINDOW_RADIUS = 500;
const BASE64_BLOB_MIN_LENGTH = 200;

const INSTRUCTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous/i,
  /disregard\s+(the\s+)?above/i,
  /system\s+prompt/i,
  /you\s+are\s+now/i,
  /set\s+trust/i,
  /mark\s+as\s+verified/i,
  /assistant:/i,
  /<\/?(system|instruction)>/i,
];

// A run of base64 alphabet characters (letters, digits, +, /, =) at least 200 chars long.
const BASE64_BLOB_PATTERN = new RegExp(`[A-Za-z0-9+/=]{${BASE64_BLOB_MIN_LENGTH},}`);

const HIDDEN_STYLE_PATTERNS: RegExp[] = [
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /font-size\s*:\s*0\b/i,
];

// White-on-white: a color and a background-color (in either order) both set to white,
// expressed as the keyword or the common hex forms.
const WHITE = '(?:white|#fff|#ffffff)';
const WHITE_ON_WHITE_PATTERNS: RegExp[] = [
  new RegExp(`color\\s*:\\s*${WHITE}[^;"]*;?[^"]*background(?:-color)?\\s*:\\s*${WHITE}`, 'i'),
  new RegExp(`background(?:-color)?\\s*:\\s*${WHITE}[^;"]*;?[^"]*color\\s*:\\s*${WHITE}`, 'i'),
];

function windowAround(text: string, span: string): string {
  const index = text.indexOf(span);
  if (index === -1) return text;
  const start = Math.max(0, index - WINDOW_RADIUS);
  const end = Math.min(text.length, index + span.length + WINDOW_RADIUS);
  return text.slice(start, end);
}

export function detectInjection(text: string, span: string): boolean {
  if (text.length === 0) return false;

  const window = windowAround(text, span);

  for (const pattern of INSTRUCTION_PATTERNS) {
    if (pattern.test(window)) return true;
  }
  if (BASE64_BLOB_PATTERN.test(window)) return true;
  for (const pattern of HIDDEN_STYLE_PATTERNS) {
    if (pattern.test(window)) return true;
  }
  for (const pattern of WHITE_ON_WHITE_PATTERNS) {
    if (pattern.test(window)) return true;
  }

  return false;
}
