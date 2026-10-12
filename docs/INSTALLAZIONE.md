# Installare Statale Open

Due strade: l'**app web** (nessuna installazione, dal browser del telefono, collegata al portale con il *ponte*)
oppure l'**app iPhone** (file `.ipa`, si collega da sola con la sessione del sito). Inizia dall'app web: bastano Safari e cinque minuti.

## App web con il ponte (consigliata per iniziare)

Apri **[leogen02.github.io/LaStataleOpen-App](https://leogen02.github.io/LaStataleOpen-App/)** in **Safari** sull'iPhone.
Il portale non lascia leggere i tuoi dati alle app web, quindi l'app li riceve dal **ponte**: un preferito di Safari
che tocchi su una pagina di La Statale Open in cui sei già entrato. Il ponte legge corsi, scadenze e avvisi e torna all'app.

### Il modo più semplice: ponte automatico (un tocco per aggiornare)

Con l'estensione gratuita **Userscripts** per Safari, «Aggiorna dal portale» diventa un solo tocco: l'app apre il portale,
il ponte legge i dati da solo e l'app si riapre aggiornata. Niente preferito, niente incolla.

1. Installa dall'App Store l'app **Userscripts** (gratuita e open source) e aprila una volta.
2. Attiva l'estensione: in Safari tocca **Gestisci estensioni** (o *Impostazioni → App → Safari → Estensioni*) → **Userscripts** → attiva,
   e consenti l'accesso a **tutti i siti web** (o almeno a `lastataleopen.myariel.unimi.it` e `leogen02.github.io`).
3. Nell'app tocca **Collega con il ponte** (o *Altro → Ponte con il portale*) → **Apri lo script del ponte automatico**.
   Nella pagina che si apre tocca l'icona delle estensioni nella barra degli indirizzi → **Userscripts** → **Installa**.
4. Torna all'app e ricarica la pagina: compare **Ponte automatico attivo**. Da qui *Home → Aggiorna dal portale* fa tutto da solo.
   Se la sessione del portale è scaduta, accedi con il login di Ateneo: subito dopo il ponte riparte e torna all'app.

- **Icona sulla schermata Home**: in Safari *Condividi → Aggiungi alla schermata Home* e **spegni «Apri come app web»** (iOS 26).
  L'icona apre l'app in Safari, dove l'estensione funziona. Aperta come app web, invece, l'app non vede le estensioni di Safari
  (limite di iOS): lì resta il preferito con gli appunti.
- Facoltativo: *Altro → Ponte con il portale → Aggiorna da solo all'apertura* aggiorna quando apri l'app con dati più vecchi di un'ora.
- Se ci sono modifiche da inviare (avvisi letti, attività completate) il pannello del ponte chiede **Applica e aggiorna**: è l'unico tocco in più.
- Lo script non fa nulla nelle altre pagine del portale: si attiva solo con la richiesta dell'app e carica lo stesso ponte del preferito,
  con la stessa impronta. Non si aggiorna da solo: resta quello che hai installato.

### Senza estensioni: crea il preferito «Statale Open»

1. Nell'app tocca **Collega con il ponte** → **Copia il codice**.
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
| *La sessione del portale è scaduta* | ricarica la pagina, accedi e tocca di nuovo il preferito |
| *Questa pagina non è adatta al ponte* | apri la Dashboard del portale (pannello → **Apri la Dashboard**) e riprova |
| *L'aggiornamento automatico non è tornato con i dati* | in Safari: *Gestisci estensioni* → Userscripts attiva e consentita su `lastataleopen.myariel.unimi.it`; in Userscripts lo script «Statale Open · ponte automatico» deve essere attivo. Intanto puoi usare il preferito |
| *Negli appunti non ci sono dati del ponte* | nel pannello sul portale tocca **Copia per l'app**, poi **Incolla i dati**; in alternativa **Scarica i dati in un file** e nell'app **Scegli un file** |

In Safari i dati dell'app restano finché la apri almeno una volta ogni 7 giorni; dalla schermata Home non scadono.

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
