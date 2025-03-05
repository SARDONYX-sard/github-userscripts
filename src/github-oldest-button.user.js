//@ts-check
// ==UserScript==
// @name        GitHub Oldest/Newest Button
// @author      SARDONYX-sard
// @description Add github more buttons.
// @downloadURL https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/github-oldest-button.user.js
// @grant       none
// @icon        https://github.githubassets.com/pinned-octocat.svg
// @license     Unlicense
// @match       https://github.com/*/*
// @namespace   https://github.com/SARDONYX-sard
// @run-at      document-idle
// @updateURL   https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/github-oldest-button.user.js
// @version     1.0.4
// ==/UserScript==

// ref
// - https://github.com/bpceee/oldest
// - https://greasyfork.org/en/scripts/402250-github%E4%BB%93%E5%BA%93%E6%9F%A5%E7%9C%8B%E7%AC%AC%E4%B8%80%E6%AC%A1commit/code//

(() => {
  // # Config
  /** - Cache expiration time: 1Day(60sec * 60min * 24h) */
  const EXPIRES = 60 * 60 * 24;
  /** @type {"trace"|"debug"|"info"|"warn"|"error"} */
  const LOG_LEVEL = "trace";

  /** For debug */
  const USE_GITHUB_API = true;
  const AVOID_INFINITY = false;

  // # Setup(Please do not edit.) -----------------------------------
  const log = setupLogger(LOG_LEVEL, "[GitHub Button script] ");
  const storageCache = setupCache();
  /** Under multiple Async calls, File I/O(`localStorage`) is too slow to function as a flag, so DRAM is used. */
  let previousUrl = "";
  /** Without this flag, a single button press calls the GitHub API about 12 times */
  let usedAPI = false;
  let callTime = 0;
  // ----------------------------------------------------------------

  new MutationObserver((_mutations, _observer) => {
    main();
  }).observe(document, { childList: true, subtree: true });

  async function main() {
    log.debug("run Script");
    callTime++;
    if (AVOID_INFINITY && callTime > 5) {
      throw new Error(" 5 time more called. So stop this script.");
    }

    // Guard to detect DOM changes on all GitHub.com repo domains to prevent SPA,
    // but only do the actual processing of commits history.
    if (!window.location.pathname.match(/commits/)) {
      return log.info("This url isn't GitHub commit history page. So this script is canceled.");
    }

    if (previousUrl !== window.location.href) {
      log.trace(`[Changed URL] previousUrl: ${previousUrl}, href: ${window.location.href}`);
      previousUrl = window.location.href;
    }

    const $newer = document.querySelector('a[data-testid="pagination-next-button"]');
    const $paginationButtons = $newer?.parentElement?.parentElement;
    if (!$paginationButtons) {
      return log.info("Not found pagination buttons.It's probably in the middle of a DOM rendering update.");
    }

    const $older = $paginationButtons.querySelector('a[data-testid="pagination-prev-button"]');
    if (!($older && $newer)) {
      throw new Error("next or prev button is required");
    }

    const $newest = $paginationButtons.querySelector('a[data-testid="pagination-newest-button"]');
    const newestUrl = window.location.pathname;
    !$newest && $paginationButtons.prepend(createButton("Newest", $newer, { url: newestUrl }));

    const $oldest = $paginationButtons.querySelector('a[data-testid="pagination-oldest-button"]');
    const $oldestButton = createButton("Loading...", $older);

    if ($paginationButtons.contains($oldestButton)) {
      return;
    }
    !$oldest && $paginationButtons.appendChild($oldestButton);

    // - cache pattern
    const cachedOldestUrl = storageCache.get(newestUrl)?.oldestUrl;
    if (cachedOldestUrl) {
      editButton("Oldest", $oldestButton, { url: cachedOldestUrl });
      return log.info("Completed.(with cache)");
    }

    try {
      if (!usedAPI) {
        usedAPI = true;
        editButton("Fetching...", $oldestButton);
        const [repo, branch] = parseGitHubUrl(window.location.pathname);
        const oldestUrl = await fetchOldestUrl(repo, branch, { useApi: USE_GITHUB_API });
        if (oldestUrl) {
          editButton("Oldest", $oldestButton, { url: oldestUrl });
          storageCache.set(newestUrl, oldestUrl, EXPIRES);
          return log.info("Completed.(by API)");
        }
      }
    } catch (error) {
      editButton("Failed", $oldestButton);
      log.error(error);
      throw new Error(error);
    }
    editButton("Reload", $oldestButton);
  }

  /**
   * @param {"Newest"|"Oldest"|"Loading..."|"Fetching..."|"Failed"|"Reload"} buttonName
   * @param {Element} $a - edit target
   * @param {{url?: string}} options
   * @throws Not found span tag in target.
   */
  function editButton(buttonName, $a, { url } = {}) {
    if (url) {
      $a.removeAttribute("aria-disabled");
      $a.setAttribute("style", "color: var(--fgColor-accent,var(--color-accent-fg,#2f81f7))");
      $a.setAttribute("href", url);
    } else {
      $a.removeAttribute("href");
      $a.setAttribute("aria-disabled", "true");
      $a.setAttribute("style", "color: var(--fgColor-disabled,var(--color-primer-fg-disabled,#484f58))");
    }

    const id = buttonName === "Newest" ? "newest" : "oldest";
    $a.setAttribute("data-testid", `pagination-${id}-button`);

    const $span = $a.firstChild;
    if (!($span instanceof HTMLSpanElement)) {
      throw new Error("textElement must HTMLSpanElement.");
    }
    $span.innerText = buttonName;
  }

  /**
   * @param {"Newest"|"Oldest"|"Loading..."} name
   * @param {Element} base - Clone target element
   * @param {{url?: string}} options
   * @throws `Error`
   */
  function createButton(name, base, options = {}) {
    const $cloned = base.cloneNode(true);
    if (!($cloned instanceof Element)) {
      throw new Error("clonedNode must Element.");
    }
    editButton(name, $cloned, options);
    return $cloned;
  }

  /**
   * TODO: Parse branch(https://stackoverflow.com/questions/12093748/how-do-i-check-for-valid-git-branch-names)
   * @param {string} url
   * @returns {[string, string]} - `[repo, branch]`
   * @throws `Error`
   * @example
   * ```javascript
   * const actual = parseGitHubUrl("https://github.com/SARDONYX-sard/dar-to-oar/commits/main")
   * console.assert(actual, ["SARDONYX-sard/dar-to-oar", "main"])
   * ```
   */
  function parseGitHubUrl(url) {
    const currentUrlPathArray = window.location.pathname.match(/\/([^/]+\/[^/]+)(?:\/(?:tree|commits|blob))\/([^?]+)?/);
    if (!currentUrlPathArray) {
      throw new Error("Failed to parse newest commit url.");
    }
    //! NOTE: RegExpMatchArray says it returns a string, but destructuring assignments can be undefined.
    const [, repo, branch_] = /** @type {[never, string|undefined, string|undefined]} */ currentUrlPathArray;
    if (!(repo && branch_)) {
      throw new Error(`Not found repo and branch in url: ${url}`);
    }
    const branch = branch_?.endsWith("/") ? branch_.replace(/\/$/, "") : branch_;
    return /** @type {const} */ ([repo, branch]);
  }

  /**
   * @param {string} repo
   * @param {string} branch
   * @param {{useApi?: boolean}} options
   *               default options: { isDebug: false, useApi: true(false is always return null) }
   * @return commit page url | null
   */
  async function fetchOldestUrl(repo, branch, { useApi = true }) {
    const gitHubHeader = /** @type {const} */ ({
      headers: { Accept: "application/vnd.github.v3+json" },
    });

    /**
     * - ref: https://stackoverflow.com/questions/27931139/how-to-use-github-v3-api-to-get-commit-count-for-a-repo
     * @param {string} url
     * @returns Number of total commits the repo contains on each branch
     * @throws Error
     */
    const getTotalCommits = async (url) => {
      /** If the query > 100 commits(per_page=100) due to the query setting of this script, the link cannot get, so set it to 1 page. */
      const numberOfPages =
        (await fetch(url, gitHubHeader)).headers
          .get("link")
          ?.split(",")[1]
          ?.match(/.*page=(?<page_num>\d+)/)?.groups?.page_num ?? 1;
      if (!numberOfPages || Number.isNaN(Number(numberOfPages))) {
        throw new Error("Failed to get specified branch's number of pages.");
      }

      const data = await fetch(`${url}&page=${numberOfPages}`, gitHubHeader);
      /** ref: https://api.github.com/repos/SARDONYX-sard/SARDONYX-sard/commits?sha=main&per_page=100&page=41 */
      const commitsArray = /** @type any[] */ (await data.json());
      return commitsArray.length + (Number(numberOfPages) - 1) * 100;
    };

    /**
     * ref: https://api.github.com/repos/SARDONYX-sard/SARDONYX-sard/commits/main
     * @param {string} url
     */
    const getCommitsId = async (url) =>
      /** @type { { sha: string } } */ (await (await fetch(url, gitHubHeader)).json()).sha;

    if (!useApi) {
      return log.info("non use API MODE. Calling API that is canceled.");
    }

    const baseUrl = `https://api.github.com/repos/${repo}/commits`;
    const [commitId, commitCount] = await Promise.all([
      getCommitsId(`${baseUrl}/${branch}`),
      getTotalCommits(`${baseUrl}?sha=${branch}&per_page=100`),
    ]);
    if (!(commitCount && commitId) || Number.isNaN(commitCount)) {
      return null;
    }

    return `https://github.com/${repo}/commits/${branch}?after=${commitId}+${commitCount - 10}`;
  }

  /** create LocalStorage manager object */
  function setupCache() {
    /**
     * @typedef CacheData
     * @property {string} newestUrl
     * @property {string} oldestUrl
     * @property {string} expiredSec - seconds
     */
    return {
      /** @param {string} newestUrl */
      get(newestUrl) {
        const cacheJson = localStorage.getItem("github-button-data");
        /** @type Partial<CacheData|null> */
        const cacheData = cacheJson ? JSON.parse(cacheJson) : null;
        const currentSec = Math.round(+new Date() / 1000);
        const expiredSec = Number(cacheData?.expiredSec);
        const isOldCache = Number.isNaN(expiredSec) || expiredSec < currentSec;
        const hasValidCache = cacheData?.newestUrl === newestUrl && !isOldCache;
        if (!hasValidCache && cacheData && cacheData.oldestUrl) {
          cacheData.oldestUrl = undefined;
        }

        return cacheData;
      },
      /**
       * @param {string} newestUrl
       * @param {string} oldestUrl
       * @param {number} expires
       */
      set(newestUrl, oldestUrl, expires) {
        const date = new Date();
        /** @type CacheData */
        const newCacheData = {
          newestUrl: newestUrl,
          oldestUrl: oldestUrl,
          expiredSec: Math.round(date.setSeconds(date.getSeconds() + expires) / 1000).toString(),
        };
        localStorage.setItem("github-button-data", JSON.stringify(newCacheData));
      },
    };
  }

  /**
   * Logger with switchable log output fog according to variable levels.
   * @param {"trace"|"debug"|"info"|"warn"|"error"} logLevel
   * # NOTE
   * It is a function because it is not possible to hoist with a class.
   */
  function setupLogger(logLevel, prefix = "") {
    // Indicates an inclusion relationship.
    // Since trace contains error, isError is true when logLevel ="trace".
    const isError = /(?:trace|debug|info|warn|error)/.test(logLevel);
    const isWarn = /(?:trace|debug|info|warn|error)/.test(logLevel);
    const isInfo = /(?:trace|debug|info)/.test(logLevel);
    const isDebug = /(?:trace|debug)/.test(logLevel);
    const isTrace = "trace" === logLevel;

    return /** @type {const} */ ({
      isTrace,
      /** debug | info | warn | error */
      isDebug,
      /** info | warn | error */
      isInfo,
      /** warn | error */
      isWarn,
      /** error */
      isError,
      trace: (...msg) => isTrace && console.trace(`${prefix}TRACE ${msg}`),
      debug: (...msg) => isDebug && console.log(...msg),
      info: (...msg) => isInfo && console.info(`${prefix}INFO ${msg}`),
      warn: (...msg) => isWarn && console.warn(`${prefix}WARN ${msg}`),
      error: (...msg) => isError && console.error(`${prefix}ERROR ${msg}`),
    });
  }
})();
