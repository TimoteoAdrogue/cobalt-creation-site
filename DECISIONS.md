# V1 « Nuit & craie » : decisions log

## Pass of 4-12 November 2026 (review stage 3)

Inputs: `reviews/v1/1-critique.md`, `2-solutions.md`, decisions in `reviews/v1/3-decisions.md` (all outside this repo).
Identity kept: the approved scrubbed film (file, encoding and 380 vh course untouched), then a chalk body,
Cormorant Garamond, quiet luxury.

### V1 is now generated
- `tools/build_v1.py` (canonical copy in the project's `tools/`, carried here as `tools/build_v1.py`) writes the
  seven pages from `data/*.json` through `tools/common.py`. Run it from the project root:
  `python3 tools/build_v1.py`. Do not hand-edit the HTML any more.
- The build ends with a copy check: every visible run of 4+ words, every alt, aria-label, meta description and
  viewer caption must be found in the client's scrape (raw or with the documented typo fixes of `common.FIXES`).
  Allowed exceptions: « Merci d'indiquer une adresse email valide. » and the book's « (PDF, 9,7 Mo) ». Last run:
  540 runs, 0 unsourced. Short labels (3 words or fewer) are interface words: Menu, Contact, Réalisations,
  Rubrique suivante, Voir nos réalisations, Approchez la lampe, Haut de page, Nous écrire, form field labels.
- All 70 works are on their rubric pages (14 / 20 / 22 / 14), asserted by the build.

### Copy changes against the previous V1 (all invented text removed)
- Gone: the hero bands « Graver, dorer, broder… » and « depuis 2014 », the second half of the manifesto, the stat
  counter (10+ / 58 / 14 / 9), the eight gesture texts and material lists, the four method steps, the four métier
  texts, « Un atelier, pas un bureau », « Dites-nous ce que vos clients… », « Nous répondons sous deux jours
  ouvrés », « Du lundi au vendredi », the invented rubric ledes and the descriptive alt texts.
- In their place, the client's own words: the home meta description as the hero lede (« Mettre en lumière
  l'univers du Luxe… »), the « Atelier parisien » technique list, the mission fragment, « Notre agence », the
  Ateliers signatures intro and each technique's own description, the 56 names of the logo wall under « Ils nous
  font confiance », each rubric's intro, the five process sentences on *Animations retail*, the team exactly as
  published, the contact page sentence, the footer lines, « Horaires d'ouverture : 9h30 - 18h30 ».
- The retail rubric is labelled « Animations retail sur-mesure » (the client's own home heading for it):
  `common.NAV`'s « Nos animations retail sur mesure » is not in the scrape.
- The book is served by the site itself (`assets/cobalt-creation-book.pdf`, 9,7 Mo): no request to the client's
  domain.

### The system
1. **Two grounds, changed only under a photograph.** No gradient band anywhere. A relay is a full-bleed client
   photograph whose box is one ground above its middle and the other below; its feathered edges meet each ground,
   and a night veil on it is scrubbed so the room dims (chalk to night) or lights (night to chalk). Sections keep
   opaque grounds, so contrast checks and the no-JS page stay true. No section margin leaks through
   (`display: flow-root`).
2. **Light is the transition.** The film ends at the brush tip: the frame lifts toward chalk while daylight opens
   from the gold leaf, and the client's first sentence arrives inside it (one plain fade layer and one scaled disc;
   no blend mode over the playing video). On night, each photograph is lit as it reaches the reading line. The
   viewer dims the work and the lamp follows the pointer. Changing page closes night onto the clicked point; the
   next page opens from a pool of light (`@property` radius, CSS only on arrival, skipped under reduced motion).
3. **Reading.** Display sentences light word by word as they are read (one engine, one scroll loop in `site.js`).
4. **Photographs at their own proportions, three scales**: full-bleed, full-height half, detail. V1's own AVIF
   derivatives at 2400 / 3000 px are cut from the client's originals in `src-media/` (`assets/media/v1/`), never
   above the original's width; the 800 / 1600 files are copied from the shared pool. Studio packshots on chalk use
   `mix-blend-mode: multiply` so their white becomes the page's chalk. **No colour grade**: owner's decision of
   8 Nov; every photograph is shown as delivered.
5. **No chrome.** No rail, no progress line, no counter, no hairlines, no boxed buttons. The nav is type only; its
   colour follows the ground under it, behind it the ground itself fades downward (no bar), and it steps aside on
   the way down.

### Home, in order
Film → light → « Notre agence » (lit sentence) → Nos ateliers signatures (eight techniques, sticky full-height
photo) → Givenchy notebooks carry the change to night → Réalisations (pairs and full-bleeds lit one by one, the
lamp on the « Atelier parisien » bee bottle) → Ils nous font confiance (the wall of 56 names, read) → the four
rubrics over their lit photographs → Rebatchi bottles carry the change to chalk → L'équipe → Nous contacter →
Evidens card carries the change to night under the edge-to-edge wordmark.

### Rubric pages
Full-bleed lead photograph with the title on it, feathered into chalk; the intro as a lit sentence (on
*Animations retail*, the five process sentences); every work placed by its aspect in a repeating phrase
(full-bleed when a sharp landscape, a pair of halves, a detail with its description); the next rubric's photograph
as the last relay into the footer. Every work opens the viewer.

### Verified (12 Nov)
- `node tools/verify.mjs http://localhost:8840/v1/` : problems 0 (7 pages x 1440 / 768 / 390, focus, reduced motion).
- `node tools/fps.mjs` : home median 16,7 ms, p99 16,8 ms on three runs; Studio graphique 16,7 / 16,8.
- 390 px: `scrollWidth` 390 on every page, nothing outside the viewport but the skip link.
- No-JS and reduced motion: every section shows its content; the film's foot dissolves into chalk as a still.

### Open for the owner
- Body typeface: specimen of three options in `reviews/v1/type-specimen.png`; recommendation Cormorant Garamond +
  Ysabeau Office (the companion sans by Cormorant's own designer). The site is built with the current faces.
- The client's retail film (`src-media/atelier-video.mp4`) could open *Animations retail*; deferred.
