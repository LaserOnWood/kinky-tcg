import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "json/cartes.json");
const OUT_INDEX = join(ROOT, "json/themes.json");
const OUT_DIR = join(ROOT, "json/themes");

const RARETES = new Set(["Coquine","Provocante","Audacieuse","Envoûtante","Sulfureuse","Mythique"]);

function slugifier(id){
  return String(id)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function validerCarte(carte, contexte, ids){
  const id = Number(carte.id);
  if(!Number.isInteger(id) || id < 1 || ids.has(id)) throw new Error(`${contexte} : id invalide ou dupliqué (${carte.id}).`);
  ids.add(id);
  if(!/^[a-f0-9]{64}$/i.test(carte.passwordHash || "")) throw new Error(`${contexte} : passwordHash invalide (carte ${id}).`);
  if(!Array.isArray(carte.hints) || !carte.hints.length) throw new Error(`${contexte} : hints manquants (carte ${id}).`);
  for(const champ of ["type","title","image","description","rarity"]){
    if(typeof carte[champ] !== "string" || !carte[champ].trim()) throw new Error(`${contexte} : champ ${champ} manquant (carte ${id}).`);
  }
  if(!RARETES.has(carte.rarity)) throw new Error(`${contexte} : rareté inconnue (carte ${id}).`);
}

const brut = JSON.parse(await readFile(SRC, "utf8"));
if(!brut?.themes || !Array.isArray(brut.themes)) throw new Error("Format attendu : { themes: [...] }");

const indexThemes = [];
const slugsVus = new Set();

await mkdir(OUT_DIR, { recursive: true });

for(const theme of brut.themes){
  const slug = slugifier(theme.id);
  if(!slug || slugsVus.has(slug)) throw new Error(`Slug invalide ou dupliqué : ${theme.id}`);
  slugsVus.add(slug);

  const ids = new Set();
  const cards = (theme.cards || []).map(c => { validerCarte(c, theme.name || theme.id, ids); return c; });

  const fichier = `${slug}.json`;
  await writeFile(
    join(OUT_DIR, fichier),
    JSON.stringify({ id: slug, version: 1, mode: theme.mode || "classique", cards }, null, 2) + "\n"
  );

  indexThemes.push({
    id: slug,
    name: theme.name || slug,
    description: theme.description || "",
    difficulty: theme.difficulty || "—",
    seal: theme.seal || "♥️",
    mode: theme.mode || "classique",
    file: `themes/${fichier}`,
    cardCount: cards.length
  });
}

await writeFile(OUT_INDEX, JSON.stringify({ version: 1, themes: indexThemes }, null, 2) + "\n");
console.log(`✔ ${indexThemes.length} thèmes écrits dans json/themes/ + json/themes.json`);