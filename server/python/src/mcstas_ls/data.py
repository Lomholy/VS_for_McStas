"""Loader for the McStas component data bundled with the package.

Ported from the ad hoc `import * as data from './mcstas-comps.json'` plus
`ensureComponentsLoaded()` pattern used in completion.ts/hover.ts; both
modules there re-import the same JSON module, whereas here they share one
lazily loaded dict.
"""

from __future__ import annotations

import json
from importlib import resources
from typing import Any

_components: dict[str, Any] | None = None


def get_components() -> dict[str, Any]:
    global _components
    if _components is None:
        data_path = resources.files("mcstas_ls").joinpath("data/mcstas-comps.json")
        with data_path.open("r", encoding="utf-8") as f:
            _components = json.load(f)
    return _components
