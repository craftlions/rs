#!/usr/bin/env node
// Copies the package.json version into Cargo.toml and Cargo.lock. `--check` only reports a mismatch.
import { readFile, writeFile } from "node:fs/promises";

const check = process.argv.includes("--check");
const { version } = JSON.parse(await readFile("package.json", "utf8")) as { version: string };

const cargoToml = await readFile("Cargo.toml", "utf8");
const crate = cargoToml.match(/^\[package\][^[]*?^name = "([^"]+)"/m)?.[1];
if (!crate) throw new Error("No [package] name in Cargo.toml");

const files = {
  // The first `version =` after [package].
  "Cargo.toml": [cargoToml, /(^\[package\][^[]*?^version = ")[^"]+(")/m],
  // The [[package]] entry of this crate.
  "Cargo.lock": [await readFile("Cargo.lock", "utf8"), new RegExp(`(^name = "${crate}"\\nversion = ")[^"]+(")`, "m")],
} as const;

let mismatch = false;
for (const [file, [content, pattern]] of Object.entries(files)) {
  if (!pattern.test(content)) throw new Error(`No ${crate} version found in ${file}`);
  const updated = content.replace(pattern, `$1${version}$2`);
  if (updated === content) continue;
  if (check) {
    console.error(`${file} version differs from package.json ${version}; run \`node scripts/sync-version.ts\`.`);
    mismatch = true;
  } else {
    await writeFile(file, updated);
    console.log(`${file} -> ${version}`);
  }
}
if (mismatch) process.exit(1);
