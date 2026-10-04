# Kaixing Zhang — Academic Homepage

Personal academic website for Kaixing Zhang (ShanghaiTech University).

## Local preview

Open `index.html` directly in a browser. Static HTML/CSS/JS, no build step.

## Editing

- `index.html`: text, publications, links, images. Search for `TODO` for items still to fill in.
- `stylesheet.css`: layout, typography, colors.
- `navigation.js`: section navigation.
- `interactions.js`: highlighted/all-papers toggle, figure preview and back-to-top button.
- `liquid-glass.js`: liquid glass effect for elements marked `data-liquid-glass` (refraction, chromatic aberration, cursor-lit rims, elastic hover).
- `assets/`: images, fonts, icons (with third-party license files).

## Deployment

Push to a repository named `<username>.github.io`; `.github/workflows/jekyll-pages.yml` builds and deploys GitHub Pages on push to `main`.

## Credits

Layout adapted from [TidalHarley/TidalHarley.github.io](https://github.com/TidalHarley/TidalHarley.github.io), itself adapted from [d-finite/d-finite.github.io](https://github.com/d-finite/d-finite.github.io) and [Jon Barron's homepage](https://jonbarron.github.io/). Paper figures are taken from the respective arXiv papers.

- Outfit font: SIL Open Font License, see `assets/fonts/outfit-OFL.txt`.
- Liquid glass effect ported from [rdev/liquid-glass-react](https://github.com/rdev/liquid-glass-react) (MIT, see `assets/files/liquid-glass-react-LICENSE.txt`), which adapts [shuding/liquid-glass](https://github.com/shuding/liquid-glass). Refraction renders in Chromium browsers; Safari and Firefox show frosted glass.
- Ma Shan Zheng (subset for the Chinese name): SIL Open Font License, see `assets/fonts/mashanzheng-OFL.txt`.
- Icons: see license files in `assets/files/icon/`.
