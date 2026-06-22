# Afon Theme Catalog

This directory hosts public theme metadata and package assets for Afon Browser.

`/afon/themes/catalog.json` is the canonical active catalog for Afon clients. The older `/themes/afon/registry.json` path is retained only for legacy consumers and should mirror this catalog when it remains published.

Themes are cosmetic-only packages. They must not contain executable code, scripts, WebView modifications, tracking behavior, or browser policy changes.

Afon clients must validate entitlement, compatibility, package hash, and signature before installing a theme.

GitHub Pages is package and catalog hosting only. License validation, unlock codes, entitlement decisions, and account checks must remain separate from this static catalog.
