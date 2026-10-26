import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { adresseIp, limiteDepassee } from "../lib/limites.js";

/*
 * Notification Discord d'un déblocage de carte.
 *
 * Sécurité : cette URL est publique. Le serveur ne fait donc pas confiance au
 * navigateur : il recalcule le hash du mot de passe reçu et le compare à
 * les thèmes officiels (json/themes.json et json/themes/*.json).
 *  - Carte officielle (trouvée) : la notification est construite à partir des
 *    données de ce fichier (titre, rareté, gage, image), jamais de celles du client.
 *  - Carte absente des thèmes officiels (niveau importé par un joueur) : la notification
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

// L'image vient des thèmes officiels (chemin relatif ou URL) : on la rend absolue pour Discord.
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

async function lireJson(...segments) {
  return JSON.parse(await readFile(path.join(process.cwd(), ...segments), "utf8"));
}

// Lit les thèmes officiels une fois par instance (fichiers inclus dans la fonction via vercel.json) :
//  - format actuel : json/themes.json (index) + un fichier par thème (json/themes/<id>.json) ;
//  - ancien format, en repli : un seul fichier json/cartes.json (comme le fait le jeu lui-même).
async function chargerCartesOfficielles() {
  if (!cartesOfficielles) {
    let index = null;
    try {
      index = await lireJson("json", "themes.json");
    } catch (erreur) {
      if (erreur?.code !== "ENOENT") throw erreur;
    }

    let themes;
    if (index) {
      themes = await Promise.all(
        (index.themes || [])
          // Le thème Hasard n'a pas de cartes ; le nom du fichier doit rester dans json/themes/.
          .filter((meta) => meta.mode !== "hasard" && /^themes\/[\w.-]+\.json$/.test(String(meta.file)))
          .map(async (meta) => ({ ...meta, cards: (await lireJson("json", meta.file)).cards || [] }))
      );
    } else {
      const donnees = await lireJson("json", "cartes.json");
      themes = Array.isArray(donnees) ? [{ difficulty: "—", cards: donnees }] : (donnees.themes || []);
    }

    cartesOfficielles = themes.flatMap((theme) =>
      (theme.cards || []).map((carte) => ({ theme, carte }))
    );
  }
  return cartesOfficielles;
}

// Retrouve la carte débloquée par ce mot de passe (le nom du thème départage les doublons éventuels).
function trouverCarte(cartes, hash, id, nomTheme) {
  const candidates = cartes.filter(({ carte }) =>
    String(carte.passwordHash).toLowerCase() === hash && Number(carte.id) === Number(id)
  );
  return candidates.find(({ theme }) => theme.name === nomTheme) ?? candidates[0] ?? null;
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
    console.error(`[SECURITY] Aucune variable ${WEBHOOK_VARIABLE_PREFIX}N n'est configurée.`);
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

  // « difficulte » est la clé actuelle ; « niveau » reste lu pour les pages encore en cache.
  const difficultePayload = texteSimple(payload.difficulte ?? payload.niveau);
  const themePayload = texteSimple(payload.theme);

  let trouvee;
  try {
    const cartes = await chargerCartesOfficielles();
    trouvee = trouverCarte(cartes, hasherMotDePasse(motDePasseSaisi), demande.id, themePayload);
  } catch (erreur) {
    console.error("Lecture des thèmes officiels impossible :", erreur);
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
      difficulte: texteSimple(theme.difficulty),
      theme: texteSimple(theme.name),
      description: texteSimple(carte.description),
      actions: texteSimple(carte.actions), // champ facultatif dans les fichiers de thèmes
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
      cleDoublon: `import|${themePayload}|${texteSimple(demande.id)}|${motDePasseSaisi}`,
      id: Number.isFinite(Number(demande.id)) ? Number(demande.id) : "?",
      titre: texteSimple(demande.title),
      rarete: texteSimple(demande.rarity),
      difficulte: difficultePayload,
      theme: themePayload,
      description: texteSimple(demande.description),
      actions: texteSimple(demande.actions),
      image: texteSimple(demande.image)
    };
  }

  if (estDoublon(ip, note.cleDoublon)) {
    return sendJson(response, 202, { ok: true, sent: 0, duplicate: true });
  }

  const titreCarte = limiterTexte(note.titre, DISCORD_TITLE_LIMIT);

  // Dernier champ : l'action à réaliser (champ « actions » s'il existe, sinon le gage de la carte).
  const actionARealiser = note.actions.trim() || note.description;

  const fields = [
    {
      name: "Carte",
      value: limiterTexte(`**${echapperMarkdown(titreCarte)}** (n°${note.id})`),
      inline: true
    },
    {
      name: "Code Utilisé",
      value: limiterTexte("✅ Mot de passe validé"),
      inline: true
    },
    {
      name: "Rareté",
      value: limiterTexte(note.rarete),
      inline: true
    },
    {
      name: note.verifiee ? "Niveau / Thème" : "Niveau importé",
      value: limiterTexte(note.theme, 256),
      inline: true
    },
    {
      name: "Difficulté",
      value: limiterTexte(note.difficulte, 256),
      inline: true
    },
    {
      name: "Action à réaliser",
      value: limiterTexte(actionARealiser)
    }
  ];

  // Embed au format voulu : titre, description, image, champs (+ couleur selon la rareté).
  const embed = {
    title: note.verifiee ? "Nouvelle carte révélée" : "Nouvelle carte révélée (niveau importé)",
    description: note.verifiee
      ? "Votre partenaire vient de débloquer une nouvelle carte dans **Kinky TCG** 👍"
      : "Votre partenaire vient de débloquer une carte d'un **niveau importé** dans **Kinky TCG** 👍\n⚠️ Contenu envoyé par le navigateur : non vérifié."
  };

  const imageURL = obtenirURLImage(note.image, request);
  if (imageURL) embed.image = { url: imageURL };

  embed.fields = fields;

  // Carte officielle : couleur selon la rareté.
  // Niveau importé : données non vérifiées, donc embed gris et pied de page d'avertissement.
  if (note.verifiee) {
    embed.color = RARITY_COLORS[note.rarete] ?? DEFAULT_COLOR;
  } else {
    embed.color = IMPORT_COLOR;
    embed.footer = { text: "Kinky TCG System • Niveau importé (non vérifié)" };
  }

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
