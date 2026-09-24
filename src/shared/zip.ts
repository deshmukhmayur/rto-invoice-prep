// Minimal ZIP writer (store method, no compression) — enough for bundling
// already-compressed PDFs into the batch zip without a dependency.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export type ZipEntry = { name: string; data: Uint8Array };

// DOS epoch (1980-01-01 00:00) — deterministic output.
const DOS_TIME = 0;
const DOS_DATE = (1 << 5) | 1;
const UTF8_FLAG = 0x0800;

export function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + nameBytes.length);
    writeU32(local, 0, 0x04034b50);
    writeU16(local, 4, 20);
    writeU16(local, 6, UTF8_FLAG);
    writeU16(local, 8, 0); // stored
    writeU16(local, 10, DOS_TIME);
    writeU16(local, 12, DOS_DATE);
    writeU32(local, 14, crc);
    writeU32(local, 18, size);
    writeU32(local, 22, size);
    writeU16(local, 26, nameBytes.length);
    writeU16(local, 28, 0);
    local.set(nameBytes, 30);

    chunks.push(local, entry.data);

    const central = new Uint8Array(46 + nameBytes.length);
    writeU32(central, 0, 0x02014b50);
    writeU16(central, 4, 20);
    writeU16(central, 6, 20);
    writeU16(central, 8, UTF8_FLAG);
    writeU16(central, 10, 0);
    writeU16(central, 12, DOS_TIME);
    writeU16(central, 14, DOS_DATE);
    writeU32(central, 16, crc);
    writeU32(central, 20, size);
    writeU32(central, 24, size);
    writeU16(central, 28, nameBytes.length);
    writeU16(central, 30, 0);
    writeU16(central, 32, 0);
    writeU16(central, 34, 0);
    writeU16(central, 36, 0);
    writeU32(central, 38, 0);
    writeU32(central, 42, offset);
    central.set(nameBytes, 46);
    centralChunks.push(central);

    offset += local.length + size;
  }

  const centralSize = centralChunks.reduce((n, c) => n + c.length, 0);
  const eocd = new Uint8Array(22);
  writeU32(eocd, 0, 0x06054b50);
  writeU16(eocd, 4, 0);
  writeU16(eocd, 6, 0);
  writeU16(eocd, 8, entries.length);
  writeU16(eocd, 10, entries.length);
  writeU32(eocd, 12, centralSize);
  writeU32(eocd, 16, offset);
  writeU16(eocd, 20, 0);

  return concat([...chunks, ...centralChunks, eocd]);
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function writeU16(buf: Uint8Array, offset: number, value: number): void {
  buf[offset] = value & 0xff;
  buf[offset + 1] = (value >>> 8) & 0xff;
}

function writeU32(buf: Uint8Array, offset: number, value: number): void {
  for (let i = 0; i < 4; i++) buf[offset + i] = (value >>> (8 * i)) & 0xff;
}