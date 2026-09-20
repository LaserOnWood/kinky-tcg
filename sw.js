const VERSION = "v1"; // change ce numéro à chaque grosse mise à jour
const CACHE_APP = "kinky-app-" + VERSION;
const CACHE_MEDIA = "kinky-media";

// Fichiers copiés dès la 1re visite
const FICHIERS_APP = [
  "./", "index.html", "manifest.webmanifest",
  "css/main.css", "css/feedback.css",
  "js/feedback.js", "js/notification.js", "js/audio.js",
  "js/passemot.js", "js/hasheur.js", "js/carousel.js",
  "json/cartes.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_APP).then((c) => c.addAll(FICHIERS_APP)));
  self.skipWaiting();
});

// Supprime les anciens caches quand VERSION change
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((noms) => Promise.all(
        noms.filter((n) => n.startsWith("kinky-app-") && n !== CACHE_APP)
            .map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord : tes mises à jour s'affichent, le cache sert de secours
async function reseauPuisCache(req) {
  try {
    const rep = await fetch(req);
    if (rep.ok) (await caches.open(CACHE_APP)).put(req, rep.clone());
    return rep;
  } catch {
    return (await caches.match(req))
      || (req.mode === "navigate" ? caches.match("index.html") : Response.error());
  }
}

// Cache d'abord : images, polices, Bootstrap… (lourds, ne changent pas)
async function cachePuisReseau(req) {
  const enCache = await caches.match(req);
  if (enCache) return enCache;
  const rep = await fetch(req);
  if (rep.status === 200 || rep.type === "opaque") {
    (await caches.open(CACHE_MEDIA)).put(req, rep.clone());
  }
  return rep;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.url.endsWith(".mp3")) return; // sons : voir remarque
  const url = new URL(req.url);
  const estApp = url.origin === self.location.origin
    && (req.mode === "navigate" || /\.(html|css|js|json|webmanifest)$/.test(url.pathname));
  e.respondWith(estApp ? reseauPuisCache(req) : cachePuisReseau(req));
});