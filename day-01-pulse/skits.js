// Les petites scènes du résultat, une par palier de 10 %, façon Tomodachi Life.
// Chaque scène dit, à chaque image et pour chaque Mii, où il se tient et ce qu'il fait :
//   x     : distance au centre de l'écran (le Mii de gauche est à −x, celui de droite à +x)
//   turn  : orientation (0 = face à nous, π/2 = face à l'autre, −π/2 = dos à l'autre)
//   y     : saut ; lean : penché vers l'autre ; shake : tremble de colère
//   pose  : animation du corps ; expr : expression du visage
//   arms  : { l: [avant, bas, coude, avant-bras levé], r: [...] } bras gauche / droit du Mii (en radians)
//   z     : décalage avant/arrière (le Mii de gauche avance de −z, celui de droite recule d'autant)
//   snap  : déplacement immédiat (sinon le Mii glisse doucement vers sa place)
//   event : 'clap' quand deux mains se tapent (son + étoile)

const P2 = Math.PI / 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const between = (v, a, b) => v >= a && v < b;
// bras croisés, bras qui pendent, bras levé
const CROSSED = [1.45, 0.75, 1.7];
const RAISED = [0.2, -0.45, 0.1, -0.9];

export const SKITS = [
  /* 0 à 9 % : l'un repousse l'autre, qui vole en arrière */
  {
    name: { amour: 'Le grand rejet', amitie: 'La bagarre' },
    update(i, t) {
      const p = t % 8;
      if (i === 1) {   // celui qui pousse (à droite)
        if (p < 0.9) return { x: 4.6, turn: P2, expr: 'ANGER', shake: 0.6 };
        if (p < 1.3) return { x: 3.4, turn: P2, expr: 'ANGER_OPEN_MOUTH', arms: { l: [1.35, 0.15, 0.1], r: [1.35, 0.15, 0.1] }, event: p < 1.05 ? 'push' : null };
        if (p < 6.6) return { x: 4.6, turn: p < 2.6 ? P2 : -P2 + 0.3, expr: 'ANGER', arms: { l: CROSSED, r: CROSSED } };
        return { x: 4.6, turn: P2, expr: 'ANGER' };
      }
      // celui qui est poussé (à gauche)
      if (p < 1.0) return { x: 4.6, turn: P2, expr: 'ANGER', shake: 0.4 };
      if (p < 1.6) {
        const k = (p - 1.0) / 0.6;
        return { x: lerp(4.6, 9, k), y: Math.sin(k * Math.PI) * 2.2, turn: P2, expr: 'SURPRISE_OPEN_MOUTH', snap: true, arms: { l: RAISED, r: RAISED } };
      }
      if (p < 4.6) return { x: 9, turn: P2 - 0.5, expr: p < 2.8 ? 'SORROW' : 'ANGER', lean: -0.12, snap: true, arms: { l: [0.6, 0.6, 0.4], r: [0.6, 0.6, 0.4] } };   // sonné
      if (p < 6.6) return { x: 9, turn: P2, expr: 'ANGER_OPEN_MOUTH', shake: 0.8, arms: { r: [0.5, -0.2, 0.2, -1.6 + Math.sin(t * 16) * 0.35] } };
      return { x: 4.6, turn: P2, expr: 'ANGER' };
    },
  },

  /* 10 à 19 % : dos à dos, bras croisés, et un « hmph » de temps en temps */
  {
    name: { amour: 'Dos à dos', amitie: 'Dos à dos' },
    update(i, t) {
      const p = (t + i * 1.6) % 3.4;
      const glance = between(p, 2.2, 2.9);   // un petit regard par-dessus l'épaule… et on se retourne
      return {
        x: 7.2, turn: glance ? -0.4 : -P2, expr: glance ? 'ANGER_OPEN_MOUTH' : 'ANGER',
        shake: glance ? 0.5 : 0.15, arms: { l: CROSSED, r: CROSSED },
      };
    },
  },

  /* 20 à 29 % : l'un boude, l'autre vient s'excuser… et repart en haussant les épaules */
  {
    name: { amour: 'La bouderie', amitie: 'La bouderie' },
    update(i, t) {
      const p = t % 7;
      if (i === 0) return { x: 4.2, turn: -P2 - 0.25, expr: 'SORROW', arms: { l: CROSSED, r: CROSSED }, shake: between(p, 2.4, 3.6) ? 0.3 : 0 };
      if (p < 2) return { x: lerp(8.6, 4.4, smooth(0, 2, p)), turn: P2, expr: 'SMILE', y: Math.abs(Math.sin(p * 7)) * 0.2 * (p < 1.9 ? 1 : 0), snap: true };
      if (p < 3.6) return { x: 4.4, turn: P2, expr: 'NORMAL', arms: { l: [1.25, 0.35 + Math.sin(t * 12) * 0.12, 0.3] } };   // tape sur l'épaule
      if (p < 4.8) return { x: 4.4, turn: 0.3, expr: 'SORROW', arms: { l: [0.5, 0.25, 0.9], r: [0.5, 0.25, 0.9] } };          // haussement d'épaules
      const k = smooth(4.8, 6.8, p);
      return { x: lerp(4.4, 8.6, k), turn: -P2 + 0.2, expr: 'SORROW', y: Math.abs(Math.sin(p * 7)) * 0.18 * (k < 1 ? 1 : 0), snap: true };
    },
  },

  /* 30 à 39 % : le malaise : on se regarde, on détourne les yeux, on se gratte la tête */
  {
    name: { amour: 'Le malaise', amitie: 'Le malaise' },
    update(i, t) {
      const p = t % 5.4;
      const look = (i === 0 && between(p, 0.4, 1.1)) || (i === 1 && between(p, 1.3, 2.0)) || between(p, 3.2, 3.6);
      const away = between(p, 3.6, 4.6);
      const o = { x: 6.6, turn: look ? P2 * 0.85 : away ? -0.7 : 0.12, expr: between(p, 3.2, 3.6) ? 'SURPRISE_OPEN_MOUTH' : look ? 'NORMAL' : 'SORROW' };
      if (i === 1 && between(p, 2.1, 3.1)) o.arms = { r: [0.5, -0.35, 0.3, -2.1 + Math.sin(t * 18) * 0.2] };   // se gratte la tête
      if (i === 0 && between(p, 4.6, 5.4)) o.arms = { l: [0.9, 0.9, 1.4], r: [0.9, 0.9, 1.4] };             // tripote ses mains
      return o;
    },
  },

  /* 40 à 49 % : une poignée de main polie */
  {
    name: { amour: 'Poignée de main', amitie: 'Poignée de main' },
    update(i, t) {
      const p = t % 5.5;
      if (p < 1.2) return { x: lerp(6, 4.4, smooth(0, 1.2, p)), turn: P2, expr: 'NORMAL' };
      if (p < 3.4) {
        const reach = smooth(1.2, 1.6, p);
        const pump = between(p, 1.6, 3.2) ? Math.sin((p - 1.6) * 13) * 0.14 : 0;
        return { x: 4.4, turn: P2, expr: 'SMILE', arms: { r: [lerp(0.2, 1.25, reach), lerp(1.1, 0.55, reach) + pump, 0.2] } };
      }
      if (p < 4.3) return { x: 4.4, turn: P2, expr: 'NORMAL', lean: -0.18 * Math.sin(((p - 3.4) / 0.9) * Math.PI) };   // petit salut
      return { x: lerp(4.4, 6, smooth(4.3, 5.5, p)), turn: P2, expr: 'NORMAL' };
    },
  },

  /* 50 à 59 % : coucou ! chacun fait signe à l'autre */
  {
    name: { amour: 'Coucou !', amitie: 'Coucou !' },
    update(i, t) {
      const p = t % 3.6;
      const waving = i === 0 ? between(p, 0, 1.8) : between(p, 1.0, 2.8);
      const o = { x: 6.4, turn: 0.55, expr: waving ? 'HAPPY' : 'SMILE', y: waving && p % 1.8 < 0.3 ? Math.sin((p % 1.8) / 0.3 * Math.PI) * 0.3 : 0 };
      // on fait signe avec le bras du côté de l'autre
      const arm = [0.25, -0.35, 0, -1.5 + Math.sin(t * 11) * 0.45];
      if (waving) o.arms = i === 0 ? { l: arm } : { r: arm };
      return o;
    },
  },

  /* 60 à 69 % : on se tape dans la main (avec un petit saut) */
  {
    name: { amour: 'Tape là !', amitie: 'Tape là !' },
    update(i, t) {
      const p = t % 2.8;
      const x = p < 0.8 ? lerp(6, 4.3, smooth(0, 0.8, p)) : p < 1.7 ? 4.3 : lerp(4.3, 6, smooth(1.7, 2.6, p));
      const jump = between(p, 0.75, 1.35) ? Math.sin(((p - 0.75) / 0.6) * Math.PI) * 0.8 : 0;
      const up = smooth(0.5, 0.8, p) * (1 - smooth(1.4, 1.7, p));
      const arm = [lerp(0.3, 1.1, up), lerp(1.15, -0.5, up), 0, lerp(0, -0.6, up)];
      return {
        x, y: jump, turn: P2, snap: true, expr: p > 0.8 && p < 2.2 ? 'HAPPY' : 'SMILE',
        // le bras « de devant » (celui qui est vers nous) : le droit pour le Mii de gauche, le gauche pour l'autre
        arms: i === 0 ? { r: arm } : { l: arm },
        event: i === 0 && between(p, 1.0, 1.06) ? 'clap' : null,
      };
    },
  },

  /* 70 à 79 % : on danse ensemble, en rythme */
  {
    name: { amour: 'La danse', amitie: 'La danse' },
    bounce: 0.35,
    update(i, t) {
      const moves = ['Pose.05', 'Pose.01', 'Pose.04', 'Pose.03'];
      const bar = Math.floor(t / 1.7);
      return {
        x: 6.2, turn: 0.25 + Math.sin(t * 3.7) * 0.35, y: Math.abs(Math.sin(t * 3.7)) * 0.2,
        lean: Math.sin(t * 3.7 + i) * 0.08, pose: moves[bar % moves.length], expr: bar % 2 ? 'HAPPY' : 'SMILE',
      };
    },
  },

  /* 80 à 89 % : main dans la main, on se balance */
  {
    name: { amour: 'Main dans la main', amitie: 'Côte à côte' },
    update(i, t) {
      const swing = Math.sin(t * 2.6);
      // le bras « intérieur » (vers l'autre) : le gauche pour le Mii de gauche, le droit pour l'autre
      // (réglé pour que les deux mains se rejoignent vraiment)
      const inner = [0.15 + swing * 0.25, 0.8, 0.3];
      return {
        x: 3.8, turn: 0.22, lean: 0.01 * swing, y: Math.abs(Math.sin(t * 2.6)) * 0.08,
        expr: Math.floor(t / 2.2) % 3 === 2 ? 'LIKE' : 'HAPPY',
        arms: i === 0 ? { l: inner } : { r: inner },
      };
    },
  },

  /* 90 à 100 % : on court l'un vers l'autre… et câlin */
  {
    name: { amour: 'Le câlin', amitie: "L'accolade" },
    update(i, t, md) {
      if (t < 0.9) {
        const k = smooth(0, 0.9, t);
        return { x: lerp(6.5, 3.1, k), z: -2.4 * k, turn: P2 - 0.7 * k, y: Math.abs(Math.sin(t * 9)) * 0.3, snap: true, expr: 'HAPPY', arms: { l: [1.1, 0.2, 0.3], r: [1.1, 0.2, 0.3] } };
      }
      const pat = md === 'amitie' ? Math.max(0, Math.sin(t * 10)) * 0.5 : 0;   // tapes dans le dos entre amis
      const hug = [1.35, 0.25, 0.9 + pat];
      return {
        x: 3.1, z: -2.4, turn: P2 - 0.75, lean: 0.03 + Math.sin(t * 2) * 0.03, y: 0,
        expr: md === 'amour' ? 'LIKE' : 'HAPPY', arms: { l: hug, r: hug },
      };
    },
  },
];

/** La scène d'un score (0 à 100). */
export const skitFor = (score) => SKITS[Math.min(9, Math.floor(score / 10))];
