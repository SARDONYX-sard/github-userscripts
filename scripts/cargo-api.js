// crateValue = crateValue ?? `{ ${crateValue} }`;
// NOTE: Impossible because github prevents fetching of external links.
// const crateInfo = await fetchCrateInfo(libName, version);
// if (!Array.isArray(crateInfo.crates)) {
//   if (crateInfo.crates.newest_version) {
//     crateValue = `latest = "${crateInfo.crates.newest_version}"`;
//   }
//   if (crateInfo.crates.repository) {
//     crateValue = `repo = "${crateInfo.crates.repository}"`;
//   }
// }

/**
 * @param {string} lib_name
 * @param {string|null} version
 */
async function fetchCrateInfo(lib_name, version) {
  const headers = {
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      // "User-Agent": "cargo 1.32.0 (8610973aa 2019-01-02)",
    },
  };
  const ver_query = version ? `&version=${version}` : "";
  // API Info: https://doc.rust-lang.org/cargo/reference/registry-web-api.html
  const res = await fetch(`https://crates.io/api/v1/crates?q=${lib_name}${ver_query}`, headers);

  /**
   * @typedef {{
   *   crates: {
   *         categories: Array<string>?;
   *         created_at: string;
   *        description: string;
   *      documentation: string?;
   *          downloads: number;
   *        exact_match: boolean;
   *           homepage: string?;
   *                 id: string;
   *           keywords: Array<string>?;
   *               name: string?;
   *     newest_version: string?;
   *         repository: string?;
   *         updated_at: string?;
   *           versions: string?;
   *   },
   *   meta: {
   *          next_page: number?,
   *          prev_page: number?,
   *              total: number, // 0 <= total
   *   }
   * }} CrateJson
   */
  /**
   * @typedef {{
   *   crates: [],
   *   meta: {
   *          next_page: number?,
   *          prev_page: number?,
   *              total: number, // 0 <= total
   *   }
   * }} CrateNotFoundjson
   */

  /**
   * @type CrateJson|CrateNotFoundjson
   */
  const crateJson = await res.json();
  return crateJson;
}
