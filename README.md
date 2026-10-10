# Arcado (آرکیدو) — Mini Games

A mobile-first pocket arcade built with React, Vite, TypeScript, inline SVG artwork, and Anime.js motion. React owns the app shell, settings, and every game screen. It can be installed as a progressive web app and reopens offline after its first production visit.

## Run locally

```bash
npm install
npm run dev
```

If you are pulling this change into an existing checkout, run `npm install` once to add the React and Vite React plugin dependencies.

Create and preview a production build:

```bash
npm run build
npm run preview
```

The service worker is registered only in production builds, so offline and update behavior should be tested through `npm run preview` rather than the development server. Each production build uses the package release and short Git commit as its identity, for example `1.3.0+b2a0c51`. Installed copies check for releases on launch, reconnect, tab focus, and every five minutes. A release downloads in the background, then waits for the user to apply it from the menu so an active match is never interrupted.

## Code quality

```bash
npm run lint
npm run format:check
npm run format
```

ESLint is configured with the TypeScript ESLint ruleset, while Prettier handles TypeScript, CSS, HTML, JSON, JavaScript, and Markdown formatting.

## Releases and deployment

Side Quest uses semantic versions. Use a patch for fixes, a minor version for new games or features, and a major version for incompatible stored-data or experience changes. `package.json` tracks the current version.

Deployments are automated through GitHub Pages:

- Every push to the `master` branch and manual triggers via `workflow_dispatch` run formatting checks, linting, tests, and a production build.
- The build artifact is automatically published to GitHub Pages via the `github-pages` environment.

### Setting up GitHub Pages

1. In your GitHub repository, open **Settings**.
2. Under the **Code and automation** section on the sidebar, click **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.

The menu currently includes:

- **Continuous Tic Tac Toe** — keep three marks each; every fourth move relocates the oldest mark.
- **Memory Match** — find eight pairs against a bot or in pass-and-play mode.
- **Reaction Duel** — wait for the green signal; the first valid tap wins and an early tap forfeits the round.
- **Connect Four** — drop discs into seven columns, build a line of four, and block the opponent.
- **Dots & Boxes** — claim edges, close boxes for extra turns, and control chains against a bot or friend.
- **Othello** — trap opponent discs between yours, flip entire lines, and claim the board against a bot or friend.
- **Nim** — take any number of matches from a single row and force your opponent into an empty board.
- **Tug of War** — rapid head-to-head tapping duel to pull the rope marker across your goal line.
- **Color War** — place and grow discs that explode at 4 dots to trigger chain-reaction captures.
- **Quoridor** — race your pawn across a 7×7 grid or place 2-tile walls to detour your opponent.

Every game supports bot and local two-player modes. Status changes are announced to assistive technology, keyboard focus is visible, and nonessential animation follows the system’s reduced-motion preference.

Selecting a game opens a setup dialog for choosing Easy, Normal, or Hard bot difficulty and a 1, 3, or 5-round match. The round limit applies to both bot and local two-player play; difficulty only affects the bot.

Open Settings from the menu to control animations, music, sound effects, and haptic feedback. Preferences are stored locally in the browser and applied immediately. Music starts after your first interaction to comply with browser autoplay rules and is cached after its first playback for later offline sessions.

The interface supports English and Persian. Choose the language in Settings; the selection is saved locally, and Persian automatically enables the right-to-left layout, Persian number formatting, and the bundled local Vazir font.

## Project structure

```text
src/
  app/                  React shell, typed view routing, icons, motion helpers
  app/settings.ts       persisted user preferences and haptic helper
  components/           shared React game layout components
  pages/
    tic-tac-toe/        Tic Tac Toe state, bot, and UI
    memory-match/       Memory Match state, bot, and UI
    reaction-duel/      Reaction Duel state, bot, and UI
    connect-four/       Connect Four rules, minimax bot, and UI
    dots-boxes/         Dots & Boxes rules, bot tactics, and board UI
    othello/            Othello rules, minimax bot, and board UI
    nim/                Nim rules, XOR bot, and matchstick UI
    tug-of-war/         Tug of War rope mechanics, bot, and UI
    color-war/          Color War chain-reaction rules, bot, and UI
    quoridor/           Quoridor 7×7 maze rules, BFS pathfinding bot, and UI
    settings/           preferences screen and toggle controls
  styles/
    design-system.css   shared color, shape, border, type, elevation, and motion tokens
    global.css          reset, typography, menu, shared layout, and accessibility
    components.css      small shared component rules
  main.tsx              React/Vite entry point
public/
  audio/                soundtrack asset
  fonts/                fonts asset
  icon.svg              application icon
  manifest.webmanifest  install metadata
  sw.js                 production offline cache
.github/workflows/      GitHub Pages deployment workflow
scripts/                standalone test and logic checks
```

Each game is a self-contained React component with local state and effects for timers, bot turns, haptics, and motion. The app switches screens through typed React view state in `src/app/react-app.tsx`.

## Design system

`src/styles/design-system.css` is the source of truth for reusable visual decisions. Shared UI decisions use its semantic tokens for colors, corner radii, border widths, shadows, gradients, type sizes, and transition timings; game-mechanic visuals may keep calibrated component-local measurements.

- Small controls use `--radius-sm`, surfaces and board cells use `--radius-md`, feature cards use `--radius-lg`, and dialogs use `--radius-xl`. Pills and circles have dedicated tokens.
- Structural borders use the thin, strong, and heavy border tokens. Focus rings use the shared focus tokens.
- Interactive controls and structural panels stay flat. Gradients are reserved for decorative and data-display surfaces and are defined centrally.
- Shared motion uses the duration and easing tokens and still respects the existing reduced-motion behavior.
- Grid-based games use the shared `.board-surface` frame and provide only their game-specific surface color and internal geometry.
- Measurements dictated by game mechanics—board gaps, disc insets, hit areas, and calibrated animation sequences—remain local to that game.
