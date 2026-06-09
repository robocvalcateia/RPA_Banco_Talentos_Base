# Repasse Tecnico - Gestao do Negocio Alcateia

## 1. Objetivo

Este pacote permite instalar, executar, testar e evoluir o MVP da plataforma
Gestao do Negocio Alcateia sem compartilhar credenciais reais ou dados pessoais.

O pacote inclui uma base demonstrativa sanitizada em `data/database.json`.
A base operacional real deve ser transferida separadamente, somente por canal
seguro e apos alinhamento com o responsavel pela informacao.

## 2. Requisitos

- Node.js 20 ou superior
- Acesso de rede para integracoes externas, quando habilitadas
- Navegador atualizado
- Python 3 com `pandas` apenas se for necessario executar o script opcional de
  migracao em `scripts/import_migracao.py`

O projeto nao possui dependencias npm obrigatorias.

## 3. Instalacao Rapida

1. Extraia o arquivo zip.
2. Abra um terminal na pasta extraida.
3. Copie `.env.example` para `.env`.
4. Preencha somente as integracoes que serao usadas.
5. Execute:

```bash
node server.js
```

6. Acesse:

```text
http://localhost:3000
```

Credenciais da base demo:

```text
Usuario: tecnico@demo.local
Senha inicial: alcateia
```

No primeiro acesso, o sistema solicita troca de senha.

## 4. Testes

Execute:

```bash
node --test
```

Resultado esperado no momento do repasse:

```text
15 testes passando
```

Tambem e recomendado validar sintaxe:

```bash
node --check server.js
node --check db.js
node --check apinfo.js
node --check smtp.js
node --check public/app.js
```

## 5. Estrutura Principal

```text
.
|-- README.md
|-- docs/
|   |-- REPASSE_TECNICO.md
|   `-- CHECKLIST_HOMOLOGACAO.md
|-- server.js
|-- db.js
|-- apinfo.js
|-- smtp.js
|-- package.json
|-- .env.example
|-- data/
|   `-- database.json
|-- public/
|   |-- app.js
|   |-- index.html
|   |-- styles.css
|   |-- brand/
|   |   `-- logo-alcateia.png
|   `-- uploads/
|       `-- .gitkeep
|-- scripts/
|   `-- import_migracao.py
`-- test/
    `-- db.test.js
```

## 6. Persistencia

O MVP grava dados em:

```text
data/database.json
```

Esse formato atende validacao inicial, mas nao e recomendado para producao com
usuarios simultaneos. Evolucao recomendada:

- PostgreSQL
- migrations
- ORM, como Prisma
- backups automatizados
- trilha de auditoria

## 7. Variaveis De Ambiente

Crie `.env` usando `.env.example`.

```text
APINFO_USER=
APINFO_PASSWORD=
SERPAPI_KEY=
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
SMTP_SECURE=false
SMTP_TO_TESTE=
```

Nunca versionar ou enviar `.env` por e-mail ou mensageiro sem protecao.

## 8. Integracao APINFO

Arquivos envolvidos:

```text
apinfo.js
server.js
```

Configuracao:

```text
APINFO_USER=
APINFO_PASSWORD=
```

O sistema autentica na APINFO, pesquisa conforme os parametros do filtro de CVs
e analisa os resultados encontrados.

Pontos de atencao:

- A integracao depende da disponibilidade e do HTML atual da APINFO.
- Alteracoes no site externo podem exigir manutencao no parser.
- Credenciais APINFO devem permanecer fora do codigo-fonte.

## 9. Integracao LinkedIn Via SerpAPI

Configuracao:

```text
SERPAPI_KEY=
```

O sistema usa a SerpAPI para pesquisar perfis publicos indexados com consulta
equivalente a:

```text
site:linkedin.com/in <habilidades obrigatorias>
```

Pontos de atencao:

- O retorno depende do indice de busca e dos limites da conta SerpAPI.
- O sistema nao acessa areas privadas do LinkedIn.
- A chave deve ficar somente em `.env`.

## 10. Envio SMTP Office 365

Arquivos envolvidos:

```text
smtp.js
server.js
```

Configuracao padrao:

```text
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
SMTP_SECURE=false
SMTP_TO_TESTE=
```

Situacao observada antes do repasse:

```text
535 Authentication unsuccessful
```

Isso indica que a aplicacao alcançou o servidor SMTP e estabeleceu STARTTLS,
mas a Microsoft recusou a autenticacao. Validar no Microsoft 365:

- Authenticated SMTP habilitado para a caixa postal
- senha atual ou senha de aplicativo
- MFA
- Security Defaults
- politica de autenticacao do tenant

Para producao, considerar Microsoft Graph com OAuth em vez de autenticacao
SMTP basica.

## 11. Fluxos Importantes

### Filtro de CVs

1. Criar filtro vinculado a uma oportunidade.
2. Informar Job Description e habilidades obrigatorias.
3. Selecionar fontes APINFO, LINKEDIN e/ou ALCATEIA.
4. Executar busca.
5. Avaliar resultados e rejeitados.
6. Marcar candidatos e salvar selecionados.

### Candidato Selecionado

1. Escolher oportunidade.
2. Marcar candidatos para envio.
3. Informar mensagem ao candidato.
4. Salvar mensagem.
5. Acionar envio.

### Conversao Para Alocado

1. Abrir tela Candidatos.
2. Clicar em `Selecionado`.
3. Confirmar acao.
4. Completar os dados operacionais solicitados.
5. Clicar em `Criar alocado`.
6. O backend marca candidato como aprovado e cria o registro em Alocados.

## 12. Seguranca

Antes de publicar:

- Trocar todas as credenciais reais que tenham sido usadas em ambiente de teste.
- Remover dados pessoais de ambientes nao produtivos.
- Restringir acesso ao arquivo `.env`.
- Implementar RBAC real por perfil.
- Adicionar protecao CSRF conforme arquitetura futura.
- Definir politica de logs sem dados sensiveis.
- Migrar persistencia para banco adequado.
- Configurar HTTPS.

## 13. Script Opcional De Migracao

O arquivo:

```text
scripts/import_migracao.py
```

foi criado para uma importacao local inicial. Ele possui caminho de planilha
especifico do ambiente original. Antes de reutilizar:

1. Ajustar a variavel `WORKBOOK`.
2. Criar backup de `data/database.json`.
3. Validar colunas da planilha.
4. Executar primeiro em uma copia da base.

## 14. Proximos Passos Recomendados

1. Subir repositorio Git privado.
2. Criar ambientes separado de desenvolvimento, homologacao e producao.
3. Migrar banco JSON para PostgreSQL.
4. Implementar logs estruturados e monitoramento.
5. Trocar envio SMTP basico por Microsoft Graph/OAuth.
6. Criar fila para buscas externas.
7. Implementar busca ALCATEIA.
8. Adicionar testes de integracao HTTP e testes end-to-end.
