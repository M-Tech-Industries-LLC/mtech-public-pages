(function () {
  const app = document.querySelector("[data-release-app]");
  if (!app) return;

  const productKey = app.dataset.product || "afon";
  const view = app.dataset.view || "patch-notes";
  const dataPath = app.dataset.dataPath || "/assets/data/patch-notes.json";

  const make = (tag, className, text) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  };

  const list = (items) => {
    const ul = make("ul", "check-list compact-list");
    items.forEach((item) => ul.appendChild(make("li", "", item)));
    return ul;
  };

  const detail = (label, value) => {
    const item = make("div", "release-detail");
    item.appendChild(make("span", "", label));
    item.appendChild(make("strong", "", value || "Not published"));
    return item;
  };

  const section = (title, items) => {
    if (!items || items.length === 0) return null;
    const block = make("div", "release-section");
    block.appendChild(make("h4", "", title));
    block.appendChild(list(items));
    return block;
  };

  const renderRelease = (release) => {
    const article = make("article", "release-card");
    article.appendChild(make("h3", "", `Version ${release.version}`));

    const details = make("div", "release-details");
    details.appendChild(detail("Build Number", release.buildNumber));
    details.appendChild(detail("Release Date", release.releaseDate));
    details.appendChild(detail("Platforms", (release.platforms || []).join(", ")));
    if (release.testingStatus) {
      details.appendChild(detail("Testing Status", release.testingStatus));
    }
    article.appendChild(details);

    if (release.summary) {
      const highlights = make("div", "release-section");
      highlights.appendChild(make("h4", "", "Highlights"));
      highlights.appendChild(make("p", "", release.summary));
      article.appendChild(highlights);
    }

    [
      ["What's New", release.whatsNew],
      ["Fixes", release.fixes],
      ["Known Issues", release.knownIssues],
      ["Tester Focus", release.testerFocus]
    ].forEach(([title, items]) => {
      const block = section(title, items);
      if (block) article.appendChild(block);
    });

    return article;
  };

  const renderPatchNotes = (product) => {
    app.innerHTML = "";
    if (!product.releases || product.releases.length === 0) {
      const empty = make("article", "info-panel");
      empty.appendChild(make("h2", "", `${product.name} patch notes are reserved.`));
      empty.appendChild(make("p", "", product.description));
      app.appendChild(empty);
      return;
    }

    let currentGroup = "Afon Releases";
    product.releases.forEach((release) => {
      const nextGroup = release.group || "Afon Releases";
      if (nextGroup !== currentGroup || app.children.length === 0) {
        currentGroup = nextGroup;
        const heading = make("div", "release-group");
        heading.appendChild(make("h2", "", currentGroup));
        app.appendChild(heading);
      }
      app.appendChild(renderRelease(release));
    });
  };

  const renderTesting = (product) => {
    const testing = product.testing || {};
    const latest = (product.releases || [])[0] || {};
    app.innerHTML = "";

    const overview = make("section", "grid two testing-grid");
    const current = make("article", "info-panel");
    current.appendChild(make("h2", "", "Testing Versions"));
    const currentDetails = make("div", "release-details stacked");
    currentDetails.appendChild(detail("Android Version", testing.currentAndroidVersion));
    currentDetails.appendChild(detail("Current Android Build", testing.currentAndroidBuild));
    currentDetails.appendChild(detail("Android Testing Status", testing.androidTestingStatus));
    currentDetails.appendChild(detail("iOS Version", testing.currentIosVersion));
    currentDetails.appendChild(detail("iOS Build", testing.currentIosBuild));
    currentDetails.appendChild(detail("iOS Testing Status", testing.iosTestingStatus));
    current.appendChild(currentDetails);

    overview.appendChild(current);
    const testingLinks = (testing.links || []).filter(
      (link) => typeof link?.url === "string" && link.url.trim()
    );
    if (testingLinks.length) {
      const join = make("article", "info-panel");
      join.appendChild(make("h2", "", "Join Testing"));
      const actions = make("div", "action-row");
      testingLinks.forEach((link) => {
        const anchor = make("a", "button primary", link.label);
        anchor.href = link.url;
        actions.appendChild(anchor);
      });
      join.appendChild(actions);
      overview.appendChild(join);
    }
    app.appendChild(overview);

    const highlights = make("article", "info-panel");
    highlights.appendChild(make("h2", "", "Recent Highlights"));
    highlights.appendChild(make("p", "", latest.summary || "Release highlights will be published when available."));
    app.appendChild(highlights);

    const known = make("article", "info-panel");
    known.appendChild(make("h2", "", "Known Issues"));
    known.appendChild(latest.knownIssues && latest.knownIssues.length ? list(latest.knownIssues) : make("p", "", "No active public issues are listed."));
    app.appendChild(known);

    const feedback = make("article", "info-panel");
    feedback.appendChild(make("h2", "", "Feedback"));
    feedback.appendChild(make("p", "", testing.feedback || "Feedback instructions will be published when testing opens."));
    app.appendChild(feedback);

    const privacy = make("article", "info-panel");
    privacy.appendChild(make("h2", "", "Privacy Notice"));
    privacy.appendChild(make("p", "", "Diagnostic reports exclude:"));
    privacy.appendChild(testing.diagnosticExclusions && testing.diagnosticExclusions.length ? list(testing.diagnosticExclusions) : make("p", "", "Diagnostic details will be documented when testing opens."));
    app.appendChild(privacy);
  };

  fetch(dataPath)
    .then((response) => {
      if (!response.ok) throw new Error("Release data could not be loaded.");
      return response.json();
    })
    .then((data) => {
      const product = data.products && data.products[productKey];
      if (!product) throw new Error("Product release data was not found.");
      if (view === "testing") renderTesting(product);
      else renderPatchNotes(product);
    })
    .catch((error) => {
      app.innerHTML = "";
      const fallback = make("article", "legal-section");
      fallback.appendChild(make("h2", "", "Release information unavailable"));
      fallback.appendChild(make("p", "", error.message));
      app.appendChild(fallback);
    });
})();
