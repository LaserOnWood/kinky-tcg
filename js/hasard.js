/* ===========================================================================
   MODE HASARD — tirage, rendu et interactions des cartes par catégorie
   ---------------------------------------------------------------------------
   Ce module est volontairement isolé du moteur classique. passemot.js ne garde
   que l'orchestration du thème et appelle l'API exposée sur window.HasardMode.
   =========================================================================== */

window.HasardMode = (() => {
  const URL_CATALOGUE = "assets/cartes/index.json";
  const ORDRE_CATEGORIES = ["Tenue", "Lieu", "Rituel", "Accessoires", "Positions", "Actions"];

  let actif = false;
  let categories = [];
  let tirages = new Map();
  let catalogueEnMemoire = null; // inventaire déjà téléchargé : évite de le recharger à chaque sélection

  async function chargerCatalogue(){
    if(catalogueEnMemoire){ return catalogueEnMemoire; }

    const reponse = await fetch(URL_CATALOGUE, { cache: "no-store" });
    if(!reponse.ok){
      throw new Error(`Impossible de charger ${URL_CATALOGUE} (${reponse.status}).`);
    }

    const donnees = await reponse.json();
    if(!Array.isArray(donnees)){
      throw new Error("L'inventaire des images doit être une liste.");
    }

    const catalogue = donnees
      .filter(image => {
        if(!image || typeof image !== "object"){ return false; }
        const category = String(image.category ?? "").trim();
        const path = String(image.path ?? "").trim();
        return Boolean(
          category && !category.includes("/") && !category.includes("\\") &&
          path.startsWith(`assets/cartes/${category}/`) &&
          !path.split("/").includes("..") &&
          /\.(webp|png|jpe?g|gif)$/i.test(path)
        );
      })
      .map(image => ({
        category: String(image.category).trim(),
        name: (typeof image.name === "string" && image.name.trim())
          ? image.name.trim()
          : String(image.path).split("/").pop(),
        path: String(image.path).trim()
      }));

    catalogueEnMemoire = catalogue; // mémorisé seulement si le chargement a réussi
    return catalogue;
  }

  function regrouperImages(images){
    const groupes = new Map();
    images.forEach(image => {
      if(!groupes.has(image.category)){ groupes.set(image.category, []); }
      groupes.get(image.category).push(image);
    });

    return [...groupes.entries()]
      .sort(([a], [b]) => {
        const indexA = ORDRE_CATEGORIES.indexOf(a);
        const indexB = ORDRE_CATEGORIES.indexOf(b);
        if(indexA < 0 && indexB < 0){ return a.localeCompare(b, "fr"); }
        if(indexA < 0){ return 1; }
        if(indexB < 0){ return -1; }
        return indexA - indexB;
      })
      .map(([name, cards]) => ({ name, cards }));
  }

  function nomCategorie(categorie){
    const libelles = {
      Actions: "Action",
      Accessoires: "Accessoire",
      Positions: "Position",
      Lieu: "Lieu",
      Rituel: "Rituel",
      Tenue: "Tenue"
    };
    return libelles[categorie] || categorie;
  }

  function tirerCarte(cartes, cheminActuel = ""){
    const autresCartes = cartes.filter(carte => carte.path !== cheminActuel);
    const choix = autresCartes.length ? autresCartes : cartes;
    return choix[Math.floor(Math.random() * choix.length)];
  }

  // Prépare un tirage sans modifier l'état courant : le moteur peut ainsi
  // ignorer proprement une sélection devenue obsolète pendant le chargement.
  async function preparer(){
    const inventaire = await chargerCatalogue();
    const nouvellesCategories = regrouperImages(inventaire).filter(groupe => groupe.cards.length > 0);
    if(!nouvellesCategories.length){
      throw new Error("Aucune image n'a été trouvée dans les dossiers de catégories.");
    }

    const nouveauxTirages = new Map(
      nouvellesCategories.map(groupe => [groupe.name, tirerCarte(groupe.cards)])
    );
    return { categories: nouvellesCategories, tirages: nouveauxTirages };
  }

  function activer(preparation){
    if(!preparation || !Array.isArray(preparation.categories) || !(preparation.tirages instanceof Map)){
      throw new Error("La préparation du niveau Hasard est invalide.");
    }
    actif = true;
    categories = preparation.categories;
    tirages = new Map(preparation.tirages);
  }

  function desactiver(){
    actif = false;
    categories = [];
    tirages = new Map();
  }

  function estActif(){
    return actif;
  }

  function texteAlternatif(groupe, tirage){
    return `${nomCategorie(groupe.name)} : ${tirage.name}`;
  }

  function creerCarteHTML(groupe){
    const tirage = tirages.get(groupe.name) || tirerCarte(groupe.cards);
    const libelle = nomCategorie(groupe.name);

    return `
      <div class="card-slot hasard-slot" role="group" aria-label="Carte ${echapperHTML(libelle)}">
        <div class="card unlocked hasard-card">
          <div class="face front">
            <img class="art hasard-art" src="${echapperHTML(tirage.path)}" alt="${echapperHTML(texteAlternatif(groupe, tirage))}" loading="lazy">
          </div>
        </div>
        <button class="hasard-shuffle" type="button" data-hasard-category="${echapperHTML(groupe.name)}" aria-label="Tirer une autre carte dans la catégorie ${echapperHTML(libelle)}">
          <i class="fa-solid fa-shuffle" aria-hidden="true"></i>
          <span>· ${echapperHTML(libelle)}</span>
        </button>
      </div>
    `;
  }

  function rendreGrille(grille){
    grille.innerHTML = categories.map(creerCarteHTML).join("");
  }

  // Renvoie true si le clic appartient au mode Hasard et a été traité.
  function gererClicGrille(evenement, { grille, rendre, ouvrirLightbox } = {}){
    if(!actif){ return false; }

    const boutonMelanger = evenement.target.closest("[data-hasard-category]");
    if(boutonMelanger){
      evenement.stopPropagation();
      const nom = boutonMelanger.dataset.hasardCategory;
      const groupe = categories.find(categorie => categorie.name === nom);
      if(!groupe){ return true; }

      const tirageActuel = tirages.get(nom);
      const nouveauTirage = tirerCarte(groupe.cards, tirageActuel?.path);
      tirages.set(nom, nouveauTirage);

      // On remplace seulement l'image de cette carte : pas de reconstruction de la
      // grille, donc pas de scintillement et le carrousel reste à sa place.
      const image = boutonMelanger.closest(".hasard-slot")?.querySelector(".hasard-art");
      if(image){
        image.src = nouveauTirage.path;
        image.alt = texteAlternatif(groupe, nouveauTirage);
        return true;
      }

      // Sécurité : si l'image est introuvable, on reconstruit en conservant la position.
      const positionCarrousel = grille?.scrollLeft ?? 0;
      rendre?.();
      if(grille){ grille.scrollLeft = positionCarrousel; }
      return true;
    }

    const image = evenement.target.closest(".hasard-art");
    if(!image){ return false; }
    evenement.stopPropagation();
    ouvrirLightbox?.(image.src, image.alt);
    return true;
  }

  return Object.freeze({
    preparer,
    activer,
    desactiver,
    estActif,
    rendreGrille,
    gererClicGrille
  });
})();
