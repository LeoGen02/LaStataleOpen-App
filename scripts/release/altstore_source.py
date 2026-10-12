#!/usr/bin/env python3
"""Genera la sorgente AltStore/SideStore (altstore-source.json) per una release.

Chi aggiunge la sorgente in AltStore o SideStore vede le nuove versioni e le installa dal telefono,
con il rinnovo automatico della firma ogni 7 giorni.

Uso: python3 scripts/release/altstore_source.py --repo owner/nome --tag v1.2.0 --version 1.2.0 \
       --build 57 --ipa dist/StataleOpen.ipa > dist/altstore-source.json
"""
import argparse
import datetime
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from release_notes import changelog_section  # noqa: E402


def project_value(key: str, text: str, default: str = "") -> str:
    match = re.search(r"^\s*" + re.escape(key) + r':\s*"?([^"\n]+?)"?\s*$', text, re.M)
    return match.group(1).strip() if match else default


def usage_descriptions(text: str) -> dict:
    return dict(re.findall(r'^\s*(NS\w+UsageDescription):\s*"([^"]*)"', text, re.M))


def build_source(repo: str, tag: str, version: str, build: str, ipa: pathlib.Path) -> dict:
    project = (ROOT / "project.yml").read_text(encoding="utf-8")
    bundle_id = project_value("PRODUCT_BUNDLE_IDENTIFIER", project, "it.leonardo.stataleopen")
    min_os = project_value("iOS", project, "17.0")
    owner = repo.split("/")[0]
    base = f"https://github.com/{repo}"
    icon = f"https://raw.githubusercontent.com/{repo}/{tag}/StataleOpen/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png"
    download = f"{base}/releases/download/{tag}/StataleOpen.ipa"
    notes = changelog_section(version, ROOT / "CHANGELOG.md") or "Correzioni e miglioramenti."
    date = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat()
    size = ipa.stat().st_size
    description = (
        "App iPhone per il portale La Statale Open (myAriel): corsi con lezioni, esercizi ed e-tivity, "
        "scadenze con promemoria, avvisi del portale e browser interno già autenticato. "
        "App non ufficiale, non affiliata all'Università degli Studi di Milano."
    )
    version_entry = {
        "version": version,
        "buildVersion": str(build),
        "date": date,
        "localizedDescription": notes,
        "downloadURL": download,
        "size": size,
        "minOSVersion": min_os,
    }
    app = {
        "name": "Statale Open",
        "bundleIdentifier": bundle_id,
        "developerName": owner,
        "subtitle": "Il portale La Statale Open sull'iPhone",
        "localizedDescription": description,
        "iconURL": icon,
        "tintColor": "#006BA8",
        "category": "education",
        "versions": [version_entry],
        # Campi del formato precedente, per le versioni meno recenti di AltStore.
        "version": version,
        "versionDate": date,
        "versionDescription": notes,
        "downloadURL": download,
        "size": size,
        "appPermissions": {"entitlements": [], "privacy": usage_descriptions(project)},
    }
    return {
        "name": "Statale Open",
        "identifier": f"{bundle_id}.source",
        "subtitle": "Release di Statale Open",
        "description": description,
        "iconURL": icon,
        "website": base,
        "tintColor": "#006BA8",
        "apps": [app],
        "news": [],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True)
    parser.add_argument("--tag", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--build", required=True)
    parser.add_argument("--ipa", required=True)
    args = parser.parse_args()
    source = build_source(args.repo, args.tag, args.version, args.build, pathlib.Path(args.ipa))
    json.dump(source, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
