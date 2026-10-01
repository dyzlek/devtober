# Jour 02 · Loop · Téléphone traduit

Deux expériences pour ce jour : **Téléphone traduit**, ci-dessous, et **[Ludo des Mii](ludo/)**, un jeu de société pour un joueur et trois bots. Le sélecteur en haut de la page permet de passer de l’une à l’autre.

Le téléphone arabe, version traducteurs automatiques. Tu écris une phrase en français, elle fait le tour des langues de ta boucle (français → anglais → japonais → russe → arabe → français), et elle revient… pas tout à fait pareille.

## Le lien avec « Loop »

- La phrase suit littéralement une **boucle** : les langues sont posées en cercle, reliées par des flèches, et la traduction revient toujours au point de départ.
- **Encore un tour** relance la boucle avec la phrase déjà déformée. On voit la dérive s'accumuler tour après tour, avec un score de « fidélité » à la phrase d'origine.
- C'est toi qui construis la boucle : clique sur une langue du bac pour l'ajouter, clique sur une langue de la boucle pour la renvoyer dans le bac, ou glisse-les pour choisir leur place.

## Comment c'est codé

HTML, CSS et JS, sans librairie ([`app.js`](app.js)).

- **Ajouter, retirer, réordonner** : au clic, la langue change de place. Au glisser, la position d'insertion est déduite de l'angle du curseur autour du centre. Les déplacements sont animés avec la technique FLIP : on mesure avant et après, puis on anime l'écart.
- **La traduction** passe par une cascade de moteurs gratuits, appelés directement depuis le navigateur du visiteur. Il n'y a ni serveur ni clé, donc ça marche sur GitHub Pages. Pour chaque étape, on essaie dans l'ordre :
  1. **Chrome** : la traduction intégrée au navigateur (Translator API), illimitée et calculée sur l'appareil, utilisée seulement si le modèle de langue est déjà installé ;
  2. **Google Traduction**, par son adresse publique non officielle ;
  3. **MyMemory** : 5 000 mots par jour et par visiteur.

  Si un moteur échoue, met plus de 7 secondes, ou renvoie la phrase sans l'avoir traduite, le suivant prend le relais. Chaque puce indique en petit le moteur qui a fait sa traduction.
- **L'animation** : la flèche en cours devient orange et ses tirets défilent dans le sens du voyage, pendant que la traduction arrive.
- **Responsive** : sur grand écran, les langues sont posées sur une ellipse qui grandit avec leur nombre. Sur téléphone, la boucle devient une piste en deux colonnes (on descend à droite, on remonte à gauche), et le résultat s'affiche en dessous. Les flèches sont des courbes calculées d'une puce à la suivante, et elles s'arrêtent avant de toucher les bords.
- **La fidélité** compte la part des mots de la phrase d'origine qui ont survécu au voyage.
- **La sauvegarde** : ta boucle est gardée dans le `localStorage`.
