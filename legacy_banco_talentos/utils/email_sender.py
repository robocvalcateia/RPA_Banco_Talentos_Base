import requests
from config.mongodb import get_candidate_collection_name
from config.microsoft_graph import get_microsoft_graph
from utils.environment import is_production_environment

PROCESSING_LOG_ALLOWED_RECIPIENTS = (
    "gerson@alcateiaconsulting.com.br",
    "bruno@alcateiaconsulting.com.br",
)


def build_processing_log_recipients():
    return list(PROCESSING_LOG_ALLOWED_RECIPIENTS)


def montar_html_erros(stats):
    erros_por_tipo = stats.get("erros_por_tipo", {})
    detalhes_erros = stats.get("detalhes_erros", [])

    if not detalhes_erros:
        return """
        <h3>Rastreabilidade de Erros</h3>
        <p>Nenhum erro identificado na execução.</p>
        """

    resumo_tipos = ""

    for tipo, quantidade in erros_por_tipo.items():
        resumo_tipos += f"<li><strong>{tipo}</strong>: {quantidade}</li>"

    linhas = ""

    for erro in detalhes_erros:
        linhas += f"""
        <tr>
            <td>{erro.get('data_hora', '')}</td>
            <td>{erro.get('tipo', '')}</td>
            <td>{erro.get('arquivo', '')}</td>
            <td>{erro.get('assunto_email', '')}</td>
            <td>{erro.get('mensagem', '')}</td>
            <td>{erro.get('acao', '')}</td>
        </tr>
        """

    return f"""
    <h3>Rastreabilidade de Erros</h3>

    <p><strong>Total de erros:</strong> {stats.get('erros', 0)}</p>

    <h4>Resumo por tipo</h4>
    <ul>
        {resumo_tipos}
    </ul>

    <h4>Detalhamento</h4>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
        <thead>
            <tr>
                <th>Data/Hora</th>
                <th>Tipo do erro</th>
                <th>Arquivo</th>
                <th>Assunto do e-mail</th>
                <th>Motivo</th>
                <th>Ação tomada</th>
            </tr>
        </thead>
        <tbody>
            {linhas}
        </tbody>
    </table>
    """


def enviar_email_resumo_graph(stats, total_candidatos):
    if not is_production_environment():
        print("Resumo de processamento nao enviado: ambiente nao produtivo.")
        return False

    graph_config = get_microsoft_graph()
    headers = graph_config.get_headers()
    email_from = graph_config.get_email()
    collection_name = stats.get("collection") or get_candidate_collection_name()

    url = f"https://graph.microsoft.com/v1.0/users/{email_from}/sendMail"

    html_erros = montar_html_erros(stats)
    corpo_html = f"""
    <h2>Resumo do Processamento</h2>

    <p><strong>Ambiente:</strong> PROD</p>

    <ul>
        <li>E-mails processados: {stats.get('emails_processados', 0)}</li>
        <li>Arquivos baixados: {stats.get('arquivos_baixados', 0)}</li>
        <li>Arquivos processados: {stats.get('arquivos_processados', 0)}</li>
        <li>Novos candidatos: {stats.get('novos_candidatos', 0)}</li>
        <li>Atualizados: {stats.get('candidatos_atualizados', 0)}</li>
        <li>Sem mudanças: {stats.get('sem_mudancas', 0)}</li>
        <li>Erros: {stats.get('erros', 0)}</li>
    </ul>

    <hr>

    {html_erros}

    <hr>

    <h3>Total geral de candidatos na base: {total_candidatos}</h3>
    <p><strong>Collection contabilizada:</strong> {collection_name}</p>
    """
    to_recipients = [
        {"emailAddress": {"address": email}}
        for email in build_processing_log_recipients()
    ]
    payload = {
        "message": {
            "subject": "Relatório Diário PROD - Banco de Talentos",
            "body": {
                "contentType": "HTML",
                "content": corpo_html
            },
            "toRecipients": to_recipients
        }
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code != 202:
        raise Exception(f"Erro ao enviar email: {response.text}")

    return True
