/** Reserve a unique file name, case-insensitively (batch may contain duplicates). */
export function uniqueName(name: string, used: Set<string>): string {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";
  let candidate = name;
  let i = 2;
  while (used.has(candidate.toLowerCase())) candidate = `${stem} (${i++})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}