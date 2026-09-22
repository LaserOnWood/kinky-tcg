/**
 * ============================================================================
 * OPTIMISATION DES IMAGES DE CARTES
 * ============================================================================
 * Réduit le poids des illustrations de assets/cartes/ :
 *   - redimensionne à LARGEUR_MAX pixels de large (jamais d'agrandissement) ;
 *   - convertit en WebP (qualité QUALITE) ;
 *   - transforme les .png / .jpg en .webp et met à jour json/cartes.json ;
 *   - ne remplace un fichier QUE si le résultat est plus léger que l'original.
 *
 * Utilisation :
 *   node scripts/optimize-images.mjs           → SIMULATION (rien n'est modifié)
 *   node scripts/optimize-images.mjs --apply   → applique réellement
 *
 * Nécessite le paquet « sharp » (installé par le workflow GitHub).
 * ============================================================================
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// ---------------------------------------------------------------- RÉGLAGES --
const LARGEUR_MAX = 1000;              // largeur maximale en pixels
const QUALITE = 90;                    // qualité WebP (1-100)
const DOSSIERS_IGNORES = new Set(["Inspiration"]); // sous-dossiers de assets/cartes/ à ne pas toucher
const EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg"]);
// ----------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const racine = path.resolve(path.dirname(__filename), "..");
const dossierCartes = path.join(racine, "assets", "cartes");
const fichierCartes = path.join(racine, "json", "cartes.json");
const appliquer = process.argv.includes("--apply");

const enKo = (octets) => `${Math.round(octets / 1024)} Ko`;
const enMo = (octets) => `${(octets / 1024 / 1024).toFixed(1)} Mo`;
const cheminRelatif = (chemin) => path.relative(racine, chemin).split(path.sep).join("/");

async function listerFichiers(dossier, estRacine = true) {
  const entrees = await fs.readdir(dossier, { withFileTypes: true });
  const fichiers = await Promise.all(entrees.map(async (entree) => {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      if (estRacine && DOSSIERS_IGNORES.has(entree.name)) return [];
      return listerFichiers(chemin, false);
    }
    return [chemin];
  }));
  return fichiers.flat();
}

async function existe(chemin) {
  try { await fs.access(chemin); return true; } catch { return false; }
}

async function main() {
  console.log(appliquer
    ? "MODE APPLICATION : les images vont être modifiées.\n"
    : "MODE SIMULATION : aucun fichier n'est modifié (ajoute --apply pour appliquer).\n");

  const fichiers = (await listerFichiers(dossierCartes))
    .filter((f) => EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort();

  const renommages = new Map(); // ancien chemin relatif → nouveau chemin relatif
  let avantTotal = 0;
  let apresTotal = 0;
  let modifiees = 0;
  let inchangees = 0;

  for (const fichier of fichiers) {
    const original = await fs.readFile(fichier);
    const ext = path.extname(fichier).toLowerCase();
    const estWebp = ext === ".webp";
    const meta = await sharp(original).metadata();
    avantTotal += original.length;

    // Déjà au bon format et déjà assez petite : on n'y touche pas.
    if (estWebp && meta.width <= LARGEUR_MAX) {
      inchangees++;
      apresTotal += original.length;
      continue;
    }

    const sortie = await sharp(original)
      .resize({ width: LARGEUR_MAX, withoutEnlargement: true })
      .webp({ quality: QUALITE, effort: 6 })
      .toBuffer();

    // On ne remplace que si le résultat est vraiment plus léger.
    if (sortie.length >= original.length) {
      console.log(`= ${cheminRelatif(fichier)} : déjà optimale (${enKo(original.length)}), conservée.`);
      inchangees++;
      apresTotal += original.length;
      continue;
    }

    const cible = estWebp ? fichier : fichier.slice(0, -ext.length) + ".webp";
    if (!estWebp && await existe(cible)) {
      console.warn(`! ${cheminRelatif(fichier)} : ${cheminRelatif(cible)} existe déjà, fichier ignoré.`);
      inchangees++;
      apresTotal += original.length;
      continue;
    }

    console.log(`✓ ${cheminRelatif(fichier)}${estWebp ? "" : ` → ${path.basename(cible)}`} : ${enKo(original.length)} → ${enKo(sortie.length)} (${meta.width}×${meta.height} → ${Math.min(meta.width, LARGEUR_MAX)} px de large)`);
    modifiees++;
    apresTotal += sortie.length;

    if (!estWebp) renommages.set(cheminRelatif(fichier), cheminRelatif(cible));

    if (appliquer) {
      await fs.writeFile(cible, sortie);
      if (cible !== fichier) await fs.unlink(fichier);
    }
  }

  // Mise à jour des chemins .png / .jpg → .webp dans json/cartes.json.
  if (renommages.size > 0) {
    let texte = await fs.readFile(fichierCartes, "utf8");
    let remplacements = 0;
    for (const [ancien, nouveau] of renommages) {
      const motif = `"${ancien}"`;
      if (texte.includes(motif)) {
        texte = texte.split(motif).join(`"${nouveau}"`);
        remplacements++;
        console.log(`  json/cartes.json : ${ancien} → ${nouveau}`);
      }
    }
    if (appliquer && remplacements > 0) await fs.writeFile(fichierCartes, texte);
  }

  console.log("\n============ RÉSUMÉ ============");
  console.log(`Images examinées : ${fichiers.length} (dossiers ignorés : ${[...DOSSIERS_IGNORES].join(", ")})`);
  console.log(`Modifiées : ${modifiees} | Laissées telles quelles : ${inchangees}`);
  console.log(`Poids total : ${enMo(avantTotal)} → ${enMo(apresTotal)} (${avantTotal ? Math.round((1 - apresTotal / avantTotal) * 100) : 0} % de moins)`);
  if (!appliquer) console.log("\nSimulation terminée : rien n'a été modifié.");
}

main().catch((erreur) => {
  console.error("Échec de l'optimisation :", erreur);
  process.exit(1);
});
