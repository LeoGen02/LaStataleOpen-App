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

  return {
    MOODLE_HOST: MOODLE_HOST,
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
