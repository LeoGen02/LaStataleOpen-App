/*
 * Statale Open — app web.
 * Stesse schermate e stessa logica dell'app iPhone (StataleOpen/), con tre fonti di dati:
 *   - il ponte con il portale (docs/ponte/): l'ultima lettura fatta da un preferito di Safari sulla pagina del portale,
 *     la strada per La Statale Open, che ha i servizi per app spenti;
 *   - il portale vero, tramite gli stessi web service Moodle dell'app (MoodleClient.swift), se li riattiva;
 *   - i dati di esempio, per provare l'app senza account o dentro claude.ai (dove il portale è bloccato).
 */
(function () {
  "use strict";

  var C = window.StataleCore;
  var EMBEDDED = !!window.STATALE_EMBEDDED; // copia dentro claude.ai: nessuna richiesta verso siti esterni
  var APP = { version: "1.3.0", repo: "LeoGen02/LaStataleOpen-App", webURL: "https://leogen02.github.io/LaStataleOpen-App/" };
  var REPO_URL = "https://github.com/" + APP.repo;
  var BASE = "https://lastataleopen.myariel.unimi.it/";
  var DEFAULT_PROGRAM = { id: 2, name: "SecAI" };
  var DISCLAIMER = "App non ufficiale realizzata da studenti: non è affiliata né approvata dall'Università degli Studi di Milano. Le credenziali restano su questo dispositivo; l'app comunica solo con i server dell'Ateneo e con GitHub per controllare gli aggiornamenti.";
  var SHORT_DISCLAIMER = "App non ufficiale, non affiliata all'Università degli Studi di Milano.";
  var ICON = window.STATALE_ICON || "icon-192.png";
  var H = 3600e3, D = 24 * H;
  var MSG = {
    offline: "Sembra che tu non sia connesso a Internet.",
    network: "Il portale non ha risposto. Se sei connesso, il portale potrebbe non accettare richieste da un'app web: prova con la chiave dell'app o usa la modalità web.",
    expired: "La sessione è scaduta: accedi di nuovo.",
    unreachable: "Portale non raggiungibile: dati non aggiornati.",
    disabled: "I servizi per le app sono disattivati sul portale: tocca «Accedi» in alto per entrare dalla pagina ufficiale del portale, oppure usa la modalità web.",
    ponteIntro: "Il portale non lascia leggere i tuoi dati alle app web. Con il ponte, un preferito di Safari che tocchi sulla pagina del portale in cui sei già entrato, l'app riceve corsi, scadenze e avvisi. Nessuna password viene salvata e i dati non passano da altri server.",
    noTree: "Percorsi e cluster non ancora letti dal portale: tocca «Aggiorna dal portale» in Home, oppure apri la pagina nel portale.",
    noContents: "Contenuti del corso non ancora letti dal portale: aggiorna dal portale o apri il corso nel portale."
  };

  // ---------- Icone (tratto, 24×24) ----------
  var P = {
    house: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    books: "M4 4h4v16H4zM10 4h4v16h-4zM16.3 4.6l3.4.9-3.9 14.5-3.4-.9z",
    calclock: "M20 11V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h7M3 10h17M8 3v4M15 3v4M17.5 22a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM17.5 15.5v2l1.3 1",
    bell: "M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0",
    gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1",
    chevL: "M15 5l-7 7 7 7",
    chevR: "M9 5l7 7-7 7",
    compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
    search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4",
    circle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
    play: "M4 5h16v14H4zM10 9l5 3-5 3z",
    playBig: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8.5l5.5 3.5-5.5 3.5z",
    doc: "M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6",
    pencil: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
    tray: "M4 14v5h16v-5M12 4v11M7.5 8.5 12 4l4.5 4.5",
    bubble: "M4 5h12v9H8l-4 3zM18 9h2v9l-3-2.5h-7V14",
    link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
    refresh: "M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5",
    ellipsis: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12h.01M12 12h.01M16 12h.01",
    warn: "M12 3.5 2.5 20h19zM12 10v4.5M12 17.2h.01",
    exclam: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5v5.5M12 16.3h.01",
    calendar: "M4 5h16v15H4zM4 10h16M8 3v4M16 3v4",
    calcheck: "M4 5h16v15H4zM4 10h16M8 3v4M16 3v4M9 15l2 2 4-4",
    cap: "M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6",
    folder: "M3 6h6l2 2h10v11H3z",
    book: "M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5zM5 19.5A1.5 1.5 0 0 0 6.5 21H19",
    video: "M3 6h13v12H3zM16 10l5-3v10l-5-3z",
    grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
    stack: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5",
    chart: "M5 20V11M12 20V5M19 20v-7",
    people: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20a6 6 0 0 1 12 0M16 11a2.5 2.5 0 1 0 0-5M17.5 14a5 5 0 0 1 3.5 6",
    personKey: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 21a6 6 0 0 1 10-4.5M17 13a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM19 17l2.5 2.5M20.5 18.5 22 17",
    share: "M12 3v12M7.5 7.5 12 3l4.5 4.5M5 12v8h14v-8",
    copy: "M8 8h11v13H8zM5 16V3h11",
    key: "M8 15a4 4 0 1 1 3.5-6H21v3h-2v3h-3v-3h-4.5A4 4 0 0 1 8 15z",
    globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18",
    down: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5v8M8.5 12.5 12 16l3.5-3.5",
    bellSlash: "M6 16v-5a6 6 0 0 1 9.5-4.9M18 11v5l1.5 2H9M10 20.5a2 2 0 0 0 4 0M3 3l18 18",
    spinner: "M12 3a9 9 0 1 0 9 9",
    pulse: "M3 12h4l3-7 4 14 3-7h4"
  };
  function ic(name, extra) {
    var dots = name === "ellipsis" || name === "warn" || name === "exclam";
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + '><path d="' + P[name] + '"' + (dots ? ' stroke-width="2.2"' : "") + "/></svg>";
  }
  function checkFilled() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="var(--cell)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function spinner() { return ic("spinner", ' class="spin"'); }

  // ---------- Utilità ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  var fmtEvent = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  var fmtShort = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  function byName(a, b) { return a.name.localeCompare(b.name, "it", { numeric: true }); }
  function delay(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function wsError(message, code) { var e = new Error(message); e.code = code; return e; }
  function isStandalone() { return window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true; }

  // Archivio locale: impostazioni, sessione e copia dei dati (come Portachiavi, UserDefaults e PortalCache).
  var KEYS = {
    session: "so.session", phase: "so.phase", settings: "so.settings", update: "so.update", demo: "so.demo", toggles: "so.demo.toggles",
    ponteSnap: "so.ponte.snap", ponteBox: "so.ponte.outbox", ponteReq: "so.ponte.req", ponteLast: "so.ponte.last", ponteFail: "so.ponte.fail",
    ponteAuto: "so.ponte.auto"
  };
  var PONTE_KEYS = [KEYS.ponteSnap, KEYS.ponteBox, KEYS.ponteReq, KEYS.ponteLast, KEYS.ponteFail, KEYS.ponteAuto];
  function readJSON(key, fallback) { try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; } }
  function writeJSON(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* archivio non disponibile */ } }
  function removeKey(key) { try { localStorage.removeItem(key); } catch (e) { /* archivio non disponibile */ } }

  // ---------- Portale vero (MoodleClient.swift) ----------
  function Moodle(token) { this.token = token; }
  Moodle.prototype.call = async function (fn, params) {
    var body = new URLSearchParams();
    Object.keys(params || {}).forEach(function (k) { body.append(k, String(params[k])); });
    body.append("wstoken", this.token);
    body.append("wsfunction", fn);
    body.append("moodlewsrestformat", "json");
    body.append("moodlewssettingfilter", "true");
    body.append("moodlewssettingfileurl", "true");
    var response;
    try {
      response = await fetch(BASE + "webservice/rest/server.php", { method: "POST", body: body, cache: "no-store" });
    } catch (e) {
      throw wsError(navigator.onLine === false ? MSG.offline : MSG.network, "network");
    }
    if (!response.ok) throw wsError("Risposta non valida dal portale (HTTP " + response.status + ").", "http");
    var json;
    try { json = await response.json(); } catch (e) { throw wsError("Formato di risposta inatteso (" + fn + ").", "decoding"); }
    if (json && typeof json === "object" && !Array.isArray(json) && (json.exception || json.errorcode)) {
      if (json.errorcode === "invalidtoken") throw wsError(MSG.expired, "expired");
      throw wsError(json.message || json.errorcode || "Errore del portale", "server");
    }
    return json;
  };

  // Accesso con email e password: login/token.php, lo stesso indirizzo usato dall'app Moodle ufficiale.
  async function requestToken(username, password) {
    var response;
    try {
      response = await fetch(BASE + "login/token.php", {
        method: "POST", cache: "no-store",
        body: new URLSearchParams({ username: username, password: password, service: "moodle_mobile_app" })
      });
    } catch (e) {
      throw wsError(navigator.onLine === false ? MSG.offline : MSG.network, "network");
    }
    if (!response.ok) throw wsError("Risposta non valida dal portale (HTTP " + response.status + ").", "http");
    var json;
    try { json = await response.json(); } catch (e) { throw wsError("Formato di risposta inatteso (token).", "decoding"); }
    if (json.token) return { token: json.token, privatetoken: json.privatetoken || null };
    if (json.errorcode === "enablewsdescription") throw wsError(MSG.disabled, "disabled");
    if (json.errorcode === "invalidlogin") {
      throw wsError("Il portale non accetta queste credenziali dall'app. Se sul sito entri con il login di Ateneo, usa la chiave dell'app oppure la modalità web.", "invalidlogin");
    }
    throw wsError(json.error || json.errorcode || "Accesso non riuscito.", json.errorcode || "server");
  }

  // Verifica: il portale risponde a un'app web e ha i servizi per app attivi?
  async function siteCheck() {
    try {
      var response = await fetch(BASE + "login/token.php?appsitecheck=1", { cache: "no-store" });
      var json = await response.json();
      if (json && json.appsitecheck === "ok") return { ok: true, text: "Il portale risponde a questa app web e ha i servizi per app attivi: puoi accedere." };
      if (json && json.errorcode === "enablewsdescription") return { ok: false, text: MSG.disabled };
      return { ok: false, text: "Il portale ha risposto: " + ((json && (json.error || json.errorcode)) || "risposta inattesa") + ". Usa la modalità web." };
    } catch (e) {
      return { ok: false, text: navigator.onLine === false ? MSG.offline : "Il portale non risponde a questa app web (rete assente o richieste bloccate dal browser). Usa la modalità web." };
    }
  }

  // Conversione delle risposte Moodle nei modelli usati dalle viste (MoodleModels.swift).
  function normCourse(c) {
    return {
      id: c.id,
      name: C.htmlStripped(c.displayname || c.fullname),
      short: C.htmlStripped(c.shortname || ""),
      category: c.category || c.categoryid || null,
      progress: typeof c.progress === "number" ? Math.min(Math.max(c.progress, 0), 100) : null,
      last: c.lastaccess ? c.lastaccess * 1000 : 0
    };
  }
  function normEvent(e) {
    return {
      id: e.id,
      name: C.htmlStripped(e.name),
      courseId: e.course ? e.course.id : null,
      courseName: e.course ? C.htmlStripped(e.course.fullname) : "",
      mod: e.modulename || "",
      t: (e.timesort || e.timestart) * 1000,
      url: (e.action && e.action.url) || e.url || "",
      overdue: typeof e.overdue === "boolean" ? e.overdue : null
    };
  }
  function normNotification(n) {
    return { id: n.id, subject: C.htmlStripped(n.subject), ctx: n.contexturlname ? C.htmlStripped(n.contexturlname) : "", url: n.contexturl || "", t: n.timecreated * 1000, read: !!n.read };
  }
  function normCategory(c) { return { id: c.id, name: C.htmlStripped(c.name), parent: c.parent, coursecount: c.coursecount || 0 }; }
  function normSections(courseId, sections) {
    return sections.map(function (s) {
      return {
        name: C.htmlStripped(s.name),
        summary: C.htmlStripped(s.summary || ""),
        modules: (s.modules || []).filter(function (m) { return m.uservisible !== false; }).map(function (m) {
          return {
            id: m.id, courseId: courseId, name: C.htmlStripped(m.name), mod: m.modname, modplural: m.modplural || m.modname,
            kind: C.classify(m.name, m.modname), description: C.htmlStripped(m.description || ""),
            completion: m.completion || 0, done: C.isCompleted(m.completiondata && m.completiondata.state),
            url: m.url || "", contents: (m.contents || []).map(function (x) { return { type: x.type, fileurl: x.fileurl, filename: x.filename }; }),
            due: C.dueDate(m.dates)
          };
        })
      };
    });
  }

  var Real = {
    siteInfo: async function () {
      var i = await S.client.call("core_webservice_get_site_info");
      return { userid: i.userid, fullname: i.fullname, firstname: i.firstname, username: i.username, sitename: C.htmlStripped(i.sitename || "") };
    },
    courses: async function () {
      var list = await S.client.call("core_enrol_get_users_courses", { userid: S.siteInfo.userid });
      return list.map(normCourse).sort(function (a, b) { return b.last - a.last; });
    },
    events: async function () {
      var r = await S.client.call("core_calendar_get_action_events_by_timesort", {
        timesortfrom: Math.floor(Date.now() / 1000) - 14 * 86400, limitnum: 50, limittononsuspendedevents: 1
      });
      return (r.events || []).map(normEvent).sort(function (a, b) { return a.t - b.t; });
    },
    notifications: async function () {
      var r = await S.client.call("message_popup_get_popup_notifications", { useridto: S.siteInfo.userid, limit: 50, offset: 0 });
      var list = (r.notifications || []).map(normNotification);
      return { list: list, unread: r.unreadcount != null ? r.unreadcount : list.filter(function (n) { return !n.read; }).length };
    },
    markRead: function (id) { return S.client.call("core_message_mark_notification_read", { notificationid: id, timeread: Math.floor(Date.now() / 1000) }); },
    markAllRead: function () { return S.client.call("core_message_mark_all_notifications_as_read", { useridto: S.siteInfo.userid }); },
    categories: async function (parent) {
      var list = await S.client.call("core_course_get_categories", { "criteria[0][key]": "parent", "criteria[0][value]": parent, addsubcategories: 0 });
      return list.map(normCategory);
    },
    coursesInCategory: async function (id) {
      var r = await S.client.call("core_course_get_courses_by_field", { field: "category", value: id });
      return (r.courses || []).map(normCourse);
    },
    contents: async function (courseId) {
      return normSections(courseId, await S.client.call("core_course_get_contents", { courseid: courseId }));
    },
    setCompletion: function (cmid, completed) {
      return S.client.call("core_completion_update_activity_completion_status_manually", { cmid: cmid, completed: completed ? 1 : 0 });
    },
    fileURL: function (url) { return C.authenticatedFileURL(url, S.client && S.client.token); }
  };

  // ---------- Dati di esempio ----------
  var Demo = (function () {
    var CATS = [
      { id: 2, name: "SecAI", parent: 0 }, { id: 21, name: "Sicurezza informatica", parent: 2 }, { id: 22, name: "Intelligenza artificiale", parent: 2 },
      { id: 23, name: "Società, etica e regole", parent: 2 }, { id: 5, name: "Competenze digitali (esempio)", parent: 0 },
      { id: 51, name: "Strumenti digitali", parent: 5 }, { id: 52, name: "Comunicazione", parent: 5 }, { id: 8, name: "Sostenibilità (esempio)", parent: 0 }
    ];
    var COURSES = [
      { id: 11, name: "Fondamenti di cybersecurity", short: "SECAI-01", category: 21, enrolled: true, seed: 0.62, last: -2 * H },
      { id: 12, name: "Crittografia applicata", short: "SECAI-02", category: 21, enrolled: true, seed: 0.8, last: -3 * D },
      { id: 13, name: "Sicurezza delle reti", short: "SECAI-03", category: 21, enrolled: true, seed: 0.45, last: -9 * D },
      { id: 21, name: "Machine learning per la sicurezza", short: "SECAI-04", category: 22, enrolled: true, seed: 0.35, last: -1 * D },
      { id: 22, name: "Analisi dei dati con Python", short: "SECAI-05", category: 22, enrolled: false },
      { id: 31, name: "Etica e diritto dell'intelligenza artificiale", short: "SECAI-07", category: 23, enrolled: true, seed: 0.15, last: -6 * D },
      { id: 32, name: "Privacy e protezione dei dati", short: "SECAI-08", category: 23, enrolled: false },
      { id: 51, name: "Fogli di calcolo avanzati", short: "DIG-01", category: 51, enrolled: false },
      { id: 52, name: "Collaborare online", short: "DIG-02", category: 51, enrolled: false },
      { id: 53, name: "Scrivere per il web", short: "DIG-03", category: 52, enrolled: false },
      { id: 81, name: "Economia circolare", short: "SOS-01", category: 8, enrolled: false }
    ];
    var PLURAL = { forum: "Forum", page: "Pagine", kalvidres: "Risorse video", resource: "File", quiz: "Quiz", assign: "Compiti", url: "URL", folder: "Cartelle", label: "Etichette" };

    function at(dayOffset, h, m) { var d = new Date(C.startOfDay(Date.now()) + dayOffset * D + 3 * H); d.setHours(h, m, 0, 0); return d.getTime(); }
    function course(id) { return COURSES.filter(function (c) { return c.id === id; })[0] || null; }
    function rawSections(c) {
      var n = 0;
      function m(name, mod, completion, extra) {
        n += 1;
        var id = c.id * 100 + n;
        var mo = { id: id, courseId: c.id, name: name, mod: mod, modplural: PLURAL[mod] || mod, kind: C.classify(name, mod), completion: completion,
          description: "", url: BASE + "mod/" + mod + "/view.php?id=" + id, contents: [], due: null };
        if (mod === "resource") mo.contents = [{ type: "file", filename: "slide-modulo.pdf", fileurl: BASE + "webservice/pluginfile.php/" + id + "/mod_resource/content/1/slide-modulo.pdf" }];
        if (mod === "url") mo.contents = [{ type: "url", filename: "", fileurl: "https://owasp.org/www-project-top-ten/" }];
        if (extra) Object.keys(extra).forEach(function (k) { mo[k] = extra[k]; });
        return mo;
      }
      return [
        { name: "Benvenuti", summary: "Presentazione dell'insegnamento, calendario delle attività e modalità d'esame.", modules: [m("Annunci", "forum", 0), m("Guida all'insegnamento", "page", 1)] },
        { name: "Modulo 1", summary: "", modules: [
          m("Etichetta", "label", 0, { description: "Prima di iniziare guarda la lezione 1: le esercitazioni la danno per scontata." }),
          m("Lezione 1 · Introduzione", "kalvidres", 1), m("Lezione 2 · Concetti chiave", "kalvidres", 1),
          m("Slide del modulo 1", "resource", 1), m("Esercitazione 1", "quiz", 2), m("E-tivity 1", "assign", 2)] },
        { name: "Modulo 2", summary: "", modules: [
          m("Lezione 3 · Casi di studio", "kalvidres", 1), m("Lezione 4 · Strumenti", "kalvidres", 1), m("Slide del modulo 2", "resource", 1),
          m("Esercitazione 2", "quiz", 2), m("Discussione sul caso di studio", "forum", 0), m("E-tivity 2", "assign", 2)] },
        { name: "Approfondimenti", summary: "", modules: [m("Sito di riferimento", "url", 0), m("Letture consigliate", "folder", 0)] }
      ];
    }
    var SECTIONS = {};
    COURSES.forEach(function (c) { SECTIONS[c.id] = rawSections(c); });
    function allModules(courseId) { var out = []; SECTIONS[courseId].forEach(function (s) { out = out.concat(s.modules); }); return out; }
    function moduleById(id) { var c = course(Math.floor(id / 100)); return c ? allModules(c.id).filter(function (m) { return m.id === id; })[0] || null : null; }
    function moduleByName(courseId, name) { return allModules(courseId).filter(function (m) { return m.name === name; })[0] || null; }

    function eventSpecs() {
      return [
        { id: 1, course: 11, module: "E-tivity 1", t: at(-3, 23, 59) }, { id: 2, course: 12, module: "Esercitazione 2", t: at(0, 23, 59) },
        { id: 3, course: 21, module: "E-tivity 2", t: at(1, 18, 0) }, { id: 4, course: 11, module: "E-tivity 2", t: at(3, 23, 59) },
        { id: 5, course: 13, module: "Esercitazione 1", t: at(5, 12, 0) }, { id: 6, course: 31, module: "E-tivity 1", t: at(8, 23, 59) }
      ];
    }
    function freshState() {
      var open = {};
      eventSpecs().forEach(function (e) { open[e.course + "|" + e.module] = true; });
      var completion = {};
      COURSES.forEach(function (c) {
        if (!c.enrolled) return;
        var tracked = allModules(c.id).filter(function (m) { return m.completion; });
        var k = Math.round(c.seed * tracked.length);
        tracked.forEach(function (m) { if (k > 0 && !open[c.id + "|" + m.name]) { completion[m.id] = true; k -= 1; } });
      });
      var now = Date.now();
      return {
        completion: completion, submissions: {}, nextId: 100,
        notifications: [
          { id: 1, subject: "Nuovo annuncio: calendario delle sessioni live", ctx: "Fondamenti di cybersecurity", url: BASE + "mod/forum/discuss.php?d=101", t: now - 1 * H, read: false },
          { id: 2, subject: "Voto pubblicato per Esercitazione 1", ctx: "Crittografia applicata", url: BASE + "grade/report/user/index.php?id=12", t: now - 26 * H, read: false },
          { id: 3, subject: "Nuova risposta nella discussione «Presentazioni»", ctx: "Etica e diritto dell'intelligenza artificiale", url: BASE + "mod/forum/discuss.php?d=88", t: now - 3 * D, read: true },
          { id: 4, subject: "Materiali del modulo 2 disponibili", ctx: "Machine learning per la sicurezza", url: BASE + "course/view.php?id=21", t: now - 4 * D, read: true }
        ]
      };
    }
    var st = readJSON(KEYS.demo, null) || freshState();
    function persist() { writeJSON(KEYS.demo, st); }
    async function net(ms) {
      await delay(ms);
      if (S.demo.offline) throw wsError(MSG.offline, "network");
    }
    function progressOf(c) {
      var tracked = allModules(c.id).filter(function (m) { return m.completion; });
      var done = tracked.filter(function (m) { return st.completion[m.id]; }).length;
      return tracked.length ? Math.round(done / tracked.length * 100) : null;
    }
    function listCourse(c) { return { id: c.id, name: c.name, short: c.short, category: c.category, progress: c.enrolled ? progressOf(c) : null, last: c.enrolled ? Date.now() + c.last : 0 }; }
    function events() {
      return eventSpecs().filter(function (e) { var m = moduleByName(e.course, e.module); return !(m && st.completion[m.id]); }).map(function (e) {
        var m = moduleByName(e.course, e.module);
        return { id: e.id, name: e.module, courseId: e.course, courseName: course(e.course).name, mod: m.mod, t: e.t, url: m.url, overdue: null };
      }).sort(function (a, b) { return a.t - b.t; });
    }

    return {
      siteInfo: async function () { await delay(200); return { userid: 1, fullname: "Studente demo", firstname: "Studente", username: "nome.cognome@studenti.unimi.it", sitename: "La Statale Open" }; },
      courses: async function () { await net(500); return COURSES.filter(function (c) { return c.enrolled; }).map(listCourse).sort(function (a, b) { return b.last - a.last; }); },
      events: async function () { await net(150); return events(); },
      notifications: async function () {
        await net(150);
        var list = st.notifications.slice().sort(function (a, b) { return b.t - a.t; }).map(function (n) { return Object.assign({}, n); });
        return { list: list, unread: list.filter(function (n) { return !n.read; }).length };
      },
      markRead: async function (id) { await net(120); st.notifications.forEach(function (n) { if (n.id === id) n.read = true; }); persist(); },
      markAllRead: async function () { await net(120); st.notifications.forEach(function (n) { n.read = true; }); persist(); },
      categories: async function (parent) {
        await net(350);
        return CATS.filter(function (c) { return c.parent === parent; }).map(function (c) {
          return { id: c.id, name: c.name, parent: c.parent, coursecount: COURSES.filter(function (x) { return x.category === c.id; }).length };
        });
      },
      coursesInCategory: async function (id) { await net(100); return COURSES.filter(function (c) { return c.category === id; }).map(listCourse); },
      contents: async function (courseId) {
        await net(400);
        var c = course(courseId);
        if (!c || !c.enrolled) throw wsError("Non sei iscritto a questo corso.", "server");
        var due = {};
        eventSpecs().forEach(function (e) { if (e.course === courseId) due[e.module] = e.t; });
        return SECTIONS[courseId].map(function (s) {
          return { name: s.name, summary: s.summary, modules: s.modules.map(function (m) {
            return Object.assign({}, m, { done: !!st.completion[m.id], due: due[m.name] || null });
          }) };
        });
      },
      setCompletion: async function (cmid, completed) { await net(250); st.completion[cmid] = completed; persist(); },
      fileURL: function (url) { return url; },
      // Solo per la demo: pagine simulate, consegne, nuovi avvisi.
      course: course, moduleById: moduleById, moduleByName: moduleByName, eventList: events,
      sectionsOf: function (courseId) { return SECTIONS[courseId] || []; },
      myCourses: function () { return COURSES.filter(function (c) { return c.enrolled; }); },
      category: function (id) { return CATS.filter(function (c) { return c.id === id; })[0] || null; },
      subcategories: function (id) { return CATS.filter(function (c) { return c.parent === id; }); },
      coursesIn: function (id) { return COURSES.filter(function (c) { return c.category === id; }); },
      submission: function (cmid) { return st.submissions[cmid] || null; },
      submit: function (cmid, filename) { st.submissions[cmid] = filename; st.completion[cmid] = true; persist(); },
      completeQuiz: function (cmid) { st.completion[cmid] = true; persist(); },
      addNotification: function () {
        var n = { id: st.nextId++, subject: "Nuovo annuncio: materiali aggiuntivi del modulo 2", ctx: "Fondamenti di cybersecurity", url: BASE + "mod/forum/discuss.php?d=101", t: Date.now(), read: false };
        st.notifications.push(n); persist(); return n;
      },
      reset: function () { st = freshState(); persist(); }
    };
  })();

  // ---------- Ponte con il portale (docs/ponte/ponte-1.js) ----------
  // Il portale ha i servizi per app spenti: i dati arrivano dal ponte, uno script che l'utente avvia con il preferito
  // «Statale Open» sulla pagina del portale. Qui niente rete: l'ultima lettura del ponte, con sopra le modifiche
  // dell'utente (avvisi letti, attività completate) che partono al prossimo «Aggiorna dal portale».
  var PB = { snap: null };
  function loadSnap() { PB.snap = readJSON(KEYS.ponteSnap, null); return PB.snap; }
  function readBox() {
    var box = readJSON(KEYS.ponteBox, null);
    return box && box.ops ? box : C.emptyBox(PB.snap ? PB.snap.user.id : null);
  }
  function writeBox(box) { writeJSON(KEYS.ponteBox, box); }
  function pendingRequest() {
    var p = readJSON(KEYS.ponteReq, null);
    return p && p.rid && Date.now() - p.at < C.PONTE.reqTTL ? p : null;
  }
  function queueOp(op, current) {
    var pending = pendingRequest();
    writeBox(C.enqueueOp(readBox(), op, current, pending ? pending.keys : []));
  }
  function snapModule(courseId, cmid) {
    var c = PB.snap && PB.snap.contents[courseId], found = null;
    if (c && c.sections) c.sections.forEach(function (s) { s.m.forEach(function (m) { if (m.id === cmid) found = m; }); });
    return found;
  }
  function treeCategory(c, parent) {
    var t = PB.snap.tree;
    return { id: c.id, name: c.n, parent: parent, coursecount: t.cats[c.id] ? t.cats[c.id].courses.length : 0 };
  }
  var Bridge = {
    siteInfo: async function () { return C.toModels(PB.snap).siteInfo; },
    courses: async function () { return C.toModels(PB.snap).courses; },
    events: async function () { return C.toModels(PB.snap).events; },
    notifications: async function () { return C.overlayNotifications(C.toModels(PB.snap).notifications, readBox()); },
    markRead: async function (id) {
      var n = PB.snap.notifs.list.filter(function (x) { return x.id === id; })[0];
      queueOp({ k: "read", id: id, label: n ? n.s : "Avviso" }, n ? n.r : false);
    },
    // Uno per uno, solo quelli mostrati: mai avvisi che l'utente non ha visto.
    markAllRead: async function () {
      var box = readBox(), pending = pendingRequest();
      PB.snap.notifs.list.forEach(function (n) {
        if (!n.r) box = C.enqueueOp(box, { k: "read", id: n.id, label: n.s }, false, pending ? pending.keys : []);
      });
      writeBox(box);
    },
    categories: async function (parent) {
      var t = PB.snap.tree;
      if (t && parent === 0) return t.root.map(function (c) { return treeCategory(c, 0); });
      if (t && t.cats[parent]) return t.cats[parent].subs.map(function (c) { return treeCategory(c, parent); });
      throw wsError(MSG.noTree, "bridge-missing");
    },
    coursesInCategory: async function (id) {
      var t = PB.snap.tree;
      if (!t || !t.cats[id]) throw wsError(MSG.noTree, "bridge-missing");
      return t.cats[id].courses.map(function (c) {
        var mine = PB.snap.courses.filter(function (x) { return x.id === c.id; })[0];
        return { id: c.id, name: c.n, short: mine ? mine.short : "", category: id, progress: mine ? mine.progress : null, last: 0 };
      });
    },
    contents: async function (courseId) {
      var sections = C.sectionsFor(PB.snap, courseId, readBox());
      if (sections) return sections;
      var c = PB.snap.contents[courseId];
      throw wsError(c && c.err ? "Il ponte non è riuscito a leggere questo corso (" + (c.err.m || c.err.code) + "): aprilo nel portale." : MSG.noContents, "bridge-missing");
    },
    setCompletion: async function (cmid, completed, mo) {
      var m = snapModule(mo.courseId, cmid);
      queueOp({ k: "done", cm: cmid, c: mo.courseId, v: completed ? 1 : 0, label: mo.name }, m ? C.isCompleted(m.st) : null);
    },
    fileURL: function (url) { return url; }
  };

  // Fonte dei dati attiva: il ponte, il portale o gli esempi, con le stesse funzioni.
  function api() { return S.mode === "demo" ? Demo : S.mode === "bridge" ? Bridge : Real; }

  // ---------- Stato (SessionStore, PortalData, UpdateChecker, impostazioni) ----------
  var settings = readJSON(KEYS.settings, {});
  var S = {
    phase: "checking", mode: null, client: null, siteInfo: null, notice: null,
    login: { method: "password", user: settings.email || "", pass: "", key: "", busy: false, error: null, diag: null, probed: false },
    program: settings.program || { id: DEFAULT_PROGRAM.id, name: DEFAULT_PROGRAM.name },
    reminders: settings.reminders !== false,
    autoReturn: settings.autoReturn !== false,
    // Acceso di serie (chiave nuova: chi aveva il vecchio interruttore spento di serie lo ritrova acceso).
    autoSync: settings.autoOpen !== false,
    email: settings.email || "", emailSaved: false,
    seen: settings.seen || null,
    demoNotifAuth: settings.demoNotifAuth === undefined ? null : settings.demoNotifAuth,
    tab: "home", stacks: null, scope: "mine", courseQuery: "", webTab: "home",
    data: emptyData(), loading: false, error: null,
    cats: {}, contents: {}, programList: null,
    sheet: null, menu: false, ql: null, ctx: null, alert: null,
    update: Object.assign({ available: null, lastCheck: null }, readJSON(KEYS.update, {}), { checking: false, result: null }),
    demo: Object.assign({ offline: false, expireNext: false, github: "new" }, readJSON(KEYS.toggles, {})),
    copied: false, toast: null, banner: null,
    ponte: { from: null, copied: false, notes: [], incoming: false, note: null, scriptAt: 0 }, sync: null
  };
  function emptyData() { return { courses: [], events: [], notifications: [], unread: 0, lastUpdated: null }; }
  function resetStacks() {
    S.stacks = { home: [{ v: "home" }], corsi: [{ v: "corsi" }], scadenze: [{ v: "scadenze" }], avvisi: [{ v: "avvisi" }], altro: [{ v: "altro" }] };
  }
  resetStacks();
  function saveSettings() {
    writeJSON(KEYS.settings, { program: S.program, reminders: S.reminders, autoReturn: S.autoReturn, autoOpen: S.autoSync, email: S.email, seen: S.seen, demoNotifAuth: S.demoNotifAuth });
  }
  function saveToggles() { writeJSON(KEYS.toggles, S.demo); }
  function saveUpdate() { writeJSON(KEYS.update, { available: S.update.available, lastCheck: S.update.lastCheck }); }
  function cacheKey() { return "so.cache." + (S.mode === "demo" ? "demo" : (S.siteInfo ? S.siteInfo.userid : "x")); }
  // PortalCache: dati mostrati subito all'avvio e senza rete, con l'ora dell'ultimo aggiornamento riuscito.
  function loadCache() {
    var cached = readJSON(cacheKey(), null);
    S.data = cached && cached.courses ? cached : emptyData();
  }
  function saveCache() { if (S.data.lastUpdated && S.mode !== "bridge") writeJSON(cacheKey(), S.data); }
  // Con il ponte anche la schermata di installazione: iOS ricarica spesso l'app mentre si crea il preferito in Safari.
  function savePhase() { writeJSON(KEYS.phase, { mode: S.mode, phase: S.phase === "web" ? "web" : S.phase === "ponte" ? "ponte" : "app", bm: S.phase === "ponte" && !!S.ponte.bookmark }); }

  // ---------- Sessione (SessionStore.swift) ----------
  // I dati del ponte arrivano anche nell'indirizzo (#ponte=…): si tolgono subito e si importano dopo l'avvio.
  async function restore() {
    var incoming = EMBEDDED ? null : takeIncoming();
    S.ponte.incoming = !!incoming;
    await restoreSession();
    if (incoming) await importText(incoming, "frag");
    S.ponte.incoming = false;
    if (!incoming) maybeAutoSync();
  }
  async function restoreSession() {
    var saved = readJSON(KEYS.phase, null);
    if (!saved || ((saved.mode === "real" || saved.mode === "bridge") && EMBEDDED)) { S.phase = "login"; render(); return; }
    S.mode = saved.mode;
    if (saved.phase === "web") { S.phase = "web"; render(); return; }
    if (S.mode === "bridge") {
      if (saved.phase === "ponte" || !loadSnap()) { S.phase = "ponte"; S.ponte.from = loadSnap() ? "app" : "login"; S.ponte.bookmark = !!saved.bm; render(); return; }
      applyBridge(); S.phase = "app"; resetStacks(); render();
      return;
    }
    if (S.mode === "demo") {
      S.siteInfo = await Demo.siteInfo();
      loadCache(); S.phase = "app"; resetStacks(); render();
      if (!S.data.lastUpdated) refreshAll();
      return;
    }
    var session = readJSON(KEYS.session, null);
    if (!session || !session.token) { S.mode = null; S.phase = "login"; render(); return; }
    S.client = new Moodle(session.token);
    S.siteInfo = session.siteInfo || null;
    loadCache();
    S.phase = "checking"; render();
    try {
      S.siteInfo = await Real.siteInfo();
      writeJSON(KEYS.session, { token: session.token, privatetoken: session.privatetoken || null, siteInfo: S.siteInfo });
      S.phase = "app"; resetStacks(); render();
      refreshAll();
    } catch (e) {
      if (e.code === "expired") { expire(); return; }
      if (S.siteInfo) { S.notice = MSG.unreachable; S.phase = "app"; resetStacks(); render(); }
      else { S.notice = e.message; S.phase = "login"; render(); }
    }
  }

  async function loginWithPassword() {
    var user = S.login.user.trim(), pass = S.login.pass;
    if (!user || !pass) { S.login.error = "Inserisci email e password di Ateneo."; render(); return; }
    S.login.busy = true; S.login.error = null; render();
    try {
      var t = await requestToken(user, pass);
      S.login.pass = "";
      S.email = user; saveSettings();
      await completeLogin(t.token, t.privatetoken);
    } catch (e) {
      loginFailed(e);
    }
  }
  async function loginWithKey() {
    var key = S.login.key.trim();
    if (!/^[a-f0-9]{32}$/i.test(key)) { S.login.error = "La chiave dell'app è lunga 32 caratteri (numeri e lettere da a a f)."; render(); return; }
    S.login.busy = true; S.login.error = null; render();
    try { await completeLogin(key, null); } catch (e) { loginFailed(e); }
  }
  function loginFailed(e) {
    S.client = null; S.login.busy = false;
    if (e.code === "network" || e.code === "invalidlogin" || e.code === "disabled") { S.login.error = e.message; render(); return; }
    S.login.error = null; render();
    // LoginFlowView: "Accesso non riuscito"
    showAlert("Accesso non riuscito", e.message, [
      { label: "Riprova", act: function () { S.login.method === "key" ? loginWithKey() : loginWithPassword(); } },
      { label: "Usa la modalità web", act: useWebMode },
      { label: "Annulla", role: "cancel" }
    ]);
  }
  async function completeLogin(token, privatetoken) {
    S.client = new Moodle(token);
    var info = await Real.siteInfo();
    S.mode = "real"; S.siteInfo = info;
    writeJSON(KEYS.session, { token: token, privatetoken: privatetoken, siteInfo: info });
    S.notice = null; S.login.busy = false; S.login.key = ""; S.error = null;
    S.phase = "app"; S.tab = "home"; resetStacks(); S.cats = {}; S.contents = {}; S.programList = null;
    savePhase(); loadCache(); render();
    refreshAll();
  }
  async function startDemo() {
    S.mode = "demo"; S.siteInfo = await Demo.siteInfo();
    S.notice = null; S.error = null; S.phase = "app"; S.tab = "home"; resetStacks(); S.cats = {}; S.contents = {}; S.programList = null;
    savePhase(); loadCache(); render();
    refreshAll();
    // SessionStore.completeLogin chiede il permesso per le notifiche.
    if (S.demoNotifAuth === null && EMBEDDED) setTimeout(askDemoNotifications, 700);
  }
  function useWebMode() {
    S.mode = S.mode || (EMBEDDED ? "demo" : "real");
    S.phase = "web"; S.webTab = "home"; S.notice = null; S.alert = null;
    savePhase(); render();
  }
  function clearSession() {
    removeKey(KEYS.session); removeKey(KEYS.phase); removeKey(cacheKey());
    S.client = null; S.data = emptyData(); S.loading = false; S.error = null;
    S.cats = {}; S.contents = {}; S.programList = null; S.sheet = null; S.menu = false; S.ctx = null; S.ql = null;
    resetStacks(); scrollMemory = {};
    setBadge(0);
  }
  function expire() {
    clearSession();
    S.mode = null; S.siteInfo = null;
    S.phase = "login"; S.notice = MSG.expired;
    render();
  }
  function logout() {
    if (S.mode === "bridge") PONTE_KEYS.forEach(removeKey);
    PB.snap = null; S.ponte.notes = []; S.sync = null;
    clearSession();
    S.mode = null; S.siteInfo = null; S.notice = null; S.alert = null;
    S.phase = "login";
    render();
  }

  // ---------- Dati (PortalData) ----------
  async function refreshAll() {
    if (S.mode === "bridge") { if (S.phase === "app" && applyBridge()) render(); return; }
    if (S.loading || !S.siteInfo || S.phase !== "app") return;
    S.loading = true; render();
    var A = api(), reached = false;
    try {
      if (S.mode === "demo" && S.demo.expireNext) {
        await delay(600);
        S.demo.expireNext = false; saveToggles();
        S.loading = false; expire(); return;
      }
      try {
        S.data.courses = await A.courses();
        S.error = null; reached = true;
      } catch (e) {
        if (e.code === "expired") { S.loading = false; expire(); return; }
        S.error = e.message;
      }
      try { S.data.events = await A.events(); reached = true; } catch (e) {
        if (e.code === "expired") { S.loading = false; expire(); return; }
      }
      await refreshNotifications();
      if (reached) { S.data.lastUpdated = Date.now(); saveCache(); }
    } finally {
      S.loading = false;
      if (S.phase === "app") render();
    }
  }
  async function refreshNotifications() {
    try {
      var r = await api().notifications();
      S.data.notifications = r.list; S.data.unread = r.unread;
      // DeadlineNotifier.notifyNew(post: false): in primo piano registra solo gli avvisi già visti.
      var ids = r.list.map(function (n) { return n.id; });
      S.seen = (S.seen || []).concat(ids).filter(function (v, i, a) { return a.indexOf(v) === i; }).slice(-500);
      saveSettings();
      setBadge(S.data.unread);
      saveCache();
    } catch (e) {
      if (e.code === "expired") expire();
    }
  }
  async function markRead(n) {
    if (n.read) return;
    try { await api().markRead(n.id); } catch (e) { /* come l'app: si riprova al prossimo aggiornamento */ }
    await refreshNotifications(); render();
    if (S.mode === "bridge") toast("Segnato come letto: arriva al portale al prossimo aggiornamento");
  }
  async function markAllRead() {
    try { await api().markAllRead(); } catch (e) { /* come l'app */ }
    await refreshNotifications(); render();
    if (S.mode === "bridge") toast("Avvisi segnati come letti: arrivano al portale al prossimo aggiornamento");
  }
  function setBadge(count) {
    if (EMBEDDED || !("setAppBadge" in navigator)) return;
    try { if (S.reminders && count > 0) navigator.setAppBadge(count); else navigator.clearAppBadge(); } catch (e) { /* non supportato */ }
  }

  // Elenchi caricati alla prima apertura, come i .task delle viste dell'app.
  function ensureCategory(id) {
    if (S.cats[id]) return S.cats[id];
    S.cats[id] = { status: "loading" };
    Promise.all([api().categories(id), api().coursesInCategory(id)]).then(function (r) {
      S.cats[id] = { status: "ok", subs: r[0].sort(byName), courses: r[1].sort(byName) };
      render();
    }, function (e) {
      if (e.code === "expired") { expire(); return; }
      S.cats[id] = { status: "error", error: e.message };
      render();
    });
    return S.cats[id];
  }
  function ensureContents(courseId) {
    var current = S.contents[courseId];
    if (current && current.status !== "reload") return current;
    S.contents[courseId] = { status: "loading", sections: current && current.sections };
    api().contents(courseId).then(function (sections) {
      S.contents[courseId] = { status: "ok", sections: sections };
      render();
    }, function (e) {
      if (e.code === "expired") { expire(); return; }
      S.contents[courseId] = { status: "error", error: e.message, sections: current && current.sections };
      render();
    });
    return S.contents[courseId];
  }
  function ensureProgramList() {
    if (S.programList) return S.programList;
    S.programList = { status: "loading" };
    api().categories(0).then(function (list) { S.programList = { status: "ok", list: list.sort(byName) }; render(); },
      function (e) { if (e.code === "expired") { expire(); return; } S.programList = { status: "error", error: e.message }; render(); });
    return S.programList;
  }
  async function toggleCompletion(mo) {
    try {
      await api().setCompletion(mo.id, !mo.done, mo);
      if (S.mode === "bridge") toast((mo.done ? "Attività segnata come da fare" : "Attività segnata come completata") + ": arriva al portale al prossimo aggiornamento");
      S.contents[mo.courseId] = Object.assign({}, S.contents[mo.courseId], { status: "reload" });
      ensureContents(mo.courseId);
    } catch (e) {
      if (e.code === "expired") { expire(); return; }
      S.contents[mo.courseId] = Object.assign({}, S.contents[mo.courseId], { error: e.message });
    }
    render();
  }

  // ---------- Ponte: aggiornamento e importazione ----------
  // Dati del ponte nelle viste, con le modifiche in attesa sovrapposte. Nessuna rete.
  function applyBridge() {
    if (!PB.snap && !loadSnap()) return false;
    var m = C.toModels(PB.snap), n = C.overlayNotifications(m.notifications, readBox());
    S.siteInfo = m.siteInfo;
    S.data = { courses: m.courses, events: m.events, notifications: n.list, unread: n.unread, lastUpdated: PB.snap.at };
    S.contents = {}; S.cats = {}; S.programList = null; S.error = null;
    setBadge(S.data.unread);
    return true;
  }
  // Indirizzo da cui è servita l'app: il preferito carica il ponte da qui (anche da un fork).
  function appBase() {
    var u = "";
    try { u = new URL("./", location.href).toString(); } catch (e) { u = ""; }
    return /^https:\/\//.test(u) ? u : APP.webURL;
  }
  function takeIncoming() {
    var m = /^#ponte=(.+)$/.exec(location.hash || "");
    if (!m) return null;
    try { history.replaceState(history.state, "", location.pathname + location.search); } catch (e) { location.hash = ""; }
    return m[1];
  }
  function startPonteSetup(from) {
    S.ponte.from = from; S.ponte.copied = false; S.ponte.bookmark = false;
    if (from === "login") S.mode = "bridge";
    S.phase = "ponte"; S.notice = null; S.sync = null;
    savePhase(); render();
  }
  function leavePonteSetup() {
    S.ponte.note = null;
    if (S.ponte.from === "app" && (PB.snap || loadSnap())) { S.phase = "app"; applyBridge(); savePhase(); render(); return; }
    S.mode = null; S.phase = "login"; removeKey(KEYS.phase); render();
  }
  // Riserva all'installazione dal menu di Userscripts: il file da mettere nella cartella degli script (app File).
  function downloadUserscript() {
    fetch(appBase() + C.PONTE.userscript, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (text) {
      var url = URL.createObjectURL(new Blob([text], { type: "text/javascript;charset=utf-8" }));
      var a = document.createElement("a");
      a.href = url; a.download = C.PONTE.userscript.split("/").pop();
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
      toast("Scaricato: in File → Download spostalo nella cartella Userscripts, poi ricarica questa pagina");
    }).catch(function () { toast("Download non riuscito: controlla la connessione e riprova"); });
  }
  function openSync() { S.sync = { copied: false, manual: false, note: null }; render(); }
  // «Accedi»: con il ponte automatico si apre la pagina ufficiale del portale (login di Ateneo se serve, compilato da Safari)
  // e si torna qui con i dati; la password non passa mai dall'app. Senza estensione si aprono i passaggi per installarla.
  function loginViaPortal() {
    if (S.ponte.starting) return;
    if (autoBridge()) startSync({ auto: true });
    else startPonteSetup("login");
  }
  // Il portale ha i servizi per app attivi? Solo allora l'accesso con email e password o con la chiave può funzionare.
  function probeServices() {
    if (EMBEDDED || S.login.probed) return;
    S.login.probed = true;
    siteCheck().then(function (r) {
      S.login.diag = r;
      if (r.ok && S.phase === "login") render();
    });
  }
  // Il percorso scelto non è tra quelli letti, o la lettura ha più di 14 giorni: il ponte rilegge le pagine dei percorsi.
  function needsTree() {
    var t = PB.snap && PB.snap.tree;
    return !t || !t.cats[S.program.id] || Date.now() - t.at > C.PONTE.treeTTL;
  }
  // Ponte automatico: lo script dell'estensione Userscripts segnala sulla pagina dell'app di essere installato.
  // Nelle app della schermata Home e nelle schede interne le estensioni di Safari non girano: lì resta il preferito.
  function autoBridge() {
    return !EMBEDDED && !isStandalone() && document.documentElement.getAttribute("data-statale-open-auto") === "1";
  }
  // Un aggiornamento automatico partito da poco non è tornato con i dati: l'estensione non è attiva o il portale non ha risposto.
  function autoVerified() { var a = readJSON(KEYS.ponteAuto, null); return !!(a && a.ok); }
  // «Aggiorna da solo all'apertura» è in pausa: l'ultimo giro automatico non è tornato e da solo non si riprova.
  function autoPaused() {
    var p = readJSON(KEYS.ponteReq, null), last = readJSON(KEYS.ponteLast, null);
    return !!(S.autoSync && p && p.auto && (!last || last.at < p.at) && Date.now() - p.at >= C.PONTE.autoTTL);
  }
  function autoStuck() {
    var p = pendingRequest(), last = readJSON(KEYS.ponteLast, null);
    return !!(p && p.auto && p.ret === "frag" && Date.now() - p.at < C.PONTE.autoTTL && (!last || last.at < p.at) && !S.ponte.incoming);
  }
  // Un tocco su «Aggiorna dal portale»: con il ponte automatico si parte subito, altrimenti si aprono i passaggi.
  function syncNow() {
    if (S.ponte.starting) return;
    if (autoBridge()) startSync({ auto: true });
    else openSync();
  }
  // Facoltativo: all'apertura, con il ponte automatico e dati più vecchi di un'ora, aggiorna da solo.
  // Mai subito dopo un ritorno dal portale o un tentativo recente, così non può ripartire in cerchio.
  function maybeAutoSync() {
    if (!S.autoSync || S.mode !== "bridge" || S.phase !== "app" || !PB.snap || !autoBridge()) return;
    if (S.ponte.incoming || S.ponte.starting || importing || S.alert || S.sync || S.ctx || document.visibilityState !== "visible") return;
    if (Date.now() - PB.snap.at < C.PONTE.autoAfter) return;
    var p = readJSON(KEYS.ponteReq, null), last = readJSON(KEYS.ponteLast, null);
    if (p && Date.now() - p.at < C.PONTE.autoTTL) return;
    // L'ultimo giro automatico non è tornato: niente nuovi tentativi da soli finché non riesce un aggiornamento.
    if (p && p.auto && (!last || last.at < p.at)) return;
    if (!S.autoReturn) return;
    var nav = window.performance && performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
    if (nav && nav.type === "back_forward") return;
    toast("Dati di " + C.relative(PB.snap.at).replace(/^tra /, "") + ": aggiorno dal portale…");
    startSync({ auto: true });
  }
  // Il ponte automatico parte solo per una richiesta che l'app gli consegna qui, sulla propria pagina: lo script la registra
  // nel suo archivio (che gli altri siti non possono scrivere) e conferma. Un link al portale costruito da altri non lo avvia.
  function armAuto(text) {
    return new Promise(function (resolve) {
      var root = document.documentElement, done = false, timer = null;
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        document.removeEventListener("statale-open-armed", finish);
        resolve(root.getAttribute("data-statale-open-armed") === text);
      }
      root.removeAttribute("data-statale-open-armed");
      root.setAttribute("data-statale-open-request", text);
      document.addEventListener("statale-open-armed", finish);
      timer = setTimeout(finish, 2500);
      try { document.dispatchEvent(new CustomEvent("statale-open-request")); } catch (e) { finish(); }
    });
  }
  function startSync(opts) {
    var auto = !!(opts && opts.auto), standalone = isStandalone();
    // Con «Ritorno automatico» spento i dati tornano dagli appunti anche con il ponte automatico (niente dati nell'indirizzo).
    var r = C.buildRequest(readBox(), { ret: standalone || !S.autoReturn ? "clip" : "frag", tree: needsTree() ? S.program.id : null });
    r.pending.auto = auto;
    var url = C.requestURL(r.text, auto ? "auto" : "bookmark");
    if (auto) {
      // Un aggiornamento alla volta: il secondo segnale dell'estensione o un doppio tocco non ne avviano un altro.
      if (S.ponte.starting) return;
      S.ponte.starting = true;
      if (S.phase !== "app") render();
      armAuto(r.text).then(function (ok) {
        if (ok) {
          writeJSON(KEYS.ponteReq, r.pending);
          try { location.assign(url); return; } catch (e) { /* navigazione rifiutata: si riprova a mano */ }
        }
        S.ponte.starting = false;
        var note = "Il ponte automatico non ha risposto: controlla in Safari che l'estensione Userscripts sia attiva e consentita su questa pagina, poi riprova.";
        if (S.phase !== "app") { S.ponte.note = note; if (S.phase === "ponte") render(); else startPonteSetup("login"); return; }
        S.sync = { copied: false, manual: false, note: note + " Intanto puoi usare il preferito (istruzioni in Altro → Ponte con il portale)." };
        render();
      });
      return;
    }
    writeJSON(KEYS.ponteReq, r.pending);
    if (!standalone) { location.assign(url); return; }
    // Dalla schermata Home il preferito di Safari non è raggiungibile: l'indirizzo passa dagli appunti.
    copyTextOk(url).then(function (ok) {
      if (!S.sync) S.sync = {};
      S.sync.copied = ok;
      S.sync.url = ok ? null : url;
      render();
    });
  }
  async function pasteData() {
    var text = null;
    try { text = navigator.clipboard && navigator.clipboard.readText ? await navigator.clipboard.readText() : null; } catch (e) { text = null; }
    if (!text) {
      S.sync = Object.assign(S.sync || {}, { manual: true, note: "Non è stato possibile leggere gli appunti: tieni premuto nel riquadro e scegli «Incolla»." });
      render();
      return;
    }
    importText(text, "clip");
  }
  function importFailed(message) {
    if (S.sync) { S.sync.note = message; render(); }
    else showAlert("Dati del ponte", message, [{ label: "OK", role: "cancel" }]);
  }
  var importing = false;
  async function importText(text, source) {
    if (importing) return;
    var found = C.findEnvelope(text);
    if (found.kind !== "payload") { importFailed(C.ponteMessage(found.kind)); return; }
    importing = true;
    var snap;
    try { snap = C.validateSnapshot(await C.decodePayload(found.env)); } catch (e) { importing = false; importFailed(e.message); return; }
    importing = false;
    var last = readJSON(KEYS.ponteLast, null);
    if (last && last.sid === snap.sid) { S.sync = null; toast("Questi dati sono già stati importati"); return; }
    var prev = readJSON(KEYS.ponteSnap, null), pending = readJSON(KEYS.ponteReq, null);
    var matched = !!(pending && snap.res && snap.res.rid === pending.rid);
    var who = snap.user.name || "account " + snap.user.id;
    function ask(title, message, replace) {
      showAlert(title, message, [{ label: "Annulla" }, { label: "Importa", role: "cancel", act: function () { commitImport(snap, replace); } }]);
    }
    if (prev && prev.user && prev.user.id !== snap.user.id) {
      ask("Account diverso", "I dati sono dell'account «" + who + "», diverso da quello salvato («" + (prev.user.name || prev.user.id) + "»). Sostituirli? Le modifiche non inviate verranno eliminate.", true);
      return;
    }
    if (prev && snap.at < prev.at) {
      ask("Dati più vecchi", "Questi dati (letti " + fmtShort.format(snap.at) + ") sono più vecchi di quelli che hai (" + fmtShort.format(prev.at) + "). Importarli comunque?", false);
      return;
    }
    // Un indirizzo #ponte=… che l'app non ha chiesto (per esempio un link ricevuto): prima si chiede.
    if (source === "frag" && !matched) {
      ask("Dati dal portale", "Importare i dati letti dal portale " + fmtShort.format(snap.at) + (snap.user.name ? " per " + snap.user.name : "") + "?", false);
      return;
    }
    commitImport(snap, false);
  }
  // Salva i dati; se lo spazio non basta toglie i contenuti dei corsi aperti meno di recente.
  function saveSnap(snap) {
    var copy = snap, trimmed = false;
    for (var i = 0; i < 80; i++) {
      try { localStorage.setItem(KEYS.ponteSnap, JSON.stringify(copy)); return { snap: copy, trimmed: trimmed, saved: true }; } catch (e) {
        var keys = copy.courses.slice().sort(function (a, b) { return a.last - b.last; }).map(function (c) { return String(c.id); })
          .filter(function (k) { return copy.contents[k]; });
        if (!keys.length) keys = Object.keys(copy.contents);
        if (!keys.length) break;
        copy = Object.assign({}, copy, { contents: Object.assign({}, copy.contents) });
        delete copy.contents[keys[0]];
        trimmed = true;
      }
    }
    return { snap: snap, trimmed: false, saved: false };
  }
  function commitImport(snap, replace) {
    var prev = replace ? null : readJSON(KEYS.ponteSnap, null), pending = readJSON(KEYS.ponteReq, null);
    var box = replace ? C.emptyBox(snap.user.id) : readBox();
    if (box.uid && box.uid !== snap.user.id) box = C.emptyBox(snap.user.id);
    box.uid = snap.user.id;
    var rec = C.reconcile({ box: box, snap: snap, pending: pending });
    var merged = C.mergeSnapshot(prev, snap);
    delete merged.res;
    var stored = saveSnap(merged);
    PB.snap = stored.snap;
    writeBox(rec.box);
    if (rec.failed.length) writeJSON(KEYS.ponteFail, readJSON(KEYS.ponteFail, []).concat(rec.failed).slice(-20));
    writeJSON(KEYS.ponteLast, { sid: snap.sid, at: Date.now() });
    if (rec.matched) {
      if (pending && pending.auto) writeJSON(KEYS.ponteAuto, { ok: Date.now() });
      removeKey(KEYS.ponteReq);
    }
    S.ponte.notes = rec.notes; S.ponte.note = null;
    // Primo collegamento (o ritorno da demo, portale, modalità web): si passa ai dati del ponte.
    if (S.mode !== "bridge" || S.phase !== "app") {
      if (S.mode === "real") removeKey(KEYS.session);
      S.mode = "bridge"; S.phase = "app"; S.tab = "home"; S.notice = null; S.client = null; resetStacks();
    }
    applyBridge(); savePhase();
    S.sync = null; S.alert = null;
    render();
    var unread = S.data.unread;
    var text = "Dati aggiornati: " + S.data.courses.length + (S.data.courses.length === 1 ? " corso, " : " corsi, ") +
      S.data.events.length + (S.data.events.length === 1 ? " scadenza, " : " scadenze, ") +
      (unread ? unread + (unread === 1 ? " avviso da leggere" : " avvisi da leggere") : "nessun avviso da leggere");
    // Il nome serve solo al saluto: se il portale non lo concede non è un problema da segnalare.
    var warn = snap.warn.filter(function (w) { return w.part !== "nome"; });
    if (warn.length) text += ". Non aggiornato: " + warn.map(function (w) { return w.part; }).join(", ");
    if (!stored.saved) text += ". Spazio dell'app esaurito: i dati restano solo finché l'app è aperta";
    else if (stored.trimmed) text += ". Spazio dell'app esaurito: alcuni contenuti dei corsi non sono stati salvati";
    if (rec.failed.length) text += ". " + rec.failed.length + (rec.failed.length === 1 ? " modifica non applicata" : " modifiche non applicate") + " (vedi Home)";
    toast(text);
  }
  function readFile(file) {
    if (!file) return;
    if (file.size > C.PONTE.maxEnvelope + 4096) { importFailed(C.ponteMessage("toobig")); return; }
    var reader = new FileReader();
    reader.onload = function () { importText(String(reader.result || ""), "file"); };
    reader.onerror = function () { importFailed("Non è stato possibile leggere il file."); };
    reader.readAsText(file);
  }
  // C'è una richiesta partita da poco e ancora senza risposta: i dati potrebbero essere negli appunti.
  function awaitingPaste() {
    var p = pendingRequest(), last = readJSON(KEYS.ponteLast, null);
    return !!(p && Date.now() - p.at < C.PONTE.pasteTTL && (!last || last.at < p.at));
  }

  // ---------- Aprire pagine, file e siti ----------
  // Nell'app si aprono nel browser interno già autenticato; nell'app web in una nuova scheda
  // (il portale non si lascia incorporare) con la sessione del portale aperta in Safari.
  function openURL(url, title) {
    if (!url) return;
    if (S.mode === "demo") { openDemoBrowser(url, title); return; }
    var w = window.open(url, "_blank");
    if (w) { try { w.opener = null; } catch (e) { /* già isolata */ } }
    else location.href = url;
  }
  // CourseDetailView.open
  function openModule(mo) {
    if (!mo) return;
    var external = mo.contents.filter(function (x) { return x.fileurl; })[0];
    var file = mo.contents.filter(function (x) { return x.type === "file" && x.fileurl; })[0];
    if (mo.mod === "url" && external) openURL(external.fileurl, mo.name);
    else if (mo.mod === "resource" && file) openURL(api().fileURL(file.fileurl), mo.name);
    else openURL(mo.url, mo.name);
  }

  // ---------- Promemoria, notifiche, badge ----------
  function exportCalendar() {
    var future = S.data.events.filter(function (e) { return e.t > Date.now(); });
    if (!future.length) { toast("Nessuna scadenza futura da aggiungere"); return; }
    if (EMBEDDED) { toast("Qui dentro Claude i file non si scaricano: usa l'app web per aggiungere le scadenze al Calendario"); return; }
    var ics = C.buildICS(future.map(function (e) { return { id: e.id, name: e.name, courseName: e.courseName, url: e.url, t: e.t }; }));
    var url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url; a.download = "scadenze-statale-open.ics";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toast("Apri il file per aggiungere " + future.length + " scadenze al Calendario, ognuna con avvisi 24 ore e 2 ore prima");
  }
  async function testNotification() {
    if (EMBEDDED) {
      if (S.demoNotifAuth === null) { askDemoNotifications(); return; }
      if (!S.demoNotifAuth) { toast("Notifiche non consentite: sull'iPhone si attivano in Impostazioni"); return; }
      toast("La notifica di prova arriva tra 3 secondi");
      setTimeout(function () { banner("La Statale Open", "Le notifiche funzionano."); }, 3000);
      return;
    }
    if (!("Notification" in window)) {
      toast(isStandalone() ? "Questo dispositivo non consente notifiche alle app web" : "Su iPhone le notifiche arrivano solo dopo aver aggiunto l'app alla schermata Home (iOS 16.4 o successivo)");
      return;
    }
    var permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") { toast("Notifiche non consentite per questa app web"); return; }
    toast("La notifica di prova arriva tra 3 secondi");
    setTimeout(function () { systemNotification("La Statale Open", "Le notifiche funzionano."); }, 3000);
  }
  function systemNotification(title, body) {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(function (reg) { return reg.showNotification(title, { body: body, icon: ICON, badge: ICON }); })
        .catch(function () { banner(title, body); });
      return;
    }
    try { new Notification(title, { body: body, icon: ICON }); } catch (e) { banner(title, body); }
  }
  function askDemoNotifications() {
    showAlert("“Statale Open” vorrebbe inviarti delle notifiche", "Le notifiche possono includere avvisi, suoni e badge sulle icone. Puoi configurarle in Impostazioni.", [
      { label: "Non consentire", act: function () { S.demoNotifAuth = false; saveSettings(); render(); } },
      { label: "Consenti", role: "cancel", act: function () { S.demoNotifAuth = true; saveSettings(); render(); } }
    ]);
  }

  // ---------- Aggiornamenti (UpdateChecker.swift) ----------
  async function checkUpdate(manual) {
    if (S.update.checking) return;
    S.update.checking = true; render();
    try {
      if (EMBEDDED) {
        await delay(manual ? 900 : 300);
        if (S.demo.offline) { S.update.result = "Controllo non riuscito: " + MSG.offline; return; }
        if (S.demo.github === "private") { S.update.result = "Nessuna release pubblica trovata su GitHub."; return; }
        S.update.lastCheck = Date.now();
        if (S.demo.github === "new") { S.update.available = { version: "1.3.0", url: REPO_URL + "/releases" }; S.update.result = "È disponibile la versione 1.3.0."; }
        else { S.update.available = null; S.update.result = "Hai l'ultima versione (" + APP.version + ")."; }
        return;
      }
      var r = await fetch("https://api.github.com/repos/" + APP.repo + "/releases/latest", { headers: { Accept: "application/vnd.github+json" }, cache: "no-store" });
      if (r.status !== 200) {
        S.update.result = r.status === 404 ? "Nessuna release pubblica trovata su GitHub." : "GitHub non ha risposto (HTTP " + r.status + ").";
        return;
      }
      var release = await r.json();
      var version = C.normalizedVersion(release.tag_name);
      S.update.lastCheck = Date.now();
      if (C.isNewer(version, APP.version)) { S.update.available = { version: version, url: release.html_url }; S.update.result = "È disponibile la versione " + version + "."; }
      else { S.update.available = null; S.update.result = "Hai l'ultima versione (" + APP.version + ")."; }
    } catch (e) {
      S.update.result = "Controllo non riuscito: " + (navigator.onLine === false ? MSG.offline : "GitHub non raggiungibile.");
    } finally {
      S.update.checking = false; saveUpdate(); render();
    }
  }
  function checkUpdateIfNeeded() {
    if (S.update.available && !C.isNewer(S.update.available.version, APP.version)) S.update.available = null;
    if (!S.update.lastCheck || Date.now() - S.update.lastCheck > D) checkUpdate(false);
  }

  // ---------- Informazioni per le segnalazioni (AppInfo.swift) ----------
  function systemVersion() {
    var m = /OS (\d+)[_.](\d+)(?:[_.](\d+))? like Mac OS X/.exec(navigator.userAgent);
    return m ? "iOS " + m[1] + "." + m[2] + "." + (m[3] || "0") : (navigator.platform || "browser");
  }
  function deviceModel() { return (/iPhone/.test(navigator.userAgent) ? "iPhone" : /iPad/.test(navigator.userAgent) ? "iPad" : "computer") + " (app web" + (isStandalone() ? ", schermata Home" : "") + ")"; }
  function diagnostics() {
    return "Statale Open " + APP.version + " · app web" + (S.mode === "demo" ? " (dati di esempio)" : S.mode === "bridge" ? " (ponte v" + (PB.snap ? PB.snap.bv : C.PONTE.version) + ")" : "") + "\n" + systemVersion() + " · " + deviceModel() + "\nPercorso: " + S.program.name + " (categoria " + S.program.id + ")";
  }
  function issueURL(template) {
    return REPO_URL + "/issues/new?template=" + template + "&versione=" + encodeURIComponent(APP.version + " (app web)") + "&dispositivo=" + encodeURIComponent(systemVersion() + " · " + deviceModel());
  }

  // ---------- Pezzi di interfaccia ----------
  function group(header, cellsHtml, footer, headerClass) {
    return '<section class="group">' + (header ? '<div class="gh ' + (headerClass || "") + '">' + header + "</div>" : "") +
      '<div class="cells">' + cellsHtml + "</div>" + (footer ? '<div class="gf">' + footer + "</div>" : "") + "</section>";
  }
  function eventRow(e) {
    var overdue = e.overdue != null ? e.overdue : e.t < Date.now();
    var icon = e.mod === "quiz" ? "pencil" : e.mod === "assign" ? "tray" : e.mod === "forum" ? "bubble" : "calendar";
    return '<button class="cell indent" data-a="event" data-id="' + e.id + '">' +
      '<span class="ic" style="color:' + (overdue ? "var(--red)" : "var(--accent)") + '">' + ic(icon) + "</span>" +
      '<span class="cell-main"><span class="t b">' + esc(e.name) + "</span>" + (e.courseName ? '<span class="s clip">' + esc(e.courseName) + "</span>" : "") +
      '<span class="s ' + (overdue ? "red" : "") + '">' + esc(fmtEvent.format(e.t)) + "</span></span>" +
      '<span class="rel">' + esc(C.relative(e.t)) + "</span></button>";
  }
  function courseRow(c) {
    var p = c.progress;
    return '<button class="cell" data-a="push" data-v="course" data-id="' + c.id + '" data-title="' + esc(c.name) + '"><span class="cell-main">' +
      '<span class="t">' + esc(c.name) + "</span>" + (c.short && c.short !== c.name ? '<span class="s">' + esc(c.short) + "</span>" : "") +
      (p === null || p === undefined ? "" : '<span class="prog"><span class="bar"><i style="width:' + p + '%"></i></span><span>Completamento ' + Math.round(p) + "%</span></span>") +
      "</span>" + ic("chevR", ' class="chev"') + "</button>";
  }
  function openRow(title, icon, url) {
    return '<button class="cell accent-row" data-a="open" data-url="' + esc(url) + '" data-title="' + esc(title) + '">' + (icon ? ic(icon) : "") + '<span class="t">' + esc(title) + "</span></button>";
  }
  function extRow(title, url, icon) {
    return '<a class="cell accent-row" href="' + esc(url) + '" target="_blank" rel="noopener">' + (icon ? ic(icon) : "") + '<span class="t">' + esc(title) + "</span></a>";
  }
  function switchRow(label, key, target) {
    var on = target === "demo" ? !!S.demo[key] : !!S[key];
    return '<div class="cell"><span class="cell-main"><span class="t">' + esc(label) + '</span></span><button class="sw' + (on ? " on" : "") + '" role="switch" aria-checked="' + on + '" aria-label="' + esc(label) + '" data-a="switch" data-key="' + key + '" data-target="' + (target || "") + '"><i></i></button></div>';
  }
  function labeled(label, value) {
    return '<div class="cell"><span class="t">' + esc(label) + '</span><span class="cell-main"></span><span class="value">' + esc(value) + "</span></div>";
  }
  function noticeGroup(message) {
    return message ? group("", '<div class="cell notice">' + ic("warn") + "<span>" + esc(message) + "</span></div>") : "";
  }
  function ptr() { return '<div class="ptr' + (S.loading ? " loading" : "") + '" id="ptr">' + ic("spinner") + "</div>"; }
  function refreshButton() { return '<button class="link" aria-label="Aggiorna" data-a="refresh">' + ic("refresh") + "</button>"; }
  function safariButton(url, title, label) {
    return '<button class="link" aria-label="' + esc(label || "Apri nel portale") + '" data-a="open" data-url="' + esc(url) + '" data-title="' + esc(title) + '">' + ic("compass") + "</button>";
  }
  function spinnerRow() { return '<div class="spinner-row">' + spinner() + "</div>"; }
  function errorWithPortal(message, url, title, label) {
    return group("", '<div class="cell notice">' + ic("warn") + "<span>" + esc(message) + "</span></div>" +
      '<button class="cell accent-row" data-a="open" data-url="' + esc(url) + '" data-title="' + esc(title) + '"><span class="t">' + esc(label) + "</span></button>");
  }

  var KIND = {
    lesson: { title: "Lezioni", color: "var(--blue)", icon: "play" },
    exercise: { title: "Esercizi", color: "var(--purple)", icon: "pencil" },
    etivity: { title: "E-tivity", color: "var(--teal)", icon: "people" },
    other: { title: "Altro", color: "var(--gray)", icon: "grid" }
  };
  // ModuleRow.icon
  var MODICON = { resource: "doc", url: "link", page: "book", book: "book", folder: "folder", quiz: "pencil", assign: "tray", forum: "bubble", scorm: "play", h5pactivity: "play", hvp: "play", lesson: "play", lti: "video", kalvidres: "video", kalvidpres: "video", wiki: "book", glossary: "book" };
  function moduleRow(mo) {
    if (mo.mod === "label") return mo.description ? '<div class="cell"><span class="s">' + esc(mo.description) + "</span></div>" : "";
    var k = KIND[mo.kind] || KIND.other;
    var state = (mo.done ? "Completata" : "Da completare") + (mo.pending ? ", da inviare al portale" : "");
    var trailing = mo.completion ? '<span class="check" style="color:' + (mo.done ? "var(--green)" : "var(--gray)") + '" aria-label="' + state + '">' + (mo.done ? checkFilled() : ic("circle")) + "</span>" : "";
    return '<div class="cell indent" role="button" tabindex="0" data-a="module" data-m="' + mo.id + '" data-c="' + mo.courseId + '" data-long="' + mo.id + '">' +
      '<span class="ic" style="color:' + k.color + '">' + ic(MODICON[mo.mod] || k.icon) + "</span>" +
      '<span class="cell-main"><span class="t">' + esc(mo.name) + '</span><span class="s">' + k.title + (mo.modplural ? " · " + esc(mo.modplural) : "") + "</span>" +
      (mo.due ? '<span class="s ' + (mo.due < Date.now() ? "" : "orange") + '">🕒 ' + esc(fmtShort.format(mo.due)) + "</span>" : "") +
      (mo.pending ? '<span class="s orange">' + (mo.done ? "Completata" : "Da fare") + " · da inviare al portale</span>" : "") +
      "</span>" + trailing + "</div>";
  }
  function findModule(courseId, id) {
    var st = S.contents[courseId], found = null;
    if (st && st.sections) st.sections.forEach(function (s) { s.modules.forEach(function (m) { if (m.id === id) found = m; }); });
    return found;
  }

  // ---------- Viste (le stesse dell'app) ----------
  var VIEWS = {
    home: function () {
      var today = C.startOfDay(Date.now());
      var upcoming = S.data.events.filter(function (e) { return e.t >= today; }).slice(0, 5);
      var name = S.siteInfo && (S.siteInfo.firstname || S.siteInfo.fullname) || "studente";
      var firstLoad = S.loading && !S.data.lastUpdated;
      var body = ptr() +
        group("", '<div class="hello"><div class="t">Ciao, ' + esc(name) + '</div><div class="s">Percorso ' + esc(S.program.name) + " · La Statale Open</div></div>",
          S.data.lastUpdated ? "Aggiornato " + esc(C.relative(S.data.lastUpdated)) : "") +
        (S.update.available ? group("", '<a class="cell accent-row" href="' + esc(S.update.available.url) + '" target="_blank" rel="noopener">' + ic("down") +
          '<span class="t">È disponibile la versione ' + esc(S.update.available.version) + ": tocca per scaricarla</span></a>") : "") +
        noticeGroup(S.error || S.notice) +
        ponteHomeGroup() +
        group("Prossime scadenze", upcoming.length ? upcoming.map(eventRow).join("") :
          '<div class="cell empty">' + (firstLoad ? "Caricamento…" : "Nessuna scadenza imminente 🎉") + "</div>") +
        group("Ripresa rapida", S.data.courses.length ? S.data.courses.slice(0, 5).map(courseRow).join("") :
          '<div class="cell empty">' + (firstLoad ? "Caricamento…" : "Nessun corso trovato") + "</div>") +
        group("Portale",
          openRow("Dashboard", "grid", BASE + "my/") +
          openRow("Percorso " + S.program.name + " (sito)", "stack", BASE + "course/index.php?categoryid=" + S.program.id) +
          openRow("Calendario", "calendar", BASE + "calendar/view.php?view=upcoming") +
          openRow("Valutazioni", "chart", BASE + "grade/report/overview/index.php"));
      return { title: "Home", body: body, ptr: true, trailing: refreshButton() };
    },

    corsi: function () {
      if (S.scope === "mine") {
        return {
          title: "Corsi", ptr: true, seg: true,
          body: '<label class="search">' + ic("search") + '<input id="q-courses" type="search" data-search="courses" placeholder="Cerca un corso" autocomplete="off" value="' + esc(S.courseQuery) + '"></label>' +
            ptr() + '<div id="results">' + VIEWS.corsi.results() + "</div>"
        };
      }
      var v = categoryView(S.program.id, S.program.name);
      v.title = "Corsi"; v.seg = true;
      return v;
    },

    cluster: function (entry) { return categoryView(entry.id, entry.title); },

    course: function (entry) {
      var f = entry.filter || "";
      function segBtn(k, label) { return '<button role="tab" aria-selected="' + (f === k) + '" class="' + (f === k ? "on" : "") + '" data-a="filter" data-k="' + k + '">' + label + "</button>"; }
      var body = '<div class="seg" role="tablist" style="margin-top:8px">' + segBtn("", "Tutto") + segBtn("lesson", "Lezioni") + segBtn("exercise", "Esercizi") + segBtn("etivity", "E-tivity") + "</div>" +
        '<label class="search">' + ic("search") + '<input id="q-course" type="search" data-search="course" placeholder="Cerca nel corso" autocomplete="off" value="' + esc(entry.q || "") + '"></label>' +
        '<div id="results">' + VIEWS.course.results(entry) + "</div>";
      return { title: entry.title, trailing: safariButton(BASE + "course/view.php?id=" + entry.id, entry.title, "Apri il corso nel portale"), body: body, ptr: true };
    },

    scadenze: function () {
      var today = C.startOfDay(Date.now()), all = S.data.events;
      var overdue = all.filter(function (e) { return e.t < today; });
      var days = {};
      all.filter(function (e) { return e.t >= today; }).forEach(function (e) { var k = C.startOfDay(e.t); (days[k] = days[k] || []).push(e); });
      var body = ptr() + noticeGroup(S.error) +
        (S.mode === "bridge" && PB.snap && C.staleness(PB.snap.at) !== "fresh" ? noticeGroup("Dati del portale letti " + C.relative(PB.snap.at) + ": le scadenze potrebbero essere cambiate. Aggiorna dal portale.") : "");
      if (!all.length) body += '<div class="unavailable">' + ic("calcheck") + '<div class="t">' + (S.loading ? "Caricamento…" : "Nessuna scadenza") + "</div><div>Qui compaiono quiz, consegne ed e-tivity con una data di scadenza.</div></div>";
      if (overdue.length) body += group(ic("exclam") + "Scadute di recente", overdue.map(eventRow).join(""), "", "red");
      Object.keys(days).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) { body += group(esc(C.dayTitle(k)), days[k].map(eventRow).join("")); });
      return {
        title: "Scadenze", ptr: true, body: body,
        trailing: '<button class="link" aria-label="Apri il calendario" data-a="open" data-url="' + BASE + 'calendar/view.php?view=upcoming" data-title="Calendario">' + ic("calendar") + "</button>"
      };
    },

    avvisi: function () {
      var list = S.data.notifications;
      var rows = list.map(function (n) {
        return '<div class="swipe" data-swipe="' + n.id + '">' + (n.read ? "" : '<button class="swipe-action" data-a="mark-read" data-id="' + n.id + '">Letto</button>') +
          '<button class="cell" data-a="notif" data-id="' + n.id + '"><span class="dot' + (n.read ? " off" : "") + '"></span><span class="cell-main">' +
          '<span class="t' + (n.read ? "" : " b") + '">' + esc(n.subject) + "</span>" + (n.ctx ? '<span class="s clip">' + esc(n.ctx) + "</span>" : "") +
          '<span class="s">' + esc(C.relative(n.t)) + (n.pending ? ' <span class="tag">da inviare</span>' : "") + "</span></span></button></div>";
      }).join("");
      var body = ptr() + (list.length ? group("", rows) + '<p class="hint">Scorri un avviso verso sinistra per segnarlo come letto.' +
        (S.mode === "bridge" ? " Le modifiche arrivano al portale al prossimo aggiornamento." : "") + "</p>" :
        '<div class="unavailable">' + ic("bellSlash") + '<div class="t">Nessun avviso</div><div>Annunci dei docenti, valutazioni e messaggi del forum compariranno qui.</div></div>');
      return { title: "Avvisi", ptr: true, swipe: true, body: body, trailing: S.data.unread ? '<button class="link" data-a="read-all">Segna tutti letti</button>' : "" };
    },

    altro: function () {
      var info = S.siteInfo;
      var body = (info ? group("Account", labeled("Studente", info.fullname) + (info.username ? labeled("Utente", info.username) : "") + labeled("Portale", info.sitename || C.MOODLE_HOST)) : "") +
        group("", '<button class="cell" data-a="push" data-v="program" data-title="Percorso"><span class="t">Percorso</span><span class="cell-main"></span><span class="value">' + esc(S.program.name) + "</span>" + ic("chevR", ' class="chev"') + "</button>",
          "Il percorso mostrato nella scheda Corsi.") +
        (S.mode === "bridge" ? ponteSection() : credentialsSection()) + remindersSection() +
        group("Portale", openRow("Apri il portale completo", "", BASE + "my/") + openRow("Profilo", "", BASE + "user/profile.php") + openRow("Messaggi", "", BASE + "message/index.php")) +
        aboutSection() +
        group("", '<button class="cell destructive centered" data-a="logout"><span class="t">' + (S.mode === "demo" ? "Esci dalla demo" : "Esci") + "</span></button>",
          S.mode === "demo" ? "Torni alla schermata di accesso. I dati di esempio restano finché non ripristini la demo."
            : S.mode === "bridge" ? "Uscendo vengono cancellati i dati letti dal portale e le modifiche non inviate. Il preferito «Statale Open» resta in Safari: puoi eliminarlo da Segnalibri → Modifica."
            : "Uscendo vengono cancellati la chiave dell'app e i dati salvati del portale. L'email resta finché non la rimuovi.") +
        (S.mode === "demo" ? demoSection() : "");
      return { title: "Altro", body: body };
    },

    program: function () {
      var st = ensureProgramList();
      var rows = st.status === "ok" ? st.list.map(function (c) {
        return '<button class="cell" data-a="pick-program" data-id="' + c.id + '" data-name="' + esc(c.name) + '"><span class="cell-main"><span class="t">' + esc(c.name) + "</span>" +
          (c.coursecount > 0 ? '<span class="s">' + c.coursecount + " insegnamenti</span>" : "") + "</span>" +
          (c.id === S.program.id ? '<span style="color:var(--accent);font-weight:700" aria-label="Selezionato">✓</span>' : "") + "</button>";
      }).join("") : st.status === "loading" ? spinnerRow() : "";
      var body = group("Attuale", labeled(S.program.name, "categoria " + S.program.id)) +
        (st.status === "error" ? noticeGroup(st.error) : "") +
        (rows ? group("Percorsi del portale", rows, "Le categorie principali di La Statale Open. Dentro ogni percorso la scheda Corsi mostra cluster e insegnamenti.") : "") +
        (S.program.id !== DEFAULT_PROGRAM.id ? group("", '<button class="cell accent-row" data-a="reset-program"><span class="t">Torna a ' + DEFAULT_PROGRAM.name + "</span></button>") : "");
      return { title: "Percorso", body: ptr() + body, ptr: true };
    }
  };

  VIEWS.corsi.results = function () {
    var q = S.courseQuery.trim().toLowerCase();
    var list = S.data.courses.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) >= 0 || (c.short || "").toLowerCase().indexOf(q) >= 0; });
    return group("", list.length ? list.map(courseRow).join("") : '<div class="cell empty">' + (S.loading ? "Caricamento…" : "Nessun corso") + "</div>");
  };

  // CategoryBrowserView
  function categoryView(id, title) {
    var url = BASE + "course/index.php?categoryid=" + id;
    var st = ensureCategory(id), body = "";
    if (st.status === "loading") body = spinnerRow();
    else if (st.status === "error") body = errorWithPortal(st.error, url, title, "Apri la pagina nel portale");
    else {
      if (st.subs.length) body += group("Cluster", st.subs.map(function (c) {
        return '<button class="cell" data-a="push" data-v="cluster" data-id="' + c.id + '" data-title="' + esc(c.name) + '"><span class="cell-main"><span class="t b">' + esc(c.name) + "</span>" +
          (c.coursecount > 0 ? '<span class="s">' + c.coursecount + " insegnamenti</span>" : "") + "</span>" + ic("chevR", ' class="chev"') + "</button>";
      }).join(""));
      if (st.courses.length) body += group("Insegnamenti", st.courses.map(courseRow).join(""));
      if (!st.subs.length && !st.courses.length) body += group("", '<div class="cell empty">Nessun contenuto in questa categoria</div>');
    }
    return { title: title, trailing: safariButton(url, title), body: body, ptr: true };
  }

  // CourseDetailView: sezioni, filtro, ricerca, errori.
  VIEWS.course.results = function (entry) {
    var st = ensureContents(entry.id);
    var portal = BASE + "course/view.php?id=" + entry.id;
    if (!st.sections) {
      if (st.status === "error") return errorWithPortal(st.error, portal, entry.title, "Apri il corso nel portale");
      return spinnerRow();
    }
    var f = entry.filter || "", q = (entry.q || "").trim().toLowerCase(), html = st.error ? errorWithPortal(st.error, portal, entry.title, "Apri il corso nel portale") : "";
    st.sections.forEach(function (s) {
      var mods = s.modules.filter(function (mo) {
        if (f && mo.kind !== f) return false;
        if (q && mo.name.toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      var showSummary = !f && !q && s.summary;
      if (!mods.length && !showSummary) return;
      html += group(esc(s.name), (showSummary ? '<div class="cell"><span class="s">' + esc(s.summary) + "</span></div>" : "") + mods.map(moduleRow).join(""));
    });
    if (!html) html = group("", '<div class="cell empty">Nessuna attività</div>');
    return html + '<p class="hint">Tieni premuta un\'attività per aprirne la pagina o segnarla come completata.</p>';
  };

  // ---------- Ponte: pezzi delle viste ----------
  function opLabel(op) {
    var name = op.label ? "«" + op.label + "»" : (op.k === "read" ? "avviso " + op.id : "attività " + op.cm);
    return op.k === "read" ? "Avviso letto: " + name : (op.v === 1 ? "Completata: " : "Da fare: ") + name;
  }
  function failures() { return readJSON(KEYS.ponteFail, []); }
  function failureCells() {
    return failures().map(function (f, i) {
      return '<div class="cell notice">' + ic("warn") + '<span class="cell-main"><span>Modifica non applicata' + (f.label ? ": «" + esc(f.label) + "»" : "") +
        (f.m ? " – " + esc(f.m) : "") + '</span></span><button class="link" data-a="fail-dismiss" data-i="' + i + '">OK</button></div>';
    }).join("");
  }
  function ponteHomeGroup() {
    if (S.mode !== "bridge" || !PB.snap) return "";
    var n = C.pendingOps(readBox()).length, age = C.staleness(PB.snap.at);
    var sub = "Dati letti " + C.relative(PB.snap.at) + (n ? " · " + n + (n === 1 ? " modifica da inviare" : " modifiche da inviare") : "");
    var auto = autoBridge(), stuck = autoStuck();
    var rows = (stuck ? '<div class="cell notice">' + ic("warn") + '<span class="cell-main"><span>L\'aggiornamento automatico non è tornato con i dati. ' +
          (autoVerified() ? "Il portale potrebbe non aver risposto o l'accesso non si è concluso: riprova." : "Controlla che in Safari l'estensione Userscripts sia consentita anche su lastataleopen.myariel.unimi.it (menu della pagina → Userscripts), poi riprova.") +
          "</span></span></div>" +
        '<button class="cell accent-row" data-a="ponte-setup">' + ic("link") + '<span class="t">Istruzioni e preferito di riserva</span></button>' : "") +
      (!stuck && autoPaused() ? '<div class="cell notice">' + ic("warn") + "<span>Aggiornamento automatico all'apertura in pausa: l'ultimo giro non è tornato con i dati. Tocca «Aggiorna dal portale» per riprovare.</span></div>" : "") +
      (awaitingPaste() ? '<button class="cell accent-row" data-a="sync-paste">' + ic("copy") + '<span class="cell-main"><span class="t">Incolla i dati copiati dal portale</span></span></button>' : "") +
      '<button class="cell accent-row" data-a="sync-now">' + ic("refresh") + '<span class="cell-main"><span class="t">Aggiorna dal portale</span><span class="s' + (age === "fresh" ? "" : " orange") + '">' + esc(sub) + "</span>" +
      (auto ? '<span class="s">' + (S.autoReturn ? "Ponte automatico: un tocco, torna da solo con i dati" : "Ponte automatico: un tocco, poi «Copia per l'app» (ritorno automatico spento)") + "</span>" : "") +
      "</span>" + ic("chevR", ' class="chev"') + "</button>" +
      (age === "old" ? '<div class="cell notice">' + ic("warn") + "<span>Dati del portale letti " + esc(C.relative(PB.snap.at)) + ": aggiorna dal portale per vedere scadenze e avvisi nuovi.</span></div>" : "") +
      S.ponte.notes.map(function (t) { return '<div class="cell notice">' + ic("warn") + "<span>" + esc(t) + "</span></div>"; }).join("") +
      failureCells();
    return group("Ponte con il portale", rows);
  }
  function ponteSection() {
    var ops = C.pendingOps(readBox());
    var rows = labeled("Dati del portale", PB.snap ? "letti " + C.relative(PB.snap.at) : "non ancora letti") +
      labeled("Ponte", "versione " + (PB.snap ? PB.snap.bv : C.PONTE.version) + (isStandalone() ? " · schermata Home" : " · Safari")) +
      labeled("Ponte automatico", autoBridge() ? (autoVerified() ? "attivo ✓" : "installato · da provare") : isStandalone() ? "solo in Safari" : "non installato") +
      (autoBridge() && S.autoReturn ? switchRow("Aggiorna da solo all'apertura", "autoSync") : "") +
      '<button class="cell accent-row" data-a="sync-now">' + ic("refresh") + '<span class="t">Aggiorna dal portale</span></button>' +
      ops.map(function (op) {
        return '<div class="cell"><span class="cell-main"><span class="t">' + esc(opLabel(op)) + '</span><span class="s">Da inviare al portale' +
          (op.tries >= 3 ? " · non riesco ad applicarla da " + op.tries + " aggiornamenti" : "") + '</span></span><button class="link" data-a="op-cancel" data-k="' + esc(C.opKey(op)) + '">Annulla</button></div>';
      }).join("") +
      failureCells() +
      (isStandalone() ? "" : switchRow("Ritorno automatico in Safari", "autoReturn")) +
      '<button class="cell accent-row" data-a="ponte-setup">' + ic("link") + '<span class="t">' + (autoBridge() ? "Preferito e ponte automatico" : "Installa il ponte automatico o il preferito") + "</span></button>" +
      extRow("Leggi il codice del ponte", appBase() + C.PONTE.file, "doc") +
      extRow("Leggi lo script del ponte automatico", appBase() + C.PONTE.userscript, "doc");
    return group("Ponte con il portale", rows,
      "Il ponte legge corsi, scadenze e avvisi solo quando tocchi il preferito «Statale Open» o, con il ponte automatico, quando tocchi «Aggiorna dal portale». " +
      (autoBridge() ? "Con «Aggiorna da solo all'apertura» l'app va al portale e torna quando la apri con dati più vecchi di un'ora. " : "") +
      "Il preferito esegue solo il file con impronta " + esc(C.PONTE.sri.slice(0, 19)) + "…: se il file cambiasse, il browser lo rifiuterebbe." +
      (isStandalone() ? "" : " Con il ritorno automatico i dati tornano all'app nell'indirizzo della scheda (Safari può tenerli nella cronologia); spento, passano dagli appunti, anche con il ponte automatico."));
  }

  // Schermata «Accesso dal portale»: il ponte automatico in quattro passaggi, ognuno con un pulsante; il preferito resta come riserva.
  function ponteHtml() {
    var code = C.bookmarklet(appBase()), standalone = isStandalone();
    var touch = /iPhone|iPad|iPod|Android/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
    function steps(list) { return '<div class="cell"><ol class="steps">' + list.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ol></div>"; }
    function text(t) { return '<div class="cell"><span class="s">' + t + "</span></div>"; }
    var auto = autoBridge(), verified = autoVerified(), first = !PB.snap && !loadSnap();
    var homeIcon = "Icona sulla schermata Home: in Safari tocca Condividi → Aggiungi alla schermata Home e spegni «Apri come app web» (iOS 26). L'icona apre l'app in Safari, dove il ponte automatico funziona; come in Safari, i dati restano se apri l'app almeno una volta ogni 7 giorni. " +
      "Un'icona aperta come app web ha un archivio suo: passando all'icona di Safari serve un aggiornamento, e le modifiche ancora da inviare vanno inviate prima dalla vecchia icona.";
    var bookmark = group("Preferito · 1 · Copia il codice",
        '<button class="cell accent-row" data-a="ponte-copy-code">' + ic("copy") + '<span class="t">' + (S.ponte.copied ? "Codice copiato ✓" : "Copia il codice") + "</span></button>" +
        '<div class="cell"><textarea class="code-box" id="ponte-code" readonly aria-label="Codice del preferito">' + esc(code) + "</textarea></div>" +
        (touch ? "" : '<div class="cell"><a class="bm-link" href="' + esc(code) + '" data-a="bm-drag" draggable="true">★ Statale Open</a><span class="s">Sul computer basta trascinare questo pulsante nella barra dei preferiti, poi passare al punto 4.</span></div>'),
        "Se la copia non parte, tieni premuto nel riquadro e scegli «Seleziona tutto» e «Copia».") +
      group("2 · Crea il preferito in Safari", steps([
        "Apri <b>Safari</b> (anche su questa pagina va bene).",
        "Tocca <b>Condividi</b> (il quadrato con la freccia) → <b>Aggiungi ai Preferiti</b>.",
        "Cambia il nome in <b>Statale Open</b> e tocca <b>Salva</b>."
      ])) +
      group("3 · Metti il codice nel preferito", steps([
        "Tocca l'icona dei <b>Segnalibri</b> (il libro) → <b>Preferiti</b> → <b>Modifica</b>.",
        "Tocca <b>Statale Open</b>, cancella l'indirizzo con ⓧ, tieni premuto nel campo → <b>Incolla</b>.",
        "Tocca <b>Fine</b> due volte."
      ])) +
      group("4 · Accedi e aggiorna", standalone
        ? text("Tocca «Aggiorna dal portale» e segui i passaggi: dalla schermata Home i dati passano dagli appunti.")
        : text("Si apre La Statale Open in questa scheda. Se serve accedi, poi tocca la barra degli indirizzi e il preferito <b>Statale Open</b>: l'app si riapre da sola con i tuoi dati."),
        standalone ? "Come app web della schermata Home servono circa 10 tocchi per aggiornare (i dati passano dagli appunti), ma i dati non scadono. In Safari con il preferito ne bastano 3, con il ponte automatico 1; lì i dati restano se apri l'app almeno una volta ogni 7 giorni."
          : "In Safari i dati restano se apri l'app almeno una volta ogni 7 giorni.") +
      '<div class="group"><button class="' + (standalone ? "btn-primary" : "btn-secondary") + '" data-a="' + (standalone ? "sync" : "sync-start") + '">' + ic(standalone ? "refresh" : "globe") +
        (standalone ? "Aggiorna dal portale" : "Apri il portale e aggiorna con il preferito") + "</button></div>";
    var bookmarkToggle = group("", '<button class="cell accent-row" data-a="ponte-bookmark" aria-expanded="' + !!S.ponte.bookmark + '">' + ic("link") +
        '<span class="cell-main"><span class="t">' + (auto ? "Preferito di riserva" : "Non vuoi installare nulla? Usa il preferito") + "</span>" +
        '<span class="s">Un preferito di Safari da toccare sulla pagina del portale: 3 tocchi a ogni aggiornamento.</span></span>' +
        ic("chevR", ' class="chev" style="transform:rotate(' + (S.ponte.bookmark ? "-90" : "90") + 'deg)"') + "</button>") +
      (S.ponte.bookmark ? bookmark : "");
    var paste = '<div class="group"><button class="btn-secondary" data-a="sync">' + ic("copy") + "Ho già i dati del ponte: incollali</button></div>";
    var body;
    if (standalone) {
      body = noticeGroup("Aperta dalla schermata Home l'app non vede le estensioni di Safari (limite di iOS), quindi il ponte automatico qui non funziona. Usa il preferito qui sotto, oppure apri l'app in Safari: lì «Accedi» e «Aggiorna dal portale» sono un tocco.") +
        noticeGroup(S.ponte.note) + bookmark + paste + '<p class="hint">' + homeIcon + "</p>";
    } else if (auto) {
      body = group("Ponte automatico", '<div class="cell"><span class="ic" style="color:var(--green)">' + checkFilled() + '</span><span class="cell-main"><span class="t b">' +
          (verified ? "Ponte automatico attivo" : "Ponte automatico installato") + "</span>" +
          '<span class="s">' + (first ? "Tocca «Accedi»: si apre la pagina ufficiale del portale, se serve accedi (Safari può compilare email e password), e l'app si riapre da sola con i tuoi dati."
            : "«Aggiorna dal portale» apre il portale, legge i dati e torna qui da solo. Se ci sono modifiche da inviare, il pannello sul portale chiede una conferma.") + "</span></span></div>") +
        noticeGroup(S.ponte.note) +
        '<div class="group"><button class="btn-primary" data-a="sync-now"' + (S.ponte.starting ? " disabled" : "") + ">" +
          (S.ponte.starting ? spinner() + "Apro il portale…" : ic(first ? "personKey" : "globe") + (first ? "Accedi" : "Aggiorna dal portale")) + "</button></div>" +
        (verified ? "" : group("Se resti sul portale", text("Se dopo l'accesso resti sulla pagina del portale senza tornare qui, su quella pagina tocca il pulsante a sinistra dell'indirizzo → <b>Userscripts</b> e consenti sempre l'accesso (meglio su tutti i siti web), poi torna qui e riprova."))) +
        bookmarkToggle + paste + '<p class="hint">' + homeIcon + "</p>";
    } else {
      body = group("", text("Per accedere dall'app serve, una volta sola, il <b>ponte automatico</b>: l'estensione gratuita Userscripts per Safari con il nostro script. Sulla pagina del portale in cui sei entrato legge corsi, scadenze e avvisi e li riporta qui. La password la scrivi solo sul portale.")) +
        noticeGroup(S.ponte.note) +
        group("1 · Installa Userscripts",
          text("App gratuita dell'App Store. Dopo l'installazione aprila una volta, poi torna qui.") +
          '<a class="cell accent-row" href="https://apps.apple.com/app/id1463298887" target="_blank" rel="noopener">' + ic("down") + '<span class="t">Apri Userscripts nell\'App Store</span></a>') +
        group("2 · Attiva l'estensione in Safari", steps([
          "Tocca il pulsante a sinistra della barra degli indirizzi (menu della pagina) → <b>Gestisci estensioni</b> e attiva <b>Userscripts</b>.",
          "Dallo stesso menu tocca <b>Userscripts</b> e consenti sempre l'accesso, su <b>tutti i siti web</b>. Non scegliere «per un giorno»."
        ]), "In alternativa: Impostazioni → App → Safari → Estensioni → Userscripts, attiva l'estensione e consenti tutti i siti web.") +
        group("3 · Installa lo script",
          text("Si apre il testo dello script, ed è normale. Su quella pagina tocca il pulsante a sinistra dell'indirizzo → <b>Userscripts</b> → <b>Tap to install</b> → <b>Install</b>. Poi torna a questa scheda.") +
          '<a class="cell accent-row" href="' + esc(appBase() + C.PONTE.userscript) + '" target="_blank" rel="noopener" data-a="script-opened">' + ic("down") + '<span class="t">Apri lo script del ponte automatico</span></a>' +
          '<button class="cell accent-row" data-a="userscript-download">' + ic("tray") + '<span class="cell-main"><span class="t">Non compare «Tap to install»? Scarica il file</span>' +
          '<span class="s">Poi in File → Download tieni premuto il file → Sposta → Sul mio iPhone → Userscripts, e apri una volta il menu di Userscripts in Safari.</span></span></button>') +
        group("4 · Controlla",
          '<button class="cell accent-row" data-a="ponte-reload">' + ic("refresh") + '<span class="t">Ho fatto: controlla</span></button>',
          "Tornando su questa scheda la pagina si ricarica da sola. Quando il ponte automatico è pronto compare il pulsante «Accedi»; se vedi ancora questi passaggi, ricontrolla il passaggio 2.") +
        bookmarkToggle + paste + '<p class="hint">' + homeIcon + "</p>";
    }
    var back = '<button class="link back" data-a="ponte-back">' + ic("chevL") + (S.ponte.from === "app" ? "Altro" : "Accesso") + "</button>";
    return '<div class="screen"><header class="nav inline"><div class="nav-row"><div class="side">' + back + '</div><div class="center">' + (S.ponte.from === "app" ? "Ponte con il portale" : "Accesso dal portale") + '</div><div class="side end"></div></div></header>' +
      '<main class="content" id="content">' + body + "</main></div>";
  }

  // Foglio «Aggiorna dal portale»: in Safari si va al portale nella stessa scheda; dalla schermata Home si passa dagli appunti.
  function syncSheetHtml() {
    var y = S.sync;
    if (!y) return "";
    var standalone = isStandalone(), box = readBox(), n = C.pendingOps(box).length;
    var enter = y.shown ? "" : " enter-up";
    y.shown = true;
    var pending = n ? group("", '<div class="cell"><span class="s">Con l\'aggiornamento partono ' + n + (n === 1 ? " modifica" : " modifiche") + " (" + esc(C.opsSummary(box)) +
      "): sul portale il ponte chiede conferma prima di applicarle.</span></div>") : "";
    var body;
    if (standalone) {
      body = group("Dalla schermata Home", '<div class="cell"><ol class="steps">' +
        "<li>Tocca <b>Copia l'indirizzo del portale</b>.</li>" +
        "<li>Apri <b>Safari</b>, tieni premuta la barra degli indirizzi e scegli <b>Incolla e vai</b>. Se serve accedi.</li>" +
        "<li>Tocca la barra degli indirizzi e il preferito <b>Statale Open</b>, poi <b>Copia per l'app</b>.</li>" +
        "<li>Torna qui e tocca <b>Incolla i dati</b>.</li></ol></div>") + pending +
        '<div class="group"><button class="btn-primary" data-a="sync-start">' + ic("copy") + (y.copied ? "Indirizzo copiato ✓" : "Copia l'indirizzo del portale") + "</button></div>" +
        (y.url ? group("Copia a mano", '<div class="cell"><textarea class="code-box" readonly aria-label="Indirizzo del portale">' + esc(y.url) + "</textarea></div>") : "");
    } else {
      body = group("", '<div class="cell"><span class="s">Si apre La Statale Open in questa scheda. Se serve accedi, poi tocca la barra degli indirizzi e il preferito <b>Statale Open</b>: ' +
        (S.autoReturn ? "l'app si riapre da sola con i dati aggiornati." : "nel pannello del ponte tocca «Copia per l'app», torna qui e tocca «Incolla i dati».") + "</span></div>") + pending +
        '<div class="group"><button class="btn-primary" data-a="sync-start">' + ic("globe") + "Apri il portale</button></div>";
    }
    body += '<div class="group"><button class="btn-secondary" data-a="sync-paste">' + ic("copy") + "Incolla i dati</button></div>" +
      (y.note ? noticeGroup(y.note) : "") +
      (y.manual
        ? group("Incolla a mano", '<div class="cell"><textarea class="paste-area" id="paste-box" data-paste="1" placeholder="Tieni premuto qui e scegli «Incolla»"></textarea></div>' +
            '<button class="cell accent-row" data-a="sync-import"><span class="t">Importa</span></button>')
        : group("", '<button class="cell accent-row" data-a="sync-manual"><span class="t">Incolla a mano</span></button>' +
            '<label class="cell accent-row"><span class="t">Scegli un file</span><input class="file-input" type="file" id="ponte-file" accept=".txt,text/plain"></label>',
            "Il file è quello di «Scarica i dati in un file» nel pannello del ponte (di solito in File → Download)."));
    return '<div class="sheet' + enter + '" role="dialog" aria-label="Aggiorna dal portale"><div class="browser">' +
      '<header class="nav inline"><div class="nav-row"><div class="side"><button class="link" data-a="sync-close">Chiudi</button></div><div class="center">Aggiorna dal portale</div><div class="side end"></div></div></header>' +
      '<main class="content">' + body + "</main></div></div>";
  }

  function credentialsSection() {
    return group("Credenziali",
      '<div class="cell"><input class="field" id="cred-email" data-field="email" type="email" autocomplete="username" placeholder="Email di Ateneo" value="' + esc(S.email) + '"></div>' +
      '<button class="cell accent-row" data-a="save-email"><span class="t" id="save-email-label">' + (S.emailSaved ? "Salvata ✓" : "Salva email") + "</span></button>" +
      '<button class="cell destructive" data-a="remove-creds"><span class="t">Rimuovi credenziali</span></button>',
      "L'email serve a precompilare l'accesso. La password non viene mai salvata: il browser non ha un Portachiavi sicuro come l'iPhone, quindi la reinserisci quando la sessione scade.");
  }
  function remindersSection() {
    var planned = C.plannedReminders(S.data.events).length;
    return group("Notifiche",
      switchRow("Promemoria scadenze e nuovi avvisi", "reminders") +
      '<button class="cell accent-row" data-a="export-ics"' + (S.reminders ? "" : " disabled") + '><span class="t">Aggiungi le scadenze al Calendario</span></button>' +
      '<button class="cell accent-row" data-a="test-notif"><span class="t">Invia notifica di prova</span></button>',
      "L'app iPhone programma da sola un promemoria 24 ore e 2 ore prima di ogni scadenza (" + planned + " ora). Il browser non può farlo a app chiusa: " +
      "aggiungi le scadenze al Calendario e ognuna avrà gli stessi due avvisi. Ripetilo quando cambiano." + (isStandalone() || EMBEDDED ? "" : " Per badge e notifiche aggiungi l'app alla schermata Home."));
  }
  function aboutSection() {
    var u = S.update;
    return group("Informazioni",
      labeled("Versione", APP.version + " · app web") +
      (u.available ? extRow("Scarica la versione " + u.available.version, u.available.url, "down") : "") +
      '<button class="cell accent-row" data-a="check-update"' + (u.checking ? " disabled" : "") + '><span class="t">Controlla aggiornamenti</span><span class="cell-main"></span>' + (u.checking ? spinner() : "") + "</button>" +
      extRow("Guida all'installazione", REPO_URL + "/blob/main/docs/INSTALLAZIONE.md") +
      extRow("Novità delle versioni", REPO_URL + "/releases") +
      extRow("Segnala un problema", issueURL("bug_report.yml")) +
      extRow("Proponi un miglioramento", issueURL("feature_request.yml")) +
      '<button class="cell accent-row" data-a="copy-diag"><span class="t">' + (S.copied ? "Copiate ✓" : "Copia le informazioni per la segnalazione") + "</span></button>" +
      extRow("Privacy", REPO_URL + "/blob/main/PRIVACY.md"),
      (u.result ? "<span>" + esc(u.result) + "</span>" : "") +
      (!EMBEDDED && !isStandalone() ? "<span>Per averla sulla schermata Home: in Safari tocca Condividi → Aggiungi alla schermata Home. Con il ponte automatico spegni «Apri come app web»: l'icona apre l'app in Safari, dove l'estensione funziona.</span>" : "") +
      "<span>" + esc(DISCLAIMER) + "</span>");
  }
  function demoSection() {
    var badge = S.reminders && (EMBEDDED ? S.demoNotifAuth : true) ? S.data.unread : 0;
    function select(key, options) {
      return '<select class="pick" data-demo-select="' + key + '" aria-label="' + key + '">' + options.map(function (o) {
        return '<option value="' + o[0] + '"' + (S.demo[key] === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
      }).join("") + "</select>";
    }
    return group("Solo nella demo",
      '<div class="cell"><span class="home-icon"><img src="' + esc(ICON) + '" alt="Icona di Statale Open">' + (badge ? '<span class="badge">' + badge + "</span>" : "") + "Statale Open</span>" +
      '<span class="cell-main"><span class="s">Icona sulla schermata Home con il badge degli avvisi non letti.</span></span></div>' +
      switchRow("Portale non raggiungibile", "offline", "demo") +
      switchRow("Sessione scaduta al prossimo aggiornamento", "expireNext", "demo") +
      (EMBEDDED ? '<div class="cell"><span class="t">Risposta di GitHub</span><span class="cell-main"></span>' + select("github", [["new", "Nuova 1.3.0"], ["latest", "Ultima versione"], ["private", "Repository privato"]]) + "</div>" : "") +
      '<button class="cell accent-row" data-a="demo-reminder"><span class="t">Mostra il prossimo promemoria</span></button>' +
      '<button class="cell accent-row" data-a="demo-new-notif"><span class="t">Simula un nuovo avviso</span></button>' +
      '<button class="cell accent-row" data-a="reset-demo"><span class="t">Ripristina i dati di esempio</span></button>',
      "Servono a provare i casi che dipendono dal portale: rete assente, sessione scaduta, nuovi avvisi. Tira giù una lista o tocca ↻ per aggiornare.");
  }

  // ---------- Accesso ----------
  function loginHtml() {
    var L = S.login, body;
    var brand = '<div class="brand">' + ic("cap") + "<h2>La Statale Open</h2><p>Percorso " + esc(S.program.name) + " · lezioni, esercizi, e-tivity e scadenze in un'app.</p><p class=\"small\">" + esc(SHORT_DISCLAIMER) + "</p></div>";
    var demoButton = '<div class="group"><button class="btn-secondary" data-a="start-demo">' + ic("grid") + "Prova con i dati di esempio</button></div>";
    if (EMBEDDED) {
      body = brand + noticeGroup(S.notice) +
        group("Dati veri", '<div class="cell"><span class="s">Qui dentro Claude la pagina non può collegarsi al portale. Per i tuoi corsi, le scadenze e gli avvisi apri l\'app web: è la stessa app, collegata al portale.</span></div>' +
          extRow("Apri l'app web", APP.webURL, "globe")) +
        '<div class="group"><button class="btn-primary" data-a="start-demo">' + ic("grid") + "Prova con i dati di esempio</button></div>";
    } else {
      var seg = '<div class="seg method" role="tablist">' +
        '<button role="tab" aria-selected="' + (L.method === "password") + '" class="' + (L.method === "password" ? "on" : "") + '" data-a="login-method" data-k="password">Email e password</button>' +
        '<button role="tab" aria-selected="' + (L.method === "key") + '" class="' + (L.method === "key" ? "on" : "") + '" data-a="login-method" data-k="key">Chiave dell\'app</button></div>';
      var form = L.method === "password"
        ? group("Credenziali di Ateneo",
            '<div class="cell"><input class="field" id="login-user" data-login="user" type="email" autocomplete="username" placeholder="nome.cognome@studenti.unimi.it" value="' + esc(L.user) + '"></div>' +
            '<div class="cell"><input class="field" id="login-pass" data-login="pass" type="password" autocomplete="current-password" placeholder="Password" value="' + esc(L.pass) + '"></div>',
            "La password va solo al portale dell'Ateneo per ottenere la chiave dell'app, come fa l'app Moodle ufficiale, e non viene salvata.")
        : group("Chiave dell'app",
            '<div class="cell"><input class="field code" id="login-key" data-login="key" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="32 caratteri" value="' + esc(L.key) + '"></div>' +
            extRow("Apri le chiavi di sicurezza nel portale", BASE + "user/managetoken.php", "key"),
            "Se il portale non accetta la password dalle app (accesso solo con il login di Ateneo): entra nel portale, apri Preferenze → Chiavi di sicurezza e copia la chiave del servizio \"Moodle mobile web service\". Se non c'è, usa la modalità web.");
      // Email e password o chiave dell'app solo se il portale ha i servizi per app attivi (controllo automatico).
      var services = !!(L.diag && L.diag.ok);
      var auto = autoBridge(), standalone = isStandalone(), starting = !!S.ponte.starting;
      var how = auto
        ? "Si apre la pagina ufficiale del portale: se serve, accedi con l'email @studenti.unimi.it e la password della posta di Ateneo (Safari può compilarle da solo). Poi torni qui con corsi, scadenze e avvisi, e per aggiornarli basta un tocco."
        : standalone
        ? "Aperta dalla schermata Home l'app non può usare le estensioni di Safari: tocca «Accedi» per i passaggi con il preferito, oppure apri l'app in Safari."
        : "Una volta sola serve l'estensione gratuita Userscripts per Safari: tocca «Accedi» e segui i passaggi (un paio di minuti). Dopo, «Accedi» apre la pagina ufficiale del portale e ti riporta qui con i tuoi dati.";
      body = brand + noticeGroup(S.notice) +
        group("", '<div class="cell"><span class="s">' + esc(how) + "</span></div>",
          "La password la scrivi solo sulla pagina del portale: l'app non la vede e non la salva.") +
        '<div class="group"><button class="btn-primary" data-a="login-portal"' + (starting ? " disabled" : "") + ">" +
          (starting ? spinner() + "Apro il portale…" : ic("personKey") + "Accedi") + "</button></div>" +
        (services ? group("Il portale accetta anche l'accesso dalle app", '<div class="cell"><span class="s">' + esc(L.diag.text) + "</span></div>") + seg + form +
          (L.error ? noticeGroup(L.error) : "") +
          '<div class="group"><button class="btn-secondary" data-a="login"' + (L.busy ? " disabled" : "") + ">" + (L.busy ? spinner() + "Accesso in corso…" : ic("key") + "Accedi con le credenziali") + "</button></div>" : "") +
        group("", '<button class="cell accent-row" data-a="web-mode">' + ic("globe") + '<span class="t">Usa la modalità web</span></button>',
          "La modalità web apre direttamente le pagine del portale, senza schede native.") +
        demoButton;
    }
    return '<div class="screen"><header class="nav"><div class="nav-row"><span></span></div><h1>Accesso</h1></header><div class="login">' + body + "</div></div>";
  }

  // ---------- Modalità web (WebOnlyTabView) ----------
  var WEB_TABS = [{ key: "home", label: "Home", icon: "house" }, { key: "corsi", label: "Corsi", icon: "books" }, { key: "scadenze", label: "Scadenze", icon: "calclock" }, { key: "altro", label: "Altro", icon: "gear" }];
  function webHtml() {
    var inner;
    if (S.webTab === "altro") {
      inner = '<div class="screen"><header class="nav"><div class="nav-row"><span></span></div><h1>Altro</h1></header><main class="content" id="content">' +
        group("", '<div class="cell"><span class="s">Stai usando la modalità web: il portale non ha concesso l\'accesso tramite i servizi per app mobile.</span></div>' +
          '<button class="cell accent-row" data-a="logout"><span class="t">Riprova il collegamento</span></button>') +
        credentialsSection() + aboutSection() +
        group("", '<button class="cell destructive centered" data-a="logout"><span class="t">Esci</span></button>') + "</main></div>";
    } else {
      var t = S.webTab === "home" ? { title: "Home", url: BASE + "my/", label: "Apri la dashboard" }
        : S.webTab === "corsi" ? { title: "Percorso " + S.program.name, url: BASE + "course/index.php?categoryid=" + S.program.id, label: "Apri il percorso" }
        : { title: "Scadenze", url: BASE + "calendar/view.php?view=upcoming", label: "Apri il calendario" };
      inner = '<div class="screen"><header class="nav"><div class="nav-row"><span></span></div><h1>' + esc(t.title) + '</h1></header><main class="content" id="content"><div class="launch">' +
        "<p>Nell'app iPhone questa scheda mostra la pagina del portale al suo interno. Il portale non si lascia incorporare nelle app web, quindi si apre in una nuova scheda di Safari, già con il tuo accesso se sei entrato lì.</p>" +
        '<button class="btn-primary" data-a="open" data-url="' + esc(t.url) + '" data-title="' + esc(t.title) + '">' + ic("globe") + esc(t.label) + "</button></div></main></div>";
    }
    var tabbar = '<nav class="tabbar">' + WEB_TABS.map(function (t) {
      return '<button class="tab' + (S.webTab === t.key ? " on" : "") + '" style="width:25%" data-a="web-tab" data-tab="' + t.key + '" aria-label="' + t.label + '">' + ic(t.icon) + t.label + "</button>";
    }).join("") + "</nav>";
    return inner + tabbar + sheetHtml();
  }

  // ---------- Browser interno simulato (solo dati di esempio) ----------
  function openDemoBrowser(url, title) {
    if (url.indexOf("pluginfile.php") >= 0) { S.ql = { name: decodeURIComponent(url.split("?")[0].split("/").pop()) }; render(); return; }
    S.sheet = { hist: [url], i: 0, title: title || "La Statale Open", seq: 0, error: S.demo.offline ? MSG.offline : null };
    S.menu = false; render();
  }
  function demoNavigate(url) {
    var b = S.sheet;
    if (url.indexOf("pluginfile.php") >= 0) { S.ql = { name: decodeURIComponent(url.split("?")[0].split("/").pop()) }; return; }
    b.hist = b.hist.slice(0, b.i + 1); b.hist.push(url); b.i += 1; b.seq += 1; b.playing = null;
    b.error = S.demo.offline ? MSG.offline : null;
  }
  function demoPage(url, b) {
    var u; try { u = new URL(url); } catch (e) { u = null; }
    var note = '<p class="mood-note">Pagina simulata. Con il portale vero l\'app iPhone la mostra qui già autenticata; l\'app web la apre in una nuova scheda.</p>';
    function wrap(inner) { return '<div class="mood-head">' + ic("cap") + 'La Statale Open</div><div class="mood-body">' + inner + note + "</div>"; }
    function nav(label, target, cls) { return '<button class="' + (cls || "mood-link") + '" data-a="nav" data-url="' + esc(target) + '">' + esc(label) + "</button>"; }
    if (!u || u.host !== C.MOODLE_HOST) {
      return '<div class="mood-body" style="padding-top:22px"><h2>' + esc(u ? u.host : url) + '</h2><p>Sito esterno aperto dal corso.</p><p class="mood-note">La demo non carica i siti esterni: tocca … → Apri in Safari.</p></div>';
    }
    var p = u.pathname, q = u.searchParams, id = Number(q.get("id")), mo = id ? Demo.moduleById(id) : null;
    var evs = Demo.eventList().filter(function (e) { return e.t > Date.now(); });
    if (p.indexOf("/my/") === 0) {
      return wrap("<h2>Dashboard</h2><h3>Panoramica dei corsi</h3>" + Demo.myCourses().map(function (c) { return nav(c.name, BASE + "course/view.php?id=" + c.id); }).join("") +
        "<h3>Eventi imminenti</h3>" + evs.slice(0, 3).map(function (e) { return nav(e.name + " · " + fmtShort.format(e.t), e.url); }).join(""));
    }
    if (p.indexOf("/course/view.php") === 0) {
      var c = Demo.course(id);
      if (!c) return wrap("<h2>Corso non trovato</h2>");
      if (!c.enrolled) return wrap("<h2>" + esc(c.name) + "</h2><p>Non sei iscritto a questo corso.</p>");
      return wrap("<h2>" + esc(c.name) + "</h2>" + Demo.sectionsOf(c.id).map(function (s) {
        return "<h3>" + esc(s.name) + "</h3>" + s.modules.filter(function (m) { return m.mod !== "label"; }).map(function (m) {
          return nav(m.name, m.mod === "resource" ? m.contents[0].fileurl : m.url);
        }).join("");
      }).join(""));
    }
    if (p.indexOf("/course/index.php") === 0) {
      var cid = Number(q.get("categoryid")), cat = Demo.category(cid);
      if (!cat) return wrap("<h2>Categoria</h2>");
      return wrap("<h2>" + esc(cat.name) + "</h2>" + Demo.subcategories(cid).map(function (x) { return nav("📁 " + x.name, BASE + "course/index.php?categoryid=" + x.id); }).join("") +
        Demo.coursesIn(cid).map(function (x) { return nav(x.name, BASE + "course/view.php?id=" + x.id); }).join(""));
    }
    if (p.indexOf("/mod/assign/") === 0 && mo) {
      var sub = Demo.submission(mo.id), due = (Demo.eventList().filter(function (e) { return e.name === mo.name && e.courseId === mo.courseId; })[0] || {}).t;
      if (q.get("action") === "editsubmission") {
        return wrap("<h2>" + esc(mo.name) + "</h2><p>Carica il file della consegna (foto, PDF o documento).</p>" +
          '<input class="mood-input" type="file" id="assign-file" accept="image/*,application/pdf,.doc,.docx">' +
          (pendingFile ? "<p>File scelto: <b>" + esc(pendingFile) + "</b></p>" : "") +
          '<button class="mood-btn" data-a="assign-save" data-id="' + mo.id + '">Salva modifiche</button>' + nav("Annulla", BASE + "mod/assign/view.php?id=" + mo.id, "mood-btn sec"));
      }
      return wrap("<h2>" + esc(mo.name) + '</h2><div class="mood-card"><b>Stato consegna</b><span>' + (sub ? "Consegnato per la valutazione · " + esc(sub) : "Nessun tentativo") + "</span>" +
        (due ? "<span>Scadenza: " + esc(fmtEvent.format(due)) + "</span>" : "") + "</div>" +
        nav(sub ? "Modifica consegna" : "Aggiungi consegna", BASE + "mod/assign/view.php?id=" + mo.id + "&action=editsubmission", "mood-btn"));
    }
    if (p.indexOf("/mod/quiz/") === 0 && mo) {
      if (p.indexOf("attempt.php") > 0) {
        return wrap("<h2>" + esc(mo.name) + " · domanda 1 di 1</h2><p>Quale principio descrive meglio la difesa in profondità?</p>" +
          ["Un solo controllo molto robusto", "Più livelli di protezione indipendenti", "Nascondere il codice sorgente"].map(function (t, i) {
            return '<label style="display:flex;gap:8px;align-items:center"><input type="radio" name="q1" value="' + i + '">' + esc(t) + "</label>";
          }).join("") + '<button class="mood-btn" data-a="quiz-finish" data-id="' + mo.id + '">Termina il tentativo</button>');
      }
      if (p.indexOf("review.php") > 0) return wrap("<h2>" + esc(mo.name) + '</h2><div class="mood-card"><b>Tentativo completato</b><span>Valutazione: 1,00 su 1,00 (100%)</span></div>' + nav("Torna al quiz", BASE + "mod/quiz/view.php?id=" + mo.id));
      return wrap("<h2>" + esc(mo.name) + "</h2><p>Tentativi consentiti: 2 · Metodo di valutazione: voto più alto.</p>" + nav("Inizia il tentativo", BASE + "mod/quiz/attempt.php?id=" + mo.id, "mood-btn"));
    }
    if (p.indexOf("/mod/kalvidres/") === 0 && mo) {
      var playing = b.playing === mo.id;
      return wrap("<h2>" + esc(mo.name) + '</h2><button class="video" data-a="video" data-id="' + mo.id + '">' + ic(playing ? "video" : "playBig") +
        (playing ? "In riproduzione nella pagina" : "Tocca per avviare il video") + "</button><p>Durata 18 min · trascrizione sotto il video.</p>");
    }
    if (p.indexOf("/mod/forum/") === 0) {
      if (p.indexOf("discuss.php") > 0) return wrap('<h2>Discussione</h2><div class="mood-card"><b>Docente del corso</b><p>Il calendario delle sessioni live è nella sezione Benvenuti. Le registrazioni compaiono entro 48 ore.</p></div>' +
        '<textarea class="mood-input" rows="3" placeholder="Scrivi una risposta…" aria-label="Risposta"></textarea><button class="mood-btn" data-a="page-alert" data-msg="Risposta pubblicata (demo).">Rispondi</button>');
      return wrap("<h2>" + esc(mo ? mo.name : "Forum") + "</h2>" + nav("Calendario delle sessioni live", BASE + "mod/forum/discuss.php?d=101") + nav("Presentazioni", BASE + "mod/forum/discuss.php?d=88"));
    }
    if (p.indexOf("/mod/page/") === 0) return wrap("<h2>" + esc(mo ? mo.name : "Pagina") + "</h2><p>Obiettivi, programma, materiali e modalità d'esame.</p><p>Le e-tivity si svolgono in gruppo e vanno consegnate entro le scadenze del calendario.</p>");
    if (p.indexOf("/mod/folder/") === 0) {
      return wrap("<h2>" + esc(mo ? mo.name : "Cartella") + "</h2>" + ["Articolo-introduttivo.pdf", "Linee-guida-esercitazioni.pdf"].map(function (f, i) {
        return nav("📄 " + f, BASE + "webservice/pluginfile.php/" + (id * 10 + i) + "/mod_folder/content/0/" + f);
      }).join(""));
    }
    if (p.indexOf("/calendar/") === 0) return wrap("<h2>Eventi imminenti</h2>" + evs.map(function (e) {
      return '<div class="mood-card"><b>' + esc(e.name) + "</b><span>" + esc(e.courseName) + "</span><span>" + esc(fmtEvent.format(e.t)) + "</span>" + nav("Vai all'attività", e.url) + "</div>";
    }).join(""));
    if (p.indexOf("/grade/") === 0) return wrap('<h2>Valutazioni</h2><table class="mood-table"><tr><th>Corso</th><th>Voto</th></tr>' + Demo.myCourses().map(function (c, i) {
      return "<tr><td>" + esc(c.name) + "</td><td>" + (i % 2 ? "-" : (27 + i) + "/30") + "</td></tr>";
    }).join("") + "</table>");
    if (p.indexOf("/user/profile.php") === 0) return wrap("<h2>Studente demo</h2><p>nome.cognome@studenti.unimi.it</p>");
    if (p.indexOf("/user/managetoken.php") === 0) return wrap("<h2>Chiavi di sicurezza</h2><p>Qui il portale vero mostra le chiavi dei servizi, tra cui \"Moodle mobile web service\".</p>");
    if (p.indexOf("/message/") === 0) return wrap('<h2>Messaggi</h2><div class="mood-card"><b>Tutor del percorso</b><span>Ricordati la e-tivity 2 entro la scadenza.</span></div>');
    return wrap("<h2>" + esc(b.title) + "</h2><p>" + esc(p) + "</p>");
  }
  function sheetHtml() {
    var b = S.sheet;
    if (!b) return "";
    var url = b.hist[b.i];
    var loading = b.drawnSeq !== b.seq;
    b.drawnSeq = b.seq;
    var enter = b.shown ? "" : " enter-up";
    b.shown = true;
    var menu = S.menu ? '<div class="menu" role="menu">' +
      '<a class="cell" role="menuitem" href="' + esc(C.sanitizedForSharing(url)) + '" target="_blank" rel="noopener" data-a="menu-close">Apri in Safari' + ic("compass") + "</a>" +
      '<button class="cell" role="menuitem" data-a="menu-item" data-k="share">Condividi link' + ic("share") + "</button>" +
      '<button class="cell" role="menuitem" data-a="menu-item" data-k="copy">Copia link' + ic("copy") + "</button></div>" : "";
    return '<div class="sheet' + enter + '" role="dialog" aria-label="' + esc(b.title) + '"><div class="browser">' +
      '<header class="nav inline"><div class="nav-row"><div class="side"><button class="link" data-a="sheet-close">Chiudi</button></div><div class="center">' + esc(b.title) +
      '</div><div class="side end"><button class="link" aria-label="Altre azioni" data-a="browser-menu">' + ic("ellipsis") + "</button></div></div></header>" +
      '<div class="loadbar' + (loading ? " go" : "") + '"></div><div class="page">' + demoPage(url, b) + "</div>" +
      (b.error ? '<button class="err-pill" data-a="browser-error">' + esc(b.error) + "</button>" : "") +
      '<div class="toolbar"><button aria-label="Indietro" data-a="browser-back"' + (b.i > 0 ? "" : " disabled") + ">" + ic("chevL") + "</button>" +
      '<button aria-label="Avanti" data-a="browser-forward"' + (b.i < b.hist.length - 1 ? "" : " disabled") + ">" + ic("chevR") + "</button>" +
      '<span class="spacer"></span><button aria-label="Ricarica" data-a="browser-reload">' + ic("refresh") + "</button></div>" + menu + "</div></div>";
  }

  // ---------- Overlay ----------
  var alertActions = [];
  var pendingFile = null;
  function showAlert(title, message, buttons) {
    alertActions = buttons.map(function (b) { return b.act || null; });
    S.alert = { title: title, message: message, buttons: buttons.map(function (b) { return { label: b.label, role: b.role || "" }; }) };
    render();
  }
  function overlaysHtml() {
    var out = syncSheetHtml();
    if (S.ql) {
      var qlEnter = S.ql.shown ? "" : " enter-up"; S.ql.shown = true;
      out += '<div class="ql' + qlEnter + '" role="dialog" aria-label="Anteprima"><header class="nav inline"><div class="nav-row"><div class="side"><button class="link" data-a="ql-close">Fine</button></div><div class="center">' + esc(S.ql.name) +
        '</div><div class="side end"><button class="link" aria-label="Condividi" data-a="ql-share">' + ic("share") + '</button></div></div></header><div class="ql-pages">' +
        [1, 2].map(function (n) { return '<div class="ql-page"><b>' + esc(S.ql.name.replace(/\.pdf$/, "")) + " · pagina " + n + '</b><i></i><i style="width:80%"></i><i></i><i style="width:60%"></i><i></i><i style="width:90%"></i></div>'; }).join("") + "</div></div>";
    }
    if (S.ctx) {
      var mo = findModule(S.ctx.courseId, S.ctx.id);
      if (mo) {
        out += '<div class="ctx" data-a="ctx-close"><div class="preview">' + moduleRow(mo).replace('data-a="module"', 'data-a="ctx-noop"').replace(/ data-long="\d+"/, "") + '</div><div class="items" role="menu">' +
          (mo.url ? '<button class="cell" role="menuitem" data-a="ctx-open">Apri pagina dell\'attività' + ic("globe") + "</button>" : "") +
          (mo.completion === 1 ? '<button class="cell" role="menuitem" data-a="ctx-toggle">' + (mo.done ? "Segna come da fare" + ic("circle") : "Segna come completata" + ic("calcheck")) + "</button>" : "") +
          "</div></div>";
      }
    }
    if (S.alert) {
      out += '<div class="scrim"><div class="alert" role="alertdialog" aria-label="' + esc(S.alert.title || S.alert.message) + '"><div class="body">' + (S.alert.title ? '<div class="title">' + esc(S.alert.title) + "</div>" : "") +
        (S.alert.message ? '<div class="msg">' + esc(S.alert.message) + "</div>" : "") + "</div>" +
        S.alert.buttons.map(function (b, i) { return '<button class="' + b.role + '" data-a="alert" data-i="' + i + '">' + esc(b.label) + "</button>"; }).join("") + "</div></div>";
    }
    if (S.banner) {
      var bEnter = S.banner.shown ? "" : " enter-drop"; S.banner.shown = true;
      out += '<div class="banner' + bEnter + '" role="status"><img class="app-ic" src="' + esc(ICON) + '" alt=""><span class="cell-main"><span class="s" style="font-size:12px">STATALE OPEN · adesso</span><span class="t b" style="font-size:15px">' + esc(S.banner.title) +
        '</span><span class="s" style="font-size:14px;color:var(--fg)">' + esc(S.banner.body) + "</span></span></div>";
    }
    if (S.toast) out += '<div class="toast" role="status">' + esc(S.toast) + "</div>";
    return out;
  }

  // ---------- Disegno ----------
  var device = document.getElementById("device");
  var TABS = [{ key: "home", label: "Home", icon: "house" }, { key: "corsi", label: "Corsi", icon: "books" }, { key: "scadenze", label: "Scadenze", icon: "calclock" }, { key: "avvisi", label: "Avvisi", icon: "bell" }, { key: "altro", label: "Altro", icon: "gear" }];
  var scrollMemory = {};
  function titleOf(entry) { return entry.title || { home: "Home", corsi: "Corsi", scadenze: "Scadenze", avvisi: "Avvisi", altro: "Altro" }[entry.v]; }
  function current() { var st = S.stacks[S.tab]; return st[st.length - 1]; }

  function appHtml() {
    var st = S.stacks[S.tab], entry = st[st.length - 1];
    var view = VIEWS[entry.v](entry), nav;
    if (st.length > 1) {
      nav = '<header class="nav inline"><div class="nav-row"><div class="side"><button class="link back" data-a="back">' + ic("chevL") + esc(titleOf(st[st.length - 2])) + "</button></div>" +
        '<div class="center">' + esc(view.title) + '</div><div class="side end">' + (view.trailing || "") + "</div></div></header>";
    } else {
      nav = '<header class="nav"><div class="nav-row"><span></span><div class="side end">' + (view.trailing || "") + "</div></div><h1>" + esc(view.title) + "</h1></header>";
    }
    var seg = view.seg ? '<div class="seg-bar"><div class="seg" role="tablist">' +
      '<button role="tab" aria-selected="' + (S.scope === "mine") + '" class="' + (S.scope === "mine" ? "on" : "") + '" data-a="scope" data-scope="mine">I miei corsi</button>' +
      '<button role="tab" aria-selected="' + (S.scope === "program") + '" class="' + (S.scope === "program" ? "on" : "") + '" data-a="scope" data-scope="program">Percorso ' + esc(S.program.name) + "</button></div></div>" : "";
    var tabbar = '<nav class="tabbar">' + TABS.map(function (t) {
      var badge = t.key === "avvisi" && S.data.unread ? '<span class="badge">' + S.data.unread + "</span>" : "";
      return '<button class="tab' + (S.tab === t.key ? " on" : "") + '" data-a="tab" data-tab="' + t.key + '" aria-label="' + t.label + '">' + ic(t.icon) + t.label + badge + "</button>";
    }).join("") + "</nav>";
    return { html: '<div class="screen">' + nav + seg + '<main class="content" id="content">' + view.body + "</main></div>" + tabbar + sheetHtml(), view: view,
      key: S.tab + ":" + st.map(function (e) { return e.v + (e.id || ""); }).join("/") + (entry.v === "corsi" ? ":" + S.scope : "") };
  }

  function render() {
    var content = device.querySelector("#content");
    if (content && device.dataset.key) scrollMemory[device.dataset.key] = content.scrollTop;
    var pageEl = device.querySelector(".page"), pageScroll = pageEl ? pageEl.scrollTop : 0;
    var focused = document.activeElement && device.contains(document.activeElement) ? document.activeElement : null;
    var focusedId = focused && focused.id, caret = null;
    try { caret = focused && focused.selectionStart; } catch (e) { caret = null; }

    var inner = "", key = "", view = null;
    if (S.phase === "checking") inner = '<div class="checking">' + spinner() + "Connessione al portale…</div>";
    else if (S.phase === "login") { probeServices(); inner = loginHtml(); key = "login"; }
    else if (S.phase === "web") { inner = webHtml(); key = "web:" + S.webTab; }
    else if (S.phase === "ponte") { inner = ponteHtml(); key = "ponte"; }
    else { var a = appHtml(); inner = a.html; key = a.key; view = a.view; }

    device.innerHTML = (S.mode === "demo" && S.phase !== "login" ? '<div class="demo-strip">Dati di esempio · v' + APP.version + "</div>" : "") + inner + overlaysHtml();
    device.dataset.key = key;
    var c2 = device.querySelector("#content");
    if (c2 && scrollMemory[key]) c2.scrollTop = scrollMemory[key];
    var p2 = device.querySelector(".page");
    if (p2 && pageScroll) p2.scrollTop = pageScroll;
    if (view && view.ptr && c2) attachPull(c2);
    if (view && view.swipe) attachSwipes();
    attachLongPress();
    if (focusedId) {
      var el = document.getElementById(focusedId);
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
        el.focus();
        if (caret != null) { try { el.setSelectionRange(caret, caret); } catch (e) { /* campo senza selezione */ } }
      }
    }
  }

  // ---------- Gesti: tira per aggiornare, tieni premuto, scorri ----------
  function attachPull(el) {
    var startY = null, pulled = 0, ptrEl = document.getElementById("ptr");
    el.addEventListener("touchstart", function (e) { startY = el.scrollTop <= 0 ? e.touches[0].clientY : null; pulled = 0; }, { passive: true });
    el.addEventListener("touchmove", function (e) {
      if (startY === null || S.loading || !ptrEl) return;
      pulled = e.touches[0].clientY - startY;
      ptrEl.style.height = Math.max(0, Math.min(56, pulled * 0.45)) + "px";
    }, { passive: true });
    el.addEventListener("touchend", function () {
      if (ptrEl) ptrEl.style.height = "";
      if (startY !== null && pulled > 110) pullRefresh();
      startY = null; pulled = 0;
    });
  }
  // .refreshable delle viste: ricarica l'elenco della schermata.
  function pullRefresh() {
    if (S.mode === "bridge") { syncNow(); return; }
    var entry = current();
    if (entry.v === "course") { S.contents[entry.id] = Object.assign({}, S.contents[entry.id], { status: "reload" }); render(); return; }
    if (entry.v === "cluster") { delete S.cats[entry.id]; render(); return; }
    if (entry.v === "corsi" && S.scope === "program") { delete S.cats[S.program.id]; render(); return; }
    if (entry.v === "program") { S.programList = null; render(); return; }
    if (entry.v === "avvisi") { refreshNotifications().then(render); return; }
    refreshAll();
  }
  var suppressClick = false;
  function attachLongPress() {
    device.querySelectorAll("[data-long]").forEach(function (el) {
      var timer = null, sx = 0, sy = 0;
      el.addEventListener("pointerdown", function (e) {
        sx = e.clientX; sy = e.clientY;
        timer = setTimeout(function () {
          suppressClick = true;
          setTimeout(function () { suppressClick = false; }, 700);
          openContext(el);
        }, 480);
      });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { el.addEventListener(t, function () { clearTimeout(timer); }); });
      el.addEventListener("pointermove", function (e) { if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) clearTimeout(timer); });
      el.addEventListener("contextmenu", function (e) { e.preventDefault(); clearTimeout(timer); openContext(el); });
    });
  }
  function openContext(el) {
    if (navigator.vibrate) { try { navigator.vibrate(10); } catch (e) { /* non supportato */ } }
    S.ctx = { id: Number(el.dataset.long), courseId: Number(el.dataset.c) };
    render();
  }
  function attachSwipes() {
    device.querySelectorAll("[data-swipe]").forEach(function (row) {
      var sx = null, sy = 0;
      row.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      row.addEventListener("touchend", function (e) {
        if (sx === null) return;
        var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          suppressClick = true;
          setTimeout(function () { suppressClick = false; }, 350);
          device.querySelectorAll(".swipe.open").forEach(function (r) { if (r !== row) r.classList.remove("open"); });
          if (row.querySelector(".swipe-action")) row.classList.toggle("open", dx < 0);
        }
        sx = null;
      });
    });
  }

  // ---------- Messaggi temporanei ----------
  var toastTimer = null, bannerTimer = null;
  function toast(msg) {
    S.toast = msg; render();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { S.toast = null; render(); }, 3000);
  }
  function banner(title, body) {
    S.banner = { title: title, body: body }; render();
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { S.banner = null; render(); }, 4000);
  }
  function copyText(text, done) {
    try { navigator.clipboard.writeText(text).then(done, function () { done(); toast("Copia non consentita qui"); }); } catch (e) { done(); }
  }
  // Copia negli appunti dentro il tocco; se il browser la rifiuta prova il vecchio metodo. Risolve con true se è riuscita.
  function copyTextOk(text) {
    function legacy() {
      var area = document.createElement("textarea");
      area.value = text; area.setAttribute("readonly", "");
      area.style.position = "fixed"; area.style.top = "0"; area.style.opacity = "0";
      document.body.appendChild(area);
      area.focus(); area.select();
      try { area.setSelectionRange(0, text.length); } catch (e) { /* selezione non disponibile */ }
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      area.remove();
      return ok;
    }
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, legacy);
    } catch (e) { /* appunti non disponibili */ }
    return Promise.resolve(legacy());
  }

  // ---------- Tocchi ----------
  device.addEventListener("click", function (ev) {
    if (suppressClick) { suppressClick = false; ev.preventDefault(); return; }
    var el = ev.target.closest("[data-a]");
    if (!el || !device.contains(el)) { if (S.menu) { S.menu = false; render(); } return; }
    var a = el.dataset.a, st = S.stacks[S.tab], mo, b = S.sheet;
    if (S.menu && a !== "menu-item" && a !== "browser-menu" && a !== "menu-close") S.menu = false;
    switch (a) {
      // Accesso
      case "login": if (S.login.method === "key") loginWithKey(); else loginWithPassword(); break;
      case "login-method": S.login.method = el.dataset.k; S.login.error = null; render(); break;
      case "login-portal": loginViaPortal(); break;
      case "web-mode": useWebMode(); break;
      case "start-demo": startDemo(); break;
      // Ponte con il portale
      case "ponte-setup": startPonteSetup(S.phase === "app" ? "app" : "login"); break;
      case "ponte-back": leavePonteSetup(); break;
      case "ponte-bookmark": S.ponte.bookmark = !S.ponte.bookmark; savePhase(); render(); break;
      // Il link apre lo script in un'altra scheda: tornando qui la pagina si ricarica da sola per vedere l'estensione.
      case "script-opened": S.ponte.scriptAt = Date.now(); break;
      case "ponte-reload": location.reload(); break;
      case "userscript-download": downloadUserscript(); break;
      case "ponte-copy-code":
        copyTextOk(C.bookmarklet(appBase())).then(function (ok) {
          S.ponte.copied = ok; render();
          toast(ok ? "Codice copiato: ora crea il preferito in Safari" : "Copia non riuscita: tieni premuto nel riquadro e scegli «Copia»");
        });
        break;
      case "bm-drag": ev.preventDefault(); toast("Trascina il pulsante nella barra dei preferiti: funziona sulle pagine del portale"); break;
      case "sync": openSync(); break;
      case "sync-now": syncNow(); break;
      case "sync-start": if (!S.sync) S.sync = {}; startSync(); break;
      case "sync-close": S.sync = null; render(); break;
      case "sync-paste": pasteData(); break;
      case "sync-manual": S.sync = Object.assign(S.sync || {}, { manual: true, note: null }); render(); setTimeout(function () { var p = document.getElementById("paste-box"); if (p) p.focus(); }, 50); break;
      case "sync-import": var box = document.getElementById("paste-box"); importText(box ? box.value : "", "paste"); break;
      case "op-cancel": writeBox(C.cancelOp(readBox(), el.dataset.k)); applyBridge(); render(); toast("Modifica annullata"); break;
      case "fail-dismiss":
        var fl = failures(); fl.splice(Number(el.dataset.i), 1); writeJSON(KEYS.ponteFail, fl); render(); break;
      // Navigazione
      case "tab":
        if (S.tab === el.dataset.tab) S.stacks[S.tab] = st.slice(0, 1);
        S.tab = el.dataset.tab; render(); break;
      case "push": st.push({ v: el.dataset.v, id: Number(el.dataset.id) || null, title: el.dataset.title }); render(); break;
      case "back": if (st.length > 1) st.pop(); render(); break;
      case "scope": S.scope = el.dataset.scope; render(); break;
      case "filter": current().filter = el.dataset.k; render(); break;
      case "refresh": if (S.mode === "bridge") syncNow(); else refreshAll(); break;
      // Contenuti
      case "open": openURL(el.dataset.url, el.dataset.title); break;
      case "event":
        var e = S.data.events.filter(function (x) { return x.id === Number(el.dataset.id); })[0];
        if (e) openURL(e.url || BASE + "calendar/view.php?view=upcoming", e.name);
        break;
      case "module": openModule(findModule(Number(el.dataset.c), Number(el.dataset.m))); break;
      case "ctx-close": if (ev.target === el) { S.ctx = null; render(); } break;
      case "ctx-noop": break;
      case "ctx-open": mo = findModule(S.ctx.courseId, S.ctx.id); S.ctx = null; render(); if (mo) openURL(mo.url, mo.name); break;
      case "ctx-toggle": mo = findModule(S.ctx.courseId, S.ctx.id); S.ctx = null; render(); if (mo) toggleCompletion(mo); break;
      case "notif":
        var n = S.data.notifications.filter(function (x) { return x.id === Number(el.dataset.id); })[0];
        if (n) { if (n.url) openURL(n.url, n.ctx || "Avviso"); markRead(n); }
        break;
      case "mark-read":
        var nr = S.data.notifications.filter(function (x) { return x.id === Number(el.dataset.id); })[0];
        if (nr) markRead(nr);
        break;
      case "read-all": markAllRead(); break;
      // Altro
      case "pick-program": S.program = { id: Number(el.dataset.id), name: el.dataset.name }; saveSettings(); render(); break;
      case "reset-program": S.program = { id: DEFAULT_PROGRAM.id, name: DEFAULT_PROGRAM.name }; saveSettings(); render(); break;
      case "save-email": S.email = S.email.trim(); S.login.user = S.email; S.emailSaved = true; saveSettings(); render(); break;
      case "remove-creds": S.email = ""; S.login.user = ""; S.login.pass = ""; S.emailSaved = false; saveSettings(); render(); break;
      case "switch":
        var key = el.dataset.key;
        if (el.dataset.target === "demo") {
          S.demo[key] = !S.demo[key]; saveToggles();
          if (key === "offline" && !S.demo.offline) S.error = null;
        } else {
          S[key] = !S[key]; saveSettings();
          if (key === "reminders") {
            setBadge(S.data.unread);
            toast(S.reminders ? "Promemoria e badge attivi" : "Promemoria disattivati e badge azzerato");
          }
        }
        render(); break;
      case "export-ics": exportCalendar(); break;
      case "test-notif": testNotification(); break;
      case "check-update": checkUpdate(true); break;
      case "copy-diag": copyText(diagnostics(), function () { S.copied = true; render(); }); break;
      case "logout": logout(); break;
      // Demo
      case "demo-reminder":
        var pr = C.plannedReminders(S.data.events)[0];
        if (!S.reminders) toast("I promemoria sono disattivati");
        else if (!pr) toast("Nessun promemoria programmato");
        else banner(pr.title, pr.body);
        break;
      case "demo-new-notif":
        var nn = Demo.addNotification();
        refreshNotifications().then(function () {
          if (S.reminders) banner(nn.ctx, nn.subject); else toast("Nuovo avviso aggiunto (promemoria spenti: nessuna notifica)");
          render();
        });
        break;
      case "reset-demo":
        Demo.reset(); removeKey(cacheKey()); S.data = emptyData(); S.contents = {}; S.cats = {}; S.programList = null;
        S.demo = { offline: false, expireNext: false, github: "new" }; saveToggles();
        toast("Dati di esempio ripristinati"); refreshAll(); break;
      // Modalità web
      case "web-tab": S.webTab = el.dataset.tab; render(); break;
      // Browser simulato
      case "sheet-close": S.sheet = null; S.menu = false; render(); break;
      case "browser-menu": S.menu = !S.menu; render(); break;
      case "browser-back": if (b && b.i > 0) { b.i -= 1; b.seq += 1; b.error = null; } render(); break;
      case "browser-forward": if (b && b.i < b.hist.length - 1) { b.i += 1; b.seq += 1; b.error = null; } render(); break;
      case "browser-reload": if (b) { b.seq += 1; b.error = S.demo.offline ? MSG.offline : null; } render(); break;
      case "browser-error": if (b) b.error = null; render(); break;
      case "nav": if (b) demoNavigate(el.dataset.url); render(); break;
      case "video": if (b) { var vid = Number(el.dataset.id); b.playing = b.playing === vid ? null : vid; } render(); break;
      case "page-alert": showAlert("", el.dataset.msg, [{ label: "OK", role: "cancel" }]); break;
      case "assign-save":
        var input = document.getElementById("assign-file");
        var fileName = input && input.files && input.files.length ? input.files[0].name : pendingFile;
        if (!fileName) { showAlert("", "Seleziona un file da consegnare.", [{ label: "OK", role: "cancel" }]); break; }
        Demo.submit(Number(el.dataset.id), fileName); pendingFile = null;
        demoNavigate(BASE + "mod/assign/view.php?id=" + el.dataset.id);
        S.contents = {};
        toast("Consegna salvata: la scadenza sparisce da Scadenze");
        refreshAll(); break;
      case "quiz-finish":
        var qid = el.dataset.id;
        showAlert("", "Inviare tutto e terminare il tentativo?", [
          { label: "Annulla" },
          { label: "OK", role: "cancel", act: function () { Demo.completeQuiz(Number(qid)); demoNavigate(BASE + "mod/quiz/review.php?id=" + qid); S.contents = {}; render(); refreshAll(); } }
        ]);
        break;
      case "menu-item":
        S.menu = false;
        var shareURL = C.sanitizedForSharing(b.hist[b.i]);
        if (el.dataset.k === "copy") copyText(shareURL, function () { toast("Link copiato, senza token di accesso"); });
        else toast("Si apre la condivisione di iOS con: " + shareURL.replace("https://", ""));
        break;
      case "menu-close": S.menu = false; setTimeout(render, 0); break;
      case "ql-close": S.ql = null; render(); break;
      case "ql-share": toast("Si apre la condivisione di iOS per il file"); break;
      // Avvisi di sistema
      case "alert":
        var fn = alertActions[Number(el.dataset.i)];
        S.alert = null; alertActions = []; render();
        if (fn) fn();
        break;
    }
  });

  device.addEventListener("keydown", function (ev) {
    var el = ev.target;
    if ((ev.key === "Enter" || ev.key === " ") && el.getAttribute && el.getAttribute("role") === "button" && el.tagName !== "BUTTON") { ev.preventDefault(); el.click(); }
    if (ev.key === "Enter" && el.dataset && el.dataset.login) { ev.preventDefault(); if (S.login.method === "key") loginWithKey(); else loginWithPassword(); }
    if (ev.key === "Escape") {
      if (S.ctx) S.ctx = null; else if (S.ql) S.ql = null; else if (S.sheet) S.sheet = null; else if (S.sync) S.sync = null; else return;
      render();
    }
  });
  device.addEventListener("paste", function (ev) {
    var el = ev.target;
    if (!el.dataset || !el.dataset.paste) return;
    var text = ev.clipboardData && ev.clipboardData.getData("text");
    if (text && C.findEnvelope(text).kind === "payload") { ev.preventDefault(); importText(text, "paste"); }
  });
  device.addEventListener("input", function (ev) {
    var el = ev.target;
    if (el.dataset.paste) { if (C.findEnvelope(el.value).kind === "payload") importText(el.value, "paste"); return; }
    if (el.dataset.login) { S.login[el.dataset.login] = el.value; return; }
    if (el.dataset.field === "email") {
      S.email = el.value;
      if (S.emailSaved) { S.emailSaved = false; var lbl = document.getElementById("save-email-label"); if (lbl) lbl.textContent = "Salva email"; }
      return;
    }
    if (el.dataset.search) {
      if (el.dataset.search === "courses") S.courseQuery = el.value; else current().q = el.value;
      var res = document.getElementById("results");
      if (res) res.innerHTML = el.dataset.search === "courses" ? VIEWS.corsi.results() : VIEWS.course.results(current());
      attachLongPress();
    }
  });
  device.addEventListener("change", function (ev) {
    var el = ev.target;
    if (el.id === "assign-file" && el.files && el.files.length) { pendingFile = el.files[0].name; return; }
    if (el.id === "ponte-file" && el.files && el.files.length) { readFile(el.files[0]); return; }
    if (el.dataset.demoSelect) { S.demo[el.dataset.demoSelect] = el.value; saveToggles(); render(); }
  });

  // Ritorno in primo piano: aggiorna se i dati hanno più di 5 minuti (MainTabView) e ricontrolla gli aggiornamenti.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    if (S.phase === "ponte" && S.ponte.scriptAt && Date.now() - S.ponte.scriptAt < 30 * 60e3 && !autoBridge()) {
      S.ponte.scriptAt = 0;
      location.reload();
      return;
    }
    // Con il ponte niente rete: si ridisegna (per l'invito a incollare i dati copiati dal portale).
    if (S.mode === "bridge") { if (S.phase === "app" && !S.alert && !S.ctx) { render(); maybeAutoSync(); } }
    else if (S.phase === "app" && (!S.data.lastUpdated || Date.now() - S.data.lastUpdated > 5 * 60e3)) refreshAll();
    checkUpdateIfNeeded();
  });
  // Tornando indietro dal portale Safari ripristina la pagina com'era: si ridisegna per l'avviso del giro non concluso.
  window.addEventListener("pageshow", function (ev) { if (ev.persisted) { S.ponte.starting = false; S.ponte.incoming = false; if (S.mode === "bridge") render(); } });
  // Lo script del ponte automatico arriva a pagina caricata: si ridisegna (un tocco) e, se scelto, si aggiorna da solo.
  function autoDetected() {
    if (S.phase === "app" || S.phase === "ponte" || S.phase === "login") render();
    maybeAutoSync();
  }
  document.addEventListener("statale-open-auto", autoDetected);
  if (window.MutationObserver) {
    new MutationObserver(function () { if (autoBridge()) autoDetected(); })
      .observe(document.documentElement, { attributes: true, attributeFilter: ["data-statale-open-auto"] });
  }
  window.addEventListener("hashchange", function () {
    var incoming = EMBEDDED ? null : takeIncoming();
    if (incoming) importText(incoming, "frag");
  });
  // Un'altra scheda dell'app ha importato dati o cambiato le modifiche in attesa.
  window.addEventListener("storage", function (ev) {
    if (!ev.key || ev.key.indexOf("so.ponte.") !== 0 || S.mode !== "bridge" || S.phase !== "app") return;
    if (loadSnap()) { applyBridge(); render(); }
  });
  // Tempi relativi aggiornati ogni minuto, senza disturbare chi scrive o guarda una pagina.
  setInterval(function () {
    var active = document.activeElement;
    var typing = active && (active.tagName === "INPUT" || active.tagName === "SELECT" || active.tagName === "TEXTAREA");
    if (!typing && !S.alert && !S.sheet && !S.ql && !S.ctx && !S.sync) render();
  }, 60e3);

  // ---------- Avvio ----------
  if (!EMBEDDED && "serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(function () { /* l'app funziona anche senza */ });
  }
  render();
  restore();
  checkUpdateIfNeeded();
})();
