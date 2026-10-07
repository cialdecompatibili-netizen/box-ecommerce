#!/usr/bin/env python3
"""nuovo_sito.py - crea un NUOVO sito (repo GitHub + Pages) clonando questa cartella, con un solo comando.

1. Cosa fa: repo pubblica vuota su GitHub, copia della cartella (senza .git, _site, node_modules, .jekyll-cache,
   .env, _cestino), riscrive il blocco iniziale 'Questo progetto' del CLAUDE.md del clone, git init + commit + push,
   attende 'Deploy site', abilita Pages (branch gh-pages), verifica l'HTML online. Output: poche righe.
2. Su quale file agisce: crea una cartella NUOVA accanto a questa (Desktop). Nel clone tocca solo CLAUDE.md
   (le 4 righe Repo GitHub / Sito live / Cartella locale / Origine). NON tocca url/baseurl/repos.json (automatici).
3. Locale + gh CLI (gia' loggato): nessuna API anonima.
4. Origine: procedura manuale provata il 04/10/2026 (italfuni, edilextreme2), descritta in CLAUDE.md,
   automatizzata il 06/10/2026.

Uso (dalla cartella del sito di partenza):
  python nuovo_sito.py <nome-repo> [--dry-run] [--privata]
Idempotente: se la cartella di destinazione esiste NON la sovrascrive e continua da li (push, deploy, Pages, verifica).
Dopo: python popola_sito.py <nome-repo> <pacchetto> per riempirlo di contenuti.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

QUI = Path(__file__).resolve().parent
ESCLUDI = ('.git', '_site', 'node_modules', '.jekyll-cache', '__pycache__', '.venv', '.env', '_cestino')


def sh(args, cwd=None):
    r = subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding='utf-8', errors='replace')
    return r.returncode, ((r.stdout or '') + (r.stderr or '')).strip()


def passo(n, testo):
    print(f'[{n}/7] {testo}', flush=True)


def attendi(fn, minuti, pausa=10):
    fine = time.time() + minuti * 60
    while time.time() < fine:
        v = fn()
        if v:
            return v
        time.sleep(pausa)
    return None


def owner_e_nome_partenza():
    _, o = sh(['git', 'remote', 'get-url', 'origin'], cwd=QUI)
    m = re.search(r'github\.com[:/]([^/]+)/([^/.]+?)(?:\.git)?$', o)
    if not m:
        sys.exit('ERRORE: origin della cartella di partenza non riconosciuto: ' + o)
    return m.group(1), m.group(2)


def riscrivi_claude(dest, repo_full, url, sha, partenza):
    """Sostituisce le 4 righe iniziali di 'Questo progetto' (a-capo preservati, assert: una riga per prefisso)."""
    p = dest / 'CLAUDE.md'
    if not p.exists():
        return 'CLAUDE.md assente (saltato)'
    nome = repo_full.split('/')[1]
    nuove = {
        b'- **Repo GitHub:**': f'- **Repo GitHub:** `{repo_full}` (sito di test, clonato da `{partenza}` con `nuovo_sito.py`).',
        b'- **Sito live:**': f'- **Sito live:** {url} (Pages, Source: branch `gh-pages`, build legacy). Baseurl automatico da `deploy.yml`.',
        b'- **Cartella locale:**': f'- **Cartella locale:** `C:\\Users\\mirco\\Desktop\\{nome}`.',
        b'- **Origine:**': f'- **Origine:** copia di `{partenza}` (commit {sha}, {time.strftime("%d/%m/%Y")}); la storia riparte da un commit.',
    }
    righe = p.read_bytes().split(b'\n')
    for pref, testo in nuove.items():
        idx = [i for i, r in enumerate(righe) if r.startswith(pref)]
        if len(idx) != 1:
            return f'CLAUDE.md: riga {pref.decode()} trovata {len(idx)} volte, NON riscritto'
        i = idx[0]
        righe[i] = testo.encode('utf-8') + (b'\r' if righe[i].endswith(b'\r') else b'')
    p.write_bytes(b'\n'.join(righe))
    return 'CLAUDE.md riscritto (4 righe)'


def main():
    ap = argparse.ArgumentParser(description='Clona questo sito in una nuova repo con Pages attivo.')
    ap.add_argument('nome', help='nome della nuova repo = nome della cartella')
    ap.add_argument('--dry-run', action='store_true', help='mostra cosa farebbe, non scrive nulla')
    ap.add_argument('--privata', action='store_true', help='repo privata (Pages gratuito richiede pubblica)')
    a = ap.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9._-]+', a.nome):
        sys.exit('ERRORE: nome repo non valido')

    owner, partenza = owner_e_nome_partenza()
    repo = f'{owner}/{a.nome}'
    dest = QUI.parent / a.nome
    url = f'https://{owner}.github.io/{a.nome}/'
    c, o = sh(['gh', 'auth', 'status'])
    if c != 0:
        sys.exit('ERRORE: gh non loggato: ' + o[:200])
    _, sha = sh(['git', 'rev-parse', '--short', 'HEAD'], cwd=QUI)
    esiste = dest.exists()
    print(f'Partenza: {partenza} ({sha}) -> {repo} | cartella {"ESISTE (si continua da li)" if esiste else "nuova"} | {url}')
    if a.dry_run:
        print('DRY-RUN: nessuna modifica.')
        return

    passo(1, 'repo GitHub')
    c, _ = sh(['gh', 'repo', 'view', repo])
    if c != 0:
        c, o = sh(['gh', 'repo', 'create', repo, '--private' if a.privata else '--public'])
        if c != 0:
            sys.exit('ERRORE creazione repo: ' + o[:300])
        print('  creata', repo)
    else:
        print('  gia\' esistente, riuso', repo)

    passo(2, 'copia + CLAUDE.md')
    if not esiste:
        shutil.copytree(QUI, dest, ignore=shutil.ignore_patterns(*ESCLUDI))
        print('  ', riscrivi_claude(dest, repo, url, sha, partenza))
    else:
        print('  cartella gia\' presente: non toccata')

    passo(3, 'git init + commit + push')
    if not (dest / '.git').exists():
        sh(['git', 'init', '-b', 'main'], cwd=dest)
        sh(['git', 'add', '-A'], cwd=dest)
        c, o = sh(['git', 'commit', '-m', f'Sito di test clonato da {partenza} ({sha})'], cwd=dest)
        if c != 0:
            sys.exit('ERRORE commit: ' + o[:300])
        sh(['git', 'remote', 'add', 'origin', f'https://github.com/{repo}.git'], cwd=dest)
    sh(['git', 'push', '-u', 'origin', 'main'], cwd=dest)  # puo' dare exit 1 anche se ok: si verifica sotto
    _, st = sh(['git', 'status', '-sb'], cwd=dest)
    print('  ', st.splitlines()[0] if st else '?')

    passo(4, "attendo 'Deploy site' (1-2 minuti)")

    def run_finita():
        c, o = sh(['gh', 'run', 'list', '--repo', repo, '--limit', '1', '--json', 'status,conclusion'])
        try:
            d = json.loads(o)[0]
        except Exception:
            return None
        return d['conclusion'] or 'x' if d['status'] == 'completed' else None

    esito = attendi(run_finita, 6)
    print('  esito run:', esito)
    if esito != 'success':
        sys.exit('STOP: il deploy non e\' riuscito. Guardare: gh run list --repo ' + repo)

    passo(5, 'abilito Pages (gh-pages)')
    c, o = sh(['gh', 'api', 'repos/' + repo + '/branches', '--jq', '.[].name'])
    if 'gh-pages' not in o.split():
        sys.exit('STOP: branch gh-pages assente (' + o.replace('\n', ',') + ')')
    c, o = sh(['gh', 'api', '-X', 'POST', 'repos/' + repo + '/pages', '-f', 'source[branch]=gh-pages', '-f', 'source[path]=/'])
    print('  ', 'Pages abilitato' if c == 0 else 'Pages gia\' attivo (secondo POST ignorato)')

    passo(6, 'attendo il sito online (circa 1 minuto)')

    def scarica():
        try:
            with urllib.request.urlopen(url, timeout=20) as r:
                return r.read().decode('utf-8', 'replace') if r.status == 200 else None
        except Exception:
            return None

    html = attendi(scarica, 6)
    if not html:
        sys.exit('STOP: sito non raggiungibile entro 6 minuti: ' + url)

    passo(7, 'verifica HTML')
    n_assets = html.count(f'/{a.nome}/assets/')
    n_vecchio = html.count(partenza)
    titolo = (re.search(r'<title>(.*?)</title>', html, re.S) or [None, '?'])[1].strip()
    print(f'  titolo: {titolo} | percorsi /{a.nome}/assets/: {n_assets} | occorrenze "{partenza}": {n_vecchio}')
    ok = n_assets > 0 and n_vecchio == 0
    print(('OK ' if ok else 'ATTENZIONE ') + url)
    sys.exit(0 if ok else 2)


if __name__ == '__main__':
    main()
