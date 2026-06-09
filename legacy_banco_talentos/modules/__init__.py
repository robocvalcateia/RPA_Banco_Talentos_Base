"""Módulos de processamento"""
from .email_reader import process_emails
from .whatsapp_reader import process_whatsapp_messages
from .gemini_extractor import extract_cv_data
from .deduplication import process_candidate_data
from .mongodb_handler import get_mongodb_handler

__all__ = [
    'process_emails',
    'process_whatsapp_messages',
    'extract_cv_data',
    'process_candidate_data',
    'get_mongodb_handler'
]
