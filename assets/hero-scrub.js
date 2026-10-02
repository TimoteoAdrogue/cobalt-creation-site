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

var VIDEO_URL = 'assets/hero-scrub.mp4';

var hero   = document.getElementById('hero');
var stage  = document.querySelector('.stage');
var video  = document.getElementById('hero-video');
var fil    = document.querySelector('.fil');
var bandEls = [].slice.call(document.querySelectorAll('.band'));

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
    else if (i === bands.length - 1) op = smoothstep(p, b.a, b.a + f);
    else op = smoothstep(p, b.a, b.a + f) * (1 - smoothstep(p, b.b - f, b.b));

    var k = clamp((p - b.a) / Math.max(0.001, (b.b - b.a) * 0.4), 0, 1);

    if (Math.abs(op - b.op) > 0.006) { b.op = op; b.el.style.opacity = op.toFixed(3); }
    if (Math.abs(k - b.k) > 0.008)  { b.k = k;  b.el.style.setProperty('--k', k.toFixed(3)); }
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
   Le chargement : on rapatrie le fichier entier avant de
   scruber. Un seek qui doit attendre le réseau saccade ;
   un seek dans un blob local est immédiat.
   --------------------------------------------------------- */
var heroLance = false;

function initHeroOnce() {
  if (heroLance) return;
  heroLance = true;

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
      video.src = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
      video.load();
      video.addEventListener('canplay', function () {
        requestSeek(heroProgress() * video.duration);
        stage.classList.add('video-ready');
      }, { once: true });
    });
  }).catch(failVideo);
}

/* ---------------------------------------------------------
   La boucle ne tourne que si le héro est à l'écran.
   --------------------------------------------------------- */
var io = new IntersectionObserver(function (es) {
  heroVisible = es[0].isIntersecting;
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
var GATES = [
  '(max-width: 820px)',
  '(orientation: portrait) and (max-width: 1024px)',
  '(orientation: portrait) and (pointer: coarse)',
  '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
  '(prefers-reduced-motion: reduce)'
];
var MQLS = GATES.map(function (q) { return matchMedia(q); });

function enableScrub() {
  if (scrubOn) return;
  scrubOn = true;
  hero.setAttribute('data-mode', 'scrub');
  initHeroOnce();
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
  window.removeEventListener('scroll', onScroll);
  window.removeEventListener('resize', onScroll);
  if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; }

  /* On efface ce que le scrub avait écrit en ligne : sinon l'opacité
     inline l'emporte sur la feuille de style et le repli reste muet. */
  bands.forEach(function (b) {
    b.el.style.removeProperty('opacity');
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
   ========================================================= */
