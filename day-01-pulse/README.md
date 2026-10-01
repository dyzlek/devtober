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

## Crédits et licences

- `lib/ffl/` : FFL.js par ariankordi, sous licence AGPL-3.0 (voir `lib/ffl/LICENSE`).
- `assets/FFLResHigh.dat` et `assets/miiBody*_wiiu.glb` : ressources Mii de **Nintendo** (tête et corps), reprises de Mii Creator. Elles ne sont pas sous licence libre.
- Mii et Tomodachi Life sont des marques de Nintendo. Ceci est un projet de fan, non officiel.
