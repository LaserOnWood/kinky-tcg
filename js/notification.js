/**
 * ============================================================================
 * NOTIFICATION DISCORD (Webhook)
 * ============================================================================
 * Envoie une notification lorsqu'une carte est déverrouillée.
 *
 * Important : laissez l'URL vide pour désactiver les notifications. Dans une
 * application statique publiée côté client, un webhook Discord est visible par
 * les visiteurs ; utilisez de préférence un relais serveur si le webhook doit
 * rester confidentiel.
 */

// Remplacez cette valeur uniquement si vous acceptez que le webhook soit exposé
// dans le code client. La virgule présente dans l'ancienne déclaration rendait
// le fichier JavaScript invalide.
const DISCORD_WEBHOOK_URL = "";

const RARITY_COLORS = Object.freeze({
  Commun: 0x7b8a94,
  Rare: 0x4fb3d9,
  Épique: 0xff2f7e,
  Légendaire: 0xd9a94f,
  Mythique: 0xe5e4e2
});

const DEFAULT_COLOR = 0xff2f7e;
const DISCORD_FIELD_LIMIT = 1024;
const DISCORD_TITLE_LIMIT = 256;

function limiterTexte(valeur, longueur = DISCORD_FIELD_LIMIT) {
  const texte = String(valeur ?? "").trim();
  if (!texte) return "—";
  return texte.length > longueur ? `${texte.slice(0, longueur - 1)}…` : texte;
}

function echapperMarkdown(valeur) {
  return String(valeur ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`");
}

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
 * Envoie un embed riche sur Discord.
 * @param {Object} carte - Carte venant d'être déverrouillée.
 * @param {string} motDePasseSaisi - Texte saisi par l'utilisateur.
 * @returns {Promise<boolean>} true si Discord a accepté la requête.
 */
async function notifierDiscord(carte, motDePasseSaisi) {
  if (!DISCORD_WEBHOOK_URL) return false;

  if (!carte || typeof carte !== "object") {
    console.warn("Notification Discord ignorée : carte invalide.");
    return false;
  }

  const titreCarte = limiterTexte(carte.title, DISCORD_TITLE_LIMIT);
  const rarete = limiterTexte(carte.rarity);
  const imageURL = obtenirURLImage(carte.image);
  const fields = [
    {
      name: "Carte",
      value: limiterTexte(`**${echapperMarkdown(titreCarte)}** (n°${carte.id})`),
      inline: true
    },
    {
      name: "Code utilisé",
      value: limiterTexte(`\`${echapperMarkdown(motDePasseSaisi)}\``),
      inline: true
    },
    {
      name: "Rareté",
      value: rarete,
      inline: true
    },
    {
      name: "Contenu / Gage",
      value: limiterTexte(carte.description)
    }
  ];

  if (typeof carte.actions === "string" && carte.actions.trim()) {
    fields.push({
      name: "Action à réaliser",
      value: limiterTexte(carte.actions)
    });
  }

  const embed = {
    title: limiterTexte(`Carte révélée — ${titreCarte}`, DISCORD_TITLE_LIMIT),
    description: "Votre partenaire vient de débloquer une nouvelle carte dans **Kinky TCG**.",
    color: RARITY_COLORS[carte.rarity] ?? DEFAULT_COLOR,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: "Kinky TCG System • Notification temps réel"
    }
  };

  if (imageURL) {
    embed.image = { url: imageURL };
  }

  try {
    const response = await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!response.ok) {
      console.error(`Erreur lors de l'envoi à Discord (${response.status}) : ${response.statusText}`);
      return false;
    }

    return true;
  } catch (erreur) {
    // Une panne Discord ne doit jamais empêcher le déblocage de la carte.
    console.error("Erreur réseau Discord :", erreur);
    return false;
  }
}

// API globale utilisée par passemot.js.
window.notifierDiscord = notifierDiscord;
