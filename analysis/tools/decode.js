// Decodes a modern ".fig" (fig-kiwi container) file into its underlying Message JSON.
// Layout follows grida-canvas-io-figma/fig-kiwi:
//   prelude "fig-kiwi" (8 bytes) + version u32 LE
//   then files: [u32 LE size][data] repeated to EOF
//   file[0] = binary schema, deflate-compressed
//   file[1] = document message, zstd- or deflate-compressed
const fs = require("fs");
const { inflateSync } = require("fflate");
const { decompress } = require("fzstd");
const { decodeBinarySchema, compileSchema } = require("kiwi-schema");

function parseArchive(buf) {
  let off = 0;
  const prelude = buf.subarray(0, 8).toString("latin1");
  off = 8;
  const version = buf.readUInt32LE(off);
  off += 4;
  const files = [];
  while (off + 4 <= buf.length) {
    const size = buf.readUInt32LE(off);
    off += 4;
    files.push(buf.subarray(off, off + size));
    off += size;
  }
  return { prelude, version, files };
}

const input = process.argv[2];
const output = process.argv[3] || "message.json";
const buf = fs.readFileSync(input);
const { prelude, version, files } = parseArchive(buf);
console.error(`prelude=${prelude} version=${version} files=${files.length} sizes=${files.map(f => f.length).join(",")}`);

const [schemaFile, dataFile, preview] = files;
const fileSchema = decodeBinarySchema(inflateSync(schemaFile));
const compiled = compileSchema(fileSchema);

const isZstd = (d) => d.length > 4 && d[0] === 0x28 && d[1] === 0xb5 && d[2] === 0x2f && d[3] === 0xfd;
const raw = isZstd(dataFile) ? decompress(dataFile) : inflateSync(dataFile);
console.error(`data file: ${isZstd(dataFile) ? "zstd" : "deflate"}, raw size=${raw.length}`);

const message = compiled.decodeMessage(raw);
fs.writeFileSync(output, JSON.stringify(message));
console.error(`wrote ${output}: ${fs.statSync(output).size} bytes`);
