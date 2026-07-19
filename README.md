# Row & Round

Row & Round is a free, browser-based crochet companion. It turns patterns into a calm, one-step-at-a-time guide with repeat counters, automatic advance, saved progress, project notes, larger text, and an optional screen wake lock.

The included Classic Granny Square contains all 97 steps from the original helper. A small scarf sample demonstrates how other pattern shapes appear in the library.

## Pattern importing

The app accepts JSON and CSV files. JSON is recommended because it can store project details and steps together. Downloadable templates are available from the Import Pattern screen.

Each step uses:

```json
{
  "section": "Round 1",
  "title": "Double crochet ×3",
  "instruction": "Work 3 double crochets into the corner space.",
  "count": 3
}
```

`count` is optional. When present, Row & Round creates numbered stitch boxes and advances after the last box is tapped.

Imported patterns, progress, counters, notes, and display preferences are stored in the browser with `localStorage`. Pattern files are not sent to a server.

## Local development

Requirements: Node.js 22 or newer.

```bash
npm install
npm run dev
```

Run `npm run check` before publishing. It validates the built-in pattern and creates a production build.

## Free GitHub Pages hosting

The included workflow builds and deploys the app whenever `main` is pushed. In the GitHub repository, open **Settings → Pages** and select **GitHub Actions** as the source. Public-repository Pages hosting and public-repository Actions are free on GitHub's current standard plan; check GitHub's plan details before switching the repository to private.

## Source archive

The original single-file guide is preserved at `public/original-helper.html` for reference.
