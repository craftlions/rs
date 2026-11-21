#!/usr/bin/env node
// Completes the platform packages in npm/<platform> after `napi create-npm-dirs` and `napi artifacts`:
// adds the PDFium library, this package's LICENSE and the license notices of all bundled third-party code.
import { copyFile, cp, readdir, readFile, writeFile } from "node:fs/promises";
import { platforms } from "./install-pdfium.ts";
import { crateLicenseTexts, pdfiumLicenseTexts, rustCrates, targets } from "./third-party.ts";

const libraries: Record<string, string> = {
  "darwin-arm64": "libpdfium.dylib",
  "darwin-x64": "libpdfium.dylib",
  "linux-x64-gnu": "libpdfium.so",
  "win32-x64-msvc": "pdfium.dll",
};

const { version: pdfiumVersion, release } = JSON.parse(await readFile("pdfium.lock.json", "utf8")) as {
  version: string;
  release: string;
};

for (const platform of platforms) {
  const dir = `npm/${platform}`;
  const library = libraries[platform]!;
  await copyFile(`vendor/pdfium/${platform}/${library}`, `${dir}/${library}`);
  await copyFile("LICENSE", `${dir}/LICENSE`);
  await cp(`vendor/pdfium/${platform}/licenses`, `${dir}/licenses/pdfium`, { recursive: true });

  const { crates } = await rustCrates(targets[platform]);
  const linked = crates.filter((c) => c.linked);
  // Identical license texts (e.g. the Apache-2.0 text) are printed once and referenced by number.
  const texts = new Map<string, number>();
  const rows: string[] = [];
  for (const crate of linked) {
    const refs: string[] = [];
    for (const [file, text] of await crateLicenseTexts(crate)) {
      const normalized = text.replace(/\r\n/g, "\n").trim();
      if (!texts.has(normalized)) texts.set(normalized, texts.size + 1);
      refs.push(`[${file}](#text-${texts.get(normalized)})`);
    }
    const source = crate.repository ? ` · ${crate.repository}` : "";
    rows.push(`- **${crate.name} ${crate.version}** — ${crate.license ?? "see license text"}${source} — ${refs.join(", ")}`);
  }
  const textSections = [...texts].map(
    ([text, n]) => `<a id="text-${n}"></a>\n\n### Text ${n}\n\n\`\`\`text\n${text}\n\`\`\``,
  );
  const pdfiumFiles = (await pdfiumLicenseTexts(platform)).map(([file]) => `- licenses/pdfium/${file}`);
  await writeFile(
    `${dir}/THIRD_PARTY_NOTICES.md`,
    `# Third-party notices\n\n` +
      `This package contains PDFium ${pdfiumVersion} (${library}, built by bblanchon/pdfium-binaries ${release}) ` +
      `and a native addon that statically links the Rust crates listed below.\n\n` +
      `## PDFium\n\nThe licenses of PDFium and the libraries built into it are in:\n\n${pdfiumFiles.join("\n")}\n\n` +
      `## Rust crates\n\n${rows.join("\n")}\n\n## License texts\n\n${textSections.join("\n\n")}\n`,
  );

  const pkgPath = `${dir}/package.json`;
  const pkg = JSON.parse(await readFile(pkgPath, "utf8")) as { files?: string[]; license?: string };
  pkg.license = "MIT";
  // napi prepublish requires every `files` entry to be a regular file, so list the license files one by one.
  const licenseFiles = (await readdir(`${dir}/licenses`, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath.slice(dir.length + 1)}/${entry.name}`.replaceAll("\\", "/"))
    .sort();
  pkg.files = [...new Set([...(pkg.files ?? []), library, "LICENSE", "THIRD_PARTY_NOTICES.md", ...licenseFiles])];
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(`${dir}: ${library}, LICENSE, ${pdfiumFiles.length} PDFium licenses, ${linked.length} Rust crates`);
}
