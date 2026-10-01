# Jour 04 · Drift · Mii Kart

Une course de karts façon Mario Kart, dans la 3DS. 8 Mii, 3 tours, un circuit, et surtout **le dérapage** : maintiens-le dans les virages pour charger un mini-turbo.

- **En haut**, la course en 3D, avec la caméra derrière ton kart : tour, chrono, position, compte à rebours, et un plan d'ouverture qui survole la grille de départ.
- **En bas**, comme dans Mario Kart DS : la carte du circuit avec la tête de chaque Mii, le classement en direct et les commandes tactiles (gauche, droite, Drift). Le tout dans le style crème des autres jours.

## Le lien avec « Drift »

Le *drift*, c'est le dérapage contrôlé, la technique de base des jeux de kart. Ici, c'est le cœur du jeu.

1. Appuie sur Drift en tournant : le kart **saute**, puis atterrit en glissant. L'arrière chasse vers l'extérieur et la fumée sort des pneus.
2. Garde le bouton : des **étincelles** jaillissent des roues arrière et changent de couleur avec le temps :
   - **bleu** : mini-turbo ;
   - **orange** : super mini-turbo ;
   - **violet** : ultra mini-turbo.
3. Lâche le bouton : **turbo**, avec des flammes dans les pots d'échappement. Plus les étincelles étaient chaudes, plus il dure longtemps.

Pendant le dérapage, braquer vers l'intérieur serre le virage (et charge plus vite), braquer vers l'extérieur l'élargit.

## Comment jouer

- **Clavier** :
  - flèches ou A / D pour tourner ;
  - Espace (ou Maj, ou X) pour sauter et déraper ;
  - flèche du bas pour freiner.
- **Tactile** : les boutons de l'écran du bas. Le kart accélère tout seul.
- Choisis **ton pilote** parmi tes Mii du jour 1 (ou des Mii au hasard si tu n'en as pas créé), et la **cylindrée** : 50cc, 100cc ou 150cc.
- Les **dalles orange** du circuit donnent un coup de turbo. **L'herbe** ralentit beaucoup. Les **murets** font rebondir.
- **Turbo de départ** : appuie sur Drift pendant le « 1 » du compte à rebours. Trop tôt, ça ne marche pas.
- Au **dernier tour**, la musique accélère et monte d'un ton, comme dans les vrais jeux de kart.
- À l'arrivée : le classement avec les temps, ton meilleur tour et ton nombre de mini-turbos.

## Comment c'est codé

- [`track.js`](track.js) : le circuit.
  - Le tracé est une courbe fermée (`CatmullRomCurve3`), découpée en 1 200 points. À partir de ces points, on fabrique la route, les vibreurs rouges et blancs et les murets bleus et blancs, comme des rubans.
  - Ces mêmes points servent à tout le reste : savoir où est chaque kart (le point le plus proche, cherché autour du dernier connu), s'il est sur l'herbe (son écart avec le centre), compter les tours, placer la carte.
  - Le décor : arbres en `InstancedMesh`, collines, nuages, ciel en dégradé, arche de départ avec les feux, tribune avec des Mii qui applaudissent.
- [`kart.js`](kart.js) : un kart et sa conduite.
  - La carrosserie est faite de formes arrondies (`RoundedBoxGeometry`), de la couleur préférée du Mii. Les roues avant tournent avec le volant.
  - Le Mii est le même qu'aux jours 1 à 3 (corps animé + tête FFL), assis : ses jambes sont cachées dans la coque, et ses bras (les os `arm_l1` / `arm_r1`) sont tournés vers le volant.
  - La conduite est « arcade » : une vitesse qui tend vers une cible (pointe, herbe, turbo), un cap qui tourne selon le volant, un saut, et le dérapage avec sa charge en trois niveaux.
- [`game.js`](game.js) : la course.
  - Le déroulé : menu, plan d'ouverture, compte à rebours, course, arrivée, résultats.
  - Les pilotes ordinateur visent un point un peu plus loin sur la route, prennent la corde dans les virages, changent de file de temps en temps, et dérapent dans les virages serrés pour avoir leurs mini-turbos.
  - Ils s'adaptent un peu à ton avance ou à ton retard, pour que la course reste serrée.
  - Les karts se bousculent quand ils se touchent.
  - La caméra suit ton cap en douceur et s'élargit pendant les turbos.
- [`fx.js`](fx.js) : les particules (étincelles, flammes, fumée, poussière), dans deux nuages de points avec un petit shader.
- [`audio.js`](audio.js) : tout le son, généré en direct avec Web Audio :
  - le moteur, dont la hauteur suit la vitesse ;
  - le crissement des pneus pendant le dérapage ;
  - les « ting » des étincelles, le souffle du turbo, le compte à rebours ;
  - la musique de course (150 BPM) et la fanfare d'arrivée.

Les Mii et leurs corps viennent du jour 1 (FFL.js, voir [`../day-01-pulse/README.md`](../day-01-pulse/README.md)). Pas de build : du HTML, du CSS et des modules JavaScript, avec three.js chargé depuis un CDN.
