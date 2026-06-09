"""
Módulo para leitura de mensagens WhatsApp via Ultramsg
Corrigido para ler o histórico completo de conversas
"""
import requests
import os
from datetime import datetime, timedelta
import logging
from config.ultramsg import get_ultramsg
from utils.file_handler import FileHandler
from utils.validators import Validators
from dotenv import load_dotenv

logger = logging.getLogger(__name__)
load_dotenv()

class WhatsAppReader:
    """Lê mensagens WhatsApp e baixa anexos do histórico completo"""
    
    def __init__(self):
        """Inicializa o leitor de WhatsApp"""
        self.ultramsg_config = get_ultramsg()
        self.dias_atras = int(os.getenv('DIAS_ATRAS', 730))
        
        if not self.ultramsg_config.is_enabled():
            logger.warning("Ultramsg não está configurado. WhatsApp será desabilitado.")
            
    def get_chats(self):
        """Obtém a lista de todos os chats (conversas)"""
        try:
            token = self.ultramsg_config.get_token()
            instance_id = self.ultramsg_config.get_instance_id()
            base_url = self.ultramsg_config.get_base_url()
            
            url = f"{base_url}/{instance_id}/chats"
            params = {'token': token}
            
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            
            # A API do Ultramsg geralmente retorna a lista diretamente ou dentro de um campo
            if isinstance(data, list):
                return data
            elif isinstance(data, dict) and 'data' in data:
                return data.get('data', [])
            elif isinstance(data, dict) and 'success' in data and data.get('success'):
                return data.get('data', [])
            else:
                logger.warning(f"Formato inesperado na resposta de chats: {data}")
                return []
                
        except Exception as e:
            logger.error(f"Erro ao obter lista de chats: {e}")
            return []

    def get_chat_messages(self, chat_id, date_limit):
        """Obtém mensagens de um chat específico até a data limite"""
        try:
            token = self.ultramsg_config.get_token()
            instance_id = self.ultramsg_config.get_instance_id()
            base_url = self.ultramsg_config.get_base_url()
            
            url = f"{base_url}/{instance_id}/chats/messages"
            
            # O limite máximo da API é 1000 por requisição
            params = {
                'token': token,
                'chatId': chat_id,
                'limit': 1000
            }
            
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            messages = []
            
            if isinstance(data, list):
                messages = data
            elif isinstance(data, dict) and 'data' in data:
                messages = data.get('data', [])
            elif isinstance(data, dict) and 'success' in data and data.get('success'):
                messages = data.get('data', [])
                
            # Filtrar mensagens dentro do intervalo de data
            filtered_messages = []
            for msg in messages:
                try:
                    # O timestamp pode vir em segundos
                    timestamp = msg.get('timestamp', 0)
                    if timestamp:
                        msg_date = datetime.fromtimestamp(timestamp)
                        if msg_date >= date_limit:
                            filtered_messages.append(msg)
                except Exception as e:
                    logger.debug(f"Erro ao processar data da mensagem: {e}")
                    continue
                    
            return filtered_messages
            
        except Exception as e:
            logger.error(f"Erro ao obter mensagens do chat {chat_id}: {e}")
            return []
    
    def get_all_messages(self):
        """Obtém todas as mensagens de todos os chats nos últimos X dias"""
        if not self.ultramsg_config.is_enabled():
            logger.warning("Ultramsg não habilitado")
            return []
            
        logger.info("Iniciando leitura do histórico completo do WhatsApp...")
        
        # Calcular data limite
        date_limit = datetime.now() - timedelta(days=self.dias_atras)
        
        # 1. Obter todos os chats
        chats = self.get_chats()
        logger.info(f"Encontrados {len(chats)} chats para processar")
        
        all_messages = []
        
        # 2. Para cada chat, obter as mensagens
        for chat in chats:
            # O ID do chat pode vir em diferentes formatos dependendo da resposta da API
            chat_id = chat.get('id') if isinstance(chat, dict) else chat
            
            if not chat_id:
                continue
                
            logger.info(f"Buscando mensagens do chat: {chat_id}")
            chat_messages = self.get_chat_messages(chat_id, date_limit)
            all_messages.extend(chat_messages)
            
        logger.info(f"Total de {len(all_messages)} mensagens encontradas no período")
        return all_messages
    
    def download_media(self, media_url, filename):
        try:
            token = self.ultramsg_config.get_token()

            separator = "&" if "?" in media_url else "?"
            media_url = f"{media_url}{separator}token={token}"

            response = requests.get(media_url, timeout=60)
            response.raise_for_status()

            return FileHandler.save_file(
                response.content,
                filename,
                subfolder="whatsapp"
            )

        except Exception as e:
            logger.error(f"Erro ao baixar {filename}: {e}")
            return None
    
    def process_messages(self):
        try:
            messages = self.get_all_messages()
            downloaded_files = []

            for message in messages:
                msg_type = message.get("type", "")
                msg_id = message.get("id")
                timestamp = message.get("timestamp", 0)

                if msg_type not in ["document", "file"]:
                    continue

                filename = message.get("body", "")

                if not self._is_valid_file_extension(filename):
                    continue

                media_url = (
                    message.get("media")
                    or message.get("mediaUrl")
                    or message.get("url")
                )

                if not media_url:
                    logger.warning(f"Documento sem URL: {filename}")
                    continue

                file_path = self.download_media(media_url, filename)

                if file_path:
                    downloaded_files.append({
                        "path": file_path,
                        "filename": filename,
                        "source": "whatsapp",
                        "message_id": msg_id,
                        "message_date": datetime.fromtimestamp(timestamp).isoformat()
                    })

            return downloaded_files

        except Exception as e:
            logger.error(f"Erro: {e}")
            return []
    
    @staticmethod
    def _is_valid_file_extension(filename):
        """Verifica se o arquivo tem extensão válida"""
        if not filename:
            return False
        valid_extensions = ['.pdf', '.doc', '.docx']
        file_ext = os.path.splitext(filename)[1].lower()
        return file_ext in valid_extensions

def process_whatsapp_messages():
    """Função auxiliar para processar mensagens WhatsApp"""
    reader = WhatsAppReader()
    return reader.process_messages()