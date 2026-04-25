const STORAGE_KEY = "agua-cristalina-data-v5";
const SUPABASE_KEY = "agua-cristalina-supabase-config-v2";
const ROLE_KEY = "agua-cristalina-session";

const ROLES = {
  "244100": "admin",
  "032026": "operacao"
};
const ROLE_LABELS = { admin: "Administrador", operacao: "Operacao" };

let currentRole = null;
const REPORT_PHONE = "244939667223";
const STORE_NAME = "AGUA CRISTALINA";
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

async function boot() {
  bindLogin();
  const savedPassword = localStorage.getItem(ROLE_KEY);
  const savedRole = savedPassword ? ROLES[savedPassword] : null;
  if (savedRole) {
    await startSession(savedRole, savedPassword, { silent: true });
  } else {
    localStorage.removeItem(ROLE_KEY);
    showLoginScreen();
  }
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
    const role = ROLES[password];
    if (!role) {
      errorBox?.removeAttribute("hidden");
      input.value = "";
      input.focus();
      return;
    }
    errorBox?.setAttribute("hidden", "");
    input.value = "";
    startSession(role, password);
  });
}

let sessionStarted = false;

async function startSession(role, password, { silent = false } = {}) {
  currentRole = role;
  if (password) localStorage.setItem(ROLE_KEY, password);
  applyRolePermissions();
  hideLoginScreen();

  if (!sessionStarted) {
    sessionStarted = true;
    hydrateDates();
    bindNavigation();
    bindForms();
    bindFilters();
    bindSupabaseControls();
    bindInteractiveControls();
    renderSupabaseConfig();
    renderAll();
    await initializeSupabaseSession({ autoPull: true, silent: true });
  } else {
    renderAll();
  }
}

function logout() {
  localStorage.removeItem(ROLE_KEY);
  currentRole = null;
  showLoginScreen();
}

function applyRolePermissions() {
  document.body.classList.toggle("role-admin", currentRole === "admin");
  document.body.classList.toggle("role-operacao", currentRole === "operacao");
  const label = document.getElementById("sessionRoleLabel");
  if (label) label.textContent = ROLE_LABELS[currentRole] || "-";

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
    activeSeries.profit = false;
    document.querySelectorAll('#seriesToggles input[data-series="profit"]').forEach((input) => {
      input.checked = false;
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
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : structuredClone(demoData);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  localStorage.setItem(`${STORAGE_KEY}:products`, JSON.stringify(productCatalog));
}

function loadProductCatalog() {
  const saved = localStorage.getItem(`${STORAGE_KEY}:products`);
  return saved ? JSON.parse(saved) : structuredClone(baseProducts);
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

  document.getElementById("monthlyReportButton")?.addEventListener("click", () => {
    navTabs.find((tab) => tab.dataset.view === "relatorios").click();
  });

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
  renderSyncStatus();
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
  const date = new Date(periodAnchor);
  if (currentPeriod === "daily") {
    date.setDate(date.getDate() + direction);
  } else if (currentPeriod === "weekly") {
    date.setDate(date.getDate() + direction * 7);
  } else if (currentPeriod === "monthly") {
    addMonthsSafely(date, direction);
  } else {
    addMonthsSafely(date, direction * 12);
  }
  periodAnchor = date.toISOString().slice(0, 10);
  renderDashboard();
}

function addMonthsSafely(date, months) {
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
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
  const periodLabel = currentPeriod === "weekly" ? "semanal" : "diario";
  const metrics = currentRole === "operacao"
    ? [
        { label: `Lucro ${periodLabel}`, value: currency(stats.profit), note: "Vendas menos despesas no periodo" }
      ]
    : [
        { label: "Total de vendas", value: currency(stats.salesTotal), note: `${stats.salesCount} movimentos que contam como venda` },
        { label: "Lucro", value: currency(stats.profit), note: "Vendas - despesas - investimentos" },
        { label: "Despesas", value: currency(stats.expenses), note: "Custos operacionais do periodo" },
        { label: "Investimentos", value: currency(stats.investments), note: "Custos de crescimento do negocio" }
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

  [...state.clients]
    .sort((a, b) => (b.balance + (b.debt || 0)) - (a.balance + (a.debt || 0)))
    .forEach((client) => {
      const row = document.createElement("div");
      row.className = "list-row";
      const debt = client.debt || 0;
      row.innerHTML = `
        <div>
          <strong>${client.name}</strong>
          <small>${client.phone || ""}</small>
        </div>
        <div class="balance-stack">
          <span class="badge ${client.balance > 0 ? "success" : "muted"}">Saldo: ${currency(client.balance)}</span>
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
        <td>${findClient(sale.clientId)?.name || sale.customerName || "-"}</td>
        <td>${findProduct(sale.productId)?.name || sale.productName || "-"}</td>
        <td>${translateEntryType(sale.entryType)}</td>
        <td>${sale.paymentMethod}</td>
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
          <strong>${client.name}</strong>
          <small>${client.phone || ""} | ${client.address || ""}</small>
        </div>
        <div class="balance-stack">
          <span class="badge ${client.balance > 0 ? "success" : "muted"}">Saldo: ${currency(client.balance)}</span>
          <span class="badge ${debt > 0 ? "danger" : "muted"}">Divida: ${currency(debt)}</span>
        </div>
      </div>
      <form class="client-adjust-form" data-client-id="${client.id}">
        <input type="number" name="amount" min="0.01" step="0.01" placeholder="Valor (Kz)" required>
        <select name="action" aria-label="Tipo de ajuste">
          <option value="deposit">Saldo</option>
          <option value="debt">Divida</option>
        </select>
        <button class="primary-button" type="submit">Aplicar</button>
      </form>
    `;
    target.appendChild(row);
  });
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
  // Stock movement also applies when client takes goods on credit (debt)
  if (product.stockControlled && (entryType === "sale" || entryType === "debt")) {
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

  state.sales.unshift({
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
    costTotal
  });

  await persistMutation({
    success: "Venda guardada e sincronizada.",
    fallback: "Venda guardada localmente."
  });

  if (movement) await insertStockMovement(movement);

  event.currentTarget.reset();
  hydrateDates();
  renderAll();
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

  productCatalog.unshift({
    id: productId,
    dbId: crypto.randomUUID(),
    name: String(form.get("name")),
    price,
    unit: String(form.get("unit") || "un"),
    category: String(form.get("category") || "Agua"),
    stockControlled
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
  const connected = await initializeSupabaseSession({ autoPull: true, silent: false });
  if (connected) renderAll();
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

  const existing = (data || []).find((item) => normalizeText(item.name) === normalizeText(STORE_NAME));
  if (existing) {
    currentStore = existing;
    return;
  }

  if (data?.length) {
    currentStore = data[0];
    return;
  }

  const { data: created, error: createError } = await supabaseClient
    .from(supabaseConfig.tables.stores)
    .insert({ name: STORE_NAME, whatsapp_number: `+${REPORT_PHONE}` })
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
    costTotal: toNumber(row.cost_total ?? 0)
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
  const expenseEntries = state.finance.filter((item) => item.type === "expense");
  const investmentEntries = state.finance.filter((item) => item.type === "investment");

  const inAnyBucket = (date) => buckets.some((b) => b.contains(date));
  const filteredSales = salesEntries.filter((item) => inAnyBucket(item.date));
  const filteredExpenses = expenseEntries.filter((item) => inAnyBucket(item.date));
  const filteredInvestments = investmentEntries.filter((item) => inAnyBucket(item.date));

  const salesTotal = filteredSales.reduce((sum, item) => sum + item.total, 0);
  const expensesTotal = filteredExpenses.reduce((sum, item) => sum + item.amount, 0);
  const investmentsTotal = filteredInvestments.reduce((sum, item) => sum + item.amount, 0);
  const paymentTotals = groupPayments(filteredSales);

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
    salesTotal,
    salesCount: filteredSales.length,
    expenses: expensesTotal,
    investments: investmentsTotal,
    profit: salesTotal - expensesTotal - investmentsTotal,
    paymentTotals,
    productTotals: filteredSales.reduce((acc, item) => {
      const name = findProduct(item.productId)?.name || item.productName || "Produto";
      acc[name] = (acc[name] || 0) + item.total;
      return acc;
    }, {}),
    timeline
  };
}

function buildBuckets(period, anchor) {
  const anchorDate = new Date(anchor);
  if (period === "daily") {
    return Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(anchorDate);
      d.setDate(d.getDate() - (6 - idx));
      const iso = d.toISOString().slice(0, 10);
      return {
        label: iso.slice(5),
        fullLabel: iso,
        contains: (date) => String(date).slice(0, 10) === iso
      };
    });
  }
  if (period === "weekly") {
    return Array.from({ length: 8 }, (_, idx) => {
      const d = new Date(anchorDate);
      d.setDate(d.getDate() - (7 - idx) * 7);
      const sunday = startOfWeek(d);
      const saturday = new Date(sunday);
      saturday.setDate(saturday.getDate() + 6);
      const startIso = sunday.toISOString().slice(0, 10);
      const endIso = saturday.toISOString().slice(0, 10);
      const wnum = weekOfMonth(sunday);
      const monthName = SHORT_MONTH_NAMES[sunday.getMonth()];
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
      const d = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
      d.setMonth(d.getMonth() - (11 - idx));
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
      return {
        label: `${monthNames[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        fullLabel: ym,
        contains: (date) => String(date).slice(0, 7) === ym
      };
    });
  }
  return Array.from({ length: 5 }, (_, idx) => {
    const year = anchorDate.getFullYear() - (4 - idx);
    const ys = String(year);
    return {
      label: ys,
      fullLabel: `Ano ${ys}`,
      contains: (date) => String(date).slice(0, 4) === ys
    };
  });
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
  const expenses = state.finance.filter((item) => item.type === "expense" && item.date === today).reduce((sum, item) => sum + item.amount, 0);
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

  const expenses = state.finance.filter((item) => item.type === "expense" && sameMonth(item.date, today)).reduce((sum, item) => sum + item.amount, 0);
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

function sendWhatsappReport() {
  const report = buildDailyReport();
  const text = [
    `AGUA CRISTALINA - Relatorio diario (${today})`,
    `Vendas do dia: ${currency(report.sales)}`,
    `Lucro: ${currency(report.profit)}`,
    `Despesas: ${currency(report.expenses)}`,
    `Investimentos: ${currency(report.investments)}`
  ].join("\n");
  window.open(`https://wa.me/${REPORT_PHONE}?text=${encodeURIComponent(text)}`, "_blank");
}

async function copyDailyReport() {
  const report = buildDailyReport();
  const text = [
    `AGUA CRISTALINA - Relatorio diario (${today})`,
    `Vendas: ${currency(report.sales)}`,
    `Lucro: ${currency(report.profit)}`,
    `Despesas: ${currency(report.expenses)}`,
    `Investimentos: ${currency(report.investments)}`
  ].join("\n");

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
  return `${Number(value || 0).toLocaleString("pt-PT")} Kz`;
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
  const expenseEntries = state.finance.filter((item) => item.type === "expense");
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
