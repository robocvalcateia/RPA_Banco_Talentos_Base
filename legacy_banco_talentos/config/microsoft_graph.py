"""
Configurao do Microsoft Graph para leitura de e-mails
"""
import os
from msal import ConfidentialClientApplication
import logging

logger = logging.getLogger(__name__)
from dotenv import load_dotenv
import os

load_dotenv()

class MicrosoftGraphConfig:
    """Gerencia a autenticao com Microsoft Graph"""
    
    _instance = None
    _app = None
    _token = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MicrosoftGraphConfig, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Inicializa a configurao do Microsoft Graph"""
        if self._app is None:
            self.setup()
    
    def setup(self):
        """Configura a aplicao MSAL"""
        try:
            client_id = os.getenv('GRAPH_CLIENT_ID')
            client_secret = os.getenv('GRAPH_CLIENT_SECRET')
            tenant_id = os.getenv('GRAPH_TENANT_ID')
            
            if not all([client_id, client_secret, tenant_id]):
                raise ValueError("Credenciais do Microsoft Graph no configuradas no arquivo .env")
            
            authority = f"https://login.microsoftonline.com/{tenant_id}"
            
            self._app = ConfidentialClientApplication(
                client_id,
                authority=authority,
                client_credential=client_secret,
            )
            
            logger.info(" Microsoft Graph configurado com sucesso")
            
        except Exception as e:
            logger.error(f" Erro ao configurar Microsoft Graph: {e}")
            raise
    
    def get_access_token(self):
        """Obtm um novo token de acesso"""
        try:
            if self._app is None:
                self.setup()
            
            scope = ["https://graph.microsoft.com/.default"]
            token_response = self._app.acquire_token_for_client(scopes=scope)
            
            if "access_token" in token_response:
                self._token = token_response["access_token"]
                logger.info(" Token de acesso obtido com sucesso")
                return self._token
            else:
                error = token_response.get("error_description", "Erro desconhecido")
                raise Exception(f"Erro ao obter token: {error}")
                
        except Exception as e:
            logger.error(f" Erro ao obter token de acesso: {e}")
            raise
    
    def get_headers(self):
        """Retorna os headers para requisies ao Microsoft Graph"""
        token = self.get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
    
    def get_email(self):
        """Retorna o email configurado"""
        return os.getenv('GRAPH_EMAIL', 'robocv@alcateiaconsulting.com.br')


def get_microsoft_graph():
    """Funo auxiliar para obter a instncia do Microsoft Graph"""
    return MicrosoftGraphConfig()
