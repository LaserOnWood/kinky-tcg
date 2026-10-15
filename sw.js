/**
 * ============================================================================
 * SERVICE WORKER — Kinky TCG (mode hors ligne)
 * ============================================================================
 * - Fichiers du jeu (HTML/CSS/JS/JSON) : « réseau d'abord ». Le cache sert de
 *   secours hors ligne, mais aussi quand le réseau met plus de DELAI_RESEAU_MS à
 *   répondre (réseau capricieux en extérieur) ou renvoie une erreur serveur.
 *   Tes mises à jour s'affichent dès que le réseau répond.
 * - Images, polices, Bootstrap… : « cache d'abord » (lourds, ne changent pas).
 * - Illustrations des cartes : mises en cache au fil des affichages, et à l'avance
 *   pour le thème choisi (le jeu envoie un message PRECACHE_IMAGES quand on ouvre
 *   un thème). Aucune image n'est téléchargée pour un thème qu'on n'ouvre jamais.
 * - Sons (.mp3) : jamais interceptés (voir le gestionnaire « fetch » plus bas).
 *
 * Change VERSION quand tu ajoutes/renommes un fichier dans FICHIERS_APP.
 * ============================================================================
 */

const VERSION = "v2.0.2.9"; // change à chaque mise à jour du jeu
const CACHE_APP = "kinky-app-" + VERSION;
const CACHE_MEDIA = "kinky-media";
const URL_CARTES = "json/cartes.json";
const URL_CATALOGUE_HASARD = "assets/cartes/index.json";

const DELAI_RESEAU_MS = 4000;     // au-delà, on sert la copie en cache (si elle existe)
const MAX_IMAGES_PAR_MESSAGE = 200;
const IMAGES_EN_PARALLELE = 3;    // téléchargements simultanés (ménage la connexion mobile)
const MAX_ENTREES_CACHE_MEDIA = 300; // borne le stockage des images, polices et ressources externes
const DELAI_ECOULE = Symbol("delai");

// Fichiers copiés dès la 1re visite.
// Chemins RELATIFS uniquement (jamais « /fichier.html ») : un chemin qui commence
// par « / » viserait la racine du domaine au lieu du dossier du jeu (par exemple
// /game/tcgproto/) et ferait échouer toute l'installation du service worker.
const FICHIERS_APP = [
  "./",
  "index.html",
  "feedback.html",
  "gallery.html",
  "level-builder.html",
  "manifest.webmanifest",
  "css/main.css?v=20261013-2",
  "css/feedback.css",
  "css/feedback-page.css",
  "js/utils.js",
  "js/feedback.js",
  "js/notification.js",
  "js/audio.js",
  "js/hasard.js?v=20261014-1",
  "js/passemot.js?v=20261014-2",
  "js/hasheur.js",
  "js/carousel.js",
  "json/gallery.json",
  URL_CARTES,
  URL_CATALOGUE_HASARD
];

/**
 * Ne garde que les images locales : même origine, dans le dossier du jeu, avec une
 * extension d'image. Les images hébergées ailleurs (https://…) sont ignorées.
 */
function nettoyerUrlsImages(urlsBrutes) {
  const scope = self.registration.scope;
  const urls = new Set();

  for (const brute of urlsBrutes.slice(0, MAX_IMAGES_PAR_MESSAGE)) {
    if (typeof brute !== "string" || !brute) continue;
    try {
      const url = new URL(brute, scope);
      if (
        url.origin === self.location.origin &&
        url.href.startsWith(scope) &&
        /\.(webp|png|jpe?g|gif|avif)$/i.test(url.pathname)
      ) {
        urls.add(url.href);
      }
    } catch {
      // URL invalide : ignorée
    }
  }
  return [...urls];
}

// Évite une croissance sans limite du cache média. Les entrées les plus anciennes
// sont supprimées ; on relance aussi ce ménage après chaque mise en cache.
async function limiterCacheMedia(cache) {
  try {
    const entrees = await cache.keys();
    const excedent = entrees.length - MAX_ENTREES_CACHE_MEDIA;
    if (excedent > 0) {
      await Promise.all(entrees.slice(0, excedent).map(requete => cache.delete(requete)));
    }
  } catch (erreur) {
    console.warn("[sw] Nettoyage du cache média ignoré :", erreur);
  }
}

/**
 * Met en cache les images pas encore stockées, 3 à la fois.
 * Ne lève jamais d'erreur : une image manquante ne bloque rien.
 */
async function precacherImages(urlsBrutes) {
  try {
    const cache = await caches.open(CACHE_MEDIA);
    const aTelecharger = [];
    for (const url of nettoyerUrlsImages(urlsBrutes)) {
      if (!(await cache.match(url))) aTelecharger.push(url);
    }

    let suivant = 0;
    const travailleur = async () => {
      while (suivant < aTelecharger.length) {
        const url = aTelecharger[suivant++];
        try {
          await cache.add(url);
        } catch (erreur) {
          console.warn("[sw] Image non mise en cache :", url, erreur);
        }
      }
    };
    await Promise.all(Array.from({ length: IMAGES_EN_PARALLELE }, travailleur));
    await limiterCacheMedia(cache);
  } catch (erreur) {
    console.warn("[sw] Préchargement des images ignoré :", erreur);
  }
}

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_APP).then((cache) => cache.addAll(FICHIERS_APP)));
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
      .then(() => caches.open(CACHE_MEDIA))
      .then((cache) => limiterCacheMedia(cache))
      .then(() => self.clients.claim())
  );
});

// Le jeu demande de mettre en cache les illustrations du thème qu'on vient d'ouvrir.
self.addEventListener("message", (e) => {
  const message = e.data;
  if (message?.type !== "PRECACHE_IMAGES" || !Array.isArray(message.urls)) return;
  e.waitUntil(precacherImages(message.urls));
});

// Réseau d'abord : tes mises à jour s'affichent, le cache sert de secours
async function reseauPuisCache(req, evenement) {
  const cache = await caches.open(CACHE_APP);

  // La requête réseau continue même si on répond avec le cache (réseau lent) :
  // elle met alors le cache à jour pour la prochaine fois.
  let copie = null;
  const reseau = fetch(req).then((rep) => {
    if (rep.ok) copie = rep.clone();
    return rep;
  });
  evenement.waitUntil(
    reseau.then(() => copie && cache.put(req, copie)).catch(() => {})
  );

  let minuteur;
  const delai = new Promise((resolve) => {
    minuteur = setTimeout(resolve, DELAI_RESEAU_MS, DELAI_ECOULE);
  });

  try {
    const premier = await Promise.race([reseau, delai]);
    clearTimeout(minuteur);

    if (premier === DELAI_ECOULE) {
      // Réseau lent : on sert la copie en cache si elle existe, sinon on attend le réseau.
      return (await caches.match(req)) || await reseau;
    }
    // Erreur serveur passagère (5xx) : on préfère la copie en cache si on en a une.
    if (premier.status >= 500) return (await caches.match(req)) || premier;
    return premier;
  } catch {
    clearTimeout(minuteur);
    return (await caches.match(req))
      || (req.mode === "navigate" ? await caches.match("index.html") : null)
      || Response.error();
  }
}

// Cache d'abord : images, polices, Bootstrap… (lourds, ne changent pas)
async function cachePuisReseau(req) {
  const enCache = await caches.match(req);
  if (enCache) return enCache;
  const rep = await fetch(req);
  if (rep.status === 200 || rep.type === "opaque") {
    const cache = await caches.open(CACHE_MEDIA);
    await cache.put(req, rep.clone());
    await limiterCacheMedia(cache);
  }
  return rep;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  // Sons (.mp3) : on laisse le navigateur gérer. Safari lit les médias par requêtes
  // partielles (Range) que le cache du service worker ne sait pas servir tel quel :
  // les sons demandent donc le réseau (ils ne sont pas disponibles hors ligne).
  if (req.method !== "GET" || req.url.endsWith(".mp3")) return;
  const url = new URL(req.url);
  const estApp = url.origin === self.location.origin
    && (req.mode === "navigate" || /\.(html|css|js|json|webmanifest)$/.test(url.pathname));
  e.respondWith(estApp ? reseauPuisCache(req, e) : cachePuisReseau(req));
});
