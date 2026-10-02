/* =========================================================
   Cobalt Création — le mouvement.

   Construit sur Motion (motion.dev), servi depuis assets/vendor :
   la page ne fait aucune requête externe.

   Une règle partout : chaque animation dit quelque chose. Elle
   montre une structure, un état, ou rend un chiffre lisible.
   Sans ce fichier, tout le contenu est là, à sa place.
   ========================================================= */
(() => {
'use strict';

const M = window.Motion;
const doc = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
const tactile = !fine;
const large = () => matchMedia('(min-width: 1001px)').matches;
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lisse = t => t * t * (3 - 2 * t);

/* Des ressorts nommés par intention, réglés une fois, réutilisés partout. */
const POSE   = { type: 'spring', stiffness: 190, damping: 26, mass: 0.9 };  // arrive et s'arrête
const PORTE  = { type: 'spring', stiffness: 320, damping: 34, mass: 0.7 };  // ouvre, ferme, net
const DERIVE = { type: 'spring', stiffness: 90,  damping: 22, mass: 1.1 };  // lent, pesant
const RIDEAU = [0.76, 0, 0.24, 1];
const TRACE  = [0.35, 0, 0.15, 1];

/* L'observation remonte du bas de l'écran : la révélation se joue là
   où l'œil se trouve, pas un écran plus bas où personne ne regarde. */
const IN = { amount: 0.1, margin: '0px 0px -16% 0px' };
const cascade = n => Math.max(0.045, Math.min(0.11, 0.6 / n));

const accueil = document.body.classList.contains('accueil');
let rail = null;
const racine = accueil ? '' : '../';

/* =========================================================
   CE QUI MARCHE SANS BIBLIOTHÈQUE
   ========================================================= */

/* ---- La barre ---------------------------------------------------------- */
const nav = $('#nav'), hero = $('#hero');
let heroPasse = !hero;

const majNav = () => {
  if (!nav) return;
  nav.classList.toggle('montre', heroPasse || nav.classList.contains('menu-ouvert'));
};
if (nav && hero && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => {
    heroPasse = !e.isIntersecting;
    majNav();
    if (rail) rail.classList.toggle('montre', heroPasse);
  }, { threshold: 0 }).observe(hero);
} else if (nav) nav.classList.add('montre');

/* La barre prend la couleur du sol qui passe dessous. */
const nuits = $$('.nuit');
let navQ = false;
const sol = () => {
  navQ = false;
  if (!nav) return;
  const y = nav.offsetHeight / 2;
  let n = false;
  for (const s of nuits) {
    const r = s.getBoundingClientRect();
    if (r.top <= y && r.bottom >= y) { n = true; break; }
  }
  nav.classList.toggle('sur-nuit', n);
};
addEventListener('scroll', () => { if (!navQ) { navQ = true; requestAnimationFrame(sol); } }, { passive: true });
sol();

/* ---- Le menu plein écran ----------------------------------------------- */
const btnMenu = $('.nav-menu'), menu = $('#rideau-menu');
if (btnMenu && menu) {
  let ouvert = false;
  const ouvrir = () => {
    ouvert = true;
    menu.hidden = false;
    btnMenu.setAttribute('aria-expanded', 'true');
    $('.nav-menu-txt', btnMenu).textContent = 'Fermer';
    nav.classList.add('menu-ouvert');
    majNav();
    document.body.style.overflow = 'hidden';
    if (M && !reduce) {
      M.animate(menu, { clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 0.8, ease: RIDEAU });
      M.animate($$('li > a', menu), { y: ['110%', '0%'] }, { ...POSE, delay: M.stagger(0.05, { startDelay: 0.28 }) });
      M.animate($('.rideau-menu-pied', menu), { opacity: [0, 1] }, { duration: 0.6, delay: 0.6 });
    }
  };
  const fermer = (vite) => {
    if (!ouvert) return;
    ouvert = false;
    btnMenu.setAttribute('aria-expanded', 'false');
    $('.nav-menu-txt', btnMenu).textContent = 'Menu';
    document.body.style.overflow = '';
    const fin = () => { menu.hidden = true; nav.classList.remove('menu-ouvert'); majNav(); sol(); };
    if (M && !reduce && !vite) {
      M.animate(menu, { clipPath: ['inset(0% 0% 0% 0%)', 'inset(0% 0% 100% 0%)'] }, { duration: 0.6, ease: RIDEAU })
        .finished.then(fin).catch(fin);
    } else fin();
  };
  btnMenu.addEventListener('click', () => (ouvert ? fermer() : ouvrir()));
  $$('a', menu).forEach(a => a.addEventListener('click', () => fermer(true)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && ouvert) { fermer(); btnMenu.focus(); } });
  matchMedia('(min-width: 1081px)').addEventListener('change', e => { if (e.matches) fermer(true); });
}

/* ---- Le formulaire -----------------------------------------------------
   Il n'y a pas de serveur derrière ce fichier : on valide, puis on
   passe la main au client de messagerie. Le jour où un point d'envoi
   existe, seule la dernière ligne change. */
(() => {
  const form = $('.form'); if (!form) return;
  const email = $('#f-email'), erreur = $('#err-email'), etat = $('#etat-form');
  const bouton = $('.envoi', form);
  const val = id => (($('#' + id) || {}).value || '').trim();
  const ok = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  const marquer = bon => {
    email.closest('.champ').classList.toggle('invalide', !bon);
    erreur.hidden = bon;
    email.setAttribute('aria-invalid', bon ? 'false' : 'true');
  };
  email.addEventListener('blur', () => { if (email.value.trim()) marquer(ok(email.value)); });
  email.addEventListener('input', () => { if (!erreur.hidden && ok(email.value)) marquer(true); });

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!ok(email.value)) {
      marquer(false);
      email.focus();
      if (M && !reduce) M.animate(email.closest('.champ'), { x: [0, -6, 5, -3, 0] }, { duration: 0.36 });
      return;
    }
    marquer(true);
    const prenom = val('f-prenom'), nom = val('f-nom'), maison = val('f-maison');
    const corps = 'Prénom : ' + prenom + '\nNom : ' + nom +
      (maison ? '\nMaison : ' + maison : '') +
      '\nEmail : ' + email.value.trim() + '\n\n' + val('f-message');
    bouton.disabled = true;
    etat.hidden = false;
    etat.textContent = 'Votre message s’ouvre dans votre messagerie.';
    if (M && !reduce) M.animate(etat, { opacity: [0, 1], y: [8, 0] }, POSE);
    location.href = 'mailto:contact@cobaltcreation.com' +
      '?subject=' + encodeURIComponent('Projet : ' + ((maison || (prenom + ' ' + nom)).trim())) +
      '&body=' + encodeURIComponent(corps);
    setTimeout(() => { bouton.disabled = false; }, 2500);
  });
})();

/* =========================================================
   À PARTIR D'ICI, LE MOUVEMENT
   ========================================================= */
if (!M) { doc.classList.remove('ouverture'); return; }

/* Tout ce qu'on cache pour le faire revenir est inscrit ici. Si un
   observateur ne se déclenche jamais, le filet le rend quand même :
   aucun contenu n'est perdu au profit du mouvement.
   Le filet ne regarde que ce qui a déjà atteint l'écran : rendre d'un
   coup ce qui est encore trois écrans plus bas gâcherait son entrée. */
const secours = new Map();
const vuDepuis = new WeakMap();
const surveiller = (el, remettre) => { secours.set(el, remettre); armer(); };
const cacher = el => { el.style.opacity = '0'; surveiller(el, () => { el.style.opacity = ''; }); };
const montre = els => { for (const el of [].concat(els)) secours.delete(el); };
let ronde = 0;
const armer = () => {
  if (ronde) return;
  ronde = setInterval(() => {
    if (!secours.size) { clearInterval(ronde); ronde = 0; return; }
    const t = performance.now();
    for (const [el, remettre] of secours) {
      if (el.getBoundingClientRect().top >= innerHeight) continue;
      if (!vuDepuis.has(el)) { vuDepuis.set(el, t); continue; }
      if (t - vuDepuis.get(el) > 1400) { remettre(); secours.delete(el); }
    }
  }, 500);
};

/* ---- 0. L'ouverture ----------------------------------------------------
   Une fois par séance : le logotype, la goutte d'or étirée en filet,
   puis le rideau se lève sur le film. Deux secondes, pas une de plus. */
(() => {
  if (!doc.classList.contains('ouverture')) return;
  try { sessionStorage.setItem('cc-ouverture', '1'); } catch (e) { /* navigation privée */ }
  const r = document.createElement('div');
  r.className = 'rideau';
  r.setAttribute('aria-hidden', 'true');
  r.innerHTML = '<img src="' + racine + 'assets/img/logo-cobalt-creme.png" alt="" width="653" height="337"><i></i>';
  document.body.append(r);
  doc.classList.remove('ouverture');
  const img = $('img', r), filet = $('i', r);
  M.animate(img, { opacity: [0, 1], y: [16, 0] }, { duration: 0.9, delay: 0.1, ease: [0.22, 0.61, 0.24, 1] });
  M.animate(filet, { scaleX: [0, 1] }, { duration: 1.1, delay: 0.35, ease: TRACE });
  M.animate([img, filet], { opacity: 0, y: -30 }, { duration: 0.55, delay: 1.45, ease: RIDEAU });
  M.animate(r, { clipPath: ['inset(0% 0% 0% 0%)', 'inset(0% 0% 100% 0%)'] },
    { duration: 1.0, delay: 1.55, ease: RIDEAU })
    .finished.then(() => r.remove()).catch(() => r.remove());
})();

/* ---- 1. Le mot qui monte de sa ligne -----------------------------------
   Chaque mot est enveloppé au moment voulu ; le balisage servi reste
   une phrase propre, celle que lisent un robot et un lecteur d'écran. */
const decouper = el => {
  const textes = [];
  (function marche(n) {
    for (const c of n.childNodes) {
      if (c.nodeType === 3 && c.nodeValue.trim()) textes.push(c);
      else if (c.nodeType === 1 && c.tagName !== 'BR') marche(c);
    }
  })(el);
  const mots = [];
  for (const t of textes) {
    const frag = document.createDocumentFragment();
    for (const part of t.nodeValue.split(/(\s+)/)) {
      if (!part) continue;
      if (!part.trim()) { frag.append(part); continue; }
      const wm = document.createElement('span'); wm.className = 'wm';
      const w = document.createElement('i'); w.textContent = part;
      w.style.transform = 'translateY(110%)';
      wm.append(w); frag.append(wm); mots.push(w);
    }
    t.replaceWith(frag);
  }
  return mots;
};
const PAS_MOT = 0.07;
const lever = (mots, delai = 0) => {
  M.animate(mots, { transform: ['translateY(110%)', 'translateY(0%)'] },
    { ...POSE, delay: M.stagger(PAS_MOT, { startDelay: delai }) });
  setTimeout(() => { for (const w of mots) if (w.style.transform.includes('110')) w.style.transform = ''; },
    (delai + PAS_MOT * mots.length) * 1000 + 1200);
};

/* ---- 2. L'ouverture de section -----------------------------------------
   Chaque section s'ouvre de la même façon, dans le même ordre : le filet
   se trace avec une goutte d'or à sa pointe, puis l'index, le titre qui
   monte mot à mot, le chapeau. C'est la répétition qui fait de sept
   sections un seul document. */
(() => {
  if (reduce) return;
  for (const tete of $$('.sec-head')) {
    const filet = $('.sec-rule', tete), idx = $('.idx', tete);
    const titre = $('h1, h2', tete), lede = $('.lede, .compte', tete);
    if (filet) { filet.style.width = '0%'; surveiller(filet, () => { filet.style.width = ''; }); }
    for (const el of [idx, lede]) if (el) cacher(el);
    const mots = titre ? decouper(titre) : [];
    if (titre) surveiller(titre, () => { for (const w of mots) w.style.transform = ''; });
    M.inView(tete, () => {
      montre([filet, titre].filter(Boolean));
      if (filet) {
        filet.classList.add('trace');
        M.animate(filet, { width: ['0%', '100%'] }, { duration: 0.9, ease: TRACE })
          .finished.then(() => filet.classList.remove('trace')).catch(() => {});
      }
      if (idx)  { montre(idx);  M.animate(idx, { opacity: [0, 1], x: [-12, 0] }, { ...POSE, delay: 0.18 }); }
      if (mots.length) lever(mots, 0.3);
      if (lede) { montre(lede); M.animate(lede, { opacity: [0, 1], y: [16, 0] }, { ...POSE, delay: 0.62 }); }
      return false;
    }, { amount: 0.3 });
  }
})();

/* ---- 3. Les entrées ----------------------------------------------------
   Le pas est tiré du nombre d'éléments : un groupe de quatre et un groupe
   de vingt se résolvent dans le même temps. */
(() => {
  if (reduce) return;
  const groupes = ['.chiffres > div', '.pole', '.etapes > li', '.metiers-liste > li',
    '.coord > p', '.form > *', '.pied-grille > *', '.equipe .pole-bloc', '.texte-legal > *'];
  const seuls = ['.maison-txt', '.vers-tout', '.lampe figcaption', '.galerie-bas', '.page-tete .compte', '.suite', '.equipe-titre'];
  const venir = (els, o) => M.animate(els, { opacity: [0, 1], y: [22, 0] }, o);
  for (const sel of groupes) {
    const els = $$(sel); if (!els.length) continue;
    const parents = new Map();
    for (const el of els) {
      const p = el.parentElement;
      if (!parents.has(p)) parents.set(p, []);
      parents.get(p).push(el);
    }
    for (const [p, lot] of parents) {
      lot.forEach(cacher);
      M.inView(p, () => { montre(lot); venir(lot, { ...POSE, delay: M.stagger(cascade(lot.length)) }); return false; }, IN);
    }
  }
  for (const sel of seuls) for (const el of $$(sel)) {
    cacher(el);
    M.inView(el, () => { montre(el); venir(el, POSE); return false; }, IN);
  }

  /* les gestes : l'opacité de la ligne appartient au survol, on ne fait
     entrer que ce qu'elle contient — deux écrivains sur une propriété,
     c'est un élément coincé à moitié visible */
  const lignes = $$('.geste');
  if (lignes.length) {
    const parts = lignes.map(li => [$('.geste-num', li), $('h3', li), $('.geste-detail', li)]);
    parts.flat().forEach(cacher);
    M.inView($('.gestes-liste'), () => {
      parts.forEach((p, i) => { montre(p); M.animate(p, { opacity: [0, 1], y: [26, 0] }, { ...POSE, delay: i * 0.07 + 0.1 }); });
      return false;
    }, IN);
  }
})();

/* ---- 4. Les images se dévoilent ----------------------------------------
   Un rideau qui remonte, et l'image qui se pose dessous en reculant :
   on ne voit pas une image apparaître, on la découvre. */
(() => {
  if (reduce) return;
  const cadres = $$('.devoile, .gestes-fenetre, .lampe-plaque, .piece-img');
  for (const c of cadres) {
    c.style.clipPath = 'inset(100% 0% 0% 0%)';
    surveiller(c, () => { c.style.clipPath = ''; });
    const img = $('img', c);
    // on observe le parent : un élément entièrement rogné ne compte, pour
    // l'observateur, comme visible nulle part, et son entrée ne viendrait jamais
    M.inView(c.parentElement, () => {
      montre(c);
      M.animate(c, { clipPath: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 1.2, ease: RIDEAU });
      if (img && !c.classList.contains('gestes-fenetre')) M.animate(img, { scale: [1.22, 1] }, { duration: 1.8, ease: [0.22, 0.61, 0.24, 1] });
      return false;
    }, { amount: 0.15 });
  }
})();

/* ---- 5. Les compteurs --------------------------------------------------
   La bonne valeur est déjà dans le HTML ; on ne rejoue que l'approche. */
(() => {
  if (reduce) return;
  for (const el of $$('[data-compte]')) {
    const fin = +el.dataset.compte;
    M.inView(el, () => {
      M.animate(0, fin, {
        duration: 1.6, ease: [0.22, 0.61, 0.24, 1],
        onUpdate: v => { el.textContent = Math.round(v); },
        onComplete: () => { el.textContent = fin; }
      });
      return false;
    }, { amount: 0.6 });
  }
})();

/* ---- 6. Le manifeste se lit sous le doigt -------------------------------
   Les mots s'allument au rythme du défilement : la phrase se lit à la
   vitesse où on la lit. */
(() => {
  const p = $('[data-lecture]'); if (!p || reduce || !M.scroll) return;
  const mots = [];
  const textes = [];
  (function marche(n) {
    for (const c of n.childNodes) {
      if (c.nodeType === 3 && c.nodeValue.trim()) textes.push(c);
      else if (c.nodeType === 1) marche(c);
    }
  })(p);
  for (const t of textes) {
    const frag = document.createDocumentFragment();
    for (const part of t.nodeValue.split(/(\s+)/)) {
      if (!part) continue;
      if (!part.trim()) { frag.append(part); continue; }
      const s = document.createElement('span'); s.className = 'lu'; s.textContent = part;
      s.style.opacity = '0.14';
      frag.append(s); mots.push(s);
    }
    t.replaceWith(frag);
  }
  const vus = new Float32Array(mots.length).fill(0.14);
  M.scroll(v => {
    const k = v * (mots.length + 2);
    for (let i = 0; i < mots.length; i++) {
      const o = 0.14 + 0.86 * lisse(clamp(k - i, 0, 1));
      if (Math.abs(o - vus[i]) > 0.01) { vus[i] = o; mots[i].style.opacity = o.toFixed(3); }
    }
  }, { target: p, offset: ['start 82%', 'end 42%'] });
})();

/* ---- 7. Le ruban des maisons -------------------------------------------
   Il dérive seul, accélère avec le défilement et en prend le sens. Au
   survol, il ralentit jusqu'à s'arrêter sur le nom qu'on regarde. */
(() => {
  const piste = $('.ruban-piste'); if (!piste || reduce) return;
  piste.classList.add('pilote');
  let x = 0, vit = 0, sens = 1, base = 46, cible = 46, dernier = 0, actif = false, yPrec = scrollY, moitie = 0;
  const mesure = () => { moitie = piste.scrollWidth / 2; };
  addEventListener('scroll', () => {
    const dy = scrollY - yPrec; yPrec = scrollY;
    if (dy) sens = dy > 0 ? 1 : -1;
    vit = Math.min(1400, vit + Math.abs(dy) * 7);
  }, { passive: true });
  const fen = $('.ruban-fenetre');
  fen.addEventListener('pointerenter', () => { cible = 0; });
  fen.addEventListener('pointerleave', () => { cible = 46; });
  const pas = t => {
    if (!actif) return;
    const dt = Math.min(64, t - (dernier || t)) / 1000; dernier = t;
    base += (cible - base) * Math.min(1, dt * 4);
    vit *= Math.pow(0.04, dt);
    x -= (base + (cible ? vit : 0)) * sens * dt;
    if (!moitie) mesure();
    if (x <= -moitie) x += moitie;
    if (x > 0) x -= moitie;
    piste.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
    requestAnimationFrame(pas);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !actif) { actif = true; dernier = 0; requestAnimationFrame(pas); }
    else if (!e.isIntersecting) actif = false;
  }).observe(fen);
  addEventListener('resize', mesure);
  if (document.fonts) document.fonts.ready.then(mesure).catch(() => {});
})();

/* ---- 8. Les gestes ------------------------------------------------------
   Le cadre reste en place ; le geste qui passe au milieu de l'écran
   prend la lumière, et son image monte par-dessus la précédente. */
(() => {
  const sec = $('.gestes'); if (!sec) return;
  const lignes = $$('.geste', sec), imgs = $$('.gestes-fenetre img', sec), n = $('.gestes-n', sec);
  if (!lignes.length || imgs.length !== lignes.length) return;
  const chiffres = lignes.map(li => $('.geste-num', li).textContent);
  let actif = 0, z = 3, tenu = false, vivant = false, q = false;

  const choisir = i => {
    if (i === actif || i < 0) return;
    lignes[actif].classList.remove('actif');
    lignes[i].classList.add('actif');
    actif = i;
    const img = imgs[i];
    img.style.zIndex = ++z;
    if (!reduce) {
      M.animate(img, { clipPath: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 0.95, ease: RIDEAU });
      M.animate(img, { scale: [1.16, 1] }, { duration: 1.5, ease: [0.22, 0.61, 0.24, 1] });
    }
    n.textContent = chiffres[i];
    if (!reduce) M.animate(n, { opacity: [0, 1], y: [8, 0] }, POSE);
  };

  const milieu = () => {
    q = false;
    if (!vivant || tenu) return;
    // au téléphone, la ligne de lecture se tient sous le cadre qui colle en haut
    const bas = large() ? 0 : $('.gestes-cadre', sec).getBoundingClientRect().bottom;
    const c = large() ? innerHeight * 0.5 : bas + (innerHeight - bas) * 0.38;
    for (let i = 0; i < lignes.length; i++) {
      const r = lignes[i].getBoundingClientRect();
      if (r.top <= c && r.bottom > c) { choisir(i); return; }
    }
    if (lignes[0].getBoundingClientRect().top > c) choisir(0);
  };
  const appliquer = () => {
    vivant = !reduce;
    sec.classList.toggle('vivant', vivant);
    milieu();
  };
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(milieu); } }, { passive: true });
  addEventListener('resize', appliquer);
  lignes.forEach((li, i) => li.addEventListener('pointerenter', () => { if (vivant && fine && large()) { tenu = true; choisir(i); } }));
  $('.gestes-liste', sec).addEventListener('pointerleave', () => { tenu = false; milieu(); });
  appliquer();
})();

/* ---- 9. La galerie ------------------------------------------------------
   Sur grand écran, la page descend et la piste glisse. Les pièces se
   développent en passant au centre : la couleur revient à celle qu'on
   regarde. Au doigt, la galerie se feuillette et le compteur suit. */
(() => {
  const gal = $('.galerie'); if (!gal) return;
  const scene = $('.galerie-scene', gal), piste = $('.galerie-piste', gal);
  const cartes = $$('.carte', piste), photos = cartes.map(c => $('.carte-img img', c));
  const compte = $('.galerie-compte b', gal), barre = $('.galerie-barre i', gal), aide = $('.galerie-aide', gal);
  const N = cartes.filter(c => !c.classList.contains('carte-fin')).length;
  let epingle = false, dist = 0, geo = [], x = 0;

  const ecrireCompte = i => {
    const t = String(clamp(i, 1, N)).padStart(2, '0');
    if (compte.textContent !== t) {
      compte.textContent = t;
      if (!reduce) M.animate(compte, { opacity: [0.2, 1] }, { duration: 0.4 });
    }
  };

  const developper = () => {
    const c = innerWidth / 2, reach = innerWidth * 0.62;
    for (let i = 0; i < cartes.length; i++) {
      const ph = photos[i]; if (!ph) continue;
      const g = geo[i];
      const d = g.left + g.w / 2 + x - c;
      const e = lisse(clamp(1 - Math.abs(d) / reach, 0, 1));
      ph.style.filter = `grayscale(${((1 - e) * 0.85).toFixed(3)}) brightness(${(0.95 + e * 0.05).toFixed(3)})`;
      ph.style.translate = `${(-d * 0.045).toFixed(1)}px 0`;
    }
  };

  const mesurer = () => {
    epingle = !reduce && innerHeight >= 460;
    gal.classList.toggle('epingle', epingle);
    if (aide) aide.textContent = epingle ? 'Faites défiler' : 'Faites glisser';
    if (!epingle) {
      gal.style.height = '';
      piste.style.transform = '';
      photos.forEach(p => { if (p) { p.style.filter = ''; p.style.translate = ''; } });
      return;
    }
    dist = Math.max(0, piste.scrollWidth - scene.clientWidth);
    // la hauteur de la scène (100svh) et non celle de la fenêtre : sur iPhone,
    // la barre d'adresse qui se replie ne doit pas faire sauter la page
    gal.style.height = (dist + scene.clientHeight) + 'px';
    geo = cartes.map(c => ({ left: c.offsetLeft, w: c.offsetWidth }));
    developper();
  };

  if (M.scroll) M.scroll(p => {
    barre.style.transform = `scaleX(${(0.08 + 0.92 * p).toFixed(4)})`;
    // le rail s'efface pendant que la piste glisse sous lui
    if (rail) rail.classList.toggle('efface', epingle && p > 0.001 && p < 0.999);
    if (!epingle) return;
    x = -p * dist;
    piste.style.transform = `translate3d(${x.toFixed(1)}px,0,0)`;
    ecrireCompte(Math.round(p * (N - 1)) + 1);
    developper();
  }, { target: gal, offset: ['start start', 'end end'] });

  scene.addEventListener('scroll', () => {
    if (epingle) return;
    const max = scene.scrollWidth - scene.clientWidth;
    const p = max > 0 ? scene.scrollLeft / max : 0;
    barre.style.transform = `scaleX(${(0.08 + 0.92 * p).toFixed(4)})`;
    ecrireCompte(Math.round(p * (N - 1)) + 1);
  }, { passive: true });

  mesurer();
  let lw = innerWidth;
  addEventListener('resize', () => {
    // seule la largeur compte : la hauteur bouge à chaque repli de la barre d'adresse
    if (tactile && innerWidth === lw) return;
    lw = innerWidth; mesurer();
  });
  addEventListener('load', mesurer);
  if (document.fonts) document.fonts.ready.then(mesurer).catch(() => {});
})();

/* ---- 10. La lampe de l'établi -------------------------------------------
   La pièce est dans la pénombre ; la main porte la lampe. Le reflet suit
   le pointeur avec un temps de retard, et la plaque s'incline un peu :
   c'est ce qui en fait un objet et non une image. Sans pointeur, la
   lampe fait seule le tour de la pièce. */
(() => {
  const lampe = $('#lampe'); if (!lampe || reduce) return;
  const plaque = $('.lampe-plaque', lampe), lum = $('.lampe-lumiere', lampe);
  lampe.classList.add('allumee');
  lampe.style.perspective = '1400px';
  let tx = 0.62, ty = 0.34, sx = tx, sy = ty, bouge = 0, raf = 0, t0 = performance.now();

  if (fine) {
    plaque.style.cursor = 'none';                         // la lumière tient lieu de curseur
    addEventListener('pointermove', e => {
      const b = plaque.getBoundingClientRect();
      if (e.clientY < b.top - 200 || e.clientY > b.bottom + 200) return;
      tx = clamp((e.clientX - b.left) / b.width, -0.15, 1.15);
      ty = clamp((e.clientY - b.top) / b.height, -0.15, 1.15);
      bouge = performance.now();
    }, { passive: true });
  }

  if (tactile) {
    const aide = $('.lampe-aide', lampe);
    if (aide) aide.textContent = 'Touchez la pièce';
    const doigt = e => {
      const t = e.touches[0], b = plaque.getBoundingClientRect();
      tx = clamp((t.clientX - b.left) / b.width, -0.15, 1.15);
      ty = clamp((t.clientY - b.top) / b.height, -0.15, 1.15);
      bouge = performance.now();
    };
    plaque.addEventListener('touchstart', doigt, { passive: true });
    plaque.addEventListener('touchmove', doigt, { passive: true });
  }

  const image = t => {
    if (performance.now() - bouge > 2600) {               // la lampe fait sa ronde
      const s = (t - t0) / 1000;
      tx = 0.5 + 0.3 * Math.sin(s * 0.52);
      ty = 0.46 + 0.26 * Math.sin(s * 0.37 + 1.1);
    }
    sx += (tx - sx) * 0.075;
    sy += (ty - sy) * 0.075;
    const b = plaque.getBoundingClientRect();
    const R = Math.max(120, b.width * 0.36);
    const m = `radial-gradient(circle ${R.toFixed(0)}px at ${(sx * b.width).toFixed(1)}px ${(sy * b.height).toFixed(1)}px,` +
      '#000 0%,#000 42%,rgba(0,0,0,.62) 60%,rgba(0,0,0,.22) 80%,rgba(0,0,0,0) 100%)';
    lum.style.webkitMaskImage = m;
    lum.style.maskImage = m;
    plaque.style.transform = `rotateX(${((sy - 0.5) * -7).toFixed(2)}deg) rotateY(${((sx - 0.5) * 9).toFixed(2)}deg)`;
    raf = requestAnimationFrame(image);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) raf = requestAnimationFrame(image);
    else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(plaque);
})();

/* ---- 11. La méthode se trace en se lisant -------------------------------
   Un fil d'or descend le long des quatre temps ; un chiffre s'allume
   quand le fil l'a atteint. Sans ce fichier, tous sont allumés. */
(() => {
  const ol = $('.etapes'); if (!ol || reduce || !M.scroll) return;
  const ligne = document.createElement('span'); ligne.className = 'etapes-ligne';
  const fil = document.createElement('i'); ligne.append(fil); ol.append(ligne);
  ol.classList.add('vivant');
  const lis = $$(':scope > li', ol);
  M.scroll(p => {
    fil.style.transform = `scaleY(${p.toFixed(4)})`;
    const h = ol.clientHeight;
    for (const li of lis) li.classList.toggle('passe', li.offsetTop + 30 <= p * h + 40);
  }, { target: ol, offset: ['start 70%', 'end 55%'] });
})();

/* ---- 12. Les métiers : l'image suit la main -----------------------------
   Une vignette suit le pointeur avec du poids, et penche dans le sens
   où la main va. Elle change de pièce avec la ligne survolée. */
(() => {
  const liste = $('.metiers-liste'), ap = $('.apercu');
  if (!liste || !ap || !fine || reduce) return;
  const imgs = $$('img', ap);
  let mx = 0, my = 0, x = 0, y = 0, vx = 0, raf = 0, dedans = false, cur = -1;
  const suivre = () => {
    const nx = x + (mx - x) * 0.14, ny = y + (my - y) * 0.14;
    vx = nx - x; x = nx; y = ny;
    ap.style.translate = `${(x - ap.offsetWidth / 2).toFixed(1)}px ${(y - ap.offsetHeight / 2).toFixed(1)}px`;
    ap.style.rotate = `${clamp(vx * 0.35, -9, 9).toFixed(2)}deg`;
    raf = (dedans || Math.abs(mx - x) > 0.5) ? requestAnimationFrame(suivre) : 0;
  };
  addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    if (dedans && !raf) raf = requestAnimationFrame(suivre);
  }, { passive: true });
  liste.addEventListener('pointerenter', e => {
    dedans = true; x = mx = e.clientX; y = my = e.clientY;
    ap.style.visibility = 'visible';
    M.animate(ap, { opacity: [0, 1], scale: [0.55, 1] }, PORTE);
    if (!raf) raf = requestAnimationFrame(suivre);
  });
  liste.addEventListener('pointerleave', () => {
    dedans = false;
    M.animate(ap, { opacity: 0, scale: 0.6 }, { duration: 0.35, ease: RIDEAU });
    for (const a of $$('.metier-titre', liste)) M.animate(a, { x: 0 }, POSE);
  });
  for (const a of $$('.metier', liste)) {
    const i = +a.dataset.i, titre = $('.metier-titre', a);
    a.addEventListener('pointerenter', () => {
      M.animate(titre, { x: 22 }, PORTE);
      if (i === cur) return;
      cur = i;
      imgs.forEach((im, k) => {
        if (k === i) {
          im.style.zIndex = 2;
          M.animate(im, { opacity: [1, 1], clipPath: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 0.6, ease: RIDEAU });
          M.animate(im, { scale: [1.2, 1] }, { duration: 0.9, ease: [0.22, 0.61, 0.24, 1] });
        } else im.style.zIndex = 1;
      });
    });
    a.addEventListener('pointerleave', () => M.animate(titre, { x: 0 }, POSE));
  }
})();

/* ---- 12b. Les métiers, au pouce ------------------------------------------
   Sans pointeur, la ligne qui passe sous le pouce prend la lumière et son
   image monte dans la colonne qui lui est réservée : rien ne pousse rien,
   la page ne bouge pas sous le doigt. */
(() => {
  const sec = $('.metiers'); if (!sec || reduce || (fine && large())) return;
  const lignes = $$('.metier', sec); if (!lignes.length) return;
  sec.classList.add('vivant');
  let actif = -1, q = false;
  const choisir = i => {
    if (i === actif) return;
    if (actif >= 0) {
      const v = lignes[actif];
      v.classList.remove('actif');
      M.animate($('.metier-img', v), { clipPath: ['inset(0% 0% 0% 0%)', 'inset(0% 0% 100% 0%)'] }, { duration: 0.6, ease: RIDEAU });
      M.animate($('.metier-titre', v), { x: 0 }, POSE);
    }
    actif = i;
    if (i < 0) return;
    const n = lignes[i], im = $('.metier-img', n);
    n.classList.add('actif');
    M.animate(im, { clipPath: ['inset(100% 0% 0% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 0.85, ease: RIDEAU });
    M.animate($('img', im), { scale: [1.25, 1] }, { duration: 1.3, ease: [0.22, 0.61, 0.24, 1] });
    M.animate($('.metier-titre', n), { x: [0, 8] }, PORTE);
  };
  const lire = () => {
    q = false;
    const c = innerHeight * 0.56;
    let i = -1;
    for (let k = 0; k < lignes.length; k++) {
      const r = lignes[k].getBoundingClientRect();
      if (r.top <= c && r.bottom > c) { i = k; break; }
    }
    if (i < 0) {
      const premier = lignes[0].getBoundingClientRect(), dernier = lignes[lignes.length - 1].getBoundingClientRect();
      if (dernier.bottom <= c && dernier.bottom > 0) i = lignes.length - 1;
      else if (premier.top > c) i = -1;
    }
    choisir(i);
  };
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(lire); } }, { passive: true });
  lire();
})();

/* ---- 13. Le curseur et les aimants ---------------------------------------
   Un disque nommé ne paraît que là où il y a quelque chose à faire :
   voir une pièce, entrer dans la galerie, porter la lampe. Les boutons
   d'appel se laissent attirer par la main. */
(() => {
  if (!fine || reduce) return;
  const c = document.createElement('div');
  c.className = 'curseur'; c.setAttribute('aria-hidden', 'true');
  document.body.append(c);
  doc.classList.add('a-curseur');
  let mx = -200, my = -200, x = -200, y = -200, raf = 0, sur = null;
  const suivre = () => {
    x += (mx - x) * 0.22; y += (my - y) * 0.22;
    c.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    raf = (sur || Math.abs(mx - x) + Math.abs(my - y) > 0.5) ? requestAnimationFrame(suivre) : 0;
  };
  addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    if (!sur) { x = mx; y = my; c.style.translate = `${x}px ${y}px`; }
    else if (!raf) raf = requestAnimationFrame(suivre);
  }, { passive: true });
  document.addEventListener('pointerover', e => {
    const cible = e.target.closest('[data-curseur]');
    if (cible === sur) return;
    sur = cible;
    if (sur) {
      c.textContent = sur.dataset.curseur;
      M.animate(c, { scale: 1 }, PORTE);
      if (!raf) raf = requestAnimationFrame(suivre);
    } else M.animate(c, { scale: 0 }, { duration: 0.3, ease: RIDEAU });
  });
  document.addEventListener('pointerleave', () => { sur = null; M.animate(c, { scale: 0 }, { duration: 0.2 }); });

  for (const el of $$('.aimant')) {
    el.addEventListener('pointermove', e => {
      const b = el.getBoundingClientRect();
      M.animate(el, { x: (e.clientX - b.left - b.width / 2) * 0.28, y: (e.clientY - b.top - b.height / 2) * 0.36 }, PORTE);
    });
    el.addEventListener('pointerleave', () => M.animate(el, { x: 0, y: 0 }, DERIVE));
  }
})();

/* ---- 13b. Au toucher ----------------------------------------------------
   Pas de curseur sur un téléphone : ce qui se touche répond au doigt, il
   s'enfonce un peu et revient sur un ressort. */
(() => {
  if (!tactile || reduce) return;
  const cibles = '.carte a, .metier, .nav-cta, .envoi, .suite, .piece, .lien-fleche, .rideau-menu li > a, .nav-menu, .haut, .pole, .chiffres > div';
  let tenu = null;
  const lacher = () => { if (tenu) { M.animate(tenu, { scale: 1 }, { type: 'spring', stiffness: 260, damping: 14, mass: 0.8 }); tenu = null; } };
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest(cibles); if (!el) return;
    tenu = el;
    M.animate(el, { scale: 0.965 }, PORTE);
  }, { passive: true });
  for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, lacher, { passive: true });
  addEventListener('scroll', lacher, { passive: true });
})();

/* ---- 13c. La section, dans la barre ---------------------------------------
   Là où le rail n'a pas la place, la barre dit où l'on est : le nom de la
   section monte à sa place quand on en change. */
(() => {
  if (!nav || reduce) return;
  const secs = $$('.sec-head').map(h => ({ el: h.closest('section'), label: ($('.idx', h)?.textContent || '').trim() }))
    .filter(s => s.el && s.label);
  if (secs.length < 3) return;
  const box = document.createElement('span'); box.className = 'nav-section'; box.setAttribute('aria-hidden', 'true');
  const b = document.createElement('b'); box.append(b);
  nav.insertBefore(box, $('.nav-menu', nav));
  let act = -2, q = false;
  const lire = () => {
    q = false;
    const y = innerHeight * 0.4;
    let n = -1;
    for (let i = 0; i < secs.length; i++) if (secs[i].el.getBoundingClientRect().top <= y) n = i;
    if (n === act) return;
    const monte = n > act;
    act = n;
    M.animate(b, { y: [0, monte ? '-110%' : '110%'], opacity: [1, 0] }, { duration: 0.22, ease: RIDEAU }).finished.then(() => {
      b.textContent = n >= 0 ? secs[n].label : '';
      M.animate(b, { y: [monte ? '110%' : '-110%', 0], opacity: [0, 1] }, POSE);
    }).catch(() => {});
  };
  addEventListener('scroll', () => { if (!q) { q = true; requestAnimationFrame(lire); } }, { passive: true });
  lire();
})();

/* ---- 14. Le rail --------------------------------------------------------
   Le fil d'or du héro ne s'arrête pas avec le film : il devient un
   enregistreur dans la marge. Un trait par section, un tracé qui se
   remplit, et l'aiguille en retard sur le défilement, comme un bras de
   plume : c'est ce retard qui donne du poids à la page. */
(() => {
  if (reduce || innerWidth < 1180 || !M.scroll) return;
  const secs = $$('.sec-head').map(h => ({
    el: h.closest('section'),
    label: ($('.idx', h)?.textContent || '').replace(/\s+/g, ' ').trim()
  })).filter(s => s.el && s.label);
  if (secs.length < 3) return;

  rail = document.createElement('div');
  rail.className = 'rail' + (heroPasse ? ' montre' : '');
  rail.setAttribute('aria-hidden', 'true');
  const run = document.createElement('span'); run.className = 'rail-run';
  const cur = document.createElement('span'); cur.className = 'rail-cur';
  const pt = document.createElement('i'), lab = document.createElement('b');
  cur.append(pt, lab);
  rail.append(run);
  for (const s of secs) { s.tick = document.createElement('span'); s.tick.className = 'rail-tick'; rail.append(s.tick); }
  rail.append(cur);
  document.body.append(rail);

  let H = 1, rh = 1, debut = 0;
  const mesurer = () => {
    debut = hero ? hero.offsetTop + hero.offsetHeight - innerHeight : 0;
    H = Math.max(1, document.documentElement.scrollHeight - innerHeight - debut);
    rh = rail.clientHeight;
    for (const s of secs) {
      s.at = clamp((s.el.offsetTop - innerHeight * 0.35 - debut) / H, 0, 1);
      s.tick.style.top = (s.at * rh).toFixed(1) + 'px';
    }
  };
  mesurer();
  addEventListener('resize', mesurer);
  addEventListener('load', mesurer);
  if (document.fonts) document.fonts.ready.then(mesurer).catch(() => {});
  setTimeout(mesurer, 1500);

  let cible = 0, pos = 0, tourne = false, act = -2;
  const pas = () => {
    const d = cible - pos;
    pos += d * 0.14;
    if (Math.abs(d) < 0.0002) { pos = cible; tourne = false; } else requestAnimationFrame(pas);
    cur.style.transform = `translateY(${(pos * rh).toFixed(2)}px)`;
    run.style.transform = `scaleY(${pos.toFixed(4)})`;
    let now = -1;
    for (let i = 0; i < secs.length; i++) if (pos >= secs[i].at - 0.002) now = i;
    if (now !== act) {
      act = now;
      secs.forEach((s, i) => s.tick.classList.toggle('now', i === now));
      rail.classList.toggle('sur-nuit', now >= 0 && secs[now].el.classList.contains('nuit'));
      lab.style.opacity = '0';
      setTimeout(() => { lab.textContent = now >= 0 ? secs[now].label : ''; lab.style.opacity = '1'; }, 160);
    }
  };
  M.scroll(() => {
    cible = clamp((scrollY - debut) / H, 0, 1);
    if (!tourne) { tourne = true; requestAnimationFrame(pas); }
  });
})();

/* ---- 15. La profondeur -------------------------------------------------
   L'image de l'atelier descend moins vite que la page. */
(() => {
  if (reduce || !M.scroll) return;
  for (const img of $$('.atelier-img img, .page-tete-img img')) {
    M.scroll(p => { img.style.translate = `0 ${(-10 * p).toFixed(2)}%`; },
      { target: img.parentElement, offset: ['start end', 'end start'] });
  }
})();

/* ---- 16. Le nom, en bas de page ------------------------------------------
   La page finit dans la nuit où elle a commencé, sur le nom de la maison,
   lettre à lettre. */
(() => {
  const mot = $('.pied-mot'); if (!mot || reduce) return;
  const texte = mot.textContent.trim();
  mot.setAttribute('aria-label', texte);
  mot.textContent = '';
  const lettres = [];
  for (const [k, m] of texte.split(' ').entries()) {
    if (k) mot.append(' ');
    const masque = document.createElement('span'); masque.className = 'lm'; masque.setAttribute('aria-hidden', 'true');
    for (const ch of m) {
      const l = document.createElement('span'); l.className = 'l'; l.textContent = ch;
      l.style.transform = 'translateY(105%)';
      masque.append(l); lettres.push(l);
    }
    mot.append(masque);
  }
  surveiller(mot, () => { for (const l of lettres) l.style.transform = ''; });
  M.inView(mot, () => {
    montre(mot);
    M.animate(lettres, { transform: ['translateY(105%)', 'translateY(0%)'] }, { ...POSE, delay: M.stagger(0.035) });
    return false;
  }, { amount: 0.4 });
})();

/* ---- 17. Les pages de rubrique : la grille arrive en vague ---------------
   Le délai suit la position de la pièce dans la grille, pas son rang :
   la grille se résout comme l'œil la balaie. */
(() => {
  if (reduce) return;
  const pieces = $$('.piece'); if (pieces.length < 2) return;
  const box = pieces[0].parentElement.getBoundingClientRect();
  const d = pieces.map(el => { const r = el.getBoundingClientRect(); return clamp(((r.left - box.left) + (r.top - box.top) * 0.6) * 0.0006, 0, 0.9); });
  const txt = pieces.map(p => $('figcaption', p)).filter(Boolean);
  txt.forEach(cacher);
  for (let i = 0; i < pieces.length; i++) {
    const f = $('figcaption', pieces[i]); if (!f) continue;
    M.inView(pieces[i], () => { montre(f); M.animate(f, { opacity: [0, 1], y: [18, 0] }, { ...POSE, delay: 0.25 + (d[i] % 0.3) }); return false; }, IN);
  }
  for (const p of pieces) {
    const img = $('.piece-img', p); if (!img || !fine) continue;
    p.addEventListener('pointerenter', () => M.animate(img, { y: -6 }, PORTE));
    p.addEventListener('pointerleave', () => M.animate(img, { y: 0 }, POSE));
  }
})();

/* ---- 18. La barre lit la page -------------------------------------------- */
(() => {
  if (!nav || reduce || !M.scroll) return;
  const prog = document.createElement('span');
  prog.className = 'nav-prog'; prog.setAttribute('aria-hidden', 'true');
  nav.append(prog);
  M.scroll(p => { prog.style.transform = `scaleX(${p.toFixed(4)})`; });
})();

})();
