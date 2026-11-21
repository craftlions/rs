#!/usr/bin/env node
// Downloads the PDFium binaries pinned in pdfium.lock.json into vendor/pdfium and verifies their SHA-256.
// Run through `mise deps install pdfium`; `mise run update-pdfium` changes the pin.
import { execFile as execFileRaw } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFile = promisify(execFileRaw);

export const platforms = ["darwin-arm64", "darwin-x64", "linux-x64-gnu", "win32-x64-msvc"] as const;
export type Platform = (typeof platforms)[number];

export const assetNames: Record<Platform, string> = {
  "darwin-arm64": "pdfium-mac-arm64.tgz",
  "darwin-x64": "pdfium-mac-x64.tgz",
  "linux-x64-gnu": "pdfium-linux-x64.tgz",
  "win32-x64-msvc": "pdfium-win-x64.tgz",
};

// Path of the shared library inside the upstream archive.
const libraryPaths: Record<Platform, string> = {
  "darwin-arm64": "lib/libpdfium.dylib",
  "darwin-x64": "lib/libpdfium.dylib",
  "linux-x64-gnu": "lib/libpdfium.so",
  "win32-x64-msvc": "bin/pdfium.dll",
};

export interface PdfiumLock {
  release: string;
  version: string;
  assets: Record<Platform, { name: string; sha256: string }>;
}

export const lockPath = "pdfium.lock.json";

export async function readLock(): Promise<PdfiumLock> {
  return JSON.parse(await readFile(lockPath, "utf8")) as PdfiumLock;
}

export function assetUrl(release: string, name: string): string {
  return `https://github.com/bblanchon/pdfium-binaries/releases/download/${encodeURIComponent(release)}/${name}`;
}

export async function download(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

export function sha256(data: Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

export async function installPdfium(lock: PdfiumLock): Promise<void> {
  console.log(`Installing PDFium ${lock.version} (${lock.release})...`);
  await rm("vendor/pdfium", { recursive: true, force: true });
  const work = await mkdtemp(join(tmpdir(), "pdfium-"));
  try {
    for (const platform of platforms) {
      const { name, sha256: expected } = lock.assets[platform];
      const archive = await download(assetUrl(lock.release, name));
      const actual = sha256(archive);
      if (actual !== expected) {
        throw new Error(`Checksum mismatch for ${name}: expected ${expected}, got ${actual}`);
      }
      const archivePath = join(work, name);
      const extractDir = join(work, platform);
      await writeFile(archivePath, archive);
      await mkdir(extractDir, { recursive: true });
      await execFile("tar", ["-xzf", archivePath, "-C", extractDir]);
      const library = libraryPaths[platform];
      const target = `vendor/pdfium/${platform}`;
      await mkdir(target, { recursive: true });
      await copyFile(join(extractDir, library), `${target}/${library.split("/").pop()}`);
      console.log(`  ${platform}: ${name} sha256 ok`);
    }
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  await installPdfium(await readLock());
}
