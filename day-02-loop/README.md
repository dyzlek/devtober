# Jour 02 · Loop

**Gratte la Boucle** : un petit jeu de tickets à gratter incrémental en pixel art, inspiré de *Scritchy Scratchy*, fait avec [Phaser 3](https://phaser.io).

## Le lien avec « Loop »

Le jeu *est* une boucle, et il le dit franchement :

- **La boucle de jeu** : acheter un ticket, le gratter, encaisser, en racheter un. Les petites phrases en bas de l'écran le rappellent (« Encore un. Juste un. »).
- **Le symbole ∞** : trois ∞ sur un ticket, et le ticket se **rejoue tout seul**, gratuitement. Le ticket Ouroboros (le serpent qui se mord la queue) en contient beaucoup plus.
- **Recommencer la boucle** : après 1 000 € gagnés, on peut tout remettre à zéro. Le compteur « Boucle n° » augmente, et chaque recommencement donne un bonus de gains permanent. Le ticket Ouroboros se débloque à la boucle n°2.
- **Le Gratt-o-bot** finit par jouer la boucle à ta place : il achète, gratte, recommence… sans toi.

## Comment c'est codé

Tout est dans [`game.js`](game.js), une seule scène Phaser, sans image ni son à charger :

- **Pixel art généré** : les symboles (pièce, anneau, flèche, étoile, ∞) et le robot sont décrits en petites grilles de caractères, transformées en textures avec `textures.generate` (palette Arne16 de Phaser).
- **Le grattage** : la couche argentée est une `RenderTexture`. À chaque mouvement de souris, on « efface » un pinceau rond le long du trait (`erase`). Chaque case a 16 points de contrôle : quand 11 sont grattés, la case se découvre entièrement.
- **Le tirage** : un ticket est gagnant selon une probabilité (augmentée par l'amélioration Trèfle). Le symbole gagnant est tiré selon des poids, et les autres cases sont remplies sans jamais faire un second triplé.
- **Le robot** suit un chemin en zigzag sur les rangées et gratte avec le même code que la souris.
- **Le son** est créé à la volée avec Web Audio : bruit filtré pour le grattage, petites mélodies pour les gains et la boucle.
- **La sauvegarde** se fait dans le `localStorage` : argent, améliorations, numéro de boucle, nombre de tickets.

## Bonus : Téléphone traduit

Une deuxième idée pour « Loop » : une phrase qui fait le tour des langues et revient déformée, avec une boucle de langues que tu construis toi-même. À voir dans [`telephone/`](telephone/).

## Jouer

Ouvre la page depuis l'accueil du Devtober, ou lance un petit serveur local à la racine du repo et ouvre `day-02-loop/`. Ça marche à la souris et au doigt.
