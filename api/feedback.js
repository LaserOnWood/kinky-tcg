const MAX_MESSAGE_LENGTH = 1500;
const MAX_LEVEL_FILE_BYTES = 512 * 1024;
const MAX_CARDS = 80;
const LEVEL_FEEDBACK_TYPE = "Proposition de niveau";
const ALLOWED_TYPES = new Set([
  "Suggestion",
  "Problème",
  "Avis général",
  "Autre",
  LEVEL_FEEDBACK_TYPE
]);
const ALLOWED_CARD_TYPES = new Set([
  "Accessoire", "Action", "Evenement", "Lieu", "Position", "Rituel", "Tenue"
]);
const ALLOWED_RARITIES = new Set([
  "Coquine", "Provocante", "Audacieuse", "Envoûtante", "Sulfureuse", "Mythique"
]);

function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8").end(JSON.stringify(body));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateLevelData(data) {
  if (!isPlainObject(data) || !Array.isArray(data.themes) || data.themes.length !== 1) {
    throw new Error("L’export doit contenir un seul niveau dans themes[].");
  }

  const theme = data.themes[0];
  if (!isPlainObject(theme) || typeof theme.name !== "string" || !theme.name.trim() || theme.name.length > 120) {
    throw new Error("Le nom du niveau est absent ou trop long.");
  }
  if (!Array.isArray(theme.cards) || theme.cards.length < 1 || theme.cards.length > MAX_CARDS) {
    throw new Error(`Le niveau doit contenir entre 1 et ${MAX_CARDS} cartes.`);
  }

  for (const [index, card] of theme.cards.entries()) {
    const label = `La carte ${index + 1}`;
    if (!isPlainObject(card)) throw new Error(`${label} est invalide.`);
    if (!(typeof card.id === "number" && Number.isFinite(card.id))
      && !(typeof card.id === "string" && card.id.trim() && card.id.length <= 128)) {
      throw new Error(`${label} n’a pas d’identifiant valide.`);
    }
    if (typeof card.title !== "string" || !card.title.trim() || card.title.length > 256) {
      throw new Error(`${label} doit avoir un titre (256 caractères maximum).`);
    }
    if (typeof card.type !== "string" || !ALLOWED_CARD_TYPES.has(card.type)) {
      throw new Error(`${label} contient un type de carte inconnu.`);
    }
    if (typeof card.passwordHash !== "string" || !/^[a-f\d]{64}$/i.test(card.passwordHash)) {
      throw new Error(`${label} doit avoir un mot de passe exporté sous forme de hash SHA-256.`);
    }
    if (!Array.isArray(card.hints) || card.hints.length < 1 || card.hints.length > 20
      || card.hints.some(hint => typeof hint !== "string" || !hint.trim() || hint.length > 1000)) {
      throw new Error(`${label} doit contenir entre 1 et 20 indices valides.`);
    }
    if (typeof card.image !== "string" || !card.image.trim() || card.image.length > 2048) {
      throw new Error(`${label} doit contenir une image (URL ou chemin, 2 048 caractères maximum).`);
    }
    if (typeof card.description !== "string" || card.description.length > 3000
      || typeof card.actions !== "string" || card.actions.length > 3000) {
      throw new Error(`${label} contient une description ou une action trop longue.`);
    }
    if (typeof card.rarity !== "string" || !ALLOWED_RARITIES.has(card.rarity)) {
      throw new Error(`${label} contient une rareté inconnue.`);
    }
  }
}

function decodeLevelFile(file) {
  if (!isPlainObject(file)
    || typeof file.name !== "string"
    || typeof file.contentBase64 !== "string") {
    throw new Error("La pièce jointe doit être un fichier JSON de niveau.");
  }

  const name = file.name.replace(/\\/g, "/").split("/").pop();
  if (!name || !name.toLowerCase().endsWith(".json")) {
    throw new Error("La pièce jointe doit porter l’extension .json.");
  }
  if (file.contentBase64.length > Math.ceil(MAX_LEVEL_FILE_BYTES / 3) * 4 + 4
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(file.contentBase64)) {
    throw new Error("Le fichier JSON dépasse la limite de 512 Ko ou son encodage est invalide.");
  }

  const bytes = Buffer.from(file.contentBase64, "base64");
  if (bytes.length === 0 || bytes.length > MAX_LEVEL_FILE_BYTES || bytes.toString("base64") !== file.contentBase64) {
    throw new Error("Le fichier JSON est vide, trop volumineux ou mal encodé.");
  }

  let data;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    data = JSON.parse(text);
  } catch {
    throw new Error("Le fichier joint ne contient pas un JSON UTF-8 valide.");
  }
  validateLevelData(data);

  // Le nom n’est jamais utilisé comme chemin ; les caractères de contrôle sont retirés.
  const safeName = name
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "_")
    .slice(0, 120);

  return { name: safeName, bytes };
}

async function sendToDiscord(webhookUrl, { type, message, levelFile }) {
  const fields = [{ name: "Type", value: type, inline: true }];
  if (levelFile) fields.push({ name: "Fichier joint", value: levelFile.name, inline: true });

  const payload = {
    username: "Kinky TCG — Feedback",
    allowed_mentions: { parse: [] },
    embeds: [{
      title: levelFile ? "Nouvelle proposition de niveau" : "Nouveau feedback anonyme",
      description: message,
      color: 0xff2f7e,
      fields,
      timestamp: new Date().toISOString(),
      footer: { text: "Prototype feedback • aucun compte requis" }
    }]
  };

  if (!levelFile) {
    return fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  const form = new FormData();
  form.set("payload_json", JSON.stringify(payload));
  form.set("files[0]", new Blob([levelFile.bytes], { type: "application/json" }), levelFile.name);
  // Ne pas fixer Content-Type : fetch ajoute la frontière multipart correcte.
  return fetch(webhookUrl, { method: "POST", body: form });
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Méthode non autorisée." });
  }

  const webhookUrl = process.env.FEEDBACK_DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("FEEDBACK_DISCORD_WEBHOOK_URL n'est pas configurée.");
    return sendJson(response, 500, { error: "Le feedback n'est pas configuré." });
  }

  let payload;
  try {
    payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  } catch {
    return sendJson(response, 400, { error: "Requête JSON invalide." });
  }
  if (!isPlainObject(payload)) {
    return sendJson(response, 400, { error: "Requête JSON invalide." });
  }

  const type = typeof payload.type === "string" && ALLOWED_TYPES.has(payload.type)
    ? payload.type
    : null;
  if (!type) return sendJson(response, 400, { error: "Type de feedback inconnu." });

  const message = typeof payload.message === "string"
    ? payload.message.trim().slice(0, MAX_MESSAGE_LENGTH)
    : "";
  if (!message) return sendJson(response, 400, { error: "Le message est obligatoire." });

  let levelFile = null;
  try {
    if (type === LEVEL_FEEDBACK_TYPE) {
      levelFile = decodeLevelFile(payload.levelFile);
    } else if (payload.levelFile !== undefined && payload.levelFile !== null) {
      return sendJson(response, 400, { error: "La pièce jointe est réservée aux propositions de niveau." });
    }
  } catch (error) {
    return sendJson(response, 400, { error: error.message });
  }

  try {
    const discordResponse = await sendToDiscord(webhookUrl, { type, message, levelFile });
    if (!discordResponse.ok) {
      console.error(`Discord a répondu HTTP ${discordResponse.status}.`);
      return sendJson(response, 502, { error: "Discord a refusé le feedback." });
    }
    return sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error("Envoi du feedback à Discord impossible :", error);
    return sendJson(response, 502, { error: "Discord est momentanément indisponible." });
  }
}
