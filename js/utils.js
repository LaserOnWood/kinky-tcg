/* ==========================================================================
   OUTILS PARTAGÉS — à charger AVANT les autres scripts (voir les balises <script>)

   Fonctions globales utilisées par passemot.js, hasard.js, hasheur.js,
   level-builder.js et gallery.js :
     - echapperHTML(valeur)         texte sûr à insérer dans du HTML
     - normaliserMotDePasse(texte)  espaces, casse et accents ignorés
     - sha256(message)              hash SHA-256 hexadécimal (HTTPS ou localhost requis)
     - hasherMotDePasse(texte)      hash du mot de passe normalisé (celui de cartes.json)

   Un seul exemplaire de chacune : ne pas les recopier dans les autres fichiers.
   ========================================================================== */
/* exported echapperHTML, normaliserMotDePasse, sha256, hasherMotDePasse */

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
