/*
 * Outils partagés par les fonctions serveur (api/notification.js et api/feedback.js) :
 * adresse du visiteur et limitation du nombre de requêtes.
 *
 * Limite : la mémoire d'une fonction serverless est propre à chaque instance (et se vide
 * quand elle s'arrête). La limitation freine donc les envois en rafale mais n'est pas absolue.
 */

export function adresseIp(request) {
  const direct = request.headers["x-real-ip"];
  const transmise = String(request.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  return String(direct || transmise || "inconnue");
}

// Enregistre une requête et renvoie true si la clé dépasse « maximum » requêtes dans la fenêtre.
export function limiteDepassee(table, cle, maximum, fenetreMs) {
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
