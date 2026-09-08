"""Download caching and .env loading.

Ingest steps are slow and rate-limited. Every step writes to data/interim/ and
skips itself if the output already exists, unless --force is passed. Downstream
stages get rerun dozens of times; the network should not be hit again for that.
"""
import os
import pathlib
from functools import lru_cache

from .paths import ROOT, DATA_INTERIM


@lru_cache(maxsize=1)
def load_env() -> dict[str, str]:
    """Read the root .env into os.environ and return it.

    Deliberately does not touch .env.example -- that file is tracked by git and
    must stay blank.
    """
    env_file = ROOT / ".env"
    found = {}
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            s = line.strip()
            if not s or s.startswith("#") or "=" not in s:
                continue
            k, v = s.split("=", 1)
            k, v = k.strip(), v.strip()
            if v:
                found[k] = v
                os.environ.setdefault(k, v)
    return found


def require_env(name: str) -> str:
    load_env()
    val = os.environ.get(name, "")
    if not val:
        raise SystemExit(
            f"{name} kosong. Isi di berkas .env (BUKAN .env.example)."
        )
    return val


def interim(name: str) -> pathlib.Path:
    DATA_INTERIM.mkdir(parents=True, exist_ok=True)
    return DATA_INTERIM / name


def cached(path: pathlib.Path, force: bool = False) -> bool:
    """True if `path` already holds a usable result and we should skip."""
    if force or not path.exists() or path.stat().st_size == 0:
        return False
    print(f"  [cache] {path.name} sudah ada, lewati (--force untuk unduh ulang)")
    return True
