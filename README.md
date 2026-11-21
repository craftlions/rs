<!-- Node.js bindings ❤️ Rust crates -->

# @craftlions/rs

When `Node.js meet Rust` = 🚀

# napi-rs

Make rust crates binding to Node.js use [napi-rs](https://github.com/napi-rs/napi-rs)

# Packages

| Package                                            | Version                                                     | Downloads                                                                  | Description                                                                |
| -------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| [`@craftlions/pdfium-rs`](./)               | ![](https://img.shields.io/npm/v/@craftlions/pdfium-rs.svg)        | ![](https://img.shields.io/npm/dm/@craftlions/pdfium-rs.svg?sanitize=true)        | `pdfium` |
| [`@craftlions/oxipng-rs`](./)               | ![](https://img.shields.io/npm/v/@craftlions/oxipng-rs.svg)        | ![](https://img.shields.io/npm/dm/@craftlions/oxipng-rs.svg?sanitize=true)        | `oxipng` |

# DEVELOPMENT

Tools (Node.js, Rust, aube, jactionlint, shellcheck) are pinned in `mise.toml` and locked in `mise.lock`.
mise installs Node.js dependencies automatically before `mise run` / `mise exec` (`[deps.aube]`).

```zsh
mise install        # install the toolchain
mise run test       # build the addon and run the test suite
mise tasks          # list all tasks
```

<!-- mise-tasks -->
## `bench`

Benchmark pdfToPng (latency, throughput, event-loop blocking, compression)


- Depends: build, local-pdfium

- **Usage:** `bench [FLAGS] [pdf]`

### Arguments
- **`[pdf]`** — PDF to render

  **Default:** `sample.pdf`

### Flags
- **`--iterations <n>`**

  **Default:** `50`
- **`--concurrency <list>`**

  **Default:** `1,2,4,8`
- **`--compression <list>`**

  **Default:** `none,fast,balanced,best`

## `build`

Build the native addon for the host platform


- **Usage:** `build [target]`
- **Aliases:** `b`

### Arguments
- **`[target]`** — Rust target triple (defaults to host)

## `changeset`

Add a changeset non-interactively (bump: patch|minor|major)


- **Usage:** `changeset <bump> <summary>`

### Arguments
- **`<bump>`** — Version bump

  **Choices:** `patch`, `minor`, `major`
- **`<summary>`** — Changelog summary

## `lint`

- Depends: fetch

- **Usage:** `lint`
- **Aliases:** `l`

Run clippy with the Cargo.toml lint configuration (warnings are errors)

## `sample`

Generate a random, seed-reproducible PDF (shapes, text, curves)


- **Usage:** `sample [FLAGS]`

### Flags
- **`--out <file>`** — Output path

  **Default:** `sample.pdf`
- **`--pages <n>`** — Number of pages

  **Default:** `3`
- **`--shapes <n>`** — Shapes per page

  **Default:** `200`
- **`--seed <n>`** — PRNG seed; random when omitted

## `test`

- Depends: build, local-pdfium

- **Usage:** `test`
- **Aliases:** `t`

Run the node:test suite against sample.pdf

## `typecheck`

- **Usage:** `typecheck`
- **Aliases:** `tc`

Type-check TypeScript sources with tsc (TypeScript 7)

## `update-pdfium`

- **Usage:** `update-pdfium`

Download the pinned PDFium binaries into vendor/pdfium (PDFIUM_RELEASE overrides the pin)

## `version`

- **Usage:** `version`

Apply changesets: bump package.json, write CHANGELOG.md and sync the Cargo.toml version
<!-- /mise-tasks -->

# RELEASE

```zsh
mise deps install pdfium   # PDFium release is pinned in mise-tasks/update-pdfium.ts (PDFIUM_RELEASE)
```

```zsh
mise run changeset patch "Uses upstream PDFium version ..."
```

> Uses upstream PDFium version [PDFium 160.0.8165.0](https://github.com/bblanchon/pdfium-binaries/releases/tag/chromium%2F8165), which includes changes based on commits between `chromium/7834` and `chromium/8165`

```zsh
git commit -m "update to PDFium 160.0.8165.0"
```

```zsh
mise exec -- changeset version
```

```zsh
git commit -m "release v0.0.9"
```

```zsh
git tag v0.0.9
```

```zsh
git push origin main --tags
```
