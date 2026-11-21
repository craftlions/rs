---
"@craftlions/pdfium-rs": patch
---

Fix the binding version check in `index.js`, which expected 0.0.15 in 0.1.0 and failed to load with `NAPI_RS_ENFORCE_VERSION_CHECK` set.
