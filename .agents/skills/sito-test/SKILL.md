---
name: sito-test
description: Crea da zero un sito di test completo (repo GitHub + Pages + contenuti + verifica online) clonando alfoliotemplate1. Usalo SEMPRE quando Mirco dice cose come "fammi sito giacchetti", "fai un sito di test su X", "nuovo sito pizzeria", "clona il template e fai un sito su X", anche con frasi spezzate o typo. Fai tutto da solo, senza chiedere conferme.
---

# Skill sito-test: TU SEI IL MASTER, fai tutto da solo

Mirco scrive terso e spezzato. Il tema e' quello che dice (es. "giacchetti"); se non dice un tema, scegline uno concreto a caso. NON chiedere conferme, NON proporre piani: esegui e alla fine dai il link. Chiedi solo se manca davvero il tema E non puoi sceglierlo, mai altro.

Lavori sempre dalla cartella `C:\Users\mirco\Desktop\alfoliotemplate1`. Leggi `docs/claude/nuovo-sito-test.md` (regole del pacchetto e punti critici), poi esegui questi passi IN ORDINE, senza fermarti tra l'uno e l'altro.

## 0. Nomi
- `<tema>` = parola minuscola senza spazi/accenti dal messaggio (giacchetti).
- `<repo>` = `<tema>test` (es. `giacchettitest`). Se `C:\Users\mirco\Desktop\<repo>` esiste gia' O la repo esiste su GitHub (`gh repo view`), NON e' il tuo sito: aggiungi un numero (`giacchettitest2`), a meno che Mirco abbia chiesto di continuare quello.

## 1. Preparare il modello (da solo)
1. `git status --porcelain` e `git fetch origin`. Se il modello ha modifiche o commit non pushati (script, doc, pacchetti): `git add -A`, commit (`Sito di test: script e doc aggiornati`), `git pull --rebase origin main`, `git push origin main`. Il clone eredita tutto, quindi deve essere pushato.
2. Checkpoint: crea e pusha `checkpoint-AAAA-MM-GG` se non esiste.
3. Se in `CLAUDE.md` la riga "SITO DI TEST AUTOMATICO" non contiene "TU SEI IL MASTER": lancia `python C:\Users\mirco\Desktop\claudetemp\patch_claude_md.py` e committa (a-capo CRLF preservati dallo script; mai riscrivere CLAUDE.md a mano).

## 2. Scrivere il pacchetto (e' il tuo lavoro creativo)
- Copia `automazioni/testi/pacchetto_birrificio.json` in `automazioni/testi/pacchetto_<tema>.json` e riscrivi SOLO i testi per il tema: home, contatti, chi_siamo, `gruppi`, `menu`, `config_descrizione`, servizi, post, progetti. Contenuti realistici in italiano, ben scritti, coerenti col tema; stessa quantita' del birrificio.
- Regole dure (il validatore le controlla): niente `:` in `chi_siamo.pagina.*` e nei valori `front` della home; ogni `gruppo` dei servizi presente in `gruppi` con identica scrittura; titoli unici; testi non vuoti; categorie post minuscole con trattini; `nuova` della home su UNA riga; le chiavi `inizia_con` della home restano quelle del birrificio.

## 3. Eseguire (un comando, a cascata)
1. `python sito_test.py <repo> <tema> --solo-controlli` -> se ci sono ERRORI correggi il pacchetto e rilancia finche' e' OK.
2. `python sito_test.py <repo> <tema> --dry-run`.
3. `python sito_test.py <repo> <tema>` (8-10 minuti, aspetta, non interrompere). Se si ferma con un codice != 0: leggi l'errore, correggi la CAUSA (pacchetto, script, gh) e rilancia LO STESSO comando: e' idempotente.
4. Esito valido SOLO con `TUTTO OK <url>`. Se dopo 3 tentativi non passa, riporta l'errore esatto e cosa hai provato.

## 4. Chiudere
- Se hai scoperto una trappola nuova: aggiungila a `docs/claude/nuovo-sito-test.md` (Punti critici) e, se controllabile prima, al validatore di `sito_test.py` con una riga in `autotest()`; poi `python sito_test.py x x --autotest` deve dare OK.
- Aggiorna lo stato verifiche del doc (giro completo provato con `<repo>`, data).
- Committa e pusha il modello (script/doc/pacchetto nuovo) con un solo commit.
- Rispondi a Mirco in 2-3 righe: link del sito, repo, cosa hai creato (n. servizi/post/progetti), eventuali problemi risolti. Italiano, terso, niente spiegoni.

## Divieti
- Non toccare `url`/`baseurl`/`repos.json`, ne' siti diversi dal nuovo clone e dal modello.
- Non modificare file del sito con editor che convertono CRLF: solo script Python in binario.
- Non creare `AGENTS.md`/`README.md` in piu'.
