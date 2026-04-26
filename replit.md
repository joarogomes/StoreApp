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
- **PWA / Mobile app**: the site is installable as a Progressive Web App. `manifest.webmanifest` declares name/short_name/icons/theme_color/standalone display, `service-worker.js` (cache `agua-cristalina-cache-v2`) precaches only the static asset shell (`manifest.webmanifest`, `assets/logo.png`, `assets/login-logo.png`) and uses **network-first** for navigations and for any mutable asset (paths `/`, `/index.html`, `/app.js`, `/styles.css` plus any `.html`/`.js`/`.css` request) so app updates are picked up on every reload, falling back to cache only when offline. Other GETs (fonts/CDN images on same origin) use cache-first. The SW is registered on https/localhost only via `registerServiceWorker()` in `app.js` (skips the Replit dev preview safely; Replit deployments are https and will register normally). Meta tags include `theme-color`, `apple-mobile-web-app-capable`, `apple-touch-icon`, `apple-mobile-web-app-title`, `mobile-web-app-capable`, `viewport-fit=cover`. **Bump `CACHE_NAME` whenever the precache list changes** so the activate handler can purge the old cache. To turn the deployed PWA into an Android APK use https://www.pwabuilder.com — paste the deployed `.replit.app` URL, click Package For Stores → Android, choose "Signed APK" (PWABuilder generates a key for you), download the `.zip` and install the `.apk` on the phone (enable Settings → Security → Install unknown apps for the browser/file manager).
- Roles:
  - **Admin**: full access to all tabs (including Estoque, Financas, Relatorios, Acessos) and dashboards.
  - **Operacao**: restricted to Dashboard / Vendas / Clientes / Agua tabs, sees only daily/weekly profit, sales+expenses chart, can only register today's sales (forced) and quick expenses, plus the WhatsApp daily report.
