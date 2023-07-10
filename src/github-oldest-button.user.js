// @ts-check

// meta-ref
// - https://wiki.greasespot.net/Metadata_Block

// ==UserScript==
// @author      SARDONYX-sard
// @description Add github more buttons.
// @downloadURL https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/github-oldest-button.user.js
// @grant       none
// @icon        https://github.githubassets.com/pinned-octocat.svg
// @lisence     Unlisence
// @match       https://github.com/*/*
// @name        Add GitHub Oldest/Newest Button(GitHub API Version)
// @namespace   https://github.com/SARDONYX-sard
// @run-at      document-idle
// @updateURL   https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/github-oldest-button.user.js
// @version     0.3.12
// ==/UserScript==

// It has the following drawbacks
// - There is an API limit.
// ref
// - https://github.com/bpceee/oldest
// - https://greasyfork.org/en/scripts/402250-github%E4%BB%93%E5%BA%93%E6%9F%A5%E7%9C%8B%E7%AC%AC%E4%B8%80%E6%AC%A1commit/code//

// I don't currently know how to identify the location of the error even though the code
// that uses `throw new Error("")` to catch the error can identify the location of the error caught by devTool.
// (It is possible to identify the location of the error if I don't use `catch'.)
// So, I use `console.error()` and early return so that the link to the error location can be traced.

(() => {
  // Config
  /** - Cache expiration time: 1Day(60sec * 60min * 24h) */
  const expires = 60 * 60 * 24;
  const isDebugMode = false;
  /** Flag for when you want to analyze only the number of Api calls without actually using Api. */
  const useApi = true;

  // DRAM buffer to support SPA rendering
  /**
   * - Storage IO, to prevent a large number of Get requests from running in a sequence of callback functions
   *   in `MutationObserver` while asynchronous is running. Without this `memCacheUrl`, the GitHub API is called twice.
   */
  let memCacheUrl = "";
  /**
   * - Without this flag, a single button press calls the GitHub API about 12 times in the MutationObserver callback function,
   *   quickly reaching its API call limit.
   */
  let needApiCall = false;

  /**
   * @typedef CacheData
   * @property {string} newestUrl
   * @property {string} oldestUrl
   * @property {string} expiredSec - seconds
   */

  // Functions (These functions follow these rules.)
  // - **Avoid having external variables captured as closures** just by writing them
  //   in the function to avoid declaring them in the global namespace.

  /**
   * @param {string} newestUrl
   */
  const getStorageCache = (newestUrl) => {
    const cacheJson = localStorage.getItem("github-button-data");
    /** @type CacheData|null */
    const cacheData = cacheJson ? JSON.parse(cacheJson) : null;
    const currentSec = Math.round(+new Date() / 1000);
    const expiredSec = Number(cacheData?.expiredSec);
    const isOldCache = Number.isNaN(expiredSec) || expiredSec < currentSec;
    const hasValidCache = cacheData?.newestUrl === newestUrl && !isOldCache;

    return {
      hasValidCache,
      cacheData,
    };
  };

  /**
   * @param {string} newestUrl
   * @param {string} oldestUrl
   * @param {number} expires
   */
  const setStorageCache = (newestUrl, oldestUrl, expires) => {
    const date = new Date();
    /** @type CacheData */
    const newCacheData = {
      newestUrl: newestUrl,
      oldestUrl: oldestUrl,
      expiredSec: Math.round(date.setSeconds(date.getSeconds() + expires) / 1000).toString(),
    };
    localStorage.setItem("github-button-data", JSON.stringify(newCacheData));
  };

  /**
   * @param {(Element|null)[]} erElms
   * @param {"Newer"|"Older"} name
   * @returns
   */
  const getIsEndBtn = (erElms, name) => {
    const erElm = erElms.filter((elm) => elm?.textContent === name)[0];
    return erElm?.getAttribute("disabled") === "disabled";
  };

  /**
   * @description
   *      - If the `canPress` flag is true =>
   *          It creates a link that can be forced to be pressed, otherwise it creates a button that cannot be pressed.
   *      - If the `canPress` argument is not passed =>
   *          It will determine if the URL of the current location and the link to the button are the same.
   * @param {string} name
   * @param {{canPress?: boolean, url?: string}} options
   *          default options: { canPress: true, url: current location }
   */
  const createButton = (name, { canPress = true, url = window.location.href }) => {
    const isTargetUrl = window.location.href === url;
    const element =
      !canPress || isTargetUrl ? document.createElement("button") : document.createElement("a");
    // common attributes
    element.classList.add("btn", "btn-outline", "BtnGroup-item");
    element.innerText = name;

    if (element.tagName === "BUTTON") {
      element.setAttribute("disabled", "disabled");
    } else {
      element.removeAttribute("disabled");
      element.setAttribute("href", url);
    }

    return element;
  };

  /**
   * @param {string} repo
   * @param {string} branch
   * @param {{isDebug?: boolean, useApi?: boolean}} options
   *               default options: { isDebug: false, useApi: true(false is always return null) }
   * @return commit page url | null
   */
  const getOldestCommitUrl = async (repo, branch, { isDebug = false, useApi = true }) => {
    /**
     * ref
     * - https://stackoverflow.com/questions/27931139/how-to-use-github-v3-api-to-get-commit-count-for-a-repo
     * @param {string} url
     * @param {boolean} isDebug
     * @returns Number of total commits the repo contains on each branch
     */
    const getTotalCommits = async (url, isDebug = false) => {
      const headers = {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      };

      const res = await fetch(url, headers);

      if (isDebug) {
        console.info(`Fetch url: ${url},
  Res headers link: ${res.headers.get("Link")}`);
      }

      /**
       * If the query is less than 100 commits(per_page=100) due to the query setting of this script,
       * the link cannot get, so set it to one page.
       */
      const numberOfPages =
        res.headers
          .get("link")
          ?.split(",")[1]
          ?.match(/.*page=(?<page_num>\d+)/)?.groups?.page_num ?? 1;
      if (!numberOfPages || Number.isNaN(Number(numberOfPages))) {
        throw new Error("Failed to get specified branch's number of pages.");
      }

      const data = await fetch(`${url}&page=${numberOfPages}`, headers);
      /**
       * @type any[]
       * @example
       * - https://api.github.com/repos/SARDONYX-sard/SARDONYX-sard/commits?sha=main&per_page=100&page=41
       */
      const commitsArray = await data.json();
      return commitsArray.length + (Number(numberOfPages) - 1) * 100;
    };

    /**
     * @param {string} url
     */
    const getCommitsId = async (url) => {
      const res = await fetch(url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
      });
      /**
       * @type { { sha: string } }
       * @example
       * - https://api.github.com/repos/SARDONYX-sard/SARDONYX-sard/commits/main
       */
      const { sha: commitId } = await res.json();
      return commitId;
    };

    isDebug &&
      console.info(
        "[GitHub Button script] Trying to get the URL of the oldest commit using the GitHub API..."
      );
    if (!useApi) return null;
    const baseUrl = `https://api.github.com/repos/${repo}/commits`;

    try {
      const [commitId, commitCount] = await Promise.all([
        getCommitsId(`${baseUrl}/${branch}`),
        getTotalCommits(`${baseUrl}?sha=${branch}&per_page=100`, isDebug),
      ]);
      if (!(commitCount && commitId) || Number.isNaN(commitCount)) return null;
      return `https://github.com/${repo}/commits/${branch}?after=${commitId}+${commitCount - 10}`;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  // To reduce the number of executions, I considered hooking the history as shown in the code below,
  // but since the button disappears after multiple re-renderings, the only solution is to use MutationObserver for now.
  // - https://stackoverflow.com/questions/3522090/event-when-window-location-href-changes
  new MutationObserver(async (_mutations, _observer) => {
    // Guard to detect DOM changes on all GitHub.com repo domains to prevent SPA, but only do the actual processing of commits history.
    if (!window.location.pathname.match(/commits/)) return;

    isDebugMode && console.info("[GitHub Button script] Called main function by MutationObserver.");

    const btnGroup = (() => {
      const baseSelector = "#repo-content-pjax-container > div > div.paginate-container > div";
      const baseSelector2 = "#repo-content-turbo-frame > div > div.paginate-container > div";
      const btnGroup =
        document.querySelector(baseSelector) ?? document.querySelector(baseSelector2);

      !btnGroup && console.error("Failed to get btn Group.");
      return btnGroup;
    })();
    if (!btnGroup) return;
    const newestElm = btnGroup.querySelector("div > :nth-child(1)");
    const oldestElm = btnGroup.querySelector("div > :nth-child(4)");
    const isSetNewestElm = newestElm?.textContent === "Newest";
    const isSetOldestElm = /Oldest|Failed/.test(oldestElm?.textContent ?? "");
    if (btnGroup.childElementCount === 4 && isSetNewestElm && isSetOldestElm) return;

    /**
     * Newer/older elements
     * (To account for the possibility that the Newer button is a separate link from Newest but points to Newest.)
     */
    const erElms = [...btnGroup.querySelectorAll("div > *")].map((div) =>
      /Newer|Older/.test(div.textContent ?? "") ? div : null
    );
    const isNewestPage = getIsEndBtn(erElms, "Newer");
    const isOldestPage = getIsEndBtn(erElms, "Older");
    // TODO: Parse branch(https://stackoverflow.com/questions/12093748/how-do-i-check-for-valid-git-branch-names)
    const currentUrlPathArray = window.location.pathname.match(
      /\/([^\/]+\/[^\/]+)(?:\/(?:tree|commits|blob))\/([^\?]+)?/
    );

    if (!currentUrlPathArray) {
      console.error("Failed to parse newest commit url.");
      return;
    }
    //! RegExpMatchArray says it returns a string, but destructuring assignments can be undefined.
    const [, repo, branch] = /** @type {[never, string|undefined, string|undefined]} */ (
      currentUrlPathArray
    );
    if (!(repo && branch)) {
      console.error(
        `This occurs when no branch name is specified.
  Also, filters using custom queries such as author=<name> in the query are currently unsupported.

  It may be possible to retrieve it by using the following URL
              <any repo name>/commits/<branch name>
  e.g.: github.com/SARDONYX-sard/SARDONYX-sard/commits/main`
      );
      return;
    }

    const newestUrl = `https://github.com/${repo}/commits/${branch ?? ""}`;

    if (!isSetNewestElm) {
      btnGroup.prepend(createButton("Newest", { url: newestUrl, canPress: !isNewestPage }));
      if (isOldestPage) {
        btnGroup.append(createButton("Oldest", { canPress: false }));
        return;
      }
    }

    const { hasValidCache, cacheData } = getStorageCache(newestUrl);
    const cachedOldestUrl = hasValidCache ? cacheData?.oldestUrl : null;
    if (cachedOldestUrl && btnGroup.childElementCount !== 4) {
      btnGroup.append(createButton("Oldest", { url: cachedOldestUrl, canPress: !isOldestPage }));
      return;
    }

    if (memCacheUrl !== newestUrl) {
      memCacheUrl = newestUrl;
      needApiCall = true;
    }
    if (needApiCall && !(hasValidCache || cachedOldestUrl)) {
      const loadingElm = oldestElm ?? btnGroup?.querySelector("div > button");
      if (loadingElm?.textContent !== "Loading...") {
        btnGroup.append(createButton("Loading...", { canPress: false }));
      }

      needApiCall = false;
      const oldestUrl = await getOldestCommitUrl(repo, branch, { isDebug: isDebugMode, useApi });
      if (!oldestUrl) {
        if (btnGroup.lastChild) btnGroup.removeChild(btnGroup.lastChild);
        btnGroup.append(createButton("Failed", { canPress: false }));
        console.error("couldn't get oldest commit URL.");
        return;
      }

      setStorageCache(newestUrl, oldestUrl, expires);

      // Use lastChild to avoid the problem of deletion errors even if a loading element is present.
      if (btnGroup.lastChild) {
        btnGroup.removeChild(btnGroup.lastChild);
        btnGroup.append(createButton("Oldest", { url: oldestUrl, canPress: !isOldestPage }));
        return;
      }
    } else {
      if (btnGroup.childElementCount === 3) {
        btnGroup.append(createButton("Need reload", { canPress: false }));
        console.warn(`[GitHub Button script] Please reload the page.
  API already used.(To avoid calling the API multiple times for each DOM update and to avoid being restricted)`);
      }
    }
  }).observe(document, { childList: true, subtree: true });
})();
