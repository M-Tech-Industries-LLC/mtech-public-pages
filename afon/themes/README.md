# Afon Theme Resources

`index.html` is the public nine-theme gallery for Build 28. It uses existing previews and production package/checksum resources under `/themes/afon/`. Nebula and Smoke have 1×1 placeholder preview files, so the gallery displays their existing background artwork with an explicit label. Runtime preview files remain unchanged.

The released Build 28 client reads `https://m-techindustries.com/themes/afon/registry.json`, not this directory’s `catalog.json`. The two metadata contracts differ; preserve both schemas and paths. This directory’s three-entry catalog is a reference contract with staged/experimental records and empty signatures, not a complete availability source.

The reference lifecycle requires entitlement, compatibility, hash, and signature validation; the static catalog does not establish current enforcement or signature readiness. Themes remain cosmetic-only: no executable code, scripts, WebView changes, tracking, or browser policy changes. License validation, unlock codes, entitlement decisions, and account checks remain separate from public static hosting.

See [hosting notes](../../docs/afon_theme_catalog_hosting.md) and [lifecycle contract](../../docs/afon_theme_install_lifecycle.md). Do not change runtime metadata, policies or packages as a website content correction.
