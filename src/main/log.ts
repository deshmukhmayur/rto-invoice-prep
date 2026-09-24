import { appendFile, mkdir } from "fs/promises";
import { dirname, join } from "path";

let filePath: string | null = null;

export function initLog(userDataDir: string): string {
  filePath = join(userDataDir, "rto-invoice-prep.log");
  return filePath;
}

export function logFilePath(): string {
  if (!filePath) throw new Error("Log not initialised");
  return filePath;
}

/** Append a line to the batch log; logging must never break the app. */
export async function appendLog(line: string): Promise<void> {
  if (!filePath) return;
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // ignore — the log is best-effort
  }
}