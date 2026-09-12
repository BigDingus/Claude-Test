const STORAGE_KEY = "household-budget-state-v1";

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error("empty");
    return JSON.parse(raw);
  } catch {
    return { income: 0, categories: [], transactions: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

const fmt = (n) =>
  (Number(n) || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function categorySpent(categoryId) {
  return state.transactions
    .filter((t) => t.categoryId === categoryId)
    .reduce((sum, t) => sum + t.amount, 0);
}

function totals() {
  const budgeted = state.categories.reduce((s, c) => s + c.amount, 0);
  const spent = state.transactions.reduce((s, t) => s + t.amount, 0);
  return {
    income: state.income,
    budgeted,
    spent,
    unallocated: state.income - budgeted,
    remaining: state.income - spent,
  };
}

function render() {
  renderSummary();
  renderCategories();
  renderTransactionCategoryOptions();
  renderTransactions();
}

function renderSummary() {
  const t = totals();
  const cards = [
    { label: "Monthly Income", value: fmt(t.income), cls: "" },
    { label: "Budgeted", value: fmt(t.budgeted), cls: "" },
    { label: "Spent", value: fmt(t.spent), cls: "" },
    {
      label: "Remaining",
      value: fmt(t.remaining),
      cls: t.remaining < 0 ? "negative" : "positive",
    },
  ];
  document.getElementById("summaryCards").innerHTML = cards
    .map(
      (c) => `
    <div class="card ${c.cls}">
      <div class="label">${c.label}</div>
      <div class="value">${c.value}</div>
    </div>`
    )
    .join("");
}

function renderCategories() {
  const list = document.getElementById("categoryList");
  if (state.categories.length === 0) {
    list.innerHTML = `<li class="empty-hint">No categories yet — add one above (e.g. Rent, Groceries, Utilities).</li>`;
    return;
  }
  list.innerHTML = state.categories
    .map((c) => {
      const spent = categorySpent(c.id);
      const pct = c.amount > 0 ? Math.min(100, (spent / c.amount) * 100) : 0;
      const over = spent > c.amount;
      const warn = !over && pct >= 80;
      return `
      <li class="category-item">
        <div class="row">
          <span class="name">${escapeHtml(c.name)}</span>
          <button class="remove-btn" data-remove-category="${c.id}">Remove</button>
        </div>
        <div class="row amounts">
          <span>${fmt(spent)} of ${fmt(c.amount)} spent</span>
          <span>${over ? "Over budget" : `${Math.round(pct)}%`}</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill ${over ? "over" : warn ? "warn" : ""}" style="width:${pct}%"></div>
        </div>
      </li>`;
    })
    .join("");

  list.querySelectorAll("[data-remove-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-category");
      state.categories = state.categories.filter((c) => c.id !== id);
      state.transactions = state.transactions.filter((t) => t.categoryId !== id);
      saveState();
      render();
    });
  });
}

function renderTransactionCategoryOptions() {
  const select = document.getElementById("transactionCategory");
  const current = select.value;
  select.innerHTML =
    state.categories.length === 0
      ? `<option value="" disabled selected>Add a category first</option>`
      : state.categories
          .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`)
          .join("");
  if (state.categories.some((c) => c.id === current)) select.value = current;
}

function renderTransactions() {
  const list = document.getElementById("transactionList");
  if (state.transactions.length === 0) {
    list.innerHTML = `<li class="empty-hint">No expenses logged yet.</li>`;
    return;
  }
  const byId = Object.fromEntries(state.categories.map((c) => [c.id, c.name]));
  list.innerHTML = [...state.transactions]
    .reverse()
    .map(
      (t) => `
    <li class="transaction-item">
      <span>
        ${escapeHtml(t.description)}
        <div class="meta">${escapeHtml(byId[t.categoryId] || "Uncategorized")}</div>
      </span>
      <span>
        ${fmt(t.amount)}
        <button class="remove-btn" data-remove-transaction="${t.id}">✕</button>
      </span>
    </li>`
    )
    .join("");

  list.querySelectorAll("[data-remove-transaction]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-remove-transaction");
      state.transactions = state.transactions.filter((t) => t.id !== id);
      saveState();
      render();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById("incomeForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = document.getElementById("incomeInput");
  state.income = parseFloat(input.value) || 0;
  input.value = "";
  saveState();
  render();
});

document.getElementById("categoryForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const nameInput = document.getElementById("categoryName");
  const amountInput = document.getElementById("categoryAmount");
  const name = nameInput.value.trim();
  const amount = parseFloat(amountInput.value);
  if (!name || isNaN(amount) || amount < 0) return;
  state.categories.push({ id: uid(), name, amount });
  nameInput.value = "";
  amountInput.value = "";
  saveState();
  render();
});

document.getElementById("transactionForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const categorySelect = document.getElementById("transactionCategory");
  const descInput = document.getElementById("transactionDesc");
  const amountInput = document.getElementById("transactionAmount");
  const categoryId = categorySelect.value;
  const description = descInput.value.trim();
  const amount = parseFloat(amountInput.value);
  if (!categoryId || !description || isNaN(amount) || amount < 0) return;
  state.transactions.push({ id: uid(), categoryId, description, amount, date: new Date().toISOString() });
  descInput.value = "";
  amountInput.value = "";
  saveState();
  render();
});

document.getElementById("resetBtn").addEventListener("click", () => {
  if (!confirm("Clear all budget data on this device? This cannot be undone.")) return;
  state = { income: 0, categories: [], transactions: [] };
  saveState();
  render();
});

render();
