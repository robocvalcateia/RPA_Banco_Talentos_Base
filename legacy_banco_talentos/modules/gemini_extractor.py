"""
Módulo para extração de dados de CVs usando Gemini API
"""
import re
import json
import time
import logging
from google.genai import types
from config.gemini import get_gemini
from utils.file_handler import FileHandler

logger = logging.getLogger(__name__)

class GeminiExtractor:
    """Extrai dados de CVs usando Gemini API"""
    
    PROMPT_TEMPLATE = """Extraia os dados de um currículo a partir do documento fornecido.

RETORNE APENAS UM JSON VÁLIDO, SEM TEXTO ADICIONAL, SEM EXPLICAÇÕES, SEM MARKDOWN.

O JSON DEVE CONTER EXATAMENTE AS SEGUINTES CHAVES (todas obrigatórias):
- Nome
- Nacionalidade
- Estado Civil
- Idade
- Endereco
- Telefone
- Email
- Link_Linkedin
- Skil
- Formacao_Academica
- Nivel_Idioma_Ingles
- Nivel_Idioma_Espanhol
- Cursos_Certificacoes
- Conhecimento_Tecnico
- Experiencia_Profissional

REGRAS IMPORTANTES:

1. O retorno deve ser um objeto JSON (dict), nunca lista.
2. Todas as chaves devem existir, mesmo que vazias.
3. Se não encontrar um valor, retornar "" (string vazia).
4. Cada chave deve conter apenas um valor do tipo string.
5. Não incluir listas, objetos aninhados ou múltiplos valores.
6. Não incluir quebras de linha no JSON.
7. Não incluir ```json ou ```.

CRITÉRIOS DE EXTRAÇÃO:

Nome:
- Nome completo do candidato
- Localizado no topo do currículo

Nacionalidade:
- Nacionalidade do Canditado, caso não tenha nada considerar Brasileiro

Estado_Civil:
- Estado Civil do Canditado, caso não tenha nada considerar vazio

Idade:
- Caso não exista, calcular a partir da data de nascimento

Endereco:
- Cidade, estado ou endereço completo

Telefone:
- Numero de Telefone no formato ddd-xxxxx-xxxx

Email:
- Email
- Caso não exista, deixar em branco

Link_Linkedin:
- Capturar somente o link do perfil LinkedIn do candidato.
- Considerar links nos formatos:
  - https://www.linkedin.com/in/nome-do-perfil
  - http://www.linkedin.com/in/nome-do-perfil
  - www.linkedin.com/in/nome-do-perfil
  - linkedin.com/in/nome-do-perfil
  - /in/nome-do-perfil
- Se encontrar apenas "/in/nome-do-perfil", completar como:
  https://www.linkedin.com/in/nome-do-perfil
- Se encontrar "linkedin.com/in/nome-do-perfil", completar como:
  https://www.linkedin.com/in/nome-do-perfil
- Retornar sempre uma URL completa iniciando com "https://".
- Não retornar texto adicional, emojis ou descrição.
- Se não encontrar um perfil LinkedIn válido, retornar "".

Skil:
- Resumo das qualificações profissionais

Formacao_Academica:
- Listar cada formação separada por " | "
- Formato: Curso - Instituição (Período ou Ano)
- Se houver apenas uma formação, retornar apenas ela
- Não usar listas JSON

Nivel_Idioma_Ingles:
- Nivel_Idioma_Ingles
- Caso não exista, deixar em branco

Nivel_Idioma_Espanhol:
- Nivel_Idioma_Espanhol
- Caso não exista, deixar em branco

Cursos_Certificacoes:
- Listar cada curso ou certificação separada por " | "
- Formato: Nome do curso/certificação - Instituição (Ano), quando existir
- Não usar listas JSON

Conhecimento_Tecnico:
- Listar os conhecimentos técnicos agrupados por tema, separados por " | "
- Exemplo: Linguagens: Python, SQL | BI: Power BI, Tableau | Cloud: AWS, Azure
- Não usar listas JSON

Experiencia_Profissional:
- Listar cada experiência separada por " | "
- Formato obrigatório:
  Empresa - Cargo (Período)
- Exemplo:
  Algar - Analista de Negócios TI e Telecom (2025) | Reply - Analista de Negócios TI (2020 a 2025) | Truckpad - Analista de Qualidade de Software (2019 a 2020)
- Não juntar empresas diferentes no mesmo bloco
- Não usar listas JSON

FORMATO FINAL OBRIGATÓRIO:
{{
  "Nome": "",
  "Nacionalidade": "",
  "Estado_Civil": "",
  "Idade": "",
  "Endereco": "",
  "Telefone": "",
  "Email": "",
  "Link_Linkedin": "",
  "Skil": "",
  "Formacao_Academica": "",
  "Nivel_Idioma_Ingles": "",
  "Nivel_Idioma_Espanhol": "",
  "Cursos_Certificacoes": "",
  "Conhecimento_Tecnico": "",
  "Experiencia_Profissional": ""
}}"""
    
    def __init__(self):
        """Inicializa o extrator Gemini"""
        self.gemini_config = get_gemini()
        self.client = self.gemini_config.get_client()
        self.model = self.gemini_config.get_model()
        self.last_error = None

    def _normalizar_campo_multilinha(self, valor, usar_bullet=True):
        """
        Converte textos separados por | em múltiplas linhas.
        Exemplo:
        Empresa A - Cargo | Empresa B - Cargo
        vira:
        • Empresa A - Cargo
        • Empresa B - Cargo
        """

        if not valor:
            return ""

        valor = str(valor).strip()

        if not valor:
            return ""

        # Se já vier com quebra de linha, apenas limpa espaços
        if "\n" in valor:
            linhas = [linha.strip(" -•\t") for linha in valor.splitlines() if linha.strip()]
        else:
            linhas = [parte.strip(" -•\t") for parte in re.split(r"\s*\|\s*", valor) if parte.strip()]

        if not linhas:
            return ""

        if usar_bullet:
            return "\n".join(f"• {linha}" for linha in linhas)

        return "\n".join(linhas)

    def _normalizar_linkedin(self, valor):
        """
        Normaliza o link do LinkedIn para URL completa.
        """

        if not valor:
            return ""

        valor = str(valor).strip()

        if not valor:
            return ""

        # Remove espaços internos comuns
        valor = valor.replace(" ", "")

        # Remove caracteres comuns no final
        valor = valor.rstrip(".,;|)")

        # Se vier apenas /in/perfil
        if valor.startswith("/in/"):
            return f"https://www.linkedin.com{valor}"

        # Se vier linkedin.com/in/perfil
        if valor.startswith("linkedin.com/in/"):
            return f"https://www.{valor}"

        # Se vier www.linkedin.com/in/perfil
        if valor.startswith("www.linkedin.com/in/"):
            return f"https://{valor}"

        # Se vier http://linkedin.com/in/perfil
        if valor.startswith("http://linkedin.com/in/"):
            valor = valor.replace("http://linkedin.com", "https://www.linkedin.com", 1)
            return valor

        # Se vier https://linkedin.com/in/perfil
        if valor.startswith("https://linkedin.com/in/"):
            valor = valor.replace("https://linkedin.com", "https://www.linkedin.com", 1)
            return valor

        # Se vier http://www.linkedin.com/in/perfil
        if valor.startswith("http://www.linkedin.com/in/"):
            valor = valor.replace("http://", "https://", 1)
            return valor

        # Se já estiver certo
        if valor.startswith("https://www.linkedin.com/in/"):
            return valor

        # Se não for perfil LinkedIn válido
        return ""
    def _extrair_retry_delay(self, exception, default_delay=60):
        """
        Extrai do erro Gemini o tempo sugerido em:
        'Please retry in 48.931894276s'
        """
        msg = str(exception)

        match = re.search(r"retry in ([\d.]+)s", msg, re.IGNORECASE)

        if match:
            return int(float(match.group(1))) + 2

        return default_delay

    def _set_error(self, tipo, mensagem):
        self.last_error = {
            "tipo": tipo,
            "mensagem": mensagem
        }

    def _classificar_exception(self, exception):
        msg = str(exception).lower()

        if "503" in msg or "unavailable" in msg or "high demand" in msg or "overloaded" in msg:
            return "gemini_modelo_indisponivel_alta_demanda"

        if "429" in msg or "quota" in msg or "rate limit" in msg:
            return "gemini_limite_quota"

        if "unsupported mime" in msg or "mime" in msg:
            return "gemini_mime_invalido"

        if "json" in msg or isinstance(exception, json.JSONDecodeError):
            return "gemini_json_invalido"

        if "timeout" in msg:
            return "gemini_timeout"

        if "permission" in msg or "unauthorized" in msg or "403" in msg or "401" in msg:
            return "gemini_erro_autenticacao"

        return "gemini_erro_api"

    def _normalize_json_response(self, dados):
        """Normaliza a resposta do modelo Gemini"""
        if isinstance(dados, list):
            if len(dados) == 1 and isinstance(dados[0], dict):
                return dados[0]
            else:
                return dados
        elif isinstance(dados, dict):
            return dados
        else:
            raise ValueError("Formato inesperado de dados retornados.")
    
    def extract_from_pdf(self, pdf_path, max_tentativas=10, delay_retry=10):
        """
        Extrai dados de um PDF usando Gemini
        
        Args:
            pdf_path (str): Caminho do arquivo PDF
            max_tentativas (int): Número máximo de tentativas
            delay_retry (int): Tempo entre tentativas em segundos
            
        Returns:
            dict: Dados extraídos ou None em caso de erro
        """
        
        for tentativa in range(1, max_tentativas + 1):
            try:
                logger.info(f" Processando PDF (tentativa {tentativa}/{max_tentativas}): {pdf_path}")
                
                # Fazer upload do PDF
                uploaded_file = self.client.files.upload(file=pdf_path)
                logger.info(f" PDF enviado para Gemini")
                
                # Chamar o modelo Gemini
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=[uploaded_file, self.PROMPT_TEMPLATE],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json"
                    )
                )
                
                # Parsear a resposta
                dados_brutos = response.text.strip()
                
                # Limpar bordas de markdown se existirem
                dados_limpos = dados_brutos.strip('```json').strip('```').strip()
                
                # Converter para JSON
                json_dados = json.loads(dados_limpos)
                dados = self._normalize_json_response(json_dados)
                campos_multilinha = [
                    "Formacao_Academica",
                    "Cursos_Certificacoes",
                    "Conhecimento_Tecnico",
                    "Experiencia_Profissional"]

                for campo in campos_multilinha:
                    dados[campo] = self._normalizar_campo_multilinha(dados.get(campo, ""),usar_bullet=True)

                dados["Link_Linkedin"] = self._normalizar_linkedin(dados.get("Link_Linkedin", ""))
                
                logger.info(f" Dados extraídos com sucesso")
                return dados
                
            except Exception as e:
                tipo_erro = self._classificar_exception(e)
                self._set_error(
                    tipo_erro,
                    f"Erro na tentativa {tentativa}/{max_tentativas} ao extrair PDF: {e}"
                )

                logger.error(f" Erro na tentativa {tentativa}: {e}")
                
                if tentativa < max_tentativas:
                    if tipo_erro == "gemini_limite_quota":
                        tempo_espera = self._extrair_retry_delay(e, default_delay=60)
                    elif tipo_erro == "gemini_modelo_indisponivel_alta_demanda":
                        tempo_espera = delay_retry * tentativa
                    else:
                        tempo_espera = delay_retry * tentativa

                    logger.info(
                        f" Tentando novamente em {tempo_espera}s... "
                        f"Motivo: {tipo_erro}"
                    )

                    time.sleep(tempo_espera)
                else:
                    logger.error(f" Limite de tentativas atingido para {pdf_path}")
                    return None
    
    def extract_from_file(self, file_path):
        """
        Extrai dados de um arquivo (PDF, DOC ou DOCX)
        
        Args:
            file_path (str): Caminho do arquivo
            
        Returns:
            dict: Dados extraídos ou None em caso de erro
        """
        
        try:
            # Garantir que seja PDF
            pdf_path = FileHandler.ensure_pdf(file_path)
            
            if not pdf_path:
                self._set_error(
                    "falha_conversao_pdf",
                    f"Não foi possível converter o arquivo para PDF: {file_path}"
                )
                logger.error(f" Não foi possível converter arquivo para PDF: {file_path}")
                return None
            
            # Extrair dados
            dados = self.extract_from_pdf(pdf_path)
            
            # Limpar arquivo temporário se foi convertido
            if pdf_path != file_path:
                FileHandler.delete_file(pdf_path)
            
            return dados
            
        except Exception as e:
            tipo_erro = self._classificar_exception(e)

            self._set_error(
                tipo_erro,
                f"Erro ao extrair dados do arquivo {file_path}: {e}"
            )

            logger.error(f" Erro ao extrair dados do arquivo: {e}")
            return None


def extract_cv_data_detalhado(file_path):
    """
    Extrai dados do CV retornando sucesso ou erro detalhado.
    """
    extractor = GeminiExtractor()
    dados = extractor.extract_from_file(file_path)

    if dados:
        return {
            "success": True,
            "dados": dados,
            "erro_tipo": None,
            "erro_mensagem": None
        }

    erro = extractor.last_error or {
        "tipo": "falha_extracao_sem_detalhe",
        "mensagem": "Não foi possível extrair dados do currículo."
    }

    return {
        "success": False,
        "dados": None,
        "erro_tipo": erro.get("tipo"),
        "erro_mensagem": erro.get("mensagem")
    }


def extract_cv_data(file_path):
    """
    Mantém compatibilidade com o código antigo.
    """
    resultado = extract_cv_data_detalhado(file_path)
    return resultado["dados"] if resultado["success"] else None
