# AGUA CRISTALINA

Prototipo inicial de um aplicativo de gestao para loja de agua filtrada, com foco em operacao diaria, controlo financeiro, clientes, qualidade da agua e relatorios.

## 1. Estrutura completa do app

### Dashboard
- Graficos diarios, semanais e mensais.
- Indicadores de vendas, lucro, despesas e investimentos.
- Cores de performance:
  - abaixo de 17.000 Kz: vermelho
  - entre 17.000 e 25.000 Kz: amarelo
  - acima de 25.000 Kz: verde
- Resumo de pagamentos.
- Saldos de clientes.
- Ultimas medicoes da agua.

### Vendas
- Registro de venda.
- Registro de deposito do cliente.
- Registro de levantamento do saldo do cliente.
- Filtros por cliente, produto, data e metodo de pagamento.
- Metodos de pagamento:
  - Consolidada
  - TPA
  - Express
  - Saldo do cliente
- Regras:
  - Agua 20L, 6L e 1.5L nao controlam estoque.
  - Dispensador e Suporte completo controlam estoque.
  - Venda de item com estoque reduz quantidade automaticamente.
  - Valor total do estoque e recalculado pelo custo medio.

### Clientes
- Cadastro completo.
- Controlo de saldo individual.
- Deposito soma ao saldo e conta como venda.
- Levantamento subtrai do saldo e nao conta como venda.
- Venda com "Saldo do cliente" desconta o saldo do cliente.

### Estoque
- Entrada de estoque para itens controlados.
- Quantidade atual.
- Custo medio.
- Valor atual do estoque.

### Financas
- Registo de despesas.
- Registo de investimentos.
- Formula de lucro:
  - `Lucro = Vendas - Despesas - Investimentos`

### Agua
- Historico de pH.
- Historico de TDS.
- Historico de temperatura.
- Sub-aba de manutencao com:
  - registo
  - custo
  - observacoes
  - historico completo

### Relatorios
- Relatorio diario preparado para WhatsApp no numero `+244939667223`.
- Relatorio mensal consolidado com:
  - vendas
  - lucro
  - despesas
  - investimentos
  - medicoes
  - manutencoes
  - graficos do mes

## 2. Fluxo de navegacao (UX)

1. Abrir app e cair no Dashboard.
2. Ver rapidamente o estado do dia no topo.
3. Entrar em Vendas para registar operacoes.
4. Consultar Clientes quando houver deposito, saldo ou levantamento.
5. Consultar Estoque para reposicao de itens controlados.
6. Consultar Financas para despesas e investimentos.
7. Entrar em Agua para medicoes tecnicas e manutencao.
8. Ir a Relatorios para copiar o resumo diario ou validar o resumo mensal.

## 3. Sugestao de tecnologia

### MVP rapido
- Frontend: `React + Vite`
- UI: `Tailwind CSS` ou `CSS Modules`
- Graficos: `Recharts`
- Estado local: `Zustand`
- Backend: `Supabase` ou `Firebase`
- Base de dados: `PostgreSQL`
- Autenticacao: email e PIN simples por operador
- WhatsApp:
  - `WhatsApp Cloud API` para automacao real
  - fallback com link `wa.me`

### Versao de producao
- Frontend mobile/web: `Next.js` ou `React Native + Expo`
- Backend: `NestJS`
- DB: `PostgreSQL`
- Jobs e relatorios: `BullMQ + Redis`
- Hospedagem: `Vercel` no frontend e `Railway/Render/AWS` no backend

## 4. Modelo de banco de dados

### Tabelas principais

```sql
create table clients (
  id uuid primary key,
  name text not null,
  phone text not null,
  address text,
  balance numeric(12,2) default 0,
  created_at timestamp default now()
);

create table products (
  id uuid primary key,
  name text not null,
  sale_price numeric(12,2) not null,
  stock_controlled boolean default false
);

create table stock_items (
  id uuid primary key,
  product_id uuid references products(id),
  quantity integer not null default 0,
  avg_cost numeric(12,2) not null default 0,
  updated_at timestamp default now()
);

create table sales (
  id uuid primary key,
  client_id uuid references clients(id),
  product_id uuid references products(id),
  quantity integer not null,
  unit_price numeric(12,2) not null,
  total numeric(12,2) not null,
  payment_method text not null,
  entry_type text not null, -- sale | deposit | withdrawal
  counts_as_sale boolean not null,
  sold_at date not null,
  created_at timestamp default now()
);

create table finance_entries (
  id uuid primary key,
  type text not null, -- expense | investment
  category text not null,
  amount numeric(12,2) not null,
  entry_date date not null,
  created_at timestamp default now()
);

create table water_readings (
  id uuid primary key,
  ph numeric(4,2) not null,
  tds numeric(10,2) not null,
  temperature numeric(5,2) not null,
  reading_date date not null,
  created_at timestamp default now()
);

create table maintenance_logs (
  id uuid primary key,
  title text not null,
  notes text,
  cost numeric(12,2) not null,
  maintenance_date date not null,
  created_at timestamp default now()
);

create table report_logs (
  id uuid primary key,
  report_type text not null, -- daily | monthly
  destination text not null,
  payload_json jsonb not null,
  sent_at timestamp default now()
);
```

## 5. Ideia de layout visual

- Visual inspirado em app mobile premium.
- Sidebar escura com identidade forte da marca.
- Area principal clara com cards transluidos.
- Tipografia forte para numeros e indicadores.
- Graficos altos e legiveis, com cores sem ambiguidades.
- Blocos de acao rapida para:
  - nova venda
  - novo cliente
  - enviar relatorio
  - reposicao de estoque

## 6. Logica das regras principais

### Vendas
- `sale` conta como venda.
- `deposit` conta como venda e aumenta saldo do cliente.
- `withdrawal` nao conta como venda e reduz saldo do cliente.

### Estoque
- Apenas `Dispensador` e `Suporte completo` usam estoque.
- Antes de vender, o sistema valida disponibilidade.
- Depois da venda, subtrai quantidade e recalcula valor do estoque.

### Lucro
- `lucro = total_vendas - total_despesas - total_investimentos`

### Relatorio diario
- Consolidar:
  - vendas do dia
  - lucro do dia
  - despesas do dia
  - investimentos do dia
- Enviar por WhatsApp automaticamente numa versao backend.

### Relatorio mensal
- Consolidar todos os dados do mes.
- Gerar graficos de desempenho.
- Incluir resumo financeiro e tecnico.

## 7. Estrutura atual do prototipo

- `index.html`: layout da aplicacao
- `styles.css`: identidade visual e responsividade
- `app.js`: regras de negocio, persistencia local e integracao com Supabase
- `serve.ps1`: servidor local simples para abrir em `http://localhost:4173`
- `start-local-server.cmd`: atalho para iniciar o servidor local no Windows

## 8. Integracao com Supabase

- O app agora aceita configuracao do Supabase diretamente na aba `Relatorios`.
- Campos configuraveis:
  - `Project URL`
  - `Anon key`
  - nomes das tabelas
- Fluxo:
  1. Guardar credenciais
  2. Conectar
  3. Puxar dados do Supabase
  4. Continuar a operar com sincronizacao nas novas entradas
- O conector funciona melhor com estas colunas:
  - `clients`: `id`, `name`, `phone`, `address`, `balance`
  - `products`: `id`, `name`, `sale_price`, `stock_controlled`
  - `sales`: `id`, `client_id`, `product_id`, `quantity`, `total`, `payment_method`, `entry_type`, `sold_at`
  - `stock_items`: `product_id`, `quantity`, `avg_cost`
  - `finance_entries`: `id`, `type`, `category`, `amount`, `entry_date`
  - `water_readings`: `id`, `ph`, `tds`, `temperature`, `reading_date`
  - `maintenance_logs`: `id`, `title`, `notes`, `cost`, `maintenance_date`
- Na leitura, o app tambem tenta reconhecer alguns aliases comuns como `nome`, `telefone`, `saldo`, `preco`, `tipo`, `valor` e `data`.

## 9. Proximos passos recomendados

1. Migrar este prototipo para React.
2. Ligar a um backend com base de dados real.
3. Implementar autenticacao por perfis.
4. Automatizar relatorios via WhatsApp Cloud API.
5. Gerar PDF mensal com graficos e exportacao.

## 10. Como abrir localmente

### Opção rapida

- Dar duplo clique em `start-local-server.cmd`
- Abrir no navegador: `http://localhost:4173`

### Opção via PowerShell

```powershell
powershell -ExecutionPolicy Bypass -File .\serve.ps1 -Port 4173
```

Depois abra:

```text
http://localhost:4173
```
