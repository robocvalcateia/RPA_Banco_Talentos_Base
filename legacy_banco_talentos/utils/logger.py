"""
Sistema de logging centralizado
"""
import logging
import os
from datetime import datetime

from utils.config import *

class LoggerSetup:
    """Configura o sistema de logging"""
    
    @staticmethod
    def setup():
        """Configura o logging para toda a aplicação"""

        
        # Criar pasta de logs se não existir
        os.makedirs(LOG_FOLDER, exist_ok=True)
        
        # Arquivo de log com data
        log_file = os.path.join(LOG_FOLDER, f"banco_talentos_{datetime.now().strftime('%Y%m%d')}.log")
        
        # Configurar logging
        logging.basicConfig(
            level=logging.INFO,
            format='[%(asctime)s] %(levelname)s - %(name)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        
        
        logger = logging.getLogger(__name__)
        logger.info("=" * 80)
        logger.info("INICIANDO BANCO DE TALENTOS")
        logger.info("=" * 80)
        
        return logger


def get_logger(name):
    """Obtém um logger para um módulo específico"""
    return logging.getLogger(name)
