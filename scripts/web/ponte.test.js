// Test del ponte con il portale: lo script che gira sul portale (docs/ponte/ponte-1.js) e la parte dell'app che ne
// riceve i dati (docs/core.js). Esegui con: node --test scripts/web/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const C = require("../../docs/core.js");
const P = require("../../docs/ponte/ponte-1.js");
const { createPortal, ORIGIN } = require("./mock-portal.js");

const DOCS = path.resolve(__dirname, "../../docs");
const APP_BASE = "https://leogen02.github.io/LaStataleOpen-App/";
const sri = (file) => "sha384-" + crypto.createHash("sha384").update(fs.readFileSync(path.join(DOCS, file))).digest("base64");

// Portale simulato collegato al ponte come lo è la pagina vera (fetch dello stesso sito).
function envFor(portal) {
  return {
    wwwroot: ORIGIN, sesskey: portal.st.sesskey, userId: portal.st.userId, appBase: APP_BASE, requests: 0,
    fetch: async (url, init) => {
      const u = new URL(url);
      if (u.origin !== ORIGIN) throw new Error("richiesta fuori dal portale: " + url);
      const text = init && init.method === "POST" ? portal.ajax(url, init.body) : portal.page(url);
      return { ok: true, status: 200, type: "basic", text: async () => text };
    }
  };
}
async function snapshotFrom(portal, req) {
  const env = envFor(portal);
  const snap = await P.collect(env, req || null, () => {});
  return { snap, env };
}

test("i file del ponte pubblicati non cambiano mai (impronta SRI)", () => {
  const files = fs.readdirSync(path.join(DOCS, "ponte")).filter((f) => /^ponte-\d+\.js$/.test(f)).map((f) => "ponte/" + f);
  assert.ok(files.includes(C.PONTE.file), "manca " + C.PONTE.file);
  for (const file of files) {
    assert.equal(C.PONTE.known[file], sri(file), file + " è cambiato: i preferiti installati non lo eseguirebbero più. Crea un file nuovo (ponte-N.js). Impronta attuale: " + sri(file));
  }
  assert.equal(C.PONTE.sri, C.PONTE.known[C.PONTE.file]);
  assert.equal(P.VERSION, C.PONTE.version);
  assert.equal(P.FILE, C.PONTE.file);
});

test("il codice del preferito: ASCII, impronta e indirizzo giusti, niente %", () => {
  const b = C.bookmarklet(APP_BASE);
  assert.match(b, /^javascript:[\x21-\x7E]+$/);
  assert.ok(b.length < 1200, "preferito troppo lungo: " + b.length);
  const code = decodeURIComponent(b.slice("javascript:".length));
  assert.ok(code.includes('s.src="' + APP_BASE + "ponte/ponte-1.js\""));
  assert.ok(code.includes('s.integrity="' + C.PONTE.sri + '"'));
  assert.ok(code.includes('s.crossOrigin="anonymous"') && code.includes('s.referrerPolicy="no-referrer"'));
  assert.ok(code.includes('location.hostname!=="lastataleopen.myariel.unimi.it"'));
  assert.ok(code.includes("non si è caricato"));
  assert.doesNotThrow(() => new Function(code), "il codice del preferito non è JavaScript valido");
});

test("il ponte usa solo le API consentite", () => {
  const src = fs.readFileSync(path.join(DOCS, C.PONTE.file), "utf8");
  const forbidden = ["innerHTML", "outerHTML", "insertAdjacentHTML", "eval(", "new Function", "document.write", "document.cookie", ".cookie",
    "localStorage", "sessionStorage", "indexedDB", "XMLHttpRequest", "sendBeacon", "postMessage", "WebSocket", "importScripts", "window.open", "Worker("];
  for (const word of forbidden) assert.ok(!src.includes(word), "il ponte contiene " + word);
  const methods = src.match(/"(?:core|message|tool|mod|gradereport|block)_[a-z0-9_]+"/g) || [];
  assert.ok(methods.length >= 7);
  for (const m of methods) assert.ok(P.ALLOWED.includes(JSON.parse(m)), "funzione non consentita nel codice: " + m);
  assert.deepEqual(P.ALLOWED.slice().sort(), [
    "core_calendar_get_action_events_by_timesort", "core_completion_update_activity_completion_status_manually", "core_course_get_enrolled_courses_by_timeline_classification",
    "core_courseformat_get_state", "core_message_mark_notification_read", "core_user_get_users_by_field", "message_popup_get_popup_notifications"]);
  // Nessun indirizzo scritto nel codice: le richieste vanno solo al portale (ORIGIN) e i dati solo all'app da cui è caricato.
  assert.deepEqual(src.match(/https?:\/\/[a-z0-9]/gi), null);
  assert.ok(Buffer.byteLength(src) < 48 * 1024, "ponte troppo grande");
});

test("testo semplice uguale all'app e indirizzi solo del portale", () => {
  for (const s of ["<p>Ciao&nbsp;<b>mondo</b></p>", "Perch&eacute; &#232; cos&igrave;", "A &amp;lt; B", "riga 1<br/>riga 2", "&#x1F600; ok", ""]) {
    assert.equal(P.textOf(s, 1e6), C.htmlStripped(s));
  }
  assert.equal(P.textOf("a‮b\u0007c\td"), "abc d");
  assert.equal(P.textOf("x".repeat(300)).length, 200);
  assert.equal(P.portalPath(ORIGIN + "/mod/quiz/view.php?id=5#q1"), "/mod/quiz/view.php?id=5#q1");
  assert.equal(P.portalPath("https://esterno.example/mod/quiz/view.php?id=5"), null);
  assert.equal(P.portalPath("javascript:alert(1)"), null);
  assert.equal(P.portalPath("//esterno.example/x"), null);
  assert.equal(P.portalPath("http://lastataleopen.myariel.unimi.it/x"), null);
  assert.equal(P.cmOf(ORIGIN + "/mod/assign/view.php?id=555&action=editsubmission"), 555);
  assert.equal(P.cmOf(ORIGIN + "/mod/assign/view.php?action=x&id=7"), 7);
  assert.equal(P.cmOf(ORIGIN + "/mod/assign/view.php?cmid=7"), null);
  assert.equal(C.portalURL("/my/"), ORIGIN + "/my/");
  for (const bad of ["//esterno.example/x", "/x y", "/a\\b", "https://esterno.example/", "/\"><img src=x>", null, 7]) assert.equal(C.portalURL(bad), "", String(bad));
});

test("richiesta dell'app: andata e ritorno, richieste ostili rifiutate", () => {
  let box = C.emptyBox(42);
  box = C.enqueueOp(box, { k: "read", id: 1, label: "Annuncio" }, false, [], 1000);
  box = C.enqueueOp(box, { k: "done", cm: 556, c: 101, v: 1, label: "Lezione 1" }, false, [], 1000);
  const r = C.buildRequest(box, { ret: "frag", tree: 2 });
  assert.match(r.text, /^SOQ1\.[A-Za-z0-9_-]+$/);
  assert.ok(!/Annuncio|Lezione/.test(Buffer.from(r.text.slice(5), "base64url").toString()), "i titoli non devono stare nella richiesta");
  const req = P.parseRequest("#statale-open=" + r.text);
  assert.equal(req.rid, r.pending.rid);
  assert.equal(req.ret, "frag");
  assert.equal(req.tree, 2);
  assert.deepEqual(req.ops, [{ k: "read", id: 1, n: 1 }, { k: "done", cm: 556, v: 1, n: 2 }]);
  assert.deepEqual(r.pending.keys, ["read:1#1", "done:556#2"]);
  assert.equal(C.requestURL(r.text), ORIGIN + "/my/#statale-open=" + r.text);
  assert.equal(P.parseRequest("#qualcosa"), null);
  assert.equal(P.parseRequest(""), null);
  const enc = (o) => "#statale-open=SOQ1." + Buffer.from(JSON.stringify(o)).toString("base64url");
  const ok = { v: 1, rid: "abcdefghijklmnopqrstuv", ret: "clip", ops: [] };
  assert.equal(P.parseRequest(enc(ok)).ops.length, 0);
  const hostile = [
    Object.assign({}, ok, { v: 2 }), Object.assign({}, ok, { rid: "corto" }), Object.assign({}, ok, { ret: "https://esterno.example" }),
    Object.assign({}, ok, { ops: [{ k: "read", id: 1.5, n: 1 }] }), Object.assign({}, ok, { ops: [{ k: "delete", id: 1, n: 1 }] }),
    Object.assign({}, ok, { ops: [{ k: "done", cm: 5, v: 2, n: 1 }] }), Object.assign({}, ok, { ops: [{ k: "read", id: 1, n: 1 }, { k: "read", id: 1, n: 2 }] }),
    Object.assign({}, ok, { ops: Array.from({ length: 101 }, (_, i) => ({ k: "read", id: i + 1, n: i + 1 })) }), Object.assign({}, ok, { tree: "2" })
  ];
  for (const h of hostile) assert.throws(() => P.parseRequest(enc(h)), /non valida/, JSON.stringify(h).slice(0, 80));
  assert.throws(() => P.parseRequest("#statale-open=SOQ1.%%%"), /non valida/);
  assert.throws(() => P.parseRequest("#statale-open=SOQ1." + "A".repeat(17000)), /non valida/);
});

test("risposte di Moodle ridotte a dati compatti", async () => {
  const portal = createPortal();
  const { snap, env } = await snapshotFrom(portal, { rid: "x".repeat(22), ret: "frag", ops: [], tree: 2 });
  assert.deepEqual(snap.parts, { courses: true, events: true, notifs: true, user: true });
  assert.deepEqual(snap.user, { id: 42, name: "Mario Rossi", first: "Mario" });
  assert.deepEqual(snap.courses.map((c) => c.id), [101, 102, 103], "ordinati per ultimo accesso");
  assert.equal(snap.courses[0].progress, 40.5);
  assert.equal(snap.courses[1].progress, null, "hasprogress false → nessuna percentuale");
  assert.equal(snap.courses[2].last, 0);
  const e1 = snap.events.find((e) => e.id === 9001);
  assert.deepEqual(e1, { id: 9001, name: "E-tivity 1 è in scadenza", c: 101, cn: "Fondamenti di cybersecurity", mod: "assign", t: e1.t, u: "/mod/assign/view.php?id=555&action=editsubmission", od: false, cm: 555 });
  assert.equal(snap.events.find((e) => e.id === 9003).u, null, "link esterno scartato");
  assert.equal(snap.notifs.unread, 2);
  assert.equal(snap.notifs.list[0].s, "Nuovo annuncio: orario lezioni");
  assert.equal(snap.notifs.list.find((n) => n.id === 3).u, null);
  const s101 = snap.contents[101].sections;
  assert.deepEqual(s101.map((s) => s.n), ["Generale", "Modulo 1 & introduzione", "Approfondimento"]);
  assert.deepEqual(s101[0].m.map((m) => m.id), [555, 556, 557], "niente voce della sottosezione");
  assert.deepEqual(s101[1].m.map((m) => m.id), [559, 561], "attività non visibili escluse");
  assert.deepEqual(s101[2].m.map((m) => m.id), [562], "sottosezione fuori dall'elenco principale: le sue attività restano");
  assert.deepEqual(s101[0].m[0], { id: 555, n: "E-tivity 1", mod: "assign", pl: "Compito", st: 0, u: "/mod/assign/view.php?id=555" });
  assert.equal(s101[1].m[0].st, null, "senza completamento: null");
  assert.deepEqual(snap.contents[102], { err: { code: "restrictedcontextexception", m: "Non hai accesso a questo corso" } });
  assert.deepEqual(snap.tree.root, [{ id: 2, n: "SecAI" }, { id: 9, n: "Altro percorso" }]);
  assert.deepEqual(snap.tree.cats[2].subs.map((c) => c.id), [21, 22]);
  assert.deepEqual(snap.tree.cats[21].courses, [{ id: 101, n: "Fondamenti di cybersecurity" }, { id: 102, n: "Crittografia applicata" }]);
  assert.deepEqual(snap.warn.map((w) => w.part), ["contenuti"]);
  // 1 richiesta per corsi/scadenze/avvisi/nome + 2 per i contenuti (Moodle si ferma all'errore del corso 102
  // e il ponte ripete la chiamata rimasta); pagine solo per i percorsi chiesti.
  assert.equal(portal.st.posts, 3);
  assert.equal(portal.st.pages.length, 1 + 2 + 2 * 2);
  assert.ok(portal.st.pages.every((p) => /^\/course\/index\.php\?categoryid=\d+&browse=(categories|courses)&perpage=1000$/.test(p)));
  assert.equal(env.requests, 3 + 7);
  const json = JSON.stringify(snap);
  for (const secret of [portal.st.sesskey, "MoodleSession", "mario.rossi@studenti", "data:image"]) assert.ok(!json.includes(secret), "nei dati c'è " + secret);
});

test("errori: una parte rifiutata non nasconde le altre, la sessione scaduta ferma tutto", async () => {
  const portal = createPortal();
  portal.st.fail.message_popup_get_popup_notifications = { errorcode: "servicenotavailable", message: "Servizio non disponibile" };
  const { snap } = await snapshotFrom(portal);
  assert.equal(snap.parts.notifs, false);
  assert.equal(snap.parts.courses && snap.parts.events && snap.parts.user, true);
  assert.equal(snap.courses.length, 3);
  assert.ok(snap.warn.some((w) => w.part === "avvisi" && w.code === "servicenotavailable"));
  assert.equal(snap.tree, undefined, "senza richiesta niente percorsi");

  const expired = createPortal();
  expired.st.loggedIn = false;
  await assert.rejects(snapshotFrom(expired), (e) => e.code === "expired");
  const badKey = createPortal();
  const env = envFor(badKey);
  env.sesskey = "sbagliata";
  await assert.rejects(P.collect(env, null, () => {}), (e) => e.code === "expired");
  const html = { wwwroot: ORIGIN, sesskey: "S3SS10Nk3y", userId: 42, requests: 0, fetch: async () => ({ ok: true, status: 200, type: "basic", text: async () => "<html>login</html>" }) };
  await assert.rejects(P.collect(html, null, () => {}), (e) => e.code === "expired");
  const redirect = Object.assign({}, html, { fetch: async () => ({ ok: false, status: 0, type: "opaqueredirect", text: async () => "" }) });
  await assert.rejects(P.collect(redirect, null, () => {}), (e) => e.code === "expired");
  const down = Object.assign({}, html, { fetch: async () => { throw new TypeError("Failed to fetch"); } });
  await assert.rejects(P.collect(down, null, () => {}), (e) => e.code === "network");
  await assert.rejects(P.ajax(envFor(createPortal()), [{ methodname: "core_user_delete_users", args: {} }]), (e) => e.code === "notallowed");
  assert.equal(P.classifyError({ errorcode: "invalidsesskey" }), "expired");
  assert.equal(P.classifyError({ errorcode: "requireloginerror" }), "permanent");
  assert.equal(P.classifyError({ code: "timeout" }), "transient");
  assert.equal(P.classifyError({ errorcode: "cannotmanualctrack" }), "permanent");
});

test("modifiche applicate sul portale con un esito per ognuna", async () => {
  const portal = createPortal();
  const env = envFor(portal);
  const res = await P.applyOps(env, [{ k: "read", id: 1, n: 3 }, { k: "done", cm: 555, v: 1, n: 4 }, { k: "done", cm: 556, v: 1, n: 5 }, { k: "read", id: 99, n: 6 }]);
  assert.deepEqual(res["read:1#3"], { s: "ok" });
  assert.equal(res["done:555#4"].s, "fail");
  assert.equal(res["done:555#4"].p, 1);
  assert.match(res["done:555#4"].m, /automatico/);
  assert.deepEqual(res["done:556#5"], { s: "ok" }, "dopo un errore Moodle si ferma: la chiamata viene ripetuta");
  assert.equal(res["read:99#6"].p, 1);
  assert.equal(portal.st.notifications[0].read, true);
  assert.equal(portal.st.completion[556], 1);
  assert.equal(portal.st.completion[555], 0);
});

test("pacchetto per l'app: codifica, controllo e decodifica", async () => {
  const { snap } = await snapshotFrom(createPortal(), { rid: "r".repeat(22), ret: "frag", ops: [], tree: 2 });
  snap.res = { rid: "r".repeat(22), ops: { "read:1#1": { s: "ok" } } };
  const env = await P.encode(snap);
  assert.match(env, /^SOP1\.z\.[0-9a-f]{16}\.[A-Za-z0-9_-]+$/);
  assert.ok(env.length < 8000, "pacchetto troppo grande: " + env.length);
  assert.deepEqual(await C.decodePayload(env), JSON.parse(JSON.stringify(snap)));
  // Senza compressione (iOS precedenti al 16.4).
  const plain = "SOP1.j." + env.split(".")[2] + "." + Buffer.from(JSON.stringify(snap)).toString("base64url");
  assert.deepEqual(await C.decodePayload(plain), JSON.parse(JSON.stringify(snap)));
  // Un carattere cambiato o un taglio: dati danneggiati.
  const parts = env.split(".");
  const flipped = parts.slice(0, 3).concat(parts[3].slice(0, 40) + (parts[3][40] === "A" ? "B" : "A") + parts[3].slice(41)).join(".");
  await assert.rejects(C.decodePayload(flipped), (e) => e.code === "corrupt");
  await assert.rejects(C.decodePayload(env.slice(0, env.length - 30)), (e) => e.code === "corrupt");
  await assert.rejects(C.decodePayload("SOP1.z.0123456789abcdef.@@@"), (e) => e.code === "corrupt");
  // Bomba di decompressione: ci si ferma a 3 MB.
  const bomb = require("node:zlib").deflateSync(Buffer.alloc(10 * 1024 * 1024, 32));
  await assert.rejects(C.decodePayload("SOP1.z.0123456789abcdef." + bomb.toString("base64url")), (e) => e.code === "toobig");
  // Il pacchetto si ritrova in qualsiasi testo; la richiesta e il testo vuoto hanno un messaggio proprio.
  assert.deepEqual(C.findEnvelope("Dati: " + env + " fine"), { kind: "payload", env });
  assert.deepEqual(C.findEnvelope(APP_BASE + "#ponte=" + env), { kind: "payload", env });
  assert.equal(C.findEnvelope(ORIGIN + "/my/#statale-open=SOQ1.eyJ2IjoxfQ").kind, "request");
  assert.equal(C.findEnvelope("ciao").kind, "none");
  assert.match(C.ponteMessage("request"), /Incolla e vai/);
});

test("dati ricevuti controllati: niente indirizzi esterni, niente HTML, limiti", () => {
  const now = Date.now();
  const hostile = {
    f: "statale-open-ponte", v: 1, bv: 1, sid: "abcdefghijklmnop", at: now - 1000,
    user: { id: 42, name: "Mario‮ Rossi", first: "Mario" },
    parts: { courses: true, events: true, notifs: true, user: true },
    courses: [{ id: 1, name: "<img src=x onerror=alert(1)>", short: "A", progress: 300, last: 1.5e9 }, { id: -1, name: "x" }, { id: "2", name: "y" }],
    events: [{ id: 5, name: "E", c: 1, cn: "C", mod: "assign<script>", t: 1.9e9, u: "https://esterno.example/x", od: "no", cm: 7 },
      { id: 6, name: "F", t: 1.9e9, u: "//esterno.example/x" }, { id: 7, name: "G", t: 12, u: "/ok" }],
    notifs: { unread: 1, list: [{ id: 1, s: "S", ctx: "C", u: "javascript:alert(1)", t: 1.9e9, r: false }] },
    contents: { "1": { sections: [{ n: "S", m: [{ id: 3, n: "M", mod: "page", pl: "Pagina", st: 9, u: "/mod/page/view.php?id=3" }] }] }, "abc": { sections: [] }, "2": { err: { code: "x", m: "y" } } },
    tree: { program: 2, at: now, root: [{ id: 2, n: "SecAI" }, { id: 2, n: "doppio" }], cats: { "2": { subs: [{ id: 21, n: "<b>C</b>" }], courses: [] } } },
    res: { rid: "rrrrrrrrrrrrrrrrrrrrrr", ops: { "read:1#1": { s: "ok" }, "delete:1#1": { s: "ok" }, "done:2#3": { s: "hack" } } },
    warn: [{ part: "avvisi", code: "x", m: "y" }]
  };
  const s = C.validateSnapshot(hostile, now);
  assert.equal(s.user.name, "Mario Rossi");
  assert.deepEqual(s.courses.map((c) => c.id), [1]);
  assert.equal(s.courses[0].name, "<img src=x onerror=alert(1)>", "resta testo: le viste lo mostrano con esc()");
  assert.equal(s.courses[0].progress, null);
  assert.equal(s.events[0].u, null);
  assert.equal(s.events[0].mod, "");
  assert.equal(s.events[0].od, null);
  assert.equal(s.events[1].u, null);
  assert.equal(s.events.length, 2, "data fuori intervallo scartata");
  assert.equal(s.notifs.list[0].u, null);
  assert.deepEqual(Object.keys(s.contents).sort(), ["1", "2"]);
  assert.equal(s.contents[1].sections[0].m[0].st, null);
  assert.deepEqual(s.tree.root, [{ id: 2, n: "SecAI" }]);
  assert.deepEqual(Object.keys(s.res.ops), ["read:1#1"]);
  const models = C.toModels(s);
  for (const e of models.events) assert.ok(e.url === "" || e.url.startsWith(ORIGIN + "/"));
  for (const n of models.notifications.list) assert.ok(n.url === "" || n.url.startsWith(ORIGIN + "/"));
  assert.throws(() => C.validateSnapshot(Object.assign({}, hostile, { f: "altro" }), now), (e) => e.code === "corrupt");
  assert.throws(() => C.validateSnapshot(Object.assign({}, hostile, { v: 2 }), now), (e) => e.code === "newer");
  assert.throws(() => C.validateSnapshot(Object.assign({}, hostile, { bv: 0 }), now), (e) => e.code === "oldbridge");
  assert.throws(() => C.validateSnapshot(Object.assign({}, hostile, { user: { id: 0 } }), now), (e) => e.code === "corrupt");
  assert.throws(() => C.validateSnapshot(Object.assign({}, hostile, { at: now + 3 * 86400e3 }), now), (e) => e.code === "corrupt");
});

test("modelli delle viste dai dati del ponte", async () => {
  const { snap } = await snapshotFrom(createPortal(), { rid: "x".repeat(22), ret: "frag", ops: [], tree: 2 });
  const s = C.validateSnapshot(JSON.parse(JSON.stringify(snap)));
  const m = C.toModels(s);
  assert.deepEqual(Object.keys(m.siteInfo).sort(), ["firstname", "fullname", "sitename", "userid", "username"]);
  assert.deepEqual(Object.keys(m.courses[0]).sort(), ["category", "id", "last", "name", "progress", "short"]);
  assert.deepEqual(Object.keys(m.events[0]).sort(), ["courseId", "courseName", "id", "mod", "name", "overdue", "t", "url"]);
  assert.deepEqual(Object.keys(m.notifications.list[0]).sort(), ["ctx", "id", "read", "subject", "t", "url"]);
  assert.ok(m.events[0].t < m.events[1].t);
  const sections = C.sectionsFor(s, 101, C.emptyBox(42));
  const etivity = sections[0].modules[0];
  assert.deepEqual(Object.keys(etivity).sort(), ["completion", "contents", "courseId", "description", "done", "due", "id", "kind", "mod", "modplural", "name", "pending", "url"]);
  assert.equal(etivity.kind, "etivity");
  assert.equal(etivity.due, s.events.find((e) => e.cm === 555).t * 1000, "scadenza dell'attività presa dalle scadenze");
  assert.equal(etivity.url, ORIGIN + "/mod/assign/view.php?id=555");
  assert.equal(sections[1].modules[0].description, "Prima di iniziare guarda la lezione 1");
  assert.equal(sections[1].modules[0].completion, 0, "etichetta senza completamento");
  assert.equal(sections[1].modules[1].completion, 1);
  assert.equal(C.sectionsFor(s, 102, null), null);
  assert.equal(C.sectionsFor(s, 999, null), null);
});

test("modifiche in attesa: coda, sovrapposizione, riconciliazione", () => {
  const now = 1_800_000_000_000;
  let box = C.emptyBox(42);
  box = C.enqueueOp(box, { k: "done", cm: 556, c: 101, v: 1, label: "Lezione 1" }, false, [], now);
  assert.equal(C.pendingOps(box).length, 1);
  // Due tocchi tornano allo stato del portale: nessuna modifica.
  box = C.enqueueOp(box, { k: "done", cm: 556, c: 101, v: 0, label: "Lezione 1" }, false, [], now);
  assert.equal(C.pendingOps(box).length, 0);
  // Ma se la prima era già partita, la seconda va mandata comunque.
  box = C.enqueueOp(box, { k: "done", cm: 556, c: 101, v: 1 }, false, [], now);
  const sent = box.ops["done:556"].n;
  box = C.enqueueOp(box, { k: "done", cm: 556, c: 101, v: 0 }, false, ["done:556#" + sent], now);
  assert.equal(box.ops["done:556"].v, 0);
  assert.ok(box.ops["done:556"].n > sent);
  box = C.enqueueOp(box, { k: "read", id: 1, label: "Annuncio" }, false, [], now);
  box = C.enqueueOp(box, { k: "read", id: 2 }, true, [], now);
  assert.equal(box.ops["read:2"], undefined, "già letto sul portale");
  assert.equal(C.opsSummary(box), "1 avviso letto, 1 da fare");

  const notifs = { list: [{ id: 1, read: false }, { id: 2, read: true }], unread: 1 };
  const over = C.overlayNotifications(notifs, box);
  assert.equal(over.unread, 0);
  assert.equal(over.list[0].pending, true);
  assert.equal(C.cancelOp(box, "read:1").ops["read:1"], undefined);

  const base = { parts: { notifs: true }, notifs: { list: [{ id: 1, r: false }] }, contents: { 101: { sections: [{ m: [{ id: 556, st: 1 }, { id: 557, st: 0 }] }] } } };
  let b2 = C.emptyBox(42);
  b2 = C.enqueueOp(b2, { k: "read", id: 1, label: "A" }, false, [], now);
  b2 = C.enqueueOp(b2, { k: "done", cm: 556, c: 101, v: 1, label: "L1" }, false, [], now);
  b2 = C.enqueueOp(b2, { k: "done", cm: 557, c: 101, v: 1, label: "Slide" }, false, [], now);
  b2 = C.enqueueOp(b2, { k: "done", cm: 900, c: 300, v: 1, label: "Altro corso" }, false, [], now);
  const req = C.buildRequest(b2, { rid: "q".repeat(22), now });
  // Esiti dal ponte: ok, rifiutata per sempre, temporanea; il corso 300 non è stato letto.
  const res = { rid: "q".repeat(22), ops: { "read:1#1": { s: "ok" }, "done:557#3": { s: "fail", p: 1, m: "Completamento automatico" }, "done:900#4": { s: "fail", m: "rete" } } };
  const r = C.reconcile({ box: b2, snap: Object.assign({}, base, { res }), pending: req.pending, now });
  assert.ok(r.matched);
  assert.deepEqual(Object.keys(r.box.ops), ["done:900"]);
  assert.equal(r.box.ops["done:900"].tries, 1);
  assert.deepEqual(r.failed.map((f) => [f.key, f.label, f.m]), [["done:557", "Slide", "Completamento automatico"]]);
  assert.equal(r.notes.length, 0);
  // Richiesta persa (login di Ateneo): decide lo stato letto, e l'utente viene avvisato.
  const lost = C.reconcile({ box: b2, snap: base, pending: req.pending, now });
  assert.equal(lost.matched, false);
  assert.deepEqual(Object.keys(lost.box.ops).sort(), ["done:557", "done:900", "read:1"]);
  assert.equal(lost.box.ops["done:556"], undefined, "già completata sul portale");
  assert.match(lost.notes[0], /non sono arrivate al portale/);
  // Dopo 30 giorni una modifica mai arrivata scade.
  const late = C.reconcile({ box: b2, snap: { parts: { notifs: false }, notifs: { list: [] }, contents: {} }, pending: null, now: now + 31 * 86400e3 });
  assert.equal(Object.keys(late.box.ops).length, 0);
  assert.equal(late.failed.length, 4);
});

test("unione con i dati già salvati e freschezza", async () => {
  const portal = createPortal();
  const first = C.validateSnapshot(JSON.parse(JSON.stringify((await snapshotFrom(portal, { rid: "x".repeat(22), ret: "frag", ops: [], tree: 2 })).snap)));
  portal.st.fail.message_popup_get_popup_notifications = { errorcode: "servicenotavailable" };
  portal.st.courses = portal.st.courses.filter((c) => c.id !== 103);
  const second = C.validateSnapshot(JSON.parse(JSON.stringify((await snapshotFrom(portal)).snap)));
  const merged = C.mergeSnapshot(first, second);
  assert.equal(merged.notifs.list.length, first.notifs.list.length, "avvisi non letti questa volta: restano quelli di prima");
  assert.equal(merged.stale.notifs, true);
  assert.deepEqual(merged.courses.map((c) => c.id), [101, 102]);
  assert.equal(merged.contents[103], undefined, "corso non più tra i tuoi: contenuti tolti");
  assert.deepEqual(merged.tree, first.tree, "percorsi tenuti finché non vengono riletti");
  const other = Object.assign({}, second, { user: { id: 7, name: "Altro", first: "" } });
  assert.equal(C.mergeSnapshot(first, other).tree, undefined, "un altro account non eredita nulla");
  const H = 3600e3;
  assert.equal(C.staleness(1000, 1000 + H), "fresh");
  assert.equal(C.staleness(1000, 1000 + 7 * H), "stale");
  assert.equal(C.staleness(1000, 1000 + 49 * H), "old");
  assert.deepEqual(C.dueByCm([{ cm: 5, t: 20 }, { cm: 5, t: 10 }, { cm: null, t: 3 }]), { 5: 10 });
});

test("pagine dei percorsi come SitePages dell'app iPhone", () => {
  const categories = '<div class="category" data-categoryid="21"><div class="info"><h3 class="categoryname aabtn"><a href="x">Cluster &amp; sicurezza</a></h3></div></div>' +
    '<div class="category" data-categoryid="2"><h3 class="categoryname"><a href="x">Se stessa</a></h3></div>' +
    '<div class="category" data-categoryid="21"><h3 class="categoryname"><a href="x">Doppione</a></h3></div>';
  assert.deepEqual(P.parseCategories(categories, 2), [{ id: 21, n: "Cluster & sicurezza" }]);
  const boxes = '<div class="coursebox" data-courseid="101"><h3 class="coursename"><a class="aalink" href="x">Fondamenti</a></h3></div>';
  assert.deepEqual(P.parseCourses(boxes), [{ id: 101, n: "Fondamenti" }]);
  const links = '<ul><li><a href="https://lastataleopen.myariel.unimi.it/course/view.php?id=7">Corso <b>sette</b></a></li><li><a href="/course/view.php?id=1">Sito</a></li></ul>';
  assert.deepEqual(P.parseCourses(links), [{ id: 7, n: "Corso sette" }]);
  assert.deepEqual(P.parseCourses("<p>niente</p>"), []);
});

// ---------- Ponte automatico (script per l'estensione Userscripts di Safari) ----------
const vm = require("node:vm");
const USERSCRIPT = fs.readFileSync(path.join(DOCS, C.PONTE.userscript), "utf8");

// Esegue lo script come l'estensione: in un ambiente finto con pagina, indirizzo e archivio GM.
async function runUserscript({ href, html = "", top = true, gm = new Map(), useGM = true }) {
  const url = new URL(href);
  const appended = [], assigned = [], replaced = [], attrs = {}, events = [];
  const scripts = html ? [{ textContent: html }] : [];
  const location = {
    href: url.href, origin: url.origin, protocol: url.protocol, hostname: url.hostname, pathname: url.pathname, search: url.search, hash: url.hash,
    assign: (u) => assigned.push(u)
  };
  const document = {
    documentElement: { setAttribute: (k, v) => { attrs[k] = v; }, appendChild: (n) => appended.push(n) },
    head: { appendChild: (n) => appended.push(n) },
    querySelectorAll: (sel) => (sel === "script:not([src])" ? scripts : []),
    createElement: (tag) => ({ tag }),
    dispatchEvent: (e) => events.push(e.type)
  };
  const self = {};
  const window = top ? self : {};
  const GM = useGM ? { getValue: async (k, d) => (gm.has(k) ? gm.get(k) : d), setValue: async (k, v) => { gm.set(k, v); }, deleteValue: async (k) => { gm.delete(k); } } : undefined;
  const session = new Map();
  const sandbox = {
    window: Object.assign(window, { top: self, self }), document, location, GM, Date, JSON, Promise, alert: () => {},
    CustomEvent: function (type) { this.type = type; },
    history: { state: null, replaceState: (s, t, u) => { replaced.push(u); } },
    sessionStorage: { getItem: (k) => (session.has(k) ? session.get(k) : null), setItem: (k, v) => session.set(k, v), removeItem: (k) => session.delete(k) }
  };
  if (!top) sandbox.window.top = {};
  vm.runInNewContext(USERSCRIPT, sandbox);
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
  return { appended, assigned, replaced, attrs, events, gm, session };
}
const LOGGED = 'var M = {}; M.cfg = {"wwwroot":"https:\\/\\/lastataleopen.myariel.unimi.it","sesskey":"abc123","userId":42};';
const GUEST = 'var M = {}; M.cfg = {"wwwroot":"https:\\/\\/lastataleopen.myariel.unimi.it","sesskey":"abc123","userId":0};';
const REQ = "SOQ1.eyJ2IjoxfQ";

test("ponte automatico: metadati, impronta del ponte, nessuna API vietata, file immutabile", () => {
  assert.ok(USERSCRIPT.startsWith("// ==UserScript==\n"));
  const meta = USERSCRIPT.slice(0, USERSCRIPT.indexOf("// ==/UserScript=="));
  const keys = (k) => (meta.match(new RegExp("^// @" + k + "\\s+(.+)$", "gm")) || []).map((l) => l.replace(new RegExp("^// @" + k + "\\s+"), "").trim());
  assert.deepEqual(keys("match"), ["https://lastataleopen.myariel.unimi.it/*", "https://leogen02.github.io/LaStataleOpen-App/*"]);
  assert.deepEqual(keys("grant"), ["GM.getValue", "GM.setValue", "GM.deleteValue"]);
  assert.deepEqual(keys("inject-into"), ["content"]);
  assert.deepEqual(keys("run-at"), ["document-end"]);
  assert.ok(/^\/\/ @noframes\s*$/m.test(meta));
  for (const k of ["updateURL", "downloadURL", "require", "include", "resource"]) assert.deepEqual(keys(k), [], "@" + k + " non ammesso: lo script resta quello installato");
  assert.ok(USERSCRIPT.includes('var APP = "' + APP_BASE + '";'));
  assert.ok(USERSCRIPT.includes('var BRIDGE = APP + "' + C.PONTE.file + '";'));
  assert.ok(USERSCRIPT.includes('var INTEGRITY = "' + C.PONTE.sri + '";'));
  for (const word of ["fetch(", "XMLHttpRequest", "xmlHttpRequest", ".cookie", "localStorage", "innerHTML", "eval(", "Function(", "postMessage", "sendBeacon", "WebSocket", "openInTab", "setClipboard", "window.open"]) {
    assert.ok(!USERSCRIPT.includes(word), "lo script contiene " + word);
  }
  assert.equal(C.PONTE.known[C.PONTE.userscript], sri(C.PONTE.userscript), C.PONTE.userscript + " è cambiato: chi l'ha installato terrebbe la versione vecchia. Crea statale-open-2.user.js. Impronta attuale: " + sri(C.PONTE.userscript));
});

test("ponte automatico: sull'app segnala di essere installato e non fa altro", async () => {
  const r = await runUserscript({ href: APP_BASE + "#ponte=x" });
  assert.deepEqual(r.attrs, { "data-statale-open-auto": "1" });
  assert.deepEqual(r.events, ["statale-open-auto"]);
  assert.equal(r.appended.length + r.assigned.length, 0);
});

test("ponte automatico: richiesta dell'app con utente entrato → stesso ponte del preferito", async () => {
  const r = await runUserscript({ href: ORIGIN + "/#statale-open=" + REQ, html: LOGGED });
  assert.equal(r.appended.length, 1);
  assert.deepEqual(r.appended[0], { tag: "script", src: APP_BASE + "ponte/ponte-1.js", integrity: C.PONTE.sri, crossOrigin: "anonymous", referrerPolicy: "no-referrer", onerror: r.appended[0].onerror });
  assert.equal(r.assigned.length, 0);
  assert.equal(r.gm.size, 0);
});

test("ponte automatico: senza login tiene la richiesta, va alla Dashboard e riparte dopo l'accesso", async () => {
  const gm = new Map();
  const first = await runUserscript({ href: ORIGIN + "/#statale-open=" + REQ, html: GUEST, gm });
  assert.equal(first.appended.length, 0);
  assert.deepEqual(first.assigned, [ORIGIN + "/my/"]);
  assert.deepEqual(first.replaced, ["/"]);
  assert.equal(JSON.parse(gm.get("statale-open-richiesta")).req, REQ);
  const after = await runUserscript({ href: ORIGIN + "/my/", html: LOGGED, gm });
  assert.deepEqual(after.replaced, ["/my/#statale-open=" + REQ]);
  assert.equal(after.appended.length, 1);
  assert.equal(gm.size, 0, "richiesta usata una volta sola");
  // Senza archivio dell'estensione resta quello della scheda.
  const noGM = await runUserscript({ href: ORIGIN + "/#statale-open=" + REQ, html: GUEST, useGM: false });
  assert.equal(JSON.parse(noGM.session.get("statale-open-richiesta")).req, REQ);
});

test("ponte automatico: nessuna azione senza richiesta, con richiesta scaduta, in un riquadro o su altri siti", async () => {
  const nothing = (r) => r.appended.length === 0 && r.assigned.length === 0 && r.replaced.length === 0;
  assert.ok(nothing(await runUserscript({ href: ORIGIN + "/my/", html: LOGGED })));
  const old = new Map([["statale-open-richiesta", JSON.stringify({ req: REQ, at: Date.now() - 11 * 60e3 })]]);
  assert.ok(nothing(await runUserscript({ href: ORIGIN + "/my/", html: LOGGED, gm: old })));
  const bad = new Map([["statale-open-richiesta", JSON.stringify({ req: "javascript:alert(1)", at: Date.now() })]]);
  assert.ok(nothing(await runUserscript({ href: ORIGIN + "/my/", html: LOGGED, gm: bad })));
  assert.ok(nothing(await runUserscript({ href: ORIGIN + "/#statale-open=" + REQ, html: LOGGED, top: false })));
  assert.ok(nothing(await runUserscript({ href: "https://esterno.example/#statale-open=" + REQ, html: LOGGED })));
  assert.ok(nothing(await runUserscript({ href: ORIGIN + "/pluginfile.php/1/a.pdf#statale-open=" + REQ })), "pagina senza M.cfg");
  assert.ok(nothing(await runUserscript({ href: ORIGIN + "/#statale-open=SOQ1.<script>", html: LOGGED })));
});
