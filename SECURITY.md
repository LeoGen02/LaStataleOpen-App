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
- Le build di GitHub Actions non usano segreti: chiunque può verificare che l'ipa nasce da questo codice confrontando l'SHA-256 indicato in ogni release.
