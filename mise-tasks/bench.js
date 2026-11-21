#!/usr/bin/env node
//MISE description="Benchmark pdfToPng (latency, throughput, event-loop blocking, compression)"
//MISE depends=["build", "local-pdfium"]
//USAGE arg "[pdf]" default="sample.pdf" help="PDF to render"
//USAGE flag "--iterations <n>" default="50"
//USAGE flag "--concurrency <list>" default="1,2,4,8"
//USAGE flag "--compression <list>" default="none,fast,balanced,best"
import { readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { monitorEventLoopDelay, performance } from "node:perf_hooks";
import { parseArgs } from "node:util";
import { pdfToPng } from "../index.js";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    iterations: { type: "string", default: "50" },
    concurrency: { type: "string", default: "1,2,4,8" },
    compression: { type: "string", default: "none,fast,balanced,best" },
  },
});

const pdf = readFileSync(positionals[0] ?? "sample.pdf");
const iterations = Number(values.iterations);
const levels = values.concurrency.split(",").map(Number);

const ms = (v) => `${v.toFixed(2)} ms`;
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];

console.log(
  `node ${process.version} · ${process.platform}-${process.arch} · ${availableParallelism()} cpus · UV_THREADPOOL_SIZE=${process.env.UV_THREADPOOL_SIZE ?? "4 (default)"}`,
);
console.log(`input ${(pdf.length / 1024).toFixed(1)} KiB, ${iterations} iterations per run\n`);

// Cold start: the first call also binds the PDFium library.
let start = performance.now();
const png = await pdfToPng(pdf);
console.log(`cold first call     ${ms(performance.now() - start)} (output ${(png.length / 1024).toFixed(1)} KiB)`);

// Warm-up.
for (let i = 0; i < 3; i++) await pdfToPng(pdf);

// Sequential latency with event-loop delay monitoring.
const loop = monitorEventLoopDelay({ resolution: 1 });
loop.enable();
const samples = [];
for (let i = 0; i < iterations; i++) {
  start = performance.now();
  await pdfToPng(pdf);
  samples.push(performance.now() - start);
}
loop.disable();
samples.sort((a, b) => a - b);
const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
console.log(
  `sequential          mean ${ms(mean)} · p50 ${ms(percentile(samples, 50))} · p95 ${ms(percentile(samples, 95))} · ${(1000 / mean).toFixed(1)} ops/s`,
);
console.log(
  `event-loop delay    p99 ${ms(loop.percentile(99) / 1e6)} · max ${ms(loop.max / 1e6)} (low = JS thread not blocked)\n`,
);

// Concurrent throughput: `level` renders in flight at a time.
for (const level of levels) {
  let next = 0;
  start = performance.now();
  await Promise.all(
    Array.from({ length: level }, async () => {
      while (next++ < iterations) await pdfToPng(pdf);
    }),
  );
  const elapsed = performance.now() - start;
  console.log(`concurrency ${String(level).padEnd(8)}${(iterations / (elapsed / 1000)).toFixed(1)} ops/s · ${ms(elapsed)} total`);
}

// PNG compression levels: sequential latency and output size.
console.log("");
for (const compression of values.compression.split(",")) {
  const out = await pdfToPng(pdf, { compression });
  start = performance.now();
  for (let i = 0; i < iterations; i++) await pdfToPng(pdf, { compression });
  const mean = (performance.now() - start) / iterations;
  console.log(`compression ${compression.padEnd(9)}${ms(mean)} mean · ${(out.length / 1024).toFixed(1)} KiB`);
}
