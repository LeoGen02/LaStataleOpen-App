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

let portal = createPortal();
let tamper = false;
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
  await context.route("https://api.github.com/**", (route) => route.fulfill({ status: 200, headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    body: JSON.stringify({ tag_name: "v" + C.PONTE.version + ".0.0-test", html_url: "https://github.com/LeoGen02/LaStataleOpen-App/releases" }) }));
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
    await page.click('.content [data-v="course"][data-id="101"]');
    await page.click('[data-long="556"]', { button: "right" });
    await page.click('[data-a="ctx-toggle"]');
    await expectText(page, "da inviare al portale");
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
  // onlyApp: l'estensione consentita solo sulla pagina dell'app e non sul portale (permesso per sito in Safari).
  async function autoPage(onlyApp) {
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
      "var run=function(){" + (onlyApp ? "if(location.hostname!=='leogen02.github.io')return;" : "") + "(function(GM){\n" + USERSCRIPT + "\n})(GM);};" +
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
    if (gm.size) throw new Error("richiesta rimasta nell'archivio dell'estensione");
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
    if (gm.size !== 1) throw new Error("richiesta non tenuta durante il login");
    await auto.click("#sso-login");
    await auto.waitForURL((u) => u.toString().startsWith(APP), { timeout: 15000 });
    await expectText(auto, "Dati aggiornati");
    if (portal.st.logins !== logins + 1) throw new Error("login non avvenuto");
    if (gm.size) throw new Error("richiesta rimasta nell'archivio");
    const t = await auto.locator("#device").innerText();
    if (/non è tornato/.test(t)) throw new Error("avviso di giro non concluso dopo un giro riuscito");
  });

  await check(auto, "modifiche in attesa: unica conferma sul portale, poi ritorno automatico", async () => {
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
    if (gm.size) throw new Error("un link esterno ha registrato una richiesta");
    portal.st.loggedIn = false;
    await auto.goto(ORIGIN + "/#statale-open=" + forged);
    await auto.waitForTimeout(700);
    if (auto.url().startsWith(SSO) || gm.size) throw new Error("un link esterno ha avviato il giro del login");
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
    if (download.suggestedFilename() !== "statale-open-1.user.js") throw new Error("nome del file: " + download.suggestedFilename());
    const text = fs.readFileSync(await download.path(), "utf8");
    if (text !== USERSCRIPT) throw new Error("il file scaricato non è lo script pubblicato");
  });

  console.log("\n" + passed + " controlli superati" + (errors.length ? ", " + errors.length + " problemi:\n" + errors.join("\n") : ", nessun problema."));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
