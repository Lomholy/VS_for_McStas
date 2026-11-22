"""Regenerate the bundled component data from a McCode mcstas-comps folder.

Usage: python generate_comps.py <path/to/McCode/mcstas-comps>

Needs mcstasscript, which only parses the .comp files (no McStas install).
"""

import json
import sys
from pathlib import Path

from mcstasscript.helper.component_reader import ComponentReader

OUT = Path(__file__).resolve().parents[1] / "src/mcstas_ls/data/mcstas-comps.json"


def main(comps_dir: str) -> None:
    # input_path is where mcstasscript looks for local override .comp files;
    # the mcstas-comps root has none.
    reader = ComponentReader(comps_dir, input_path=comps_dir)
    data = {}
    for name in sorted(reader.component_category):
        try:
            data[name] = reader.read_name(name).__dict__
        except Exception:
            data[name] = "Component information is unavailable"
    with OUT.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)
        f.write("\n")
    print(f"Wrote {len(data)} components to {OUT}")


if __name__ == "__main__":
    main(sys.argv[1])
