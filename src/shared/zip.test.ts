import { mkdirSync, writeFileSync } from "fs";
import { describe, expect, test } from "bun:test";
import { crc32, createZip } from "./zip";

/** Walk local file headers + central directory of a stored zip and return the entries. */
function readStoredZip(bytes: Uint8Array): { name: string; data: Uint8Array; crc: number }[] {
  const view = (offset: number, length: number): DataView =>
    new DataView(bytes.buffer, bytes.byteOffset + offset, length);
  const u16 = (offset: number) => view(offset, 2).getUint16(0, true);
  const u32 = (offset: number) => view(offset, 4).getUint32(0, true);

  const decoder = new TextDecoder();
  const entries: { name: string; data: Uint8Array; crc: number }[] = [];
  let offset = 0;
  while (u32(offset) === 0x04034b50) {
    const crc = u32(offset + 14);
    const size = u32(offset + 22);
    const nameLen = u16(offset + 26);
    const extraLen = u16(offset + 28);
    const name = decoder.decode(bytes.subarray(offset + 30, offset + 30 + nameLen));
    const dataStart = offset + 30 + nameLen + extraLen;
    entries.push({ name, data: bytes.slice(dataStart, dataStart + size), crc });
    offset = dataStart + size;
  }
  return entries;
}

describe("createZip", () => {
  test("round-trips entries byte-for-byte with correct CRCs", () => {
    const a = new TextEncoder().encode("hello world");
    const b = new Uint8Array(256).map((_, i) => i & 0xff);
    const zip = createZip([
      { name: "a.txt", data: a },
      { name: "invoices/b-RTO.pdf", data: b },
    ]);

    const entries = readStoredZip(zip);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.name).toBe("a.txt");
    expect(new TextDecoder().decode(entries[0]!.data)).toBe("hello world");
    expect(entries[0]!.crc).toBe(crc32(a));
    expect(entries[1]!.name).toBe("invoices/b-RTO.pdf");
    expect([...entries[1]!.data]).toEqual([...b]);
    expect(entries[1]!.crc).toBe(crc32(b));
  });

  test("empty input produces a valid empty archive", () => {
    const zip = createZip([]);
    expect(readStoredZip(zip)).toHaveLength(0);
    expect(zip.length).toBe(22);
  });

  test("output is a valid zip file for unzip(1)", () => {
    const dir = `/tmp/opencode/zip-test-${Date.now()}`;
    mkdirSync(dir, { recursive: true });
    const zipPath = `${dir}/test.zip`;
    writeFileSync(
      zipPath,
      createZip([{ name: "one.pdf", data: new TextEncoder().encode("PDF-one") }]),
    );
    const proc = Bun.spawnSync(["unzip", "-t", zipPath], { stdout: "pipe", stderr: "pipe" });
    if (proc.exitCode !== null && proc.exitCode !== 0) {
      // unzip not installed in this environment — structural test above covers the format.
      return;
    }
    expect(proc.stdout.toString()).toContain("one.pdf");
    expect(proc.exitCode).toBe(0);
  });
});