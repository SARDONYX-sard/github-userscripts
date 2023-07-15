// @ts-check

// See: https://www.bugbugnow.net/2021/02/user-script.html
// ==UserScript==
// @author       SARDONYX-sard
// @description  niconico auto play script.
// @downloadURL   https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/niconico-autoplay.user.js
// @grant        none
// @icon         https://www.google.com/s2/favicons?sz=64&domain=nicovideo.jp
// @license      Unlisence
// @match        https://*.nicovideo.jp/watch/*
// @name         niconico auto play
// @namespace   https://github.com/SARDONYX-sard
// @noframes
// @run-at      document-idle
// @updateURL   https://raw.githubusercontent.com/SARDONYX-sard/github-userscripts/main/src/niconico-autoplay.user.js
// @version      0.0.2
// ==/UserScript==

"use strict";
(() => {
  // config
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

  const clickPlay = () => {
    const playBtn = document.querySelector(
      "#js-app > div > div.WatchAppContainer-main > div.MainContainer > div.MainContainer-player > div.PlayerContainer > div.ControllerBoxContainer > div.ControllerContainer > div > div:nth-child(1) > button.ActionButton.ControllerButton.PlayerPlayButton"
    );
    if (playBtn instanceof HTMLButtonElement) {
      log.info("[block blocker] 再生ボタンを自動クリックしました");
      playBtn.click();
    } else {
      log.debug("[block blocker] 再生ボタンが見つかりません");
    }
  };

  const blockBlocker = () => {
    log.info("[block blocker] popupの削除と再生ボタン連打開始");
    const intervalId = setInterval(() => {
      clickPlay();
    }, INTERVAL_TIME);

    setTimeout(() => {
      clearInterval(intervalId);
      log.info("[block blocker] 再生ボタン連打終了");
    }, CLEAR_INTERVAL_TIME);
  };

  blockBlocker();
  let oldHref = document.location.href;
  const observer = new MutationObserver(async (_mutations, observer) => {
    log.info("[block blocker] 起動");

    if (oldHref != document.location.href) {
      oldHref = document.location.href;
      blockBlocker();
    }
  });
  observer.observe(document, { childList: true, subtree: true });
})();
