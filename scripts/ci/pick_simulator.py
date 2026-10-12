#!/usr/bin/env python3
"""Stampa l'UDID di un simulatore iPhone disponibile, con il runtime iOS più recente.

Uso: xcrun simctl list devices available -j | python3 scripts/ci/pick_simulator.py
"""
import json
import re
import sys


def runtime_version(key: str) -> tuple:
    # es. "com.apple.CoreSimulator.SimRuntime.iOS-18-2" → (18, 2)
    match = re.search(r"iOS-(\d+(?:-\d+)*)$", key)
    return tuple(int(part) for part in match.group(1).split("-")) if match else ()


def main() -> int:
    devices = json.load(sys.stdin).get("devices", {})
    for runtime in sorted((k for k in devices if runtime_version(k)), key=runtime_version, reverse=True):
        if runtime_version(runtime) < (17,):
            continue
        for device in devices[runtime]:
            if device.get("isAvailable", True) and device.get("name", "").startswith("iPhone"):
                print(device["udid"])
                return 0
    print("Nessun simulatore iPhone con iOS 17 o successivo disponibile", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
