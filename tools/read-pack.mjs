/**
 * Read a Foundry compendium pack straight off disk, without launching Foundry.
 *
 * Why this exists. §8's method is "probe against real data before writing code",
 * and until now that meant starting Foundry, pasting a probe into the DevTools
 * console, and getting the answer back through the clipboard (§6.7). That is a
 * slow loop for a question like "how many creatures are in this install, and
 * from which books". This reads the packs directly: 97 packs, 93MB, in about
 * thirteen seconds, with Foundry closed.
 *
 * Why it is hand-rolled. Foundry v11+ stores packs as LevelDB directories.
 * Reading one properly needs an SSTable parser and a Snappy decompressor, and
 * `classic-level` cannot be installed in every environment this project gets
 * worked on from. Both pieces are small and are implemented below with no
 * dependencies beyond node:zlib.
 *
 * Why not `strings`. It was tried first and rejected. `strings` on a `.ldb`
 * file finds only records that happen to sit in uncompressed blocks and
 * silently misses everything inside a Snappy block — searching
 * book-of-the-dead-bestiary for "Husk Zombie" that way returns nothing, though
 * the creature is plainly there. For a coverage measurement that produces false
 * absences, which is the one error such a measurement must not make.
 *
 * Validation. `--verify` asserts the known answer this reader was built
 * against: Husk Zombie must appear in book-of-the-dead-bestiary. Its totals also
 * reproduce three numbers this project previously obtained through Foundry's own
 * API — see ARCHITECTURE.md §7.7.
 *
 * Close Foundry before trusting a count. These are live databases: with Foundry
 * running, records move between the SSTables and the write-ahead log as it works,
 * and two runs minutes apart can differ by a few documents on frequently-written
 * types. Observed 23 Aug — 7,638 feats in one run and 7,633 in the next, while npc
 * stayed at 6,393 both times. Nothing is broken when that happens; it means a count
 * taken against a running Foundry is a snapshot rather than a fact.
 *
 * Usage:
 *   node tools/read-pack.mjs <pack-dir> [--type npc] [--names] [--json]
 *   node tools/read-pack.mjs <packs-root> --all [--type npc]
 *   node tools/read-pack.mjs <packs-root> --verify
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { join, basename } from "node:path";
import { pathToFileURL } from "node:url";

const FOOTER_LEN = 48;
const MAGIC_LO = 0x8b80fb57;
const MAGIC_HI = 0xdb477524;

/** LevelDB varints are little-endian base-128. */
function varint(buf, pos) {
  let result = 0;
  let shift = 0;
  for (;;) {
    const b = buf[pos++];
    result += (b & 0x7f) * 2 ** shift;
    if ((b & 0x80) === 0) return [result, pos];
    shift += 7;
  }
}

/**
 * Snappy decompression. Only the decompressor is needed, and it is the simple
 * half of the format: a length preamble, then tagged literals and copies.
 *
 * The preamble gives the exact output size, so the buffer is allocated once.
 * An earlier version grew it per copy and ran the whole install in 20s rather
 * than 12s. Copies may overlap the bytes they are writing (`abcabcabc` from a
 * three-byte source), so they are emitted one byte at a time on purpose.
 */
function snappyDecompress(data) {
  let [ulen, pos] = varint(data, 0);
  const out = Buffer.alloc(ulen);
  let o = 0;

  while (pos < data.length) {
    const tag = data[pos];
    const t = tag & 0x03;

    if (t === 0) {
      let n = tag >> 2;
      pos += 1;
      if (n >= 60) {
        const extra = n - 59;
        n = data.readUIntLE(pos, extra);
        pos += extra;
      }
      n += 1;
      data.copy(out, o, pos, pos + n);
      o += n;
      pos += n;
      continue;
    }

    let n, off;
    if (t === 1) {
      n = 4 + ((tag >> 2) & 0x07);
      off = ((tag >> 5) << 8) | data[pos + 1];
      pos += 2;
    } else if (t === 2) {
      n = (tag >> 2) + 1;
      off = data.readUInt16LE(pos + 1);
      pos += 3;
    } else {
      n = (tag >> 2) + 1;
      off = data.readUInt32LE(pos + 1);
      pos += 5;
    }
    if (off > o) throw new Error("bad snappy back-reference");
    for (let i = 0; i < n; i++) out[o + i] = out[o - off + i];
    o += n;
  }

  if (o !== ulen) throw new Error(`snappy length mismatch: ${o} != ${ulen}`);
  return out;
}

function readBlock(data, off, size) {
  const raw = data.subarray(off, off + size);
  const ctype = data[off + size];
  if (ctype === 0) return raw;
  if (ctype === 1) return snappyDecompress(raw);
  if (ctype === 2) return inflateSync(raw);
  throw new Error(`unsupported block compression type ${ctype}`);
}

/** Entries are prefix-compressed against the previous key. */
function* blockEntries(block) {
  const n = block.length;
  const numRestarts = block.readUInt32LE(n - 4);
  const end = n - 4 - numRestarts * 4;
  let pos = 0;
  let last = Buffer.alloc(0);
  while (pos < end) {
    let shared, nonShared, vlen;
    [shared, pos] = varint(block, pos);
    [nonShared, pos] = varint(block, pos);
    [vlen, pos] = varint(block, pos);
    const key = Buffer.concat([last.subarray(0, shared), block.subarray(pos, pos + nonShared)]);
    pos += nonShared;
    const value = block.subarray(pos, pos + vlen);
    pos += vlen;
    last = key;
    yield [key, value];
  }
}

function* sstRecords(path) {
  const data = readFileSync(path);
  if (data.length < FOOTER_LEN) return;
  const footer = data.subarray(data.length - FOOTER_LEN);
  if (footer.readUInt32LE(40) !== MAGIC_LO || footer.readUInt32LE(44) !== MAGIC_HI) return;
  let p = 0;
  [, p] = varint(footer, p);          // metaindex offset
  [, p] = varint(footer, p);          // metaindex size
  let idxOff, idxSize;
  [idxOff, p] = varint(footer, p);
  [idxSize, p] = varint(footer, p);

  for (const [, handle] of blockEntries(readBlock(data, idxOff, idxSize))) {
    let q = 0, off, size;
    [off, q] = varint(handle, q);
    [size, q] = varint(handle, q);
    let blk;
    try { blk = readBlock(data, off, size); } catch { continue; }
    yield* blockEntries(blk);
  }
}

// ---------------------------------------------------------------------------
// Write-ahead log
//
// A LevelDB pack does not always keep its data in .ldb SSTables. Recent writes
// live in a .log write-ahead file until they are compacted, and after Foundry
// opens a pack the SSTable can be gone entirely with everything sitting in the
// log. Reading only .ldb then returns a pack that looks empty.
//
// That happened on 23 Aug: an ability diff reported 4,153 abilities where an
// earlier run of the same tool had found 33,267, because Foundry had been
// opened in between and every pack had been rewritten into log form. Zero
// documents and no error is the exact false-absence failure this reader exists
// to avoid, so the log is parsed too.
//
// Format: 32 KiB blocks of records, each 4-byte checksum, 2-byte length, 1-byte
// type, then payload. A record is FULL, or FIRST/MIDDLE/LAST fragments to be
// concatenated. Each assembled payload is a WriteBatch: an 8-byte sequence, a
// 4-byte count, then that many entries of <type><varint-len key><varint-len
// value>, where type 0 is a deletion and carries no value.
// ---------------------------------------------------------------------------

const LOG_BLOCK = 32768;
const REC_FULL = 1, REC_FIRST = 2, REC_MIDDLE = 3, REC_LAST = 4;
const BATCH_HEADER = 12;

function* logPayloads(data) {
  let pos = 0;
  let partial = [];
  while (pos + 7 <= data.length) {
    const inBlock = pos % LOG_BLOCK;
    if (LOG_BLOCK - inBlock < 7) { pos += LOG_BLOCK - inBlock; continue; }
    const length = data.readUInt16LE(pos + 4);
    const type = data[pos + 6];
    const body = data.subarray(pos + 7, pos + 7 + length);
    pos += 7 + length;
    if (type === 0) continue;                       // zero record: padding
    if (type === REC_FULL) { yield body; continue; }
    if (type === REC_FIRST) { partial = [body]; continue; }
    if (type === REC_MIDDLE) { partial.push(body); continue; }
    if (type === REC_LAST) { partial.push(body); yield Buffer.concat(partial); partial = []; }
  }
}

/** Key/value pairs from one WriteBatch payload. Deletions are yielded as null. */
function* batchEntries(batch) {
  if (batch.length < BATCH_HEADER) return;
  const count = batch.readUInt32LE(8);
  let pos = BATCH_HEADER;
  for (let i = 0; i < count && pos < batch.length; i++) {
    const kind = batch[pos++];
    let klen; [klen, pos] = varint(batch, pos);
    const key = batch.subarray(pos, pos + klen); pos += klen;
    if (kind === 0) { yield [key, null]; continue; }   // deletion
    let vlen; [vlen, pos] = varint(batch, pos);
    const value = batch.subarray(pos, pos + vlen); pos += vlen;
    yield [key, value];
  }
}

/**
 * Records from a .log file. Keys here are *user* keys with no 8-byte trailer —
 * that suffix belongs to SSTable internal keys only.
 */
function* logRecords(path) {
  const data = readFileSync(path);
  for (const payload of logPayloads(data)) yield* batchEntries(payload);
}

/** LevelDB internal keys carry an 8-byte trailer; the user key is what precedes it. */
const INTERNAL_KEY_TRAILER = 8;

/**
 * Every document in a pack, keyed by its Foundry document key. Later writes win.
 *
 * The 8-byte LevelDB trailer is stripped. Keys inside a data block are *internal*
 * keys: the user key followed by a fixed 8-byte suffix holding a 1-byte value type
 * and a 7-byte sequence number. Printed to a terminal that suffix looks like
 * trailing whitespace — `!actors!0PrrwvV1936eSCQy······` — which is a trap twice
 * over. `trimEnd()` does not remove it, because the bytes are `0x01 0x01 0x00…`
 * rather than spaces; and when a sequence byte happens to fall in the printable
 * range it reads as a real character, so `!actors.items!<actor>.<item>` appears to
 * carry a 17-character item id where Foundry only ever issues 16.
 *
 * Left on, it breaks any join between a creature and its embedded items: the actor
 * id captured from an `!actors!` key carries a different trailer from the same id
 * captured out of the middle of an `!actors.items!` key, so the two never compare
 * equal and the join silently yields nothing. That cost two debugging rounds the
 * first time this tool was used for real.
 */
export function readPack(packDir) {
  const docs = new Map();
  const files = readdirSync(packDir).sort();

  // SSTables first, then the write-ahead log: the log holds the newer writes.
  for (const fn of files.filter((f) => f.endsWith(".ldb"))) {
    for (const [key, value] of sstRecords(join(packDir, fn))) {
      if (!value.length || key.length <= INTERNAL_KEY_TRAILER) continue;
      const userKey = key.subarray(0, key.length - INTERNAL_KEY_TRAILER).toString("utf8");
      try { docs.set(userKey, JSON.parse(value.toString("utf8"))); }
      catch { /* not a document record */ }
    }
  }

  for (const fn of files.filter((f) => f.endsWith(".log"))) {
    for (const [key, value] of logRecords(join(packDir, fn))) {
      const userKey = key.toString("utf8");
      if (value === null) { docs.delete(userKey); continue; }
      if (!value.length) continue;
      try { docs.set(userKey, JSON.parse(value.toString("utf8"))); }
      catch { /* not a document record */ }
    }
  }

  return docs;
}

/** Which source book a document declares, however it records it. */
export function publication(doc) {
  const s = doc.system ?? {};
  const p = s.publication ?? s.details?.publication ?? {};
  return p.title ?? s.details?.source?.value ?? "(unknown)";
}

// ---------------------------------------------------------------------------

/**
 * Is this directory a LevelDB pack?
 *
 * Exported because every caller used to hand-roll it as "contains a .ldb", and
 * that is wrong: a pack whose data currently sits in the write-ahead log has no
 * SSTable at all. On 23 Aug the same wrong test appeared in three places and
 * silently excluded every pack in the install, which looked like an empty
 * result rather than a skipped one. One definition, exported, so it can only be
 * wrong once.
 */
export function isPackDir(d) {
  try {
    if (!statSync(d).isDirectory()) return false;
    return readdirSync(d).some((f) => f.endsWith(".ldb") || f.endsWith(".log"));
  } catch { return false; }
}

function main(argv) {
  const args = argv.filter((a) => !a.startsWith("--"));
  const flag = (f) => argv.includes(f);
  const root = args[0];
  if (!root) {
    console.error("usage: node tools/read-pack.mjs <pack-dir|packs-root> [--all] [--type npc] [--names] [--json] [--verify]");
    process.exit(2);
  }
  const typeIdx = argv.indexOf("--type");
  const wantType = typeIdx >= 0 ? argv[typeIdx + 1] : null;

  if (flag("--verify")) {
    const dir = isPackDir(root) ? root : join(root, "book-of-the-dead-bestiary");
    const names = [...readPack(dir).values()].map((d) => d.name);
    const ok = names.includes("Husk Zombie");
    console.log(`${dir}: ${names.length} documents`);
    console.log(ok ? "PASS  known answer: Husk Zombie found" : "FAIL  known answer: Husk Zombie NOT found");
    process.exit(ok ? 0 : 1);
  }

  const dirs = flag("--all")
    ? readdirSync(root).map((d) => join(root, d)).filter(isPackDir)
    : [root];

  const rows = [];
  const byType = new Map();
  const byBook = new Map();
  for (const dir of dirs) {
    for (const [key, doc] of readPack(dir)) {
      if (key.includes(".items!")) continue;      // embedded, not a top-level document
      const t = doc.type ?? "(none)";
      byType.set(t, (byType.get(t) ?? 0) + 1);
      if (wantType && t !== wantType) continue;
      const book = publication(doc);
      byBook.set(book, (byBook.get(book) ?? 0) + 1);
      rows.push({ pack: basename(dir), name: doc.name, type: t, book, level: doc.system?.details?.level?.value ?? null });
    }
  }

  if (flag("--json")) { console.log(JSON.stringify(rows, null, 1)); return; }
  if (flag("--names")) { for (const r of rows.sort((a, b) => a.name.localeCompare(b.name))) console.log(r.name); return; }

  // Not the guard that would have caught the Windows CLI bug — that one stopped
  // main() from running at all — but a run that reads packs and finds nothing in
  // them is almost always a wrong path or a typo'd --type, and saying so beats
  // printing a confident row of zeroes.
  if (rows.length === 0) {
    console.warn(`no documents matched${wantType ? ` for --type ${wantType}` : ""} in ${dirs.length} pack(s) under ${root}`);
  }

  console.log(`packs read : ${dirs.length}`);
  console.log(`documents  : ${rows.length}${wantType ? ` (type=${wantType})` : ""}`);
  console.log(`unique names: ${new Set(rows.map((r) => r.name)).size}`);
  console.log("\ntop types:");
  for (const [t, n] of [...byType].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(n).padStart(6)}  ${t}`);
  console.log("\ntop source books:");
  for (const [b, n] of [...byBook].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${String(n).padStart(6)}  ${b}`);
}

// `file://${argv[1]}` looks right and is wrong on Windows: argv[1] is
// C:\Projects\...\read-pack.mjs while import.meta.url is
// file:///C:/Projects/.../read-pack.mjs, so the comparison fails, main() never
// runs, and the process exits 0 having printed nothing. pathToFileURL is the
// only form that agrees on both platforms.
// argv[1] is undefined under `node -e`, and pathToFileURL throws on undefined,
// so importing this module from such a context would crash before the caller
// got a chance to use it. Guard the guard.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
