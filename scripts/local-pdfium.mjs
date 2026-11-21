// Copies the vendored PDFium library for the host platform next to the locally built addon,
// mirroring the layout of the published platform packages.
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

for (const file of await readdir(`vendor/pdfium/${folder}`)) {
  await copyFile(`vendor/pdfium/${folder}/${file}`, file);
  console.log(`copied vendor/pdfium/${folder}/${file} -> ./${file}`);
}
