"""
Mdulo para deduplicao e controle de registros duplicados
"""
import logging
from datetime import datetime
from config.mongodb import get_candidate_collection_name, get_mongodb
from utils.validators import Validators
from pymongo import ReturnDocument

logger = logging.getLogger(__name__)

class DeduplicationHandler:
    """Gerencia deduplicao e atualizao de registros"""
    
    def __init__(self):
        """Inicializa o gerenciador de deduplicao"""
        self.db = get_mongodb().get_db()
        self.collection_name = get_candidate_collection_name()
        self.collection = self.db[self.collection_name]

    def _has_value(self, value):
        if value is None:
            return False
        if isinstance(value, str):
            return bool(value.strip())
        return value != ''

    def _set_if_filled(self, update_data, field_name, value):
        if self._has_value(value):
            update_data[field_name] = value.strip() if isinstance(value, str) else value
    
    def gerar_id_controle(self):
        """
        Gera próximo ID de controle de forma atômica.
        Exemplo: 01, 02, 03...
        """
        contador = self.db["contadores"].find_one_and_update(
            {"_id": f"{self.collection_name}_id_controle"},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )

        proximo_numero = int(contador.get("seq", 1))
        return f"{proximo_numero:02d}"

    def find_duplicate(self, candidate_data, document_hash):
        """
        Procura por duplicata usando mltiplas estratgias
        
        Args:
            candidate_data (dict): Dados do candidato
            document_hash (str): Hash do documento
            
        Returns:
            dict: Registro encontrado ou None
        """
        try:
            # Estrategia 1: Buscar por email valido para respeitar o indice unico
            email = Validators.normalize_email(candidate_data.get('Email', ''))
            if email:
                existing = self.collection.find_one({'email': email})
                if existing:
                    logger.info(f" Duplicata encontrada por email: {email}")
                    return existing

            # Estrategia 2: Buscar por hash do documento
            if document_hash:
                existing = self.collection.find_one({'hash_documento': document_hash})
                if existing:
                    logger.info(f" Duplicata encontrada por hash: {document_hash}")
                    return existing
            
            # Estratgia 3: Buscar por telefone
            phone = Validators.normalize_phone(candidate_data.get('Telefone', ''))
            if phone:
                existing = self.collection.find_one({'telefone': phone})
                if existing:
                    logger.info(f" Duplicata encontrada por telefone: {phone}")
                    return existing
            
            # Estratgia 4: Buscar por nome + endereo
            name = Validators.normalize_name(candidate_data.get('Nome', ''))
            address = candidate_data.get('Endereco', '').strip()
            
            if name and address:
                existing = self.collection.find_one({
                    'nome': name,
                    'endereco': address
                })
                if existing:
                    logger.info(f" Duplicata encontrada por nome + endereo: {name}")
                    return existing
            
            return None
            
        except Exception as e:
            logger.error(f" Erro ao procurar duplicata: {e}")
            return None
    
    def has_changes(self, existing_data, new_data):
        """
        Verifica se h mudanas entre dados existentes e novos
        
        Args:
            existing_data (dict): Dados existentes no MongoDB
            new_data (dict): Novos dados extrados
            
        Returns:
            bool: True se h mudanas
        """
        try:
            fields_to_compare = [
                'Nome', 'Email', 'Telefone', 'Endereco',
                'Nacionalidade', 'Estado_Civil', 'Idade',
                'DataNascimento', 'Skil', 'Formacao_Academica',
                'Cursos_Certificacoes', 'Nivel_Idioma_Ingles',
                'Nivel_Idioma_Espanhol', 'Experiencia_Profissional',
                'Conhecimento_Tecnico', 'Link_Linkedin'
            ]

            field_map = {
                'Nome': 'nome',
                'Email': 'email',
                'Telefone': 'telefone',
                'Endereco': 'endereco',
                'Nacionalidade': 'nacionalidade',
                'Estado_Civil': 'estado_civil',
                'Idade': 'idade',
                'DataNascimento': 'data_nascimento',
                'Skil': 'skills',
                'Formacao_Academica': 'formacao_academica',
                'Cursos_Certificacoes': 'cursos_certificacoes',
                'Nivel_Idioma_Ingles': 'nivel_ingles',
                'Nivel_Idioma_Espanhol': 'nivel_espanhol',
                'Experiencia_Profissional': 'experiencia_profissional',
                'Conhecimento_Tecnico': 'conhecimento_tecnico',
                'Link_Linkedin': 'linkedin'
            }
            
            for field in fields_to_compare:
                existing_value = existing_data.get(field_map.get(field, field.lower()), '')
                new_value = new_data.get(field, '')
                
                # Normalizar valores para comparao
                existing_norm = str(existing_value).strip().lower()
                new_norm = str(new_value).strip().lower()
                
                if existing_norm != new_norm and new_norm:
                    logger.info(f" Mudana detectada em {field}")
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f" Erro ao comparar dados: {e}")
            return False
    
    def insert_candidate(self, candidate_data, document_hash, source, source_date):
        """
        Insere um novo candidato
        
        Args:
            candidate_data (dict): Dados do candidato
            document_hash (str): Hash do documento
            source (str): Fonte (email/whatsapp)
            source_date (str): Data da fonte
            
        Returns:
            dict: Resultado da insero
        """
        try:
            now = datetime.now().isoformat()
            email_normalizado = Validators.normalize_email(candidate_data.get('Email', ''))
            telefone_normalizado = Validators.normalize_phone(candidate_data.get('Telefone', ''))
            # Normalizar dados
            normalized_data = {
                'id_controle': self.gerar_id_controle(),
                'nome': Validators.normalize_name(candidate_data.get('Nome', '')),
                'telefone': telefone_normalizado,
                'endereco': candidate_data.get('Endereco', '').strip(),
                'nacionalidade': candidate_data.get('Nacionalidade', '').strip(),
                'estado_civil': candidate_data.get('Estado_Civil', '').strip(),
                'idade': candidate_data.get('Idade', ''),
                'linkedin': candidate_data.get('Link_Linkedin', '').strip(),
                'skills': candidate_data.get('Skil', '').strip(),
                'formacao_academica': candidate_data.get('Formacao_Academica', '').strip(),
                'nivel_ingles': candidate_data.get('Nivel_Idioma_Ingles', '').strip(),
                'nivel_espanhol': candidate_data.get('Nivel_Idioma_Espanhol', '').strip(),
                'cursos_certificacoes': candidate_data.get('Cursos_Certificacoes', '').strip(),
                'conhecimento_tecnico': candidate_data.get('Conhecimento_Tecnico', '').strip(),
                'experiencia_profissional': candidate_data.get('Experiencia_Profissional', '').strip(),
                'search_text_all': (
                    candidate_data.get('Texto_Integral_Original', '').strip()
                    or candidate_data.get('Experiencia_Profissional', '').strip()
                ),
                'hash_documento': document_hash,
                'fonte': source,
                'data_criacao': now,
                'data_atualizacao': now,
                'data_origem': source_date,
                'versoes': [
                    {
                        'data': now,
                        'dados': candidate_data
                    }
                ]
            }

            if email_normalizado:
                normalized_data['email'] = email_normalizado
            
            result = self.collection.insert_one(normalized_data)
            logger.info(f" Novo candidato inserido: {normalized_data['nome']} (ID: {result.inserted_id})")
            
            return {
                'status': 'novo',
                'id': str(result.inserted_id),
                'nome': normalized_data['nome']
            }
            
        except Exception as e:
            logger.error(f" Erro ao inserir candidato: {e}")
            return {'status': 'erro', 'mensagem': str(e)}
    
    def update_candidate(self, existing_id, candidate_data, document_hash, source, source_date):
        """
        Atualiza um candidato existente
        
        Args:
            existing_id: ID do candidato existente
            candidate_data (dict): Novos dados
            document_hash (str): Hash do novo documento
            source (str): Fonte (email/whatsapp)
            source_date (str): Data da fonte
            
        Returns:
            dict: Resultado da atualizao
        """
        try:
            now = datetime.now().isoformat()
            existing_doc = self.collection.find_one({'_id': existing_id}) or {}
            email_normalizado = Validators.normalize_email(candidate_data.get('Email', ''))
            telefone_normalizado = Validators.normalize_phone(candidate_data.get('Telefone', ''))

            update_data = {
                'data_atualizacao': now
            }

            if source_date:
                update_data['data_origem'] = source_date

            field_map = {
                'nome': Validators.normalize_name(candidate_data.get('Nome', '')),
                'telefone': telefone_normalizado,
                'endereco': candidate_data.get('Endereco', ''),
                'nacionalidade': candidate_data.get('Nacionalidade', ''),
                'estado_civil': candidate_data.get('Estado_Civil', ''),
                'idade': candidate_data.get('Idade', ''),
                'data_nascimento': candidate_data.get('DataNascimento', ''),
                'linkedin': candidate_data.get('Link_Linkedin', ''),
                'skills': candidate_data.get('Skil', ''),
                'formacao_academica': candidate_data.get('Formacao_Academica', ''),
                'cursos_certificacoes': candidate_data.get('Cursos_Certificacoes', ''),
                'nivel_ingles': candidate_data.get('Nivel_Idioma_Ingles', ''),
                'nivel_espanhol': candidate_data.get('Nivel_Idioma_Espanhol', ''),
                'conhecimento_tecnico': candidate_data.get('Conhecimento_Tecnico', ''),
                'experiencia_profissional': candidate_data.get('Experiencia_Profissional', ''),
                'search_text_all': (
                    candidate_data.get('Texto_Integral_Original', '')
                    or candidate_data.get('Experiencia_Profissional', '')
                )
            }

            for field_name, value in field_map.items():
                self._set_if_filled(update_data, field_name, value)

            if email_normalizado:
                owner = self.collection.find_one({
                    'email': email_normalizado,
                    '_id': {'$ne': existing_id}
                })
                if owner:
                    logger.warning(
                        f" Email {email_normalizado} ja pertence a outro candidato; "
                        "campo preservado para evitar duplicidade."
                    )
                else:
                    update_data['email'] = email_normalizado

            # Adicionar hash se for novo documento
            if document_hash:
                update_data['hash_documento'] = document_hash

            skipped_empty_fields = [
                field_name
                for field_name in field_map
                if not self._has_value(field_map[field_name]) and self._has_value(existing_doc.get(field_name))
            ]
            if skipped_empty_fields:
                logger.info(
                    " Campos existentes preservados por falta de valor no reprocessamento: "
                    + ", ".join(skipped_empty_fields)
                )
            
            # Atualizar registro
            result = self.collection.update_one(
                {'_id': existing_id},
                {
                    '$set': update_data,
                    '$push': {
                        'versoes': {
                            'data': now,
                            'dados': candidate_data
                        }
                    }
                }
            )
            
            logger.info(f" Candidato atualizado: {update_data.get('nome') or existing_doc.get('nome') or existing_id}")
            
            return {
                'status': 'atualizado',
                'id': str(existing_id),
                'nome': update_data.get('nome') or existing_doc.get('nome')
            }
            
        except Exception as e:
            logger.error(f" Erro ao atualizar candidato: {e}")
            return {'status': 'erro', 'mensagem': str(e)}
    
    def process_candidate(self, candidate_data, document_hash, source, source_date):
        """
        Processa um candidato (insere ou atualiza)
        
        Args:
            candidate_data (dict): Dados do candidato
            document_hash (str): Hash do documento
            source (str): Fonte (email/whatsapp)
            source_date (str): Data da fonte
            
        Returns:
            dict: Resultado do processamento
        """
        try:
            candidate_data = Validators.sanitize_for_storage(candidate_data)

            # Validar dados
            errors = Validators.validate_candidate_data(candidate_data)
            if errors:
                logger.warning(f" Dados invalidos: {errors}")
                return {
                    'status': 'erro',
                    'mensagem': f"Dados invalidos: {', '.join(errors)}"
                }
            
            # Procurar duplicata
            existing = self.find_duplicate(candidate_data, document_hash)
            
            if existing:
                # Verificar se ha mudancas
                if self.has_changes(existing, candidate_data):
                    # Atualizar registro
                    return self.update_candidate(
                        existing['_id'],
                        candidate_data,
                        document_hash,
                        source,
                        source_date
                    )
                else:
                    logger.info(f" Nenhuma mudana detectada para {candidate_data.get('Nome')}")
                    return {
                        'status': 'sem_mudancas',
                        'id': str(existing['_id']),
                        'nome': existing.get('nome')
                    }
            else:
                # Inserir novo registro
                return self.insert_candidate(
                    candidate_data,
                    document_hash,
                    source,
                    source_date
                )
            
        except Exception as e:
            logger.error(f" Erro ao processar candidato: {e}")
            return {'status': 'erro', 'mensagem': str(e)}


def process_candidate_data(candidate_data, document_hash, source, source_date):
    """Funo auxiliar para processar dados de candidato"""
    handler = DeduplicationHandler()
    return handler.process_candidate(candidate_data, document_hash, source, source_date)
