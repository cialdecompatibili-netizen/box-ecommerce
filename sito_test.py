#!/usr/bin/env python3
"""sito_test.py - UN SOLO COMANDO per creare un sito di test completo (clone + contenuti + verifica online).

======================================================================================================
COSA FA (in ordine; si ferma al primo errore e dice quale passo e perche')
======================================================================================================
  1. CONTROLLI    legge automazioni/testi/pacchetto_<tema>.json e lo valida PRIMA di toccare GitHub
                  (chiavi sconosciute, ':' nelle description, gruppi servizi incoerenti, slug doppi, testi
                  vuoti, righe della home che non esistono nel modello, modello con modifiche non pushate).
  2. CLONE        lancia nuovo_sito.py   (repo GitHub + copia + push + Pages).      Idempotente.
  3. CONTENUTI    lancia popola_sito.py  (pulizia demo, home, chi-siamo, servizi...). Idempotente.
  4. VERIFICA     aspetta il deploy e controlla le pagine ONLINE (200, niente testi della web agency,
                  sezioni dei servizi giuste, demo spariti). Riprova fino a --minuti.

======================================================================================================
ESEMPI (si lancia dalla cartella del modello: C:\\Users\\mirco\\Desktop\\alfoliotemplate1)
======================================================================================================
  # 0) provare solo i controlli del pacchetto (1 secondo, non scrive niente, non tocca GitHub):
  python sito_test.py testbirrificio birrificio --solo-controlli

  # 1) prova a secco di tutto (nessuna repo creata, nessun file scritto):
  python sito_test.py pizzeriatest pizzeria --dry-run

  # 2) giro completo vero (circa 8-10 minuti):
  python sito_test.py pizzeriatest pizzeria

  # 3) ripetere la sola verifica online di un sito gia' fatto:
  python sito_test.py testbirrificio birrificio --verifica-solo

  # 4) auto-test del validatore (deve TROVARE gli errori messi apposta; se non li trova e' rotto lui):
  python sito_test.py x x --autotest

  Argomenti: <nome-repo> = nome nuovo (solo lettere, numeri, . _ -), diventa anche la cartella sul Desktop.
             <tema>      = il pezzo dopo 'pacchetto_' nel nome del file (birrificio -> pacchetto_birrificio.json).

======================================================================================================
ERRORI TIPICI E COSA FARE
======================================================================================================
  "':' nella description"   -> togli i due punti dal testo (YAML rotto = pagina 404 SENZA nessun errore).
  "gruppo 'X' non e' in gruppi" -> aggiungi X alla lista "gruppi" del pacchetto (stesso nome, stesse maiuscole).
  "chiave sconosciuta"      -> errore di battitura nel pacchetto (es. "servizio" invece di "servizi").
  "modello con modifiche"   -> committa e pusha alfoliotemplate1 PRIMA: il clone copia la cartella cosi' com'e'.
  "dest esiste"             -> non e' un errore: si continua da li (idempotente), si legge git log del clone.
  Verifica che non passa subito -> normale per 1-2 minuti (GitHub Pages); lo script riprova da solo.

======================================================================================================
DOVE STA COSA / CHI CHIAMA CHI
======================================================================================================
  sito_test.py (questo)  --chiama-->  nuovo_sito.py   --usa-->  gh + git
                         --chiama-->  popola_sito.py  --usa-->  python -m automazioni <modulo> ... + pubblica_chi_siamo.py
  Dati (mai codice):  automazioni/testi/pacchetto_<tema>.json        Doc:  docs/claude/nuovo-sito-test.md
  Il sito nuovo nasce in  C:\\Users\\mirco\\Desktop\\<nome-repo>  (accanto al modello).

Origine: richiesta del 06/10/2026 ("rendilo stabile"): prima erano 2 comandi separati e gli errori del pacchetto
(es. i due punti) si scoprivano solo a meta', con la repo gia' creata.
Codici di uscita: 0 ok | 1 controlli | 2 clone | 3 contenuti | 4 verifica online.
"""
import argparse
import json
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

QUI = Path(__file__).resolve().parent                    # cartella del modello (alfoliotemplate1)
TESTI = QUI / 'automazioni' / 'testi'
sys.path.insert(0, str(QUI))
from popola_sito import slug_di                          # stessa regola degli slug dello script che crea i contenuti

# Chiavi ammesse nel pacchetto. Quelle che iniziano con '_' sono commenti liberi (es. "_istruzioni") e si ignorano.
CHIAVI_OK = {'home', 'gruppi', 'menu', 'chi_siamo', 'config_descrizione', 'svuota_cartelle',
             'servizi', 'post', 'progetti'}
TIPI_SEZIONE = {'hero', 'numeri', 'griglia', 'finale'}   # tipi ammessi in chi_siamo.sezioni (vedi chi_siamo.json)
# Testi del modello che NON devono restare online nel sito di test (se compaiono: contenuto non riscritto).
VIETATE = ['Web Agency', 'Web agency', 'web agency', 'a Roma', 'Roma dal 2013']
# Pagine che devono rispondere 200 e URL demo del tema che devono essere spariti (404).
PAGINE_OK = ['/', '/chi-siamo/', '/servizi/', '/contatti/', '/blog/']
PAGINE_DEMO_404 = ['/projects/1_project/', '/teachings/data-science-fundamentals/']


def sh(args, cwd=None, timeout=None):
    """Esegue un comando, ritorna (codice, output). Mai eccezioni: l'errore sta nel codice di ritorno."""
    try:
        r = subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout)
        return r.returncode, ((r.stdout or '') + (r.stderr or '')).strip()
    except subprocess.TimeoutExpired:
        return 124, 'TIMEOUT'


def passo(n, testo):
    print(f'\n=== [{n}/4] {testo}', flush=True)


def ultime(o, n=4):
    return '\n'.join(o.splitlines()[-n:])


# ----------------------------------------------------------------------------------------------------
# 1. CONTROLLI DEL PACCHETTO (offline). Ritorna (errori, avvisi): se ci sono errori NON si va avanti.
# ----------------------------------------------------------------------------------------------------
def controlli_pacchetto(pk):
    """Valida il dizionario del pacchetto. Esempio di errore trovato:
         "servizi[2] 'Visite guidate': gruppo 'Esperienze ' non e' in gruppi ['Esperienze', ...]"  (spazio finale!)
    """
    err, avv = [], []
    for k in pk:
        if k not in CHIAVI_OK and not k.startswith('_'):
            err.append(f"chiave sconosciuta '{k}' (ammesse: {sorted(CHIAVI_OK)}; i commenti iniziano con '_')")
    gruppi = pk.get('gruppi')
    if gruppi is not None and (not isinstance(gruppi, list) or not all(isinstance(g, str) and g for g in gruppi)):
        err.append("'gruppi' deve essere una lista di nomi (stringhe non vuote)")
        gruppi = None

    # Servizi / post / progetti: titolo e testo obbligatori, slug unici, gruppo coerente.
    for chiave in ('servizi', 'post', 'progetti'):
        visti = set()
        for i, x in enumerate(pk.get(chiave, [])):
            nome = f"{chiave}[{i}] '{x.get('titolo', '?')}'"
            if not x.get('titolo'):
                err.append(f'{chiave}[{i}]: manca il titolo')
                continue
            if not (x.get('testo') or '').strip():
                err.append(f'{nome}: testo vuoto (la pagina uscirebbe vuota)')
            s = slug_di(x['titolo'])
            if not s:
                err.append(f'{nome}: titolo senza lettere/numeri, lo slug sarebbe vuoto')
            if s in visti:
                err.append(f"{nome}: slug '{s}' gia' usato da un altro elemento")
            visti.add(s)
            if chiave == 'servizi':
                g = x.get('gruppo')
                if gruppi is not None and g and g not in gruppi:
                    err.append(f"{nome}: gruppo '{g}' non e' in gruppi {gruppi}")
                if gruppi is not None and not g:
                    avv.append(f"{nome}: senza gruppo, finira' in 'Altri servizi'")
            if chiave == 'post':
                c = x.get('categoria', '')
                if not re.fullmatch(r'[a-z0-9-]+', c):
                    err.append(f"{nome}: categoria '{c}' non valida (minuscole, numeri, trattini: entra nell'URL /blog/<categoria>/)")
            if ': ' in (x.get('descrizione') or '') or (x.get('descrizione') or '').startswith(('-', '#', '&', '*', '!', '|', '>', "'", '"', '%', '@')):
                avv.append(f'{nome}: descrizione con caratteri YAML a rischio (il motore quota, ma controlla la pagina)')

    # chi_siamo: il front matter lo scrive pubblica_chi_siamo.py SENZA virgolette -> niente ':' (-> pagina 404 muta).
    cs = pk.get('chi_siamo')
    if cs:
        for k, v in (cs.get('pagina') or {}).items():
            if isinstance(v, str) and ':' in v:
                err.append(f"chi_siamo.pagina.{k}: ':' nella stringa (YAML rotto, /chi-siamo/ darebbe 404 senza errori)")
        for j, sez in enumerate(cs.get('sezioni', [])):
            if sez.get('tipo') not in TIPI_SEZIONE:
                err.append(f"chi_siamo.sezioni[{j}]: tipo '{sez.get('tipo')}' non ammesso {sorted(TIPI_SEZIONE)}")
        if not cs.get('sezioni'):
            err.append('chi_siamo senza sezioni')

    # home: righe su UNA riga, 'inizia_con' lista, niente ': ' nei campi front matter.
    for p in (pk.get('home') or {}).get('pagine', []):
        for k, v in (p.get('front') or {}).items():
            if isinstance(v, str) and ': ' in v:
                err.append(f"home {p.get('pagina')} front.{k}: ': ' nel valore (rompe il front matter YAML)")
        for r in p.get('righe', []):
            if '\n' in r.get('nuova', '') or '\r' in r.get('nuova', ''):
                err.append(f"home {p.get('pagina')}: 'nuova' deve stare su UNA riga: {r.get('nuova', '')[:50]!r}")
            if not isinstance(r.get('inizia_con'), list) or not r['inizia_con']:
                err.append(f"home {p.get('pagina')}: 'inizia_con' deve essere una lista non vuota")

    d = pk.get('config_descrizione')
    if d is not None and ('\n' in d or not d.strip()):
        err.append("config_descrizione: una riga sola, non vuota")
    for c in pk.get('svuota_cartelle', []):
        if not c.startswith('_') or '/' in c or '\\' in c:
            err.append(f"svuota_cartelle '{c}': solo nomi di cartelle del sito che iniziano con '_' (es. _teachings)")
    return err, avv


def controlla_righe_home_sul_modello(pk):
    """Prova (a secco) le righe della home sul MODELLO: se un 'inizia_con' non trova UNA riga, qui lo si scopre
    prima di creare la repo. Esempio: 'inizia_con': ['## Web Agency'] funziona perche' la home del modello la contiene."""
    if not (pk.get('home') or {}).get('pagine'):
        return []
    import tempfile
    home = dict(pk['home'])
    home['sito'] = QUI.name
    tmp = Path(tempfile.gettempdir()) / 'sito_test_home_check.json'
    tmp.write_text(json.dumps(home, ensure_ascii=False), encoding='utf-8')
    c, o = sh([sys.executable, '-m', 'automazioni', 'pagine', 'testi', str(tmp), '--dry-run', '--sito', str(QUI)], cwd=QUI)
    return [] if c == 0 else ['righe della home non applicabili al modello:\n   ' + ultime(o, 3).replace('\n', '\n   ')]


def modello_pulito():
    """Il clone copia la cartella cosi' com'e': modifiche non committate/pushate finirebbero nel sito nuovo."""
    out = []
    c, o = sh(['git', 'status', '--porcelain'], cwd=QUI)
    if o:
        out.append('modello con modifiche non committate (git status): ' + o.splitlines()[0][:80] + ' ...')
    sh(['git', 'fetch', 'origin', '--quiet'], cwd=QUI)
    c, o = sh(['git', 'rev-list', '--count', 'origin/main..HEAD'], cwd=QUI)
    if c == 0 and o.strip() not in ('', '0'):
        out.append(f'modello con {o.strip()} commit non pushati (git push origin main)')
    return out


# ----------------------------------------------------------------------------------------------------
# 4. VERIFICA ONLINE
# ----------------------------------------------------------------------------------------------------
def scarica(url):
    """(codice HTTP, html). Codice 0 = rete/timeout. Esempio: scarica('https://x.github.io/repo/') -> (200, '<html...')"""
    try:
        with urllib.request.urlopen(url, timeout=25) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, ''
    except Exception:
        return 0, ''


def esito_deploy(repo):
    """Ultima run di GitHub Actions: 'success' | 'failure' | 'cancelled' | ... | None se ancora in corso."""
    c, o = sh(['gh', 'run', 'list', '--repo', repo, '--limit', '1', '--json', 'status,conclusion'])
    try:
        d = json.loads(o)[0]
    except Exception:
        return None
    return (d['conclusion'] or 'x') if d['status'] == 'completed' else None


def verifica_una_volta(base, pk):
    """Ritorna la lista dei problemi trovati ORA (lista vuota = tutto ok)."""
    problemi = []
    pagine = list(PAGINE_OK)
    if pk.get('servizi'):
        pagine.append('/servizi/%s/' % slug_di(pk['servizi'][0]['titolo']))
    for p in pagine:
        cod, html = scarica(base + p.lstrip('/'))
        if cod != 200:
            problemi.append(f'{p} -> HTTP {cod} (atteso 200)')
            continue
        for v in VIETATE:
            if v in html:
                problemi.append(f"{p} contiene ancora '{v}' (testo del modello non riscritto)")
                break
        if p == '/servizi/':
            for g in pk.get('gruppi', []):
                if g not in html:
                    problemi.append(f"/servizi/ non mostra la sezione '{g}' (controlla _data/servizi_gruppi.yml)")
            if pk.get('gruppi') and 'Altri servizi' in html:
                problemi.append("/servizi/ mostra 'Altri servizi': qualche servizio ha un gruppo non elencato")
    if pk.get('servizi') or pk.get('progetti'):   # i demo del tema devono essere spariti
        for p in PAGINE_DEMO_404:
            cod, _ = scarica(base + p.lstrip('/'))
            if cod == 200:
                problemi.append(f'{p} risponde ancora 200 (demo del tema non rimosso)')
    return problemi


def verifica_online(owner, nome, pk, minuti):
    repo, base = f'{owner}/{nome}', f'https://{owner}.github.io/{nome}/'
    fine = time.time() + minuti * 60
    print('  attendo il deploy...', flush=True)
    while time.time() < fine:                       # 1) la run di Actions deve finire
        e = esito_deploy(repo)
        if e:
            break
        time.sleep(10)
    else:
        return ['deploy ancora in corso dopo %d minuti (gh run list --repo %s)' % (minuti, repo)]
    if e != 'success':
        return [f"deploy '{e}': guarda gh run list --repo {repo}"]
    problemi = ['(non ancora verificato)']
    inizio_pages, sbloccato = time.time(), False
    while time.time() < fine:                       # 2) Pages impiega ~1 minuto a pubblicare: si riprova
        problemi = verifica_una_volta(base, pk)
        if not problemi:
            return []
        if not sbloccato and time.time() - inizio_pages > 150:   # dopo 2,5 minuti ancora niente: Pages puo' essere bloccato
            sbloccato = sblocca_pages(repo)
        print(f'  ... {len(problemi)} controlli non ancora ok, riprovo tra 20s', flush=True)
        time.sleep(20)
    return problemi


def sblocca_pages(repo):
    """Trovato nel primo giro vero (gelatotest, 06/10/2026): la run 'pages build and deployment' restava in 'waiting'
    per 8+ minuti (lato GitHub) e il sito online era ancora quello vecchio. Rimedio provato: cancellare la run ferma
    e chiedere una build nuova (gh api -X POST repos/<repo>/pages/builds) -> online in ~1 minuto.
    Ritorna True se ha tentato lo sblocco (una volta sola per verifica)."""
    c, o = sh(['gh', 'run', 'list', '--repo', repo, '--limit', '5', '--json', 'databaseId,status,name'])
    try:
        ferme = [r for r in json.loads(o) if r['status'] in ('waiting', 'queued') and 'pages build' in r['name']]
    except Exception:
        return False
    if not ferme:
        return False
    for r in ferme:
        sh(['gh', 'run', 'cancel', str(r['databaseId']), '--repo', repo])
    time.sleep(5)
    sh(['gh', 'api', '-X', 'POST', f'repos/{repo}/pages/builds'])
    print(f"  Pages bloccato ({len(ferme)} run ferme): annullate e richiesta una build nuova", flush=True)
    return True


# ----------------------------------------------------------------------------------------------------
# AUTO-TEST: il validatore deve TROVARE errori messi apposta. Se non li trova, il validatore e' rotto.
# ----------------------------------------------------------------------------------------------------
def autotest():
    cattivo = {
        'servizio': [],                                                       # chiave sconosciuta (battitura)
        'gruppi': ['A'],
        'servizi': [{'titolo': 'Uno', 'gruppo': 'B', 'testo': 'x'},           # gruppo non in gruppi
                    {'titolo': 'Uno', 'gruppo': 'A', 'testo': ' '}],          # slug doppio + testo vuoto
        'post': [{'titolo': 'P', 'categoria': 'Birra Buona', 'testo': 'x'}],  # categoria non valida
        'chi_siamo': {'pagina': {'description': 'Bello: davvero'}, 'sezioni': [{'tipo': 'boh'}]},
        'home': {'pagine': [{'pagina': '_pages/home.md', 'front': {'seo_description': 'a: b'},
                             'righe': [{'inizia_con': [], 'nuova': 'riga1\nriga2'}]}]},
        'svuota_cartelle': ['assets/img'],
    }
    err, _ = controlli_pacchetto(cattivo)
    attesi = ['chiave sconosciuta', "gruppo 'B'", "slug 'uno'", 'testo vuoto', 'categoria', "':' nella stringa",
              "tipo 'boh'", "': ' nel valore", 'UNA riga', "'inizia_con'", 'svuota_cartelle']
    mancanti = [a for a in attesi if not any(a in e for e in err)]
    ok_err, _ = controlli_pacchetto(json.loads((TESTI / 'pacchetto_birrificio.json').read_text(encoding='utf-8')))
    if mancanti or ok_err:
        print('AUTOTEST FALLITO. Errori non rilevati:', mancanti, '| falsi allarmi sul pacchetto buono:', ok_err)
        return 1
    print(f'AUTOTEST OK: {len(err)} errori voluti trovati, nessun falso allarme su pacchetto_birrificio.json')
    return 0


def main():
    ap = argparse.ArgumentParser(description='Crea un sito di test completo: controlli, clone, contenuti, verifica online.')
    ap.add_argument('nome', help='nome della nuova repo/cartella (es. pizzeriatest)')
    ap.add_argument('tema', help='pacchetto: automazioni/testi/pacchetto_<tema>.json (es. pizzeria)')
    ap.add_argument('--dry-run', action='store_true', help='prova a secco: nessuna repo, nessun file')
    ap.add_argument('--solo-controlli', action='store_true', help='solo il passo 1 (offline)')
    ap.add_argument('--verifica-solo', action='store_true', help='solo il passo 4 su un sito gia\' fatto')
    ap.add_argument('--autotest', action='store_true', help='prova il validatore con errori messi apposta')
    ap.add_argument('--minuti', type=int, default=8, help='quanto aspettare deploy+Pages (default 8)')
    ap.add_argument('--ignora-modello', action='store_true', help='non bloccare se il modello ha modifiche non pushate')
    a = ap.parse_args()
    if a.autotest:
        sys.exit(autotest())
    if not re.fullmatch(r'[A-Za-z0-9._-]+', a.nome):
        sys.exit("ERRORE: nome repo non valido (solo lettere, numeri, . _ -)")
    pf = TESTI / f'pacchetto_{a.tema}.json'
    if not pf.exists():
        disp = sorted(p.stem.replace('pacchetto_', '') for p in TESTI.glob('pacchetto_*.json'))
        sys.exit(f"ERRORE: manca {pf.name}. Pacchetti disponibili: {disp}")
    try:
        pk = json.loads(pf.read_text(encoding='utf-8'))
    except ValueError as e:
        sys.exit(f'ERRORE: {pf.name} non e\' un JSON valido: {e}')
    c, o = sh(['git', 'remote', 'get-url', 'origin'], cwd=QUI)
    m = re.search(r'github\.com[:/]([^/]+)/', o)
    if not m:
        sys.exit('ERRORE: origin del modello non riconosciuto: ' + o)
    owner = m.group(1)

    if a.verifica_solo:
        passo(4, 'verifica online')
        pr = verifica_online(owner, a.nome, pk, a.minuti)
        print('OK tutto a posto' if not pr else 'PROBLEMI:\n  - ' + '\n  - '.join(pr))
        sys.exit(0 if not pr else 4)

    # ---- 1. controlli
    passo(1, 'controlli del pacchetto')
    err, avv = controlli_pacchetto(pk)
    err += controlla_righe_home_sul_modello(pk)
    if not a.ignora_modello and not a.dry_run:
        err += modello_pulito()
    for w in avv:
        print('  avviso:', w)
    if err:
        print('ERRORI (nessuna repo creata, nessun file scritto):\n  - ' + '\n  - '.join(err))
        sys.exit(1)
    print(f"  OK: pacchetto '{a.tema}' valido | {len(pk.get('servizi', []))} servizi, {len(pk.get('post', []))} post, "
          f"{len(pk.get('progetti', []))} progetti")
    if a.solo_controlli:
        return

    dr = ['--dry-run'] if a.dry_run else []
    # ---- 2. clone
    passo(2, 'clone del modello (nuovo_sito.py)')
    c, o = sh([sys.executable, 'nuovo_sito.py', a.nome, *dr], cwd=QUI)
    print(ultime(o, 5))
    if c != 0:
        sys.exit(f'STOP passo 2 (clone), codice {c}. Si puo\' rilanciare: riparte da dove si e\' fermato.')
    # ---- 3. contenuti
    passo(3, 'contenuti (popola_sito.py)')
    if a.dry_run and not (QUI.parent / a.nome).exists():
        print('  (dry-run: il clone non esiste ancora, passo 3 saltato)')
    else:
        c, o = sh([sys.executable, 'popola_sito.py', a.nome, a.tema, *dr], cwd=QUI)
        print(ultime(o, 5))
        if c != 0:
            sys.exit(f'STOP passo 3 (contenuti), codice {c}. Si puo\' rilanciare: salta cio\' che esiste gia\'.')
    if a.dry_run:
        print('\nDRY-RUN finito: nessuna modifica fatta.')
        return
    # ---- 4. verifica
    passo(4, 'verifica online')
    pr = verifica_online(owner, a.nome, pk, a.minuti)
    if pr:
        print('PROBLEMI:\n  - ' + '\n  - '.join(pr))
        sys.exit(4)
    print(f'\nTUTTO OK  https://{owner}.github.io/{a.nome}/')


if __name__ == '__main__':
    main()
