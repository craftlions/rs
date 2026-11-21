#!/usr/bin/env node
//MISE description="Pin a PDFium release in pdfium.lock.json, install it and draft a changeset with AI"
//USAGE arg "[release]" help="bblanchon/pdfium-binaries tag, e.g. chromium/8165 (defaults to the latest release)"
//USAGE flag "--skip-changeset" help="Only update the pin, do not draft a changeset"
import { execFile as execFileRaw } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, promisify } from "node:util";
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

const execFile = promisify(execFileRaw);

// opencode model that drafts the changeset; no #variant suffix means the model's default effort.
const model = process.env.PDFIUM_CHANGELOG_MODEL ?? "openrouter/google/gemini-4-neon";

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

// PDFium commits between two chromium/NNNN branches, oldest first.
async function pdfiumLog(from: string, to: string): Promise<string[]> {
  const commits: string[] = [];
  let next: string | undefined;
  do {
    const url = `https://pdfium.googlesource.com/pdfium/+log/${from}..${to}?format=JSON&n=1000${next ? `&s=${next}` : ""}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`PDFium log ${from}..${to}: ${response.status} ${response.statusText}`);
    // Gitiles prefixes JSON with )]}' to prevent XSSI.
    const page = JSON.parse((await response.text()).replace(/^\)\]\}'\n/, "")) as {
      log: { commit: string; message: string }[];
      next?: string;
    };
    for (const { commit, message } of page.log) {
      const body = message.replace(/\n(Change-Id|Bug|Reviewed-on|Reviewed-by|Commit-Queue|Auto-Submit|Fixed):.*$/gm, "").trim();
      commits.push(`${commit.slice(0, 12)} ${body.slice(0, 600)}`);
    }
    next = page.next;
  } while (next);
  return commits.reverse();
}

async function draftChangeset(previous: PdfiumLock, lock: PdfiumLock): Promise<void> {
  const work = await mkdtemp(join(tmpdir(), "pdfium-log-"));
  try {
    const commits = await pdfiumLog(previous.release, lock.release);
    const logFile = join(work, "pdfium-commits.txt");
    await writeFile(logFile, commits.join("\n\n"));
    console.log(`Drafting changeset from ${commits.length} PDFium commits with ${model}...`);

    const link = `[PDFium ${lock.version}](https://github.com/bblanchon/pdfium-binaries/releases/tag/${encodeURIComponent(lock.release)})`;
    const prompt = [
      `You write one changelog entry for @craftlions/pdfium-rs, a Node.js addon that renders PDF pages to PNG with PDFium.`,
      `PDFium was updated from ${previous.release} (${previous.version}) to ${lock.release} (${lock.version}).`,
      `The attached pdfium-commits.txt lists every upstream PDFium commit in that range. src/lib.rs shows which PDFium features the addon uses: loading PDFs from bytes, rendering pages to bitmaps, and encoding PNG.`,
      `Pick only the changes users of this addon would notice: rendering correctness and fidelity, fonts and text, images and color, annotations and forms drawn during rendering, parsing robustness, crashes, security fixes and performance.`,
      `Ignore JavaScript/XFA, editing and saving APIs, build, test, refactoring, code style and Chromium infrastructure changes.`,
      `Output only Markdown, with no preamble and no code fences: the first line must be exactly "Uses upstream PDFium version ${link}.", then a blank line, then at most 8 "- " bullets in plain user-facing language, each ending with the short commit hash in parentheses. If nothing is relevant, output only the first line.`,
    ].join("\n\n");

    const { stdout } = await execFile(
      "opencode",
      ["run", "--archived", "--model", model, "--file", logFile, "--file", "src/lib.rs", prompt],
      { maxBuffer: 16 * 1024 * 1024 },
    );
    const summary = stdout.trim();
    if (!summary.startsWith("Uses upstream PDFium version")) {
      throw new Error(`Unexpected changeset draft from ${model}:\n${summary}`);
    }
    const file = `.changeset/pdfium-${lock.release.replace(/\W+/g, "-")}.md`;
    await writeFile(file, `---\n"@craftlions/pdfium-rs": patch\n---\n\n${summary}\n`);
    console.log(`Wrote ${file}. Review it before committing.`);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}

const { values: options, positionals } = parseArgs({
  allowPositionals: true,
  options: { "skip-changeset": { type: "boolean", default: false } },
});

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

if (!options["skip-changeset"]) {
  await draftChangeset(previous, lock);
}

const pdfiumRender = (await readFile("Cargo.toml", "utf8")).match(/pdfium-render = \{ version = "([^"]+)"/)?.[1];
console.log(`Check that pdfium-render ${pdfiumRender ?? "?"} supports ${lock.release}; bump it in Cargo.toml if needed.`);
