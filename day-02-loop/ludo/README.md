# Jour 02 · Loop · Ludo des Mii

Un vrai jeu de **Ludo** (les « petits chevaux ») en 3D, dans la 3DS du jour 1. Tu joues contre trois bots, et tous les joueurs sont des Mii.

- **En haut**, la pièce : une table ronde en bois sur un tapis, le plateau, des pions en plastique brillant, et les quatre Mii debout autour de la table, chacun derrière sa couleur.
- **En bas**, le dé : un dé en ivoire qui roule dans un plateau de feutre. Touche-le pour lancer.

## Le lien avec « Loop »

Au Ludo, chaque pion fait **le tour complet du plateau**, soit 52 cases en boucle, avant de remonter le couloir de sa couleur jusqu'au centre. Se faire capturer, c'est retourner au départ et recommencer la boucle. Le premier qui boucle avec ses quatre pions gagne.

## Les règles

- Il faut un **6** pour sortir un pion de sa cour.
- Un **6** fait rejouer, tout comme une capture ou un pion qui arrive au centre.
- Tomber sur un pion adverse le **renvoie dans sa cour**, sauf sur les cases protégées (les cases de départ et les étoiles).
- Il faut le nombre exact pour arriver au centre.

## Une caméra de cinéma

On ne contrôle jamais la caméra : un « réalisateur » choisit les plans tout seul.

- Une vue d'ensemble qui tourne lentement autour de la table.
- Par-dessus l'épaule de ton Mii quand c'est ton tour.
- Un gros plan sur le visage d'un bot quand il lance, avec des bandes noires façon cinémascope.
- Un travelling qui suit le pion pendant qu'il avance case par case.
- La victime puis le gagnant en gros plan quand il y a une capture.

Les Mii réagissent aussi :
- **des bulles de phrases** au-dessus de leur tête : « Un 6 ! », « À la maison ! », « NOOON ! », « Pas moi, pas moi… », « Bravo ! » ;
- **des poses et des expressions** : joie, colère, inquiétude, applaudissements ;
- **les spectateurs** se tournent vers le joueur actif, suivent le pion des yeux, rient d'une capture et s'inquiètent quand un pion adverse s'arrête juste derrière le leur.

## Comment c'est codé

- [`board.js`](board.js) : la scène three.js de l'écran du haut.
  - Le plateau est dessiné dans un canvas 2048 px.
  - Le bois de la table et du cadre est généré dans le code (veines aléatoires).
  - Les pions sont des formes de révolution (`LatheGeometry`) en matériau brillant.
  - L'éclairage combine une lampe avec ombres douces, un éclairage d'ambiance (`RoomEnvironment`) et un rendu filmique (ACES).
  - Les Mii viennent du moteur du jour 1 (FFL.js + corps Wii U), sans copier ses fichiers.
  - La classe `Director` fait glisser la caméra vers chaque plan.
- [`dice.js`](dice.js) : le dé, avec une **vraie physique de cube rigide, faite maison**.
  - À chaque petite étape, on teste les 8 coins du cube.
  - Un coin qui s'enfonce dans le feutre ou un rebord reçoit une impulsion de rebond et de frottement, appliquée à ce coin. C'est ce qui fait basculer, rouler et retomber le dé naturellement sur une face.
  - Le résultat n'est pas tiré à l'avance : c'est la face qui finit sur le dessus.
- [`game.js`](game.js) : les règles, les tours, les bots et les sons (Web Audio).
  - Les bots notent chaque coup possible : capturer, sortir un pion, se mettre à l'abri, éviter les pions adverses juste derrière, avancer.
- **Les Mii** : ceux que tu as créés dans le jour 1 sont réutilisés, parce qu'ils sont dans la même sauvegarde du navigateur, et des Mii au hasard complètent la liste jusqu'à 10. Sur l'écran de départ, tu choisis ton Mii et celui de chacun des trois bots (flèches ◀ ▶, ou « Bots au hasard »). Pendant ce temps, les Mii autour de la table se saluent, se chambrent dans des bulles, prennent des poses et se regardent.

## Commandes

- Touche le dé, ou appuie sur Espace / Entrée, pour lancer.
- Pour choisir un pion, touche-le sur la table, utilise les boutons 1 à 4, ou les touches 1 à 4. Chaque pion porte son numéro au-dessus de la tête. Pendant un choix, les numéros des pions jouables grossissent, les autres s'estompent, et la caméra se fige au-dessus du plateau.
- Boutons : bots rapides, son, nouvelle partie.
