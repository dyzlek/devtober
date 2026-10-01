# Jour 03 · Bloom · La boîte des Mii

Une boîte de nuit en 3D dans la 3DS. **Tu es le DJ** : tape en rythme sur la musique pour faire monter l'ambiance, jusqu'à la pleine floraison.

- **En haut**, la boîte : une piste de danse en dalles lumineuses, un Mii DJ derrière ses platines, des lasers, une boule à facettes, de la fumée, des néons, et des Mii qui dansent.
- **En bas**, la console du DJ : un gros pad à taper sur chaque temps, la jauge d'ambiance, les effets à allumer, et le bouton **DROP**.

## Le lien avec « Bloom »

Deux sens du mot, réunis :

- **Le bloom, l'effet de lumière** : en 3D, le *bloom* est le halo qui entoure les lumières vives. Ici, il fait briller la piste, les néons, les lasers et l'enseigne « BLOOM » (`UnrealBloomPass` de three.js). Son intensité suit l'ambiance.
- **La fête qui éclot** : la soirée commence vide et sombre. Chaque tap réussi fait **éclore une fleur de lumière** sur la piste : une onde qui s'ouvre en anneau, de dalle en dalle. Plus tu tiens le rythme :
  - plus il y a de Mii qui dansent, de 2 à 14 ;
  - plus la musique s'enrichit (hi-hats, claps, accords, arpèges) ;
  - plus les effets se débloquent : fumée, lasers, stroboscope.

  Au sommet, c'est la **« pleine floraison »**, et le DROP fait tout exploser.

## Comment jouer

- **Tape sur chaque temps** (sur le « boum » du kick) : clic, toucher, Espace ou Entrée. L'anneau autour du pad bat sur le temps pour t'aider.
  - « PARFAIT ! » quand tu es à moins de 70 ms du temps, « Bien ! » à moins de 130 ms ; au-delà, c'est raté et l'ambiance retombe.
  - Les combos rapportent un bonus.
- Si tu arrêtes, l'ambiance redescend et les Mii quittent la piste.
- À 90 % d'ambiance, **DROP** : une montée de 8 temps, puis tout part (lasers, strobo, fumée, halo à fond, caméra qui tremble, pirouettes).

## Comment c'est codé

- [`music.js`](music.js) : le morceau électro à 124 BPM, généré en direct avec Web Audio (kick, basse, hi-hats, claps, accords, arpèges).
  - Les notes sont programmées un peu à l'avance sur l'horloge audio. Cette même horloge sert à juger les taps et à synchroniser toute la scène.
  - Un filtre s'ouvre avec l'ambiance : le son est étouffé au début, brillant à la fin.
- [`club.js`](club.js) : la scène three.js.
  - La piste est une seule `InstancedMesh` de 80 dalles colorées une par une : damier sur le temps, vague depuis le centre, fleurs de lumière.
  - Lasers, boule à facettes (avec des centaines de reflets qui tournent), fumée en sprites, spots qui balaient, stroboscope.
  - Post-traitement : `EffectComposer`, `UnrealBloomPass` et `OutputPass`.
  - **Caméra « clip »** : on ne la contrôle pas. Elle coupe franchement vers un nouveau plan toutes les 2 mesures (vue large, DJ, ras de la piste, plongée qui tourne, foule, côté), avec un léger travelling pendant chaque plan.
- **Les Mii** viennent du moteur du jour 1 (FFL.js et corps Wii U). Ils dansent en enchaînant des poses sur le temps, en sautant, en se balançant et en faisant des pirouettes quand c'est la folie.
  - Leur shader sort des couleurs déjà prêtes pour l'écran. Avec le post-traitement, ils devenaient trop clairs : on corrige leurs couleurs pour qu'ils restent sous le seuil du halo.
- [`game.js`](game.js) : le jeu (taps, combos, jauge, paliers, effets, drop). Le DJ est ton premier Mii du jour 1, et les danseurs sont tes autres Mii, complétés au hasard.
