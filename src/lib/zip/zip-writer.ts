/**
 * Streaming ZIP writer.
 *
 * Produces a valid ZIP archive as a sequence of chunks without ever buffering
 * the whole archive — essential for serverless runtimes where a bulk download
 * ZIP can be far larger than available memory.
 *
 * Entries are stored (method 0) rather than deflated: video and audio payloads
 * are already compressed, so deflating them only burns CPU on a function.
 * Sizes are written with data descriptors (general purpose bit 3), which lets
 * us stream an entry whose length is not known up front.
 */

import { Crc32 } from "./crc32";

const LOCAL_HEADER_SIGNATURE = 0x04034b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const DATA_DESCRIPTOR_SIGNATURE = 0x08074b50;

const FLAG_DATA_DESCRIPTOR = 0x0008;
const FLAG_UTF8_NAMES = 0x0800;
const VERSION_NEEDED = 20;
const VERSION_MADE_BY = 20;
const METHOD_STORED = 0;

/** ZIP without ZIP64 extensions cannot represent these values. */
const MAX_ENTRY_SIZE = 0xffffffff;
const MAX_ENTRIES = 0xffff;

export class ZipLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipLimitError";
  }
}

export interface ZipEntryInput {
  /** Entry name inside the archive, e.g. `video-01.mp4`. */
  filename: string;
  /**
   * Lazily opened byte stream for the entry payload. Returning a promise keeps
   * the upstream fetch from starting until the writer reaches this entry, so
   * only one media stream is open at a time.
   */
  data: () => AsyncIterable<Uint8Array> | Promise<AsyncIterable<Uint8Array>>;
  /** Modified time recorded in the archive (defaults to now). */
  mtime?: Date;
}

export interface ZipEntrySummary {
  filename: string;
  crc32: number;
  size: number;
  localHeaderOffset: number;
  flags: number;
  mtime: Date;
}

export interface StreamZipOptions {
  /** Abort before finishing. */
  signal?: AbortSignal;
  /** Hard cap on the uncompressed archive payload. */
  maxTotalBytes?: number;
  /** Called before each entry's payload is written. */
  onEntryStart?: (index: number, filename: string, total: number) => void;
  /** Called after each entry completes with the bytes written so far. */
  onEntryEnd?: (index: number, filename: string, totalBytes: number) => void;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function writeString(bytes: Uint8Array, value: string, offset: number): void {
  for (let i = 0; i < value.length; i += 1) {
    bytes[offset + i] = value.charCodeAt(i) & 0xff;
  }
}

function needsUtf8Flag(name: string): boolean {
  for (let i = 0; i < name.length; i += 1) {
    if (name.charCodeAt(i) > 0x7f) return true;
  }
  return false;
}

const encoder = new TextEncoder();

function encodeName(name: string): Uint8Array {
  return encoder.encode(name);
}

export function toAsyncIterable(stream: ReadableStream<Uint8Array>): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      const reader = stream.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return;
          if (value) yield value;
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

/**
 * Generate the archive. Each yielded chunk should be written straight to the
 * response body; nothing is retained beyond the ~46 byte central directory
 * record per entry.
 */
export async function* streamZip(
  entries: ZipEntryInput[],
  options: StreamZipOptions = {},
): AsyncGenerator<Uint8Array, void, void> {
  const { signal, maxTotalBytes, onEntryStart, onEntryEnd } = options;

  if (entries.length > MAX_ENTRIES) {
    throw new ZipLimitError(`An archive can hold at most ${MAX_ENTRIES} files.`);
  }

  const summaries: ZipEntrySummary[] = [];
  let totalBytes = 0;
  let index = 0;

  for (const entry of entries) {
    if (signal?.aborted) throw new DOMException("ZIP creation was cancelled.", "AbortError");

    const nameBytes = encodeName(entry.filename);
    if (nameBytes.length > 0xffff) {
      throw new ZipLimitError(`Filename "${entry.filename}" is too long for a ZIP archive.`);
    }

    const mtime = entry.mtime ?? new Date();
    const flags = FLAG_DATA_DESCRIPTOR | (needsUtf8Flag(entry.filename) ? FLAG_UTF8_NAMES : 0);
    const { time, date } = dosDateTime(mtime);
    const localHeaderOffset = totalBytes;

    onEntryStart?.(index, entry.filename, entries.length);

    // Local file header: sizes are zeroed and supplied by the data descriptor.
    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, LOCAL_HEADER_SIGNATURE, true);
    localView.setUint16(4, VERSION_NEEDED, true);
    localView.setUint16(6, flags, true);
    localView.setUint16(8, METHOD_STORED, true);
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, 0, true); // crc32
    localView.setUint32(18, 0, true); // compressed size
    localView.setUint32(22, 0, true); // uncompressed size
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true); // extra length
    local.set(nameBytes, 30);
    totalBytes += local.byteLength;
    yield local;

    const crc = new Crc32();
    let size = 0;

    for await (const chunk of await entry.data()) {
      if (signal?.aborted) throw new DOMException("ZIP creation was cancelled.", "AbortError");
      crc.update(chunk);
      size += chunk.byteLength;
      if (size > MAX_ENTRY_SIZE) {
        throw new ZipLimitError(`"${entry.filename}" is larger than 4 GB, which ZIP cannot store.`);
      }
      totalBytes += chunk.byteLength;
      if (maxTotalBytes && totalBytes > maxTotalBytes) {
        throw new ZipLimitError("The archive exceeded the maximum allowed size.");
      }
      yield chunk;
    }

    const descriptor = new Uint8Array(16);
    const descriptorView = new DataView(descriptor.buffer);
    descriptorView.setUint32(0, DATA_DESCRIPTOR_SIGNATURE, true);
    descriptorView.setUint32(4, crc.digest(), true);
    descriptorView.setUint32(8, size, true);
    descriptorView.setUint32(12, size, true);
    totalBytes += descriptor.byteLength;
    yield descriptor;

    summaries.push({
      filename: entry.filename,
      crc32: crc.digest(),
      size,
      localHeaderOffset,
      flags,
      mtime,
    });

    onEntryEnd?.(index, entry.filename, totalBytes);
    index += 1;
  }

  // Central directory.
  const centralStart = totalBytes;
  let centralSize = 0;

  for (const summary of summaries) {
    const nameBytes = encodeName(summary.filename);
    const { time, date } = dosDateTime(summary.mtime);
    const record = new Uint8Array(46 + nameBytes.length);
    const view = new DataView(record.buffer);
    view.setUint32(0, CENTRAL_HEADER_SIGNATURE, true);
    view.setUint16(4, VERSION_MADE_BY, true);
    view.setUint16(6, VERSION_NEEDED, true);
    view.setUint16(8, summary.flags, true);
    view.setUint16(10, METHOD_STORED, true);
    view.setUint16(12, time, true);
    view.setUint16(14, date, true);
    view.setUint32(16, summary.crc32, true);
    view.setUint32(20, summary.size, true);
    view.setUint32(24, summary.size, true);
    view.setUint16(28, nameBytes.length, true);
    view.setUint16(30, 0, true); // extra
    view.setUint16(32, 0, true); // comment
    view.setUint16(34, 0, true); // disk number start
    view.setUint16(36, 0, true); // internal attributes
    view.setUint32(38, 0, true); // external attributes
    view.setUint32(42, summary.localHeaderOffset, true);
    record.set(nameBytes, 46);
    centralSize += record.byteLength;
    totalBytes += record.byteLength;
    yield record;
  }

  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);
  eocdView.setUint32(0, END_OF_CENTRAL_DIRECTORY_SIGNATURE, true);
  eocdView.setUint16(4, 0, true); // disk number
  eocdView.setUint16(6, 0, true); // disk with central directory
  eocdView.setUint16(8, summaries.length, true);
  eocdView.setUint16(10, summaries.length, true);
  eocdView.setUint32(12, centralSize, true);
  eocdView.setUint32(16, centralStart, true);
  eocdView.setUint16(20, 0, true); // comment length
  yield eocd;
}

/** Convenience helper for tests and small in-memory archives. */
export async function buildZipBuffer(entries: ZipEntryInput[]): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of streamZip(entries)) {
    chunks.push(chunk);
    length += chunk.byteLength;
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Write an ASCII string into a Uint8Array at an offset (ZIP local headers). */
export function writeAscii(bytes: Uint8Array, value: string, offset: number): void {
  writeString(bytes, value, offset);
}
