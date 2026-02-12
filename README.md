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

# RELEASE

```zsh
node scripts/update.ts
```

```zsh
pnpm changeset
```

```zsh
git commit -m "update to PDFium 146.0.7678.0"
```

```zsh
pnpm changeset version
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
