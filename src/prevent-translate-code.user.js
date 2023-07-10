// @ts-check

// ==UserScript==
// @author      SARDONYX-sard
// @description Prevent translate code.
// @downloadURL https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/prevent-translate-code.user.js
// @grant       none
// @icon        https://github.githubassets.com/pinned-octocat.svg
// @license     Unlisence
// @match       http://*/*
// @name        Prevent translate code
// @namespace   https://github.com/SARDONYX-sard
// @run-at      document-idle
// @updateURL   https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/prevent-translate-code.user.js
// @version     0.0.1
// ==/UserScript==

(function () {
  "use strict";

  const addNoTranslateCls = (selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.classList.add("notranslate");
    });
  };

  const gitHubCommentOnlyTranslate = () => {
    if (!document.querySelector(".highlight")) return;
    document
      .querySelector(".highlight")
      ?.querySelectorAll("td")
      .forEach((td) => {
        td.classList.add("notranslate");
        const $comments = td.querySelectorAll(".pl-c");
        $comments.forEach((comment) => comment?.parentElement?.classList.remove("notranslate"));
      });
  };

  gitHubCommentOnlyTranslate();
  addNoTranslateCls("pre");
  addNoTranslateCls(".prism-code");
  addNoTranslateCls(".program");
})();
