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

Tools (Node.js, Rust, aube) are pinned in `mise.toml` and locked in `mise.lock`.

```zsh
mise install        # install the toolchain (runs `aube install` afterwards)
mise run build      # build the addon for the host platform
mise run lint       # clippy, warnings are errors
mise run typecheck  # tsc (TypeScript 7)
mise tasks          # list all tasks
```

# RELEASE

```zsh
mise run update-pdfium   # PDFium release is pinned in scripts/update.ts (PDFIUM_RELEASE)
```

```zsh
mise run changeset patch "Uses upstream PDFium version ..."
```

> Uses upstream PDFium version [PDFium 160.0.8165.0](https://github.com/bblanchon/pdfium-binaries/releases/tag/chromium%2F8165), which includes changes based on commits between `chromium/7834` and `chromium/8165`

```zsh
git commit -m "update to PDFium 160.0.8165.0"
```

```zsh
aube exec -- changeset version
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
