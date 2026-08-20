# Kinky TCG — prototype v3

Ce dossier contient un **prototype isolé** de la page de jeu. Il ne modifie ni `index.html`, ni la feuille de style, ni les scripts de la version actuelle du projet.

## Objectif du prototype

L’écran de jeu est distribué dans trois zones verticales au sein de la hauteur visible du navigateur : l’en-tête, la collection de cartes et le pied de page de saisie. La structure utilise `100dvh` pour tenir compte de la hauteur dynamique des navigateurs mobiles. Le conteneur principal masque tout débordement vertical, tandis que la collection autorise seulement un déplacement horizontal entre les cartes.

| Zone | Contenu | Comportement |
|---|---|---|
| **En-tête** | Retour, titre et progression, niveau sélectionné | Hauteur stable, visible en permanence |
| **Cartes** | Cartes du thème actif | Prend tout l’espace restant ; déplacement horizontal uniquement |
| **Pied de page** | Retour d’état, saisie du code et validation | Fait partie de la grille, sans position fixe ni réserve artificielle |

Les cartes gardent le ratio **5 / 7,3** de la collection. Leur largeur est limitée à la plus petite valeur entre la largeur disponible, une taille maximale de 340 px et la hauteur disponible du cadre. Elles ne sont donc pas déformées, et elles réduisent seulement si l’écran est particulièrement bas.

## Essai local

Lancer un serveur web à la racine du dépôt, puis ouvrir `v3/index.html`. Un serveur est nécessaire parce que les cartes sont chargées depuis `v3/json/cartes.json`.

```bash
python3 -m http.server 8000 --directory .
```

L’adresse de test est ensuite : `http://localhost:8000/v3/index.html`.

## Contenu isolé

Le dossier inclut ses propres fichiers de styles, scripts et données. La seule adaptation fonctionnelle effectuée dans `js/passemot-v3.js` est la mise à jour du libellé de niveau dans le nouvel en-tête. Les règles de disposition du prototype se trouvent dans `css/layout-v3.css` et sont commentées en français.
