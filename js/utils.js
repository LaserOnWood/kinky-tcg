/* ==========================================================================
   OUTILS PARTAGÉS — à charger AVANT les autres scripts (voir les balises <script>)

   Fonctions globales utilisées par passemot.js, hasard.js, hasheur.js,
   level-builder.js et gallery.js :
     - echapperHTML(valeur)         texte sûr à insérer dans du HTML
     - normaliserMotDePasse(texte)  espaces, casse et accents ignorés
     - sha256(message)              hash SHA-256 hexadécimal (HTTPS ou localhost requis)
     - hasherMotDePasse(texte)      hash du mot de passe normalisé (celui de cartes.json)

     - creerModale(element, options) comportement commun des fenêtres modales
                                    (voir la section FENÊTRES MODALES en bas)

   Un seul exemplaire de chacune : ne pas les recopier dans les autres fichiers.
   ========================================================================== */
/* exported echapperHTML, normaliserMotDePasse, sha256, hasherMotDePasse, creerModale */

// Remplace les caractères spéciaux pour pouvoir insérer un texte dans du HTML sans risque.
function echapperHTML(valeur){
  return String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[caractere]);
}

// Normalise un mot de passe : espaces, casse et accents sont ignorés.
function normaliserMotDePasse(texte){
  return String(texte ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Calcule le hash SHA-256 (hexadécimal) d'une chaîne, via l'API native du navigateur.
async function sha256(message){
  // crypto.subtle n'existe qu'en HTTPS (ou sur localhost) : on le signale clairement.
  if(!globalThis.crypto?.subtle){
    throw new Error("CRYPTO_INDISPONIBLE");
  }
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Hash d'un mot de passe tel qu'il est stocké dans cartes.json (passwordHash).
function hasherMotDePasse(texte){
  return sha256(normaliserMotDePasse(texte));
}

/* ===========================================================================
   FENÊTRES MODALES
   Comportement commun à toutes les fenêtres (aide, feedback, aperçu d'image, fin de
   niveau, galerie). L'apparence reste gérée par le CSS de chaque fenêtre ; ce code
   ajoute ce qui rend la fenêtre utilisable au clavier et avec un lecteur d'écran :
     - le reste de la page devient inactif (attribut « inert ») tant qu'elle est ouverte,
     - Tab reste dans la fenêtre (Maj+Tab aussi), Échap la ferme,
     - le défilement de la page est bloqué (classe info-modal-open sur <body>),
     - le focus est placé dans la fenêtre à l'ouverture et rendu au bouton à la fermeture.

   Exemple :
     const fenetre = creerModale(element, { focusInitial: boutonFermer });
     fenetre.ouvrir(boutonQuiOuvre);   // ouvre (hidden = false par défaut)
     fenetre.fermer();                 // ferme (hidden = true par défaut)

   Options :
     afficher(), masquer()   comment montrer / cacher la fenêtre (par défaut : attribut hidden)
     focusInitial            élément (ou fonction qui le renvoie) à focaliser à l'ouverture
     apresFermeture()        appelé après la fermeture (par exemple pour vider une image)
   ouvrir(declencheur) : élément qui récupère le focus à la fermeture (par défaut l'élément
   actif ; passer null pour ne rien focaliser).
   fermer({ restaurerFocus: false }) ferme sans rendre le focus.
   =========================================================================== */

const SELECTEUR_FOCALISABLES = "a[href], button, input, select, textarea, [tabindex]";
const modalesOuvertes = []; // la dernière est la fenêtre au premier plan
let ecouteurModalesInstalle = false;

function elementsFocalisables(conteneur){
  return [...conteneur.querySelectorAll(SELECTEUR_FOCALISABLES)].filter(element =>
    !element.disabled && element.tabIndex >= 0 && element.type !== "hidden" && !element.closest("[hidden]")
  );
}

// Rend inactif (inert) tout ce qui entoure la fenêtre, à chaque niveau de l'arborescence.
// Renvoie la liste des éléments modifiés, pour pouvoir les rétablir.
function rendreArrierePlanInactif(fenetre){
  const modifies = [];
  for(let noeud = fenetre; noeud && noeud !== document.body; noeud = noeud.parentElement){
    for(const frere of noeud.parentElement.children){
      if(frere === noeud || frere.hasAttribute("inert")){ continue; }
      if(["SCRIPT", "STYLE", "LINK", "TEMPLATE"].includes(frere.tagName)){ continue; }
      frere.setAttribute("inert", "");
      modifies.push(frere);
    }
  }
  return modifies;
}

function installerEcouteurModales(){
  if(ecouteurModalesInstalle){ return; }
  ecouteurModalesInstalle = true;

  document.addEventListener("keydown", evenement => {
    const modale = modalesOuvertes[modalesOuvertes.length - 1];
    if(!modale){ return; }

    if(evenement.key === "Escape"){
      evenement.preventDefault();
      modale.fermer();
      return;
    }

    if(evenement.key !== "Tab"){ return; }

    const focalisables = elementsFocalisables(modale.element);
    if(!focalisables.length){
      evenement.preventDefault();
      return;
    }
    const premier = focalisables[0];
    const dernier = focalisables[focalisables.length - 1];
    const actif = document.activeElement;

    if(!modale.element.contains(actif)){
      evenement.preventDefault();
      premier.focus();
    }else if(evenement.shiftKey && actif === premier){
      evenement.preventDefault();
      dernier.focus();
    }else if(!evenement.shiftKey && actif === dernier){
      evenement.preventDefault();
      premier.focus();
    }
  });
}

function creerModale(element, options = {}){
  const {
    afficher = () => { element.hidden = false; },
    masquer = () => { element.hidden = true; },
    focusInitial = null,
    apresFermeture = null
  } = options;

  let ouverte = false;
  let declencheur = null;
  let elementsInactifs = [];

  const modale = {
    element,
    estOuverte: () => ouverte,

    ouvrir(declencheurOuverture = document.activeElement){
      if(ouverte){ return; }

      afficher();
      // Fenêtre située dans une zone masquée (ex. écran de jeu quitté entre-temps) : on annule,
      // sinon le reste de la page deviendrait inactif sans qu'aucune fenêtre ne soit visible.
      if(typeof element.checkVisibility === "function" && !element.checkVisibility()){
        masquer();
        return;
      }

      ouverte = true;
      declencheur = declencheurOuverture;
      document.body.classList.add("info-modal-open");
      elementsInactifs = rendreArrierePlanInactif(element);
      modalesOuvertes.push(modale);
      installerEcouteurModales();

      const cible = (typeof focusInitial === "function" ? focusInitial() : focusInitial)
        || elementsFocalisables(element)[0]
        || element;
      if(cible === element && !element.hasAttribute("tabindex")){
        element.setAttribute("tabindex", "-1");
      }
      cible.focus();
    },

    fermer({ restaurerFocus = true } = {}){
      if(!ouverte){ return; }
      ouverte = false;

      masquer();
      modalesOuvertes.splice(modalesOuvertes.indexOf(modale), 1);
      elementsInactifs.forEach(frere => frere.removeAttribute("inert"));
      elementsInactifs = [];
      if(!modalesOuvertes.length){
        document.body.classList.remove("info-modal-open");
      }
      apresFermeture?.();

      if(restaurerFocus && declencheur?.isConnected){
        declencheur.focus();
      }
      declencheur = null;
    }
  };

  return modale;
}
