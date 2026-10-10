import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, readdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { appendLog, initLog } from "./log";

describe("log", () => {
  test("appends to the monthly file without ever truncating it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rto-log-"));
    const path = initLog(dir);
    expect(path).toMatch(/logs[\\/]rto-invoice-prep-\d{4}-\d{2}\.log$/);

    await appendLog("OK", "a.pdf — parsed");
    const first = await readFile(path, "utf8");
    expect(first).toContain("OK a.pdf — parsed");

    await appendLog("REFUSED", "b.pdf: already prepared");
    const second = await readFile(path, "utf8");
    expect(second).toContain("OK a.pdf — parsed");
    expect(second).toContain("REFUSED b.pdf: already prepared");
    expect(second.length).toBeGreaterThan(first.length);

    expect((await readdir(join(dir, "logs"))).length).toBe(1);
  });

  test("session buffer captures each line with its kind", async () => {
    const dir = await mkdtemp(join(tmpdir(), "rto-log-"));
    initLog(dir);
    await appendLog("OK", "a.pdf — parsed");
    await appendLog("REFUSED", "b.pdf: reason");
    await appendLog("FAILED", "c.pdf: boom");
    await appendLog("ERROR", "d.pdf: parser crash — x");
    const lines = (await import("./log")).sessionLines().slice(-4);
    expect(lines.map((l) => l.kind)).toEqual(["OK", "REFUSED", "FAILED", "ERROR"]);
    const text = (await import("./log")).sessionLogText();
    expect(text).toContain("REFUSED b.pdf: reason");
    expect(text).toContain("ERROR d.pdf: parser crash — x");
  });
});
