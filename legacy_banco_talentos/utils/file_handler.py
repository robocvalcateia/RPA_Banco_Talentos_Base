"""
Manipulação de arquivos e conversões
"""
import unicodedata
import re
import os
import hashlib
import shutil
from pathlib import Path
import logging
from docx import Document
from pdf2image import convert_from_path
from PIL import Image
import PyPDF2
import subprocess
from docx import Document
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from utils.config import *

logger = logging.getLogger(__name__)

class FileHandler:
    """Gerencia operações com arquivos"""
    @staticmethod
    def normalizar_nome_arquivo(file_path):
        caminho = Path(file_path)

        nome_sem_acento = unicodedata.normalize("NFKD", caminho.stem)
        nome_sem_acento = nome_sem_acento.encode("ascii", "ignore").decode("ascii")

        nome_limpo = re.sub(r"[^a-zA-Z0-9_-]+", "_", nome_sem_acento).strip("_")
        novo_caminho = caminho.with_name(f"{nome_limpo}{caminho.suffix.lower()}")

        if novo_caminho != caminho:
            shutil.copy2(caminho, novo_caminho)
            logger.info(f"Arquivo normalizado: {novo_caminho}")
            return str(novo_caminho)

        return str(caminho)
    
    @staticmethod
    def get_temp_folder():
        """Retorna a pasta temporária"""
        os.makedirs(TEMP_FOLDER, exist_ok=True)
        return TEMP_FOLDER
    
    @staticmethod
    def generate_file_hash(file_path):
        """Gera hash SHA256 de um arquivo"""
        try:
            sha256_hash = hashlib.sha256()
            with open(file_path, "rb") as f:
                for byte_block in iter(lambda: f.read(4096), b""):
                    sha256_hash.update(byte_block)
            return sha256_hash.hexdigest()
        except Exception as e:
            logger.error(f" Erro ao gerar hash do arquivo: {e}")
            return None
    
    @staticmethod
    def save_file(file_content, filename, subfolder=''):
        """Salva um arquivo na pasta temporária"""
        try:
            temp_folder = FileHandler.get_temp_folder()
            
            if subfolder:
                temp_folder = os.path.join(temp_folder, subfolder)
                os.makedirs(temp_folder, exist_ok=True)
            
            file_path = os.path.join(temp_folder, filename)
            
            with open(file_path, 'wb') as f:
                f.write(file_content)
            
            logger.info(f" Arquivo salvo: {file_path}")
            return file_path
            
        except Exception as e:
            logger.error(f" Erro ao salvar arquivo: {e}")
            return None
    
    @staticmethod
    def convert_docx_to_pdf(docx_path):
        """Converte DOCX/DOC para PDF usando LibreOffice"""

        try:
            temp_folder = FileHandler.get_temp_folder()
            os.makedirs(temp_folder, exist_ok=True)

            docx_path = os.path.abspath(docx_path)

            if not os.path.exists(docx_path):
                logger.error(f"Arquivo não encontrado: {docx_path}")
                return None

            pdf_path = os.path.join(
                temp_folder,
                f"{Path(docx_path).stem}.pdf"
            )

            # localiza o executável
            soffice_path = (
                shutil.which("soffice")
                or shutil.which("libreoffice")
            )

            # fallback windows
            if not soffice_path and os.name == "nt":
                possible_paths = [
                    r"C:\Program Files\LibreOffice\program\soffice.exe",
                    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe"
                ]

                for path in possible_paths:
                    if os.path.exists(path):
                        soffice_path = path
                        break

            if not soffice_path:
                logger.error("LibreOffice não encontrado.")
                return None

            cmd = [
                soffice_path,
                "--headless",
                "--nologo",
                "--nolockcheck",
                "--nodefault",
                "--nofirststartwizard",
                "--convert-to", "pdf",
                "--outdir", temp_folder,
                docx_path
            ]

            logger.info(f"Convertendo arquivo: {docx_path}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=120
            )

            logger.info(f"STDOUT: {result.stdout}")
            logger.info(f"STDERR: {result.stderr}")

            if result.returncode != 0:
                logger.error(
                    f"Erro na conversão. Código: {result.returncode}"
                )
                return None

            if not os.path.exists(pdf_path):
                logger.error("PDF não foi gerado.")
                return None

            if os.path.getsize(pdf_path) == 0:
                logger.error("PDF gerado está vazio.")
                return None

            logger.info(f"PDF gerado com sucesso: {pdf_path}")

            return pdf_path

        except subprocess.TimeoutExpired:
            logger.error("Timeout ao converter DOCX para PDF")
            return None

        except Exception as e:
            logger.error(f"Erro ao converter DOCX para PDF: {e}")
            return None
    
    @staticmethod
    def convert_doc_to_pdf(doc_path):
        """Converte arquivo DOC para PDF"""
        try:
            # Usar LibreOffice para conversão
            import subprocess
            
            temp_folder = FileHandler.get_temp_folder()
            pdf_path = os.path.join(temp_folder, Path(doc_path).stem + '.pdf')
            
            # Comando para converter com LibreOffice
            cmd = [
                'libreoffice',
                '--headless',
                '--convert-to', 'pdf',
                '--outdir', temp_folder,
                doc_path
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            
            if result.returncode == 0 and os.path.exists(pdf_path):
                logger.info(f" DOC convertido para PDF: {pdf_path}")
                return pdf_path
            else:
                logger.warning(f"Erro ao converter DOC: {result.stderr}")
                return None
                
        except Exception as e:
            logger.error(f" Erro ao converter DOC para PDF: {e}")
            return None
    
    @staticmethod
    def ensure_pdf(file_path):
        try:
            file_path = FileHandler.normalizar_nome_arquivo(file_path)

            file_ext = Path(file_path).suffix.lower()

            if file_ext == '.pdf':
                return file_path
            elif file_ext == '.docx':
                return FileHandler.convert_docx_to_pdf(file_path)
            elif file_ext == '.doc':
                return FileHandler.convert_docx_to_pdf(file_path)
            else:
                logger.warning(f"Formato não suportado: {file_ext}")
                return None

        except Exception as e:
            logger.error(f" Erro ao garantir PDF: {e}")
            return None
    
    @staticmethod
    def cleanup_temp_files():
        """Limpa arquivos temporários"""
        try:
            temp_folder = FileHandler.get_temp_folder()
            
            if os.path.exists(temp_folder):
                shutil.rmtree(temp_folder)
                os.makedirs(temp_folder, exist_ok=True)
                logger.info(" Arquivos temporários limpos")
                
        except Exception as e:
            logger.error(f" Erro ao limpar arquivos temporários: {e}")
    
    @staticmethod
    def delete_file(file_path):
        """Deleta um arquivo específico"""
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f" Arquivo deletado: {file_path}")
                return True
            return False
        except Exception as e:
            logger.error(f" Erro ao deletar arquivo: {e}")
            return False
