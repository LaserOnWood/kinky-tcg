/**
 * ============================================================================
 * SERVICE WORKER — Kinky TCG (mode hors ligne)
 * ============================================================================
 * - Fichiers du jeu (HTML/CSS/JS/JSON) : « réseau d'abord », le cache sert de
 *   secours hors ligne. Tes mises à jour s'affichent donc dès qu'il y a du réseau.
 * - Images, polices, Bootstrap… : « cache d'abord » (lourds, ne changent pas).
 * - Illustrations des cartes : téléchargées automatiquement dans le cache d'après
 *   json/cartes.json (les nouvelles cartes sont prises en compte toutes seules).
 *
 * Change VERSION quand tu ajoutes/renommes un fichier dans FICHIERS_APP.
 * ============================================================================
 */

const VERSION = "v2";
const CACHE_APP = "kinky-app-" + VERSION;
const CACHE_MEDIA = "kinky-media";
const URL_CARTES = "json/cartes.json";

// Fichiers copiés dès la 1re visite
const FICHIERS_APP = [
  "./", "index.html", "manifest.webmanifest",
  "css/main.css", "css/feedback.css",
  "js/feedback.js", "js/notification.js", "js/audio.js",
  "js/passemot.js", "js/hasheur.js", "js/carousel.js",
  URL_CARTES
];

/**
 * Lit json/cartes.json et met en cache les illustrations locales pas encore
 * stockées. Ne lève jamais d'erreur : une image manquante ne bloque rien.
 * Les images hébergées ailleurs (https://…) sont ignorées.
 */
async function precacherImages(reponseCartes) {
  try {
    const donnees = await reponseCartes.json();
    const cartes = Array.isArray(donnees)
      ? donnees
      : (donnees.themes || []).flatMap((theme) => theme.cards || []);

    const urls = [...new Set(
      cartes
        .map((carte) => carte.image)
        .filter((image) => typeof image === "string" && image && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(image))
        .map((image) => new URL(image, self.registration.scope).href)
    )];

    const cache = await caches.open(CACHE_MEDIA);
    await Promise.allSettled(urls.map(async (url) => {
      if (await cache.match(url)) return; // déjà en cache
      await cache.add(url);
    }));
  } catch (erreur) {
    console.warn("[sw] Préchargement des images ignoré :", erreur);
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_APP);
    await cache.addAll(FICHIERS_APP);

    // Images : ne fait jamais échouer l'installation.
    try {
      const reponse = await fetch(URL_CARTES, { cache: "no-store" });
      if (reponse.ok) await precacherImages(reponse);
    } catch (erreur) {
      console.warn("[sw] Images non préchargées à l'installation :", erreur);
    }
  })());
  self.skipWaiting();
});

// Supprime les anciens caches du jeu quand VERSION change
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
async function reseauPuisCache(req, evenement) {
  try {
    const rep = await fetch(req);
    if (rep.ok) {
      (await caches.open(CACHE_APP)).put(req, rep.clone());
      // Chaque chargement de cartes.json vérifie que toutes les images sont en cache.
      if (new URL(req.url).pathname.endsWith("/" + URL_CARTES)) {
        evenement.waitUntil(precacherImages(rep.clone()));
      }
    }
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
  e.respondWith(estApp ? reseauPuisCache(req, e) : cachePuisReseau(req));
});