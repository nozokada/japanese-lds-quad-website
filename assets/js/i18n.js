// Gappon site-wide client-side i18n runtime (ja / en).
//
// Loaded on every page via _includes/head.html. Reads the translation table
// injected as `window.GAPPON_I18N` (built from _data/i18n.yml) and applies it to
// the DOM. Two mechanisms:
//   1. `data-i18n="key"`      -> swaps textContent from the string table.
//   2. `data-i18n-block="ja"` -> long-form content blocks; only the block matching
//      the current language is shown (handled by CSS keyed on <html data-lang>).
//
// The chosen language is stored in localStorage ("gappon_lang") and defaults to
// Japanese unless the browser language is English. Other scripts (e.g.
// account.js) can read the language and react to changes via `window.Gappon.i18n`.

(function () {
  var STORAGE_KEY = "gappon_lang";
  var DICT = window.GAPPON_I18N || {};
  var listeners = [];

  function detectLang() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "ja" || saved === "en") return saved;
    } catch (e) {}
    return (navigator.language || "ja").toLowerCase().indexOf("en") === 0 ? "en" : "ja";
  }

  var currentLang = detectLang();

  function lookup(key) {
    var entry = DICT[key];
    if (!entry) return null;
    return entry[currentLang] != null ? entry[currentLang] : entry.ja;
  }

  function t(key, params) {
    var s = lookup(key);
    if (s == null) return key;
    if (params) {
      Object.keys(params).forEach(function (k) {
        s = s.replace("{" + k + "}", params[k]);
      });
    }
    return s;
  }

  function apply() {
    var d = document.documentElement;
    d.lang = currentLang;
    d.setAttribute("data-lang", currentLang);

    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var val = lookup(node.getAttribute("data-i18n"));
      if (val != null) node.textContent = val;
    });

    var desc = document.querySelector('meta[name="description"]');
    var metaDesc = lookup("app_description");
    if (desc && metaDesc != null) desc.setAttribute("content", metaDesc);

    document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
      btn.textContent = currentLang === "ja" ? "English" : "日本語";
    });

    listeners.forEach(function (cb) {
      try {
        cb(currentLang);
      } catch (e) {
        console.error("[i18n] listener error", e);
      }
    });
  }

  function setLang(lang) {
    if (lang !== "ja" && lang !== "en") return;
    currentLang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (e) {}
    apply();
  }

  function toggle() {
    setLang(currentLang === "ja" ? "en" : "ja");
  }

  window.Gappon = window.Gappon || {};
  window.Gappon.i18n = {
    getLang: function () {
      return currentLang;
    },
    setLang: setLang,
    toggle: toggle,
    t: t,
    // Register a callback invoked immediately with the current language and again
    // on every language change. Useful for scripts that render their own strings.
    onChange: function (cb) {
      if (typeof cb !== "function") return;
      listeners.push(cb);
      try {
        cb(currentLang);
      } catch (e) {
        console.error("[i18n] listener error", e);
      }
    },
  };

  function init() {
    document.querySelectorAll("[data-lang-toggle]").forEach(function (btn) {
      btn.addEventListener("click", toggle);
    });
    apply();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
