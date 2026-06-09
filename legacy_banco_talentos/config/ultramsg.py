"""
Configurao do Ultramsg para leitura de mensagens WhatsApp
"""
import os
import logging

logger = logging.getLogger(__name__)

from dotenv import load_dotenv
import os

load_dotenv()
class UltramsgConfig:
    """Gerencia a configurao do Ultramsg"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(UltramsgConfig, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Inicializa a configurao do Ultramsg"""
        self.validate()
    
    def validate(self):
        """Valida as configuraes do Ultramsg"""
        try:
            token = os.getenv('ULTRAMSG_TOKEN')
            instance_id = os.getenv('ULTRAMSG_INSTANCE_ID')
            
            if not token or not instance_id:
                logger.warning(" Credenciais do Ultramsg no configuradas. WhatsApp ser desabilitado.")
                self.enabled = False
            else:
                self.enabled = True
                logger.info(" Ultramsg configurado com sucesso")
                
        except Exception as e:
            logger.error(f" Erro ao validar Ultramsg: {e}")
            self.enabled = False
    
    def get_token(self):
        """Retorna o token do Ultramsg"""
        return os.getenv('ULTRAMSG_TOKEN')
    
    def get_instance_id(self):
        """Retorna o ID da instncia"""
        return os.getenv('ULTRAMSG_INSTANCE_ID')
    
    def get_base_url(self):
        """Retorna a URL base da API"""
        return "https://api.ultramsg.com"
    
    def is_enabled(self):
        """Verifica se o Ultramsg est habilitado"""
        return self.enabled


def get_ultramsg():
    """Funo auxiliar para obter a instncia do Ultramsg"""
    return UltramsgConfig()
