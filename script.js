/* NEXUS ERP for Traders — vanilla HTML/CSS/JS */
(() => {
  "use strict";

  const STORAGE_KEY = "nexus_backup";
  const SETTINGS_KEY = "nexus_settings";
  const VIEW_KEY = "nexus_active_view";

  const MENU = [
    { id: "dashboard", label: "لوحة التحكم", icon: "◫", color: "nav-blue" },
    { id: "inventory", label: "المخزن", icon: "▣", color: "nav-yellow" },
    { id: "sales", label: "المبيعات", icon: "▤", color: "nav-green" },
    { id: "customer_orders", label: "طلبات العملاء", icon: "🛒", color: "nav-indigo" },
    { id: "purchases", label: "المشتريات", icon: "💳", color: "nav-accent" },
    { id: "purchase_requests", label: "طلبات الشراء", icon: "📦", color: "nav-amber" },
    { id: "expenses", label: "المصروفات", icon: "↗", color: "nav-red" },
    { id: "debts", label: "الديون", icon: "🪙", color: "nav-emerald" },
    { id: "directory", label: "الدليل", icon: "👥", color: "nav-purple" },
    { id: "reports", label: "التقارير", icon: "📊", color: "nav-purple2" },
    { id: "profits", label: "الأرباح", icon: "💹", color: "nav-neon" },
    { id: "settings", label: "الإعدادات", icon: "⚙", color: "nav-slate" },
  ];

  const PAGE_TITLES = Object.fromEntries(MENU.map((m) => [m.id, m.label]));

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const els = {
    nav: $("#nav"),
    view: $("#view"),
    pageTitle: $("#pageTitle"),
    sidebar: $("#sidebar"),
    menuToggle: $("#menuToggle"),
    themeToggle: $("#themeToggle"),
    quickAdd: $("#quickAdd"),
    storageStatus: $("#storageStatus"),
    toast: $("#toast"),
    modal: $("#modal"),
    modalTitle: $("#modalTitle"),
    modalBody: $("#modalBody"),
    modalForm: $("#modalForm"),
    modalSave: $("#modalSave"),
  };

  let state = loadState();
  let activeView = localStorage.getItem(VIEW_KEY) || "dashboard";
  let modalHandler = null;
  let toastTimer = null;

  function defaultState() {
    return {
      items: [],
      invoices: [],
      purchases: [],
      expenses: [],
      customers: [],
      suppliers: [],
      debts: [],
      customerOrders: [],
      purchaseRequests: [],
      recycleBin: [],
      companyInfo: { name: "", phone: "", address: "", footer: "", logo: "" },
      settings: { deductExpensesFromProfits: false },
      lastSync: new Date().toISOString(),
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaultState(), ...JSON.parse(raw) };
    } catch (_) {}
    const seeded = defaultState();
    seedDemoData(seeded);
    return seeded;
  }

  function saveState() {
    state.lastSync = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    } catch (_) {}
    els.storageStatus.textContent = "محفوظ محلياً";
  }

  function seedDemoData(s) {
    if (localStorage.getItem("nexus_demo_seeded")) return;
    const today = formatDate(new Date());
    const yesterday = formatDate(new Date(Date.now() - 86400000));
    s.items = [
      { id: "1", name: "قميص قطن", qty: 45, price: 250, purchasePrice: 160, barcode: "6281001", category: "ملابس" },
      { id: "2", name: "بنطلون جينز", qty: 22, price: 420, purchasePrice: 280, barcode: "6281002", category: "ملابس" },
      { id: "3", name: "حذاء رياضي", qty: 8, price: 650, purchasePrice: 430, barcode: "6281003", category: "أحذية" },
    ];
    s.customers = [
      { id: "c1", name: "أحمد محمود", phone: "01001234567", address: "القاهرة", type: "customer" },
      { id: "c2", name: "سارة علي", phone: "01009876543", address: "الجيزة", type: "customer" },
    ];
    s.suppliers = [
      { id: "s1", name: "مورد النيل", phone: "0223344556", address: "الإسكندرية", type: "supplier" },
    ];
    s.invoices = [
      {
        id: "1",
        customer: "أحمد محمود",
        date: today,
        total: 1250,
        paidAmount: 1250,
        remainingAmount: 0,
        discount: 0,
        items: [{ id: "1", name: "قميص قطن", qty: 5, price: 250, purchasePrice: 160 }],
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        customer: "سارة علي",
        date: yesterday,
        total: 840,
        paidAmount: 500,
        remainingAmount: 340,
        discount: 0,
        items: [{ id: "2", name: "بنطلون جينز", qty: 2, price: 420, purchasePrice: 280 }],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
    s.purchases = [
      {
        id: "1",
        supplier: "مورد النيل",
        date: yesterday,
        total: 3200,
        paidAmount: 3200,
        remainingAmount: 0,
        items: [{ id: "1", name: "قميص قطن", qty: 20, cost: 160 }],
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ];
    s.expenses = [
      { id: "e1", title: "إيجار المحل", amount: 5000, date: today, category: "إيجار", createdAt: new Date().toISOString() },
      { id: "e2", title: "كهرباء", amount: 850, date: yesterday, category: "مرافق", createdAt: new Date(Date.now() - 86400000).toISOString() },
    ];
    s.companyInfo = { name: "متجر نيكسوس", phone: "01000000000", address: "مصر", footer: "شكراً لتعاملكم معنا", logo: "" };
    localStorage.setItem("nexus_demo_seeded", "1");
  }

  function money(n) {
    return `${Number(n || 0).toLocaleString("ar-EG")} ج.م`;
  }

  function uid(prefix = "") {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  }

  function nextId(list) {
    const nums = list.map((x) => Number(x.id)).filter((n) => !Number.isNaN(n));
    return String((nums.length ? Math.max(...nums) : 0) + 1);
  }

  function formatDate(d) {
    const x = d instanceof Date ? d : new Date(d);
    return `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;
  }

  function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const western = String(dateStr).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
    const parts = western.split(/[/.-]/);
    if (parts.length === 3) {
      const a = parseInt(parts[0], 10);
      const b = parseInt(parts[1], 10);
      const c = parseInt(parts[2], 10);
      if (c > 1000) return new Date(c, b - 1, a);
      if (a > 1000) return new Date(a, b - 1, c);
    }
    const d = new Date(western);
    return Number.isNaN(d.getTime()) ? new Date(0) : d;
  }

  function sameDay(a, b) {
    return a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2600);
  }

  function openModal(title, bodyHtml, onSave) {
    els.modalTitle.textContent = title;
    els.modalBody.innerHTML = bodyHtml;
    modalHandler = onSave;
    els.modal.showModal();
  }

  function closeModal() {
    modalHandler = null;
    els.modal.close();
  }

  function field(label, name, value = "", type = "text", extra = "") {
    const tag = type === "textarea"
      ? `<textarea name="${name}" ${extra}>${escapeHtml(value)}</textarea>`
      : `<input name="${name}" type="${type}" value="${escapeAttr(value)}" ${extra} />`;
    return `<label class="field ${type === "textarea" ? "full" : ""}"><span>${label}</span>${tag}</label>`;
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function renderNav() {
    els.nav.innerHTML = MENU.map((item) => `
      <button type="button" class="${item.color}${activeView === item.id ? " active" : ""}" data-view="${item.id}">
        <span class="nav-icon">${item.icon}</span>
        <span class="nav-label">${item.label}</span>
      </button>
    `).join("");
    $$("#nav button").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeView = btn.dataset.view;
        localStorage.setItem(VIEW_KEY, activeView);
        els.sidebar.classList.remove("open");
        render();
      });
    });
  }

  function render() {
    renderNav();
    els.pageTitle.textContent = PAGE_TITLES[activeView] || "NEXUS";
    const renderers = {
      dashboard: renderDashboard,
      inventory: renderInventory,
      sales: renderSales,
      customer_orders: renderCustomerOrders,
      purchases: renderPurchases,
      purchase_requests: renderPurchaseRequests,
      expenses: renderExpenses,
      debts: renderDebts,
      directory: renderDirectory,
      reports: renderReports,
      profits: renderProfits,
      settings: renderSettings,
    };
    els.view.innerHTML = `<div class="page">${(renderers[activeView] || renderDashboard)()}</div>`;
    bindViewEvents();
    if (activeView === "dashboard") drawDashboardCharts();
  }

  function bindViewEvents() {
    $$("[data-action]").forEach((el) => {
      el.addEventListener("click", (e) => {
        const action = el.dataset.action;
        const id = el.dataset.id;
        const handlers = {
          "inventory-add": () => openInventoryModal(),
          "inventory-edit": () => openInventoryModal(state.items.find((x) => x.id === id)),
          "inventory-delete": () => deleteItem("items", id, "المنتج"),
          "sales-add": () => openInvoiceModal(),
          "sales-delete": () => deleteItem("invoices", id, "الفاتورة"),
          "purchases-add": () => openPurchaseModal(),
          "purchases-delete": () => deleteItem("purchases", id, "فاتورة الشراء"),
          "expenses-add": () => openExpenseModal(),
          "expenses-edit": () => openExpenseModal(state.expenses.find((x) => x.id === id)),
          "expenses-delete": () => deleteItem("expenses", id, "المصروف"),
          "directory-add": () => openDirectoryModal(),
          "directory-edit": () => openDirectoryModal(findDirectoryItem(id)),
          "directory-delete": () => deleteDirectoryItem(id),
          "debts-add": () => openDebtModal(),
          "debts-delete": () => deleteItem("debts", id, "الحركة"),
          "orders-add": () => openOrderModal(),
          "orders-delete": () => deleteItem("customerOrders", id, "الطلب"),
          "orders-transfer": () => transferOrderToInvoice(id),
          "requests-add": () => openRequestModal(),
          "requests-delete": () => deleteItem("purchaseRequests", id, "طلب الشراء"),
          "requests-transfer": () => transferRequestToPurchase(id),
          "settings-save": () => saveCompanyInfo(),
          "settings-export": () => exportBackup(),
          "settings-import": () => $("#importFile").click(),
          "settings-clear": () => clearAllData(),
        };
        handlers[action]?.();
        e.preventDefault();
      });
    });

    const dirTab = $("#directoryTab");
    if (dirTab) {
      $$(".tab", dirTab).forEach((tab) => {
        tab.addEventListener("click", () => {
          dirTab.dataset.tab = tab.dataset.tab;
          render();
        });
      });
    }

    const debtTab = $("#debtTab");
    if (debtTab) {
      $$(".tab", debtTab).forEach((tab) => {
        tab.addEventListener("click", () => {
          debtTab.dataset.tab = tab.dataset.tab;
          render();
        });
      });
    }

    ["inventorySearch", "salesSearch", "expensesSearch", "directorySearch"].forEach((id) => {
      const input = $(`#${id}`);
      if (input) {
        input.addEventListener("input", () => {
          input.dataset.value = input.value;
          render();
        });
      }
    });

    const deduct = $("#deductExpenses");
    if (deduct) {
      deduct.addEventListener("change", () => {
        state.settings.deductExpensesFromProfits = deduct.checked;
        saveState();
        render();
      });
    }
  }

  function deleteItem(key, id, label) {
    if (!confirm(`هل تريد حذف ${label}؟`)) return;
    const item = state[key].find((x) => x.id === id);
    if (item) state.recycleBin.unshift({ type: key, data: item, deletedAt: new Date().toISOString() });
    state[key] = state[key].filter((x) => x.id !== id);
    saveState();
    toast(`تم حذف ${label}`);
    render();
  }

  function hero(badge, title, subtitle, actions = "") {
    return `
      <div class="hero-line">
        <div>
          <span class="badge">${badge}</span>
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        ${actions ? `<div class="toolbar-actions">${actions}</div>` : ""}
      </div>`;
  }

  function table(headers, rows, empty = "لا توجد بيانات") {
    if (!rows.length) return `<div class="empty">${empty}</div>`;
    return `
      <div class="table-wrap card card-pad">
        <table>
          <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>`;
  }

  function calcInvoiceProfit(inv) {
    if (!inv?.items) return 0;
    const itemsProfit = inv.items.reduce((acc, item) => {
      return acc + ((Number(item.price) - Number(item.purchasePrice || item.cost || 0)) * Number(item.qty || 0));
    }, 0);
    return itemsProfit - (Number(inv.discount) || 0);
  }

  function getChartData() {
    const data = [];
    const days = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = `${days[d.getDay()]} ${d.toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" })}`;
      const daySales = state.invoices.filter((inv) => sameDay(parseDate(inv.date), d)).reduce((a, inv) => a + Number(inv.total || 0), 0);
      const dayProfit = state.invoices.filter((inv) => sameDay(parseDate(inv.date), d)).reduce((a, inv) => a + calcInvoiceProfit(inv), 0);
      const dayExpenses = state.expenses.filter((exp) => sameDay(parseDate(exp.date), d)).reduce((a, exp) => a + Number(exp.amount || 0), 0);
      const dayPurchases = state.purchases.filter((p) => sameDay(parseDate(p.date), d)).reduce((a, p) => a + Number(p.total || 0), 0);
      data.push({ label, sales: daySales, profit: dayProfit, expenses: dayExpenses, purchases: dayPurchases });
    }
    return data;
  }

  function statCard(title, value, icon, color) {
    return `
      <div class="stat-card">
        <div class="stat-inner">
          <div class="stat-icon ${color}">${icon}</div>
          <p class="stat-title">${title}</p>
          <p class="stat-value">${money(value).replace(" ج.م", "")} <span style="font-size:12px;opacity:.5">ج.م</span></p>
        </div>
      </div>`;
  }

  function renderDashboard() {
    const totalSales = state.invoices.reduce((a, i) => a + Number(i.total || 0), 0);
    const totalExpenses = state.expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
    const stockValue = state.items.reduce((a, i) => a + Number(i.qty || 0) * Number(i.purchasePrice || 0), 0);
    const grossProfit = state.invoices.reduce((a, i) => a + calcInvoiceProfit(i), 0);
    const netProfit = grossProfit - (state.settings.deductExpensesFromProfits ? totalExpenses : 0);

    return `
      ${hero("نظرة عامة على أدائك", "Dash<br>board", "تحليلات سريعة لأدائك.", `<button class="secondary-button" type="button" onclick="location.reload()">↻ تحديث البيانات</button>`)}
      <div class="grid stats-grid">
        ${statCard("إجمالي المبيعات", totalSales, "↗", "blue")}
        ${statCard("قيمة المخزون", stockValue, "▣", "yellow")}
        ${statCard("المصروفات", totalExpenses, "💳", "red")}
        ${statCard("الربح الصافي", netProfit, "◎", "accent")}
      </div>
      <div class="grid two-grid">
        <div class="card card-pad">
          <div class="panel-head">
            <h3>المبيعات مقابل المشتريات (7 أيام)</h3>
            <div class="chart-legend">
              <span><i class="legend-dot" style="background:#3b82f6"></i> المبيعات</span>
              <span><i class="legend-dot" style="background:#f97316"></i> المشتريات</span>
            </div>
          </div>
          <div class="chart-wrap"><canvas id="chartSales"></canvas></div>
        </div>
        <div class="card card-pad">
          <div class="panel-head">
            <h3>الأرباح مقابل المصروفات (7 أيام)</h3>
            <div class="chart-legend">
              <span><i class="legend-dot" style="background:#22c55e"></i> الأرباح</span>
              <span><i class="legend-dot" style="background:#f87171"></i> المصروفات</span>
            </div>
          </div>
          <div class="chart-wrap"><canvas id="chartProfit"></canvas></div>
        </div>
      </div>`;
  }

  function drawLineChart(canvasId, labels, series) {
    const canvas = $(`#${canvasId}`);
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    canvas.width = w * devicePixelRatio;
    canvas.height = h * devicePixelRatio;
    const ctx = canvas.getContext("2d");
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0, 0, w, h);

    const allVals = series.flatMap((s) => s.data);
    const max = Math.max(...allVals, 1);
    const pad = { t: 16, r: 16, b: 42, l: 52 };
    const plotW = w - pad.l - pad.r;
    const plotH = h - pad.t - pad.b;

    ctx.strokeStyle = "rgba(100,116,139,.15)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (plotH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
    }

    ctx.fillStyle = getComputedStyle(document.body).color;
    ctx.font = "bold 10px Cairo, sans-serif";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const val = max - (max / 4) * i;
      const y = pad.t + (plotH / 4) * i + 4;
      ctx.fillText(Math.round(val).toLocaleString("ar-EG"), pad.l - 8, y);
    }

    const xStep = labels.length > 1 ? plotW / (labels.length - 1) : plotW;
    labels.forEach((label, i) => {
      const x = pad.l + xStep * i;
      ctx.save();
      ctx.translate(x, h - 8);
      ctx.rotate(-0.45);
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(100,116,139,.9)";
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });

    series.forEach((s) => {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      s.data.forEach((v, i) => {
        const x = pad.l + xStep * i;
        const y = pad.t + plotH - (v / max) * plotH;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      s.data.forEach((v, i) => {
        const x = pad.l + xStep * i;
        const y = pad.t + plotH - (v / max) * plotH;
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  function drawDashboardCharts() {
    const data = getChartData();
    const labels = data.map((d) => d.label);
    drawLineChart("chartSales", labels, [
      { color: "#3b82f6", data: data.map((d) => d.sales) },
      { color: "#f97316", data: data.map((d) => d.purchases) },
    ]);
    drawLineChart("chartProfit", labels, [
      { color: "#22c55e", data: data.map((d) => d.profit) },
      { color: "#f87171", data: data.map((d) => d.expenses) },
    ]);
  }

  function renderInventory() {
    const q = ($("#inventorySearch")?.dataset.value || $("#inventorySearch")?.value || "").trim().toLowerCase();
    const rows = state.items
      .filter((i) => !q || i.name.toLowerCase().includes(q) || String(i.barcode || "").includes(q))
      .map((item) => `
        <tr>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.category || "عام")}</td>
          <td class="${Number(item.qty) <= 5 ? "low-stock" : ""}">${item.qty ?? 0}</td>
          <td>${money(item.price)}</td>
          <td>${money(item.purchasePrice)}</td>
          <td>${escapeHtml(item.barcode || "-")}</td>
          <td class="actions-cell">
            <button class="secondary-button" data-action="inventory-edit" data-id="${item.id}">تعديل</button>
            <button class="danger-button" data-action="inventory-delete" data-id="${item.id}">حذف</button>
          </td>
        </tr>`);

    return `
      ${hero("إدارة المخزون", "Inven<br>tory", "تتبع الكميات والأسعار والباركود.")}
      <div class="toolbar">
        <input class="search-input" id="inventorySearch" placeholder="بحث بالاسم أو الباركود..." value="${escapeAttr(q)}" />
        <button class="primary-button" data-action="inventory-add">+ إضافة منتج</button>
      </div>
      ${table(["المنتج", "التصنيف", "الكمية", "سعر البيع", "سعر الشراء", "الباركود", "إجراءات"], rows, "لا توجد منتجات في المخزن")}
    `;
  }

  function openInventoryModal(item = null) {
    openModal(item ? "تعديل منتج" : "إضافة منتج", `
      <div class="form-grid">
        ${field("اسم المنتج", "name", item?.name || "")}
        ${field("التصنيف", "category", item?.category || "عام")}
        ${field("الكمية", "qty", item?.qty ?? "", "number", 'min="0" step="1"')}
        ${field("سعر البيع", "price", item?.price ?? "", "number", 'min="0" step="0.01"')}
        ${field("سعر الشراء", "purchasePrice", item?.purchasePrice ?? "", "number", 'min="0" step="0.01"')}
        ${field("الباركود", "barcode", item?.barcode || "")}
        ${field("ملاحظات", "notes", item?.notes || "", "textarea")}
      </div>
    `, (fd) => {
      const payload = {
        id: item?.id || uid("i"),
        name: fd.get("name").trim(),
        category: fd.get("category").trim() || "عام",
        qty: Number(fd.get("qty")) || 0,
        price: Number(fd.get("price")) || 0,
        purchasePrice: Number(fd.get("purchasePrice")) || 0,
        barcode: fd.get("barcode").trim(),
        notes: fd.get("notes").trim(),
      };
      if (!payload.name) return toast("يرجى إدخال اسم المنتج");
      if (item) state.items = state.items.map((x) => (x.id === item.id ? payload : x));
      else state.items.unshift(payload);
      saveState();
      toast(item ? "تم تحديث المنتج" : "تمت إضافة المنتج");
      render();
    });
  }

  function renderSales() {
    const q = ($("#salesSearch")?.dataset.value || "").trim().toLowerCase();
    const rows = state.invoices
      .filter((inv) => !q || String(inv.customer || "").toLowerCase().includes(q) || String(inv.id).includes(q))
      .map((inv) => `
        <tr>
          <td>#${inv.id}</td>
          <td>${escapeHtml(inv.customer || "عميل نقدي")}</td>
          <td>${escapeHtml(inv.date)}</td>
          <td>${money(inv.total)}</td>
          <td>${money(inv.paidAmount)}</td>
          <td>${money(inv.remainingAmount)}</td>
          <td class="actions-cell">
            <button class="danger-button" data-action="sales-delete" data-id="${inv.id}">حذف</button>
          </td>
        </tr>`);

    return `
      ${hero("فواتير المبيعات", "Sales", "إدارة المبيعات والتحصيل.")}
      <div class="toolbar">
        <input class="search-input" id="salesSearch" placeholder="بحث برقم الفاتورة أو العميل..." value="${escapeAttr(q)}" />
        <button class="primary-button" data-action="sales-add">+ فاتورة جديدة</button>
      </div>
      ${table(["رقم", "العميل", "التاريخ", "الإجمالي", "المدفوع", "المتبقي", "إجراءات"], rows)}
    `;
  }

  function openInvoiceModal() {
    const itemOptions = state.items.map((i) => `<option value="${i.id}">${escapeHtml(i.name)} (${i.qty})</option>`).join("");
    openModal("فاتورة مبيعات جديدة", `
      <div class="form-grid">
        ${field("العميل", "customer", "")}
        ${field("التاريخ", "date", formatDate(new Date()), "date")}
        ${field("الخصم", "discount", "0", "number", 'min="0" step="0.01"')}
        ${field("المدفوع", "paidAmount", "0", "number", 'min="0" step="0.01"')}
        <label class="field full"><span>المنتج</span><select name="itemId">${itemOptions || '<option value="">لا يوجد منتج</option>'}</select></label>
        ${field("الكمية", "qty", "1", "number", 'min="1" step="1"')}
      </div>
    `, (fd) => {
      const item = state.items.find((x) => x.id === fd.get("itemId"));
      const qty = Number(fd.get("qty")) || 0;
      if (!item || qty <= 0) return toast("اختر منتجاً وكمية صحيحة");
      if (qty > Number(item.qty || 0)) return toast("الكمية أكبر من المتوفر في المخزن");
      const line = { id: item.id, name: item.name, qty, price: item.price, purchasePrice: item.purchasePrice };
      const discount = Number(fd.get("discount")) || 0;
      const total = qty * Number(item.price) - discount;
      const paid = Number(fd.get("paidAmount")) || 0;
      const inv = {
        id: nextId(state.invoices),
        customer: fd.get("customer").trim() || "عميل نقدي",
        date: fd.get("date") ? formatDate(new Date(fd.get("date"))) : formatDate(new Date()),
        items: [line],
        discount,
        total,
        paidAmount: paid,
        remainingAmount: Math.max(0, total - paid),
        createdAt: new Date().toISOString(),
      };
      state.invoices.unshift(inv);
      state.items = state.items.map((x) => (x.id === item.id ? { ...x, qty: Math.max(0, Number(x.qty) - qty) } : x));
      saveState();
      toast("تم حفظ الفاتورة");
      render();
    });
  }

  function renderPurchases() {
    const rows = state.purchases.map((p) => `
      <tr>
        <td>#${p.id}</td>
        <td>${escapeHtml(p.supplier || "مورد عام")}</td>
        <td>${escapeHtml(p.date)}</td>
        <td>${money(p.total)}</td>
        <td class="actions-cell"><button class="danger-button" data-action="purchases-delete" data-id="${p.id}">حذف</button></td>
      </tr>`);
    return `
      ${hero("المشتريات", "Purchases", "تسجيل فواتير الشراء وتحديث المخزون.")}
      <div class="toolbar"><button class="primary-button" data-action="purchases-add">+ فاتورة شراء</button></div>
      ${table(["رقم", "المورد", "التاريخ", "الإجمالي", "إجراءات"], rows)}
    `;
  }

  function openPurchaseModal() {
    const itemOptions = state.items.map((i) => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join("");
    openModal("فاتورة شراء جديدة", `
      <div class="form-grid">
        ${field("المورد", "supplier", "")}
        ${field("التاريخ", "date", formatDate(new Date()), "date")}
        <label class="field full"><span>المنتج</span><select name="itemId">${itemOptions || '<option value="">لا يوجد منتج</option>'}</select></label>
        ${field("الكمية", "qty", "1", "number", 'min="1"')}
        ${field("سعر الشراء", "cost", "0", "number", 'min="0" step="0.01"')}
      </div>
    `, (fd) => {
      const item = state.items.find((x) => x.id === fd.get("itemId"));
      const qty = Number(fd.get("qty")) || 0;
      const cost = Number(fd.get("cost")) || 0;
      if (!item || qty <= 0) return toast("اختر منتجاً وكمية صحيحة");
      const total = qty * cost;
      const purchase = {
        id: nextId(state.purchases),
        supplier: fd.get("supplier").trim() || "مورد عام",
        date: formatDate(new Date(fd.get("date") || new Date())),
        items: [{ id: item.id, name: item.name, qty, cost }],
        total,
        paidAmount: total,
        remainingAmount: 0,
        createdAt: new Date().toISOString(),
      };
      state.purchases.unshift(purchase);
      const oldQty = Number(item.qty) || 0;
      const oldCost = Number(item.purchasePrice) || 0;
      const newQty = oldQty + qty;
      const avgCost = newQty > 0 ? (oldQty * oldCost + qty * cost) / newQty : cost;
      state.items = state.items.map((x) => (x.id === item.id ? { ...x, qty: newQty, purchasePrice: avgCost } : x));
      saveState();
      toast("تم حفظ فاتورة الشراء");
      render();
    });
  }

  function renderExpenses() {
    const q = ($("#expensesSearch")?.dataset.value || "").trim().toLowerCase();
    const rows = state.expenses
      .filter((e) => !q || e.title.toLowerCase().includes(q) || (e.category || "").toLowerCase().includes(q))
      .map((e) => `
        <tr>
          <td>${escapeHtml(e.title)}</td>
          <td>${escapeHtml(e.category || "عام")}</td>
          <td>${escapeHtml(e.date)}</td>
          <td>${money(e.amount)}</td>
          <td class="actions-cell">
            <button class="secondary-button" data-action="expenses-edit" data-id="${e.id}">تعديل</button>
            <button class="danger-button" data-action="expenses-delete" data-id="${e.id}">حذف</button>
          </td>
        </tr>`);
    return `
      ${hero("المصروفات", "Expenses", "تتبع نفقات المحل اليومية.")}
      <div class="toolbar">
        <input class="search-input" id="expensesSearch" placeholder="بحث..." value="${escapeAttr(q)}" />
        <button class="primary-button" data-action="expenses-add">+ مصروف جديد</button>
      </div>
      ${table(["البيان", "التصنيف", "التاريخ", "المبلغ", "إجراءات"], rows)}
    `;
  }

  function openExpenseModal(expense = null) {
    openModal(expense ? "تعديل مصروف" : "مصروف جديد", `
      <div class="form-grid">
        ${field("البيان", "title", expense?.title || "")}
        ${field("التصنيف", "category", expense?.category || "عام")}
        ${field("التاريخ", "date", expense?.date || formatDate(new Date()), "date")}
        ${field("المبلغ", "amount", expense?.amount ?? "", "number", 'min="0" step="0.01"')}
      </div>
    `, (fd) => {
      const payload = {
        id: expense?.id || uid("e"),
        title: fd.get("title").trim(),
        category: fd.get("category").trim() || "عام",
        date: formatDate(new Date(fd.get("date") || new Date())),
        amount: Number(fd.get("amount")) || 0,
        createdAt: expense?.createdAt || new Date().toISOString(),
      };
      if (!payload.title) return toast("أدخل وصف المصروف");
      if (expense) state.expenses = state.expenses.map((x) => (x.id === expense.id ? payload : x));
      else state.expenses.unshift(payload);
      saveState();
      toast("تم حفظ المصروف");
      render();
    });
  }

  function renderDirectory() {
    const tab = $("#directoryTab")?.dataset.tab || "customers";
    const list = tab === "customers" ? state.customers : state.suppliers;
    const q = ($("#directorySearch")?.dataset.value || "").trim();
    const filtered = list.filter((x) => (x.name || "").includes(q) || (x.phone || "").includes(q));
    const rows = filtered.map((x) => `
      <tr>
        <td>${escapeHtml(x.name)}</td>
        <td>${escapeHtml(x.phone || "-")}</td>
        <td>${escapeHtml(x.address || "-")}</td>
        <td class="actions-cell">
          <button class="secondary-button" data-action="directory-edit" data-id="${x.id}">تعديل</button>
          <button class="danger-button" data-action="directory-delete" data-id="${x.id}">حذف</button>
        </td>
      </tr>`);

    return `
      ${hero("دليل العملاء والموردين", "Directory", "إدارة بيانات التواصل.")}
      <div id="directoryTab" data-tab="${tab}">
        <div class="tabs">
          <button type="button" class="tab ${tab === "customers" ? "active" : ""}" data-tab="customers">العملاء</button>
          <button type="button" class="tab ${tab === "suppliers" ? "active" : ""}" data-tab="suppliers">الموردين</button>
        </div>
      </div>
      <div class="toolbar">
        <input class="search-input" id="directorySearch" placeholder="بحث بالاسم أو الهاتف..." value="${escapeAttr(q)}" />
        <button class="primary-button" data-action="directory-add">+ إضافة</button>
      </div>
      ${table(["الاسم", "الهاتف", "العنوان", "إجراءات"], rows)}
    `;
  }

  function findDirectoryItem(id) {
    return state.customers.find((x) => x.id === id) || state.suppliers.find((x) => x.id === id);
  }

  function openDirectoryModal(item = null) {
    const tab = $("#directoryTab")?.dataset.tab || (item?.type === "supplier" ? "suppliers" : "customers");
    openModal(item ? "تعديل" : "إضافة جديد", `
      <div class="form-grid">
        ${field("الاسم", "name", item?.name || "")}
        ${field("الهاتف", "phone", item?.phone || "")}
        ${field("العنوان", "address", item?.address || "", "textarea")}
      </div>
    `, (fd) => {
      const payload = {
        id: item?.id || uid(tab === "customers" ? "c" : "s"),
        name: fd.get("name").trim(),
        phone: fd.get("phone").trim(),
        address: fd.get("address").trim(),
        type: tab === "customers" ? "customer" : "supplier",
      };
      if (!payload.name) return toast("أدخل الاسم");
      const key = tab === "customers" ? "customers" : "suppliers";
      if (item) state[key] = state[key].map((x) => (x.id === item.id ? payload : x));
      else state[key].push(payload);
      saveState();
      toast("تم الحفظ");
      render();
    });
  }

  function deleteDirectoryItem(id) {
    const inCustomers = state.customers.some((x) => x.id === id);
    const key = inCustomers ? "customers" : "suppliers";
    deleteItem(key, id, inCustomers ? "العميل" : "المورد");
  }

  function renderDebts() {
    const tab = $("#debtTab")?.dataset.tab || "customers";
    const rows = state.debts
      .filter((d) => d.partyType === tab || (!d.partyType && tab === "customers"))
      .map((d) => `
        <tr>
          <td>${escapeHtml(d.personName || "-")}</td>
          <td>${escapeHtml(d.date)}</td>
          <td>${d.type === "gave" ? "أعطيت" : "أخذت"}</td>
          <td>${money(d.amount)}</td>
          <td class="actions-cell"><button class="danger-button" data-action="debts-delete" data-id="${d.id}">حذف</button></td>
        </tr>`);
    return `
      ${hero("إدارة الديون", "Debts", "متابعة المديونيات والمقبوضات.")}
      <div id="debtTab" data-tab="${tab}">
        <div class="tabs">
          <button type="button" class="tab ${tab === "customers" ? "active" : ""}" data-tab="customers">ديون العملاء</button>
          <button type="button" class="tab ${tab === "suppliers" ? "active" : ""}" data-tab="suppliers">ديون الموردين</button>
        </div>
      </div>
      <div class="toolbar"><button class="primary-button" data-action="debts-add">+ حركة جديدة</button></div>
      ${table(["الشخص", "التاريخ", "النوع", "المبلغ", "إجراءات"], rows)}
    `;
  }

  function openDebtModal() {
    const tab = $("#debtTab")?.dataset.tab || "customers";
    openModal("حركة مالية", `
      <div class="form-grid">
        ${field("الاسم", "personName", "")}
        ${field("التاريخ", "date", formatDate(new Date()), "date")}
        <label class="field"><span>النوع</span><select name="type"><option value="gave">أعطيت (سحب)</option><option value="took">أخذت (قبض)</option></select></label>
        ${field("المبلغ", "amount", "", "number", 'min="0" step="0.01"')}
        ${field("ملاحظات", "notes", "", "textarea")}
      </div>
    `, (fd) => {
      const payload = {
        id: uid("d"),
        personName: fd.get("personName").trim(),
        date: formatDate(new Date(fd.get("date") || new Date())),
        type: fd.get("type"),
        amount: Number(fd.get("amount")) || 0,
        notes: fd.get("notes").trim(),
        partyType: tab,
      };
      if (!payload.personName || !payload.amount) return toast("أكمل البيانات");
      state.debts.unshift(payload);
      saveState();
      toast("تم تسجيل الحركة");
      render();
    });
  }

  function renderCustomerOrders() {
    const rows = state.customerOrders.map((o) => `
      <tr>
        <td>#${o.id}</td>
        <td>${escapeHtml(o.customer || "-")}</td>
        <td>${escapeHtml(o.date)}</td>
        <td>${money(o.total)}</td>
        <td><span class="badge ${o.status === "transferred" ? "green" : "yellow"}">${o.status === "transferred" ? "تم التحويل" : "معلق"}</span></td>
        <td class="actions-cell">
          ${o.status !== "transferred" ? `<button class="primary-button" data-action="orders-transfer" data-id="${o.id}">تحويل لفاتورة</button>` : ""}
          <button class="danger-button" data-action="orders-delete" data-id="${o.id}">حذف</button>
        </td>
      </tr>`);
    return `
      ${hero("طلبات العملاء", "Orders", "إدارة الطلبات قبل التحويل لفواتير.")}
      <div class="toolbar"><button class="primary-button" data-action="orders-add">+ طلب جديد</button></div>
      ${table(["رقم", "العميل", "التاريخ", "الإجمالي", "الحالة", "إجراءات"], rows)}
    `;
  }

  function openOrderModal() {
    const itemOptions = state.items.map((i) => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join("");
    openModal("طلب عميل جديد", `
      <div class="form-grid">
        ${field("العميل", "customer", "")}
        ${field("التاريخ", "date", formatDate(new Date()), "date")}
        <label class="field full"><span>المنتج</span><select name="itemId">${itemOptions}</select></label>
        ${field("الكمية", "qty", "1", "number", 'min="1"')}
      </div>
    `, (fd) => {
      const item = state.items.find((x) => x.id === fd.get("itemId"));
      const qty = Number(fd.get("qty")) || 0;
      if (!item) return toast("اختر منتجاً");
      const total = qty * Number(item.price || 0);
      state.customerOrders.unshift({
        id: nextId(state.customerOrders),
        customer: fd.get("customer").trim() || "عميل",
        date: formatDate(new Date(fd.get("date") || new Date())),
        items: [{ id: item.id, name: item.name, qty, price: item.price, purchasePrice: item.purchasePrice }],
        total,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      saveState();
      toast("تم حفظ الطلب");
      render();
    });
  }

  function transferOrderToInvoice(id) {
    const order = state.customerOrders.find((x) => x.id === id);
    if (!order || order.status === "transferred") return toast("لا يمكن تحويل هذا الطلب");
    const inv = {
      ...order,
      id: nextId(state.invoices),
      paidAmount: order.total,
      remainingAmount: 0,
      transferredFrom: order.id,
      createdAt: new Date().toISOString(),
    };
    state.invoices.unshift(inv);
    order.items.forEach((line) => {
      state.items = state.items.map((x) => (x.id === line.id ? { ...x, qty: Math.max(0, Number(x.qty) - Number(line.qty)) } : x));
    });
    order.status = "transferred";
    saveState();
    toast("تم تحويل الطلب لفاتورة");
    render();
  }

  function renderPurchaseRequests() {
    const rows = state.purchaseRequests.map((r) => `
      <tr>
        <td>#${r.id}</td>
        <td>${escapeHtml(r.supplier || "-")}</td>
        <td>${escapeHtml(r.date)}</td>
        <td>${money(r.total)}</td>
        <td><span class="badge ${r.status === "transferred" ? "green" : "yellow"}">${r.status === "transferred" ? "تم التحويل" : "معلق"}</span></td>
        <td class="actions-cell">
          ${r.status !== "transferred" ? `<button class="primary-button" data-action="requests-transfer" data-id="${r.id}">تحويل لمشتريات</button>` : ""}
          <button class="danger-button" data-action="requests-delete" data-id="${r.id}">حذف</button>
        </td>
      </tr>`);
    return `
      ${hero("طلبات الشراء", "Requests", "طلبات الشراء قبل اعتمادها.")}
      <div class="toolbar"><button class="primary-button" data-action="requests-add">+ طلب شراء</button></div>
      ${table(["رقم", "المورد", "التاريخ", "الإجمالي", "الحالة", "إجراءات"], rows)}
    `;
  }

  function openRequestModal() {
    const itemOptions = state.items.map((i) => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join("");
    openModal("طلب شراء جديد", `
      <div class="form-grid">
        ${field("المورد", "supplier", "")}
        ${field("التاريخ", "date", formatDate(new Date()), "date")}
        <label class="field full"><span>المنتج</span><select name="itemId">${itemOptions}</select></label>
        ${field("الكمية", "qty", "1", "number", 'min="1"')}
        ${field("التكلفة", "cost", "0", "number", 'min="0" step="0.01"')}
      </div>
    `, (fd) => {
      const item = state.items.find((x) => x.id === fd.get("itemId"));
      const qty = Number(fd.get("qty")) || 0;
      const cost = Number(fd.get("cost")) || 0;
      if (!item) return toast("اختر منتجاً");
      state.purchaseRequests.unshift({
        id: nextId(state.purchaseRequests),
        supplier: fd.get("supplier").trim() || "مورد",
        date: formatDate(new Date(fd.get("date") || new Date())),
        items: [{ id: item.id, name: item.name, qty, cost }],
        total: qty * cost,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      saveState();
      toast("تم حفظ طلب الشراء");
      render();
    });
  }

  function transferRequestToPurchase(id) {
    const request = state.purchaseRequests.find((x) => x.id === id);
    if (!request || request.status === "transferred") return;
    const purchase = {
      ...request,
      id: nextId(state.purchases),
      status: "completed",
      transferredFrom: request.id,
      paidAmount: request.total,
      remainingAmount: 0,
      createdAt: new Date().toISOString(),
    };
    state.purchases.unshift(purchase);
    request.items.forEach((line) => {
      const item = state.items.find((x) => x.id === line.id);
      if (!item) return;
      const oldQty = Number(item.qty) || 0;
      const oldCost = Number(item.purchasePrice) || 0;
      const newQty = oldQty + Number(line.qty);
      const cost = Number(line.cost) || 0;
      const avg = newQty > 0 ? (oldQty * oldCost + Number(line.qty) * cost) / newQty : cost;
      state.items = state.items.map((x) => (x.id === item.id ? { ...x, qty: newQty, purchasePrice: avg } : x));
    });
    request.status = "transferred";
    saveState();
    toast("تم تحويل الطلب لمشتريات");
    render();
  }

  function renderReports() {
    const totalSales = state.invoices.reduce((a, i) => a + Number(i.total || 0), 0);
    const totalPurchases = state.purchases.reduce((a, p) => a + Number(p.total || 0), 0);
    const totalExpenses = state.expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
    const totalProfit = state.invoices.reduce((a, i) => a + calcInvoiceProfit(i), 0);
    const topItems = {};
    state.invoices.forEach((inv) => {
      (inv.items || []).forEach((line) => {
        topItems[line.name] = (topItems[line.name] || 0) + Number(line.qty || 0);
      });
    });
    const topRows = Object.entries(topItems)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, qty]) => `<tr><td>${escapeHtml(name)}</td><td>${qty}</td></tr>`);

    return `
      ${hero("التقارير", "Reports", "ملخص الأداء والمبيعات.")}
      <div class="grid stats-grid">
        ${statCard("المبيعات", totalSales, "↗", "blue")}
        ${statCard("المشتريات", totalPurchases, "💳", "yellow")}
        ${statCard("المصروفات", totalExpenses, "↘", "red")}
        ${statCard("الأرباح", totalProfit, "◎", "accent")}
      </div>
      <div class="card card-pad">
        <div class="panel-head"><h3>أكثر المنتجات مبيعاً</h3></div>
        ${table(["المنتج", "الكمية المباعة"], topRows, "لا توجد مبيعات بعد")}
      </div>
    `;
  }

  function renderProfits() {
    const gross = state.invoices.reduce((a, i) => a + calcInvoiceProfit(i), 0);
    const expenses = state.expenses.reduce((a, e) => a + Number(e.amount || 0), 0);
    const net = gross - (state.settings.deductExpensesFromProfits ? expenses : 0);
    return `
      ${hero("تحليل الأرباح", "Profits", "متابعة هامش الربح الصافي.")}
      <div class="card card-pad">
        <div class="summary-row"><span>إجمالي أرباح المبيعات</span><strong>${money(gross)}</strong></div>
        <div class="summary-row"><span>إجمالي المصروفات</span><strong>${money(expenses)}</strong></div>
        <div class="summary-row"><span>الربح الصافي</span><strong style="color:#6366f1">${money(net)}</strong></div>
        <label style="display:flex;align-items:center;gap:10px;margin-top:18px;font-weight:900">
          <input type="checkbox" id="deductExpenses" ${state.settings.deductExpensesFromProfits ? "checked" : ""} />
          خصم المصروفات من الأرباح
        </label>
      </div>
    `;
  }

  function renderSettings() {
    const c = state.companyInfo;
    return `
      ${hero("الإعدادات", "Settings", "بيانات المحل والنسخ الاحتياطي.")}
      <div class="card card-pad">
        <div class="panel-head"><h3>بيانات المؤسسة</h3><button class="primary-button" data-action="settings-save">حفظ</button></div>
        <div class="form-grid" id="companyForm">
          ${field("اسم المحل", "name", c.name)}
          ${field("الهاتف", "phone", c.phone)}
          ${field("العنوان", "address", c.address, "textarea")}
          ${field("تذييل الفاتورة", "footer", c.footer, "textarea")}
        </div>
      </div>
      <div class="grid two-grid">
        <div class="card card-pad">
          <h3>نسخ احتياطي</h3>
          <p style="color:var(--muted);font-weight:700">احفظ نسخة من بياناتك أو استعدها.</p>
          <div class="toolbar-actions" style="margin-top:16px">
            <button class="secondary-button" data-action="settings-export">تصدير JSON</button>
            <button class="secondary-button" data-action="settings-import">استيراد JSON</button>
            <input type="file" id="importFile" accept="application/json" hidden />
          </div>
        </div>
        <div class="card card-pad">
          <h3>منطقة الخطر</h3>
          <p style="color:var(--muted);font-weight:700">مسح كل البيانات المحلية.</p>
          <button class="danger-button" style="margin-top:16px" data-action="settings-clear">مسح البيانات</button>
        </div>
      </div>
    `;
  }

  function saveCompanyInfo() {
    const form = $("#companyForm");
    state.companyInfo = {
      ...state.companyInfo,
      name: form.querySelector('[name="name"]').value.trim(),
      phone: form.querySelector('[name="phone"]').value.trim(),
      address: form.querySelector('[name="address"]').value.trim(),
      footer: form.querySelector('[name="footer"]').value.trim(),
    };
    saveState();
    toast("تم حفظ بيانات المؤسسة");
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nexus-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("تم تصدير النسخة الاحتياطية");
  }

  function clearAllData() {
    if (!confirm("سيتم حذف جميع البيانات المحلية. هل أنت متأكد؟")) return;
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("nexus_demo_seeded");
    state = defaultState();
    saveState();
    toast("تم مسح البيانات");
    render();
  }

  function handleQuickAdd() {
    const map = {
      dashboard: null,
      inventory: () => openInventoryModal(),
      sales: () => openInvoiceModal(),
      customer_orders: () => openOrderModal(),
      purchases: () => openPurchaseModal(),
      purchase_requests: () => openRequestModal(),
      expenses: () => openExpenseModal(),
      debts: () => openDebtModal(),
      directory: () => openDirectoryModal(),
    };
    (map[activeView] || (() => openInventoryModal()))();
  }

  function init() {
    if (localStorage.getItem("nexus_theme") === "dark") document.body.classList.add("dark");

    els.menuToggle.addEventListener("click", () => els.sidebar.classList.toggle("open"));
    els.themeToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark");
      localStorage.setItem("nexus_theme", document.body.classList.contains("dark") ? "dark" : "light");
    });
    els.quickAdd.addEventListener("click", handleQuickAdd);

    els.modalForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const submitter = e.submitter;
      if (submitter?.value === "cancel") {
        closeModal();
        return;
      }
      if (modalHandler) {
        const fd = new FormData(els.modalForm);
        modalHandler(fd);
        closeModal();
      }
    });

    document.addEventListener("change", async (e) => {
      if (e.target?.id !== "importFile") return;
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        state = { ...defaultState(), ...JSON.parse(text) };
        saveState();
        toast("تم استيراد البيانات");
        render();
      } catch (_) {
        toast("ملف غير صالح");
      }
      e.target.value = "";
    });

    window.addEventListener("resize", () => {
      if (activeView === "dashboard") drawDashboardCharts();
    });

    render();
  }

  init();
})();
