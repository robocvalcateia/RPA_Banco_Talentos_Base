# Checklist De Homologacao

## Preparacao

- [ ] Instalar Node.js 20 ou superior
- [ ] Copiar `.env.example` para `.env`
- [ ] Manter credenciais reais fora do repositorio
- [ ] Executar `node --test`
- [ ] Executar `node server.js`
- [ ] Abrir `http://localhost:3000`

## Login

- [ ] Entrar com `tecnico@demo.local`
- [ ] Usar senha inicial `alcateia`
- [ ] Confirmar troca obrigatoria da senha no primeiro acesso
- [ ] Confirmar logout

## Dashboard

- [ ] Confirmar indicadores principais
- [ ] Confirmar WON no mes por modelo
- [ ] Confirmar valor fechado no mes
- [ ] Confirmar pizza de alocados por cliente
- [ ] Confirmar tempo medio por etapa

## Cadastros

- [ ] Criar e editar cliente
- [ ] Criar e editar oportunidade
- [ ] Criar filtro de CVs
- [ ] Excluir filtro de CVs
- [ ] Consultar Banco de Talentos
- [ ] Criar candidato manual
- [ ] Movimentar etapa do candidato
- [ ] Criar e editar alocado

## Conversao De Candidato Em Alocado

- [ ] Abrir tela Candidatos
- [ ] Clicar em `Selecionado`
- [ ] Confirmar a acao
- [ ] Preencher modal de alocacao
- [ ] Clicar em `Criar alocado`
- [ ] Confirmar candidato aprovado
- [ ] Confirmar novo registro em Alocados

## Busca Externa

- [ ] Configurar credenciais APINFO em `.env`
- [ ] Executar busca somente APINFO
- [ ] Configurar `SERPAPI_KEY`
- [ ] Executar busca somente LINKEDIN
- [ ] Executar busca combinada
- [ ] Confirmar limpeza de resultados ao iniciar nova busca
- [ ] Confirmar ordenacao por aderencia ao Job Description
- [ ] Confirmar lista de rejeitados com observacao

## Candidatos Selecionados

- [ ] Salvar candidatos selecionados da busca
- [ ] Filtrar por oportunidade
- [ ] Salvar mensagem ao candidato
- [ ] Marcar candidatos para envio
- [ ] Excluir candidato selecionado

## SMTP Office 365

- [ ] Configurar variaveis SMTP em `.env`
- [ ] Habilitar Authenticated SMTP na caixa postal
- [ ] Validar MFA, senha de aplicativo ou politica OAuth
- [ ] Enviar e-mail de teste
- [ ] Confirmar recebimento

## Seguranca Para Producao

- [ ] Trocar credenciais usadas em testes
- [ ] Usar HTTPS
- [ ] Remover base demo
- [ ] Transferir base real apenas por canal seguro
- [ ] Criar backup automatizado
- [ ] Planejar migracao para PostgreSQL
- [ ] Implementar RBAC por perfil
- [ ] Implementar auditoria
