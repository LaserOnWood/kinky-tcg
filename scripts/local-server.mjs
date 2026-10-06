#!/usr/bin/env node
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "127.0.0.1";
const webhookFile = path.join(projectRoot, ".discord-webhook.txt");
const maxBodySize = 256 * 1024;

function json(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function text(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, { "Content-Type": contentType });
  response.end(body);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > maxBodySize) {
        reject(Object.assign(new Error("Requête trop volumineuse."), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function readWebhookUrl() {
  let content;
  try {
    content = await fs.readFile(webhookFile, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Fichier absent : ${path.basename(webhookFile)}`);
    }
    throw error;
  }

  const url = content
    .split(/\r?\n/)
    .map(line => line.trim())
    .find(line => line && !line.startsWith("#"));

  if (!url) throw new Error(`Aucun webhook trouvé dans ${path.basename(webhookFile)}.`);

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Le webhook du fichier n'est pas une URL valide.");
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== "discord.com") {
    throw new Error("Le webhook doit être une URL HTTPS de discord.com.");
  }
  return parsed.href;
}

function limitText(value, length = 1024) {
  const textValue = String(value ?? "").trim();
  if (!textValue) return "—";
  return textValue.length > length ? `${textValue.slice(0, length - 1)}…` : textValue;
}

function escapeMarkdown(value) {
  return String(value ?? "").replace(/\\/g, "\\\\").replace(/`/g, "\\`");
}

const rarityColors = Object.freeze({
  Coquine: 0xeab0c2,
  Provocante: 0xff4f8b,
  Audacieuse: 0xb46cff,
  Envoûtante: 0x8274e8,
  Sulfureuse: 0xe23e57,
  Mythique: 0xf6f0da
});

function buildEmbed(payload) {
  const card = payload?.carte;
  if (!card || typeof card !== "object") throw new Error("Carte invalide.");

  const title = limitText(card.title, 256);
  const password = typeof payload.motDePasseSaisi === "string"
    ? payload.motDePasseSaisi.trim().slice(0, 200)
    : "";
  const embed = {
    title: limitText(`Carte révélée — ${title}`, 256),
    description: "Votre partenaire vient de débloquer une nouvelle carte dans **Kinky TCG**.",
    color: rarityColors[card.rarity] ?? 0xff2f7e,
    fields: [
      { name: "Carte", value: limitText(`**${escapeMarkdown(title)}** (n°${card.id})`), inline: true },
      { name: "Code utilisé", value: limitText(`\`${escapeMarkdown(password)}\``), inline: true },
      { name: "Rareté", value: limitText(card.rarity), inline: true },
      { name: "Niveau choisi", value: limitText(payload.niveau, 256), inline: true },
      { name: "Contenu / Gage", value: limitText(card.description) }
    ],
    timestamp: new Date().toISOString(),
    footer: { text: "Kinky TCG System • Notification temps réel" }
  };

  if (typeof card.actions === "string" && card.actions.trim()) {
    embed.fields.push({ name: "Action à réaliser", value: limitText(card.actions) });
  }
  if (typeof card.image === "string" && /^https:\/\/discord\.com\//.test(card.image)) {
    embed.image = { url: card.image };
  }
  return embed;
}

async function sendNotification(request, response) {
  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch (error) {
    return json(response, error.statusCode || 400, { error: error.statusCode ? error.message : "Requête JSON invalide." });
  }

  let webhookUrl;
  try {
    webhookUrl = await readWebhookUrl();
  } catch (error) {
    console.error(`[local] ${error.message}`);
    return json(response, 500, { error: `${error.message}. Créez ce fichier pour activer les notifications locales.` });
  }

  let embed;
  try {
    embed = buildEmbed(payload);
  } catch (error) {
    return json(response, 400, { error: error.message });
  }

  try {
    const discordResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } })
    });
    if (!discordResponse.ok) {
      console.error(`[local] Discord a répondu HTTP ${discordResponse.status}.`);
      return json(response, 502, { error: `Discord a répondu HTTP ${discordResponse.status}.` });
    }
    return json(response, 200, { ok: true, sent: 1, total: 1 });
  } catch (error) {
    console.error("[local] Envoi Discord impossible :", error);
    return json(response, 502, { error: "Discord est momentanément indisponible." });
  }
}

function contentType(filePath) {
  return {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".mp3": "audio/mpeg"
  }[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

async function serveStatic(request, response) {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${host}:${port}`).pathname);
  const relative = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(projectRoot, relative);
  if (filePath !== projectRoot && !filePath.startsWith(`${projectRoot}${path.sep}`)) {
    return text(response, 403, "Accès refusé");
  }
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) return text(response, 404, "Fichier introuvable");
    response.writeHead(200, { "Content-Type": contentType(filePath) });
    if (request.method === "HEAD") return response.end();
    response.end(await fs.readFile(filePath));
  } catch {
    text(response, 404, "Fichier introuvable");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`);
  if (url.pathname === "/api/notification") {
    if (request.method !== "POST") {
      response.setHeader("Allow", "POST");
      return json(response, 405, { error: "Méthode non autorisée." });
    }
    return sendNotification(request, response);
  }
  if (request.method !== "GET" && request.method !== "HEAD") return text(response, 405, "Méthode non autorisée");
  return serveStatic(request, response);
});

server.listen(port, host, () => {
  console.log(`Kinky TCG local : http://${host}:${port}`);
  console.log(`Webhook local : ${path.basename(webhookFile)} (non versionné)`);
  console.log("Vercel reste disponible avec : vercel dev");
});
