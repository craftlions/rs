---
"@craftlions/pdfium-rs": minor
---

**Breaking:** pdfToPng now renders on the libuv thread pool and returns a `Promise<Buffer>` instead of a `Buffer`, so rendering no longer blocks the JavaScript thread. Add `await` where you use the result.
