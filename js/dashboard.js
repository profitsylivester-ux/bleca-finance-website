import { requireLogin, getUser, clearSession, fetchWithAuth } from './portal.js'

const API_URL = 'https://bleca-finance-portal-backend.onrender.com'

const token = requireLogin()

if (token) {
  const user = getUser()

  const greeting = document.getElementById('userGreeting')
  if (greeting && user) {
    greeting.textContent = `Logged in as ${user.name} (${user.role.replace('_', ' ')})`
  }

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession()
    window.location.href = 'login.html'
  })

  const formatTZS = (value) => {
    return new Intl.NumberFormat('en-TZ', {
      maximumFractionDigits: 0,
    }).format(value) + ' TZS'
  }

  async function loadSummary() {
    try {
      const response = await fetchWithAuth(`${API_URL}/transactions/summary`)
      const data = await response.json()

      document.getElementById('statCash').textContent = formatTZS(data.cashPosition)
      document.getElementById('statReceived').textContent = formatTZS(data.receivedThisMonth)
      document.getElementById('statSpent').textContent = formatTZS(data.spentThisMonth)
      document.getElementById('statPending').textContent = data.pendingApprovals
    } catch (error) {
      console.error('Failed to load summary', error)
    }
  }

  async function loadRecent() {
    const container = document.getElementById('recentTransactions')
    if (!container) return

    try {
      const response = await fetchWithAuth(`${API_URL}/transactions`)
      const transactions = await response.json()

      if (transactions.length === 0) {
        container.innerHTML = '<p class="portal-empty">No transactions yet.</p>'
        return
      }

      const recent = transactions.slice(0, 5)
      container.innerHTML = ''

      recent.forEach((tx) => {
        const row = document.createElement('div')
        row.className = `portal-row portal-row--${tx.type}`

        const sign = tx.type === 'income' ? '+' : '−'

        row.innerHTML = `
          <div class="portal-row-main">
            <p class="portal-row-title">${escapeHtml(tx.description)}</p>
            <p class="portal-row-meta">
              ${new Date(tx.date).toLocaleDateString()} · ${escapeHtml(tx.category)}
              · <span class="status-pill ${tx.status}">${tx.status}</span>
            </p>
          </div>
          <div class="portal-row-amount ${tx.type}">
            ${sign} ${formatTZS(tx.amount)}
          </div>
        `

        container.appendChild(row)
      })
    } catch (error) {
      console.error('Failed to load recent', error)
      container.innerHTML = '<p class="portal-empty">Could not load transactions.</p>'
    }
  }

  async function loadPending() {
    const container = document.getElementById('pendingApprovals')
    if (!container) return

    try {
      const response = await fetchWithAuth(`${API_URL}/transactions`)
      const transactions = await response.json()
      const pending = transactions.filter((tx) => tx.status === 'pending')

      if (pending.length === 0) {
        container.innerHTML = '<p class="portal-empty">No pending approvals.</p>'
        return
      }

      container.innerHTML = ''

      pending.forEach((tx) => {
        const row = document.createElement('div')
        row.className = `portal-row portal-row--${tx.type}`

        row.innerHTML = `
          <div class="portal-row-main">
            <p class="portal-row-title">${escapeHtml(tx.description)}</p>
            <p class="portal-row-meta">
              ${new Date(tx.date).toLocaleDateString()} · ${escapeHtml(tx.category)}
              · By ${escapeHtml(tx.createdBy?.name || 'Unknown')}
            </p>
          </div>
          <div class="portal-row-amount ${tx.type}">
            ${tx.type === 'income' ? '+' : '−'} ${formatTZS(tx.amount)}
          </div>
        `

        container.appendChild(row)
      })
    } catch (error) {
      console.error('Failed to load pending', error)
      container.innerHTML = '<p class="portal-empty">Could not load approvals.</p>'
    }
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  loadSummary()
  loadRecent()
  loadPending()
}