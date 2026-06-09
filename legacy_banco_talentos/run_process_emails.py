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

print("__RESULT_JSON__=" + json.dumps(resultado, ensure_ascii=False, default=str))
sys.exit(0 if resultado.get("success") else 1)
