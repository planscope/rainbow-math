# Mila's Rainbow Math Adventure

A calm, playful web app that helps Mila (age 7) understand two-digit addition
and subtraction by seeing and moving tens and ones. English and Spanish.

## What's inside

| File | What it does |
|---|---|
| `index.html` | Stand-alone page (noindex). Works at any folder, e.g. `/math/`. |
| `css/app.css` | All styles, scoped under `.rm`, so it can sit on top of a Webflow page. |
| `js/math.js` | Problem generation, answer checking, guided steps. Pure logic, no AI. |
| `js/model.js` | The tens-and-ones blocks model (combine, trade, take away). |
| `js/levels.js` | The 10-level path: which skills each level mixes and how many stars it takes to climb. |
| `js/mult.js` | First multiplication: equal groups and rows, with step-by-step help. |
| `js/app.js` | Screens: welcome, choose adventure, problems, help, break, celebration, island, grown-ups. |
| `js/i18n.js` | Every word in English and Spanish, short stories, island friends. |
| `js/art.js` | Original artwork drawn as SVG: Lumi the rainbow dragon, 12 friends, the island, icons. |
| `js/store.js` | Saves settings and progress in this browser (localStorage) and the gentle level-up rules. |
| `js/audio.js` | Soft sound effects (no failure sound) and read-aloud with the device's voices. |
| `tests/` | `npm test` runs the math, blocks, language and progress checks. |
| `webflow-embed.html` | The code to paste into the Webflow `/math` page. |

No build step, no dependencies, no API keys, no accounts, no tracking.

## Run it on your computer

```bash
cd rainbow-math
python3 -m http.server 8642
```
Then open http://localhost:8642/ . Tests: `npm test` (Node 18+).

## How it fits at bluesierracorp.com/math

bluesierracorp.com is a Webflow site, and `/math` is currently free (404).
The same pattern as `/portal` is used: the files are hosted on GitHub Pages
and a Webflow page loads them.

1. Push this folder to a GitHub repo `planscope/rainbow-math` and turn on
   GitHub Pages (branch `main`, root). Files then live at
   `https://planscope.github.io/rainbow-math/`.
2. In Webflow, add a blank page with slug `math`. Don't link it anywhere,
   and turn off "Sitemap indexing" in its SEO settings.
3. Paste the two blocks from `webflow-embed.html` into the page's custom code
   (head and before `</body>`).
4. Publish the site, then open https://www.bluesierracorp.com/math and refresh
   it once to confirm direct loading works.

The page is unlisted, not private: anyone with the link can open it.

## Learning design in short

- Skills unlock gently: addition without regrouping and subtraction without
  regrouping first, then regrouping. 3 problems in a row on her own → slightly
  harder. 2 problems in a row with help → easier level and blocks shown.
- Wrong answers never say "wrong". First miss: a kind line plus one true fact
  about her answer (for example, "The 5 in your ones place is just right!
  Let's check the tens."), and the right column lights up. Second miss: Lumi
  walks through it one small step at a time, and Mila moves the blocks and
  types each small answer herself.
- Pictures, written numbers (with crossed-out and regrouped digits) and words
  always describe the same state. This is checked for all 5,000+ valid problems
  in the tests.
- Every finished problem earns a rainbow piece, with or without help. Every
  finished adventure brings a new friend to the island. Nothing is ever taken away.

## Updating

After changing code, bump the `?v=` number on the imports in `js/*.js` (all files the same) so iPads never mix old and new files, then push. The Webflow page picks up changes within 10 minutes; no Webflow publish is needed.

## The guide friend's voice (ElevenLabs, recorded once)

The guide friend speaks with short clips recorded with ElevenLabs (voice: Gigi) in
`audio/`, joined together in the app (`js/voice.js`). The app never calls ElevenLabs
and holds no key; if a clip is missing it uses the device voice.

After changing any line the guide says (keys listed in `VOICE_KEYS` in `js/voice.js`),
record the missing clips (needs the key in `~/.config/elevenlabs/api_key`):

```bash
node tools/eleven.mjs generate jBpfuIE2acCO8z3wKNLl Gigi
```

`node tools/preview-lines.mjs` joins a few sentences into `samples/` to listen to.
