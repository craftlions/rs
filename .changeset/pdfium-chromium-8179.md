---
"@craftlions/pdfium-rs": patch
---

Uses upstream PDFium version [PDFium 160.0.8179.0](https://github.com/bblanchon/pdfium-binaries/releases/tag/chromium%2F8179).

- Sped up mask compositing during page rendering using 16-bit SIMD lanes, processing twice as many pixels per iteration on SSE and AVX2 CPUs (cb73733715a1)
- Updated the bundled FreeType font rendering library with 16 upstream commits (96cb92b773d8)
