import { execFile as execFileRaw } from 'node:child_process';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const platformAssetMap = {
  "darwin-arm64": "pdfium-mac-arm64.tgz",
  "darwin-x64": "pdfium-mac-x64.tgz",
  "linux-x64-gnu": "pdfium-linux-x64.tgz",
  "win32-x64-msvc": "pdfium-win-x64.tgz"
}

const platformUpstreamMap = {
  "darwin-arm64": "lib/libpdfium.dylib",
  "darwin-x64": "lib/libpdfium.dylib",
  "linux-x64-gnu": "lib/libpdfium.so",
  "win32-x64-msvc": "lib/pdfium.dll.lib"
}

const platformFileNameMap = {
  "darwin-arm64": "libpdfium.dylib",
  "darwin-x64": "libpdfium.dylib",
  "linux-x64-gnu": "libpdfium.so",
  "win32-x64-msvc": "pdfium.lib"
}

console.log("Updating PDFium binaries...");

const baseUrl = "https://github.com/bblanchon/pdfium-binaries/releases/latest/download";

for (const platform of ["darwin-arm64", "darwin-x64", "linux-x64-gnu", "win32-x64-msvc"] as const) {
  const file = await fetch(`${baseUrl}/${platformAssetMap[platform]}`);
  if (!file.ok) {
    throw new Error(`Failed to download ${platformAssetMap[platform]}: ${file.status} ${file.statusText}`);
  }
  const arrayBuffer = await file.arrayBuffer();
  await writeFile(`./vendor/pdfium/${platform}/${platformAssetMap[platform]}`, Buffer.from(arrayBuffer));
  await mkdir(`./vendor/pdfium/${platform}/upstream`, { recursive: true });
  const execFile = promisify(execFileRaw);
  const { stdout } = await execFile('tar', ['-xvf', `./vendor/pdfium/${platform}/${platformAssetMap[platform]}`, '-C', `./vendor/pdfium/${platform}/upstream`]);
  await rm(`./vendor/pdfium/${platform}/${platformAssetMap[platform]}`)
  await copyFile(`./vendor/pdfium/${platform}/upstream/${platformUpstreamMap[platform]}`, `./vendor/pdfium/${platform}/${platformFileNameMap[platform]}`);
  await rm(`./vendor/pdfium/${platform}/upstream`, { recursive: true, force: true });
}
