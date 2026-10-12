/*
 * Statale Open — logica senza interfaccia, condivisa dall'app web e dai suoi test.
 * Ogni funzione replica la corrispondente dell'app iPhone (indicata nei commenti).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.StataleCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var H = 3600e3, D = 24 * H;
  var MOODLE_HOST = "lastataleopen.myariel.unimi.it";

  // String.htmlStripped (SiteConfig.swift)
  var ENTITIES = {
    "&nbsp;": " ", "&quot;": "\"", "&#39;": "'", "&apos;": "'", "&lt;": "<", "&gt;": ">",
    "&agrave;": "à", "&egrave;": "è", "&eacute;": "é", "&igrave;": "ì", "&ograve;": "ò", "&ugrave;": "ù",
    "&Agrave;": "À", "&Egrave;": "È", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”", "&ndash;": "–", "&mdash;": "—"
  };
  function htmlStripped(input) {
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

  // ActivityKind.classify (MoodleModels.swift)
  function classify(name, modname) {
    var n = String(name || "").toLowerCase();
    if (n.indexOf("e-tivit") >= 0 || n.indexOf("etivit") >= 0) return "etivity";
    if (n.indexOf("annunci") >= 0 || n.indexOf("notizie") >= 0 || n.indexOf("news") >= 0) return "other";
    if (n.indexOf("eserciz") >= 0 || n.indexOf("esercitaz") >= 0 || n.indexOf("autovalutazione") >= 0) return "exercise";
    if (n.indexOf("lezion") >= 0 || n.indexOf("videolez") >= 0) return "lesson";
    switch (modname) {
      case "quiz": return "exercise";
      case "assign": case "forum": case "workshop": case "wiki": case "glossary": case "choice": case "feedback": case "data": return "etivity";
      case "resource": case "page": case "url": case "folder": case "book": case "scorm": case "lesson": case "h5pactivity":
      case "hvp": case "imscp": case "lti": case "kalvidres": case "kalvidpres": return "lesson";
      default: return "other";
    }
  }

  // CourseModule.isCompleted / dueDate
  function isCompleted(state) { return state === 1 || state === 2; }
  function dueDate(dates) {
    if (!dates || !dates.length) return null;
    var preferred = dates.filter(function (d) {
      var l = String(d.label || "").toLowerCase();
      return l.indexOf("scaden") >= 0 || l.indexOf("due") >= 0 || l.indexOf("chiu") >= 0 || l.indexOf("close") >= 0;
    })[0] || dates[dates.length - 1];
    return preferred.timestamp * 1000;
  }

  // URL.sanitizedForSharing: mai il token dei web service nei link condivisi o aperti fuori dall'app.
  function sanitizedForSharing(url) {
    try {
      var u = new URL(url);
      if (!u.searchParams.has("token")) return url;
      u.searchParams.delete("token");
      u.pathname = u.pathname.replace("/webservice/pluginfile.php", "/pluginfile.php");
      return u.toString();
    } catch (e) { return url; }
  }

  // MoodleClient.authenticatedFileURL: i file dei web service richiedono il token.
  function authenticatedFileURL(url, token) {
    try {
      var u = new URL(url);
      if (u.host !== MOODLE_HOST || u.pathname.indexOf("pluginfile.php") < 0 || !token) return url;
      u.searchParams.set("token", token);
      return u.toString();
    } catch (e) { return url; }
  }

  // UpdateChecker.normalized / isNewer
  function normalizedVersion(tag) {
    var v = String(tag || "").trim();
    if (v.charAt(0) === "v" || v.charAt(0) === "V") v = v.slice(1);
    return v;
  }
  function versionParts(v) {
    return normalizedVersion(v).split(".").filter(function (p) { return p.length; }).map(function (p) {
      var m = /^\d+/.exec(p);
      return m ? parseInt(m[0], 10) : null;
    });
  }
  function isNewer(candidate, current) {
    var a = versionParts(candidate), b = versionParts(current);
    if (!a.length || a[0] === null) return false;
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var x = i < a.length ? (a[i] || 0) : 0, y = i < b.length ? (b[i] || 0) : 0;
      if (x !== y) return x > y;
    }
    return false;
  }

  // DeadlineNotifier.plannedReminders: 24 h e 2 h prima di ogni scadenza futura, al massimo 25 scadenze.
  function plannedReminders(events, now) {
    now = now == null ? Date.now() : now;
    var out = [];
    events.filter(function (e) { return e.t > now; }).sort(function (a, b) { return a.t - b.t; }).slice(0, 25).forEach(function (e) {
      [[D, "domani"], [2 * H, "tra 2 ore"]].forEach(function (r) {
        var fire = e.t - r[0];
        if (fire > now) {
          out.push({
            identifier: "deadline-" + e.id + "-" + (r[0] / 1000),
            fire: fire,
            title: "Scadenza " + r[1],
            body: [e.name, e.courseName].filter(Boolean).join(" — ")
          });
        }
      });
    });
    return out;
  }

  // Calendario .ics con gli stessi promemoria dell'app (24 h e 2 h prima), per chi usa l'app web.
  function icsText(s) { return String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n"); }
  function icsDate(t) { return new Date(t).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z"); }
  function foldLine(line) {
    // Righe al massimo di 75 byte (RFC 5545), spezzate senza dividere un carattere.
    var out = [], current = "", bytes = 0;
    Array.from(line).forEach(function (ch) {
      var cp = ch.codePointAt(0), size = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if (bytes + size > (out.length ? 74 : 75)) { out.push(current); current = ""; bytes = 0; }
      current += ch; bytes += size;
    });
    out.push(current);
    return out.join("\r\n ");
  }
  function buildICS(events, now) {
    now = now == null ? Date.now() : now;
    var lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Statale Open//Scadenze//IT", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:Scadenze La Statale Open"];
    events.filter(function (e) { return e.t > now; }).sort(function (a, b) { return a.t - b.t; }).forEach(function (e) {
      lines.push("BEGIN:VEVENT", "UID:statale-open-" + e.id + "@lastataleopen", "DTSTAMP:" + icsDate(now), "DTSTART:" + icsDate(e.t),
        "SUMMARY:" + icsText("Scadenza: " + e.name), "DESCRIPTION:" + icsText([e.courseName, e.url].filter(Boolean).join("\n")));
      if (e.url) lines.push("URL:" + e.url);
      [["PT24H", "domani"], ["PT2H", "tra 2 ore"]].forEach(function (a) {
        lines.push("BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + icsText("Scadenza " + a[1] + ": " + e.name), "TRIGGER:-" + a[0], "END:VALARM");
      });
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    return lines.map(foldLine).join("\r\n") + "\r\n";
  }

  // Date e tempi relativi in italiano, come le viste dell'app.
  function startOfDay(t) { var d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); }
  var rtf = typeof Intl !== "undefined" && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat("it", { numeric: "auto" }) : null;
  function relative(t, now) {
    now = now == null ? Date.now() : now;
    var diff = t - now, a = Math.abs(diff);
    if (!rtf) return new Date(t).toLocaleString("it-IT");
    if (a < 60e3) return "adesso";
    if (a < H) return rtf.format(Math.round(diff / 60e3), "minute");
    if (a < D) return rtf.format(Math.round(diff / H), "hour");
    return rtf.format(Math.round(diff / D), "day");
  }
  function dayTitle(day, now) {
    now = now == null ? Date.now() : now;
    var full = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(day);
    var today = startOfDay(now);
    if (day === today) return "Oggi · " + full;
    if (day === startOfDay(today + D + 3 * H)) return "Domani · " + full;
    return full.charAt(0).toUpperCase() + full.slice(1);
  }

  // ---------- Ponte con il portale (docs/ponte/ponte-N.js) ----------
  // Il portale ha i servizi per app spenti e il browser non lascia a questa pagina leggere le sue: il ponte è uno script
  // che l'utente avvia con un preferito sulla pagina del portale. Qui c'è tutto ciò che l'app fa con i suoi dati.
  var ORIGIN = "https://" + MOODLE_HOST;
  var PONTE = {
    version: 1,
    min: 1,
    file: "ponte/ponte-1.js",
    // Ponte automatico: script per l'estensione Userscripts di Safari, che avvia lo stesso ponte da solo.
    userscript: "ponte/statale-open-1.user.js",
    sri: "sha384-WuK1i08q5ugibinF49Tb4mka8bTimQM3l76f9nkUugF8cjVs49zNYCbQDRx0+UN6",
    // Impronte dei file pubblicati: non cambiano mai (i preferiti già installati le controllano).
    known: {
      "ponte/ponte-1.js": "sha384-WuK1i08q5ugibinF49Tb4mka8bTimQM3l76f9nkUugF8cjVs49zNYCbQDRx0+UN6",
      "ponte/statale-open-1.user.js": "sha384-jsohAMyb6FdOJpwHi3wiXRr+Zfavm3Yl8mb101rJb8fiB/0tzW8JHptrI+/QIJS8"
    },
    fragmentCap: 60000,
    maxEnvelope: 1500000,
    maxJSON: 3000000,
    staleH: 6,
    oldH: 48,
    reqTTL: D,
    pasteTTL: 30 * 60e3,
    treeTTL: 14 * D,
    opTTL: 30 * D,
    autoTTL: 10 * 60e3,
    autoAfter: H
  };

  // Preferito di Safari che carica il ponte con la sua impronta. Solo caratteri ASCII visibili: gli spazi e le lettere
  // accentate sono codificati (%20, %C3%A8), e nel codice non c'è nessun altro "%".
  function bookmarklet(appBase) {
    var code = "(function(d,s){if(location.hostname!==\"" + MOODLE_HOST + "\"){alert(\"Statale Open: tocca il preferito mentre sei su una pagina di La Statale Open.\");return}" +
      "s=d.createElement(\"script\");s.src=\"" + appBase + PONTE.file + "\";s.integrity=\"" + PONTE.sri + "\";s.crossOrigin=\"anonymous\";s.referrerPolicy=\"no-referrer\";" +
      "s.onerror=function(){alert(\"Statale Open: il ponte non si è caricato. Controlla la connessione; se continua, reinstalla il preferito dall'app (Altro, Ponte con il portale).\")};" +
      "(d.head||d.documentElement).appendChild(s)})(document)";
    if (code.indexOf("%") >= 0) throw new Error("Il codice del preferito non può contenere %");
    return "javascript:" + code.replace(/[^\x21-\x7E]/g, function (c) { return encodeURIComponent(c); });
  }

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
  function randomId(n) {
    var bytes = new Uint8Array(n);
    crypto.getRandomValues(bytes);
    return b64urlEncode(bytes).slice(0, n);
  }
  function ponteError(code) {
    var messages = {
      corrupt: "I dati incollati sono incompleti o danneggiati: copiali di nuovo dal portale.",
      toobig: "I dati sono troppo grandi per l'app. Segnala il problema.",
      unsupported: "Questo browser non sa aprire i dati compressi del ponte: aggiorna iOS o usa un browser recente.",
      newer: "Il ponte è più recente dell'app: chiudi e riapri l'app per aggiornarla.",
      oldbridge: "Il preferito «Statale Open» è di una versione non più supportata: reinstallalo da Altro → Ponte con il portale.",
      request: "Negli appunti c'è ancora l'indirizzo del portale: aprilo in Safari con «Incolla e vai» e tocca il preferito «Statale Open».",
      none: "Negli appunti non ci sono dati del ponte. Nel portale tocca «Copia per l'app» e riprova."
    };
    var e = new Error(messages[code] || messages.corrupt);
    e.code = code;
    return e;
  }
  function ponteMessage(code) { return ponteError(code).message; }

  // Trova i dati del ponte in un testo qualsiasi (appunti, file, indirizzo #ponte=…).
  function findEnvelope(text) {
    var s = String(text == null ? "" : text);
    var m = /SOP1\.[zj]\.[0-9a-f]{16}\.[A-Za-z0-9_-]+/.exec(s);
    if (m) return { kind: "payload", env: m[0] };
    if (/SOQ1\.[A-Za-z0-9_-]+/.test(s)) return { kind: "request" };
    return { kind: "none" };
  }
  async function sha16(bytes) {
    var digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
    return Array.prototype.map.call(digest, function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("").slice(0, 16);
  }
  async function inflate(bytes, cap) {
    if (typeof DecompressionStream !== "function") throw ponteError("unsupported");
    var reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate")).getReader();
    var chunks = [], total = 0;
    try {
      for (;;) {
        var r = await reader.read();
        if (r.done) break;
        total += r.value.length;
        // Mai più di cap byte decompressi, anche se il testo è costruito per esplodere.
        if (total > cap) { reader.cancel().catch(function () {}); throw ponteError("toobig"); }
        chunks.push(r.value);
      }
    } catch (e) {
      throw e && e.code === "toobig" ? e : ponteError("corrupt");
    }
    var out = new Uint8Array(total), at = 0;
    chunks.forEach(function (c) { out.set(c, at); at += c.length; });
    return out;
  }
  async function decodePayload(env) {
    if (typeof env !== "string" || env.length > PONTE.maxEnvelope) throw ponteError("toobig");
    var m = /^SOP1\.([zj])\.([0-9a-f]{16})\.([A-Za-z0-9_-]+)$/.exec(env);
    if (!m) throw ponteError("corrupt");
    var bytes;
    try { bytes = b64urlDecode(m[3]); } catch (e) { throw ponteError("corrupt"); }
    if (m[1] === "z") bytes = await inflate(bytes, PONTE.maxJSON);
    if (bytes.length > PONTE.maxJSON) throw ponteError("toobig");
    if ((await sha16(bytes)) !== m[2]) throw ponteError("corrupt");
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch (e) { throw ponteError("corrupt"); }
  }

  // Controllo completo dei dati ricevuti: tipi, numeri, lunghezze, testo semplice e solo indirizzi del portale.
  // Quello che non torna viene scartato; un pacchetto non riconosciuto viene rifiutato.
  var BAD_CHARS = /[\u0000-\u0009\u000B-\u001F\u007F‪-‮⁦-⁩]/g;
  function vText(v, max) {
    if (typeof v !== "string") return "";
    var s = v.replace(BAD_CHARS, "");
    return s.length > max ? s.slice(0, max) : s;
  }
  function vInt(v) { return typeof v === "number" && v > 0 && v % 1 === 0 && v < 1e12 ? v : null; }
  function vSec(v) { return typeof v === "number" && v >= 946684800 && v <= 4102444800 ? Math.floor(v) : 0; }
  function vPath(v) { return typeof v === "string" && v.length <= 500 && /^\/(?!\/)[^\s\\<>"'`]*$/.test(v) ? v : null; }
  function vMod(v) { return typeof v === "string" && /^[a-z0-9_]{1,40}$/.test(v) ? v : ""; }
  function vList(v, max) { return Array.isArray(v) ? v.slice(0, max) : []; }
  function portalURL(path) {
    var p = vPath(path);
    if (!p) return "";
    try {
      var u = new URL(ORIGIN + p);
      return u.host === MOODLE_HOST && u.protocol === "https:" ? u.toString() : "";
    } catch (e) { return ""; }
  }
  function vNamed(list, max) {
    var seen = {};
    return vList(list, max).map(function (x) { return x && vInt(x.id) ? { id: x.id, n: vText(x.n, 200) } : null; })
      .filter(function (x) { if (!x || !x.n || seen[x.id]) return false; seen[x.id] = true; return true; });
  }
  function validateSnapshot(o, now) {
    now = now == null ? Date.now() : now;
    if (!o || typeof o !== "object" || o.f !== "statale-open-ponte") throw ponteError("corrupt");
    if (typeof o.v !== "number" || o.v > 1) throw ponteError(o.v > 1 ? "newer" : "corrupt");
    if (o.v !== 1) throw ponteError("corrupt");
    if (typeof o.bv !== "number" || o.bv < PONTE.min) throw ponteError("oldbridge");
    if (typeof o.sid !== "string" || !/^[A-Za-z0-9_-]{8,40}$/.test(o.sid)) throw ponteError("corrupt");
    if (typeof o.at !== "number" || o.at < 946684800000 || o.at > now + D) throw ponteError("corrupt");
    var user = o.user || {};
    if (!vInt(user.id)) throw ponteError("corrupt");
    var parts = o.parts || {};
    var snap = {
      v: 1, bv: o.bv, sid: o.sid, at: o.at,
      user: { id: user.id, name: vText(user.name, 200), first: vText(user.first, 100) },
      parts: { courses: parts.courses === true, events: parts.events === true, notifs: parts.notifs === true, user: parts.user === true },
      courses: [], events: [], notifs: { unread: 0, list: [] }, contents: {}, warn: []
    };
    var seenCourse = {};
    vList(o.courses, 200).forEach(function (c) {
      if (!c || !vInt(c.id) || seenCourse[c.id]) return;
      seenCourse[c.id] = true;
      snap.courses.push({
        id: c.id, name: vText(c.name, 200) || "Corso " + c.id, short: vText(c.short, 200),
        progress: typeof c.progress === "number" && c.progress >= 0 && c.progress <= 100 ? c.progress : null, last: vSec(c.last)
      });
    });
    vList(o.events, 100).forEach(function (e) {
      if (!e || !vInt(e.id) || !vSec(e.t)) return;
      snap.events.push({ id: e.id, name: vText(e.name, 200), c: vInt(e.c), cn: vText(e.cn, 200), mod: vMod(e.mod), t: vSec(e.t), u: vPath(e.u), od: typeof e.od === "boolean" ? e.od : null, cm: vInt(e.cm) });
    });
    var notifs = o.notifs || {};
    vList(notifs.list, 100).forEach(function (n) {
      if (!n || !vInt(n.id)) return;
      snap.notifs.list.push({ id: n.id, s: vText(n.s, 200), ctx: vText(n.ctx, 200), u: vPath(n.u), t: vSec(n.t), r: n.r === true });
    });
    snap.notifs.unread = typeof notifs.unread === "number" && notifs.unread >= 0 && notifs.unread % 1 === 0 ? Math.min(notifs.unread, 9999)
      : snap.notifs.list.filter(function (n) { return !n.r; }).length;
    var total = 0;
    Object.keys(o.contents && typeof o.contents === "object" ? o.contents : {}).slice(0, 60).forEach(function (key) {
      if (!/^\d{1,11}$/.test(key) || !vInt(Number(key))) return;
      var c = o.contents[key];
      if (!c || typeof c !== "object") return;
      if (!Array.isArray(c.sections)) {
        snap.contents[key] = { err: { code: vText(c.err && c.err.code, 60) || "error", m: vText(c.err && c.err.m, 200) } };
        return;
      }
      snap.contents[key] = { sections: vList(c.sections, 100).map(function (s) {
        var mods = vList(s && s.m, 300).filter(function (m) { return m && vInt(m.id); }).map(function (m) {
          return { id: m.id, n: vText(m.n, 200), mod: vMod(m.mod), pl: vText(m.pl, 60), st: m.st === 0 || m.st === 1 || m.st === 2 || m.st === 3 ? m.st : null, u: vPath(m.u) };
        });
        mods = mods.slice(0, Math.max(0, 3000 - total));
        total += mods.length;
        return { n: vText(s && s.n, 120), m: mods };
      }) };
    });
    if (o.tree && typeof o.tree === "object") {
      var t = o.tree, cats = {};
      Object.keys(t.cats && typeof t.cats === "object" ? t.cats : {}).slice(0, 50).forEach(function (key) {
        if (!/^\d{1,11}$/.test(key)) return;
        var c = t.cats[key] || {};
        cats[key] = { subs: vNamed(c.subs, 500), courses: vNamed(c.courses, 500) };
      });
      var program = t.program === 0 ? 0 : vInt(t.program);
      if (program !== null) snap.tree = { program: program, at: typeof t.at === "number" && t.at > 0 && t.at <= now + D ? t.at : o.at, root: vNamed(t.root, 500), cats: cats };
    }
    if (o.res && typeof o.res === "object" && typeof o.res.rid === "string" && /^[A-Za-z0-9_-]{16,32}$/.test(o.res.rid)) {
      var ops = {};
      Object.keys(o.res.ops && typeof o.res.ops === "object" ? o.res.ops : {}).slice(0, 100).forEach(function (key) {
        var r = o.res.ops[key];
        if (!/^(read|done):\d{1,11}#\d{1,9}$/.test(key) || !r || ["ok", "fail", "skip"].indexOf(r.s) < 0) return;
        ops[key] = { s: r.s, p: r.p === 1 ? 1 : 0, m: vText(r.m, 200) };
      });
      snap.res = { rid: o.res.rid, ops: ops };
    }
    snap.warn = vList(o.warn, 20).filter(function (w) { return w && typeof w === "object"; }).map(function (w) {
      return { part: vText(w.part, 30), code: vText(w.code, 60), m: vText(w.m, 200) };
    });
    return snap;
  }

  // Unisce i dati nuovi a quelli già salvati: una parte non letta questa volta resta quella di prima (segnata come vecchia).
  function mergeSnapshot(prev, next) {
    var out = JSON.parse(JSON.stringify(next));
    if (!prev || prev.user.id !== next.user.id) return out;
    out.stale = {};
    if (!next.parts.courses && prev.courses.length) { out.courses = prev.courses; out.stale.courses = true; }
    if (!next.parts.events && prev.events.length) { out.events = prev.events; out.stale.events = true; }
    if (!next.parts.notifs && prev.notifs.list.length) { out.notifs = prev.notifs; out.stale.notifs = true; }
    if (!next.parts.user && prev.user.name) { out.user = prev.user; }
    var keep = {};
    out.courses.forEach(function (c) { keep[c.id] = true; });
    Object.keys(prev.contents || {}).forEach(function (key) {
      var old = prev.contents[key], fresh = out.contents[key];
      if (!keep[key] || !old || !old.sections) return;
      if (!fresh || !fresh.sections) out.contents[key] = { sections: old.sections, stale: true, err: fresh && fresh.err };
    });
    if (!out.tree && prev.tree) out.tree = prev.tree;
    return out;
  }

  // Dati del ponte nei modelli delle viste (gli stessi di normCourse, normEvent, normNotification in app.js).
  function dueByCm(events) {
    var due = {};
    (events || []).forEach(function (e) { if (e.cm && (!due[e.cm] || e.t < due[e.cm])) due[e.cm] = e.t; });
    return due;
  }
  function toModels(snap) {
    return {
      siteInfo: { userid: snap.user.id, fullname: snap.user.name || "Studente", firstname: snap.user.first || "", username: "", sitename: "La Statale Open" },
      courses: snap.courses.map(function (c) {
        return { id: c.id, name: c.name, short: c.short, category: null, progress: c.progress, last: c.last * 1000 };
      }).sort(function (a, b) { return b.last - a.last; }),
      events: snap.events.map(function (e) {
        return { id: e.id, name: e.name, courseId: e.c, courseName: e.cn, mod: e.mod, t: e.t * 1000, url: portalURL(e.u), overdue: e.od };
      }).sort(function (a, b) { return a.t - b.t; }),
      notifications: {
        list: snap.notifs.list.map(function (n) {
          return { id: n.id, subject: n.s, ctx: n.ctx, url: portalURL(n.u), t: n.t * 1000, read: n.r };
        }).sort(function (a, b) { return b.t - a.t; }),
        unread: snap.notifs.unread
      }
    };
  }
  // Sezioni del corso per CourseDetailView, con le modifiche in attesa sovrapposte; null se il ponte non le ha lette.
  function sectionsFor(snap, courseId, box) {
    var c = snap.contents[courseId];
    if (!c || !c.sections) return null;
    var due = dueByCm(snap.events), ops = box && box.ops || {};
    return c.sections.map(function (s) {
      return {
        name: s.n, summary: "",
        modules: s.m.map(function (m) {
          var op = ops["done:" + m.id];
          return {
            id: m.id, courseId: courseId, name: m.n, mod: m.mod, modplural: m.pl || m.mod, kind: classify(m.n, m.mod),
            description: m.mod === "label" ? m.n : "", completion: m.st === null ? 0 : 1,
            done: op ? op.v === 1 : isCompleted(m.st), pending: !!op, url: portalURL(m.u), contents: [], due: due[m.id] ? due[m.id] * 1000 : null
          };
        })
      };
    });
  }
  function overlayNotifications(notifications, box) {
    var ops = box && box.ops || {}, cleared = 0;
    var list = notifications.list.map(function (n) {
      if (!ops["read:" + n.id] || n.read) return n;
      cleared += 1;
      return Object.assign({}, n, { read: true, pending: true });
    });
    return { list: list, unread: Math.max(0, notifications.unread - cleared) };
  }

  // ---------- Modifiche in attesa (avvisi letti, attività completate) ----------
  // Una modifica per elemento, con l'ultimo stato voluto: ripeterla non fa danni.
  function emptyBox(uid) { return { uid: uid || null, seq: 0, ops: {} }; }
  function opKey(op) { return op.k === "read" ? "read:" + op.id : "done:" + op.cm; }
  // current: valore che il portale ha oggi secondo i dati del ponte; inflight: chiavi già partite con l'ultima richiesta.
  function enqueueOp(box, op, current, inflight, now) {
    var out = JSON.parse(JSON.stringify(box || emptyBox()));
    var key = opKey(op), desired = op.k === "read" ? true : op.v === 1;
    var sent = (inflight || []).some(function (k) { return k.split("#")[0] === key; });
    if (current === desired && !sent) { delete out.ops[key]; return out; }
    out.seq += 1;
    out.ops[key] = Object.assign({}, op, { n: out.seq, at: now == null ? Date.now() : now, tries: out.ops[key] ? out.ops[key].tries || 0 : 0 });
    return out;
  }
  function cancelOp(box, key) {
    var out = JSON.parse(JSON.stringify(box));
    delete out.ops[key];
    return out;
  }
  function pendingOps(box) {
    return Object.keys(box && box.ops || {}).map(function (k) { return box.ops[k]; }).sort(function (a, b) { return a.n - b.n; });
  }
  function opsSummary(box) {
    var ops = pendingOps(box), reads = 0, done = 0, undone = 0;
    ops.forEach(function (op) { if (op.k === "read") reads += 1; else if (op.v === 1) done += 1; else undone += 1; });
    var parts = [];
    if (reads) parts.push(reads + (reads === 1 ? " avviso letto" : " avvisi letti"));
    if (done) parts.push(done + (done === 1 ? " attività completata" : " attività completate"));
    if (undone) parts.push(undone + " da fare");
    return parts.join(", ");
  }
  // Richiesta per il ponte: solo numeri (nessun titolo), nell'indirizzo del portale dopo #statale-open=.
  function buildRequest(box, opts) {
    opts = opts || {};
    var ops = pendingOps(box).slice(0, 100);
    var rid = opts.rid || randomId(22);
    var req = { v: 1, rid: rid, ret: opts.ret === "clip" ? "clip" : "frag", ops: ops.map(function (op) {
      return op.k === "read" ? { k: "read", id: op.id, n: op.n } : { k: "done", cm: op.cm, v: op.v === 1 ? 1 : 0, n: op.n };
    }) };
    if (opts.tree != null) req.tree = opts.tree;
    var text = "SOQ1." + b64urlEncode(new TextEncoder().encode(JSON.stringify(req)));
    return {
      text: text,
      pending: { rid: rid, at: opts.now == null ? Date.now() : opts.now, ret: req.ret, tree: opts.tree == null ? null : opts.tree,
        keys: ops.map(function (op) { return opKey(op) + "#" + op.n; }) }
    };
  }
  // Con il preferito si va alla Dashboard; con il ponte automatico alla pagina iniziale, che si apre anche senza login:
  // così lo script può tenere la richiesta mentre l'utente entra (la Dashboard rimanderebbe subito al login di Ateneo).
  function requestURL(text, entry) { return ORIGIN + (entry === "auto" ? "/" : "/my/") + "#statale-open=" + text; }

  // La modifica risulta già fatta nei dati appena letti? null se il ponte non ha letto quella parte.
  function satisfied(op, snap) {
    if (op.k === "read") {
      if (!snap.parts.notifs) return null;
      var n = snap.notifs.list.filter(function (x) { return x.id === op.id; })[0];
      return n ? n.r : true;
    }
    var c = snap.contents[op.c];
    if (!c || !c.sections || c.stale) return null;
    var found = null;
    c.sections.forEach(function (s) { s.m.forEach(function (m) { if (m.id === op.cm) found = m; }); });
    if (!found || found.st === null) return true;
    return isCompleted(found.st) === (op.v === 1);
  }
  // Dopo ogni importazione: toglie le modifiche arrivate al portale, tiene quelle da ritentare, segnala quelle rifiutate.
  function reconcile(args) {
    var box = JSON.parse(JSON.stringify(args.box || emptyBox())), snap = args.snap, res = snap.res, pending = args.pending;
    var now = args.now == null ? Date.now() : args.now, failed = [], notes = [];
    var matched = !!(res && pending && res.rid === pending.rid);
    Object.keys(box.ops).forEach(function (key) {
      var op = box.ops[key], r = matched ? res.ops[key + "#" + op.n] : null;
      if (r && r.s === "ok") { delete box.ops[key]; return; }
      if (r && r.s === "fail" && r.p) { delete box.ops[key]; failed.push({ key: key, label: op.label || "", m: r.m, at: now }); return; }
      if (satisfied(op, snap) === true) { delete box.ops[key]; return; }
      if (r) op.tries = (op.tries || 0) + 1;
      if (now - op.at > PONTE.opTTL) { delete box.ops[key]; failed.push({ key: key, label: op.label || "", m: "Non inviata entro 30 giorni.", at: now }); }
    });
    var sentKeys = pending && pending.keys || [];
    if (sentKeys.length && !matched && sentKeys.some(function (k) { return box.ops[k.split("#")[0]]; })) {
      notes.push("Le modifiche non sono arrivate al portale (probabilmente per l'accesso). Tocca «Aggiorna dal portale» per riprovare.");
    }
    return { box: box, failed: failed, notes: notes, matched: matched };
  }

  // Quanto sono vecchi i dati del ponte: freschi sotto le 6 ore, vecchi dopo 48.
  function staleness(at, now) {
    now = now == null ? Date.now() : now;
    var age = now - at;
    return age < PONTE.staleH * H ? "fresh" : age < PONTE.oldH * H ? "stale" : "old";
  }

  return {
    MOODLE_HOST: MOODLE_HOST,
    ORIGIN: ORIGIN,
    PONTE: PONTE,
    bookmarklet: bookmarklet,
    b64urlEncode: b64urlEncode,
    b64urlDecode: b64urlDecode,
    randomId: randomId,
    ponteMessage: ponteMessage,
    findEnvelope: findEnvelope,
    decodePayload: decodePayload,
    validateSnapshot: validateSnapshot,
    mergeSnapshot: mergeSnapshot,
    portalURL: portalURL,
    dueByCm: dueByCm,
    toModels: toModels,
    sectionsFor: sectionsFor,
    overlayNotifications: overlayNotifications,
    emptyBox: emptyBox,
    opKey: opKey,
    enqueueOp: enqueueOp,
    cancelOp: cancelOp,
    pendingOps: pendingOps,
    opsSummary: opsSummary,
    buildRequest: buildRequest,
    requestURL: requestURL,
    reconcile: reconcile,
    staleness: staleness,
    htmlStripped: htmlStripped,
    classify: classify,
    isCompleted: isCompleted,
    dueDate: dueDate,
    sanitizedForSharing: sanitizedForSharing,
    authenticatedFileURL: authenticatedFileURL,
    normalizedVersion: normalizedVersion,
    isNewer: isNewer,
    plannedReminders: plannedReminders,
    buildICS: buildICS,
    startOfDay: startOfDay,
    relative: relative,
    dayTitle: dayTitle
  };
});
