import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
DATABASE = ROOT / "data" / "database.json"
WORKBOOK = Path(r"C:\Users\Usuário\Downloads\migração.xlsx")


def text(value):
    if value is None:
        return ""
    value = str(value).strip()
    return "" if value.lower() in {"nan", "nat"} else value


def slug(value):
    clean = unicodedata.normalize("NFD", text(value))
    clean = "".join(char for char in clean if unicodedata.category(char) != "Mn")
    clean = re.sub(r"[^a-zA-Z0-9]+", "_", clean).strip("_").lower()
    return clean or "item"


def key(value):
    return slug(value)


def number(value, default=0):
    raw = text(value)
    if not raw:
        return default
    raw = raw.replace("R$", "").replace(" ", "")
    if "," in raw and "." in raw:
        raw = raw.replace(".", "").replace(",", ".")
    elif "," in raw:
        raw = raw.replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return default


def integerish(value, default=0):
    parsed = number(value, default)
    return int(parsed) if float(parsed).is_integer() else parsed


def date_only(value):
    raw = text(value)
    if not raw:
        return ""
    parsed = pd.to_datetime(raw, errors="coerce")
    if pd.isna(parsed):
        return ""
    return parsed.strftime("%Y-%m-%d")


def month_year(value, fallback_date=""):
    raw = text(value).replace("--", "-")
    match = re.search(r"(\d{4})-(\d{1,2})", raw)
    if match:
        return f"{match.group(1)}-{int(match.group(2)):02d}"
    if fallback_date:
        return fallback_date[:7]
    return ""


def boolean(value):
    return text(value).lower() in {"true", "1", "sim", "yes", "on", "x"}


def iso_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def row_value(row, column):
    return text(row.get(column, ""))


def main():
    db = json.loads(DATABASE.read_text(encoding="utf-8"))
    clients = [client for client in db.get("clients", []) if text(client.get("customerName"))]
    client_by_name = {key(client.get("customerName")): client for client in clients}

    def client_id(name):
        found = client_by_name.get(key(name))
        if found:
            return found["id"]
        new_client = {
            "id": f"client_{slug(name)}",
            "customerName": text(name),
            "primaryContactName": "",
            "primaryContactEmail": "",
            "primaryContactPhone": "",
            "observation": "Criado automaticamente na importacao de migracao.xlsx.",
            "createdAt": iso_now(),
        }
        clients.append(new_client)
        client_by_name[key(name)] = new_client
        return new_client["id"]

    def guess_client_id(label):
        normalized = key(label)
        for client_key, client in client_by_name.items():
            if client_key and client_key in normalized:
                return client["id"]
        return clients[0]["id"] if clients else client_id("Cliente nao informado")

    opportunities_df = pd.read_excel(WORKBOOK, sheet_name="Oportunidades", dtype=str).fillna("")
    candidates_df = pd.read_excel(WORKBOOK, sheet_name="Candidatos", dtype=str).fillna("")
    allocateds_df = pd.read_excel(WORKBOOK, sheet_name="Alocados", dtype=str).fillna("")

    opportunities = []
    opportunity_id_by_code = {}
    opportunity_id_by_name = {}
    for index, row in opportunities_df.iterrows():
        code = row_value(row, "Id_Oportunidade") or str(index + 1)
        opportunity_name = row_value(row, "Oportunidade")
        if not opportunity_name and not row_value(row, "Cliente"):
            continue
        opening = date_only(row_value(row, "Abertura"))
        closing = date_only(row_value(row, "Fechamento"))
        opportunity_id = f"opp_{slug(code)}"
        opportunity_id_by_code[code] = opportunity_id
        opportunity_id_by_name.setdefault(key(opportunity_name), opportunity_id)
        opportunities.append(
            {
                "id": opportunity_id,
                "clientId": client_id(row_value(row, "Cliente")),
                "opportunity": opportunity_name,
                "opportunityCode": code,
                "status": row_value(row, "Status") or "Open",
                "openingDate": opening,
                "closingDate": closing,
                "monthYear": month_year(row_value(row, "Ano_Mês"), closing or opening),
                "model": row_value(row, "Modelo") or "Alocação",
                "owner": row_value(row, "Responsável"),
                "quantity": integerish(row_value(row, "Qtde Vagas"), 0),
                "closedQuantity": integerish(row_value(row, "Qtde Fechada"), 0),
                "contractValue": number(row_value(row, "Valor Ano"), 0),
                "observation": row_value(row, "Observação"),
                "createdAt": iso_now(),
            }
        )

    candidates = []
    for index, row in candidates_df.iterrows():
        opportunity_code = row_value(row, "Id_Oportunidade")
        opportunity_name = row_value(row, "Oportunidade")
        opportunity_id = opportunity_id_by_code.get(opportunity_code) or opportunity_id_by_name.get(key(opportunity_name))
        if not opportunity_id:
            opportunity_id = f"opp_missing_{slug(opportunity_name)}"
            opportunity_id_by_name[key(opportunity_name)] = opportunity_id
            opportunities.append(
                {
                    "id": opportunity_id,
                    "clientId": guess_client_id(opportunity_name),
                    "opportunity": opportunity_name,
                    "opportunityCode": "",
                    "status": "Open",
                    "openingDate": "",
                    "closingDate": "",
                    "monthYear": "",
                    "model": "Alocação",
                    "owner": "",
                    "quantity": 0,
                    "closedQuantity": 0,
                    "contractValue": 0,
                    "observation": "Criada automaticamente porque havia candidato vinculado sem registro na aba Oportunidades.",
                    "createdAt": iso_now(),
                }
            )
        approved = boolean(row_value(row, "aprovado"))
        stage = "Aprovado" if approved else "Triagem"
        timestamp = iso_now()
        candidates.append(
            {
                "id": f"cand_{index + 1:04d}_{slug(row_value(row, 'Consultor'))}",
                "name": row_value(row, "Consultor"),
                "curriculumId": "",
                "opportunityId": opportunity_id,
                "hourlyRate": number(row_value(row, "Valor Hora"), 0),
                "observation": row_value(row, "Observação"),
                "approved": approved,
                "stage": stage,
                "aderencia": 50,
                "source": "migração.xlsx",
                "notes": "",
                "status": stage if approved else "Em andamento",
                "stageEnteredAt": timestamp,
                "createdAt": timestamp,
                "stageHistory": [
                    {
                        "stage": stage,
                        "enteredAt": timestamp,
                        "leftAt": "",
                    }
                ],
            }
        )

    allocateds = []
    for index, row in allocateds_df.iterrows():
        code = row_value(row, "codigo") or str(index + 1)
        allocateds.append(
            {
                "id": f"alloc_{slug(code)}",
                "externalId": row_value(row, "Id"),
                "code": code,
                "consultant": row_value(row, "consultor"),
                "skill": row_value(row, "skill"),
                "clientId": client_id(row_value(row, "cliente")),
                "hourlyRate": number(row_value(row, "valor hora"), 0),
                "phone": row_value(row, "phone"),
                "consultantEmail": row_value(row, "email"),
                "startDate": date_only(row_value(row, "inicio")),
                "active": boolean(row_value(row, "ativo")),
                "endDate": date_only(row_value(row, "termino")),
                "manager": row_value(row, "gestor"),
                "managerEmail": row_value(row, "email.1"),
                "managerPhone": row_value(row, "phone.1"),
                "createdAt": iso_now(),
            }
        )

    db["clients"] = clients
    db["opportunities"] = opportunities
    db["candidates"] = candidates
    db["allocateds"] = allocateds
    DATABASE.write_text(json.dumps(db, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "clients": len(db["clients"]),
                "opportunities": len(opportunities),
                "candidates": len(candidates),
                "allocateds": len(allocateds),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
