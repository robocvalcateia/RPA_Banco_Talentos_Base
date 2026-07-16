"""
Mdulo para operaes no MongoDB
"""
import logging
from config.mongodb import get_candidate_collection_name, get_mongodb
from bson import ObjectId

logger = logging.getLogger(__name__)

class MongoDBHandler:
    def ensure_indexes(self):
        """Cria índices para melhorar performance das buscas e ordenações"""
        try:
            self.collection.create_index([("data_atualizacao", -1)])
            self.collection.create_index([("data_criacao", -1)])
            self.collection.create_index([("id_controle", 1)], unique=True, sparse=True)
            self.collection.create_index([("nome", 1)])
            self.collection.create_index([("email", 1)], unique=True, sparse=True)

            logger.info("Índices do MongoDB verificados/criados com sucesso.")

        except Exception as e:
            logger.error(f"Erro ao criar índices do MongoDB: {e}")
    """Gerencia operaes no MongoDB"""
    
    def get_candidate_by_id(self, candidate_id: str):
        """
        Busca um candidato pelo ID
        
        Args:
            candidate_id: ID do candidato (string)
        
        Returns:
            Documento do candidato ou None
        """
        try:
            from bson import ObjectId
            
            # Converter string para ObjectId
            try:
                obj_id = ObjectId(candidate_id)
            except:
                return None
            
            candidate = self.collection.find_one({"_id": obj_id})
            return candidate
        
        except Exception as e:
            print(f"❌ Erro ao buscar candidato por ID: {str(e)}")
            return None

    def update_candidate(self, candidate_id: str, data: dict):
        """
        Atualiza dados de um candidato
        
        Args:
            candidate_id: ID do candidato
            data: Dicionário com dados a atualizar
        
        Returns:
            Documento atualizado ou None
        """
        try:
            from bson import ObjectId
            from datetime import datetime
            
            # Converter string para ObjectId
            try:
                obj_id = ObjectId(candidate_id)
            except:
                return None
            
            # Campos permitidos para atualização
            allowed_fields = {
                'nome', 'email', 'nacionalidade','estado_civil','idade', 'telefone', 'endereco', 'skills',
                'formacao_academica', 'cursos_certificacoes', 'nivel_ingles',
                'nivel_espanhol', 'experiencia_profissional', 'linkedin'
            }
            
            # Filtrar apenas campos permitidos
            update_data = {k: v for k, v in data.items() if k in allowed_fields}
            
            # Adicionar data de atualização
            update_data['data_atualizacao'] = datetime.now().isoformat()
            
            # Atualizar no banco
            result = self.collection.find_one_and_update(
                {"_id": obj_id},
                {"$set": update_data},
                return_document=True
            )
            
            if result:
                print(f"✅ Candidato {candidate_id} atualizado com sucesso")
                return result
            else:
                print(f"⚠️ Candidato {candidate_id} não encontrado")
                return None
        
        except Exception as e:
            print(f"❌ Erro ao atualizar candidato: {str(e)}")
            return None

    def delete_candidate(self, candidate_id: str):
        """
        Deleta um candidato
        
        Args:
            candidate_id: ID do candidato
        
        Returns:
            True se deletado, False caso contrário
        """
        try:
            from bson import ObjectId
            
            # Converter string para ObjectId
            try:
                obj_id = ObjectId(candidate_id)
            except:
                return False
            
            # Deletar do banco
            result = self.collection.delete_one({"_id": obj_id})
            
            if result.deleted_count > 0:
                print(f"✅ Candidato {candidate_id} deletado com sucesso")
                return True
            else:
                print(f"⚠️ Candidato {candidate_id} não encontrado")
                return False
        
        except Exception as e:
            print(f"❌ Erro ao deletar candidato: {str(e)}")
            return False

    def search_candidates(self, nome: str = "", skill: str = ""):
        """
        Busca candidatos por nome ou skill
        
        Args:
            nome: Nome do candidato (busca parcial)
            skill: Skill do candidato (busca parcial)
        
        Returns:
            Lista de candidatos
        """
        try:
            query = {}
            
            if nome:
                query["nome"] = {"$regex": nome, "$options": "i"}
            
            if skill:
                query["skills"] = {"$regex": skill, "$options": "i"}
            
            candidates = list(self.collection.find(query))
            return candidates
        
        except Exception as e:
            print(f"❌ Erro ao buscar candidatos: {str(e)}")
            return []

    def get_statistics(self):
        """
        Retorna estatísticas dos candidatos
        
        Returns:
            Dicionário com estatísticas
        """
        try:
            total = self.collection.count_documents({})
            email_count = self.collection.count_documents({"fonte": "email"})
            whatsapp_count = self.collection.count_documents({"fonte": "whatsapp"})
            
            return {
                "total": total,
                "email": email_count,
                "whatsapp": whatsapp_count
            }
        
        except Exception as e:
            print(f"❌ Erro ao buscar estatísticas: {str(e)}")
            return {"total": 0, "email": 0, "whatsapp": 0}

    def __init__(self):
        """Inicializa o gerenciador MongoDB"""
        self.db = get_mongodb().get_db()
        self.collection = self.db[get_candidate_collection_name()]
        self.ensure_indexes()
    
    def get_all_candidates(self, limit=None):
        """Obtm todos os candidatos"""
        try:
            query = self.collection.find().sort('data_criacao', -1)
            
            if limit:
                query = query.limit(limit)
            
            candidates = list(query)
            logger.info(f" {len(candidates)} candidatos recuperados")
            return candidates
            
        except Exception as e:
            logger.error(f" Erro ao obter candidatos: {e}")
            return []
    
    def search_candidates(self, search_term, field=None):
        """
        Busca candidatos por termo
        
        Args:
            search_term (str): Termo de busca
            field (str): Campo especfico para buscar (nome, skills, etc.)
            
        Returns:
            list: Candidatos encontrados
        """
        try:
            if field:
                # Buscar em campo especfico
                query = {field: {'$regex': search_term, '$options': 'i'}}
            else:
                # Buscar em mltiplos campos
                query = {
                    '$or': [
                        {'nome': {'$regex': search_term, '$options': 'i'}},
                        {'skills': {'$regex': search_term, '$options': 'i'}},
                        {'email': {'$regex': search_term, '$options': 'i'}},
                        {'telefone': {'$regex': search_term, '$options': 'i'}},
                        {'formacao_academica': {'$regex': search_term, '$options': 'i'}},
                        {'experiencia_profissional': {'$regex': search_term, '$options': 'i'}}
                    ]
                }
            
            results = list(self.collection.find(query).sort('data_criacao', -1))
            logger.info(f" {len(results)} candidatos encontrados para '{search_term}'")
            return results
            
        except Exception as e:
            logger.error(f" Erro ao buscar candidatos: {e}")
            return []
    
    def get_candidate_by_id(self, candidate_id):
        """Obtm um candidato por ID"""
        try:
            candidate = self.collection.find_one({'_id': ObjectId(candidate_id)})
            
            if candidate:
                logger.info(f" Candidato encontrado: {candidate.get('nome')}")
                return candidate
            else:
                logger.warning(f" Candidato no encontrado: {candidate_id}")
                return None
                
        except Exception as e:
            logger.error(f" Erro ao obter candidato: {e}")
            return None
    
    def get_candidate_by_email(self, email):
        """Obtm um candidato por email"""
        try:
            candidate = self.collection.find_one({'email': email.lower().strip()})
            
            if candidate:
                logger.info(f" Candidato encontrado por email: {email}")
                return candidate
            else:
                logger.warning(f" Candidato no encontrado para email: {email}")
                return None
                
        except Exception as e:
            logger.error(f" Erro ao obter candidato por email: {e}")
            return None
    
    def get_statistics(self):
        """Obtm estatsticas dos candidatos"""
        try:
            total = self.collection.count_documents({})
            
            # Contar por fonte
            email_count = self.collection.count_documents({'fonte': 'email'})
            whatsapp_count = self.collection.count_documents({'fonte': 'whatsapp'})
            
            # Contar com email
            with_email = self.collection.count_documents({'email': {'$ne': ''}})
            
            # Contar com telefone
            with_phone = self.collection.count_documents({'telefone': {'$ne': ''}})
            
            stats = {
                'total_candidatos': total,
                'origem_email': email_count,
                'origem_whatsapp': whatsapp_count,
                'com_email': with_email,
                'com_telefone': with_phone
            }
            
            logger.info(f" Estatsticas: {stats}")
            return stats
            
        except Exception as e:
            logger.error(f" Erro ao obter estatsticas: {e}")
            return {}
    
    def export_to_dict(self, candidates):
        """Converte candidatos para dicionrio para exportao"""
        try:
            exported = []
            
            for candidate in candidates:
                exported.append({
                    'ID': str(candidate.get('_id')),
                    'Nome': candidate.get('nome', ''),
                    'Email': candidate.get('email', ''),
                    'Nacionalidade': candidate.get('nacionalidade', ''),
                    'Estado Civil': candidate.get('estado_civil', ''),
                    'Idade': candidate.get('idade', ''),
                    'Telefone': candidate.get('telefone', ''),
                    'Endereco': candidate.get('endereco', ''),
                    'Data Nascimento': candidate.get('data_nascimento', ''),
                    'LinkedIn': candidate.get('linkedin', ''),
                    'Skills': candidate.get('skills', ''),
                    'Formacao': candidate.get('formacao_academica', ''),
                    'Cursos': candidate.get('cursos_certificacoes', ''),
                    'Ingles': candidate.get('nivel_ingles', ''),
                    'Espanhol': candidate.get('nivel_espanhol', ''),
                    'Experincia': candidate.get('experiencia_profissional', ''),
                    'Fonte': candidate.get('fonte', ''),
                    'Data Criacao': candidate.get('data_criacao', ''),
                    'Data Atualizacao': candidate.get('data_atualizacao', '')
                })
            
            logger.info(f" {len(exported)} candidatos exportados")
            return exported
            
        except Exception as e:
            logger.error(f" Erro ao exportar candidatos: {e}")
            return []
    
    def delete_candidate(self, candidate_id):
        """Deleta um candidato"""
        try:
            result = self.collection.delete_one({'_id': ObjectId(candidate_id)})
            
            if result.deleted_count > 0:
                logger.info(f" Candidato deletado: {candidate_id}")
                return True
            else:
                logger.warning(f" Candidato no encontrado para deletar: {candidate_id}")
                return False
                
        except Exception as e:
            logger.error(f" Erro ao deletar candidato: {e}")
            return False
    
    def get_recent_candidates(self, days=7):
        """Obtm candidatos adicionados nos ltimos N dias"""
        try:
            from datetime import datetime, timedelta
            
            date_limit = datetime.now() - timedelta(days=days)
            date_iso = date_limit.isoformat()
            
            candidates = list(self.collection.find({
                'data_criacao': {'$gte': date_iso}
            }).sort('data_criacao', -1))
            
            logger.info(f" {len(candidates)} candidatos dos ltimos {days} dias")
            return candidates
            
        except Exception as e:
            logger.error(f" Erro ao obter candidatos recentes: {e}")
            return []


def get_mongodb_handler():
    """Funo auxiliar para obter o gerenciador MongoDB"""
    return MongoDBHandler()
