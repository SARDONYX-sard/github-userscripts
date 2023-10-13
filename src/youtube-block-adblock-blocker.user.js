// @ts-check

// See: https://www.bugbugnow.net/2021/02/user-script.html
// ==UserScript==
// @name        Youtube Block adblock blocker
// @author      SARDONYX-sard
// @description Prevent Youtube from detecting adblock and stopping playback.
// @downloadURL https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/youtube-block-adblock-blocker.user.js
// @grant       none
// @icon        https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @license     Unlicense
// @match       https://*.youtube.com/watch*
// @namespace   https://github.com/SARDONYX-sard
// @noframes
// @run-at      document-idle
// @updateURL   https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/youtube-block-adblock-blocker.user.js
// @version     0.1.9
// ==/UserScript==

"use strict";
(() => {
  // config
  /** @type {"debug"|"info"|"warn"|"error"} */
  const DEBUG_MODE = "debug";
  const INTERVAL_TIME = 1000;
  const CLEAR_INTERVAL_TIME = 10000;
  const PLAY_BUTTON_NAME = "再生"; // jp: "再生", en: "play"

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

  const clickPlay = (/** @type {string} */ playBtnName) => {
    /** @type {HTMLButtonElement|null} */
    const playBtn = document.querySelector(`button[data-title-no-tooltip="${playBtnName}"]`);

    if (playBtn) {
      log.info("[Youtube block blocker] auto clicked play button");
      playBtn.click();
    } else {
      log.debug("[Youtube block blocker] Not found play button");
    }
  };

  /**
   * Add elements from the playlist, etc. to prevent necessary popups from not working.
   */
  const addEmptyPopup = () => {
    const popup = document.createElement("ytd-popup-container");
    popup.classList.add("style-scope");
    popup.classList.add("ytd-app");
    popup.innerHTML = "<!--css-build:shady--><!--css-build:shady-->";
    const contentNext = document.getElementById("content")?.nextSibling;
    if (!contentNext) {
      log.debug("[Youtube block blocker] Not found content id nextSibling.");
      return;
    }

    document.querySelector("body > ytd-app")?.insertBefore(popup, null);
  };

  const removePopup = () => {
    const popup = document.querySelector("body > ytd-app > ytd-popup-container");
    popup ? popup.remove() : log.debug("[Youtube block blocker] Not found popup.");
    const scrollBlock = document.querySelector("body > tp-yt-iron-overlay-backdrop");
    scrollBlock ? scrollBlock.remove() : log.debug("[Youtube block blocker] Not found overlay.");
  };

  const blockBlocker = () => {
    log.info("[Youtube block blocker] Start to remove popup & click play button.");
    const intervalId = setInterval(() => {
      removePopup();
      clickPlay(PLAY_BUTTON_NAME);
    }, INTERVAL_TIME);

    setTimeout(() => {
      clearInterval(intervalId);
      log.info("[Youtube block blocker] Complete to click play button.");
      addEmptyPopup();
    }, CLEAR_INTERVAL_TIME);
  };

  blockBlocker();
  let oldHref = document.location.href;
  const observer = new MutationObserver(async (_mutations, observer) => {
    log.info("[Youtube block blocker] Script called.");

    if (oldHref != document.location.href) {
      oldHref = document.location.href;
      blockBlocker();
    }
  });
  observer.observe(document, { childList: true, subtree: true });
})();
