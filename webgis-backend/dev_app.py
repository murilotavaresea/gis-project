from __future__ import annotations

import site
import sys
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent
SITE_PACKAGES_CANDIDATES = [
    ROOT_DIR / "venv" / "Lib" / "site-packages",
    ROOT_DIR / ".venv" / "Lib" / "site-packages",
]


for site_packages in SITE_PACKAGES_CANDIDATES:
    if site_packages.exists():
        site.addsitedir(str(site_packages))


if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))


from app import app  # noqa: E402


if __name__ == "__main__":
    app.run(debug=True, use_reloader=False, port=5000, threaded=True)
