/* =========================================================
   Cobalt Création — le film scrubé au défilement
   Rien d'externe, rien à compiler. API natives seulement.

   Trois choix qui font toute la fluidité, et qui ont coûté
   cher à trouver ailleurs :

   1. Un seul <video>, pas une séquence d'images sur <canvas>.
      Le coût de décodage d'une image commande le nombre
      d'images que le défilement peut afficher ; une séquence
      JPEG de la même durée pèse deux à trois fois plus lourd
      pour un résultat moins fluide.

   2. Le fichier doit être encodé avec UNE IMAGE CLÉ PAR IMAGE
      (ffmpeg -g 1 -keyint_min 1). Sans cela, Firefox cherche
      l'image clé précédente à chaque seek et le défilement
      saccade. Voir NOTE-ENCODAGE en bas de fichier.

   3. Jamais deux seeks en vol. On sérialise : un seek en cours,
      un seul en attente, le dernier demandé gagne.
   ========================================================= */
(function () {
'use strict';

var clamp = function (v, lo, hi) { return Math.min(hi, Math.max(lo, v)); };
var smoothstep = function (p, e0, e1) {
  var t = clamp((p - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/* Deux films, choisis une fois, au lancement du scrub.
   L'écran tenu droit reçoit sa propre coupe verticale :
   506 x 900, 30 img/s, crf 24, 4,6 Mo au lieu de 24. Le
   téléphone ne décode plus que les pixels qu'il affiche, et le
   film descend en quelques secondes sur un réseau mobile.
   Encodage dans NOTE-ENCODAGE en bas de fichier. */
var VIDEO_URL_LARGE = 'assets/hero-scrub.mp4';
var VIDEO_URL_PHONE = 'assets/hero-scrub-phone.mp4';
var mqVertical = matchMedia('(orientation: portrait)');

var hero   = document.getElementById('hero');
var stage  = document.querySelector('.stage');
var video  = document.getElementById('hero-video');
var fil    = document.querySelector('.fil');
var bandEls = [].slice.call(document.querySelectorAll('.band'));
/* La lumière de l'atelier : elle s'ouvre à la pointe du pinceau, sur la
   feuille d'or, et devient la craie de la page. Un seul calque, mis à
   l'échelle : aucun masque animé, aucun repeint du dégradé. */
var aube = document.querySelector('.aube');
var lave = aube && aube.querySelector('.aube-lave');
var jour = aube && aube.querySelector('.aube-jour');
var techs = [].slice.call(document.querySelectorAll('.techniques li'));
var racine = document.documentElement;
/* La pointe du pinceau sur la dernière image du film (image 575),
   relevée dans chaque coupe, en fraction de l'image. */
var POINTE_LARGE = [0.53, 0.47], POINTE_PHONE = [0.59, 0.47];
var A_LARGE = 1600 / 900, A_PHONE = 506 / 900;
function placerAube() {
  if (!aube) return;
  var w = stage.clientWidth, h = stage.clientHeight;
  var vert = mqVertical.matches, a = vert ? A_PHONE : A_LARGE, pt = vert ? POINTE_PHONE : POINTE_LARGE;
  var vw = h * a, vh = h;                         /* object-fit: cover */
  if (w / h > a) { vw = w; vh = w / a; }
  aube.style.setProperty('--ax', ((w - vw) / 2 + pt[0] * vw).toFixed(1) + 'px');
  aube.style.setProperty('--ay', ((h - vh) / 2 + pt[1] * vh).toFixed(1) + 'px');
}
window.addEventListener('resize', placerAube, { passive: true });
placerAube();

if (!hero || !stage || !video) return;

var bands = bandEls.map(function (el) {
  return {
    el: el,
    a: parseFloat(el.getAttribute('data-a')),
    b: parseFloat(el.getAttribute('data-b')),
    op: -1, k: -1
  };
});

/* ---- l'état ---- */
var cible = 0, montre = 0, rafId = null, lastTick = 0;
var heroVisible = true;
var scrubOn = false;

/* ---------------------------------------------------------
   La progression : 0 en haut du héro, 1 quand la course
   est épuisée et que la scène rend la main.
   --------------------------------------------------------- */
function heroProgress() {
  var r = hero.getBoundingClientRect();
  var course = hero.offsetHeight - window.innerHeight;
  if (course <= 0) return 0;
  return clamp(-r.top / course, 0, 1);
}

/* ---------------------------------------------------------
   Les seeks, sérialisés.
   --------------------------------------------------------- */
var seekBusy = false, pendingTime = null;

function requestSeek(t) {
  if (!video.duration || !isFinite(video.duration)) return;
  if (seekBusy) { pendingTime = t; return; }
  seekBusy = true;
  try { video.currentTime = t; }
  catch (e) { seekBusy = false; }
}

video.addEventListener('seeked', function () {
  seekBusy = false;
  if (pendingTime !== null) {
    var t = pendingTime; pendingTime = null;
    requestSeek(t);
  }
});

video.addEventListener('error', function () {
  seekBusy = false; pendingTime = null; failVideo();
});

function failVideo() {
  stage.classList.add('video-failed');   /* l'image fixe reprend la main */
}

/* ---------------------------------------------------------
   Les bandes de texte, sur la même progression que le film.
   On n'écrit dans le style que si la valeur a bougé : les
   écritures inutiles coûtent plus cher que le calcul.
   --------------------------------------------------------- */
function majBandes(p) {
  for (var i = 0; i < bands.length; i++) {
    var b = bands[i];
    var f = Math.min(0.05, (b.b - b.a) / 3);   /* le fondu */
    var op;

    if (i === 0)                    op = 1 - smoothstep(p, b.b - f, b.b);
    /* la dernière phrase s'efface avant que la lumière ne l'atteigne */
    else if (i === bands.length - 1) op = smoothstep(p, b.a, b.a + f) * (1 - smoothstep(p, 0.75, 0.81));
    else op = smoothstep(p, b.a, b.a + f) * (1 - smoothstep(p, b.b - f, b.b));

    var k = clamp((p - b.a) / Math.max(0.001, (b.b - b.a) * 0.4), 0, 1);

    if (Math.abs(op - b.op) > 0.006) {
      b.op = op;
      b.el.style.opacity = op.toFixed(3);
      /* Une bande éteinte ne capte pas le doigt : sans cela, le lien
         d'une bande invisible restait cliquable au toucher. */
      b.el.style.visibility = op > 0.01 ? '' : 'hidden';
    }
    if (Math.abs(k - b.k) > 0.008)  { b.k = k;  b.el.style.setProperty('--k', k.toFixed(3)); }
  }

  /* Les cinq techniques, une à une, au rythme du geste */
  if (techs.length) {
    var t = clamp((p - 0.30) / (0.57 - 0.30), 0, 0.9999) * techs.length;
    for (var j = 0; j < techs.length; j++) {
      var on = j === Math.floor(t) ? 1 : (j < t ? 0.42 : 0.2);
      if (techs[j]._o !== on) { techs[j]._o = on; techs[j].classList.toggle('lu', on === 1); techs[j].style.opacity = on; }
    }
  }

  /* La lumière : un halo d'or attrape la feuille, puis le jour monte
     de la pointe et couvre la scène. L'opacité suit l'échelle, pour que
     la lumière ne soit jamais une boule blanche. */
  if (aube) {
    /* toute l'image se lève vers la craie (la lampe qu'on monte), pendant
       que le jour s'ouvre depuis la feuille : jamais de bord net, jamais de boule */
    var w = smoothstep(p, 0.76, 0.95), d = smoothstep(p, 0.79, 1);
    lave.style.opacity = (0.7 * w).toFixed(3);
    jour.style.transform = 'scale(' + (0.35 + 3.6 * d).toFixed(4) + ')';
    jour.style.opacity = smoothstep(p, 0.79, 0.9).toFixed(3);
    racine.style.setProperty('--jour', smoothstep(p, 0.86, 0.97).toFixed(3));
    /* pour la barre : une fois la lumière venue, le sol du héro est la craie */
    var sol = p > 0.93 ? 'craie' : 'photo';
    if (hero.dataset.sol !== sol) hero.dataset.sol = sol;
  }

  /* Une amorce d'or reste visible à l'arrêt : sans elle, rien
     ne dit que la page se déroule. */
  if (fil) fil.style.setProperty('--p', Math.max(0.035, p).toFixed(4));
}

/* ---------------------------------------------------------
   La boucle. Elle se rendort dès que le film a rattrapé
   le défilement — pas de rAF qui tourne dans le vide.
   --------------------------------------------------------- */
function tick(now) {
  var dt = Math.min(100, now - (lastTick || now));
  lastTick = now;

  /* Lissage exponentiel, indépendant de la cadence d'écran. */
  var k = 0.16;
  montre += (cible - montre) * (1 - Math.pow(1 - k, dt / 16.667));

  if (Math.abs(cible - montre) < 0.0005) {
    montre = cible; rafId = null; lastTick = 0;
  } else {
    rafId = requestAnimationFrame(tick);
  }

  requestSeek(montre * (video.duration || 0));
  majBandes(montre);
}

function onScroll() {
  cible = heroProgress();
  if (rafId === null && heroVisible && scrubOn) {
    lastTick = 0;
    rafId = requestAnimationFrame(tick);
  }
}

/* ---------------------------------------------------------
   Le chargement, en deux temps.

   Le blob reste la cible : un seek dans un fichier entièrement
   en mémoire est immédiat, et c'est lui qui donne les 60 img/s.
   Mais l'attendre pour commencer coûte dix secondes de poster
   figé sur un hébergeur distant — mesuré sur GitHub Pages :
   le film ne prenait la main qu'à la douzième seconde, après
   que le visiteur a déjà défilé.

   Donc : on branche d'abord le fichier en direct (les seeks
   passent par des requêtes de plage, ça bouge tout de suite),
   et on bascule sur le blob quand il est descendu. Le fetch
   relit la réponse déjà en cache HTTP, le fichier ne descend
   pas deux fois.
   --------------------------------------------------------- */
var heroLance = false;
var blobEnAttente = null;

/* Une bascule de src laisse un seek orphelin : son 'seeked'
   n'arrivera jamais et la file resterait bloquée. */
function attachSource(src, seekTo) {
  seekBusy = false; pendingTime = null;
  video.src = src;
  video.load();
  video.addEventListener('loadeddata', function () {
    requestSeek((seekTo !== null ? seekTo : heroProgress() * video.duration) || 0);
    stage.classList.remove('video-failed');
    stage.classList.add('video-ready');
  }, { once: true });
  amorcer();
}

/* Safari sur iPhone ne charge ni n'affiche les images d'un film
   qui n'a jamais joué, même muet. Un play() aussitôt suivi d'un
   pause() le réveille ; ailleurs, c'est sans effet visible. */
function amorcer() {
  var p;
  try { p = video.play(); } catch (e) { return; }
  if (p && p.then) {
    p.then(function () {
      video.pause();
      requestSeek(montre * (video.duration || 0));
    }, function () { /* refusé (mode économie d'énergie) : on retente au toucher */ });
  }
}

/* En mode économie d'énergie, iOS refuse toute lecture sans geste :
   le premier toucher du visiteur sert alors de geste. */
function amorcerAuToucher() {
  if (video.readyState >= 2) {
    window.removeEventListener('touchend', amorcerAuToucher);
    return;
  }
  if (scrubOn && video.currentSrc) amorcer();
}
window.addEventListener('touchend', amorcerAuToucher, { passive: true });

function initHeroOnce() {
  if (heroLance) return;
  heroLance = true;

  var VIDEO_URL = mqVertical.matches ? VIDEO_URL_PHONE : VIDEO_URL_LARGE;
  video.muted = true;
  video.preload = 'auto';
  attachSource(VIDEO_URL, null);

  var ctrl = new AbortController();
  var watchdog = setTimeout(function () { ctrl.abort(); }, 20000);

  fetch(VIDEO_URL, { signal: ctrl.signal }).then(function (res) {
    if (!res.ok || !res.body) throw new Error('http ' + res.status);
    var reader = res.body.getReader();
    var chunks = [];

    return (function pump() {
      return reader.read().then(function (r) {
        if (r.done) return;
        clearTimeout(watchdog);
        watchdog = setTimeout(function () { ctrl.abort(); }, 20000);
        chunks.push(r.value);
        return pump();
      });
    })().then(function () {
      clearTimeout(watchdog);
      /* Basculer sur le blob recharge le film : jamais pendant que le
         visiteur est plus bas, où ce rechargement coûtait une image. */
      var blob = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
      var basculer = function () { attachSource(blob, video.currentTime); };
      if (heroVisible) basculer(); else blobEnAttente = basculer;
    });
  }).catch(function () {
    /* Le direct joue déjà : le blob n'est qu'un confort, son échec
       ne doit pas renvoyer le héro sur l'image fixe. */
    if (!video.readyState) failVideo();
  });
}

/* ---------------------------------------------------------
   La boucle ne tourne que si le héro est à l'écran.
   --------------------------------------------------------- */
var io = new IntersectionObserver(function (es) {
  heroVisible = es[0].isIntersecting;
  if (heroVisible && blobEnAttente) { var f = blobEnAttente; blobEnAttente = null; f(); }
  if (heroVisible && scrubOn) onScroll();
  else if (!heroVisible && rafId !== null) {
    cancelAnimationFrame(rafId); rafId = null;
  }
}, { threshold: 0 });
io.observe(hero);

/* ---------------------------------------------------------
   Les portes du repli, décidées en direct et réévaluées
   si l'appareil tourne ou si la préférence change.
   --------------------------------------------------------- */
/* Le téléphone tenu droit a désormais son film : il n'est plus
   renvoyé sur l'image fixe. Restent sur l'image fixe le téléphone
   couché, trop bas pour la typographie, et le mouvement réduit. */
var GATES = [
  '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
  '(prefers-reduced-motion: reduce)'
];
var MQLS = GATES.map(function (q) { return matchMedia(q); });

/* Le film ne descend qu'une fois la page chargée : lancé plus tôt,
   il disputait la bande passante au poster, et le poster est ce que
   le visiteur voit en premier. Le défilement est déjà branché ; il
   rattrape le film dès que celui-ci est là. */
function quandPageChargee(fn) {
  if (document.readyState === 'complete') fn();
  else window.addEventListener('load', fn, { once: true });
}

function enableScrub() {
  if (scrubOn) return;
  scrubOn = true;
  hero.setAttribute('data-mode', 'scrub');
  racine.classList.add('scrub');
  placerAube();
  quandPageChargee(initHeroOnce);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  bands.forEach(function (b) { b.op = -1; b.k = -1; });
  majBandes(heroProgress());
  onScroll();
}

function disableScrub() {
  if (!scrubOn && hero.getAttribute('data-mode')) return;
  scrubOn = false;
  hero.setAttribute('data-mode', 'still');   /* l'image fixe, rien d'autre */
  racine.classList.remove('scrub');
  racine.style.removeProperty('--jour');
  techs.forEach(function (li) { li.style.removeProperty('opacity'); li._o = null; });
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onScroll);
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }

  /* On efface ce que le scrub avait écrit en ligne : sinon l'opacité
     inline l'emporte sur la feuille de style et le repli reste muet. */
  bands.forEach(function (b) {
    b.el.style.removeProperty('opacity');
    b.el.style.removeProperty('visibility');
    b.el.style.removeProperty('--k');
    b.op = -1; b.k = -1;
  });
  if (fil) fil.style.removeProperty('--p');
}

function applyHeroMode() {
  var gated = MQLS.some(function (m) { return m.matches; });
  if (gated) disableScrub(); else enableScrub();
}

MQLS.forEach(function (m) {
  if (m.addEventListener) m.addEventListener('change', applyHeroMode);
  else m.addListener(applyHeroMode);                /* Safari ancien */
});

/* L'onglet caché ne mérite pas de boucle. */
document.addEventListener('visibilitychange', function () {
  if (document.hidden && rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }
  else if (!document.hidden && scrubOn) onScroll();
});

applyHeroMode();

})();

/* =========================================================
   NOTE-ENCODAGE — à réappliquer à chaque nouveau montage.

   ffmpeg -i master.mov \
     -vf "scale=1280:-2,fps=30" \
     -c:v libx264 -profile:v high -pix_fmt yuv420p \
     -crf 26 -g 1 -keyint_min 1 -sc_threshold 0 \
     -movflags +faststart -an \
     hero-scrub.mp4

   -g 1 -keyint_min 1 : une image clé par image. C'est ce qui rend
   le seek instantané sur Firefox. Mais c'est aussi ce qui pèse :
   sans compression inter-images, le fichier est une suite de JPEG.
   D'où la retenue sur les trois autres réglages.

   Ces valeurs ne sont pas arbitraires, elles ont été mesurées :
   en 1600 / 48 img/s / crf 20 le film pesait 23 Mo, soit 97 % du
   poids de la page, et rien ne bougeait tant qu'il n'était pas
   entièrement descendu. En 1280 / 30 / 26 il pèse 6,6 Mo pour un
   seek médian de 5 ms, et la texture de la feuille d'or tient
   encore au zoom. Ne pas remonter la définition sans remesurer
   le poids : c'est lui qui décide si le visiteur voit le film.

   -an : pas de piste son, le héro est muet.

   Le film des téléphones se tire du film large, coupe au centre
   (le flacon, la feuille et le pinceau y tiennent du début à la
   fin) :

   ffmpeg -i hero-scrub.mp4 \
     -vf "crop=506:900,fps=30" \
     -c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p \
     -crf 24 -g 1 -keyint_min 1 -sc_threshold 0 -bf 0 \
     -movflags +faststart -an \
     hero-scrub-phone.mp4

   4,6 Mo, SSIM 0,981 contre la même coupe du film large.
   Son poster : hero-poster.jpg coupé au centre en 804 x 1428,
   ramené à 720 de large (hero-poster-phone.jpg, 110 Ko).
   ========================================================= */
