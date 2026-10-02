# Jour 01 · Pulse

**Testeur d'affinité** inspiré de l'écran de compatibilité de *Tomodachi Life*, avec de **vrais Mii en 3D**.

## Le lien avec « Pulse »

- Le pourcentage ne monte pas d'un coup. Il grimpe **au rythme d'un cœur qui s'emballe** : chaque battement (son généré avec Web Audio) fait avancer le score, et les Mii « sursautent » avec.
- À la fin, le cœur continue de battre. **Son pouls dépend du score**, de 45 bpm pour un couple raté à environ 155 bpm pour des âmes sœurs.

## Comment ça marche

- **L'interface** est une 3DS dessinée en CSS. En haut, l'écran du résultat dans son cadre doré ; en bas, l'écran tactile. On touche deux Mii, on choisit Amour ou Amitié, puis « Tester ! ». Les boutons de la coque sont décoratifs.
- **Les Mii** sont rendus en 3D avec [FFL.js](https://github.com/ariankordi/FFL.js) (la bibliothèque Mii de la Wii U, décompilée) et three.js, avec les **corps Mii officiels** de la Wii U, comme dans [Mii Creator](https://github.com/JoshuaTheNewUser/mii-creator). Le corps est animé (pose d'attente, saut de joie, air triste), la tête suit l'os « head », les Mii clignent des yeux et changent d'expression selon le score.
- **Le Mii Maker** (`+ Nouveau` ou `✏️ Modifier`) modifie directement les données du Mii (CharInfo, 288 octets) : visage, coiffure, sourcils, yeux, nez, bouche, lunettes/barbe, taille et corpulence. Le profil contient le prénom, l'anniversaire, la couleur préférée et la personnalité. On peut aussi importer un `.ffsd` depuis Mii Creator.
- **Le calcul** (`compat()` dans `app.js`) donne toujours le même résultat pour un même couple, comme dans le jeu. Il prend en compte :
  - la personnalité (4 curseurs) ;
  - le signe astro, déduit de l'anniversaire du Mii ;
  - la couleur préférée ;
  - un « grain de folie » stable.
- **La sauvegarde** se fait dans le `localStorage`. On peut exporter/importer en JSON, ou envoyer un **lien de partage** qui contient les deux Mii.

## Lancer

Il faut un petit serveur, parce que le fichier de ressources est chargé avec `fetch` :

```bash
python -m http.server 5173
```

Puis ouvre http://localhost:5173/day-01-pulse/. Sur GitHub Pages, ça marche tel quel.

## Versions

### v1.3
- **Une petite scène pour chaque palier de 10 %**, comme les relations dans Tomodachi Life. Elles sont décrites dans [`skits.js`](skits.js) : position, orientation, expression et bras de chaque Mii, image par image. Les bras sont posés par-dessus l'animation du corps (os `arm_l1`, `arm_r1` et les avant-bras).
  - 0 à 9 % : l'un repousse l'autre, qui vole en arrière (« Le grand rejet » ou « La bagarre ») ;
  - 10 à 19 % : dos à dos, bras croisés ;
  - 20 à 29 % : la bouderie, l'autre vient s'excuser puis repart en haussant les épaules ;
  - 30 à 39 % : le malaise, on se regarde, on détourne les yeux, on se gratte la tête ;
  - 40 à 49 % : une poignée de main polie ;
  - 50 à 59 % : coucou !
  - 60 à 69 % : on se tape dans la main ;
  - 70 à 79 % : on danse ensemble ;
  - 80 à 89 % : main dans la main (« Côte à côte » en amitié) ;
  - 90 à 100 % : le câlin (« L'accolade » en amitié, avec des tapes dans le dos).
- **Le cœur bat avec la musique** : après le résultat, une petite boucle joue à un tempo qui suit l'affinité, de lente et triste à rapide et joyeuse. Le gros cœur bat sur chaque temps et les Mii rebondissent dessus.

### v1.2
- **De la musique** : une petite boîte à musique accompagne le comptage, et sa mélodie monte avec le score. Elle passe en trémolo nerveux quand le compteur hésite. Le jingle de fin dépend du résultat : de la fanfare du coup de foudre au trombone raté sous 15 %. Tout est généré avec Web Audio.
- **Des bulles de réaction** : après le résultat, chaque Mii dit une petite phrase au-dessus de sa tête, selon le score et le mode (« … », « Hmph ! », « Mon âme sœur ! »). Au-delà de 90 %, des cœurs ou des étoiles s'envolent. Les bulles suivent les Mii et restent dans l'écran.
- **Des Mii vivants au repos** : en attendant le test, ils prennent des poses, changent d'expression, te regardent ou sautillent. Pendant le comptage, ils regardent le score.
- **Correctif** : cliquer sur Amour ou Amitié ne lance plus le test, ça remet juste l'écran en attente.
- Les fichiers du jour sont versionnés (`?v=…`) pour ne jamais afficher une ancienne version gardée en cache.

### v1.1
- **Entrée en scène** : à chaque test, les deux Mii arrivent chacun de son bord de l'écran en trottinant, puis se tournent l'un vers l'autre, comme dans Tomodachi Life.
- **Un compteur qui hésite** : le pourcentage dépasse le vrai score, redescend, hésite, puis s'arrête. Pour un très mauvais score, il monte bien haut avant de s'effondrer.
- **Des scores plus extrêmes** : avant, les résultats restaient presque toujours entre 30 et 89 %. Le score est maintenant étiré par une courbe qui le pousse vers les extrêmes. Environ un couple sur cinq tombe sous 20 %, et presque autant dépasse 80 %.

### v1.0
- Première version : la 3DS, les Mii en 3D (FFL.js + corps Wii U), le Mii Maker, le battement de cœur, la capture de l'écran du haut.

## Crédits et licences

- `lib/ffl/` : FFL.js par ariankordi, sous licence AGPL-3.0 (voir `lib/ffl/LICENSE`).
- `assets/FFLResHigh.dat` et `assets/miiBody*_wiiu.glb` : ressources Mii de **Nintendo** (tête et corps), reprises de Mii Creator. Elles ne sont pas sous licence libre.
- Mii et Tomodachi Life sont des marques de Nintendo. Ceci est un projet de fan, non officiel.
