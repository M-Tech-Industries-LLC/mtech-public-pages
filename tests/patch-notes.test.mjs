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

async function renderTesting(links) {
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
      json: async () => structuredClone(data)
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
            releases: [structuredClone(release)]
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
