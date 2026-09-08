# Prototype — Aide niveaux et raretés

Ce dossier est une copie autonome du jeu Kinky TCG intégrant un système d’aide contextuelle.

## Ajouts

- Bouton d’information sur l’écran de sélection des thèmes pour expliquer la difficulté.
- Bouton d’information dans le header du jeu pour expliquer les raretés réellement utilisées dans `json/cartes.json`.
- Modale commune, responsive et accessible, fermable avec la croix, un clic sur l’arrière-plan ou la touche `Échap`.
- Conservation de l’application principale intacte : les modifications sont limitées à ce prototype.

## Lancement local

Depuis ce dossier, lancer un serveur HTTP, car le jeu charge `json/cartes.json` avec `fetch` :

```bash
python3 -m http.server 8080
```

Puis ouvrir `http://localhost:8080/`.

## Fichiers modifiés dans le prototype

- `index.html` : boutons et structure de la modale.
- `css/main.css` : styles de l’aide contextuelle.
- `js/passemot.js` : ouverture, fermeture et contenu dynamique de la modale.

Les niveaux et les raretés affichés correspondent aux valeurs existantes dans `json/cartes.json`.
