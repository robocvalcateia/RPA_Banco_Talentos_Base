"""
Configurao e conexo com MongoDB
"""
import os
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure
import logging
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)

def get_candidate_collection_name():
    """Retorna a collection ativa do Banco de Talentos."""
    return (
        os.getenv('MONGODB_CURRICULUM_COLLECTION')
        or os.getenv('MONGODB_COLLECTION')
        or 'curriculums'
    )

class MongoDBConfig:
    """Gerencia a conexo com MongoDB"""
    
    _instance = None
    _client = None
    _db = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBConfig, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Inicializa a configurao do MongoDB"""
        if self._client is None:
            self.connect()
    
    def connect(self):
        """Conecta ao MongoDB"""
        try:
            url = os.getenv('MONGODB_URL')
            db_name = os.getenv('MONGODB_DB', 'Banco_de_Talentos')
            
            if not url:
                raise ValueError("MONGODB_URL no configurada no arquivo .env")
            
            self._client = MongoClient(url, serverSelectionTimeoutMS=5000)
            
            # Testa a conexo
            self._client.admin.command('ping')
            
            self._db = self._client[db_name]
            logger.info(f" Conectado ao MongoDB: {db_name}")
            
            # Criar Indices
            self._create_indexes()
            
        except (ServerSelectionTimeoutError, ConnectionFailure) as e:
            logger.error(f" Erro ao conectar ao MongoDB: {e}")
            raise
        except Exception as e:
            logger.error(f" Erro inesperado: {e}")
            raise
    
    def _create_indexes(self):
        """Cria Indices na coleo de candidatos"""
        try:
            collection = self._db[get_candidate_collection_name()]
            
            # ndice nico para email
            # Remover índice antigo de email, se existir
            try:
                collection.drop_index("email_1")
            except Exception:
                pass

            # Índice único apenas para e-mails preenchidos
            collection.create_index(
                "email",
                unique=True,
                sparse=True
            )
            
            # ndice nico para hash do documento
            collection.create_index('hash_documento', unique=True, sparse=True)
            
            # Indices para busca
            collection.create_index('nome')
            collection.create_index('telefone')
            collection.create_index('skills')
            collection.create_index('data_criacao')
            collection.create_index('data_atualizacao')
            collection.create_index('id_controle', unique=True, sparse=True)

            logger.info("Indices criados/verificados no MongoDB")
            
        except Exception as e:
            logger.warning(f" Erro ao criar Indices: {e}")
    
    def get_db(self):
        """Retorna a instncia do banco de dados"""
        if self._db is None:
            self.connect()
        return self._db
    
    def get_collection(self, collection_name=None):
        """Retorna uma coleo especfica"""
        return self.get_db()[collection_name or get_candidate_collection_name()]
    
    def close(self):
        """Fecha a conexo com MongoDB"""
        if self._client:
            self._client.close()
            logger.info(" Conexo com MongoDB fechada")
    
    def close(self):
        try:
            if self._client:
                self._client.close()
                self._client = None
                self._db = None
                logger.info(" Conexão com MongoDB fechada")
        except Exception:
            pass


def get_mongodb():
    """Funo auxiliar para obter a instncia do MongoDB"""
    return MongoDBConfig()
