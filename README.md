# Devtober 2026

Comme l'Inktober, mais pour les devs : **1 mot par jour pendant tout octobre**. Chaque jour, on crée quelque chose en code inspiré du mot, et on le publie.

Total liberté sur la forme : jeu, animation, art génératif, outil, expérience UI... Environ 1h30 à 2h par jour. Pas besoin que ce soit parfait, l'important c'est de publier. Pas obligé de faire les 31 jours.

Hashtag : **#devtober**

Toutes les créations sont jouables depuis la page d'accueil du repo, publiée sur GitHub Pages.

## Les mots

| Jour | Mot | Projet |
| --- | --- | --- |
| 01 | Pulse | [Testeur d'affinité](day-01-pulse/) |
| 02 | Loop |  |
| 03 | Bloom |  |
| 04 | Drift |  |
| 05 | Chaos |  |
| 06 | Tiny |  |
| 07 | Swarm |  |
| 08 | Maze |  |
| 09 | Gravity |  |
| 10 | Fold |  |
| 11 | Ripple |  |
| 12 | Lost |  |
| 13 | Tangle |  |
| 14 | Bounce |  |
| 15 | Shadow |  |
| 16 | Tide |  |
| 17 | Orbit |  |
| 18 | Glitch |  |
| 19 | Echo |  |
| 20 | Fragile |  |
| 21 | Signal |  |
| 22 | Mirror |  |
| 23 | Spark |  |
| 24 | Hidden |  |
| 25 | Melt |  |
| 26 | Machine |  |
| 27 | Haunted |  |
| 28 | Grow |  |
| 29 | Infinite |  |
| 30 | Collapse |  |
| 31 | Wake |  |

## Organisation du repo

Un dossier par jour, nommé `day-XX-mot`. Chaque dossier contient :

- le code du projet, avec une page `index.html` à ouvrir dans un navigateur ;
- un `README.md` qui explique le code et en quoi il correspond au mot.

```
octobre/
├── README.md            ← ce fichier
├── index.html           ← page d'accueil : la grille des 31 jours
├── days.js              ← les 31 mots + la liste des jours publiés
├── hub/                 ← le cadre commun (accueil, navigation, README en modale)
├── day-01-pulse/
│   ├── index.html
│   └── README.md
├── day-02-loop/
└── ...
```

### Le site d'accueil

`index.html` affiche les 31 mots avec l'état de chaque jour : publié, aujourd'hui, passé ou à venir. Un jour publié s'ouvre sur sa propre page (`#/day-01-pulse`). La création y prend tout l'écran, sous une barre qui contient :

- le fil d'Ariane ;
- les boutons jour précédent et jour suivant ;
- une icône livre qui ouvre le README du jour.

Le tout est en HTML/CSS/JS, sans build. Les README sont convertis avec [marked](https://marked.js.org), chargé à la première ouverture.

### Ajouter un jour

1. Crée le dossier `day-XX-mot/` avec un `index.html` et un `README.md`.
2. Ajoute le jour dans `PUBLISHED` (fichier `days.js`), avec un titre et une phrase d'accroche.
3. Ajoute le lien dans le tableau ci-dessus.

## Lancer en local

Les pages chargent des fichiers avec `fetch`, il faut donc un petit serveur :

```bash
python -m http.server 5173
```

Puis ouvre http://localhost:5173/.

## Participer

1. Crée un repo GitHub public avec un dossier par jour (`day-01-pulse`, `day-02-loop`...).
2. Dans chaque dossier, ajoute un README qui explique ton code et le lien avec le mot.
3. Ajoute le topic `devtober` à ton repo (la roue crantée à côté de « About ») pour qu'on puisse tous les retrouver : [github.com/topics/devtober](https://github.com/topics/devtober).
4. Poste ton lien avec un GIF ou un screenshot, avec **#devtober**.

## Et après ?

Une plateforme où les projets de chaque jour seront visibles et jouables par tout le monde est envisagée, pour que chacun puisse tester les créations des autres. Uniquement avec l'autorisation du créateur.
