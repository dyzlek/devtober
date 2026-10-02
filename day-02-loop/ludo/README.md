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

- **Lance le dé d'un geste du doigt** (ou de la souris) sur l'écran du bas : le dé part dans le sens du geste, et plus le geste est rapide, plus il roule fort. Un simple toucher, ou Espace / Entrée, le lance normalement.
- Pour choisir un pion, touche-le sur la table, utilise les boutons 1 à 4, ou les touches 1 à 4. Chaque pion porte son numéro au-dessus de la tête. Pendant un choix, les numéros des pions jouables grossissent, les autres s'estompent, et la caméra se fige au-dessus du plateau.
- Boutons : bots rapides, son, nouvelle partie.
- **Sous la console** : le choix du décor et des boutons pour faire jouer des animations aux quatre Mii.

## Versions

### v2.1
- **Les affinités du jour 1** : au début de la partie, on calcule l'affinité amicale entre chaque paire de Mii, avec la même formule que le Testeur d'affinité ([`affinity.js`](affinity.js)). Pendant la partie :
  - quand quelqu'un fait un 6 ou rentre un pion, ses amis l'encouragent (« Bien joué ! », applaudissements) et ceux qui ne l'aiment pas le narguent (« Hmph ! », bras croisés) ;
  - quand quelqu'un se fait manger, ses amis se prennent la tête (« Oh non… ») et ses ennemis applaudissent (« Bien fait ! ») ;
  - si deux amis se mangent, celui qui mange s'excuse et l'autre crie à la trahison ;
  - à la fin, les amis du gagnant applaudissent, les autres boudent.
- **Des réactions avec les bras** : applaudir, lever les bras, faire un « bien joué », croiser les bras, se prendre la tête. Les bras sont posés par-dessus l'animation du corps, comme dans les scènes du jour 1.
- **Le lancer au doigt** : la vitesse et la direction du geste donnent la force et le sens du lancer.
- **Ralenti sur les captures** : le jeu passe au ralenti, la caméra suit le pion mangé qui s'envole jusqu'à sa cour, avec une traînée de sa couleur.
- **Quatre décors** ([`decor.js`](decor.js)) : le salon (bibliothèque, fenêtre), un pique-nique dans l'herbe (nappe à carreaux, arbres, fleurs, nuages), la plage (sable, mer qui ondule, parasol, palmiers) et la nuit (étoiles, guirlandes de lampions, lucioles). Le décor choisi est gardé pour la prochaine visite.
- **Multijoueur local** : sur l'écran de départ, touche « Toi », « Joueur » ou « Bot » au-dessus de chaque place pour la changer. De 0 à 4 vrais joueurs sur la même console. À chaque tour d'un joueur, l'écran du bas montre à qui passer la console, avec son Mii et sa couleur.
- **Une petite pause** de 400 ms après chaque action des bots, pour mieux suivre la partie.
