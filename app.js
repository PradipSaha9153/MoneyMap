/* ============================================================
   ExpenseIQ – Application Logic (app.js)
   ============================================================ */

'use strict';

// ─────────────────────────────────────────────
// 1. STATE
// ─────────────────────────────────────────────
const API_URL = 'https://moneymap-8xzf.onrender.com';
const THEME_KEY   = 'expenseiq_theme';

let expenses   = []; // Loaded asynchronously from backend
let barChart   = null;
let pieChart   = null;
let deleteTargetId = null;

const CATEGORY_ICONS = {
  Food: '🍔', Travel: '✈️', Bills: '💡', Shopping: '🛍️',
  Health: '🏥', Entertainment: '🎬', Education: '📚',
  Rent: '🏠', Groceries: '🛒', Other: '📦',
};

// ─────────────────────────────────────────────
// 2. BACKEND API INTEGRATION
// ─────────────────────────────────────────────
async function loadExpenses() {
  try {
    const res = await fetch(`${API_URL}/expenses`);
    if (!res.ok) throw new Error('Network response was not ok');
    return await res.json();
  } catch (error) {
    console.error('Failed to load expenses from server:', error);
    showToast('Failed to connect to backend', 'error');
    return [];
  }
}

// ─────────────────────────────────────────────
// 3. UTILITY HELPERS
// ─────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function fmt(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthLabel(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function shortMonthLabel(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return new Date(y, m - 1, 1).toLocaleString('default', { month: 'short' });
}

function getMonthKey(dateStr) { return dateStr.slice(0, 7); } // "YYYY-MM"

function getCurrentMonthKey() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function pct(a, b) {
  if (b === 0) return a > 0 ? '+100%' : '0%';
  const diff = ((a - b) / b * 100).toFixed(1);
  return (diff > 0 ? '+' : '') + diff + '%';
}

// ─────────────────────────────────────────────
// 4. TAB NAVIGATION
// ─────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // "View All" shortcut from dashboard
  document.getElementById('viewAllBtn').addEventListener('click', () => switchTab('transactions'));
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
    b.setAttribute('aria-selected', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === `panel-${tabName}`);
  });

  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'transactions') renderTransactions();
  if (tabName === 'reports') renderReports();
}

// ─────────────────────────────────────────────
// 5. CRUD OPERATIONS
// ─────────────────────────────────────────────
function addExpense(data) {
  // Now async, moved below
}

function updateExpense(id, data) {
  // Now async, moved below
}

function deleteExpense(id) {
  // Now async, moved below
}

// ASYNC CRUD
async function addExpense(data) {
  const expense = { id: uid(), ...data, createdAt: new Date().toISOString() };
  try {
    const res = await fetch(`${API_URL}/add-expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expense)
    });
    if (!res.ok) throw new Error('Failed to add expense');
    expenses.unshift(expense);
    return true;
  } catch (error) {
    console.error(error);
    showToast('Failed to save expense to server', 'error');
    return false;
  }
}

async function updateExpense(id, data) {
  try {
    const res = await fetch(`${API_URL}/expense/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update expense');
    const idx = expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      expenses[idx] = { ...expenses[idx], ...data, updatedAt: new Date().toISOString() };
    }
    return true;
  } catch (error) {
    console.error(error);
    showToast('Failed to update expense on server', 'error');
    return false;
  }
}

async function deleteExpense(id) {
  try {
    const res = await fetch(`${API_URL}/expense/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete expense');
    expenses = expenses.filter(e => e.id !== id);
    return true;
  } catch (error) {
    console.error(error);
    showToast('Failed to delete expense from server', 'error');
    return false;
  }
}

// ─────────────────────────────────────────────
// 6. ADD EXPENSE FORM
// ─────────────────────────────────────────────
function initAddForm() {
  const form = document.getElementById('expenseForm');
  document.getElementById('expDate').value = today();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!validateForm()) return;

    const data = {
      amount:   parseFloat(document.getElementById('expAmount').value),
      category: document.getElementById('expCategory').value,
      date:     document.getElementById('expDate').value,
      payment:  document.getElementById('expPayment').value,
      note:     document.getElementById('expNote').value.trim(),
    };

    const success = await addExpense(data);
    if (success) {
      form.reset();
      document.getElementById('expDate').value = today();
      showToast('Expense added successfully!', 'success');
      renderQuickStats();
      renderDashboard(); // keep charts in sync
      
      // Switch to transactions tab to show all expenses
      switchTab('transactions');
    }
  });

  document.getElementById('formResetBtn').addEventListener('click', () => {
    clearFormErrors();
    setTimeout(() => { document.getElementById('expDate').value = today(); }, 10);
  });
}

function validateForm() {
  let valid = true;
  const amount   = document.getElementById('expAmount');
  const category = document.getElementById('expCategory');
  const date     = document.getElementById('expDate');

  clearFormErrors();

  if (!amount.value || parseFloat(amount.value) <= 0) {
    showFieldError('errAmount', amount, 'Please enter a valid amount.');
    valid = false;
  }
  if (!category.value) {
    showFieldError('errCategory', category, 'Please select a category.');
    valid = false;
  }
  if (!date.value) {
    showFieldError('errDate', date, 'Please select a date.');
    valid = false;
  }

  return valid;
}

function showFieldError(errId, input, msg) {
  document.getElementById(errId).textContent = msg;
  input.classList.add('error');
  input.addEventListener('input', () => {
    document.getElementById(errId).textContent = '';
    input.classList.remove('error');
  }, { once: true });
}

function clearFormErrors() {
  ['errAmount', 'errCategory', 'errDate'].forEach(id => {
    document.getElementById(id).textContent = '';
  });
  document.querySelectorAll('#expenseForm .form-input').forEach(el => el.classList.remove('error'));
}

// ─────────────────────────────────────────────
// 7. QUICK STATS (ADD TAB)
// ─────────────────────────────────────────────
function renderQuickStats() {
  const todayStr  = today();
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStr   = weekStart.toISOString().slice(0, 10);

  const todayExpenses = expenses.filter(e => e.date === todayStr);
  const weekExpenses  = expenses.filter(e => e.date >= weekStr);

  document.getElementById('qsTodaySpend').textContent  = fmt(todayExpenses.reduce((s, e) => s + e.amount, 0));
  document.getElementById('qsWeekSpend').textContent   = fmt(weekExpenses.reduce((s, e) => s + e.amount, 0));
  document.getElementById('qsTodayCount').textContent  = todayExpenses.length;
}

// ─────────────────────────────────────────────
// 8. DASHBOARD (STAT CARDS + CHARTS + RECENT)
// ─────────────────────────────────────────────
function renderDashboard() {
  renderStatCards();
  renderBarChart();
  renderPieChart();
  renderRecentTable();
}

function renderStatCards() {
  const curKey  = getCurrentMonthKey();
  const now     = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

  const curExpenses  = expenses.filter(e => getMonthKey(e.date) === curKey);
  const prevExpenses = expenses.filter(e => getMonthKey(e.date) === prevKey);

  const curTotal  = curExpenses.reduce((s, e) => s + e.amount, 0);
  const prevTotal = prevExpenses.reduce((s, e) => s + e.amount, 0);

  // YTD
  const ytdExpenses = expenses.filter(e => e.date.startsWith(now.getFullYear().toString()));
  const ytd = ytdExpenses.reduce((s, e) => s + e.amount, 0);

  // Monthly average
  const byMonth = groupByMonth(ytdExpenses);
  const months  = Object.keys(byMonth);
  const avg     = months.length ? ytd / months.length : 0;

  // Top category this month
  const catTotals = {};
  curExpenses.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('statThisMonth').textContent = fmt(curTotal);
  document.getElementById('statYTD').textContent       = fmt(ytd);
  document.getElementById('statAvg').textContent       = fmt(avg);
  document.getElementById('statTopCat').textContent    = topCat
    ? `${CATEGORY_ICONS[topCat[0]] || ''} ${topCat[0]}`
    : '—';

  // Month-on-month change
  const changeEl = document.getElementById('statMonthChange');
  if (prevTotal > 0 || curTotal > 0) {
    const p = pct(curTotal, prevTotal);
    const up = curTotal >= prevTotal;
    changeEl.textContent = `${p} vs last month`;
    changeEl.className   = 'stat-change ' + (up ? 'change-up' : 'change-down');
  } else {
    changeEl.textContent = '';
  }

  // Subtitle
  document.getElementById('dashboardSubtitle').textContent =
    `${monthLabel(curKey)} • ${curExpenses.length} transaction${curExpenses.length !== 1 ? 's' : ''}`;
}

// ─── Group expenses by YYYY-MM ───
function groupByMonth(list) {
  return list.reduce((acc, e) => {
    const k = getMonthKey(e.date);
    (acc[k] = acc[k] || []).push(e);
    return acc;
  }, {});
}

// ─── Bar Chart ───
function renderBarChart() {
  const year = new Date().getFullYear();
  const labels = [];
  const data   = [];

  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    labels.push(shortMonthLabel(key));
    const total = expenses
      .filter(e => getMonthKey(e.date) === key)
      .reduce((s, e) => s + e.amount, 0);
    data.push(total);
  }

  const ctx = document.getElementById('barChart').getContext('2d');
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const labelColor = isDark ? '#8b949e' : '#94a3b8';

  const curMonth = new Date().getMonth(); // 0-indexed

  const bgColors = data.map((_, i) =>
    i === curMonth
      ? 'rgba(99,102,241,1)'
      : 'rgba(99,102,241,0.35)'
  );

  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Expenses (₹)',
        data,
        backgroundColor: bgColors,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: labelColor, font: { family: 'Inter', size: 11 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: labelColor,
            font: { family: 'Inter', size: 11 },
            callback: v => v === 0 ? '0' : '₹' + Number(v).toLocaleString('en-IN')
          },
          beginAtZero: true,
        }
      }
    }
  });
}

// ─── Pie Chart ───
function renderPieChart() {
  const curKey = getCurrentMonthKey();
  const curExpenses = expenses.filter(e => getMonthKey(e.date) === curKey);

  const catTotals = {};
  curExpenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
  });

  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const labels = sorted.map(([k]) => k);
  const data   = sorted.map(([, v]) => v);

  const COLORS = [
    '#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981',
    '#3b82f6','#ef4444','#14b8a6','#f97316','#84cc16',
  ];

  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChart) pieChart.destroy();

  if (data.length === 0) {
    pieChart = null;
    // draw empty state on canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = document.documentElement.getAttribute('data-theme') === 'dark' ? '#8b949e' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.font = '14px Inter';
    ctx.fillText('No data for this month', ctx.canvas.width / 2, ctx.canvas.height / 2);
    return;
  }

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: COLORS.slice(0, data.length),
        borderWidth: 2,
        borderColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#161b22' : '#ffffff',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#e6edf3' : '#475569',
            font: { family: 'Inter', size: 11 },
            padding: 12,
            boxWidth: 12,
            boxHeight: 12,
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${fmt(ctx.parsed)}`
          }
        }
      }
    }
  });
}

// ─── Recent Transactions ───
function renderRecentTable() {
  const tbody = document.getElementById('recentTableBody');
  const recent = expenses.slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="4">No expenses yet. Start adding!</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(e => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td><span class="cat-badge cat-${e.category}">${CATEGORY_ICONS[e.category] || ''} ${e.category}</span></td>
      <td style="color:var(--text-secondary)">${escHtml(e.note) || '<span style="color:var(--text-muted)">—</span>'}</td>
      <td class="amount-cell">${fmt(e.amount)}</td>
    </tr>
  `).join('');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─────────────────────────────────────────────
// 9. TRANSACTIONS (FILTERS + TABLE)
// ─────────────────────────────────────────────
function initFilters() {
  populateFilterMonths();

  ['filterMonth', 'filterCategory', 'filterFrom', 'filterTo'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderTransactions);
    document.getElementById(id).addEventListener('input', renderTransactions);
  });

  document.getElementById('clearFiltersBtn').addEventListener('click', () => {
    ['filterMonth', 'filterCategory', 'filterFrom', 'filterTo'].forEach(id => {
      document.getElementById(id).value = '';
    });
    renderTransactions();
  });
}

function populateFilterMonths() {
  const monthKeys = [...new Set(expenses.map(e => getMonthKey(e.date)))].sort().reverse();
  const select    = document.getElementById('filterMonth');
  const existing  = [...select.options].slice(1).map(o => o.value);

  monthKeys.forEach(key => {
    if (!existing.includes(key)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = monthLabel(key);
      select.appendChild(opt);
    }
  });
}

function getFilteredExpenses() {
  const month    = document.getElementById('filterMonth').value;
  const category = document.getElementById('filterCategory').value;
  const from     = document.getElementById('filterFrom').value;
  const to       = document.getElementById('filterTo').value;

  return expenses.filter(e => {
    if (month    && getMonthKey(e.date) !== month)   return false;
    if (category && e.category !== category)          return false;
    if (from     && e.date < from)                    return false;
    if (to       && e.date > to)                      return false;
    return true;
  });
}

function renderTransactions() {
  const filtered = getFilteredExpenses();
  const tbody    = document.getElementById('mainTableBody');
  const footer   = document.getElementById('tableFooter');
  const summary  = document.getElementById('resultSummary');

  const total = filtered.reduce((s, e) => s + e.amount, 0);

  summary.textContent = filtered.length === expenses.length
    ? `${expenses.length} transaction${expenses.length !== 1 ? 's' : ''}`
    : `${filtered.length} of ${expenses.length} transactions`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No expenses match the current filters.</td></tr>`;
    footer.textContent = '';
    return;
  }

  tbody.innerHTML = filtered.map(e => `
    <tr>
      <td>${formatDate(e.date)}</td>
      <td><span class="cat-badge cat-${e.category}">${CATEGORY_ICONS[e.category] || ''} ${e.category}</span></td>
      <td><span style="font-size:0.82rem;color:var(--text-muted)">${e.payment || 'Cash'}</span></td>
      <td style="color:var(--text-secondary);max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
        ${escHtml(e.note) || '<span style="color:var(--text-muted)">—</span>'}
      </td>
      <td class="amount-cell">${fmt(e.amount)}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn edit" data-id="${e.id}" title="Edit" aria-label="Edit expense"><i class="fa-solid fa-pencil"></i></button>
          <button class="icon-btn delete" data-id="${e.id}" title="Delete" aria-label="Delete expense"><i class="fa-solid fa-trash"></i></button>
        </div>
      </td>
    </tr>
  `).join('');

  footer.innerHTML = `Total: <strong style="color:var(--accent-blue);margin-left:8px">${fmt(total)}</strong>`;

  // Bind action buttons
  tbody.querySelectorAll('.icon-btn.edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.icon-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
  });

  // Update month filter options
  populateFilterMonths();
}

// ─────────────────────────────────────────────
// 10. EDIT MODAL
// ─────────────────────────────────────────────
function openEditModal(id) {
  const exp = expenses.find(e => e.id === id);
  if (!exp) return;

  document.getElementById('editId').value       = id;
  document.getElementById('editAmount').value   = exp.amount;
  document.getElementById('editCategory').value = exp.category;
  document.getElementById('editDate').value     = exp.date;
  document.getElementById('editPayment').value  = exp.payment || 'Cash';
  document.getElementById('editNote').value     = exp.note || '';

  document.getElementById('modalBackdrop').hidden = false;
}

function closeEditModal() {
  document.getElementById('modalBackdrop').hidden = true;
}

function initEditModal() {
  document.getElementById('editForm').addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const data = {
      amount:   parseFloat(document.getElementById('editAmount').value),
      category: document.getElementById('editCategory').value,
      date:     document.getElementById('editDate').value,
      payment:  document.getElementById('editPayment').value,
      note:     document.getElementById('editNote').value.trim(),
    };

    if (!data.amount || data.amount <= 0 || !data.category || !data.date) return;

    const success = await updateExpense(id, data);
    if (success) {
      closeEditModal();
      renderTransactions();
      renderDashboard();
      showToast('Expense updated successfully!', 'success');
    }
  });

  document.getElementById('modalClose').addEventListener('click', closeEditModal);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
  document.getElementById('modalBackdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('modalBackdrop')) closeEditModal();
  });
}

// ─────────────────────────────────────────────
// 11. DELETE MODAL
// ─────────────────────────────────────────────
function openDeleteModal(id) {
  deleteTargetId = id;
  document.getElementById('deleteBackdrop').hidden = false;
}

function closeDeleteModal() {
  deleteTargetId = null;
  document.getElementById('deleteBackdrop').hidden = true;
}

function initDeleteModal() {
  document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
    if (!deleteTargetId) return;
    const success = await deleteExpense(deleteTargetId);
    if (success) {
      closeDeleteModal();
      renderTransactions();
      renderDashboard();
      showToast('Expense deleted.', 'info');
    }
  });

  document.getElementById('cancelDeleteBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteModalClose').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteBackdrop').addEventListener('click', e => {
    if (e.target === document.getElementById('deleteBackdrop')) closeDeleteModal();
  });
}

// ─────────────────────────────────────────────
// 12. REPORTS
// ─────────────────────────────────────────────
function renderReports() {
  const yearSelect = document.getElementById('reportYear');
  const catSelect  = document.getElementById('catBreakdownMonth');
  const curYear    = new Date().getFullYear();

  // Populate year dropdown
  const years = [...new Set(expenses.map(e => e.date.slice(0, 4)))].sort().reverse();
  if (years.length === 0) years.push(String(curYear));
  yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  yearSelect.value = yearSelect.value || String(curYear);

  yearSelect.addEventListener('change', renderComparisonTable);
  renderComparisonTable();

  // Populate cat breakdown month selector
  const monthKeys = [...new Set(expenses.map(e => getMonthKey(e.date)))].sort().reverse();
  catSelect.innerHTML = monthKeys.length
    ? monthKeys.map(k => `<option value="${k}">${monthLabel(k)}</option>`).join('')
    : `<option value="">No data</option>`;
  catSelect.value = catSelect.value || monthKeys[0] || '';

  catSelect.addEventListener('change', () => renderCategoryBreakdown(catSelect.value));
  renderCategoryBreakdown(catSelect.value);
}

function renderComparisonTable() {
  const year  = document.getElementById('reportYear').value;
  const tbody = document.getElementById('comparisonTableBody');
  const badge = document.getElementById('peakMonthBadge');

  const yearExpenses = expenses.filter(e => e.date.startsWith(year));
  const byMonth      = groupByMonth(yearExpenses);

  const months = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    const list = byMonth[key] || [];
    const total = list.reduce((s, e) => s + e.amount, 0);
    const catTotals = {};
    list.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
    const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

    months.push({ key, total, count: list.length, topCat: topCat ? topCat[0] : null });
  }

  const maxTotal   = Math.max(...months.map(m => m.total), 0);
  const nonZero    = months.filter(m => m.total > 0);
  const peakMonth  = months.find(m => m.total === maxTotal && m.total > 0);

  if (!nonZero.length) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">No data for ${year}.</td></tr>`;
    badge.textContent = '';
    return;
  }

  badge.textContent = peakMonth ? `🏆 Highest: ${monthLabel(peakMonth.key)}` : '';

  tbody.innerHTML = months.map((m, i) => {
    const isPeak = m.total === maxTotal && m.total > 0;
    const avg    = m.count ? m.total / m.count : 0;
    const prev   = i > 0 ? months[i - 1].total : null;
    let changeHtml = '<span class="change-neutral">—</span>';
    if (prev !== null && prev > 0) {
      const d = ((m.total - prev) / prev * 100).toFixed(1);
      changeHtml = m.total >= prev
        ? `<span class="change-positive">▲ ${d}%</span>`
        : `<span class="change-negative">▼ ${Math.abs(d)}%</span>`;
    } else if (prev !== null && prev === 0 && m.total > 0) {
      changeHtml = '<span class="change-positive">New</span>';
    }

    return `
      <tr class="${isPeak ? 'peak-row' : ''}">
        <td><strong>${monthLabel(m.key)}</strong></td>
        <td class="amount-cell">${m.total > 0 ? fmt(m.total) : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>${m.count || '<span style="color:var(--text-muted)">0</span>'}</td>
        <td>${avg > 0 ? fmt(avg) : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>${m.topCat ? `<span class="cat-badge cat-${m.topCat}">${CATEGORY_ICONS[m.topCat] || ''} ${m.topCat}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
        <td>${changeHtml}</td>
      </tr>
    `;
  }).join('');
}

function renderCategoryBreakdown(monthKey) {
  const container = document.getElementById('categoryBreakdown');
  const list      = monthKey ? expenses.filter(e => getMonthKey(e.date) === monthKey) : [];

  if (list.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);padding:16px;font-size:0.9rem;">No data for this period.</p>';
    return;
  }

  const catTotals = {};
  list.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const sorted  = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const maxVal  = sorted[0][1];

  container.innerHTML = sorted.map(([cat, total]) => `
    <div class="cat-row">
      <span class="cat-row-label">${CATEGORY_ICONS[cat] || ''} ${cat}</span>
      <div class="cat-bar-track">
        <div class="cat-bar-fill" style="width:${(total / maxVal * 100).toFixed(1)}%"></div>
      </div>
      <span class="cat-row-amount">${fmt(total)}</span>
    </div>
  `).join('');
}

// ─────────────────────────────────────────────
// 13. DARK MODE
// ─────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next    = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);

    // Re-render charts so they pick up new colors
    if (document.getElementById('panel-dashboard').classList.contains('active')) {
      renderBarChart();
      renderPieChart();
    }
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  const icon = document.querySelector('.theme-icon i');

  if (theme === 'dark') {
    icon.classList.remove('fa-moon');
    icon.classList.add('fa-sun');
  } else {
    icon.classList.remove('fa-sun');
    icon.classList.add('fa-moon');
  }
}

// ─────────────────────────────────────────────
// 14. TOAST NOTIFICATIONS
// ─────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  const toast     = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-dot"></span><span>${escHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hide');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ─────────────────────────────────────────────
// 15. INIT
// ─────────────────────────────────────────────
function init() {
  initTheme();
  initTabs();

  // Wait for variables to load from server
  loadExpenses().then(data => {
    expenses = data;
    
    initAddForm();
    initFilters();
    initEditModal();
    initDeleteModal();

    // Render initial view
    switchTab('transactions');
    renderQuickStats();
  });
}

document.addEventListener('DOMContentLoaded', init);
