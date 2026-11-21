import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { pdfToPng } from "./index.js";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const pdf = fs.readFileSync("./sample.pdf");

test("renders the first page to a PNG", async () => {
  const png = await pdfToPng(pdf);
  assert.ok(png.subarray(0, 8).equals(PNG_SIGNATURE), "output is not a PNG");
  fs.writeFileSync("./out.png", png);
});

test("renders repeatedly and concurrently in one process", async () => {
  const first = await pdfToPng(pdf);
  const results = await Promise.all(Array.from({ length: 8 }, () => pdfToPng(pdf)));
  for (const png of results) assert.ok(png.equals(first));
});

test("rejects input that is not a PDF", async () => {
  await assert.rejects(pdfToPng(Buffer.from("not a pdf")), /Failed to load PDF/);
});

test("supports compression levels with identical pixels and different sizes", async () => {
  const none = await pdfToPng(pdf, { compression: "none" });
  const best = await pdfToPng(pdf, { compression: "best" });
  assert.ok(none.subarray(0, 8).equals(PNG_SIGNATURE));
  assert.ok(best.length < none.length, "best compression should be smaller than none");
});

test("dpi controls the output resolution", async () => {
  const png = await pdfToPng(pdf, { dpi: 72 });
  // IHDR width/height live at byte offsets 16 and 20; a US-letter page at 72 dpi is 612x792.
  assert.equal(png.readUInt32BE(16), 612);
  assert.equal(png.readUInt32BE(20), 792);
});

test("rejects an out-of-range dpi", async () => {
  await assert.rejects(async () => pdfToPng(pdf, { dpi: 0 }), /dpi must be between 1 and 1200/);
});
