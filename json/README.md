# Modifier les cartes du prototype TCG

Le fichier `cartes.json` centralise **toutes les données éditables** du prototype. Pour modifier une carte, son type affiché, ses indices ou son contenu révélé, éditez ce fichier puis publiez les changements. La logique JavaScript ne doit pas être modifiée.

| Champ | Rôle | Exemple |
|---|---|---|
| `id` | Identifiant interne unique de la carte. Il n’est pas affiché à l’utilisateur. Ne pas réutiliser un identifiant existant. | `9` |
| `type` | Mot affiché au dos de la carte à la place de l’ancien numéro. Ce champ doit contenir un texte non vide et peut être choisi librement. | `"Objet"` |
| `passwordHash` | Hash SHA-256 du mot de passe normalisé : minuscules et sans espaces inutiles. | `"…"` |
| `hints` | Liste d’indices. Le premier s’affiche d’abord ; le bouton **Aide** fait défiler les suivants en boucle. | `["Indice 1", "Indice 2"]` |
| `title` | Titre révélé après le déverrouillage. | `"La Surprise"` |
| `image` | URL absolue ou chemin relatif de l’illustration. | `"images/carte-09.jpg"` |
| `description` | Texte ou gage révélé par la carte. | `"…"` |
| `rarity` | Rareté visuelle. Valeurs autorisées : `Coquine`, `Provocante`, `Audacieuse`, `Envoûtante`, `Sulfureuse`, `Mythique`. | `"Provocante"` |

> Le fichier est du JSON strict : aucun commentaire n’est permis, et une virgule est requise entre deux cartes, sauf après la dernière.

> Comme les données sont chargées avec `fetch`, ouvrez le jeu via GitHub Pages ou un serveur local HTTP. L’ouverture directe de `index.html` avec une adresse commençant par `file://` peut empêcher le navigateur de lire le JSON.

## Générer un hash de mot de passe

Après le chargement du jeu dans un navigateur, ouvrez la console puis saisissez :

```js
await genererHash("mon-mot-de-passe")
```

Copiez le résultat dans `passwordHash`. Ne placez jamais le mot de passe en clair dans `cartes.json`.
