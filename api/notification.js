import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

/*
 * Notification Discord d'un déblocage de carte.
 *
 * Sécurité : cette URL est publique. Le serveur ne fait donc pas confiance au
 * navigateur : il recalcule le hash du mot de passe reçu et le compare à
 * json/cartes.json.
 *  - Carte officielle (trouvée) : la notification est construite à partir des
 *    données de ce fichier (titre, rareté, gage, image), jamais de celles du client.
 *  - Carte absente de cartes.json (niveau importé par un joueur) : la notification
 *    est envoyée avec les données du navigateur, mais clairement marquée « non
 *    vérifiée » (couleur grise) et soumise à des limites plus strictes.
 */

const RARITY_COLORS = Object.freeze({
  Coquine: 0xeab0c2,
  Provocante: 0xff4f8b,
  Audacieuse: 0xb46cff,
  Envoûtante: 0x8274e8,
  Sulfureuse: 0xe23e57,
  Mythique: 0xf6f0da
});

const DEFAULT_COLOR = 0xff2f7e;
const IMPORT_COLOR = 0x9aa0a6; // gris : niveau importé, données non vérifiées
const DISCORD_FIELD_LIMIT = 1024;
const DISCORD_TITLE_LIMIT = 256;
const MAX_PASSWORD_LENGTH = 200;
const WEBHOOK_VARIABLE_PREFIX = "DISCORD_NOTIFICATION_WEBHOOK_URL_";
const DISCORD_TIMEOUT_MS = 8000;

// Limites (best effort : la mémoire d'une fonction serverless est propre à chaque instance).
const FENETRE_DEBIT_MS = 60_000;
const MAX_REQUETES_PAR_FENETRE = 20;
const DELAI_DOUBLON_MS = 30_000;
// Niveaux importés (non vérifiables) : limites plus strictes, par adresse et globales.
const MAX_IMPORTEES_PAR_FENETRE = 8;
const FENETRE_GLOBALE_MS = 600_000;
const MAX_IMPORTEES_GLOBAL = 40;
const requetesParIp = new Map();   // ip -> horodatages récents
const importeesParIp = new Map();
const importeesGlobal = new Map();
const dernieresNotifications = new Map(); // ip|carte -> horodatage

let cartesOfficielles = null;

function sendJson(response, status, body) {
  response.status(status).setHeader("Content-Type", "application/json").end(JSON.stringify(body));
}

function obtenirWebhooks() {
  return Object.entries(process.env)
    .map(([nom, valeur]) => {
      const correspondance = nom.match(/^DISCORD_NOTIFICATION_WEBHOOK_URL_(\d+)$/);
      return correspondance && valeur?.trim()
        ? { index: Number(correspondance[1]), url: valeur.trim() }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index)
    .map(({ url }) => url);
}

function limiterTexte(valeur, longueur = DISCORD_FIELD_LIMIT) {
  const texte = String(valeur ?? "").trim();
  if (!texte) return "—";
  return texte.length > longueur ? `${texte.slice(0, longueur - 1)}…` : texte;
}

// Données venant du navigateur : on ne garde que du texte (jamais d'objet).
function texteSimple(valeur) {
  return typeof valeur === "string" || typeof valeur === "number" ? String(valeur) : "";
}

function echapperMarkdown(valeur) {
  return String(valeur ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`");
}

// L'image vient de cartes.json (chemin relatif ou URL) : on la rend absolue pour Discord.
function obtenirURLImage(image, request) {
  const valeur = String(image ?? "").trim();
  if (!valeur) return null;

  const hote = request.headers["x-forwarded-host"] || request.headers.host;
  const protocole = request.headers["x-forwarded-proto"] || "https";

  try {
    const url = new URL(valeur, `${protocole}://${hote}/`);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

// Même normalisation que le jeu (passemot.js) : espaces, casse et accents ignorés.
function normaliserMotDePasse(texte) {
  return String(texte ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasherMotDePasse(texte) {
  return createHash("sha256").update(normaliserMotDePasse(texte)).digest("hex");
}

// Lit json/cartes.json une fois par instance (fichier inclus dans la fonction via vercel.json).
async function chargerCartesOfficielles() {
  if (!cartesOfficielles) {
    const brut = await readFile(path.join(process.cwd(), "json", "cartes.json"), "utf8");
    const donnees = JSON.parse(brut);
    const themes = Array.isArray(donnees) ? [{ difficulty: "—", cards: donnees }] : (donnees.themes || []);
    cartesOfficielles = themes.flatMap((theme) =>
      (theme.cards || []).map((carte) => ({ theme, carte }))
    );
  }
  return cartesOfficielles;
}

// Retrouve la carte débloquée par ce mot de passe (le niveau départage les doublons éventuels).
function trouverCarte(cartes, hash, id, niveau) {
  const candidates = cartes.filter(({ carte }) =>
    String(carte.passwordHash).toLowerCase() === hash && Number(carte.id) === Number(id)
  );
  return candidates.find(({ theme }) => theme.difficulty === niveau) ?? candidates[0] ?? null;
}

function adresseIp(request) {
  const direct = request.headers["x-real-ip"];
  const transmise = String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  return String(direct || transmise || "inconnue");
}

// Enregistre une requête et renvoie true si la clé dépasse « maximum » requêtes dans la fenêtre.
function limiteDepassee(table, cle, maximum, fenetreMs) {
  const maintenant = Date.now();
  const recentes = (table.get(cle) ?? []).filter((t) => maintenant - t < fenetreMs);
  recentes.push(maintenant);
  table.set(cle, recentes);

  if (table.size > 500) { // évite que la table grossisse indéfiniment
    for (const [autre, valeurs] of table) {
      if (!valeurs.some((t) => maintenant - t < fenetreMs)) table.delete(autre);
    }
  }
  return recentes.length > maximum;
}

// true si la même notification vient d'être envoyée par cette adresse.
function estDoublon(ip, cleCarte) {
  const maintenant = Date.now();
  const cle = `${ip}|${cleCarte}`;
  const dernier = dernieresNotifications.get(cle);
  if (dernier && maintenant - dernier < DELAI_DOUBLON_MS) return true;
  dernieresNotifications.set(cle, maintenant);

  if (dernieresNotifications.size > 500) {
    for (const [autre, instant] of dernieresNotifications) {
      if (maintenant - instant >= DELAI_DOUBLON_MS) dernieresNotifications.delete(autre);
    }
  }
  return false;
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return sendJson(response, 405, { error: "Méthode non autorisée." });
  }

  const webhookUrls = obtenirWebhooks();
  if (!webhookUrls.length) {
    console.error(`Aucune variable ${WEBHOOK_VARIABLE_PREFIX}N n'est configurée.`);
    return sendJson(response, 500, { error: "Les notifications ne sont pas configurées." });
  }

  let payload;
  try {
    payload = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  } catch {
    return sendJson(response, 400, { error: "Requête JSON invalide." });
  }

  const demande = payload?.carte;
  if (!demande || typeof demande !== "object") {
    return sendJson(response, 400, { error: "Carte invalide." });
  }

  const motDePasseSaisi = typeof payload.motDePasseSaisi === "string"
    ? payload.motDePasseSaisi.trim().slice(0, MAX_PASSWORD_LENGTH)
    : "";
  if (!motDePasseSaisi) {
    return sendJson(response, 400, { error: "Mot de passe manquant." });
  }

  const ip = adresseIp(request);
  if (limiteDepassee(requetesParIp, ip, MAX_REQUETES_PAR_FENETRE, FENETRE_DEBIT_MS)) {
    response.setHeader("Retry-After", "60");
    return sendJson(response, 429, { error: "Trop de requêtes, réessayez dans une minute." });
  }

  let trouvee;
  try {
    const cartes = await chargerCartesOfficielles();
    trouvee = trouverCarte(cartes, hasherMotDePasse(motDePasseSaisi), demande.id, payload.niveau);
  } catch (erreur) {
    console.error("Lecture de json/cartes.json impossible :", erreur);
    return sendJson(response, 500, { error: "Les données du jeu sont indisponibles." });
  }

  // Données de la notification : serveur (carte officielle) ou navigateur (niveau importé).
  let note;
  if (trouvee) {
    const { theme, carte } = trouvee;
    note = {
      verifiee: true,
      cleDoublon: `${theme.id}|${carte.id}`,
      id: carte.id,
      titre: texteSimple(carte.title),
      rarete: texteSimple(carte.rarity),
      niveau: texteSimple(theme.difficulty ?? theme.name),
      theme: texteSimple(theme.name),
      description: texteSimple(carte.description),
      actions: texteSimple(carte.actions), // champ facultatif dans cartes.json
      image: texteSimple(carte.image)
    };
  } else {
    // Niveau importé : impossible à vérifier, donc limites plus strictes et marquage « non vérifié ».
    if (
      limiteDepassee(importeesParIp, ip, MAX_IMPORTEES_PAR_FENETRE, FENETRE_DEBIT_MS) ||
      limiteDepassee(importeesGlobal, "global", MAX_IMPORTEES_GLOBAL, FENETRE_GLOBALE_MS)
    ) {
      response.setHeader("Retry-After", "60");
      return sendJson(response, 429, { error: "Trop de notifications de niveaux importés, réessayez plus tard." });
    }
    note = {
      verifiee: false,
      cleDoublon: `import|${texteSimple(payload.niveau)}|${texteSimple(demande.id)}|${motDePasseSaisi}`,
      id: Number.isFinite(Number(demande.id)) ? Number(demande.id) : "?",
      titre: texteSimple(demande.title),
      rarete: texteSimple(demande.rarity),
      niveau: texteSimple(payload.niveau),
      description: texteSimple(demande.description),
      actions: texteSimple(demande.actions),
      image: texteSimple(demande.image)
    };
  }

  if (estDoublon(ip, note.cleDoublon)) {
    return sendJson(response, 202, { ok: true, sent: 0, duplicate: true });
  }

  const titreCarte = limiterTexte(note.titre, DISCORD_TITLE_LIMIT);
  const fields = [
    {
      name: "Carte",
      value: limiterTexte(`**${echapperMarkdown(titreCarte)}** (n°${note.id})`),
      inline: true
    },
    {
      name: "Code utilisé",
      value: limiterTexte(`\`${echapperMarkdown(motDePasseSaisi)}\``),
      inline: true
    },
    {
      name: "Rareté",
      value: limiterTexte(note.rarete),
      inline: true
    },
    {
      name: note.verifiee ? "Niveau choisi" : "Niveau importé",
      value: limiterTexte(note.niveau, 256),
      inline: true
    },
    {
      name: "Thème",
      value: limiterTexte(note.theme, 256),
      inline: true
    },
    {
      name: "Contenu / Gage",
      value: limiterTexte(note.description)
    }
  ];

  if (note.actions.trim()) {
    fields.push({
      name: "Action à réaliser",
      value: limiterTexte(note.actions)
    });
  }

  const embed = {
    title: limiterTexte(
      `${note.verifiee ? "Carte révélée" : "Carte révélée (niveau importé)"} — ${titreCarte}`,
      DISCORD_TITLE_LIMIT
    ),
    description: note.verifiee
      ? "Votre partenaire vient de débloquer une nouvelle carte dans **Kinky TCG**."
      : "Votre partenaire vient de débloquer une carte d'un **niveau importé** dans **Kinky TCG**.\n⚠️ Contenu envoyé par le navigateur : non vérifié.",
    color: note.verifiee ? (RARITY_COLORS[note.rarete] ?? DEFAULT_COLOR) : IMPORT_COLOR,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: note.verifiee
        ? "Kinky TCG System • Notification temps réel"
        : "Kinky TCG System • Niveau importé (non vérifié)"
    }
  };

  const imageURL = obtenirURLImage(note.image, request);
  if (imageURL) embed.image = { url: imageURL };

  const resultats = await Promise.allSettled(
    webhookUrls.map(async (webhookUrl) => {
      const discordResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
        signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS)
      });

      if (!discordResponse.ok) {
        throw new Error(`Discord a répondu HTTP ${discordResponse.status}.`);
      }
    })
  );

  const nombreEnvoye = resultats.filter(({ status }) => status === "fulfilled").length;
  resultats
    .filter(({ status }) => status === "rejected")
    .forEach(({ reason }) => console.error("Envoi d'une notification Discord impossible :", reason));

  if (!nombreEnvoye) {
    return sendJson(response, 502, { error: "Discord a refusé toutes les notifications." });
  }

  return sendJson(response, 200, {
    ok: true,
    sent: nombreEnvoye,
    total: webhookUrls.length
  });
}
