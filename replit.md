# WaterGest

A management application prototype for a filtered water store (formerly "Agua Cristalina"; localStorage keys retain the old prefix to preserve existing user data), covering daily operations, financial control, client management, water quality monitoring, and reporting.

## Run & Operate

To run the application, execute `node server.js` which serves static files on port 5000.
The application uses `localStorage` for data persistence. Optional `Supabase` integration is configurable via the UI.

## Stack

- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3
- **Data persistence:** localStorage (with optional Supabase integration)
- **Fonts:** Google Fonts (Manrope, Space Grotesk)
- **Build Tool:** N/A (Vanilla JS)
- **Runtime:** Node.js (for dev server)

## Where things live

- `index.html`: Main application entry point with all views.
- `app.js`: Core logic, state management, DOM manipulation, charts, Supabase integration.
- `styles.css`: All styling with CSS variables.
- `server.js`: Simple Node.js static file server for development.
- `manifest.webmanifest`: PWA manifest file.
- `service-worker.js`: PWA service worker for caching.
- DB Schema: Implicit in `app.js`'s state management and `localStorage` keys.
- API Contracts: N/A (primarily client-side, Supabase interaction handled in `app.js`).

## Architecture decisions

- **Client-side first with optional cloud sync:** Prioritizes immediate usability and offline access via `localStorage`, with Supabase as an opt-in for cross-device synchronization, avoiding mandatory backend complexity for small businesses.
- **PWA for mobile experience:** Utilizes PWA capabilities for an installable, app-like experience without requiring native app development, focusing on accessibility and offline functionality.
- **Role-based access control:** Implements distinct roles (Admin, Operacao) to manage feature visibility and data manipulation, ensuring operational security and separation of duties within the store.
- **Modular fiscal compliance scaffolding:** Designed for future Angola tax authority (AGT) certification by including dedicated structures for fiscal configuration, document hashing, and SAF-T export, allowing for post-deployment certification.
- **Dynamic promotional product and stock management:** Promotions can define new products or composite kits, with automatic product catalog integration and stock management (including decomposition for kits) to streamline sales processes for promotional offers.

## Product

- Dashboard with real-time sales/finance summaries and charts.
- Sales tracking for various water products and dispensers.
- Client management, including balance and debt tracking.
- Inventory management.
- Financial control for expenses, investments, and profit.
- Water quality logging (pH, TDS, temperature).
- Daily report sharing via WhatsApp and monthly PDF reports.
- Multi-store support with isolated data and user accounts/roles.
- Admin client management (edit/delete clients) with history preservation.
- PWA installable for mobile experience.
- AGT (Angola tax authority) certification scaffolding (document hashing, SAF-T export, fiscal config).
- "Promoção" tab for managing and selling promotional items, including composite kits with auto-stock deduction.

## User preferences

- I want iterative development.
- I prefer clear and concise variable names.
- I like functional programming paradigms where they improve readability and maintainability.
- Ask for clarification before implementing significant changes or new features.

## Gotchas

- **Service Worker Cache Busting:** Always bump `CACHE_NAME` in `service-worker.js` when the precache list changes to ensure old caches are purged and new assets are loaded.
- **Fiscal Document Integrity:** Fiscal documents cannot be deleted, only "anulados" (cancelled), maintaining the integrity of the hash chain.
- **Promotional Product Stock:** For promotional products, especially kits, ensure sufficient stock of individual components is registered in the "Estoque" tab, as stock is decremented at the component level.
- **Admin Password Reset:** When an admin resets their *own* password, the active session (`ROLE_KEY`) is updated to reflect the new credentials.

## Pointers

- [jsPDF Documentation](https://artskydj.github.io/jsPDF/)
- [jspdf-autotable Documentation](https://github.com/simonbengtsson/jsPDF-AutoTable)
- [Supabase Documentation](https://supabase.com/docs)
- [PWA Builder](https://www.pwabuilder.com) (for generating Android APKs from PWA)
- [AG T (Angola Tax Authority) SAF-T (AO) Specification](https://www.agt.minfin.gov.ao) (external resource for fiscal compliance details)