/**
 * ============================================================================
 * NOTIFICATION DISCORD
 * ============================================================================
 * L'envoi est réalisé par /api/notification afin que le webhook Discord reste
 * confidentiel dans la variable Vercel DISCORD_NOTIFICATION_WEBHOOK_URL.
 */

function obtenirURLImage(image) {
  const valeur = String(image ?? "").trim();
  if (!valeur) return null;

  try {
    return new URL(valeur, window.location.href).href;
  } catch (erreur) {
    console.warn("URL d'image ignorée pour la notification Discord :", erreur);
    return null;
  }
}

/**
 * Demande au relais serveur d'envoyer un embed Discord.
 * @param {Object} carte - Carte venant d'être déverrouillée.
 * @param {string} motDePasseSaisi - Texte saisi par l'utilisateur.
 * @param {string} niveauChoisi - Niveau sélectionné dans le jeu.
 * @returns {Promise<boolean>} true si le relais a accepté la requête.
 */
async function notifierDiscord(carte, motDePasseSaisi, niveauChoisi) {
  if (!carte || typeof carte !== "object") {
    console.warn("Notification Discord ignorée : carte invalide.");
    return false;
  }

  try {
    const response = await fetch("/api/notification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carte: {
          id: carte.id,
          title: carte.title,
          rarity: carte.rarity,
          description: carte.description,
          actions: carte.actions,
          image: obtenirURLImage(carte.image),
          niveau: niveauChoisi
        },
        motDePasseSaisi
      })
    });

    if (!response.ok) {
      console.error(`Erreur lors de l'envoi de la notification (${response.status}).`);
      return false;
    }

    return true;
  } catch (erreur) {
    // Une panne Discord ne doit jamais empêcher le déblocage de la carte.
    console.error("Erreur réseau lors de la notification Discord :", erreur);
    return false;
  }
}

// API globale utilisée par passemot.js.
window.notifierDiscord = notifierDiscord;
