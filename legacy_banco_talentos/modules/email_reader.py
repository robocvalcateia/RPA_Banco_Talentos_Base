"""
Mdulo para leitura de e-mails via Microsoft Graph
"""
import requests
import os
from datetime import datetime, timedelta
import logging
import email
from email import policy
from config.microsoft_graph import get_microsoft_graph
from utils.file_handler import FileHandler
from utils.validators import Validators

logger = logging.getLogger(__name__)

from dotenv import load_dotenv
import os

load_dotenv()
EXTENSOES_VALIDAS = {'.pdf', '.doc', '.docx', '.eml'}

EXTENSOES_IGNORADAS = {
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.bmp',
    '.webp',
    '.svg'
}


def obter_extensao(filename):
    return os.path.splitext(filename or '')[1].lower() or 'sem_extensao'

class EmailReader:
    """L e-mails e baixa anexos"""
    
    def __init__(self):
        """Inicializa o leitor de e-mails"""
        self.graph_config = get_microsoft_graph()
        self.base_url = "https://graph.microsoft.com/v1.0"
        self.email = self.graph_config.get_email()
        self.dias_atras = int(os.getenv('DIAS_ATRAS', 730))
        self.subject_filter = os.getenv('EMAIL_SUBJECT_FILTER', '').strip().lower()
        self.max_messages = max(0, int(os.getenv('EMAIL_MAX_MESSAGES', '0') or 0))
        self.folder_names = [
            folder.strip()
            for folder in os.getenv('EMAIL_FOLDERS', 'inbox').split(',')
            if folder.strip()
        ]

    def _get_folder_page(self, url, headers, params=None):
        folders = []
        request_params = params

        while url:
            response = requests.get(url, headers=headers, params=request_params)
            response.raise_for_status()
            payload = response.json()
            folders.extend(payload.get("value", []))
            url = payload.get('@odata.nextLink')
            request_params = None

        return folders

    def _get_child_folders(self, folder_id, headers):
        url = f"{self.base_url}/users/{self.email}/mailFolders/{folder_id}/childFolders"
        return self._get_folder_page(url, headers, params={'$top': 999})

    def _get_folder_id(self, folder_name):
        """Resolve o ID de uma pasta pelo displayName, inclusive subpastas."""
        normalized_folder_name = folder_name.strip().lower()
        if normalized_folder_name == 'inbox':
            return 'inbox'

        headers = self.graph_config.get_headers()
        folders_url = f"{self.base_url}/users/{self.email}/mailFolders"
        folders = self._get_folder_page(folders_url, headers, params={'$top': 999})
        queue = [(folder, folder.get("displayName", "")) for folder in folders]
        visited = set()
        available_paths = []

        while queue:
            folder, folder_path = queue.pop(0)
            folder_path = folder_path.strip()
            folder_id = folder.get("id")
            if not folder_id or folder_id in visited:
                continue
            visited.add(folder_id)
            available_paths.append(folder_path)

            display_name = folder.get("displayName", "").strip()
            if display_name.lower() == normalized_folder_name or folder_path.lower() == normalized_folder_name:
                logger.info(f" Pasta encontrada para leitura: {folder_path}")
                return folder_id

            for child in self._get_child_folders(folder_id, headers):
                child_path = f"{folder_path}/{child.get('displayName', '').strip()}"
                queue.append((child, child_path))

        logger.warning(f"Pasta nao encontrada para leitura: {folder_name}")
        if available_paths:
            logger.warning("Pastas disponiveis: " + " | ".join(available_paths[:120]))
        return None

    def _matches_subject_filter(self, email_item):
        if not self.subject_filter:
            return True

        subject = str(email_item.get('subject') or '').lower()
        sender = email_item.get('from', {}).get('emailAddress', {})
        sender_text = f"{sender.get('name', '')} {sender.get('address', '')}".lower()
        return self.subject_filter in subject or self.subject_filter in sender_text
    
    def get_emails(self):
        """Obtm lista de e-mails dos ltimos 2 anos"""
        try:
            logger.info(" Iniciando leitura de e-mails...")
            
            # Calcular data limite
            date_limit = datetime.now() - timedelta(days=self.dias_atras)
            date_filter = date_limit.strftime('%Y-%m-%dT%H:%M:%SZ')
            
            headers = self.graph_config.get_headers()
            params = {
                '$filter': f"receivedDateTime ge {date_filter}",
                '$select': 'id,subject,from,receivedDateTime,hasAttachments,parentFolderId',
                '$top': 999
            }

            emails = []

            for folder_name in self.folder_names:
                folder_id = self._get_folder_id(folder_name)
                if not folder_id:
                    continue

                url = f"{self.base_url}/users/{self.email}/mailFolders/{folder_id}/messages"
                folder_emails = []
                request_params = dict(params)

                while url:
                    response = requests.get(url, headers=headers, params=request_params)
                    response.raise_for_status()
                    payload = response.json()
                    folder_emails.extend(payload.get('value', []))
                    url = payload.get('@odata.nextLink')
                    request_params = None

                logger.info(f" {len(folder_emails)} e-mails encontrados em {folder_name}")
                emails.extend(folder_emails)

            if self.subject_filter:
                before = len(emails)
                emails = [item for item in emails if self._matches_subject_filter(item)]
                logger.info(
                    f" {len(emails)} de {before} e-mails mantidos pelo filtro: {self.subject_filter}"
                )

            if self.max_messages and len(emails) > self.max_messages:
                logger.info(f" Limitando leitura a {self.max_messages} e-mails neste lote")
                emails = emails[:self.max_messages]

            logger.info(f" {len(emails)} e-mails encontrados no total")
            
            return emails
            
        except Exception as e:
            logger.error(f" Erro ao obter e-mails: {e}")
            return []
    
    def get_email_attachments(self, email_id):
        """Obtm anexos de um e-mail especfico"""
        try:
            url = f"{self.base_url}/users/{self.email}/messages/{email_id}/attachments"
            headers = self.graph_config.get_headers()
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            attachments = response.json().get('value', [])
            return attachments
            
        except Exception as e:
            logger.error(f" Erro ao obter anexos do e-mail {email_id}: {e}")
            return []

    def _extract_attachments_from_item(self, email_id, attachment_id, subject, received_date):
        try:
            url = f"{self.base_url}/users/{self.email}/messages/{email_id}/attachments/{attachment_id}?$expand=microsoft.graph.itemAttachment/item"
            headers = self.graph_config.get_headers()

            response = requests.get(url, headers=headers)
            response.raise_for_status()

            item = response.json().get('item', {})
            attachments = item.get('attachments', [])

            extracted_files = []

            for att in attachments:
                att_type = att.get('@odata.type', '')
                filename = att.get('name', '')

                if '#microsoft.graph.fileAttachment' in att_type:
                    extensao = obter_extensao(filename)

                    if extensao in EXTENSOES_IGNORADAS:
                        logger.info(
                            f"[anexo_interno_ignorado] Ignorando imagem/assinatura em itemAttachment: "
                            f"{filename} | Extensão: {extensao} | Assunto: {subject}"
                        )
                        continue

                    if extensao not in EXTENSOES_VALIDAS:
                        extracted_files.append({
                            'path': None,
                            'filename': filename,
                            'source': 'email',
                            'email_id': email_id,
                            'email_subject': f"{subject} (ITEM)",
                            'email_date': received_date,
                            'status': 'extensao_fora_padrao',
                            'tipo_erro': 'extensao_fora_padrao',
                            'motivo': (
                                f"Anexo interno ignorado porque possui extensão fora do padrão: {extensao}. "
                                f"Extensões permitidas: .pdf, .doc, .docx, .eml"
                            )
                        })
                        continue

                    import base64
                    content = base64.b64decode(att.get('contentBytes', ''))

                    file_path = FileHandler.save_file(content, filename, subfolder='email_item')

                    if extensao == ".eml":
                        arquivos_eml = self._extract_attachments_from_eml(
                            file_path,
                            email_id,
                            subject,
                            received_date
                        )

                        if arquivos_eml:
                            extracted_files.extend(arquivos_eml)
                        else:
                            extracted_files.append({
                                'path': None,
                                'filename': filename,
                                'source': 'email',
                                'email_id': email_id,
                                'email_subject': f"{subject} (ITEM/EML)",
                                'email_date': received_date,
                                'status': 'eml_sem_anexo_valido',
                                'tipo_erro': 'eml_sem_anexo_valido',
                                'motivo': (
                                    f"O arquivo EML interno {filename} foi aberto, "
                                    f"mas não possui anexo válido de currículo."
                                )
                            })

                        continue

                    extracted_files.append({
                        'path': file_path,
                        'filename': filename,
                        'source': 'email',
                        'email_id': email_id,
                        'email_subject': f"{subject} (ITEM)",
                        'email_date': received_date
                    })

            return extracted_files

        except Exception as e:
            logger.error(f"Erro ao extrair itemAttachment: {e}")
            return []

    def download_attachment(self, email_id, attachment_id, filename):
        """Baixa um anexo especfico"""
        try:
            url = f"{self.base_url}/users/{self.email}/messages/{email_id}/attachments/{attachment_id}"
            headers = self.graph_config.get_headers()
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            
            attachment_data = response.json()
            
            # Verificar se  um arquivo com contedo
            if '@odata.type' in attachment_data and '#microsoft.graph.fileAttachment' in attachment_data['@odata.type']:
                # Decodificar o contedo base64
                import base64
                content = base64.b64decode(attachment_data.get('contentBytes', ''))
                
                # Salvar arquivo
                file_path = FileHandler.save_file(content, filename, subfolder='email')
                logger.info(f" Anexo baixado: {filename}")
                return file_path
            
            return None
            
        except Exception as e:
            logger.error(f" Erro ao baixar anexo {attachment_id}: {e}")
            return None
    
    def process_emails(self):
        """Processa todos os e-mails e baixa anexos vlidos"""
        try:
            emails = self.get_emails()
            downloaded_files = []
            
            for email in emails:
                email_id = email.get('id')
                subject = email.get('subject', 'Sem assunto')
                has_attachments = email.get('hasAttachments', False)
                received_date = email.get('receivedDateTime')
                
                # Validar data
                if not Validators.is_within_date_range(received_date, self.dias_atras):
                    continue
                
                if has_attachments:
                    logger.info(f" Processando e-mail: {subject}")
                    
                    attachments = self.get_email_attachments(email_id)
                    
                    for attachment in attachments:
                        filename = attachment.get('name', 'arquivo')
                        attachment_id = attachment.get('id')
                        attachment_type = attachment.get('@odata.type', '')

                        # Sempre resetar para não herdar arquivo anterior
                        file_path = None

                        if '#microsoft.graph.itemAttachment' in attachment_type:
                            arquivos_item = self._extract_attachments_from_item(
                                email_id,
                                attachment_id,
                                subject,
                                received_date
                            )

                            downloaded_files.extend(arquivos_item)
                            continue

                        extensao = obter_extensao(filename)

                        if extensao in EXTENSOES_IGNORADAS:
                            logger.info(
                                f"[anexo_ignorado] Ignorando anexo de imagem/assinatura: "
                                f"{filename} | Extensão: {extensao} | Assunto: {subject}"
                            )
                            continue

                        if extensao not in EXTENSOES_VALIDAS:
                            downloaded_files.append({
                                'path': None,
                                'filename': filename,
                                'source': 'email',
                                'email_id': email_id,
                                'email_subject': subject,
                                'email_date': received_date,
                                'status': 'extensao_fora_padrao',
                                'tipo_erro': 'extensao_fora_padrao',
                                'motivo': (
                                    f"Anexo ignorado porque possui extensão fora do padrão: {extensao}. "
                                    f"Extensões permitidas: .pdf, .doc, .docx, .eml"
                                )
                            })
                            continue

                        file_path = self.download_attachment(email_id, attachment_id, filename)

                        if not file_path:
                            downloaded_files.append({
                                'path': None,
                                'filename': filename,
                                'source': 'email',
                                'email_id': email_id,
                                'email_subject': subject,
                                'email_date': received_date,
                                'status': 'falha_download_anexo',
                                'tipo_erro': 'falha_download_anexo',
                                'motivo': f"Falha ao baixar o anexo {filename} via Microsoft Graph."
                            })
                            continue

                        extensao = os.path.splitext(filename)[1].lower()

                        if extensao == ".eml":
                            arquivos_eml = self._extract_attachments_from_eml(
                                file_path,
                                email_id,
                                subject,
                                received_date
                            )

                            if arquivos_eml:
                                downloaded_files.extend(arquivos_eml)
                            else:
                                downloaded_files.append({
                                    'path': None,
                                    'filename': filename,
                                    'source': 'email',
                                    'email_id': email_id,
                                    'email_subject': subject,
                                    'email_date': received_date,
                                    'status': 'eml_sem_anexo_valido',
                                    'tipo_erro': 'eml_sem_anexo_valido',
                                    'motivo': (
                                        f"O arquivo EML {filename} foi aberto, "
                                        f"mas não possui anexo interno válido. "
                                        f"Extensões internas permitidas: .pdf, .doc, .docx"
                                    )
                                })

                            continue

                        downloaded_files.append({
                            'path': file_path,
                            'filename': filename,
                            'source': 'email',
                            'email_id': email_id,
                            'email_subject': subject,
                            'email_date': received_date
                        })
                else:
                    downloaded_files.append({
                        'path': None,
                        'filename': '',
                        'source': 'email',
                        'email_id': email_id,
                        'email_subject': subject,
                        'email_date': received_date,
                        'status': 'sem_anexo',
                        'tipo_erro': 'email_sem_anexo',
                        'motivo': 'E-mail não possui anexos.'
                    })
            
            logger.info(f" Total de arquivos baixados do e-mail: {len(downloaded_files)}")
            return downloaded_files
            
        except Exception as e:
            logger.error(f" Erro ao processar e-mails: {e}")
            return []
    
    @staticmethod
    def _is_valid_file_extension(filename):
        """Verifica se o arquivo tem extensão válida para processamento."""
        file_ext = obter_extensao(filename)
        return file_ext in EXTENSOES_VALIDAS

    def _extract_attachments_from_eml(self, eml_path, parent_email_id, subject, received_date):
        extracted_files = []

        with open(eml_path, 'rb') as f:
            msg = email.message_from_binary_file(f, policy=policy.default)

        for part in msg.iter_attachments():
            filename = part.get_filename()

            if not filename:
                continue

            ext = os.path.splitext(filename)[1].lower()

            if ext in ['.pdf', '.doc', '.docx']:
                content = part.get_payload(decode=True)

                file_path = FileHandler.save_file(content, filename, subfolder='email_eml')

                extracted_files.append({
                    'path': file_path,
                    'filename': filename,
                    'source': 'email',
                    'email_id': parent_email_id,
                    'email_subject': f"{subject} (EML)",
                    'email_date': received_date
                })

        return extracted_files

    def move_email(self, email_id, destination_folder_name):
        """Move e-mail para uma pasta específica"""
        try:
            headers = self.graph_config.get_headers()

            # buscar pasta destino
            folders_url = f"{self.base_url}/users/{self.email}/mailFolders"
            response = requests.get(folders_url, headers=headers)
            response.raise_for_status()

            folders = response.json().get("value", [])

            destination_folder = next(
                (f for f in folders if f["displayName"] == destination_folder_name),
                None
            )

            if not destination_folder:
                logger.error(f"Pasta não encontrada: {destination_folder_name}")
                return False

            move_url = f"{self.base_url}/users/{self.email}/messages/{email_id}/move"

            payload = {"destinationId": destination_folder["id"]}

            response = requests.post(move_url, headers=headers, json=payload)

            if response.status_code == 404:
                logger.warning(
                    f"E-mail não encontrado ao mover. Provavelmente já foi movido anteriormente. "
                    f"Email ID: {email_id}"
                )
                return True

            response.raise_for_status()

            logger.info(f"E-mail movido para {destination_folder_name}")
            return True

        except Exception as e:
            logger.error(f"Erro ao mover e-mail: {e}")
            return False

def process_emails():
    """Funo auxiliar para processar e-mails"""
    reader = EmailReader()
    return reader.process_emails()
