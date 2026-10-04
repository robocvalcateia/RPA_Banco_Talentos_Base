# Solicitações DTT — piloto LOCAL

Endereço de cada solicitação: `http://127.0.0.1:3010/?view=opportunityIntake&request=IDENTIFICADOR`.

Iniciar na pasta do projeto: `npm run dev:intake`. Usar um usuário interno já existente na cópia local. A tela também aparece em **Deals → Oportunidades → Revisar solicitação DTT**.

## Recebimento e geração do link

O bloco de entrada manual foi removido. O evento de recebimento prepara a solicitação e executa a pesquisa antes de gerar os avisos. A pesquisa e suas evidências ficam salvas para abertura imediata pelo link, sem exigir um clique para buscar.

Destinatários conferidos no cadastro: **gerson@alcateiaconsulting.com.br** e **bruno@alcateiaconsulting.com.br**. Ambos recebem o mesmo endereço da solicitação; o endereço não contém senha nem token e exige login no sistema.

No LOCAL, os avisos são somente prévias persistidas na base, com status `simulated` e sem data de envio. A caixa de entrada real não está conectada. `GET /api/intake/notifications` permite a um administrador consultar essas prévias.

Para simular o exemplo, iniciar o piloto, informar as variáveis temporárias `INTAKE_LOCAL_USER` e `INTAKE_LOCAL_PASSWORD` e executar `node scripts/simulate-intake-email.mjs`. Um arquivo JSON opcional pode ser passado como argumento, com `mailbox`, `sender`, `subject`, `messageId` e `body`. O comando retorna o link e o resultado, sem revelar credenciais. O assunto do exemplo é explicitamente identificado como simulação; o corpo é o fornecido pelo usuário.

## Como revisar

1. Abrir o link e entrar no sistema. A tela começa nos **Dados da oportunidade**, com campos editáveis, pendências e e-mail original recolhido. Remetente **poolterceiros@deloitte.com** e contratação **PJ** são fixos. O campo Prazo de resposta foi removido.
2. Os candidatos já estão listados, com paginação de 20 em 20. **Ver candidatos** leva diretamente à lista.
3. Consultar as evidências, pendências e texto do currículo. **Selecionado** marca/desmarca e salva imediatamente a escolha para os dois revisores.
4. Se editar os requisitos, clicar em **Salvar revisão**. A pesquisa, seus percentuais e as seleções são preservados. A tela informa quando os dados foram alterados após a pesquisa; a adequação técnica deve ser conferida pelo revisor. O filtro geográfico e impedimentos cadastrais são revalidados nos candidatos já listados, na seleção e na confirmação, sem executar outra busca.
5. Marcar a ciência da revisão e clicar em **Confirmar**. Oportunidade DTT/Open, vínculos e histórico são gravados juntos. É possível confirmar sem profissionais.
6. **Cancelar** encerra o rascunho sem criar oportunidade ou vínculos. O registro de processamento permanece para impedir repetição.

As seleções sobrevivem à recarga e ficam disponíveis na mesma solicitação para o outro revisor. **Atualizar solicitação** recupera o estado mais recente; alterações de formulário ainda não salvas são descartadas ao atualizar. Revisões antigas não podem sobrescrever alterações de outra sessão. A tela identifica quem confirmou/cancelou e bloqueia novas ações depois do encerramento.

## Regras verificadas

- Caixa: gerson@alcateiaconsulting.com.br; remetente: poolterceiros@deloitte.com.
- Assunto obrigatório no evento de recebimento: SOLICITAÇÃO DE COTAÇÃO - …, admitindo prefixos de resposta/encaminhamento.
- Extração de perfil, senioridade explícita ou sugerida, quantidade, modalidade, cidade, estado, início, duração, idioma, experiência mínima, requisitos, diferenciais e orientações de apresentação.
- O exemplo SAP FI recebe sugestão **Sênior**, considerando cinco anos exigidos, escopo funcional e referências oficiais pesquisadas em 01/10/2026. A tela mostra a justificativa e links da Indra (Brasil), Capgemini (Espanha) e NTT DATA (Itália). A classificação permanece editável; uma senioridade explícita do cliente ou editada pelo revisor é preservada.
- As referências pesquisadas desta versão cobrem SAP FI/FICO com pelo menos quatro anos e escopo funcional comparável. Não se aplica uma tabela universal de anos a qualquer profissão: perfis sem referência suficiente ficam a confirmar. Não há pesquisa automática na internet a cada novo e-mail.
- Os pares cidade/estado RJ/RJ e SP/SP são normalizados para Rio de Janeiro/Rio de Janeiro e São Paulo/São Paulo. Estado isolado não preenche cidade. Início é MM/AAAA, sem exigir dia; mês inválido bloqueia gravação. FA-GL/FA-AR/FA-AP/FA-AA permanecem com alerta para validar equivalência, sem redução de pontuação por essa grafia.
- Anexos são apenas mencionados como pendência; não foram recebidos nem interpretados neste piloto.
- A análise examina currículo integral, textos consolidados, competências, experiências, projetos, atividades, formação, certificações, versões disponíveis, idiomas cadastrados e observações de entrevista. Preserva o texto completo para análise, sem limite dos primeiros caracteres. Campos demográficos e notas de busca referentes à vaga não são critérios de avaliação.
- Cada candidato apresenta uma matriz **requisito a requisito**, com obrigatório/diferencial/condição da vaga, resultado, trecho e fonte. Os resultados distinguem evidência declarada, menção/curso, ausência de informação, divergência e equivalência a validar. Cursos e listas não comprovam atuação profissional.
- Menções a SAP em gestão de programas, infraestrutura e inventários de tecnologias não comprovam atuação funcional em FI. Atividades em outros ERPs permanecem como menções quando não há evidência funcional no módulo. Os trechos exibidos são resumidos para leitura, com o texto integral disponível.
- O intérprete local usa contexto e equivalências de termos. Cláusulas sem interpretação suficiente permanecem explícitas para revisão; não se afirma que um modelo externo de IA validou os currículos. A tela distingue aderência nos requisitos identificados e cobertura dos requisitos técnicos. Nenhum dos dois percentuais representa probabilidade de contratação.
- Informações ausentes não geram uma reprovação no cadastro. Inglês abaixo do solicitado fica visível; idioma estruturado é priorizado. Residência não comprova disponibilidade presencial, e anos no módulo não comprovam anos exclusivos em implementação. Início, duração, aceite PJ e senioridade do candidato permanecem sujeitos a validação.
- Instruções de envio de CV/modelo e resumo de entrevista são obrigações do processo, não exigências que o currículo do profissional precise mencionar.
- Deduplicação por identificador da mensagem, corpo equivalente e código da solicitação DTT. Também se verifica o código já cadastrado nas oportunidades. Requisições com códigos distintos não são agrupadas só por terem a mesma descrição.
- Sem código, conteúdo alterado pode não ser reconhecido como reenvio: conferir a identificação antes de confirmar.
- Reenvio com mudança e mesmo código é sinalizado na resposta do processamento, sem sobrescrever o rascunho nem repetir os dois avisos. Atualização de oportunidade já cadastrada fica para uma etapa posterior.
- Duplo clique/repetição de confirmação não cria novos registros. Revisão antiga em outra aba é rejeitada.

## Isolamento

- Base do piloto: `data/intake-local/database.json`, criada uma única vez como cópia de `data/database.json`.
- O teste inicial utilizou 2.023 currículos da base local; ela pode estar desatualizada em relação à produção.
- Não há leitura de caixa de e-mail, download de anexos, acesso a MongoDB remoto ou envio de mensagens.
- O servidor usa somente 127.0.0.1:3010. O inicializador não repassa credenciais de integração.
- Rotinas agendadas estão desligadas. Outras alterações do sistema são bloqueadas nesse piloto; as telas existentes servem para consulta dos registros locais.
- Banco original e produção não são modificados. Nada foi publicado no GitHub ou Render.

## Validação

Testes automatizados cobrem extração, campos ausentes, busca sem limite de primeiros resultados, pesquisa salva antes dos avisos, dois destinatários e um link, reenvios concorrentes, seleções compartilhadas, revisão concorrente, confirmação com/sem selecionados, vínculos, histórico, persistência, cancelamento, duplicidade e falhas sem gravação parcial.

Validação no Chrome local cobre login pelo link, remoção do bloco manual, candidatos previamente listados, seleção compartilhada em duas sessões, bloqueio de revisão antiga, persistência após recarga e telas em desktop/celular. O arquivo de dados original é comparado por hash para verificar que permanece igual. O exemplo SAP FI é mantido pendente para avaliação do usuário; os testes não o confirmam nem o cancelam.


## Regras revisadas em 01/10/2026

- Identificação extraída exclusivamente da numeração após **VAGA** no assunto (exemplo: `SOLICITAÇÃO DE COTAÇÃO -VAGA 2054 - SAP Successfactors EC` → `2054`). Reenvio com o mesmo código é deduplicado para DTT. Sem essa numeração, permanece pendente. Título do assunto é usado quando o corpo não informa o perfil.
- Comunicação, capacidade analítica, liderança, proatividade, colaboração e adaptabilidade ficam em **Avaliar na entrevista**, fora de numerador e denominador. Análise de causa raiz e especificações funcionais continuam técnicas.
- Pontuação somente dos requisitos técnicos obrigatórios reconhecidos. Diferenciais e cláusulas que exigem interpretação manual são exibidos separadamente, sem pontuar.
- Pesos por grupo: competência principal 5; implementação 5; cada submódulo 3; processos financeiros 3; entregas funcionais (especificação/configuração/desenvolvimento) 3; testes/homologação 3; fechamento mensal/anual 3; localização/impostos 3; diagnóstico/soluções/plano de ação 3; metodologia 1; demais critérios técnicos reconhecidos 1.
- Grupos relacionados compartilham o peso, evitando contagem repetida. Cada subcritério divide igualmente o peso do grupo. Evidência reconhecida recebe 1, menção parcial 0,5, conflito explícito 0. Critério não localizado permanece pendente: seu peso não entra na aderência, mas reduz a cobertura.
- **Aderência identificada = pontos obtidos / peso com informação identificada × 100. Cobertura = peso com informação identificada / peso total técnico × 100.** Se não houver informação avaliável, aderência fica a confirmar. O ordenamento considera evidência ponderada sobre o total e prioriza localização elegível; assim, 100% com cobertura escassa não significa aprovação nem tem prioridade automática sobre evidência mais abrangente.
- Presencial/híbrida: raio máximo de 100 km, inclusive. Cálculo Haversine entre coordenadas das sedes municipais, em linha reta. Não é percurso de carro nem distância entre endereços. Acima de 100 km não entra na busca. Remoto não aplica raio.
- Localização usa campos de residência/endereço cadastrado. Não usa locais de projetos anteriores, telefone ou DDD. Endereço ausente, ambíguo ou município não reconhecido permanece a confirmar, visível e sem seleção habilitada. A referência local inclui 5.571 municípios; fonte e licença estão em `resources/geography/README.md`.
- Salvar revisão não remove candidatos nem seleções. Mudança de local ou modalidade atualiza a indicação de elegibilidade dos candidatos já listados e pode bloquear sua seleção/confirmação. Não acrescenta candidatos excluídos pela busca original.
- Atualização única dos rascunhos pendentes aplica as regras novas e registra a revisão no histórico. Uma seleção incompatível com o novo filtro obrigatório é removida nessa migração, com auditoria. Não há alterações na base original ou em produção.
