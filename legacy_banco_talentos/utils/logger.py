"""
Sistema de logging centralizado.
"""
import logging
import os
from datetime import datetime

from utils.config import LOG_FOLDER
from utils.environment import is_production_environment


class LoggerSetup:
    """Configura o sistema de logging."""

    @staticmethod
    def setup():
        """Configura o logging para toda a aplicacao."""
        handlers = [logging.StreamHandler()]

        if is_production_environment():
            os.makedirs(LOG_FOLDER, exist_ok=True)
            log_file = os.path.join(LOG_FOLDER, f"banco_talentos_{datetime.now().strftime('%Y%m%d')}.log")
            handlers.insert(0, logging.FileHandler(log_file))

        logging.basicConfig(
            level=logging.INFO,
            format='[%(asctime)s] %(levelname)s - %(name)s - %(message)s',
            handlers=handlers
        )

        logger = logging.getLogger(__name__)
        logger.info("=" * 80)
        logger.info("INICIANDO BANCO DE TALENTOS")
        logger.info("=" * 80)

        return logger


def get_logger(name):
    """Obtem um logger para um modulo especifico."""
    return logging.getLogger(name)
