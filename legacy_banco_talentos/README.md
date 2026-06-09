# Banco de Talentos - Sistema Completo

Sistema automatizado para captura, processamento e consulta de currculos via mltiplos canais (WhatsApp e E-mail), com anlise inteligente via Gemini API e armazenamento no MongoDB.

##  Caractersticas

- **Captura de E-mails**: Integrao com Microsoft Graph para ler e-mails dos ltimos 2 anos
- **Captura WhatsApp**: Integrao com Ultramsg para ler mensagens dos ltimos 2 anos
- **Download de Anexos**: Suporta PDF, DOC e DOCX
- **Anlise com IA**: Extrao de dados usando Gemini API
- **Deduplicao**: Controle automtico de duplicatas
- **Armazenamento**: MongoDB para persistncia de dados
- **Interface Web**: Pgina para consultar candidatos com filtros
- **Histrico**: Rastreamento de alteraes em registros

##  Instalao

### 1. Pr-requisitos

- Python 3.8+
- pip (gerenciador de pacotes Python)
- MongoDB (conta gratuita em https://cloud.mongodb.com/)
- Credenciais do Microsoft Graph
- Token do Ultramsg (opcional)
- API Key do Gemini

### 2. Clonar/Criar o Projeto

```bash
# Criar pasta do projeto
mkdir banco_talentos
cd banco_talentos
```

### 3. Instalar Dependncias

```bash
# Criar ambiente virtual (recomendado)
python -m venv venv

# Ativar ambiente virtual
# No Windows:
venv\Scripts\activate
# No Linux/Mac:
source venv/bin/activate

# Instalar dependncias
pip install -r requirements.txt
```

### 4. Configurar Variveis de Ambiente



##  Estrutura do Projeto

```
banco_talentos/
 config/                    # Configuraes
    __init__.py
    mongodb.py            # Config MongoDB
    gemini.py             # Config Gemini
    ultramsg.py           # Config Ultramsg
 modules/                   # Mdulos de processamento
    __init__.py
    email_reader.py       # Leitura de e-mails
    whatsapp_reader.py    # Leitura de WhatsApp
    gemini_extractor.py   # Extrao com Gemini
    deduplication.py      # Deduplicao
    mongodb_handler.py    # Operaes MongoDB
 utils/                     # Utilitrios
    __init__.py
    logger.py             # Sistema de logs
    file_handler.py       # Manipulao de arquivos
    validators.py         # Validaes
 web/                       # Interface web (React)
 logs/                      # Arquivos de log
 temp/                      # Arquivos temporrios
 main.py                    # Script principal
 requirements.txt           # Dependncias
 .env                       # Variveis de ambiente
 README.md                  # Este arquivo
```

##  Como Usar

### Executar o Script Principal

```bash
python main.py
```

O script ir:

1. **Capturar Arquivos**
   - Ler e-mails dos ltimos 2 anos
   - Ler mensagens WhatsApp dos ltimos 2 anos
   - Baixar anexos (PDF, DOC, DOCX)

2. **Processar Arquivos**
   - Converter para PDF se necessrio
   - Enviar para Gemini API
   - Extrair dados estruturados

3. **Armazenar no MongoDB**
   - Verificar duplicatas
   - Inserir novos registros
   - Atualizar registros existentes
   - Manter histrico de alteraes

4. **Gerar Relatrio**
   - Exibir estatsticas
   - Listar erros (se houver)

### Exemplo de Sada

```
================================================================================
 INICIANDO BANCO DE TALENTOS
================================================================================

 ETAPA 1: CAPTURANDO ARQUIVOS
--------------------------------------------------------------------------------

 Processando e-mails...
 5 e-mails encontrados
 Processando e-mail: Currculo - Joo Silva
 Anexo baixado: Curriculo_Joao_Silva.pdf

 Processando mensagens WhatsApp...
 3 mensagens encontradas

 Total de arquivos capturados: 8

 ETAPA 2: PROCESSANDO ARQUIVOS
--------------------------------------------------------------------------------

 Processando: Curriculo_Joao_Silva.pdf
 Extraindo dados com Gemini...
 Dados extrados: Joo Silva
 Novo candidato: Joo Silva

 ETAPA 3: GERANDO RELATRIO
--------------------------------------------------------------------------------

================================================================================
 RESUMO DA EXECUO
================================================================================
 E-mails processados: 5
 Mensagens WhatsApp processadas: 3
 Total de arquivos baixados: 8
 Arquivos processados: 8
 Novos candidatos: 6
 Candidatos atualizados: 2
 Sem mudanas: 0
 Erros: 0

 Estatsticas do MongoDB:
  Total de candidatos: 45
  Origem E-mail: 28
  Origem WhatsApp: 17
  Com E-mail: 42
  Com Telefone: 40
================================================================================
```

##  Interface Web

A interface web permite consultar os candidatos armazenados no MongoDB.

### Funcionalidades

- **Busca por Nome**: Filtrar candidatos pelo nome
- **Busca por Skill**: Filtrar candidatos pelas competncias
- **Visualizao de Detalhes**: Ver informaes completas do candidato
- **Estatsticas**: Ver total de candidatos por origem
- **Responsivo**: Funciona em desktop, tablet e mobile

### Acessar a Interface

```bash
# No diretrio do projeto web
cd banco_talentos_web
npm install
npm run dev
```

Acesse em: `http://localhost:3000`

##  Estrutura de Dados no MongoDB

### Coleo: candidatos

```javascript
{
  _id: ObjectId,
  nome: String,
  email: String,
  telefone: String,
  endereco: String,
  data_nascimento: String,
  linkedin: String,
  skills: String,
  formacao_academica: String,
  cursos_certificacoes: String,
  nivel_ingles: String,
  nivel_espanhol: String,
  experiencia_profissional: String,
  hash_documento: String,
  fonte: String,  // "email" ou "whatsapp"
  data_criacao: DateTime,
  data_atualizacao: DateTime,
  data_origem: DateTime,
  versoes: [
    {
      data: DateTime,
      dados: Object
    }
  ]
}
```

##  Dados Extrados pelo Gemini

O sistema extrai automaticamente os seguintes campos de cada CV:

- **Nome**: Nome completo do candidato
- **Endereo**: Cidade, estado ou endereo completo
- **Telefone**: Nmero de telefone formatado
- **Email**: Endereo de e-mail
- **LinkedIn**: URL do perfil LinkedIn
- **Data de Nascimento**: Data ou idade
- **Skills**: Competncias profissionais
- **Formao Acadmica**: Nvel de escolaridade
- **Cursos e Certificaes**: Cursos complementares
- **Nvel de Ingls**: Proficincia em ingls
- **Nvel de Espanhol**: Proficincia em espanhol
- **Experincia Profissional**: Histrico de trabalho

##  Segurana

-  Credenciais armazenadas em `.env` (nunca fazer commit)
-  Validao de entrada de dados
-  indices para email e hash de documento
-  Logs de todas as operaes
-  Tratamento de erros robusto

##  Logs

Os logs so salvos em `logs/` com timestamp:

```
logs/
 banco_talentos_20240328_101530.log
 banco_talentos_20240328_143022.log
 ...
```

Cada log contm:
- Timestamp de cada operao
- Nvel de severidade (INFO, WARNING, ERROR)
- Mdulo que gerou o log
- Mensagem descritiva

##  Troubleshooting

### Erro: "MONGODB_URL no configurada"

**Soluo**: Verificar se o arquivo `.env` existe e contm `MONGODB_URL`

### Erro: "Erro ao conectar ao MongoDB"

**Soluo**: 
- Verificar se a URL do MongoDB est correta
- Verificar conexo com internet
- Verificar se o IP est autorizado no MongoDB Atlas

### Erro: "Gemini API Key invlida"

**Soluo**: Verificar se a chave est correta no `.env`

### Erro: "Arquivo no pode ser convertido para PDF"

**Soluo**: Instalar LibreOffice:
```bash
# Ubuntu/Debian
sudo apt-get install libreoffice

# macOS
brew install libreoffice

# Windows
# Baixar de https://www.libreoffice.org/
```

##  Prximos Passos

1. **Configurar Agendamento**: Usar cron (Linux) ou Task Scheduler (Windows) para executar automaticamente
2. **Integrar com Aplicao**: Conectar a interface web ao backend Python
3. **Adicionar Exportao**: Exportar dados em Excel ou CSV
4. **Notificaes**: Enviar alertas quando novos candidatos forem adicionados
5. **Dashboard**: Criar dashboard com grficos e estatsticas

##  Suporte

Para dvidas ou problemas, consulte:
- Documentao do MongoDB: https://docs.mongodb.com/
- Documentao do Gemini: https://ai.google.dev/
- Documentao do Microsoft Graph: https://docs.microsoft.com/graph/
- Documentao do Ultramsg: https://www.ultramsg.com/api/

##  Licena

Este projeto  fornecido como est, sem garantias.

##  Autor

Desenvolvido com  para o Banco de Talentos
