// Generates a random but reproducible PDF (shapes, text, curves) without dependencies.
// Usage: node scripts/sample-pdf.mjs [--out sample.pdf] [--pages 3] [--seed 1234] [--shapes 200]
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    out: { type: "string", default: "sample.pdf" },
    pages: { type: "string", default: "3" },
    seed: { type: "string" },
    shapes: { type: "string", default: "200" },
  },
});

const seed = values.seed === undefined ? Math.floor(Math.random() * 2 ** 31) : Number(values.seed);
const pages = Number(values.pages);
const shapes = Number(values.shapes);

// mulberry32: small seeded PRNG, so a seed always yields the same document.
let state = seed >>> 0;
const rand = () => {
  state = (state + 0x6d2b79f5) >>> 0;
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (min, max) => min + rand() * (max - min);
const n = (v) => v.toFixed(2);
const words = ["PDFium", "napi-rs", "Rust", "Node.js", "render", "page", "aube", "mise", "bench", "sample"];

function pageContent(width, height, index) {
  const ops = [];
  for (let i = 0; i < shapes; i++) {
    ops.push(`${n(rand())} ${n(rand())} ${n(rand())} rg ${n(rand())} ${n(rand())} ${n(rand())} RG ${n(between(0.5, 4))} w`);
    const x = between(0, width);
    const y = between(0, height);
    switch (Math.floor(rand() * 3)) {
      case 0:
        ops.push(`${n(x)} ${n(y)} ${n(between(10, 150))} ${n(between(10, 150))} re B`);
        break;
      case 1:
        ops.push(
          `${n(x)} ${n(y)} m ${n(between(0, width))} ${n(between(0, height))} ${n(between(0, width))} ${n(between(0, height))} ${n(between(0, width))} ${n(between(0, height))} c S`,
        );
        break;
      default: {
        const text = Array.from({ length: 3 }, () => words[Math.floor(rand() * words.length)]).join(" ");
        ops.push(`BT /F1 ${n(between(8, 36))} Tf ${n(x)} ${n(y)} Td (${text}) Tj ET`);
      }
    }
  }
  ops.push(`0 0 0 rg BT /F1 14 Tf 36 36 Td (seed ${seed} - page ${index + 1}/${pages}) Tj ET`);
  return Buffer.from(ops.join("\n"));
}

// Objects: 1 catalog, 2 pages, 3 font, then (page, content) pairs.
const objects = [];
const kids = [];
objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
for (let p = 0; p < pages; p++) {
  const landscape = rand() < 0.3;
  const [w, h] = landscape ? [792, 612] : [612, 792];
  const pageId = 4 + p * 2;
  const contentId = pageId + 1;
  kids.push(`${pageId} 0 R`);
  objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`;
  objects[contentId] = pageContent(w, h, p);
}
objects[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages} >>`;

const chunks = [Buffer.from("%PDF-1.7\n")];
let length = chunks[0].length;
const offsets = [];
for (let id = 1; id < objects.length; id++) {
  offsets[id] = length;
  const obj = objects[id];
  const body = Buffer.isBuffer(obj)
    ? Buffer.concat([Buffer.from(`<< /Length ${obj.length} >>\nstream\n`), obj, Buffer.from("\nendstream")])
    : Buffer.from(obj);
  const chunk = Buffer.concat([Buffer.from(`${id} 0 obj\n`), body, Buffer.from("\nendobj\n")]);
  chunks.push(chunk);
  length += chunk.length;
}
const xref = [`xref\n0 ${objects.length}\n0000000000 65535 f \n`];
for (let id = 1; id < objects.length; id++) xref.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
xref.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`);
chunks.push(Buffer.from(xref.join("")));

writeFileSync(values.out, Buffer.concat(chunks));
console.log(`wrote ${values.out}: ${pages} page(s), ${shapes} shapes/page, seed ${seed}`);
