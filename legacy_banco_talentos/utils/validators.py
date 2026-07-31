"""
Validaes de dados
"""
import re
import logging
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

class Validators:
    """Validadores de dados"""

    @staticmethod
    def sanitize_for_storage(value):
        """Remove caracteres Unicode invalidos sem perder acentuacao valida."""
        if isinstance(value, str):
            cleaned = re.sub(r"[\ud800-\udfff]", "", value)
            return cleaned.encode("utf-8", "ignore").decode("utf-8", "ignore")
        if isinstance(value, list):
            return [Validators.sanitize_for_storage(item) for item in value]
        if isinstance(value, dict):
            return {
                Validators.sanitize_for_storage(key): Validators.sanitize_for_storage(item)
                for key, item in value.items()
            }
        return value
    
    @staticmethod
    def is_valid_email(email):
        """
        Extrai todos os e-mails válidos encontrados em um texto.
        Retorna lista sem duplicados.
        """
        if not email:
            return []

        pattern = r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'

        emails = re.findall(pattern, str(email))

        # Normaliza e remove duplicados mantendo a ordem
        emails_normalizados = []
        for email in emails:
            email = email.strip().lower()
            if email not in emails_normalizados:
                emails_normalizados.append(email)

        return emails_normalizados
    
    @staticmethod
    def is_valid_phone(phone):
        """Valida formato de telefone"""
        if not phone:
            return False
        # Remove caracteres especiais
        phone_clean = re.sub(r'\D', '', phone)
        # Aceita telefones com 10 ou 11 dgitos
        return len(phone_clean) >= 7
    
    @staticmethod
    def is_valid_linkedin_url(url):
        """Valida URL do LinkedIn"""
        if not url:
            return True  # Campo opcional
        return 'linkedin.com' in url.lower()
    
    @staticmethod
    def is_within_date_range(date_str, days_back=730):
        """Valida se a data está dentro do intervalo (UTC-safe)"""
        try:
            if not date_str:
                return False

            # 🔥 Converter ISO (Graph API padrão)
            try:
                date_obj = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except:
                # fallback para outros formatos
                date_formats = [
                    '%Y-%m-%d %H:%M:%S',
                    '%Y-%m-%d',
                    '%d/%m/%Y',
                ]

                date_obj = None
                for fmt in date_formats:
                    try:
                        date_obj = datetime.strptime(str(date_str)[:19], fmt)
                        break
                    except:
                        continue

                if date_obj is None:
                    return False

                # assumir UTC se não tiver timezone
                date_obj = date_obj.replace(tzinfo=timezone.utc)

            # 🔥 Agora tudo em UTC
            now_utc = datetime.now(timezone.utc)

            date_limit = now_utc - timedelta(days=days_back)

            # 🔥 Regras:
            return date_limit <= date_obj <= now_utc

        except Exception as e:
            logger.error(f"Erro ao validar data: {e}")
            return False
    
    @staticmethod
    def validate_candidate_data(data):
        """Valida dados completos de um candidato"""
        errors = []
        
        # Nome  obrigatrio
        if not data.get('Nome'):
            errors.append("Nome  obrigatrio")
        
        # Email  obrigatrio e deve ser vlido
        email = data.get('Email', '')
        if email and not Validators.is_valid_email(email):
            errors.append(f"Email invalido: {email}")
        
        # Telefone deve ser vlido se fornecido
        phone = data.get('Telefone', '')
        if phone and not Validators.is_valid_phone(phone):
            errors.append(f"Telefone invalido: {phone}")
        
        # # LinkedIn deve ser valido se fornecido
        # linkedin = data.get('Link_Linkedin', '')
        # if linkedin and not Validators.is_valid_linkedin_url(linkedin):
        #     errors.append(f"URL do LinkedIn invlida: {linkedin}")
        
        return errors
    
    @staticmethod
    def normalize_phone(phone):
        """Normaliza nmero de telefone"""
        if not phone:
            return ""
        # Remove caracteres especiais
        phone_clean = re.sub(r'\D', '', phone)
        # Formata como DDD-XXXXX-XXXX
        if len(phone_clean) == 11:
            return f"{phone_clean[:2]}-{phone_clean[2:7]}-{phone_clean[7:]}"
        elif len(phone_clean) == 10:
            return f"{phone_clean[:2]}-{phone_clean[2:6]}-{phone_clean[6:]}"
        return phone_clean
    
    @staticmethod
    def normalize_email(email):
        """Normaliza email"""
        if not email:
            return ""
        valid_emails = Validators.is_valid_email(email)
        if valid_emails:
            return valid_emails[0]
        return ""
    
    @staticmethod
    def normalize_name(name):
        """Normaliza nome"""
        if not name:
            return ""
        return name.strip().title()
