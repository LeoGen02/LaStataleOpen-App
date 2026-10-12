// ==UserScript==
// @name         Statale Open · ponte automatico
// @namespace    https://leogen02.github.io/LaStataleOpen-App/
// @version      1
// @description  Quando nell'app Statale Open tocchi «Aggiorna dal portale», avvia da solo il ponte sulla pagina di La Statale Open e torna all'app con i dati. Nelle altre pagine non fa nulla. App non ufficiale.
// @match        https://lastataleopen.myariel.unimi.it/*
// @match        https://leogen02.github.io/LaStataleOpen-App/*
// @run-at       document-end
// @inject-into  content
// @noframes
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// ==/UserScript==

/*
 * Statale Open — ponte automatico, versione 1.
 *
 * Fa le veci del tocco sul preferito «Statale Open», e solo quando è l'app a chiederlo:
 * - sull'app (leogen02.github.io/LaStataleOpen-App) segnala di essere installato, così «Aggiorna dal portale»
 *   diventa un solo tocco;
 * - sul portale non fa nulla, a meno che l'indirizzo contenga la richiesta dell'app (#statale-open=…). In quel caso
 *   carica lo stesso file del preferito, ponte/ponte-1.js, con la stessa impronta SHA-384: il browser lo rifiuta
 *   se cambia anche un solo byte. Se non sei ancora entrato, tiene la richiesta (solo numeri, per al massimo
 *   10 minuti) nell'archivio dell'estensione mentre fai il login di Ateneo, e riparte da sola subito dopo.
 *
 * Non legge cookie, password o pagine, non fa richieste di rete e non manda dati: tutto il lavoro lo fa il ponte,
 * che consegna i dati solo all'app. Le modifiche chieste dall'app (avvisi letti, attività completate) restano
 * da confermare nel pannello del ponte.
 *
 * File immutabile come il ponte: senza aggiornamenti automatici, una correzione va in statale-open-2.user.js.
 */
(function () {
  "use strict";

  var HOST = "lastataleopen.myariel.unimi.it";
  var APP = "https://leogen02.github.io/LaStataleOpen-App/";
  var BRIDGE = APP + "ponte/ponte-1.js";
  var INTEGRITY = "sha384-WuK1i08q5ugibinF49Tb4mka8bTimQM3l76f9nkUugF8cjVs49zNYCbQDRx0+UN6";
  var KEY = "statale-open-richiesta";
  var TTL = 10 * 60 * 1000;
  var REQUEST = /(?:^|[#&])statale-open=(SOQ1\.[A-Za-z0-9_-]{1,16000})(?=&|$)/;

  if (window.top !== window.self) return;

  // Sull'app: «ci sono», letto da «Aggiorna dal portale».
  if ((location.origin + location.pathname).indexOf(APP) === 0) {
    document.documentElement.setAttribute("data-statale-open-auto", "1");
    try { document.dispatchEvent(new CustomEvent("statale-open-auto")); } catch (e) { /* evento non disponibile */ }
    return;
  }
  if (location.protocol !== "https:" || location.hostname !== HOST) return;

  // Utente della pagina, da M.cfg ("userId":42): 0 non entrato, 1 ospite, -1 pagina senza configurazione Moodle.
  function pageUser() {
    var scripts = document.querySelectorAll("script:not([src])");
    for (var i = 0; i < scripts.length; i++) {
      var m = /"userId"\s*:\s*"?(\d+)/.exec(scripts[i].textContent || "");
      if (m) return Number(m[1]);
    }
    return -1;
  }
  // Archivio dell'estensione (GM.*, condiviso tra le schede); senza, quello di questa scheda del portale.
  var store = typeof GM !== "undefined" && GM && GM.getValue && GM.setValue && GM.deleteValue ? {
    get: function () { return GM.getValue(KEY, null); },
    set: function (v) { return GM.setValue(KEY, v); },
    del: function () { return GM.deleteValue(KEY); }
  } : {
    get: function () { return Promise.resolve(sessionStorage.getItem(KEY)); },
    set: function (v) { sessionStorage.setItem(KEY, v); return Promise.resolve(); },
    del: function () { sessionStorage.removeItem(KEY); return Promise.resolve(); }
  };
  function saved() {
    return store.get().then(function (raw) {
      var o = JSON.parse(raw || "null");
      return o && typeof o.req === "string" && /^SOQ1\.[A-Za-z0-9_-]{1,16000}$/.test(o.req) && Date.now() - o.at < TTL ? o.req : null;
    }).catch(function () { return null; });
  }
  function keep(req) {
    return Promise.resolve().then(function () { return store.set(JSON.stringify({ req: req, at: Date.now() })); })
      .then(function () { return true; }, function () { return false; });
  }
  function forget() {
    return Promise.resolve().then(function () { return store.del(); }).catch(function () { /* archivio non disponibile */ });
  }
  // Lo stesso codice del preferito: il ponte con la sua impronta, senza indirizzo di provenienza.
  function startBridge() {
    var s = document.createElement("script");
    s.src = BRIDGE;
    s.integrity = INTEGRITY;
    s.crossOrigin = "anonymous";
    s.referrerPolicy = "no-referrer";
    s.onerror = function () {
      alert("Statale Open: il ponte non si è caricato. Controlla la connessione e riprova dall'app; se continua, reinstalla il ponte automatico (Altro, Ponte con il portale).");
    };
    (document.head || document.documentElement).appendChild(s);
  }

  var match = REQUEST.exec(location.hash);
  var user = pageUser();
  if (match) {
    if (user > 1) { forget(); startBridge(); return; }
    if (user < 0) return;
    // Non sei entrato: la richiesta resta nell'archivio, la Dashboard chiede il login di Ateneo e poi torna qui.
    keep(match[1]).then(function (ok) {
      if (!ok) return;
      try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) { /* indirizzo invariato */ }
      location.assign(location.origin + "/my/");
    });
    return;
  }
  if (user <= 1) return;
  saved().then(function (request) {
    if (!request) return;
    return forget().then(function () {
      try { history.replaceState(history.state, "", location.pathname + location.search + "#statale-open=" + request); } catch (e) { return; }
      startBridge();
    });
  });
})();
