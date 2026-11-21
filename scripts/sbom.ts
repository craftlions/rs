#!/usr/bin/env node
// Writes a CycloneDX 1.5 SBOM of the release to the path given as argument (default sbom.cdx.json).
// It merges `aube sbom` (the npm graph; dev tools as scope "excluded") with what the npm graph cannot see:
// the four platform packages, the Rust crates compiled into the addon and the PDFium binaries.
// Needs `cargo fetch --locked` and `mise deps install pdfium` first.
import { execFile as execFileRaw } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { assetUrl, platforms, readLock } from "./install-pdfium.ts";
import { pdfiumLicenseTexts, rustCrates, targets, type Crate } from "./third-party.ts";

const execFile = promisify(execFileRaw);
const out = process.argv[2] ?? "sbom.cdx.json";

interface Component {
  type: string;
  "bom-ref": string;
  name: string;
  version?: string;
  description?: string;
  scope?: "required" | "optional" | "excluded";
  purl?: string;
  licenses?: ({ license: { id?: string; name?: string } } | { expression: string })[];
  hashes?: { alg: string; content: string }[];
  externalReferences?: { type: string; url: string; comment?: string; hashes?: { alg: string; content: string }[] }[];
  properties?: { name: string; value: string }[];
  components?: Component[];
}

interface Bom {
  bomFormat: "CycloneDX";
  specVersion: string;
  serialNumber?: string;
  version: number;
  metadata: { timestamp: string; tools: { components: Component[] }; component: Component };
  components: Component[];
  dependencies: { ref: string; dependsOn: string[] }[] | null;
}

const { stdout } = await execFile("aube", ["sbom", "--format", "cyclonedx"], { maxBuffer: 64 * 1024 * 1024 });
const bom = JSON.parse(stdout) as Bom;
const pkg = JSON.parse(await readFile("package.json", "utf8")) as { name: string; version: string; description: string };
const lock = await readLock();
const npmPurl = (name: string, version: string) => `pkg:npm/${name.replace(/^@/, "%40")}@${version}`;
// Cargo license fields are SPDX expressions ("/" is the legacy OR). They go in `expression`, because CycloneDX 1.5
// validates `id` against an older SPDX list that lacks newer ids such as Unicode-3.0.
const license = (expression: string | null): NonNullable<Component["licenses"]> | undefined =>
  expression ? [{ expression: expression.replace(/\s*\/\s*/g, " OR ") }] : undefined;

// The published package itself.
const rootRef = npmPurl(pkg.name, pkg.version);
bom.serialNumber = `urn:uuid:${randomUUID()}`;
bom.metadata.tools.components.push({ type: "application", "bom-ref": "scripts/sbom.ts", name: "scripts/sbom.ts" });
bom.metadata.component = {
  ...bom.metadata.component,
  type: "library",
  "bom-ref": rootRef,
  purl: rootRef,
  description: pkg.description,
  licenses: [{ license: { id: "MIT" } }],
};
const dependencies = new Map<string, Set<string>>();
const dependOn = (from: string, to: string) => {
  if (!dependencies.has(from)) dependencies.set(from, new Set());
  dependencies.get(from)!.add(to);
};

// PDFium: one component with each platform archive as a hashed distribution and the bundled libraries inside.
const pdfiumRef = `pkg:github/bblanchon/pdfium-binaries@${encodeURIComponent(lock.release)}`;
// One component per library built into PDFium, named after its license file(s) (some have two).
const bundled = new Map<string, string[]>();
for (const [file] of await pdfiumLicenseTexts("linux-x64-gnu")) {
  if (file === "pdfium.txt" || file === "pdfium-binaries.txt") continue;
  const name = file.replace(/\.(txt|md|ijg)$/, "").replace(/-(Apache2-LLVM|Boost)$/, "");
  bundled.set(name, [...(bundled.get(name) ?? []), file]);
}
const pdfium: Component = {
  type: "library",
  "bom-ref": pdfiumRef,
  name: "pdfium",
  version: lock.version,
  description: `PDFium ${lock.version}, prebuilt by bblanchon/pdfium-binaries ${lock.release}`,
  scope: "required",
  purl: pdfiumRef,
  licenses: [{ license: { id: "BSD-3-Clause" } }],
  externalReferences: [
    { type: "website", url: "https://pdfium.googlesource.com/pdfium/" },
    ...platforms.map((platform) => ({
      type: "distribution",
      url: assetUrl(lock.release, lock.assets[platform].name),
      comment: platform,
      hashes: [{ alg: "SHA-256", content: lock.assets[platform].sha256 }],
    })),
  ],
  components: [...bundled].map(([name, files]) => ({
    type: "library",
    "bom-ref": `${pdfiumRef}#${name}`,
    name,
    licenses: files.map((file) => ({ license: { name: `See licenses/pdfium/${file} in the platform package` } })),
  })),
};

// Rust crates, merged over the four targets; linked into the addon on at least one target => required.
const crates = new Map<string, { crate: Crate; linkedOn: string[] }>();
const crateRef = (c: Crate) => `pkg:cargo/${c.name}@${c.version}`;
const platformComponents: Component[] = [];
for (const platform of platforms) {
  const { root, crates: list } = await rustCrates(targets[platform]);
  const name = `${pkg.name}-${platform}`;
  const ref = npmPurl(name, pkg.version);
  platformComponents.push({
    type: "library",
    "bom-ref": ref,
    name,
    version: pkg.version,
    description: `Native addon (${targets[platform]}) and PDFium library`,
    scope: "optional",
    purl: ref,
    licenses: [{ license: { id: "MIT" } }],
  });
  dependOn(rootRef, ref);
  dependOn(ref, pdfiumRef);
  for (const dep of root.dependsOn) dependOn(ref, crateRef(list.find((c) => c.id === dep)!));
  for (const crate of list) {
    const entry = crates.get(crateRef(crate)) ?? { crate, linkedOn: [] };
    if (crate.linked) entry.linkedOn.push(platform);
    crates.set(crateRef(crate), entry);
    for (const dep of crate.dependsOn) dependOn(crateRef(crate), crateRef(list.find((c) => c.id === dep)!));
  }
}
const crateComponents: Component[] = [...crates].map(([ref, { crate, linkedOn }]): Component => {
  const licenses = license(crate.license);
  return {
    type: "library",
    "bom-ref": ref,
    name: crate.name,
    version: crate.version,
    ...(crate.description ? { description: crate.description.trim() } : {}),
    scope: linkedOn.length > 0 ? "required" : "excluded",
    purl: ref,
    ...(licenses ? { licenses } : {}),
    ...(crate.checksum ? { hashes: [{ alg: "SHA-256", content: crate.checksum }] } : {}),
    ...(crate.repository ? { externalReferences: [{ type: "vcs", url: crate.repository }] } : {}),
    properties:
      linkedOn.length > 0
        ? [{ name: "craftlions:linked-on", value: linkedOn.join(",") }]
        : [{ name: "craftlions:build-time-only", value: "true" }],
  };
});

bom.components = [...platformComponents, pdfium, ...crateComponents, ...bom.components];
bom.dependencies = [...(bom.dependencies ?? []), ...[...dependencies].map(([ref, deps]) => ({ ref, dependsOn: [...deps].sort() }))];

// Every reference must resolve to a component.
const refs = new Set([rootRef, ...bom.components.flatMap((c) => [c["bom-ref"], ...(c.components ?? []).map((s) => s["bom-ref"])])]);
if (refs.size !== 1 + bom.components.reduce((n, c) => n + 1 + (c.components?.length ?? 0), 0)) {
  throw new Error("Duplicate bom-ref in SBOM");
}
for (const { ref, dependsOn } of bom.dependencies) {
  for (const r of [ref, ...dependsOn]) if (!refs.has(r)) throw new Error(`SBOM dependency ${r} has no component`);
}

await writeFile(out, `${JSON.stringify(bom, null, 2)}\n`);
const required = crateComponents.filter((c) => c.scope === "required").length;
console.log(
  `${out}: ${platformComponents.length} platform packages, PDFium with ${bundled.size} bundled libraries, ` +
    `${crateComponents.length} Rust crates (${required} linked), ${bom.components.length} components total`,
);
