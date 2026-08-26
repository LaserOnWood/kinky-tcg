# Pass-Card · Kinky TCG

<div align="center">

**Un jeu de cartes narratif, immersif et entièrement jouable dans le navigateur.**

[![Application web statique](https://img.shields.io/badge/application-web%20statique-5c1228?style=for-the-badge)](https://github.com/LaserOnWood/kinky-tcg)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-d9a94f?style=for-the-badge&logo=javascript&logoColor=1a0b14)](https://developer.mozilla.org/fr/docs/Web/JavaScript)
[![Responsive](https://img.shields.io/badge/design-responsive-ff2f7e?style=for-the-badge)](https://developer.mozilla.org/fr/docs/Learn/CSS/CSS_layout/Responsive_Design)

[**Jouer au projet**](https://laseronwood.github.io/game/tcgproto/) · [**Voir le dépôt**](https://github.com/LaserOnWood/kinky-tcg) · [**Signaler un problème**](https://github.com/LaserOnWood/kinky-tcg/issues)

</div>

> **Pass-Card** est une expérience de cartes à révéler : choisissez une ambiance, découvrez les indices, puis trouvez les réponses qui déverrouillent progressivement votre collection.

## À propos du projet

Kinky TCG est un projet web indépendant conçu comme une expérience de jeu légère, visuelle et accessible directement depuis un navigateur. L’interface propose une sélection de thèmes, une collection de cartes à révéler, une progression persistante et une présentation adaptée aussi bien aux téléphones qu’aux écrans plus larges.

Le dépôt constitue la **source principale du projet**. Les modifications doivent être réalisées ici, puis poussées sur `main`. Un workflow GitHub synchronise ensuite le contenu vers le site public dans le dossier `game/tcgproto`.

## Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| Sélection de thème | Choisissez l’ambiance de la partie avant de commencer. |
| Cartes à révéler | Chaque carte possède un indice, une réponse et une illustration. |
| Progression locale | Les cartes déjà découvertes sont conservées dans le navigateur. |
| Notifications optionnelles | Une notification Discord peut être envoyée lors d’un déverrouillage si une URL de relais est configurée. Elle est désactivée par défaut. |
| Indices supplémentaires | Certaines cartes proposent plusieurs niveaux d’aide via le bouton **Aide**. |
| Révélation animée | Les cartes se retournent et affichent leur illustration lorsqu’elles sont déverrouillées. |
| Aperçu des illustrations | Une carte révélée peut être ouverte en grand format. |
| Catalogue visuel | La page `gallery.html` liste les images du dossier `assets/` et permet de les rechercher, filtrer et ouvrir en grand. |
| Interface responsive | Les cartes restent dans une zone dédiée à hauteur contrôlée et se parcourent horizontalement, sans défilement vertical parasite sur téléphone. |
| Synchronisation automatique | Chaque mise à jour de `main` peut être publiée automatiquement sur le site principal. |

## Règles du jeu

Pass-Card se joue en plusieurs étapes simples. Commencez par choisir un thème parmi les ambiances proposées. Chaque thème possède sa propre collection de cartes, son niveau de difficulté et son identité visuelle.

Une fois la partie lancée, une carte verrouillée affiche un indice. Saisissez votre réponse dans la zone située en bas de l’écran, puis validez. La réponse est normalisée et comparée de manière sécurisée à l’empreinte SHA-256 enregistrée pour la carte : les mots de passe ne sont donc jamais stockés en clair dans les données du jeu.

| Étape | Action du joueur |
|---|---|
| 1. Choisir une ambiance | Sélectionnez un thème pour charger sa collection de cartes. |
| 2. Lire l’indice | Chaque carte propose un premier indice pour orienter votre réflexion. |
| 3. Proposer une réponse | Saisissez votre réponse dans le champ prévu à cet effet, puis sélectionnez **Valider**. |
| 4. Révéler la carte | Une réponse correcte retourne la carte et révèle son illustration, son titre et sa rareté. |
| 5. Utiliser une aide | Si plusieurs indices existent, le bouton **Aide** permet de passer au niveau suivant. |
| 6. Compléter la collection | La barre de progression indique le nombre de cartes déjà découvertes. |

La progression et les indices consultés sont conservés dans le stockage local du navigateur. Le bouton **Retour** permet de revenir au sélecteur de thèmes. Une carte révélée peut également être ouverte en grand format en sélectionnant son illustration.

> **Objectif :** révéler toutes les cartes du thème choisi en trouvant les réponses à partir des indices proposés.

## Démarrer en local

Les cartes sont chargées avec `fetch`. Il est donc nécessaire d’utiliser un serveur HTTP local plutôt que d’ouvrir directement `index.html` avec l’URL `file://`.

Depuis la racine du dépôt, lancez par exemple :

```bash
python3 -m http.server 8000
```

Ouvrez ensuite [http://localhost:8000](http://localhost:8000) dans votre navigateur.

Pour arrêter le serveur, utilisez `Ctrl+C` dans le terminal qui l’exécute.

## Catalogue d’images

La page [`gallery.html`](gallery.html) charge l’inventaire `json/gallery.json`. Ce fichier est généré à partir de tous les formats d’images pris en charge dans `assets/`, y compris les sous-dossiers.

| Commande | Rôle |
| --- | --- |
| `pnpm gallery:index` | Génère ou actualise une seule fois `json/gallery.json`. |
| `pnpm gallery:watch` | Surveille `assets/` et régénère l’inventaire après chaque ajout, retrait, renommage ou modification. |

Le workflow de synchronisation régénère également l’inventaire avant de copier les fichiers vers le site public. Lorsqu’un changement est détecté dans `assets/`, il enregistre automatiquement le nouveau `json/gallery.json` dans `main`, puis le site public reçoit la version mise à jour. Le script compare les chemins, formats, tailles et empreintes des fichiers ; il ne crée donc pas de commit superflu si l’inventaire est déjà à jour.

## Modifier les cartes

Les données jouables se trouvent dans [`json/cartes.json`](json/cartes.json). Chaque carte peut notamment définir un identifiant, un type, une rareté, une image, une description, plusieurs indices et une empreinte de réponse.

| Fichier | Rôle |
|---|---|
| `json/cartes.json` | Collection actuellement utilisée par le jeu. |
| `json/cartes_original.json` | Copie de référence des données d’origine. |
| `json/README.md` | Notes de format et consignes relatives aux données. |

Après une modification des données, rechargez la page et testez au minimum la sélection du thème, le déverrouillage d’une carte et la progression.

## Structure du projet

```text
.
├── index.html              # Point d’entrée de l’application
├── css/
│   ├── style.css           # Palette, composants communs et surcharge Bootstrap sombre
│   └── layout-v3.css       # Mise en page du jeu en trois zones, responsive
├── js/
│   ├── passemot.js         # Chargement des données et logique principale
│   ├── carousel.js         # Navigation du sélecteur de thèmes
│   ├── hasheur.js          # Utilitaire de génération de hash en console
│   └── notification.js     # Notification Discord optionnelle, inactive sans configuration
├── json/
│   ├── cartes.json         # Données actives du jeu
│   ├── cartes_original.json  # Copie de référence
│   ├── gallery.json        # Inventaire généré des fichiers présents dans assets/
│   └── README.md           # Documentation des données
├── gallery.html            # Catalogue visuel des illustrations
├── scripts/
│   ├── generate-gallery.mjs # Génération de l’inventaire JSON
│   └── watch-gallery.mjs    # Surveillance locale du dossier assets/
└── .github/workflows/
    └── sync-to-site.yml    # Synchronisation vers le site public
```

## Déploiement et synchronisation

Le dépôt `LaserOnWood/kinky-tcg` est la source de vérité. Le workflow `.github/workflows/sync-to-site.yml` synchronise le projet vers `LaserOnWood/LaserOnWood.github.io`, dans `game/tcgproto`.

Pour permettre cette synchronisation, le dépôt doit disposer d’un secret GitHub nommé `SITE_REPO_TOKEN`. Ce secret doit autoriser la lecture et l’écriture dans le dépôt du site public ; il ne doit jamais être ajouté aux fichiers du projet ni affiché dans les logs.

Le fonctionnement recommandé est le suivant :

```text
Modification locale
        ↓
Commit sur main
        ↓
Push vers kinky-tcg
        ↓
Workflow de synchronisation
        ↓
Publication dans game/tcgproto
```

Avant chaque publication, vérifiez que les chemins restent relatifs au dossier du projet :

```html
<link rel="stylesheet" href="css/style.css">
<script src="js/passemot.js"></script>
```

Évitez d’ajouter une balise `<base href="../">` dans `index.html`, car elle peut casser le chargement des ressources lorsque le projet est synchronisé dans un sous-dossier.

## Vérifications recommandées

Avant de pousser une modification importante, lancez une prévisualisation locale et contrôlez les principaux parcours :

1. Le sélecteur de thèmes s’affiche correctement.
2. Le choix d’un thème ouvre bien l’écran de jeu.
3. Les cartes et leurs illustrations sont chargées.
4. Une réponse correcte retourne la carte et met à jour la progression.
5. Le bouton **Retour** restaure le sélecteur de thèmes.
6. Le rendu reste utilisable sur téléphone, tablette et ordinateur.
7. La dernière ligne de cartes reste accessible malgré la barre de saisie fixe.

## Historique des versions

Le projet évolue par itérations courtes, avec une attention particulière portée au confort de jeu sur téléphone et à la fiabilité de la synchronisation vers le site public.

| Version / étape | Évolution principale |
|---|---|
| Prototype initial | Mise en place du jeu de cartes, des indices, des réponses hashées et de la progression locale. |
| Sélection thématique | Ajout de plusieurs univers et d’un écran de choix avant l’accès à la partie. |
| Interface responsive | Adaptation de la grille et de la zone de saisie aux téléphones, tablettes et ordinateurs. |
| Carrousel mobile | Ajout d’un défilement horizontal tactile pour les cartes sur les petits écrans. |
| Hauteur mobile adaptative | Utilisation de `dvh` pour adapter la hauteur aux navigateurs mobiles et supprimer le défilement vertical parasite. |
| Mise en page en trois zones | Header, zone de cartes et zone de saisie sont désormais gérés par une grille de hauteur contrôlée. |
| Finition unifiée | Les cartes utilisent une bordure dorée et le fond Bootstrap est surchargé avec la palette sombre du jeu. |
| Organisation des ressources | Déplacement des scripts et des ressources vers une structure plus claire, avec des chemins compatibles avec la synchronisation dans `game/tcgproto`. |
| Documentation actuelle | README enrichi, règles de jeu documentées et procédure de développement local clarifiée. |

Pour consulter l’historique technique détaillé :

```bash
git log --oneline --decorate
```

Les versions publiques sont synchronisées depuis la branche `main`. Les changements importants doivent donc être testés localement avant chaque push afin de préserver la compatibilité avec le workflow de publication.

## Technologies utilisées

Le projet repose volontairement sur une architecture légère et sans étape de compilation : **HTML**, **CSS** et **JavaScript** natifs. Les polices Google Fonts et les icônes Font Awesome sont chargées depuis des CDN dans l’interface principale.

Cette approche facilite l’hébergement statique, la maintenance rapide des données et la publication automatique sans dépendance à un serveur applicatif.

## Contribution

Les propositions d’amélioration sont les bienvenues. Pour contribuer, créez une branche dédiée, effectuez vos changements, testez le parcours complet, puis ouvrez une pull request avec une description concise du problème traité et du comportement attendu.

Les changements de logique, de données ou de synchronisation doivent rester compatibles avec le fonctionnement du site public dans `game/tcgproto`.

## Licence et contenu

Ce projet est un prototype indépendant. Les contenus, illustrations, textes et données de cartes doivent être considérés comme appartenant au projet, sauf indication contraire explicite dans les fichiers concernés. Avant toute réutilisation publique, vérifiez les droits associés aux ressources utilisées.

## Ressources

- [Documentation MDN · JavaScript](https://developer.mozilla.org/fr/docs/Web/JavaScript)
- [Documentation MDN · Responsive design](https://developer.mozilla.org/fr/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [GitHub Actions · Documentation](https://docs.github.com/fr/actions)
- [Font Awesome · Documentation](https://fontawesome.com/docs)
