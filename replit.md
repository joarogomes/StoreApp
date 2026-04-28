# AGUA CRISTALINA

## Project Overview
A management application prototype for a filtered water store (Loja de Água Filtrada). It covers daily operations, financial control, client management, water quality monitoring, and reporting.

## Tech Stack
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Data persistence:** localStorage (with optional Supabase integration configurable via UI)
- **Fonts:** Google Fonts (Manrope, Space Grotesk)
- **Server (dev):** Node.js built-in HTTP server (`server.js`)

## Project Structure
```
index.html      - Main app entry point with all views (Dashboard, Vendas, Clientes, Estoque, Financas, Agua, Relatorios)
app.js          - Core logic: state management, DOM manipulation, charts, Supabase integration
styles.css      - All styling with CSS variables
server.js       - Simple Node.js static file server for development (port 5000)
logo.png        - Brand asset used in sidebar
README.md       - Comprehensive docs in Portuguese
```

## Running the App
The workflow "Start application" runs `node server.js` which serves static files on port 5000.

## Deployment
Configured as a static site deployment (publicDir: ".").

## Features
- Dashboard with real-time sales/finance summaries and charts
- Sales tracking (different water sizes, dispensers)
- Client management with balance tracking
- Inventory management
- Financial control (expenses, investments, profit)
- Water quality logging (pH, TDS, temperature)
- Daily report sharing via WhatsApp; **monthly report exported as a professional branded PDF** (logo, summary cards, sales-by-product, sales-by-payment, daily-sales bar chart, top-products bar chart, expenses + investments tables) using jsPDF + jspdf-autotable (CDN).
- Optional Supabase sync for data persistence across devices
- Multi-store + user accounts:
  - Admin can create unlimited lojas in the **Acessos** tab; each loja has its own isolated data (sales, clients, stock, finance, water, maintenance, products) under localStorage keys `agua-cristalina-data-v5:<storeId>` and `agua-cristalina-data-v5:products:<storeId>`.
  - Each loja has its own WhatsApp report number, used by the WhatsApp daily report button.
  - Header includes a **Loja** switcher (hidden when the user only has access to one loja). Switching saves the current loja's data and reloads the selected loja's data.
  - Admin can create users in the **Acessos** tab, defining username, numeric password (4-8 digits), role (admin/operacao) and which lojas the user can operate. Use `*` (Todas) for full access (admin only). Each user card has a **Resetar senha** button so admins can change any user's password (including their own); resetting the current user's password also updates the active session in `ROLE_KEY`.
  - Default seed account (created on first run): Administrador (password `244100`, all lojas via `*`). The Operacao seed user is no longer created automatically — admin can create operacao users (and any other accounts) from the Acessos tab.
  - **No auto-seeded loja**. On a brand-new install (or any device with empty `agua-cristalina-stores-v1`), the Administrador can still log in with `244100`; immediately after authentication the app shows a "Configure a sua primeira loja" setup overlay (`#firstStoreOverlay`) where the admin enters the loja name + WhatsApp. After submission the loja is persisted, becomes the active loja, and the normal session continues. Non-admin users with zero allowed lojas continue to see the existing "Usuario sem lojas atribuidas" error and cannot log in. The setup overlay also exposes a "Sair" button that returns to the login screen.
  - Registries: `agua-cristalina-stores-v1`, `agua-cristalina-users-v1`, `agua-cristalina-current-store`. Session password persisted in `agua-cristalina-session`.
  - **One-time orphan-default cleanup**: on boot, after the legacy migration, `cleanupOrphanDefaultStore()` removes the auto-seeded `id="default" / name="AGUA CRISTALINA"` loja when (a) more than one loja exists, (b) the default still has its untouched seed name, (c) its data buckets (sales/finance/clients/stock/water/maintenance) are empty, (d) it is not the active loja, and (e) no user has it as their only allowed loja. Before deleting, a recoverable snapshot is written to `agua-cristalina-orphan-default-cleanup-v1:backup`; if that write fails the cleanup aborts. The success flag `agua-cristalina-orphan-default-cleanup-v1` is set only after a real removal so future eligible boots can still run. References to the default id are scrubbed from non-wildcard users (with fallback to the first remaining loja).
  - **One-time seed Operacao cleanup**: `cleanupSeedOperacaoUser()` removes the auto-seeded user `username="Operacao" / password="032026" / role="operacao"` only if it still has its untouched seed credentials and at least one admin user remains afterwards. If the active session belongs to that user, `ROLE_KEY` is cleared so the next boot returns to the login screen. Tracked by `agua-cristalina-seed-operacao-cleanup-v1`.
  - **Maintenance costs count as expenses everywhere.** `getAllExpenseEntries()` returns finance expenses + each `state.maintenance` entry normalized to `{type:"expense", category:"Manutencao", description, amount: cost, date, source:"maintenance"}`. This helper feeds the daily/monthly reports, dashboard period stats, finance analytics, and the monthly PDF (so maintenance lines appear in "Despesas do mes" and in the "Despesas por categoria" table under category `Manutencao`).
  - **Daily WhatsApp / clipboard report**: `buildDailyReportText()` produces a structured message with sections for Resumo financeiro (vendas + despesas + investimentos + lucro), Produtos vendidos (top 3), Recebimentos por metodo, Despesas detalhadas por categoria, Clientes (cadastrados / com saldo / com divida + total de divida) and Estoque baixo (qty <= 2). Both `sendWhatsappReport()` and `copyDailyReport()` use this same formatter; uses WhatsApp markdown (`*bold*`).
  - **Admin client management**: each card in the **Clientes** tab now has admin-only `Editar` and `Excluir` buttons (hidden by `.role-admin-only` for operacao). `onEditClient` prompts for name/phone/address and updates `customerName` on past sales referencing the client. `onDeleteClient` confirms (showing balance/divida warnings + linked sales count), then removes the client and detaches `clientId` on past sales (keeping `customerName` for historical reference). Both are gated by `requireAdmin()`.
  - **Operacao dashboard expanded**: operacao now sees the Lucro metric card AND the panels "KPI por produto", "Pagamentos do periodo" and "Saldo e dividas" (clients with balance > 0 OR debt > 0 only — empty state if none). The Lucro series toggle is enabled by default for operacao. Operacao remains restricted to Diario/Semanal periods and to the Dashboard / Vendas / Clientes / Agua tabs (Estoque / Financas / Relatorios / Acessos stay admin-only).
- **PWA / Mobile app**: the site is installable as a Progressive Web App. `manifest.webmanifest` declares name/short_name/icons/theme_color/standalone display, `service-worker.js` (cache `agua-cristalina-cache-v3`) precaches only the static asset shell (`manifest.webmanifest`, `assets/logo.png`, `assets/login-logo.png`) and uses **network-first** for navigations and for any mutable asset (paths `/`, `/index.html`, `/app.js`, `/styles.css` plus any `.html`/`.js`/`.css` request) so app updates are picked up on every reload, falling back to cache only when offline. Other GETs (fonts/CDN images on same origin) use cache-first. The SW is registered on https/localhost only via `registerServiceWorker()` in `app.js` (skips the Replit dev preview safely; Replit deployments are https and will register normally). Meta tags include `theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`, `apple-mobile-web-app-title`, `mobile-web-app-capable`, `viewport-fit=cover`. **Bump `CACHE_NAME` whenever the precache list changes** so the activate handler can purge the old cache. To turn the deployed PWA into an Android APK use https://www.pwabuilder.com — paste the deployed `.replit.app` URL, click Package For Stores → Android, choose "Signed APK" (PWABuilder generates a key for you), download the `.zip` and install the `.apk` on the phone (enable Settings → Security → Install unknown apps for the browser/file manager).
- Roles:
  - **Admin**: full access to all tabs (including Estoque, Financas, Facturação, Relatorios, Acessos) and dashboards.
  - **Operacao**: restricted to Dashboard / Vendas / Clientes / Agua tabs, sees only daily/weekly profit, sales+expenses chart, can only register today's sales (forced) and quick expenses, plus the WhatsApp daily report.
- **AGT (Angola tax authority) certification scaffolding**: built so the app can become certifiable once the producer receives the AGT-issued software validation number and RSA private key. Implemented now (no signing key yet):
  - **Per-store fiscal config** persisted on the store object (`store.fiscal`) via `agua-cristalina-stores-v1`: `nif`, `legalName`, `address`, `municipality`, `province`, `fiscalRegime` (GERAL/SIMPLIFICADO/NAO_SUJEICAO/ISENTO), `defaultVatRate` (14/7/5/0), `documentSeries` (e.g. `A2026`), `defaultDocumentType` (FR or FT), `softwareValidationNumber` (left empty until AGT certifies), `defaultExemptionReason` (M01/M02/M04/M07/M99). Admin-only form `#fiscalConfigForm` lives in the **Acessos** tab.
  - **Client NIF** field on `#clientForm` and `onEditClient`. Stored on `client.nif`. Documents fall back to `999999999` (Consumidor Final) when blank.
  - **Product VAT rate** field on `#productForm` (`vatRate` 14/7/5/0 or empty for default). Resolved by `getProductVatRate(product)` which falls back to the store's `defaultVatRate`, then to 14.
  - **Document hash chain**: each emitted document stores `hashFull` (SHA-1 base64 of `issueDate;systemDateTime;documentNumber;grossTotal.toFixed(2);previousHash`) and `hashCompact` (4 chars at positions 0/10/20/30 — AGT format `_____`). Hashing uses `crypto.subtle.digest("SHA-1", ...)`. The chain is **per document type per fiscal year** (matches the AGT spec). RSA signing is left as `signature: ""` and a stub TODO — when the producer gets the RSA key, plug it into `issueFiscalDocument` to sign the same payload.
  - **Sequential numbering** per series + type: `nextDocumentNumber(type, series)` — no gaps. Format `FT A2026/0001`. Documents cannot be deleted, only **anulados** (`status="cancelled"`, `cancelReason`, `cancelledAt`); cancelled docs stay in the chain.
  - **Auto-issuance**: `onCreateSale` calls `issueFiscalDocument({ type: store.fiscal.defaultDocumentType, sale })` when `entryType === "sale"` AND `isFiscalConfigured()` is true (NIF + legalName + address + documentSeries all set). Sales with no fiscal config still work (legacy mode). Other entry types (deposit/withdrawal/debt/settlement) do not emit fiscal documents.
  - **Facturação tab** (admin-only, between Água and Relatórios): lists all documents with filters (type/status/client search), per-row buttons for **PDF** and **Anular** (prompts for motivo), banner showing fiscal status (configurar / aguarda nº de validação / certificado) and a **"Exportar SAF-T (AO) do mês"** button gated on `<input type="month">`.
  - **PDF**: `downloadInvoicePdf(id)` uses jsPDF + jspdf-autotable (already loaded via CDN) to produce an AGT-style invoice with header (legalName/NIF/address/regime), document number, date, cliente block (NIF), itens table (descrição/qtd/preço/IVA%/subtotal/IVA/total), resumo do IVA por taxa, motivo de isenção quando aplicável, total a pagar, forma de pagamento, hash compact and either *"Processado por programa validado n.º X/AGT"* or *"Aguarda número de validação da AGT — documento NÃO certificado."* depending on whether `softwareValidationNumber` is set.
  - **SAF-T (AO) export**: `buildSaftXml(year, month)` returns AGT 1.01_01-style XML with `<Header>` (companyID, taxRegistrationNumber, fiscalYear, period, currency AOA, software product/validation number), `<MasterFiles>` (Customers used in the period, Products, TaxTable with one entry per IVA rate found), and `<SourceDocuments>/<SalesInvoices>` with each invoice including `<Hash>`, `<HashControl>1</HashControl>`, `<InvoiceStatus>`, `<Line>` items (with `<Tax>` and `<TaxExemptionReason>/<TaxExemptionCode>` when rate is 0%) and `<DocumentTotals>`. Downloaded as `SAFT-AO-<NIF>-<year>-<month>.xml`.
  - **State**: `state.documents` is the canonical document store on each loja's localStorage bucket; `emptyState()` initialises it. `normalizeState` merges with an empty list when missing in older data.
  - **Constants**: `VAT_RATES`, `FISCAL_REGIMES`, `DOCUMENT_TYPES` (FT/FR/RC/NC/ND), `VAT_EXEMPTION_REASONS`, `SOFTWARE_PRODUCT_NAME = "AGUA CRISTALINA Gestao"`, `SOFTWARE_PRODUCT_VERSION = "1.0.0"` — bump version on production-affecting changes per AGT requirement.

### Promoção tab (added 2026-04-28)
- **Nav**: "Promoção" tab visible to all roles (between Água and Sincronizar). View id `promocoes`.
- **State**: `state.promotions[]` per loja, persisted via `saveState()`. Each promo: `{ id, title, description (multi-line, one item per line), startDate, endDate, createdAt }`. `emptyState()` and `normalizeState()` initialise the array.
- **Seed**: `seedDefaultPromotionIfNeeded()` (gated on `localStorage["promo:workers-week-2026:seeded"]`) inserts the **Semana do Trabalhador** promo (28/04 → 05/05/2026) with Dispensador eléctrico 2999 Kz, Suporte Completo 5300 Kz, Kit Suporte Completo + Galão 20L + Enchimento 9990 Kz.
- **UX**: green theme (`#16a34a`), card grid, badges per status: **active** (green pill, with countdown), **upcoming** (cyan), **expired** (grey). When `daysLeft ≤ 3` the active badge gets `.promo-badge-blink` (1s opacity+ring keyframes `promoBlink`).
- **Editor** (admin-only via `role-admin-only` on the form panel and the **+ Nova promoção** button + Editar/Remover actions): create/update/delete promotions with title, multi-line description, start/end dates. Operadores só visualizam.
- **Files**: `index.html` view + form, `app.js` end-of-file block (`bindPromotions`, `renderPromotions`, `onSavePromotion`, `deletePromotion`, helpers `todayISO`/`daysBetween`/`formatDatePT`), `styles.css` `.promo-*` classes. Service-worker bumped to v4.

### Promoção — botão "Vender" por item (added 2026-04-28)
- Cada linha da descrição da promoção (formato `Nome — Preço Kz`) ganha um botão verde **"Vender"** quando a promoção está activa (entre startDate e endDate).
- `parsePromoLine(line)` extrai `{name, price}` (suporta separadores `—`, `–`, `-`; preço com pontos/vírgulas; sufixo `Kz/AOA` opcional).
- `ensurePromoProductInCatalog(promo, parsed)` cria (uma vez) um produto no `productCatalog` com id determinístico `promo-<promoId>-<slug>`, nome `"<Nome> (<Título da promoção>)"`, `price = parsed.price`, `stockControlled: true`, `vatRate: 14`, `isPromotional: true`, `promoId`. Se já existir mas o preço mudou, actualiza. Persiste via `saveState()`.
- `startPromoSale(promo, line)` salta para a aba **Vendas**, pré-selecciona o produto promocional, faz `renderSelects/renderStock/renderSalePreview` e avisa se ainda não há stock registado para esse SKU.
- Stock cai automaticamente na confirmação porque o produto tem `stockControlled:true` (caminho normal de `onCreateSale`). Admin tem de adicionar uma vez o stock dos SKUs promocionais na aba Estoque.
- Service-worker bumped to v5.

### Promoção — kits compostos + auto-stock (added 2026-04-28)
- **Auto-seed de produtos & stock**: `seedDefaultPromotionIfNeeded` (chave `promo:workers-week-2026:seeded` → `done-v2`) cria automaticamente os produtos promocionais no catálogo e regista uma entrada inicial em `state.stock` com `PROMO_DEFAULT_INITIAL_STOCK = 10` unidades para cada SKU. Idempotente: re-executa quando promo existe sem `itemMeta` (migração de utilizadores que estavam em v1 do seed).
- **Componentes de kits (produto-pacote)**:
  - O seed da Semana do Trabalhador inclui `promo.itemMeta["Kit Suporte Completo + Galão 20L + Enchimento"].components = [Suporte Completo×1, Galão 20L×1, Enchimento 20L×1]`.
  - `ensurePromoComponentProduct(promo, name)` cria SKUs de componentes com `price:0`, `stockControlled:true`, `isComponent:true` e respectiva entrada de stock inicial (10 un).
  - `ensurePromoProductInCatalog`: quando o item tem componentes (`itemMeta`), o produto-kit fica `stockControlled:false` e ganha `components: [{productId, name, qty}]`. Quando não tem, fica `stockControlled:true` com a sua própria entrada de stock.
- **Decomposição na venda**: `onCreateSale` valida primeiro se o produto tem `components[]`. Se sim, percorre cada componente e:
  1. Verifica se existe stock suficiente (qty × quantidade vendida).
  2. Decrementa o stock de cada componente.
  3. Soma `unitCost × needed` ao `costTotal` da venda.
  4. Não decrementa o produto-kit em si (porque tem `stockControlled:false`).
  Se algum componente não tiver stock suficiente, a venda é abortada antes de qualquer escrita.
- **Compatibilidade**: produtos sem `components` continuam a usar o fluxo original (decremento directo do próprio SKU).
- Service-worker bumped to v6.
