import fs from "node:fs";
import { pdfToPng } from "./index.js";

async function main() {
  const pdfData = fs.readFileSync("./sample.pdf");
  const png = await pdfToPng(pdfData)
  fs.writeFileSync("./out.png", png);
}

main().catch(console.error);
