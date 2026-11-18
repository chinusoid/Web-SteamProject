# Steam Game Hub - Final Project

Team **Eggs**, group **SE-2507**, Web Technologies I.

**[Live website](https://chinusoid.github.io/Web-SteamProject/)** · **[Final submission files](https://github.com/chinusoid/Web-SteamProject/releases/tag/v2.0.4-final)**

A continuation of the team's Assignment 6 game hub: discover games, try virtual purchases, build a local collection, rate games and explore current giveaways. Independent student project; no affiliation with Valve or Steam.

## Final features

- 14 connected responsive pages; desktop, tablet and mobile.
- Light/dark mode on every page, saved in localStorage and synchronized across tabs.
- Three-step signup, credential-based login, profile details and logout.
- Shared JavaScript rules in `js/validation.js` with inline errors: required fields, email, phone, 8–128 character complex password and matching confirmation. All wizard steps are rechecked before saving. All forms use `novalidate`; no native constraint-validation attributes.
- Dynamic catalogue search, genre/budget filters, safe highlighting and saved filters.
- Player-specific virtual $100 wallets, confirmations, purchases, returns and ratings.
- A details page for every game (overview, tags, price facts, gallery) opened from "More details" on each card and in the carousel.
- Public GamerPower API through `fetch`/`async`/`await`: platform filters, current giveaway cards, loading/error/empty/retry and labelled cached preview.
- Skip links, keyboard controls, focus feedback, accessible dialogs and reduced-motion support.

## Pages

| Page | Purpose |
| --- | --- |
| `index.html` | Featured carousel, game discovery, wallet introduction |
| `games.html` | Nine-game searchable, filterable catalogue |
| `game-details.html` | One game by `?game=<id>`: overview, tags, facts, gallery, buy and rate |
| `library.html` | Active player's collection and returns |
| `featured.html` | Highlighted games, purchases and ratings |
| `categories.html` | Genre-based catalogue entry points |
| `community.html` | Expandable topic previews, player-card builder, signup, gallery |
| `news.html` | Sample stories and validated newsletter demonstration |
| `about.html` | Project purpose, team with email/Telegram contacts and imagery |
| `contact.html` | Validated local support form and FAQs |
| `responsive.html` | Standalone CSS responsive showcase |
| `login.html` | Credential check and password visibility control |
| `profile.html` | Saved account details, activity and logout |
| `giveaways.html` | Current public GamerPower giveaways |

## Run locally

No build step needed. From this directory:

```sh
python -m http.server 4173 --bind 127.0.0.1
```

Open `http://127.0.0.1:4173/`. Use localhost or the hosted HTTPS site for Web Crypto. Bootstrap, jQuery and catalogue artwork are bundled. The API and external offer pages need internet.

Create an account under **Community -> Join** using **sample details and a demo password**. No account is pre-seeded. Accounts stay in their browser/origin: localhost accounts do not appear on GitHub Pages. Passwords need at least 8 characters, uppercase, lowercase, a digit and a symbol.

Validation audit and boundary cases: `docs/final/Validation_Audit.txt`. Required fields are declared in JavaScript; `inputmode`/`autocomplete` are keyboard hints only. Runtime-generated forms are audited too.

## Data and limits

Frontend authentication simulation, not a production security system. `hub-accounts-v1` stores account records with a salted SHA-256 password verifier. `hub-session-v1` stores the local session. Anyone controlling this browser can inspect/alter data; no backend or cross-device sync exists.

Wallets, owned games and ratings remain compatible with Assignment 6 under `eggs-game-hub-v6`. Each player starts with $100: a purchase subtracts the price and a return refunds it. The balance is always $100 minus the games still owned, so a refresh can never add funds. Guest local players and registered accounts are distinct features. Opening an account profile selects its linked player.

Support/newsletter forms only simulate feedback; no messages or subscriptions are sent. Catalogue prices and news are sample content. GamerPower offers are external, may expire and are separate from virtual purchases. SessionStorage retains an explicitly labelled offline preview for up to 24 hours.

## Verification

```sh
npm install
npx playwright install chromium
npm test
npm run test:live
```

The local suite starts its own server and uses isolated sample data. `npm run test:live` runs both acceptance suites directly against GitHub Pages; `HUB_BASE_URL` can select another deployed base URL. `BROWSER_PATH` may point to existing Chromium. The live API test needs internet. Results/screenshots: `docs/final/verification.json`, `docs/final/screenshots/`.

Checks cover 14 pages at 375/768/1440 px in both themes, assets/anchors, signup/login/logout/profile, duplicate accounts, filters/persistence, purchases/ratings/refunds, support validation, real API access and failure/retry/empty states. Screenshots are offline presentation backup. `verification-live.json` and `published-audit.json` record the deployed checks, including all galleries, FAQs, game actions, clipboard/sound, all four API platforms and recovery/race states. Community topics expand useful sample content; related links go to real hub pages.

## Team responsibility allocation

| Member | Final responsibilities |
| --- | --- |
| Ташкенбаев Нурсултан / Nursultan Tashkenbayev | Design, Store/Featured/Categories, responsiveness and themes |
| Бигали Абулхаир / Abulkhair Bigali | Catalogue, search, purchases, library and ratings |
| Султанкулов Шынгыс / Shyngys Sultankulov | Accounts, validation, profile, integration and deployment |
| Лопаткин Артем / Artem Lopatkin | API, support/news/community content, tests and documentation |

Speaking plan: `docs/final/Presentation_Notes.txt`.

## Submission

Release assets: **ZIP project + PDF report + TXT links**. Each student submits all three to Moodle FINAL EXAM. The guide's example .docx filename conflicts with its explicit PDF-only report rule; this package uses PDF. Publishing does not submit to Moodle.

## Sources

- [GamerPower API](https://www.gamerpower.com/api-read) / [provider attribution](https://www.gamerpower.com/).
- [Bootstrap](https://getbootstrap.com/docs/5.3/), [jQuery API](https://api.jquery.com/), [GitHub Pages](https://docs.github.com/en/pages).
- `IMAGE_SOURCES.md` retains artwork credits. Art belongs to its owners; vendor licenses are bundled.
- Supplied Assignment 6 archive/report and final requirements/presentation guideline.
