# Public asset provenance

This inventory records the public assets whose source and reuse rights need to be confirmed before a public release. The repository history shows when some files were added or refreshed, but does not record their creator, source URL, or license. A commit message alone is not proof of permission to redistribute an image.

| Files | Current record | Required before release |
| --- | --- | --- |
| `favicon.*`, `icon.*`, `icon-mono.*`, `icon-maskable.png`, `logo192.png`, `logo512.png`, `apple-touch-icon.png`, `manifest.webmanifest` | Project branding files; the repository history does not identify the designer or rights holder. | Confirm that the project owner created or has permission to redistribute each file. |
| `hero/2.jpg`, `og.png` | Image files; no source URL, creator, prompt, or license is recorded in the repository. | Confirm provenance and any model/source terms, or replace them with assets whose rights are documented. |
| `blog/*.jpg` | Refreshed in commits titled “Add Anthropic-style blog thumbnail images” and “Replace abstract blog images with literal object representations”; neither commit records source or license. | Confirm provenance and redistribution rights, or replace with documented assets. |
| `screenshot-narrow.png`, `screenshot-wide.png` | Product screenshots; no capture date, account/data source, or release record is stored here. | Confirm they contain no private or third-party material that should not be published. |
| `watermark.svg` | Repository file; creator and license are not recorded. | Confirm project ownership or permission. |

Do not treat this inventory as a rights grant. Add the source, creator, and license beside an asset when verified; remove or replace assets that cannot be cleared.
