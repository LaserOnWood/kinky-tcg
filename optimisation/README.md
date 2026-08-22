# Optimisation de la feuille de style (CSS)

Ce dossier contient une version refondue et optimisée de la feuille de style principale du projet Kinky TCG (`main.css`).

## Objectifs de cette optimisation

1. **Amélioration de la lisibilité et de la maintenance :**
   - Toutes les variables CSS ont été renommées avec une nomenclature claire et hiérarchique (ex: `--bg-void` devient `--color-bg-main`, `--velvet` devient `--color-accent-velvet`).
   - Le code a été restructuré en sections logiques avec des commentaires délimitant chaque partie (Variables, Typographie, Sélection, Jeu, Responsive).

2. **Nettoyage des références obsolètes (V3) :**
   - Toutes les classes contenant le préfixe `v3-` (comme `.v3-prototype`, `.v3-game-shell`, `.v3-header`, etc.) ont été renommées en classes sémantiques universelles (`.game-shell`, `.game-header`, etc.).
   - La logique d'affichage a été simplifiée, retirant la nécessité de jongler entre des anciennes versions et des versions "v3".

3. **Carrousel infini intégré :**
   - La gestion des fonds dynamiques des cartes de thème utilise la règle `nth-child(4n+X)` mise en place précédemment, garantissant que l'ajout de nouveaux thèmes dans `json/cartes.json` ne cassera jamais le design.

## Comment utiliser ce fichier ?

Pour basculer sur cette version optimisée, vous devrez :

1. Remplacer le fichier `css/main.min.css` actuel par le contenu de `optimisation/main.css` (et potentiellement le minifier à nouveau si vous utilisez un outil de build).
2. Mettre à jour les classes dans votre fichier `index.html` (et potentiellement `showroom.html`) pour correspondre aux nouveaux noms de classes. Par exemple :
   - Remplacer `<body class="selection-v2 v3-prototype">` par `<body>` (et s'assurer que la section de sélection a bien la classe `selection-screen`).
   - Remplacer `<div id="game-content" class="hidden v3-game-shell">` par `<div id="game-content" class="hidden game-shell">`.
   - Remplacer `<header class="top v3-header">` par `<header class="game-header">`.
   - Et ainsi de suite pour toutes les classes préfixées par `v3-`.

## Correspondance des principales classes modifiées

| Ancienne classe (V3) | Nouvelle classe optimisée |
|----------------------|---------------------------|
| `.v3-prototype` | (Supprimée, les styles sont globaux ou sur `.selection-screen`) |
| `.v3-game-shell` | `.game-shell` |
| `.v3-header` | `.game-header` |
| `.v3-back-button` | `.back-button` |
| `.v3-level` | `.level-indicator` |
| `.v3-title-block` | `.title-block` |
| `.v3-cards-zone` | `.cards-zone` |
| `.v3-cards-frame` | `.cards-frame` |
| `.grid` (dans v3) | `.cards-grid` |
| `.v3-swipe-hint` | `.cards-swipe-hint` |
| `.v3-entry-bar` | `.entry-bar` |
| `.eyebrow` | `.eyebrow-text` |

## Variables CSS renommées

Les variables ont été catégorisées pour une meilleure compréhension de leur rôle :
- `--color-bg-*` : Couleurs de fond
- `--color-accent-*` : Couleurs d'accentuation (boutons, bordures actives, etc.)
- `--color-text-*` : Couleurs de texte
- `--color-border-*` : Couleurs de bordure
- `--radius-*` : Rayons de courbure (border-radius)
- `--font-family-*` : Polices de caractères
