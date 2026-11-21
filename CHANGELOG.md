# @craftlions/pdfium-rs

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
