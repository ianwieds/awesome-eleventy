# Using this template

This repository is a template for an awesome list. It holds the list's README, its contribution rules, and the checks that keep it clean. Every value that defines the list lives in one file, `awesome.json`, and one command writes those values into the docs.

## What runs on GitHub

- **PR check** (`.github/workflows/pr-check.yml`): checks every pull request's new or changed entries against the rules and the star bar, posts the result as one comment, and closes the pull request when it fails.
- **Sweep** (`.github/workflows/sweep.yml`): every Monday, and on demand, re-checks every entry for dead links and archived or inactive repositories, and keeps one open `Entries to review` issue listing what it found.
- **Checks** (`.github/workflows/checks.yml`): on every pull request and push to `main`, runs the tests and fails when the docs no longer match `awesome.json`.

## Steps

1. On GitHub, click **Use this template**, then **Create a new repository**. Name it `awesome-<topic>` and clone it.
2. Edit `awesome.json`:
   - `topic`: the subject, as it reads after "Awesome" in the title.
   - `repo`: the new repository, as `owner/name`.
   - `tagline`: the one sentence under the title.
   - `scope`: the pull request checklist line that says what belongs.
   - `accent`: the badge color, six hex digits without `#`.
   - `minStars`: the stars a GitHub project needs when it is submitted.
   - `maxInactiveMonths`: `0` rejects only archived or broken repositories; `12` also rejects any repository with no push in the last 12 months.
   - `maintainer`: your name and profile link for the "Maintained by" line.
   - `heroAlt`: the alt text for the hero image.
3. Run `npm run sync`. It writes those values into `README.md`, `contributing.md` and `.github/pull_request_template.md`, between the `<!-- awesome:... -->` markers. Node 22 or later; there is nothing to install.
4. Replace `.github/assets/hero.gif` with the list's own hero image, 1200x400, under the same name.
5. Write the sections: replace the example sections in `README.md` (and their lines under Contents) with real ones, each in alphabetical order, one entry per line in the format `- [Name](https://link) - Description.` Rewrite the placeholder paragraphs in `README.md` and `contributing.md`.
6. Run `npm test`, then `npm run sweep` to check every entry you added.
7. Delete this file (`template.md`), then commit and push.

Text outside the markers is yours to edit. Text inside them is rewritten by the next `npm run sync`, so change the value in `awesome.json` instead.
