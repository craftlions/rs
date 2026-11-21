# @craftlions/pdfium-rs

## 0.1.1

### Patch Changes

- 378cbf8: Fix the binding version check in `index.js`, which expected 0.0.15 in 0.1.0 and failed to load with `NAPI_RS_ENFORCE_VERSION_CHECK` set.
- 132a20c: License the package under MIT. It previously had no license, so it could not legally be used.
- 9b0c971: Replace the placeholder npm description ("My napi-rs addon") of the main and platform packages.
- 57bc731: Stop bundling every platform's addon and PDFium library (~47 MB) in the main package; installs now download only the platform package they need.
- eb05dc8: Ship the license notices of PDFium, the libraries built into it and the Rust crates linked into the addon in every platform package (`LICENSE`, `THIRD_PARTY_NOTICES.md`, `licenses/pdfium/`).

## 0.1.0

### Minor Changes

- bdab54a: **Breaking:** pdfToPng now renders on the libuv thread pool and returns a `Promise<Buffer>` instead of a `Buffer`, so rendering no longer blocks the JavaScript thread. Add `await` where you use the result.
- 971153c: Add `compression` (`none`, `fast`, `balanced`, `best`; default `fast` as before) and `dpi` (1–1200; default 144) options to pdfToPng.

### Patch Changes

- f91a619: Fix pdfToPng failing with PdfiumLibraryBindingsAlreadyInitialized on every call after the first. PDFium is now bound once per process and shared.
- d8fb83c: Uses upstream PDFium version [PDFium 160.0.8165.0](https://github.com/bblanchon/pdfium-binaries/releases/tag/chromium%2F8165). Also updates pdfium-render to 0.9.5.
  
  - Patched CVE-2026-6192 in OpenJPEG for safer JPEG 2000 image decoding (65c78d0727c6)
  - Fixed an out-of-bounds memory access in the path rasterizer when rendering paths at extreme coordinates (58e11305710a)
  - Fixed crashes when loading malformed PDFs with out-of-range object numbers in the cross-reference table (ae277bf21448)
  - Fixed swapped red and blue channels when rendering PDFs with transfer function arrays (2621636d380f)
  - Fixed color banding in ICC-based gradients by removing quantized color caching (5875ad4c3a6f)
  - Fixed inaccurate CMYK color rendering with blend modes and soft masks to match other PDF viewers (2b52a82ab817)
  - Sped up JBIG2 Huffman decoding, greatly improving render times for JBIG2-compressed scanned PDFs (5f6ecb0cf341)
  - Accelerated image scaling during page rendering with SIMD vectorization (ab5e0a9a5e84)
- d1aea7c: Fix the Windows package (`@craftlions/pdfium-rs-win32-x64-msvc`), which shipped `pdfium.lib` instead of `pdfium.dll`, so PDFium could not be loaded at runtime.

## 0.0.15

### Patch Changes

- c51df5f: Handle PDF page image conversion errors before encoding rendered PNG output.

## 0.0.14

### Patch Changes

- b24a57a: Uses upstream PDFium version [PDFium 150.0.7834.0](https://github.com/bblanchon/pdfium-binaries/releases/tag/chromium%2F7834), which includes changes based on commits between `chromium/7825` and `chromium/7834`
