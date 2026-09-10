# Herculano Studios

Uma plataforma de e-commerce para venda de produtos digitais voltados à produção musical, como **beats**, **drum kits**, sample packs e presets. O projeto combina uma vitrine moderna para clientes com um painel administrativo para cadastro, publicação e preparação de previews dos produtos.

> Arquivos originais de produtos são mantidos em armazenamento privado. Apenas previews derivados são disponibilizados pela aplicação.

## Funcionalidades

- Catálogo público de produtos ativos, com destaque e filtro por tipo.
- Páginas de detalhes para beats e drum kits, com variantes, preço, BPM e tonalidade quando aplicável.
- Cadastro, login, renovação de sessão e logout com cookies `httpOnly`.
- Controle de acesso por perfil: `CUSTOMER` e `ADMIN`.
- Painel da conta com histórico de pedidos e biblioteca de itens adquiridos.
- Painel administrativo com indicadores, pedidos e fluxo de criação/publicação de produtos.
- Upload privado de capas e arquivos de download.
- Geração de previews em MP3 a partir de beats e de arquivos ZIP de drum kits.
- Banco de dados relacional para usuários, produtos, variantes, mídia, previews, pedidos e tokens de download.

## Tecnologias

| Camada | Tecnologias |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS e Lucide |
| Backend | Node.js, Express 5, TypeScript, Zod, JWT (`jose`) e bcrypt |
| Dados | PostgreSQL 16 e Prisma ORM |
| Infraestrutura local | Docker Compose e pnpm workspaces |
| Processamento de áudio | FFmpeg e `unzip` |

## Estrutura do projeto

```text
.
├── frontend/                 # Aplicação Next.js e interface da loja
├── backend/                  # API Express, Prisma e armazenamento local
│   ├── prisma/               # Schema, migrations e seed
│   └── storage/
│       ├── private/          # Arquivos originais — não públicos
│       └── previews/         # MP3s derivados para prévia
├── docker-compose.yml        # PostgreSQL local
└── package.json              # Scripts do monorepo
```

## Pré-requisitos

- Node.js 20 ou superior
- pnpm 11
- Docker e Docker Compose
- FFmpeg — necessário para gerar previews de áudio
- `unzip` — necessário para extrair amostras de drum kits ZIP

## Como executar localmente

1. Clone o repositório e instale as dependências:

   ```bash
   git clone https://github.com/SEU_USUARIO/herculano-studios.git
   cd herculano-studios
   pnpm install
   ```

2. Crie o arquivo `.env` na raiz a partir do exemplo:

   ```bash
   cp .env.example .env
   ```

3. Crie `backend/.env` com as configurações abaixo. Gere uma chave longa e aleatória para `JWT_SECRET`; ela deve ter no mínimo 32 caracteres.

   ```env
   NODE_ENV=development
   PORT=4000
   FRONTEND_URL=http://localhost:3000
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/herculano_studios?schema=public
   JWT_SECRET=troque-por-uma-chave-secreta-com-ao-menos-32-caracteres
   ACCESS_TOKEN_TTL=15m
   REFRESH_TOKEN_DAYS=30
   PRIVATE_STORAGE_PATH=./storage/private
   PREVIEW_STORAGE_PATH=./storage/previews

   # Necessário apenas para criar o administrador inicial
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=UmaSenhaForte@123
   ADMIN_NAME=Administrador
   ```

4. Inicie o PostgreSQL:

   ```bash
   pnpm db:up
   ```

5. Aplique as migrations, gere o cliente Prisma e carregue os dados de demonstração:

   ```bash
   pnpm --dir backend prisma:generate
   pnpm db:migrate
   pnpm db:seed
   ```

6. Inicie frontend e API:

   ```bash
   pnpm dev
   ```

   A loja estará em `http://localhost:3000` e a API em `http://localhost:4000`. Verifique a API em `http://localhost:4000/api/health`.

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Executa frontend e backend em modo de desenvolvimento |
| `pnpm build` | Gera os builds de produção das duas aplicações |
| `pnpm db:up` | Inicia o PostgreSQL via Docker Compose |
| `pnpm db:down` | Para os containers locais |
| `pnpm db:migrate` | Executa as migrations do Prisma |
| `pnpm db:seed` | Cria o administrador e os dados de demonstração |
| `pnpm --dir backend lint` | Verifica os tipos do backend |
| `pnpm --dir frontend lint` | Executa o linter do frontend |

## Endpoints principais

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Público | Estado da API |
| `POST` | `/api/auth/register` | Público | Cria uma conta de cliente |
| `POST` | `/api/auth/login` | Público | Inicia uma sessão |
| `POST` | `/api/auth/logout` | Público | Encerra a sessão |
| `GET` | `/api/auth/me` | Autenticado | Retorna o usuário atual |
| `GET` | `/api/products` | Público | Lista produtos ativos |
| `GET` | `/api/products/:slug` | Público | Detalha um produto ativo |
| `POST` | `/api/products` | Admin | Cria um produto em rascunho |
| `PATCH` | `/api/products/:id/publish` | Admin | Publica um produto |
| `POST` | `/api/media/admin/products/:productId/beat-preview` | Admin | Gera preview de beat de até 30 s |
| `POST` | `/api/media/admin/products/:productId/drum-kit-previews` | Admin | Gera previews de um drum kit ZIP |

## Segurança e arquivos digitais

- O backend aceita uploads de até 2 GB por arquivo.
- Arquivos enviados e downloads são guardados em `backend/storage/private/`, diretório ignorado pelo Git.
- Os previews passam por conversão e são servidos como MP3; os arquivos fonte não são expostos publicamente.
- Senhas recebem hash com bcrypt e as sessões usam tokens de acesso e refresh tokens revogáveis.
- Em produção, use valores exclusivos e seguros para credenciais, `DATABASE_URL` e `JWT_SECRET`, além de armazenamento persistente para os arquivos privados.

## Licença

Este projeto é privado. Todos os direitos reservados a Herculano Studios.

