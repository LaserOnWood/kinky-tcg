import { watch } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateGallery } from "./generate-gallery.mjs";

const __filename = fileURLToPath(import.meta.url);
const assetsDirectory = path.resolve(path.dirname(__filename), "..", "assets", "cartes");
let pendingRefresh;

async function refresh() {
  try {
    await generateGallery();
  } catch (error) {
    console.error("La mise à jour de la galerie a échoué :", error);
  }
}

await refresh();
console.log("Surveillance active : les changements dans assets/cartes/ régénèrent json/gallery.json.");

const watcher = watch(assetsDirectory, { recursive: true }, () => {
  clearTimeout(pendingRefresh);
  pendingRefresh = setTimeout(refresh, 250);
});

function stop() {
  watcher.close();
  clearTimeout(pendingRefresh);
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
