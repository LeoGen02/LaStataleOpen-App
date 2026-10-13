# Statale Open

[![CI](https://github.com/LeoGen02/LaStataleOpen-App/actions/workflows/ci.yml/badge.svg)](https://github.com/LeoGen02/LaStataleOpen-App/actions/workflows/ci.yml)

App iPhone per il portale **[La Statale Open](https://lastataleopen.myariel.unimi.it)** (Moodle myAriel), che non ha un'app propria:
corsi con lezioni, esercizi ed e-tivity, scadenze con promemoria, avvisi del portale e un browser interno già autenticato.

> **App non ufficiale**, realizzata da studenti: non è affiliata né approvata dall'Università degli Studi di Milano.
> Le credenziali restano sul tuo iPhone; l'app comunica solo con i server dell'Ateneo e con GitHub per controllare gli aggiornamenti
> ([privacy](PRIVACY.md)).

## App web (senza installare nulla)

**[leogen02.github.io/LaStataleOpen-App](https://leogen02.github.io/LaStataleOpen-App/)** — la stessa app, dal browser del telefono o del computer,
con i tuoi corsi, scadenze e avvisi veri. In Safari *Condividi → Aggiungi alla schermata Home* la apre a tutto schermo con la sua icona.

- **Ponte con il portale.** Il portale ha i servizi per app spenti e il browser non lascia a una pagina di `github.io` leggere le sue.
  Il ponte è un preferito di Safari, «Statale Open», che tocchi su una pagina del portale in cui sei già entrato: legge corsi, sezioni e attività,
  scadenze, avvisi e percorsi con `lib/ajax/service.php` (lo stesso canale delle pagine del portale) e riporta i dati all'app.
  Installazione una volta sola, poi 3 tocchi per aggiornare in Safari: **[guida passo passo](docs/INSTALLAZIONE.md#app-web-con-il-ponte-consigliata-per-iniziare)**.
- **Accedi dall'app con il ponte automatico** (consigliato): con l'estensione gratuita *Userscripts* per Safari e lo script
  `docs/ponte/statale-open-2.user.js`, **Accedi** apre la pagina ufficiale del portale (la password la scrivi solo lì, Safari può compilarla)
  e l'app si riapre con i tuoi dati; anche entrando direttamente dalla pagina di login di Ateneo, dopo «Entra» torni all'app da solo. Poi «Aggiorna dal portale» è **un solo tocco**, e all'apertura l'app si aggiorna da sola se i dati hanno
  più di un'ora: il ponte parte da solo (anche dopo il login di Ateneo) e l'app si riapre con i dati; se ci sono modifiche da inviare, il pannello chiede una conferma. Funziona in Safari, anche da un'icona sulla schermata Home
  aggiunta con «Apri come app web» spento. Lo script parte solo per le richieste che l'app gli consegna.
- **Modifiche in attesa**: avvisi letti e attività completate partono al prossimo aggiornamento, dopo una conferma nel pannello del ponte.
- **Sicurezza**: il preferito carica solo `docs/ponte/ponte-1.js` con la sua impronta SHA-384 (Subresource Integrity: se il file cambia
  il browser non lo esegue); il ponte non legge cookie né password, chiama solo sette funzioni Moodle elencate nel codice e consegna i dati
  solo all'app (indirizzo, appunti o file). Dettagli in [SECURITY](SECURITY.md#ponte-con-il-portale-app-web).
- **Altri accessi**: email e password o *chiave dell'app* (se il portale riattiva i servizi per app), *modalità web* (pagine del portale)
  e *dati di esempio* per provare tutto senza account.
- **Differenze dall'app iPhone**, dovute al browser: i dati si aggiornano quando tocchi il preferito, non da soli; le pagine del portale
  si aprono in una nuova scheda; i promemoria si aggiungono al Calendario con un file `.ics` (stessi avvisi 24 h e 2 h prima).

L'app web sta in `docs/` ed è pubblicata con GitHub Pages (vedi [CONTRIBUTING](CONTRIBUTING.md#app-web)).

## Scarica l'app iPhone

**[⬇︎ StataleOpen.ipa — ultima versione](https://github.com/LeoGen02/LaStataleOpen-App/releases/latest/download/StataleOpen.ipa)**
· [tutte le versioni e le novità](https://github.com/LeoGen02/LaStataleOpen-App/releases)

Serve un iPhone con **iOS 17 o successivo**, un Apple ID (va bene quello gratuito) e, per la prima installazione, un computer Windows o Mac.

## Installa

In breve, con [Sideloadly](https://sideloadly.io):

1. collega l'iPhone al computer, apri Sideloadly e trascina dentro `StataleOpen.ipa`;
2. inserisci il tuo Apple ID e premi **Start**;
3. sull'iPhone attiva la **Modalità sviluppatore** (*Impostazioni → Privacy e sicurezza*) e autorizza il tuo Apple ID
   (*Impostazioni → Generali → VPN e gestione dispositivo*).

Con un Apple ID gratuito l'app va rinnovata ogni 7 giorni. Tutti i passaggi, AltStore/SideStore e i problemi frequenti:
**[guida all'installazione](docs/INSTALLAZIONE.md)**.

### Aggiornamenti

- L'app controlla da sola se c'è una versione nuova e lo segnala in Home (oppure *Altro → Informazioni → Controlla aggiornamenti*).
- Per aggiornare installa il nuovo ipa sopra quello vecchio con lo stesso Apple ID: credenziali e impostazioni restano.
- Con **AltStore** o **SideStore** aggiungi la sorgente e aggiorni dal telefono:
  `https://github.com/LeoGen02/LaStataleOpen-App/releases/latest/download/altstore-source.json`

## Cosa fa

| Scheda | Contenuto |
|---|---|
| **Home** | saluto, prossime scadenze, corsi aperti di recente, link rapidi (dashboard, calendario, valutazioni), avviso di nuova versione |
| **Corsi** | *I miei corsi* con avanzamento, oppure il *Percorso* (predefinito SecAI): cluster e insegnamenti |
| **Dettaglio corso** | sezioni e attività con filtro **Lezioni / Esercizi / E-tivity**, ricerca, completamento, "segna come completata" |
| **Scadenze** | quiz, consegne ed e-tivity in ordine di data, con *Scadute di recente*, *Oggi* e *Domani* |
| **Avvisi** | notifiche del portale (annunci, valutazioni, forum) con badge dei non letti anche sull'icona |
| **Altro** | percorso, credenziali, notifiche, portale completo, informazioni e segnalazioni, logout |

- **Browser interno** per lezioni, quiz ed e-tivity, con la stessa sessione del portale: upload di file e foto per le consegne,
  video, PDF e download con anteprima. *Condividi* e *Copia link* non includono mai il token di accesso.
- **Promemoria** 24 ore e 2 ore prima di ogni scadenza; in background (quando iOS lo concede) controlla i nuovi avvisi.
- **Dati offline**: senza rete restano visibili gli ultimi dati scaricati, con l'ora dell'aggiornamento.
- **Percorso selezionabile** in *Altro → Percorso*, per chi non segue SecAI.

## Segnalazioni e proposte

Dall'app: *Altro → Informazioni → Segnala un problema* (versione e modello vengono compilati da soli).
Oppure apri una [issue](https://github.com/LeoGen02/LaStataleOpen-App/issues/new/choose). Non scrivere mai password o token.
Per problemi di sicurezza segui [SECURITY.md](SECURITY.md).

## Come funziona il login

1. Email e password di Ateneo vengono salvate **solo nel Portachiavi dell'iPhone** (mai nel codice o nel repository).
2. L'app apre la pagina di login ufficiale (`elearning.unimi.it/...login.aspx`), la compila e la invia una volta (disattivabile con "Accesso automatico").
3. Dentro Moodle chiede il token come fa l'app ufficiale Moodle (`admin/tool/mobile/launch.php`) e usa i web service REST
   (`core_course_get_contents`, `core_calendar_get_action_events_by_timesort`, …).
4. Le pagine del browser interno usano l'*autologin* di Moodle; se la sessione scade il login viene ricompilato da solo.

**Sessione del sito — quando i servizi per app sono disattivati** (è il caso di La Statale Open: `enablewebservices = 0`):
l'app non chiede il token ma usa la sessione aperta dal login di Ateneo, come fanno le pagine del portale.

1. Dopo il login legge dalla pagina la `sesskey` di Moodle (`M.cfg`) e i cookie del portale, e li salva nel Portachiavi.
2. Chiama `lib/ajax/service.php`, il canale che Moodle tiene sempre attivo per il sito stesso, con le funzioni usate dalle sue pagine:
   `core_course_get_enrolled_courses_by_timeline_classification` (I miei corsi), `core_courseformat_get_state` (sezioni e attività),
   `core_calendar_get_action_events_by_timesort` (scadenze), `message_popup_get_popup_notifications` (avvisi),
   `core_completion_update_activity_completion_status_manually` (segna come completata).
   L'elenco dei percorsi e dei cluster viene letto dalle pagine `course/index.php`.
3. Quando il portale chiude la sessione, l'app la rinnova da sola: prima riprende quella del browser interno, poi rifà il login di Ateneo
   in una pagina invisibile con le credenziali salvate. Se serve l'utente (credenziali cambiate, passaggi in più) torna alla schermata di accesso.

In *Altro → Account* la voce *Collegamento* dice quale strada sta usando l'app. Differenze rispetto ai servizi per app: nel dettaglio del corso
non ci sono le date di consegna delle singole attività (restano nella scheda Scadenze) e "segna come completata" è proposto per ogni attività
con completamento: se il completamento è automatico, il portale lo rifiuta e l'app mostra il suo messaggio.

**Modalità web:** resta disponibile come riserva (le schede mostrano direttamente le pagine del sito, con login automatico).

L'app web non può usare la sessione del sito da `github.io`: il browser non lascia a una pagina leggere le pagine di un altro sito.
Per questo c'è il **ponte** (`docs/ponte/ponte-1.js`): gira sulla pagina del portale, avviato da un preferito, con le stesse funzioni
della sessione del sito dell'app iPhone, e consegna i dati all'app web.

## Per chi sviluppa

Niente Mac necessario: il progetto Xcode viene generato da [XcodeGen](https://github.com/yonaskolb/XcodeGen) e compilato da GitHub Actions.

```
project.yml            spec XcodeGen: target app e test, Info.plist, versione, repository per gli aggiornamenti
StataleOpen/
  App/                 entry point, SiteConfig (URL del portale, percorso), AppInfo (versione, link GitHub)
  Models/              modelli JSON dei web service Moodle + classificazione lezioni/esercizi/e-tivity
  Services/            PortalAPI con le due strade (MoodleClient: servizi per app; SiteSessionClient: sessione del sito),
                       SessionStore/PortalData, login invisibile, Keychain, notifiche, aggiornamenti, token di login
  Views/               login, schede, dettaglio corso, scelta del percorso, browser interno
  Resources/           Assets.xcassets (icona, colore), PrivacyInfo.xcprivacy
StataleOpenTests/      test unitari (classificazione, HTML, link, token, sessione del sito, promemoria, versioni)
docs/                  app web (index.html, app.js, core.js, app.css, service worker, manifest) e guida all'installazione
docs/ponte/            ponte con il portale: file immutabili, caricati dal preferito con l'impronta SHA-384
scripts/               selezione del simulatore, note di rilascio, sorgente AltStore, test e build dell'app web
.github/workflows/     ci.yml (test + build a ogni push/PR), release.yml (pubblicazione), _test.yml, _build.yml
```

- **CI**: a ogni push e pull request girano i test su simulatore e la build dell'ipa (che resta tra gli artifact del run),
  più i test dell'app web e una prova completa nel browser con il portale simulato.
- **Release**: *Actions → Release → Run workflow* con la versione (es. `1.3.0`), oppure una release con tag `v1.3.0` creata dal sito.
  Il workflow testa, compila, verifica l'ipa e pubblica `StataleOpen.ipa`, la copia con versione e la sorgente AltStore,
  con le note prese da [CHANGELOG.md](CHANGELOG.md).

Dettagli, convenzioni e procedura di rilascio: [CONTRIBUTING.md](CONTRIBUTING.md).

### Da verificare sul portale

Il portale non era raggiungibile dall'ambiente in cui è stata scritta l'app, quindi:
- se l'invio automatico del login non parte (pulsante non riconosciuto), basta toccare "Accedi" a mano: i campi sono già compilati;
- con la sessione del sito, se una scheda resta vuota o dà errore apri una issue indicando quale (il portale potrebbe usare un tema
  che cambia le pagine dei percorsi, lette in `SitePages`, con i test in `StataleOpenTests/SiteSessionTests.swift`);
- la classificazione Lezioni/Esercizi/E-tivity usa tipo e nome dell'attività (es. "E-tivity 1" → E-tivity, quiz → Esercizi):
  si regola in `ActivityKind.classify`, con i test in `StataleOpenTests/ParsingTests.swift`.

## Licenza

[MIT](LICENSE). Il nome e i contenuti del portale La Statale Open appartengono all'Università degli Studi di Milano.
