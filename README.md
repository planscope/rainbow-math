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
| `js/art.js` | Original artwork drawn as SVG: Lumi the rainbow dragon, 12 friends (and their baby versions), the island, icons. |
| `js/critters.js` | Island friends that never run out, treats, feeding and hearts, what friends see on a visit. |
| `js/islands.js` | Visiting friends' islands in other houses (through the family's Google Sheet). |
| `js/sync.js`, `js/merge.js` | Progress saved to the family's Google Sheet and put together across devices. |
| `cloud/Code.gs` | The small Google Apps Script web app behind the Sheet (progress and islands). |
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
  finished adventure brings a new friend to the island: the 12 named friends first,
  then baby friends forever (each with its own color, hat or bow, and name).
  Nothing is ever taken away.

## Island friends and visits

- Every solved problem also earns a treat (plus 10 to start). Tap a friend on the
  island to feed it (3 treats a day each, then "I'm full!") or pet it. Each friend has
  a secret favorite food to discover, and hearts grow with care.
- Visits between houses are off until a grown-up turns them on for a child (grown-ups
  area, "Friends' islands"). That gives an island code, separate from the progress
  code, to share with a friend's grown-up, who adds it on their child's page.
- A visitor sees only the island, its friends and the child's first name. They can
  leave a treat for one friend (3 per island per day, from their own treats) or a
  wave. No chat and no typing. Gifts show up on the owner's island next time.
- Only the owner's devices can change or close an island; closing it or making a new
  code cuts off old visitors.

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

## Players, level check and prizes

- Several children can play on one device. Each picks their name and makes a 4-number
  code; progress is saved separately per player (localStorage, this device only). The
  code is stored as a SHA-256 fingerprint and only keeps classmates' progress apart.
  Mila's progress from before players existed becomes her player automatically.
- New players start with a short level check (about 4-7 problems, no hints) that
  places them on the 10-level path. Grown-ups can repeat it.
- Grown-ups can add real-life prizes per child (e.g. "Go to Target" at 100 rainbow
  pieces). Pieces only go up, so a prize is never lost once earned.
