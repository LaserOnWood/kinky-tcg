# Prototype — Aide niveaux et raretés

Ce dossier est une copie autonome du jeu Kinky TCG intégrant un système d’aide contextuelle et un formulaire de feedback anonyme.

## Ajouts

- Bouton d’information sur l’écran de sélection des thèmes pour expliquer la difficulté.
- Bouton d’information dans le header du jeu pour expliquer les raretés réellement utilisées dans `json/cartes.json`.
- Modale commune, responsive et accessible, fermable avec la croix, un clic sur l’arrière-plan ou la touche `Échap`.
- Formulaire de feedback envoyé par la route serverless `/api/feedback`, afin que le webhook Discord ne soit jamais exposé au navigateur.
- Conservation de l’application principale intacte : les modifications sont limitées à ce prototype et à la fonction API partagée nécessaire au déploiement Vercel.

## Configuration Vercel

Dans les paramètres du projet Vercel, ajouter les variables d’environnement `FEEDBACK_DISCORD_WEBHOOK_URL` et `DISCORD_NOTIFICATION_WEBHOOK_URL`, avec leurs URLs de webhook Discord respectives comme valeurs. La variable `DISCORD_NOTIFICATION_WEBHOOK_URL` est utilisée par `/api/notification` pour les cartes débloquées. Les variables doivent être configurées pour les environnements souhaités, notamment **Production** et **Preview** si nécessaire. Ne pas utiliser de préfixe public tel que `NEXT_PUBLIC_` ou `VITE_`.

Après l’ajout ou la modification de la variable, créer un nouveau déploiement afin que la fonction serverless utilise la nouvelle configuration. Pour un développement local, copier `.env.example` dans `.env.local` et remplacer la valeur par un webhook de test; ne jamais committer ce fichier.

L’ancien webhook ayant été présent dans le code source, il est recommandé de le supprimer/régénérer dans Discord avant de renseigner la nouvelle valeur dans Vercel.

## Lancement local

Depuis la racine du dépôt, lancer un serveur HTTP compatible avec les fonctions Vercel, car le jeu charge `json/cartes.json` avec `fetch` et le feedback utilise `/api/feedback`. Avec la CLI Vercel :

```bash
vercel dev
```

Puis ouvrir l’URL locale indiquée par la commande.

## Fichiers modifiés dans le prototype

- `index.html` : boutons et structure de la modale.
- `css/main.css` : styles de l’aide contextuelle.
- `js/passemot.js` : ouverture, fermeture et contenu dynamique de la modale.
- `js/feedback.js` : envoi du formulaire vers `/api/feedback`, sans secret côté client.
- `../../api/feedback.js` : relais serverless vers Discord avec `FEEDBACK_DISCORD_WEBHOOK_URL`.
- `../../api/notification.js` : relais serverless des cartes débloquées avec `DISCORD_NOTIFICATION_WEBHOOK_URL`.

Les niveaux et les raretés affichés correspondent aux valeurs existantes dans `json/cartes.json`.
