# Privacy

Statale Open è un'app non ufficiale per il portale La Statale Open dell'Università degli Studi di Milano.
Non ha server propri, non contiene pubblicità né strumenti di analisi e non raccoglie dati.

## Cosa resta sul tuo iPhone

| Dato | Dove | Perché |
|---|---|---|
| Email e password di Ateneo | Portachiavi di iOS, solo su questo dispositivo | compilare il login dell'Ateneo quando la sessione scade |
| Token del portale (Moodle) | Portachiavi di iOS, solo su questo dispositivo | leggere corsi, scadenze e avvisi |
| Corsi, scadenze, avvisi | cartella cache dell'app | mostrarli anche senza rete |
| Impostazioni (percorso, promemoria, accesso automatico) | impostazioni dell'app | ricordare le tue scelte |
| Cookie del portale | archivio del browser interno | restare collegato nelle pagine del sito |

Niente di tutto questo viene inviato agli sviluppatori o a terzi, e nulla finisce nel repository GitHub.

## Con chi parla l'app

- `lastataleopen.myariel.unimi.it` ed `elearning.unimi.it` — il portale e il login dell'Ateneo, come il sito nel browser.
- `api.github.com` — una volta al giorno, per sapere qual è l'ultima versione pubblicata.
  La richiesta non contiene dati personali (GitHub vede solo l'indirizzo IP, come per qualsiasi visita).
- I siti esterni che apri tu dalle lezioni (link, video), nel browser interno o in Safari.

## Permessi

- **Notifiche**: per i promemoria delle scadenze e i nuovi avvisi. Le notifiche sono generate sul telefono.
- **Fotocamera, foto, microfono**: solo quando alleghi qualcosa a una consegna nel browser interno, e solo se lo autorizzi.

## Come cancellare tutto

*Altro → Esci* cancella token, cookie e dati salvati del portale; *Altro → Rimuovi credenziali* cancella email e password.
Eliminando l'app iOS rimuove anche il resto.

Per domande apri una [issue](https://github.com/LeoGen02/LaStataleOpen-App/issues/new/choose).
