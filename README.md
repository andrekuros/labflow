# LabFlow

Plataforma **self-hosted** para gestao de laboratorio de pesquisa. Centraliza Kanban, projetos, sprints, roadmap, entregaveis, requisitos com rastreabilidade, base de conhecimento, foruns, perfis da equipe, temas visuais, plugins e assistente de IA (RAG).

Repositorio: https://github.com/andrekuros/labflow

---

## Indice

1. [Funcionalidades](#funcionalidades)
2. [Requisitos](#requisitos)
3. [Instalacao rapida](#instalacao-rapida)
4. [Configuracao do .env](#configuracao-do-env)
5. [Variaveis de ambiente (referencia)](#variaveis-de-ambiente-referencia)
6. [Primeiro acesso](#primeiro-acesso)
7. [Scripts disponiveis](#scripts-disponiveis)
8. [Modulos da plataforma](#modulos-da-plataforma)
9. [Papeis e permissoes](#papeis-e-permissoes)
10. [Temas visuais](#temas-visuais)
11. [Assistente de IA](#assistente-de-ia)
12. [Plugins](#plugins)
13. [API REST](#api-rest)
14. [Estrutura do projeto](#estrutura-do-projeto)
15. [Producao e PostgreSQL](#producao-e-postgresql)
16. [Desenvolvimento com IA](#desenvolvimento-com-ia)
17. [Solucao de problemas](#solucao-de-problemas)

---

## Funcionalidades

| Modulo | Descricao |
|--------|-----------|
| **Kanban** | Quadro com drag-and-drop, filtros por projeto, pessoa, categoria, sprint e prioridade |
| **Projetos** | Linhas de pesquisa com WBS (estrutura hierarquica de atividades) |
| **Sprints** | Ciclos de trabalho com metas, prazos e barra de progresso |
| **Entregaveis** | Produtos com criterios de aceitacao e rastreabilidade a requisitos |
| **Requisitos** | Metas/requisitos com matriz de rastreabilidade (eng. de sistemas) |
| **Roadmap** | Linha do tempo de marcos, verificacao/validacao e sprints |
| **Conhecimento** | Wiki com busca semantica; alimenta o RAG automaticamente |
| **Repositorio** | Acervo institucional estilo DSpace/Invenio: colecoes, metadados citaveis, upload de arquivos, busca facetada e perguntas por IA sobre os documentos |
| **Gantt** | Cronograma consolidado (projeto > pacote > sprint/tarefa/marco/entregavel), somente leitura |
| **Foruns** | Canais e topicos por projeto, com atualizacao near-realtime |
| **Equipe** | Perfis com tarefas, projetos e visao geral de cada integrante |
| **Assistente IA** | Respostas baseadas no conhecimento acumulado (RAG) |
| **Planejamento** | Visao unificada de requisitos, entregaveis, roadmap e sprints por projeto |
| **Relatorios** | Portfolio de projetos (saude, atrasos, throughput), painel de equipe e relatorio individual |
| **Modelo SE** | System of Interest, subsistemas, componentes e interfaces (MBSE leve) |
| **V&V** | Casos de verificacao e matriz de rastreabilidade de requisitos |
| **Teses** | Trabalhos de pos-graduacao como projetos (metodologia, disciplinas) |
| **Artigos** | Artigos cientificos como projetos, com pipeline de publicacao |
| **Demandas** | Bugs, sugestoes e pedidos do laboratorio, com agente de IA |
| **Atividades** | Timeline global de acoes dos usuarios (admin) |
| **Plugins** | Extensibilidade via eventos, ferramentas de IA e slots de UI |
| **Temas** | 8 paletas x modo claro/escuro (16 combinacoes) |
| **API headless** | Login por token, `GET /api/v1/me`, OpenAPI 3.1 e CORS configuravel — para construir uma UI propria |

---

## Requisitos

- **Node.js** 20+ (recomendado 22 LTS)
- **npm** 10+
- **Git**
- Nenhum banco externo necessario para desenvolvimento (usa SQLite)

Opcional para IA:
- Chave **OpenAI** (ou API compativel), ou
- **Ollama** instalado localmente

---

## Instalacao rapida

### 1. Clonar o repositorio

```bash
git clone https://github.com/andrekuros/labflow.git
cd labflow
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Criar e configurar o `.env`

Veja a secao [Configuracao do .env](#configuracao-do-env) abaixo.

### 4. Criar banco e dados de exemplo

```bash
npm run setup
```

Este comando executa `prisma db push` (cria o schema SQLite) e `prisma/seed.ts` (popula usuarios, projetos e tarefas de demonstracao).

### 5. Iniciar o servidor de desenvolvimento

```bash
npm run dev
```

Acesse **http://localhost:3000**

### 6. Build de producao (opcional)

```bash
npm run build
npm start
```

---

## Configuracao do .env

O arquivo `.env` contem segredos e configuracoes locais. **Ele nunca deve ser commitado no Git** (ja esta listado no `.gitignore`).

### Passo a passo

#### Windows (PowerShell)

Abra o PowerShell na pasta raiz do projeto (`labflow`) e execute:

```powershell
# 1. Copiar o template
Copy-Item .env.example .env

# 2. (Opcional) Gerar um AUTH_SECRET seguro e copiar o resultado
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))

# 3. Editar o arquivo .env
notepad .env
```

No Notepad, substitua o valor de `AUTH_SECRET` pelo valor gerado no passo 2.

#### Linux / macOS

```bash
# 1. Copiar o template
cp .env.example .env

# 2. (Opcional) Gerar AUTH_SECRET
openssl rand -base64 48

# 3. Editar
nano .env   # ou vim, code, etc.
```

### Configuracao minima para comecar

Para rodar localmente com dados de demonstracao, basta:

1. Copiar `.env.example` para `.env`
2. Trocar `AUTH_SECRET` por um valor aleatorio longo (minimo 32 caracteres)

Exemplo minimo funcional:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="sua-chave-secreta-aleatoria-com-pelo-menos-32-caracteres"
AI_PROVIDER="none"
AI_API_KEY=""
AI_BASE_URL=""
AI_CHAT_MODEL="gpt-4o-mini"
AI_EMBEDDING_MODEL="text-embedding-3-small"
```

Depois rode `npm run setup` e `npm run dev`.

### Checklist antes de ir para producao

- [ ] `AUTH_SECRET` alterado para valor unico e aleatorio (nunca use o valor do exemplo)
- [ ] `.env` **nao** esta no Git (`git status` nao deve listar `.env`)
- [ ] Banco migrado para PostgreSQL (recomendado em producao)
- [ ] `npm run build` conclui sem erros
- [ ] Senhas padrao dos usuarios de seed alteradas ou seed desabilitado

---

## Variaveis de ambiente (referencia)

| Variavel | Obrigatoria | Padrao | Descricao |
|----------|-------------|--------|-----------|
| `DATABASE_URL` | Sim | `file:./dev.db` | URL de conexao Prisma. SQLite em dev; PostgreSQL em prod |
| `AUTH_SECRET` | Sim | — | Segredo para assinar sessoes JWT (cookies httpOnly) |
| `AI_PROVIDER` | Nao | `none` | Provedor de IA: `none`, `openai` ou `ollama` |
| `AI_API_KEY` | Se OpenAI | — | Chave da API OpenAI (ou compativel) |
| `AI_BASE_URL` | Nao | auto | URL base customizada da API |
| `AI_CHAT_MODEL` | Nao | `gpt-4o-mini` | Modelo de chat |
| `AI_EMBEDDING_MODEL` | Nao | `text-embedding-3-small` | Modelo de embeddings (OpenAI) |
| `REPOSITORY_STORAGE_DIR` | Nao | `./storage/repository` | Onde os arquivos do repositorio sao gravados. Inclua no backup |
| `API_CORS_ORIGINS` | Nao | vazio | Origens liberadas para a API (separadas por virgula). Vazio = nenhuma UI externa. `*` libera todas, mas desativa o cookie de sessao |
| `API_TOKEN_TTL_HOURS` | Nao | `12` | Validade padrao dos tokens de `POST /api/v1/auth/token` (teto 720) |

### Exemplos por cenario

**Desenvolvimento local (sem IA):**

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="dev-local-secret-min-32-chars-here-abc123"
AI_PROVIDER="none"
```

**Com OpenAI:**

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="sua-chave-secreta-producao"
AI_PROVIDER="openai"
AI_API_KEY="sk-proj-..."
AI_CHAT_MODEL="gpt-4o-mini"
AI_EMBEDDING_MODEL="text-embedding-3-small"
```

**Com Ollama local:**

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="sua-chave-secreta"
AI_PROVIDER="ollama"
AI_BASE_URL="http://localhost:11434"
AI_CHAT_MODEL="llama3"
```

**Producao com PostgreSQL:**

```env
DATABASE_URL="postgresql://labflow:senha@localhost:5432/labflow?schema=public"
AUTH_SECRET="chave-gerada-com-openssl-rand-base64-48"
AI_PROVIDER="openai"
AI_API_KEY="sk-..."
NODE_ENV="production"
```

---

## Primeiro acesso

Apos `npm run setup`, os seguintes usuarios estao disponiveis:

| Email | Senha | Papel |
|-------|-------|-------|
| `admin@lab.edu` | `admin123` | Administrador |
| `carlos@lab.edu` | `lab12345` | Pesquisador (PI) |
| `bruna@lab.edu` | `lab12345` | Doutoranda |
| `diego@lab.edu` | `lab12345` | Mestrando |
| `elena@lab.edu` | `lab12345` | Aluno de IC |

O seed cria dois projetos de exemplo (**NEURO** e **ROBO**) com tarefas, sprints, requisitos, entregaveis, artigos de conhecimento e topicos no forum.

---

## Scripts disponiveis

| Comando | Descricao |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (hot reload) |
| `npm run build` | Build de producao |
| `npm start` | Servidor de producao (apos build) |
| `npm run setup` | Cria banco SQLite + popula seed |
| `npm run db:push` | Sincroniza schema Prisma com o banco |
| `npm run db:seed` | Repopula dados de exemplo |
| `npm run db:studio` | Abre Prisma Studio (GUI do banco) |
| `npm run db:migrate` | Cria/aplica migracoes (PostgreSQL) |
| `npm run typecheck` | Verificacao TypeScript |
| `npm run lint` | ESLint |

---

## Modulos da plataforma

### No menu lateral

| Rota | Grupo | Descricao |
|------|-------|-----------|
| `/` | — | Dashboard (resumo pessoal e do lab) |
| `/board` | Trabalho | Kanban filtravel com drag-and-drop |
| `/projects` | Trabalho | Lista e detalhe de projetos (WBS, equipe, categorias) |
| `/planning` | Trabalho | Requisitos, entregaveis, roadmap e sprints em uma visao |
| `/gantt` | Planejamento | Cronograma Gantt consolidado (somente leitura) |
| `/system-model` | Planejamento | Modelo do sistema (MBSE leve) |
| `/verification` | Planejamento | Casos de V&V e matriz de verificacao |
| `/knowledge` | Conhecimento | Biblioteca, busca semantica e vault Nextcloud |
| `/repository` | Conhecimento | Repositorio institucional (`/repository/[id]` para cada deposito) |
| `/forum` | Conhecimento | Foruns por canal/projeto |
| `/assistant` | Conhecimento | Assistente de IA (RAG) |
| `/reports` | Gestao | Portfolio, equipe e relatorios individuais |
| `/feedback` | Administracao | Demandas: bugs, sugestoes e pedidos |
| `/activity-log` | Administracao | Timeline global (requer `activity_log:view`) |
| `/team` | Administracao | Equipe e perfis individuais (`/team/[id]`) |

### Acessiveis fora do menu

| Rota | Como se chega |
|------|---------------|
| `/sprints`, `/roadmap`, `/deliverables`, `/requirements` | Consolidadas nas abas de `/planning` |
| `/thesis`, `/papers` | Abertas a partir dos projetos correspondentes |
| `/settings` | Icone de configuracoes (permissao `settings:view`) |
| `/plugins` | Plugins instalados |
| `/academic`, `/publications` | Rotas legadas — redirecionam para `/thesis` e `/papers` |

O menu tambem se adapta ao contexto: no modo "foco em projeto", modulos desativados naquele projeto sao ocultados.

### Filtros de contexto (barra superior)

Os quatro icones no topo (teses/dissertacoes, publicacoes, desenvolvimento, admin) escolhem
**quais projetos entram na conta**. Eles valem para tudo: dashboard, Kanban, planejamento,
Gantt, relatorios, timeline de atividades e o relatorio gerado manualmente. Desligar
"acadêmicos", por exemplo, remove teses e dissertacoes de todos os KPIs, nao apenas da lista
de projetos. Cada pagina afetada mostra uma faixa com o contexto ativo e quantos projetos
estao sendo contados, para que um numero menor nunca pareca um erro.

---

## Papeis e permissoes

### Papel global (usuario)

| Papel | Descricao |
|-------|-----------|
| `admin` | Acesso total; gerencia usuarios e permissoes |
| `researcher` | Pesquisador / orientador |
| `project_manager` | Gerente de projetos |
| `contributor` | Colaborador |
| `viewer` | Somente leitura |

Programa academico (mestrado, doutorado, etc.) fica em **Perfil Academico**, nao em `User.role`.

### Papel por projeto

| Papel | Permissoes |
|-------|------------|
| `lead` | Lider do projeto; leitura e escrita |
| `contributor` | Leitura e escrita |
| `viewer` | Somente leitura |

Admins veem todos os projetos. Demais usuarios veem apenas projetos dos quais sao membros.

---

## Temas visuais

Na sidebar, clique em **Tema** para:

- Alternar **modo claro / escuro** (botao Sol/Lua)
- Escolher entre **8 paletas**: Indigo, Oceano, Floresta, Por do sol, Rose, Ambar, Grafite, Carmesim

A preferencia e salva no navegador (`localStorage`).

---

## Assistente de IA

O assistente usa **RAG** (Retrieval-Augmented Generation):

1. Conteudo de artigos, foruns, tarefas e entregaveis e indexado automaticamente
2. Perguntas recuperam trechos relevantes via busca semantica
3. Com `AI_PROVIDER=openai` ou `ollama`, um LLM gera a resposta; sem provedor, respostas extrativas offline

Configure as variaveis `AI_*` no `.env` conforme a [referencia](#variaveis-de-ambiente-referencia).

---

## Plugins

Plugins estendem a plataforma sem alterar o nucleo. Cada plugin declara um `PluginManifest` em `src/plugins/types.ts`:

- **Assinaturas de eventos** — reagem a `task.created`, `post.created`, etc.
- **Ferramentas de IA** — funcoes que agentes podem chamar
- **Slots de UI** — componentes renderizados em areas nomeadas (ex.: dashboard)

Registre plugins em `src/plugins/index.ts` (`BUILTIN_PLUGINS` + `API_REGISTRATIONS`) e o icone
Lucide em `src/plugins/nav-icons.tsx`. O plugin `src/plugins/example/` exercita todos os pontos
de extensao e e o melhor ponto de partida.

Praticamente todo modulo da plataforma e um plugin: veja a tabela completa em
[AGENTS.md](AGENTS.md#4-plugins-registrados).

---

## API REST

Base: `/api/v1/{pluginId}/...`

**Autenticacao:** header `Authorization: Bearer lf_...` (gere a chave em Configuracoes > Integracoes), JWT Bearer, ou cookie de sessao do browser quando voce ja esta logado (ex.: link do catalogo em Configuracoes).

**Catalogo automatico** (lista todas as rotas registradas):

```bash
curl -H "Authorization: Bearer lf_SUA_CHAVE" http://localhost:3000/api/v1
```

Documentacao in-app: artigo **LabFlow — API REST** na base de conhecimento (tambem linkado em Configuracoes > Integracoes).

Respostas: `{ "ok": true, "data": ... }` ou `{ "ok": false, "error": "..." }`. Downloads de arquivo
retornam bytes crus, com `X-Checksum-Sha256`. Onde existe paginacao: `?page=1&pageSize=20` e
`{ total, page, pageSize }` na resposta. Permissoes RBAC iguais as da UI.

Handlers por plugin em `src/plugins/<id>/api.ts`, registrados em `src/plugins/index.ts`.

### Construir uma UI propria (modo headless)

A API foi preparada para ser consumida por uma interface separada:

```bash
# 1. trocar credenciais por um token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{"email":"voce@lab.edu","password":"sua-senha"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["data"]["token"])')

# 2. descobrir quem e o usuario e o que ele pode fazer
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/me

# 3. gerar o cliente a partir da especificacao
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/openapi.json > openapi.json
```

`GET /api/v1/me` devolve identidade, **lista de permissoes efetivas** e os itens de menu com os
mesmos filtros da interface — a UI externa nao precisa adivinhar o que renderizar.

Para chamar de outro dominio, libere a origem:

```env
API_CORS_ORIGINS="http://localhost:5173,https://minha-ui.exemplo"
```

Sem essa variavel nenhuma origem externa e aceita. Requisicoes de origens liberadas recebem
`OPTIONS` e cabecalhos CORS inclusive nas respostas de erro, para que o navegador mostre o motivo
real de uma falha.

Upload de arquivo usa `multipart/form-data` com o campo `file` repetivel:

```bash
curl -X POST http://localhost:3000/api/v1/repository/records/<id>/files \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@artigo.pdf" -F "file=@dados.csv"
```

---

## Estrutura do projeto

```
labflow/
├── AGENTS.md               # Guia canonico para agentes de IA
├── CLAUDE.md               # Ponteiro para AGENTS.md (Claude Code)
├── docs/
│   ├── ARCHITECTURE.md     # Visao geral com diagramas e fluxos
│   └── CURSOR.md           # Workflow com agentes de IA
├── .cursor/skills/         # Skills: labflow-dev, labflow-plugin, labflow-ai
├── .cursor/rules/          # Regras persistentes (.mdc)
├── prisma/
│   ├── schema.prisma       # Modelo de dados (35 models)
│   └── seed.ts             # Dados de demonstracao
├── scripts/                # Utilitarios de manutencao
├── src/
│   ├── app/
│   │   ├── (app)/          # Paginas autenticadas (reexportam o page do plugin)
│   │   ├── actions/        # Server Actions globais (auth, settings, users)
│   │   ├── api/            # Route handlers (/api/v1/*, backup, arquivos)
│   │   └── login/          # Tela publica de login
│   ├── components/         # UI React (um diretorio por modulo + ui/)
│   ├── lib/                # Auth, RBAC, DB, eventos, IA/RAG, conhecimento
│   ├── plugins/            # Modulos + registry + contrato + auth da API
│   └── server/             # bootstrap.ts (eventos, plugins, schedulers)
├── .env.example            # Template de variaveis (copie para .env)
├── .gitignore              # .env e node_modules excluidos
└── package.json
```

Cada modulo do produto e um **plugin** em `src/plugins/<id>/`. Detalhes em [AGENTS.md](AGENTS.md) e [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Producao e PostgreSQL

Para ambientes de laboratorio com varios usuarios simultaneos, migre para PostgreSQL:

1. Instale PostgreSQL (e extensao `pgvector` se quiser busca vetorial nativa)
2. Em `prisma/schema.prisma`, altere:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
3. Configure `DATABASE_URL` no `.env`:
   ```
   DATABASE_URL="postgresql://usuario:senha@host:5432/labflow?schema=public"
   ```
4. Execute:
   ```bash
   npm run db:push    # ou db:migrate em producao
   npm run build
   npm start
   ```
5. Sirva atras de um reverse proxy (Nginx/Caddy) com HTTPS

Os embeddings sao armazenados como JSON (portavel). Para escala maior com pgvector, troque a coluna `Embedding.vector` por tipo `vector` e ajuste `src/lib/ai/rag.ts`.

---

## Desenvolvimento com IA

O repositorio e preparado para contribuicao assistida por IA. Ordem de leitura recomendada
(para voce e para o agente):

| Arquivo | Conteudo |
|---------|----------|
| [AGENTS.md](AGENTS.md) | **Entrada canonica para agentes**: arquitetura, plugins registrados, convencoes, receitas por tarefa e armadilhas |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Visao geral com diagramas: camadas, ciclo de vida de request, event bus, modelo de dados |
| [docs/CURSOR.md](docs/CURSOR.md) | Workflow pratico: skills, prompts eficazes, checklist antes de commit |
| [CLAUDE.md](CLAUDE.md) | Ponteiro para `AGENTS.md`, lido automaticamente pelo Claude Code |
| [.cursor/skills/](.cursor/skills/) | Skills: `labflow-dev`, `labflow-plugin`, `labflow-ai` |
| [.cursor/rules/](.cursor/rules/) | Regras automaticas por escopo de arquivo (Cursor) |

Nao ha suite de testes automatizados: o portao de qualidade e `npm run typecheck` + `npm run lint`.

Artigos de desenvolvimento tambem sao indexados na base de conhecimento apos `npm run setup`
(veja `src/lib/docs-seed.ts`) e ficam consultaveis pelo Assistente IA dentro da plataforma.

---

## Solucao de problemas

### `Error: Environment variable not found: DATABASE_URL`

O arquivo `.env` nao existe ou nao esta na raiz do projeto. Execute:

```powershell
Copy-Item .env.example .env   # Windows
cp .env.example .env          # Linux/macOS
```

### `Prisma schema validation` / banco nao encontrado

```bash
npm run db:push
npm run db:seed
```

### Login nao funciona apos alterar AUTH_SECRET

Sessoes antigas ficam invalidas. Limpe cookies do navegador ou faca logout e login novamente.

### Assistente de IA nao responde com LLM

Verifique no `.env`:
- `AI_PROVIDER` nao pode ser `none`
- `AI_API_KEY` preenchida (OpenAI)
- Ollama rodando em `http://localhost:11434` (se usar Ollama)

### Porta 3000 em uso

```bash
npm run dev -- -p 3001
```

---

## Stack tecnica

- **Next.js 15** (App Router) + React 19 + TypeScript + Tailwind
- **Prisma ORM** + SQLite (dev) / PostgreSQL (prod)
- **Auth** JWT em cookie httpOnly + RBAC
- **IA** camada abstrata (OpenAI / Ollama / offline) + RAG com embeddings locais
- **Event bus** in-process para plugins e ingestao de conhecimento

---

## Licenca

Projeto privado — uso interno do laboratorio de pesquisa.
