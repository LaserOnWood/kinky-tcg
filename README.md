# Kinky TCG

Projet indépendant du prototype de jeu de cartes Kinky TCG.

## Structure

Le projet est une application web statique :

- `index.html` contient l’interface principale ;
- `css/` contient les styles ;
- `js/` contient la logique JavaScript ;
- `json/` contient les données éditables des cartes ;
- `v2/` contient la variante expérimentale du prototype ;
- `assets/` contient les ressources graphiques.

## Développement local

Comme les cartes sont chargées avec `fetch`, il faut utiliser un serveur HTTP local plutôt que d’ouvrir directement `index.html` avec `file://`.

Par exemple :

```bash
python3 -m http.server 8000
```

Puis ouvrir <http://localhost:8000>.

## Source de vérité

Ce dépôt est désormais la **source principale** du projet. Les fichiers doivent être modifiés ici, et non directement dans `game/tcgproto` du dépôt du site principal.

Le workflow situé dans `.github/workflows/sync-to-site.yml` publie automatiquement le contenu du dépôt dans `game/tcgproto` de `LaserOnWood.github.io`.

## Configuration de la synchronisation

Le dépôt doit disposer d’un secret GitHub nommé `SITE_REPO_TOKEN`. Ce secret doit être un jeton autorisé à lire et écrire dans le dépôt `LaserOnWood/LaserOnWood.github.io`. Il n’est jamais enregistré dans les fichiers du projet.

Une fois ce secret configuré, chaque modification poussée sur `main` déclenche la synchronisation.
