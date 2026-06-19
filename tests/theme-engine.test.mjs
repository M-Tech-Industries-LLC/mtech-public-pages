import assert from "node:assert/strict";
import test from "node:test";
import {
  LocalThemeCache,
  ThemeActivationService,
  ThemeDisplayService,
  ThemeInstallService,
  ThemeRegistryService,
  ThemeDefaults
} from "../assets/js/theme-engine.mjs";

const catalog = {
  schemaVersion: 1,
  updatedAt: "2026-06-15T00:00:00Z",
  themes: [
    {
      themeId: "nebula",
      publisherId: "mtech",
      name: "Nebula",
      description: "A space-inspired visual theme for Afon.",
      version: "1.0.0",
      minAfonVersion: "0.1.0",
      packageUrl: "https://m-techindustries.com/afon/themes/nebula/package.zip",
      manifestUrl: "https://m-techindustries.com/afon/themes/nebula/manifest.json",
      previewUrl: "https://m-techindustries.com/afon/themes/nebula/preview.webp",
      sha256: "",
      signature: "",
      status: "staged",
      tags: ["space", "dark"]
    }
  ]
};

const installContract = {
  schemaVersion: 1,
  installStates: [
    "available",
    "downloading",
    "downloaded",
    "validating",
    "installed",
    "active",
    "failed",
    "removed",
    "deprecated",
    "incompatible"
  ],
  requiredValidation: [
    "manifest_schema",
    "theme_id_match",
    "publisher_id_match",
    "version_compatibility",
    "package_hash",
    "signature",
    "cosmetic_only_scope"
  ],
  fallbackTheme: "classic",
  allowsRollback: true,
  allowsCodeExecution: false,
  allowsWebViewModification: false
};

const nebulaInstall = {
  schemaVersion: 1,
  themeId: "nebula",
  publisherId: "mtech",
  version: "1.0.0",
  installPolicy: {
    allowInstall: true,
    allowActivate: true,
    allowRollback: true,
    allowRemove: true
  },
  validation: {
    requiresHash: true,
    requiresSignature: true,
    requiresCompatibilityCheck: true,
    requiresEntitlement: true
  },
  fallback: {
    themeId: "classic",
    reason: "Classic is always available as the safe default theme."
  }
};

const nebulaManifest = {
  schemaVersion: 1,
  themeId: "nebula",
  publisherId: "mtech",
  name: "Nebula",
  description: "A space-inspired visual theme for Afon.",
  version: "1.0.0",
  minAfonVersion: "0.1.0",
  packageType: "theme",
  themeMode: "custom",
  behaviorScope: "cosmetic_only",
  allowsCodeExecution: false,
  allowsWebViewModification: false,
  tokens: {
    accent: "#8A6CFF",
    toolbarBackground: "#111827",
    pageBackground: "#050816",
    cardBackground: "#111827",
    textPrimary: "#F9FAFB",
    textSecondary: "#CBD5E1",
    searchFieldText: "#111827"
  },
  assets: {
    preview: "preview.webp",
    background: "background.webp"
  }
};

const registrySchema = {
  schemaVersion: 1,
  installedThemes: [
    {
      themeId: "nebula",
      publisherId: "mtech",
      version: "1.0.0",
      installState: "installed",
      active: false,
      installedAt: "2026-06-15T00:00:00Z",
      lastValidatedAt: "2026-06-15T00:00:00Z",
      source: "mtech_catalog",
      packageHash: "",
      signature: "",
      localPath: ""
    }
  ]
};

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

function response(json, ok = true) {
  return {
    ok,
    async json() {
      return structuredClone(json);
    }
  };
}

function createFetcher(overrides = {}) {
  const routes = {
    "/afon/themes/catalog.json": catalog,
    "/afon/themes/registry-schema.json": registrySchema,
    "/afon/themes/install-contract.json": installContract,
    "https://m-techindustries.com/afon/themes/nebula/install.json": nebulaInstall,
    "https://m-techindustries.com/afon/themes/nebula/manifest.json": nebulaManifest,
    ...overrides
  };

  return async (url) => {
    if (!(url in routes)) return response({}, false);
    return response(routes[url], routes[url] !== null);
  };
}

test("discovers, validates, installs, activates, and reverts Nebula", async () => {
  const storage = new MemoryStorage();
  const cache = new LocalThemeCache({ storage });
  const fetcher = createFetcher();
  const registryService = new ThemeRegistryService({ fetcher, cache });
  const installService = new ThemeInstallService({
    fetcher,
    cache,
    clock: () => new Date("2026-06-15T00:00:00Z")
  });
  const activationService = new ThemeActivationService({ cache });

  await registryService.loadRegistrySchema();
  const remoteCatalog = await registryService.loadRemoteCatalog();
  const nebula = registryService.discoverTheme(remoteCatalog, "nebula");
  assert.equal(nebula.name, "Nebula");

  const installedRegistry = await installService.installFromThemeRecord(nebula);
  const installedNebula = installedRegistry.installedThemes.find((theme) => theme.themeId === "nebula");
  assert.equal(installedNebula.installState, "installed");
  assert.equal(installedNebula.active, false);

  const activeRegistry = activationService.activate("nebula");
  assert.equal(activeRegistry.installedThemes.find((theme) => theme.themeId === "nebula").active, true);
  assert.equal(activeRegistry.installedThemes.find((theme) => theme.themeId === ThemeDefaults.DEFAULT_THEME_ID).active, false);

  const revertedRegistry = activationService.deactivate("nebula");
  assert.equal(revertedRegistry.installedThemes.find((theme) => theme.themeId === "nebula").active, false);
  assert.equal(revertedRegistry.installedThemes.find((theme) => theme.themeId === ThemeDefaults.DEFAULT_THEME_ID).active, true);
});

test("invalid install never activates and falls back to default", async () => {
  const storage = new MemoryStorage();
  const cache = new LocalThemeCache({ storage });
  const invalidManifest = structuredClone(nebulaManifest);
  invalidManifest.tokens.accent = "purple";
  const fetcher = createFetcher({
    "https://m-techindustries.com/afon/themes/nebula/manifest.json": invalidManifest
  });
  const registryService = new ThemeRegistryService({ fetcher, cache });
  const installService = new ThemeInstallService({
    fetcher,
    cache,
    clock: () => new Date("2026-06-15T00:00:00Z")
  });

  const remoteCatalog = await registryService.loadRemoteCatalog();
  const nebula = registryService.discoverTheme(remoteCatalog, "nebula");
  const result = await installService.installFromThemeRecord(nebula);
  const failedNebula = result.registry.installedThemes.find((theme) => theme.themeId === "nebula");
  const fallback = result.registry.installedThemes.find((theme) => theme.themeId === ThemeDefaults.DEFAULT_THEME_ID);

  assert.equal(result.fallbackTheme, ThemeDefaults.DEFAULT_THEME_ID);
  assert.equal(failedNebula.installState, "failed");
  assert.equal(failedNebula.active, false);
  assert.equal(fallback.active, true);
});

test("theme package missing required fields is marked failed", async () => {
  const storage = new MemoryStorage();
  const cache = new LocalThemeCache({ storage });
  const incompleteManifest = structuredClone(nebulaManifest);
  delete incompleteManifest.assets;
  const fetcher = createFetcher({
    "https://m-techindustries.com/afon/themes/nebula/manifest.json": incompleteManifest
  });
  const registryService = new ThemeRegistryService({ fetcher, cache });
  const installService = new ThemeInstallService({
    fetcher,
    cache,
    clock: () => new Date("2026-06-15T00:00:00Z")
  });

  const remoteCatalog = await registryService.loadRemoteCatalog();
  const nebula = registryService.discoverTheme(remoteCatalog, "nebula");
  const result = await installService.installFromThemeRecord(nebula);

  assert.equal(result.registry.installedThemes.find((theme) => theme.themeId === "nebula").installState, "failed");
  assert.equal(result.registry.installedThemes.find((theme) => theme.themeId === ThemeDefaults.DEFAULT_THEME_ID).active, true);
});

test("invalid install JSON is marked failed without changing active theme", async () => {
  const storage = new MemoryStorage();
  const cache = new LocalThemeCache({ storage });
  const invalidInstall = structuredClone(nebulaInstall);
  delete invalidInstall.installPolicy;
  const fetcher = createFetcher({
    "https://m-techindustries.com/afon/themes/nebula/install.json": invalidInstall
  });
  const registryService = new ThemeRegistryService({ fetcher, cache });
  const installService = new ThemeInstallService({
    fetcher,
    cache,
    clock: () => new Date("2026-06-15T00:00:00Z")
  });

  const remoteCatalog = await registryService.loadRemoteCatalog();
  const nebula = registryService.discoverTheme(remoteCatalog, "nebula");
  const result = await installService.installFromThemeRecord(nebula);

  assert.equal(result.registry.installedThemes.find((theme) => theme.themeId === "nebula").installState, "failed");
  assert.equal(result.registry.installedThemes.find((theme) => theme.themeId === ThemeDefaults.DEFAULT_THEME_ID).active, true);
});

test("registry loader returns safe fallback catalog when remote registry fails", async () => {
  const fetcher = createFetcher({
    "/afon/themes/catalog.json": null
  });
  const registryService = new ThemeRegistryService({ fetcher });

  const remoteCatalog = await registryService.loadRemoteCatalog();
  assert.deepEqual(remoteCatalog.themes, []);
  assert.equal(remoteCatalog.fallbackTheme, ThemeDefaults.DEFAULT_THEME_ID);
  assert.ok(remoteCatalog.error);
});

test("remote Nebula displays once when local test Nebula exists", () => {
  const logs = [];
  const displayService = new ThemeDisplayService({ logger: (event, data) => logs.push({ event, data }) });
  const visible = displayService.buildVisibleThemes({
    remoteCatalog: catalog,
    localRegistry: {
      schemaVersion: 1,
      installedThemes: [
        {
          themeId: "nebula",
          publisherId: "mtech",
          version: "1.0.0",
          installState: "installed",
          active: false,
          installedAt: "2026-06-15T00:00:00Z",
          lastValidatedAt: "2026-06-15T00:00:00Z",
          source: "local_test",
          packageHash: "",
          signature: "",
          localPath: "local-test/nebula"
        }
      ]
    }
  });

  assert.equal(visible.length, 1);
  assert.equal(visible[0].themeId, "nebula");
  assert.equal(visible[0].publisherId, "mtech");
  assert.equal(visible[0].source, "mtech_catalog");
  assert.equal(visible[0].statusText, "Installed");
  assert.equal(logs[0].data.raw_count, 1);
  assert.equal(logs[0].data.visible_count, 1);
  assert.equal(logs[0].data.merged_count, 1);
  assert.equal(logs[0].data.filtered_count, 0);
});

test("local test Nebula does not create duplicate card", () => {
  const displayService = new ThemeDisplayService();
  const visible = displayService.buildVisibleThemes({
    remoteCatalog: { schemaVersion: 1, updatedAt: "", themes: [] },
    localRegistry: {
      schemaVersion: 1,
      installedThemes: [
        {
          themeId: "nebula",
          publisherId: "mtech",
          version: "1.0.0",
          installState: "installed",
          active: false,
          installedAt: "2026-06-15T00:00:00Z",
          lastValidatedAt: "2026-06-15T00:00:00Z",
          source: "local_test",
          packageHash: "",
          signature: "",
          localPath: "local-test/nebula"
        }
      ]
    }
  });

  assert.equal(visible.length, 0);
});

test("same themeId with different publisherId remains separate", () => {
  const displayService = new ThemeDisplayService();
  const visible = displayService.buildVisibleThemes({
    remoteCatalog: {
      schemaVersion: 1,
      updatedAt: "2026-06-15T00:00:00Z",
      themes: [
        catalog.themes[0],
        {
          ...catalog.themes[0],
          publisherId: "partner",
          name: "Nebula Partner"
        }
      ]
    },
    localRegistry: { schemaVersion: 1, installedThemes: [] }
  });

  assert.equal(visible.length, 2);
  assert.deepEqual(visible.map((theme) => theme.publisherId).sort(), ["mtech", "partner"]);
});

test("remote metadata enriches local installed state", () => {
  const displayService = new ThemeDisplayService();
  const visible = displayService.buildVisibleThemes({
    remoteCatalog: catalog,
    localRegistry: {
      schemaVersion: 1,
      installedThemes: [
        {
          themeId: "nebula",
          publisherId: "mtech",
          version: "1.0.0",
          installState: "installed",
          active: false,
          installedAt: "2026-06-15T00:00:00Z",
          lastValidatedAt: "2026-06-15T00:00:00Z",
          source: "mtech_catalog",
          packageHash: "",
          signature: "",
          localPath: "themes/nebula/1.0.0"
        }
      ]
    }
  });

  assert.equal(visible[0].name, "Nebula");
  assert.equal(visible[0].description, "A space-inspired visual theme for Afon.");
  assert.equal(visible[0].localInstallState, "installed");
  assert.equal(visible[0].statusText, "Installed");
});

test("incompatible registry theme shows incompatible instead of hidden", () => {
  const displayService = new ThemeDisplayService();
  const visible = displayService.buildVisibleThemes({
    remoteCatalog: {
      schemaVersion: 1,
      updatedAt: "2026-06-15T00:00:00Z",
      themes: [{ ...catalog.themes[0], status: "incompatible" }]
    },
    localRegistry: { schemaVersion: 1, installedThemes: [] }
  });

  assert.equal(visible.length, 1);
  assert.equal(visible[0].statusText, "Incompatible");
});

test("registry display logging includes counts and never logs unlock codes", () => {
  const logs = [];
  const displayService = new ThemeDisplayService({ logger: (event, data) => logs.push({ event, data }) });
  displayService.buildVisibleThemes({
    remoteCatalog: catalog,
    localRegistry: { schemaVersion: 1, installedThemes: [] },
    unlockedThemeIds: ["nebula", "SECRET-UNLOCK-CODE-123"]
  });

  assert.equal(logs[0].event, "theme_registry_fetch_success");
  assert.equal(logs[0].data.raw_count, 1);
  assert.equal(logs[0].data.visible_count, 1);
  assert.equal(logs[0].data.merged_count, 1);
  assert.equal(logs[0].data.filtered_count, 0);
  assert.equal(JSON.stringify(logs).includes("SECRET-UNLOCK-CODE-123"), false);
});
