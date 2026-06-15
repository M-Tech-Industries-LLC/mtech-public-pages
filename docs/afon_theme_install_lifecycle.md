# Afon Theme Install Lifecycle

## Purpose

This document defines the client-side lifecycle contract for downloaded Afon themes. GitHub Pages hosts public catalog, manifest, and package metadata, but Afon clients remain responsible for entitlement checks, validation, local installation, activation, rollback, and removal.

The lifecycle is:

```text
download -> validate -> install -> register -> activate -> rollback/remove
```

## Client Lifecycle States

Theme clients should use the install states from `/afon/themes/install-contract.json`:

- `available`: Listed in the catalog and eligible for client evaluation.
- `downloading`: Package download is in progress.
- `downloaded`: Package is present in download cache but not trusted or installed.
- `validating`: Manifest, compatibility, hash, signature, and cosmetic-only scope checks are running.
- `installed`: Package has passed validation and was installed locally.
- `active`: Installed theme is currently applied.
- `failed`: Download, validation, install, or activation failed.
- `removed`: Theme was removed from local install storage.
- `deprecated`: Theme remains known but should no longer be offered for new installs.
- `incompatible`: Theme does not satisfy client compatibility requirements.

## Download Staging Directory

Downloaded packages must first be written to a staging or download-cache directory. A package is never activated directly from download cache.

The staging directory should be treated as untrusted. The client should clear stale partial downloads, avoid executing any content, and use unique temporary paths per download attempt so failed or interrupted downloads do not overwrite a known-good installed theme.

## Validation Requirements

A package must validate before installation. Required validation includes:

- Manifest schema validation.
- Catalog theme ID and manifest theme ID match.
- Catalog publisher ID and manifest publisher ID match.
- Version compatibility with the running Afon client.
- Package hash verification.
- Package signature verification.
- Cosmetic-only scope validation.

Theme packages cannot execute code or modify WebView behavior. `allowsCodeExecution` and `allowsWebViewModification` must remain `false`.

## Atomic Install Requirement

A package must install before activation. Installation should be atomic:

1. Validate the staged package.
2. Extract or copy the theme into a new local install directory.
3. Write install metadata.
4. Register the theme in the local theme registry.
5. Mark the theme as `installed`.

The client should not modify the active theme until the new theme has completed installation. Failed installs must not affect the active theme.

## Registry Behavior

The local registry shape is documented by `/afon/themes/registry-schema.json`. Registry entries should record the theme ID, publisher ID, version, install state, active flag, install timestamp, last validation timestamp, source, package hash, signature, and local path.

Only one installed theme should be marked active at a time. The `classic` theme is always available and must not depend on catalog availability.

## Activation Rules

Theme activation must be reversible. Activation may only occur after a theme is installed and registered.

Activation should:

1. Confirm the theme is installed.
2. Confirm the theme is compatible with the running client.
3. Confirm cosmetic-only constraints still hold.
4. Save the previous active theme.
5. Apply theme tokens.
6. Mark the new theme as active.

If activation fails, the client must restore the previous active theme or fall back to `classic`.

## Rollback Behavior

Rollback should restore the previously active theme when possible. If the previous theme is unavailable, invalid, removed, or incompatible, the client must apply `classic`.

Rollback should be available after failed activation, failed validation during startup, package corruption, or user-requested revert.

## Removal Behavior

Theme removal should delete local package files and mark or remove the registry entry. Removing an inactive theme should not affect the current theme.

If the user removes the active theme, Afon should first activate `classic` or another known-good theme, then remove the selected theme. Theme removal must not remove `classic`.

## Failed Install Recovery

Failed downloads, validation failures, extraction errors, and registry write failures should leave the current active theme unchanged.

The client should:

- Mark the attempted install as `failed`.
- Remove incomplete staging files.
- Keep the previous active theme.
- Keep `classic` available.
- Provide enough non-sensitive diagnostic detail for troubleshooting.

## Offline Behavior

If the client is offline, already installed themes may remain available locally. The client should not install or activate a new catalog theme that has not already been downloaded, validated, and installed.

If catalog refresh fails, the client may use cached catalog metadata for display, but it should not skip package hash, signature, compatibility, or cosmetic-only validation for new installs.

## Deprecated And Incompatible Packages

Deprecated themes may remain installed locally, but clients should avoid offering them for new installs. Disabled or incompatible themes should not be activated.

If an active theme becomes incompatible after an Afon update, the client should mark it `incompatible`, deactivate it, and fall back to `classic`.

## Future Marketplace Compatibility

The install lifecycle should remain compatible with a future marketplace or CDN-backed delivery model. A future service may replace static catalog hosting, but the client should keep the same safety model:

- Entitlement validation remains separate from public catalog hosting.
- Downloaded packages validate before installation.
- Installed packages register before activation.
- Activation remains reversible.
- `classic` remains the safe fallback theme.
- Theme packages remain cosmetic-only.
