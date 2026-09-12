const RARITY_COLORS = Object.freeze({
  Coquine: 0xeab0c2,
  Provocante: 0xff4f8b,
  Audacieuse: 0xb46cff,
  Envoûtante: 0x8274e8,
  Sulfureuse: 0xe23e57,
  Mythique: 0xf6f0da
});

const DEFAULT_COLOR = 0xff2f7e;
const DISCORD_FIELD_LIMIT = 1024;
const DISCORD_TITLE_LIMIT = 256;
const MAX_PASSWORD_LENGTH = 200;

function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(body));
}

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
    const url = new URL(valeur);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Méthode non autorisée." });
  }

  const webhookUrl = process.env.DISCORD_NOTIFICATION_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("DISCORD_NOTIFICATION_WEBHOOK_URL n'est pas configurée.");
    return sendJson(response, 500, { error: "Les notifications ne sont pas configurées." });
  }

  let payload;
  try {
    payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  } catch {
    return sendJson(response, 400, { error: "Requête JSON invalide." });
  }

  const carte = payload?.carte;
  if (!carte || typeof carte !== "object") {
    return sendJson(response, 400, { error: "Carte invalide." });
  }

  const titreCarte = limiterTexte(carte.title, DISCORD_TITLE_LIMIT);
  const rarete = limiterTexte(carte.rarity);
  const motDePasseSaisi = typeof payload.motDePasseSaisi === "string"
    ? payload.motDePasseSaisi.trim().slice(0, MAX_PASSWORD_LENGTH)
    : "";
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
    footer: { text: "Kinky TCG System • Notification temps réel" }
  };

  const imageURL = obtenirURLImage(carte.image);
  if (imageURL) embed.image = { url: imageURL };

  try {
    const discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] })
    });

    if (!discordResponse.ok) {
      console.error(`Discord a répondu HTTP ${discordResponse.status}.`);
      return sendJson(response, 502, { error: "Discord a refusé la notification." });
    }

    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error("Envoi de la notification à Discord impossible :", error);
    return sendJson(response, 502, { error: "Discord est momentanément indisponible." });
  }
}
