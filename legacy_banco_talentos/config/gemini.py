"""
Configurao da Gemini API
"""
from dotenv import load_dotenv
import os

load_dotenv()
from google import genai
import logging


logger = logging.getLogger(__name__)

class GeminiConfig:
    """Gerencia a configurao da Gemini API"""
    
    _instance = None
    _client = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GeminiConfig, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Inicializa a configurao da Gemini"""
        if self._client is None:
            self.setup()
    
    def setup(self):
        """Configura o cliente da Gemini API"""
        try:
            api_key = os.getenv('GEMINI_API_KEY')
            
            if not api_key:
                raise ValueError("GEMINI_API_KEY no configurada no arquivo .env")
            
            self._client = genai.Client(api_key=api_key)
            logger.info(" Gemini API configurada com sucesso")
            
        except Exception as e:
            logger.error(f" Erro ao configurar Gemini API: {e}")
            raise
    
    def get_client(self):
        """Retorna o cliente da Gemini API"""
        if self._client is None:
            self.setup()
        return self._client
    
    def get_model(self):
        """Retorna o modelo configurado"""
        return os.getenv('GEMINI_MODEL', 'gemini-2.5-flash-lite')


def get_gemini():
    """Funo auxiliar para obter a instncia do Gemini"""
    return GeminiConfig()
