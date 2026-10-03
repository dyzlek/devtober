# Jour 03 · Bloom · La boîte des Mii

Une boîte de nuit en 3D dans la 3DS, et un **jeu de rythme façon osu!** sur l'écran tactile. Tu es le DJ : touche les cercles en rythme pour faire monter l'ambiance, jusqu'à la pleine floraison.

- **En haut**, la boîte : une piste de danse en dalles lumineuses, un Mii DJ devant un mur LED avec un égaliseur, des lasers, des faisceaux de projecteurs, une boule à facettes, de la fumée, des néons, des confettis, et des Mii qui dansent.
- **En bas**, le terrain de jeu, dans le style crème des autres jours. Des cercles numérotés apparaissent avec un anneau qui se resserre : touche-les **pile quand l'anneau rejoint le cercle**, sur le temps de la musique.

## Le lien avec « Bloom »

Deux sens du mot, réunis :

- **Le bloom, l'effet de lumière** : en 3D, le *bloom* est le halo qui entoure les lumières vives. Ici, il fait briller la piste, les néons, les lasers et le mur LED (`UnrealBloomPass` de three.js). Son intensité suit l'ambiance.
- **La fête qui éclot** : chaque cercle réussi **s'ouvre en fleur**, et une fleur de lumière éclot sur la piste, au même endroit. Plus tu joues juste :
  - plus il y a de Mii qui dansent, de 2 à 14 ;
  - plus la musique s'enrichit ;
  - plus les effets s'allument : fumée, lasers, stroboscope, confettis.

  À fond, c'est la **« pleine floraison »**, et le DJ lance un **DROP**.

## Comment jouer

- Touche les cercles dans l'ordre des numéros, au moment où l'anneau rejoint le bord du cercle. Tu peux toucher au doigt, cliquer, ou viser à la souris et appuyer sur X, C ou Espace.
- La note dépend de ton timing :
  - **300** à moins de 70 ms du temps ;
  - **100** à moins de 130 ms ;
  - **50** à moins de 190 ms ;
  - **Raté** si tu laisses passer le cercle.
- Les combos multiplient le score.
- Les pointillés montrent le chemin entre les cercles d'un même groupe (même couleur, numéros 1, 2, 3…).
- Plus l'ambiance monte, plus il y a de cercles, avec des enchaînements rapides au plus fort de la soirée.
- La soirée dure 64 mesures (environ 2 minutes). À la fin : rang (S+, S, A, B, C, D), précision, score et meilleur combo.

## Les niveaux

Trois niveaux à choisir avant la soirée (le choix est gardé pour la prochaine fois) :

| | Facile | Moyen | Difficile |
|---|---|---|---|
| L'anneau met… | 2,1 temps | 1,6 temps | 1,25 temps |
| Fenêtre du « 300 » | 90 ms | 70 ms | 50 ms |
| Taille des cercles | plus grands | normale | plus petits |
| Notes | moins nombreuses, pas de doubles croches | normal | plus serrées, doubles croches dès que ça s'anime |
| Ambiance | monte plus vite, un raté coûte peu | normal | monte moins vite, un raté coûte cher |
| Score | ×0,75 | ×1 | ×1,5 |

## Comment c'est codé

- [`music.js`](music.js) : le morceau électro à 124 BPM, généré en direct avec Web Audio (kick, basse, hi-hats, claps, accords, arpèges).
  - Les notes sont programmées un peu à l'avance sur l'horloge audio. Cette même horloge sert à juger les taps et à synchroniser toute la scène.
  - Un filtre s'ouvre avec l'ambiance : le son est étouffé au début, brillant à la fin.
- [`club.js`](club.js) : la scène three.js.
  - La piste est une seule `InstancedMesh` de 80 dalles colorées une par une : damier sur le temps, vague depuis le centre, fleurs de lumière.
  - Lasers, projecteurs avec des faisceaux visibles, boule à facettes (avec des centaines de reflets qui tournent), fumée en sprites, stroboscope.
  - Un mur LED dont l'égaliseur est redessiné à chaque image, et des confettis (`InstancedMesh`) pendant le drop.
  - Post-traitement : `EffectComposer`, `UnrealBloomPass` et `OutputPass`.
  - **Caméra « clip »** : on ne la contrôle pas. Elle coupe franchement vers un nouveau plan toutes les 2 mesures (vue large, DJ, ras de la piste, plongée qui tourne, foule, côté), avec un léger travelling pendant chaque plan.
- **Les Mii** viennent du moteur du jour 1 (FFL.js et corps Wii U). Ils dansent en enchaînant des poses sur le temps, en sautant, en se balançant et en faisant des pirouettes quand c'est la folie.
  - Leur shader sort des couleurs déjà prêtes pour l'écran. Avec le post-traitement, ils devenaient trop clairs : on corrige leurs couleurs pour qu'ils restent sous le seuil du halo.
- [`game.js`](game.js) : le jeu de rythme.
  - La partition est **générée en direct** sur le tempo, avec des respirations toutes les 4 mesures et des enchaînements rapides pendant le drop.
  - Les cercles suivent un chemin fluide qui tourne et rebondit sur les bords. Ils sont dessinés dans un canvas 2D.
  - Le timing est jugé sur l'horloge audio. Les fleurs s'ouvrent au toucher.
  - L'ambiance, les paliers, les effets automatiques, le drop et l'écran de résultats sont gérés ici.
  - Le DJ est ton premier Mii du jour 1, et les danseurs sont tes autres Mii, complétés au hasard.
