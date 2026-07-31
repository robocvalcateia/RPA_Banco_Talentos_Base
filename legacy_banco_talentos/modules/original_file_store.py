"""
Armazena os arquivos originais de CV em GridFS para consulta posterior.
"""
import logging
import mimetypes
import os
from datetime import datetime

import gridfs
from bson import ObjectId

from config.mongodb import get_candidate_collection_name, get_mongodb

logger = logging.getLogger(__name__)


class OriginalFileStore:
    """Persistencia idempotente dos anexos originais processados."""

    def __init__(self):
        self.db = get_mongodb().get_db()
        self.candidate_collection_name = get_candidate_collection_name()
        self.candidate_collection = self.db[self.candidate_collection_name]
        self.bucket_name = os.getenv('MONGODB_ORIGINAL_FILES_BUCKET', 'candidate_original_files')
        self.fs = gridfs.GridFS(self.db, collection=self.bucket_name)
        self.files_collection = self.db[f'{self.bucket_name}.files']
        self._ensure_indexes()

    def _ensure_indexes(self):
        try:
            self.files_collection.create_index('metadata.document_hash', unique=True, sparse=True)
            self.files_collection.create_index('metadata.candidate_id')
            self.files_collection.create_index('metadata.email_id')
            self.files_collection.create_index('uploadDate')
        except Exception as exc:
            logger.warning(f" Nao foi possivel criar indices de arquivos originais: {exc}")

    @staticmethod
    def _to_object_id(value):
        try:
            return ObjectId(str(value))
        except Exception:
            return None

    def _link_candidate(self, candidate_id, file_id, document_hash, filename):
        object_id = self._to_object_id(candidate_id)
        if not object_id:
            logger.warning(f" ID de candidato invalido para vinculo de arquivo original: {candidate_id}")
            return False

        now = datetime.now().isoformat()
        result = self.candidate_collection.update_one(
            {'_id': object_id},
            {
                '$set': {
                    'tem_arquivo_original': True,
                    'arquivo_original_atualizado_em': now
                },
                '$addToSet': {
                    'arquivos_originais': {
                        'file_id': str(file_id),
                        'hash_documento': document_hash,
                        'filename': filename
                    }
                }
            }
        )
        if not result.matched_count:
            logger.warning(f" Candidato nao encontrado para vinculo de arquivo original: {candidate_id}")
            return False
        return True

    def save(self, file_path, file_info, candidate_result, document_hash, candidate_data):
        if not file_path or not os.path.exists(file_path):
            return {'saved': False, 'reason': 'arquivo_nao_encontrado'}
        if not document_hash:
            return {'saved': False, 'reason': 'hash_vazio'}

        candidate_id = str(candidate_result.get('id') or '').strip()
        filename = file_info.get('filename') or os.path.basename(file_path)
        now = datetime.now().isoformat()
        content_type = mimetypes.guess_type(filename)[0] or 'application/octet-stream'
        metadata = {
            'candidate_id': candidate_id,
            'candidate_name': candidate_result.get('nome') or candidate_data.get('Nome'),
            'document_hash': document_hash,
            'source': file_info.get('source'),
            'email_id': file_info.get('email_id'),
            'email_subject': file_info.get('email_subject'),
            'email_date': file_info.get('email_date'),
            'message_id': file_info.get('message_id'),
            'message_date': file_info.get('message_date'),
            'original_filename': filename,
            'stored_at': now
        }

        existing = self.files_collection.find_one({'metadata.document_hash': document_hash})
        if existing:
            file_id = existing['_id']
            self.files_collection.update_one(
                {'_id': file_id},
                {
                    '$set': {
                        'metadata.last_seen_at': now,
                        'metadata.candidate_id': candidate_id,
                        'metadata.candidate_name': metadata['candidate_name']
                    },
                    '$addToSet': {
                        'metadata.candidate_ids': candidate_id,
                        'metadata.source_emails': file_info.get('email_id')
                    }
                }
            )
            linked = self._link_candidate(candidate_id, file_id, document_hash, filename)
            if not linked:
                return {'saved': False, 'reason': 'falha_vincular_candidato', 'file_id': str(file_id)}
            logger.info(f" Arquivo original ja armazenado e vinculado: {filename}")
            return {'saved': False, 'existing': True, 'file_id': str(file_id)}

        with open(file_path, 'rb') as original_file:
            file_id = self.fs.put(
                original_file,
                filename=filename,
                contentType=content_type,
                metadata={
                    **metadata,
                    'candidate_ids': [candidate_id] if candidate_id else [],
                    'source_emails': [file_info.get('email_id')] if file_info.get('email_id') else []
                }
            )

        linked = self._link_candidate(candidate_id, file_id, document_hash, filename)
        if not linked:
            return {'saved': False, 'reason': 'falha_vincular_candidato', 'file_id': str(file_id)}
        logger.info(f" Arquivo original armazenado: {filename} ({file_id})")
        return {'saved': True, 'file_id': str(file_id)}


def save_original_cv_file(file_path, file_info, candidate_result, document_hash, candidate_data):
    store = OriginalFileStore()
    return store.save(file_path, file_info, candidate_result, document_hash, candidate_data)
