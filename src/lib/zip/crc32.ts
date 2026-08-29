/**
 * Table-driven CRC-32 (IEEE 802.3 polynomial), the checksum required by ZIP
 * entries. Implemented locally so the ZIP writer has no runtime dependencies.
 */

const POLYNOMIAL = 0xedb88320;

let table: Uint32Array | null = null;

function getTable(): Uint32Array {
  if (table) return table;
  const next = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ POLYNOMIAL : crc >>> 1;
    }
    next[i] = crc >>> 0;
  }
  table = next;
  return next;
}

export class Crc32 {
  private crc = 0xffffffff;

  update(chunk: Uint8Array): this {
    const t = getTable();
    let crc = this.crc;
    for (let i = 0; i < chunk.length; i += 1) {
      crc = (crc >>> 8) ^ t[(crc ^ chunk[i]!) & 0xff]!;
    }
    this.crc = crc >>> 0;
    return this;
  }

  /** Final checksum, ready to be written to a ZIP header. */
  digest(): number {
    return (this.crc ^ 0xffffffff) >>> 0;
  }

  reset(): this {
    this.crc = 0xffffffff;
    return this;
  }
}

export function crc32(data: Uint8Array): number {
  return new Crc32().update(data).digest();
}
