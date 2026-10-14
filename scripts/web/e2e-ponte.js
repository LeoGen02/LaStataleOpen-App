// Prova completa del ponte in un browser vero: l'app servita come su GitHub Pages, il portale simulato
// (pagine con M.cfg e lib/ajax/service.php), il preferito eseguito sulla pagina del portale con il controllo SRI reale.
//
// Uso: node scripts/web/e2e-ponte.js [cartella per gli screenshot]
// Richiede Playwright (npm i playwright) e Chromium.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const C = require("../../docs/core.js");
const P = require("../../docs/ponte/ponte-1.js");
const { createPortal, ORIGIN, SSO } = require("./mock-portal.js");

const DOCS = path.resolve(__dirname, "../../docs");
const APP = "https://leogen02.github.io/LaStataleOpen-App/";
const SHOTS = process.argv[2] || null;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const BOOKMARK = decodeURIComponent(C.bookmarklet(APP).slice("javascript:".length));
const USERSCRIPT = fs.readFileSync(path.join(DOCS, C.PONTE.userscript), "utf8");
const USERSCRIPT_V1 = fs.readFileSync(path.join(DOCS, "ponte/statale-open-1.user.js"), "utf8");

let portal = createPortal();
let tamper = false;
// GitHub simulato per le note: un repository privato con il file note.json.
const gh = { private: true, file: null, sha: 0, puts: 0, token: "github_pat_" + "x".repeat(40), putDelay: 0, conflict: false, inflight: 0 };
const treePages = () => portal.st.pages.filter((p) => p.startsWith("/course/index.php")).length;

async function setup(context) {
  // GitHub Pages: i file di docs/, con Access-Control-Allow-Origin: * (serve al controllo SRI del ponte).
  await context.route(APP + "**", (route) => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname.slice("/LaStataleOpen-App/".length)) || "index.html";
    const file = path.join(DOCS, rel.endsWith("/") ? rel + "index.html" : rel);
    if (!file.startsWith(DOCS) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: "" });
    let body = fs.readFileSync(file);
    if (tamper && rel.startsWith("ponte/")) body = Buffer.concat([body, Buffer.from("\n// modificato\n")]);
    return route.fulfill({ status: 200, headers: { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Access-Control-Allow-Origin": "*" }, body });
  });
  // Portale con i suoi reindirizzamenti (Dashboard senza login → login di Ateneo → Dashboard).
  // Playwright non intercetta le richieste nate da un reindirizzamento servito da route.fulfill: i 302/303 del portale
  // simulato diventano una pagina che va subito all'indirizzo di destinazione (come farebbe il browser).
  await context.route(ORIGIN + "/**", (route) => {
    const req = route.request();
    const r = portal.respond(req.method(), req.url(), req.postData());
    if (r.status >= 300 && r.status < 400) {
      return route.fulfill({ status: 200, contentType: "text/html; charset=utf-8",
        body: "<!doctype html><title>Reindirizzamento</title><script>location.replace(" + JSON.stringify(r.headers.Location) + ");</script>" });
    }
    return route.fulfill({ status: r.status, headers: r.headers, body: r.body });
  });
  await context.route(SSO + "**", (route) => route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: portal.ssoPage() }));
  await context.route("https://api.github.com/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, X-GitHub-Api-Version", "Access-Control-Allow-Methods": "GET, PUT, OPTIONS", "Content-Type": "application/json" };
    const reply = (status, body) => route.fulfill({ status, headers: cors, body: JSON.stringify(body) });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors, body: "" });
    if (u.pathname.startsWith("/repos/LeoGen02/statale-open-note")) {
      if (req.headers().authorization !== "Bearer " + gh.token) return reply(401, { message: "Bad credentials" });
      if (u.pathname === "/repos/LeoGen02/statale-open-note") return reply(200, { full_name: "LeoGen02/statale-open-note", private: gh.private });
      if (u.pathname === "/repos/LeoGen02/statale-open-note/contents/note.json") {
        if (req.method() === "GET") return gh.file === null ? reply(404, { message: "Not Found" }) : reply(200, { sha: "s" + gh.sha, content: Buffer.from(gh.file).toString("base64").replace(/(.{60})/g, "$1\n") });
        const body = JSON.parse(req.postData());
        // Rete lenta: la scrittura arriva dopo un po'.
        if (gh.putDelay) { gh.inflight += 1; await new Promise((r) => setTimeout(r, gh.putDelay)); gh.inflight -= 1; }
        if (gh.conflict || (gh.file === null && body.sha) || (gh.file !== null && body.sha !== "s" + gh.sha)) return reply(409, { message: "sha does not match" });
        gh.file = Buffer.from(body.content, "base64").toString("utf8"); gh.sha += 1; gh.puts += 1;
        return reply(gh.sha === 1 ? 201 : 200, { content: { sha: "s" + gh.sha } });
      }
      return reply(404, { message: "Not Found" });
    }
    return reply(200, { tag_name: "v" + C.PONTE.version + ".0.0-test", html_url: "https://github.com/LeoGen02/LaStataleOpen-App/releases" });
  });
}

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [], dialogs = [];
  let passed = 0;
  async function newPage(standalone) {
    const context = await browser.newContext({ viewport: { width: 390, height: 820 }, hasTouch: true, locale: "it-IT", serviceWorkers: "block", acceptDownloads: true });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: APP.replace(/\/LaStataleOpen-App\/$/, "") });
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
    if (standalone) await context.addInitScript(() => { Object.defineProperty(navigator, "standalone", { get: () => true }); });
    await setup(context);
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push("errore JavaScript: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|integrity/.test(m.text())) errors.push("console: " + m.text()); });
    page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
    return page;
  }
  async function check(page, name, fn) {
    try { await fn(); passed += 1; console.log("✓ " + name); }
    catch (e) { errors.push(name + ": " + e.message.split("\n")[0]); console.log("✗ " + name); if (SHOTS) await page.screenshot({ path: path.join(SHOTS, "errore-" + passed + ".png") }).catch(() => {}); }
  }
  async function expectText(page, t, timeout) {
    await page.waitForFunction((s) => document.body.innerText.toLowerCase().includes(s.toLowerCase()), t, { timeout: timeout || 8000 });
  }
  async function panelText(page) { return page.locator('[data-statale-open="ponte"]').innerText(); }
  async function waitPanel(page, t) {
    await page.waitForFunction((s) => { const h = document.querySelector('[data-statale-open="ponte"]'); return h && h.shadowRoot.textContent.toLowerCase().includes(s.toLowerCase()); }, t, { timeout: 10000 });
  }
  // Tocco sul preferito: lo stesso codice che l'utente incolla in Safari.
  async function tapBookmark(page) { await page.evaluate(BOOKMARK); }
  async function shot(page, name) { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + ".png") }); }

  // ---------- Scheda di Safari ----------
  const page = await newPage(false);
  await page.goto(APP);

  await check(page, "accesso senza estensione: niente email e password, «Accedi» apre i 4 passaggi", async () => {
    await expectText(page, "estensione gratuita Userscripts");
    if (await page.locator("#login-pass").count()) throw new Error("accesso con la password mostrato con i servizi per app spenti");
    await page.click('[data-a="login-portal"]');
    await expectText(page, "1 · Installa Userscripts");
    await expectText(page, "4 · Controlla");
    if (await page.locator("#ponte-code").count()) throw new Error("preferito aperto senza chiederlo");
    await shot(page, "p0-passaggi");
  });

  await check(page, "tornando dalla scheda dello script la pagina si ricarica da sola", async () => {
    if ((await page.getAttribute('[data-a="script-opened"]', "href")) !== APP + C.PONTE.userscript) throw new Error("link allo script sbagliato");
    // Safari mostra il testo dello script in una nuova scheda (Chromium lo scarica e chiude la scheda).
    const [popup] = await Promise.all([page.waitForEvent("popup"), page.click('[data-a="script-opened"]')]);
    await popup.close().catch(() => {});
    await page.evaluate(() => { window.__primaDelRitorno = 1; });
    await Promise.all([page.waitForEvent("load"), page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))]);
    if (await page.evaluate(() => window.__primaDelRitorno)) throw new Error("pagina non ricaricata");
    await expectText(page, "1 · Installa Userscripts");
    // Una volta sola: un secondo ritorno non ricarica di nuovo.
    await page.evaluate(() => { window.__secondo = 1; document.dispatchEvent(new Event("visibilitychange")); });
    await page.waitForTimeout(500);
    if (!(await page.evaluate(() => window.__secondo))) throw new Error("ricaricata in cerchio");
  });

  await check(page, "preferito di riserva: mostra il codice", async () => {
    await page.click('[data-a="ponte-bookmark"]');
    await expectText(page, "Copia il codice");
    const code = await page.inputValue("#ponte-code");
    if (code !== C.bookmarklet(APP)) throw new Error("codice del preferito diverso");
    await page.click('[data-a="ponte-copy-code"]');
    await expectText(page, "Codice copiato");
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    if (clip !== C.bookmarklet(APP)) throw new Error("negli appunti c'è altro");
    await shot(page, "p1-installazione");
  });

  await check(page, "la schermata di installazione resta dopo un ricaricamento", async () => {
    await page.reload();
    await expectText(page, "Metti il codice nel preferito");
  });

  await check(page, "primo aggiornamento: portale, preferito, ritorno automatico all'app", async () => {
    await page.click('[data-a="sync-start"]');
    await page.waitForURL((u) => u.toString().startsWith(ORIGIN + "/my/#statale-open=SOQ1."));
    await tapBookmark(page);
    await page.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(page, "Ciao, Mario");
    await expectText(page, "Dati aggiornati");
    const hash = await page.evaluate(() => location.hash);
    if (hash) throw new Error("i dati sono rimasti nell'indirizzo: " + hash.slice(0, 30));
    if (treePages() !== 7) throw new Error("pagine dei percorsi lette: " + treePages());
    await shot(page, "p2-home");
  });

  await check(page, "Home: scadenze, corsi, ponte; nei dati salvati niente sesskey", async () => {
    await expectText(page, "E-tivity 1 è in scadenza");
    await expectText(page, "Fondamenti di cybersecurity");
    await expectText(page, "Aggiorna dal portale");
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    for (const secret of [portal.st.sesskey, "MoodleSession", "mario.rossi@"]) if (stored.includes(secret)) throw new Error("nell'archivio c'è " + secret);
  });

  await check(page, "corso: sezioni, scadenza dell'attività, sottosezione, attività nascosta esclusa", async () => {
    await page.click('[data-tab="corsi"]');
    // Un secondo tocco sulla scheda torna all'elenco (la scheda ricorda la pagina aperta prima del giro sul portale).
    await page.click('[data-tab="corsi"]');
    await page.click('.content [data-v="course"][data-id="101"]');
    await expectText(page, "Modulo 1 & introduzione");
    const t = await page.locator("#device").innerText();
    if (t.includes("Nascosta")) throw new Error("attività nascosta mostrata");
    if (!t.includes("🕒")) throw new Error("scadenza dell'attività mancante");
    if (!t.includes("Sito di riferimento")) throw new Error("attività della sottosezione persa");
    if (!t.includes("Prima di iniziare guarda la lezione 1")) throw new Error("etichetta mancante");
  });

  await check(page, "corso non letto dal ponte: messaggio e link al portale", async () => {
    await page.click('[data-a="back"]');
    await page.click('.content [data-v="course"][data-id="102"]');
    await expectText(page, "Non hai accesso a questo corso");
    await expectText(page, "Apri il corso nel portale");
    await page.click('[data-a="back"]');
  });

  await check(page, "percorso e cluster letti dalle pagine del portale", async () => {
    await page.click('[data-scope="program"]');
    await expectText(page, "Cluster sicurezza");
    await page.click('[data-v="cluster"][data-id="22"]');
    await expectText(page, "Analisi dei dati con Python");
    await page.click('[data-a="back"]');
    await page.click('[data-scope="mine"]');
  });

  await check(page, "modifiche offline: avviso letto e attività completata in attesa", async () => {
    await page.click('[data-tab="avvisi"]');
    await expectText(page, "Nuovo annuncio: orario lezioni");
    await page.click('[data-a="notif"][data-id="1"]').catch(() => {});
    await expectText(page, "da inviare");
    await page.click('[data-tab="corsi"]');
    // Un secondo tocco sulla scheda torna all'elenco (la scheda ricorda la pagina aperta prima del giro sul portale).
    await page.click('[data-tab="corsi"]');
    await page.click('.content [data-v="course"][data-id="101"]');
    const button = page.locator('[data-a="mod-done"][data-m="556"]');
    if ((await button.innerText()).trim() !== "Spunta come completato") throw new Error("pulsante: " + (await button.innerText()));
    await button.click();
    await expectText(page, "da inviare al portale");
    if (!(await page.locator('[data-a="mod-done"][data-m="556"]').innerText()).includes("Completato")) throw new Error("pulsante non aggiornato");
    await page.click('[data-tab="home"]');
    await expectText(page, "2 modifiche da inviare");
  });

  await check(page, "aggiornamento con modifiche: conferma sul portale, poi applicate e tolte dalla coda", async () => {
    await page.click('[data-a="sync-now"]');
    await expectText(page, "partono 2 modifiche");
    await page.click('.sheet [data-a="sync-start"]');
    await page.waitForURL((u) => u.toString().startsWith(ORIGIN + "/my/"));
    await tapBookmark(page);
    await waitPanel(page, "applicare 2 modifiche");
    await shot(page, "p3-conferma");
    await page.click('[data-statale-open="ponte"] >> text=Applica e aggiorna');
    await page.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(page, "Dati aggiornati");
    if (!portal.st.notifications.find((n) => n.id === 1).read) throw new Error("avviso non letto sul portale");
    if (portal.st.completion[556] !== 1) throw new Error("attività non completata sul portale");
    const box = await page.evaluate(() => JSON.parse(localStorage.getItem("so.ponte.outbox")));
    if (Object.keys(box.ops).length) throw new Error("coda non vuota: " + Object.keys(box.ops));
    if (treePages() !== 7) throw new Error("percorsi riletti senza motivo");
  });

  await check(page, "attività a completamento automatico: rifiutata dal portale, stato ripristinato", async () => {
    await page.click('[data-tab="corsi"]');
    // Un secondo tocco sulla scheda torna all'elenco (la scheda ricorda la pagina aperta prima del giro sul portale).
    await page.click('[data-tab="corsi"]');
    await page.click('.content [data-v="course"][data-id="101"]');
    await page.click('[data-long="555"]', { button: "right" });
    await page.click('[data-a="ctx-toggle"]');
    await page.click('[data-tab="home"]');
    await page.click('[data-a="sync-now"]');
    await page.click('.sheet [data-a="sync-start"]');
    await page.waitForURL((u) => u.toString().startsWith(ORIGIN + "/my/"));
    await tapBookmark(page);
    await waitPanel(page, "applicare 1 modifica");
    await page.click('[data-statale-open="ponte"] >> text=Applica e aggiorna');
    await page.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(page, "Modifica non applicata: «E-tivity 1»");
    await expectText(page, "automatico");
  });

  await check(page, "richiesta persa al login: dati importati con conferma, modifica ancora in attesa", async () => {
    await page.click('[data-a="fail-dismiss"]');
    await page.click('[data-tab="avvisi"]');
    await page.click('[data-a="notif"][data-id="3"]');
    await page.click('[data-tab="home"]');
    await page.click('[data-a="sync-now"]');
    await page.click('.sheet [data-a="sync-start"]');
    await page.waitForURL((u) => u.toString().startsWith(ORIGIN + "/my/"));
    await page.goto(ORIGIN + "/my/"); // il login di Ateneo toglie il frammento
    await tapBookmark(page);
    await waitPanel(page, "Copia per l'app");
    await page.click("[data-statale-open=\"ponte\"] >> text=Apri l'app con i dati");
    await page.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(page, "Importare i dati letti dal portale");
    await page.click('.alert [data-i="1"]');
    await expectText(page, "non sono arrivate al portale");
    await expectText(page, "1 modifica da inviare");
  });

  await check(page, "preferito toccato due volte: un solo pannello", async () => {
    await page.goto(ORIGIN + "/my/");
    await tapBookmark(page);
    await tapBookmark(page);
    await waitPanel(page, "Copia per l'app");
    const n = await page.evaluate(() => document.querySelectorAll('[data-statale-open="ponte"]').length);
    if (n !== 1) throw new Error(n + " pannelli");
  });

  await check(page, "file scaricato dal pannello e importato nell'app", async () => {
    const [download] = await Promise.all([page.waitForEvent("download"), page.click('[data-statale-open="ponte"] >> text=Scarica i dati in un file')]);
    const file = await download.path();
    if (!/^SOP1\.z\./.test(fs.readFileSync(file, "utf8"))) throw new Error("file senza dati del ponte");
    await page.goto(APP);
    await expectText(page, "Ciao, Mario");
    await page.click('[data-a="sync-now"]');
    await page.setInputFiles("#ponte-file", file);
    await expectText(page, "Dati aggiornati");
  });

  await check(page, "pagina da ospite e sessione scaduta: messaggi nel pannello", async () => {
    portal.st.loggedIn = false;
    await page.goto(ORIGIN + "/");
    await tapBookmark(page);
    await waitPanel(page, "Non hai ancora effettuato l'accesso");
    portal.st.loggedIn = true;
    await page.goto(ORIGIN + "/my/");
    const real = portal.st.sesskey;
    portal.st.sesskey = "cambiata";
    await page.evaluate(() => { M.cfg.sesskey = "vecchiachiave"; });
    await tapBookmark(page);
    await waitPanel(page, "sessione del portale è scaduta");
    portal.st.sesskey = real;
  });

  await check(page, "preferito fuori dal portale e ponte modificato: avvisi chiari", async () => {
    await page.goto(APP);
    dialogs.length = 0;
    await page.evaluate(BOOKMARK);
    if (!dialogs.some((d) => d.includes("mentre sei su una pagina di La Statale Open"))) throw new Error("nessun avviso: " + dialogs.join(" | "));
    tamper = true;
    await page.goto(ORIGIN + "/my/");
    await page.evaluate(BOOKMARK);
    await page.waitForTimeout(1500);
    tamper = false;
    if (!dialogs.some((d) => d.includes("il ponte non si è caricato"))) throw new Error("ponte modificato eseguito lo stesso: " + dialogs.join(" | "));
    if (await page.evaluate(() => !!window.__statalePonte)) throw new Error("il ponte modificato è partito");
  });

  await check(page, "dati ostili in un link #ponte=: conferma, testo innocuo, nessun link esterno", async () => {
    const now = Date.now();
    const hostile = {
      f: "statale-open-ponte", v: 1, bv: 1, sid: "ostile12345678", at: now, user: { id: 42, name: "Mario Rossi", first: "<img src=x onerror=alert(1)>" },
      parts: { courses: true, events: true, notifs: true, user: true },
      courses: [{ id: 101, name: "<img src=x onerror=alert(2)>", short: "", progress: null, last: Math.floor(now / 1000) }],
      events: [{ id: 1, name: "Evento", c: 101, cn: "C", mod: "quiz", t: Math.floor(now / 1000) + 3600, u: "https://esterno.example/rubare", od: false, cm: null }],
      notifs: { unread: 1, list: [{ id: 9, s: "\"><script>alert(3)</script>", ctx: "", u: "javascript:alert(4)", t: Math.floor(now / 1000), r: false }] },
      contents: {}, warn: []
    };
    const env = await P.encode(hostile);
    dialogs.length = 0;
    await page.goto(APP + "#ponte=" + env);
    await expectText(page, "Importare i dati letti dal portale");
    await page.click('.alert [data-i="1"]');
    await expectText(page, "<img src=x onerror=alert(2)>");
    if (dialogs.length) throw new Error("finestra aperta dai dati: " + dialogs.join(" | "));
    const bad = await page.evaluate(() => Array.from(document.querySelectorAll("#device img, #device script, #device [data-url], #device a[href]")).map((e) => e.getAttribute("data-url") || e.getAttribute("href") || e.getAttribute("src") || "")
      .filter((u) => u && !u.startsWith("https://lastataleopen.myariel.unimi.it/") && !u.startsWith("https://github.com/") && !u.startsWith("https://leogen02.github.io/") && u !== "icon-192.png"));
    if (bad.length) throw new Error("indirizzi non consentiti: " + bad.join(", "));
    await page.click('[data-tab="altro"]');
    await page.click('[data-a="logout"]');
    await page.waitForSelector('[data-a="login-portal"]');
    const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("so.ponte.")));
    if (left.length) throw new Error("dati del ponte rimasti: " + left);
  });

  // ---------- App sulla schermata Home: i dati passano dagli appunti ----------
  portal = createPortal();
  const pwa = await newPage(true);
  await pwa.goto(APP);
  await check(pwa, "schermata Home: copia l'indirizzo, preferito in Safari, «Copia per l'app», «Incolla i dati»", async () => {
    await pwa.click('[data-a="login-portal"]');
    await expectText(pwa, "non vede le estensioni");
    await pwa.click('.content [data-a="sync"]');
    await pwa.click('.sheet [data-a="sync-start"]');
    await expectText(pwa, "Indirizzo copiato");
    const url = await pwa.evaluate(() => navigator.clipboard.readText());
    if (!url.startsWith(ORIGIN + "/my/#statale-open=SOQ1.")) throw new Error("negli appunti: " + url.slice(0, 60));
    const safari = await pwa.context().newPage();
    await safari.goto(url);
    await tapBookmark(safari);
    await waitPanel(safari, "Copia per l'app");
    await safari.click("[data-statale-open=\"ponte\"] >> text=Copia per l'app");
    await waitPanel(safari, "Copiato");
    await safari.close();
    await pwa.bringToFront();
    await pwa.click('.sheet [data-a="sync-paste"]');
    await expectText(pwa, "Ciao, Mario");
    await expectText(pwa, "Dati aggiornati");
    await shot(pwa, "p4-schermata-home");
  });
  await check(pwa, "incolla a mano", async () => {
    const { snap } = { snap: await P.collect({ wwwroot: ORIGIN, sesskey: portal.st.sesskey, userId: 42, requests: 0,
      fetch: async (u, init) => ({ ok: true, status: 200, type: "basic", text: async () => (init && init.method === "POST" ? portal.ajax(u, init.body) : portal.page(u)) }) }, null, () => {}) };
    const env = await P.encode(snap);
    await pwa.click('[data-a="sync-now"]');
    await pwa.click('[data-a="sync-manual"]');
    await pwa.fill("#paste-box", "testo intorno " + env + " altro");
    await expectText(pwa, "Dati aggiornati");
  });

  // ---------- Ponte automatico: lo script dell'estensione Userscripts, come lo esegue Safari ----------
  // A fine caricamento (@run-at document-end), con GM.getValue/setValue/deleteValue condivisi tra le pagine.
  portal = createPortal();
  const gm = new Map();
  const REQ_KEY = "statale-open-richiesta", LOGIN_KEY = "statale-open-accesso";
  // onlyApp: l'estensione consentita solo sulla pagina dell'app e non sul portale (permesso per sito in Safari).
  async function autoPage(onlyApp, source) {
    const page2 = await newPage(false);
    const context = page2.context();
    await context.exposeBinding("__statale_gm", (source, op, key, value) => {
      if (op === "get") return gm.has(key) ? gm.get(key) : null;
      if (op === "set") gm.set(key, value);
      if (op === "del") gm.delete(key);
      return null;
    });
    await context.addInitScript({ content: "(function(){" +
      "var GM={getValue:function(k,d){return window.__statale_gm('get',k).then(function(v){return v==null?d:v;});}," +
      "setValue:function(k,v){return window.__statale_gm('set',k,v);},deleteValue:function(k){return window.__statale_gm('del',k);}};" +
      "var run=function(){" + (onlyApp ? "if(location.hostname!=='leogen02.github.io')return;" : "") + "(function(GM){\n" + (source || USERSCRIPT) + "\n})(GM);};" +
      "if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();})();" });
    return page2;
  }
  const auto = await autoPage();
  await auto.goto(APP);
  const portalPosts = () => portal.st.posts;

  await check(auto, "estensione rilevata: «Accedi» apre il login di Ateneo e torna all'app con i dati", async () => {
    await expectText(auto, "pagina ufficiale del portale");
    await shot(auto, "p5-automatico-accesso");
    portal.st.loggedIn = false;
    await auto.click('[data-a="login-portal"]');
    await auto.waitForURL((u) => u.toString().startsWith(SSO), { timeout: 10000 });
    await auto.click("#sso-login");
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(auto, "Ciao, Mario");
    await expectText(auto, "Dati aggiornati");
    if (portal.st.logins !== 1) throw new Error("login di Ateneo non avvenuto");
    if (gm.has(REQ_KEY) || gm.has(LOGIN_KEY)) throw new Error("richiesta rimasta nell'archivio dell'estensione");
    await auto.click('[data-tab="altro"]');
    await expectText(auto, "attivo ✓");
    if ((await auto.getAttribute('[data-a="switch"][data-key="autoSync"]', "aria-checked")) !== "true") throw new Error("«Aggiorna da solo all'apertura» non acceso");
    await auto.click('[data-a="ponte-setup"]');
    await expectText(auto, "Ponte automatico attivo");
    await auto.click('[data-a="ponte-back"]');
    await auto.click('[data-tab="home"]');
  });

  await check(auto, "Home: «Aggiorna dal portale» va e torna da solo, nessun passaggio da fare", async () => {
    await expectText(auto, "Ponte automatico: un tocco");
    const before = portalPosts();
    await auto.click('[data-a="sync-now"]');
    await auto.waitForURL((u) => u.toString().startsWith(ORIGIN + "/"), { timeout: 10000 });
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(auto, "Dati aggiornati");
    if (await auto.locator(".sheet").count()) throw new Error("si è aperto il foglio dei passaggi");
    if (portalPosts() <= before) throw new Error("il portale non è stato letto");
    await shot(auto, "p6-automatico-home");
  });

  await check(auto, "sessione scaduta: login di Ateneo, poi il ponte riparte da solo e torna all'app", async () => {
    portal.st.loggedIn = false;
    const logins = portal.st.logins;
    await auto.click('[data-a="sync-now"]');
    await auto.waitForURL((u) => u.toString().startsWith(SSO), { timeout: 10000 });
    if (!gm.has(REQ_KEY)) throw new Error("richiesta non tenuta durante il login");
    await auto.click("#sso-login");
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(auto, "Dati aggiornati");
    if (portal.st.logins !== logins + 1) throw new Error("login non avvenuto");
    if (gm.has(REQ_KEY) || gm.has(LOGIN_KEY)) throw new Error("richiesta rimasta nell'archivio");
    const t = await auto.locator("#device").innerText();
    if (/non è tornato/.test(t)) throw new Error("avviso di giro non concluso dopo un giro riuscito");
  });

  await check(auto, "login direttamente dalla pagina di Ateneo: dopo «Entra» torna all'app con i dati, senza conferme", async () => {
    if (!gm.has("statale-open-dopo-login")) throw new Error("l'app non ha lasciato la richiesta per il ritorno dopo il login");
    portal.st.loggedIn = false;
    const logins = portal.st.logins, posts = portalPosts();
    await auto.goto(SSO + "?url=" + encodeURIComponent(ORIGIN + "/login/index.php"));
    await auto.click("#sso-login");
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(auto, "Dati aggiornati");
    if (portal.st.logins !== logins + 1 || portalPosts() <= posts) throw new Error("login o lettura non avvenuti");
    const t = await auto.locator("#device").innerText();
    if (/Dati dal portale|Importare i dati/.test(t)) throw new Error("chiesta una conferma per i dati del ritorno dopo il login");
    if (gm.has("statale-open-accesso")) throw new Error("annotazione del login rimasta");
    await auto.waitForTimeout(300);
    if (!gm.has("statale-open-dopo-login")) throw new Error("nessuna richiesta nuova per il prossimo login");
    await shot(auto, "p8-ritorno-dopo-login");
  });

  await check(auto, "dopo il login, un'attività aperta resta aperta (niente ritorno all'app)", async () => {
    portal.st.loggedIn = false;
    await auto.goto(SSO + "?url=" + encodeURIComponent(ORIGIN + "/login/index.php"));
    portal.st.loggedIn = true;
    const posts = portalPosts();
    await auto.goto(ORIGIN + "/mod/assign/view.php?id=555");
    await auto.waitForTimeout(1200);
    if (!auto.url().startsWith(ORIGIN + "/mod/assign/") || portalPosts() !== posts) throw new Error("attività dirottata verso l'app");
    await auto.goto(ORIGIN + "/my/");
    await auto.waitForTimeout(1200);
    if (!auto.url().startsWith(ORIGIN + "/my/") || portalPosts() !== posts) throw new Error("la Dashboard aperta più tardi è tornata all'app");
    await auto.goto(APP);
    await expectText(auto, "Aggiorna dal portale");
  });

  await check(auto, "«Torna all'app dopo il login sul portale» spento: dopo il login si resta sul portale", async () => {
    await auto.click('[data-tab="altro"]');
    await auto.click('[data-a="switch"][data-key="loginReturn"]');
    await auto.waitForTimeout(300);
    if (gm.has("statale-open-dopo-login")) throw new Error("richiesta per il ritorno rimasta nello script");
    portal.st.loggedIn = false;
    const posts = portalPosts();
    await auto.goto(SSO + "?url=" + encodeURIComponent(ORIGIN + "/login/index.php"));
    await auto.click("#sso-login");
    await auto.waitForURL((u) => u.toString().startsWith(ORIGIN + "/my/"), { timeout: 10000 });
    await auto.waitForTimeout(1200);
    if (!auto.url().startsWith(ORIGIN + "/my/") || portalPosts() !== posts) throw new Error("tornato all'app con il ritorno spento");
    await auto.goto(APP);
    await auto.click('[data-tab="altro"]');
    await auto.click('[data-a="switch"][data-key="loginReturn"]');
    await auto.waitForTimeout(300);
    if (!gm.has("statale-open-dopo-login")) throw new Error("riacceso, ma nessuna richiesta");
    await auto.click('[data-tab="home"]');
  });

  await check(auto, "Dashboard aperta dall'app: dopo il login lì si resta; tornando all'app il ritorno si riattiva", async () => {
    if (!gm.has("statale-open-dopo-login")) throw new Error("richiesta per il ritorno assente prima del test");
    const [popup] = await Promise.all([auto.waitForEvent("popup"), auto.click('[data-a="open"][data-url="' + ORIGIN + '/my/"]')]);
    await auto.waitForTimeout(300);
    if (gm.has("statale-open-dopo-login")) throw new Error("ritorno ancora attivo mentre è aperta la Dashboard");
    await popup.close().catch(() => {});
    await auto.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await auto.waitForTimeout(300);
    if (!gm.has("statale-open-dopo-login")) throw new Error("ritorno non riattivato tornando all'app");
  });

  await check(auto, "«Invia subito le modifiche» spento: unica conferma sul portale, poi ritorno automatico", async () => {
    await auto.click('[data-tab="altro"]');
    if ((await auto.getAttribute('[data-a="switch"][data-key="autoSend"]', "aria-checked")) !== "true") throw new Error("invio automatico non acceso di serie");
    await auto.click('[data-a="switch"][data-key="autoSend"]');
    await auto.click('[data-tab="avvisi"]');
    await auto.click('[data-a="mark-read"][data-id="3"]', { force: true }).catch(() => auto.click('[data-a="notif"][data-id="3"]'));
    await auto.click('[data-tab="home"]');
    await auto.click('[data-a="sync-now"]');
    await auto.waitForURL((u) => u.toString().startsWith(ORIGIN + "/"), { timeout: 10000 });
    await waitPanel(auto, "applicare 1 modifica");
    await auto.click('[data-statale-open="ponte"] >> text=Applica e aggiorna');
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(auto, "Dati aggiornati");
    if (!portal.st.notifications.find((n) => n.id === 3).read) throw new Error("avviso non segnato sul portale");
    await auto.click('[data-tab="altro"]');
    await auto.click('[data-a="switch"][data-key="autoSend"]');
    await auto.click('[data-tab="home"]');
  });

  await check(auto, "invio automatico: «Spunta come completato» arriva al portale da solo e si torna alla stessa schermata", async () => {
    await auto.click('[data-tab="corsi"]');
    // Un secondo tocco sulla scheda torna all'elenco (la scheda ricorda la pagina aperta prima del giro sul portale).
    await auto.click('[data-tab="corsi"]');
    await auto.click('.content [data-v="course"][data-id="101"]');
    await expectText(auto, "Modulo 1 & introduzione");
    const before = portal.st.completion[556];
    // Posizione nella pagina del corso: deve restare dopo il giro sul portale.
    const scrolled = await auto.evaluate(() => { const c = document.querySelector("#content"); c.scrollTop = Math.min(140, c.scrollHeight - c.clientHeight); return c.scrollTop; });
    await auto.click('[data-a="mod-done"][data-m="556"]');
    await expectText(auto, "tra pochi secondi");
    await auto.waitForURL((u) => u.toString().startsWith(ORIGIN + "/"), { timeout: 25000 });
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(auto, "arrivata al portale");
    await expectText(auto, "Modulo 1 & introduzione");
    await auto.waitForTimeout(400);
    const restored = await auto.evaluate(() => document.querySelector("#content").scrollTop);
    if (scrolled > 20 && Math.abs(restored - scrolled) > 4) throw new Error("posizione persa: " + scrolled + " → " + restored);
    if (portal.st.completion[556] === before || portal.st.completion[556] !== 1) throw new Error("attività non completata sul portale");
    if (!(await auto.locator('[data-a="mod-done"][data-m="556"]').innerText()).includes("Completato")) throw new Error("pulsante non aggiornato dopo il ritorno");
    const box = await auto.evaluate(() => JSON.parse(localStorage.getItem("so.ponte.outbox")));
    if (Object.keys(box.ops).length) throw new Error("coda non vuota: " + Object.keys(box.ops));
    // Niente nuovi giri senza nuove modifiche.
    const posts = portalPosts();
    await auto.waitForTimeout(10000);
    if (!auto.url().startsWith(APP) || portalPosts() !== posts) throw new Error("è ripartito senza modifiche nuove");
    await shot(auto, "p9-invio-automatico");
  });

  await check(auto, "attività che il portale non lascia spuntare: avviso, stato ripristinato, pulsante tolto", async () => {
    await auto.click('[data-a="mod-done"][data-m="555"]');
    await auto.waitForURL((u) => u.toString().startsWith(ORIGIN + "/"), { timeout: 25000 });
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(auto, "Dati aggiornati");
    if (await auto.locator('[data-a="mod-done"][data-m="555"]').count()) throw new Error("pulsante ancora presente per un completamento automatico");
    await auto.click('[data-tab="home"]');
    await expectText(auto, "Modifica non applicata");
    await auto.click('[data-a="fail-dismiss"]');
  });

  await check(auto, "link al portale costruito da altri (anche ripetuto): il ponte non parte", async () => {
    const forged = C.buildRequest({ seq: 0, ops: { "done:557": { k: "done", cm: 557, v: 0, n: 1 } } }, { ret: "frag", tree: 2 }).text;
    const posts = portalPosts(), pages = portal.st.pages.length;
    for (let i = 0; i < 3; i++) {
      await auto.goto(ORIGIN + "/?n=" + i + "#statale-open=" + forged);
      await auto.waitForTimeout(700);
    }
    const injected = await auto.evaluate(() => !!document.querySelector('script[src*="ponte-1.js"]') || !!window.__statalePonte);
    if (injected) throw new Error("ponte avviato da un link non chiesto dall'app");
    if (portalPosts() !== posts) throw new Error("richieste al portale da un link esterno");
    if (gm.has(REQ_KEY)) throw new Error("un link esterno ha registrato una richiesta");
    portal.st.loggedIn = false;
    await auto.goto(ORIGIN + "/#statale-open=" + forged);
    await auto.waitForTimeout(700);
    if (auto.url().startsWith(SSO) || gm.has(REQ_KEY)) throw new Error("un link esterno ha avviato il giro del login");
    portal.st.loggedIn = true;
    await auto.goto(APP);
  });

  await check(auto, "sul portale senza richiesta lo script non fa nulla", async () => {
    const posts = portalPosts();
    await auto.goto(ORIGIN + "/my/");
    await auto.waitForTimeout(1200);
    const injected = await auto.evaluate(() => !!document.querySelector('script[src*="ponte-1.js"]') || !!window.__statalePonte);
    if (injected) throw new Error("ponte avviato senza richiesta");
    if (portalPosts() !== posts) throw new Error("richieste al portale senza richiesta dell'app");
    await auto.goto(APP);
  });

  await check(auto, "aggiorna da solo all'apertura (dati vecchi), senza ripartire in cerchio", async () => {
    await auto.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("so.ponte.snap"));
      s.at -= 3 * 3600e3;
      localStorage.setItem("so.ponte.snap", JSON.stringify(s));
      localStorage.removeItem("so.ponte.req");
    });
    const posts = portalPosts();
    await auto.goto(APP);
    await auto.waitForURL((u) => u.toString().startsWith(ORIGIN + "/"), { timeout: 10000 });
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(auto, "Dati aggiornati");
    if (portalPosts() <= posts) throw new Error("non ha aggiornato");
    const after = portalPosts();
    await auto.waitForTimeout(2500);
    if (!auto.url().startsWith(APP) || portalPosts() !== after) throw new Error("è ripartito da solo dopo il ritorno");
    // Dati freschi: riaprendo l'app non riparte.
    await auto.goto(APP);
    await auto.waitForTimeout(2000);
    if (!auto.url().startsWith(APP) || portalPosts() !== after) throw new Error("aggiornato con dati freschi");
  });

  await check(auto, "giro automatico che non torna: avviso e strada del preferito, nessun nuovo tentativo", async () => {
    await auto.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("so.ponte.snap"));
      s.at -= 3 * 3600e3;
      localStorage.setItem("so.ponte.snap", JSON.stringify(s));
      localStorage.setItem("so.ponte.req", JSON.stringify({ rid: "abcdefghijklmnopqrstuv", at: Date.now(), ret: "frag", tree: null, keys: [], auto: true }));
    });
    const posts = portalPosts();
    await auto.goto(APP);
    await expectText(auto, "non è tornato con i dati");
    await expectText(auto, "Istruzioni e preferito di riserva");
    await auto.waitForTimeout(1500);
    if (!auto.url().startsWith(APP) || portalPosts() !== posts) throw new Error("nuovo tentativo automatico subito dopo uno non concluso");
  });

  await check(auto, "dopo un giro automatico non tornato, all'apertura non riprova da solo", async () => {
    await auto.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("so.ponte.snap"));
      s.at -= 3 * 3600e3;
      localStorage.setItem("so.ponte.snap", JSON.stringify(s));
      localStorage.setItem("so.ponte.req", JSON.stringify({ rid: "abcdefghijklmnopqrstuv", at: Date.now() - 20 * 60e3, ret: "frag", tree: null, keys: [], auto: true }));
      localStorage.setItem("so.ponte.last", JSON.stringify({ sid: "precedente", at: Date.now() - 30 * 60e3 }));
    });
    const posts = portalPosts();
    await auto.goto(APP);
    await expectText(auto, "Aggiorna dal portale");
    await auto.waitForTimeout(2000);
    if (!auto.url().startsWith(APP) || portalPosts() !== posts) throw new Error("ha riprovato da solo dopo un giro fallito");
    await expectText(auto, "in pausa");
  });

  await check(auto, "ritorno automatico spento: dati dagli appunti, nessun falso avviso, «Incolla» visibile", async () => {
    await auto.click('[data-tab="altro"]');
    await auto.click('[data-a="switch"][data-key="autoReturn"]');
    await auto.click('[data-tab="home"]');
    await auto.click('[data-a="sync-now"]');
    await auto.waitForURL((u) => u.toString().startsWith(ORIGIN + "/"), { timeout: 10000 });
    await waitPanel(auto, "Copia per l'app");
    await auto.click("[data-statale-open=\"ponte\"] >> text=Copia per l'app");
    await waitPanel(auto, "Copiato");
    await auto.goto(APP);
    await expectText(auto, "Incolla i dati copiati dal portale");
    const t = await auto.locator("#device").innerText();
    if (/non è tornato/.test(t)) throw new Error("avviso di giro non concluso con il ritorno dagli appunti");
    await auto.click('[data-a="sync-paste"]');
    await expectText(auto, "Dati aggiornati");
    await auto.click('[data-tab="altro"]');
    await auto.click('[data-a="switch"][data-key="autoReturn"]');
  });

  await check(auto, "avvisi: tutti quelli da leggere (oltre 50), per argomento, cerca, segna letti un gruppo", async () => {
    const now = Math.floor(Date.now() / 1000);
    const topics = [
      { component: "mod_forum", contexturlname: "Annunci", customdata: JSON.stringify({ cmid: 560, courseid: 101 }), url: "/mod/forum/discuss.php?d=" },
      { component: "mod_assign", contexturlname: "E-tivity 1", url: "/mod/assign/view.php?id=555&x=" },
      { component: "moodle", eventtype: "gradenotifications", contexturlname: "Sicurezza delle reti", url: "/grade/report/user/index.php?id=103&x=" },
      { component: "moodle", contexturlname: "", url: "/user/profile.php?x=" }
    ];
    portal.st.notifications = Array.from({ length: 260 }, (_, i) => {
      const t = topics[i % topics.length];
      return { id: 5000 + i, subject: "Avviso numero " + i, timecreated: now - i * 300, read: i >= 172, contexturl: ORIGIN + t.url + i,
        contexturlname: t.contexturlname, component: t.component, eventtype: t.eventtype || "", customdata: t.customdata };
    });
    await auto.click('[data-a="sync-now"]').catch(async () => { await auto.click('[data-tab="home"]'); await auto.click('[data-a="sync-now"]'); });
    await auto.waitForURL((u) => u.toString().startsWith(ORIGIN + "/"), { timeout: 10000 });
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 20000 });
    await expectText(auto, "Dati aggiornati");
    await auto.click('[data-tab="avvisi"]');
    await auto.click('[data-tab="avvisi"]');
    if ((await auto.locator(".tab .badge").innerText()).trim() !== "172") throw new Error("badge: " + (await auto.locator(".tab .badge").innerText()));
    const stored = await auto.evaluate(() => JSON.parse(localStorage.getItem("so.ponte.snap")).notifs.list.filter((n) => !n.r).length);
    if (stored !== 172) throw new Error("avvisi da leggere nei dati: " + stored);
    await expectText(auto, "Per argomento");
    await expectText(auto, "Fondamenti di cybersecurity");
    await expectText(auto, "Sicurezza delle reti");
    await shot(auto, "p10-avvisi-argomenti");
    // Il gruppo del corso 101 (annunci + e-tivity): 86 da leggere.
    const pill = await auto.locator('[data-a="notif-group"][data-k="c101"] .pill').innerText();
    if (pill.trim() !== "86") throw new Error("da leggere nel corso 101: " + pill);
    await auto.click('[data-a="notif-mode"][data-k="kind"]');
    await expectText(auto, "Valutazioni");
    await expectText(auto, "Forum e annunci");
    await auto.click('[data-a="notif-mode"][data-k="topic"]');
    await auto.fill("#q-notif", "numero 171");
    await expectText(auto, "Avviso numero 171");
    if (await auto.locator('[data-a="notif"][data-id="5170"]').count()) throw new Error("ricerca non filtra");
    await auto.fill("#q-notif", "");
    await auto.click('[data-a="read-group"][data-k="c103"]');
    await expectText(auto, "avvisi segnati come letti");
    await auto.waitForURL((u) => u.toString().startsWith(ORIGIN + "/"), { timeout: 30000 });
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 20000 });
    await expectText(auto, "arrivate al portale");
    const unreadLeft = portal.st.notifications.filter((n) => !n.read).length;
    if (unreadLeft !== 172 - 43) throw new Error("da leggere sul portale dopo il gruppo: " + unreadLeft);
    // Il portale non dà le pagine oltre i primi 100: i dati arrivano lo stesso, gli avvisi già visti restano da leggere.
    portal.st.notifFailFrom = 100;
    await auto.click('[data-tab="home"]');
    await auto.click('[data-a="sync-now"]');
    await auto.waitForURL((u) => u.toString().startsWith(ORIGIN + "/"), { timeout: 10000 });
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 20000 });
    await expectText(auto, "avvisi (in parte)");
    portal.st.notifFailFrom = null;
    const partial = await auto.evaluate(() => { const s = JSON.parse(localStorage.getItem("so.ponte.snap")); return [s.notifs.part, s.notifs.unread, s.notifs.list.filter((n) => !n.r).length]; });
    if (partial.join() !== "1,129,129") throw new Error("lettura in parte (parziale, portale, elenco): " + partial);
    if ((await auto.locator(".tab .badge").innerText()).trim() !== "129") throw new Error("badge dopo la lettura in parte");
  });

  await check(auto, "note: nuova nota da Home, salvata mentre scrivi, nota di un corso", async () => {
    await auto.click('[data-tab="home"]');
    await auto.click('[data-tab="home"]');
    await expectText(auto, "Le mie note");
    await auto.click('.content [data-a="note-new"]');
    await auto.fill("#note-title", "Esame di crittografia");
    await auto.fill("#note-body", "Ripassare RSA e firme.\nPortare la calcolatrice.");
    await auto.waitForTimeout(700);
    const stored = await auto.evaluate(() => JSON.parse(localStorage.getItem("so.notes")).notes[0]);
    if (stored.title !== "Esame di crittografia" || !stored.body.includes("calcolatrice")) throw new Error("nota non salvata: " + JSON.stringify(stored));
    await auto.click('[data-a="back"]');
    await expectText(auto, "Esame di crittografia");
    // Nota di un corso, dal corso.
    await auto.click('[data-tab="corsi"]');
    await auto.click('[data-tab="corsi"]');
    await auto.click('.content [data-v="course"][data-id="101"]');
    await auto.click('[data-a="push"][data-v="note"][data-id="101"]');
    await auto.click('.content [data-a="note-new"]');
    await auto.fill("#note-title", "Domande per il docente");
    await auto.waitForTimeout(700);
    const course = await auto.evaluate(() => JSON.parse(localStorage.getItem("so.notes")).notes.find((n) => n.title === "Domande per il docente").course);
    if (course !== 101) throw new Error("corso della nota: " + course);
    await auto.click('[data-a="back"]');
    await expectText(auto, "Domande per il docente");
    const t = await auto.locator("#device").innerText();
    if (t.includes("Esame di crittografia")) throw new Error("nella lista del corso c'è una nota di altro");
    await auto.click('[data-tab="home"]');
  });

  await check(auto, "note su GitHub: repository pubblico rifiutato, privato collegato, unione con un altro dispositivo, eliminazione", async () => {
    await auto.click('[data-tab="altro"]');
    await auto.click('[data-a="push"][data-v="notegit"]');
    await expectText(auto, "Crea il repository privato");
    gh.private = false;
    await auto.fill("#git-token", gh.token);
    await auto.click('[data-a="notes-link"]');
    await expectText(auto, "Il repository è pubblico");
    if (gh.file !== null) throw new Error("scritto in un repository pubblico");
    gh.private = true;
    await auto.click('[data-a="notes-link"]');
    await expectText(auto, "Note sincronizzate con GitHub");
    const saved = JSON.parse(gh.file);
    if (saved.app !== "statale-open-note" || saved.notes.length !== 2 || !saved.notes.some((n) => n.title === "Esame di crittografia")) throw new Error("file su GitHub: " + gh.file.slice(0, 200));
    const local = await auto.evaluate(() => localStorage.getItem("so.notes.github"));
    if (!local.includes(gh.token) || JSON.stringify(await auto.evaluate(() => localStorage.getItem("so.ponte.snap"))).includes(gh.token)) throw new Error("chiave fuori posto");
    // Un altro dispositivo aggiunge una nota e ne modifica una.
    const other = JSON.parse(gh.file);
    const later = Date.now();
    other.notes.push({ id: "altroDispositivo1", title: "Scritta sull'iPad", body: "ciao", course: null, created: later, updated: later });
    other.notes.find((n) => n.title === "Esame di crittografia").body = "Cambiata altrove";
    other.notes.find((n) => n.title === "Esame di crittografia").updated = later;
    gh.file = JSON.stringify(other); gh.sha += 1;
    await auto.click('[data-a="notes-sync"]');
    await auto.waitForFunction(() => (localStorage.getItem("so.notes") || "").includes("Scritta sull'iPad"), null, { timeout: 8000 });
    const merged = await auto.evaluate(() => JSON.parse(localStorage.getItem("so.notes")).notes);
    if (!merged.some((n) => n.title === "Scritta sull'iPad") || merged.find((n) => n.title === "Esame di crittografia").body !== "Cambiata altrove") throw new Error("unione: " + JSON.stringify(merged).slice(0, 300));
    // Eliminazione: arriva anche su GitHub.
    await auto.click('[data-tab="home"]');
    await auto.click('[data-a="note-open"]');
    await auto.click('[data-a="note-delete"]');
    await auto.click('.alert button.destructive');
    await expectText(auto, "Nota eliminata");
    await auto.waitForTimeout(5500);
    const after = JSON.parse(gh.file).notes;
    if (after.filter((n) => n.deleted).length !== 1) {
      const loc = await auto.evaluate(() => [localStorage.getItem("so.notes"), localStorage.getItem("so.notes.github")]);
      throw new Error("eliminazione non arrivata su GitHub (" + gh.puts + " scritture): " + loc.join(" | ").slice(0, 900));
    }
    await shot(auto, "p11-note");
  });

  await check(auto, "note su GitHub: la nota aperta si aggiorna, le modifiche durante l'invio arrivano, conflitti continui segnalati", async () => {
    // Come al ritorno in primo piano dopo più di un minuto.
    const comeBack = () => auto.evaluate(() => {
      const g = JSON.parse(localStorage.getItem("so.notes.github")); g.syncedAt = 0; localStorage.setItem("so.notes.github", JSON.stringify(g));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    const elsewhere = (body) => {
      const f = JSON.parse(gh.file), n = f.notes.find((x) => x.id === "altroDispositivo1");
      n.body = body; n.updated = Date.now();
      gh.file = JSON.stringify(f); gh.sha += 1;
    };
    await auto.click('[data-tab="home"]');
    await auto.click('[data-a="note-open"]:has-text("Scritta sull")');
    await auto.waitForSelector("#note-body");
    // Cambiata altrove mentre è aperta (senza scrivere): si vede la versione nuova.
    elsewhere("Aggiornata sul portatile");
    await comeBack();
    await auto.waitForFunction(() => document.querySelector("#note-body") && document.querySelector("#note-body").value === "Aggiornata sul portatile", null, { timeout: 8000 });
    // Cambiata altrove mentre scrivi qui: il campo si aggiorna, il cursore resta, e la riga aggiunta si somma.
    await auto.focus("#note-body");
    elsewhere("Seconda dal portatile");
    await comeBack();
    await auto.waitForFunction(() => document.querySelector("#note-body").value === "Seconda dal portatile", null, { timeout: 8000 });
    if (await auto.evaluate(() => document.activeElement.id) !== "note-body") throw new Error("campo non più attivo");
    await auto.press("#note-body", "End");
    await auto.keyboard.type(" +riga");
    await auto.waitForFunction(() => (localStorage.getItem("so.notes") || "").includes("Seconda dal portatile +riga"), null, { timeout: 5000 });
    for (let i = 0; i < 40 && !gh.file.includes("Seconda dal portatile +riga"); i++) await auto.waitForTimeout(250);
    if (!gh.file.includes("Seconda dal portatile +riga")) throw new Error("modifica non arrivata su GitHub");
    // Una modifica mentre la scrittura su GitHub è in corso: arriva con la sincronizzazione seguente.
    gh.putDelay = 5000;
    await auto.keyboard.type(" A");
    for (let i = 0; i < 40 && !gh.inflight; i++) await auto.waitForTimeout(250);
    if (!gh.inflight) throw new Error("scrittura lenta non partita");
    await auto.keyboard.type(" B");
    for (let i = 0; i < 80 && !gh.file.includes("+riga A B"); i++) await auto.waitForTimeout(250);
    gh.putDelay = 0;
    if (!gh.file.includes("+riga A B")) throw new Error("modifica fatta durante l'invio non arrivata: " + JSON.parse(gh.file).notes.find((x) => x.id === "altroDispositivo1").body);
    // GitHub rifiuta ogni scrittura (il file cambia di continuo): niente «sincronizzate», errore e nuovo tentativo.
    gh.conflict = true;
    await auto.keyboard.type(" C");
    await auto.waitForFunction(() => /cambiato più volte/.test((document.querySelector("#note-sync") || {}).textContent || ""), null, { timeout: 15000 });
    gh.conflict = false;
    await comeBack();
    for (let i = 0; i < 40 && !gh.file.includes("A B C"); i++) await auto.waitForTimeout(250);
    if (!gh.file.includes("A B C")) throw new Error("nessun nuovo tentativo dopo i conflitti");
    await auto.evaluate(() => document.activeElement && document.activeElement.blur());
  });

  portal = createPortal();
  const old = await autoPage(false, USERSCRIPT_V1);
  await old.goto(APP);
  await check(old, "script 1 ancora installato: funziona e l'app invita ad aggiornarlo", async () => {
    await old.click('[data-a="login-portal"]');
    await old.waitForURL((u) => u.toString().startsWith(APP + "#") || u.toString() === APP, { timeout: 15000 }).catch(() => {});
    await expectText(old, "Dati aggiornati", 15000);
    await expectText(old, "Aggiorna lo script del ponte automatico");
    await old.click('[data-a="ponte-setup"]');
    await expectText(old, "Aggiorna lo script (versione " + C.PONTE.userscriptVersion + ")");
    if ((await old.getAttribute('[data-a="script-opened"]', "href")) !== APP + C.PONTE.userscript) throw new Error("link allo script nuovo sbagliato");
    gm.clear();
  });

  const half = await autoPage(true);
  await half.goto(APP);
  await check(half, "estensione non consentita sul portale: «Accedi» non torna, riaprendo l'app spiegazione, preferito e «Incolla»", async () => {
    await expectText(half, "pagina ufficiale del portale");
    await half.click('[data-a="login-portal"]');
    await half.waitForURL((u) => u.toString().startsWith(ORIGIN + "/"), { timeout: 10000 });
    await half.waitForTimeout(1200);
    if (!half.url().startsWith(ORIGIN + "/")) throw new Error("tornato all'app senza il ponte sul portale");
    await half.goto(APP);
    await expectText(half, "non è tornato con i dati");
    await expectText(half, "consenti sempre l'accesso");
    for (const a of ["ponte-bookmark", "sync", "sync-now"]) if (!(await half.locator('[data-a="' + a + '"]').count())) throw new Error("manca " + a);
    await shot(half, "p7-accesso-non-tornato");
    gm.clear();
  });

  await check(page, "senza estensione: «Aggiorna dal portale» apre i passaggi del preferito", async () => {
    portal = createPortal();
    await page.goto(APP);
    await page.click('[data-a="login-portal"]');
    await expectText(page, "ponte automatico");
    const t = await page.locator("#device").innerText();
    if (/attivo ✓/.test(t)) throw new Error("ponte automatico segnato come attivo senza estensione");
    const [download] = await Promise.all([page.waitForEvent("download"), page.click('[data-a="userscript-download"]')]);
    if (download.suggestedFilename() !== C.PONTE.userscript.split("/").pop()) throw new Error("nome del file: " + download.suggestedFilename());
    const text = fs.readFileSync(await download.path(), "utf8");
    if (text !== USERSCRIPT) throw new Error("il file scaricato non è lo script pubblicato");
  });

  console.log("\n" + passed + " controlli superati" + (errors.length ? ", " + errors.length + " problemi:\n" + errors.join("\n") : ", nessun problema."));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
