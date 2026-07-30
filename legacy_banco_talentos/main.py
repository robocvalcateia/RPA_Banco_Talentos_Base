"""
Script principal - Orquestração do sistema de Banco de Talentos
"""
import os
import sys
import logging
from datetime import datetime
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configurar logging
from utils.logger import LoggerSetup
logger = LoggerSetup.setup()

# Importar módulos
from modules.email_reader import process_emails
from modules.email_reader import EmailReader
from modules.whatsapp_reader import process_whatsapp_messages
from modules.gemini_extractor import extract_cv_data_detalhado
from modules.deduplication import process_candidate_data
from modules.original_file_store import save_original_cv_file
from utils.file_handler import FileHandler
from modules.mongodb_handler import get_mongodb_handler
from utils.email_sender import enviar_email_resumo_graph

class BancoTalentosOrchestrator:
    """Orquestra o fluxo completo do sistema"""
    
    def __init__(self):
        """Inicializa o orquestrador"""
        self.logger = logging.getLogger(__name__)
        self.stats = {
            'emails_processados': 0,
            'whatsapp_processados': 0,
            'arquivos_baixados': 0,
            'arquivos_processados': 0,
            'novos_candidatos': 0,
            'candidatos_atualizados': 0,
            'sem_mudancas': 0,
            'arquivos_originais_gravados': 0,
            'arquivos_originais_ja_existentes': 0,
            'erros': 0,

            # NOVO - rastreabilidade
            'erros_por_tipo': {},
            'detalhes_erros': []
        }



    def _registrar_erro(self, tipo, mensagem, file_info=None, exception=None, acao=None):
        """
        Registra erro com rastreabilidade para log e envio por e-mail.
        """

        self.stats['erros'] += 1

        if 'erros_por_tipo' not in self.stats:
            self.stats['erros_por_tipo'] = {}

        if 'detalhes_erros' not in self.stats:
            self.stats['detalhes_erros'] = []

        self.stats['erros_por_tipo'][tipo] = self.stats['erros_por_tipo'].get(tipo, 0) + 1

        detalhe = {
            'data_hora': datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
            'tipo': tipo,
            'mensagem': mensagem,
            'arquivo': file_info.get('filename') if file_info else '',
            'origem': file_info.get('source') if file_info else '',
            'email_id': file_info.get('email_id') if file_info else '',
            'assunto_email': file_info.get('email_subject') if file_info else '',
            'data_email': file_info.get('email_date') if file_info else '',
            'acao': acao or '',
            'exception': repr(exception) if exception else ''
        }

        self.stats['detalhes_erros'].append(detalhe)

        self.logger.error(
            f"[{tipo}] {mensagem} | "
            f"Arquivo: {detalhe['arquivo']} | "
            f"Assunto: {detalhe['assunto_email']} | "
            f"Ação: {detalhe['acao']} | "
            f"Exception: {detalhe['exception']}"
        )
    def run(self):
        """Executa o fluxo completo"""
        try:
            email_reader = EmailReader()
            Folder_Mail_Sucesso = 'CVs_Processados'
            Folder_Mail_Erro = 'CVs_Processados_Erro'
            self.logger.info("=" * 80)
            self.logger.info(" INICIANDO BANCO DE TALENTOS")
            self.logger.info("=" * 80)
            
            # Etapa 1: Capturar arquivos
            self.logger.info("\nETAPA 1: CAPTURANDO ARQUIVOS")
            self.logger.info("-" * 80)
            
            all_files = []
            
            # Processar e-mails
            self.logger.info("\nProcessando e-mails...")
            email_files = process_emails()
            all_files.extend(email_files)
            self.stats['emails_processados'] = len(set(f['email_id'] for f in email_files if f.get('email_id')))
            
            # Processar WhatsApp
            # self.logger.info("\nProcessando mensagens WhatsApp...")
            # whatsapp_files = process_whatsapp_messages()
            # all_files.extend(whatsapp_files)
            # self.stats['whatsapp_processados'] = len(whatsapp_files)
            
            self.stats['arquivos_baixados'] = len(all_files)
            self.logger.info(f"\nTotal de arquivos capturados: {len(all_files)}")
            
            if not all_files:
                self.logger.warning("Nenhum arquivo foi capturado")
                self._print_summary()
                handler = get_mongodb_handler()
                db_stats = handler.get_statistics()
                total_candidatos = db_stats.get('total_candidatos', 0)

                enviar_email_resumo_graph(self.stats, total_candidatos)
                return {
                    "success": True,
                    "message": "Nenhum arquivo foi capturado para processamento.",
                    "stats": self.stats,
                    "total_candidatos": total_candidatos
                }
            
            # Etapa 2: Processar arquivos
            self.logger.info("\nETAPA 2: PROCESSANDO ARQUIVOS")
            self.logger.info("-" * 80)
            
            emails_movidos = set()
            emails_com_tentativa_movimento = set()

            def mover_email_uma_vez(file_info, pasta_destino):
                email_id = file_info.get("email_id")

                if file_info.get("source") != "email" or not email_id:
                    return

                if email_id in emails_com_tentativa_movimento:
                    self.logger.info(f"E-mail já teve tentativa de movimentação nesta execução: {email_id}")
                    return

                emails_com_tentativa_movimento.add(email_id)

                movido = email_reader.move_email(email_id, pasta_destino)

                if movido:
                    emails_movidos.add(email_id)

            for file_info in all_files:
                try:

                    status = file_info.get("status")
                    if status == "anexo_ignorado":
                        self.logger.info(
                            f"Anexo ignorado sem erro: {file_info.get('filename')} | "
                            f"Motivo: {file_info.get('motivo', '')}"
                        )
                        continue

                    if status in [
                        "arquivo_invalido",
                        "sem_anexo",
                        "extensao_fora_padrao",
                        "falha_download_anexo",
                        "item_attachment_sem_anexo_valido",
                        "eml_sem_anexo_valido"
                    ]:
                        tipo_erro = file_info.get("tipo_erro") or status
                        motivo = file_info.get("motivo") or "Arquivo não processado por regra de validação."

                        self._registrar_erro(
                            tipo=tipo_erro,
                            mensagem=motivo,
                            file_info=file_info,
                            acao=f"E-mail movido para {Folder_Mail_Erro}"
                        )

                        if file_info.get("email_id"):
                            mover_email_uma_vez(file_info, Folder_Mail_Erro)

                        continue

                    file_path = file_info.get('path')
                    filename = file_info.get('filename')
                    source = file_info.get('source')

                    self.logger.info(f"\nProcessando: {filename}")

                    if not file_path or not os.path.exists(file_path):
                        self._registrar_erro(
                            tipo="arquivo_temp_nao_encontrado",
                            mensagem=f"Arquivo temporário não encontrado para processamento: {filename}",
                            file_info=file_info,
                            acao="Arquivo ignorado. Verificar concorrência ou limpeza de temporários."
                        )

                        if file_info.get("source") == "email" and file_info.get("email_id"):
                            mover_email_uma_vez(file_info, Folder_Mail_Erro)

                        continue

                    # Gerar hash do arquivo
                    document_hash = FileHandler.generate_file_hash(file_path)
                    
                    if not document_hash:
                        self._registrar_erro(
                            tipo="falha_gerar_hash",
                            mensagem=f"Não foi possível gerar hash para o arquivo {filename}",
                            file_info=file_info,
                            acao=f"E-mail movido para {Folder_Mail_Erro}"
                        )

                        if file_info.get("source") == "email" and file_info.get("email_id"):
                            mover_email_uma_vez(file_info, Folder_Mail_Erro)

                        continue
                    
                    # Extrair dados com Gemini
                    self.logger.info(f" Extraindo dados com Gemini...")

                    resultado_extracao = extract_cv_data_detalhado(file_path)

                    if not resultado_extracao.get("success"):
                        self._registrar_erro(
                            tipo=resultado_extracao.get("erro_tipo", "falha_extracao_gemini"),
                            mensagem=resultado_extracao.get("erro_mensagem", f"Não foi possível extrair dados de {filename}"),
                            file_info=file_info,
                            acao=f"E-mail movido para {Folder_Mail_Erro}"
                        )

                        if file_info.get("source") == "email" and file_info.get("email_id"):
                            mover_email_uma_vez(file_info, Folder_Mail_Erro)

                        continue

                    candidate_data = resultado_extracao["dados"]

                    if not candidate_data:
                        self._registrar_erro(
                            tipo="falha_extracao_gemini",
                            mensagem=f"Não foi possível extrair dados do currículo {filename}",
                            file_info=file_info,
                            acao=f"E-mail movido para {Folder_Mail_Erro}"
                        )

                        if file_info.get("source") == "email" and file_info.get("email_id"):
                            mover_email_uma_vez(file_info, Folder_Mail_Erro)

                        continue
                    self.logger.info(f" Dados extraídos: {candidate_data.get('Nome', 'Desconhecido')}")
                    
                    # Processar candidato (inserir ou atualizar)
                    source_date = file_info.get('email_date') or file_info.get('message_date')
                    
                    result = process_candidate_data(
                        candidate_data,
                        document_hash,
                        source,
                        source_date
                    )
                    
                    # Atualizar estatísticas
                    Move_Folder = Folder_Mail_Sucesso
                    if result['status'] == 'novo':
                        self.stats['novos_candidatos'] += 1
                        self.logger.info(f" Novo candidato: {result['nome']}")
                    elif result['status'] == 'atualizado':
                        self.stats['candidatos_atualizados'] += 1
                        self.logger.info(f" Candidato atualizado: {result['nome']}")
                    elif result['status'] == 'sem_mudancas':
                        self.stats['sem_mudancas'] += 1
                        self.logger.info(f"Sem mudanças: {result['nome']}")
                    else:
                        self._registrar_erro(
                            tipo="falha_processar_candidato",
                            mensagem=result.get('mensagem', 'Erro ao inserir ou atualizar candidato no banco.'),
                            file_info=file_info,
                            acao=f"E-mail movido para {Folder_Mail_Erro}"
                        )
                        Move_Folder = Folder_Mail_Erro

                    if Move_Folder == Folder_Mail_Sucesso:
                        try:
                            original_file_result = save_original_cv_file(
                                file_path,
                                file_info,
                                result,
                                document_hash,
                                candidate_data
                            )
                            if original_file_result.get('saved'):
                                self.stats['arquivos_originais_gravados'] += 1
                            elif original_file_result.get('existing'):
                                self.stats['arquivos_originais_ja_existentes'] += 1
                        except Exception as e:
                            self._registrar_erro(
                                tipo="falha_gravar_arquivo_original",
                                mensagem=f"CV processado, mas nao foi possivel gravar o arquivo original: {filename}",
                                file_info=file_info,
                                exception=e,
                                acao="Processamento do candidato preservado; arquivo original devera ser reprocessado se necessario."
                            )

                    # Move Mail Folder
                    mover_email_uma_vez(file_info, Move_Folder)

                    self.stats['arquivos_processados'] += 1
                    
                except Exception as e:
                    # Move Mail Folder
                    if file_info.get("source") == "email" and file_info.get("email_id"):
                        mover_email_uma_vez(file_info, Folder_Mail_Erro)

                    self._registrar_erro(
                        tipo="erro_inesperado_processamento_arquivo",
                        mensagem="Erro inesperado ao processar arquivo.",
                        file_info=file_info,
                        exception=e,
                        acao=f"E-mail movido para {Folder_Mail_Erro}"
                    )
                    continue
            
            # Etapa 3: Gerar relatório
            self.logger.info("\n ETAPA 3: GERANDO RELATÓRIO")
            self.logger.info("-" * 80)
            
            self._print_summary()
            
            # Limpar arquivos temporários
            self.logger.info("\nLimpando arquivos temporários...")
            FileHandler.cleanup_temp_files()
            
            self.logger.info("\n" + "=" * 80)
            self.logger.info(" PROCESSO CONCLUÍDO COM SUCESSO")
            self.logger.info("=" * 80)

            handler = get_mongodb_handler()
            db_stats = handler.get_statistics()
            total_candidatos = db_stats.get('total_candidatos', 0)

            enviar_email_resumo_graph(self.stats, total_candidatos)
            return {
                "success": True,
                "message": "Processamento concluído com sucesso.",
                "stats": self.stats,
                "total_candidatos": total_candidatos
            }
            
        except Exception as e:
            self.logger.error(f"Erro crítico no orquestrador: {e}")
            self._print_summary()

            handler = get_mongodb_handler()
            db_stats = handler.get_statistics()
            total_candidatos = db_stats.get('total_candidatos', 0)

            enviar_email_resumo_graph(self.stats, total_candidatos)
            return {
                "success": False,
                "message": f"Erro crítico durante o processamento: {str(e)}",
                "stats": self.stats,
                "total_candidatos": total_candidatos
            }
    
    def _print_summary(self):
        """Imprime resumo das operações"""
        self.logger.info("\n" + "=" * 80)
        self.logger.info(" RESUMO DA EXECUÇÃO")
        self.logger.info("=" * 80)
        self.logger.info(f" E-mails processados: {self.stats['emails_processados']}")
        self.logger.info(f" Mensagens WhatsApp processadas: {self.stats['whatsapp_processados']}")
        self.logger.info(f" Total de arquivos baixados: {self.stats['arquivos_baixados']}")
        self.logger.info(f" Arquivos processados: {self.stats['arquivos_processados']}")
        self.logger.info(f" Novos candidatos: {self.stats['novos_candidatos']}")
        self.logger.info(f" Candidatos atualizados: {self.stats['candidatos_atualizados']}")
        self.logger.info(f"Sem mudanças: {self.stats['sem_mudancas']}")
        self.logger.info(f" Arquivos originais gravados: {self.stats.get('arquivos_originais_gravados', 0)}")
        self.logger.info(f" Arquivos originais ja existentes: {self.stats.get('arquivos_originais_ja_existentes', 0)}")
        self.logger.info(f" Erros: {self.stats['erros']}")
        if self.stats.get('erros_por_tipo'):
            self.logger.info("\n Erros por tipo:")
            for tipo, quantidade in self.stats['erros_por_tipo'].items():
                self.logger.info(f"  - {tipo}: {quantidade}")

        if self.stats.get('detalhes_erros'):
            self.logger.info("\n Detalhamento dos erros:")
            for erro in self.stats['detalhes_erros']:
                self.logger.info(
                    f"  - [{erro.get('tipo')}] "
                    f"Arquivo: {erro.get('arquivo')} | "
                    f"Assunto: {erro.get('assunto_email')} | "
                    f"Motivo: {erro.get('mensagem')} | "
                    f"Ação: {erro.get('acao')}"
                )
        
        # Estatísticas do MongoDB
        try:
            handler = get_mongodb_handler()
            db_stats = handler.get_statistics()
            self.logger.info("\n Estatísticas do MongoDB:")
            self.logger.info(f"  Total de candidatos: {db_stats.get('total_candidatos', 0)}")
            self.logger.info(f"  Origem E-mail: {db_stats.get('origem_email', 0)}")
            self.logger.info(f"  Origem WhatsApp: {db_stats.get('origem_whatsapp', 0)}")
            self.logger.info(f"  Com E-mail: {db_stats.get('com_email', 0)}")
            self.logger.info(f"  Com Telefone: {db_stats.get('com_telefone', 0)}")
        except Exception as e:
            self.logger.warning(f"Não foi possível obter estatísticas do MongoDB: {e}")
        
        self.logger.info("=" * 80)


def main():
    """Função principal"""
    try:
        orchestrator = BancoTalentosOrchestrator()
        orchestrator.run()
    except Exception as e:
        logger.error(f" Erro fatal: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
