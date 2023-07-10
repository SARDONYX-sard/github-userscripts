// @ts-check

/** @type {"debug"|"info"|"warn"|"error"} */
const DEBUG_MODE = "debug";
const INTERVAL_TIME = 1000;
const CLEAR_INTERVAL_TIME = 1000;

const log = {
  debug: (...msg) => {
    /(?:debug)/.test(DEBUG_MODE) && console.debug(...msg);
  },
  info: (...msg) => {
    /(?:debug|info)/.test(DEBUG_MODE) && console.info(...msg);
  },
  warn: (...msg) => {
    /(?:debug|info|warn)/.test(DEBUG_MODE) && console.warn(...msg);
  },
  error: (...msg) => {
    /(?:debug|info|warn|error)/.test(DEBUG_MODE) && console.error(...msg);
  },
};

/** See: https://developer.mozilla.org/en-US/docs/Glossary/Base64 */
function base64ToBytes(/** @type {string} */ base64) {
  const binString = atob(base64);
  // @ts-ignore
  return Uint8Array.from(binString, (m) => m.codePointAt(0));
}

function bytesToBase64(bytes) {
  const binString = Array.from(bytes, (x) => String.fromCodePoint(x)).join("");
  return btoa(binString);
}

/// ref: https://stackoverflow.com/questions/25022016/get-all-file-names-from-a-github-repo-through-the-github-api
async function createMarkdownFileLinks() {
  const url =
    "https://api.github.com/repos/SARDONYX-sard/github-userscripts/git/trees/main?recursive=1";

  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
    },
  });

  log.info(`Fetch url: ${url},
  Res headers link: ${res.headers.get("Link")}`);

  /**
   * ref: https://github.com/microsoft/TypeScript/issues/50321
   * @typedef {{
   *   sha: string;
   *   url: string;
   *   tree: ({
   *       path: string;
   *       mode: string;
   *       type: string;
   *       sha: string;
   *       size?: number;
   *       url: string;
   *   })[];
   *   truncated: boolean;
   * }} FileTree
   */
  /** @type {FileTree} */
  const fileTree = await res.json();
  const rawLink = "https://github.com/SARDONYX-sard/github-userscripts/raw/main";

  let myLinksMd = "";
  let forkLinksMd = "";
  fileTree.tree.forEach((fileInfo) => {
    if (fileInfo.path.endsWith("user.js")) {
      const [_, _dir, fileName, _ext] = fileInfo.path.match(/(.*\/)(.*)(\.user\.js)/) ?? [];
      if (!fileName) {
        log.error("Failed to get file name");
        return;
      }

      const linkMd = `- [${fileName}](${rawLink}/${fileInfo.path}) \n`;

      if (fileInfo.path.startsWith("src/fork")) {
        forkLinksMd += linkMd;
      } else {
        myLinksMd += linkMd;
      }
    }
  });

  /** @typedef {{
   *     name: string;
   *     path: string;
   *     sha: string;
   *     size?: number;
   *     url: string;
   *     html_url: string;
   *     git_url: string;
   *     download_url: string;
   *     type: string;
   *     content: string;
   *     encoding: string;
   *     _links: {
   *         self: string;
   *         git: string;
   *         html: string;
   *     };
   * }} GitHubContent
   */
  /** @type {GitHubContent} */
  const readmeRes = await (
    await fetch("https://api.github.com/repos/SARDONYX-sard/github-userscripts/contents/readme.md")
  ).json();
  const readmeMd = new TextDecoder().decode(base64ToBytes(readmeRes.content));
  const forkLinksComment = "<!-- forked scripts -->\n";
  const myLinksComment = "<!-- original scripts -->\n";

  return readmeMd
    .replace(myLinksComment, myLinksComment + myLinksMd)
    .replace(forkLinksComment, forkLinksComment + forkLinksMd);
}

(async () => {
  console.log(await createMarkdownFileLinks());
})();
