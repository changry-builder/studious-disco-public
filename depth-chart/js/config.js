/* Settings. Set refreshUrl to a roster service to turn on "Refresh from web":
 * GET <refreshUrl>?team=<id> must return { players: [...], depth: {...}, asOf: "..." }
 * in the same shape as js/data-*.js. */
window.DC_CONFIG = {
  refreshUrl: "",
};
