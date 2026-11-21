---
"@craftlions/pdfium-rs": patch
---

Uses upstream PDFium version [PDFium 160.0.8165.0](https://github.com/bblanchon/pdfium-binaries/releases/tag/chromium%2F8165). Also updates pdfium-render to 0.9.5.

- Patched CVE-2026-6192 in OpenJPEG for safer JPEG 2000 image decoding (65c78d0727c6)
- Fixed an out-of-bounds memory access in the path rasterizer when rendering paths at extreme coordinates (58e11305710a)
- Fixed crashes when loading malformed PDFs with out-of-range object numbers in the cross-reference table (ae277bf21448)
- Fixed swapped red and blue channels when rendering PDFs with transfer function arrays (2621636d380f)
- Fixed color banding in ICC-based gradients by removing quantized color caching (5875ad4c3a6f)
- Fixed inaccurate CMYK color rendering with blend modes and soft masks to match other PDF viewers (2b52a82ab817)
- Sped up JBIG2 Huffman decoding, greatly improving render times for JBIG2-compressed scanned PDFs (5f6ecb0cf341)
- Accelerated image scaling during page rendering with SIMD vectorization (ab5e0a9a5e84)
