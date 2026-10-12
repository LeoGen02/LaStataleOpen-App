// Test della logica dell'app web: gli stessi casi dei test Swift in StataleOpenTests.
// Esegui con: node --test scripts/web/
const test = require("node:test");
const assert = require("node:assert/strict");
const C = require("../../docs/core.js");

test("classificazione delle attività come nell'app", () => {
  assert.equal(C.classify("E-tivity 1", "assign"), "etivity");
  assert.equal(C.classify("Etivity 3 – lavoro di gruppo", "page"), "etivity");
  assert.equal(C.classify("Quiz finale", "quiz"), "exercise");
  assert.equal(C.classify("Esercitazione 1", "url"), "exercise");
  assert.equal(C.classify("Autovalutazione modulo 2", "resource"), "exercise");
  assert.equal(C.classify("Videolezione 2", "kalvidres"), "lesson");
  assert.equal(C.classify("Slide del modulo", "resource"), "lesson");
  assert.equal(C.classify("Annunci", "forum"), "other");
  assert.equal(C.classify("Discussione sul caso di studio", "forum"), "etivity");
  assert.equal(C.classify("Qualcosa", "tipo-sconosciuto"), "other");
});

test("pulizia dell'HTML e delle entità", () => {
  assert.equal(C.htmlStripped("<p>Ciao&nbsp;<b>mondo</b></p>"), "Ciao mondo");
  assert.equal(C.htmlStripped("Perch&eacute; &#232; cos&igrave;"), "Perché è così");
  assert.equal(C.htmlStripped("A &amp;lt; B"), "A &lt; B");
  assert.equal(C.htmlStripped("riga 1<br/>riga 2"), "riga 1\nriga 2");
  assert.equal(C.htmlStripped(null), "");
});

test("scadenza dell'attività dalle date di Moodle", () => {
  assert.equal(C.dueDate([{ label: "Aperto:", timestamp: 10 }, { label: "Scadenza:", timestamp: 20 }, { label: "Altro", timestamp: 30 }]), 20000);
  assert.equal(C.dueDate([{ label: "Aperto:", timestamp: 10 }, { label: "Termine", timestamp: 30 }]), 30000);
  assert.equal(C.dueDate([]), null);
  assert.ok(C.isCompleted(1) && C.isCompleted(2) && !C.isCompleted(0) && !C.isCompleted(3));
});

test("i link condivisi non contengono mai il token", () => {
  assert.equal(
    C.sanitizedForSharing("https://lastataleopen.myariel.unimi.it/webservice/pluginfile.php/12/mod_resource/content/1/a.pdf?token=segreto&forcedownload=1"),
    "https://lastataleopen.myariel.unimi.it/pluginfile.php/12/mod_resource/content/1/a.pdf?forcedownload=1");
  const page = "https://lastataleopen.myariel.unimi.it/mod/quiz/view.php?id=5";
  assert.equal(C.sanitizedForSharing(page), page);
  assert.ok(!C.sanitizedForSharing("https://lastataleopen.myariel.unimi.it/webservice/pluginfile.php/3/x.pdf?token=s").includes("token"));
});

test("token aggiunto solo ai file del portale", () => {
  assert.equal(C.authenticatedFileURL("https://lastataleopen.myariel.unimi.it/webservice/pluginfile.php/1/a.pdf", "T"),
    "https://lastataleopen.myariel.unimi.it/webservice/pluginfile.php/1/a.pdf?token=T");
  assert.equal(C.authenticatedFileURL("https://example.org/pluginfile.php/1/a.pdf", "T"), "https://example.org/pluginfile.php/1/a.pdf");
  assert.equal(C.authenticatedFileURL("https://lastataleopen.myariel.unimi.it/mod/page/view.php?id=1", "T"), "https://lastataleopen.myariel.unimi.it/mod/page/view.php?id=1");
});

test("confronto delle versioni", () => {
  assert.ok(C.isNewer("v1.3.0", "1.2.0"));
  assert.ok(C.isNewer("1.10.0", "1.9.9"));
  assert.ok(C.isNewer("1.2.1", "1.2"));
  assert.ok(!C.isNewer("1.2", "1.2.0"));
  assert.ok(!C.isNewer("v1.2.0", "1.2.0"));
  assert.ok(!C.isNewer("ultima-versione", "1.2.0"));
  assert.equal(C.normalizedVersion(" v2.0.1 "), "2.0.1");
});

test("promemoria come DeadlineNotifier", () => {
  const now = 1_800_000_000_000, H = 3600e3, D = 24 * H;
  const ev = (id, dt) => ({ id, name: "Quiz " + id, courseName: "Corso", t: now + dt });
  assert.deepEqual(C.plannedReminders([ev(1, 3 * D)], now).map((r) => r.title), ["Scadenza domani", "Scadenza tra 2 ore"]);
  assert.equal(C.plannedReminders([ev(1, 3 * D)], now)[0].body, "Quiz 1 — Corso");
  assert.equal(C.plannedReminders([ev(1, 5 * H)], now).length, 1);
  assert.equal(C.plannedReminders([ev(2, H)], now).length, 0);
  assert.equal(C.plannedReminders([ev(3, -H)], now).length, 0);
  const many = Array.from({ length: 40 }, (_, i) => ev(i + 1, (i + 1) * D + 3 * H));
  const planned = C.plannedReminders(many, now);
  assert.equal(planned.length, 50);
  assert.ok(planned[0].identifier.startsWith("deadline-1-"));
});

test("calendario .ics con due avvisi per scadenza", () => {
  const now = Date.UTC(2026, 9, 12, 8, 0, 0);
  const ics = C.buildICS([
    { id: 7, name: "E-tivity 2, gruppo; finale", courseName: "Fondamenti di cybersecurity", url: "https://lastataleopen.myariel.unimi.it/mod/assign/view.php?id=1", t: now + 3 * 24 * 3600e3 },
    { id: 8, name: "Passata", courseName: "Corso", url: "", t: now - 1000 }
  ], now);
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.ok(ics.includes("TRIGGER:-PT24H") && ics.includes("TRIGGER:-PT2H"));
  assert.ok(ics.includes("SUMMARY:Scadenza: E-tivity 2\\, gruppo\\; finale"));
  assert.ok(ics.includes("DTSTART:20261015T080000Z"));
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75, "riga troppo lunga: " + line);
});

test("giorni Oggi e Domani", () => {
  const now = new Date(2026, 9, 12, 10, 0).getTime();
  assert.ok(C.dayTitle(C.startOfDay(now), now).startsWith("Oggi · "));
  assert.ok(C.dayTitle(C.startOfDay(now + 24 * 3600e3), now).startsWith("Domani · "));
  assert.equal(C.relative(now + 30e3, now), "adesso");
});
