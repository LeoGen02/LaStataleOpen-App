// ==UserScript==
// @name         Statale Open · ponte automatico
// @namespace    https://leogen02.github.io/LaStataleOpen-App/
// @version      2
// @description  Quando nell'app Statale Open tocchi «Accedi» o «Aggiorna dal portale», o quando entri dalla pagina di login di Ateneo di La Statale Open, avvia da solo il ponte sul portale e torna all'app con i dati. Nelle altre pagine non fa nulla. App non ufficiale.
// @match        https://lastataleopen.myariel.unimi.it/*
// @match        https://leogen02.github.io/LaStataleOpen-App/*
// @match        https://elearning.unimi.it/authentication/skin/lastataleopen/*
// @run-at       document-end
// @inject-into  content
// @noframes
// @grant        GM.getValue
// @grant        GM.setValue
// @grant        GM.deleteValue
// ==/UserScript==

/*
 * Statale Open — ponte automatico, versione 2.
 *
 * Fa le veci del tocco sul preferito «Statale Open», e solo quando è l'app a chiederlo:
 * - sull'app (leogen02.github.io/LaStataleOpen-App) segnala di essere installato e registra nel proprio archivio
 *   le richieste che l'app gli consegna: quella di «Accedi» / «Aggiorna dal portale» (valida 10 minuti, usata una volta)
 *   e quella di sola lettura per il ritorno dopo il login (nessuna modifica, valida 30 giorni, una volta per ogni login).
 *   Le pagine degli altri siti non possono scrivere in quell'archivio;
 * - sulla pagina di login di Ateneo di La Statale Open annota soltanto l'ora in cui la apri o invii il modulo:
 *   non legge i campi, non tocca il modulo;
 * - sul portale non fa nulla, salvo due casi: l'indirizzo contiene proprio la richiesta registrata (#statale-open=…),
 *   oppure sei appena entrato dalla pagina di login di Ateneo e arrivi alla pagina iniziale o alla Dashboard: allora usa
 *   la richiesta di sola lettura e torna all'app con i dati. Un link costruito da altri viene ignorato. In entrambi i casi
 *   carica lo stesso file del preferito, ponte/ponte-1.js, con la stessa impronta SHA-384: il browser lo rifiuta se cambia
 *   anche un solo byte. Se non sei ancora entrato, la richiesta resta registrata mentre fai il login e riparte subito dopo.
 *
 * Non legge cookie, password o pagine, non fa richieste di rete e non manda dati: tutto il lavoro lo fa il ponte,
 * che consegna i dati solo all'app. Le modifiche chieste dall'app (avvisi letti, attività completate) restano
 * da confermare nel pannello del ponte; la richiesta per il ritorno dopo il login non ne contiene mai.
 *
 * File immutabile come il ponte: senza aggiornamenti automatici, una correzione va in statale-open-3.user.js.
 */
(function () {
  "use strict";

  var HOST = "lastataleopen.myariel.unimi.it";
  var SSO_HOST = "elearning.unimi.it";
  var SSO_PATH = "/authentication/skin/lastataleopen/";
  var APP = "https://leogen02.github.io/LaStataleOpen-App/";
  var BRIDGE = APP + "ponte/ponte-1.js";
  var INTEGRITY = "sha384-WuK1i08q5ugibinF49Tb4mka8bTimQM3l76f9nkUugF8cjVs49zNYCbQDRx0+UN6";
  var KEY = "statale-open-richiesta";
  var KEY_STANDING = "statale-open-dopo-login";
  var KEY_LOGIN = "statale-open-accesso";
  var TTL = 10 * 60 * 1000;
  var STANDING_TTL = 30 * 24 * 60 * 60 * 1000;
  // Dopo la pagina di login di Ateneo: il ritorno all'app vale per la prima pagina del portale aperta da entrato.
  var LOGIN_WINDOW = 10 * 60 * 1000;
  // Richiesta consegnata dall'app ma mai vista dal portale (il login è partito prima di una sua pagina): riparte dopo il login
  // solo se recente.
  var RESUME = 5 * 60 * 1000;
  var REQUEST = /(?:^|[#&])statale-open=(SOQ1\.[A-Za-z0-9_-]{1,16000})(?=&|$)/;
  var VALID = /^SOQ1\.[A-Za-z0-9_-]{1,16000}$/;
  // Pagine d'arrivo del login: pagina iniziale, Dashboard, I miei corsi.
  var LANDING = /^\/(?:index\.php|my\/(?:index\.php|courses\.php)?)?$/;

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
  // Archivio dell'estensione (GM.*, condiviso tra le schede e i siti); senza, quello di questa scheda.
  var hasGM = typeof GM !== "undefined" && GM && GM.getValue && GM.setValue && GM.deleteValue;
  function store(key) {
    return hasGM ? {
      get: function () { return GM.getValue(key, null); },
      set: function (v) { return GM.setValue(key, v); },
      del: function () { return GM.deleteValue(key); }
    } : {
      get: function () { return Promise.resolve(sessionStorage.getItem(key)); },
      set: function (v) { sessionStorage.setItem(key, v); return Promise.resolve(); },
      del: function () { sessionStorage.removeItem(key); return Promise.resolve(); }
    };
  }
  // Voce dell'archivio { req?, at, … } ancora valida, altrimenti cancellata.
  function read(key, ttl, check) {
    var s = store(key);
    return Promise.resolve().then(function () { return s.get(); }).then(function (raw) {
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (o && typeof o.at === "number" && Date.now() - o.at < ttl && Date.now() >= o.at - 60000 && check(o)) return o;
      return forget(key).then(function () { return null; });
    }).catch(function () { return null; });
  }
  function write(key, value) {
    return Promise.resolve().then(function () { return store(key).set(JSON.stringify(value)); })
      .then(function () { return true; }, function () { return false; });
  }
  function forget(key) {
    return Promise.resolve().then(function () { return store(key).del(); }).catch(function () { /* archivio non disponibile */ });
  }
  function validReq(o) { return typeof o.req === "string" && VALID.test(o.req); }
  // Richiesta registrata dall'app: { req, at, parked } (parked = in attesa del login di Ateneo).
  function registered() { return read(KEY, TTL, validReq); }
  function register(req, parked) { return write(KEY, { req: req, at: Date.now(), parked: !!parked }); }
  // Richiesta di sola lettura per il ritorno dopo il login: { req, at }.
  function standing() { return read(KEY_STANDING, STANDING_TTL, function (o) { return validReq(o) && readOnly(o.req); }); }
  // Pagina di login di Ateneo aperta di recente: { at }.
  function loginMark() { return read(KEY_LOGIN, LOGIN_WINDOW, function () { return true; }); }

  // Richiesta che non può cambiare nulla sul portale: nessuna modifica, ritorno all'app nell'indirizzo.
  function readOnly(req) {
    try {
      var s = req.slice(5).replace(/-/g, "+").replace(/_/g, "/");
      while (s.length % 4) s += "=";
      var bin = atob(s), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var o = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      return !!(o && o.v === 1 && typeof o.rid === "string" && /^[A-Za-z0-9_-]{16,32}$/.test(o.rid) && o.ret === "frag" &&
        Array.isArray(o.ops) && o.ops.length === 0);
    } catch (e) {
      return false;
    }
  }
  function signal(name) {
    try { document.dispatchEvent(new CustomEvent(name)); } catch (e) { /* evento non disponibile */ }
  }

  // Sull'app: «ci sono», e registrazione delle richieste che l'app consegna.
  if ((location.origin + location.pathname).indexOf(APP) === 0) {
    var root = document.documentElement;
    document.addEventListener("statale-open-request", function () {
      var req = root.getAttribute("data-statale-open-request") || "";
      if (!VALID.test(req)) return;
      register(req, false).then(function (ok) {
        if (!ok) return;
        root.setAttribute("data-statale-open-armed", req);
        signal("statale-open-armed");
      });
    });
    // Ritorno dopo il login: una richiesta di sola lettura, oppure "off" per non tornare all'app.
    document.addEventListener("statale-open-standing", function () {
      var req = root.getAttribute("data-statale-open-standing") || "";
      var done = req === "off" ? forget(KEY_STANDING).then(function () { return true; })
        : VALID.test(req) && readOnly(req) ? write(KEY_STANDING, { req: req, at: Date.now() }) : null;
      if (!done) return;
      done.then(function (ok) {
        if (!ok) return;
        root.setAttribute("data-statale-open-standing-ok", req);
        signal("statale-open-standing-ok");
      });
    });
    root.setAttribute("data-statale-open-auto", "2");
    signal("statale-open-auto");
    return;
  }

  // Pagina di login di Ateneo: solo l'ora (il modulo e i campi restano come sono).
  if (location.hostname === SSO_HOST) {
    if (location.protocol !== "https:" || location.pathname.indexOf(SSO_PATH) !== 0) return;
    if (!document.querySelectorAll('input[type="password"]').length) return;
    var mark = function () { write(KEY_LOGIN, { at: Date.now() }); };
    mark();
    document.addEventListener("submit", mark, true);
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
  // La richiesta entra nell'indirizzo di questa pagina, dove il ponte la legge (e la toglie subito).
  function run(req) {
    try { history.replaceState(history.state, "", location.pathname + location.search + "#statale-open=" + req); } catch (e) { return; }
    startBridge();
  }

  var match = REQUEST.exec(location.hash);
  var user = pageUser();
  if (match) {
    if (user < 0) return;
    registered().then(function (reg) {
      // Solo la richiesta che l'app ha appena consegnato: un link costruito da altri non avvia nulla.
      if (!reg || reg.req !== match[1]) return;
      if (user > 1) return forget(KEY).then(function () { return forget(KEY_LOGIN); }).then(function () { startBridge(); });
      // Non sei entrato: la richiesta resta registrata, la Dashboard chiede il login di Ateneo e poi torna qui.
      return register(reg.req, true).then(function (ok) {
        if (!ok) return;
        try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) { /* indirizzo invariato */ }
        location.assign(location.origin + "/my/");
      });
    });
    return;
  }
  if (user <= 1) return;
  var landing = LANDING.test(location.pathname);
  Promise.all([registered(), loginMark(), landing ? standing() : null]).then(function (got) {
    var reg = got[0], login = got[1], stand = got[2];
    // 1. La richiesta dell'app rimasta in attesa del login (o consegnata da meno di 5 minuti, se il login di Ateneo
    //    è partito prima che una pagina del portale potesse metterla in attesa). Solo sulla pagina d'arrivo, così
    //    un'altra scheda del portale (un'attività aperta dall'app) non viene mai dirottata.
    if (landing && reg && (reg.parked || Date.now() - reg.at <= RESUME)) {
      return forget(KEY).then(function () { return forget(KEY_LOGIN); }).then(function () { run(reg.req); });
    }
    // 2. Appena entrato dalla pagina di login di Ateneo: decide la prima pagina del portale aperta da entrato.
    //    Se è la pagina d'arrivo e l'app ha lasciato la richiesta di sola lettura, si torna all'app con i dati;
    //    se è un'altra pagina (un link aperto prima del login) si resta lì. Vale una volta per login: l'annotazione
    //    si consuma, la richiesta resta (se il giro si interrompe, il login successivo riprova); quando i dati arrivano
    //    l'app ne lascia una nuova.
    if (!login) return;
    return forget(KEY_LOGIN).then(function () {
      if (landing && stand) run(stand.req);
    });
  });
})();
