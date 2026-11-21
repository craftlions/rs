// Third-party code shipped in the platform packages: the Rust crates linked into the addon and PDFium.
// Used by prepare-packages.ts (license notices) and sbom.ts (SBOM). Run `cargo fetch --locked` first.
import { execFile as execFileRaw } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import type { Platform } from "./install-pdfium.ts";

const execFile = promisify(execFileRaw);

export const targets: Record<Platform, string> = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
  "linux-x64-gnu": "x86_64-unknown-linux-gnu",
  "win32-x64-msvc": "x86_64-pc-windows-msvc",
};

export interface Crate {
  id: string;
  name: string;
  version: string;
  license: string | null;
  repository: string | null;
  description: string | null;
  authors: string[];
  /** SHA-256 of the .crate file from Cargo.lock; null for the local crate. */
  checksum: string | null;
  /** False for proc-macros and crates only they use: those run at build time and are not linked into the addon. */
  linked: boolean;
  dir: string;
  /** ids of the crates this one depends on (normal dependencies only). */
  dependsOn: string[];
}

interface Metadata {
  packages: {
    id: string;
    name: string;
    version: string;
    license: string | null;
    license_file: string | null;
    repository: string | null;
    description: string | null;
    authors: string[];
    manifest_path: string;
    targets: { kind: string[] }[];
  }[];
  resolve: {
    root: string;
    nodes: { id: string; deps: { pkg: string; dep_kinds: { kind: string | null }[] }[] }[];
  };
}

async function lockChecksums(): Promise<Map<string, string>> {
  const lock = await readFile("Cargo.lock", "utf8");
  const checksums = new Map<string, string>();
  for (const block of lock.split("[[package]]")) {
    const name = block.match(/^name = "([^"]+)"/m)?.[1];
    const version = block.match(/^version = "([^"]+)"/m)?.[1];
    const checksum = block.match(/^checksum = "([^"]+)"/m)?.[1];
    if (name && version && checksum) checksums.set(`${name}@${version}`, checksum);
  }
  return checksums;
}

/** The local crate and every crate reachable from it through normal (non-build, non-dev) dependencies on `target`. */
export async function rustCrates(target: string): Promise<{ root: Crate; crates: Crate[] }> {
  const { stdout } = await execFile(
    "cargo",
    ["metadata", "--format-version", "1", "--locked", "--offline", "--filter-platform", target],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  const metadata = JSON.parse(stdout) as Metadata;
  const checksums = await lockChecksums();
  const packages = new Map(metadata.packages.map((p) => [p.id, p]));
  const nodes = new Map(metadata.resolve.nodes.map((n) => [n.id, n]));

  const crates = new Map<string, Crate>();
  const visit = (id: string) => {
    if (crates.has(id)) return;
    const pkg = packages.get(id);
    const node = nodes.get(id);
    if (!pkg || !node) throw new Error(`cargo metadata is missing ${id}`);
    const dependsOn = node.deps.filter((d) => d.dep_kinds.some((k) => k.kind === null)).map((d) => d.pkg);
    crates.set(id, {
      id,
      name: pkg.name,
      version: pkg.version,
      license: pkg.license,
      repository: pkg.repository,
      description: pkg.description,
      authors: pkg.authors,
      checksum: checksums.get(`${pkg.name}@${pkg.version}`) ?? null,
      linked: false,
      dir: dirname(pkg.manifest_path),
      dependsOn,
    });
    for (const dep of dependsOn) visit(dep);
  };
  visit(metadata.resolve.root);

  const root = crates.get(metadata.resolve.root);
  if (!root) throw new Error("cargo metadata has no root crate");
  const isProcMacro = (id: string) => packages.get(id)!.targets.some((t) => t.kind.includes("proc-macro"));
  const link = (crate: Crate) => {
    if (crate.linked || isProcMacro(crate.id)) return;
    crate.linked = true;
    for (const dep of crate.dependsOn) link(crates.get(dep)!);
  };
  link(root);
  crates.delete(root.id);
  return { root, crates: [...crates.values()].sort((a, b) => a.id.localeCompare(b.id)) };
}

const mitText = (holders: string) => `MIT License

Copyright (c) ${holders}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

/**
 * License and notice files a crate ships, as [file name, text]. Crates that publish no license file but offer MIT
 * get the standard MIT text with their Cargo.toml authors as copyright holders; anything else is an error.
 */
export async function crateLicenseTexts(crate: Crate): Promise<[string, string][]> {
  const files = (await readdir(crate.dir)).filter((f) => /^(licen[cs]e|copying|notice|unlicense)/i.test(f)).sort();
  if (files.length > 0) {
    return Promise.all(files.map(async (f): Promise<[string, string]> => [f, await readFile(join(crate.dir, f), "utf8")]));
  }
  if (crate.license && /(^|[\s(/])MIT($|[\s)/])/.test(crate.license)) {
    const holders = crate.authors.map((a) => a.replace(/\s*<[^>]*>/, "")).join(", ") || `the ${crate.name} authors`;
    return [["LICENSE-MIT (standard text; the crate publishes no license file)", mitText(holders)]];
  }
  throw new Error(`${crate.name} ${crate.version} (${crate.license}) ships no license file and does not offer MIT`);
}

/** PDFium license files that install-pdfium.ts extracted for a platform, as [file name, text]. */
export async function pdfiumLicenseTexts(platform: Platform): Promise<[string, string][]> {
  const dir = `vendor/pdfium/${platform}/licenses`;
  const files = (await readdir(dir)).sort();
  return Promise.all(files.map(async (f): Promise<[string, string]> => [f, await readFile(join(dir, f), "utf8")]));
}
