# Statale Open — app iPhone per il portale myAriel (percorso SecAI)

App SwiftUI (iOS 17+, pensata per iPhone 15 Pro Max) che porta sul telefono il portale
[La Statale Open](https://lastataleopen.myariel.unimi.it), che non ha un'app propria.
Stessa pipeline dell'altro progetto: niente Mac, il progetto Xcode viene generato da **XcodeGen** nella GitHub Action, che produce un `.ipa` non firmato da installare con Sideloadly/AltStore.

## Cosa fa

| Scheda | Contenuto |
|---|---|
| **Home** | saluto, prossime scadenze, corsi aperti di recente, link rapidi (dashboard, calendario, valutazioni) |
| **Corsi** | *I miei corsi* con avanzamento, oppure *Percorso SecAI*: i cluster della categoria 2 e i relativi insegnamenti |
| **Dettaglio corso** | sezioni e attività con filtro **Lezioni / Esercizi / E-tivity**, ricerca, stato di completamento, segna come completata |
| **Scadenze** | quiz, consegne ed e-tivity in ordine di data |
| **Avvisi** | notifiche del portale (annunci, valutazioni, forum) con badge dei non letti |
| **Altro** | credenziali, notifiche, link al portale completo, logout |

Lezioni, quiz ed e-tivity si aprono nel **browser interno** (WKWebView) con la stessa sessione del portale:
upload di file e foto per le consegne, video inline, PDF e download visualizzati con QuickLook, condivisione/apertura in Safari.

**Notifiche locali**: promemoria 24 h e 2 h prima di ogni scadenza; in background (quando iOS lo concede) controlla i nuovi avvisi del portale.

## Come funziona il login

1. Inserisci email e password di Ateneo nella schermata iniziale: vengono salvate **solo nel Portachiavi dell'iPhone** (mai nel codice o nel repository).
2. L'app apre la pagina di login ufficiale (`elearning.unimi.it/...login.aspx`), la compila e la invia una volta (disattivabile con "Accesso automatico").
3. Una volta dentro Moodle, l'app chiede il token come fa l'app ufficiale Moodle (`admin/tool/mobile/launch.php`) e da lì usa i web service REST (`core_course_get_contents`, `core_calendar_get_action_events_by_timesort`, ecc.).
4. Le pagine aperte nel browser interno usano l'*autologin* di Moodle, e se la sessione scade il login viene ricompilato automaticamente.

**Piano B — modalità web:** se il portale non ha abilitato i servizi per app mobile, l'app lo segnala e offre la modalità web: schede native (Home, Corsi, Scadenze) che mostrano direttamente le pagine del sito, con login automatico.

## Struttura

```
project.yml                     spec XcodeGen (Info.plist, versione, icona, background fetch, URL scheme)
StataleOpen/
  App/       entry point, SiteConfig (URL del portale, categoria SecAI = 2)
  Models/    modelli JSON dei web service Moodle + classificazione lezioni/esercizi/e-tivity
  Services/  MoodleClient, SessionStore/PortalData, Keychain, notifiche, autofill login
  Views/     login, schede, dettaglio corso, browser interno
  Resources/ Assets.xcassets (icona, colore)
.github/workflows/build-unsigned-ipa.yml
```

## Novità 1.1

- **Icona** e colore dell'app.
- **Dati offline**: corsi, scadenze e avvisi restano visibili all'apertura anche senza rete (si aggiornano appena il portale risponde).
- **Badge** sull'icona con il numero di avvisi non letti.
- **Scadenze** con sezione *Scadute di recente* e giorni etichettati *Oggi* / *Domani*; in Home l'ora dell'ultimo aggiornamento.

## Scarica e installa

1. Scarica l'ipa già compilato: **[StataleOpen.ipa](https://github.com/LeoGen02/LaStataleOpen-App/releases/latest/download/StataleOpen.ipa)**
   (pagina *Releases* → *ultima-versione*; viene ripubblicato a ogni push. In alternativa: Actions → artifact `StataleOpen-unsigned`).
2. Sideloadly: trascina l'`.ipa`, Apple ID gratuito, Start.
3. iPhone: Impostazioni → Generali → VPN e gestione dispositivo → Autorizza. Con ID gratuito l'app va rifirmata ogni 7 giorni.

## Da verificare al primo avvio

Non ho potuto aprire il portale dall'ambiente di sviluppo, quindi:
- se l'invio automatico del login non parte (pulsante non riconosciuto), basta toccare "Accedi" a mano: i campi sono già compilati;
- se il portale non concede il token, usa la modalità web e segnalamelo: si può passare allo scraping delle pagine;
- la classificazione Lezioni/Esercizi/E-tivity usa tipo di attività e nome (es. "E-tivity 1" → E-tivity, quiz → Esercizi): si regola in `ActivityKind.classify`.
