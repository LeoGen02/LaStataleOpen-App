/*
 * Statale Open — ponte con il portale, versione 2.
 *
 * Gira sulla pagina di La Statale Open in cui sei già entrato, e solo quando tocchi il preferito «Statale Open».
 * Legge i tuoi corsi, le scadenze e gli avvisi con lib/ajax/service.php, lo stesso canale che usano le pagine
 * del portale, e li consegna all'app web: nell'indirizzo (#ponte=…), negli appunti o in un file, sempre con un tuo tocco
 * o dopo una tua richiesta dall'app. Applica le modifiche chieste dall'app (avvisi letti, attività completate)
 * solo dopo una conferma.
 *
 * Cosa non fa: non legge cookie né password, non scrive nell'archivio del portale, non manda dati ad altri siti
 * (l'unica destinazione è l'app da cui è stato caricato questo file), chiama solo le funzioni dell'elenco ALLOWED.
 * La sesskey resta in memoria durante la lettura e non entra mai nei dati consegnati.
 *
 * Novità della versione 2: legge tutti gli avvisi da leggere (a pagine di 50, fino a 1000 avvisi), con il tipo
 * (forum, compito, …) e il corso o l'attività a cui si riferiscono, così l'app li può ordinare per argomento;
 * consegna nell'indirizzo anche pacchetti più grandi.
 *
 * File immutabile: il preferito lo carica con la sua impronta SHA-384 (Subresource Integrity) e il browser lo rifiuta
 * se cambia anche un solo byte. Una correzione va in un file nuovo (ponte-3.js) e in PONTE dentro docs/core.js.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else if (typeof document !== "undefined") api.main(window, document.currentScript);
})(this, function () {
  "use strict";

  var VERSION = 2;
  var HOST = "lastataleopen.myariel.unimi.it";
  var ORIGIN = "https://" + HOST;
  var FILE = "ponte/ponte-2.js";

  // Le sole funzioni che il ponte può chiamare: cinque letture e due scritture, le stesse delle pagine del portale.
  var READS = [
    "core_course_get_enrolled_courses_by_timeline_classification",
    "core_calendar_get_action_events_by_timesort",
    "message_popup_get_popup_notifications",
    "core_user_get_users_by_field",
    "core_courseformat_get_state"
  ];
  var WRITES = [
    "core_message_mark_notification_read",
    "core_completion_update_activity_completion_status_manually"
  ];
  var ALLOWED = READS.concat(WRITES);
  // Codici con cui lib/ajax/service.php dice che la sessione non c'è più. requireloginerror qui riguarda un solo corso
  // (accesso negato a quel corso), quindi è un errore di quella parte e non ferma la lettura.
  var EXPIRED = ["servicerequireslogin", "invalidsesskey", "sessionerroruser", "sessionerroruser2"];
  var LIMITS = {
    courses: 100, contents: 30, sections: 100, modules: 300, totalModules: 3000, events: 50, notifications: 1000,
    notifPage: 50, notifPages: 2, notifRecent: 100,
    ops: 100, clusters: 12, treeItems: 500, text: 200, sectionText: 120, request: 16000,
    json: 1500000, fragment: 250000, batch: 4, opsBatch: 10, timeout: 25000, repeat: 20000
  };
  var PAGE_PATH = /^\/course\/index\.php\?categoryid=\d+&browse=(categories|courses)&perpage=1000$/;

  // ---------- Testo e indirizzi ----------

  // Come C.htmlStripped (docs/core.js) e String.htmlStripped (app iPhone).
  var ENTITIES = {
    "&nbsp;": " ", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">",
    "&agrave;": "à", "&egrave;": "è", "&eacute;": "é", "&igrave;": "ì", "&ograve;": "ò", "&ugrave;": "ù",
    "&Agrave;": "À", "&Egrave;": "È", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&ndash;": "–", "&mdash;": "—"
  };
  function stripHTML(input) {
    var s = String(input == null ? "" : input);
    s = s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<[^>]+>/g, "");
    Object.keys(ENTITIES).forEach(function (k) { s = s.split(k).join(ENTITIES[k]); });
    s = s.replace(/&#(x?[0-9a-fA-F]+);/g, function (match, raw) {
      var code = raw.charAt(0) === "x" ? parseInt(raw.slice(1), 16) : (/^\d+$/.test(raw) ? parseInt(raw, 10) : NaN);
      return isFinite(code) && code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : match;
    });
    s = s.replace(/&amp;/g, "&").replace(/\n{3,}/g, "\n\n");
    return s.trim();
  }
  // Testo semplice e corto: niente caratteri di controllo né inversioni di direzione.
  function textOf(input, max) {
    var s = stripHTML(input).replace(/\t/g, " ").replace(/[\u0000-\u0009\u000B-\u001F\u007F‪-‮⁦-⁩]/g, "");
    max = max || LIMITS.text;
    return s.length > max ? s.slice(0, max - 1).trim() + "…" : s;
  }
  // Indirizzo del portale ridotto al percorso; gli indirizzi di altri siti vengono scartati.
  function portalPath(u) {
    if (typeof u !== "string" || !u) return null;
    var url;
    try { url = new URL(u, ORIGIN + "/"); } catch (e) { return null; }
    if (url.origin !== ORIGIN) return null;
    var p = url.pathname + url.search + url.hash;
    return p.length <= 500 && /^\/(?!\/)[^\s\\<>"'`]*$/.test(p) ? p : null;
  }
  function posInt(v) { return typeof v === "number" && v > 0 && v % 1 === 0 && v < 1e12; }
  function toInt(v) { var n = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : v; return posInt(n) ? n : null; }
  function modName(v) { return typeof v === "string" && /^[a-z0-9_]{1,40}$/.test(v) ? v : ""; }
  function cmOf(u) {
    var p = portalPath(u || "");
    var m = p && /^\/mod\/[a-z0-9_]+\/view\.php\?(?:[^#]*&)?id=(\d+)/.exec(p);
    return m ? Number(m[1]) : null;
  }

  // ---------- Richiesta dell'app (#statale-open=SOQ1.…) ----------

  function b64urlEncode(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(text) {
    var s = text.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var bin = atob(s), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function badRequest() { var e = new Error("Richiesta dell'app non valida"); e.code = "badrequest"; return e; }

  // null se l'indirizzo non contiene una richiesta; errore se la richiesta non è valida.
  function parseRequest(hash) {
    var m = /(?:^|[#&])statale-open=(SOQ1\.[A-Za-z0-9_-]*)/.exec(String(hash || ""));
    if (!m) return null;
    if (m[1].length > LIMITS.request) throw badRequest();
    var o;
    try { o = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(b64urlDecode(m[1].slice(5)))); } catch (e) { throw badRequest(); }
    if (!o || typeof o !== "object" || o.v !== 1 || typeof o.rid !== "string" || !/^[A-Za-z0-9_-]{16,32}$/.test(o.rid)) throw badRequest();
    if (o.ret !== "frag" && o.ret !== "clip") throw badRequest();
    if (!Array.isArray(o.ops) || o.ops.length > LIMITS.ops) throw badRequest();
    var seen = {};
    var ops = o.ops.map(function (op) {
      if (!op || !posInt(op.n)) throw badRequest();
      var clean;
      if (op.k === "read" && posInt(op.id)) clean = { k: "read", id: op.id, n: op.n };
      else if (op.k === "done" && posInt(op.cm) && (op.v === 0 || op.v === 1)) clean = { k: "done", cm: op.cm, v: op.v, n: op.n };
      else throw badRequest();
      var key = opKey(clean);
      if (seen[key]) throw badRequest();
      seen[key] = true;
      return clean;
    });
    var tree = o.tree === undefined || o.tree === null ? null : o.tree;
    if (tree !== null && !(tree === 0 || posInt(tree))) throw badRequest();
    return { rid: o.rid, ret: o.ret, ops: ops, tree: tree };
  }
  function opKey(op) { return op.k === "read" ? "read:" + op.id : "done:" + op.cm; }

  // ---------- Risposte di Moodle → dati compatti ----------

  function normCourses(r) {
    var list = (r && Array.isArray(r.courses) ? r.courses : []).filter(function (c) { return c && posInt(c.id); });
    list.sort(function (a, b) { return (b.timeaccess || 0) - (a.timeaccess || 0); });
    return list.slice(0, LIMITS.courses).map(function (c) {
      return {
        id: c.id,
        name: textOf(c.fullnamedisplay || c.fullname),
        short: textOf(c.shortname || ""),
        progress: c.hasprogress === false || typeof c.progress !== "number" ? null : Math.min(Math.max(c.progress, 0), 100),
        last: posInt(c.timeaccess) ? c.timeaccess : 0
      };
    });
  }
  function normEvents(r) {
    return (r && Array.isArray(r.events) ? r.events : []).filter(function (e) {
      return e && posInt(e.id) && posInt(e.timesort || e.timestart);
    }).slice(0, LIMITS.events).map(function (e) {
      var action = e.action && typeof e.action.url === "string" ? e.action.url : "";
      return {
        id: e.id,
        name: textOf(e.name),
        c: e.course && posInt(e.course.id) ? e.course.id : null,
        cn: e.course ? textOf(e.course.fullnamedisplay || e.course.fullname || "") : "",
        mod: modName(e.modulename),
        t: e.timesort || e.timestart,
        u: portalPath(action) || portalPath(e.url),
        od: typeof e.overdue === "boolean" ? e.overdue : null,
        cm: cmOf(e.url) || cmOf(action)
      };
    });
  }
  // Dati in più dell'avviso (customdata, testo JSON di Moodle): solo il numero dell'attività e del corso.
  function noteIds(n) {
    var cd = n.customdata, out = { cm: null, crs: null };
    if (typeof cd === "string" && cd.length < 20000) { try { cd = JSON.parse(cd); } catch (e) { cd = null; } }
    if (cd && typeof cd === "object") { out.cm = toInt(cd.cmid); out.crs = toInt(cd.courseid); }
    if (!out.cm) out.cm = cmOf(n.contexturl);
    return out;
  }
  function normNotifications(r) {
    var seen = {};
    var list = (r && Array.isArray(r.notifications) ? r.notifications : []).filter(function (n) {
      if (!n || !posInt(n.id) || seen[n.id]) return false;
      seen[n.id] = true;
      return true;
    }).slice(0, LIMITS.notifications).map(function (n) {
      var ids = noteIds(n);
      return { id: n.id, s: textOf(n.subject), ctx: textOf(n.contexturlname || ""), u: portalPath(n.contexturl), t: posInt(n.timecreated) ? n.timecreated : 0, r: !!n.read,
        comp: modName(n.component), ev: modName(n.eventtype), cm: ids.cm, crs: ids.crs };
    });
    var unread = r && typeof r.unreadcount === "number" && r.unreadcount >= 0 ? Math.floor(r.unreadcount) : list.filter(function (n) { return !n.r; }).length;
    var out = { unread: unread, list: list };
    if (r && r.partial === true) out.part = 1;
    return out;
  }
  function normUser(r, id) {
    var u = (Array.isArray(r) ? r : []).filter(function (x) { return x && x.id === id; })[0];
    return u ? { id: id, name: textOf(u.fullname || ""), first: textOf(u.firstname || "", 100) } : { id: id, name: "", first: "" };
  }
  // core_courseformat_get_state: sezioni nell'ordine del corso, solo attività visibili (come CourseFormatState.sections).
  function normState(raw) {
    var st = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!st || typeof st !== "object" || !Array.isArray(st.cm) || !Array.isArray(st.section)) throw new Error("stato del corso non valido");
    var cms = {}, secs = {}, used = {};
    st.cm.forEach(function (m) { var id = m && toInt(m.id); if (id && !cms[id]) cms[id] = m; });
    st.section.forEach(function (s) { var id = s && toInt(s.id); if (id && !secs[id]) secs[id] = s; });
    var order = (st.course && Array.isArray(st.course.sectionlist) ? st.course.sectionlist : st.section.map(function (s) { return s && s.id; })).map(toInt);
    // Le sottosezioni che non sono nell'elenco principale vengono dopo, così nessuna attività va persa.
    st.section.forEach(function (s) { var id = s && toInt(s.id); if (id && order.indexOf(id) < 0) order.push(id); });
    var total = 0, sections = [];
    order.forEach(function (id) {
      var s = secs[id];
      if (!s || used[id]) return;
      used[id] = true;
      var mods = (Array.isArray(s.cmlist) ? s.cmlist : []).map(toInt).map(function (cid) { return cid && cms[cid]; }).filter(function (m) {
        return m && m.module !== "subsection" && m.uservisible !== false;
      }).slice(0, LIMITS.modules).map(function (m) {
        return {
          id: toInt(m.id), n: textOf(m.name), mod: modName(m.module), pl: textOf(m.modname || "", 60),
          st: typeof m.completionstate === "number" && m.completionstate >= 0 && m.completionstate <= 3 ? m.completionstate : null,
          u: portalPath(m.url)
        };
      });
      if (total + mods.length > LIMITS.totalModules) mods = mods.slice(0, Math.max(0, LIMITS.totalModules - total));
      total += mods.length;
      if (sections.length < LIMITS.sections) sections.push({ n: textOf(s.title || s.rawtitle || "", LIMITS.sectionText), m: mods });
    });
    return { sections: sections };
  }

  // Pagine course/index.php: le stesse espressioni di SitePages nell'app iPhone.
  function allMatches(re, html) {
    var out = [], m;
    re.lastIndex = 0;
    while ((m = re.exec(html)) !== null) { out.push(m); if (m[0] === "") re.lastIndex += 1; }
    return out;
  }
  function parseCategories(html, parent) {
    var seen = {}, out = [];
    allMatches(/data-categoryid="(\d+)"[^>]*>[\s\S]*?class="categoryname[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/gi, String(html || "")).forEach(function (m) {
      var id = Number(m[1]), name = textOf(m[2]);
      if (!posInt(id) || id === parent || seen[id] || !name) return;
      seen[id] = true;
      out.push({ id: id, n: name });
    });
    return out.slice(0, LIMITS.treeItems);
  }
  function parseCourses(html) {
    var patterns = [
      /data-courseid="(\d+)"[^>]*>[\s\S]*?class="coursename[^"]*"[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/gi,
      // Temi che ridisegnano l'elenco: si ripiega sui link agli insegnamenti.
      /<a[^>]+href="[^"]*\/course\/view\.php\?id=(\d+)"[^>]*>([\s\S]*?)<\/a>/gi
    ];
    for (var i = 0; i < patterns.length; i++) {
      var seen = {}, out = [];
      allMatches(patterns[i], String(html || "")).forEach(function (m) {
        var id = Number(m[1]), name = textOf(m[2]);
        if (!posInt(id) || id <= 1 || !name || seen[id]) return;
        seen[id] = true;
        out.push({ id: id, n: name });
      });
      if (out.length) return out.slice(0, LIMITS.treeItems);
    }
    return [];
  }

  // ---------- Errori ----------

  function bridgeError(code, message, extra) {
    var e = new Error(message || code);
    e.code = code;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }
  // expired: la sessione non c'è più; transient: rete o portale momentaneamente giù; permanent: Moodle ha rifiutato.
  function classifyError(e) {
    if (!e) return "transient";
    var code = e.errorcode || e.code || "";
    if (EXPIRED.indexOf(code) >= 0 || code === "expired") return "expired";
    if (code === "network" || code === "timeout" || code === "http5xx") return "transient";
    return "permanent";
  }
  function exceptionOf(r) {
    var x = r && (r.exception || r) || {};
    return { errorcode: typeof x.errorcode === "string" ? x.errorcode : "error", message: textOf(x.message || x.error || x.errorcode || "Errore del portale") };
  }

  // ---------- Trasporto: lib/ajax/service.php, unico punto di uscita verso il portale ----------

  async function ajax(env, calls) {
    calls.forEach(function (c) {
      if (ALLOWED.indexOf(c.methodname) < 0) throw bridgeError("notallowed", "Funzione non consentita: " + c.methodname);
    });
    var names = calls.map(function (c) { return c.methodname; });
    var url = env.wwwroot + "/lib/ajax/service.php?sesskey=" + encodeURIComponent(env.sesskey) +
      "&info=" + encodeURIComponent(names.length <= 5 ? names.join(",") : names.length + "-method-calls");
    var body = JSON.stringify(calls.map(function (c, i) { return { index: i, methodname: c.methodname, args: c.args }; }));
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, LIMITS.timeout) : null;
    var response, text;
    try {
      response = await env.fetch(url, {
        method: "POST", credentials: "same-origin", redirect: "manual", cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "application/json" }, body: body, signal: ctrl ? ctrl.signal : undefined
      });
      text = await response.text();
    } catch (e) {
      throw bridgeError(ctrl && ctrl.signal.aborted ? "timeout" : "network");
    } finally {
      if (timer) clearTimeout(timer);
    }
    env.requests += 1;
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) throw bridgeError("expired");
    if (response.status >= 500) throw bridgeError("http5xx", "HTTP " + response.status);
    if (!response.ok) throw bridgeError("http", "HTTP " + response.status);
    var json;
    // Una pagina HTML al posto del JSON: di solito il login di Ateneo dopo un reindirizzamento.
    try { json = JSON.parse(text); } catch (e) { throw bridgeError("expired"); }
    if (json && !Array.isArray(json) && typeof json === "object") {
      var top = exceptionOf(json);
      throw bridgeError(classifyError(top) === "expired" ? "expired" : top.errorcode, top.message);
    }
    if (!Array.isArray(json)) throw bridgeError("format", "Risposta inattesa del portale");
    return calls.map(function (c, i) {
      var r = json[i];
      if (!r || typeof r !== "object") return { missing: true };
      if (r.error) return { error: exceptionOf(r) };
      return { data: r.data };
    });
  }

  // Esegue le chiamate a gruppi. Moodle si ferma al primo errore di un gruppo: le chiamate rimaste senza risposta
  // vengono ripetute, così un errore in una parte non nasconde le altre. Una sessione scaduta ferma tutto.
  async function runCalls(env, calls, size) {
    var results = new Array(calls.length), queue = calls.map(function (c, i) { return i; });
    while (queue.length) {
      var batch = queue.slice(0, size);
      var out = await ajax(env, batch.map(function (i) { return calls[i]; }));
      var again = [];
      out.forEach(function (r, j) {
        if (r.missing) again.push(batch[j]);
        else if (r.error && classifyError(r.error) === "expired") throw bridgeError("expired");
        else results[batch[j]] = r;
      });
      if (again.length === batch.length) {
        again.forEach(function (i) { results[i] = { error: { errorcode: "noresponse", message: "Nessuna risposta dal portale" } }; });
        again = [];
      }
      queue = again.concat(queue.slice(batch.length));
    }
    return results;
  }

  async function getPage(env, path) {
    if (!PAGE_PATH.test(path)) throw bridgeError("notallowed", "Pagina non consentita");
    var ctrl = typeof AbortController === "function" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, LIMITS.timeout) : null;
    var response, text;
    try {
      response = await env.fetch(env.wwwroot + path, { credentials: "same-origin", redirect: "manual", cache: "no-store", signal: ctrl ? ctrl.signal : undefined });
      text = await response.text();
    } catch (e) {
      throw bridgeError(ctrl && ctrl.signal.aborted ? "timeout" : "network");
    } finally {
      if (timer) clearTimeout(timer);
    }
    env.requests += 1;
    if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) throw bridgeError("expired");
    if (!response.ok) throw bridgeError(response.status >= 500 ? "http5xx" : "http", "HTTP " + response.status);
    return text;
  }

  // ---------- Modifiche chieste dall'app ----------

  async function applyOps(env, ops) {
    var now = Math.floor(Date.now() / 1000), results = {};
    var calls = ops.map(function (op) {
      return op.k === "read"
        ? { methodname: "core_message_mark_notification_read", args: { notificationid: op.id, timeread: now } }
        : { methodname: "core_completion_update_activity_completion_status_manually", args: { cmid: op.cm, completed: op.v === 1 } };
    });
    var out = await runCalls(env, calls, LIMITS.opsBatch);
    ops.forEach(function (op, i) {
      var key = opKey(op) + "#" + op.n, r = out[i];
      if (r.error) {
        var kind = classifyError(r.error);
        results[key] = kind === "permanent" ? { s: "fail", p: 1, m: r.error.message } : { s: "fail", m: r.error.message };
      } else if (op.k === "done" && !(r.data && r.data.status === true)) {
        results[key] = { s: "fail", p: 1, m: "Il portale non ha cambiato lo stato dell'attività." };
      } else {
        results[key] = { s: "ok" };
      }
    });
    return results;
  }

  // ---------- Lettura ----------

  // Avvisi oltre la prima pagina: fino ad averli tutti da leggere (più i 100 più recenti), 2 pagine per richiesta.
  // Se una richiesta o una pagina non arriva restano quelli già letti, segnati come parziali.
  async function moreNotifications(env, first, progress) {
    var list = [], ids = {}, seenUnread = 0, partial = false;
    function add(page) {
      page.forEach(function (n) {
        // Un avviso arrivato durante la lettura sposta le pagine di uno: il doppione si salta.
        if (!n || !posInt(n.id) || ids[n.id]) return;
        ids[n.id] = true;
        list.push(n);
        if (!n.read) seenUnread++;
      });
    }
    var firstPage = Array.isArray(first && first.notifications) ? first.notifications : [];
    add(firstPage);
    var unread = first && typeof first.unreadcount === "number" ? first.unreadcount : null;
    var offset = firstPage.length, last = firstPage.length;
    while (last >= LIMITS.notifPage && list.length < LIMITS.notifications) {
      if (list.length >= LIMITS.notifRecent && (unread === null || seenUnread >= unread)) break;
      progress("Lettura degli avvisi: " + list.length + (unread ? " (" + unread + " da leggere)" : "") + "…");
      var calls = [];
      for (var i = 0; i < LIMITS.notifPages; i++) {
        calls.push({ methodname: "message_popup_get_popup_notifications",
          args: { useridto: env.userId, newestfirst: true, limit: LIMITS.notifPage, offset: offset + i * LIMITS.notifPage } });
      }
      var out;
      try { out = await runCalls(env, calls, LIMITS.notifPages); } catch (e) {
        if (e.code === "expired") throw e;
        partial = true;
        break;
      }
      for (var j = 0; j < out.length; j++) {
        var page = !out[j].error && out[j].data && Array.isArray(out[j].data.notifications) ? out[j].data.notifications : null;
        if (!page) { partial = true; last = 0; break; }
        add(page);
        offset += page.length;
        last = page.length;
        if (last < LIMITS.notifPage) break;
      }
      if (partial) break;
    }
    var res = { notifications: list, unreadcount: first ? first.unreadcount : undefined };
    if (partial) res.partial = true;
    return res;
  }

  async function collect(env, req, progress) {
    var now = Math.floor(Date.now() / 1000), warn = [], parts = {};
    progress("Lettura di corsi, scadenze e avvisi…");
    // Prima la chiamata facoltativa per ultima: se Moodle la rifiuta, le altre hanno già risposto.
    var first = await runCalls(env, [
      { methodname: "core_course_get_enrolled_courses_by_timeline_classification", args: { classification: "all", limit: 0, offset: 0 } },
      { methodname: "core_calendar_get_action_events_by_timesort", args: { timesortfrom: now - 14 * 86400, limitnum: LIMITS.events, limittononsuspendedevents: true } },
      { methodname: "message_popup_get_popup_notifications", args: { useridto: env.userId, newestfirst: true, limit: LIMITS.notifPage, offset: 0 } },
      { methodname: "core_user_get_users_by_field", args: { field: "id", values: [String(env.userId)] } }
    ], LIMITS.batch);
    function part(name, label, r, fn, fallback) {
      if (r.error) { parts[name] = false; warn.push({ part: label, code: r.error.errorcode, m: r.error.message }); return fallback; }
      try { var v = fn(r.data); parts[name] = true; return v; } catch (e) { parts[name] = false; warn.push({ part: label, code: "format", m: "Risposta inattesa" }); return fallback; }
    }
    // Gli avvisi oltre i primi 50 (due pagine per volta del portale); se una pagina manca restano quelli letti.
    if (!first[2].error && first[2].data) first[2] = { data: await moreNotifications(env, first[2].data, progress) };
    if (first[2].data && first[2].data.partial) warn.push({ part: "avvisi (in parte)", code: "partial", m: "Avvisi letti solo in parte" });
    var courses = part("courses", "corsi", first[0], normCourses, []);
    var events = part("events", "scadenze", first[1], normEvents, []);
    var notifs = part("notifs", "avvisi", first[2], normNotifications, { unread: 0, list: [] });
    var user = part("user", "nome", first[3], function (d) { return normUser(d, env.userId); }, { id: env.userId, name: "", first: "" });

    var contents = {};
    var targets = courses.slice(0, LIMITS.contents);
    for (var i = 0; i < targets.length; i += LIMITS.batch) {
      var group = targets.slice(i, i + LIMITS.batch);
      progress("Contenuti dei corsi: " + Math.min(i + group.length, targets.length) + " di " + targets.length + "…");
      var out = await runCalls(env, group.map(function (c) { return { methodname: "core_courseformat_get_state", args: { courseid: c.id } }; }), LIMITS.batch);
      group.forEach(function (c, j) {
        var r = out[j];
        if (r.error) { contents[c.id] = { err: { code: r.error.errorcode, m: r.error.message } }; return; }
        try { contents[c.id] = normState(r.data); } catch (e) { contents[c.id] = { err: { code: "format", m: "Struttura del corso non riconosciuta" } }; }
      });
    }
    var failed = targets.filter(function (c) { return contents[c.id] && contents[c.id].err; }).length;
    if (failed) warn.push({ part: "contenuti", c: failed, code: "contents", m: "Contenuti non letti per " + failed + (failed === 1 ? " corso" : " corsi") });

    var snap = {
      f: "statale-open-ponte", v: 1, bv: VERSION, sid: randomId(16), at: Date.now(),
      user: user, parts: parts, courses: courses, events: events, notifs: notifs, contents: contents, warn: warn
    };
    if (req && req.tree !== null) {
      try { snap.tree = await readTree(env, req.tree, progress); } catch (e) {
        if (e.code === "expired") throw e;
        warn.push({ part: "percorsi", code: e.code || "error", m: "Percorsi non letti" });
      }
    }
    return snap;
  }

  // Elenco dei percorsi, cluster e insegnamenti del percorso scelto, dalle pagine course/index.php.
  async function readTree(env, program, progress) {
    function path(id, browse) { return "/course/index.php?categoryid=" + id + "&browse=" + browse + "&perpage=1000"; }
    async function category(id) {
      var subs = parseCategories(await getPage(env, path(id, "categories")), id);
      var courses = parseCourses(await getPage(env, path(id, "courses")));
      return { subs: subs, courses: courses };
    }
    progress("Lettura dei percorsi…");
    var tree = { program: program, at: Date.now(), root: parseCategories(await getPage(env, path(0, "categories")), 0), cats: {} };
    if (program > 0) {
      tree.cats[program] = await category(program);
      var clusters = tree.cats[program].subs.slice(0, LIMITS.clusters);
      // Due pagine alla volta, per non pesare sul portale.
      for (var i = 0; i < clusters.length; i += 2) {
        progress("Lettura dei cluster: " + Math.min(i + 2, clusters.length) + " di " + clusters.length + "…");
        var pair = clusters.slice(i, i + 2);
        var got = await Promise.all(pair.map(function (c) { return category(c.id); }));
        pair.forEach(function (c, j) { tree.cats[c.id] = got[j]; });
      }
    }
    return tree;
  }

  // ---------- Pacchetto per l'app: SOP1.<z|j>.<sha256 16 hex>.<base64url> ----------

  function randomId(n) {
    var bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return b64urlEncode(bytes).slice(0, n);
  }
  async function sha16(bytes) {
    var digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return Array.prototype.map.call(digest, function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("").slice(0, 16);
  }
  async function deflate(bytes) {
    var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function encode(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (bytes.length > LIMITS.json) throw bridgeError("toobig", "Troppi dati da consegnare all'app");
    var sum = await sha16(bytes);
    if (typeof CompressionStream === "function") return "SOP1.z." + sum + "." + b64urlEncode(await deflate(bytes));
    return "SOP1.j." + sum + "." + b64urlEncode(bytes);
  }
  function summary(snap) {
    var unread = snap.notifs.list.filter(function (n) { return !n.r; }).length;
    var parts = [snap.courses.length + (snap.courses.length === 1 ? " corso" : " corsi"), snap.events.length + (snap.events.length === 1 ? " scadenza" : " scadenze")];
    parts.push(unread ? unread + (unread === 1 ? " avviso da leggere" : " avvisi da leggere") : "nessun avviso da leggere");
    return parts.join(", ");
  }

  // ---------- Pannello sulla pagina del portale ----------

  var CSS = [
    ":host{all:initial}",
    ".p{position:fixed;left:8px;right:8px;bottom:calc(8px + env(safe-area-inset-bottom,0px));z-index:2147483647;max-width:520px;margin:0 auto;",
    "background:#FFFFFF;color:#111114;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.28);padding:14px 16px 16px;",
    "font:16px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;display:flex;flex-direction:column;gap:10px}",
    ".h{display:flex;align-items:center;gap:10px;font-weight:700;font-size:16px}",
    ".h span{flex:1}.h small{font-weight:500;color:#6C6C73;font-size:13px}",
    ".x{font:inherit;font-size:22px;line-height:1;border:0;background:none;color:#6C6C73;padding:2px 6px;cursor:pointer}",
    ".m{margin:0}.d{margin:0;color:#6C6C73;font-size:14px}.e{margin:0;color:#B4440C}",
    ".b{display:flex;flex-direction:column;gap:8px}",
    "button.k{font:inherit;font-size:16px;font-weight:600;border:0;border-radius:12px;padding:12px;background:#E4E4EA;color:#006BA8;cursor:pointer}",
    "button.k.pr{background:#006BA8;color:#FFFFFF}",
    "textarea{font:13px ui-monospace,Menlo,monospace;width:100%;box-sizing:border-box;height:80px;border:1px solid #D9D9DE;border-radius:8px;padding:6px}",
    "@media (prefers-color-scheme:dark){.p{background:#1C1C1E;color:#F5F5F7}.h small,.d,.x{color:#9C9CA3}",
    ".e{color:#FFA154}button.k{background:#2C2C2E;color:#4CB8E6}button.k.pr{background:#4CB8E6;color:#06233A}textarea{background:#000;color:#F5F5F7;border-color:#38383C}}"
  ].join("");

  function makeUI(win) {
    var doc = win.document;
    var host = doc.createElement("div");
    host.setAttribute("data-statale-open", "ponte");
    var shadow = host.attachShadow({ mode: "open" });
    var style = doc.createElement("style");
    style.textContent = CSS;
    var panel = doc.createElement("div");
    panel.className = "p";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Statale Open, ponte con il portale");
    var head = doc.createElement("div");
    head.className = "h";
    var title = doc.createElement("span");
    title.textContent = "Statale Open · ponte ";
    var note = doc.createElement("small");
    note.textContent = "(non ufficiale)";
    title.appendChild(note);
    var close = doc.createElement("button");
    close.className = "x";
    close.setAttribute("aria-label", "Chiudi");
    close.textContent = "×";
    close.addEventListener("click", function () { hide(); });
    head.appendChild(title);
    head.appendChild(close);
    var message = doc.createElement("p");
    message.className = "m";
    var detail = doc.createElement("p");
    detail.className = "d";
    var buttons = doc.createElement("div");
    buttons.className = "b";
    panel.appendChild(head);
    panel.appendChild(message);
    panel.appendChild(detail);
    panel.appendChild(buttons);
    shadow.appendChild(style);
    shadow.appendChild(panel);

    function show() { if (!host.isConnected) (doc.body || doc.documentElement).appendChild(host); }
    function hide() { if (host.isConnected) host.remove(); }
    function set(text, more, isError, list) {
      show();
      message.textContent = text || "";
      message.className = isError ? "e" : "m";
      detail.textContent = more || "";
      detail.hidden = !more;
      while (buttons.firstChild) buttons.removeChild(buttons.firstChild);
      (list || []).forEach(function (b) {
        if (b.text !== undefined) {
          var area = doc.createElement("textarea");
          area.readOnly = true;
          area.value = b.text;
          area.setAttribute("aria-label", b.label);
          area.addEventListener("focus", function () { area.select(); });
          buttons.appendChild(area);
          return;
        }
        var btn = doc.createElement("button");
        btn.className = "k" + (b.primary ? " pr" : "");
        btn.textContent = b.label;
        btn.addEventListener("click", function () { b.act(btn); });
        buttons.appendChild(btn);
      });
    }
    return { show: show, hide: hide, set: set };
  }

  function copyText(win, text) {
    var doc = win.document;
    function legacy() {
      var area = doc.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "0";
      area.style.opacity = "0";
      (doc.body || doc.documentElement).appendChild(area);
      area.focus();
      area.select();
      try { area.setSelectionRange(0, text.length); } catch (e) { /* selezione non disponibile */ }
      var ok = false;
      try { ok = doc.execCommand("copy"); } catch (e) { ok = false; }
      area.remove();
      return ok;
    }
    var clip = win.navigator && win.navigator.clipboard;
    if (clip && clip.writeText) return clip.writeText(text).then(function () { return true; }, function () { return legacy(); });
    return Promise.resolve(legacy());
  }
  function downloadText(win, text) {
    var doc = win.document;
    var url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    var a = doc.createElement("a");
    a.href = url;
    a.download = "statale-open-dati.txt";
    (doc.body || doc.documentElement).appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  // Configurazione della pagina e indirizzo dell'app; errore con il testo da mostrare se la pagina non va bene.
  function readEnv(win, script) {
    function stop(message, code) { var e = new Error(message); e.code = code; return e; }
    if (win.location.origin !== ORIGIN) throw stop("Questa non è una pagina di La Statale Open.", "page");
    if (win.top !== win.self) throw stop("Apri la pagina del portale da sola, non dentro un'altra pagina, e tocca di nuovo il preferito.", "page");
    var src = script && script.src || "";
    var app = /^(https:\/\/[^\/?#]+\/(?:[^?#]*\/)?)ponte\/ponte-2\.js$/.exec(src);
    if (!app) throw stop("Il ponte va aperto dal preferito «Statale Open»: reinstallalo dall'app (Altro → Ponte con il portale).", "app");
    var cfg = win.M && win.M.cfg;
    if (!cfg || typeof cfg.wwwroot !== "string") {
      throw stop(win.document.readyState === "loading" ? "Attendi che la pagina finisca di caricarsi e riprova." : "Questa pagina non è adatta al ponte: apri la Dashboard e tocca di nuovo il preferito.", "nocfg");
    }
    var wwwroot = cfg.wwwroot.replace(/\/+$/, "");
    var root;
    try { root = new URL(wwwroot); } catch (e) { root = null; }
    if (!root || root.origin !== ORIGIN) throw stop("Questa pagina non è adatta al ponte: apri la Dashboard e tocca di nuovo il preferito.", "nocfg");
    var userId = Number(cfg.userId), sesskey = String(cfg.sesskey || "");
    if (!(userId > 1) || !/^[A-Za-z0-9]{6,64}$/.test(sesskey)) throw stop("Non hai ancora effettuato l'accesso al portale. Accedi, poi tocca di nuovo il preferito.", "guest");
    return { wwwroot: wwwroot, sesskey: sesskey, userId: userId, appBase: app[1], fetch: win.fetch.bind(win), requests: 0 };
  }

  function messageFor(e) {
    if (e.code === "expired") return "La sessione del portale è scaduta: ricarica la pagina, accedi e tocca di nuovo il preferito.";
    if (e.code === "network" || e.code === "timeout" || e.code === "http5xx") return "Il portale non risponde. Riprova tra poco.";
    if (e.code === "toobig") return "I dati sono troppi per l'app. Segnala il problema dall'app (Altro → Segnala un problema).";
    return "Il ponte non è riuscito a leggere il portale (" + (e.code || "errore") + "). Riprova; se si ripete, segnala il problema.";
  }

  function main(win, script) {
    var prev = win.__statalePonte;
    if (prev) {
      if (prev.busy || Date.now() - prev.finishedAt < LIMITS.repeat) { prev.ui.show(); return; }
      prev.ui.hide();
    }
    var ui = makeUI(win);
    var state = { ui: ui, busy: false, finishedAt: 0 };
    win.__statalePonte = state;

    var env;
    try { env = readEnv(win, script); } catch (e) {
      var buttons = [];
      if (e.code === "nocfg") buttons.push({ label: "Apri la Dashboard", primary: true, act: function () { win.location.assign(ORIGIN + "/my/"); } });
      if (e.code === "guest") buttons.push({ label: "Accedi", primary: true, act: function () { win.location.assign(ORIGIN + "/login/index.php"); } });
      ui.set(e.message, "", true, buttons);
      return;
    }

    // La richiesta dell'app esce subito dall'indirizzo (e dalla cronologia di questa scheda).
    var req = null, reqInvalid = false;
    try { req = parseRequest(win.location.hash); } catch (e) { reqInvalid = true; }
    if (/statale-open=/.test(win.location.hash)) {
      try { win.history.replaceState(win.history.state, "", win.location.pathname + win.location.search); } catch (e) { /* indirizzo invariato */ }
    }

    function finish() { state.busy = false; state.finishedAt = Date.now(); }

    function deliver(envelope, snap) {
      var fits = envelope.length <= LIMITS.fragment;
      var toApp = env.appBase + "#ponte=" + envelope;
      var text = "Dati letti: " + summary(snap) + ".";
      var warn = snap.warn.length ? "Non aggiornato: " + snap.warn.map(function (w) { return w.part; }).join(", ") + ". Il resto sì." : "";
      if (req && req.ret === "frag" && fits) {
        ui.set(text, "Torno all'app…");
        win.location.assign(toApp);
        return;
      }
      var list = [
        { label: "Copia per l'app", primary: true, act: function (btn) {
          copyText(win, envelope).then(function (ok) {
            if (ok) {
              btn.textContent = "Copiato ✓";
              ui.set(text, "Copiato. Apri Statale Open e tocca «Incolla i dati».", false, list);
            } else {
              ui.set("Copia non riuscita: tieni premuto nel riquadro, scegli «Seleziona tutto» e «Copia».", "", true,
                [{ label: "Dati per l'app", text: envelope }].concat(list.slice(1)));
            }
          });
        } }
      ];
      list.push(fits
        ? { label: "Apri l'app con i dati", act: function () { win.location.assign(toApp); } }
        : { label: "Torna all'app", act: function () { win.location.assign(env.appBase); } });
      list.push({ label: "Scarica i dati in un file", act: function () { downloadText(win, envelope); } });
      ui.set(text, [fits ? "" : "I dati sono troppi per tornare all'app in automatico: copiali e incollali nell'app.", warn].filter(Boolean).join(" "), false, list);
    }

    async function run(withOps) {
      state.busy = true;
      try {
        var results = null;
        if (req) {
          results = {};
          if (withOps && req.ops.length) {
            ui.set("Applico " + req.ops.length + (req.ops.length === 1 ? " modifica…" : " modifiche…"));
            results = await applyOps(env, req.ops);
          } else {
            req.ops.forEach(function (op) { results[opKey(op) + "#" + op.n] = { s: "skip" }; });
          }
        }
        var snap = await collect(env, req, function (t) { ui.set(t); });
        if (req) snap.res = { rid: req.rid, ops: results };
        ui.set("Preparo i dati per l'app…");
        var envelope = await encode(snap);
        finish();
        deliver(envelope, snap);
      } catch (e) {
        finish();
        state.finishedAt = 0;
        ui.set(messageFor(e), "", true, e.code === "expired"
          ? [{ label: "Ricarica la pagina", primary: true, act: function () { win.location.reload(); } }]
          : [{ label: "Riprova", primary: true, act: function () { run(withOps); } }]);
      }
    }

    if (reqInvalid) {
      ui.set("Richiesta dell'app non valida: nessuna modifica applicata.", "Leggo comunque i dati.", true);
      req = null;
      run(false);
      return;
    }
    if (req && req.ops.length) {
      var reads = req.ops.filter(function (op) { return op.k === "read"; }).length;
      var done = req.ops.filter(function (op) { return op.k === "done" && op.v === 1; }).length;
      var undone = req.ops.length - reads - done;
      var what = [];
      if (reads) what.push(reads + (reads === 1 ? " avviso letto" : " avvisi letti"));
      if (done) what.push(done + (done === 1 ? " attività completata" : " attività completate"));
      if (undone) what.push(undone + (undone === 1 ? " attività da fare" : " attività da fare"));
      ui.set("L'app chiede di applicare " + req.ops.length + (req.ops.length === 1 ? " modifica" : " modifiche") + " (" + what.join(", ") + ").",
        "Poi il ponte legge i dati aggiornati.", false, [
          { label: "Applica e aggiorna", primary: true, act: function () { run(true); } },
          { label: "Solo aggiorna", act: function () { run(false); } }
        ]);
      return;
    }
    run(false);
  }

  return {
    VERSION: VERSION, FILE: FILE, ALLOWED: ALLOWED, READS: READS, WRITES: WRITES, LIMITS: LIMITS,
    main: main, parseRequest: parseRequest, opKey: opKey, textOf: textOf, stripHTML: stripHTML, portalPath: portalPath, cmOf: cmOf,
    normCourses: normCourses, normEvents: normEvents, normNotifications: normNotifications, moreNotifications: moreNotifications, normUser: normUser, normState: normState,
    parseCategories: parseCategories, parseCourses: parseCourses, classifyError: classifyError,
    ajax: ajax, runCalls: runCalls, applyOps: applyOps, collect: collect, readTree: readTree,
    encode: encode, b64urlEncode: b64urlEncode, b64urlDecode: b64urlDecode, summary: summary
  };
});
