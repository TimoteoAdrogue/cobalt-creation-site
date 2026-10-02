/* =========================================================
   Cobalt Création — le corps de la page.
   Deux choses seulement : les entrées au défilement, et le
   formulaire. Aucune bibliothèque, aucun écouteur de scroll.
   ========================================================= */
(function () {
'use strict';

var doux = matchMedia('(prefers-reduced-motion: reduce)');

/* ---------------------------------------------------------
   Les entrées.
   IntersectionObserver, jamais un écouteur de `scroll` : le
   navigateur nous prévient, on ne l'interroge pas à chaque image.
   Chaque élément n'est observé que jusqu'à sa première venue.
   --------------------------------------------------------- */
var aVoir = [].slice.call(document.querySelectorAll('.reveal'));

if (doux.matches || !('IntersectionObserver' in window)) {
  aVoir.forEach(function (el) { el.classList.add('vu'); });
} else {
  var io = new IntersectionObserver(function (entrees) {
    entrees.forEach(function (e) {
      /* `isIntersecting` seul ne suffit pas : sur un défilement très
         rapide (barre tirée à la main, touche Fin), un élément peut
         entrer et sortir entre deux livraisons de l'observateur, et
         il resterait alors invisible pour de bon. On rattrape donc
         aussi tout ce qui est déjà passé au-dessus de l'écran. */
      if (!e.isIntersecting && e.boundingClientRect.top > 0) return;
      e.target.classList.add('vu');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

  aVoir.forEach(function (el) { io.observe(el); });
}

/* ---------------------------------------------------------
   La barre.
   Elle apparaît quand le héro a fini de passer. On observe le
   héro plutôt que d'écouter le défilement : même raison
   qu'au-dessus.
   --------------------------------------------------------- */
var nav  = document.getElementById('nav');
var hero = document.getElementById('hero');

if (nav && hero && 'IntersectionObserver' in window) {
  var ioNav = new IntersectionObserver(function (es) {
    /* le héro n'est plus à l'écran : la barre peut descendre */
    nav.classList.toggle('montre', !es[0].isIntersecting);
  }, { threshold: 0 });
  ioNav.observe(hero);
} else if (nav) {
  nav.classList.add('montre');
}

/* ---------------------------------------------------------
   Le formulaire.
   Il n'y a pas de serveur derrière ce fichier : on valide,
   puis on passe la main au client de messagerie. Le jour où
   un point d'envoi existe, seul `envoyer` change.
   --------------------------------------------------------- */
var form = document.querySelector('.form');
if (!form) return;

var email  = document.getElementById('f-email');
var erreur = document.getElementById('err-email');
var etat   = document.getElementById('etat-form');
var bouton = form.querySelector('.envoi');

function emailValide(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

function marquer(ok) {
  var champ = email.closest('.champ');
  champ.classList.toggle('invalide', !ok);
  erreur.hidden = ok;
  email.setAttribute('aria-invalid', ok ? 'false' : 'true');
}

email.addEventListener('blur', function () {
  if (email.value.trim()) marquer(emailValide(email.value));
});
email.addEventListener('input', function () {
  if (!erreur.hidden && emailValide(email.value)) marquer(true);
});

form.addEventListener('submit', function (e) {
  e.preventDefault();

  if (!emailValide(email.value)) {
    marquer(false);
    email.focus();
    return;
  }
  marquer(true);

  var prenom  = (document.getElementById('f-prenom').value || '').trim();
  var nom     = (document.getElementById('f-nom').value || '').trim();
  var message = (document.getElementById('f-message').value || '').trim();

  var corps =
    'Prénom : ' + prenom + '\n' +
    'Nom : ' + nom + '\n' +
    'Email : ' + email.value.trim() + '\n\n' +
    message;

  bouton.disabled = true;
  etat.hidden = false;
  etat.textContent = 'Votre message s’ouvre dans votre messagerie.';

  window.location.href =
    'mailto:contact@cobaltcreation.com' +
    '?subject=' + encodeURIComponent('Projet : ' + (prenom + ' ' + nom).trim()) +
    '&body=' + encodeURIComponent(corps);

  setTimeout(function () { bouton.disabled = false; }, 2500);
});

})();
