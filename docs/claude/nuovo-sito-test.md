# Sito di test automatico: istruzioni per Claude (TU sei il master)

Questo file e' scritto per Claude. Quando Mirco chiede un sito di test (anche con frasi spezzate, dialetto, typo), tu sei il master: decidi, scrivi i dati, lanci UN comando e verifichi. Lo script fa il lavoro ripetitivo, tu fai quello che richiede giudizio.

## Cosa fai tu e cosa delegare

| Tu (master) | Lo script (`sito_test.py`) |
|---|---|
| Scegli il tema se Mirco non lo dice (a caso, ma concreto: pizzeria, palestra, studio dentistico...) | Valida il pacchetto prima di toccare GitHub |
| Scegli un nome repo NUOVO (minuscolo, es. `pizzeriatest`; controlla che `Desktop\<nome>` non esista) | Crea repo, copia, push, abilita Pages |
| Scrivi `automazioni\testi\pacchetto_<tema>.json` | Pulisce i demo, scrive home/chi-siamo/servizi/post/progetti |
| Leggi gli errori e correggi il pacchetto | Verifica le pagine ONLINE e dice cosa non va |
| Dai a Mirco il link e 2 righe di esito | Codici di uscita: 1 controlli, 2 clone, 3 contenuti, 4 verifica |

Non fare a mano passaggi che lo script copre. Se manca un caso, estendi lo script, non aggirarlo.

## Procedura (in ordine, senza chiedere conferme inutili)

1. Checkpoint `checkpoint-AAAA-MM-GG` e modello pulito: `git status` vuoto e niente commit non pushati (altrimenti committa e pusha: il clone eredita tutto).
2. Copia `pacchetto_birrificio.json` in `pacchetto_<tema>.json` e cambia SOLO i testi. Regole: niente `:` nelle description di `chi_siamo.pagina`; ogni `gruppo` dei servizi deve stare in `gruppi` (stesse maiuscole, niente spazi finali); titoli unici; testi non vuoti; categorie post minuscole con trattini; righe della home su UNA riga; le chiavi `inizia_con` della home restano uguali al birrificio.
3. `python sito_test.py <repo> <tema> --solo-controlli` (1 secondo). Correggi finche' e' OK.
4. `python sito_test.py <repo> <tema> --dry-run`.
5. `python sito_test.py <repo> <tema>` (8-10 minuti). Se si ferma, rilancia lo STESSO comando: e' idempotente.
6. Se esce con 0 stampa `TUTTO OK <url>`: dai il link a Mirco. Se esce con un codice != 0 leggi l'errore, correggi la causa e rilancia; non dire "fatto" senza `TUTTO OK`.

Se in dubbio sul validatore: `python sito_test.py x x --autotest` deve stampare AUTOTEST OK.

## Quando hai finito, aggiorna la documentazione

Se hai scoperto una trappola nuova, aggiungila qui sotto in "Punti critici" e nel validatore di `sito_test.py` (con una riga in `autotest()`), cosi' non si ripete. Documenti aggiuntivi (`AGENTS.md`, `README.md`) solo se servono davvero; oggi non servono: questo file e il blocco in `CLAUDE.md` bastano.

## Comando unico (dalla cartella `alfoliotemplate1`)

    python sito_test.py <nome-repo> <tema> [--dry-run] [--solo-controlli] [--verifica-solo] [--autotest] [--minuti N] [--ignora-modello]

Passi interni, si ferma al primo errore:
1. Controlli (codice 1): chiavi sconosciute, `:` nelle description, gruppi incoerenti, slug doppi, testi vuoti, categorie non valide, righe home non applicabili al modello, modello con modifiche non pushate.
2. Clone (codice 2): `nuovo_sito.py`.
3. Contenuti (codice 3): `popola_sito.py`.
4. Verifica online (codice 4): 200 su `/`, `/chi-siamo/`, `/servizi/`, `/contatti/`, `/blog/` e sul primo servizio; niente testi della web agency; sezioni servizi presenti; demo 404. Riprova da solo fino a `--minuti` (default 8).

Chi chiama chi:

    sito_test.py --chiama--> nuovo_sito.py  --usa--> gh + git
                 --chiama--> popola_sito.py --usa--> python -m automazioni <modulo> ... + pubblica_chi_siamo.py
    Dati (mai codice): automazioni/testi/pacchetto_<tema>.json
    Il sito nuovo nasce in C:\Users\mirco\Desktop\<nome-repo> (accanto al modello).

I due script restano usabili da soli: `nuovo_sito.py <repo> [--dry-run] [--privata]` e `popola_sito.py <repo> <pacchetto> [--dry-run] [--no-pulisci] [--no-push]`.

## Punti critici

- Il clone eredita `sito_test.py`, `nuovo_sito.py`, `popola_sito.py` e i pacchetti: vanno committati e pushati nel modello PRIMA di clonare.
- Non toccano `url`/`baseurl`/`repos.json` (automatici). Il titolo del sito e' automatico dal nome repo.
- **Due punti nelle description = pagina 404 senza errori** (`pubblica_chi_siamo.py` scrive il front matter senza virgolette). Il validatore lo blocca.
- **`servizi_gruppi.yml`:** servizi con un `gruppo` non in `gruppi` finiscono in "Altri servizi".
- **Slug con `_`** (`1_project`...): gestiti (`[a-z0-9_-]`). `_teachings` e `_books` si svuotano con `svuota_cartelle`.
- Piu' push ravvicinati = run `cancelled` (normale): conta l'ultima.
- Gli avvisi "descrizione con caratteri YAML a rischio" sul pacchetto birrificio sono noti e non bloccano.
- File del sito in CRLF: modificarli solo con script Python in binario, mai con editor che convertono gli a-capo.

## Chiavi del pacchetto (tutte opzionali)

`home`, `gruppi`, `menu` ({"agenzia": "Birrificio"}), `chi_siamo`, `config_descrizione`, `svuota_cartelle`, `servizi`, `post`, `progetti`. Le chiavi che iniziano con `_` sono commenti liberi.

## Stato verifiche (06/10/2026)

- `testbirrificio` fatto a mano in 2 passi e verificato online (200 sulle pagine, demo 404).
- `sito_test.py --autotest`: 11 errori voluti trovati, nessun falso allarme sul pacchetto birrificio.
- Giro completo vero provato il 06/10/2026 con `gelatotest` (tema gelato, pacchetto minimo): controlli, clone, contenuti OK; verifica online OK dopo lo sblocco di Pages (vedi sotto).
- **Pages bloccato (trovato con gelatotest, 06/10/2026):** la run 'pages build and deployment' puo' restare in `waiting` per 8+ minuti (lato GitHub) e il sito resta quello vecchio (10 controlli falliti, codice 4). Rimedio, ora automatico in `sblocca_pages()` di `sito_test.py` dopo 2,5 minuti: `gh run cancel <id>` + `gh api -X POST repos/<repo>/pages/builds`. A mano: stessi due comandi, poi `--verifica-solo`.
