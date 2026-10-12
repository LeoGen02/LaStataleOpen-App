# Installare Statale Open

Due strade: l'**app web** (nessuna installazione, dal browser del telefono, collegata al portale con il *ponte*)
oppure l'**app iPhone** (file `.ipa`, si collega da sola con la sessione del sito). Inizia dall'app web: bastano Safari e cinque minuti.

## App web con il ponte (consigliata per iniziare)

Apri **[leogen02.github.io/LaStataleOpen-App](https://leogen02.github.io/LaStataleOpen-App/)** in **Safari** sull'iPhone.
Il portale non lascia leggere i tuoi dati alle app web, quindi l'app li riceve dal **ponte**: un preferito di Safari
che tocchi su una pagina di La Statale Open in cui sei già entrato. Il ponte legge corsi, scadenze e avvisi e torna all'app.

### Il modo più semplice: «Accedi» con il ponte automatico

Con l'estensione gratuita **Userscripts** per Safari l'accesso parte dall'app: tocchi **Accedi**, si apre la pagina ufficiale del portale,
entri con il login di Ateneo (email `@studenti.unimi.it` e password della posta di Ateneo, che Safari può compilare da solo)
e l'app si riapre con corsi, scadenze e avvisi. Da lì **Aggiorna dal portale** è un solo tocco, e l'app si aggiorna anche da sola
quando la apri con dati più vecchi di un'ora. La password la scrivi solo sul portale: l'app non la vede e non la salva.

Nell'app tocca **Accedi**: la prima volta compaiono quattro passaggi, ognuno con il suo pulsante.

1. Installa dall'App Store l'app **Userscripts** (gratuita e open source) e aprila una volta.
2. In Safari tocca il pulsante a sinistra della barra degli indirizzi (il menu della pagina) → **Gestisci estensioni** e attiva **Userscripts**.
   Poi, dallo stesso menu → **Userscripts**, consenti **sempre** l'accesso: a tutti i siti web, oppure sia sulla pagina dell'app
   sia su una pagina di La Statale Open (`lastataleopen.myariel.unimi.it`). Non scegliere «per un giorno»: scadrebbe.
3. Nell'app tocca **Apri lo script del ponte automatico** (passaggio 3; anche da *Altro → Ponte con il portale*).
   Si apre il **testo** dello script: è normale, l'installazione non parte da sola. Su quella pagina tocca l'icona del menu
   nella barra degli indirizzi (aA) → **Userscripts** (se Safari chiede il permesso, consenti sempre). In alto nella finestra
   di Userscripts compare **Tap to install**: toccalo, poi **Install** (la finestra dell'estensione è in inglese).
   Se *Userscripts* non è nel menu, tocca **Gestisci estensioni** e attivala. Se *Tap to install* non compare, nell'app tocca
   **Scarica il file**, poi in *File → Download* tieni premuto `statale-open-1.user.js` → **Sposta** → *Sul mio iPhone → Userscripts*
   e apri una volta il menu di Userscripts in Safari.
4. Torna alla scheda dell'app: la pagina si ricarica da sola (oppure tocca **Ho fatto: controlla**) e compare **Ponte automatico installato**
   con il pulsante **Accedi**. Toccalo, entra con il login di Ateneo e l'app si riapre con i tuoi dati; al primo giro riuscito il ponte
   diventa **attivo**. Se resti sul portale senza tornare, manca il permesso sul portale (passaggio 2).
   Quando la sessione del portale scade, «Aggiorna dal portale» riapre il login di Ateneo: subito dopo il ponte riparte e torna all'app.

- **Modifiche da inviare** (avvisi letti, attività completate): il pannello del ponte chiede **Applica e aggiorna**, l'unico tocco in più.
- **Ritorno automatico in Safari** (*Altro*) deve restare acceso: spento, i dati tornano dagli appunti anche con il ponte automatico.
- *Altro → Ponte con il portale → Aggiorna da solo all'apertura* (acceso di serie) aggiorna quando apri l'app con dati più vecchi di un'ora.
  Se un giro non torna, non riprova da solo finché un aggiornamento non riesce. Puoi spegnerlo dallo stesso interruttore.
- **Icona sulla schermata Home**: in Safari *Condividi → Aggiungi alla schermata Home* e **spegni «Apri come app web»** (iOS 26).
  L'icona apre l'app in Safari, dove l'estensione funziona; come in Safari, i dati restano se apri l'app almeno una volta ogni 7 giorni.
  Aperta come app web, invece, l'app non vede le estensioni di Safari (limite di iOS) e ha un archivio suo: se passi da un'icona all'altra
  serve un aggiornamento, e le modifiche ancora da inviare vanno inviate prima dalla vecchia icona.
- Lo script parte solo per le richieste che l'app gli consegna (un link al portale costruito da altri non lo avvia) e carica lo stesso
  ponte del preferito, con la stessa impronta. Non si aggiorna da solo: resta quello che hai installato.

### Senza estensioni: crea il preferito «Statale Open»

1. Nell'app tocca **Accedi** → **Non vuoi installare nulla? Usa il preferito** → **Copia il codice**.
2. In Safari tocca **Condividi** (il quadrato con la freccia) → **Aggiungi ai Preferiti**, chiamalo **Statale Open** e tocca **Salva**.
3. Tocca l'icona dei **Segnalibri** (il libro) → **Preferiti** → **Modifica** → **Statale Open**.
   Cancella l'indirizzo con ⓧ, tieni premuto nel campo → **Incolla**, poi **Fine** due volte.
4. Torna all'app e tocca **Apri il portale e aggiorna**: si apre La Statale Open nella stessa scheda.
   Se serve accedi con il login di Ateneo, poi tocca la **barra degli indirizzi** e il preferito **Statale Open**.
   Compare un pannello in basso (*Statale Open · ponte*), legge i dati in pochi secondi e riapre l'app con corsi, scadenze e avvisi.

Sul computer basta trascinare il pulsante **★ Statale Open** della schermata di installazione nella barra dei preferiti.

### Ogni giorno

- **In una scheda di Safari** (3 tocchi): *Home → Aggiorna dal portale → Apri il portale*, poi barra degli indirizzi → **Statale Open**.
  L'app si riapre da sola con i dati nuovi.
- **Dalla schermata Home** (*Condividi → Aggiungi alla schermata Home*): l'app ha un archivio separato da Safari, quindi i dati passano
  dagli appunti. *Aggiorna dal portale → Copia l'indirizzo del portale*; in Safari tieni premuta la barra degli indirizzi →
  **Incolla e vai** → preferito **Statale Open** → **Copia per l'app**; torna all'app e tocca **Incolla i dati**.
- Se il login di Ateneo ti chiede di accedere, dopo l'accesso tocca di nuovo il preferito: i dati arrivano lo stesso.
  Se avevi modifiche in attesa, l'app lo dice e le rimanda al prossimo aggiornamento.
- **Avvisi letti** e **attività segnate come completate** nell'app restano *da inviare* e arrivano al portale al prossimo aggiornamento,
  dopo una conferma nel pannello del ponte (*Applica e aggiorna*).

### Se qualcosa non va

| Messaggio | Cosa fare |
|---|---|
| *tocca il preferito mentre sei su una pagina di La Statale Open* | il preferito è stato toccato su un altro sito: apri il portale e riprova |
| *il ponte non si è caricato* | controlla la connessione; se continua, reinstalla il preferito (*Altro → Ponte con il portale → Reinstalla il preferito*) |
| *Non hai ancora effettuato l'accesso al portale* | tocca **Accedi** nel pannello, entra con il login di Ateneo e tocca di nuovo il preferito |
| *La sessione del portale è scaduta* | ricarica la pagina e accedi, poi tocca di nuovo il preferito oppure, con il ponte automatico, torna all'app e tocca di nuovo **Aggiorna dal portale** |
| *Questa pagina non è adatta al ponte* | apri la Dashboard del portale (pannello → **Apri la Dashboard**) e riprova |
| *L'aggiornamento automatico non è tornato con i dati* | in Safari, sulla pagina del portale: menu della pagina → **Userscripts** → consenti sempre; nell'app Userscripts lo script «Statale Open · ponte automatico» deve essere attivo. Poi riprova dall'app |
| *Il ponte automatico non ha risposto* | sulla pagina dell'app: menu della pagina → **Gestisci estensioni** → Userscripts attiva e consentita su questo sito |
| *Negli appunti non ci sono dati del ponte* | nel pannello sul portale tocca **Copia per l'app**, poi **Incolla i dati**; in alternativa **Scarica i dati in un file** e nell'app **Scegli un file** |

In Safari (anche da un'icona con «Apri come app web» spento) i dati dell'app restano finché la apri almeno una volta ogni 7 giorni;
come app web della schermata Home non scadono.

## App iPhone

Statale Open non è sull'App Store: si installa da un file `.ipa` firmato con il tuo Apple ID ("sideloading").
È gratuito e non serve un account sviluppatore a pagamento.

**Ti servono:** un iPhone con iOS 17 o successivo, un Apple ID (anche gratuito), un cavo USB e, per la prima volta,
un computer Windows o Mac.

## 1. Scarica l'app

Scarica **[StataleOpen.ipa](https://github.com/LeoGen02/LaStataleOpen-App/releases/latest/download/StataleOpen.ipa)** sul computer.
Il link porta sempre all'ultima versione. Le note di ogni versione e l'impronta SHA-256 del file sono nella pagina
[Releases](https://github.com/LeoGen02/LaStataleOpen-App/releases).

## 2. Installa con Sideloadly (Windows o Mac)

1. Installa [Sideloadly](https://sideloadly.io).
   Su Windows servono anche **iTunes** e **iCloud** scaricati dal sito Apple (le versioni del Microsoft Store possono non funzionare).
2. Collega l'iPhone con il cavo, sbloccalo e tocca **Autorizza** quando chiede se fidarsi del computer.
3. Apri Sideloadly, trascina `StataleOpen.ipa` nella finestra e scrivi il tuo Apple ID.
4. Premi **Start** e inserisci la password dell'Apple ID (ed eventualmente il codice di verifica a due fattori).
   La password va solo ad Apple per firmare l'app.
5. Quando Sideloadly scrive *Done*, l'icona di Statale Open compare sull'iPhone.

## 3. Prima apertura sull'iPhone

1. **Modalità sviluppatore** (obbligatoria da iOS 16 per le app installate così):
   *Impostazioni → Privacy e sicurezza → Modalità sviluppatore* → attiva → riavvia l'iPhone → conferma **Attiva**.
   La voce compare dopo aver installato la prima app con Sideloadly.
2. **Autorizza il tuo Apple ID:** *Impostazioni → Generali → VPN e gestione dispositivo* → tocca il tuo Apple ID → **Autorizza**.
   Serve la connessione a Internet.
3. Apri Statale Open, inserisci email e password di Ateneo e tocca **Accedi**.

## Rinnovo ogni 7 giorni

Con un Apple ID gratuito la firma dura **7 giorni**: dopo, l'app non si apre più finché non la rinnovi.
I dati non si perdono: ripeti il passaggio 2 con lo stesso file e lo stesso Apple ID, oppure usa la funzione di rinnovo di Sideloadly.
Con un account sviluppatore a pagamento (99 €/anno) la firma dura un anno.

Limiti dell'Apple ID gratuito: al massimo **3 app** installate così nello stesso momento e **10 identificativi di app** nuovi ogni 7 giorni.

## Alternativa: AltStore o SideStore

[AltStore](https://altstore.io) e [SideStore](https://sidestore.io) installano l'app e rinnovano la firma dal telefono,
così non devi ricordarti dei 7 giorni (AltStore usa AltServer sul computer, SideStore funziona anche senza).

Dopo averli configurati, aggiungi la sorgente di Statale Open (*Sorgenti* → **+**):

```
https://github.com/LeoGen02/LaStataleOpen-App/releases/latest/download/altstore-source.json
```

Da lì installi l'app e ricevi le nuove versioni.

## Aggiornare

L'app ti avvisa in Home quando esce una versione nuova (oppure *Altro → Informazioni → Controlla aggiornamenti*).
Scarica il nuovo `StataleOpen.ipa` e installalo **sopra** quello vecchio con lo stesso Apple ID:
credenziali, percorso e impostazioni restano. Con AltStore o SideStore basta toccare *Aggiorna*.

## Problemi frequenti

**"Sviluppatore non autorizzato" o l'app non si apre.**
Autorizza il tuo Apple ID (passaggio 3.2) e controlla di avere Internet: iOS verifica la firma alla prima apertura.

**Non trovo "Modalità sviluppatore".**
Compare solo dopo aver installato un'app con Sideloadly, AltStore o SideStore. Installa, poi ricontrolla in *Privacy e sicurezza*.

**Dopo una settimana l'app si chiude subito.**
La firma è scaduta: rinnovala (vedi *Rinnovo ogni 7 giorni*).

**Sideloadly segnala che il bundle identifier non è disponibile.**
L'identificativo dell'app è già usato da un altro Apple ID. Nelle opzioni avanzate di Sideloadly imposta un bundle ID personale,
ad esempio `it.leonardo.stataleopen.tuonome`, e usa sempre lo stesso: se lo cambi, l'iPhone la tratta come un'altra app
e perdi le impostazioni salvate.

**"Hai raggiunto il limite di app" / "maximum number of apps".**
Con l'Apple ID gratuito puoi avere al massimo 3 app installate così: rimuovine una che non usi.

**Il login non parte da solo.**
Tocca "Accedi" nella pagina dell'Ateneo: i campi sono già compilati. Se non funziona, *Altro → Informazioni → Segnala un problema*.

**Nessuno di questi?**
[Apri una segnalazione](https://github.com/LeoGen02/LaStataleOpen-App/issues/new/choose), senza scrivere password o dati personali.
