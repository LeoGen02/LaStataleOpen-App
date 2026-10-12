// Prova completa dell'app web in un browser vero, con il portale simulato da risposte Moodle.
// Verifica il collegamento reale (login/token.php e webservice/rest/server.php), non i dati di esempio.
//
// Uso: node scripts/web/e2e.js [cartella per gli screenshot]
// Richiede Playwright (npm i playwright) e Chromium.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const DOCS = path.resolve(__dirname, "../../docs");
const SHOTS = process.argv[2] || null;
const PORTAL = "https://lastataleopen.myariel.unimi.it/";
const TOKEN = "0123456789abcdef0123456789abcdef";
const now = Math.floor(Date.now() / 1000);

// Portale simulato: stato e risposte nel formato dei web service Moodle.
const portal = {
  expireNext: false,
  calls: [],
  completion: { 556: 0 },
  notifications: [
    { id: 1, subject: "Nuovo annuncio: orario lezioni", timecreated: now - 600, read: false, contexturl: PORTAL + "mod/forum/discuss.php?d=1", contexturlname: "Annunci" },
    { id: 2, subject: "Voto pubblicato", timecreated: now - 90000, read: true, contexturl: PORTAL + "grade/report/user/index.php?id=101", contexturlname: "Fondamenti" }
  ],
  handle(fn, p) {
    this.calls.push(fn);
    if (this.expireNext) { this.expireNext = false; return { exception: "moodle_exception", errorcode: "invalidtoken", message: "Token non valido" }; }
    switch (fn) {
      case "core_webservice_get_site_info":
        return { sitename: "La Statale Open", username: "studente@studenti.unimi.it", firstname: "Mario", lastname: "Rossi", fullname: "Mario Rossi", userid: 42 };
      case "core_enrol_get_users_courses":
        return [
          { id: 102, shortname: "SECAI-02", fullname: "Crittografia applicata", displayname: "Crittografia applicata", category: 21, progress: null, lastaccess: now - 86400 },
          { id: 101, shortname: "SECAI-01", fullname: "Fondamenti di cybersecurity", displayname: "Fondamenti di cybersecurity", category: 21, progress: 40.5, lastaccess: now - 3600 }
        ];
      case "core_calendar_get_action_events_by_timesort":
        return { events: [
          { id: 9001, name: "E-tivity 1 è in scadenza", modulename: "assign", timestart: now + 2 * 86400, timesort: now + 2 * 86400, course: { id: 101, fullname: "Fondamenti di cybersecurity" },
            url: PORTAL + "mod/assign/view.php?id=555", action: { name: "Aggiungi consegna", url: PORTAL + "mod/assign/view.php?id=555&action=editsubmission", actionable: true }, overdue: false },
          { id: 9002, name: "Quiz 1 chiude", modulename: "quiz", timestart: now - 2 * 86400, timesort: now - 2 * 86400, course: { id: 102, fullname: "Crittografia applicata" },
            url: PORTAL + "mod/quiz/view.php?id=600", overdue: true }
        ] };
      case "message_popup_get_popup_notifications":
        return { notifications: this.notifications, unreadcount: this.notifications.filter((n) => !n.read).length };
      case "core_message_mark_notification_read":
        this.notifications.forEach((n) => { if (n.id === Number(p.get("notificationid"))) n.read = true; });
        return { notificationid: Number(p.get("notificationid")), warnings: [] };
      case "core_message_mark_all_notifications_as_read":
        this.notifications.forEach((n) => { n.read = true; });
        return true;
      case "core_course_get_categories":
        return p.get("criteria[0][value]") === "0"
          ? [{ id: 2, name: "SecAI", parent: 0, coursecount: 0 }, { id: 9, name: "Altro percorso", parent: 0, coursecount: 3 }]
          : p.get("criteria[0][value]") === "2" ? [{ id: 21, name: "Cluster sicurezza", parent: 2, coursecount: 2 }] : [];
      case "core_course_get_courses_by_field":
        return { courses: p.get("value") === "21" ? [
          { id: 101, fullname: "Fondamenti di cybersecurity", displayname: "Fondamenti di cybersecurity", shortname: "SECAI-01", categoryid: 21 },
          { id: 102, fullname: "Crittografia applicata", displayname: "Crittografia applicata", shortname: "SECAI-02", categoryid: 21 }
        ] : [] };
      case "core_course_get_contents":
        if (p.get("courseid") !== "101") return { exception: "require_login_exception", errorcode: "requireloginerror", message: "Non sei iscritto a questo corso." };
        return [{ id: 1, name: "Generale", section: 0, summary: "<p>Benvenuti &egrave; il corso</p>", modules: [
          { id: 555, url: PORTAL + "mod/assign/view.php?id=555", name: "E-tivity 1", modname: "assign", modplural: "Compiti", uservisible: true, completion: 2, completiondata: { state: 0 }, dates: [{ label: "Aperto:", timestamp: now - 86400 }, { label: "Scadenza:", timestamp: now + 2 * 86400 }] },
          { id: 556, url: PORTAL + "mod/page/view.php?id=556", name: "Lezione 1", modname: "page", modplural: "Pagine", uservisible: true, completion: 1, completiondata: { state: this.completion[556] } },
          { id: 557, url: PORTAL + "mod/resource/view.php?id=557", name: "Slide", modname: "resource", modplural: "File", uservisible: true, completion: 0,
            contents: [{ type: "file", filename: "slide.pdf", fileurl: PORTAL + "webservice/pluginfile.php/1/mod_resource/content/1/slide.pdf?forcedownload=1" }] },
          { id: 558, url: PORTAL + "mod/page/view.php?id=558", name: "Nascosta", modname: "page", uservisible: false, completion: 0 }
        ] }];
      case "core_completion_update_activity_completion_status_manually":
        this.completion[Number(p.get("cmid"))] = p.get("completed") === "1" ? 1 : 0;
        return { status: true, warnings: [] };
      default:
        return { exception: "invalid_parameter_exception", errorcode: "invalidrecord", message: "Funzione non simulata: " + fn };
    }
  }
};

function serve() {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const file = path.join(DOCS, decodeURIComponent(req.url.split("?")[0]).replace(/\/$/, "/index.html"));
      if (!file.startsWith(DOCS) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
      res.end(fs.readFileSync(file));
    }).listen(0, "127.0.0.1", () => resolve(server));
  });
}

(async () => {
  const server = await serve();
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const context = await browser.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, locale: "it-IT" });
  const errors = [], opened = [];
  await context.route(PORTAL + "**", async (route) => {
    const req = route.request(), url = new URL(req.url());
    const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
    if (url.pathname === "/login/token.php") {
      if (url.searchParams.get("appsitecheck")) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ appsitecheck: "ok" }) });
      const p = new URLSearchParams(req.postData() || "");
      const ok = p.get("username") === "studente@studenti.unimi.it" && p.get("password") === "giusta" && p.get("service") === "moodle_mobile_app";
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(ok ? { token: TOKEN, privatetoken: "PRIV" } : { error: "Accesso non valido", errorcode: "invalidlogin" }) });
    }
    if (url.pathname === "/webservice/rest/server.php") {
      const p = new URLSearchParams(req.postData() || "");
      if (p.get("wstoken") !== TOKEN) return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ exception: "moodle_exception", errorcode: "invalidtoken", message: "Token non valido" }) });
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(portal.handle(p.get("wsfunction"), p)) });
    }
    return route.fulfill({ status: 200, contentType: "text/html", body: "<p>pagina del portale</p>" });
  });
  await context.route("https://api.github.com/**", (route) => route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    body: JSON.stringify({ tag_name: "v1.4.0", html_url: "https://github.com/LeoGen02/LaStataleOpen-App/releases/tag/v1.4.0" }) }));

  const page = await context.newPage();
  // Pagine aperte in una nuova scheda (window.open): se ne registra l'indirizzo.
  page.on("popup", async (p) => {
    try { await p.waitForLoadState("domcontentloaded", { timeout: 5000 }); } catch (e) { /* basta l'indirizzo */ }
    opened.push(p.url());
    p.close().catch(() => {});
  });
  page.on("pageerror", (e) => errors.push("errore JavaScript: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  const base = "http://127.0.0.1:" + server.address().port + "/";
  let passed = 0;
  async function check(name, fn) {
    try { await fn(); passed += 1; console.log("✓ " + name); }
    catch (e) { errors.push(name + ": " + e.message.split("\n")[0]); console.log("✗ " + name); if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "errore.png") }); }
  }
  const text = () => page.locator("#device").innerText();
  // innerText segue lo stile (le intestazioni sono in maiuscolo): il confronto ignora maiuscole e minuscole.
  async function expectText(t) { await page.waitForFunction((s) => document.querySelector("#device").innerText.toLowerCase().includes(s.toLowerCase()), t, { timeout: 5000 }); }
  async function shot(name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png") }); }

  await page.goto(base);

  await check("verifica del collegamento", async () => {
    await page.click('[data-a="login-more"]');
    await page.click('[data-a="site-check"]');
    await expectText("ha i servizi per app attivi");
  });
  await check("password sbagliata: messaggio chiaro", async () => {
    await page.fill("#login-user", "studente@studenti.unimi.it");
    await page.fill("#login-pass", "sbagliata");
    await page.click('[data-a="login"]');
    await expectText("non accetta queste credenziali");
  });
  await check("chiave non valida rifiutata prima di chiamare il portale", async () => {
    await page.click('[data-a="login-method"][data-k="key"]');
    await page.fill("#login-key", "abc");
    await page.click('[data-a="login"]');
    await expectText("32 caratteri");
    await page.click('[data-a="login-method"][data-k="password"]');
  });
  await check("accesso con email e password", async () => {
    await page.fill("#login-pass", "giusta");
    await page.click('[data-a="login"]');
    await expectText("Ciao, Mario");
    await expectText("Aggiornato");
    await shot("1-home");
  });
  await check("Home: scadenze, corsi per ultimo accesso, avviso di aggiornamento", async () => {
    const t = await text();
    if (!t.includes("E-tivity 1 è in scadenza")) throw new Error("scadenza mancante");
    if (t.indexOf("Fondamenti di cybersecurity") > t.indexOf("Crittografia applicata", t.indexOf("RIPRESA"))) throw new Error("corsi non ordinati per ultimo accesso");
    await expectText("È disponibile la versione 1.4.0");
  });
  await check("password non salvata, chiave salvata", async () => {
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    if (stored.includes("giusta")) throw new Error("la password è finita nell'archivio locale");
    if (!stored.includes(TOKEN)) throw new Error("chiave dell'app non salvata");
  });
  await check("Scadenze: scadute di recente e giorni", async () => {
    await page.click('[data-tab="scadenze"]');
    await expectText("Scadute di recente");
    await expectText("Quiz 1 chiude");
    await shot("2-scadenze");
  });
  await check("tocco su una scadenza: apre la pagina dell'attività", async () => {
    await page.click('[data-a="event"][data-id="9001"]');
    await page.waitForTimeout(800);
    if (!opened.some((u) => u.includes("id=555&action=editsubmission"))) throw new Error("pagina non aperta: " + opened.join(", "));
  });
  await check("Avvisi: badge, apertura e segna come letto", async () => {
    await page.click('[data-tab="avvisi"]');
    await expectText("Nuovo annuncio: orario lezioni");
    if (!(await page.locator(".tab .badge").innerText()).includes("1")) throw new Error("badge non corretto");
    await page.click('[data-a="notif"][data-id="1"]');
    await page.waitForFunction(() => !document.querySelector(".tab .badge"), null, { timeout: 5000 });
    if (!portal.calls.includes("core_message_mark_notification_read")) throw new Error("avviso non segnato come letto sul portale");
  });
  await check("Corsi: ricerca e percorso con cluster", async () => {
    await page.click('[data-tab="corsi"]');
    await page.fill("#q-courses", "cripto");
    const t = await page.locator("#results").innerText();
    if (t.includes("Fondamenti")) throw new Error("ricerca non filtra");
    await page.fill("#q-courses", "");
    await page.click('[data-scope="program"]');
    await expectText("Cluster sicurezza");
    await page.click('[data-v="cluster"]');
    await expectText("Insegnamenti");
  });
  await check("dettaglio corso: sezioni, attività visibili, scadenza", async () => {
    await page.click('.content [data-v="course"][data-id="101"]');
    await expectText("Benvenuti è il corso");
    const t = await text();
    if (t.includes("Nascosta")) throw new Error("mostrata un'attività non visibile");
    if (!t.includes("🕒")) throw new Error("scadenza dell'attività mancante");
    await shot("3-corso");
  });
  await check("filtro Esercizi / E-tivity", async () => {
    await page.click('[data-k="etivity"]');
    let t = await page.locator("#results").innerText();
    if (t.includes("Lezione 1") || !t.includes("E-tivity 1")) throw new Error("filtro E-tivity errato");
    await page.click('[data-k=""]');
  });
  await check("file del corso aperto con il token", async () => {
    opened.length = 0;
    await page.click('[data-a="module"][data-m="557"]');
    await page.waitForTimeout(800);
    if (!opened.some((u) => u.includes("pluginfile.php") && u.includes("token=" + TOKEN))) throw new Error("file non aperto con il token: " + opened.join(", "));
  });
  await check("tieni premuto: segna come completata sul portale", async () => {
    await page.click('[data-long="556"]', { button: "right" });
    await expectText("Segna come completata");
    await page.click('[data-a="ctx-toggle"]');
    await page.waitForFunction(() => {
      const row = document.querySelector('[data-m="556"] .check');
      return row && row.getAttribute("aria-label") === "Completata";
    }, null, { timeout: 5000 });
    if (portal.completion[556] !== 1) throw new Error("completamento non inviato al portale");
  });
  await check("corso non iscritto: errore del portale e link", async () => {
    await page.click('[data-a="back"]');
    await page.click('.content [data-v="course"][data-id="102"]');
    await expectText("Non sei iscritto a questo corso.");
    await expectText("Apri il corso nel portale");
  });
  await check("Altro: percorso, informazioni, aggiornamenti", async () => {
    await page.click('[data-tab="altro"]');
    await expectText("Mario Rossi");
    await page.click('[data-v="program"]');
    await expectText("Altro percorso");
    await page.click('[data-a="pick-program"][data-id="9"]');
    await page.click('[data-a="back"]');
    await expectText("Altro percorso");
    await page.click('[data-a="check-update"]');
    await expectText("È disponibile la versione 1.4.0.");
    await shot("4-altro");
  });
  await check("calendario .ics generato", async () => {
    const [download] = await Promise.all([page.waitForEvent("download", { timeout: 5000 }), page.click('[data-a="export-ics"]')]);
    const file = await download.path();
    const ics = fs.readFileSync(file, "utf8");
    if (!ics.includes("BEGIN:VEVENT") || !ics.includes("TRIGGER:-PT2H")) throw new Error("calendario incompleto");
  });
  await check("sessione scaduta: torna all'accesso con l'avviso", async () => {
    portal.expireNext = true;
    await page.click('[data-tab="home"]');
    await page.click('[data-a="refresh"]');
    await expectText("La sessione è scaduta");
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    if (stored.includes(TOKEN)) throw new Error("chiave non cancellata");
  });
  await check("riavvio con chiave salvata: ripristina la sessione", async () => {
    await page.fill("#login-pass", "giusta");
    await page.click('[data-a="login"]');
    await expectText("Ciao, Mario");
    await page.reload();
    await expectText("Ciao, Mario");
  });
  await check("modalità web e dati di esempio", async () => {
    await page.click('[data-tab="altro"]');
    await page.click('[data-a="logout"]');
    await page.click('[data-a="web-mode"]');
    await expectText("si apre in una nuova scheda");
    await page.click('[data-a="web-tab"][data-tab="altro"]');
    await page.click('[data-a="logout"]');
    await page.click('[data-a="start-demo"]');
    await expectText("Dati di esempio");
    await expectText("Ciao, Studente");
  });

  console.log("\n" + passed + " controlli superati" + (errors.length ? ", " + errors.length + " problemi:\n" + errors.join("\n") : ", nessun problema."));
  await browser.close();
  server.close();
  process.exit(errors.length ? 1 : 0);
})();
