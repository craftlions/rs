---
"@craftlions/pdfium-rs": patch
---

Stop bundling every platform's addon and PDFium library (~47 MB) in the main package; installs now download only the platform package they need.
