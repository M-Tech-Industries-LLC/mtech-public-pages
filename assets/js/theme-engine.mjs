const DEFAULT_THEME_ID = "classic";
const CACHE_KEY = "afon.theme.registry.v1";
const DISPLAY_STATE_PRIORITY = [
  "active",
  "installed",
  "unlocked",
  "locked",
  "available",
  "incompatible",
  "unavailable"
];

const REQUIRED_CATALOG_FIELDS = [
  "themeId",
  "publisherId",
  "name",
  "description",
  "version",
  "manifestUrl"
];

const REQUIRED_REGISTRY_FIELDS = [
  "themeId",
  "publisherId",
  "version",
  "installState",
  "active",
  "installedAt",
  "lastValidatedAt",
  "source",
  "packageHash",
  "signature",
  "localPath"
];

const REQUIRED_MANIFEST_FIELDS = [
  "schemaVersion",
  "themeId",
  "publisherId",
  "name",
  "description",
  "version",
  "minAfonVersion",
  "packageType",
  "themeMode",
  "behaviorScope",
  "allowsCodeExecution",
  "allowsWebViewModification",
  "tokens",
  "assets"
];

const REQUIRED_INSTALL_FIELDS = [
  "schemaVersion",
  "themeId",
  "publisherId",
  "version",
  "installPolicy",
  "validation",
  "fallback"
];

const TOKEN_FIELDS = [
  "accent",
  "toolbarBackground",
  "pageBackground",
  "cardBackground",
  "textPrimary",
  "textSecondary"
];

const REQUIRED_INSTALL_STATES = [
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
];

const REQUIRED_VALIDATION_STEPS = [
  "manifest_schema",
  "theme_id_match",
  "publisher_id_match",
  "version_compatibility",
  "package_hash",
  "signature",
  "cosmetic_only_scope"
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasFields(value, fields) {
  return isObject(value) && fields.every((field) => Object.prototype.hasOwnProperty.call(value, field));
}

function isHexColor(value) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
}

function nowIso(clock) {
  return clock().toISOString();
}

function identityKey(theme) {
  return `${theme.themeId}::${theme.publisherId}`;
}

function sortedDisplayState(states) {
  return DISPLAY_STATE_PRIORITY.find((state) => states.includes(state)) || "unavailable";
}

function createDefaultRegistry() {
  return {
    schemaVersion: 1,
    installedThemes: [
      {
        themeId: DEFAULT_THEME_ID,
        publisherId: "afon",
        version: "1.0.0",
        installState: "active",
        active: true,
        installedAt: "built-in",
        lastValidatedAt: "built-in",
        source: "builtin",
        packageHash: "",
        signature: "",
        localPath: ""
      }
    ]
  };
}

export class ThemeValidationError extends Error {
  constructor(message, code = "theme_validation_failed") {
    super(message);
    this.name = "ThemeValidationError";
    this.code = code;
  }
}

export class LocalThemeCache {
  constructor({ storage = globalThis.localStorage, cacheKey = CACHE_KEY } = {}) {
    this.storage = storage;
    this.cacheKey = cacheKey;
  }

  read() {
    if (!this.storage) return createDefaultRegistry();
    const raw = this.storage.getItem(this.cacheKey);
    if (!raw) return createDefaultRegistry();

    try {
      const registry = JSON.parse(raw);
      return this.validateRegistry(registry) ? registry : createDefaultRegistry();
    } catch {
      return createDefaultRegistry();
    }
  }

  write(registry) {
    const safeRegistry = this.validateRegistry(registry) ? registry : createDefaultRegistry();
    if (this.storage) this.storage.setItem(this.cacheKey, JSON.stringify(safeRegistry));
    return safeRegistry;
  }

  validateRegistry(registry) {
    return Boolean(
      isObject(registry) &&
      registry.schemaVersion === 1 &&
      Array.isArray(registry.installedThemes) &&
      registry.installedThemes.every((theme) => hasFields(theme, REQUIRED_REGISTRY_FIELDS))
    );
  }
}

export class ThemeRegistryService {
  constructor({
    catalogUrl = "/afon/themes/catalog.json",
    registrySchemaUrl = "/afon/themes/registry-schema.json",
    fetcher = globalThis.fetch,
    cache = new LocalThemeCache(),
    logger = () => {}
  } = {}) {
    this.catalogUrl = catalogUrl;
    this.registrySchemaUrl = registrySchemaUrl;
    this.fetcher = fetcher;
    this.cache = cache;
    this.logger = logger;
  }

  async fetchJson(url) {
    if (!this.fetcher) throw new ThemeValidationError("Fetch is unavailable.", "fetch_unavailable");
    const response = await this.fetcher(url);
    if (!response || !response.ok) throw new ThemeValidationError(`Unable to load ${url}.`, "fetch_failed");
    return response.json();
  }

  async loadRemoteCatalog() {
    try {
      const catalog = await this.fetchJson(this.catalogUrl);
      const normalized = this.normalizeCatalog(catalog);
      this.validateCatalog(normalized);
      return normalized;
    } catch (error) {
      this.logger("theme_registry_fetch_failed", {
        raw_count: 0,
        visible_count: 0,
        merged_count: 0,
        filtered_count: 0
      });
      return {
        schemaVersion: 1,
        updatedAt: "",
        themes: [],
        fallbackTheme: DEFAULT_THEME_ID,
        error
      };
    }
  }

  normalizeCatalog(catalog) {
    if (!isObject(catalog) || !Array.isArray(catalog.themes)) {
      throw new ThemeValidationError("Theme catalog is invalid.", "invalid_catalog");
    }

    return {
      schemaVersion: catalog.schemaVersion || catalog.version,
      updatedAt: catalog.updatedAt || "",
      themes: catalog.themes.map((theme) => ({
        status: "available",
        tags: [],
        ...theme,
        minAfonVersion: theme.minAfonVersion || "0.1.0",
        packageUrl: theme.packageUrl || "",
        previewUrl: theme.previewUrl || "",
        signature: theme.signature || "",
        sha256: theme.sha256 || ""
      }))
    };
  }

  async loadRegistrySchema() {
    const schema = await this.fetchJson(this.registrySchemaUrl);
    if (!this.cache.validateRegistry(schema)) {
      throw new ThemeValidationError("Registry schema shape is invalid.", "invalid_registry_schema");
    }
    return schema;
  }

  validateCatalog(catalog) {
    if (!isObject(catalog) || catalog.schemaVersion !== 1 || !Array.isArray(catalog.themes)) {
      throw new ThemeValidationError("Theme catalog is invalid.", "invalid_catalog");
    }

    catalog.themes.forEach((theme) => {
      if (!hasFields(theme, REQUIRED_CATALOG_FIELDS)) {
        throw new ThemeValidationError("Theme catalog entry is missing required fields.", "invalid_catalog_theme");
      }
    });

    return true;
  }

  discoverTheme(catalog, themeId) {
    const theme = catalog.themes.find((entry) => entry.themeId === themeId);
    return theme || null;
  }
}

export class ThemeDisplayService {
  constructor({ logger = () => {} } = {}) {
    this.logger = logger;
  }

  buildVisibleThemes({
    remoteCatalog,
    localRegistry,
    unlockedThemeIds = [],
    compatibility = {}
  }) {
    const remoteThemes = remoteCatalog?.themes || [];
    const localThemes = localRegistry?.installedThemes || [];
    const unlockedKeys = new Set(unlockedThemeIds);
    const byIdentity = new Map();
    const filtered = [];

    remoteThemes.forEach((remote) => {
      byIdentity.set(identityKey(remote), { remote });
    });

    localThemes.forEach((local) => {
      const key = identityKey(local);
      const existing = byIdentity.get(key);
      const isLocalTestOnly = local.source === "local_test" && !existing;
      if (isLocalTestOnly || (local.source === "bundled" && !existing)) {
        filtered.push({ theme: local, reason: "bundled_duplicate" });
        return;
      }
      byIdentity.set(key, { ...(existing || {}), local });
    });

    const visibleThemes = [...byIdentity.values()].map(({ local, remote }) => this.mergeTheme({ local, remote, unlockedKeys, compatibility }));

    this.logger("theme_registry_fetch_success", {
      raw_count: remoteThemes.length,
      visible_count: visibleThemes.length,
      merged_count: visibleThemes.length,
      filtered_count: filtered.length,
      ...(filtered.length ? { filtered_reason: filtered[0].reason } : {})
    });

    return visibleThemes;
  }

  mergeTheme({ local, remote, unlockedKeys, compatibility }) {
    const base = remote || local;
    const key = identityKey(base);
    const displayState = this.resolveDisplayState({ local, remote, unlockedKeys, compatibility });
    return {
      themeId: base.themeId,
      publisherId: base.publisherId,
      name: remote?.name || local?.name || base.themeId,
      subtitle: this.publisherLabel(remote || local),
      description: remote?.description || local?.description || "",
      version: remote?.version || local?.version || "",
      previewUrl: remote?.previewUrl || "",
      manifestUrl: remote?.manifestUrl || "",
      source: remote ? "mtech_catalog" : local?.source || "local",
      localInstallState: local?.installState || "available",
      active: local?.active === true,
      userVisible: true,
      displayState,
      statusText: this.statusText(displayState),
      helperText: displayState === "locked" ? "Enter an unlock code to install this theme." : "",
      mergedIdentity: key
    };
  }

  resolveDisplayState({ local, remote, unlockedKeys, compatibility }) {
    const key = identityKey(remote || local);
    const states = [];
    const isIncompatible = remote?.status === "incompatible" || local?.installState === "incompatible" || compatibility[key] === false;

    if (local?.active === true || local?.installState === "active") states.push("active");
    if (["installed", "active"].includes(local?.installState)) states.push("installed");
    if (unlockedKeys.has(key) || unlockedKeys.has((remote || local)?.themeId)) states.push("unlocked");
    if (!isIncompatible && remote && !unlockedKeys.has(key) && !unlockedKeys.has(remote.themeId) && remote.requiresEntitlement !== false) states.push("locked");
    if (!isIncompatible && (remote?.status === "active" || remote?.status === "available" || remote?.status === "staged")) states.push("available");
    if (isIncompatible) states.push("incompatible");
    states.push("unavailable");

    return sortedDisplayState(states);
  }

  publisherLabel(theme) {
    if (theme.publisherId === "mtech") return "M-Tech Theme";
    return `${theme.publisherId} Theme`;
  }

  statusText(displayState) {
    return {
      active: "Active",
      installed: "Installed",
      unlocked: "Unlocked",
      locked: "Locked",
      available: "Available",
      incompatible: "Incompatible",
      unavailable: "Unavailable"
    }[displayState] || "Unavailable";
  }
}

export class ThemeInstallService {
  constructor({
    installContractUrl = "/afon/themes/install-contract.json",
    fetcher = globalThis.fetch,
    cache = new LocalThemeCache(),
    clock = () => new Date()
  } = {}) {
    this.installContractUrl = installContractUrl;
    this.fetcher = fetcher;
    this.cache = cache;
    this.clock = clock;
  }

  async fetchJson(url) {
    if (!this.fetcher) throw new ThemeValidationError("Fetch is unavailable.", "fetch_unavailable");
    const response = await this.fetcher(url);
    if (!response || !response.ok) throw new ThemeValidationError(`Unable to load ${url}.`, "fetch_failed");
    return response.json();
  }

  async loadInstallContract() {
    const contract = await this.fetchJson(this.installContractUrl);
    this.validateInstallContract(contract);
    return contract;
  }

  async installFromThemeRecord(themeRecord) {
    try {
      const contract = await this.loadInstallContract();
      const installJson = await this.fetchJson(themeRecord.installUrl || themeRecord.manifestUrl.replace(/manifest\.json$/, "install.json"));
      const manifest = await this.fetchJson(themeRecord.manifestUrl);

      this.validateInstallPackage({ contract, themeRecord, installJson, manifest });

      const registry = this.cache.read();
      const timestamp = nowIso(this.clock);
      const nextEntry = {
        themeId: themeRecord.themeId,
        publisherId: themeRecord.publisherId,
        version: themeRecord.version,
        installState: "installed",
        active: false,
        installedAt: timestamp,
        lastValidatedAt: timestamp,
        source: "mtech_catalog",
        packageHash: themeRecord.sha256 || "",
        signature: themeRecord.signature || "",
        localPath: `themes/${themeRecord.themeId}/${themeRecord.version}`
      };

      const withoutExisting = registry.installedThemes.filter((theme) => identityKey(theme) !== identityKey(themeRecord));
      const nextRegistry = {
        schemaVersion: 1,
        installedThemes: [...withoutExisting, nextEntry]
      };
      return this.cache.write(nextRegistry);
    } catch (error) {
      return this.markFailed(themeRecord, error);
    }
  }

  validateInstallContract(contract) {
    const hasInstallStates = REQUIRED_INSTALL_STATES.every((state) => contract?.installStates?.includes(state));
    const hasValidationSteps = REQUIRED_VALIDATION_STEPS.every((step) => contract?.requiredValidation?.includes(step));

    if (
      !isObject(contract) ||
      contract.schemaVersion !== 1 ||
      !Array.isArray(contract.installStates) ||
      !Array.isArray(contract.requiredValidation) ||
      !hasInstallStates ||
      !hasValidationSteps ||
      contract.fallbackTheme !== DEFAULT_THEME_ID ||
      contract.allowsCodeExecution !== false ||
      contract.allowsWebViewModification !== false
    ) {
      throw new ThemeValidationError("Install contract is invalid.", "invalid_install_contract");
    }
    return true;
  }

  validateInstallPackage({ contract, themeRecord, installJson, manifest }) {
    this.validateInstallContract(contract);

    if (!hasFields(installJson, REQUIRED_INSTALL_FIELDS)) {
      throw new ThemeValidationError("Install JSON is missing required fields.", "invalid_install_json");
    }

    if (!hasFields(manifest, REQUIRED_MANIFEST_FIELDS)) {
      throw new ThemeValidationError("Theme manifest is missing required fields.", "invalid_manifest");
    }

    if (
      themeRecord.themeId !== installJson.themeId ||
      themeRecord.themeId !== manifest.themeId ||
      themeRecord.publisherId !== installJson.publisherId ||
      themeRecord.publisherId !== manifest.publisherId ||
      themeRecord.version !== installJson.version ||
      themeRecord.version !== manifest.version
    ) {
      throw new ThemeValidationError("Theme identity fields do not match.", "theme_identity_mismatch");
    }

    if (installJson.installPolicy?.allowInstall !== true || installJson.installPolicy?.allowActivate !== true) {
      throw new ThemeValidationError("Theme install policy does not allow install and activation.", "install_not_allowed");
    }

    if (manifest.packageType !== "theme" || manifest.behaviorScope !== "cosmetic_only") {
      throw new ThemeValidationError("Theme package is not cosmetic-only.", "invalid_behavior_scope");
    }

    if (manifest.allowsCodeExecution !== false || manifest.allowsWebViewModification !== false) {
      throw new ThemeValidationError("Theme package requests unsafe behavior.", "unsafe_theme_behavior");
    }

    if (!this.validateThemeTokens(manifest.tokens)) {
      throw new ThemeValidationError("Theme colors are malformed.", "invalid_theme_colors");
    }

    return true;
  }

  validateThemeTokens(tokens) {
    return isObject(tokens) && TOKEN_FIELDS.every((field) => isHexColor(tokens[field]));
  }

  markFailed(themeRecord, error) {
    const registry = this.cache.read();
    const failedThemeId = themeRecord?.themeId || "unknown";
    const failedEntry = {
      themeId: failedThemeId,
      publisherId: themeRecord?.publisherId || "",
      version: themeRecord?.version || "",
      installState: "failed",
      active: false,
      installedAt: "",
      lastValidatedAt: nowIso(this.clock),
      source: "mtech_catalog",
      packageHash: themeRecord?.sha256 || "",
      signature: themeRecord?.signature || "",
      localPath: ""
    };
    const existingActive = registry.installedThemes.find((theme) => theme.active);
    const withoutFailed = registry.installedThemes.filter((theme) => identityKey(theme) !== identityKey(failedEntry));
    const nextRegistry = {
      schemaVersion: 1,
      installedThemes: existingActive ? [...withoutFailed, failedEntry] : [createDefaultRegistry().installedThemes[0], failedEntry]
    };
    const written = this.cache.write(nextRegistry);
    return {
      registry: written,
      error,
      fallbackTheme: DEFAULT_THEME_ID
    };
  }
}

export class ThemeActivationService {
  constructor({ cache = new LocalThemeCache() } = {}) {
    this.cache = cache;
  }

  activate(themeId, publisherId) {
    const registry = this.cache.read();
    const target = registry.installedThemes.find((theme) => theme.themeId === themeId && (!publisherId || theme.publisherId === publisherId));
    if (!target || !["installed", "active"].includes(target.installState)) {
      return this.revertToDefault();
    }

    const nextRegistry = {
      schemaVersion: 1,
      installedThemes: registry.installedThemes.map((theme) => ({
        ...theme,
        active: identityKey(theme) === identityKey(target),
        installState: identityKey(theme) === identityKey(target) ? "active" : theme.installState === "active" ? "installed" : theme.installState
      }))
    };
    return this.cache.write(nextRegistry);
  }

  deactivate(themeId) {
    const registry = this.cache.read();
    const target = registry.installedThemes.find((theme) => theme.themeId === themeId);
    if (!target || themeId === DEFAULT_THEME_ID) return this.revertToDefault();

    const nextRegistry = {
      schemaVersion: 1,
      installedThemes: registry.installedThemes.map((theme) => {
        if (theme.themeId === themeId) return { ...theme, active: false, installState: "installed" };
        if (theme.themeId === DEFAULT_THEME_ID) return { ...theme, active: true, installState: "active" };
        return { ...theme, active: false, installState: theme.installState === "active" ? "installed" : theme.installState };
      })
    };
    return this.cache.write(nextRegistry);
  }

  revertToDefault() {
    const registry = this.cache.read();
    const hasDefault = registry.installedThemes.some((theme) => theme.themeId === DEFAULT_THEME_ID);
    const themes = hasDefault ? registry.installedThemes : [createDefaultRegistry().installedThemes[0], ...registry.installedThemes];
    const nextRegistry = {
      schemaVersion: 1,
      installedThemes: themes.map((theme) => ({
        ...theme,
        active: theme.themeId === DEFAULT_THEME_ID,
        installState: theme.themeId === DEFAULT_THEME_ID ? "active" : theme.installState === "active" ? "installed" : theme.installState
      }))
    };
    return this.cache.write(nextRegistry);
  }
}

export const ThemeDefaults = {
  CACHE_KEY,
  DEFAULT_THEME_ID,
  createDefaultRegistry
};
