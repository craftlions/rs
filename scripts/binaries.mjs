import { glob, copyFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

for (const platform of ["darwin-arm64", "darwin-x64", "linux-x64-gnu", "win32-x64-msvc"]) {
  let fileName = "";
  for await (const file of glob(`pdfium-binaries/${platform}/*`)) {
    fileName = file.split('/').pop();
    await copyFile(file, file.replace(`pdfium-binaries/${platform}/`, `npm/${platform}/`));
  }

  for await (const file of glob(`npm/${platform}/package.json`)) {
    console.log(`Reading ${file}`);
    console.log(`File name: ${fileName}`);
    const pkg = await import(pathToFileURL(file), {
      with: {
        type: 'json'
      }
    }).then(m => m.default);
    const newPkg = {
      ...pkg,
      files: [
        ...pkg.files,
        fileName
      ]
    };
    await writeFile(file, JSON.stringify(newPkg, null, 2));
  }
}

