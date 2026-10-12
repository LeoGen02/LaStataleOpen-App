#!/usr/bin/env python3
"""Crea la copia in un solo file dell'app web, da pubblicare come pagina su claude.ai.

Stesso codice di docs/ (app.css, core.js, app.js) con STATALE_EMBEDDED attivo: lì il portale
non è raggiungibile, quindi la pagina offre i dati di esempio e il link all'app web.

Uso: python3 scripts/web/build_embedded.py <file di uscita>
"""
import base64
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"


def build() -> str:
    css = (DOCS / "app.css").read_text(encoding="utf-8")
    core = (DOCS / "core.js").read_text(encoding="utf-8")
    app = (DOCS / "app.js").read_text(encoding="utf-8")
    icon = base64.b64encode((DOCS / "icon-180.png").read_bytes()).decode()
    for name, text in (("core.js", core), ("app.js", app)):
        if "</script" in text.lower():
            raise SystemExit(f"{name} contiene </script>: non si può incorporare")
    return (
        "<title>Statale Open Demo</title>\n"
        f"<style>\n{css}\n</style>\n"
        '<div class="stage">\n  <div class="device" id="device"></div>\n'
        '  <p class="caption">Statale Open con i dati di esempio. Per i tuoi dati veri apri l\'app web: '
        "leogen02.github.io/LaStataleOpen-App</p>\n</div>\n"
        f'<script>window.STATALE_EMBEDDED = true; window.STATALE_ICON = "data:image/png;base64,{icon}";</script>\n'
        f"<script>\n{core}\n</script>\n<script>\n{app}\n</script>\n"
    )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    pathlib.Path(sys.argv[1]).write_text(build(), encoding="utf-8")
