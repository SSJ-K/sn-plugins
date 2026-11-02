# sn-plugins

Custom themes and editor plugins for [Standard Notes](https://standardnotes.com), served from this repo through GitHub Pages.

## Install a plugin

1. In Standard Notes open **Preferences → Plugins**.
2. Scroll to **Install Custom Plugin** and paste the plugin's `ext.json` link (listed on the Pages site, see `index.html`).
3. Click **Install**. Themes appear under Appearance; editors appear in a note's editor menu.

## Layout

- `themes/<name>/` — one folder per theme: `ext.json` (descriptor), `theme.css`, and any font files.
- `editors/<name>/` — one folder per editor plugin: `ext.json` plus the built web app.
- `index.html` — the Pages landing page listing every install link.
- `.nojekyll` — tells GitHub Pages to serve every file as-is.

## Descriptor (`ext.json`) fields

`identifier`, `name`, `content_type` (`SN|Theme` or `SN|Component`), `area` (editors: `editor-editor`), `version`, `description`, `url` (the CSS or editor page), `latest_url` (this descriptor's own URL, so the app can check for updates).

## Themes

- **Duo** — iA Writer Duo S typeface for the interface and note text. Install link: `https://raw.githubusercontent.com/SSJ-K/sn-plugins/main/themes/duo/ext.json`

## Credits

- [iA Writer Duo](https://github.com/iaolo/iA-Fonts) typeface © Information Architects Inc., based on IBM Plex, licensed under the SIL Open Font License 1.1 (see `themes/duo/LICENSE.md`). This project is not affiliated with iA.
