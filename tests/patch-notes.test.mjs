import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const rendererSource = readFileSync(
  new URL("../assets/js/patch-notes.js", import.meta.url),
  "utf8"
);

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.className = "";
    this.textContent = "";
    this.children = [];
    this.dataset = {};
    this.href = "";
    this._innerHTML = "";
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  set innerHTML(value) {
    this._innerHTML = value;
    if (value === "") this.children = [];
  }

  get innerHTML() {
    return this._innerHTML;
  }
}

function descendants(element) {
  return [element, ...element.children.flatMap(descendants)];
}

async function renderTesting(links, product) {
  const app = new FakeElement("div");
  app.dataset = {
    product: "afon",
    view: "testing",
    dataPath: "/assets/data/patch-notes.json"
  };

  const data = {
    products: {
      afon: {
        name: "Afon",
        testing: {
          currentAndroidVersion: "0.1.3+23",
          currentIosVersion: "0.1.1+13",
          currentAndroidBuild: "23",
          currentIosBuild: "13",
          androidTestingStatus: "Open Testing",
          iosTestingStatus: "Latest recorded testing build",
          links,
          diagnosticExclusions: []
        },
        releases: [{ summary: "Current Android testing release." }]
      }
    }
  };

  const context = {
    document: {
      querySelector: () => app,
      createElement: (tagName) => new FakeElement(tagName)
    },
    fetch: async () => ({
      ok: true,
      json: async () => structuredClone(product ? { products: { afon: product } } : data)
    }),
    structuredClone
  };
  vm.runInNewContext(rendererSource, context);
  await new Promise((resolve) => setImmediate(resolve));
  return app;
}

async function renderPatchNotes(release) {
  const app = new FakeElement("div");
  app.dataset = {
    product: "afon",
    view: "patch-notes",
    dataPath: "/assets/data/patch-notes.json"
  };

  const context = {
    document: {
      querySelector: () => app,
      createElement: (tagName) => new FakeElement(tagName)
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        products: {
          afon: {
            name: "Afon",
            releases: structuredClone(Array.isArray(release) ? release : [release])
          }
        }
      })
    }),
    structuredClone
  };
  vm.runInNewContext(rendererSource, context);
  await new Promise((resolve) => setImmediate(resolve));
  return app;
}

test("testing renderer omits Join Testing when no valid links exist", async () => {
  const app = await renderTesting([]);
  const headings = descendants(app)
    .filter((element) => element.tagName === "h2")
    .map((element) => element.textContent);

  assert.ok(headings.includes("Testing Versions"));
  assert.ok(!headings.includes("Join Testing"));
});

test("testing renderer shows only valid testing links", async () => {
  const app = await renderTesting([
    { label: "Android Testing", url: "https://example.test/android" },
    { label: "Unavailable Testing", url: "" }
  ]);
  const elements = descendants(app);
  const headings = elements
    .filter((element) => element.tagName === "h2")
    .map((element) => element.textContent);
  const anchors = elements.filter((element) => element.tagName === "a");

  assert.ok(headings.includes("Join Testing"));
  assert.equal(anchors.length, 1);
  assert.equal(anchors[0].textContent, "Android Testing");
  assert.equal(anchors[0].href, "https://example.test/android");
});

test("patch-notes renderer shows grouped improvements and release details", async () => {
  const app = await renderPatchNotes({
    version: "0.1.3+24",
    buildNumber: "24",
    releaseDate: "September 2026",
    platforms: ["Android"],
    summary: "Build 24 summary.",
    details: "Build 24 details.",
    improvements: [
      {
        title: "More reliable navigation",
        items: ["Improved address-bar and search navigation"]
      }
    ],
    knownIssuesTitle: "Known Compatibility Notes",
    knownIssues: ["Some services may behave differently"]
  });
  const elements = descendants(app);
  const headings = elements
    .filter((element) => ["h3", "h4"].includes(element.tagName))
    .map((element) => element.textContent);
  const paragraphs = elements
    .filter((element) => element.tagName === "p")
    .map((element) => element.textContent);
  const listItems = elements
    .filter((element) => element.tagName === "li")
    .map((element) => element.textContent);

  assert.ok(headings.includes("Version 0.1.3+24"));
  assert.ok(headings.includes("More reliable navigation"));
  assert.ok(headings.includes("Known Compatibility Notes"));
  assert.ok(paragraphs.includes("Build 24 summary."));
  assert.ok(paragraphs.includes("Build 24 details."));
  assert.ok(listItems.includes("Improved address-bar and search navigation"));
});

test("Build 25 preserves approved copy and renders before Build 24", async () => {
  const product = JSON.parse(readFileSync(
    new URL("../assets/data/patch-notes.json", import.meta.url), "utf8"
  )).products.afon;
  const latest = product.releases.find((release) => release.buildNumber === "25");
  const approvedBullets = [
    "Standard is now the default Link Protection mode",
    "Improved Standard and Strict navigation behavior",
    "Improved Strict-mode tab loading and new-tab reliability",
    "Improved handling of blocked navigation and bounded recovery",
    "More consistent Tracker, URL Safety, link, and download protections",
    "Improved external-link and navigation classification",
    "Improved tab lifecycle, Back/Forward, refresh, and background/foreground behavior",
    "Improved diagnostics and policy reporting",
    "General stability and reliability improvements"
  ];
  const knownIssue = "DuckDuckGo searches initiated from Afon’s Start Page may occasionally take longer to begin on some devices. Refreshing generally completes the search normally.";
  assert.equal(latest.buildNumber, "25");
  assert.equal(latest.summary, "Build 25 focuses on reliability and consistency across Afon’s navigation and privacy protections.");
  assert.deepEqual(latest.whatsNew, approvedBullets);
  assert.deepEqual(latest.knownIssues, [knownIssue]);
  const app = await renderPatchNotes(product.releases.filter((release) => !["26", "27"].includes(release.buildNumber)));
  const cards = app.children.filter((element) => element.className === "release-card");
  assert.equal(cards[0].children[0].textContent, "Version 0.1.3+25");
  assert.equal(cards[1].children[0].textContent, "Version 0.1.3+24");
  const sections = cards[0].children.filter((element) => element.className === "release-section");
  const improvements = sections.find((element) => element.children[0].textContent === "What's New");
  const known = sections.find((element) => element.children[0].textContent === "Known Issues");
  assert.deepEqual(descendants(improvements).filter((element) => element.tagName === "li").map((element) => element.textContent), approvedBullets);
  assert.deepEqual(descendants(known).filter((element) => element.tagName === "li").map((element) => element.textContent), [knownIssue]);
});

test("newest-release Known Issues surface uses Build 27", async () => {
  const product = JSON.parse(readFileSync(
    new URL("../assets/data/patch-notes.json", import.meta.url), "utf8"
  )).products.afon;
  const app = await renderTesting(product.testing.links, product);
  const known = app.children.find((element) => element.children[0]?.textContent === "Known Issues");
  assert.deepEqual(descendants(known).filter((element) => element.tagName === "li").map((element) => element.textContent), product.releases[0].knownIssues);
});

test("Build 27 preserves approved copy and renders before prior releases", async () => {
  const product = JSON.parse(readFileSync(
    new URL("../assets/data/patch-notes.json", import.meta.url), "utf8"
  )).products.afon;
  const release = product.releases[0];
  const approvedBullets = [
    "Clearer explanations when Afon blocks or interrupts navigation, with more helpful recovery options.",
    "Added Try HTTPS for eligible HTTP links. Afon tries the secure address without first contacting the insecure HTTP address.",
    "Improved Edit Address so the blocked URL is restored and ready to change.",
    "More consistent recovery from blocked HTTP navigation across typed addresses, tapped links, the Start page, and links opened from other apps.",
    "Private Session now preserves each tab’s navigation history while the session remains open, with improved isolation and cleanup of private browsing storage.",
    "Improved Start-page search compatibility, including Yahoo verification flows.",
    "Improved tab handling and protection against outdated navigation events.",
    "Accessibility and layout improvements across screen sizes, plus fixes for links opened from other apps and default-browser handling.",
    "General reliability fixes across Android, iPhone, and iPad."
  ];
  const approvedSummary = "Build 27 improves navigation recovery, Private Session behavior, Start-page search compatibility, tab handling, accessibility, and reliability across Android, iPhone, and iPad.";
  const approvedSecurityCopy = "Security remains unchanged: Insecure HTTP navigation stays blocked. Try HTTPS and Edit Address provide recovery options while preserving Afon’s existing security protections.";
  assert.equal(release.version, "0.1.3+27");
  assert.equal(release.buildNumber, "27");
  assert.equal(release.releaseDate, undefined);
  assert.deepEqual(release.platforms, ["Android", "iOS / iPadOS"]);
  assert.equal(release.summary, approvedSummary);
  assert.equal(release.details, approvedSecurityCopy);
  assert.deepEqual(release.whatsNew, approvedBullets);
  assert.ok(release.knownIssues.some((text) => text.includes("15 or later")));
  assert.ok(release.knownIssues.some((text) => text.includes("not in this iOS release")));
  assert.ok(release.knownIssues.some((text) => text.includes("does not add Continue Once")));
  assert.ok(!release.knownIssues.some((text) => /Yahoo verification|Private tabs may lose/i.test(text)));
  assert.ok(!product.releases.some((item) => item.buildNumber === "28"));
  const app = await renderPatchNotes(product.releases);
  const cards = app.children.filter((element) => element.className === "release-card");
  assert.deepEqual(cards.slice(0, 3).map((card) => card.children[0].textContent),
    ["Version 0.1.3+27", "Version 0.1.3+26", "Version 0.1.3+25"]);
  assert.ok(descendants(cards[0]).some((element) => element.textContent === "Compatibility and Security Notes"));
});

test("Build 26 remains intact as historical release data", async () => {
  const product = JSON.parse(readFileSync(
    new URL("../assets/data/patch-notes.json", import.meta.url), "utf8"
  )).products.afon;
  const release = product.releases.find((item) => item.buildNumber === "26");
  assert.equal(release.version, "0.1.3+26");
  assert.equal(release.buildNumber, "26");
  assert.deepEqual(release.platforms, ["Android", "iOS / iPadOS"]);
  assert.equal(release.whatsNew.length, 8);
  assert.ok(release.whatsNew.some((text) => text.includes("Brave, Startpage, Ecosia, and Yahoo")));
  assert.ok(release.whatsNew.some((text) => text.includes("search overlay")));
  assert.ok(release.knownIssues.some((text) => text.includes("15 or later")));
  assert.ok(release.knownIssues.some((text) => text.includes("not in this iOS release")));
  assert.ok(release.knownIssues.some((text) => text.includes("not resolved in Build 26")));
  assert.ok(!/video|typing|faster|Try HTTPS|Edit Address|adaptive/i.test(release.whatsNew.join(" ")));
  const app = await renderPatchNotes([release]);
  const card = app.children.find((element) => element.className === "release-card");
  assert.ok(descendants(card).some((element) => element.textContent === "Compatibility and Support Notes"));
});
