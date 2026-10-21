# Open assets

Only free author-published editions are stored here. These are motion/model references and candidates; the restaurant renderer does not import them.

See [the research record](../../docs/OPEN_ASSET_RESEARCH.md) for sources, licenses, actual free-edition contents and known limitations. `catalog.json` records archive SHA-256 values and metadata read from the downloaded files.

Original assets: Quaternius and Kenney, CC0 1.0. Each provided license is retained in its original folder. The older animal archive has no separate license file; its author-published OpenGameArt page specifies CC0.

The Git repository includes the extracted assets and license files. Original ZIP downloads are kept locally and excluded from Git because they duplicate the extracted files and one archive exceeds GitHub's single-file limit. Archive hashes remain in `catalog.json`; restoring the original downloads is required only to regenerate that catalog with `scripts/catalog-open-assets.mjs`.

The independent `/asset-preview.html` page demonstrates the downloaded humanoid animation and car wheel pivots. Its appearance is the original 3D source, not a final painted game character.
