# Contribuire a Statale Open

Grazie! Che tu voglia correggere un'etichetta o aggiungere una scheda, il flusso è lo stesso: un branch, una pull request,
la CI che verifica, una release quando le modifiche sono pronte per tutti.

## Ambiente

**Con un Mac** (Xcode 16 o successivo):

```sh
brew install xcodegen
xcodegen generate          # rigenera StataleOpen.xcodeproj da project.yml (non va committato)
open StataleOpen.xcodeproj # ⌘R per avviare sul simulatore, ⌘U per i test
```

**Senza Mac**: modifica i file e fai push su un branch. La CI genera il progetto, esegue i test su un simulatore
e compila l'ipa, che trovi tra gli *artifact* del run (`StataleOpen-ipa`) da installare con Sideloadly per provarlo.

Il progetto Xcode non è nel repository: tutto ciò che serve (target, Info.plist, impostazioni) sta in `project.yml`.

## Flusso di lavoro

1. Crea un branch da `main` (`fix/login-pulsante`, `feature/voti`, …).
2. Fai le modifiche e, se l'utente se ne accorge, aggiungi una riga in `CHANGELOG.md` sotto **Non rilasciato**.
3. Apri una pull request: la CI (test + build) deve essere verde prima del merge.
4. Unisci su `main`. Le modifiche arrivano agli altri solo con la release successiva.

Consigliato nelle impostazioni del repository: *Branches → regola su `main`* con "Require status checks" (CI) prima del merge.

## Convenzioni

- Testi dell'interfaccia e commenti in **italiano**, come il resto del codice.
- SwiftUI e `async/await`; nessuna dipendenza esterna.
- Mai credenziali, token o dati reali nel codice, nei test o nelle issue. I test usano dati inventati.
- La logica senza interfaccia (parsing, regole, calcoli) va in funzioni pure con un test in `StataleOpenTests/`.
- La classificazione Lezioni / Esercizi / E-tivity è in `ActivityKind.classify` (`StataleOpen/Models/MoodleModels.swift`):
  se un'attività finisce nel gruppo sbagliato, aggiungi il caso lì e un test in `ParsingTests.swift`.
- URL del portale e percorso predefinito sono in `StataleOpen/App/SiteConfig.swift`.

## Pubblicare una versione

1. In `CHANGELOG.md` sposta le voci di *Non rilasciato* in una nuova sezione `## [X.Y.Z] - AAAA-MM-GG`.
   Versioni: `CORREZIONE` per bug, `MINORE` per funzioni nuove, `MAGGIORE` per cambiamenti che richiedono di reinstallare o riconfigurare.
2. Aggiorna `MARKETING_VERSION` in `project.yml` alla stessa versione (è quella delle build di prova),
   e con lei `APP.version` in `docs/app.js` e `CACHE` in `docs/sw.js`.
3. Unisci su `main`, poi **Actions → Release → Run workflow** su `main` e scrivi la versione (es. `1.3.0`).
   In alternativa crea una release dal sito con il tag nuovo `v1.3.0`.

Il workflow esegue i test, compila con la versione del tag, controlla l'ipa e pubblica:
`StataleOpen.ipa` (link fisso `releases/latest/download/StataleOpen.ipa`), `StataleOpen-X.Y.Z.ipa`,
`altstore-source.json` e le note con l'SHA-256. Le app installate vedono la nuova versione entro un giorno.

Il numero di build è il numero di commit del branch: cresce sempre ed è uguale tra la CI e la release dello stesso commit.

## App web

L'app web sta in `docs/` ed è statica: `index.html`, `app.css`, `core.js` (logica senza interfaccia, la stessa dell'app iPhone),
`app.js` (interfaccia, collegamento al portale, dati di esempio), `sw.js` (avvio offline) e `manifest.webmanifest`.

- **Provarla**: `npx serve docs` e apri l'indirizzo indicato. Il portale risponde solo se il browser può raggiungerlo; altrimenti usa i dati di esempio.
- **Test**: `node --test scripts/web/*.test.js` per la logica; `node scripts/web/e2e.js` per la prova completa in Chromium con il portale simulato
  (serve `npm i playwright`). Entrambi girano nella CI.
- **Pubblicarla**: *Settings → Pages → Build and deployment → Deploy from a branch*, cartella **`/docs`**, sul branch da pubblicare (di norma `main`).
  GitHub Pages gratuito richiede il repository pubblico. L'indirizzo è `https://<utente>.github.io/<repository>/`.
- **Copia per claude.ai**: `python3 scripts/web/build_embedded.py uscita.html` crea un file unico con gli stessi sorgenti che funziona solo con i dati di esempio.
- La versione in `docs/app.js` (`APP.version`) e la cache in `docs/sw.js` (`statale-open-vX.Y.Z`) devono coincidere con `MARKETING_VERSION`: la CI lo controlla.

## Fork

Un fork funziona senza modifiche: la build scrive nell'app il repository da cui parte (`STATALE_REPOSITORY`),
quindi controllo aggiornamenti, segnalazioni e sorgente AltStore puntano al fork. Se cambi il bundle identifier
in `project.yml`, aggiorna anche `BGTaskSchedulerPermittedIdentifiers` e `SiteConfig.backgroundRefreshID`.
