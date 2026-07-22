import os
from urllib.parse import urlparse

PRODUCTION_HOSTS = {"rpa-banco-talentos-5v5r.onrender.com"}
PRODUCTION_SERVICE_NAMES = {"rpa-banco-talentos-5v5r"}


def _is_truthy(value):
    return str(value or "").strip().lower() in {"1", "true", "yes", "sim", "prod", "production"}


def _is_falsey(value):
    return str(value or "").strip().lower() in {"0", "false", "no", "nao", "não", "dev", "local", "staging", "homolog"}


def _host_from_url(value):
    try:
        return urlparse(str(value or "").strip()).hostname or ""
    except Exception:
        return ""


def is_production_environment(env=None):
    env = env or os.environ

    override = env.get("PROCESSING_LOGS_ENABLED") or env.get("SEND_PROCESSING_LOG_EMAIL")
    if override:
        return _is_truthy(override)

    explicit_env = (
        env.get("APP_ENV")
        or env.get("APP_ENVIRONMENT")
        or env.get("ENVIRONMENT")
        or env.get("DEPLOY_ENV")
    )
    if explicit_env:
        return _is_truthy(explicit_env) and not _is_falsey(explicit_env)

    for key in ("APP_BASE_URL", "PUBLIC_BASE_URL", "RENDER_EXTERNAL_URL"):
        if _host_from_url(env.get(key)) in PRODUCTION_HOSTS:
            return True

    service_name = str(env.get("RENDER_SERVICE_NAME") or "").strip().lower()
    return service_name in PRODUCTION_SERVICE_NAMES
