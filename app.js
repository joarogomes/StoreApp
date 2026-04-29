const STORAGE_KEY = "agua-cristalina-data-v5";
const ORPHAN_DEFAULT_CLEANUP_KEY = "agua-cristalina-orphan-default-cleanup-v1";
const SEED_OPERACAO_CLEANUP_KEY = "agua-cristalina-seed-operacao-cleanup-v1";
const SUPABASE_KEY = "agua-cristalina-supabase-config-v2";
const ROLE_KEY = "agua-cristalina-session";
const STORES_KEY = "agua-cristalina-stores-v1";
const USERS_KEY = "agua-cristalina-users-v1";
const CURRENT_STORE_KEY = "agua-cristalina-current-store";

const DEFAULT_STORE_ID = "default";
const DEFAULT_STORE_NAME = "AGUA CRISTALINA";
const DEFAULT_REPORT_PHONE = "+244939667223";
const ROLE_LABELS = { admin: "Administrador", operacao: "Operacao" };

const VAT_RATES = [14, 7, 5, 0];
const FISCAL_REGIMES = {
  GERAL: "Regime Geral",
  SIMPLIFICADO: "Regime Simplificado",
  NAO_SUJEICAO: "Não sujeição",
  ISENTO: "Isento"
};
const DOCUMENT_TYPES = {
  FT: "Factura",
  FR: "Factura/Recibo",
  RC: "Recibo",
  NC: "Nota de Crédito",
  ND: "Nota de Débito"
};
const VAT_EXEMPTION_REASONS = {
  M01: "Artigo 12.º do CIVA",
  M02: "Artigo 13.º do CIVA",
  M04: "Operação não localizada em território angolano",
  M07: "Regime de IVA Simplificado",
  M99: "Outras isenções (declarar fundamentação)"
};
const SOFTWARE_PRODUCT_VERSION = "1.0.0";
const SOFTWARE_PRODUCT_NAME = "AGUA CRISTALINA Gestao";

let currentRole = null;
let currentUser = null;
let sessionStarted = false;
let stores = [];
let users = [];
let activeStoreId = null;
const today = new Date().toISOString().slice(0, 10);

const defaultTables = {
  stores: "stores",
  clients: "customers",
  products: "products",
  stock: "inventory_items",
  movements: "inventory_movements",
  sales: "sales",
  expenses: "expenses",
  investments: "investments",
  water: "water_quality_records",
  maintenance: "maintenance_records"
};

const defaultSupabaseConfig = {
  url: "https://hpnucfsocbfnikrjwvdc.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhwbnVjZnNvY2Jmbmlrcmp3dmRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NDk4MjUsImV4cCI6MjA5MjUyNTgyNX0.ayY28Vg5SnvJ0DRXmJTd3JVKxnsNfTdf43p6TKcm03Q",
  tables: { ...defaultTables }
};

const baseProducts = [
  { id: "water20", name: "Agua 20L", price: 500, stockControlled: false, unit: "un" },
  { id: "water6", name: "Agua 6L", price: 200, stockControlled: false, unit: "un" },
  { id: "water15", name: "Agua 1.5L", price: 50, stockControlled: false, unit: "un" },
  { id: "dispenser", name: "Dispensador", price: 4500, stockControlled: true, unit: "un" },
  { id: "support", name: "Suporte completo", price: 6000, stockControlled: true, unit: "un" }
];

const demoData = {
  clients: [
    { id: crypto.randomUUID(), name: "Maria Domingos", phone: "+244923111222", address: "Benfica", balance: 3500, debt: 0 },
    { id: crypto.randomUUID(), name: "Carlos Mateus", phone: "+244924333444", address: "Viana", balance: 0, debt: 1500 },
    { id: crypto.randomUUID(), name: "Escola Sol Nascente", phone: "+244925777888", address: "Kilamba", balance: 6000, debt: 0 }
  ],
  stock: [
    { id: crypto.randomUUID(), productId: "dispenser", quantity: 8, unitCost: 2600 },
    { id: crypto.randomUUID(), productId: "support", quantity: 12, unitCost: 3200 }
  ],
  sales: [
    { id: crypto.randomUUID(), clientId: "", customerName: "Maria Domingos", productId: "water20", productName: "Agua 20L", quantity: 20, paymentMethod: "Consolidada", entryType: "sale", date: today, total: 10000 },
    { id: crypto.randomUUID(), clientId: "", customerName: "Carlos Mateus", productId: "water6", productName: "Agua 6L", quantity: 25, paymentMethod: "TPA", entryType: "sale", date: today, total: 5000 },
    { id: crypto.randomUUID(), clientId: "", customerName: "Escola Sol Nascente", productId: "dispenser", productName: "Dispensador", quantity: 1, paymentMethod: "Express", entryType: "sale", date: today, total: 4500 }
  ],
  finance: [
    { id: crypto.randomUUID(), type: "expense", category: "Energia", amount: 4200, description: "Conta do dia", date: today },
    { id: crypto.randomUUID(), type: "investment", category: "Filtros", amount: 8000, description: "Reposicao de filtros", date: offsetDate(-3) }
  ],
  waterReadings: [
    { id: crypto.randomUUID(), ph: 7.1, tds: 84, temperature: 17.6, date: today, notes: "" },
    { id: crypto.randomUUID(), ph: 7.3, tds: 81, temperature: 18.2, date: offsetDate(-1), notes: "" }
  ],
  maintenance: [
    { id: crypto.randomUUID(), title: "Troca de filtro", cost: 6500, notes: "Filtro principal substituido", date: offsetDate(-4) }
  ]
};

let state = loadState();
let productCatalog = loadProductCatalog();
let currentPeriod = "daily";
let periodAnchor = today;
let activeSeries = { sales: true, expenses: true, profit: true };
let financePeriod = "daily";
let financeAnchor = today;
let activeFinanceSeries = { expenses: true, investments: true, impact: true };
let waterMetric = "ph";
let supabaseConfig = loadSupabaseConfig();
let supabaseClient = null;
let currentStore = null;
let syncState = { tone: "warning", text: "Modo local. Configure o Supabase para sincronizar." };

migrateClientsForDebt();

const views = [...document.querySelectorAll(".view")];
const navTabs = [...document.querySelectorAll(".nav-tab")];
const dashboardPeriodButtons = [...document.querySelectorAll("#periodSwitch .period-button")];
const financePeriodButtons = [...document.querySelectorAll("#financePeriodSwitch .period-button")];
const waterMetricButtons = [...document.querySelectorAll("#waterMetricSwitch .period-button")];

boot();
registerServiceWorker();

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => null);
  });
}

async function boot() {
  loadStoresAndUsers();
  migrateLegacyDataIfNeeded();
  cleanupOrphanDefaultStore();
  cleanupSeedOperacaoUser();
  bindLogin();
  bindFirstStoreSetup();
  const savedPassword = localStorage.getItem(ROLE_KEY);
  const savedUser = savedPassword ? users.find((u) => u.password === savedPassword) : null;
  const adminWithoutStore = savedUser && savedUser.role === "admin" && stores.length === 0;
  if (savedUser && (allowedStoresFor(savedUser).length > 0 || adminWithoutStore)) {
    await startSession(savedUser, { silent: true });
  } else {
    localStorage.removeItem(ROLE_KEY);
    showLoginScreen();
  }
}

function loadStoresAndUsers() {
  try {
    const rawStores = localStorage.getItem(STORES_KEY);
    stores = rawStores ? JSON.parse(rawStores) : [];
  } catch {
    stores = [];
  }
  try {
    const rawUsers = localStorage.getItem(USERS_KEY);
    users = rawUsers ? JSON.parse(rawUsers) : [];
  } catch {
    users = [];
  }
  if (!Array.isArray(stores)) stores = [];
  if (!Array.isArray(users) || users.length === 0) {
    users = [
      { id: crypto.randomUUID(), username: "Administrador", password: "244100", role: "admin", allowedStoreIds: ["*"] }
    ];
    persistUsers();
  }
}

function migrateLegacyDataIfNeeded() {
  const legacyState = localStorage.getItem(STORAGE_KEY);
  const legacyProducts = localStorage.getItem(`${STORAGE_KEY}:products`);
  const targetStateKey = stateKeyFor(DEFAULT_STORE_ID);
  const targetProductsKey = productsKeyFor(DEFAULT_STORE_ID);
  if (legacyState && !localStorage.getItem(targetStateKey)) {
    localStorage.setItem(targetStateKey, legacyState);
  }
  if (legacyProducts && !localStorage.getItem(targetProductsKey)) {
    localStorage.setItem(targetProductsKey, legacyProducts);
  }
  if (legacyState) localStorage.removeItem(STORAGE_KEY);
  if (legacyProducts) localStorage.removeItem(`${STORAGE_KEY}:products`);
}

function defaultStoreHasUserData() {
  try {
    const raw = localStorage.getItem(stateKeyFor(DEFAULT_STORE_ID));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return true;
    const counts = [
      Array.isArray(parsed.sales) ? parsed.sales.length : 0,
      Array.isArray(parsed.finance) ? parsed.finance.length : 0,
      Array.isArray(parsed.clients) ? parsed.clients.length : 0,
      Array.isArray(parsed.stock) ? parsed.stock.length : 0,
      Array.isArray(parsed.waterReadings) ? parsed.waterReadings.length : 0,
      Array.isArray(parsed.maintenance) ? parsed.maintenance.length : 0
    ];
    return counts.some((n) => n > 0);
  } catch {
    return true;
  }
}

function defaultStoreHasCustomProducts() {
  try {
    const raw = localStorage.getItem(productsKeyFor(DEFAULT_STORE_ID));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return true;
    return parsed.length > 0;
  } catch {
    return true;
  }
}

function cleanupOrphanDefaultStore() {
  if (localStorage.getItem(ORPHAN_DEFAULT_CLEANUP_KEY)) return;
  if (!Array.isArray(stores) || stores.length <= 1) return;
  const defaultStore = stores.find((s) => s.id === DEFAULT_STORE_ID);
  if (!defaultStore) return;
  if (defaultStore.name !== DEFAULT_STORE_NAME) return;
  if (defaultStoreHasUserData()) return;
  if (defaultStoreHasCustomProducts()) return;
  const currentStoreId = localStorage.getItem(CURRENT_STORE_KEY);
  if (currentStoreId === DEFAULT_STORE_ID) return;
  const referencedByUser = Array.isArray(users) && users.some((u) => {
    const ids = u?.allowedStoreIds;
    return Array.isArray(ids) && !ids.includes("*") && ids.length === 1 && ids[0] === DEFAULT_STORE_ID;
  });
  if (referencedByUser) return;

  const removedSnapshot = {
    version: 1,
    store: defaultStore,
    state: localStorage.getItem(stateKeyFor(DEFAULT_STORE_ID)),
    products: localStorage.getItem(productsKeyFor(DEFAULT_STORE_ID)),
    timestamp: new Date().toISOString()
  };
  try {
    localStorage.setItem(`${ORPHAN_DEFAULT_CLEANUP_KEY}:backup`, JSON.stringify(removedSnapshot));
  } catch {
    return;
  }

  stores = stores.filter((s) => s.id !== DEFAULT_STORE_ID);
  persistStores();
  localStorage.removeItem(stateKeyFor(DEFAULT_STORE_ID));
  localStorage.removeItem(productsKeyFor(DEFAULT_STORE_ID));
  if (Array.isArray(users) && users.length) {
    let changed = false;
    users = users.map((u) => {
      if (!Array.isArray(u.allowedStoreIds)) return u;
      if (u.allowedStoreIds.includes("*")) return u;
      const filtered = u.allowedStoreIds.filter((id) => id !== DEFAULT_STORE_ID);
      if (filtered.length === u.allowedStoreIds.length) return u;
      changed = true;
      return { ...u, allowedStoreIds: filtered.length ? filtered : [stores[0].id] };
    });
    if (changed) persistUsers();
  }
  localStorage.setItem(ORPHAN_DEFAULT_CLEANUP_KEY, "done");
}

function cleanupSeedOperacaoUser() {
  if (localStorage.getItem(SEED_OPERACAO_CLEANUP_KEY)) return;
  if (!Array.isArray(users) || users.length < 2) return;
  const seedOperacao = users.find((u) => u && u.role === "operacao" && u.username === "Operacao" && u.password === "032026");
  if (!seedOperacao) return;
  const remainingAdmins = users.filter((u) => u !== seedOperacao && u.role === "admin" && allowedStoresFor(u).length > 0);
  if (!remainingAdmins.length) return;
  const sessionPassword = localStorage.getItem(ROLE_KEY);
  if (sessionPassword === seedOperacao.password) localStorage.removeItem(ROLE_KEY);
  users = users.filter((u) => u !== seedOperacao);
  persistUsers();
  localStorage.setItem(SEED_OPERACAO_CLEANUP_KEY, "done");
}

function persistStores() {
  localStorage.setItem(STORES_KEY, JSON.stringify(stores));
}

function persistUsers() {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function stateKeyFor(storeId) {
  return `${STORAGE_KEY}:${storeId}`;
}

function productsKeyFor(storeId) {
  return `${STORAGE_KEY}:products:${storeId}`;
}

function getActiveStore() {
  return stores.find((s) => s.id === activeStoreId) || stores[0] || null;
}

function userHasAccessToStore(user, storeId) {
  if (!user || !storeId) return false;
  const allowed = user.allowedStoreIds || [];
  return allowed.includes("*") || allowed.includes(storeId);
}

function allowedStoresFor(user) {
  if (!user) return [];
  if ((user.allowedStoreIds || []).includes("*")) return stores.slice();
  return stores.filter((s) => user.allowedStoreIds.includes(s.id));
}

function pickInitialStore(user) {
  const remembered = localStorage.getItem(CURRENT_STORE_KEY);
  if (remembered && userHasAccessToStore(user, remembered) && stores.some((s) => s.id === remembered)) {
    return remembered;
  }
  const allowed = allowedStoresFor(user);
  return allowed.length ? allowed[0].id : stores[0]?.id || null;
}

function showLoginScreen() {
  document.getElementById("loginOverlay")?.removeAttribute("hidden");
  document.getElementById("appShell")?.setAttribute("hidden", "");
  document.getElementById("loginPassword")?.focus();
}

function hideLoginScreen() {
  document.getElementById("loginOverlay")?.setAttribute("hidden", "");
  document.getElementById("appShell")?.removeAttribute("hidden");
}

function bindLogin() {
  document.getElementById("loginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("loginPassword");
    const errorBox = document.getElementById("loginError");
    const password = String(input.value || "").trim();
    const user = users.find((u) => u.password === password);
    if (!user) {
      errorBox?.removeAttribute("hidden");
      input.value = "";
      input.focus();
      return;
    }
    if (!allowedStoresFor(user).length) {
      if (!(user.role === "admin" && stores.length === 0)) {
        errorBox && (errorBox.textContent = "Usuario sem lojas atribuidas. Contacte o administrador.");
        errorBox?.removeAttribute("hidden");
        input.value = "";
        return;
      }
    }
    errorBox?.setAttribute("hidden", "");
    input.value = "";
    startSession(user);
  });
}

async function startSession(user, { silent = false } = {}) {
  currentUser = user;
  currentRole = user.role;
  localStorage.setItem(ROLE_KEY, user.password);

  if (stores.length === 0) {
    if (user.role !== "admin") {
      logout();
      return;
    }
    showFirstStoreSetup();
    return;
  }

  activeStoreId = pickInitialStore(user);
  if (activeStoreId) localStorage.setItem(CURRENT_STORE_KEY, activeStoreId);

  state = loadState();
  productCatalog = loadProductCatalog();

  applyRolePermissions();
  hideFirstStoreSetup();
  hideLoginScreen();

  if (!sessionStarted) {
    sessionStarted = true;
    hydrateDates();
    bindNavigation();
    bindForms();
    bindFilters();
    bindSupabaseControls();
    bindInteractiveControls();
    bindStoreSwitcher();
    bindAccessManagement();
    bindPromotions();
    renderSupabaseConfig();
    renderStoreSwitcher();
    renderAccessManagement();
    renderAll();
    await initializeSupabaseSession({ autoPull: true, silent: true });
  } else {
    renderStoreSwitcher();
    renderAccessManagement();
    renderAll();
  }
}

function logout() {
  localStorage.removeItem(ROLE_KEY);
  currentUser = null;
  currentRole = null;
  hideFirstStoreSetup();
  showLoginScreen();
}

function showFirstStoreSetup() {
  document.getElementById("loginOverlay")?.setAttribute("hidden", "");
  document.getElementById("appShell")?.setAttribute("hidden", "");
  const overlay = document.getElementById("firstStoreOverlay");
  if (!overlay) return;
  overlay.removeAttribute("hidden");
  const errorBox = document.getElementById("firstStoreError");
  errorBox?.setAttribute("hidden", "");
  document.getElementById("firstStoreName")?.focus();
}

function hideFirstStoreSetup() {
  document.getElementById("firstStoreOverlay")?.setAttribute("hidden", "");
}

function bindFirstStoreSetup() {
  const form = document.getElementById("firstStoreForm");
  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentUser || currentUser.role !== "admin") return;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton?.disabled) return;
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    let whatsapp = String(data.get("whatsapp") || "").trim();
    const errorBox = document.getElementById("firstStoreError");
    const showError = (message) => {
      if (!errorBox) return;
      errorBox.textContent = message;
      errorBox.removeAttribute("hidden");
    };
    errorBox?.setAttribute("hidden", "");
    if (errorBox) errorBox.textContent = "";
    if (!name) {
      showError("Indique o nome da loja.");
      return;
    }
    if (whatsapp && !whatsapp.startsWith("+")) whatsapp = `+${whatsapp.replace(/[^0-9]/g, "")}`;
    if (!whatsapp) whatsapp = DEFAULT_REPORT_PHONE;
    const id = `loja-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newStore = { id, name, whatsapp };
    if (submitButton) submitButton.disabled = true;
    try {
      stores.push(newStore);
      persistStores();
      localStorage.setItem(CURRENT_STORE_KEY, id);
    } catch (error) {
      stores = stores.filter((s) => s !== newStore);
      showError("Nao foi possivel guardar a loja. Verifique o armazenamento e tente de novo.");
      if (submitButton) submitButton.disabled = false;
      return;
    }
    form.reset();
    hideFirstStoreSetup();
    try {
      await startSession(currentUser, { silent: true });
    } catch (error) {
      showError("Loja criada, mas houve uma falha ao iniciar a sessao. Recarregue a pagina.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  document.getElementById("firstStoreLogout")?.addEventListener("click", () => {
    logout();
  });
}

function applyRolePermissions() {
  document.body.classList.toggle("role-admin", currentRole === "admin");
  document.body.classList.toggle("role-operacao", currentRole === "operacao");
  const label = document.getElementById("sessionRoleLabel");
  if (label) {
    const fullName = currentUser?.username || ROLE_LABELS[currentRole] || "-";
    label.textContent = fullName.slice(0, 3);
    label.title = fullName;
  }

  if (currentRole === "operacao") {
    if (currentPeriod !== "daily" && currentPeriod !== "weekly") {
      currentPeriod = "daily";
      dashboardPeriodButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.period === "daily"));
    }
    const activeTab = document.querySelector(".nav-tab.active");
    if (activeTab && activeTab.classList.contains("role-admin-only")) {
      const fallback = document.querySelector(".nav-tab:not(.role-admin-only)");
      fallback?.click();
    }
    const saleEntry = document.getElementById("saleEntryType");
    if (saleEntry) saleEntry.value = "sale";
    const saleDate = document.getElementById("saleDate");
    if (saleDate) {
      saleDate.value = today;
      saleDate.min = today;
      saleDate.max = today;
    }
    activeSeries.profit = true;
    document.querySelectorAll('#seriesToggles input[data-series="profit"]').forEach((input) => {
      input.checked = true;
    });
  } else {
    const saleDate = document.getElementById("saleDate");
    if (saleDate) {
      saleDate.removeAttribute("min");
      saleDate.removeAttribute("max");
    }
    activeSeries.profit = true;
    document.querySelectorAll('#seriesToggles input[data-series="profit"]').forEach((input) => {
      input.checked = true;
    });
  }
}

function loadState() {
  const storeId = activeStoreId || DEFAULT_STORE_ID;
  const saved = localStorage.getItem(stateKeyFor(storeId));
  if (saved) {
    try {
      return normalizeState(JSON.parse(saved));
    } catch {
      return emptyState();
    }
  }
  return storeId === DEFAULT_STORE_ID ? normalizeState(structuredClone(demoData)) : emptyState();
}

function saveState() {
  const storeId = activeStoreId || DEFAULT_STORE_ID;
  localStorage.setItem(stateKeyFor(storeId), JSON.stringify(state));
  localStorage.setItem(productsKeyFor(storeId), JSON.stringify(productCatalog));
}

function loadProductCatalog() {
  const storeId = activeStoreId || DEFAULT_STORE_ID;
  const saved = localStorage.getItem(productsKeyFor(storeId));
  if (saved) return JSON.parse(saved);
  return storeId === DEFAULT_STORE_ID ? structuredClone(baseProducts) : structuredClone(baseProducts);
}

function emptyState() {
  return {
    clients: [],
    stock: [],
    sales: [],
    finance: [],
    waterReadings: [],
    maintenance: [],
    documents: [],
    promotions: []
  };
}

function normalizeState(raw) {
  const base = emptyState();
  const merged = { ...base, ...(raw || {}) };
  for (const key of Object.keys(base)) {
    if (!Array.isArray(merged[key])) merged[key] = [];
  }
  return merged;
}

function loadSupabaseConfig() {
  const saved = localStorage.getItem(SUPABASE_KEY);
  if (!saved) return structuredClone(defaultSupabaseConfig);
  const parsed = JSON.parse(saved);
  return {
    ...defaultSupabaseConfig,
    ...parsed,
    tables: { ...defaultTables, ...(parsed.tables || {}) }
  };
}

function saveSupabaseConfig() {
  localStorage.setItem(SUPABASE_KEY, JSON.stringify(supabaseConfig));
}

function hydrateDates() {
  ["saleDate", "financeDate", "waterDate", "maintenanceDate"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = today;
  });
}

function closeMobileMenu() {
  document.body.classList.remove("menu-open");
  document.getElementById("mobileMenuToggle")?.setAttribute("aria-expanded", "false");
}

function bindNavigation() {
  navTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      navTabs.forEach((item) => item.classList.toggle("active", item === tab));
      views.forEach((view) => view.classList.toggle("active", view.id === tab.dataset.view));
      document.getElementById("viewTitle").textContent = tab.textContent;
      closeMobileMenu();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  const menuToggle = document.getElementById("mobileMenuToggle");
  const overlay = document.getElementById("mobileOverlay");
  menuToggle?.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });
  overlay?.addEventListener("click", closeMobileMenu);

  dashboardPeriodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      currentPeriod = button.dataset.period;
      dashboardPeriodButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderDashboard();
    });
  });

  document.getElementById("periodPrev")?.addEventListener("click", () => shiftPeriodAnchor(-1));
  document.getElementById("periodNext")?.addEventListener("click", () => shiftPeriodAnchor(1));
  document.getElementById("periodToday")?.addEventListener("click", () => {
    periodAnchor = today;
    syncAnchorInput();
    renderDashboard();
  });
  document.getElementById("periodAnchor")?.addEventListener("change", (event) => {
    const value = event.target.value;
    if (value) {
      periodAnchor = value;
      renderDashboard();
    }
  });

  document.querySelectorAll("#seriesToggles input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", () => {
      activeSeries[input.dataset.series] = input.checked;
      renderDashboard();
    });
  });

  document.getElementById("monthlyReportButton")?.addEventListener("click", generateMonthlyPdf);
  document.getElementById("refreshReportsTop")?.addEventListener("click", renderReports);

  document.getElementById("sendWhatsappReport")?.addEventListener("click", sendWhatsappReport);
  document.getElementById("copyDailyReport")?.addEventListener("click", copyDailyReport);
  document.getElementById("refreshReports")?.addEventListener("click", renderReports);
}

function bindForms() {
  document.getElementById("saleForm")?.addEventListener("submit", onCreateSale);
  document.getElementById("clientForm")?.addEventListener("submit", onCreateClient);
  document.getElementById("clientsList")?.addEventListener("submit", (event) => {
    const form = event.target.closest(".client-adjust-form");
    if (!form) return;
    event.preventDefault();
    onAdjustClient(form);
  });
  document.getElementById("clientsList")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-client-action]");
    if (!button) return;
    const action = button.dataset.clientAction;
    const clientId = button.dataset.clientId;
    if (action === "edit") onEditClient(clientId);
    else if (action === "delete") onDeleteClient(clientId);
  });
  document.getElementById("productForm")?.addEventListener("submit", onCreateProduct);
  document.getElementById("stockForm")?.addEventListener("submit", onUpdateStock);
  document.getElementById("financeForm")?.addEventListener("submit", onFinanceEntry);
  document.getElementById("waterForm")?.addEventListener("submit", onWaterEntry);
  document.getElementById("maintenanceForm")?.addEventListener("submit", onMaintenanceEntry);
  document.getElementById("quickExpenseForm")?.addEventListener("submit", onQuickExpense);
  document.getElementById("logoutButton")?.addEventListener("click", logout);
}

async function onQuickExpense(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const category = String(data.get("category") || "").trim();
  const amount = Number(data.get("amount"));
  if (!category || !Number.isFinite(amount) || amount <= 0) {
    return alert("Informe categoria e valor validos.");
  }
  state.finance.unshift({
    id: crypto.randomUUID(),
    type: "expense",
    category,
    amount,
    description: category,
    date: today
  });
  await persistMutation({
    success: "Despesa registrada e sincronizada.",
    fallback: "Despesa registrada localmente."
  });
  form.reset();
  renderAll();
}

function bindFilters() {
  ["filterClient", "filterProduct", "filterPayment", "filterDate"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", renderSalesTable);
  });
}

function bindSupabaseControls() {
  document.getElementById("supabaseForm")?.addEventListener("submit", onSaveSupabaseConfig);
  document.getElementById("pullSupabaseData")?.addEventListener("click", () => syncFromSupabase(false));
  document.getElementById("pushSupabaseData")?.addEventListener("click", syncToSupabase);
}

function bindInteractiveControls() {
  ["saleProduct", "saleQuantity", "saleEntryType"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", renderSalePreview);
    document.getElementById(id)?.addEventListener("change", renderSalePreview);
  });

  financePeriodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      financePeriod = button.dataset.financePeriod;
      financePeriodButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderFinance();
    });
  });

  document.getElementById("financePeriodPrev")?.addEventListener("click", () => shiftFinanceAnchor(-1));
  document.getElementById("financePeriodNext")?.addEventListener("click", () => shiftFinanceAnchor(1));
  document.getElementById("financePeriodToday")?.addEventListener("click", () => {
    financeAnchor = today;
    syncFinanceAnchorInput();
    renderFinance();
  });
  document.getElementById("financeAnchor")?.addEventListener("change", (event) => {
    const value = event.target.value;
    if (value) {
      financeAnchor = value;
      renderFinance();
    }
  });
  document.querySelectorAll("#financeSeriesToggles input[type=checkbox]").forEach((input) => {
    input.addEventListener("change", () => {
      activeFinanceSeries[input.dataset.financeSeries] = input.checked;
      renderFinance();
    });
  });

  waterMetricButtons.forEach((button) => {
    button.addEventListener("click", () => {
      waterMetric = button.dataset.waterMetric;
      waterMetricButtons.forEach((item) => item.classList.toggle("active", item === button));
      renderWater();
    });
  });
}

function bindStoreSwitcher() {
  const select = document.getElementById("storeSwitcher");
  if (!select) return;
  select.addEventListener("change", async (event) => {
    const newId = event.target.value;
    if (!newId || newId === activeStoreId) {
      renderStoreSwitcher();
      return;
    }
    await switchActiveStore(newId);
  });
}

async function switchActiveStore(newId) {
  if (!newId || newId === activeStoreId) return;
  if (!userHasAccessToStore(currentUser, newId)) {
    alert("Voce nao tem acesso a esta loja.");
    renderStoreSwitcher();
    return;
  }
  saveState();
  activeStoreId = newId;
  localStorage.setItem(CURRENT_STORE_KEY, newId);
  state = loadState();
  productCatalog = loadProductCatalog();
  currentStore = null;
  renderStoreSwitcher();
  renderAccessManagement();
  renderAll();
  if (supabaseClient) {
    try {
      await ensureStore();
      await syncFromSupabase(true);
    } catch (error) {
      console.warn("Falha ao trocar loja no Supabase:", error);
    }
  }
}

function renderStoreSwitcher() {
  const select = document.getElementById("storeSwitcher");
  const wrapper = select?.closest(".store-switcher");
  if (!select || !wrapper) return;
  const allowed = allowedStoresFor(currentUser);
  if (allowed.length <= 1) {
    wrapper.style.display = "none";
  } else {
    wrapper.style.display = "";
  }
  select.innerHTML = allowed
    .map((s) => `<option value="${escapeAttr(s.id)}"${s.id === activeStoreId ? " selected" : ""}>${escapeHtml(s.name)}</option>`)
    .join("");
}

function bindAccessManagement() {
  document.getElementById("storeForm")?.addEventListener("submit", onCreateStore);
  document.getElementById("fiscalConfigForm")?.addEventListener("submit", onSaveFiscalConfig);
  bindInvoicesView();
  document.getElementById("userForm")?.addEventListener("submit", onCreateUser);
  document.getElementById("storesList")?.addEventListener("click", onStoresListAction);
  document.getElementById("usersList")?.addEventListener("click", onUsersListAction);
  document.getElementById("userFormRole")?.addEventListener("change", renderUserFormStores);
}

function renderAccessManagement() {
  renderStoresList();
  renderUsersList();
  renderUserFormStores();
}

function renderStoresList() {
  const container = document.getElementById("storesList");
  if (!container) return;
  if (!stores.length) {
    container.innerHTML = '<p class="helper-note">Nenhuma loja cadastrada ainda.</p>';
    return;
  }
  container.innerHTML = stores
    .map((store) => {
      const isActive = store.id === activeStoreId;
      const canDelete = stores.length > 1;
      const canActivate = userHasAccessToStore(currentUser, store.id) && !isActive;
      return `
        <article class="entity-card${isActive ? " is-active" : ""}" data-store-id="${escapeAttr(store.id)}">
          <div class="entity-card-header">
            <div>
              <h4 class="entity-card-title">${escapeHtml(store.name)}${isActive ? " · activa" : ""}</h4>
              <p class="entity-card-meta">WhatsApp: ${escapeHtml(store.whatsapp || "-")}</p>
            </div>
            <div class="entity-card-tags">
              ${canActivate ? `<button class="primary-button compact" data-action="activate-store" data-id="${escapeAttr(store.id)}">Activar</button>` : ""}
              <button class="ghost-button compact" data-action="edit-store" data-id="${escapeAttr(store.id)}">Editar</button>
              ${canDelete ? `<button class="danger-button" data-action="delete-store" data-id="${escapeAttr(store.id)}">Remover</button>` : ""}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderUsersList() {
  const container = document.getElementById("usersList");
  if (!container) return;
  if (!users.length) {
    container.innerHTML = '<p class="helper-note">Nenhum usuario cadastrado ainda.</p>';
    return;
  }
  container.innerHTML = users
    .map((user) => {
      const allowed = (user.allowedStoreIds || []).includes("*")
        ? "Todas as lojas"
        : (user.allowedStoreIds || [])
            .map((id) => stores.find((s) => s.id === id)?.name || "Loja removida")
            .join(", ") || "Nenhuma";
      const isMe = currentUser && user.id === currentUser.id;
      return `
        <article class="entity-card" data-user-id="${escapeAttr(user.id)}">
          <div class="entity-card-header">
            <div>
              <h4 class="entity-card-title">${escapeHtml(user.username)}${isMe ? " · voce" : ""}</h4>
              <p class="entity-card-meta">Senha: ${escapeHtml(user.password)} · Lojas: ${escapeHtml(allowed)}</p>
            </div>
            <div class="entity-card-tags">
              <span class="entity-tag${user.role === "admin" ? " role-admin" : ""}">${escapeHtml(ROLE_LABELS[user.role] || user.role)}</span>
              <button class="ghost-button compact" data-action="reset-password" data-id="${escapeAttr(user.id)}">Resetar senha</button>
              ${!isMe ? `<button class="danger-button" data-action="delete-user" data-id="${escapeAttr(user.id)}">Remover</button>` : ""}
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderUserFormStores() {
  const container = document.getElementById("userFormStoresOptions");
  const roleSelect = document.getElementById("userFormRole");
  if (!container) return;
  const isAdmin = roleSelect?.value === "admin";
  const wildcardOption = isAdmin
    ? `<label><input type="checkbox" value="*" name="storeAccess"> Todas (acesso completo)</label>`
    : "";
  container.innerHTML =
    wildcardOption +
    stores
      .map(
        (s) =>
          `<label><input type="checkbox" value="${escapeAttr(s.id)}" name="storeAccess"> ${escapeHtml(s.name)}</label>`
      )
      .join("");
}

function onCreateStore(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  let whatsapp = String(data.get("whatsapp") || "").trim();
  if (!name) return;
  if (whatsapp && !whatsapp.startsWith("+")) whatsapp = `+${whatsapp.replace(/[^0-9]/g, "")}`;
  if (!whatsapp) whatsapp = DEFAULT_REPORT_PHONE;
  if (stores.some((s) => normalizeText(s.name) === normalizeText(name))) {
    alert("Ja existe uma loja com esse nome.");
    return;
  }
  const id = `loja-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  stores.push({ id, name, whatsapp });
  persistStores();
  form.reset();
  renderAccessManagement();
  renderStoreSwitcher();
}

async function onStoresListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (!requireAdmin()) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const store = stores.find((s) => s.id === id);
  if (!store) return;

  if (action === "activate-store") {
    await switchActiveStore(id);
    return;
  }

  if (action === "edit-store") {
    const newName = prompt(`Novo nome da loja "${store.name}":`, store.name);
    if (newName === null) return;
    const trimmedName = String(newName).trim();
    if (!trimmedName) {
      alert("O nome da loja nao pode ficar em branco.");
      return;
    }
    if (stores.some((s) => s.id !== id && normalizeText(s.name) === normalizeText(trimmedName))) {
      alert("Ja existe outra loja com esse nome.");
      return;
    }
    const newPhoneRaw = prompt(`WhatsApp para a loja "${trimmedName}" (formato +244...):`, store.whatsapp || DEFAULT_REPORT_PHONE);
    if (newPhoneRaw === null) return;
    let newPhone = String(newPhoneRaw).trim();
    if (newPhone && !newPhone.startsWith("+")) newPhone = `+${newPhone.replace(/[^0-9]/g, "")}`;
    store.name = trimmedName;
    store.whatsapp = newPhone || DEFAULT_REPORT_PHONE;
    persistStores();
    if (id === activeStoreId) currentStore = null;
    renderAccessManagement();
    renderStoreSwitcher();
    return;
  }

  if (action === "delete-store") {
    if (stores.length <= 1) {
      alert("Nao e possivel remover a unica loja.");
      return;
    }
    if (!confirm(`Remover a loja "${store.name}"? Os dados desta loja continuarao guardados, mas ela ficara inacessivel.`)) return;
    stores = stores.filter((s) => s.id !== id);
    persistStores();
    users = users.map((u) => ({
      ...u,
      allowedStoreIds: (u.allowedStoreIds || []).filter((sid) => sid === "*" || sid !== id)
    }));
    persistUsers();
    if (activeStoreId === id) {
      activeStoreId = pickInitialStore(currentUser);
      if (activeStoreId) localStorage.setItem(CURRENT_STORE_KEY, activeStoreId);
      state = loadState();
      productCatalog = loadProductCatalog();
      renderAll();
    }
    renderAccessManagement();
    renderStoreSwitcher();
  }
}

function onCreateUser(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = event.currentTarget;
  const data = new FormData(form);
  const username = String(data.get("username") || "").trim();
  const password = String(data.get("password") || "").trim();
  const rawRole = String(data.get("role") || "operacao");
  const role = rawRole === "admin" ? "admin" : "operacao";
  let allowedStoreIds = data.getAll("storeAccess").map(String);
  const validStoreIds = new Set(stores.map((s) => s.id));
  if (role === "admin" && allowedStoreIds.includes("*")) {
    allowedStoreIds = ["*"];
  } else {
    allowedStoreIds = allowedStoreIds.filter((id) => id !== "*" && validStoreIds.has(id));
  }
  if (!username || !password) return;
  if (!/^\d{4,8}$/.test(password)) {
    alert("A senha deve ter entre 4 e 8 digitos numericos.");
    return;
  }
  if (users.some((u) => u.password === password)) {
    alert("Ja existe um usuario com essa senha.");
    return;
  }
  if (!allowedStoreIds.length) {
    alert("Selecione pelo menos uma loja para o usuario.");
    return;
  }
  users.push({
    id: crypto.randomUUID(),
    username,
    password,
    role,
    allowedStoreIds
  });
  persistUsers();
  form.reset();
  renderAccessManagement();
}

function onUsersListAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  if (!requireAdmin()) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  const user = users.find((u) => u.id === id);
  if (!user) return;

  if (action === "reset-password") {
    const newPassword = prompt(`Nova senha para "${user.username}" (4 a 8 digitos numericos):`, user.password);
    if (newPassword === null) return;
    const trimmed = String(newPassword).trim();
    if (!/^\d{4,8}$/.test(trimmed)) {
      alert("A senha deve ter entre 4 e 8 digitos numericos.");
      return;
    }
    if (users.some((u) => u.id !== id && u.password === trimmed)) {
      alert("Ja existe outro usuario com essa senha.");
      return;
    }
    user.password = trimmed;
    persistUsers();
    if (currentUser && currentUser.id === user.id) {
      currentUser.password = trimmed;
      localStorage.setItem(ROLE_KEY, trimmed);
    }
    renderAccessManagement();
    alert("Senha actualizada com sucesso.");
    return;
  }

  if (action === "delete-user") {
    if (currentUser && user.id === currentUser.id) {
      alert("Nao e possivel remover o proprio usuario logado.");
      return;
    }
    if (!confirm(`Remover o usuario "${user.username}"?`)) return;
    users = users.filter((u) => u.id !== id);
    persistUsers();
    renderAccessManagement();
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function renderAll() {
  renderSelects();
  renderDashboard();
  renderSalePreview();
  renderSalesTable();
  renderClients();
  renderStock();
  renderFinance();
  renderWater();
  renderReports();
  renderInvoicesView();
  renderFiscalConfigForm();
  renderSyncStatus();
  renderPromotions();
}

function renderSupabaseConfig() {
  setInputValue("supabaseUrl", supabaseConfig.url || "");
  setInputValue("supabaseAnonKey", supabaseConfig.anonKey || "");
  renderSyncStatus();
}

function setSyncStatus(tone, text) {
  syncState = { tone, text };
  renderSyncStatus();
}

function renderSyncStatus() {
  const pill = document.getElementById("syncStatus");
  const details = document.getElementById("supabaseStatusText");
  if (!pill || !details) return;

  pill.textContent = syncState.text;
  pill.className = "status-pill";
  if (syncState.tone === "success") pill.classList.add("badge", "success");
  if (syncState.tone === "warning") pill.classList.add("badge", "warning");
  if (syncState.tone === "danger") pill.classList.add("badge", "danger");
  details.textContent = syncState.text;
}

function renderSelects() {
  const clientOptions = [{ id: "", name: "Todos os clientes" }, ...state.clients];
  const productOptions = [{ id: "", name: "Todos os produtos" }, ...productCatalog];

  fillOptionalSelect("saleClient", state.clients, "Sem cliente (opcional)");
  fillSelect("filterClient", clientOptions);
  fillSelect("saleProduct", productCatalog, "Escolha o produto");
  fillSelect("filterProduct", productOptions);
  fillSelect("stockProduct", productCatalog.filter((item) => item.stockControlled), "Escolha o produto");
}

function fillSelect(id, items, placeholder) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = "";

  if (placeholder) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);
  }

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
}

function fillOptionalSelect(id, items, placeholder) {
  const select = document.getElementById(id);
  if (!select) return;
  const currentValue = select.value;
  select.innerHTML = `<option value="">${placeholder}</option>`;
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name;
    select.appendChild(option);
  });
  if ([...select.options].some((option) => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function renderDashboard() {
  syncAnchorInput();
  const stats = buildPeriodStats(currentPeriod, periodAnchor);
  renderMetricCards(stats);
  renderInteractiveSalesChart(stats.timeline);
  renderPeriodRangeLabel(stats.timeline);
  renderProductPie(stats.productTotals);
  renderPaymentBreakdown(stats.paymentTotals);
  renderClientBalances();
  renderWaterSummary();
}

function syncAnchorInput() {
  const input = document.getElementById("periodAnchor");
  if (input && input.value !== periodAnchor) input.value = periodAnchor;
}

function shiftPeriodAnchor(direction) {
  const date = parseIsoUtc(periodAnchor);
  if (currentPeriod === "daily") {
    date.setUTCDate(date.getUTCDate() + direction);
  } else if (currentPeriod === "weekly") {
    date.setUTCDate(date.getUTCDate() + direction * 7);
  } else if (currentPeriod === "monthly") {
    addMonthsSafelyUtc(date, direction);
  } else {
    addMonthsSafelyUtc(date, direction * 12);
  }
  periodAnchor = isoFromUtc(date);
  renderDashboard();
}

function addMonthsSafelyUtc(date, months) {
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
}

function renderPeriodRangeLabel(timeline) {
  const target = document.getElementById("periodRangeLabel");
  if (!target || !timeline.length) return;
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const periodLabel = ({ daily: "dias", weekly: "semanas", monthly: "meses", yearly: "anos" })[currentPeriod];
  target.textContent = `Visualizando ${timeline.length} ${periodLabel} - ${first.label} a ${last.label}`;
}

function renderMetricCards(stats) {
  const periodWord = ({ daily: "do dia", weekly: "da semana", monthly: "do mes", yearly: "do ano" })[currentPeriod] || "do periodo";
  const selectedLabel = stats.selectedLabel || "";
  const metrics = currentRole === "operacao"
    ? [
        { label: `Lucro ${periodWord}`, value: currency(stats.profit), note: selectedLabel }
      ]
    : [
        { label: `Total de vendas ${periodWord}`, value: currency(stats.salesTotal), note: `${stats.salesCount} movimentos - ${selectedLabel}` },
        { label: `Lucro ${periodWord}`, value: currency(stats.profit), note: `Vendas - despesas - investimentos (${selectedLabel})` },
        { label: `Despesas ${periodWord}`, value: currency(stats.expenses), note: selectedLabel },
        { label: `Investimentos ${periodWord}`, value: currency(stats.investments), note: selectedLabel }
      ];

  const grid = document.getElementById("statsGrid");
  const template = document.getElementById("metricTemplate");
  grid.innerHTML = "";

  metrics.forEach((metric) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector(".card-label").textContent = metric.label;
    node.querySelector("h3").textContent = metric.value;
    node.querySelector("span").textContent = metric.note;
    grid.appendChild(node);
  });
}

function renderInteractiveSalesChart(timeline) {
  renderInteractiveChart({
    svgId: "salesChartSvg",
    tooltipId: "salesChartTooltip",
    timeline,
    series: [
      { key: "sales", label: "Vendas", type: "bar", visible: activeSeries.sales, dotClass: "sales", dynamicFill: salesBarFill },
      { key: "expenses", label: "Despesas", type: "bar", visible: activeSeries.expenses, dotClass: "expenses", color: "#dc5b48", gradientId: "expensesBarGradient", gradientStops: [["0%", "#f5a293"], ["100%", "#dc5b48"]] },
      { key: "profit", label: "Lucro", type: "line", visible: activeSeries.profit, dotClass: "profit", color: "#7e6dff" }
    ],
    extraTooltipRows: (point) => [
      { label: "Investimentos", value: point.investments, dotClass: "investment" }
    ],
    formatValue: currency,
    minY: 0
  });
}

function renderInteractiveChart({ svgId, tooltipId, timeline, series, formatValue, extraTooltipRows, minY }) {
  const svg = document.getElementById(svgId);
  const tooltip = tooltipId ? document.getElementById(tooltipId) : null;
  if (!svg) return;
  svg.innerHTML = "";
  if (tooltip) tooltip.style.opacity = "0";
  if (!timeline.length) return;

  const visibleSeries = series.filter((s) => s.visible !== false);
  if (!visibleSeries.length) return;

  const fmt = formatValue || ((v) => formatShortNumber(v));

  const width = 880;
  const height = 320;
  const paddingLeft = 60;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 48;
  const innerWidth = width - paddingLeft - paddingRight;
  const innerHeight = height - paddingTop - paddingBottom;

  const numbers = timeline.flatMap((point) => visibleSeries.map((s) => Number(point[s.key]) || 0));
  const dataMax = numbers.length ? Math.max(...numbers, 0) : 0;
  const dataMin = numbers.length ? Math.min(...numbers, 0) : 0;

  const yMax = niceCeil(Math.max(dataMax, minY === 0 ? 1000 : Math.abs(dataMax) || 1));
  const baseMinY = minY !== undefined ? minY : (dataMin < 0 ? niceFloor(dataMin) : 0);
  const yMin = baseMinY > dataMin ? niceFloor(dataMin) : baseMinY;
  const range = Math.max(yMax - yMin, 1);
  const yFor = (value) => paddingTop + innerHeight - ((value - yMin) / range) * innerHeight;

  const barSeries = visibleSeries.filter((s) => s.type === "bar");
  const lineSeries = visibleSeries.filter((s) => s.type === "line");
  const slotWidth = innerWidth / timeline.length;
  const barGroupW = slotWidth * 0.62;
  const barW = barSeries.length ? Math.max(barGroupW / barSeries.length - 2, 6) : 0;

  const labelStep = Math.max(1, Math.ceil(timeline.length / 14));

  const gridLines = [];
  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const value = yMin + ((yMax - yMin) * i) / ticks;
    const y = yFor(value);
    gridLines.push(`<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="rgba(16,49,77,0.10)" stroke-dasharray="4 6"/>`);
    gridLines.push(`<text x="${paddingLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="#647788">${formatShortNumber(value)}</text>`);
  }

  const defs = [];
  const seenGradients = new Set();
  visibleSeries.forEach((s) => {
    if (s.gradientId && !seenGradients.has(s.gradientId)) {
      seenGradients.add(s.gradientId);
      const stops = (s.gradientStops || [["0%", s.color || "#1aa8d8"], ["100%", s.color || "#1aa8d8"]])
        .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
        .join("");
      defs.push(`<linearGradient id="${s.gradientId}" x1="0" x2="0" y1="0" y2="1">${stops}</linearGradient>`);
    }
    if (s.type === "line" && s.areaGradientId && !seenGradients.has(s.areaGradientId)) {
      seenGradients.add(s.areaGradientId);
      defs.push(`<linearGradient id="${s.areaGradientId}" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="${s.color}" stop-opacity="0.32"/><stop offset="100%" stop-color="${s.color}" stop-opacity="0.02"/></linearGradient>`);
    }
  });

  const xLabels = [];
  const barNodes = [];
  const hoverZones = [];
  const linePoints = lineSeries.map((s) => ({ series: s, points: [] }));

  timeline.forEach((point, index) => {
    const slotX = paddingLeft + slotWidth * index + slotWidth / 2;
    if (index % labelStep === 0 || index === timeline.length - 1) {
      xLabels.push(`<text x="${slotX}" y="${height - paddingBottom + 18}" text-anchor="middle" font-size="11" fill="#647788">${point.label}</text>`);
    }

    const baseY = yFor(0);

    barSeries.forEach((s, bi) => {
      const groupStart = slotX - barGroupW / 2;
      const x = groupStart + bi * (barW + 2);
      const value = Number(point[s.key]) || 0;
      const yTop = yFor(value);
      const h = Math.max(Math.abs(baseY - yTop), 0);
      const top = Math.min(baseY, yTop);
      const fill = s.dynamicFill ? s.dynamicFill(value) : (s.gradientId ? `url(#${s.gradientId})` : (s.color || "#1aa8d8"));
      barNodes.push(`<rect class="chart-bar bar-${s.key}" data-index="${index}" x="${x}" y="${top}" width="${barW}" height="${h}" rx="5" fill="${fill}"/>`);
    });

    lineSeries.forEach((s, si) => {
      linePoints[si].points.push({ x: slotX, y: yFor(Number(point[s.key]) || 0), value: Number(point[s.key]) || 0, index });
    });

    hoverZones.push(`<rect class="chart-hover-zone" data-index="${index}" x="${paddingLeft + slotWidth * index}" y="${paddingTop}" width="${slotWidth}" height="${innerHeight}" fill="transparent"/>`);
  });

  const linesSvg = linePoints.map(({ series: s, points }) => {
    if (!points.length) return "";
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    let area = "";
    if (s.areaGradientId) {
      const baseY = yFor(yMin);
      area = `<path d="${path} L ${points[points.length - 1].x} ${baseY} L ${points[0].x} ${baseY} Z" fill="url(#${s.areaGradientId})"/>`;
    }
    const dots = points.map((p) => `<circle class="chart-profit-dot" data-series="${s.key}" data-index="${p.index}" cx="${p.x}" cy="${p.y}" r="5" fill="${s.color}" stroke="white" stroke-width="2"/>`).join("");
    return `${area}<path d="${path}" fill="none" stroke="${s.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${dots}`;
  }).join("");

  const baselineY = yFor(0);
  const baseline = yMin < 0 ? `<line x1="${paddingLeft}" y1="${baselineY}" x2="${width - paddingRight}" y2="${baselineY}" stroke="rgba(16,49,77,0.30)" stroke-width="1.2"/>` : "";

  svg.innerHTML = `
    <defs>${defs.join("")}</defs>
    ${gridLines.join("")}
    ${baseline}
    ${barNodes.join("")}
    ${linesSvg}
    ${hoverZones.join("")}
    ${xLabels.join("")}
  `;

  if (!tooltip) return;

  const showTooltip = (event, index) => {
    const point = timeline[index];
    if (!point) return;
    const rows = visibleSeries.map((s) => `<div class="tip-row"><span><span class="series-dot ${s.dotClass || s.key}"></span>${s.label}</span><b>${fmt(Number(point[s.key]) || 0, s)}</b></div>`).join("");
    const extras = (extraTooltipRows ? extraTooltipRows(point) : []).map((r) => `<div class="tip-row"><span><span class="series-dot ${r.dotClass || ""}"></span>${r.label}</span><b>${fmt(r.value)}</b></div>`).join("");
    tooltip.innerHTML = `<strong>${point.fullLabel || point.label}</strong>${rows}${extras}`;
    const shell = svg.parentElement.getBoundingClientRect();
    const x = event.clientX - shell.left;
    const y = event.clientY - shell.top;
    tooltip.style.left = `${Math.min(Math.max(x + 12, 12), shell.width - 220)}px`;
    tooltip.style.top = `${Math.max(y - 110, 12)}px`;
    tooltip.style.opacity = "1";
  };
  const hideTooltip = () => { tooltip.style.opacity = "0"; };

  svg.querySelectorAll(".chart-hover-zone, .chart-bar, .chart-profit-dot").forEach((el) => {
    el.addEventListener("mousemove", (event) => showTooltip(event, Number(el.dataset.index)));
    el.addEventListener("mouseleave", hideTooltip);
    el.addEventListener("touchstart", (event) => {
      const touch = event.touches[0];
      if (touch) showTooltip({ clientX: touch.clientX, clientY: touch.clientY }, Number(el.dataset.index));
    }, { passive: true });
  });
}

function salesBarFill(value) {
  if (value < 17000) return "#dc5b48";
  if (value <= 25000) return "#d4a425";
  return "#289b65";
}

function niceCeil(value) {
  if (value <= 0) return 1000;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / exp;
  let m = 1;
  if (norm > 5) m = 10;
  else if (norm > 2) m = 5;
  else if (norm > 1) m = 2;
  return m * exp;
}

function niceFloor(value) {
  return -niceCeil(Math.abs(value));
}

function formatShortNumber(value) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return Math.round(value).toString();
}

function renderPaymentBreakdown(paymentTotals) {
  const wrapper = document.getElementById("paymentBreakdown");
  wrapper.innerHTML = "";
  Object.entries(paymentTotals).forEach(([method, value]) => {
    const card = document.createElement("div");
    card.className = "mini-card";
    card.innerHTML = `<strong>${method}</strong><small>${currency(value)}</small>`;
    wrapper.appendChild(card);
  });
}

function renderClientBalances() {
  const target = document.getElementById("clientBalances");
  target.innerHTML = "";

  const filtered = state.clients.filter((c) => (c.balance || 0) > 0 || (c.debt || 0) > 0);
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "helper-note";
    empty.textContent = "Nenhum cliente com saldo ou divida.";
    target.appendChild(empty);
    return;
  }

  filtered
    .sort((a, b) => ((b.debt || 0) + (b.balance || 0)) - ((a.debt || 0) + (a.balance || 0)))
    .forEach((client) => {
      const row = document.createElement("div");
      row.className = "list-row";
      const debt = client.debt || 0;
      const balance = client.balance || 0;
      row.innerHTML = `
        <div>
          <strong>${escapeHtml(client.name)}</strong>
          <small>${escapeHtml(client.phone || "")}</small>
        </div>
        <div class="balance-stack">
          ${balance > 0 ? `<span class="badge success">Saldo: ${currency(balance)}</span>` : ""}
          ${debt > 0 ? `<span class="badge danger">Divida: ${currency(debt)}</span>` : ""}
        </div>
      `;
      target.appendChild(row);
    });
}

function renderWaterSummary() {
  const target = document.getElementById("waterSummary");
  if (!target) return;
  target.innerHTML = "";

  state.waterReadings
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3)
    .forEach((entry) => {
      const row = document.createElement("div");
      row.className = "mini-card";
      row.innerHTML = `<strong>${entry.date}</strong><small>pH ${entry.ph} | TDS ${entry.tds} | Temp ${entry.temperature} C</small>`;
      target.appendChild(row);
    });
}

function renderProductPie(productTotals) {
  const chart = document.getElementById("productPieChart");
  const legend = document.getElementById("productPieLegend");
  if (!chart || !legend) return;

  const items = Object.entries(productTotals)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  if (!items.length) {
    chart.innerHTML = `<div class="pie-empty">Sem vendas no periodo</div>`;
    legend.innerHTML = "";
    return;
  }

  const colors = ["#1aa8d8", "#0f5f8f", "#41d2f3", "#f0c35a", "#289b65", "#dc5b48", "#7e6dff"];
  const total = items.reduce((sum, [, value]) => sum + value, 0);
  let accumulator = 0;
  const slices = items.map(([name, value], index) => {
    const start = accumulator;
    const portion = (value / total) * 100;
    accumulator += portion;
    return { name, value, color: colors[index % colors.length], start, end: accumulator };
  });

  chart.innerHTML = `<div class="pie-chart-disc" style="background: conic-gradient(${slices.map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`).join(", ")});"></div>`;
  legend.innerHTML = "";

  slices.forEach((slice) => {
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <div>
        <span class="legend-dot" style="background:${slice.color}"></span>
        <strong>${slice.name}</strong>
      </div>
      <small>${currency(slice.value)}</small>
    `;
    legend.appendChild(row);
  });
}

function renderSalesTable() {
  const tbody = document.getElementById("salesTable");
  tbody.innerHTML = "";

  const filters = {
    clientId: document.getElementById("filterClient").value,
    productId: document.getElementById("filterProduct").value,
    paymentMethod: document.getElementById("filterPayment").value,
    date: document.getElementById("filterDate").value
  };

  state.sales
    .filter((item) => !filters.clientId || item.clientId === filters.clientId)
    .filter((item) => !filters.productId || item.productId === filters.productId)
    .filter((item) => !filters.paymentMethod || item.paymentMethod === filters.paymentMethod)
    .filter((item) => !filters.date || item.date === filters.date)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((sale) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${sale.date}</td>
        <td>${escapeHtml(findClient(sale.clientId)?.name || sale.customerName || "-")}</td>
        <td>${escapeHtml(findProduct(sale.productId)?.name || sale.productName || "-")}</td>
        <td>${translateEntryType(sale.entryType)}</td>
        <td>${escapeHtml(sale.paymentMethod)}</td>
        <td>${escapeHtml(sale.sellerUsername || "-")}</td>
        <td>${currency(sale.total)}</td>
      `;
      tbody.appendChild(tr);
    });
}

function renderClients() {
  const target = document.getElementById("clientsList");
  target.innerHTML = "";

  state.clients.forEach((client) => {
    const row = document.createElement("div");
    row.className = "list-row client-row";
    const debt = client.debt || 0;
    row.innerHTML = `
      <div class="client-row-info">
        <div>
          <strong>${escapeHtml(client.name)}</strong>
          <small>${escapeHtml(client.phone || "")} | ${escapeHtml(client.address || "")}</small>
        </div>
        <div class="balance-stack">
          <span class="badge ${client.balance > 0 ? "success" : "muted"}">Saldo: ${currency(client.balance)}</span>
          <span class="badge ${debt > 0 ? "danger" : "muted"}">Divida: ${currency(debt)}</span>
        </div>
      </div>
      <form class="client-adjust-form" data-client-id="${escapeAttr(client.id)}">
        <input type="number" name="amount" min="0.01" step="0.01" placeholder="Valor (Kz)" required>
        <select name="action" aria-label="Tipo de ajuste">
          <option value="deposit">Saldo</option>
          <option value="debt">Divida</option>
        </select>
        <button class="primary-button" type="submit">Aplicar</button>
      </form>
      <div class="client-admin-actions role-admin-only">
        <button type="button" class="ghost-button" data-client-action="edit" data-client-id="${escapeAttr(client.id)}">Editar</button>
        <button type="button" class="ghost-button danger" data-client-action="delete" data-client-id="${escapeAttr(client.id)}">Excluir</button>
      </div>
    `;
    target.appendChild(row);
  });
}

async function onEditClient(clientId) {
  if (!requireAdmin()) return;
  const client = findClient(clientId);
  if (!client) return alert("Cliente nao encontrado.");

  const newName = prompt("Nome do cliente:", client.name || "");
  if (newName === null) return;
  const trimmedName = newName.trim();
  if (!trimmedName) return alert("Nome nao pode ficar vazio.");

  const newPhone = prompt("Telefone:", client.phone || "");
  if (newPhone === null) return;

  const newAddress = prompt("Endereco:", client.address || "");
  if (newAddress === null) return;

  const newNif = prompt("NIF (deixe vazio para Consumidor Final):", client.nif || "");
  if (newNif === null) return;

  client.name = trimmedName;
  client.phone = newPhone.trim();
  client.address = newAddress.trim();
  client.nif = newNif.trim();

  // Update cached customer name on past sales so reports stay consistent.
  state.sales.forEach((sale) => {
    if (sale.clientId && String(sale.clientId) === String(client.id)) {
      sale.customerName = trimmedName;
    }
  });

  await persistMutation({
    success: "Cliente actualizado e sincronizado.",
    fallback: "Cliente actualizado localmente."
  });
  renderAll();
}

async function onDeleteClient(clientId) {
  if (!requireAdmin()) return;
  const client = findClient(clientId);
  if (!client) return alert("Cliente nao encontrado.");

  const balance = client.balance || 0;
  const debt = client.debt || 0;
  const warnings = [];
  if (balance > 0) warnings.push(`Saldo a favor: ${currency(balance)}`);
  if (debt > 0) warnings.push(`Divida em aberto: ${currency(debt)}`);
  const linkedSales = state.sales.filter((s) => String(s.clientId) === String(client.id)).length;
  if (linkedSales > 0) warnings.push(`${linkedSales} ${linkedSales === 1 ? "lancamento" : "lancamentos"} no historico`);

  const safeName = String(client.name || "").replace(/[\r\n\t\u0000-\u001F\u007F]+/g, " ").trim().slice(0, 80) || "(sem nome)";
  const message = `Excluir o cliente "${safeName}"?` +
    (warnings.length ? `\n\nAtencao:\n- ${warnings.join("\n- ")}\n\nO historico de vendas mantem o nome para registo, mas o cliente sera removido da lista.` : "");
  if (!confirm(message)) return;

  // Detach the client from past sales so they no longer reference a missing record,
  // while keeping the customer name visible in reports.
  state.sales.forEach((sale) => {
    if (String(sale.clientId) === String(client.id)) {
      sale.customerName = sale.customerName || client.name;
      sale.clientId = "";
    }
  });
  state.clients = state.clients.filter((c) => String(c.id) !== String(client.id));

  await persistMutation({
    success: "Cliente excluido e sincronizado.",
    fallback: "Cliente excluido localmente."
  });
  renderAll();
}

async function onAdjustClient(form) {
  const clientId = form.dataset.clientId;
  const client = findClient(clientId);
  if (!client) return alert("Cliente nao encontrado.");

  const amount = Number(new FormData(form).get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return alert("Informe um valor valido.");
  }
  const action = String(new FormData(form).get("action"));

  if (action === "deposit") {
    client.balance = (client.balance || 0) + amount;
  } else if (action === "debt") {
    client.debt = (client.debt || 0) + amount;
  } else {
    return;
  }

  await persistMutation({
    success: "Ajuste guardado e sincronizado.",
    fallback: "Ajuste guardado localmente."
  });

  renderAll();
}

function renderStock() {
  const target = document.getElementById("stockList");
  target.innerHTML = "";

  state.stock.forEach((item) => {
    const product = findProduct(item.productId);
    const row = document.createElement("div");
    row.className = "list-row";
    row.innerHTML = `
      <div>
        <strong>${product?.name || item.productId}</strong>
        <small>${item.quantity} unidades | custo medio ${currency(item.unitCost)}</small>
      </div>
      <span class="badge ${item.quantity <= 2 ? "danger" : "success"}">${currency(item.quantity * item.unitCost)}</span>
    `;
    target.appendChild(row);
  });
}

function renderFinance() {
  renderFinanceAnalytics();
  const target = document.getElementById("financeList");
  if (!target) return;
  target.innerHTML = "";

  state.finance
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div>
          <strong>${item.category}</strong>
          <small>${item.date}</small>
        </div>
        <span class="badge ${item.type === "expense" ? "danger" : "warning"}">${currency(item.amount)}</span>
      `;
      target.appendChild(row);
    });
}

function renderFinanceAnalytics() {
  const summary = document.getElementById("financeSummaryCards");
  const svg = document.getElementById("financeChartSvg");
  if (!summary || !svg) return;

  syncFinanceAnchorInput();
  const data = buildFinanceAnalytics(financePeriod, financeAnchor);
  summary.innerHTML = "";

  [
    { label: "Despesas", value: currency(data.expenses) },
    { label: "Investimentos", value: currency(data.investments) },
    { label: "Impacto", value: currency(data.expenses + data.investments) }
  ].forEach((item) => {
    const card = document.createElement("div");
    card.className = "finance-stat-card";
    card.innerHTML = `<small>${item.label}</small><strong>${item.value}</strong>`;
    summary.appendChild(card);
  });

  renderFinanceRangeLabel(data.timeline);

  renderInteractiveChart({
    svgId: "financeChartSvg",
    tooltipId: "financeChartTooltip",
    timeline: data.timeline,
    series: [
      { key: "expenses", label: "Despesas", type: "bar", visible: activeFinanceSeries.expenses, dotClass: "expenses", color: "#dc5b48", gradientId: "financeExpensesGradient", gradientStops: [["0%", "#f5a293"], ["100%", "#dc5b48"]] },
      { key: "investments", label: "Investimentos", type: "bar", visible: activeFinanceSeries.investments, dotClass: "investment", color: "#d4a425", gradientId: "financeInvestGradient", gradientStops: [["0%", "#f0d97d"], ["100%", "#d4a425"]] },
      { key: "impact", label: "Impacto", type: "line", visible: activeFinanceSeries.impact, dotClass: "profit", color: "#7e6dff", areaGradientId: "financeImpactArea" }
    ],
    formatValue: currency,
    minY: 0
  });
}

function renderFinanceRangeLabel(timeline) {
  const target = document.getElementById("financeRangeLabel");
  if (!target || !timeline.length) return;
  const first = timeline[0].fullLabel || timeline[0].label;
  const last = timeline[timeline.length - 1].fullLabel || timeline[timeline.length - 1].label;
  const periodName = financePeriod === "daily" ? "7 dias" : financePeriod === "weekly" ? "8 semanas" : financePeriod === "monthly" ? "12 meses" : "5 anos";
  target.textContent = `Visualizando ${periodName} - ${first} a ${last}`;
}

function syncFinanceAnchorInput() {
  const input = document.getElementById("financeAnchor");
  if (input && input.value !== financeAnchor) input.value = financeAnchor;
}

function shiftFinanceAnchor(direction) {
  const date = new Date(financeAnchor);
  if (financePeriod === "daily") date.setDate(date.getDate() + direction);
  else if (financePeriod === "weekly") date.setDate(date.getDate() + direction * 7);
  else if (financePeriod === "monthly") addMonthsSafely(date, direction);
  else addMonthsSafely(date, direction * 12);
  financeAnchor = date.toISOString().slice(0, 10);
  renderFinance();
}

function renderWater() {
  renderWaterTrend();
  const history = document.getElementById("waterHistory");
  const maintenance = document.getElementById("maintenanceList");
  if (!history || !maintenance) return;
  history.innerHTML = "";
  maintenance.innerHTML = "";

  state.waterReadings
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((entry) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div>
          <strong>${entry.date}</strong>
          <small>pH ${entry.ph} | TDS ${entry.tds} | Temperatura ${entry.temperature} C</small>
        </div>
        <span class="badge success">${phStatus(entry.ph)}</span>
      `;
      history.appendChild(row);
    });

  state.maintenance
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach((item) => {
      const row = document.createElement("div");
      row.className = "list-row";
      row.innerHTML = `
        <div>
          <strong>${item.title}</strong>
          <small>${item.date} | ${item.notes}</small>
        </div>
        <span class="badge warning">${currency(item.cost)}</span>
      `;
      maintenance.appendChild(row);
    });
}

function renderWaterTrend() {
  const svg = document.getElementById("waterChartSvg");
  const kpis = document.getElementById("waterKpis");
  const rangeLabel = document.getElementById("waterRangeLabel");
  if (!svg || !kpis) return;

  const readings = state.waterReadings
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12);

  if (!readings.length) {
    svg.innerHTML = "";
    kpis.innerHTML = "";
    if (rangeLabel) rangeLabel.textContent = "";
    return;
  }

  const metricLabel = { ph: "pH", tds: "TDS", temperature: "Temperatura" }[waterMetric];
  const metricColor = { ph: "#1aa8d8", tds: "#126f95", temperature: "#289b65" }[waterMetric];

  const values = readings.map((entry) => toNumber(entry[waterMetric]));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length;
  const latest = values[values.length - 1];

  kpis.innerHTML = `
    <div class="water-kpi"><small>Metrica</small><strong>${metricLabel}</strong></div>
    <div class="water-kpi"><small>Atual</small><strong>${formatMetricValue(waterMetric, latest)}</strong></div>
    <div class="water-kpi"><small>Min</small><strong>${formatMetricValue(waterMetric, min)}</strong></div>
    <div class="water-kpi"><small>Media</small><strong>${formatMetricValue(waterMetric, avg)}</strong></div>
  `;

  if (rangeLabel) {
    rangeLabel.textContent = `${readings.length} medicoes - ${readings[0].date} a ${readings[readings.length - 1].date}`;
  }

  const timeline = readings.map((entry) => ({
    label: entry.date.slice(5),
    fullLabel: entry.date,
    value: toNumber(entry[waterMetric])
  }));

  const padding = (max - min) * 0.18 || (max * 0.1) || 1;
  renderInteractiveChart({
    svgId: "waterChartSvg",
    tooltipId: "waterChartTooltip",
    timeline,
    series: [
      { key: "value", label: metricLabel, type: "line", visible: true, dotClass: "profit", color: metricColor, areaGradientId: "waterAreaGradient" }
    ],
    formatValue: (v) => formatMetricValue(waterMetric, v),
    minY: Math.max(0, min - padding)
  });
}

function renderReports() {
  const daily = buildDailyReport();
  const monthly = buildMonthlyReport();

  document.getElementById("dailyReport").innerHTML = `
    <strong>Resumo de ${today}</strong>
    <span>Vendas: ${currency(daily.sales)}</span>
    <span>Lucro: ${currency(daily.profit)}</span>
    <span>Despesas: ${currency(daily.expenses)}</span>
    <span>Investimentos: ${currency(daily.investments)}</span>
    <span>Clientes com saldo: ${daily.clientsWithBalance}</span>
  `;

  document.getElementById("monthlyReport").innerHTML = `
    <strong>Resumo do mes</strong>
    <span>Vendas: ${currency(monthly.sales)}</span>
    <span>Lucro: ${currency(monthly.profit)}</span>
    <span>Despesas: ${currency(monthly.expenses)}</span>
    <span>Investimentos: ${currency(monthly.investments)}</span>
    <span>Medicoes de agua: ${monthly.readings}</span>
    <span>Manutencoes: ${monthly.maintenance}</span>
  `;
}

async function onCreateSale(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const clientId = String(form.get("clientId"));
  const productId = String(form.get("productId"));
  const quantity = Number(form.get("quantity"));
  const paymentMethod = String(form.get("paymentMethod"));
  let entryType = String(form.get("entryType"));
  let date = String(form.get("date"));
  if (currentRole === "operacao") {
    entryType = "sale";
    date = today;
  }
  const product = findProduct(productId);
  const client = findClient(clientId);

  if (!product) return alert("Escolha um produto.");
  if (
    (entryType === "deposit" || entryType === "withdrawal" || entryType === "debt" || entryType === "settlement" || paymentMethod === "Saldo do cliente") &&
    !client
  ) {
    return alert("Selecione um cliente para deposito, levantamento, divida, liquidacao ou uso de saldo.");
  }

  let costTotal = 0;
  let movement = null;
  const components = Array.isArray(product.components) ? product.components : null;
  const consumesStock = entryType === "sale" || entryType === "debt";
  // Composite product (kit/pacote): decrement each component's stock instead of the kit itself.
  if (components && components.length && consumesStock) {
    for (const comp of components) {
      const compStock = findStockByProduct(comp.productId);
      const needed = (Number(comp.qty) || 1) * quantity;
      if (!compStock || compStock.quantity < needed) {
        return alert(`Estoque insuficiente para o componente "${comp.name || comp.productId}" do kit. Verifique a aba Estoque.`);
      }
    }
    for (const comp of components) {
      const compStock = findStockByProduct(comp.productId);
      const needed = (Number(comp.qty) || 1) * quantity;
      compStock.quantity -= needed;
      costTotal += (compStock.unitCost || 0) * needed;
    }
    movement = { itemId: null, productId, quantity, type: "out", composite: true };
  } else if (product.stockControlled && consumesStock) {
    const stockItem = findStockByProduct(productId);
    if (!stockItem || stockItem.quantity < quantity) {
      return alert("Estoque insuficiente para este produto.");
    }
    stockItem.quantity -= quantity;
    costTotal = stockItem.unitCost * quantity;
    movement = { itemId: stockItem.id, productId, quantity, type: "out" };
  }

  const total = product.price * quantity;

  if (entryType === "deposit" && client) client.balance += total;
  if (entryType === "withdrawal") {
    if (client.balance < total) return alert("Saldo do cliente insuficiente.");
    client.balance -= total;
  }
  if (entryType === "debt" && client) {
    client.debt = (client.debt || 0) + total;
  }
  if (entryType === "settlement" && client) {
    if ((client.debt || 0) < total) {
      return alert(`Divida do cliente insuficiente. Divida atual: ${currency(client.debt || 0)}.`);
    }
    client.debt -= total;
  }
  if (entryType === "sale" && paymentMethod === "Saldo do cliente") {
    if (client.balance < total) return alert("Saldo do cliente insuficiente para concluir a venda.");
    client.balance -= total;
  }

  const formEl = event.currentTarget;
  const submitButton = formEl.querySelector('button[type="submit"]');
  const previousLabel = submitButton?.textContent;
  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "A emitir...";
  }
  try {
    const saleRecord = {
      id: crypto.randomUUID(),
      clientId,
      customerName: client?.name || "Cliente avulso",
      productId,
      productName: product.name,
      quantity,
      paymentMethod,
      entryType,
      date,
      total,
      costTotal,
      sellerUsername: currentUser?.username || "",
      sellerRole: currentRole || ""
    };
    state.sales.unshift(saleRecord);

    let issuedDoc = null;
    if (entryType === "sale" && isFiscalConfigured()) {
      try {
        const fiscal = getActiveStoreFiscal();
        const docType = fiscal.defaultDocumentType || "FR";
        issuedDoc = await issueFiscalDocument({ type: docType, sale: saleRecord });
        saleRecord.documentNumber = issuedDoc.documentNumber;
        saleRecord.documentId = issuedDoc.id;
      } catch (err) {
        console.error("Erro ao emitir documento fiscal", err);
        alert("Aviso: não foi possível emitir o documento fiscal. " + (err?.message || ""));
      }
    }

    await persistMutation({
      success: issuedDoc ? `Venda guardada. Documento ${issuedDoc.documentNumber} emitido.` : "Venda guardada e sincronizada.",
      fallback: "Venda guardada localmente."
    });

    if (movement) await insertStockMovement(movement);

    formEl.reset();
    hydrateDates();
    renderAll();
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = previousLabel;
    }
  }
}

function requireAdmin() {
  if (currentRole !== "admin") {
    alert("Apenas o administrador pode realizar esta acao.");
    return false;
  }
  return true;
}

async function onCreateProduct(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = new FormData(event.currentTarget);
  const stockControlled = String(form.get("stockControlled")) === "true";
  const productId = crypto.randomUUID();
  const price = Number(form.get("price"));
  const initialStock = Number(form.get("initialStock") || 0);
  const unitCost = Number(form.get("unitCost") || 0);

  const vatRateRaw = form.get("vatRate");
  const vatRate = vatRateRaw === null || vatRateRaw === "" ? null : Number(vatRateRaw);
  productCatalog.unshift({
    id: productId,
    dbId: crypto.randomUUID(),
    name: String(form.get("name")),
    price,
    unit: String(form.get("unit") || "un"),
    category: String(form.get("category") || "Agua"),
    stockControlled,
    vatRate
  });

  if (stockControlled) {
    state.stock.unshift({
      id: crypto.randomUUID(),
      dbId: crypto.randomUUID(),
      productId,
      quantity: initialStock,
      unitCost
    });
  }

  await persistMutation({
    success: "Produto criado e sincronizado.",
    fallback: "Produto criado localmente."
  });

  event.currentTarget.reset();
  renderAll();
}

async function onCreateClient(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.clients.unshift({
    id: crypto.randomUUID(),
    name: String(form.get("name")),
    phone: String(form.get("phone")),
    address: String(form.get("address")),
    nif: String(form.get("nif") || "").trim(),
    balance: 0,
    debt: 0
  });

  await persistMutation({
    success: "Cliente sincronizado.",
    fallback: "Cliente guardado localmente."
  });

  event.currentTarget.reset();
  renderAll();
}

async function onUpdateStock(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = new FormData(event.currentTarget);
  const productId = String(form.get("productId"));
  const quantity = Number(form.get("quantity"));
  const unitCost = Number(form.get("unitCost"));
  const existing = findStockByProduct(productId);

  if (existing) {
    const totalValue = existing.quantity * existing.unitCost + quantity * unitCost;
    existing.quantity += quantity;
    existing.unitCost = totalValue / existing.quantity;
  } else {
    state.stock.push({ id: crypto.randomUUID(), productId, quantity, unitCost });
  }

  await persistMutation({
    success: "Estoque sincronizado.",
    fallback: "Estoque guardado localmente."
  });

  const movementTarget = findStockByProduct(productId);
  if (movementTarget) {
    await insertStockMovement({ itemId: movementTarget.id, productId, quantity, type: "in" });
  }

  event.currentTarget.reset();
  renderAll();
}

async function onFinanceEntry(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = new FormData(event.currentTarget);
  state.finance.unshift({
    id: crypto.randomUUID(),
    type: String(form.get("type")),
    category: String(form.get("category")),
    amount: Number(form.get("amount")),
    description: String(form.get("category")),
    date: String(form.get("date"))
  });

  await persistMutation({
    success: "Movimento financeiro sincronizado.",
    fallback: "Movimento financeiro guardado localmente."
  });

  event.currentTarget.reset();
  hydrateDates();
  renderAll();
}

async function onWaterEntry(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.waterReadings.unshift({
    id: crypto.randomUUID(),
    ph: Number(form.get("ph")),
    tds: Number(form.get("tds")),
    temperature: Number(form.get("temperature")),
    date: String(form.get("date")),
    createdAt: new Date().toISOString(),
    notes: ""
  });

  await persistMutation({
    success: "Qualidade da agua sincronizada.",
    fallback: "Qualidade da agua guardada localmente."
  });

  event.currentTarget.reset();
  hydrateDates();
  renderAll();
}

async function onMaintenanceEntry(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const form = new FormData(event.currentTarget);
  state.maintenance.unshift({
    id: crypto.randomUUID(),
    title: String(form.get("title")),
    cost: Number(form.get("cost")),
    notes: String(form.get("notes")),
    date: String(form.get("date"))
  });

  await persistMutation({
    success: "Manutencao sincronizada.",
    fallback: "Manutencao guardada localmente."
  });

  event.currentTarget.reset();
  hydrateDates();
  renderAll();
}

async function onSaveSupabaseConfig(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  supabaseConfig = {
    url: String(form.get("url") || "").trim(),
    anonKey: String(form.get("anonKey") || "").trim(),
    tables: {
      stores: String(form.get("stores") || defaultTables.stores).trim(),
      clients: String(form.get("clients") || defaultTables.clients).trim(),
      products: String(form.get("products") || defaultTables.products).trim(),
      stock: String(form.get("stock") || defaultTables.stock).trim(),
      movements: String(form.get("movements") || defaultTables.movements).trim(),
      sales: String(form.get("sales") || defaultTables.sales).trim(),
      expenses: String(form.get("expenses") || defaultTables.expenses).trim(),
      investments: String(form.get("investments") || defaultTables.investments).trim(),
      water: String(form.get("water") || defaultTables.water).trim(),
      maintenance: String(form.get("maintenance") || defaultTables.maintenance).trim()
    }
  };

  saveSupabaseConfig();
  const isOperacao = currentRole === "operacao";
  const connected = await initializeSupabaseSession({ autoPull: !isOperacao, silent: false });
  if (connected) {
    if (isOperacao) {
      try {
        await syncToSupabase();
      } catch (error) {
        console.warn("Falha ao enviar dados locais apos conectar (operacao):", error);
      }
    }
    renderAll();
  }
}

async function initializeSupabaseSession({ autoPull = false, silent = false } = {}) {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    supabaseClient = null;
    currentStore = null;
    if (!silent) setSyncStatus("warning", "Credenciais do Supabase ainda nao configuradas.");
    return false;
  }

  if (!window.supabase?.createClient) {
    setSyncStatus("danger", "Biblioteca do Supabase nao carregou. Abra o app com internet.");
    return false;
  }

  try {
    supabaseClient = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey);
    await ensureStore();
    if (autoPull) await syncFromSupabase(true);
    else setSyncStatus("success", `Supabase conectado na loja ${currentStore.name}.`);
    return true;
  } catch (error) {
    supabaseClient = null;
    currentStore = null;
    setSyncStatus("danger", formatSupabaseError(error, "Falha ao conectar no Supabase."));
    return false;
  }
}

async function ensureStore() {
  const { data, error } = await supabaseClient.from(supabaseConfig.tables.stores).select("*").order("created_at", { ascending: true });
  if (error) throw error;

  const activeStore = getActiveStore();
  const storeName = activeStore?.name || DEFAULT_STORE_NAME;
  const storePhone = activeStore?.whatsapp || DEFAULT_REPORT_PHONE;
  const existing = (data || []).find((item) => normalizeText(item.name) === normalizeText(storeName));
  if (existing) {
    currentStore = existing;
    return;
  }

  const { data: created, error: createError } = await supabaseClient
    .from(supabaseConfig.tables.stores)
    .insert({ name: storeName, whatsapp_number: storePhone.startsWith("+") ? storePhone : `+${storePhone}` })
    .select()
    .single();

  if (createError) throw createError;
  currentStore = created;
}

async function syncFromSupabase(silent = false) {
  if (!supabaseClient) {
    const connected = await initializeSupabaseSession({ autoPull: false, silent });
    if (!connected) return;
  }

  try {
    setSyncStatus("warning", "A puxar dados do Supabase...");

    const [
      clientsRows,
      productsRows,
      stockRows,
      salesRows,
      expensesRows,
      investmentsRows,
      waterRows,
      maintenanceRows
    ] = await Promise.all([
      fetchStoreRows(supabaseConfig.tables.clients),
      fetchStoreRows(supabaseConfig.tables.products),
      fetchStoreRows(supabaseConfig.tables.stock),
      fetchStoreRows(supabaseConfig.tables.sales),
      fetchStoreRows(supabaseConfig.tables.expenses),
      fetchStoreRows(supabaseConfig.tables.investments),
      fetchStoreRows(supabaseConfig.tables.water),
      fetchStoreRows(supabaseConfig.tables.maintenance)
    ]);

    state.clients = clientsRows.map(normalizeClientRow);
    productCatalog = mergeCatalogWithProducts(productsRows);
    state.stock = stockRows.map(normalizeStockRow).filter(Boolean);
    state.sales = salesRows.map(normalizeSaleRow);
    state.finance = [
      ...expensesRows.map((row) => normalizeExpenseRow(row, "expense")),
      ...investmentsRows.map((row) => normalizeInvestmentRow(row, "investment"))
    ];
    state.waterReadings = waterRows.map(normalizeWaterRow);
    state.maintenance = maintenanceRows.map(normalizeMaintenanceRow);

    saveState();
    renderAll();
    setSyncStatus("success", `Dados sincronizados com ${currentStore.name}.`);
  } catch (error) {
    setSyncStatus("danger", formatSupabaseError(error, "Falha ao puxar dados do Supabase."));
  }
}

async function syncToSupabase() {
  if (!supabaseClient) {
    const connected = await initializeSupabaseSession({ autoPull: false, silent: false });
    if (!connected) throw new Error("Conexao com Supabase indisponivel.");
  }

  try {
    setSyncStatus("warning", "A enviar dados locais para o Supabase...");

    ensureEntityIds();
    await reconcileProductIdsWithSupabase();

    await upsertRows(supabaseConfig.tables.clients, state.clients.map(serializeClientRow), "id");
    await upsertRows(supabaseConfig.tables.products, productCatalog.map(serializeProductRow), "id");
    await upsertRows(supabaseConfig.tables.stock, state.stock.map(serializeStockRow), "id");
    await upsertRows(supabaseConfig.tables.sales, state.sales.map(serializeSaleRow), "id");
    await upsertRows(supabaseConfig.tables.expenses, state.finance.filter((item) => item.type === "expense").map(serializeExpenseRow), "id");
    await upsertRows(supabaseConfig.tables.investments, state.finance.filter((item) => item.type === "investment").map(serializeInvestmentRow), "id");
    await upsertRows(supabaseConfig.tables.water, state.waterReadings.map(serializeWaterRow), "id");
    await upsertRows(supabaseConfig.tables.maintenance, state.maintenance.map(serializeMaintenanceRow), "id");

    setSyncStatus("success", "Dados enviados para o novo projeto Supabase.");
  } catch (error) {
    setSyncStatus("danger", formatSupabaseError(error, "Falha ao enviar dados para o Supabase."));
    throw error;
  }
}

async function persistMutation(messages) {
  saveState();
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    setSyncStatus("warning", "Dados guardados localmente. Configure o Supabase para sincronizar.");
    return;
  }

  try {
    await syncToSupabase();
    setSyncStatus("success", messages.success);
  } catch {
    setSyncStatus("danger", messages.fallback);
  }
}

async function insertStockMovement({ itemId, productId, quantity, type }) {
  if (!supabaseClient || !itemId || !supabaseConfig.tables.movements) return;
  const stockItem = findStockByProduct(productId);
  try {
    const { error } = await supabaseClient.from(supabaseConfig.tables.movements).insert({
      store_id: currentStore.id,
      item_id: itemId,
      product_id: findProduct(productId)?.dbId || null,
      movement_type: type,
      quantity,
      unit_cost: stockItem?.unitCost ?? 0,
      notes: type === "in" ? "Reposicao" : "Saida por venda"
    });
    if (error) throw error;
  } catch {
    setSyncStatus("warning", "Dados principais sincronizados, mas o movimento de estoque nao foi registado.");
  }
}

async function fetchStoreRows(table) {
  if (!table) return [];
  let query = supabaseClient.from(table).select("*");
  if (currentStore?.id) query = query.eq("store_id", currentStore.id);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function upsertRows(table, rows, onConflict) {
  if (!table || !rows.length) return;
  const { error } = await supabaseClient.from(table).upsert(rows, { onConflict });
  if (error) throw error;
}

async function reconcileProductIdsWithSupabase() {
  if (!supabaseClient || !currentStore?.id) return;
  const table = supabaseConfig.tables.products;
  if (!table) return;
  try {
    const { data, error } = await supabaseClient
      .from(table)
      .select("id,name")
      .eq("store_id", currentStore.id);
    if (error) throw error;
    const remoteByName = new Map();
    (data || []).forEach((row) => {
      if (row?.name) remoteByName.set(String(row.name).trim(), String(row.id));
    });
    if (!remoteByName.size) return;
    const idChanges = new Map();
    productCatalog.forEach((product) => {
      const remoteId = remoteByName.get(String(product.name || "").trim());
      if (remoteId && product.dbId !== remoteId) {
        if (product.dbId) idChanges.set(product.dbId, remoteId);
        product.dbId = remoteId;
      }
    });
    if (idChanges.size) {
      state.stock.forEach((item) => {
        if (item.productDbId && idChanges.has(item.productDbId)) {
          item.productDbId = idChanges.get(item.productDbId);
        }
      });
    }
    saveState();
  } catch (err) {
    console.warn("reconcileProductIdsWithSupabase failed", err);
  }
}

function normalizeClientRow(row) {
  return {
    id: String(row.id),
    dbId: String(row.id),
    name: row.name ?? "Cliente",
    phone: row.phone ?? "",
    address: row.address ?? "",
    balance: toNumber(row.balance ?? 0),
    debt: toNumber(row.debt ?? 0)
  };
}

function normalizeSaleRow(row) {
  const logicalId = logicalProductIdFromRow(row.product_name, row.product_id);
  return {
    id: String(row.id),
    clientId: String(row.customer_id || ""),
    customerName: row.customer_name ?? "",
    productId: logicalId,
    productName: row.product_name ?? "",
    quantity: toNumber(row.quantity ?? 1),
    paymentMethod: normalizePaymentMethod(row.payment_method),
    entryType: row.entry_type ?? "sale",
    date: normalizeDate(row.sale_date ?? row.created_at ?? today),
    total: toNumber(row.total ?? 0),
    costTotal: toNumber(row.cost_total ?? 0),
    sellerUsername: row.seller_username ?? "",
    sellerRole: row.seller_role ?? ""
  };
}

function normalizeExpenseRow(row) {
  return {
    id: String(row.id),
    type: "expense",
    category: row.category ?? "Geral",
    amount: toNumber(row.amount ?? 0),
    description: row.description ?? "",
    date: normalizeDate(row.expense_date ?? row.created_at ?? today)
  };
}

function normalizeInvestmentRow(row) {
  return {
    id: String(row.id),
    type: "investment",
    category: row.category ?? "Geral",
    amount: toNumber(row.amount ?? 0),
    description: row.description ?? "",
    date: normalizeDate(row.investment_date ?? row.created_at ?? today)
  };
}

function normalizeWaterRow(row) {
  return {
    id: String(row.id),
    ph: toNumber(row.ph ?? 0),
    tds: toNumber(row.tds ?? 0),
    temperature: toNumber(row.temperature ?? 0),
    date: normalizeDate(row.measured_at ?? row.created_at ?? today),
    notes: row.notes ?? ""
  };
}

function normalizeMaintenanceRow(row) {
  return {
    id: String(row.id),
    title: row.maintenance_type ?? "Manutencao",
    cost: toNumber(row.cost ?? 0),
    notes: [row.area, row.description].filter(Boolean).join(" | "),
    date: normalizeDate(row.maintenance_date ?? row.created_at ?? today)
  };
}

function normalizeStockRow(row) {
  const product = productCatalog.find((item) => String(item.dbId) === String(row.product_id));
  if (!product) return null;
  return {
    id: String(row.id),
    dbId: String(row.id),
    productId: product.id,
    quantity: toNumber(row.quantity ?? 0),
    unitCost: toNumber(row.avg_cost ?? 0)
  };
}

function mergeCatalogWithProducts(rows) {
  const map = new Map(baseProducts.map((item) => [item.id, { ...item }]));

  rows.forEach((row) => {
    const logicalId = logicalProductIdFromRow(row.name, row.id);
    const fallback = map.get(logicalId) || {};
    map.set(logicalId, {
      ...fallback,
      id: logicalId,
      dbId: String(row.id),
      name: row.name,
      price: toNumber(row.sale_price ?? 0),
      stockControlled: Boolean(row.stock_controlled)
    });
  });

  return [...map.values()];
}

function serializeClientRow(client) {
  return {
    id: client.dbId || client.id,
    store_id: currentStore.id,
    name: client.name,
    phone: client.phone || null,
    address: client.address || null,
    balance: client.balance ?? 0,
    debt: client.debt ?? 0
  };
}

function serializeProductRow(product) {
  const stock = findStockByProduct(product.id);
  return {
    id: product.dbId,
    store_id: currentStore.id,
    name: product.name,
    category: product.stockControlled ? "Acessorio" : "Agua",
    unit: product.unit || "un",
    sale_price: product.price,
    cost_price: stock?.unitCost ?? 0,
    stock_quantity: stock?.quantity ?? 0,
    min_stock: product.stockControlled ? 2 : 0,
    stock_controlled: product.stockControlled,
    is_active: true
  };
}

function serializeStockRow(item) {
  const product = findProduct(item.productId);
  return {
    id: item.dbId || item.id,
    store_id: currentStore.id,
    product_id: product?.dbId || null,
    quantity: item.quantity,
    avg_cost: item.unitCost,
    min_threshold: product?.stockControlled ? 2 : 0
  };
}

function serializeSaleRow(sale) {
  const product = findProduct(sale.productId);
  const client = findClient(sale.clientId);
  const unitPrice = product?.price ?? sale.total / Math.max(sale.quantity, 1);
  const costTotal = sale.costTotal ?? 0;
  return {
    id: sale.id,
    store_id: currentStore.id,
    customer_id: client?.dbId || client?.id || null,
    product_id: product?.dbId || null,
    product_name: product?.name || sale.productName || sale.productId,
    quantity: sale.quantity,
    unit_price: unitPrice,
    total: sale.total,
    cost_total: costTotal,
    profit: sale.total - costTotal,
    payment_method: normalizeWritablePaymentMethod(sale.paymentMethod),
    entry_type: sale.entryType,
    counts_as_sale: sale.entryType !== "withdrawal" && sale.entryType !== "debt",
    customer_name: client?.name || sale.customerName || null,
    notes: ({ deposit: "Deposito do cliente", withdrawal: "Levantamento do saldo", debt: "Divida do cliente", settlement: "Liquidacao de divida" })[sale.entryType] || null,
    sale_date: sale.date
  };
}

function serializeExpenseRow(item) {
  return {
    id: item.id,
    store_id: currentStore.id,
    category: item.category,
    amount: item.amount,
    description: item.description || item.category,
    expense_date: item.date
  };
}

function serializeInvestmentRow(item) {
  return {
    id: item.id,
    store_id: currentStore.id,
    category: item.category,
    amount: item.amount,
    description: item.description || item.category,
    investment_date: item.date
  };
}

function serializeWaterRow(item) {
  return {
    id: item.id,
    store_id: currentStore.id,
    ph: item.ph,
    tds: item.tds,
    temperature: item.temperature,
    chlorine: null,
    status: phStatus(item.ph),
    notes: item.notes || null,
    measured_at: item.date
  };
}

function serializeMaintenanceRow(item) {
  return {
    id: item.id,
    store_id: currentStore.id,
    maintenance_date: item.date,
    maintenance_type: item.title,
    area: "agua",
    description: item.notes,
    cost: item.cost
  };
}

function buildPeriodStats(period, anchor = today) {
  const buckets = buildBuckets(period, anchor);
  const salesEntries = entriesThatCountAsSales();
  const expenseEntries = getAllExpenseEntries();
  const investmentEntries = state.finance.filter((item) => item.type === "investment");

  // Headline numbers reflect ONLY the selected period (single day / week / month / year).
  const selected = selectedBucket(period, anchor);
  const selectedSales = salesEntries.filter((item) => selected.contains(item.date));
  const selectedExpenses = expenseEntries.filter((item) => selected.contains(item.date));
  const selectedInvestments = investmentEntries.filter((item) => selected.contains(item.date));

  const salesTotal = selectedSales.reduce((sum, item) => sum + item.total, 0);
  const expensesTotal = selectedExpenses.reduce((sum, item) => sum + item.amount, 0);
  const investmentsTotal = selectedInvestments.reduce((sum, item) => sum + item.amount, 0);
  const paymentTotals = groupPayments(selectedSales);

  // Timeline drives the trend chart, so it stays the rolling window of buckets.
  const timeline = buckets.map((bucket) => {
    const sales = salesEntries.filter((item) => bucket.contains(item.date)).reduce((sum, item) => sum + item.total, 0);
    const expenses = expenseEntries.filter((item) => bucket.contains(item.date)).reduce((sum, item) => sum + item.amount, 0);
    const investments = investmentEntries.filter((item) => bucket.contains(item.date)).reduce((sum, item) => sum + item.amount, 0);
    return {
      label: bucket.label,
      fullLabel: bucket.fullLabel,
      sales,
      expenses,
      investments,
      profit: sales - expenses - investments
    };
  });

  return {
    selectedLabel: selected.label,
    salesTotal,
    salesCount: selectedSales.length,
    expenses: expensesTotal,
    investments: investmentsTotal,
    profit: salesTotal - expensesTotal - investmentsTotal,
    paymentTotals,
    productTotals: selectedSales.reduce((acc, item) => {
      const name = findProduct(item.productId)?.name || item.productName || "Produto";
      acc[name] = (acc[name] || 0) + item.total;
      return acc;
    }, {}),
    timeline
  };
}

function parseIsoUtc(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y || 1970, (m || 1) - 1, d || 1));
}

function isoFromUtc(date) {
  return date.toISOString().slice(0, 10);
}

function startOfWeekUtc(date) {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // Sunday = 0
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function selectedBucket(period, anchor) {
  const anchorDate = parseIsoUtc(anchor);
  if (period === "weekly") {
    const sunday = startOfWeekUtc(anchorDate);
    const saturday = new Date(sunday.getTime());
    saturday.setUTCDate(saturday.getUTCDate() + 6);
    const startIso = isoFromUtc(sunday);
    const endIso = isoFromUtc(saturday);
    return {
      label: `Semana de ${formatDateBr(startIso)} a ${formatDateBr(endIso)}`,
      contains: (date) => {
        const iso = String(date).slice(0, 10);
        return iso >= startIso && iso <= endIso;
      }
    };
  }
  if (period === "monthly") {
    const ym = `${anchorDate.getUTCFullYear()}-${String(anchorDate.getUTCMonth() + 1).padStart(2, "0")}`;
    return {
      label: `${PT_MONTHS[anchorDate.getUTCMonth()]} de ${anchorDate.getUTCFullYear()}`,
      contains: (date) => String(date).slice(0, 7) === ym
    };
  }
  if (period === "yearly") {
    const ys = String(anchorDate.getUTCFullYear());
    return {
      label: `Ano ${ys}`,
      contains: (date) => String(date).slice(0, 4) === ys
    };
  }
  const iso = isoFromUtc(anchorDate);
  return {
    label: formatDateBr(iso),
    contains: (date) => String(date).slice(0, 10) === iso
  };
}

function formatDateBr(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function buildBuckets(period, anchor) {
  const anchorDate = parseIsoUtc(anchor);
  if (period === "daily") {
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(anchorDate.getTime());
      d.setUTCDate(d.getUTCDate() - (6 - idx));
      const iso = isoFromUtc(d);
      return {
        label: iso.slice(5),
        fullLabel: iso,
        contains: (date) => String(date).slice(0, 10) === iso
      };
    });
  }
  if (period === "weekly") {
    return Array.from({ length: 4 }, (_, idx) => {
      const d = new Date(anchorDate.getTime());
      d.setUTCDate(d.getUTCDate() - (3 - idx) * 7);
      const sunday = startOfWeekUtc(d);
      const saturday = new Date(sunday.getTime());
      saturday.setUTCDate(saturday.getUTCDate() + 6);
      const startIso = isoFromUtc(sunday);
      const endIso = isoFromUtc(saturday);
      const wnum = weekOfMonthUtc(sunday);
      const monthName = SHORT_MONTH_NAMES[sunday.getUTCMonth()];
      return {
        label: `S${wnum}/${monthName}`,
        fullLabel: `Semana ${wnum} de ${monthName} (${startIso} a ${endIso})`,
        contains: (date) => {
          const iso = String(date).slice(0, 10);
          return iso >= startIso && iso <= endIso;
        }
      };
    });
  }
  if (period === "monthly") {
    return Array.from({ length: 12 }, (_, idx) => {
      const d = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() - (11 - idx), 1));
      const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return {
        label: `${monthNames[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`,
        fullLabel: ym,
        contains: (date) => String(date).slice(0, 7) === ym
      };
    });
  }
  return Array.from({ length: 5 }, (_, idx) => {
    const year = anchorDate.getUTCFullYear() - (4 - idx);
    const ys = String(year);
    return {
      label: ys,
      fullLabel: `Ano ${ys}`,
      contains: (date) => String(date).slice(0, 4) === ys
    };
  });
}

function weekOfMonthUtc(sunday) {
  const firstOfMonth = new Date(Date.UTC(sunday.getUTCFullYear(), sunday.getUTCMonth(), 1));
  const firstSunday = startOfWeekUtc(firstOfMonth);
  const diffDays = Math.round((sunday - firstSunday) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function weekOfMonth(date) {
  const d = new Date(date);
  const sunday = startOfWeek(d);
  const firstOfMonth = new Date(sunday.getFullYear(), sunday.getMonth(), 1);
  const firstSunday = startOfWeek(firstOfMonth);
  const diffDays = Math.round((sunday - firstSunday) / 86400000);
  return Math.floor(diffDays / 7) + 1;
}

const SHORT_MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function buildDailyReport() {
  const sales = entriesThatCountAsSales().filter((item) => item.date === today).reduce((sum, item) => sum + item.total, 0);
  const expenses = getAllExpenseEntries().filter((item) => item.date === today).reduce((sum, item) => sum + item.amount, 0);
  const investments = state.finance.filter((item) => item.type === "investment" && item.date === today).reduce((sum, item) => sum + item.amount, 0);

  return {
    sales,
    expenses,
    investments,
    profit: sales - expenses - investments,
    clientsWithBalance: state.clients.filter((client) => client.balance > 0).length
  };
}

function buildMonthlyReport() {
  const now = new Date(today);
  const month = now.getMonth();
  const year = now.getFullYear();

  const sales = entriesThatCountAsSales()
    .filter((item) => {
      const entryDate = new Date(item.date);
      return entryDate.getMonth() === month && entryDate.getFullYear() === year;
    })
    .reduce((sum, item) => sum + item.total, 0);

  const expenses = getAllExpenseEntries().filter((item) => sameMonth(item.date, today)).reduce((sum, item) => sum + item.amount, 0);
  const investments = state.finance.filter((item) => item.type === "investment" && sameMonth(item.date, today)).reduce((sum, item) => sum + item.amount, 0);

  return {
    sales,
    expenses,
    investments,
    profit: sales - expenses - investments,
    readings: state.waterReadings.filter((item) => sameMonth(item.date, today)).length,
    maintenance: state.maintenance.filter((item) => sameMonth(item.date, today)).length
  };
}

function buildDailyReportText() {
  const todaySales = entriesThatCountAsSales().filter((item) => item.date === today);
  const todayExpenses = getAllExpenseEntries().filter((item) => item.date === today);
  const todayInvestments = state.finance.filter((item) => item.type === "investment" && item.date === today);

  const totalSales = todaySales.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalExpenses = todayExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalInvestments = todayInvestments.reduce((sum, item) => sum + (item.amount || 0), 0);
  const profit = totalSales - totalExpenses - totalInvestments;

  const totalTransactions = todaySales.length + todayExpenses.length + todayInvestments.length;

  const latestPh = [...state.waterReadings]
    .filter((r) => r.ph != null && !Number.isNaN(Number(r.ph)))
    .sort((a, b) => {
      const ka = String(a.createdAt || a.date || "");
      const kb = String(b.createdAt || b.date || "");
      return kb.localeCompare(ka);
    })[0];

  const storeName = getActiveStore()?.name || DEFAULT_STORE_NAME;

  const lines = [];
  lines.push(`*${storeName} - Relatório Diário - ${today}*`);
  lines.push("");
  lines.push("💰 *Financeiro:*");
  lines.push(`• Vendas: ${currency(totalSales)}`);
  lines.push(`• Despesas: ${currency(totalExpenses)}`);
  lines.push(`• Investimentos: ${currency(totalInvestments)}`);
  lines.push(`• *Saldo Líquido: ${currency(profit)}*`);
  lines.push("");
  lines.push("💧 *Qualidade (Último pH):*");
  if (latestPh) {
    lines.push(`• Valor: ${Number(latestPh.ph).toFixed(2)} (${phStatus(latestPh.ph)})`);
    lines.push(`• Data: ${formatPhDateTime(latestPh)}`);
  } else {
    lines.push("• Sem registos");
  }
  lines.push("");
  lines.push("📊 *Resumo Operacional:*");
  lines.push(`• Total de Transações: ${totalTransactions}`);
  lines.push(`• Vendas Realizadas: ${todaySales.length}`);

  return lines.join("\n");
}

function formatPhDateTime(reading) {
  const ts = reading.createdAt || (reading.date ? `${reading.date}T00:00:00` : null);
  if (!ts) return "-";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return reading.date || "-";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;
}

function sendWhatsappReport() {
  const text = buildDailyReportText();
  const phoneRaw = (getActiveStore()?.whatsapp || DEFAULT_REPORT_PHONE).replace(/[^0-9]/g, "");
  window.open(`https://wa.me/${phoneRaw}?text=${encodeURIComponent(text)}`, "_blank");
}

const PT_MONTHS = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

async function loadImageAsDataUrl(src) {
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildMonthlyDataset() {
  const now = new Date(today);
  const month = now.getMonth();
  const year = now.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthSales = entriesThatCountAsSales().filter((s) => {
    const d = new Date(s.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });

  const monthExpenses = getAllExpenseEntries().filter((f) => sameMonth(f.date, today));
  const monthInvestments = state.finance.filter((f) => f.type === "investment" && sameMonth(f.date, today));

  const totals = {
    sales: monthSales.reduce((s, i) => s + (i.total || 0), 0),
    expenses: monthExpenses.reduce((s, i) => s + (i.amount || 0), 0),
    investments: monthInvestments.reduce((s, i) => s + (i.amount || 0), 0),
    quantity: monthSales.reduce((s, i) => s + (i.quantity || 0), 0),
    transactions: monthSales.length
  };
  totals.profit = totals.sales - totals.expenses - totals.investments;

  const byProductMap = new Map();
  monthSales.forEach((s) => {
    const key = s.productName || s.productId || "(Sem produto)";
    const acc = byProductMap.get(key) || { product: key, quantity: 0, total: 0 };
    acc.quantity += Number(s.quantity || 0);
    acc.total += Number(s.total || 0);
    byProductMap.set(key, acc);
  });
  const byProduct = [...byProductMap.values()].sort((a, b) => b.total - a.total);

  const paymentMethods = ["Consolidada", "TPA", "Express", "Saldo do cliente"];
  const byPayment = paymentMethods.map((method) => {
    const items = monthSales.filter((s) => s.paymentMethod === method);
    return {
      method,
      transactions: items.length,
      total: items.reduce((sum, i) => sum + (i.total || 0), 0)
    };
  });

  const dailySales = Array.from({ length: daysInMonth }, (_, idx) => {
    const day = idx + 1;
    const total = monthSales
      .filter((s) => new Date(s.date).getDate() === day)
      .reduce((sum, i) => sum + (i.total || 0), 0);
    return { day, total };
  });

  const expensesByCategory = new Map();
  monthExpenses.forEach((e) => {
    const key = e.category || "Sem categoria";
    expensesByCategory.set(key, (expensesByCategory.get(key) || 0) + (e.amount || 0));
  });

  return {
    period: { month, year, monthName: PT_MONTHS[month], daysInMonth },
    totals,
    byProduct,
    byPayment,
    dailySales,
    expenses: monthExpenses.slice().sort((a, b) => new Date(b.date) - new Date(a.date)),
    investments: monthInvestments.slice().sort((a, b) => new Date(b.date) - new Date(a.date)),
    expensesByCategory: [...expensesByCategory.entries()]
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total)
  };
}

async function generateMonthlyPdf() {
  if (!window.jspdf?.jsPDF) {
    alert("Biblioteca de PDF nao carregada. Verifique a conexao a internet.");
    return;
  }
  const button = document.getElementById("monthlyReportButton");
  const originalLabel = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = "Gerando PDF...";
  }
  try {
    const data = buildMonthlyDataset();
    const store = getActiveStore();
    const storeName = store?.name || DEFAULT_STORE_NAME;
    const logoDataUrl = await loadImageAsDataUrl("assets/login-logo.png");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    const generatedAt = new Date().toLocaleString("pt-PT");
    const headerCtx = { logoDataUrl, storeName, period: data.period, generatedAt, pageWidth, marginX, headerDrawnPages: new Set() };

    drawPdfHeader(doc, headerCtx);
    headerCtx.headerDrawnPages.add(doc.internal.getCurrentPageInfo().pageNumber);
    let cursorY = 170;

    cursorY = drawSummaryBlock(doc, data, { startY: cursorY, marginX, pageWidth });
    cursorY = ensurePageSpace(doc, cursorY + 18, 120, headerCtx);
    cursorY = drawSalesByProductTable(doc, data, { startY: cursorY, marginX, headerCtx });
    cursorY = ensurePageSpace(doc, cursorY + 18, 120, headerCtx);
    cursorY = drawSalesByPaymentTable(doc, data, { startY: cursorY, marginX, headerCtx });
    cursorY = ensurePageSpace(doc, cursorY, 220, headerCtx);
    cursorY = drawDailySalesChart(doc, data, { startY: cursorY + 18, marginX, pageWidth });
    cursorY = ensurePageSpace(doc, cursorY, 220, headerCtx);
    cursorY = drawTopProductsChart(doc, data, { startY: cursorY + 18, marginX, pageWidth });
    cursorY = drawExpensesTables(doc, data, { startY: cursorY + 18, marginX, headerCtx });

    addPdfFooters(doc);

    const filename = `Relatorio-${slugify(storeName)}-${data.period.year}-${String(data.period.month + 1).padStart(2, "0")}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("Falha ao gerar PDF:", error);
    alert("Nao foi possivel gerar o relatorio em PDF. " + (error?.message || ""));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = originalLabel || "Gerar relatorio mensal (PDF)";
    }
  }
}

function drawPdfHeader(doc, { logoDataUrl, storeName, period, generatedAt, pageWidth, marginX }) {
  doc.setFillColor(7, 56, 95);
  doc.rect(0, 0, pageWidth, 110, "F");
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", marginX, 18, 74, 74);
    } catch {
      // ignore image errors
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(storeName, marginX + 90, 50);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Relatorio mensal - ${period.monthName} ${period.year}`, marginX + 90, 70);
  doc.setFontSize(9);
  doc.text(`Gerado em ${generatedAt}`, marginX + 90, 88);
  doc.setTextColor(20, 30, 50);
}

function drawSummaryBlock(doc, data, { startY, marginX, pageWidth }) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Sumario do mes", marginX, startY);
  const cards = [
    { label: "Vendas", value: currency(data.totals.sales) },
    { label: "Lucro", value: currency(data.totals.profit) },
    { label: "Despesas", value: currency(data.totals.expenses) },
    { label: "Investimentos", value: currency(data.totals.investments) }
  ];
  const cardW = (pageWidth - marginX * 2 - 18) / 4;
  const cardH = 60;
  cards.forEach((card, idx) => {
    const x = marginX + idx * (cardW + 6);
    const y = startY + 10;
    doc.setFillColor(241, 246, 252);
    doc.roundedRect(x, y, cardW, cardH, 6, 6, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 90, 110);
    doc.text(card.label.toUpperCase(), x + 10, y + 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(7, 56, 95);
    doc.text(card.value, x + 10, y + 38);
  });
  doc.setTextColor(20, 30, 50);
  const extraY = startY + 10 + cardH + 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `Transacoes: ${data.totals.transactions} | Quantidade total vendida: ${data.totals.quantity}`,
    marginX,
    extraY
  );
  return extraY + 6;
}

function runAutoTable(doc, headerCtx, options) {
  const merged = {
    ...options,
    margin: { left: headerCtx.marginX, right: headerCtx.marginX, top: 130, ...(options.margin || {}) },
    didDrawPage: (pageData) => {
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
      if (!headerCtx.headerDrawnPages.has(currentPage)) {
        drawPdfHeader(doc, headerCtx);
        headerCtx.headerDrawnPages.add(currentPage);
      }
      if (typeof options.didDrawPage === "function") {
        options.didDrawPage(pageData);
      }
    }
  };
  doc.autoTable(merged);
  return doc.lastAutoTable.finalY;
}

function drawSalesByProductTable(doc, data, { startY, marginX, headerCtx }) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 30, 50);
  doc.text("Vendas por produto", marginX, startY);
  const totalSales = data.totals.sales || 1;
  const body = data.byProduct.length
    ? data.byProduct.map((p) => [
        p.product,
        String(p.quantity),
        currency(p.total),
        `${((p.total / totalSales) * 100).toFixed(1)}%`
      ])
    : [["Sem vendas no periodo", "-", "-", "-"]];
  return runAutoTable(doc, headerCtx, {
    startY: startY + 8,
    head: [["Produto", "Quantidade", "Total", "% das vendas"]],
    body,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [7, 56, 95], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 246, 252] }
  });
}

function drawSalesByPaymentTable(doc, data, { startY, marginX, headerCtx }) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Vendas por metodo de pagamento", marginX, startY);
  const totalSales = data.totals.sales || 1;
  const body = data.byPayment.map((row) => [
    row.method,
    String(row.transactions),
    currency(row.total),
    `${((row.total / totalSales) * 100).toFixed(1)}%`
  ]);
  return runAutoTable(doc, headerCtx, {
    startY: startY + 8,
    head: [["Metodo", "Transacoes", "Total", "% das vendas"]],
    body,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [7, 56, 95], textColor: 255 },
    alternateRowStyles: { fillColor: [241, 246, 252] }
  });
}

function drawDailySalesChart(doc, data, { startY, marginX, pageWidth }) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 30, 50);
  doc.text("Vendas por dia do mes", marginX, startY);
  const chartTop = startY + 14;
  const chartHeight = 160;
  const chartWidth = pageWidth - marginX * 2;
  doc.setDrawColor(220, 226, 235);
  doc.setFillColor(248, 250, 253);
  doc.roundedRect(marginX, chartTop, chartWidth, chartHeight, 6, 6, "FD");

  const max = Math.max(1, ...data.dailySales.map((d) => d.total));
  const innerLeft = marginX + 10;
  const innerRight = marginX + chartWidth - 10;
  const innerTop = chartTop + 10;
  const innerBottom = chartTop + chartHeight - 22;
  const usableHeight = innerBottom - innerTop;
  const slot = (innerRight - innerLeft) / data.dailySales.length;
  const barW = Math.max(2, slot * 0.6);

  data.dailySales.forEach((entry, idx) => {
    const x = innerLeft + slot * idx + (slot - barW) / 2;
    const h = (entry.total / max) * usableHeight;
    const y = innerBottom - h;
    if (entry.total === 0) {
      doc.setFillColor(220, 226, 235);
    } else if (entry.total < 17000) {
      doc.setFillColor(217, 79, 61);
    } else if (entry.total <= 25000) {
      doc.setFillColor(216, 164, 34);
    } else {
      doc.setFillColor(44, 140, 91);
    }
    doc.rect(x, y, barW, Math.max(1, h), "F");
    if ((idx + 1) % 5 === 0 || idx === 0 || idx === data.dailySales.length - 1) {
      doc.setFontSize(7);
      doc.setTextColor(80, 90, 110);
      doc.text(String(entry.day), x + barW / 2, innerBottom + 12, { align: "center" });
    }
  });

  doc.setFontSize(8);
  doc.setTextColor(80, 90, 110);
  doc.text(`Maximo: ${currency(max)}`, marginX + 6, innerTop + 8);
  doc.setTextColor(20, 30, 50);
  return chartTop + chartHeight;
}

function drawTopProductsChart(doc, data, { startY, marginX, pageWidth }) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Top produtos do mes", marginX, startY);
  const chartTop = startY + 14;
  const top = data.byProduct.slice(0, 6);
  if (!top.length) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Sem vendas registradas no periodo.", marginX, chartTop + 14);
    return chartTop + 18;
  }
  const max = Math.max(1, ...top.map((p) => p.total));
  const rowHeight = 22;
  const labelWidth = 140;
  const barAreaLeft = marginX + labelWidth + 10;
  const barAreaWidth = pageWidth - marginX - barAreaLeft - 70;
  top.forEach((p, idx) => {
    const y = chartTop + idx * rowHeight;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(20, 30, 50);
    doc.text(truncateText(p.product, 28), marginX, y + 14);
    const w = (p.total / max) * barAreaWidth;
    doc.setFillColor(13, 132, 200);
    doc.roundedRect(barAreaLeft, y + 4, Math.max(2, w), 14, 3, 3, "F");
    doc.setFontSize(8);
    doc.setTextColor(80, 90, 110);
    doc.text(currency(p.total), barAreaLeft + barAreaWidth + 6, y + 14);
  });
  return chartTop + top.length * rowHeight;
}

function drawExpensesTables(doc, data, { startY, marginX, headerCtx }) {
  let cursorY = ensurePageSpace(doc, startY, 120, headerCtx);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(20, 30, 50);
  doc.text("Despesas do mes", marginX, cursorY);
  const expensesBody = data.expenses.length
    ? data.expenses.map((e) => [
        formatDateShort(e.date),
        e.category || "-",
        e.description || "-",
        currency(e.amount)
      ])
    : [["-", "Sem despesas registradas", "-", "-"]];
  cursorY = runAutoTable(doc, headerCtx, {
    startY: cursorY + 8,
    head: [["Data", "Categoria", "Descricao", "Valor"]],
    body: expensesBody,
    foot: data.expenses.length
      ? [["", "", "Total", currency(data.totals.expenses)]]
      : undefined,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [148, 60, 60], textColor: 255 },
    footStyles: { fillColor: [241, 246, 252], fontStyle: "bold", textColor: [20, 30, 50] },
    alternateRowStyles: { fillColor: [253, 246, 244] }
  }) + 18;

  if (data.expensesByCategory.length) {
    cursorY = ensurePageSpace(doc, cursorY, 120, headerCtx);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Despesas por categoria", marginX, cursorY);
    cursorY = runAutoTable(doc, headerCtx, {
      startY: cursorY + 8,
      head: [["Categoria", "Total", "% das despesas"]],
      body: data.expensesByCategory.map((row) => [
        row.category,
        currency(row.total),
        `${((row.total / (data.totals.expenses || 1)) * 100).toFixed(1)}%`
      ]),
      styles: { fontSize: 9, cellPadding: 5 },
      headStyles: { fillColor: [148, 60, 60], textColor: 255 },
      alternateRowStyles: { fillColor: [253, 246, 244] }
    }) + 18;
  }

  cursorY = ensurePageSpace(doc, cursorY, 120, headerCtx);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Investimentos do mes", marginX, cursorY);
  const investmentsBody = data.investments.length
    ? data.investments.map((e) => [
        formatDateShort(e.date),
        e.category || "-",
        e.description || "-",
        currency(e.amount)
      ])
    : [["-", "Sem investimentos registrados", "-", "-"]];
  return runAutoTable(doc, headerCtx, {
    startY: cursorY + 8,
    head: [["Data", "Categoria", "Descricao", "Valor"]],
    body: investmentsBody,
    foot: data.investments.length
      ? [["", "", "Total", currency(data.totals.investments)]]
      : undefined,
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [44, 92, 140], textColor: 255 },
    footStyles: { fillColor: [241, 246, 252], fontStyle: "bold", textColor: [20, 30, 50] },
    alternateRowStyles: { fillColor: [241, 248, 253] }
  });
}

function ensurePageSpace(doc, currentY, neededHeight, headerCtx) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + neededHeight > pageHeight - 50) {
    doc.addPage();
    drawPdfHeader(doc, headerCtx);
    headerCtx?.headerDrawnPages?.add(doc.internal.getCurrentPageInfo().pageNumber);
    return 170;
  }
  return currentY;
}

function addPdfFooters(doc) {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110, 120, 140);
    doc.text(`Pagina ${i} de ${pages}`, w / 2, h - 20, { align: "center" });
    doc.text("AGUA CRISTALINA - Relatorio gerado automaticamente", 40, h - 20);
  }
  doc.setTextColor(20, 30, 50);
}

function truncateText(value, max) {
  const str = String(value || "");
  return str.length > max ? `${str.slice(0, max - 1)}...` : str;
}

function formatDateShort(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .toLowerCase() || "loja";
}

async function copyDailyReport() {
  const text = buildDailyReportText();

  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    alert("Relatorio diario copiado.");
    return;
  }

  alert(text);
}

function entriesThatCountAsSales() {
  // Sale, deposit, settlement count as sales of the day.
  // Withdrawal and debt do NOT count.
  return state.sales.filter((item) => item.entryType !== "withdrawal" && item.entryType !== "debt");
}

// Returns all entries that count as expenses: finance expenses + maintenance costs.
// Maintenance items are normalized to look like a finance expense entry so they can be
// summed and listed alongside regular expenses (PDF tables, dashboards, reports, etc.).
function getAllExpenseEntries() {
  const finance = state.finance.filter((item) => item.type === "expense");
  const maintenance = state.maintenance.map((item) => ({
    id: `maint-${item.id}`,
    type: "expense",
    category: "Manutencao",
    description: item.title || item.notes || "Manutencao",
    amount: Number(item.cost) || 0,
    date: item.date,
    source: "maintenance"
  }));
  return [...finance, ...maintenance];
}

function migrateClientsForDebt() {
  let changed = false;
  state.clients.forEach((client) => {
    if (typeof client.debt !== "number") {
      client.debt = 0;
      changed = true;
    }
  });
  if (changed) saveState();
}

function sumFinanceByType(type, period) {
  return state.finance.filter((item) => item.type === type).filter((item) => matchPeriod(item.date, period)).reduce((sum, item) => sum + item.amount, 0);
}

function groupPayments(items) {
  return ["Consolidada", "TPA", "Express", "Saldo do cliente"].reduce((acc, method) => {
    acc[method] = items.filter((item) => item.paymentMethod === method).reduce((sum, item) => sum + item.total, 0);
    return acc;
  }, {});
}

function matchPeriod(date, period) {
  const itemDate = new Date(date);
  const current = new Date(today);
  if (period === "daily") return (current - itemDate) / 86400000 < 7;
  if (period === "weekly") return (current - itemDate) / 86400000 < 42;
  return itemDate.getFullYear() === current.getFullYear();
}

function salesColor(value) {
  if (value < 17000) return "linear-gradient(180deg, #f08f84, #d94f3d)";
  if (value <= 25000) return "linear-gradient(180deg, #f4d36f, #d8a422)";
  return "linear-gradient(180deg, #62c595, #2c8c5b)";
}

function translateEntryType(type) {
  return ({ sale: "Venda", deposit: "Deposito", withdrawal: "Levantamento", debt: "Divida", settlement: "Liquidacao" })[type] || type;
}

function sameMonth(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function ensureEntityIds() {
  state.clients.forEach((client) => {
    if (!isUuid(client.id)) client.id = crypto.randomUUID();
    if (!isUuid(client.dbId)) client.dbId = client.id;
  });

  productCatalog.forEach((product) => {
    if (!isUuid(product.dbId)) product.dbId = crypto.randomUUID();
  });

  state.stock.forEach((item) => {
    if (!isUuid(item.id)) item.id = crypto.randomUUID();
    if (!isUuid(item.dbId)) item.dbId = item.id;
  });

  state.sales.forEach((sale) => {
    if (!isUuid(sale.id)) sale.id = crypto.randomUUID();
  });

  state.finance.forEach((item) => {
    if (!isUuid(item.id)) item.id = crypto.randomUUID();
  });

  state.waterReadings.forEach((item) => {
    if (!isUuid(item.id)) item.id = crypto.randomUUID();
  });

  state.maintenance.forEach((item) => {
    if (!isUuid(item.id)) item.id = crypto.randomUUID();
  });
}

function findClient(id) {
  return state.clients.find((client) => String(client.id) === String(id));
}

function findProduct(id) {
  return productCatalog.find((product) => String(product.id) === String(id));
}

function findStockByProduct(productId) {
  return state.stock.find((item) => String(item.productId) === String(productId));
}

function logicalProductIdFromRow(name, dbId) {
  const byName = baseProducts.find((item) => normalizeText(item.name) === normalizeText(name));
  if (byName) return byName.id;
  const byDb = productCatalog.find((item) => String(item.dbId) === String(dbId));
  if (byDb) return byDb.id;
  return slugify(name || dbId || crypto.randomUUID());
}

function normalizePaymentMethod(value) {
  if (!value) return "Consolidada";
  const normalized = normalizeText(value);
  if (normalized.includes("express")) return "Express";
  if (normalized.includes("tpa")) return "TPA";
  if (normalized.includes("saldo")) return "Saldo do cliente";
  return "Consolidada";
}

function normalizeWritablePaymentMethod(value) {
  return ["Express", "Consolidada", "TPA", "Saldo do cliente"].includes(value) ? value : "Consolidada";
}

function phStatus(value) {
  const number = toNumber(value);
  if (number >= 6.5 && number <= 8.5) return "Ideal";
  if ((number >= 6 && number < 6.5) || (number > 8.5 && number <= 9)) return "Alerta";
  return "Critico";
}

function currency(value) {
  const formatted = Number(value || 0)
    .toLocaleString("pt-PT")
    .replace(/\./g, " ")
    .replace(/\u00A0/g, " ");
  return `${formatted} Kz`;
}

function offsetDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value;
}

function renderSalePreview() {
  const product = findProduct(document.getElementById("saleProduct")?.value);
  const quantity = Number(document.getElementById("saleQuantity")?.value || 0);
  const unit = product?.price ?? 0;
  const total = unit * Math.max(quantity, 0);
  const unitTarget = document.getElementById("saleUnitPrice");
  const totalTarget = document.getElementById("saleTotalPreview");
  if (unitTarget) unitTarget.textContent = currency(unit);
  if (totalTarget) totalTarget.textContent = currency(total);
}

function buildFinanceAnalytics(period, anchor = today) {
  const buckets = buildBuckets(period, anchor);
  const expenseEntries = getAllExpenseEntries();
  const investmentEntries = state.finance.filter((item) => item.type === "investment");
  const inAnyBucket = (date) => buckets.some((b) => b.contains(date));
  const filteredExpenses = expenseEntries.filter((item) => inAnyBucket(item.date));
  const filteredInvestments = investmentEntries.filter((item) => inAnyBucket(item.date));

  const timeline = buckets.map((bucket) => {
    const expenses = expenseEntries.filter((item) => bucket.contains(item.date)).reduce((sum, item) => sum + item.amount, 0);
    const investments = investmentEntries.filter((item) => bucket.contains(item.date)).reduce((sum, item) => sum + item.amount, 0);
    return {
      label: bucket.label,
      fullLabel: bucket.fullLabel,
      expenses,
      investments,
      impact: expenses + investments
    };
  });

  return {
    expenses: filteredExpenses.reduce((sum, item) => sum + item.amount, 0),
    investments: filteredInvestments.reduce((sum, item) => sum + item.amount, 0),
    timeline
  };
}

function formatMetricValue(metric, value) {
  if (metric === "ph") return `${Number(value).toFixed(1)}`;
  if (metric === "temperature") return `${Number(value).toFixed(1)} C`;
  return `${Number(value).toFixed(0)}`;
}

function normalizeDate(value) {
  return String(value || today).slice(0, 10);
}

function toNumber(value) {
  return Number(value || 0);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function formatSupabaseError(error, fallback) {
  return error?.message ? `${fallback} ${error.message}` : fallback;
}

// =====================================================================
// AGT (Angola Tax Authority) certification helpers
// =====================================================================

function getActiveStoreFiscal() {
  const store = getActiveStore();
  return store?.fiscal || null;
}

function isFiscalConfigured() {
  const f = getActiveStoreFiscal();
  return !!(f && f.nif && f.legalName && f.address && f.documentSeries);
}

function getProductVatRate(product) {
  if (product && product.vatRate != null && product.vatRate !== "" && !Number.isNaN(Number(product.vatRate))) {
    return Number(product.vatRate);
  }
  const f = getActiveStoreFiscal();
  return f && f.defaultVatRate != null ? Number(f.defaultVatRate) : 14;
}

async function sha1Base64(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-1", data);
  let s = "";
  new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s);
}

function nextDocumentNumber(type, series) {
  const docs = (state.documents || []).filter((d) => d.type === type && d.series === series);
  const max = docs.reduce((m, d) => Math.max(m, Number(d.sequence) || 0), 0);
  return max + 1;
}

function previousDocumentHash(type) {
  const year = today.slice(0, 4);
  const docs = (state.documents || [])
    .filter((d) => d.type === type && (d.issueDate || "").startsWith(year))
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  return docs.length ? (docs[docs.length - 1].hashFull || "") : "";
}

async function buildDocumentHash({ issueDate, systemDateTime, documentNumber, grossTotal, previousHash }) {
  const payload = `${issueDate};${systemDateTime};${documentNumber};${Number(grossTotal).toFixed(2)};${previousHash}`;
  const full = await sha1Base64(payload);
  const c = (i) => full[i] || "*";
  const compact = `${c(0)}${c(10)}${c(20)}${c(30)}`;
  return { full, compact, payload };
}

function buildVatBreakdown(items) {
  const map = new Map();
  items.forEach((item) => {
    const rate = Number(item.vatRate || 0);
    const acc = map.get(rate) || { rate, base: 0, tax: 0, gross: 0 };
    acc.base += item.base;
    acc.tax += item.tax;
    acc.gross += item.gross;
    map.set(rate, acc);
  });
  return [...map.values()].sort((a, b) => b.rate - a.rate);
}

async function issueFiscalDocument({ type = "FR", sale }) {
  const fiscal = getActiveStoreFiscal();
  if (!fiscal) throw new Error("Configuração fiscal não definida.");
  if (!fiscal.documentSeries) throw new Error("Série de facturação não definida.");

  const series = fiscal.documentSeries;
  const sequence = nextDocumentNumber(type, series);
  const documentNumber = `${type} ${series}/${String(sequence).padStart(4, "0")}`;
  const issueDate = today;
  const systemDateTime = new Date().toISOString().slice(0, 19);

  const product = sale ? findProduct(sale.productId) : null;
  const vatRate = getProductVatRate(product);
  const qty = Number(sale?.quantity || 1);
  const gross = Number(sale?.total || 0);
  const base = vatRate > 0 ? gross / (1 + vatRate / 100) : gross;
  const tax = gross - base;

  const lines = [{
    productId: sale?.productId || "ITEM",
    description: product?.name || sale?.productName || "Produto",
    quantity: qty,
    unitPriceGross: qty ? gross / qty : gross,
    vatRate,
    base,
    tax,
    gross,
    exemptionReason: vatRate === 0 ? (fiscal.defaultExemptionReason || "M99") : null
  }];
  const totals = { netTotal: base, vatTotal: tax, grandTotal: gross };

  const previousHash = previousDocumentHash(type);
  const { full, compact, payload } = await buildDocumentHash({
    issueDate,
    systemDateTime,
    documentNumber,
    grossTotal: totals.grandTotal,
    previousHash
  });

  const client = sale && sale.clientId ? state.clients.find((c) => c.id === sale.clientId) : null;
  const document = {
    id: crypto.randomUUID(),
    type,
    series,
    sequence,
    documentNumber,
    issueDate,
    systemDateTime,
    fiscalSnapshot: {
      nif: fiscal.nif,
      legalName: fiscal.legalName,
      address: fiscal.address,
      municipality: fiscal.municipality || "",
      province: fiscal.province || "",
      regime: fiscal.fiscalRegime || "GERAL",
      softwareValidationNumber: fiscal.softwareValidationNumber || ""
    },
    client: client ? {
      id: client.id,
      name: client.name,
      nif: (client.nif && client.nif.trim()) || "999999999",
      address: client.address || "",
      phone: client.phone || ""
    } : {
      id: null,
      name: sale?.customerName || "Consumidor Final",
      nif: "999999999",
      address: "",
      phone: ""
    },
    lines,
    totals,
    vatBreakdown: buildVatBreakdown(lines),
    paymentMethod: sale?.paymentMethod || "Numerário",
    saleId: sale?.id || null,
    status: "issued",
    cancelledAt: null,
    cancelReason: null,
    hashFull: full,
    hashCompact: compact,
    hashPayload: payload,
    signature: "",
    softwareName: SOFTWARE_PRODUCT_NAME,
    softwareVersion: SOFTWARE_PRODUCT_VERSION
  };

  if (!Array.isArray(state.documents)) state.documents = [];
  state.documents.unshift(document);
  return document;
}

async function cancelFiscalDocument(id) {
  if (!requireAdmin()) return;
  const doc = (state.documents || []).find((d) => d.id === id);
  if (!doc) return;
  if (doc.status === "cancelled") {
    alert("Documento já anulado.");
    return;
  }
  const reason = prompt(`Motivo da anulação do documento ${doc.documentNumber}:`, "");
  if (reason === null) return;
  const trimmed = reason.trim();
  if (!trimmed) {
    alert("Indique um motivo para anular o documento.");
    return;
  }
  doc.status = "cancelled";
  doc.cancelledAt = new Date().toISOString();
  doc.cancelReason = trimmed;
  await persistMutation({
    success: `Documento ${doc.documentNumber} anulado.`,
    fallback: `Documento ${doc.documentNumber} anulado localmente.`
  });
  renderInvoicesView();
}

// ---------------------------------------------------------------------
// Invoices view rendering & bindings
// ---------------------------------------------------------------------

function renderInvoicesView() {
  const tbody = document.getElementById("invoicesTable");
  if (!tbody) return;

  const summary = document.getElementById("invoiceFiscalSummary");
  const fiscal = getActiveStoreFiscal();
  if (summary) {
    if (!fiscal || !fiscal.nif) {
      summary.textContent = "⚠ Configure os dados fiscais da loja em Acessos antes de emitir documentos.";
      summary.style.color = "#b94c00";
    } else if (!fiscal.softwareValidationNumber) {
      summary.textContent = `Loja ${fiscal.legalName} (NIF ${fiscal.nif}) — sem nº de validação AGT. Os documentos saem com a indicação "NÃO certificado" até a AGT atribuir o número.`;
      summary.style.color = "#7d5b00";
    } else {
      summary.textContent = `Programa validado nº ${fiscal.softwareValidationNumber}/AGT — ${fiscal.legalName} (NIF ${fiscal.nif}).`;
      summary.style.color = "#1a6c2b";
    }
  }

  const monthInput = document.getElementById("invoiceMonth");
  if (monthInput && !monthInput.value) {
    monthInput.value = today.slice(0, 7);
  }

  const typeFilter = document.getElementById("invoiceFilterType")?.value || "";
  const statusFilter = document.getElementById("invoiceFilterStatus")?.value || "";
  const clientFilter = (document.getElementById("invoiceFilterClient")?.value || "").trim().toLowerCase();

  const docs = (state.documents || [])
    .slice()
    .sort((a, b) => (b.systemDateTime || "").localeCompare(a.systemDateTime || ""))
    .filter((d) => !typeFilter || d.type === typeFilter)
    .filter((d) => !statusFilter || d.status === statusFilter)
    .filter((d) => {
      if (!clientFilter) return true;
      const name = (d.client?.name || "").toLowerCase();
      const nif = (d.client?.nif || "").toLowerCase();
      return name.includes(clientFilter) || nif.includes(clientFilter);
    });

  if (!docs.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-row">Sem documentos emitidos.</td></tr>`;
    return;
  }

  tbody.innerHTML = docs.map((d) => `
    <tr class="${d.status === "cancelled" ? "doc-cancelled" : ""}">
      <td><strong>${escapeHtml(d.documentNumber)}</strong><br><small>${escapeHtml(DOCUMENT_TYPES[d.type] || d.type)}</small></td>
      <td>${escapeHtml(formatDateBr(d.issueDate))}<br><small>${escapeHtml((d.systemDateTime || "").slice(11, 16))}</small></td>
      <td>${escapeHtml(d.client?.name || "Consumidor Final")}<br><small>NIF: ${escapeHtml(d.client?.nif || "999999999")}</small></td>
      <td>${escapeHtml(currency(d.totals.grandTotal))}</td>
      <td>${d.status === "cancelled"
        ? `<span class="badge danger">Anulado</span><br><small>${escapeHtml(d.cancelReason || "")}</small>`
        : `<span class="badge success">Emitido</span>`}</td>
      <td class="invoice-actions">
        <button type="button" class="ghost-button" data-doc-action="pdf" data-id="${escapeAttr(d.id)}">PDF</button>
        ${d.status !== "cancelled" ? `<button type="button" class="ghost-button danger" data-doc-action="cancel" data-id="${escapeAttr(d.id)}">Anular</button>` : ""}
      </td>
    </tr>
  `).join("");
}

function bindInvoicesView() {
  const tbody = document.getElementById("invoicesTable");
  tbody?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-doc-action]");
    if (!button) return;
    const id = button.dataset.id;
    const action = button.dataset.docAction;
    if (action === "pdf") downloadInvoicePdf(id);
    else if (action === "cancel") cancelFiscalDocument(id);
  });

  ["invoiceFilterType", "invoiceFilterStatus", "invoiceFilterClient"].forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", renderInvoicesView);
    el?.addEventListener("change", renderInvoicesView);
  });

  document.getElementById("exportSaftButton")?.addEventListener("click", downloadSaft);
}

// ---------------------------------------------------------------------
// Fiscal config form
// ---------------------------------------------------------------------

const DEFAULT_FISCAL_PRESET = {
  nif: "5002862867",
  legalName: "CrystalOne",
  fiscalRegime: "GERAL",
  defaultVatRate: "14",
  documentSeries: `A${new Date().getFullYear()}`,
  defaultDocumentType: "FR"
};

function renderFiscalConfigForm() {
  const form = document.getElementById("fiscalConfigForm");
  if (!form) return;
  const fiscal = getActiveStoreFiscal() || {};
  form.querySelectorAll("input, select").forEach((field) => {
    const name = field.name;
    if (!name) return;
    const saved = fiscal[name];
    if (saved != null && saved !== "") {
      field.value = String(saved);
      return;
    }
    if (DEFAULT_FISCAL_PRESET[name] != null && (field.value === "" || field.value == null)) {
      field.value = DEFAULT_FISCAL_PRESET[name];
    }
  });
  const status = document.getElementById("fiscalConfigStatus");
  if (status) {
    if (!fiscal.nif) {
      status.textContent = "Ainda sem configuração fiscal.";
    } else if (!fiscal.softwareValidationNumber) {
      status.textContent = `Configurado para NIF ${fiscal.nif} — aguarda nº de validação AGT.`;
    } else {
      status.textContent = `Configurado para NIF ${fiscal.nif} — software validado nº ${fiscal.softwareValidationNumber}.`;
    }
  }
}

async function onSaveFiscalConfig(event) {
  event.preventDefault();
  if (!requireAdmin()) return;
  const store = getActiveStore();
  if (!store) {
    alert("Nenhuma loja activa.");
    return;
  }
  const form = new FormData(event.currentTarget);
  store.fiscal = {
    nif: String(form.get("nif") || "").trim(),
    legalName: String(form.get("legalName") || "").trim(),
    address: String(form.get("address") || "").trim(),
    municipality: String(form.get("municipality") || "").trim(),
    province: String(form.get("province") || "").trim(),
    fiscalRegime: String(form.get("fiscalRegime") || "GERAL"),
    defaultVatRate: Number(form.get("defaultVatRate") || 14),
    documentSeries: String(form.get("documentSeries") || "").trim().toUpperCase(),
    defaultDocumentType: String(form.get("defaultDocumentType") || "FR"),
    softwareValidationNumber: String(form.get("softwareValidationNumber") || "").trim(),
    defaultExemptionReason: String(form.get("defaultExemptionReason") || ""),
    updatedAt: new Date().toISOString()
  };
  persistStores();
  renderFiscalConfigForm();
  renderInvoicesView();
  const status = document.getElementById("fiscalConfigStatus");
  if (status) {
    status.textContent = "Configuração fiscal guardada.";
    status.style.color = "#1a6c2b";
  }
}

// ---------------------------------------------------------------------
// SAF-T (AO) export
// ---------------------------------------------------------------------

function buildSaftXml(year, month) {
  const fiscal = getActiveStoreFiscal();
  if (!fiscal || !fiscal.nif) {
    alert("Configure os dados fiscais antes de exportar SAF-T.");
    return null;
  }
  const monthStr = String(month).padStart(2, "0");
  const periodPrefix = `${year}-${monthStr}`;
  const docs = (state.documents || []).filter((d) => (d.issueDate || "").startsWith(periodPrefix));

  const customers = new Map();
  const productsUsed = new Map();
  const taxTable = new Map();
  docs.forEach((doc) => {
    if (doc.client?.id) customers.set(doc.client.id, doc.client);
    doc.lines.forEach((l) => {
      if (l.productId) productsUsed.set(l.productId, l);
      taxTable.set(`IVA-${l.vatRate}`, { code: `IVA${l.vatRate}`, rate: l.vatRate });
    });
  });

  const esc = (s) => String(s == null ? "" : s).replace(/[<>&'"]/g, (ch) => ({
    "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;"
  }[ch]));
  const num = (n) => Number(n || 0).toFixed(2);
  const startDate = `${year}-${monthStr}-01`;
  const endDate = `${year}-${monthStr}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
  const totalCredit = docs.filter((d) => d.status === "issued").reduce((sum, d) => sum + d.totals.grandTotal, 0);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:AO_1.01_01">\n`;
  xml += `  <Header>\n`;
  xml += `    <AuditFileVersion>1.01_01</AuditFileVersion>\n`;
  xml += `    <CompanyID>${esc(fiscal.nif)}</CompanyID>\n`;
  xml += `    <TaxRegistrationNumber>${esc(fiscal.nif)}</TaxRegistrationNumber>\n`;
  xml += `    <TaxAccountingBasis>F</TaxAccountingBasis>\n`;
  xml += `    <CompanyName>${esc(fiscal.legalName)}</CompanyName>\n`;
  xml += `    <CompanyAddress>\n`;
  xml += `      <AddressDetail>${esc(fiscal.address)}</AddressDetail>\n`;
  xml += `      <City>${esc(fiscal.municipality || "Luanda")}</City>\n`;
  xml += `      <Country>AO</Country>\n`;
  xml += `    </CompanyAddress>\n`;
  xml += `    <FiscalYear>${year}</FiscalYear>\n`;
  xml += `    <StartDate>${startDate}</StartDate>\n`;
  xml += `    <EndDate>${endDate}</EndDate>\n`;
  xml += `    <CurrencyCode>AOA</CurrencyCode>\n`;
  xml += `    <DateCreated>${today}</DateCreated>\n`;
  xml += `    <TaxEntity>Global</TaxEntity>\n`;
  xml += `    <ProductCompanyTaxID>${esc(fiscal.nif)}</ProductCompanyTaxID>\n`;
  xml += `    <SoftwareValidationNumber>${esc(fiscal.softwareValidationNumber || "0")}</SoftwareValidationNumber>\n`;
  xml += `    <ProductID>${esc(SOFTWARE_PRODUCT_NAME)}/${esc(SOFTWARE_PRODUCT_NAME)}</ProductID>\n`;
  xml += `    <ProductVersion>${esc(SOFTWARE_PRODUCT_VERSION)}</ProductVersion>\n`;
  xml += `  </Header>\n`;

  const hasFinalCustomer = docs.some((d) => !d.client?.id);
  xml += `  <MasterFiles>\n`;
  if (hasFinalCustomer) {
    xml += `    <Customer>\n`;
    xml += `      <CustomerID>FINAL</CustomerID>\n`;
    xml += `      <AccountID>Desconhecido</AccountID>\n`;
    xml += `      <CustomerTaxID>999999999</CustomerTaxID>\n`;
    xml += `      <CompanyName>Consumidor Final</CompanyName>\n`;
    xml += `      <BillingAddress>\n`;
    xml += `        <AddressDetail>Desconhecido</AddressDetail>\n`;
    xml += `        <City>Luanda</City>\n`;
    xml += `        <Country>AO</Country>\n`;
    xml += `      </BillingAddress>\n`;
    xml += `      <SelfBillingIndicator>0</SelfBillingIndicator>\n`;
    xml += `    </Customer>\n`;
  }
  customers.forEach((c) => {
    xml += `    <Customer>\n`;
    xml += `      <CustomerID>${esc(c.id)}</CustomerID>\n`;
    xml += `      <AccountID>Desconhecido</AccountID>\n`;
    xml += `      <CustomerTaxID>${esc(c.nif || "999999999")}</CustomerTaxID>\n`;
    xml += `      <CompanyName>${esc(c.name)}</CompanyName>\n`;
    xml += `      <BillingAddress>\n`;
    xml += `        <AddressDetail>${esc(c.address || "Desconhecido")}</AddressDetail>\n`;
    xml += `        <City>Luanda</City>\n`;
    xml += `        <Country>AO</Country>\n`;
    xml += `      </BillingAddress>\n`;
    xml += `      <SelfBillingIndicator>0</SelfBillingIndicator>\n`;
    xml += `    </Customer>\n`;
  });
  productsUsed.forEach((line, pid) => {
    const product = findProduct(pid);
    xml += `    <Product>\n`;
    xml += `      <ProductType>P</ProductType>\n`;
    xml += `      <ProductCode>${esc(pid)}</ProductCode>\n`;
    xml += `      <ProductDescription>${esc(line.description || product?.name || "Produto")}</ProductDescription>\n`;
    xml += `      <ProductNumberCode>${esc(pid)}</ProductNumberCode>\n`;
    xml += `    </Product>\n`;
  });
  xml += `    <TaxTable>\n`;
  taxTable.forEach((t) => {
    xml += `      <TaxTableEntry>\n`;
    xml += `        <TaxType>IVA</TaxType>\n`;
    xml += `        <TaxCountryRegion>AO</TaxCountryRegion>\n`;
    xml += `        <TaxCode>${esc(t.code)}</TaxCode>\n`;
    xml += `        <Description>IVA ${t.rate}%</Description>\n`;
    xml += `        <TaxPercentage>${num(t.rate)}</TaxPercentage>\n`;
    xml += `      </TaxTableEntry>\n`;
  });
  xml += `    </TaxTable>\n`;
  xml += `  </MasterFiles>\n`;

  xml += `  <SourceDocuments>\n`;
  xml += `    <SalesInvoices>\n`;
  xml += `      <NumberOfEntries>${docs.length}</NumberOfEntries>\n`;
  xml += `      <TotalDebit>0.00</TotalDebit>\n`;
  xml += `      <TotalCredit>${num(totalCredit)}</TotalCredit>\n`;
  docs.forEach((d) => {
    xml += `      <Invoice>\n`;
    xml += `        <InvoiceNo>${esc(d.documentNumber)}</InvoiceNo>\n`;
    xml += `        <DocumentStatus>\n`;
    xml += `          <InvoiceStatus>${d.status === "cancelled" ? "A" : "N"}</InvoiceStatus>\n`;
    xml += `          <InvoiceStatusDate>${esc(d.cancelledAt || d.systemDateTime)}</InvoiceStatusDate>\n`;
    xml += `          <SourceID>${esc(currentUser?.username || "Sistema")}</SourceID>\n`;
    xml += `          <SourceBilling>P</SourceBilling>\n`;
    xml += `        </DocumentStatus>\n`;
    xml += `        <Hash>${esc(d.hashFull)}</Hash>\n`;
    xml += `        <HashControl>1</HashControl>\n`;
    xml += `        <Period>${month}</Period>\n`;
    xml += `        <InvoiceDate>${esc(d.issueDate)}</InvoiceDate>\n`;
    xml += `        <InvoiceType>${esc(d.type)}</InvoiceType>\n`;
    xml += `        <SpecialRegimes>\n`;
    xml += `          <SelfBillingIndicator>0</SelfBillingIndicator>\n`;
    xml += `          <CashVATSchemeIndicator>0</CashVATSchemeIndicator>\n`;
    xml += `          <ThirdPartiesBillingIndicator>0</ThirdPartiesBillingIndicator>\n`;
    xml += `        </SpecialRegimes>\n`;
    xml += `        <SourceID>${esc(currentUser?.username || "Sistema")}</SourceID>\n`;
    xml += `        <SystemEntryDate>${esc(d.systemDateTime)}</SystemEntryDate>\n`;
    xml += `        <CustomerID>${esc(d.client?.id || "FINAL")}</CustomerID>\n`;
    d.lines.forEach((l, idx) => {
      const unitPrice = l.quantity ? l.base / l.quantity : l.base;
      xml += `        <Line>\n`;
      xml += `          <LineNumber>${idx + 1}</LineNumber>\n`;
      xml += `          <ProductCode>${esc(l.productId || "ITEM")}</ProductCode>\n`;
      xml += `          <ProductDescription>${esc(l.description)}</ProductDescription>\n`;
      xml += `          <Quantity>${num(l.quantity)}</Quantity>\n`;
      xml += `          <UnitOfMeasure>un</UnitOfMeasure>\n`;
      xml += `          <UnitPrice>${num(unitPrice)}</UnitPrice>\n`;
      xml += `          <TaxPointDate>${esc(d.issueDate)}</TaxPointDate>\n`;
      xml += `          <Description>${esc(l.description)}</Description>\n`;
      xml += `          <CreditAmount>${num(l.base)}</CreditAmount>\n`;
      xml += `          <Tax>\n`;
      xml += `            <TaxType>IVA</TaxType>\n`;
      xml += `            <TaxCountryRegion>AO</TaxCountryRegion>\n`;
      xml += `            <TaxCode>IVA${l.vatRate}</TaxCode>\n`;
      xml += `            <TaxPercentage>${num(l.vatRate)}</TaxPercentage>\n`;
      xml += `          </Tax>\n`;
      if (Number(l.vatRate) === 0 && l.exemptionReason) {
        xml += `          <TaxExemptionReason>${esc(VAT_EXEMPTION_REASONS[l.exemptionReason] || l.exemptionReason)}</TaxExemptionReason>\n`;
        xml += `          <TaxExemptionCode>${esc(l.exemptionReason)}</TaxExemptionCode>\n`;
      }
      xml += `        </Line>\n`;
    });
    xml += `        <DocumentTotals>\n`;
    xml += `          <TaxPayable>${num(d.totals.vatTotal)}</TaxPayable>\n`;
    xml += `          <NetTotal>${num(d.totals.netTotal)}</NetTotal>\n`;
    xml += `          <GrossTotal>${num(d.totals.grandTotal)}</GrossTotal>\n`;
    xml += `        </DocumentTotals>\n`;
    xml += `      </Invoice>\n`;
  });
  xml += `    </SalesInvoices>\n`;
  xml += `  </SourceDocuments>\n`;
  xml += `</AuditFile>\n`;
  return xml;
}

function downloadSaft() {
  if (!requireAdmin()) return;
  const monthInput = document.getElementById("invoiceMonth");
  const value = monthInput?.value || today.slice(0, 7);
  const [y, m] = value.split("-").map(Number);
  if (!y || !m) {
    alert("Selecione um mês válido.");
    return;
  }
  const xml = buildSaftXml(y, m);
  if (!xml) return;
  const fiscal = getActiveStoreFiscal();
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SAFT-AO-${fiscal.nif}-${y}-${String(m).padStart(2, "0")}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------

function downloadInvoicePdf(id) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    alert("Biblioteca de PDF não carregou. Verifique a ligação.");
    return;
  }
  const doc = (state.documents || []).find((d) => d.id === id);
  if (!doc) return;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 36;
  let y = margin;

  pdf.setFontSize(14).setFont(undefined, "bold");
  pdf.text(doc.fiscalSnapshot.legalName || DEFAULT_STORE_NAME, margin, y);
  y += 16;
  pdf.setFontSize(9).setFont(undefined, "normal");
  pdf.text(`NIF: ${doc.fiscalSnapshot.nif}`, margin, y);
  y += 12;
  pdf.text(doc.fiscalSnapshot.address || "", margin, y);
  y += 12;
  if (doc.fiscalSnapshot.municipality || doc.fiscalSnapshot.province) {
    pdf.text(`${doc.fiscalSnapshot.municipality || ""}${doc.fiscalSnapshot.province ? " - " + doc.fiscalSnapshot.province : ""}`, margin, y);
    y += 12;
  }
  pdf.text(`Regime: ${FISCAL_REGIMES[doc.fiscalSnapshot.regime] || "Regime Geral"}`, margin, y);
  y += 18;

  pdf.setFontSize(13).setFont(undefined, "bold");
  pdf.text(`${DOCUMENT_TYPES[doc.type] || doc.type}  ${doc.documentNumber}`, margin, y);
  y += 16;
  pdf.setFontSize(9).setFont(undefined, "normal");
  pdf.text(`Data: ${formatDateBr(doc.issueDate)}    Hora: ${(doc.systemDateTime || "").slice(11, 19)}`, margin, y);
  y += 14;
  if (doc.status === "cancelled") {
    pdf.setTextColor(180, 0, 0).setFont(undefined, "bold");
    pdf.text(`** ANULADO ** ${doc.cancelReason || ""}`, margin, y);
    pdf.setTextColor(0, 0, 0).setFont(undefined, "normal");
    y += 14;
  }

  pdf.setFontSize(10).setFont(undefined, "bold");
  pdf.text("Cliente", margin, y);
  y += 12;
  pdf.setFontSize(9).setFont(undefined, "normal");
  pdf.text(doc.client.name, margin, y);
  y += 12;
  pdf.text(`NIF: ${doc.client.nif}`, margin, y);
  y += 12;
  if (doc.client.address) { pdf.text(doc.client.address, margin, y); y += 12; }

  if (typeof pdf.autoTable === "function") {
    pdf.autoTable({
      startY: y + 6,
      head: [["Descrição", "Qtd", "Preço Unit.", "IVA %", "Subtotal s/IVA", "IVA", "Total"]],
      body: doc.lines.map((l) => [
        l.description,
        Number(l.quantity).toFixed(0),
        currency(l.quantity ? l.base / l.quantity : l.base),
        `${l.vatRate}%`,
        currency(l.base),
        currency(l.tax),
        currency(l.gross)
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [25, 95, 160] }
    });
    y = pdf.lastAutoTable.finalY + 14;
  } else {
    pdf.text("(Tabela de itens indisponível)", margin, y + 6);
    y += 24;
  }

  pdf.setFontSize(10).setFont(undefined, "bold");
  pdf.text("Resumo do IVA", margin, y);
  y += 14;
  pdf.setFontSize(9).setFont(undefined, "normal");
  doc.vatBreakdown.forEach((v) => {
    pdf.text(`IVA ${v.rate}% — base ${currency(v.base)} | imposto ${currency(v.tax)}`, margin, y);
    y += 12;
  });
  if (doc.lines.some((l) => Number(l.vatRate) === 0 && l.exemptionReason)) {
    const reasons = [...new Set(doc.lines.filter((l) => Number(l.vatRate) === 0 && l.exemptionReason).map((l) => l.exemptionReason))];
    reasons.forEach((code) => {
      pdf.text(`Motivo isenção ${code}: ${VAT_EXEMPTION_REASONS[code] || ""}`, margin, y);
      y += 12;
    });
  }
  y += 4;
  pdf.setFontSize(11).setFont(undefined, "bold");
  pdf.text(`TOTAL A PAGAR: ${currency(doc.totals.grandTotal)}`, margin, y);
  y += 14;
  pdf.setFontSize(9).setFont(undefined, "normal");
  pdf.text(`Forma de pagamento: ${doc.paymentMethod || "Numerário"}`, margin, y);
  y += 18;

  pdf.setFontSize(8).setFont(undefined, "italic");
  pdf.text(`Hash: ${doc.hashCompact}`, margin, y);
  y += 10;
  const validation = doc.fiscalSnapshot.softwareValidationNumber
    ? `Processado por programa validado n.º ${doc.fiscalSnapshot.softwareValidationNumber}/AGT`
    : "Aguarda número de validação da AGT — documento NÃO certificado.";
  pdf.text(validation, margin, y);
  y += 10;
  pdf.text(`${SOFTWARE_PRODUCT_NAME} v${SOFTWARE_PRODUCT_VERSION}`, margin, y);

  pdf.save(`${doc.documentNumber.replace(/[^A-Za-z0-9]+/g, "_")}.pdf`);
}

// ---------------------- PROMOÇÕES ----------------------

const PROMO_SEED_KEY = "promo:workers-week-2026:seeded";

function ensurePromotionsArray() {
  if (!Array.isArray(state.promotions)) state.promotions = [];
}

const PROMO_DEFAULT_INITIAL_STOCK = 10;

function seedDefaultPromotionIfNeeded() {
  ensurePromotionsArray();
  let promo = state.promotions.find((p) => p.id === "promo-workers-week-2026");
  if (!promo) {
    promo = {
      id: "promo-workers-week-2026",
      title: "Semana do Trabalhador",
      description: "Dispensador elétrico — 2999 Kz\nSuporte Completo — 5300 Kz\nKit Suporte Completo + Galão 20L + Enchimento — 9990 Kz",
      startDate: "2026-04-28",
      endDate: "2026-05-05",
      createdAt: new Date().toISOString(),
      itemMeta: {
        "Kit Suporte Completo + Galão 20L + Enchimento": {
          components: [
            { name: "Suporte Completo", qty: 1 },
            { name: "Galão 20L", qty: 1 },
            { name: "Enchimento 20L", qty: 1 }
          ]
        }
      }
    };
    state.promotions.push(promo);
    saveState();
  } else if (promo && !promo.itemMeta) {
    promo.itemMeta = {
      "Kit Suporte Completo + Galão 20L + Enchimento": {
        components: [
          { name: "Suporte Completo", qty: 1 },
          { name: "Galão 20L", qty: 1 },
          { name: "Enchimento 20L", qty: 1 }
        ]
      }
    };
    saveState();
  }
  // Pre-create / migrate promo SKUs and seed initial stock so the user can sell immediately.
  // Idempotent: also renames legacy duplicates from older versions.
  if (promo) {
    const lines = promo.description.split("\n").map((s) => s.trim()).filter(Boolean);
    for (const line of lines) {
      const parsed = parsePromoLine(line);
      if (parsed) ensurePromoProductInCatalog(promo, parsed);
    }
    localStorage.setItem(PROMO_SEED_KEY, "done-v3");
  }
}

function bindPromotions() {
  const addBtn = document.getElementById("addPromotionButton");
  const cancelBtn = document.getElementById("cancelPromotionButton");
  const form = document.getElementById("promotionForm");
  addBtn?.addEventListener("click", () => {
    try { openPromotionForm(null); }
    catch (err) { console.error("openPromotionForm failed", err); alert("Não consegui abrir o formulário: " + err.message); }
  });
  cancelBtn?.addEventListener("click", closePromotionForm);
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    try { onSavePromotion(event); }
    catch (err) { console.error("onSavePromotion failed", err); alert("Erro ao guardar promoção: " + err.message); }
  });
  try { seedDefaultPromotionIfNeeded(); }
  catch (err) { console.error("seedDefaultPromotionIfNeeded failed", err); }
}

function openPromotionForm(promo) {
  const panel = document.getElementById("promotionFormPanel");
  const title = document.getElementById("promotionFormTitle");
  if (!panel) return;
  panel.hidden = false;
  document.getElementById("promotionId").value = promo?.id || "";
  document.getElementById("promotionTitle").value = promo?.title || "";
  document.getElementById("promotionDescription").value = promo?.description || "";
  document.getElementById("promotionStartDate").value = promo?.startDate || todayISO();
  document.getElementById("promotionEndDate").value = promo?.endDate || todayISO();
  title.textContent = promo ? "Editar promoção" : "Nova promoção";
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closePromotionForm() {
  const panel = document.getElementById("promotionFormPanel");
  if (panel) panel.hidden = true;
  const form = document.getElementById("promotionForm");
  form?.reset();
}

function onSavePromotion(event) {
  event.preventDefault();
  ensurePromotionsArray();
  const id = document.getElementById("promotionId").value;
  const title = document.getElementById("promotionTitle").value.trim();
  const description = document.getElementById("promotionDescription").value.trim();
  const startDate = document.getElementById("promotionStartDate").value;
  const endDate = document.getElementById("promotionEndDate").value;
  if (!title || !description || !startDate || !endDate) {
    alert("Preencha todos os campos: título, descrição, data de início e data de fim.");
    return;
  }
  if (endDate < startDate) {
    alert("A data de fim não pode ser anterior à data de início.");
    return;
  }
  if (id) {
    const idx = state.promotions.findIndex((p) => p.id === id);
    if (idx >= 0) {
      state.promotions[idx] = { ...state.promotions[idx], title, description, startDate, endDate };
    }
  } else {
    state.promotions.unshift({
      id: crypto.randomUUID(),
      title,
      description,
      startDate,
      endDate,
      createdAt: new Date().toISOString()
    });
  }
  saveState();
  closePromotionForm();
  renderPromotions();
}

function deletePromotion(id) {
  if (!confirm("Eliminar esta promoção?")) return;
  state.promotions = (state.promotions || []).filter((p) => p.id !== id);
  saveState();
  renderPromotions();
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(fromISO, toISO) {
  const a = new Date(`${fromISO}T00:00:00`);
  const b = new Date(`${toISO}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

function formatDatePT(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function renderPromotions() {
  const list = document.getElementById("promotionsList");
  const emptyHint = document.getElementById("promoEmptyHint");
  if (!list) return;
  ensurePromotionsArray();
  const promos = [...state.promotions].sort((a, b) => (a.endDate || "").localeCompare(b.endDate || ""));
  list.innerHTML = "";
  if (!promos.length) {
    if (emptyHint) emptyHint.hidden = false;
    return;
  }
  if (emptyHint) emptyHint.hidden = true;
  const today = todayISO();
  for (const promo of promos) {
    const card = document.createElement("article");
    const daysLeft = daysBetween(today, promo.endDate);
    const started = today >= promo.startDate;
    const expired = daysLeft < 0;
    let statusClass = "promo-card";
    let badge = "";
    if (expired) {
      statusClass += " promo-expired";
      badge = `<span class="promo-badge promo-badge-expired">Encerrada</span>`;
    } else if (!started) {
      const daysToStart = daysBetween(today, promo.startDate);
      statusClass += " promo-upcoming";
      badge = `<span class="promo-badge promo-badge-upcoming">Começa em ${daysToStart} dia${daysToStart === 1 ? "" : "s"}</span>`;
    } else {
      const blink = daysLeft <= 3 ? " promo-badge-blink" : "";
      const label = daysLeft === 0 ? "Termina hoje" : `Faltam ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`;
      badge = `<span class="promo-badge promo-badge-active${blink}">${label}</span>`;
    }
    const items = promo.description.split("\n").map((line) => line.trim()).filter(Boolean);
    const sellable = started && !expired;
    const itemsHtml = items.map((line, idx) => {
      const parsed = parsePromoLine(line);
      const sellBtn = parsed && sellable
        ? `<button type="button" class="promo-sell-btn" data-idx="${idx}">Vender</button>`
        : "";
      return `<li><span class="promo-item-text">${escapeHtml(line)}</span>${sellBtn}</li>`;
    }).join("");
    card.className = statusClass;
    card.innerHTML = `
      <header class="promo-card-header">
        <h4>${escapeHtml(promo.title)}</h4>
        ${badge}
      </header>
      <ul class="promo-items">${itemsHtml}</ul>
      <footer class="promo-card-footer">
        <span class="promo-dates">📅 ${formatDatePT(promo.startDate)} — ${formatDatePT(promo.endDate)}</span>
        <div class="promo-card-actions role-admin-only">
          <button type="button" class="ghost-button promo-edit">Editar</button>
          <button type="button" class="ghost-button promo-delete">Remover</button>
        </div>
      </footer>
    `;
    card.querySelector(".promo-edit")?.addEventListener("click", () => openPromotionForm(promo));
    card.querySelector(".promo-delete")?.addEventListener("click", () => deletePromotion(promo.id));
    card.querySelectorAll(".promo-sell-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        startPromoSale(promo, items[idx]);
      });
    });
    list.appendChild(card);
  }
  applyRolePermissions();
}

function parsePromoLine(line) {
  if (!line) return null;
  const match = line.match(/^(.+?)\s*[—–\-]\s*([\d\s.,]+)\s*(Kz|kz|AOA)?\s*$/);
  if (!match) return null;
  const name = match[1].trim();
  const raw = match[2].replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const price = Number(raw);
  if (!name || !Number.isFinite(price) || price <= 0) return null;
  return { name, price };
}

function promoProductId(promoId, name) {
  const slug = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `promo-${promoId}-${slug}`.slice(0, 80);
}

function ensurePromoComponentProduct(promo, componentName) {
  const id = promoProductId(promo.id, `comp-${componentName}`);
  const desiredName = `${componentName} · componente (${promo.title})`;
  let product = productCatalog.find((p) => p.id === id);
  if (!product) {
    product = {
      id,
      name: desiredName,
      price: 0,
      stockControlled: true,
      unit: "un",
      vatRate: 14,
      isPromotional: true,
      isComponent: true,
      promoId: promo.id
    };
    productCatalog.unshift(product);
  } else if (product.name !== desiredName) {
    product.name = desiredName;
  }
  ensurePromoStockEntry(product);
  return product;
}

function ensurePromoStockEntry(product) {
  const existing = state.stock.find((item) => String(item.productId) === String(product.id));
  if (existing) return existing;
  const entry = {
    id: crypto.randomUUID(),
    productId: product.id,
    quantity: PROMO_DEFAULT_INITIAL_STOCK,
    unitCost: 0,
    minStock: 2,
    isPromotional: true
  };
  state.stock.unshift(entry);
  return entry;
}

function ensurePromoProductInCatalog(promo, parsed) {
  const id = promoProductId(promo.id, parsed.name);
  let product = productCatalog.find((p) => p.id === id);
  const meta = (promo.itemMeta && promo.itemMeta[parsed.name]) || null;
  const componentDefs = meta && Array.isArray(meta.components) ? meta.components : null;
  const isComposite = !!(componentDefs && componentDefs.length);

  let components = null;
  if (isComposite) {
    components = componentDefs.map((c) => {
      const compProduct = ensurePromoComponentProduct(promo, c.name);
      return { productId: compProduct.id, name: c.name, qty: Number(c.qty) || 1 };
    });
  }

  if (!product) {
    product = {
      id,
      name: `${parsed.name} (${promo.title})`,
      price: parsed.price,
      stockControlled: !isComposite,
      unit: "un",
      vatRate: 14,
      isPromotional: true,
      promoId: promo.id,
      components: components || undefined
    };
    productCatalog.unshift(product);
    saveState();
  } else {
    let dirty = false;
    if (product.price !== parsed.price) { product.price = parsed.price; dirty = true; }
    if (isComposite) {
      if (product.stockControlled) { product.stockControlled = false; dirty = true; }
      if (JSON.stringify(product.components || []) !== JSON.stringify(components)) {
        product.components = components;
        dirty = true;
      }
    }
    if (dirty) saveState();
  }

  if (!isComposite) {
    ensurePromoStockEntry(product);
    saveState();
  } else {
    saveState();
  }
  return product;
}

function startPromoSale(promo, line) {
  const parsed = parsePromoLine(line);
  if (!parsed) {
    alert("Não consegui interpretar este item da promoção. Use o formato \"Nome — Preço Kz\".");
    return;
  }
  const product = ensurePromoProductInCatalog(promo, parsed);
  renderSelects();
  renderStock();
  const vendasTab = document.querySelector(".nav-tab[data-view='vendas']");
  vendasTab?.click();
  const saleProductSelect = document.getElementById("saleProduct");
  if (saleProductSelect) {
    saleProductSelect.value = product.id;
    saleProductSelect.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const qty = document.getElementById("saleQuantity");
  if (qty) qty.value = "1";
  renderSalePreview();
  document.getElementById("saleForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const stockItem = (typeof findStockByProduct === "function") ? findStockByProduct(product.id) : null;
  if (!stockItem || stockItem.quantity <= 0) {
    setTimeout(() => {
      alert(`O produto "${product.name}" ainda não tem stock registado.\n\nVá à aba Estoque (administrador) e adicione a quantidade disponível antes de finalizar a venda.`);
    }, 350);
  }
}
