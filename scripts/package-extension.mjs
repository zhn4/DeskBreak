import { ZipArchive } from "archiver";
import { build } from "vite";
import { createWriteStream } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const distDirectory = path.join(projectRoot, "dist");
const releaseDirectory = path.join(projectRoot, "release");

await build();

const manifestPath = path.join(distDirectory, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (typeof manifest.version !== "string" || !manifest.version) {
  throw new Error(`Missing a valid extension version in ${manifestPath}`);
}

await mkdir(releaseDirectory, { recursive: true });

const archivePath = path.join(releaseDirectory, `DeskBreak-v${manifest.version}.zip`);
const output = createWriteStream(archivePath);
const archive = new ZipArchive({ zlib: { level: 9 } });

const archiveClosed = new Promise((resolve, reject) => {
  output.on("close", resolve);
  output.on("error", reject);
  archive.on("error", reject);
  archive.on("warning", reject);
});

archive.pipe(output);
archive.directory(distDirectory, false);
await archive.finalize();
await archiveClosed;

console.log(`Extension package created: ${path.relative(projectRoot, archivePath)}`);
