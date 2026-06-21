// =====================================================
// NEXUS ERP SYSTEM - VANILLA JAVASCRIPT
// =====================================================
// Complete ERP system without any GEMINI API integration

// =====================================================
// GLOBAL DATA STATE
// =====================================================
let appState = {
    items: [],
    invoices: [],
    purchases: [],
    expenses: [],
    customers: [],
    suppliers: [],
    debts: [],
    trash: [],
    companyInfo: {},
    settings: {
        deductExpensesFromProfits: false
    },
    isLoggedIn: false,
    currentUser: null
};

let charts = {
    salesChart: null,
    profitChart: null
};

// =====================================================
// INITIALIZATION
// =====================================================
document.addEventListener('DOMContentLoaded', function() {
    loadDataFromStorage();
    attachEventListeners();
    initDarkMode();
    setupKeyboardShortcuts();
    renderDashboard();
    updateAllViews();
});

function attachEventListeners() {
    // Sidebar navigation
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', function() {
            const viewId = this.getAttribute('data-view');
            switchView(viewId);
        });
    });

    // Menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarClose = document.getElementById('sidebarClose');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (sidebarOverlay) sidebarOverlay.classList.toggle('open');
    });

    sidebarClose.addEventListener('click', () => {
        closeSidebar();
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        renderDashboard();
        updateAllViews();
        // Check for pending/credit transactions
        const pendingInvoices = appState.invoices.filter(inv => inv.paymentType === 'credit' && (inv.remainingAmount || 0) > 0).length;
        const pendingPurchases = appState.purchases.filter(p => p.paymentType === 'credit' && (p.remainingAmount || 0) > 0).length;
        let msg = 'تم تحديث البيانات بنجاح';
        if (pendingInvoices > 0 || pendingPurchases > 0) {
            msg += ` | يوجد ${pendingInvoices + pendingPurchases} معاملة معلقة`;
        }
        showNotification(msg, pendingInvoices > 0 || pendingPurchases > 0 ? 'warning' : 'success');
    });

    // Logout button (if exists)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);
}

// =====================================================
// LOCAL STORAGE MANAGEMENT
// =====================================================
function loadDataFromStorage() {
    const saved = localStorage.getItem('nexusErpData');
    if (saved) {
        try {
            appState = JSON.parse(saved);
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }

    // Load company info
    const companyInfo = localStorage.getItem('nexusCompanyInfo');
    if (companyInfo) {
        appState.companyInfo = JSON.parse(companyInfo);
    }

    // Load settings
    const settings = localStorage.getItem('nexusSettings');
    if (settings) {
        appState.settings = JSON.parse(settings);
    }

    // Migration: old debts with name → link to customers
    appState.debts.forEach(debt => {
        if (!debt.customerId && debt.name) {
            // Find or create customer by name
            let customer = appState.customers.find(c => c.name === debt.name);
            if (!customer) {
                customer = {
                    id: 'cust-' + Date.now() + Math.random().toString(36).slice(2, 6),
                    name: debt.name,
                    phone: '',
                    address: '',
                    balance: 0,
                    createdAt: new Date().toISOString()
                };
                appState.customers.push(customer);
            }
            debt.customerId = customer.id;
            delete debt.name;
        }
    });

    // Load user
    const user = localStorage.getItem('nexusUser');
    if (user) {
        appState.currentUser = JSON.parse(user);
        appState.isLoggedIn = true;
        document.getElementById('userEmail').textContent = appState.currentUser.email || 'ضيف';
    }
}

function saveDataToStorage() {
    localStorage.setItem('nexusErpData', JSON.stringify(appState));
}

function saveSettings() {
    appState.companyInfo.name = document.getElementById('companyName').value;
    appState.companyInfo.phone = document.getElementById('companyPhone').value;
    appState.companyInfo.address = document.getElementById('companyAddress').value;
    appState.companyInfo.footer = document.getElementById('invoiceFooter').value;
    
    appState.settings.deductExpensesFromProfits = document.getElementById('deductExpenses').checked;

    localStorage.setItem('nexusCompanyInfo', JSON.stringify(appState.companyInfo));
    localStorage.setItem('nexusSettings', JSON.stringify(appState.settings));
    saveDataToStorage();

    showNotification('تم حفظ الإعدادات بنجاح', 'success');
}

// =====================================================
// SIDEBAR
// =====================================================
function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

// =====================================================
// VIEW SWITCHING
// =====================================================
function switchView(viewId) {
    closeSidebar();
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Remove active class from sidebar items
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
    });

    // Show selected view
    const view = document.getElementById(viewId);
    if (view) {
        view.classList.add('active');
        
        // Mark sidebar item as active
        const sidebarItem = document.querySelector(`[data-view="${viewId}"]`);
        if (sidebarItem) {
            sidebarItem.classList.add('active');
        }

        // Render view-specific content
        if (viewId === 'dashboard') {
            renderDashboard();
        } else if (viewId === 'inventory') {
            renderInventory();
        } else if (viewId === 'sales') {
            renderSales();
        } else if (viewId === 'purchases') {
            renderPurchases();
        } else if (viewId === 'expenses') {
            renderExpenses();
        } else if (viewId === 'debts') {
            renderDebts();
        } else if (viewId === 'profits') {
            renderProfits();
        } else if (viewId === 'directory') {
            renderDirectory();
        } else if (viewId === 'reports') {
            renderReports();
        } else if (viewId === 'settings') {
            renderSettings();
        } else if (viewId === 'trash') {
            renderTrash();
        }

        // Close sidebar
        closeSidebar();
    }
}

// =====================================================
// DASHBOARD RENDERING
// =====================================================
function renderDashboard() {
    // Calculate totals
    const totalSales = appState.invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    const stockValue = appState.items.reduce((sum, item) => sum + ((Number(item.qty) || 0) * (Number(item.purchasePrice) || 0)), 0);
    const totalExpenses = appState.expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    const totalGrossProfit = appState.invoices.reduce((sum, inv) => sum + calculateInvoiceProfit(inv), 0);
    const netProfit = totalGrossProfit - (appState.settings.deductExpensesFromProfits ? totalExpenses : 0);

    // Update stat cards
    document.getElementById('totalSales').textContent = totalSales.toLocaleString('ar-EG');
    document.getElementById('stockValue').textContent = stockValue.toLocaleString('ar-EG');
    document.getElementById('totalExpenses').textContent = totalExpenses.toLocaleString('ar-EG');
    document.getElementById('netProfit').textContent = netProfit.toLocaleString('ar-EG');

    // Low stock warnings
    const lowStockItems = appState.items.filter(item => (Number(item.qty) || 0) <= (Number(item.minQty) || 0));
    const dashboardContainer = document.querySelector('#dashboard .stats-grid');
    let warningEl = document.getElementById('lowStockWarning');
    if (!warningEl) {
        warningEl = document.createElement('div');
        warningEl.id = 'lowStockWarning';
        warningEl.className = 'low-stock-warning';
        dashboardContainer.parentNode.insertBefore(warningEl, dashboardContainer.nextSibling);
    }
    if (lowStockItems.length > 0) {
        warningEl.innerHTML = '⚠️ <span>تنبيه المخزون!</span> يوجد ' + lowStockItems.length + ' صنف' + (lowStockItems.length > 1 ? 'اً' : '') + ' تحت الحد الأدنى: ' +
            lowStockItems.slice(0, 5).map(i => i.name).join('، ') +
            (lowStockItems.length > 5 ? ' وأكثر...' : '');
        warningEl.style.display = 'flex';
    } else {
        warningEl.style.display = 'none';
    }

    // Render charts
    renderCharts();
}

function calculateInvoiceProfit(inv) {
    if (!inv || !inv.items) return 0;
    const itemsProfit = (inv.items || []).reduce((acc, item) => {
        const purchasePrice = Number(item.purchasePrice) || 0;
        const salePrice = Number(item.price) || 0;
        const qty = Number(item.qty) || 0;
        return acc + ((salePrice - purchasePrice) * qty);
    }, 0);
    return itemsProfit - (Number(inv.discount) || 0);
}

function renderCharts() {
    const chartData = getLast7DaysData();

    // Sales Chart
    const salesCtx = document.getElementById('salesChart');
    if (salesCtx) {
        if (charts.salesChart) {
            charts.salesChart.destroy();
        }
        charts.salesChart = new Chart(salesCtx, {
            type: 'line',
            data: {
                labels: chartData.map(d => d.date),
                datasets: [
                    {
                        label: 'المبيعات',
                        data: chartData.map(d => d.sales),
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'المشتريات',
                        data: chartData.map(d => d.purchases),
                        borderColor: '#F97316',
                        backgroundColor: 'rgba(249, 115, 22, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: "'Cairo', sans-serif" }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Profit Chart
    const profitCtx = document.getElementById('profitChart');
    if (profitCtx) {
        if (charts.profitChart) {
            charts.profitChart.destroy();
        }
        charts.profitChart = new Chart(profitCtx, {
            type: 'line',
            data: {
                labels: chartData.map(d => d.date),
                datasets: [
                    {
                        label: 'الأرباح',
                        data: chartData.map(d => d.profit),
                        borderColor: '#22C55E',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'المصروفات',
                        data: chartData.map(d => d.expenses),
                        borderColor: '#F87171',
                        backgroundColor: 'rgba(248, 113, 113, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            font: { family: "'Cairo', sans-serif" }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
}

function getLast7DaysData() {
    const data = [];
    const today = new Date();
    const days = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const formattedDate = d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'numeric' });
        const dayName = days[d.getDay()];

        const daySales = appState.invoices
            .filter(inv => isSameDay(parseDate(inv.date), d))
            .reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);

        const dayProfit = appState.invoices
            .filter(inv => isSameDay(parseDate(inv.date), d))
            .reduce((sum, inv) => sum + calculateInvoiceProfit(inv), 0);

        const dayExpenses = appState.expenses
            .filter(exp => isSameDay(parseDate(exp.date), d))
            .reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

        const dayPurchases = appState.purchases
            .filter(p => isSameDay(parseDate(p.date), d))
            .reduce((sum, p) => sum + (Number(p.total) || 0), 0);

        data.push({
            date: `${dayName} ${formattedDate}`,
            sales: daySales,
            profit: dayProfit,
            expenses: dayExpenses,
            purchases: dayPurchases
        });
    }

    return data;
}

function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const westernDigits = String(dateStr).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
    const parts = westernDigits.split(/[/.-]/);
    
    if (parts.length === 3) {
        const d = parseInt(parts[0]);
        const m = parseInt(parts[1]);
        const y = parseInt(parts[2]);
        
        if (y > 1000 && d <= 31) {
            return new Date(y, m - 1, d);
        }
        if (d > 1000) {
            return new Date(d, m - 1, y);
        }
    }
    
    const dateObj = new Date(westernDigits);
    return isNaN(dateObj.getTime()) ? new Date(0) : dateObj;
}

function isSameDay(d1, d2) {
    return d1.getDate() === d2.getDate() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getFullYear() === d2.getFullYear();
}

// =====================================================
// INVENTORY RENDERING
// =====================================================
function renderInventory() {
    const tbody = document.getElementById('inventoryTable');
    
    if (appState.items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">لا توجد أصناف</td></tr>';
        return;
    }

    const searchText = (document.getElementById('inventorySearch')?.value || '').toLowerCase();
    const categoryFilter = document.getElementById('inventoryCategoryFilter')?.value || '';

    const filteredIndices = appState.items.reduce((acc, item, idx) => {
        if (categoryFilter && item.category !== categoryFilter) return acc;
        if (searchText) {
            const haystack = (item.name + (item.category || '') + String(item.purchasePrice || '') + String(item.price || '')).toLowerCase();
            if (!haystack.includes(searchText)) return acc;
        }
        acc.push(idx);
        return acc;
    }, []);

    if (filteredIndices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">لا توجد نتائج</td></tr>';
        return;
    }

    tbody.innerHTML = filteredIndices.map(idx => {
        const item = appState.items[idx];
        const totalValue = (Number(item.qty) || 0) * (Number(item.purchasePrice) || 0);
        const isLowStock = (Number(item.qty) || 0) <= (Number(item.minQty) || 0);
        return `
            <tr class="${isLowStock ? 'low-stock' : ''}">
                <td>${item.name}</td>
                <td>${item.category || '-'}</td>
                <td>${Number(item.qty).toLocaleString('ar-EG')}</td>
                <td>${Number(item.minQty || 5).toLocaleString('ar-EG')}</td>
                <td>${Number(item.purchasePrice).toLocaleString('ar-EG')}</td>
                <td>${Number(item.price).toLocaleString('ar-EG')}</td>
                <td>${totalValue.toLocaleString('ar-EG')}</td>
                <td>
                    <div class="action-menu-container">
                        <button class="action-menu-btn" onclick="showActionMenu(${idx}, 'inventory')">⋮</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showAddItemForm() {
    showModal('إضافة صنف جديد', 'item');
}

let selectedDebtType = 'اعطيت';

function selectDebtType(type) {
    selectedDebtType = type;
    document.getElementById('debtType').value = type;
    document.querySelectorAll('.debt-type-btns .btn-type').forEach(b => b.classList.remove('active'));
    document.getElementById(type === 'اعطيت' ? 'debtTypeGive' : 'debtTypeTake').classList.add('active');
}

function showModal(title, formType) {
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalForm = document.getElementById('modalForm');

    modalTitle.textContent = title;
    selectedDebtType = 'اعطيت';

    let formHTML = '';

    if (formType === 'item') {
        formHTML = `
            <div class="form-group">
                <label>اسم الصنف</label>
                <input type="text" id="itemName" class="form-input" placeholder="اسم الصنف">
            </div>
            <div class="form-group">
                <label>التصنيف</label>
                <select id="itemCategory" class="form-input">
                    <option value="">بدون تصنيف</option>
                    <option value="مواد خام">مواد خام</option>
                    <option value="منتج نهائي">منتج نهائي</option>
                    <option value="مستلزمات">مستلزمات</option>
                    <option value="الكترونيات">الكترونيات</option>
                    <option value="ملابس">ملابس</option>
                    <option value="مواد غذائية">مواد غذائية</option>
                    <option value="منظفات">منظفات</option>
                    <option value="قرطاسية">قرطاسية</option>
                    <option value="غير ذلك">غير ذلك</option>
                </select>
            </div>
            <div class="form-group">
                <label>الكمية</label>
                <input type="number" id="itemQty" class="form-input" placeholder="0">
            </div>
            <div class="form-group">
                <label>الحد الأدنى للتنبيه</label>
                <input type="number" id="itemMinQty" class="form-input" placeholder="5" value="5">
            </div>
            <div class="form-group">
                <label>سعر الشراء</label>
                <input type="number" id="itemPurchasePrice" class="form-input" placeholder="0">
            </div>
            <div class="form-group">
                <label>سعر البيع</label>
                <input type="number" id="itemPrice" class="form-input" placeholder="0">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">إلغاء</button>
                <button type="button" class="btn-primary" onclick="saveItem()">حفظ</button>
            </div>
        `;
    } else if (formType === 'invoice') {
        formHTML = `
            <div class="form-group">
                <label>تاريخ الفاتورة</label>
                <input type="date" id="invoiceDate" class="form-input">
            </div>
            <div class="form-group">
                <label>اسم العميل</label>
                <input type="text" id="customerName" class="form-input" placeholder="اسم العميل">
            </div>
            <div class="form-group">
                <label>الإجمالي</label>
                <input type="number" id="invoiceTotal" class="form-input" placeholder="0">
            </div>
            <div class="form-group">
                <label>الخصم</label>
                <input type="number" id="invoiceDiscount" class="form-input" placeholder="0">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">إلغاء</button>
                <button type="button" class="btn-primary" onclick="saveInvoice()">حفظ</button>
            </div>
        `;
    } else if (formType === 'purchase') {
        formHTML = `
            <div class="form-group">
                <label>تاريخ الشراء</label>
                <input type="date" id="purchaseDate" class="form-input">
            </div>
            <div class="form-group">
                <label>اسم المورد</label>
                <input type="text" id="supplierName" class="form-input" placeholder="اسم المورد">
            </div>
            <div class="form-group">
                <label>الإجمالي</label>
                <input type="number" id="purchaseTotal" class="form-input" placeholder="0">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">إلغاء</button>
                <button type="button" class="btn-primary" onclick="savePurchase()">حفظ</button>
            </div>
        `;
    } else if (formType === 'expense') {
        formHTML = `
            <div class="form-group">
                <label>وصف المصروف</label>
                <input type="text" id="expenseTitle" class="form-input" placeholder="وصف المصروف">
            </div>
            <div class="form-group">
                <label>الفئة</label>
                <input type="text" id="expenseCategory" class="form-input" placeholder="الفئة">
            </div>
            <div class="form-group">
                <label>المبلغ</label>
                <input type="number" id="expenseAmount" class="form-input" placeholder="0">
            </div>
            <div class="form-group">
                <label>التاريخ</label>
                <input type="date" id="expenseDate" class="form-input">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">إلغاء</button>
                <button type="button" class="btn-primary" onclick="saveExpense()">حفظ</button>
            </div>
        `;
    } else if (formType === 'debt') {
        formHTML = `
            <div class="form-group" id="debtNameGroup">
                <label>العميل</label>
                <input type="text" id="debtName" class="form-input" value="${selectedDebtCustomerId ? (appState.customers.find(c => c.id === selectedDebtCustomerId)?.name || '') : ''}" readonly style="background:#F3F4F6;">
            </div>
            <div class="form-group">
                <label>النوع</label>
                <div class="debt-type-btns">
                    <button type="button" id="debtTypeGive" class="btn-type ${selectedDebtType === 'اعطيت' ? 'active' : ''}" onclick="selectDebtType('اعطيت')">💸 اعطيت</button>
                    <button type="button" id="debtTypeTake" class="btn-type ${selectedDebtType === 'اخذت' ? 'active' : ''}" onclick="selectDebtType('اخذت')">💰 اخذت</button>
                </div>
                <input type="hidden" id="debtType" value="${selectedDebtType || 'اعطيت'}">
            </div>
            <div class="form-group">
                <label>المبلغ</label>
                <input type="number" id="debtAmount" class="form-input" placeholder="0">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">إلغاء</button>
                <button type="button" class="btn-primary" onclick="saveDebt()">حفظ</button>
            </div>
        `;
    } else if (formType === 'customer') {
        formHTML = `
            <div class="form-group">
                <label>اسم العميل</label>
                <input type="text" id="custName" class="form-input" placeholder="اسم العميل">
            </div>
            <div class="form-group">
                <label>الهاتف</label>
                <input type="tel" id="custPhone" class="form-input" placeholder="رقم الهاتف">
            </div>
            <div class="form-group">
                <label>العنوان</label>
                <input type="text" id="custAddress" class="form-input" placeholder="العنوان">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">إلغاء</button>
                <button type="button" class="btn-primary" onclick="saveCustomer()">حفظ</button>
            </div>
        `;
    } else if (formType === 'supplier') {
        formHTML = `
            <div class="form-group">
                <label>اسم المورد</label>
                <input type="text" id="suppName" class="form-input" placeholder="اسم المورد">
            </div>
            <div class="form-group">
                <label>الهاتف</label>
                <input type="tel" id="suppPhone" class="form-input" placeholder="رقم الهاتف">
            </div>
            <div class="form-group">
                <label>العنوان</label>
                <input type="text" id="suppAddress" class="form-input" placeholder="العنوان">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" onclick="closeModal()">إلغاء</button>
                <button type="button" class="btn-primary" onclick="saveSupplier()">حفظ</button>
            </div>
        `;
    }

    modalForm.innerHTML = formHTML;
    modal.style.display = 'flex';

    // Set today's date for date inputs
    const dateInputs = modalForm.querySelectorAll('input[type="date"]');
    const today = new Date().toISOString().split('T')[0];
    dateInputs.forEach(input => {
        input.value = today;
    });
}

function closeModal() {
    document.getElementById('modal').style.display = 'none';
}

function saveItem() {
    const item = {
        id: Date.now().toString(),
        name: document.getElementById('itemName').value,
        category: document.getElementById('itemCategory').value,
        qty: Number(document.getElementById('itemQty').value),
        minQty: Number(document.getElementById('itemMinQty').value) || 5,
        purchasePrice: Number(document.getElementById('itemPurchasePrice').value),
        price: Number(document.getElementById('itemPrice').value),
        createdAt: new Date().toISOString()
    };

    if (!item.name) {
        showNotification('اسم الصنف مطلوب', 'error');
        return;
    }

    appState.items.push(item);
    saveDataToStorage();
    closeModal();
    renderInventory();
    showNotification('تم إضافة الصنف بنجاح', 'success');
}

function deleteItem(index) {
    const item = appState.items.splice(index, 1)[0];
    appState.trash.push({ type: 'صنف', data: item, deletedAt: new Date().toISOString() });
    saveDataToStorage();
    renderInventory();
    showNotification('تم نقل الصنف إلى سلة المحذوفات', 'success');
}

function editItem(index) {
    const item = appState.items[index];
    showModal('تعديل الصنف', 'item');
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category || '';
    document.getElementById('itemQty').value = item.qty || 0;
    document.getElementById('itemMinQty').value = item.minQty || 5;
    document.getElementById('itemPurchasePrice').value = item.purchasePrice || 0;
    document.getElementById('itemPrice').value = item.price || 0;
    const saveBtn = document.querySelector('#modalForm .btn-primary');
    saveBtn.textContent = 'تحديث';
    saveBtn.onclick = function() {
        item.name = document.getElementById('itemName').value;
        item.category = document.getElementById('itemCategory').value;
        item.qty = Number(document.getElementById('itemQty').value);
        item.minQty = Number(document.getElementById('itemMinQty').value) || 5;
        item.purchasePrice = Number(document.getElementById('itemPurchasePrice').value);
        item.price = Number(document.getElementById('itemPrice').value);
        if (!item.name) { showNotification('اسم الصنف مطلوب', 'error'); return; }
        saveDataToStorage();
        closeModal();
        renderInventory();
        showNotification('تم تحديث الصنف', 'success');
    };
}

// =====================================================
// SALES RENDERING
// =====================================================
function renderSales() {
    const tbody = document.getElementById('salesTable');
    
    if (appState.invoices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا توجد فواتير</td></tr>';
        return;
    }

    const searchText = (document.getElementById('salesSearch')?.value || '').toLowerCase();
    const filteredIndices = appState.invoices.reduce((acc, inv, idx) => {
        if (searchText) {
            const haystack = ((inv.id || '') + (inv.customerName || '') + (inv.date || '') + String(inv.total || '')).toLowerCase();
            if (!haystack.includes(searchText)) return acc;
        }
        acc.push(idx);
        return acc;
    }, []);

    if (filteredIndices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">لا توجد نتائج</td></tr>';
        return;
    }

    tbody.innerHTML = filteredIndices.map(idx => {
        const inv = appState.invoices[idx];
        const finalTotal = (Number(inv.total) || 0) - (Number(inv.discount) || 0);
        const paymentIcon = inv.paymentType === 'credit' ? '📝' : '💰';
        const paymentLabel = inv.paymentType === 'credit' ? ' (اجل)' : ' (نقد)';
        return `
            <tr>
                <td>${inv.id || idx + 1}</td>
                <td>${inv.date}</td>
                <td>${(inv.customerName || '-') + ' ' + paymentIcon + paymentLabel}</td>
                <td>${Number(inv.total || 0).toLocaleString('ar-EG')}</td>
                <td>${Number(inv.discount || 0).toLocaleString('ar-EG')}</td>
                <td>${finalTotal.toLocaleString('ar-EG')}</td>
                <td>
                    <div class="action-menu-container">
                        <button class="action-menu-btn" onclick="showActionMenu(${idx}, 'sales')">⋮</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showAddInvoiceForm() {
    showModal('إضافة فاتورة جديدة', 'invoice');
}

function saveInvoice() {
    const invoice = {
        id: `INV-${Date.now()}`,
        date: document.getElementById('invoiceDate').value,
        customerName: document.getElementById('customerName').value,
        total: Number(document.getElementById('invoiceTotal').value),
        discount: Number(document.getElementById('invoiceDiscount').value),
        items: [],
        createdAt: new Date().toISOString()
    };

    if (invoice.total === 0) {
        showNotification('الإجمالي مطلوب', 'error');
        return;
    }

    appState.invoices.push(invoice);
    saveDataToStorage();
    closeModal();
    renderSales();
    renderDashboard();
    showNotification('تم إضافة الفاتورة بنجاح', 'success');
}

function deleteInvoice(index) {
    const item = appState.invoices.splice(index, 1)[0];
    appState.trash.push({ type: 'فاتورة', data: item, deletedAt: new Date().toISOString() });
    saveDataToStorage();
    renderSales();
    renderDashboard();
    showNotification('تم نقل الفاتورة إلى سلة المحذوفات', 'success');
}

function editInvoice(index) {
    const inv = appState.invoices[index];
    editingInvoiceIndex = index;
    switchSalesTab('form');
    document.getElementById('newSalesDate').value = inv.date;
    document.getElementById('newSalesCustomer').value = inv.customerName || '';
    document.getElementById('salesDiscountPercent').value = inv.discountPercent || 0;
    currentSalesInvoice = {
        items: (inv.items || []).map(item => ({ ...item })),
        paymentType: inv.paymentType || 'cash'
    };
    renderSalesItems();
    updateSalesTotal();
    // Restore payment type
    const paymentType = inv.paymentType || 'cash';
    setSalesPayment(paymentType);
    if (paymentType === 'credit') {
        document.getElementById('salesPaidAmount').value = inv.paidAmount || 0;
        updateSalesRemaining();
    }
    showNotification('يمكنك تعديل الفاتورة الآن', 'success');
}

// =====================================================
// PURCHASES RENDERING
// =====================================================
function renderPurchases() {
    const tbody = document.getElementById('purchasesTable');
    
    if (appState.purchases.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">لا توجد مشتريات</td></tr>';
        return;
    }

    const searchText = (document.getElementById('purchasesSearch')?.value || '').toLowerCase();
    const filteredIndices = appState.purchases.reduce((acc, p, idx) => {
        if (searchText) {
            const haystack = ((p.id || '') + (p.supplierName || '') + (p.date || '') + String(p.total || '')).toLowerCase();
            if (!haystack.includes(searchText)) return acc;
        }
        acc.push(idx);
        return acc;
    }, []);

    if (filteredIndices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">لا توجد نتائج</td></tr>';
        return;
    }

    tbody.innerHTML = filteredIndices.map(idx => {
        const purchase = appState.purchases[idx];
        const paymentIcon = purchase.paymentType === 'credit' ? '📝' : '💰';
        const paymentLabel = purchase.paymentType === 'credit' ? ' (اجل)' : ' (نقد)';
        return `
            <tr>
                <td>${purchase.id || idx + 1}</td>
                <td>${purchase.date}</td>
                <td>${(purchase.supplierName || '-') + ' ' + paymentIcon + paymentLabel}</td>
                <td>${Number(purchase.total || 0).toLocaleString('ar-EG')}</td>
                <td>
                    <div class="action-menu-container">
                        <button class="action-menu-btn" onclick="showActionMenu(${idx}, 'purchases')">⋮</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showAddPurchaseForm() {
    showModal('إضافة عملية شراء جديدة', 'purchase');
}

function savePurchase() {
    const purchase = {
        id: `PUR-${Date.now()}`,
        date: document.getElementById('purchaseDate').value,
        supplierName: document.getElementById('supplierName').value,
        total: Number(document.getElementById('purchaseTotal').value),
        createdAt: new Date().toISOString()
    };

    if (purchase.total === 0) {
        showNotification('الإجمالي مطلوب', 'error');
        return;
    }

    appState.purchases.push(purchase);
    saveDataToStorage();
    closeModal();
    renderPurchases();
    renderDashboard();
    showNotification('تم إضافة عملية الشراء بنجاح', 'success');
}

function deletePurchase(index) {
    const item = appState.purchases.splice(index, 1)[0];
    appState.trash.push({ type: 'شراء', data: item, deletedAt: new Date().toISOString() });
    saveDataToStorage();
    renderPurchases();
    renderDashboard();
    showNotification('تم نقل العملية إلى سلة المحذوفات', 'success');
}

function editPurchase(index) {
    const pur = appState.purchases[index];
    editingPurchaseIndex = index;
    switchPurchasesTab('form');
    document.getElementById('newPurchaseDate').value = pur.date;
    document.getElementById('newPurchaseSupplier').value = pur.supplierName || '';
    document.getElementById('purchasesDiscountPercent').value = pur.discountPercent || 0;
    document.getElementById('purchasesNotes').value = pur.notes || '';
    currentPurchaseOrder = {
        items: (pur.items || []).map(item => ({ ...item })),
        paymentType: pur.paymentType || 'cash'
    };
    renderPurchasesItems();
    updatePurchasesTotal();
    // Restore payment type
    const paymentType = pur.paymentType || 'cash';
    setPurchasesPayment(paymentType);
    if (paymentType === 'credit') {
        document.getElementById('purchasesPaidAmount').value = pur.paidAmount || 0;
        updatePurchasesRemaining();
    }
    showNotification('يمكنك تعديل عملية الشراء الآن', 'success');
}

// =====================================================
// EXPENSES RENDERING
// =====================================================
function renderExpenses() {
    const tbody = document.getElementById('expensesTable');
    
    if (appState.expenses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد مصروفات</td></tr>';
        return;
    }

    const searchText = (document.getElementById('expensesSearch')?.value || '').toLowerCase();
    const filteredIndices = appState.expenses.reduce((acc, exp, idx) => {
        if (searchText) {
            const haystack = ((exp.title || '') + (exp.category || '') + (exp.date || '') + String(exp.amount || '')).toLowerCase();
            if (!haystack.includes(searchText)) return acc;
        }
        acc.push(idx);
        return acc;
    }, []);

    if (filteredIndices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد نتائج</td></tr>';
        return;
    }

    tbody.innerHTML = filteredIndices.map(idx => {
        const expense = appState.expenses[idx];
        return `
            <tr>
                <td>${expense.title}</td>
                <td>${expense.category}</td>
                <td>${Number(expense.amount || 0).toLocaleString('ar-EG')}</td>
                <td>${expense.date}</td>
                <td>
                    <div class="action-menu-container">
                        <button class="action-menu-btn" onclick="showActionMenu(${idx}, 'expenses')">⋮</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showAddExpenseForm() {
    showModal('إضافة مصروف جديد', 'expense');
}

function saveExpense() {
    const expense = {
        id: Date.now().toString(),
        title: document.getElementById('expenseTitle').value,
        category: document.getElementById('expenseCategory').value,
        amount: Number(document.getElementById('expenseAmount').value),
        date: document.getElementById('expenseDate').value,
        createdAt: new Date().toISOString()
    };

    if (!expense.title || expense.amount === 0) {
        showNotification('الوصف والمبلغ مطلوبان', 'error');
        return;
    }

    appState.expenses.push(expense);
    saveDataToStorage();
    closeModal();
    renderExpenses();
    renderDashboard();
    showNotification('تم إضافة المصروف بنجاح', 'success');
}

function deleteExpense(index) {
    const item = appState.expenses.splice(index, 1)[0];
    appState.trash.push({ type: 'مصروف', data: item, deletedAt: new Date().toISOString() });
    saveDataToStorage();
    renderExpenses();
    renderDashboard();
    showNotification('تم نقل المصروف إلى سلة المحذوفات', 'success');
}

function editExpense(index) {
    const exp = appState.expenses[index];
    showModal('تعديل المصروف', 'expense');
    document.getElementById('expenseTitle').value = exp.title;
    document.getElementById('expenseCategory').value = exp.category || '';
    document.getElementById('expenseAmount').value = exp.amount || 0;
    document.getElementById('expenseDate').value = exp.date;
    const saveBtn = document.querySelector('#modalForm .btn-primary');
    saveBtn.textContent = 'تحديث';
    saveBtn.onclick = function() {
        exp.title = document.getElementById('expenseTitle').value;
        exp.category = document.getElementById('expenseCategory').value;
        exp.amount = Number(document.getElementById('expenseAmount').value);
        exp.date = document.getElementById('expenseDate').value;
        saveDataToStorage();
        closeModal();
        renderExpenses();
        renderDashboard();
        showNotification('تم تحديث المصروف', 'success');
    };
}

// =====================================================
// DEBTS RENDERING
// =====================================================
let selectedDebtCustomerId = null;
let filteredDebtIndices = [];

function renderDebts() {
    selectedDebtCustomerId = null;
    document.getElementById('debtsCustomerList').style.display = 'block';
    document.getElementById('debtsCustomerDetail').style.display = 'none';
    document.getElementById('debtsViewTitle').textContent = 'الديون';
    document.getElementById('debtsAddBtn').style.display = 'inline-block';

    const tbody = document.getElementById('debtsCustomerTable');
    const customers = appState.customers;

    if (customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">لا توجد عملاء. قم بإضافة عملاء من شاشة الدليل أولاً</td></tr>';
        return;
    }

    // Calculate balance for each customer from debts
    const customerBalances = {};
    appState.debts.forEach(debt => {
        const cid = debt.customerId || 'unknown';
        if (!customerBalances[cid]) {
            customerBalances[cid] = 0;
        }
        if (debt.type === 'اعطيت') {
            customerBalances[cid] -= Number(debt.amount || 0);
        } else {
            customerBalances[cid] += Number(debt.amount || 0);
        }
    });

    const searchText = (document.getElementById('debtsCustomerSearch')?.value || '').toLowerCase();
    const filteredIndices = customers.reduce((acc, c, idx) => {
        if (searchText) {
            const haystack = ((c.name || '') + (c.phone || '')).toLowerCase();
            if (!haystack.includes(searchText)) return acc;
        }
        acc.push(idx);
        return acc;
    }, []);

    if (filteredIndices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">لا توجد نتائج</td></tr>';
        return;
    }

    tbody.innerHTML = filteredIndices.map(idx => {
        const customer = customers[idx];
        const balance = customerBalances[customer.id] || 0;
        const balanceClass = balance > 0 ? 'debt-positive' : (balance < 0 ? 'debt-negative' : '');
        const balanceLabel = balance > 0 ? `⚖️ له ${balance.toLocaleString('ar-EG')}` : (balance < 0 ? `⚖️ عليه ${Math.abs(balance).toLocaleString('ar-EG')}` : '⚖️ 0');
        return `
            <tr onclick="showDebtCustomer('${customer.id}')" style="cursor:pointer;">
                <td>${customer.name}</td>
                <td>${customer.phone || '-'}</td>
                <td class="${balanceClass}">${balanceLabel}</td>
                <td>
                    <div class="action-menu-container">
                        <button class="action-menu-btn" onclick="event.stopPropagation();showActionMenu(${idx}, 'debtCustomer')">⋮</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showDebtCustomer(customerId) {
    selectedDebtCustomerId = customerId;
    const customer = appState.customers.find(c => c.id === customerId);
    if (!customer) return;

    document.getElementById('debtsCustomerList').style.display = 'none';
    document.getElementById('debtsCustomerDetail').style.display = 'block';
    document.getElementById('debtsViewTitle').textContent = `ديون ${customer.name}`;
    document.getElementById('debtsAddBtn').style.display = 'inline-block';

    // Filter debts for this customer
    const custDebts = appState.debts.filter(d => d.customerId === customerId);
    filteredDebtIndices = custDebts.map(d => appState.debts.indexOf(d));

    // Calculate totals
    let totalGave = 0, totalTook = 0;
    custDebts.forEach(d => {
        if (d.type === 'اعطيت') totalGave += Number(d.amount || 0);
        else totalTook += Number(d.amount || 0);
    });
    const balance = totalTook - totalGave;

    document.getElementById('debtTotalGave').textContent = totalGave.toLocaleString('ar-EG');
    document.getElementById('debtTotalTook').textContent = totalTook.toLocaleString('ar-EG');

    const balanceEl = document.getElementById('debtBalanceValue');
    const balanceBar = document.getElementById('debtBalanceBar');
    if (balance > 0) {
        balanceEl.textContent = `لك ${balance.toLocaleString('ar-EG')}`;
        balanceBar.style.background = '#FEE2E2';
        balanceEl.style.color = '#DC2626';
    } else if (balance < 0) {
        balanceEl.textContent = `عليك ${Math.abs(balance).toLocaleString('ar-EG')}`;
        balanceBar.style.background = '#D1FAE5';
        balanceEl.style.color = '#059669';
    } else {
        balanceEl.textContent = '0 (متساوي)';
        balanceBar.style.background = '#F3F4F6';
        balanceEl.style.color = '#6B7280';
    }

    // Render transactions
    const tbody = document.getElementById('debtsDetailTable');
    if (custDebts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">لا توجد معاملات لهذا العميل</td></tr>';
        return;
    }

    tbody.innerHTML = custDebts.map((debt, fi) => {
        const typeLabel = debt.type === 'اخذت' ? '💰 اخذت' : '💸 اعطيت';
        const typeClass = debt.type === 'اخذت' ? 'debt-took-text' : 'debt-gave-text';
        const date = debt.createdAt ? new Date(debt.createdAt).toLocaleDateString('ar-EG') : '-';
        return `
            <tr>
                <td class="${typeClass}">${typeLabel}</td>
                <td class="${typeClass}">${Number(debt.amount || 0).toLocaleString('ar-EG')}</td>
                <td>${date}</td>
                <td>
                    <div class="action-menu-container">
                        <button class="action-menu-btn" onclick="showActionMenu(${fi}, 'debtTransaction')">⋮</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showAddDebtForm() {
    if (!selectedDebtCustomerId) {
        showNotification('الرجاء اختيار عميل أولاً', 'error');
        return;
    }
    showModal('إضافة معاملة دين', 'debt');
}

function saveDebt() {
    if (!selectedDebtCustomerId) {
        showNotification('الرجاء اختيار عميل أولاً', 'error');
        return;
    }
    const debt = {
        id: Date.now().toString(),
        customerId: selectedDebtCustomerId,
        type: document.getElementById('debtType').value,
        amount: Number(document.getElementById('debtAmount').value),
        createdAt: new Date().toISOString()
    };

    if (!debt.amount || debt.amount === 0) {
        showNotification('المبلغ مطلوب', 'error');
        return;
    }

    appState.debts.push(debt);
    saveDataToStorage();
    closeModal();
    showDebtCustomer(selectedDebtCustomerId);
    showNotification('تم إضافة المعاملة بنجاح', 'success');
}

function deleteDebtTransaction(filteredIndex) {
    const globalIndex = filteredDebtIndices[filteredIndex];
    if (globalIndex === undefined) return;
    const item = appState.debts.splice(globalIndex, 1)[0];
    appState.trash.push({ type: 'دين', data: item, deletedAt: new Date().toISOString() });
    saveDataToStorage();
    showDebtCustomer(selectedDebtCustomerId);
    showNotification('تم نقل المعاملة إلى سلة المحذوفات', 'success');
}

function editDebtTransaction(filteredIndex) {
    const globalIndex = filteredDebtIndices[filteredIndex];
    if (globalIndex === undefined) return;
    const d = appState.debts[globalIndex];
    showModal('تعديل المعاملة', 'debt');
    // Override the type after showModal resets it
    selectedDebtType = d.type || 'اعطيت';
    document.getElementById('debtType').value = d.type;
    document.querySelectorAll('.debt-type-btns .btn-type').forEach(b => b.classList.remove('active'));
    const btnId = d.type === 'اخذت' ? 'debtTypeTake' : 'debtTypeGive';
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');
    document.getElementById('debtAmount').value = d.amount || 0;
    // Hide the name field since we're using customer
    const nameGroup = document.getElementById('debtName').closest('.form-group');
    if (nameGroup) nameGroup.style.display = 'none';
    const saveBtn = document.querySelector('#modalForm .btn-primary');
    saveBtn.textContent = 'تحديث';
    saveBtn.onclick = function() {
        d.type = document.getElementById('debtType').value;
        d.amount = Number(document.getElementById('debtAmount').value);
        saveDataToStorage();
        closeModal();
        showDebtCustomer(selectedDebtCustomerId);
        showNotification('تم تحديث المعاملة', 'success');
    };
}

// =====================================================
// PROFITS RENDERING
// =====================================================
function renderProfits() {
    const totalSales = appState.invoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    const totalExpenses = appState.expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
    const grossProfit = appState.invoices.reduce((sum, inv) => sum + calculateInvoiceProfit(inv), 0);
    const netProfit = grossProfit - (appState.settings.deductExpensesFromProfits ? totalExpenses : 0);
    const profitRatio = totalSales > 0 ? ((grossProfit / totalSales) * 100).toFixed(2) : 0;

    document.getElementById('grossProfit').textContent = grossProfit.toLocaleString('ar-EG');
    document.getElementById('finalProfit').textContent = netProfit.toLocaleString('ar-EG');
    document.getElementById('profitRatio').textContent = `${profitRatio}%`;
}

// =====================================================
// DIRECTORY RENDERING
// =====================================================
function switchDirectoryTab(tab) {
    const customersTab = document.getElementById('customersTab');
    const suppliersTab = document.getElementById('suppliersTab');

    if (tab === 'customers') {
        customersTab.style.display = 'block';
        suppliersTab.style.display = 'none';
        renderCustomers();
    } else {
        customersTab.style.display = 'none';
        suppliersTab.style.display = 'block';
        renderSuppliers();
    }
}

function renderDirectory() {
    renderCustomers();
}

function renderCustomers() {
    const tbody = document.getElementById('customersTable');
    
    if (appState.customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد عملاء</td></tr>';
        return;
    }

    const searchText = (document.getElementById('customersSearch')?.value || '').toLowerCase();
    const filteredIndices = appState.customers.reduce((acc, c, idx) => {
        if (searchText) {
            const haystack = ((c.name || '') + (c.phone || '') + (c.address || '')).toLowerCase();
            if (!haystack.includes(searchText)) return acc;
        }
        acc.push(idx);
        return acc;
    }, []);

    if (filteredIndices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد نتائج</td></tr>';
        return;
    }

    tbody.innerHTML = filteredIndices.map(idx => {
        const customer = appState.customers[idx];
        return `
            <tr>
                <td>${customer.name}</td>
                <td>${customer.phone}</td>
                <td>${customer.address}</td>
                <td>${Number(customer.balance || 0).toLocaleString('ar-EG')}</td>
                <td>
                    <div class="action-menu-container">
                        <button class="action-menu-btn" onclick="showActionMenu(${idx}, 'customers')">⋮</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showAddCustomerForm() {
    showModal('إضافة عميل جديد', 'customer');
}

function renderSuppliers() {
    const tbody = document.getElementById('suppliersTable');
    
    if (appState.suppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد موردون</td></tr>';
        return;
    }

    const searchText = (document.getElementById('suppliersSearch')?.value || '').toLowerCase();
    const filteredIndices = appState.suppliers.reduce((acc, s, idx) => {
        if (searchText) {
            const haystack = ((s.name || '') + (s.phone || '') + (s.address || '')).toLowerCase();
            if (!haystack.includes(searchText)) return acc;
        }
        acc.push(idx);
        return acc;
    }, []);

    if (filteredIndices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">لا توجد نتائج</td></tr>';
        return;
    }

    tbody.innerHTML = filteredIndices.map(idx => {
        const supplier = appState.suppliers[idx];
        return `
            <tr>
                <td>${supplier.name}</td>
                <td>${supplier.phone}</td>
                <td>${supplier.address}</td>
                <td>${Number(supplier.balance || 0).toLocaleString('ar-EG')}</td>
                <td>
                    <div class="action-menu-container">
                        <button class="action-menu-btn" onclick="showActionMenu(${idx}, 'suppliers')">⋮</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function showAddCustomerForm() {
    showModal('إضافة عميل جديد', 'customer');
}

function saveCustomer() {
    const customer = {
        id: Date.now().toString(),
        name: document.getElementById('custName').value,
        phone: document.getElementById('custPhone').value,
        address: document.getElementById('custAddress').value,
        balance: 0,
        createdAt: new Date().toISOString()
    };

    if (!customer.name) {
        showNotification('اسم العميل مطلوب', 'error');
        return;
    }

    appState.customers.push(customer);
    saveDataToStorage();
    closeModal();
    renderCustomers();
    showNotification('تم إضافة العميل بنجاح', 'success');
}

function deleteCustomer(index) {
    const item = appState.customers.splice(index, 1)[0];
    appState.trash.push({ type: 'عميل', data: item, deletedAt: new Date().toISOString() });
    saveDataToStorage();
    renderCustomers();
    showNotification('تم نقل العميل إلى سلة المحذوفات', 'success');
}

function editCustomer(index) {
    const c = appState.customers[index];
    showModal('تعديل العميل', 'customer');
    document.getElementById('custName').value = c.name;
    document.getElementById('custPhone').value = c.phone || '';
    document.getElementById('custAddress').value = c.address || '';
    const saveBtn = document.querySelector('#modalForm .btn-primary');
    saveBtn.textContent = 'تحديث';
    saveBtn.onclick = function() {
        c.name = document.getElementById('custName').value;
        c.phone = document.getElementById('custPhone').value;
        c.address = document.getElementById('custAddress').value;
        saveDataToStorage();
        closeModal();
        renderCustomers();
        showNotification('تم تحديث العميل', 'success');
    };
}

function showAddSupplierForm() {
    showModal('إضافة مورد جديد', 'supplier');
}

function saveSupplier() {
    const supplier = {
        id: Date.now().toString(),
        name: document.getElementById('suppName').value,
        phone: document.getElementById('suppPhone').value,
        address: document.getElementById('suppAddress').value,
        balance: 0,
        createdAt: new Date().toISOString()
    };

    if (!supplier.name) {
        showNotification('اسم المورد مطلوب', 'error');
        return;
    }

    appState.suppliers.push(supplier);
    saveDataToStorage();
    closeModal();
    renderSuppliers();
    showNotification('تم إضافة المورد بنجاح', 'success');
}

function deleteSupplier(index) {
    const item = appState.suppliers.splice(index, 1)[0];
    appState.trash.push({ type: 'مورد', data: item, deletedAt: new Date().toISOString() });
    saveDataToStorage();
    renderSuppliers();
    showNotification('تم نقل المورد إلى سلة المحذوفات', 'success');
}

function editSupplier(index) {
    const s = appState.suppliers[index];
    showModal('تعديل المورد', 'supplier');
    document.getElementById('suppName').value = s.name;
    document.getElementById('suppPhone').value = s.phone || '';
    document.getElementById('suppAddress').value = s.address || '';
    const saveBtn = document.querySelector('#modalForm .btn-primary');
    saveBtn.textContent = 'تحديث';
    saveBtn.onclick = function() {
        s.name = document.getElementById('suppName').value;
        s.phone = document.getElementById('suppPhone').value;
        s.address = document.getElementById('suppAddress').value;
        saveDataToStorage();
        closeModal();
        renderSuppliers();
        showNotification('تم تحديث المورد', 'success');
    };
}

// =====================================================
// REPORTS RENDERING
// =====================================================
function renderReports() {
    const dateFrom = document.getElementById('reportDateFrom')?.value;
    const dateTo = document.getElementById('reportDateTo')?.value;

    const filterByDate = (items, dateField = 'date') => {
        if (!dateFrom && !dateTo) return items;
        return items.filter(item => {
            const itemDate = item[dateField] || '';
            if (dateFrom && itemDate < dateFrom) return false;
            if (dateTo && itemDate > dateTo) return false;
            return true;
        });
    };

    const filteredInvoices = filterByDate(appState.invoices);
    const filteredPurchases = filterByDate(appState.purchases);
    const filteredExpenses = filterByDate(appState.expenses);

    const totalSales = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.total) || 0), 0);
    const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (Number(p.total) || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    
    // Find top product
    const itemsMap = {};
    appState.items.forEach(item => {
        itemsMap[item.id] = item;
    });
    
    let topProductName = '-';
    let topProductQty = 0;
    appState.items.forEach(item => {
        if ((Number(item.qty) || 0) > topProductQty) {
            topProductQty = Number(item.qty) || 0;
            topProductName = item.name;
        }
    });

    // Find top customer from filtered invoices
    const customersMap = {};
    filteredInvoices.forEach(inv => {
        if (!customersMap[inv.customerName]) {
            customersMap[inv.customerName] = 0;
        }
        customersMap[inv.customerName] += Number(inv.total) || 0;
    });

    let topCustomerName = '-';
    let topCustomerValue = 0;
    for (const [name, value] of Object.entries(customersMap)) {
        if (value > topCustomerValue) {
            topCustomerValue = value;
            topCustomerName = name;
        }
    }

    document.getElementById('salesSummary').textContent = totalSales.toLocaleString('ar-EG');
    document.getElementById('purchasesSummary').textContent = totalPurchases.toLocaleString('ar-EG');
    document.getElementById('topProduct').textContent = topProductName;
    document.getElementById('topCustomer').textContent = topCustomerName;

    // Reports Charts with date filter
    window._reportDateFrom = dateFrom;
    window._reportDateTo = dateTo;
    renderReportsCharts();
}

function renderReportsCharts() {
    const dateFrom = window._reportDateFrom;
    const dateTo = window._reportDateTo;

    const filterByDate = (items, dateField = 'date') => {
        if (!dateFrom && !dateTo) return items;
        return items.filter(item => {
            const itemDate = item[dateField] || '';
            if (dateFrom && itemDate < dateFrom) return false;
            if (dateTo && itemDate > dateTo) return false;
            return true;
        });
    };

    // Build date range data for bar chart (use actual filtered data grouped by day)
    const filteredInvoices = filterByDate(appState.invoices);
    const filteredPurchases = filterByDate(appState.purchases);

    // Group by date
    const dateMap = {};
    filteredInvoices.forEach(inv => {
        const d = inv.date || 'unknown';
        if (!dateMap[d]) dateMap[d] = { sales: 0, purchases: 0 };
        dateMap[d].sales += Number(inv.total || 0);
    });
    filteredPurchases.forEach(p => {
        const d = p.date || 'unknown';
        if (!dateMap[d]) dateMap[d] = { sales: 0, purchases: 0 };
        dateMap[d].purchases += Number(p.total || 0);
    });

    const sortedDates = Object.keys(dateMap).sort();
    const labels = sortedDates;
    const salesData = sortedDates.map(d => dateMap[d].sales);
    const purchasesData = sortedDates.map(d => dateMap[d].purchases);

    // Sales vs Purchases bar chart
    const salesCtx = document.getElementById('reportsSalesChart');
    if (salesCtx && typeof Chart !== 'undefined') {
        if (window.reportsSalesChart) window.reportsSalesChart.destroy();
        window.reportsSalesChart = new Chart(salesCtx, {
            type: 'bar',
            data: {
                labels: labels.length > 0 ? labels : ['لا توجد بيانات'],
                datasets: [
                    { label: 'المبيعات', data: salesData.length > 0 ? salesData : [0], backgroundColor: '#6366F1', borderRadius: 4 },
                    { label: 'المشتريات', data: purchasesData.length > 0 ? purchasesData : [0], backgroundColor: '#F97316', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: true,
                plugins: { legend: { position: 'top', labels: { font: { size: 10 } } } },
                scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } } }
            }
        });
    }

    // Expenses pie/doughnut chart with date filter
    const expCtx = document.getElementById('reportsExpensesChart');
    if (expCtx && typeof Chart !== 'undefined') {
        const filteredExpenses = filterByDate(appState.expenses);
        const categories = {};
        filteredExpenses.forEach(e => {
            const cat = e.category || 'أخرى';
            categories[cat] = (categories[cat] || 0) + Number(e.amount || 0);
        });
        const labels = Object.keys(categories);
        const data = Object.values(categories);
        if (window.reportsExpensesChart) window.reportsExpensesChart.destroy();
        if (labels.length === 0) {
            window.reportsExpensesChart = new Chart(expCtx, {
                type: 'doughnut',
                data: { labels: ['لا توجد بيانات'], datasets: [{ data: [1], backgroundColor: ['#E2E8F0'] }] },
                options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } } }
            });
        } else {
            const colors = ['#6366F1','#10B981','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#EC4899','#14B8A6'];
            window.reportsExpensesChart = new Chart(expCtx, {
                type: 'doughnut',
                data: { labels: labels, datasets: [{ data: data, backgroundColor: colors.slice(0, labels.length) }] },
                options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } } }
            });
        }
    }
}

// =====================================================
// SETTINGS RENDERING
// =====================================================
function renderSettings() {
    document.getElementById('companyName').value = appState.companyInfo.name || '';
    document.getElementById('companyPhone').value = appState.companyInfo.phone || '';
    document.getElementById('companyAddress').value = appState.companyInfo.address || '';
    document.getElementById('invoiceFooter').value = appState.companyInfo.footer || '';
    document.getElementById('deductExpenses').checked = appState.settings.deductExpensesFromProfits || false;
}

// =====================================================
// DATA MANAGEMENT
// =====================================================
function exportData() {
    const dataToExport = {
        items: appState.items,
        invoices: appState.invoices,
        purchases: appState.purchases,
        expenses: appState.expenses,
        customers: appState.customers,
        suppliers: appState.suppliers,
        debts: appState.debts,
        trash: appState.trash,
        companyInfo: appState.companyInfo,
        settings: appState.settings,
        exportDate: new Date().toISOString()
    };

    const dataStr = JSON.stringify(dataToExport, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nexus-erp-backup-${new Date().getTime()}.json`;
    link.click();
    
    showNotification('تم تصدير البيانات بنجاح', 'success');
}

function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Merge or replace data
                if (confirm('هل تريد استبدال جميع البيانات الحالية؟')) {
                    appState = { ...appState, ...importedData };
                } else {
                    // Merge data
                    appState.items = [...appState.items, ...(importedData.items || [])];
                    appState.invoices = [...appState.invoices, ...(importedData.invoices || [])];
                    appState.purchases = [...appState.purchases, ...(importedData.purchases || [])];
                    appState.expenses = [...appState.expenses, ...(importedData.expenses || [])];
                    appState.customers = [...appState.customers, ...(importedData.customers || [])];
                    appState.suppliers = [...appState.suppliers, ...(importedData.suppliers || [])];
                    appState.debts = [...appState.debts, ...(importedData.debts || [])];
                    appState.trash = [...appState.trash, ...(importedData.trash || [])];
                }

                saveDataToStorage();
                updateAllViews();
                showNotification('تم استيراد البيانات بنجاح', 'success');
            } catch (error) {
                showNotification('خطأ في استيراد البيانات', 'error');
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

function clearAllData() {
    if (confirm('هل أنت متأكد من حذف جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.')) {
        appState = {
            items: [],
            invoices: [],
            purchases: [],
            expenses: [],
            customers: [],
            suppliers: [],
            debts: [],
            trash: [],
            companyInfo: {},
            settings: { deductExpensesFromProfits: false },
            isLoggedIn: false,
            currentUser: null
        };
        
        localStorage.removeItem('nexusErpData');
        localStorage.removeItem('nexusCompanyInfo');
        localStorage.removeItem('nexusSettings');
        
        updateAllViews();
        showNotification('تم حذف جميع البيانات', 'success');
    }
}

// =====================================================
// TRASH / RECYCLE BIN
// =====================================================
function renderTrash() {
    const tbody = document.getElementById('trashTable');
    if (appState.trash.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">سلة المحذوفات فارغة</td></tr>';
        return;
    }

    const searchText = (document.getElementById('trashSearch')?.value || '').toLowerCase();
    const filteredIndices = appState.trash.reduce((acc, item, idx) => {
        if (searchText) {
            const haystack = ((item.type || '') + (item.data.name || item.data.title || item.data.customerName || item.data.supplierName || item.data.id || '')).toLowerCase();
            if (!haystack.includes(searchText)) return acc;
        }
        acc.push(idx);
        return acc;
    }, []);

    if (filteredIndices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">لا توجد نتائج</td></tr>';
        return;
    }

    tbody.innerHTML = filteredIndices.map(idx => {
        const item = appState.trash[idx];
        return `
            <tr>
                <td>${item.type}</td>
                <td>${item.data.name || item.data.title || item.data.customerName || item.data.supplierName || item.data.id || '-'}</td>
                <td>${new Date(item.deletedAt).toLocaleDateString('ar-EG')}</td>
                <td>
                    <button class="btn-secondary" onclick="restoreFromTrash(${idx})" style="width: auto; display: inline-block; margin: 0 0 0.25rem 0; padding: 0.5rem 1rem; font-size:0.85rem;">استرجاع</button>
                    <button class="btn-danger" onclick="permanentDelete(${idx})" style="width: auto; display: inline-block; margin: 0; padding: 0.5rem 1rem; font-size:0.85rem;">حذف نهائي</button>
                </td>
            </tr>
        `;
    }).join('');
}

function restoreFromTrash(index) {
    const item = appState.trash.splice(index, 1)[0];
    const typeMap = {
        'فاتورة': 'invoices',
        'شراء': 'purchases',
        'مصروف': 'expenses',
        'دين': 'debts',
        'عميل': 'customers',
        'مورد': 'suppliers',
        'صنف': 'items'
    };
    const key = typeMap[item.type];
    if (key && appState[key]) {
        appState[key].push(item.data);
    }
    saveDataToStorage();
    renderTrash();
    showNotification('تم استرجاع العنصر بنجاح', 'success');
}

function permanentDelete(index) {
    if (confirm('هل أنت متأكد من حذف هذا العنصر نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) {
        appState.trash.splice(index, 1);
        saveDataToStorage();
        renderTrash();
        showNotification('تم الحذف النهائي', 'success');
    }
}

function emptyTrash() {
    if (confirm('هل أنت متأكد من إفراغ سلة المحذوفات بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) {
        appState.trash = [];
        saveDataToStorage();
        renderTrash();
        showNotification('تم إفراغ سلة المحذوفات', 'success');
    }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
function updateAllViews() {
    renderInventory();
    renderSales();
    renderPurchases();
    renderExpenses();
    renderDebts();
    renderTrash();
    renderProfits();
    renderDirectory();
    renderReports();
    renderDashboard();
}

// =====================================================
// 3-DOT ACTION MENU
// =====================================================
// FLOATING ACTION MENU
// =====================================================
function showActionMenu(index, type) {
    const overlay = document.getElementById('actionMenuOverlay');
    const container = document.getElementById('actionMenuItems');

    const actions = {
        inventory: [
            { label: '✏️ تعديل', class: 'menu-edit', onclick: `editItem(${index})` },
            { label: '🗑️ حذف', class: 'menu-delete', onclick: `deleteItem(${index})` }
        ],
        sales: [
            { label: '✏️ تعديل', class: 'menu-edit', onclick: `editInvoice(${index})` },
            { label: '🖨️ طباعة', class: 'menu-print', onclick: `printInvoice(${index})` },
            { label: '📡 بلوتوث', class: 'menu-print', onclick: `printBluetooth(${index})` },
            { label: '💬 واتساب', class: 'menu-whatsapp', onclick: `shareInvoiceOnWhatsApp(${index})` },
            { label: '🔄 مرتجع', class: 'menu-print', onclick: `returnInvoice(${index})` },
            { label: '🗑️ حذف', class: 'menu-delete', onclick: `deleteInvoice(${index})` }
        ],
        purchases: [
            { label: '✏️ تعديل', class: 'menu-edit', onclick: `editPurchase(${index})` },
            { label: '🔄 مرتجع', class: 'menu-print', onclick: `returnPurchase(${index})` },
            { label: '🗑️ حذف', class: 'menu-delete', onclick: `deletePurchase(${index})` }
        ],
        expenses: [
            { label: '✏️ تعديل', class: 'menu-edit', onclick: `editExpense(${index})` },
            { label: '🗑️ حذف', class: 'menu-delete', onclick: `deleteExpense(${index})` }
        ],
        debts: [
            { label: '✏️ تعديل', class: 'menu-edit', onclick: `editDebt(${index})` },
            { label: '🗑️ حذف', class: 'menu-delete', onclick: `deleteDebt(${index})` }
        ],
        debtCustomer: [
            { label: '📋 عرض المعاملات', class: 'menu-edit', onclick: `showDebtCustomer(appState.customers[${index}]?.id)` },
            { label: '🗑️ حذف العميل', class: 'menu-delete', onclick: `deleteCustomer(${index})` }
        ],
        debtTransaction: [
            { label: '✏️ تعديل', class: 'menu-edit', onclick: `editDebtTransaction(${index})` },
            { label: '🗑️ حذف', class: 'menu-delete', onclick: `deleteDebtTransaction(${index})` }
        ],
        customers: [
            { label: '✏️ تعديل', class: 'menu-edit', onclick: `editCustomer(${index})` },
            { label: '🗑️ حذف', class: 'menu-delete', onclick: `deleteCustomer(${index})` }
        ],
        suppliers: [
            { label: '✏️ تعديل', class: 'menu-edit', onclick: `editSupplier(${index})` },
            { label: '🗑️ حذف', class: 'menu-delete', onclick: `deleteSupplier(${index})` }
        ]
    };

    const items = actions[type] || [];
    container.innerHTML = items.map(a =>
        `<button class="action-menu-popup-item ${a.class}" onclick="${a.onclick}; closeActionMenu()">
            ${a.label}
        </button>`
    ).join('');

    overlay.classList.add('open');
}

function closeActionMenu() {
    const overlay = document.getElementById('actionMenuOverlay');
    if (overlay) overlay.classList.remove('open');
}

// =====================================================
// PAYMENT TYPE (CASH / CREDIT)
// =====================================================
function setSalesPayment(type) {
    document.getElementById('salesPaymentCash').classList.toggle('active', type === 'cash');
    document.getElementById('salesPaymentCredit').classList.toggle('active', type === 'credit');
    document.getElementById('salesCreditFields').style.display = type === 'credit' ? 'block' : 'none';
    if (type === 'cash') document.getElementById('salesPaidAmount').value = '';
    currentSalesInvoice.paymentType = type;
}

function setPurchasesPayment(type) {
    document.getElementById('purchasesPaymentCash').classList.toggle('active', type === 'cash');
    document.getElementById('purchasesPaymentCredit').classList.toggle('active', type === 'credit');
    document.getElementById('purchasesCreditFields').style.display = type === 'credit' ? 'block' : 'none';
    if (type === 'cash') document.getElementById('purchasesPaidAmount').value = '';
    currentPurchaseOrder.paymentType = type;
}

function updateSalesRemaining() {
    const totalText = document.getElementById('salesTotal').textContent;
    const total = parseFloat(totalText.replace(/[^0-9.-]/g, '')) || 0;
    const paid = parseFloat(document.getElementById('salesPaidAmount').value) || 0;
    document.getElementById('salesRemainingAmount').textContent = Math.max(0, total - paid).toLocaleString('ar-EG');
}

function updatePurchasesRemaining() {
    const totalText = document.getElementById('purchasesTotal').textContent;
    const total = parseFloat(totalText.replace(/[^0-9.-]/g, '')) || 0;
    const paid = parseFloat(document.getElementById('purchasesPaidAmount').value) || 0;
    document.getElementById('purchasesRemainingAmount').textContent = Math.max(0, total - paid).toLocaleString('ar-EG');
}

// =====================================================
// SAVE AND PRINT
// =====================================================
function saveAndPrint() {
    saveSalesInvoice();
    // Print the last invoice
    if (appState.invoices.length > 0) {
        setTimeout(() => printInvoice(appState.invoices.length - 1), 500);
    }
}

function hideSearchIfOutside(inputId, resultsId) {
    const input = document.getElementById(inputId);
    const results = document.getElementById(resultsId);
    if (results && results.style.display !== 'none' && input && !event.target.closest('#' + inputId) && !event.target.closest('#' + resultsId)) {
        results.style.display = 'none';
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('nexusUser');
        appState.isLoggedIn = false;
        appState.currentUser = null;
        document.getElementById('userEmail').textContent = 'ضيف';
        showNotification('تم تسجيل الخروج', 'success');
    }
}

// Modal click outside to close
window.addEventListener('click', (event) => {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        closeModal();
    }
    // Hide search results when clicking outside
    hideSearchIfOutside('itemSearchInput', 'itemSearchResults');
    hideSearchIfOutside('purchaseItemSearchInput', 'purchaseItemSearchResults');
    hideSearchIfOutside('newSalesCustomer', 'customerSearchResults');
    hideSearchIfOutside('newPurchaseSupplier', 'supplierSearchResults');
});

// =====================================================
// ADVANCED SALES & PURCHASES FUNCTIONS
// =====================================================

// State for current invoice/purchase being built
let currentSalesInvoice = {
    items: [],
    paymentType: 'cash'
};
let editingInvoiceIndex = -1;

let currentPurchaseOrder = {
    items: [],
    paymentType: 'cash'
};
let editingPurchaseIndex = -1;

// SALES FUNCTIONS
function switchSalesTab(tab) {
    const listTab = document.getElementById('salesListTab');
    const formTab = document.getElementById('salesFormTab');
    const headerActions = document.getElementById('salesHeaderActions');

    if (tab === 'list') {
        listTab.style.display = 'block';
        formTab.style.display = 'none';
        if (headerActions) headerActions.style.display = 'flex';
        renderSales();
    } else {
        listTab.style.display = 'none';
        formTab.style.display = 'block';
        if (headerActions) headerActions.style.display = 'none';
        initializeSalesForm();
    }
}

function filterCustomers() {
    const input = document.getElementById('newSalesCustomer');
    const results = document.getElementById('customerSearchResults');
    const query = input.value.trim().toLowerCase();
    
    if (!query || appState.customers.length === 0) {
        results.style.display = 'none';
        return;
    }
    
    const filtered = appState.customers.filter(c => c.name.toLowerCase().includes(query));
    
    if (filtered.length === 0) {
        results.innerHTML = '<div class="search-result-item" style="color:var(--color-gray-500);">لا توجد نتائج</div>';
        results.style.display = 'block';
        return;
    }
    
    results.innerHTML = filtered.map(c => `
        <div class="search-result-item" onclick="selectCustomer('${c.name.replace(/'/g, "\\'")}')">
            <span class="search-result-name">${c.name}</span>
            <span class="search-result-qty">${c.phone || ''}</span>
        </div>
    `).join('');
    results.style.display = 'block';
}

function selectCustomer(name) {
    document.getElementById('newSalesCustomer').value = name;
    document.getElementById('customerSearchResults').style.display = 'none';
}

function filterSuppliers() {
    const input = document.getElementById('newPurchaseSupplier');
    const results = document.getElementById('supplierSearchResults');
    const query = input.value.trim().toLowerCase();
    
    if (!query || appState.suppliers.length === 0) {
        results.style.display = 'none';
        return;
    }
    
    const filtered = appState.suppliers.filter(s => s.name.toLowerCase().includes(query));
    
    if (filtered.length === 0) {
        results.innerHTML = '<div class="search-result-item" style="color:var(--color-gray-500);">لا توجد نتائج</div>';
        results.style.display = 'block';
        return;
    }
    
    results.innerHTML = filtered.map(s => `
        <div class="search-result-item" onclick="selectSupplier('${s.name.replace(/'/g, "\\'")}')">
            <span class="search-result-name">${s.name}</span>
            <span class="search-result-qty">${s.phone || ''}</span>
        </div>
    `).join('');
    results.style.display = 'block';
}

function selectSupplier(name) {
    document.getElementById('newPurchaseSupplier').value = name;
    document.getElementById('supplierSearchResults').style.display = 'none';
}

function initializeSalesForm() {
    // Reset current invoice
    currentSalesInvoice = { items: [], paymentType: 'cash' };
    editingInvoiceIndex = -1;
    
    // Reset payment type
    setSalesPayment('cash');
    document.getElementById('salesPaidAmount').value = '';
    document.getElementById('salesRemainingAmount').textContent = '0';

    // Set today's date
    document.getElementById('newSalesDate').valueAsDate = new Date();
    document.getElementById('newSalesCustomer').value = '';
    document.getElementById('itemSearchInput').value = '';
    document.getElementById('itemSearchResults').style.display = 'none';
    document.getElementById('customerSearchResults').style.display = 'none';
    document.getElementById('salesDiscountPercent').value = '0';
    
    // Clear items list
    document.getElementById('salesItemsList').innerHTML = '<p class="empty-state">لم تختر أصنافاً حتى الآن</p>';
    updateSalesTotal();
}

function filterItemsForSales() {
    const input = document.getElementById('itemSearchInput');
    const results = document.getElementById('itemSearchResults');
    const query = input.value.trim().toLowerCase();
    
    if (!query) {
        results.style.display = 'none';
        return;
    }
    
    const filtered = appState.items.filter(item =>
        item.name.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
        results.innerHTML = '<div class="search-result-item" style="color: var(--color-gray-500);">لا توجد نتائج</div>';
        results.style.display = 'block';
        return;
    }
    
    results.innerHTML = filtered.map((item, idx) => {
        const realIndex = appState.items.indexOf(item);
        return `
            <div class="search-result-item" onclick="addSearchItemToSales(${realIndex})">
                <span class="search-result-name">${item.name}</span>
                <span class="search-result-qty">متوفر: ${item.qty} | سعر: ${Number(item.price).toLocaleString('ar-EG')}</span>
            </div>
        `;
    }).join('');
    results.style.display = 'block';
}

function addSearchItemToSales(index) {
    const item = appState.items[index];
    
    const itemInvoice = currentSalesInvoice.items.find(i => i.itemId === index);
    
    if (!itemInvoice) {
        currentSalesInvoice.items.push({
            itemId: index,
            name: item.name,
            purchasePrice: item.purchasePrice,
            price: item.price,
            qty: 1,
            maxQty: item.qty
        });
    } else {
        itemInvoice.qty++;
    }
    
    document.getElementById('itemSearchInput').value = '';
    document.getElementById('itemSearchResults').style.display = 'none';
    renderSalesItems();
    updateSalesTotal();
}

function renderSalesItems() {
    const container = document.getElementById('salesItemsList');
    
    if (currentSalesInvoice.items.length === 0) {
        container.innerHTML = '<p class="empty-state">لم تختر أصنافاً حتى الآن</p>';
        return;
    }
    
    container.innerHTML = currentSalesInvoice.items.map((item, index) => `
        <div class="item-row">
            <div class="item-row-name" style="flex:1; font-weight:700; font-size:0.95rem;">${item.name}</div>
            <div class="item-row-qty" style="width:60px;">
                <input type="number" min="1" max="${item.maxQty}" value="${item.qty}" 
                    onchange="updateSalesItemQty(${index}, this.value)" style="text-align:center;">
            </div>
            <div class="item-row-price" style="width:80px;">
                <input type="number" min="0" step="0.01" value="${item.price}" 
                    onchange="updateSalesItemPrice(${index}, this.value)" 
                    style="width:100%; text-align:center;">
            </div>
            <div class="item-row-total" style="width:90px;">
                <input type="number" step="0.01" value="${(item.qty * item.price).toFixed(2)}" 
                    onchange="updateSalesItemTotal(${index}, this.value)" 
                    style="width:100%; text-align:center; font-weight:700;">
            </div>
            <button class="item-row-remove" onclick="removeSalesItem(${index})">حذف</button>
        </div>
    `).join('');
}

function updateSalesItemQty(index, qty) {
    const qtyNum = parseInt(qty);
    if (qtyNum > 0 && qtyNum <= currentSalesInvoice.items[index].maxQty) {
        currentSalesInvoice.items[index].qty = qtyNum;
    }
    renderSalesItems();
    updateSalesTotal();
}

function updateSalesItemPrice(index, price) {
    const priceNum = parseFloat(price);
    if (priceNum >= 0) {
        currentSalesInvoice.items[index].price = priceNum;
    }
    renderSalesItems();
    updateSalesTotal();
}

function updateSalesItemTotal(index, total) {
    const totalNum = parseFloat(total);
    const item = currentSalesInvoice.items[index];
    if (totalNum >= 0 && item.qty > 0) {
        item.price = totalNum / item.qty;
    }
    renderSalesItems();
    updateSalesTotal();
}

function removeSalesItem(index) {
    currentSalesInvoice.items.splice(index, 1);
    renderSalesItems();
    updateSalesTotal();
}

function updateSalesTotal() {
    const subtotal = currentSalesInvoice.items.reduce((sum, item) => {
        return sum + (item.qty * item.price);
    }, 0);
    
    const discountPercent = parseFloat(document.getElementById('salesDiscountPercent').value) || 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const total = subtotal - discountAmount;
    
    document.getElementById('salesSubtotal').textContent = subtotal.toLocaleString('ar-EG');
    document.getElementById('salesTotal').textContent = total.toLocaleString('ar-EG');
    updateSalesRemaining();
}

function saveSalesInvoice() {
    if (currentSalesInvoice.items.length === 0) {
        showNotification('يرجى اختيار أصنافاً واحداً على الأقل', 'error');
        return;
    }
    
    const date = document.getElementById('newSalesDate').value;
    const customerName = document.getElementById('newSalesCustomer').value || 'عميل بدون اسم';
    const discountPercent = parseFloat(document.getElementById('salesDiscountPercent').value) || 0;
    
    const subtotal = currentSalesInvoice.items.reduce((sum, item) => {
        return sum + (item.qty * item.price);
    }, 0);
    
    const discountAmount = (subtotal * discountPercent) / 100;
    const total = subtotal - discountAmount;
    
    const paymentType = currentSalesInvoice.paymentType || 'cash';
    const paidAmount = paymentType === 'credit' ? (parseFloat(document.getElementById('salesPaidAmount').value) || 0) : total;
    const remainingAmount = paymentType === 'credit' ? Math.max(0, total - paidAmount) : 0;

    if (editingInvoiceIndex >= 0) {
        // Update existing invoice
        const inv = appState.invoices[editingInvoiceIndex];
        inv.date = date;
        inv.customerName = customerName;
        inv.items = currentSalesInvoice.items;
        inv.subtotal = subtotal;
        inv.discountPercent = discountPercent;
        inv.discountAmount = discountAmount;
        inv.total = total;
        inv.paymentType = paymentType;
        inv.paidAmount = paidAmount;
        inv.remainingAmount = remainingAmount;
        editingInvoiceIndex = -1;
        saveDataToStorage();
        switchSalesTab('list');
        renderDashboard();
        showNotification('تم تحديث الفاتورة بنجاح', 'success');
        return;
    }
    
    const invoice = {
        id: `INV-${Date.now()}`,
        date: date,
        customerName: customerName,
        items: currentSalesInvoice.items,
        subtotal: subtotal,
        discountPercent: discountPercent,
        discountAmount: discountAmount,
        total: total,
        paymentType: paymentType,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        createdAt: new Date().toISOString()
    };
    
    appState.invoices.push(invoice);
    
    // Update inventory quantities
    currentSalesInvoice.items.forEach(item => {
        const inventoryItem = appState.items[item.itemId];
        if (inventoryItem) {
            inventoryItem.qty -= item.qty;
        }
    });
    
    saveDataToStorage();
    switchSalesTab('list');
    renderDashboard();
    showNotification('تم حفظ الفاتورة بنجاح', 'success');
}

// PURCHASES FUNCTIONS
function switchPurchasesTab(tab) {
    const listTab = document.getElementById('purchasesListTab');
    const formTab = document.getElementById('purchasesFormTab');
    const headerActions = document.getElementById('purchasesHeaderActions');

    if (tab === 'list') {
        listTab.style.display = 'block';
        formTab.style.display = 'none';
        if (headerActions) headerActions.style.display = 'flex';
        renderPurchases();
    } else {
        listTab.style.display = 'none';
        formTab.style.display = 'block';
        if (headerActions) headerActions.style.display = 'none';
        initializePurchasesForm();
    }
}

function initializePurchasesForm() {
    // Reset current purchase
    currentPurchaseOrder = { items: [], paymentType: 'cash' };
    editingPurchaseIndex = -1;
    
    // Reset payment type
    setPurchasesPayment('cash');
    document.getElementById('purchasesPaidAmount').value = '';
    document.getElementById('purchasesRemainingAmount').textContent = '0';

    // Set today's date
    document.getElementById('newPurchaseDate').valueAsDate = new Date();
    document.getElementById('newPurchaseSupplier').value = '';
    document.getElementById('purchaseItemSearchInput').value = '';
    document.getElementById('purchaseItemSearchResults').style.display = 'none';
    document.getElementById('supplierSearchResults').style.display = 'none';
    document.getElementById('purchasesDiscountPercent').value = '0';
    document.getElementById('purchasesNotes').value = '';
    
    // Clear items list
    document.getElementById('purchasesItemsList').innerHTML = '<p class="empty-state">لم تختر أصنافاً حتى الآن</p>';
    updatePurchasesTotal();
}

function filterItemsForPurchases() {
    const input = document.getElementById('purchaseItemSearchInput');
    const results = document.getElementById('purchaseItemSearchResults');
    const query = input.value.trim().toLowerCase();
    
    if (!query) {
        results.style.display = 'none';
        return;
    }
    
    const filtered = appState.items.filter(item =>
        item.name.toLowerCase().includes(query)
    );
    
    if (filtered.length === 0) {
        results.innerHTML = '<div class="search-result-item" style="color: var(--color-gray-500);">لا توجد نتائج</div>';
        results.style.display = 'block';
        return;
    }
    
    results.innerHTML = filtered.map((item, idx) => {
        const realIndex = appState.items.indexOf(item);
        return `
            <div class="search-result-item" onclick="addSearchItemToPurchase(${realIndex})">
                <span class="search-result-name">${item.name}</span>
                <span class="search-result-qty">متوفر: ${item.qty} | سعر الشراء: ${Number(item.purchasePrice).toLocaleString('ar-EG')}</span>
            </div>
        `;
    }).join('');
    results.style.display = 'block';
}

function addSearchItemToPurchase(index) {
    const item = appState.items[index];
    const itemInPurchase = currentPurchaseOrder.items.find(i => i.itemId === index);
    
    if (!itemInPurchase) {
        currentPurchaseOrder.items.push({
            itemId: index,
            name: item.name,
            purchasePrice: item.purchasePrice,
            qty: 1,
            maxQty: 1000
        });
    } else {
        itemInPurchase.qty++;
    }
    
    document.getElementById('purchaseItemSearchInput').value = '';
    document.getElementById('purchaseItemSearchResults').style.display = 'none';
    renderPurchasesItems();
    updatePurchasesTotal();
}

function renderPurchasesItems() {
    const container = document.getElementById('purchasesItemsList');
    
    if (currentPurchaseOrder.items.length === 0) {
        container.innerHTML = '<p class="empty-state">لم تختر أصنافاً حتى الآن</p>';
        return;
    }
    
    container.innerHTML = currentPurchaseOrder.items.map((item, index) => `
        <div class="item-row">
            <div class="item-row-name" style="flex:1; font-weight:700; font-size:0.95rem;">${item.name}</div>
            <div class="item-row-qty" style="width:60px;">
                <input type="number" min="1" value="${item.qty}" 
                    onchange="updatePurchasesItemQty(${index}, this.value)" style="text-align:center;">
            </div>
            <div class="item-row-price" style="width:80px;">
                <input type="number" min="0" step="0.01" value="${item.purchasePrice}" 
                    onchange="updatePurchasesItemPrice(${index}, this.value)" 
                    style="width:100%; text-align:center;">
            </div>
            <div class="item-row-total" style="width:90px;">
                <input type="number" step="0.01" value="${(item.qty * item.purchasePrice).toFixed(2)}" 
                    onchange="updatePurchasesItemTotal(${index}, this.value)" 
                    style="width:100%; text-align:center; font-weight:700;">
            </div>
            <button class="item-row-remove" onclick="removePurchasesItem(${index})">حذف</button>
        </div>
    `).join('');
}

function updatePurchasesItemQty(index, qty) {
    const qtyNum = parseInt(qty);
    if (qtyNum > 0) {
        currentPurchaseOrder.items[index].qty = qtyNum;
    }
    renderPurchasesItems();
    updatePurchasesTotal();
}

function updatePurchasesItemPrice(index, price) {
    const priceNum = parseFloat(price);
    if (priceNum >= 0) {
        currentPurchaseOrder.items[index].purchasePrice = priceNum;
    }
    renderPurchasesItems();
    updatePurchasesTotal();
}

function updatePurchasesItemTotal(index, total) {
    const totalNum = parseFloat(total);
    const item = currentPurchaseOrder.items[index];
    if (totalNum >= 0 && item.qty > 0) {
        item.purchasePrice = totalNum / item.qty;
    }
    renderPurchasesItems();
    updatePurchasesTotal();
}

function removePurchasesItem(index) {
    currentPurchaseOrder.items.splice(index, 1);
    renderPurchasesItems();
    updatePurchasesTotal();
}

function updatePurchasesTotal() {
    const subtotal = currentPurchaseOrder.items.reduce((sum, item) => {
        return sum + (item.qty * item.purchasePrice);
    }, 0);
    
    const discountPercent = parseFloat(document.getElementById('purchasesDiscountPercent').value) || 0;
    const discountAmount = (subtotal * discountPercent) / 100;
    const total = subtotal - discountAmount;
    
    document.getElementById('purchasesSubtotal').textContent = subtotal.toLocaleString('ar-EG');
    document.getElementById('purchasesTotal').textContent = total.toLocaleString('ar-EG');
    updatePurchasesRemaining();
}

function savePurchaseOrder() {
    if (currentPurchaseOrder.items.length === 0) {
        showNotification('يرجى اختيار أصنافاً واحداً على الأقل', 'error');
        return;
    }
    
    const date = document.getElementById('newPurchaseDate').value;
    const supplierName = document.getElementById('newPurchaseSupplier').value || 'مورد بدون اسم';
    const notes = document.getElementById('purchasesNotes').value;
    const discountPercent = parseFloat(document.getElementById('purchasesDiscountPercent').value) || 0;
    
    const subtotal = currentPurchaseOrder.items.reduce((sum, item) => {
        return sum + (item.qty * item.purchasePrice);
    }, 0);
    
    const discountAmount = (subtotal * discountPercent) / 100;
    const total = subtotal - discountAmount;
    
    const paymentType = currentPurchaseOrder.paymentType || 'cash';
    const paidAmount = paymentType === 'credit' ? (parseFloat(document.getElementById('purchasesPaidAmount').value) || 0) : total;
    const remainingAmount = paymentType === 'credit' ? Math.max(0, total - paidAmount) : 0;

    if (editingPurchaseIndex >= 0) {
        // Update existing purchase
        const pur = appState.purchases[editingPurchaseIndex];
        pur.date = date;
        pur.supplierName = supplierName;
        pur.items = currentPurchaseOrder.items;
        pur.discountPercent = discountPercent;
        pur.discountAmount = discountAmount;
        pur.subtotal = subtotal;
        pur.total = total;
        pur.notes = notes;
        pur.paymentType = paymentType;
        pur.paidAmount = paidAmount;
        pur.remainingAmount = remainingAmount;
        editingPurchaseIndex = -1;
        saveDataToStorage();
        switchPurchasesTab('list');
        renderDashboard();
        showNotification('تم تحديث عملية الشراء بنجاح', 'success');
        return;
    }
    
    const purchase = {
        id: `PUR-${Date.now()}`,
        date: date,
        supplierName: supplierName,
        items: currentPurchaseOrder.items,
        discountPercent: discountPercent,
        discountAmount: discountAmount,
        subtotal: subtotal,
        total: total,
        notes: notes,
        paymentType: paymentType,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        createdAt: new Date().toISOString()
    };
    
    appState.purchases.push(purchase);
    
    // Update inventory quantities
    currentPurchaseOrder.items.forEach(item => {
        const inventoryItem = appState.items[item.itemId];
        if (inventoryItem) {
            inventoryItem.qty += item.qty;
        }
    });
    
    saveDataToStorage();
    switchPurchasesTab('list');
    renderDashboard();
    showNotification('تم حفظ عملية الشراء بنجاح', 'success');
}

// =====================================================
// PRINT FUNCTIONS - 80mm Thermal / Bluetooth
// =====================================================
function printInvoice(index) {
    const invoice = appState.invoices[index];
    if (!invoice) return;

    const company = appState.companyInfo || {};
    const finalTotal = (Number(invoice.total) || 0) - (Number(invoice.discount) || 0);

    const itemsRows = (invoice.items || []).map(item => `
        <tr>
            <td style="text-align:right; padding:4px 2px; font-size:11px; border-bottom:1px dashed #999;">${item.name}</td>
            <td style="text-align:center; padding:4px 2px; font-size:11px; border-bottom:1px dashed #999;">${item.qty}</td>
            <td style="text-align:center; padding:4px 2px; font-size:11px; border-bottom:1px dashed #999;">${Number(item.price).toLocaleString('ar-EG')}</td>
            <td style="text-align:left; padding:4px 2px; font-size:11px; border-bottom:1px dashed #999;">${(item.qty * item.price).toLocaleString('ar-EG')}</td>
        </tr>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=380,height=600');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>فاتورة - ${invoice.id}</title>
            <style>
                @page { size: 80mm auto; margin: 0; }
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { 
                    font-family: 'Courier New', 'Arial', monospace; 
                    padding: 10px 8px; 
                    color: #000;
                    background: #fff;
                    width: 80mm;
                    font-size: 12px;
                    line-height: 1.4;
                }
                .receipt-header { text-align: center; margin-bottom: 8px; }
                .receipt-header h1 { font-size: 16px; font-weight: 800; margin-bottom: 2px; }
                .receipt-header .info { font-size: 10px; color: #555; }
                .divider { border-top: 1px dashed #333; margin: 6px 0; }
                .thick-divider { border-top: 2px solid #000; margin: 8px 0; }
                .meta-line { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
                table { width: 100%; border-collapse: collapse; margin: 6px 0; }
                th { font-size: 11px; font-weight: 700; padding: 4px 2px; border-bottom: 2px solid #000; text-align: center; }
                td { padding: 3px 2px; font-size: 11px; }
                .summary-line { display: flex; justify-content: space-between; font-size: 11px; padding: 3px 0; }
                .summary-line.final { font-size: 14px; font-weight: 800; border-top: 2px solid #000; margin-top: 6px; padding-top: 6px; }
                .footer { text-align: center; font-size: 10px; color: #888; margin-top: 10px; padding-top: 6px; border-top: 1px dashed #999; }
                .btn-group { text-align: center; margin-top: 12px; }
                .btn-group button { 
                    padding: 8px 16px; margin: 4px; border: none; border-radius: 4px;
                    font-family: 'Courier New', monospace; font-size: 11px; cursor: pointer;
                }
                .btn-print { background: #6366F1; color: white; }
                .btn-bt { background: #10B981; color: white; }
                @media print { .btn-group { display: none; } body { padding: 8px; } }
            </style>
        </head>
        <body>
            <div class="receipt-header">
                <h1>${company.name || 'فاتورة'}</h1>
                <div class="info">${company.phone || ''} ${company.address || ''}</div>
            </div>
            <div class="thick-divider"></div>
            <div class="meta-line"><span>${invoice.id}</span></div>
            <div class="meta-line"><span>${invoice.date}</span></div>
            <div class="meta-line"><span>${invoice.customerName || ''}</span></div>
            <div class="divider"></div>
            <table>
                <thead><tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr></thead>
                <tbody>${itemsRows}</tbody>
            </table>
            <div class="divider"></div>
            <div class="summary-line"><span>الإجمالي:</span><span>${Number(invoice.total || 0).toLocaleString('ar-EG')}</span></div>
            ${invoice.discountPercent > 0 ? `<div class="summary-line"><span>خصم (${invoice.discountPercent}%):</span><span>-${Number(invoice.discountAmount || 0).toLocaleString('ar-EG')}</span></div>` : ''}
            <div class="summary-line final"><span>المبلغ النهائي:</span><span>${finalTotal.toLocaleString('ar-EG')}</span></div>
            ${company.footer ? `<div class="footer">${company.footer}</div>` : ''}
            <div class="btn-group">
                <button class="btn-print" onclick="window.print()">🖨️ طباعة</button>
                <button class="btn-bt" onclick="window.print()">📡 طباعة عبر البلوتوث</button>
            </div>
            <script>window.onload=function(){setTimeout(function(){window.print()},500)};<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Bluetooth printing using Web Bluetooth API
async function printBluetooth(index) {
    const invoice = appState.invoices[index];
    if (!invoice) return showNotification('الفاتورة غير موجودة', 'error');

    try {
        const device = await navigator.bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['0000180f-0000-1000-8000-00805f9b34fb']
        });
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService('0000180f-0000-1000-8000-00805f9b34fb');
        const characteristic = await service.getCharacteristic('00002a19-0000-1000-8000-00805f9b34fb');
        // Simple ESC/POS receipt data
        const company = appState.companyInfo || {};
        const finalTotal = (Number(invoice.total) || 0) - (Number(invoice.discount) || 0);
        let text = '';
        text += '\x1B\x40'; // Initialize
        text += '\x1B\x61\x01'; // Center align
        text += (company.name || 'فاتورة') + '\n';
        if (company.phone) text += company.phone + '\n';
        text += '--------------------------------\n';
        text += '\x1B\x61\x00'; // Left align
        text += invoice.id + '\n';
        text += invoice.date + '\n';
        text += (invoice.customerName || '') + '\n';
        text += '--------------------------------\n';
        text += 'صنف\tكمية\tسعر\tالمجموع\n';
        text += '--------------------------------\n';
        (invoice.items || []).forEach(item => {
            text += item.name + '\t' + item.qty + '\t' + Number(item.price).toFixed(2) + '\t' + (item.qty * item.price).toFixed(2) + '\n';
        });
        text += '--------------------------------\n';
        text += 'الإجمالي: ' + Number(invoice.total || 0).toFixed(2) + '\n';
        if (invoice.discountPercent > 0) {
            text += 'خصم: -' + Number(invoice.discountAmount || 0).toFixed(2) + '\n';
        }
        text += 'المبلغ النهائي: ' + finalTotal.toFixed(2) + '\n';
        text += '\n';
        if (company.footer) text += company.footer + '\n';
        text += '\n\n\n';
        const encoder = new TextEncoder();
        await characteristic.writeValue(encoder.encode(text));
        showNotification('تمت الطباعة عبر البلوتوث', 'success');
    } catch (err) {
        showNotification('فشلت الطباعة عبر البلوتوث: ' + err.message, 'error');
    }
}

// =====================================================
// RETURNS / REFUNDS
// =====================================================
function returnPurchase(index) {
    const pur = appState.purchases[index];
    if (!pur) return showNotification('الشراء غير موجود', 'error');

    if (!confirm('هل تريد إرجاع فاتورة الشراء رقم ' + (pur.id || index + 1) + '؟ سيتم خصم الأصناف من المخزن.')) return;

    // Deduct items from inventory
    (pur.items || []).forEach(item => {
        const existingItem = appState.items.find(i => i.name === item.name);
        if (existingItem) {
            existingItem.qty = Math.max(0, (Number(existingItem.qty) || 0) - (Number(item.qty) || 0));
        }
    });

    // Move to trash
    const removed = appState.purchases.splice(index, 1)[0];
    appState.trash.push({ type: 'مرتجع شراء', data: removed, deletedAt: new Date().toISOString() });

    saveDataToStorage();
    renderPurchases();
    renderInventory();
    updateAllViews();
    showNotification('تم إرجاع فاتورة الشراء وتحديث المخزون', 'success');
}

function returnInvoice(index) {
    const inv = appState.invoices[index];
    if (!inv) return showNotification('الفاتورة غير موجودة', 'error');

    if (!confirm('هل تريد إرجاع الفاتورة رقم ' + (inv.id || index + 1) + '؟ سيتم إعادة الأصناف إلى المخزن.')) return;

    // Restore items to inventory
    (inv.items || []).forEach(item => {
        const existingItem = appState.items.find(i => i.name === item.name);
        if (existingItem) {
            existingItem.qty = (Number(existingItem.qty) || 0) + (Number(item.qty) || 0);
        }
    });

    // Move invoice to trash
    const removed = appState.invoices.splice(index, 1)[0];
    appState.trash.push({ type: 'مرتجع', data: removed, deletedAt: new Date().toISOString() });

    saveDataToStorage();
    renderSales();
    renderInventory();
    updateAllViews();
    showNotification('تم إرجاع الفاتورة واستعادة الأصناف إلى المخزن', 'success');
}

// =====================================================
// DARK MODE
// =====================================================
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('nexusDarkMode', isDark ? '1' : '0');
    document.getElementById('darkModeToggle').textContent = isDark ? '☀️' : '🌙';
    const cb = document.getElementById('darkModeSetting');
    if (cb) cb.checked = isDark;
}

function initDarkMode() {
    const saved = localStorage.getItem('nexusDarkMode');
    if (saved === '1') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').textContent = '☀️';
        const cb = document.getElementById('darkModeSetting');
        if (cb) cb.checked = true;
    }
}

// =====================================================
// KEYBOARD SHORTCUTS
// =====================================================
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl+N: New sale invoice
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            const salesView = document.getElementById('sales');
            if (salesView && salesView.classList.contains('active')) {
                switchSalesTab('form');
            } else {
                switchView('sales');
                setTimeout(() => switchSalesTab('form'), 100);
            }
        }
        // Ctrl+S: Save (click active save button)
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            const saveBtn = document.querySelector('.btn-primary');
            if (saveBtn) saveBtn.click();
        }
        // Escape: Close modals / go back
        if (e.key === 'Escape') {
            const modal = document.getElementById('modal');
            if (modal.style.display !== 'none') {
                closeModal();
                return;
            }
            const actionMenu = document.getElementById('actionMenuOverlay');
            if (actionMenu.classList.contains('open')) {
                closeActionMenu();
                return;
            }
            // Go back to dashboard if in another view
            const activeView = document.querySelector('.view.active');
            if (activeView && activeView.id !== 'dashboard') {
                switchView('dashboard');
            }
        }
    });
}

// =====================================================
// CSV EXPORT
// =====================================================
function exportTableToCSV(type) {
    let data, filename, headers;
    switch (type) {
        case 'inventory':
            data = appState.items;
            headers = ['الاسم', 'التصنيف', 'الكمية', 'الحد الأدنى', 'سعر الشراء', 'سعر البيع'];
            filename = 'المخزن.csv';
            break;
        case 'sales':
            data = appState.invoices;
            headers = ['رقم الفاتورة', 'التاريخ', 'العميل', 'الإجمالي', 'الخصم', 'المبلغ النهائي', 'نوع الدفع'];
            filename = 'المبيعات.csv';
            break;
        case 'purchases':
            data = appState.purchases;
            headers = ['رقم الفاتورة', 'التاريخ', 'المورد', 'الإجمالي', 'نوع الدفع'];
            filename = 'المشتريات.csv';
            break;
        case 'expenses':
            data = appState.expenses;
            headers = ['الوصف', 'الفئة', 'المبلغ', 'التاريخ'];
            filename = 'المصروفات.csv';
            break;
        case 'customers':
            data = appState.customers;
            headers = ['الاسم', 'الهاتف', 'العنوان', 'الرصيد'];
            filename = 'العملاء.csv';
            break;
        case 'suppliers':
            data = appState.suppliers;
            headers = ['الاسم', 'الهاتف', 'العنوان', 'الرصيد'];
            filename = 'الموردين.csv';
            break;
        default:
            return;
    }

    if (!data || data.length === 0) {
        showNotification('لا توجد بيانات للتصدير', 'error');
        return;
    }

    let csv = headers.join(',') + '\n';
    data.forEach(item => {
        const row = headers.map(h => {
            let val = '';
            switch (type) {
                case 'inventory':
                    if (h === 'الاسم') val = item.name || '';
                    else if (h === 'التصنيف') val = item.category || '';
                    else if (h === 'الكمية') val = item.qty || 0;
                    else if (h === 'الحد الأدنى') val = item.minQty || 5;
                    else if (h === 'سعر الشراء') val = item.purchasePrice || 0;
                    else if (h === 'سعر البيع') val = item.price || 0;
                    break;
                case 'sales':
                    if (h === 'رقم الفاتورة') val = item.id || '';
                    else if (h === 'التاريخ') val = item.date || '';
                    else if (h === 'العميل') val = item.customerName || '';
                    else if (h === 'الإجمالي') val = item.total || 0;
                    else if (h === 'الخصم') val = item.discount || 0;
                    else if (h === 'المبلغ النهائي') val = (Number(item.total || 0) - Number(item.discount || 0));
                    else if (h === 'نوع الدفع') val = item.paymentType === 'credit' ? 'اجل' : 'نقد';
                    break;
                case 'purchases':
                    if (h === 'رقم الفاتورة') val = item.id || '';
                    else if (h === 'التاريخ') val = item.date || '';
                    else if (h === 'المورد') val = item.supplierName || '';
                    else if (h === 'الإجمالي') val = item.total || 0;
                    else if (h === 'نوع الدفع') val = item.paymentType === 'credit' ? 'اجل' : 'نقد';
                    break;
                case 'expenses':
                    if (h === 'الوصف') val = item.title || '';
                    else if (h === 'الفئة') val = item.category || '';
                    else if (h === 'المبلغ') val = item.amount || 0;
                    else if (h === 'التاريخ') val = item.date || '';
                    break;
                case 'customers':
                case 'suppliers':
                    if (h === 'الاسم') val = item.name || '';
                    else if (h === 'الهاتف') val = item.phone || '';
                    else if (h === 'العنوان') val = item.address || '';
                    else if (h === 'الرصيد') val = item.balance || 0;
                    break;
            }
            // Escape quotes in CSV
            return '"' + String(val).replace(/"/g, '""') + '"';
        }).join(',');
        csv += row + '\n';
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    showNotification('تم تصدير ' + filename, 'success');
}

// =====================================================
// WHATSAPP SHARE
// =====================================================
function shareInvoiceOnWhatsApp(index) {
    const inv = appState.invoices[index];
    if (!inv) return showNotification('الفاتورة غير موجودة', 'error');

    const company = appState.companyInfo || {};
    const finalTotal = (Number(inv.total) || 0) - (Number(inv.discount) || 0);
    let msg = '';
    msg += '🧾 *فاتورة* ' + (inv.id || '') + '\n';
    msg += '🏢 ' + (company.name || 'Nexus ERP') + '\n';
    msg += '📅 ' + (inv.date || '') + '\n';
    if (inv.customerName) msg += '👤 ' + inv.customerName + '\n';
    msg += '┄┄┄┄┄┄┄┄┄┄┄┄┄\n';
    (inv.items || []).forEach(item => {
        msg += '• ' + item.name + ' x' + item.qty + ' = ' + (item.qty * item.price).toLocaleString('ar-EG') + '\n';
    });
    msg += '┄┄┄┄┄┄┄┄┄┄┄┄┄\n';
    msg += '💰 الإجمالي: ' + Number(inv.total || 0).toLocaleString('ar-EG') + '\n';
    if (inv.discountPercent > 0) {
        msg += '🏷️ خصم: -' + Number(inv.discountAmount || 0).toLocaleString('ar-EG') + '\n';
    }
    msg += '*🔹 المبلغ النهائي: ' + finalTotal.toLocaleString('ar-EG') + '*\n';
    if (inv.notes) msg += '📝 ' + inv.notes + '\n';
    if (company.footer) msg += '\n' + company.footer;

    const encoded = encodeURIComponent(msg);
    window.open('https://wa.me/?text=' + encoded, '_blank');
}

// =====================================================
// PWA - Service Worker Registration
// =====================================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('service-worker.js').then(function(reg) {
            console.log('Service Worker registered');
        }).catch(function(err) {
            console.log('Service Worker registration failed:', err);
        });
    });
}


