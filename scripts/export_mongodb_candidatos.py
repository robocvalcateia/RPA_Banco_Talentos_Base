"""Exporta a collection candidatos do MongoDB legado para JSON.

Uso:
    python scripts/export_mongodb_candidatos.py

O script lê as variáveis MONGODB_URL, MONGODB_DB e MONGODB_COLLECTION do .env
local. Ele gera data/candidatos_old.json, que depois pode ser importado com:
    npm run import:curriculums -- data/candidatos_old.json
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from datetime import datetime, date
from decimal import Decimal

try:
    from dotenv import load_dotenv
    from pymongo import MongoClient
    from bson import ObjectId
except ImportError as exc:
    raise SystemExit(
        "Instale as dependências antes: pip install pymongo python-dotenv"
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

MONGODB_URL = os.getenv("MONGODB_URL")
MONGODB_DB = os.getenv("MONGODB_DB", "Banco_de_Talentos")
MONGODB_COLLECTION = os.getenv("MONGODB_CURRICULUM_COLLECTION") or os.getenv("MONGODB_COLLECTION", "curriculums")
OUTPUT = ROOT / "data" / "curriculums_export.json"

if not MONGODB_URL:
    raise SystemExit("Configure MONGODB_URL no arquivo .env antes de executar.")


def json_default(value):
    if isinstance(value, ObjectId):
        return {"$oid": str(value)}
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    return str(value)

client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=10000)
client.admin.command("ping")
collection = client[MONGODB_DB][MONGODB_COLLECTION]

docs = list(collection.find({}).sort([("data_atualizacao", -1), ("data_criacao", -1), ("_id", -1)]))
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(docs, ensure_ascii=False, indent=2, default=json_default) + "\n", encoding="utf-8")
print(f"Exportados {len(docs)} candidatos para {OUTPUT}")
