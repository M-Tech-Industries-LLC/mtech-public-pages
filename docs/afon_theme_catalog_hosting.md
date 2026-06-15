# Afon Theme Catalog Hosting

## Purpose

The Afon theme catalog provides public, static metadata for cosmetic Afon Browser themes hosted by M-Tech Industries. It lets Afon clients discover theme manifests, preview assets, package download URLs, compatibility requirements, package hashes, signatures, and publication status.

This catalog does not grant access to paid or restricted themes. It is a hosting and discovery layer only.

## Static Hosting Model

The public website serves the catalog directly from GitHub Pages:

- `/afon/themes/catalog.json`
- `/afon/themes/{themeId}/manifest.json`
- `/afon/themes/{themeId}/preview.webp`
- `/afon/themes/{themeId}/package.zip`
- `/afon/themes/{themeId}/package.sha256`

Theme packages may be omitted while a theme is staged. The catalog must still include `packageUrl`, `sha256`, and `signature` fields so the client contract stays stable before package distribution is enabled.

## File Structure

```text
afon/
  themes/
    catalog.json
    README.md
    nebula/
      manifest.json
      package.zip
      package.sha256
      preview.webp
```

`package.zip` can be absent for staged themes. `package.sha256` may remain empty until a package exists.

## Catalog Schema

`catalog.json` contains:

- `schemaVersion`: Catalog schema version.
- `updatedAt`: UTC timestamp for the catalog update.
- `themes`: Array of public theme records.

Each theme record contains:

- `themeId`: Stable theme identifier.
- `publisherId`: Theme publisher identifier.
- `name`: Public display name.
- `description`: Public summary.
- `version`: Theme package version.
- `minAfonVersion`: Minimum compatible Afon version.
- `packageUrl`: Public package URL.
- `manifestUrl`: Public manifest URL.
- `previewUrl`: Public preview image URL.
- `sha256`: Expected package SHA-256 digest.
- `signature`: Expected package signature.
- `status`: `staged`, `active`, `deprecated`, or `disabled`.
- `tags`: Public catalog tags.

## Manifest Schema

Each theme manifest contains:

- `schemaVersion`: Manifest schema version.
- `themeId`: Stable theme identifier matching the catalog.
- `publisherId`: Publisher identifier matching the catalog.
- `name`: Public display name.
- `description`: Public summary.
- `version`: Theme version.
- `minAfonVersion`: Minimum compatible Afon version.
- `packageType`: Must be `theme`.
- `themeMode`: Theme mode, such as `custom`.
- `behaviorScope`: Must remain cosmetic-only for hosted themes.
- `allowsCodeExecution`: Must be `false`.
- `allowsWebViewModification`: Must be `false`.
- `tokens`: Cosmetic color and UI tokens.
- `assets`: Package-relative asset paths.

## Client Fetch Flow

1. Afon opens Theme Manager.
2. The user enters an unlock code.
3. The app validates the code with the M-Tech license service.
4. The license service response includes an entitled `themeId`.
5. The app fetches `/afon/themes/catalog.json`.
6. The app locates the matching `themeId`.
7. The app downloads `packageUrl`.
8. The app verifies `sha256` and `signature`.
9. The app installs the package locally.
10. The app applies theme tokens.

## Security Boundaries

- No license codes are stored in this repository.
- No entitlement decisions are made by GitHub Pages.
- No account state is stored in the catalog.
- No executable code is allowed in theme packages.
- No scripts are allowed in theme packages.
- No WebView modifications are allowed in theme packages.
- No tracking behavior is allowed in theme packages.
- No browser policy changes are allowed in theme packages.
- M-Tech license validation remains separate from static hosting.
- Afon clients must validate entitlement, compatibility, package hash, and signature before installing a theme.

## Future API/CDN Migration

This static catalog can later migrate to a dedicated API or CDN without changing the client model. The future service should preserve the same catalog and manifest fields, continue using signed package verification, and keep entitlement decisions inside the M-Tech license service rather than the public hosting layer.
