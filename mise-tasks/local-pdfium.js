#!/usr/bin/env node
//MISE description="Copy the vendored PDFium library for the host next to the local addon"
//MISE hide=true
import { copyFile, readdir } from "node:fs/promises";

const platforms = {
  "darwin-arm64": "darwin-arm64",
  "darwin-x64": "darwin-x64",
  "linux-x64": "linux-x64-gnu",
  "win32-x64": "win32-x64-msvc",
};

const folder = platforms[`${process.platform}-${process.arch}`];
if (!folder) {
  throw new Error(`No vendored PDFium for ${process.platform}-${process.arch}`);
}

// Only the shared library; licenses/ stays in vendor.
for (const entry of await readdir(`vendor/pdfium/${folder}`, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const file = entry.name;
  await copyFile(`vendor/pdfium/${folder}/${file}`, file);
  console.log(`copied vendor/pdfium/${folder}/${file} -> ./${file}`);
}
