from pathlib import Path
import sys
import re

# Permite importar os módulos do projeto
sys.path.append(str(Path(__file__).resolve().parents[1]))

from config.mongodb import get_mongodb


COUNTER_ID = "candidatos_id_controle"


def extrair_numero_id_controle(valor):
    if not valor:
        return 0

    valor = str(valor).strip()

    if re.fullmatch(r"\d+", valor):
        return int(valor)

    return 0


def main():
    db = get_mongodb().get_db()
    candidatos = db["candidatos"]
    contadores = db["contadores"]

    print("Iniciando geração dos IDs de controle...")

    # Verifica o maior ID já existente, caso o script seja executado mais de uma vez
    maior_id_atual = 0

    for doc in candidatos.find(
        {"id_controle": {"$exists": True}},
        {"id_controle": 1}
    ):
        maior_id_atual = max(
            maior_id_atual,
            extrair_numero_id_controle(doc.get("id_controle"))
        )

    sequencial = maior_id_atual

    # Busca somente candidatos ainda sem ID de controle
    cursor = candidatos.find(
        {
            "$or": [
                {"id_controle": {"$exists": False}},
                {"id_controle": None},
                {"id_controle": ""}
            ]
        }
    ).sort([
        ("data_criacao", 1),
        ("_id", 1)
    ])

    total_atualizados = 0

    for candidato in cursor:
        sequencial += 1
        novo_id = f"{sequencial:02d}"

        resultado = candidatos.update_one(
            {
                "_id": candidato["_id"],
                "$or": [
                    {"id_controle": {"$exists": False}},
                    {"id_controle": None},
                    {"id_controle": ""}
                ]
            },
            {
                "$set": {
                    "id_controle": novo_id
                }
            }
        )

        if resultado.modified_count > 0:
            total_atualizados += 1
            print(f"{novo_id} - {candidato.get('nome', 'Sem nome')}")

    # Atualiza o contador para os próximos registros
    contadores.update_one(
        {"_id": COUNTER_ID},
        {"$max": {"seq": sequencial}},
        upsert=True
    )

    print("=" * 60)
    print(f"Total de candidatos atualizados: {total_atualizados}")
    print(f"Último ID de controle: {sequencial:02d}")
    print("Finalizado.")


if __name__ == "__main__":
    main()