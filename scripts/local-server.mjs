#!/usr/bin/env node
import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 8000);
const host = process.env.HOST || "127.0.0.1";
const webhookFile = path.join(projectRoot, ".discord-webhook.txt");
const notificationFile = path.join(projectRoot, "api", "notification.js");
const cardsFile = path.join(projectRoot, "json", "cartes.json");   // ancien format (repli)
const themesFile = path.join(projectRoot, "json", "themes.json");
const themesDir = path.join(projectRoot, "json", "themes");
const maxBodySize = 256 * 1024;

// api/notification.js lit les thèmes (json/themes.json, json/themes/) depuis le dossier de travail : on se place à la racine du projet.
process.chdir(projectRoot);

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

// Charge le VRAI code de notification (api/notification.js, celui de Vercel). Il est rechargé
// automatiquement quand ce fichier ou les fichiers de thèmes (json/) changent : pas besoin de redémarrer
// le serveur après avoir modifié une carte ou le code de l'API.
let notificationCache = { cle: "", handler: null };

async function loadNotificationHandler() {
  const fichiers = [notificationFile, cardsFile, themesFile];
  try {
    for (const nom of await fs.readdir(themesDir)) fichiers.push(path.join(themesDir, nom));
  } catch {
    // dossier absent (ancien format) : rien à surveiller en plus
  }
  const dates = await Promise.all(fichiers.map((fichier) => fs.stat(fichier).then((s) => s.mtimeMs, () => 0)));
  const cle = dates.join("-");
  if (notificationCache.cle !== cle) {
    const module = await import(`${pathToFileURL(notificationFile).href}?v=${cle}`);
    notificationCache = { cle, handler: module.default };
  }
  return notificationCache.handler;
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

  // Seul le webhook du fichier local reçoit les notifications de test : on retire les éventuels
  // webhooks de production présents dans l'environnement de cette machine.
  for (const nom of Object.keys(process.env)) {
    if (nom.startsWith("DISCORD_NOTIFICATION_WEBHOOK_URL_")) delete process.env[nom];
  }
  process.env.DISCORD_NOTIFICATION_WEBHOOK_URL_1 = webhookUrl;

  // Adapte la réponse Node à l'interface attendue par les fonctions Vercel (response.status()),
  // et affiche dans la console ce que l'API a répondu (utile pour comprendre un 202 ou un 429).
  response.status = (code) => {
    response.statusCode = code;
    return response;
  };
  const end = response.end.bind(response);
  response.end = (body, ...args) => {
    console.log(`[local] /api/notification → HTTP ${response.statusCode} ${body ?? ""}`);
    return end(body, ...args);
  };

  try {
    const handler = await loadNotificationHandler();
    request.body = payload;
    await handler(request, response);
  } catch (error) {
    console.error("[local] Notification impossible :", error);
    if (!response.headersSent) json(response, 500, { error: "Erreur interne du serveur local." });
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
  console.log("Notifications : même code que la production (api/notification.js), rechargé automatiquement.");
  console.log("Vercel reste disponible avec : vercel dev");
});
