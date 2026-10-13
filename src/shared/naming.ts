export const DEFAULT_NAMING_PATTERN = "{name}-RTO";

export type PatternContext = { name: string; seq: number; date: string };

/** Replace {name}, {seq} and {date} in the pattern; other text passes through untouched. */
export function applyPattern(pattern: string, ctx: PatternContext): string {
  return pattern.replaceAll("{name}", ctx.name).replaceAll("{seq}", String(ctx.seq)).replaceAll("{date}", ctx.date);
}

/** Strip characters Windows forbids in file names; a name left empty falls back to "invoice". */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[/\\:*?"<>|]/g, "_").trim();
  const stem = cleaned.replace(/\.pdf$/i, "");
  const safe = /[a-zA-Z0-9]/.test(stem) ? stem : "invoice";
  return `${safe}.pdf`;
}

/** Pattern → sanitised file name, ready for uniqueName() dedup. */
export function resolveSaveName(pattern: string, ctx: PatternContext): string {
  return sanitizeFileName(applyPattern(pattern, ctx));
}

/**
 * The name to save as: the user's per-file override (sanitised), or the
 * pattern-derived fallback for that file.
 */
export function sanitizeSaveName(saveName: string | undefined, fallbackStem: string): string {
  return saveName !== undefined && saveName.trim() !== ""
    ? sanitizeFileName(saveName)
    : sanitizeFileName(fallbackStem);
}
