# Novità

Tutte le modifiche rilevanti di Statale Open. Il formato segue [Keep a Changelog](https://keepachangelog.com/it/1.1.0/)
e le versioni seguono il [versionamento semantico](https://semver.org/lang/it/): `MAGGIORE.MINORE.CORREZIONE`.

Prima di pubblicare una release aggiungi qui la sezione della nuova versione: diventa il testo della release su GitHub
e la descrizione dell'aggiornamento in AltStore e SideStore.

## [Non rilasciato]

### Aggiunto
- **Sessione del sito** nell'app iPhone: con i servizi per app disattivati sul portale (come su La Statale Open) l'app funziona lo stesso.
  Dopo il login di Ateneo legge corsi, sezioni e attività, scadenze e avvisi con la sessione del sito (`lib/ajax/service.php`, come le pagine
  del portale), segna le attività come completate e, quando la sessione scade, rifà il login da sola in una pagina invisibile.
  Promemoria e aggiornamento in background funzionano anche così. *Altro → Account → Collegamento* mostra la strada in uso.
- **App web** (`docs/`, pubblicata con GitHub Pages): stesse schermate e stessa logica dell'app iPhone, collegata al portale
  con gli stessi web service. Accesso con email e password o con la chiave dell'app, verifica del collegamento, modalità web,
  dati di esempio, copia offline, scadenze nel Calendario (`.ics` con avvisi 24 h e 2 h prima), installabile sulla schermata Home.
- Test dell'app web: logica condivisa (`node --test`) e prova completa nel browser con il portale simulato, anche nella CI.

### Modificato
- App web: con i servizi per app disattivati spiega che il browser non le lascia leggere il portale e rimanda all'app iPhone.

## [1.2.0] - 2026-10-12

### Aggiunto
- **Percorso selezionabile** in *Altro → Percorso*: chi non segue SecAI può scegliere il proprio percorso del portale.
- **Controllo aggiornamenti**: l'app avvisa in Home quando su GitHub c'è una versione più recente.
- Sezione **Informazioni** in *Altro*: versione installata, guida all'installazione, novità, *Segnala un problema*
  e *Proponi un miglioramento* (con versione e modello già compilati), privacy.
- Sorgente **AltStore / SideStore** per installare e aggiornare l'app direttamente dal telefono.
- Avviso "app non ufficiale" nella schermata di accesso.

### Modificato
- Le release hanno un numero di versione e note proprie; il link per scaricare l'ultima versione non cambia.
- Il numero di build cresce a ogni commit, quindi due build diverse non hanno mai lo stesso numero.

### Sicurezza
- Il token restituito da Moodle al login viene letto da un componente separato e coperto da test automatici.

## [1.1.0] - 2026-10-11

### Aggiunto
- Icona e colore dell'app.
- Dati offline: corsi, scadenze e avvisi restano visibili senza rete, con l'ora dell'ultimo aggiornamento riuscito.
- Badge sull'icona con gli avvisi non letti.
- Scadenze con la sezione *Scadute di recente* e i giorni *Oggi* / *Domani*.

### Corretto
- Date, giorni e testi di sistema in italiano anche con l'iPhone in un'altra lingua.
- *Apri in Safari*, *Condividi* e *Copia link* non includono mai il token di accesso.
- Disattivando i promemoria vengono cancellati anche quelli già programmati.
- Il token di Moodle viene accettato una sola volta; una "/" finale valida non viene più persa.

## [1.0.0] - 2026-10-11

### Aggiunto
- Prima versione: Home, Corsi (con il percorso SecAI), dettaglio corso con Lezioni / Esercizi / E-tivity,
  Scadenze con promemoria, Avvisi, browser interno autenticato, modalità web di riserva.
