# Installare Statale Open

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
