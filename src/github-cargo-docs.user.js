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
// @version     0.0.1
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
    const parsedToml = parseToml(toml);
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
  }

  function debugParseToml() {
    const toml_data = `[package]
name = "ras"
version = "0.1.0"
edition = "2021"
authors = ["SARDONYX"]
description = "A small assembler."
license = "MIT OR Apache-2.0"

# See more keys and their definitions at https://doc.rust-lang.org/cargo/reference/manifest.html

[dependencies]
byteorder = "1.4.3"
clap = { version = "4.3.1", features = ["derive"] }
once_cell = "1.18.0"
seq-macro = "0.3.5"

[dev-dependencies]
pretty_assertions = "1.3.0"`;
    console.debug(parseToml(toml_data));
  }

  /**
   * Parse a TOML-formatted string and convert it to an object.
   *
   * @param {string} toml_data - The TOML-formatted string.
   * @returns {Object.<string, (Object|Array|string|number|boolean)>} - The object representing TOML data.
   */
  function parseToml(toml_data) {
    const tomlObject = {};
    let currentTable = null;

    const lines = toml_data.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Detect sections
      const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
      if (sectionMatch) {
        currentTable = sectionMatch[1];
        tomlObject[currentTable] = {};
        continue;
      }

      // Detect keys and values
      const keyValueMatch = /([\w|-]+)\s*=\s*(.+)/.exec(line);
      if (keyValueMatch && currentTable) {
        const key = keyValueMatch[1];
        const value = keyValueMatch[2].trim();
        tomlObject[currentTable][key] = parseValue(value);
      }
    }

    return tomlObject;
  }

  /**
   * Parse a TOML-formatted value into an appropriate JavaScript data type.
   *
   * @param {string} value - The TOML-formatted value.
   * @returns {(Object|Array|string|number|boolean)} - The parsed JavaScript data.
   */
  function parseValue(value) {
    /**
     * @param{string} value
     * @returns {Object.<string, (Object|Array|string|number|boolean)>} - パースされたJavaScriptオブジェクト
     */
    const parseTomlValue = (value) => {
      const cleanedValue = value.slice(1, -1).trim();
      const keyValuePairs = cleanedValue.split(",").map((pair) => pair.trim());
      const parsedObject = {};

      for (const keyValuePair of keyValuePairs) {
        const [key, rawValue] = keyValuePair.split("=").map((item) => item.trim());
        parsedObject[key] = parseValue(rawValue);
      }

      return parsedObject;
    };

    /**
     * Parse a TOML-formatted array into a JavaScript array.
     *
     * @param {string} value - The TOML-formatted array.
     * @returns {Array.<(|Array|string|number|boolean)>} - The parsed JavaScript array.
     */
    const parseArray = (value) => {
      const cleanedValue = value.slice(1, -1).trim();
      const elements = cleanedValue.split(",").map((item) => parseValue(item.trim()));
      return elements;
    };

    /**
     * @param{string} value
     */
    const parseBool = (value) => {
      return value === "true";
    };

    if (value.startsWith("{") && value.endsWith("}")) {
      return parseTomlValue(value);
    } else if (value.startsWith("[") && value.endsWith("]")) {
      return parseArray(value);
    } else if (value === "true" || value === "false") {
      return parseBool(value);
    } else if (!isNaN(parseFloat(value))) {
      return parseFloat(value);
    } else if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      return value.slice(1, -1);
    } else {
      return value;
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
