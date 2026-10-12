# Privacy

Statale Open è un'app non ufficiale per il portale La Statale Open dell'Università degli Studi di Milano.
Non ha server propri, non contiene pubblicità né strumenti di analisi e non raccoglie dati.

## Cosa resta sul tuo iPhone

| Dato | Dove | Perché |
|---|---|---|
| Email e password di Ateneo | Portachiavi di iOS, solo su questo dispositivo | compilare il login dell'Ateneo quando la sessione scade |
| Token del portale (Moodle) oppure sessione del sito (cookie del portale e sesskey) | Portachiavi di iOS, solo su questo dispositivo | leggere corsi, scadenze e avvisi |
| Corsi, scadenze, avvisi | cartella cache dell'app | mostrarli anche senza rete |
| Impostazioni (percorso, promemoria, accesso automatico) | impostazioni dell'app | ricordare le tue scelte |
| Cookie del portale | archivio del browser interno | restare collegato nelle pagine del sito |

Niente di tutto questo viene inviato agli sviluppatori o a terzi, e nulla finisce nel repository GitHub.

## App web

Nell'app web gli stessi dati restano nell'archivio del browser (localStorage) di quel dispositivo:
la chiave dell'app, l'email se la salvi, le impostazioni e la copia di corsi, scadenze e avvisi.
**La password non viene mai salvata**: serve solo a chiedere la chiave al portale, una volta.
La pagina è un sito statico su GitHub Pages: non ha un server proprio e non riceve i tuoi dati,
che viaggiano direttamente tra il browser e il portale dell'Ateneo.

### Ponte con il portale (app web)

- Il ponte gira sulla pagina del portale solo quando tocchi il preferito «Statale Open». Legge i tuoi corsi (nome, avanzamento),
  sezioni e attività (nome, tipo, completamento), scadenze, avvisi (oggetto e corso, non il testo del messaggio) e l'elenco dei percorsi.
  **Non legge** password, cookie, email, voti, testi dei messaggi né dati di altri studenti; la chiave di sessione del portale (sesskey)
  resta in memoria durante la lettura e non viene consegnata all'app.
- I dati vanno **solo all'app**, sul tuo dispositivo, in uno di questi modi che scegli tu: nell'indirizzo della scheda (`#ponte=…`, compressi;
  l'app lo toglie subito, ma Safari può tenerlo nella cronologia — disattivabile con *Altro → Ritorno automatico in Safari*),
  negli appunti (*Copia per l'app*; con gli Appunti universali possono arrivare agli altri tuoi dispositivi Apple) o in un file.
- L'app li salva nell'archivio del browser, insieme alle modifiche non ancora inviate. *Esci* cancella tutto; il preferito resta in Safari
  finché non lo elimini.
- GitHub vede solo lo scaricamento anonimo del file del ponte (senza indirizzo di provenienza).

## Con chi parla l'app

- `lastataleopen.myariel.unimi.it` ed `elearning.unimi.it` — il portale e il login dell'Ateneo, come il sito nel browser.
- `api.github.com` — una volta al giorno, per sapere qual è l'ultima versione pubblicata.
  La richiesta non contiene dati personali (GitHub vede solo l'indirizzo IP, come per qualsiasi visita).
- I siti esterni che apri tu dalle lezioni (link, video), nel browser interno o in Safari.

## Permessi

- **Notifiche**: per i promemoria delle scadenze e i nuovi avvisi. Le notifiche sono generate sul telefono.
- **Fotocamera, foto, microfono**: solo quando alleghi qualcosa a una consegna nel browser interno, e solo se lo autorizzi.

## Come cancellare tutto

*Altro → Esci* cancella token, sessione, cookie e dati salvati del portale; *Altro → Rimuovi credenziali* cancella email e password.
Eliminando l'app iOS rimuove anche il resto. Nell'app web *Esci* cancella chiave e dati salvati; cancellando i dati del sito
nelle impostazioni del browser sparisce tutto.

Per domande apri una [issue](https://github.com/LeoGen02/LaStataleOpen-App/issues/new/choose).
