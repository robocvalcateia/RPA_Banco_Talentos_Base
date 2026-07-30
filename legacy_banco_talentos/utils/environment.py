import os
from urllib.parse import urlparse

PRODUCTION_HOSTS = {"rpa-banco-talentos-5v5r.onrender.com"}
PRODUCTION_SERVICE_NAMES = {"rpa-banco-talentos-5v5r"}


def _is_falsey(value):
    return str(value or "").strip().lower() in {
        "0",
        "false",
        "no",
        "nao",
        "não",
        "dev",
        "local",
        "staging",
        "homolog",
    }


def _host_from_url(value):
    try:
        return urlparse(str(value or "").strip()).hostname or ""
    except Exception:
        return ""


def is_production_environment(env=None):
    env = env or os.environ

    explicit_env = (
        env.get("APP_ENV")
        or env.get("APP_ENVIRONMENT")
        or env.get("ENVIRONMENT")
        or env.get("DEPLOY_ENV")
    )
    if explicit_env and _is_falsey(explicit_env):
        return False

    for key in ("APP_BASE_URL", "PUBLIC_BASE_URL", "RENDER_EXTERNAL_URL"):
        if _host_from_url(env.get(key)) in PRODUCTION_HOSTS:
            return True

    service_name = str(env.get("RENDER_SERVICE_NAME") or "").strip().lower()
    return service_name in PRODUCTION_SERVICE_NAMES
