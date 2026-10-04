# Solicitações DTT e lembretes horários

## Fluxo em produção

- Caixa consultada: gerson@alcateiaconsulting.com.br, via credenciais Microsoft Graph já usadas pelo sistema. É necessária permissão de leitura para essa caixa.
- Remetente aceito: poolterceiros@deloitte.com. Assunto: SOLICITAÇÃO DE COTAÇÃO -VAGA número - título (respostas/encaminhamentos são tolerados).
- A identificação exibida contém número e título. O código numérico permanece separado para deduplicação e gravação em `clientOpportunityCode`.
- Cada nova mensagem válida prepara uma solicitação temporária DTT, pesquisa os currículos e gera um único link com autenticação. Não cria oportunidade definitiva antes de Confirmar.
- Destinatários fixos dos avisos: Gerson e Bruno, conforme seus usuários ativos. O mesmo link é reenviado a cada hora enquanto a solicitação permanecer pendente. Cancelamento, confirmação ou oportunidade já existente interrompem os novos avisos. Uma mensagem já entregue ao transporte não pode ser retirada.
- A rotina persiste seu horário de execução e seu marco de leitura. Uma verificação leve ocorre a cada minuto; somente quando transcorrerem 60 minutos desde o início anterior a caixa é consultada. Reinício do servidor não reinicia a contagem nem duplica a solicitação.
- A primeira ativação começa no momento da ativação: não importa o histórico antigo. Uma sobreposição de cinco minutos na leitura protege contra atrasos, mas mensagens anteriores à ativação não são importadas.
- A caixa não é alterada: não marca mensagens como lidas, não move nem apaga. Anexos ficam como pendência de revisão.
- Falha de leitura preserva o marco anterior. Falha de envio é registrada por destinatário, sem impedir o outro. A tentativa será refeita no próximo ciclo horário, evitando repetição imediata.
- Tentativas são persistidas em `intakeNotifications` e espelhadas no histórico `emailDeliveryLogs` com tipo `dtt_opportunity_review`. SMTP aceito é registrado como enviado; isso não comprova leitura ou entrega final ao destinatário.

## Armazenamento e ativação

Produção usa MongoDB com transações e registros próprios: `opportunityIntakes`, `intakeSearchResults`, `intakeNotifications`, `intakeRuntime` e `intakeLocks`. As gravações de oportunidade, vínculos e movimentos ocorrem juntas. Resultados de busca são divididos por candidato para evitar um único documento de tamanho excessivo. Não são substituídas coleções completas.

A funcionalidade publicada começa desativada para envios reais. Rotas administrativas autenticadas:

- `GET /api/intake/preflight`: verifica leitura da caixa do Gerson e presença da configuração SMTP, sem enviar mensagens.
- `GET /api/intake/scheduler`: consulta ativação, intervalo, última execução, marco de leitura e eventual erro.
- `POST /api/intake/activate`: após verificar Graph, SMTP, DTT e revisores, persiste a ativação e executa o primeiro ciclo. É idempotente; não desloca o marco em reativações.

O processamento de currículos RoboCV mantém sua configuração própria. O piloto LOCAL continua isolado e bloqueia envios reais.

## Tela

O botão Wapp reutiliza a validação de celular brasileiro e a abertura de conversa do cadastro de currículos. Sem celular válido, fica indisponível. O clique abre a conversa; não envia mensagem automaticamente. Os outros comportamentos de triagem, raio de 100 km e revisão sem nova busca permanecem.

## Verificações

Testes cobrem periodicidade, persistência entre reinícios, concorrência, reenvios com a mesma numeração, interrupção por confirmação/cancelamento, falha SMTP por destinatário, erro Graph, paginação, ausência de importação histórica, campos e fluxo de candidatos. A inspeção visual usa navegador isolado e intercepta a abertura do WhatsApp, sem envio real. O teste de integração com o MongoDB e Graph de produção depende do ambiente publicado; não deve ser confundido com os testes simulados.
