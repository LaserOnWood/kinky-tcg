import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), "..");
const assetsDirectory = path.join(projectRoot, "assets", "cartes");
const outputPath = path.join(projectRoot, "json", "gallery.json");
const builderIndexPath = path.join(assetsDirectory, "index.json");
const supportedExtensions = new Set([".avif", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"]);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 ** 2).toFixed(1)} Mo`;
}

function formatTitle(fileName) {
  return fileName
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferCategory(relativePath) {
  const parts = relativePath.split(path.sep);
  return parts.length > 1 ? parts[0] : "Collection";
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  }));
  return files.flat();
}

async function checksum(filePath) {
  const content = await fs.readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export async function generateGallery() {
  const files = await listFiles(assetsDirectory);
  const images = [];

  for (const absolutePath of files) {
    const extension = path.extname(absolutePath).toLowerCase();
    if (!supportedExtensions.has(extension)) continue;

    const relativePath = path.relative(projectRoot, absolutePath);
    const stats = await fs.stat(absolutePath);
    const name = path.basename(absolutePath, extension);
    images.push({
      id: relativePath.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase(),
      name: formatTitle(name),
      path: relativePath.split(path.sep).join("/"),
      src: relativePath.split(path.sep).map(encodeURIComponent).join("/"),
      category: inferCategory(path.relative(assetsDirectory, absolutePath)),
      extension: extension.slice(1).toUpperCase(),
      size: stats.size,
      sizeLabel: formatBytes(stats.size),
      checksum: await checksum(absolutePath)
    });
  }

  images.sort((first, second) => first.path.localeCompare(second.path, "fr"));

  // Le level-builder utilise un index plus léger, généré depuis le même scan.
  // Les fichiers supprimés ou renommés ne peuvent donc pas rester dans sa liste.
  const builderImages = images.map(({ path: imagePath, name, category }) => ({
    path: imagePath,
    name,
    category
  }));

  let previousInventory;
  try {
    previousInventory = JSON.parse(await fs.readFile(outputPath, "utf8"));
  } catch {
    previousInventory = undefined;
  }

  const galleryUnchanged = previousInventory && JSON.stringify(previousInventory.images) === JSON.stringify(images);
  if (!galleryUnchanged) {
    const inventory = { generatedAt: new Date().toISOString(), count: images.length, images };

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(`${outputPath}.tmp`, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
    await fs.rename(`${outputPath}.tmp`, outputPath);
    previousInventory = inventory;
    console.log(`gallery.json actualisé : ${inventory.count} image(s) indexée(s).`);
  } else {
    console.log(`gallery.json inchangé : ${images.length} image(s) indexée(s).`);
  }

  let previousBuilderIndex;
  try {
    previousBuilderIndex = JSON.parse(await fs.readFile(builderIndexPath, "utf8"));
  } catch {
    previousBuilderIndex = undefined;
  }

  if (JSON.stringify(previousBuilderIndex) !== JSON.stringify(builderImages)) {
    await fs.writeFile(`${builderIndexPath}.tmp`, `${JSON.stringify(builderImages, null, 2)}\n`, "utf8");
    await fs.rename(`${builderIndexPath}.tmp`, builderIndexPath);
    console.log(`assets/cartes/index.json actualisé : ${builderImages.length} image(s) indexée(s).`);
  } else {
    console.log(`assets/cartes/index.json inchangé : ${builderImages.length} image(s) indexée(s).`);
  }

  return previousInventory;
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  generateGallery().catch((error) => {
    console.error("Impossible de générer json/gallery.json :", error);
    process.exitCode = 1;
  });
}
