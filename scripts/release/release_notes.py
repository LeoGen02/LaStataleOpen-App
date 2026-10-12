#!/usr/bin/env python3
"""Compone le note di una release GitHub: la sezione della versione nel CHANGELOG,
le istruzioni di installazione e l'impronta SHA-256 dell'ipa.

Uso: python3 scripts/release/release_notes.py --version 1.2.0 --repo owner/nome --sha256 <hash>
"""
import argparse
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]


def changelog_section(version: str, changelog: pathlib.Path) -> str:
    """Testo sotto "## [versione]" fino alla sezione successiva; vuoto se manca."""
    if not changelog.exists():
        return ""
    text = changelog.read_text(encoding="utf-8")
    pattern = re.compile(r"^## \[" + re.escape(version) + r"\][^\n]*\n(.*?)(?=^## \[|\Z)", re.S | re.M)
    match = pattern.search(text)
    return match.group(1).strip() if match else ""


def build_notes(version: str, repo: str, sha256: str, changelog: pathlib.Path) -> str:
    section = changelog_section(version, changelog)
    if not section:
        print(f"::warning::CHANGELOG.md non ha una sezione [{version}]: uso un testo generico.", file=sys.stderr)
        section = "Correzioni e miglioramenti."
    base = f"https://github.com/{repo}"
    return f"""{section}

### Installazione
1. Scarica **StataleOpen.ipa** qui sotto, su un computer Windows o Mac.
2. Installalo con Sideloadly (oppure AltStore o SideStore) usando il tuo Apple ID.
3. Solo la prima volta: attiva la **Modalità sviluppatore** e autorizza il tuo Apple ID in *Impostazioni → Generali → VPN e gestione dispositivo*.

Guida passo passo: {base}/blob/main/docs/INSTALLAZIONE.md

Per aggiornare installa il nuovo ipa sopra quello vecchio, con lo stesso Apple ID: credenziali e impostazioni restano.

Con AltStore o SideStore puoi aggiungere questa sorgente per ricevere gli aggiornamenti:
`{base}/releases/latest/download/altstore-source.json`

**SHA-256 di StataleOpen.ipa:** `{sha256}`

App non ufficiale, non affiliata all'Università degli Studi di Milano.
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--sha256", required=True)
    parser.add_argument("--changelog", default=str(ROOT / "CHANGELOG.md"))
    args = parser.parse_args()
    sys.stdout.write(build_notes(args.version, args.repo, args.sha256, pathlib.Path(args.changelog)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
