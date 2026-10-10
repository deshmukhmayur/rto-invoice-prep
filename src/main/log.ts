import { appendFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import type { LogKind, LogLine } from "../shared/log";

export type { LogKind, LogLine };

let logsDir: string | null = null;

export function initLog(userDataDir: string): string {
  logsDir = join(userDataDir, "logs");
  return logFilePath();
}

export function logFilePath(): string {
  return monthFilePath();
}

export function logsDirectory(): string {
  if (!logsDir) throw new Error("Log not initialised");
  return logsDir;
}

export function monthFilePath(): string {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return join(logsDirectory(), `rto-invoice-prep-${month}.log`);
}

const session: LogLine[] = [];

export function sessionLines(): LogLine[] {
  return [...session];
}

/** Text of this session's log, as shown in the modal and saved by Download. */
export function sessionLogText(): string {
  return session.map((l) => `${l.time} ${l.text}`).join("\n") + (session.length ? "\n" : "");
}

/** Append an entry to the monthly log; logging must never break the app. */
export async function appendLog(kind: LogKind, text: string): Promise<void> {
  if (!logsDir) return;
  const time = new Date().toISOString();
  const line = `${kind} ${text}`;
  session.push({ kind, time, text: line });
  try {
    const path = monthFilePath();
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${time} ${line}\n`);
  } catch {
    // ignore — the log is best-effort
  }
}
