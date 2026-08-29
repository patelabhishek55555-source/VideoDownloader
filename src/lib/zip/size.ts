/**
 * ZIP size arithmetic.
 *
 * Because entries are stored rather than compressed, the exact byte length of an
 * archive is known before a single file is fetched. Both sides use these
 * functions: the server to set a Content-Length for object-storage uploads, and
 * the browser to translate streamed bytes into "adding 3 of 12".
 *
 * Deliberately free of any Node-only import so it is safe in client code.
 */

const encoder = new TextEncoder();

export const LOCAL_HEADER_BASE = 30;
export const DATA_DESCRIPTOR_SIZE = 16;
export const CENTRAL_HEADER_BASE = 46;
export const END_OF_CENTRAL_DIRECTORY_SIZE = 22;

export function nameByteLength(name: string): number {
  return encoder.encode(name).byteLength;
}

export function localHeaderSize(name: string): number {
  return LOCAL_HEADER_BASE + nameByteLength(name);
}

export function centralHeaderSize(name: string): number {
  return CENTRAL_HEADER_BASE + nameByteLength(name);
}

/** Local header + data descriptor + central directory record for one entry. */
export function entryOverhead(name: string): number {
  return localHeaderSize(name) + DATA_DESCRIPTOR_SIZE + centralHeaderSize(name);
}

export interface SizedEntry {
  filename: string;
  fileSize?: number;
}

/** Exact archive size when every entry size is known, otherwise `null`. */
export function estimateArchiveSize(entries: SizedEntry[]): number | null {
  let total = END_OF_CENTRAL_DIRECTORY_SIZE;
  for (const entry of entries) {
    if (!entry.fileSize || !Number.isFinite(entry.fileSize) || entry.fileSize <= 0) return null;
    total += entry.fileSize + entryOverhead(entry.filename);
  }
  return total;
}

export interface EntryOffset {
  name: string;
  start: number;
  end: number;
}

/**
 * Byte offset of each entry inside the finished archive, used to map streaming
 * progress onto a filename. Returns `null` when any size is unknown.
 */
export function entryOffsets(entries: SizedEntry[]): { offsets: EntryOffset[]; total: number } | null {
  const total = estimateArchiveSize(entries);
  if (total === null) return null;

  const offsets: EntryOffset[] = [];
  let cursor = 0;
  for (const entry of entries) {
    const start = cursor;
    cursor += entryOverhead(entry.filename) + (entry.fileSize ?? 0);
    offsets.push({ name: entry.filename, start, end: cursor });
  }
  return { offsets, total };
}
