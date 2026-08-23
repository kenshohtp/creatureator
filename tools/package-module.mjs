/**
 * Build `module.zip` for a Foundry release.
 *
 * Why this exists. `module.json` points Foundry's installer at
 * `releases/latest/download/module.zip`, but nothing built that file — it was
 * assembled by hand. Two things about the ORC licence depend on getting it
 * right, and neither is enforced by anything else in the repo:
 *
 *   - `NOTICE.md` must be in the archive. `module.json` links Foundry at it
 *     through the `license` field, and the link is dead if the file is absent.
 *   - Nothing Paizo-owned beyond the mechanical tables may ship. See NOTICE.md.
 *
 * So this script uses a strict allowlist rather than an ignore list. Only the
 * paths in CONTENTS go into the archive; anything new in the repo is excluded
 * by default and has to be added here deliberately. An ignore list fails open —
 * forget an entry and private material ships. An allowlist fails closed.
 *
 * Zero dependencies: the npm registry is unreachable from some of the
 * environments this project is worked on from (§6.9), and a release must not
 * depend on which machine cut it. The ZIP writer below is about eighty lines.
 *
 *   npm run package
 *   node tools/package-module.mjs --list     (show what would go in, write nothing)
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { deflateRawSync } from "node:zlib";
import { join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Everything that ships, and nothing else.
 *
 * `required: true` means a missing entry is a failed build rather than a
 * warning — that is the whole point for NOTICE.md and LICENSE.
 */
const CONTENTS = [
  { path: "module.json", required: true },
  { path: "scripts", required: true, dir: true },
  { path: "styles", required: true, dir: true },
  { path: "lang", required: true, dir: true },
  { path: "NOTICE.md", required: true },   // ORC Notice + Attribution. Never optional.
  { path: "LICENSE", required: true },     // module.json `license` points here via NOTICE
  { path: "README.md", required: true },   // module.json `readme` points at it
];

// --- CRC32, written out rather than imported ------------------------------
// node:zlib gained crc32 only in recent releases and this must run wherever a
// release is cut, so the table is built here.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time, which is what ZIP stores. Two-second resolution, by design. */
function dosTime(date) {
  const y = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((y - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** Minimal ZIP writer: local headers, central directory, end record. */
function buildZip(entries) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const deflated = deflateRawSync(e.data);
    // Deflate can exceed the input on tiny or incompressible files; store those.
    const stored = deflated.length >= e.data.length;
    const body = stored ? e.data : deflated;
    const method = stored ? 0 : 8;
    const { time, date } = dosTime(e.mtime);
    const crc = crc32(e.data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);          // version needed
    local.writeUInt16LE(0, 6);           // flags
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, body);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);             // version made by
    cd.writeUInt16LE(20, 6);             // version needed
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(body.length, 20);
    cd.writeUInt32LE(e.data.length, 24);
    cd.writeUInt16LE(name.length, 28);
    cd.writeUInt32LE(0, 38);             // external attrs
    cd.writeUInt32LE(offset, 42);
    central.push(cd, name);

    offset += local.length + name.length + body.length;
  }

  const cdBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...chunks, cdBuf, eocd]);
}

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(full);
  }
  return out;
}

function collect() {
  const files = [];
  const missing = [];
  for (const item of CONTENTS) {
    const full = join(ROOT, item.path);
    if (!existsSync(full)) { if (item.required) missing.push(item.path); continue; }
    const paths = item.dir ? walk(full) : [full];
    if (item.dir && paths.length === 0 && item.required) { missing.push(`${item.path}/ (empty)`); continue; }
    for (const p of paths) {
      files.push({
        name: relative(ROOT, p).split(sep).join("/"),   // ZIP always uses forward slashes
        data: readFileSync(p),
        mtime: statSync(p).mtime,
      });
    }
  }
  return { files, missing };
}

function main(argv) {
  const { files, missing } = collect();

  if (missing.length) {
    console.error("release aborted — required contents are missing:");
    for (const m of missing) console.error(`  ${m}`);
    console.error("\nIf scripts/ or styles/ is missing, run `npm run build` first.");
    console.error("If NOTICE.md or LICENSE is missing, do not ship: see NOTICE.md.");
    process.exit(1);
  }

  const total = files.reduce((n, f) => n + f.data.length, 0);
  console.log(`contents (${files.length} files, ${(total / 1024).toFixed(0)} kB uncompressed):`);
  for (const f of files) console.log(`  ${String(f.data.length).padStart(8)}  ${f.name}`);

  if (argv.includes("--list")) { console.log("\n--list: nothing written."); return; }

  const zip = buildZip(files);
  const out = join(ROOT, "module.zip");
  writeFileSync(out, zip);
  console.log(`\nwrote module.zip — ${(zip.length / 1024).toFixed(0)} kB`);
  console.log("NOTICE.md and LICENSE are present; the ORC notice ships with the module.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}
