//@ts-check

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
// @version     0.1.0
// @require     https://raw.githubusercontent.com/Gin-Quin/fast-toml/master/dist/browser/fast-toml.js
// ==/UserScript==

(async () => {
  // https://stackoverflow.com/questions/3522090/event-when-window-location-href-changes
  // Guard to detect DOM changes on all GitHub.com repo domains to prevent SPA, but only do the actual processing of commits history.
  let isCalled = false;
  const observer = new MutationObserver(async (mutations) => {
    if (!document.location.pathname.match(/Cargo.toml$/)) {
      document.getElementById("cargo-doc")?.remove();
      isCalled = false;
      return;
    }
    setTimeout(async () => {
      if (!isCalled) {
        isCalled = true;
        await githubCargoDocs();
      }
    }, 2000);
  });
  observer.observe(document, { childList: true, subtree: true });

  async function githubCargoDocs() {
    const target = document.getElementById("read-only-cursor-text-area");
    const toml = target?.textContent;
    if (toml == null) {
      return;
    }
    // @ts-ignore
    const parsedToml = TOML.parse(toml);
    alert(JSON.stringify(parsedToml));

    const depsKeys = ["build-dependencies", "dev-dependencies", "dependencies", "workspace.dependencies"];
    const hasDepsKey = depsKeys.some((key) => key in parsedToml);
    if (!hasDepsKey) {
      return;
    }

    const div = document.createElement("div");
    div.id = "cargo-doc";
    // Directly below the text of Cargo.toml
    const targetNode = document.querySelector(`section[aria-labelledby="file-name-id-wide file-name-id-mobile"]`);
    if (!targetNode) {
      throw new Error("Not found target Node.");
    }
    targetNode?.append(div);

    addDocLink(parsedToml, depsKeys);
  }

  /**
   *
   * @param {{}} parsedToml
   * @param {string[]} fields - e.g. ['dev-dependencies', 'dependencies', 'workspace.dependencies']
   */
  async function addDocLink(parsedToml, fields) {
    const docElm = document.getElementById("cargo-doc");

    for (const field of fields) {
      /** @type {{}|null} */
      let current = parsedToml;
      const pathParts = field.split(".");
      for (const part of pathParts) {
        if (current && current[part]) {
          current = current[part];
        } else {
          current = null;
          break;
        }
      }

      if (current) {
        for (const lib_name of Object.keys(current)) {
          const value = current[lib_name];
          if (typeof value === "object") {
            const version = value.version;
            // lib_name = { version = "0.1.0" }
            docElm?.append(await createDocsLink(lib_name, version));
          } else {
            // lib_name = "0.1.0"
            docElm?.append(await createDocsLink(lib_name, value));
          }
        }
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
