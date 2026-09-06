/* ==========================================================================
   6. OUTIL — Générateur de hash SHA-256 (pour l'organisateur)
   --------------------------------------------------------------------------
   Pour générer le hash d'un nouveau mot de passe :
   1. Ouvrez la console du navigateur (F12) sur cette page.
   2. Tapez : await genererHash("mon-mot-de-passe")
   3. Copiez le résultat dans le champ "passwordHash" de la carte voulue.
   ========================================================================== */
async function genererHash(motDePasse){
  const h = await sha256(normaliser(motDePasse));
  console.log(`"${motDePasse}" → ${h}`);
  return h;
}
window.genererHash = genererHash; // rend la fonction accessible depuis la console