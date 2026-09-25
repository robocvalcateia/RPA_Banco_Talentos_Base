import copy
import importlib.util
from pathlib import Path
import sys
import types
import unittest

rows = []
class Collection:
    def update_one(self, query, value, upsert):
        rows.append(copy.deepcopy(value["$set"]))

mongo = types.ModuleType("config.mongodb")
mongo.get_mongodb = lambda: types.SimpleNamespace(get_db=lambda: {"emailDeliveryLogs": Collection()})
mongo.get_candidate_collection_name = lambda: "curriculums"
graph = types.ModuleType("config.microsoft_graph")
graph.get_microsoft_graph = lambda: types.SimpleNamespace(get_email=lambda: "robocv@example.test", get_headers=lambda: {})
env = types.ModuleType("utils.environment")
env.is_production_environment = lambda: True
requests = types.ModuleType("requests")
for name, module in [("config.mongodb", mongo), ("config.microsoft_graph", graph), ("utils.environment", env), ("requests", requests)]:
    sys.modules[name] = module
spec = importlib.util.spec_from_file_location("email_sender", Path(__file__).resolve().parents[1] / "legacy_banco_talentos/utils/email_sender.py")
sender = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sender)

class ReceiptLogTests(unittest.TestCase):
    def setUp(self):
        rows.clear()
        requests.post = lambda *a, **k: types.SimpleNamespace(status_code=202)

    def test_success_records_before_and_after_send(self):
        result = sender.enviar_confirmacao_recebimento_cv("Teste", "teste@example.test")
        self.assertTrue(result["sent"])
        self.assertEqual([row["status"] for row in rows], ["sending", "sent"])
        self.assertEqual(rows[0]["id"], rows[1]["id"])
        self.assertTrue(rows[1]["sentAt"])

    def test_missing_email_does_not_send(self):
        requests.post = lambda *a, **k: self.fail("Não deve enviar")
        self.assertFalse(sender.enviar_confirmacao_recebimento_cv("Teste", "")["sent"])
        self.assertEqual(rows[-1]["status"], "skipped")

    def test_provider_error_is_persisted(self):
        requests.post = lambda *a, **k: types.SimpleNamespace(status_code=403, text="Permissão recusada")
        with self.assertRaises(Exception):
            sender.enviar_confirmacao_recebimento_cv("Teste", "teste@example.test")
        self.assertEqual(rows[-1]["status"], "failed")
        self.assertIn("Permissão recusada", rows[-1]["error"])

if __name__ == '__main__':
    unittest.main()
