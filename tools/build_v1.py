"""V1 « Nuit & craie »: builds the seven pages of site/ from the client's own words and photographs.

    python3 tools/build_v1.py

Every visible sentence comes from data/*.json through tools/common.py (read-only). The build ends with a copy
check: each visible run of 4+ words, alt, aria-label and meta description must be a substring of the client's
scrape (normalised), or an interface sentence from ALLOW. It fails otherwise.

Media: copies the shared 800/1600 files it uses into site/assets/media/, and writes V1's own large derivatives
(2400 / 3000 px AVIF, never above the original) from src-media/ into site/assets/media/v1/. It never writes
media/ or data/ (no common.ensure_wide()).
"""
import html, json, re, shutil, sys, unicodedata
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import common as c  # noqa: E402

ROOT = c.ROOT
SITE = ROOT / "site"
OUT_MEDIA = SITE / "assets/media"
esc, typo, fix = c.esc, c.typo, c.fix

# ---------------------------------------------------------------- media
BIG = (2400, 3000)
USED = set()          # files under site/assets/media we reference


def stem(name):
    return name.split("~")[0].replace("53e2f6_", "")[:12]


def by_stem(s):
    for n in c.MEDIA_INDEX:
        if stem(n) == s:
            return n
    raise KeyError(s)


def work(s):
    return next(w for w in c.WORKS if stem(w["media"]) == s)


def big_files(name):
    """V1's own large AVIF derivatives, cached; widths capped at the original."""
    m = c.MEDIA_INDEX[name]
    if m["w"] <= 1700:
        return []
    out = []
    for w in sorted({min(x, m["w"]) for x in BIG}):
        if w <= 1700 or w in [o[0] for o in out]:
            continue
        rel = f"v1/{stem(name)}-{w}.avif"
        dst = OUT_MEDIA / rel
        if not dst.exists():
            from PIL import Image, ImageOps
            Image.MAX_IMAGE_PIXELS = None
            im = ImageOps.exif_transpose(Image.open(ROOT / "src-media" / name)).convert("RGB")
            h = round(im.height * w / im.width)
            dst.parent.mkdir(parents=True, exist_ok=True)
            im.resize((w, h), Image.LANCZOS).save(dst, "AVIF", quality=58, speed=6)
            print("  derived", rel, flush=True)
        out.append((w, rel))
    return out


def srcsets(name, b, big=True):
    m = c.MEDIA_INDEX[name]
    files = m["files"]
    for f in files:
        USED.add(f["jpg"]); USED.add(f["avif"])
    av = [(f["w"], f["avif"]) for f in files] + (big_files(name) if big else [])
    for _, r in av:
        USED.add(r)
    avif = ", ".join(f"{b}assets/media/{r} {w}w" for w, r in av)
    jpg = ", ".join(f"{b}assets/media/{f['jpg']} {f['w']}w" for f in files)
    return avif, jpg, files[-1]["jpg"]


def pic(name, b, slot, alt="", cls="", eager=False, pos=None):
    """slot: plein (100vw x 100svh, cover), moitie (50vw x tall, cover), detail (5/12 column, true aspect)."""
    m = c.MEDIA_INDEX[name]
    a = m["w"] / m["h"]
    sizes = {"plein": f"max(100vw, calc(100vh * {a:.3f}))",
             "moitie": f"(min-width: 1001px) max(50vw, calc(100vh * {a:.3f})), 100vw",
             "detail": "(min-width: 1001px) 42vw, 100vw",
             "vignette": "(min-width: 1001px) 30vw, 60vw"}[slot]
    avif, jpg, fall = srcsets(name, b, big=slot in ("plein", "moitie"))
    st = f' style="object-position:{pos}"' if pos else ""
    load = 'loading="eager" fetchpriority="high"' if eager else 'loading="lazy"'
    cl = f' class="{cls}"' if cls else ""
    return (f'<picture><source type="image/avif" srcset="{avif}" sizes="{sizes}">'
            f'<img{cl} src="{b}assets/media/{fall}" srcset="{jpg}" sizes="{sizes}" width="{m["w"]}" height="{m["h"]}"'
            f' alt="{esc(alt)}" {load} decoding="async"{st}></picture>')


def viewer_attrs(name, b, lines, desc):
    """What the viewer needs to show a work at full size (the largest derivative)."""
    m = c.MEDIA_INDEX[name]
    avif, jpg, _ = srcsets(name, b)
    return (f' data-oeuvre data-avif="{avif}" data-jpg="{jpg}" data-w="{m["w"]}" data-h="{m["h"]}"'
            f' data-legende="{esc(" / ".join(lines))}" data-desc="{esc(desc)}"')


# ---------------------------------------------------------------- words
def phrase(s):
    """Sentence case for the client's all-caps headings (« NOS ATELIERS SIGNATURES »)."""
    s = s.strip()
    return s[0] + s[1:].lower() if s.isupper() else s


def paras(text):
    return [typo(fix(p.strip())) for p in re.split(r"\n\s*\n|\n", text) if p.strip()]


def stress(sentence, words, cls=""):
    """Italicise a stretch of the client's own sentence; asserts it is really in it."""
    s = esc(sentence)
    w = esc(words)
    assert w in s, (words, sentence)
    return s.replace(w, f"<em{cls}>{w}</em>", 1)


H = c.home()
COL = H["columns"]
CUR = ' aria-current="page"'
OR = ' class="or"'
NAV_SHORT = {"creation-d-objet-unique": "Ateliers signatures", "ateliers-de-personnalisation": "Animations retail",
             "design-graphique-design-papier": "Studio graphique", "coffrets-packaging": "Atelier parisien"}
NAV_LONG = dict(c.NAV)
# common.NAV's « Nos animations retail sur mesure » is typed, not in the scrape; the client's own heading for
# this rubric on the home page is « Animations retail sur-mesure ».
NAV_LONG["ateliers-de-personnalisation"] = COL[0]["title"]
ORDER = c.RUBRICS  # live order: signatures, retail, studio, atelier parisien
DESC = {s: typo(c.PAGES["pages"][s]["description"].split("\n")[0].strip()) for s in c.PAGES["pages"]}
TITLE = {s: c.PAGES["pages"][s]["title"] for s in c.PAGES["pages"]}
CONTACT_Q = typo(c.PAGES["pages"]["contact-feedback"]["description"])
BOOK = "assets/cobalt-creation-book.pdf"

# Lead photograph of each rubric (its opener, its métier backdrop, its « rubrique suivante » panel).
LEAD = {
    "creation-d-objet-unique": (by_stem("beea44379bf7"), "50% 60%"),
    "ateliers-de-personnalisation": (by_stem("08cb192d62d2"), "50% 38%"),
    "design-graphique-design-papier": (by_stem("40a8eebbf9c0"), "50% 55%"),
    "coffrets-packaging": (by_stem("bf50eca92f9a"), "52% 50%"),
}


# ---------------------------------------------------------------- page frame
def head(slug, b, preload=""):
    t = esc(typo(TITLE[slug]))
    d = esc(DESC[slug])
    canon = "https://www.cobaltcreation.com/" + slug
    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{t}</title>
<meta name="description" content="{d}">
<meta name="theme-color" content="#011E2C">
<link rel="canonical" href="{canon}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:site_name" content="Cobalt Création">
<meta property="og:title" content="{t}">
<meta property="og:description" content="{d}">
<meta property="og:image" content="{b}assets/img/hero-poster.jpg">
<link rel="icon" href="{b}assets/img/logo-cobalt.png" type="image/png">
{preload}<link rel="preload" href="{b}assets/fonts/cormorant-garamond-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{b}assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{b}assets/hero.css">
<link rel="stylesheet" href="{b}assets/site.css">
<script>(function(d){{d.classList.add('js');try{{if(sessionStorage.getItem('v1-pt')){{sessionStorage.removeItem('v1-pt');if(!matchMedia('(prefers-reduced-motion: reduce)').matches){{d.classList.add('pt-in');setTimeout(function(){{d.classList.remove('pt-in')}},1600)}}}}}}catch(e){{}}}})(document.documentElement);</script>
</head>
"""


def nav(slug, b, sol):
    home = slug == ""
    liens = "".join(
        f'<li><a href="{b}{s}/index.html"{CUR if s == slug else ""}>{NAV_SHORT[s]}</a></li>'
        for s in ORDER)
    contact = "#contact" if home else f"{b}contact-feedback/index.html"
    menu = "".join(
        f'<li><a href="{b}{s + "/" if s else ""}index.html"{CUR if s == slug else ""}>{esc(lab)}</a></li>'
        for s, lab in [(k, NAV_LONG[k]) for k, _ in c.NAV])
    cls = "nav" + ("" if home else " montre") + {"nuit": " sur-nuit", "photo": " sur-nuit sur-photo"}.get(sol, "")
    return f"""<header class="{cls}" id="nav">
  <a class="nav-logo" href="{b}index.html" aria-label="Cobalt Création">
    <img class="logo-encre" src="{b}assets/img/logo-cobalt.png" alt="" width="653" height="337">
    <img class="logo-craie" src="{b}assets/img/logo-cobalt-creme.png" alt="" width="653" height="337">
  </a>
  <nav aria-label="Navigation principale"><ul class="nav-liens">{liens}</ul></nav>
  <a class="nav-contact" href="{contact}">Contact</a>
  <button class="nav-menu" type="button" aria-expanded="false" aria-controls="rideau-menu">
    <span class="nav-menu-txt">Menu</span><span class="nav-menu-traits" aria-hidden="true"><i></i><i></i></span>
  </button>
</header>

<div class="rideau-menu" id="rideau-menu" hidden>
  <nav aria-label="Menu"><ol>{menu}</ol></nav>
  <p class="rideau-menu-pied">{esc(c.ADDRESS_LINE)}<br><a href="tel:{c.tel(c.PHONE)}">{esc(c.PHONE)}</a></p>
</div>
"""


def footer(b, relais=True):
    photo = ""
    if relais:
        n = by_stem("13d0253e40a6")
        photo = (f'<figure class="pied-relais relais" data-de="craie" data-a="nuit" data-sol="photo" aria-hidden="true">'
                 f'{pic(n, b, "plein", pos="50% 46%")}<span class="voile"></span></figure>')
    return f"""<footer class="pied nuit{' avec-relais' if relais else ''}" data-sol="nuit">
  {photo}
  <p class="pied-mot">Cobalt Création</p>
  <div class="pied-grille">
    <p>Agence Cobalt Création<br>{esc(c.ADDRESS_LINE)}</p>
    <p><a href="tel:{c.tel(c.PHONE)}">{esc(c.PHONE)}</a><br><a href="mailto:{c.EMAIL}">{c.EMAIL}</a><br>{esc(typo(c.HOURS))}</p>
    <p class="pied-liens">
      <a href="{c.INSTAGRAM}" rel="noopener">Instagram</a>
      <a href="{b}{BOOK}" download>{esc(H["book_link"])}<span class="poids"> (PDF, {c.BOOK_SIZE})</span></a>
      <a href="{b}contact-feedback/index.html">L’équipe</a>
      <a href="{b}politique-de-confidentialite/index.html">Confidentialité</a>
    </p>
    <a class="haut" href="#top">Haut de page</a>
  </div>
</footer>
"""


def page(slug, body_cls, main, sol, b, pre_main="", relais_pied=True, preload=""):
    scripts = (f'<script src="{b}assets/hero-scrub.js" defer></script>\n' if slug == "" else "")
    return (head(slug, b, preload) + f'<body class="{body_cls}" id="top">\n\n<a class="skip" href="#contenu">Aller au contenu</a>\n\n'
            + nav(slug, b, sol) + pre_main + f'\n<main id="contenu">\n{main}\n</main>\n\n' + footer(b, relais_pied)
            + scripts + f"""<script>
addEventListener('load', function () {{
  var m = document.createElement('script');
  m.src = '{b}assets/vendor/motion.js';
  m.onload = m.onerror = function () {{ var s = document.createElement('script'); s.src = '{b}assets/site.js'; document.body.appendChild(s); }};
  document.body.appendChild(m);
}}, {{ once: true }});
</script>
</body>
</html>
""")


# ---------------------------------------------------------------- pieces
def caption(w, cls="legende"):
    lines = c.work_lines(w)
    if not lines:
        return ""
    head_, rest = lines[0], lines[1:]
    r = "".join(f'<span class="leg-ligne">{esc(x)}</span>' for x in rest)
    return f'<figcaption class="{cls}"><span class="leg-maison">{esc(head_)}</span>{r}</figcaption>'


def piece(w, b, slot, cls="", pos=None, desc=False, lit=False):
    lines = c.work_lines(w)
    d = c.work_desc(w)
    alt = c.work_alt(w)
    img = pic(w["media"], b, slot, alt=alt, pos=pos)
    voile = '<span class="voile" aria-hidden="true"></span>' if lit else ""
    btn = (f'<button class="ouvrir" type="button" data-curseur="Voir"{viewer_attrs(w["media"], b, lines, d)}'
           f' aria-label="{esc(alt or "Voir")}">{img}{voile}</button>')
    txt = ""
    if desc and d:
        txt = '<div class="piece-desc">' + "".join(f"<p>{esc(p)}</p>" for p in paras(d)) + "</div>"
    return f'<figure class="piece piece-{slot} {cls}">{btn}{caption(w)}{txt}</figure>'


def plein(w, b, de, a, pos=None, lit=False):
    m = c.MEDIA_INDEX[w["media"]]
    rel = de != a
    attrs = f' data-de="{de}" data-a="{a}"' if rel else ""
    return (f'<div class="plein{" relais" if rel else ""}"{attrs} data-sol="photo">'
            f'{piece(w, b, "plein", pos=pos, lit=lit or rel)}</div>')


def rythme(items, b, sol, lit=False):
    """Three scales in a repeating phrase: full-bleed (sharp landscapes), a pair of full-height halves,
    a detail with its description. Order follows the client's; a full-bleed beat pulls the next landscape forward."""
    q = list(items)
    out, beat, side = [], 0, 0
    sharp = lambda w: (c.MEDIA_INDEX[w["media"]]["w"] / c.MEDIA_INDEX[w["media"]]["h"] >= 1.3
                       and c.MEDIA_INDEX[w["media"]]["w"] >= 2400)
    n_in = len(q)
    while q:
        kind = ("plein", "paire", "detail")[beat % 3]
        beat += 1
        if kind == "plein":
            k = next((i for i, w in enumerate(q) if sharp(w)), None)
            if k is None:
                continue
            out.append(plein(q.pop(k), b, sol, sol, lit=lit))
        elif kind == "paire":
            if len(q) < 2:
                continue          # the next beat is the detail
            p1, p2 = q.pop(0), q.pop(0)
            out.append(f'<div class="paire">{piece(p1, b, "moitie", lit=lit)}{piece(p2, b, "moitie", lit=lit)}</div>')
        else:
            w = q.pop(0)
            side ^= 1
            out.append(f'<div class="detail{" detail-droite" if side else ""}">{piece(w, b, "detail", desc=True, lit=lit)}</div>')
    html_ = "\n".join(out)
    assert html_.count('class="piece piece-') == n_in, "rythme: every work placed exactly once"
    return html_


def lecture(text, tag="p", cls="titre", base="0.28", em=None, em_cls=""):
    inner = stress(text, em, em_cls) if em else esc(text)
    return f'<{tag} class="{cls}" data-lecture="{base}">{inner}</{tag}>'


def form():
    return """<form class="form" novalidate>
      <div class="duo">
        <div class="champ"><input id="f-prenom" name="prenom" type="text" autocomplete="given-name" placeholder=" "><label for="f-prenom">Prénom</label></div>
        <div class="champ"><input id="f-nom" name="nom" type="text" autocomplete="family-name" placeholder=" "><label for="f-nom">Nom</label></div>
      </div>
      <div class="champ"><input id="f-maison" name="maison" type="text" autocomplete="organization" placeholder=" "><label for="f-maison">Maison</label></div>
      <div class="champ">
        <input id="f-email" name="email" type="email" autocomplete="email" required placeholder=" "><label for="f-email">Email</label>
        <p class="err" id="err-email" hidden>Merci d’indiquer une adresse email valide.</p>
      </div>
      <div class="champ"><textarea id="f-message" name="message" rows="4" placeholder=" "></textarea><label for="f-message">Votre projet</label></div>
      <button class="envoi" type="submit">Nous écrire</button>
      <p class="etat" id="etat-form" role="status" hidden></p>
    </form>"""


def coordonnees(b, grand=True):
    return f"""<address class="coord{' coord-grand' if grand else ''}">
      <p class="coord-adr">Agence Cobalt Création<br>{esc(c.ADDRESS_LINE)}</p>
      <p><span class="label">Téléphone</span><a href="tel:{c.tel(c.PHONE)}">{esc(c.PHONE)}</a></p>
      <p><span class="label">Email</span><a href="mailto:{c.EMAIL}">{c.EMAIL}</a></p>
      <p class="coord-h">{esc(typo(c.HOURS))}</p>
      <p><a class="lien" href="{b}{BOOK}" download>{esc(H["book_link"])}<span class="poids"> (PDF, {c.BOOK_SIZE})</span></a></p>
    </address>"""


def gestes(b, heading_tag="h2"):
    tech = [w for w in c.works("creation-d-objet-unique") if c.work_desc(w)]
    assert len(tech) == 8
    pos = {"La Gravure": "62% 50%", "La feuille d’or": "55% 50%", "L’illustration": "46% 50%",
           "L’embossage et la dorure à chaud": "42% 50%", "La peinture": "40% 50%", "La broderie": "45% 50%",
           "L’aérographe": "50% 50%", "La calligraphie": "58% 50%"}
    lis, frames = [], []
    for i, w in enumerate(tech):
        t = c.work_lines(w)[0]
        ps = paras(c.work_desc(w))
        mat, rest = ps[0], ps[1:]
        lis.append(f'<li class="geste{" actif" if i == 0 else ""}" data-i="{i}"><h3>{esc(t)}</h3>'
                   f'<p class="geste-mat">{esc(mat)}</p>' + "".join(f"<p>{esc(p)}</p>" for p in rest)
                   + f'<div class="geste-photo">{pic(w["media"], b, "moitie", alt=c.work_alt(w), pos=pos.get(t))}</div></li>')
        frames.append(pic(w["media"], b, "moitie", cls="on" if i == 0 else "", pos=pos.get(t)))
    titre = phrase(c.heading("creation-d-objet-unique")[0])
    return f"""<section class="gestes craie" id="savoir-faire" data-sol="craie" data-nom="{esc(titre)}">
  <header class="scene-tete">
    <{heading_tag} class="titre-scene">{esc(titre)}</{heading_tag}>
    <p class="texte">{esc(c.intro("creation-d-objet-unique")[1])}</p>
  </header>
  <div class="gestes-corps">
    <ol class="gestes-liste">{"".join(lis)}</ol>
    <div class="gestes-cadre" aria-hidden="true"><div class="gestes-fenetre">{"".join(frames)}</div></div>
  </div>
</section>"""


# ---------------------------------------------------------------- home
def build_home():
    b = ""
    col3 = COL[2]
    hero = f"""<section class="hero" id="hero" aria-label="Cobalt Création" data-sol="photo">
  <div class="stage">
    <div class="poster" role="img" aria-label="{esc(col3["title"])}"></div>
    <video id="hero-video" class="film" preload="none" muted playsinline disablepictureinpicture tabindex="-1" aria-hidden="true"></video>
    <div class="veil" aria-hidden="true"></div>
    <div class="bands">
      <div class="band" data-a="0.00" data-b="0.30">
        <p class="kicker">{esc(col3["title"])}</p>
        <h1 class="band-h"><img src="assets/img/logo-cobalt-creme.png" alt="Cobalt Création" class="wordmark" width="653" height="337" fetchpriority="high"></h1>
        <p class="band-lede">{esc(typo(c.PAGES["pages"][""]["description"].split(chr(10))[0].strip()))}</p>
      </div>
      <div class="band band-tech" data-a="0.27" data-b="0.60">
        <p class="kicker">{esc(col3["lead"])}</p>
        <ul class="techniques">{"".join(f"<li>{esc(t)}</li>" for t in col3["bullets"])}</ul>
      </div>
      <div class="band" data-a="0.57" data-b="1.00">
        <p class="band-h">{stress("Donner de l’âme et de la couleur à vos ateliers de personnalisation.", "l’âme et de la couleur")}</p>
        <a class="cta" href="#realisations">Voir nos réalisations</a>
      </div>
    </div>
    <div class="aube" aria-hidden="true"><b class="aube-lave"></b><i class="aube-jour"></i></div>
    <div class="fil" aria-hidden="true"></div>
  </div>
</section>
"""
    ag = H["agence"]
    maison = f"""<section class="maison craie" id="maison" data-sol="craie" data-nom="{esc(H["title"])}">
  <h2 class="label">{esc(H["title"])}</h2>
  {lecture(ag[0], cls="display manifeste", base="0.22", em="depuis plus de 10 ans")}
  <p class="texte maison-txt">{esc(ag[1])}</p>
</section>"""

    # Réalisations: the room goes dark under the first piece, then each piece is lit as it arrives.
    W = lambda s: work(s)
    lampe_img = by_stem("430ff5e51a03")
    oeuvres = f"""{plein(W("bf5377469999"), b, "craie", "nuit", pos="50% 55%")}
<section class="oeuvres nuit" id="realisations" data-sol="nuit" data-nom="Réalisations">
  <h2 class="label">Réalisations</h2>
  <div class="paire">{piece(W("396411c5f961"), b, "moitie", lit=True, pos="50% 40%")}{piece(W("e81a1d324247"), b, "moitie", lit=True)}</div>
  <div class="lampe-scene">
    <figure class="lampe" id="lampe">
      <div class="lampe-plaque">
        {pic(lampe_img, b, "moitie", cls="lampe-base", alt=col3["title"])}
        {pic(lampe_img, b, "moitie", cls="lampe-lumiere")}
      </div>
      <figcaption><span class="lampe-aide" aria-hidden="true">Approchez la lampe</span></figcaption>
    </figure>
    <div class="lampe-texte">
      <h3 class="label">{esc(col3["title"])}</h3>
      {lecture(col3["paras"][0], cls="titre", base="0.24", em="un savoir-faire artisanal", em_cls=' class="or"')}
      <p class="texte">{esc(col3["paras"][1])}</p>
    </div>
  </div>
  {plein(W("dd7d7397eb9f"), b, "nuit", "nuit", lit=True)}
  <div class="paire">{piece(W("6cf80f2f42c2"), b, "moitie", lit=True)}{piece(W("fb314fe1673a"), b, "moitie", lit=True)}</div>
</section>"""

    noms = [l["name"] for l in c.LOGOS]
    mur = '<span class="sep" aria-hidden="true"> · </span>'.join(f'<span class="nom">{esc(n)}</span>' for n in noms)
    confiance = f"""<section class="confiance nuit" data-sol="nuit" data-nom="{esc(phrase(H["trust_title"]))}">
  <h2 class="label">{esc(phrase(H["trust_title"]))}</h2>
  <p class="mur" data-lecture="0.16">{mur}</p>
</section>"""

    met_f, met_l = [], []
    for i, s in enumerate(ORDER):
        n, pos = LEAD[s]
        met_f.append(f'<div class="fond{" on" if i == 0 else ""}">{pic(n, b, "plein", pos=pos)}</div>')
        met_l.append(f'<li><a class="metier{" actif" if i == 0 else ""}" href="{s}/index.html" data-i="{i}">'
                     f'<span class="metier-titre">{esc(NAV_LONG[s])}</span>'
                     f'<span class="metier-txt">{esc(c.intro(s)[0])}</span></a></li>')
    metiers = f"""<section class="metiers nuit" id="metiers" data-sol="photo" data-nom="Nos métiers">
  <div class="metiers-fond" aria-hidden="true">{"".join(met_f)}<span class="metiers-voile"></span></div>
  <ul class="metiers-liste">{"".join(met_l)}</ul>
</section>"""

    relais2 = by_stem("4922bf49ba42")
    groupes = []
    for g in c.team():
        gens = "".join(f'<li><span class="qui">{esc(p["name"])}</span><span class="role">{esc(typo(p["role"]))}</span></li>'
                       for p in g["people"])
        groupes.append(f'<div class="groupe"><h3 class="label">{esc(phrase(g["name"]))}</h3><ul>{gens}</ul></div>')
    equipe = f"""<div class="plein relais" data-de="nuit" data-a="craie" data-sol="photo" aria-hidden="true">
  <figure class="piece piece-plein">{pic(relais2, b, "plein", pos="50% 50%")}<span class="voile"></span></figure>
</div>
<section class="equipe craie" id="equipe" data-sol="craie" data-nom="L’équipe">
  <h2 class="label">L’équipe</h2>
  <div class="groupes">{"".join(groupes)}</div>
</section>"""

    contact = f"""<section class="contact craie" id="contact" data-sol="craie" data-nom="Contact">
  <div class="contact-tete">
    <h2 class="display">{esc(phrase(c.heading("contact-feedback")[0]))}</h2>
    {lecture(CONTACT_Q.split("? ")[0] + "? " + CONTACT_Q.split("? ")[1] + "?", cls="titre", base="0.28")}
  </div>
  <div class="contact-corps">
    {coordonnees(b)}
    {form()}
  </div>
</section>"""
    pre = ('<link rel="preload" href="assets/img/hero-poster.webp" as="image" type="image/webp" media="(orientation: landscape)" fetchpriority="high">\n'
           '<link rel="preload" href="assets/img/hero-poster-phone.webp" as="image" type="image/webp" media="(orientation: portrait)" fetchpriority="high">\n')
    main = "\n".join([maison, gestes(b), oeuvres, confiance, metiers, equipe, contact])
    return page("", "accueil", main, "photo", b, pre_main=hero, preload=pre)


# ---------------------------------------------------------------- rubric pages
def ouverture(slug, b, h_lines, eager=True):
    n, pos = LEAD[slug]
    h = "<br>".join(esc(phrase(x)) for x in h_lines)
    return f"""<section class="ouverture relais" data-de="nuit" data-a="craie" data-sol="photo">
  <div class="ouverture-photo">{pic(n, b, "plein", eager=eager, pos=pos)}</div>
  <span class="voile" aria-hidden="true"></span>
  <div class="ouverture-txt">
    <p class="label">Réalisations</p>
    <h1 class="display">{h}</h1>
  </div>
</section>"""


def suite(slug, b):
    i = ORDER.index(slug)
    nxt = ORDER[(i + 1) % len(ORDER)]
    n, pos = LEAD[nxt]
    return f"""<a class="suite plein relais" data-de="craie" data-a="nuit" data-sol="photo" href="{b}{nxt}/index.html">
  <span class="piece piece-plein">{pic(n, b, "plein", pos=pos)}<span class="voile" aria-hidden="true"></span></span>
  <span class="suite-txt"><span class="label">Rubrique suivante</span><span class="display suite-titre">{esc(NAV_LONG[nxt])}</span></span>
</a>"""


# The verb of each process sentence on Animations retail (a stretch of the client's own words).
METHODE = {
    1: "pensée pour vous", 2: "de la conception", 3: "la technique, la gestuelle, le set-up",
    4: "nos artistes et artisans qualifiés", 5: "des guidelines détaillées",
}


def build_rubric(slug):
    b = "../"
    items = c.works(slug)
    assert len(items) == c.RUBRIC_COUNTS[slug], (slug, len(items))
    intro = c.intro(slug)
    if slug == "ateliers-de-personnalisation":
        texte = (lecture(intro[0], cls="display-s", base="0.22") + '<ol class="methode">'
                 + "".join(f"<li>{lecture(p, cls='titre', base='0.24', em=METHODE[k], em_cls=OR)}</li>"
                           for k, p in enumerate(intro[1:], 1)) + "</ol>")
    else:
        texte = lecture(intro[0], cls="display-s", base="0.22") + "".join(f'<p class="texte">{esc(p)}</p>' for p in intro[1:])
    if slug == "creation-d-objet-unique":
        rest = [w for w in items if not c.work_desc(w)]
        corps = gestes(b, "h2") + f'\n<section class="rubrique craie" data-sol="craie">{rythme(rest, b, "craie")}</section>'
    else:
        corps = f'<section class="rubrique craie" data-sol="craie">{rythme(items, b, "craie")}</section>'
    main = f"""{ouverture(slug, b, c.heading(slug))}
<section class="intro craie" data-sol="craie">{texte}</section>
{corps}
{suite(slug, b)}"""
    return page(slug, f"page p-{slug}", main, "photo", b, relais_pied=False)


def build_contact():
    b = "../"
    slug = "contact-feedback"
    groupes = []
    for g in c.team():
        gens = []
        for p in g["people"]:
            j = []
            if p.get("email"):
                j.append(f'<a href="mailto:{p["email"]}">{p["email"]}</a>')
            if p.get("phone"):
                j.append(f'<a href="tel:{c.tel(p["phone"])}">{esc(p["phone"])}</a>')
            gens.append(f'<li><span class="qui">{esc(p["name"])}</span><span class="role">{esc(typo(p["role"]))}</span>'
                        f'<span class="joindre">{"<br>".join(j)}</span></li>')
        groupes.append(f'<div class="groupe"><h3 class="label">{esc(phrase(g["name"]))}</h3><ul>{"".join(gens)}</ul></div>')
    q = CONTACT_Q.split("? ")
    n = by_stem("08cb192d62d2")
    main = f"""<section class="contact contact-page craie" id="contact" data-sol="craie">
  <div class="contact-ouverture">
    <div class="contact-tete">
      <h1 class="display">{esc(phrase(c.heading(slug)[0]))}</h1>
      {lecture(q[0] + "? " + q[1] + "?", cls="titre", base="0.28")}
      <p class="texte">{esc(q[2])}</p>
      {coordonnees(b)}
    </div>
    <div class="contact-photo">{pic(n, b, "moitie", eager=True, pos="50% 40%")}</div>
  </div>
  <div class="contact-corps contact-corps-seul">{form()}</div>
</section>
<section class="equipe craie" id="equipe" data-sol="craie">
  <h2 class="label">L’équipe</h2>
  <div class="groupes">{"".join(groupes)}</div>
</section>"""
    return page(slug, "page p-contact", main, "craie", b)


def build_privacy():
    b = "../"
    out, in_list = [], False
    for bl in c.privacy():
        t = esc(typo(bl["text"]))
        if bl["tag"] == "li":
            if not in_list:
                out.append("<ul>"); in_list = True
            out.append(f"<li>{t}</li>"); continue
        if in_list:
            out.append("</ul>"); in_list = False
        if bl["tag"] == "h1":
            out.append(f'<h1 class="display">{esc(phrase(bl["text"]))}</h1>')
        elif bl["tag"] in ("h2", "h3"):
            out.append(f"<h2>{t}</h2>")
        else:
            out.append(f"<p>{t}</p>")
    if in_list:
        out.append("</ul>")
    main = f'<section class="legal craie" data-sol="craie"><div class="texte-legal">{"".join(out)}</div></section>'
    return page("politique-de-confidentialite", "page p-legal", main, "craie", b)


# ---------------------------------------------------------------- copy check
ALLOW = {  # interface sentences (4+ words) that are not the client's and say nothing about the client
    "merci d'indiquer une adresse email valide",
    "pdf 9 7 mo",            # format and measured size of the client's own book (common.BOOK_SIZE)
}


def norm(s):
    s = unicodedata.normalize("NFKC", html.unescape(s)).replace("’", "'").replace("œ", "oe").lower()
    s = re.sub(r"[^\w']+", " ", s)
    return " ".join(s.split())


def corpus():
    """The client's text, raw and with the documented typo fixes (common.FIXES). Within one page the Wix lines
    are joined in reading order (a paragraph is split one line per block); pages, works and logos stay apart."""
    src = []
    for pg in c.PAGES["pages"].values():
        src += [" ".join(b["text"] for b in pg["blocks"]), pg["description"], pg["title"]]
    for w in c.WORKS:
        src += [w["title"], w["description"]]
    src += [l["name"] for l in c.LOGOS]
    src = [t for t in src if t]
    return " | ".join(norm(t) for t in src + [fix(t) for t in src])


class Runs(HTMLParser):
    BREAK = {"p", "h1", "h2", "h3", "li", "span", "a", "label", "figcaption", "button", "br", "address", "title", "em"}

    def __init__(self):
        super().__init__(); self.runs = []; self.buf = []; self.stack = []

    def flush(self):
        t = " ".join("".join(self.buf).split()); self.buf = []
        if t:
            self.runs.append(t)

    def handle_starttag(self, tag, a):
        if tag in self.BREAK and tag != "em":
            self.flush()
        self.stack.append(tag)
        a = dict(a)
        for k in ("alt", "aria-label", "content", "data-legende", "data-desc"):
            v = a.get(k)
            if v and (k != "content" or a.get("name") == "description" or a.get("property") in ("og:description", "og:title")):
                self.runs.append(v)

    def handle_endtag(self, tag):
        if tag != "em":
            self.flush()
        if self.stack:
            self.stack.pop()

    def handle_data(self, d):
        if not (self.stack and self.stack[-1] in ("script", "style")):
            self.buf.append(d)


def copy_check(pages):
    corp = corpus()
    bad, short, n = [], set(), 0
    for rel, text in pages.items():
        c.check_no_dashes(text, rel)
        r = Runs(); r.feed(text); r.flush()
        for run in r.runs:
            for part in run.split(" / "):  # viewer captions join the work's own lines with « / »
                k = norm(part)
                if not k:
                    continue
                if len(k.split()) <= 3:
                    if k not in corp:
                        short.add(part)
                    continue
                n += 1
                if k not in corp and k not in ALLOW:
                    bad.append((rel, part))
    print(f"copy check: {n} runs of 4+ words, {len(bad)} unsourced")
    print("  short labels not in the scrape (interface words, judged by hand):", sorted(short))
    for rel, t in bad:
        print("  UNSOURCED", rel, "|", t[:140])
    assert not bad, "copy check failed"


# ---------------------------------------------------------------- main
def main():
    pages = {"index.html": build_home()}
    for s in c.RUBRICS:
        pages[f"{s}/index.html"] = build_rubric(s)
    pages["contact-feedback/index.html"] = build_contact()
    pages["politique-de-confidentialite/index.html"] = build_privacy()
    copy_check(pages)
    for rel, t in pages.items():
        c.write(SITE, rel, t)
    # media: copy what is used, drop what is not (V1's own derivatives are kept as a cache only while used)
    OUT_MEDIA.mkdir(parents=True, exist_ok=True)
    for rel in USED:
        dst = OUT_MEDIA / rel
        if rel.startswith("v1/"):
            continue
        if not dst.exists() or dst.stat().st_size != (c.MEDIA / rel).stat().st_size:
            shutil.copy2(c.MEDIA / rel, dst)
    for f in OUT_MEDIA.rglob("*"):
        if f.is_file() and str(f.relative_to(OUT_MEDIA)) not in USED:
            f.unlink()
    book = SITE / BOOK
    if not book.exists():
        shutil.copy2(c.MEDIA / "cobalt-creation-book.pdf", book)
    old = SITE / "assets/img/work"
    if old.exists():
        shutil.rmtree(old)
    c.write(SITE, "robots.txt", "User-agent: *\nDisallow: /\n")
    print("v1 built:", len(pages), "pages,", len(USED), "media files")


if __name__ == "__main__":
    main()
