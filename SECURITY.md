# Sicurezza

## Segnalare una vulnerabilità

Se trovi un problema che potrebbe esporre credenziali, token o dati degli studenti, **non aprire una issue pubblica**.

- Usa **Security → Report a vulnerability** in questo repository (segnalazione privata di GitHub), se attiva;
- altrimenti contatta in privato il proprietario del repository [@LeoGen02](https://github.com/LeoGen02).

Descrivi il problema e come riprodurlo, senza includere credenziali reali. Riceverai una risposta appena possibile;
la correzione verrà pubblicata in una nuova versione e indicata nel [CHANGELOG](CHANGELOG.md).

## Come l'app protegge i dati

- Credenziali e token stanno nel Portachiavi di iOS (`AfterFirstUnlockThisDeviceOnly`): non vengono sincronizzati né copiati nei backup su altri dispositivi.
- Le richieste al portale usano solo HTTPS.
- I link condivisi o aperti in Safari non contengono mai il token dei web service.
- Nell'app web la chiave dell'app sta nell'archivio del browser e la password non viene mai salvata; il sito non ha un server
  proprio e non usa librerie esterne.
- Le build di GitHub Actions non usano segreti: chiunque può verificare che l'ipa nasce da questo codice confrontando l'SHA-256 indicato in ogni release.

## Ponte con il portale (app web)

Il ponte (`docs/ponte/ponte-1.js`) gira sulla pagina del portale con la tua sessione, quindi è progettato per fare il minimo:

- **Solo il codice che hai installato.** Il preferito carica il file con `integrity="sha384-…"` e `crossorigin`: se il file pubblicato cambia
  anche di un byte, il browser non lo esegue. I file `ponte-N.js` pubblicati non si modificano mai (la CI lo verifica e controlla anche
  la copia su GitHub Pages); una correzione è un file nuovo con un nuovo preferito. L'impronta è in *Altro → Ponte con il portale*.
- **Un solo punto di uscita** verso il portale, con un elenco chiuso di sette funzioni Moodle (cinque letture, due scritture) e le sole pagine
  `course/index.php` dei percorsi. Nessun `eval`, `innerHTML`, `document.cookie`, `localStorage`, `postMessage` o richiesta ad altri siti:
  un test lo controlla a ogni push.
- **Dati solo all'app** da cui è stato caricato il ponte, e solo con un tuo gesto o una richiesta dell'app; la richiesta non può scegliere
  la destinazione. Le scritture (avvisi letti, attività completate) partono solo dopo la conferma nel pannello.
- **Nell'app** i dati ricevuti vengono ricontrollati: solo testo, numeri validi, lunghezze limitate e indirizzi del solo portale;
  la pagina ha una Content-Security-Policy che vieta script esterni. Un link `#ponte=…` non richiesto dall'app chiede conferma prima di essere importato.

Per verificare a mano: `openssl dgst -sha384 -binary docs/ponte/ponte-1.js | base64` deve dare l'impronta del preferito.

### Ponte automatico (estensione Userscripts)

`docs/ponte/statale-open-3.user.js` (e le versioni 1 e 2, ancora pubblicate per chi le ha installate) fa le veci del tocco sul preferito
e nient'altro: `@match` solo sul portale, sulla pagina dell'app e (dalla versione 2) sulla pagina di login di Ateneo di La Statale Open,
nessuna richiesta di rete, nessun `@require`/`@updateURL` (non si aggiorna da solo), immutabile come il ponte (impronta in `PONTE.known`,
controllata dalla CI). Sul portale carica `ponte/ponte-1.js` con la stessa `integrity` del preferito solo se l'indirizzo contiene
una richiesta dell'app; un link costruito ad arte può al massimo far leggere i tuoi dati e consegnarli alla tua app (che chiede conferma
se non li aveva chiesti), mentre le scritture restano da confermare nel pannello.

Ritorno dopo il login (versione 2): sulla pagina di login di Ateneo lo script annota solo l'ora in cui la apri o invii il modulo, senza leggere
i campi né toccare il modulo. La prima pagina del portale aperta da entrato nei 10 minuti successivi consuma l'annotazione; se è la pagina
d'arrivo (`/`, `/my/`, `/my/courses.php`) e l'app ha lasciato allo script la sua richiesta di **sola lettura** (lo script rifiuta richieste con
modifiche o con ritorno diverso dall'indirizzo), parte il ponte e i dati tornano all'app, che li riconosce senza chiedere conferma.
Un sito esterno che apre la pagina di login e poi il portale può al massimo far leggere i tuoi dati e riportarli alla tua app.

Invio automatico (versione 3): l'app segna con `"ok":1` le richieste le cui modifiche hai già confermato nell'app («Spunta come completato»,
«Segna come letto» con *Invia subito le modifiche* acceso). Il ponte ignora quel campo; lo script, solo per una richiesta che l'app gli ha
consegnato sulla propria pagina e che contiene modifiche, `"ok":1` e l'account dei dati (`"u"`, uguale all'utente entrato sul portale),
tocca nel pannello del ponte (`ponte-1.js`, immutabile) il pulsante principale soltanto se il suo testo è esattamente «Applica e aggiorna».
Se sul portale è entrato un altro account, il pannello resta da confermare a mano. Un link costruito da altri, anche con `"ok":1`, non viene registrato
e non avvia nulla; la richiesta per il ritorno dopo il login non contiene mai modifiche. Il preferito chiede sempre la conferma.

