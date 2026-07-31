"""
Wrapper chamado pelo servidor Node.js para manter o fluxo antigo de leitura de e-mails.
Ele executa BancoTalentosOrchestrator.run() e imprime uma linha JSON fácil de parsear.
"""
import json
import os
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

def make_json_safe(value):
    if isinstance(value, str):
        return value.encode("utf-8", "ignore").decode("utf-8", "ignore")
    if isinstance(value, list):
        return [make_json_safe(item) for item in value]
    if isinstance(value, dict):
        return {
            make_json_safe(key): make_json_safe(item)
            for key, item in value.items()
        }
    return value

try:
    from main import BancoTalentosOrchestrator

    resultado = BancoTalentosOrchestrator().run()
    if resultado is None:
        resultado = {
            "success": False,
            "message": "O processamento não retornou resultado.",
            "stats": {},
            "total_candidatos": 0,
        }
except Exception as exc:
    resultado = {
        "success": False,
        "message": f"Erro ao executar processamento de e-mails: {exc}",
        "traceback": traceback.format_exc(),
        "stats": {
            "emails_processados": 0,
            "arquivos_baixados": 0,
            "arquivos_processados": 0,
            "novos_candidatos": 0,
            "candidatos_atualizados": 0,
            "sem_mudancas": 0,
            "erros": 1,
        },
        "total_candidatos": 0,
    }

resultado = make_json_safe(resultado)
print("__RESULT_JSON__=" + json.dumps(resultado, ensure_ascii=False, default=str))
sys.exit(0 if resultado.get("success") else 1)
