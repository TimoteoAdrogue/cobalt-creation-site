/* =========================================================
   Cobalt Création, V1 « Nuit & craie » : le mouvement.

   Trois verbes, et rien d'autre ne bouge :
   - s'allumer : les photographies, les relais, la visionneuse, le
     passage d'une page à l'autre. C'est la lampe de l'atelier.
   - s'écrire  : la phrase du client se lit mot à mot, au rythme du
     défilement.
   - se poser  : le menu, la visionneuse, la barre, sur un ressort.

   Motion (motion.dev, servi depuis assets/vendor) pour les ressorts ;
   le défilement est lu par une seule boucle, ici. Sans ce fichier, tout
   le contenu est là, allumé, à sa place.
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
const POSE  = { type: 'spring', stiffness: 190, damping: 26, mass: 0.9 };
const PORTE = { type: 'spring', stiffness: 320, damping: 34, mass: 0.7 };
const RIDEAU = [0.76, 0, 0.24, 1];
const anime = (el, k, o) => (M && !reduce ? M.animate(el, k, o) : null);

doc.classList.add('italiques');

/* =========================================================
   LA BOUCLE DE DÉFILEMENT
   Tout ce qui suit le défilement s'inscrit ici et ne travaille que près
   de l'écran. Un élément passé ou à venir reçoit une fois son état final.
   ========================================================= */
const suivis = [];
let q = false;
const tour = () => {
  q = false;
  const h = innerHeight;
  for (const s of suivis) {
    const r = s.el.getBoundingClientRect();
    const loin = r.bottom < -h * 0.5 || r.top > h * 1.5;
    if (loin && s.repos === (r.top > 0)) continue;
    s.repos = loin ? (r.top > 0) : null;
    s.maj(r, h);
  }
  for (const f of apres) f();
};
const apres = [];
const demander = () => { if (!q) { q = true; requestAnimationFrame(tour); } };
addEventListener('scroll', demander, { passive: true });
addEventListener('resize', demander);
const suivre = (el, maj) => { suivis.push({ el, maj, repos: undefined }); demander(); };

/* ---- la barre : après le film, couleur du sol, s'efface en descendant -- */
const nav = $('#nav'), hero = $('#hero');
let heroPasse = !hero, yPrec = scrollY;
const sols = $$('[data-sol]');
if (nav) {
  if (hero && 'IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { heroPasse = !e.isIntersecting; demander(); }, { threshold: 0 }).observe(hero);
  } else heroPasse = true;
  apres.push(() => {
    const ouvert = nav.classList.contains('menu-ouvert');
    nav.classList.toggle('montre', heroPasse || ouvert);
    const y = nav.offsetHeight / 2;
    let sol = 'craie';
    for (const el of sols) {               // le plus profond l'emporte (ordre du document)
      const r = el.getBoundingClientRect();
      if (r.top > y || r.bottom <= y) continue;
      sol = el.dataset.sol;
      if (sol === 'photo' && el.dataset.de) {
        const k = (y - r.top) / r.height;   // dans le bord fondu, on lit le sol qu'il touche
        if (k < 0.12) sol = el.dataset.de; else if (k > 0.88) sol = el.dataset.a;
      }
    }
    nav.classList.toggle('sur-nuit', sol !== 'craie');
    nav.classList.toggle('sur-photo', sol === 'photo');
    const dy = scrollY - yPrec; yPrec = scrollY;
    if (!ouvert && Math.abs(dy) > 3) nav.classList.toggle('range', dy > 0 && scrollY > innerHeight * 0.8 && !reduce);
  });
}

/* ---- le menu plein écran ---------------------------------------------- */
const btnMenu = $('.nav-menu'), menu = $('#rideau-menu');
if (btnMenu && menu) {
  let ouvert = false;
  const ouvrir = () => {
    ouvert = true; menu.hidden = false;
    btnMenu.setAttribute('aria-expanded', 'true');
    $('.nav-menu-txt', btnMenu).textContent = 'Fermer';
    nav.classList.add('menu-ouvert'); demander();
    document.body.style.overflow = 'hidden';
    anime(menu, { clipPath: ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'] }, { duration: 0.8, ease: RIDEAU });
    anime($$('li > a', menu), { y: ['110%', '0%'] }, { ...POSE, delay: M ? M.stagger(0.05, { startDelay: 0.28 }) : 0 });
  };
  const fermer = vite => {
    if (!ouvert) return;
    ouvert = false;
    btnMenu.setAttribute('aria-expanded', 'false');
    $('.nav-menu-txt', btnMenu).textContent = 'Menu';
    document.body.style.overflow = '';
    const fin = () => { menu.hidden = true; nav.classList.remove('menu-ouvert'); demander(); };
    const a = vite ? null : anime(menu, { clipPath: ['inset(0% 0% 0% 0%)', 'inset(0% 0% 100% 0%)'] }, { duration: 0.6, ease: RIDEAU });
    if (a) a.finished.then(fin).catch(fin); else fin();
  };
  btnMenu.addEventListener('click', () => (ouvert ? fermer() : ouvrir()));
  $$('a', menu).forEach(a => a.addEventListener('click', () => fermer(true)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && ouvert) { fermer(); btnMenu.focus(); } });
  matchMedia('(min-width: 1081px)').addEventListener('change', e => { if (e.matches) fermer(true); });
}

/* ---- les ancres : un glissé, sans que le défilement des scripts en hérite ---- */
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a || a.classList.contains('skip') || e.defaultPrevented) return;
  const id = a.getAttribute('href').slice(1);
  const cible = id === 'top' ? document.body : document.getElementById(id);
  if (!cible) return;
  e.preventDefault();
  if (id === 'top') scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
  else cible.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  history.replaceState(null, '', '#' + id);
});

/* ---- le formulaire : pas de serveur, on passe la main à la messagerie -- */
(() => {
  const form = $('.form'); if (!form) return;
  const email = $('#f-email'), erreur = $('#err-email'), etat = $('#etat-form'), bouton = $('.envoi', form);
  const val = id => (($('#' + id) || {}).value || '').trim();
  const ok = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
  const marquer = bon => { email.closest('.champ').classList.toggle('invalide', !bon); erreur.hidden = bon; email.setAttribute('aria-invalid', bon ? 'false' : 'true'); };
  email.addEventListener('blur', () => { if (email.value.trim()) marquer(ok(email.value)); });
  email.addEventListener('input', () => { if (!erreur.hidden && ok(email.value)) marquer(true); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!ok(email.value)) { marquer(false); email.focus(); anime(email.closest('.champ'), { x: [0, -6, 5, -3, 0] }, { duration: 0.36 }); return; }
    marquer(true);
    const prenom = val('f-prenom'), nom = val('f-nom'), maison = val('f-maison');
    const corps = 'Prénom : ' + prenom + '\nNom : ' + nom + (maison ? '\nMaison : ' + maison : '') + '\nEmail : ' + email.value.trim() + '\n\n' + val('f-message');
    bouton.disabled = true; etat.hidden = false;
    etat.textContent = 'Votre message s’ouvre dans votre messagerie.';
    location.href = 'mailto:contact@cobaltcreation.com?subject=' + encodeURIComponent('Projet : ' + ((maison || (prenom + ' ' + nom)).trim())) + '&body=' + encodeURIComponent(corps);
    setTimeout(() => { bouton.disabled = false; }, 2500);
  });
})();

/* ---- les images arrivent avant le regard ------------------------------- */
(() => {
  const charger = img => { if (img.loading === 'lazy') img.loading = 'eager'; };
  const blocs = $$('main > *, .pied');
  const toutes = b => $$('img[loading="lazy"]', b).filter(i => i.getClientRects().length || i.closest('.gestes-fenetre, .metiers-fond'));
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); toutes(e.target).forEach(charger); }
  }, { rootMargin: '150% 0px 150% 0px' });
  blocs.forEach(b => io.observe(b));
})();

/* =========================================================
   S'ÉCRIRE : la phrase se lit sous le défilement
   ========================================================= */
(() => {
  if (reduce) return;
  for (const p of $$('[data-lecture]')) {
    const base = parseFloat(p.dataset.lecture) || 0.28;
    const mots = [], textes = [];
    (function marche(n) {
      for (const c of n.childNodes) {
        if (c.nodeType === 3 && c.nodeValue.trim()) textes.push(c);
        else if (c.nodeType === 1 && !c.classList.contains('sep')) marche(c);
      }
    })(p);
    for (const t of textes) {
      const frag = document.createDocumentFragment();
      for (const part of t.nodeValue.split(/(\s+)/)) {
        if (!part) continue;
        if (!part.trim()) { frag.append(part); continue; }
        const s = document.createElement('span'); s.className = 'lu'; s.textContent = part; s.style.opacity = base;
        frag.append(s); mots.push(s);
      }
      t.replaceWith(frag);
    }
    const seps = $$('.sep', p);
    const vus = new Float32Array(mots.length).fill(base);
    suivre(p, (r, h) => {
      // de l'entrée par le bas jusqu'au dernier mot lu aux deux cinquièmes de l'écran
      const v = clamp((h * 0.88 - r.top) / (r.height + h * 0.42), 0, 1);
      const k = v * (mots.length + 3) - 1.5;
      for (let i = 0; i < mots.length; i++) {
        const o = base + (1 - base) * lisse(clamp(k - i, 0, 1));
        if (Math.abs(o - vus[i]) > 0.01 || (o === 1 && vus[i] !== 1)) { vus[i] = o; mots[i].style.opacity = o === 1 ? '' : o.toFixed(3); }
      }
      if (seps.length) { const o = (base + (1 - base) * v).toFixed(3); for (const s of seps) s.style.opacity = o; }
    });
  }
})();

/* =========================================================
   S'ALLUMER
   ========================================================= */
/* ---- les relais : la pièce baisse ou monte avec la lumière de la salle -- */
(() => {
  if (reduce) return;
  for (const el of $$('.relais')) {
    const v = $(':scope .voile', el) || $('.voile', el);
    if (!v) continue;
    const versNuit = el.dataset.a === 'nuit';
    suivre(el, (r, h) => {
      let o;
      if (versNuit) o = 0.06 + 0.5 * lisse(clamp((h * 0.5 - r.top) / r.height, 0, 1));      // la salle s'éteint
      else o = 0.56 * (1 - lisse(clamp((h - r.top) / (r.height * 0.9), 0, 1)));           // le jour se lève
      v.style.setProperty('--v', o.toFixed(3));
    });
  }
  /* sur la nuit, chaque pièce s'allume quand elle arrive à la lecture */
  for (const v of $$('.nuit .voile')) {
    if (v.closest('.relais, .metiers')) continue;
    const el = v.parentElement;
    suivre(el, (r, h) => {
      const o = 0.55 * (1 - lisse(clamp((h - r.top) / (h * 0.62), 0, 1)));
      v.style.setProperty('--v', o.toFixed(3));
    });
  }
})();

/* ---- les gestes : le cadre reste, le geste lu prend la lumière ---------- */
(() => {
  const sec = $('.gestes'); if (!sec) return;
  const lignes = $$('.geste', sec), imgs = $$('.gestes-fenetre img', sec);
  if (!lignes.length || imgs.length !== lignes.length) return;
  let actif = 0, tenu = false;
  const choisir = i => {
    if (i === actif || i < 0) return;
    lignes[actif].classList.remove('actif'); imgs[actif].classList.remove('on');
    lignes[i].classList.add('actif'); imgs[i].classList.add('on');
    actif = i;
  };
  sec.classList.add('vivant');
  apres.push(() => {
    if (tenu || !large()) return;
    const c = innerHeight * 0.5;
    for (let i = 0; i < lignes.length; i++) {
      const r = lignes[i].getBoundingClientRect();
      if (r.top <= c && r.bottom > c) { choisir(i); return; }
    }
    if (lignes[0].getBoundingClientRect().top > c) choisir(0);
  });
  if (fine) {
    lignes.forEach((li, i) => li.addEventListener('pointerenter', () => { if (large()) { tenu = true; choisir(i); } }));
    $('.gestes-liste', sec).addEventListener('pointerleave', () => { tenu = false; demander(); });
  }
})();

/* ---- les métiers : le nom lu allume sa photographie ---------------------- */
(() => {
  const sec = $('.metiers'); if (!sec) return;
  const liens = $$('.metier', sec), fonds = $$('.fond', sec);
  let actif = 0, tenu = false;
  const choisir = i => {
    if (i === actif) return;
    liens[actif].classList.remove('actif'); fonds[actif].classList.remove('on');
    liens[i].classList.add('actif'); fonds[i].classList.add('on');
    actif = i;
  };
  apres.push(() => {
    if (tenu) return;
    const c = innerHeight * 0.5;
    let k = 0;
    for (let i = 0; i < liens.length; i++) if (liens[i].getBoundingClientRect().top <= c) k = i;
    choisir(k);
  });
  if (fine) {
    liens.forEach((a, i) => {
      a.addEventListener('pointerenter', () => { tenu = true; choisir(i); });
      a.addEventListener('focus', () => choisir(i));
    });
    $('.metiers-liste', sec).addEventListener('pointerleave', () => { tenu = false; demander(); });
  }
})();

/* ---- la lampe de l'établi : la main porte la lumière --------------------- */
(() => {
  const lampe = $('#lampe'); if (!lampe || reduce) return;
  const plaque = $('.lampe-plaque', lampe), lum = $('.lampe-lumiere', lampe);
  lampe.classList.add('allumee');
  let tx = 0.6, ty = 0.4, sx = tx, sy = ty, bouge = 0, raf = 0;
  const t0 = performance.now();
  const viser = (x, y) => {
    const b = plaque.getBoundingClientRect();
    tx = clamp((x - b.left) / b.width, -0.15, 1.15); ty = clamp((y - b.top) / b.height, -0.15, 1.15);
    bouge = performance.now();
  };
  if (fine) {
    plaque.style.cursor = 'none';
    addEventListener('pointermove', e => {
      const b = plaque.getBoundingClientRect();
      if (e.clientY < b.top - 200 || e.clientY > b.bottom + 200) return;
      viser(e.clientX, e.clientY);
    }, { passive: true });
  } else {
    const aide = $('.lampe-aide', lampe); if (aide) aide.textContent = 'Touchez la pièce';
    const doigt = e => viser(e.touches[0].clientX, e.touches[0].clientY);
    plaque.addEventListener('touchstart', doigt, { passive: true });
    plaque.addEventListener('touchmove', doigt, { passive: true });
  }
  const image = t => {
    if (performance.now() - bouge > 2600) {
      const s = (t - t0) / 1000;
      tx = 0.5 + 0.26 * Math.sin(s * 0.52); ty = 0.46 + 0.24 * Math.sin(s * 0.37 + 1.1);
    }
    sx += (tx - sx) * 0.075; sy += (ty - sy) * 0.075;
    const b = plaque.getBoundingClientRect();
    const R = Math.max(140, Math.min(b.width, b.height) * 0.42);
    const m = `radial-gradient(circle ${R.toFixed(0)}px at ${(sx * b.width).toFixed(1)}px ${(sy * b.height).toFixed(1)}px,#000 0%,#000 40%,rgba(0,0,0,.62) 60%,rgba(0,0,0,.22) 80%,rgba(0,0,0,0) 100%)`;
    lum.style.webkitMaskImage = m; lum.style.maskImage = m;
    raf = requestAnimationFrame(image);
  };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) raf = requestAnimationFrame(image);
    else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  }).observe(plaque);
})();

/* ---- la visionneuse : la pièce sous la lampe ---------------------------- */
(() => {
  const items = $$('[data-oeuvre]');
  if (!items.length || !window.HTMLDialogElement) return;
  let dlg, cadre, base, lum, leg, i = 0, source = null, lampeOn = false, x0 = null;
  const pic = (cls, it, a) => {
    const sizes = `min(200vw, calc((100dvh - 12rem) * ${(+it.dataset.w / +it.dataset.h).toFixed(3)} * 2))`;
    return `<picture><source type="image/avif" srcset="${it.dataset.avif}" sizes="${sizes}"><img class="${cls}" srcset="${it.dataset.jpg}" sizes="${sizes}" alt="${a}" ${a ? '' : 'aria-hidden="true"'}></picture>`;
  };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const montrer = k => {
    i = (k + items.length) % items.length;
    const it = items[i];
    cadre.classList.remove('proche', 'lampe-on');
    cadre.innerHTML = pic('vis-base', it, esc(it.dataset.legende || '')) + pic('vis-lumiere', it, '');
    base = $('.vis-base', cadre); lum = $('.vis-lumiere', cadre);
    const l = (it.dataset.legende || '').split(' / ').filter(Boolean);
    leg.innerHTML = (l.length ? `<b>${esc(l[0])}</b>` + l.slice(1).map(x => `<span>${esc(x)}</span>`).join('') : '')
      + (it.dataset.desc ? `<p>${esc(it.dataset.desc.split('\n')[0])}</p>` : '');
    anime(cadre, { opacity: [0, 1], scale: [0.965, 1] }, POSE);
  };
  const lampe = e => {
    if (!fine || reduce || !lum) return;
    const b = cadre.getBoundingClientRect();
    const dedans = e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom;
    if (dedans !== lampeOn) { lampeOn = dedans; cadre.classList.toggle('lampe-on', dedans); }
    if (!dedans) return;
    const s = cadre.classList.contains('proche') ? 2 : 1;
    const R = Math.max(160, Math.min(b.width, b.height) * 0.34) / s;
    const m = `radial-gradient(circle ${R.toFixed(0)}px at ${((e.clientX - b.left) / s).toFixed(1)}px ${((e.clientY - b.top) / s).toFixed(1)}px,#000 0%,#000 38%,rgba(0,0,0,.6) 62%,rgba(0,0,0,0) 100%)`;
    lum.style.webkitMaskImage = m; lum.style.maskImage = m;
  };
  const construire = () => {
    dlg = document.createElement('dialog');
    dlg.className = 'visionneuse';
    dlg.setAttribute('aria-label', 'Réalisations');
    dlg.innerHTML = '<div class="vis-scene"><div class="vis-cadre"></div></div><div class="vis-legende" aria-live="polite"></div>'
      + '<button class="vis-btn vis-prec" type="button">Précédente</button><button class="vis-btn vis-suiv" type="button">Suivante</button>'
      + '<button class="vis-btn vis-fermer" type="button">Fermer</button>';
    document.body.append(dlg);
    cadre = $('.vis-cadre', dlg); leg = $('.vis-legende', dlg);
    $('.vis-fermer', dlg).addEventListener('click', () => dlg.close());
    $('.vis-prec', dlg).addEventListener('click', () => montrer(i - 1));
    $('.vis-suiv', dlg).addEventListener('click', () => montrer(i + 1));
    dlg.addEventListener('keydown', e => { if (e.key === 'ArrowRight') montrer(i + 1); else if (e.key === 'ArrowLeft') montrer(i - 1); });
    dlg.addEventListener('close', () => { document.body.style.overflow = ''; if (source) source.focus({ preventScroll: true }); });
    cadre.addEventListener('click', e => {
      if (x0 !== null && Math.abs(e.clientX - x0) > 12) return;
      const b = cadre.getBoundingClientRect();
      const proche = !cadre.classList.contains('proche');
      if (proche) cadre.style.transformOrigin = `${((e.clientX - b.left) / b.width * 100).toFixed(1)}% ${((e.clientY - b.top) / b.height * 100).toFixed(1)}%`;
      cadre.classList.toggle('proche', proche);
      cadre.style.transform = proche ? 'scale(2)' : '';
    });
    dlg.addEventListener('pointermove', lampe, { passive: true });
    dlg.addEventListener('pointerdown', e => { x0 = e.clientX; }, { passive: true });
    dlg.addEventListener('pointerup', e => {
      if (e.pointerType === 'mouse' || x0 === null || cadre.classList.contains('proche')) return;
      const dx = e.clientX - x0;
      if (Math.abs(dx) > 60) montrer(i + (dx < 0 ? 1 : -1));
    }, { passive: true });
  };
  items.forEach((it, k) => it.addEventListener('click', () => {
    if (!dlg) construire();
    source = it; montrer(k);
    dlg.showModal(); document.body.style.overflow = 'hidden';
  }));
})();

/* ---- d'une page à l'autre : la lumière s'éteint sur ce qu'on a touché --- */
(() => {
  if (reduce) return;
  addEventListener('pageshow', e => { if (e.persisted) { $$('.pt').forEach(x => x.remove()); doc.classList.remove('pt-in'); } });
  const page = u => u.pathname.replace(/index\.html$/, '');
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if (!a || a.target || a.hasAttribute('download')) return;
    const u = new URL(a.href, location.href);
    if (u.origin !== location.origin || page(u) === page(location) || /\.(pdf|jpe?g|png|mp4)$/i.test(u.pathname)) return;
    e.preventDefault();
    let x = e.clientX, y = e.clientY;
    if (!x && !y) { const b = a.getBoundingClientRect(); x = b.left + b.width / 2; y = b.top + b.height / 2; }
    const d = document.createElement('div');
    d.className = 'pt'; d.style.setProperty('--x', x + 'px'); d.style.setProperty('--y', y + 'px');
    document.body.append(d);
    try { sessionStorage.setItem('v1-pt', '1'); } catch (err) { /* sans mémoire de session, la page s'ouvre sans lumière */ }
    setTimeout(() => { location.href = u.href; }, 560);
  });
})();

/* =========================================================
   SE POSER
   ========================================================= */
/* ---- le curseur nommé, là où il y a quelque chose à voir ----------------- */
(() => {
  if (!fine || reduce || !M) return;
  const c = document.createElement('div');
  c.className = 'curseur'; c.setAttribute('aria-hidden', 'true');
  document.body.append(c); doc.classList.add('a-curseur');
  let mx = -200, my = -200, x = -200, y = -200, raf = 0, sur = null;
  const pas = () => {
    x += (mx - x) * 0.22; y += (my - y) * 0.22;
    c.style.translate = `${x.toFixed(1)}px ${y.toFixed(1)}px`;
    raf = (sur || Math.abs(mx - x) + Math.abs(my - y) > 0.5) ? requestAnimationFrame(pas) : 0;
  };
  addEventListener('pointermove', e => {
    mx = e.clientX; my = e.clientY;
    if (!sur) { x = mx; y = my; c.style.translate = `${x}px ${y}px`; } else if (!raf) raf = requestAnimationFrame(pas);
  }, { passive: true });
  document.addEventListener('pointerover', e => {
    const cible = e.target.closest('[data-curseur]');
    if (cible === sur) return;
    sur = cible;
    if (sur) { c.textContent = sur.dataset.curseur; M.animate(c, { scale: 1 }, PORTE); if (!raf) raf = requestAnimationFrame(pas); }
    else M.animate(c, { scale: 0 }, { duration: 0.3, ease: RIDEAU });
  });
})();

/* ---- au toucher : ce qui se touche s'enfonce un peu et revient --------- */
(() => {
  if (!tactile || reduce || !M) return;
  const cibles = '.ouvrir, .metier, .suite, .rideau-menu li > a, .nav-menu, .envoi, .lien';
  let tenu = null;
  const lacher = () => { if (tenu) { M.animate(tenu, { scale: 1 }, { type: 'spring', stiffness: 260, damping: 14, mass: 0.8 }); tenu = null; } };
  document.addEventListener('pointerdown', e => { const el = e.target.closest(cibles); if (!el) return; tenu = el; M.animate(el, { scale: 0.975 }, PORTE); }, { passive: true });
  for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, lacher, { passive: true });
  addEventListener('scroll', lacher, { passive: true });
})();

/* ---- au téléphone, la barre dit où l'on est ----------------------------- */
(() => {
  if (!nav || reduce || !M) return;
  const secs = $$('[data-nom]');
  if (secs.length < 3) return;
  const box = document.createElement('span'); box.className = 'nav-section'; box.setAttribute('aria-hidden', 'true');
  const b = document.createElement('b'); box.append(b);
  nav.insertBefore(box, $('.nav-menu', nav));
  let act = -2;
  apres.push(() => {
    const y = innerHeight * 0.4;
    let n = -1;
    for (let i = 0; i < secs.length; i++) if (secs[i].getBoundingClientRect().top <= y) n = i;
    if (n === act) return;
    const monte = n > act; act = n;
    M.animate(b, { y: [0, monte ? '-110%' : '110%'], opacity: [1, 0] }, { duration: 0.22, ease: RIDEAU }).finished.then(() => {
      b.textContent = n >= 0 ? secs[n].dataset.nom : '';
      M.animate(b, { y: [monte ? '110%' : '-110%', 0], opacity: [0, 1] }, POSE);
    }).catch(() => {});
  });
})();

/* ---- le nom, en bas de page, lettre à lettre ----------------------------- */
(() => {
  const mot = $('.pied-mot'); if (!mot || reduce || !M) return;
  const texte = mot.textContent.trim();
  mot.textContent = '';
  const lu = document.createElement('span'); lu.className = 'sr-only'; lu.textContent = texte; mot.append(lu);
  const lettres = [];
  for (const [k, m] of texte.split(' ').entries()) {
    if (k) mot.append(' ');
    const masque = document.createElement('span'); masque.className = 'lm'; masque.setAttribute('aria-hidden', 'true');
    for (const ch of m) { const l = document.createElement('span'); l.className = 'l'; l.textContent = ch; l.style.transform = 'translateY(105%)'; masque.append(l); lettres.push(l); }
    mot.append(masque);
  }
  let fait = false;
  const lever = () => {
    if (fait) return; fait = true;
    M.animate(lettres, { transform: ['translateY(105%)', 'translateY(0%)'] }, { ...POSE, delay: M.stagger(0.035) });
    setTimeout(() => lettres.forEach(l => { l.style.transform = ''; }), 2400);
  };
  M.inView(mot, () => { lever(); return false; }, { amount: 0.3 });
  suivre(mot, r => { if (r.top < innerHeight * 0.6 || r.bottom < 0) lever(); });   // un saut ne la laisse jamais sous sa ligne
})();

demander();
})();
