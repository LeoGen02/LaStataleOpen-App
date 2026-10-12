// Portale La Statale Open simulato, per i test del ponte: pagine con M.cfg, lib/ajax/service.php con le risposte
// di Moodle (stesse forme del portale vero, anche lo stato del corso come testo JSON) e le pagine dei percorsi.
// Dati inventati: nessuna credenziale o informazione reale.
"use strict";

const ORIGIN = "https://lastataleopen.myariel.unimi.it";

function createPortal() {
  const now = Math.floor(Date.now() / 1000);
  const st = {
    sesskey: "S3SS10Nk3y",
    userId: 42,
    loggedIn: true,
    calls: [],
    posts: 0,
    pages: [],
    fail: {},
    completion: { 555: 0, 556: 0, 557: 1, 561: 0 },
    manual: { 556: true, 557: true },
    notifications: [
      { id: 1, subject: "Nuovo annuncio: <b>orario</b> lezioni", timecreated: now - 600, read: false, contexturl: ORIGIN + "/mod/forum/discuss.php?d=1", contexturlname: "Annunci" },
      { id: 2, subject: "Voto pubblicato", timecreated: now - 90000, read: true, contexturl: ORIGIN + "/grade/report/user/index.php?id=101", contexturlname: "Fondamenti" },
      { id: 3, subject: "Link esterno", timecreated: now - 200000, read: false, contexturl: "https://esterno.example/pagina", contexturlname: "Esterno" }
    ],
    courses: [
      { id: 102, fullname: "Crittografia applicata", fullnamedisplay: "Crittografia applicata", shortname: "SECAI-02", hasprogress: false, progress: null, timeaccess: now - 86400, courseimage: "data:image/svg+xml;base64,AAAA", summary: "<p>Corso</p>" },
      { id: 101, fullname: "Fondamenti di cybersecurity", fullnamedisplay: "Fondamenti di cybersecurity", shortname: "SECAI-01", hasprogress: true, progress: 40.5, timeaccess: now - 3600, courseimage: "data:image/svg+xml;base64,AAAA", summary: "" },
      { id: 103, fullname: "Sicurezza delle reti", fullnamedisplay: "Sicurezza delle reti", shortname: "SECAI-03", hasprogress: true, progress: 0, timeaccess: null, summary: "" }
    ],
    user: { id: 42, username: "mario.rossi@studenti.unimi.it", firstname: "Mario", lastname: "Rossi", fullname: "Mario Rossi", email: "mario.rossi@studenti.unimi.it" }
  };

  function events() {
    const list = [
      { id: 9001, name: "E-tivity 1 è in scadenza", modulename: "assign", instance: 7, timestart: now + 2 * 86400, timesort: now + 2 * 86400,
        course: { id: 101, fullname: "Fondamenti di cybersecurity", fullnamedisplay: "Fondamenti di cybersecurity" },
        url: ORIGIN + "/mod/assign/view.php?id=555", action: { name: "Aggiungi consegna", url: ORIGIN + "/mod/assign/view.php?id=555&action=editsubmission", actionable: true }, overdue: false },
      { id: 9002, name: "Quiz 1 chiude", modulename: "quiz", timestart: now - 2 * 86400, timesort: now - 2 * 86400,
        course: { id: 102, fullname: "Crittografia applicata" }, url: ORIGIN + "/mod/quiz/view.php?id=600", overdue: true },
      { id: 9003, name: "Evento con link esterno", modulename: "url", timestart: now + 5 * 86400, timesort: now + 5 * 86400,
        course: { id: 103, fullname: "Sicurezza delle reti" }, url: "https://esterno.example/x", overdue: false }
    ];
    return list.filter((e) => !(e.id === 9001 && st.completion[555]));
  }

  function state(courseId) {
    const cm = (id, name, module, modname, extra) => Object.assign({
      id: String(id), anchor: "module-" + id, name, visible: true, uservisible: true, module, modname, url: ORIGIN + "/mod/" + module + "/view.php?id=" + id,
      istrackeduser: true
    }, extra || {});
    return JSON.stringify({
      course: { id: String(courseId), numsections: 2, sectionlist: ["11", "12"], editmode: false },
      section: [
        { id: "11", section: 0, number: 0, title: "Generale", hassummary: true, rawtitle: "", cmlist: ["555", "556", "557", "560"], visible: true },
        { id: "12", section: 1, number: 1, title: "Modulo 1 &amp; introduzione", cmlist: ["558", "559", "561"], visible: true },
        { id: "13", section: 3, number: 3, title: "Approfondimento", component: "mod_subsection", itemid: 1, cmlist: ["562"], visible: true }
      ],
      cm: [
        cm(555, "E-tivity 1", "assign", "Compito", { completionstate: st.completion[555] }),
        cm(556, "Lezione 1", "page", "Pagina", { completionstate: st.completion[556] }),
        cm(557, "Slide del modulo", "resource", "File", { completionstate: st.completion[557] }),
        cm(558, "Nascosta", "page", "Pagina", { uservisible: false }),
        cm(559, "Prima di iniziare guarda la lezione 1", "label", "Etichetta", { url: null }),
        cm(560, "Approfondimento", "subsection", "Sottosezione"),
        cm(561, "Esercitazione 1", "quiz", "Quiz", { completionstate: st.completion[561] }),
        cm(562, "Sito di riferimento", "url", "URL")
      ]
    });
  }

  function handle(method, args) {
    st.calls.push(method);
    if (st.fail[method]) {
      const f = st.fail[method];
      if (!f.persist) delete st.fail[method];
      return { error: { message: f.message || "Errore simulato", errorcode: f.errorcode, exception: "moodle_exception" } };
    }
    switch (method) {
      case "core_course_get_enrolled_courses_by_timeline_classification":
        return { data: { courses: st.courses, nextoffset: st.courses.length } };
      case "core_calendar_get_action_events_by_timesort":
        return { data: { events: events(), firstid: 9001, lastid: 9003 } };
      case "message_popup_get_popup_notifications":
        if (args.useridto !== st.userId) return { error: { message: "Utente non valido", errorcode: "invaliduser" } };
        return { data: { notifications: st.notifications.slice().sort((a, b) => b.timecreated - a.timecreated), unreadcount: st.notifications.filter((n) => !n.read).length } };
      case "core_user_get_users_by_field":
        return { data: args.values.indexOf(String(st.userId)) >= 0 ? [st.user] : [] };
      case "core_courseformat_get_state":
        if (args.courseid === 102) return { error: { message: "Non hai accesso a questo corso", errorcode: "restrictedcontextexception" } };
        return { data: state(args.courseid) };
      case "core_message_mark_notification_read": {
        const n = st.notifications.find((x) => x.id === args.notificationid);
        if (!n) return { error: { message: "Notifica inesistente", errorcode: "invalidrecord" } };
        n.read = true;
        return { data: { notificationid: n.id, warnings: [] } };
      }
      case "core_completion_update_activity_completion_status_manually":
        if (!st.manual[args.cmid]) return { error: { message: "Il completamento di questa attività è automatico.", errorcode: "cannotmanualctrack" } };
        st.completion[args.cmid] = args.completed ? 1 : 0;
        return { data: { status: true, warnings: [] } };
      default:
        return { error: { message: "Funzione non disponibile", errorcode: "servicenotavailable" } };
    }
  }

  // lib/ajax/service.php: risponde in ordine e si ferma al primo errore, come Moodle.
  function ajax(url, body) {
    st.posts += 1;
    const u = new URL(url);
    let calls;
    try { calls = JSON.parse(body); } catch (e) { return JSON.stringify({ error: "Richiesta non valida", errorcode: "invalidjson" }); }
    const out = [];
    for (const call of calls) {
      let r;
      if (!st.loggedIn) r = { error: { message: "Devi autenticarti", errorcode: "servicerequireslogin" } };
      else if (u.searchParams.get("sesskey") !== st.sesskey) r = { error: { message: "Chiave di sessione non valida", errorcode: "invalidsesskey" } };
      else r = handle(call.methodname, call.args || {});
      if (r.error) { out.push({ error: true, exception: r.error }); break; }
      out.push({ error: false, data: r.data });
    }
    return JSON.stringify(out);
  }

  function categoryBox(id, name) {
    return '<div class="category loaded with_children" data-categoryid="' + id + '" data-depth="1" data-showcourses="15" data-type="0">' +
      '<div class="info"><h3 class="categoryname aabtn"><a href="' + ORIGIN + "/course/index.php?categoryid=" + id + '">' + name + "</a></h3></div></div>";
  }
  function courseBox(id, name) {
    return '<div class="coursebox clearfix odd" data-courseid="' + id + '" data-type="1"><div class="info"><h3 class="coursename">' +
      '<a class="aalink" href="' + ORIGIN + "/course/view.php?id=" + id + '">' + name + "</a></h3></div></div>";
  }
  const TREE = {
    0: { subs: [[2, "SecAI"], [9, "Altro percorso"]], courses: [] },
    2: { subs: [[21, "Cluster sicurezza"], [22, "Cluster intelligenza artificiale"]], courses: [] },
    21: { subs: [], courses: [[101, "Fondamenti di cybersecurity"], [102, "Crittografia applicata"]] },
    22: { subs: [], courses: [[103, "Sicurezza delle reti"], [104, "Analisi dei dati con Python"]] },
    9: { subs: [], courses: [[901, "Corso di un altro percorso"]] }
  };
  function cfg(userId) {
    return '<script>var M = {}; M.yui = {}; M.cfg = {"wwwroot":"' + ORIGIN + '","homeurl":{},"sesskey":"' + st.sesskey + '","theme":"boost","courseId":1,"contextid":2,"siteId":1,"userId":' + userId + "};</script>";
  }
  function page(url) {
    const u = new URL(url);
    st.pages.push(u.pathname + u.search);
    const userId = st.loggedIn ? st.userId : 0;
    if (u.pathname === "/course/index.php") {
      const id = Number(u.searchParams.get("categoryid") || 0), browse = u.searchParams.get("browse");
      const t = TREE[id] || { subs: [], courses: [] };
      const inner = (browse !== "courses" ? t.subs.map((c) => categoryBox(c[0], c[1])).join("") : "") +
        (browse !== "categories" ? t.courses.map((c) => courseBox(c[0], c[1])).join("") : "");
      return "<!doctype html><html><head><title>Corsi</title>" + cfg(userId) + '</head><body><div class="course_category_tree">' + inner + "</div></body></html>";
    }
    return "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><title>Dashboard</title>" + cfg(userId) +
      "</head><body><header><a href=\"" + ORIGIN + "/my/\">La Statale Open</a></header><main><h1>Dashboard</h1><p>Pagina del portale simulato.</p></main></body></html>";
  }

  // Risposta completa come il portale vero: Dashboard senza login → login di Ateneo → di nuovo la Dashboard.
  function respond(method, url, body) {
    const u = new URL(url);
    if (u.pathname === "/lib/ajax/service.php" && method === "POST") return { status: 200, headers: { "Content-Type": "application/json" }, body: ajax(url, body || "") };
    if (u.pathname === "/my/" && !st.loggedIn) return { status: 303, headers: { Location: ORIGIN + "/login/index.php" }, body: "" };
    if (u.pathname === "/login/index.php") {
      return st.loggedIn ? { status: 303, headers: { Location: ORIGIN + "/my/" }, body: "" }
        : { status: 302, headers: { Location: SSO + "?url=" + encodeURIComponent(ORIGIN + "/login/index.php") }, body: "" };
    }
    if (u.pathname === "/auth/sso/ritorno.php") { st.loggedIn = true; st.logins += 1; return { status: 303, headers: { Location: ORIGIN + "/my/" }, body: "" }; }
    return { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" }, body: page(url) };
  }
  // Pagina di login di Ateneo simulata: il pulsante completa l'accesso e torna al portale.
  function ssoPage() {
    return "<!doctype html><html lang=\"it\"><head><meta charset=\"utf-8\"><title>Login di Ateneo</title></head><body>" +
      "<form action=\"" + ORIGIN + "/auth/sso/ritorno.php\" method=\"get\"><input type=\"email\" name=\"u\"><input type=\"password\" name=\"p\">" +
      "<button id=\"sso-login\" type=\"submit\">Accedi</button></form></body></html>";
  }
  st.logins = 0;

  return { ORIGIN, SSO, st, handle, ajax, page, respond, ssoPage, state, events };
}

const SSO = "https://elearning.unimi.it/authentication/skin/lastataleopen/it/login.aspx";

module.exports = { createPortal, ORIGIN, SSO };
