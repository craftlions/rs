#!/usr/bin/env node
//MISE description="Pin a PDFium release in pdfium.lock.json and install it"
//USAGE arg "[release]" help="bblanchon/pdfium-binaries tag, e.g. chromium/8165 (defaults to the latest release)"
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  assetNames,
  assetUrl,
  download,
  installPdfium,
  lockPath,
  platforms,
  readLock,
  sha256,
  type PdfiumLock,
} from "../scripts/install-pdfium.ts";

interface GitHubRelease {
  tag_name: string;
  name: string;
  assets: { name: string; digest: string | null }[];
}

async function githubRelease(release: string | undefined): Promise<GitHubRelease> {
  const path = release ? `tags/${encodeURIComponent(release)}` : "latest";
  const headers: Record<string, string> = { accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/bblanchon/pdfium-binaries/releases/${path}`, { headers });
  if (!response.ok) throw new Error(`GitHub release ${release ?? "latest"}: ${response.status} ${response.statusText}`);
  return (await response.json()) as GitHubRelease;
}

const { positionals } = parseArgs({ allowPositionals: true });

const previous = await readLock();
const release = await githubRelease(positionals[0]);

if (release.tag_name === previous.release) {
  console.log(`PDFium is already pinned to ${previous.release}.`);
  process.exit(0);
}

const assets = {} as PdfiumLock["assets"];
for (const platform of platforms) {
  const name = assetNames[platform];
  const asset = release.assets.find((a) => a.name === name);
  if (!asset) throw new Error(`${release.tag_name} has no ${name}`);
  const actual = sha256(await download(assetUrl(release.tag_name, name)));
  if (asset.digest && asset.digest !== `sha256:${actual}`) {
    throw new Error(`${name}: downloaded sha256:${actual} but GitHub reports ${asset.digest}`);
  }
  assets[platform] = { name, sha256: actual };
}

const lock: PdfiumLock = {
  release: release.tag_name,
  version: release.name.replace(/^PDFium\s+/, ""),
  assets,
};
await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Pinned ${lock.release} (${lock.version}) in ${lockPath}.`);

await installPdfium(lock);

const pdfiumRender = (await readFile("Cargo.toml", "utf8")).match(/pdfium-render = \{ version = "([^"]+)"/)?.[1];
console.log(`Check that pdfium-render ${pdfiumRender ?? "?"} supports ${lock.release}; bump it in Cargo.toml if needed.`);
