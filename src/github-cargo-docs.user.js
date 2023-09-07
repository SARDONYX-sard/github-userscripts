// ==UserScript==
// @name        Generate Cargo.toml dependencies link
// @author      SARDONYX-sard
// @description Generate Cargo.toml dependencies link
// @downloadURL https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/github-cargo-docs.user.js
// @grant       none
// @icon        https://github.githubassets.com/pinned-octocat.svg
// @license     Unlicense
// @match       https://github.com/*/*
// @namespace   https://github.com/SARDONYX-sard
// @run-at      document-idle
// @updateURL   https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/github-cargo-docs.user.js
// @version     0.0.2
// @require     https://raw.githubusercontent.com/Gin-Quin/fast-toml/master/dist/browser/fast-toml.js
// ==/UserScript==

(async () => {
  // https://stackoverflow.com/questions/3522090/event-when-window-location-href-changes
  // Guard to detect DOM changes on all GitHub.com repo domains to prevent SPA, but only do the actual processing of commits history.
  const observeUrlChange = () => {
    let oldHref = document.location.href;
    const body = document.querySelector("body");
    const observer = new MutationObserver(async (mutations) => {
      if (oldHref !== document.location.href) {
        oldHref = document.location.href;
        if (!document.location.pathname.endsWith("Cargo.toml")) {
          document.getElementById("cargo-doc")?.remove();
          return;
        }
        // Delay prevents the previous DOM from being returned if the DOM is not drawn in time.
        setTimeout(async () => {
          await githubCargoDocs();
        }, 3000);
      }
    });
    observer.observe(body, { childList: true, subtree: true });
  };
  window.onload = observeUrlChange;

  if (!window.location.pathname.endsWith("Cargo.toml")) {
    document.getElementById("cargo-doc")?.remove();
    return;
  }
  githubCargoDocs();

  async function githubCargoDocs() {
    const toml = document.getElementById("read-only-cursor-text-area")?.textContent;
    if (toml == null) {
      throw new Error("toml data not found");
    }
    const parsedToml = TOML.parse(toml);
    if (!parsedToml.dependencies) {
      return;
    }

    const div = document.createElement("div");
    div.id = "cargo-doc";
    // Directly below the text of Cargo.toml
    const targetNode = document.querySelector(
      "#repo-content-pjax-container > react-app > div > div > div > div > div > main > div > div > div:nth-child(3)"
    );
    targetNode?.append(div);

    for (const lib_name of Object.keys(parsedToml.dependencies)) {
      const value = parsedToml.dependencies[lib_name];
      if (typeof value === "object") {
        const version = value.version;
        // lib_name = { version = "0.1.0" }
        document.getElementById("cargo-doc")?.append(await createDocsLink(lib_name, version));
      } else {
        // lib_name = "0.1.0"
        document.getElementById("cargo-doc")?.append(await createDocsLink(lib_name, value));
      }
    }
    for (const lib_name of Object.keys(parsedToml["dev-dependencies"])) {
      const value = parsedToml["dev-dependencies"][lib_name];
      if (typeof value === "object") {
        const version = value.version;
        // lib_name = { version = "0.1.0" }
        document.getElementById("cargo-doc")?.append(await createDocsLink(lib_name, version));
      } else {
        // lib_name = "0.1.0"
        document.getElementById("cargo-doc")?.append(await createDocsLink(lib_name, value));
      }
    }
  }

  /**
   * @param {string} libName
   * @param {string|null} version
   */
  async function createDocsLink(libName, version) {
    const linkElement = document.createElement("a");
    let crateValue = "";
    linkElement.textContent = `${libName}${crateValue}`;
    linkElement.href = `https://docs.rs/${libName}/${version ?? ""}`;
    linkElement.target = "_blank";
    linkElement.style.cssText = "transition: background-color 0.3s ease-in-out; display: flex;";

    /**
     * @param {string} event
     * @param {string} color
     */
    const eventBgColor = (event, color) => {
      linkElement.addEventListener(event, () => (linkElement.style.backgroundColor = color));
    };
    eventBgColor("mouseover", "#222222b5");
    eventBgColor("mouseout", "transparent");

    return linkElement;
  }
})();
