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
 * - sull'app (leogen02.github.io/LaStataleOpen-App) segnala di essere installato e, quando tocchi «Aggiorna dal
 *   portale», registra nel proprio archivio la richiesta che l'app gli consegna (solo numeri, valida 10 minuti,
 *   usata una volta sola). Le pagine degli altri siti non possono scrivere in quell'archivio;
 * - sul portale non fa nulla, a meno che l'indirizzo contenga proprio la richiesta registrata (#statale-open=…):
 *   un link costruito da altri viene ignorato. In quel caso carica lo stesso file del preferito, ponte/ponte-1.js,
 *   con la stessa impronta SHA-384: il browser lo rifiuta se cambia anche un solo byte. Se non sei ancora entrato,
 *   la richiesta resta registrata mentre fai il login di Ateneo e riparte da sola subito dopo.
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
  // Richiesta consegnata dall'app ma mai vista dal portale (il login è partito prima di una sua pagina): riparte dopo il login
  // solo se recente.
  var RESUME = 5 * 60 * 1000;
  var REQUEST = /(?:^|[#&])statale-open=(SOQ1\.[A-Za-z0-9_-]{1,16000})(?=&|$)/;
  var VALID = /^SOQ1\.[A-Za-z0-9_-]{1,16000}$/;

  if (window.top !== window.self) return;

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
  // Richiesta registrata dall'app: { req, at, parked } (parked = in attesa del login di Ateneo).
  function registered() {
    return Promise.resolve().then(function () { return store.get(); }).then(function (raw) {
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && typeof o.req === "string" && VALID.test(o.req) && typeof o.at === "number" && Date.now() - o.at < TTL) return o;
      // Scaduta o non valida: si cancella subito.
      return forget().then(function () { return null; });
    }).catch(function () { return null; });
  }
  function register(req, parked) {
    return Promise.resolve().then(function () { return store.set(JSON.stringify({ req: req, at: Date.now(), parked: !!parked })); })
      .then(function () { return true; }, function () { return false; });
  }
  function forget() {
    return Promise.resolve().then(function () { return store.del(); }).catch(function () { /* archivio non disponibile */ });
  }

  // Sull'app: «ci sono», e registrazione della richiesta che l'app consegna prima di aprire il portale.
  if ((location.origin + location.pathname).indexOf(APP) === 0) {
    var root = document.documentElement;
    document.addEventListener("statale-open-request", function () {
      var req = root.getAttribute("data-statale-open-request") || "";
      if (!VALID.test(req)) return;
      register(req, false).then(function (ok) {
        if (!ok) return;
        root.setAttribute("data-statale-open-armed", req);
        try { document.dispatchEvent(new CustomEvent("statale-open-armed")); } catch (e) { /* evento non disponibile */ }
      });
    });
    root.setAttribute("data-statale-open-auto", "1");
    try { document.dispatchEvent(new CustomEvent("statale-open-auto")); } catch (e) { /* evento non disponibile */ }
    return;
  }
  if (location.protocol !== "https:" || location.hostname !== HOST) return;
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
    if (user < 0) return;
    registered().then(function (reg) {
      // Solo la richiesta che l'app ha appena consegnato: un link costruito da altri non avvia nulla.
      if (!reg || reg.req !== match[1]) return;
      if (user > 1) return forget().then(function () { startBridge(); });
      // Non sei entrato: la richiesta resta registrata, la Dashboard chiede il login di Ateneo e poi torna qui.
      return register(reg.req, true).then(function (ok) {
        if (!ok) return;
        try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) { /* indirizzo invariato */ }
        location.assign(location.origin + "/my/");
      });
    });
    return;
  }
  // Dopo il login si arriva alla Dashboard o alla pagina iniziale: solo lì riparte la richiesta in attesa,
  // così un'altra scheda del portale (un'attività aperta dall'app) non viene mai dirottata.
  if (user <= 1 || !/^\/(?:index\.php|my\/(?:index\.php)?)?$/.test(location.pathname)) return;
  // Riparte, una volta sola, la richiesta dell'app rimasta in attesa del login (o consegnata da meno di 5 minuti,
  // se il login di Ateneo è partito prima che una pagina del portale potesse metterla in attesa).
  registered().then(function (reg) {
    if (!reg || (!reg.parked && Date.now() - reg.at > RESUME)) return;
    return forget().then(function () {
      try { history.replaceState(history.state, "", location.pathname + location.search + "#statale-open=" + reg.req); } catch (e) { return; }
      startBridge();
    });
  });
})();
