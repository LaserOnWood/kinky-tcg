/* ===========================================================================
   JEU TCG-KINKY — LOGIQUE FUSIONNÉE (v1.0)
   ---------------------------------------------------------------------------
   Ce fichier remplace à la fois :
     - game/tcg/js/passemot.js      (version "plate", une seule collection)
     - game/tcgproto/js/passemot.js (version avec écran de sélection de thèmes)

   Il détecte automatiquement le format de json/cartes.json et s'adapte :

     1) Tableau de cartes  → mode "plat" (comme l'ancien tcg)
        [ { id, passwordHash, hints, title, image, description, rarity }, ... ]

     2) Objet avec thèmes  → mode "thèmes" (comme l'ancien tcgproto)
        { "themes": [ { id, name, description, difficulty, cards: [...] }, ... ] }

   Il s'adapte aussi au gabarit HTML utilisé :
     - Si la page contient #selection-screen / #themes-container / #game-content
       (gabarit tcgproto), l'écran de choix du thème est affiché normalement.
     - Sinon (gabarit tcg, plus simple), l'écran de sélection est ignoré :
       en mode "plat" le jeu démarre directement, et si jamais le JSON contient
       des thèmes sans l'écran de sélection correspondant, le premier thème est
       chargé automatiquement pour que le jeu reste jouable.
   =========================================================================== */

const CARTES_URL = "json/cartes.json";

// Mode "plat" : mêmes clés que l'ancien tcg/js/passemot.js (progression conservée).
const FLAT_STORAGE_KEY = "kinky_tcg_progress_v0.4.a.hints";
const FLAT_HINTS_KEY = "kinky_tcg_hints_revealed";

// Mode "thèmes" : mêmes préfixes que l'ancien tcgproto/js/passemot.js.
const THEME_STORAGE_BASE = "kinky_tcg_progress_v0.2";
const THEME_HINTS_BASE = "kinky_tcg_hints_revealed";

const RARETES_AUTORISEES = new Set([
  "Coquine",
  "Provocante",
  "Audacieuse",
  "Envoûtante",
  "Sulfureuse",
  "Mythique"
]);

let MODE = null;           // "flat" | "themes"
let THEMES = [];           // uniquement rempli en mode "themes"
let CARTES = [];           // collection actuellement jouée
let selectedThemeId = null;
let sceauActuel = "✦";     // symbole affiché au dos des cartes, personnalisable par thème
let debloquees = new Set();
let indicesReveles = {};

/* ===========================================================================
   UTILITAIRES
   =========================================================================== */

function $(id){
  return document.getElementById(id);
}

// Calcule le hash SHA-256 (hexadécimal) d'une chaîne, via l'API native du navigateur.
async function sha256(message){
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Normalise la saisie : minuscules + suppression des espaces superflus.
function normaliser(texte){
  return texte.trim().toLowerCase();
}

function getStorageKey(){
  return selectedThemeId ? `${THEME_STORAGE_BASE}_${selectedThemeId}` : FLAT_STORAGE_KEY;
}

function getHintsKey(){
  return selectedThemeId ? `${THEME_HINTS_BASE}_${selectedThemeId}` : FLAT_HINTS_KEY;
}

function chargerProgression(){
  try{
    const brut = localStorage.getItem(getStorageKey());
    return brut ? new Set(JSON.parse(brut)) : new Set();
  }catch(e){
    return new Set();
  }
}

function sauverProgression(setDebloquees){
  try{
    localStorage.setItem(getStorageKey(), JSON.stringify([...setDebloquees]));
  }catch(e){
    console.error("Impossible d'enregistrer la progression :", e);
  }
}

function chargerIndicesReveles(){
  try{
    const brut = localStorage.getItem(getHintsKey());
    const donnees = brut ? JSON.parse(brut) : {};
    return donnees && typeof donnees === "object" && !Array.isArray(donnees) ? donnees : {};
  }catch(e){
    return {};
  }
}

function sauverIndicesReveles(indicesObj){
  try{
    localStorage.setItem(getHintsKey(), JSON.stringify(indicesObj));
  }catch(e){
    console.error("Impossible d'enregistrer les indices révélés :", e);
  }
}

function echapperHTML(valeur){
  return String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[caractere]);
}

/* ===========================================================================
   VALIDATION DES DONNÉES
   ---------------------------------------------------------------------------
   Reprend la validation stricte de l'ancien tcg/js/passemot.js et l'applique
   aussi bien au mode "plat" qu'à chaque thème en mode "thèmes", pour que les
   erreurs de contenu (indice manquant, hash mal formé, etc.) soient signalées
   clairement au lieu de faire planter ou de fausser silencieusement le jeu.
   =========================================================================== */

function validerCartes(donnees, contexte){
  if(!Array.isArray(donnees) || donnees.length === 0){
    throw new Error(`${contexte} doit contenir au moins une carte.`);
  }

  const ids = new Set();

  return donnees.map((carte, index) => {
    const position = index + 1;

    if(!carte || typeof carte !== "object" || Array.isArray(carte)){
      throw new Error(`${contexte} : la carte n°${position} est invalide.`);
    }

    const id = Number(carte.id);
    if(!Number.isInteger(id) || id < 1 || ids.has(id)){
      throw new Error(`${contexte} : l'identifiant de la carte n°${position} doit être un entier unique.`);
    }
    ids.add(id);

    if(typeof carte.passwordHash !== "string" || !/^[a-f0-9]{64}$/i.test(carte.passwordHash)){
      throw new Error(`${contexte} : le passwordHash de la carte n°${id} doit être un hash SHA-256 valide.`);
    }

    if(!Array.isArray(carte.hints) || carte.hints.length === 0 || carte.hints.some(indice => typeof indice !== "string" || !indice.trim())){
      throw new Error(`${contexte} : la carte n°${id} doit contenir au moins un indice valide dans « hints ».`);
    }

    for(const champ of ["type", "title", "image", "description", "rarity"]){
      if(typeof carte[champ] !== "string" || !carte[champ].trim()){
        throw new Error(`${contexte} : le champ « ${champ} » de la carte n°${id} est obligatoire.`);
      }
    }

    if(!RARETES_AUTORISEES.has(carte.rarity)){
      throw new Error(`${contexte} : la rareté de la carte n°${id} n'est pas reconnue.`);
    }

    return {
      id,
      passwordHash: carte.passwordHash.toLowerCase(),
      hints: carte.hints.map(indice => indice.trim()),
      type: carte.type,
      title: carte.title,
      image: carte.image,
      description: carte.description,
      actions: (typeof carte.actions === "string" && carte.actions.trim()) ? carte.actions.trim() : "(aucune action définie)",
      rarity: carte.rarity
    };
  });
}

function validerThemes(themesData){
  if(!Array.isArray(themesData) || themesData.length === 0){
    throw new Error("« themes » doit contenir au moins un thème.");
  }

  const idsThemes = new Set();

  return themesData.map((theme, index) => {
    const position = index + 1;

    if(!theme || typeof theme !== "object" || Array.isArray(theme)){
      throw new Error(`Le thème n°${position} est invalide.`);
    }

    const id = String(theme.id ?? "").trim();
    if(!id || idsThemes.has(id)){
      throw new Error(`Le thème n°${position} doit avoir un « id » unique et non vide.`);
    }
    idsThemes.add(id);

    const name = (typeof theme.name === "string" && theme.name.trim()) ? theme.name.trim() : id;

    return {
      id,
      name,
      description: (typeof theme.description === "string") ? theme.description.trim() : "",
      difficulty: (typeof theme.difficulty === "string" && theme.difficulty.trim()) ? theme.difficulty.trim() : "—",
      // Symbole affiché au dos des cartes (dans .seal). Optionnel dans le JSON,
      // par défaut "✦" si absent ou vide. Peut être un emoji ou un court symbole.
      seal: (typeof theme.seal === "string" && theme.seal.trim()) ? theme.seal.trim() : "✦",
      cards: validerCartes(theme.cards, `Le thème « ${name} »`)
    };
  });
}

async function chargerDonnees(){
  const reponse = await fetch(CARTES_URL, { cache: "no-store" });

  if(!reponse.ok){
    throw new Error(`Impossible de charger ${CARTES_URL} (${reponse.status}).`);
  }

  const donnees = await reponse.json();

  if(Array.isArray(donnees)){
    MODE = "flat";
    CARTES = validerCartes(donnees, "json/cartes.json");
  } else if(donnees && typeof donnees === "object" && Array.isArray(donnees.themes)){
    MODE = "themes";
    THEMES = validerThemes(donnees.themes);
  } else {
    throw new Error("Format de json/cartes.json non reconnu (tableau de cartes, ou objet { \"themes\": [...] } attendu).");
  }
}

/* ===========================================================================
   AGRANDISSEMENT DE L'IMAGE (LIGHTBOX)
   ---------------------------------------------------------------------------
   Clic sur l'illustration d'une carte débloquée → aperçu en grand, superposé
   à toute la page. Fermeture au clic sur le fond, sur le bouton, ou touche
   Échap. Créée dynamiquement (aucun ajout requis dans index.html).
   =========================================================================== */

function creerLightbox(){
  if($("art-lightbox")){ return; } // déjà créée (ex: rendu répété)

  const overlay = document.createElement("div");
  overlay.id = "art-lightbox";
  overlay.className = "art-lightbox";
  overlay.innerHTML = `
    <button type="button" class="art-lightbox-close" aria-label="Fermer l'aperçu">✕</button>
    <img class="art-lightbox-img" alt="">
  `;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", evenement => {
    // Ferme si on clique sur le fond sombre ou sur le bouton (pas sur l'image).
    if(evenement.target === overlay || evenement.target.closest(".art-lightbox-close")){
      fermerLightbox();
    }
  });

  document.addEventListener("keydown", evenement => {
    if(evenement.key === "Escape"){
      fermerLightbox();
    }
  });
}

function ouvrirLightbox(src, alt){
  const overlay = $("art-lightbox");
  if(!overlay){ return; }
  overlay.querySelector(".art-lightbox-img").src = src;
  overlay.querySelector(".art-lightbox-img").alt = alt || "";
  overlay.classList.add("show");
}

function fermerLightbox(){
  $("art-lightbox")?.classList.remove("show");
}

/* ===========================================================================
   GESTION DES THÈMES
   =========================================================================== */

function ecranSelectionDisponible(){
  return Boolean($("selection-screen") && $("themes-container") && $("game-content"));
}

function afficherSelectionThemes(){
  const container = $("themes-container");
  const selectionScreen = $("selection-screen");
  const gameContent = $("game-content");

  selectionScreen.classList.remove("hidden");
  gameContent.classList.add("hidden");

  container.innerHTML = THEMES.map(theme => `
    <div class="theme-card" data-theme-id="${echapperHTML(theme.id)}">
      <h3>${echapperHTML(theme.name)}</h3>
      <p>${echapperHTML(theme.description)}</p>
      <div class="theme-info">
        <span class="diff-badge">${echapperHTML(theme.difficulty)}</span>
        <span class="card-count">${theme.cards.length} cartes</span>
      </div>
    </div>
  `).join("");
}

function choisirTheme(themeId){
  const theme = THEMES.find(t => t.id === themeId);
  if(!theme){ return; }

  selectedThemeId = theme.id;
  CARTES = theme.cards; // déjà validées par validerThemes()
  sceauActuel = theme.seal;

  debloquees = chargerProgression();
  indicesReveles = chargerIndicesReveles();

  const titre = $("game-title");
  if(titre){ titre.textContent = theme.name; }

  // Le niveau reste visible dans la zone droite du header.
  const niveau = $("game-level-text");
  if(niveau){ niveau.textContent = theme.difficulty || "Niveau"; }

  if(ecranSelectionDisponible()){
    $("selection-screen").classList.add("hidden");
    $("game-content").classList.remove("hidden");
  }

  nettoyerProgression();
  nettoyerIndicesReveles();
  rendreGrille();
  rendreProgression();

  input.disabled = false;
  btn.disabled = false;
  feedback.textContent = "";
}

// Délégation d'événements : fonctionne même si la grille de thèmes est
// régénérée (au lieu d'un onclick="" par carte, fragile et peu sûr).
$("themes-container")?.addEventListener("click", evenement => {
  const carte = evenement.target.closest(".theme-card");
  if(carte && carte.dataset.themeId){
    choisirTheme(carte.dataset.themeId);
  }
});

$("back-to-selection")?.addEventListener("click", () => {
  afficherSelectionThemes();
});

/* ===========================================================================
   ÉTAT & RENDU
   =========================================================================== */

function nettoyerProgression(){
  const idsValides = new Set(CARTES.map(carte => carte.id));
  debloquees = new Set([...debloquees].map(Number).filter(id => idsValides.has(id)));
  sauverProgression(debloquees);
}

function nettoyerIndicesReveles(){
  const cartesParId = new Map(CARTES.map(carte => [carte.id, carte]));
  const indicesNettoyes = {};

  for(const [idTexte, indice] of Object.entries(indicesReveles)){
    const carte = cartesParId.get(Number(idTexte));
    const indiceNombre = Number(indice);

    if(carte && Number.isInteger(indiceNombre) && indiceNombre >= 0){
      indicesNettoyes[carte.id] = indiceNombre % carte.hints.length;
    }
  }

  indicesReveles = indicesNettoyes;
  sauverIndicesReveles(indicesReveles);
}

function obtenirIndiceActuel(carteId){
  const indice = Number(indicesReveles[carteId]);
  return Number.isInteger(indice) && indice >= 0 ? indice : 0;
}

function creerCarteHTML(carte){
  const estDebloquee = debloquees.has(carte.id);
  const indiceActuel = obtenirIndiceActuel(carte.id);
  const texteIndice = carte.hints[indiceActuel] || carte.hints[0];
  const aPlusieursIndices = carte.hints.length > 1;

  return `
    <div class="card-slot">
      <div class="card ${estDebloquee ? "unlocked" : ""}" data-id="${carte.id}">
        <div class="face back">
          <div class="seal">${echapperHTML(sceauActuel)}</div>
          <div class="num">${echapperHTML(carte.type)}</div>
          <div class="hint">${echapperHTML(texteIndice)}</div>
          ${aPlusieursIndices ? `<button class="hint-btn" type="button" data-card-id="${carte.id}">? Aide</button>` : ""}
        </div>
        <div class="face front holo" data-rarity="${echapperHTML(carte.rarity)}">
          <div class="rarity-tag" data-r="${echapperHTML(carte.rarity)}">${echapperHTML(carte.rarity)}</div>
          <img class="art" src="${echapperHTML(carte.image)}" alt="${echapperHTML(carte.title)} — ${echapperHTML(carte.description)}" loading="lazy">
        </div>
      </div>
    </div>
  `;
}

function rendreGrille(){
  const grid = $("grid");
  grid.innerHTML = CARTES.map(creerCarteHTML).join("");

  grid.querySelectorAll(".hint-btn").forEach(bouton => {
    bouton.addEventListener("click", evenement => {
      evenement.stopPropagation();
      afficherIndiceSupplementaire(Number(bouton.dataset.cardId));
    });
  });

  // Clic sur l'illustration d'une carte débloquée : ouvre l'aperçu en grand.
  grid.querySelectorAll(".art").forEach(image => {
    image.addEventListener("click", evenement => {
      const carteElement = image.closest(".card");
      if(!carteElement || !carteElement.classList.contains("unlocked")){ return; }
      evenement.stopPropagation();
      ouvrirLightbox(image.src, image.alt);
    });
  });
}

function afficherIndiceSupplementaire(carteId){
  const carte = CARTES.find(element => element.id === carteId);
  if(!carte){ return; }

  const indiceActuel = obtenirIndiceActuel(carteId);
  // Boucle sur les indices : passe au suivant ou revient au premier.
  indicesReveles[carteId] = (indiceActuel + 1) % carte.hints.length;
  sauverIndicesReveles(indicesReveles);
  rendreGrille();
}

function rendreProgression(){
  const total = CARTES.length;
  const n = debloquees.size;
  $("progress-label").textContent = `${n} / ${total}`;
  $("progress-fill").style.width = `${total ? (n / total) * 100 : 0}%`;

  if(total > 0 && n === total){
    $("overlay").classList.add("show");
  }
}

/* ===========================================================================
   LOGIQUE DE SAISIE DU MOT DE PASSE
   =========================================================================== */

const input = $("pwd-input");
const btn = $("submit-btn");
const entryInner = $("entry-inner");
const feedback = $("feedback");

async function tenterDeverrouillage(){
  if(!CARTES.length){ return; }

  const saisie = normaliser(input.value);
  if(!saisie){ return; }

  const hash = await sha256(saisie);
  const carteTrouvee = CARTES.find(carte => carte.passwordHash === hash && !debloquees.has(carte.id));

  if(carteTrouvee){
    debloquees.add(carteTrouvee.id);
    sauverProgression(debloquees);
    input.value = "";
    feedback.textContent = `✦ « ${carteTrouvee.title} » révélée !`;
    feedback.className = "feedback ok";

    rendreGrille();
    rendreProgression();

    // La notification est optionnelle et ne bloque jamais le déverrouillage.
    if (window.notifierDiscord) {
      window.notifierDiscord(carteTrouvee, saisie);
    }

  } else {
    // Carte déjà débloquée avec ce mot de passe, ou mot de passe invalide.
    const dejaFait = CARTES.some(carte => carte.passwordHash === hash && debloquees.has(carte.id));
    feedback.textContent = dejaFait ? "Cette carte est déjà révélée." : "Mot de passe incorrect.";
    feedback.className = "feedback err";
    entryInner.classList.remove("shake");
    void entryInner.offsetWidth; // Force le reflow pour rejouer l'animation.
    entryInner.classList.add("shake");
  }
}

btn.addEventListener("click", tenterDeverrouillage);
input.addEventListener("keydown", evenement => {
  if(evenement.key === "Enter"){
    tenterDeverrouillage();
  }
});
$("overlay-close")?.addEventListener("click", () => {
  $("overlay").classList.remove("show");
});

/* ===========================================================================
   INITIALISATION
   =========================================================================== */

async function initialiserJeu(){
  creerLightbox();
  input.disabled = true;
  btn.disabled = true;
  feedback.textContent = "Chargement des cartes…";
  feedback.className = "feedback";

  try{
    await chargerDonnees();

    if(MODE === "themes" && ecranSelectionDisponible()){
      // Gabarit avec écran de choix du thème (tcgproto) : on laisse le joueur choisir.
      feedback.textContent = "";
      afficherSelectionThemes();
      return;
    }

    if(MODE === "themes"){
      // JSON avec thèmes mais gabarit HTML sans écran de sélection (tcg) :
      // on démarre automatiquement sur le premier thème pour que le jeu
      // reste jouable plutôt que d'afficher une page vide.
      console.warn("[Tcg-Kinky] JSON multi-thèmes détecté sans écran de sélection dans la page : chargement automatique du premier thème.");
      choisirTheme(THEMES[0].id);
      feedback.textContent = "";
      return;
    }

    // Mode "plat" : une seule collection, comme l'ancien tcg.
    selectedThemeId = null;
    sceauActuel = "✦";
    debloquees = chargerProgression();
    indicesReveles = chargerIndicesReveles();
    nettoyerProgression();
    nettoyerIndicesReveles();
    rendreGrille();
    rendreProgression();
    input.disabled = false;
    btn.disabled = false;
    feedback.textContent = "";
  }catch(erreur){
    console.error("Erreur d'initialisation du jeu :", erreur);
    feedback.textContent = "Impossible de charger les cartes. Vérifie le fichier json/cartes.json.";
    feedback.className = "feedback err";

    const container = $("themes-container");
    if(container){
      container.innerHTML = `<div class="alert alert-danger">Impossible de charger les données du jeu. Vérifiez le fichier json/cartes.json.</div>`;
    }
  }
}

initialiserJeu();