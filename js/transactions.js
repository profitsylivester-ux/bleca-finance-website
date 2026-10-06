import { requireLogin, getUser, clearSession, fetchWithAuth } from './portal.js'

const API_URL = 'http://localhost:3001'

const token = requireLogin()

if (token) {
  const user = getUser()
  const isCEO = user && user.role === 'ceo'

  // ===== HEADER =====
  const greeting = document.getElementById('userGreeting')
  if (greeting && user) {
    greeting.textContent = `Logged in as ${user.name} (${user.role.replace('_', ' ')})`
  }

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession()
    window.location.href = 'login.html'
  })

  // ===== STATE =====
  let allTransactions = []
  let currentFilter = 'all'
  let pendingRejectId = null

  // ===== HELPERS =====
  const formatTZS = (value) => {
    return new Intl.NumberFormat('en-TZ', {
      maximumFractionDigits: 0,
    }).format(value) + ' TZS'
  }

  const escapeHtml = (str) => {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  const formatDate = (iso) => {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  // ===== LOAD =====
  async function loadTransactions() {
    const container = document.getElementById('transactionsList')

    try {
      const response = await fetchWithAuth(`${API_URL}/transactions`)
      allTransactions = await response.json()
      renderTransactions()
    } catch (error) {
      console.error('Failed to load transactions', error)
      container.innerHTML = '<p class="portal-empty">Could not load transactions.</p>'
    }
  }

  // ===== RENDER =====
  function renderTransactions() {
    const container = document.getElementById('transactionsList')

    const filtered = currentFilter === 'all'
      ? allTransactions
      : allTransactions.filter((tx) => tx.status === currentFilter)

    if (filtered.length === 0) {
      container.innerHTML = `<p class="portal-empty">No ${currentFilter === 'all' ? '' : currentFilter + ' '}transactions.</p>`
      return
    }

    container.innerHTML = ''

    filtered.forEach((tx) => {
      const row = document.createElement('div')
      row.className = 'portal-row'
      row.style.flexDirection = 'column'
      row.style.alignItems = 'stretch'

      const sign = tx.type === 'income' ? '+' : '−'

      let actionsHtml = ''
      if (tx.status === 'pending' && isCEO) {
        actionsHtml = `
          <div class="tx-actions">
            <button class="btn-approve" data-action="approve" data-id="${tx._id}">Approve</button>
            <button class="btn-reject" data-action="reject" data-id="${tx._id}">Reject</button>
          </div>
        `
      }

      let rejectionHtml = ''
      if (tx.status === 'rejected' && tx.rejectionReason) {
        rejectionHtml = `
          <div class="tx-rejection-reason">
            <strong>Rejected:</strong> ${escapeHtml(tx.rejectionReason)}
          </div>
        `
      }

      row.innerHTML = `
        <div class="portal-row-main">
          <div style="display:flex; justify-content:space-between; gap:12px; align-items:flex-start;">
            <div style="flex:1; min-width:0;">
              <p class="portal-row-title">${escapeHtml(tx.description)}</p>
              <p class="portal-row-meta">
                ${formatDate(tx.date)} · ${escapeHtml(tx.category)} · ${escapeHtml(tx.project)}
                · By ${escapeHtml(tx.createdBy?.name || 'Unknown')}
              </p>
              <p style="margin-top:6px;">
                <span class="status-pill ${tx.status}">${tx.status}</span>
              </p>
            </div>
            <div class="portal-row-amount ${tx.type}" style="text-align:right;">
              ${sign} ${formatTZS(tx.amount)}
            </div>
          </div>
          ${rejectionHtml}
          ${actionsHtml}
        </div>
      `

      container.appendChild(row)
    })

    container.querySelectorAll('[data-action="approve"]').forEach((btn) => {
      btn.addEventListener('click', () => approveTransaction(btn.dataset.id))
    })

    container.querySelectorAll('[data-action="reject"]').forEach((btn) => {
      btn.addEventListener('click', () => openRejectModal(btn.dataset.id))
    })
  }

  // ===== FILTERS =====
  document.querySelectorAll('.filter-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach((t) => t.classList.remove('active'))
      tab.classList.add('active')
      currentFilter = tab.dataset.filter
      renderTransactions()
    })
  })

  // ===== NEW TRANSACTION MODAL =====
  const newModal = document.getElementById('newTransactionModal')
  const newForm = document.getElementById('newTransactionForm')
  const newError = document.getElementById('newTxError')

  document.getElementById('openNewTransaction')?.addEventListener('click', () => {
    newModal.hidden = false
    document.getElementById('txDate').value = new Date().toISOString().slice(0, 10)
  })

  document.getElementById('closeNewModal')?.addEventListener('click', () => {
    newModal.hidden = true
  })

  document.getElementById('cancelNewModal')?.addEventListener('click', () => {
    newModal.hidden = true
  })

  newModal?.addEventListener('click', (event) => {
    if (event.target === newModal) newModal.hidden = true
  })

  newForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    newError.hidden = true

    const submitBtn = document.getElementById('submitNewTx')
    submitBtn.disabled = true
    submitBtn.textContent = 'Saving...'

    const payload = {
      date: document.getElementById('txDate').value,
      description: document.getElementById('txDescription').value.trim(),
      amount: Number(document.getElementById('txAmount').value),
      type: document.getElementById('txType').value,
      category: document.getElementById('txCategory').value,
      project: document.getElementById('txProject').value.trim() || 'General',
      paymentMethod: document.getElementById('txPaymentMethod').value,
    }

    try {
      const response = await fetchWithAuth(`${API_URL}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const data = await response.json()
        newError.textContent = data.error || 'Failed to save'
        newError.hidden = false
        submitBtn.disabled = false
        submitBtn.textContent = 'Save Transaction'
        return
      }

      newForm.reset()
      newModal.hidden = true
      submitBtn.disabled = false
      submitBtn.textContent = 'Save Transaction'
      loadTransactions()
    } catch (error) {
      newError.textContent = 'Network error. Please try again.'
      newError.hidden = false
      submitBtn.disabled = false
      submitBtn.textContent = 'Save Transaction'
    }
  })

  // ===== APPROVE =====
  async function approveTransaction(id) {
    if (!confirm('Approve this transaction?')) return

    try {
      await fetchWithAuth(`${API_URL}/transactions/${id}/approve`, {
        method: 'PUT',
      })
      loadTransactions()
    } catch (error) {
      console.error('Failed to approve', error)
    }
  }

  // ===== REJECT MODAL =====
  const rejectModal = document.getElementById('rejectModal')
  const rejectForm = document.getElementById('rejectForm')
  const rejectError = document.getElementById('rejectError')

  function openRejectModal(id) {
    pendingRejectId = id
    rejectModal.hidden = false
    document.getElementById('rejectReason').value = ''
    document.getElementById('rejectReason').focus()
  }

  document.getElementById('closeRejectModal')?.addEventListener('click', () => {
    rejectModal.hidden = true
  })

  document.getElementById('cancelRejectModal')?.addEventListener('click', () => {
    rejectModal.hidden = true
  })

  rejectModal?.addEventListener('click', (event) => {
    if (event.target === rejectModal) rejectModal.hidden = true
  })

  rejectForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    rejectError.hidden = true

    const reason = document.getElementById('rejectReason').value.trim()

    if (!reason) {
      rejectError.textContent = 'You must explain why this transaction is being rejected.'
      rejectError.hidden = false
      return
    }

    const submitBtn = document.getElementById('submitReject')
    submitBtn.disabled = true
    submitBtn.textContent = 'Rejecting...'

    try {
      const response = await fetchWithAuth(
        `${API_URL}/transactions/${pendingRejectId}/reject`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      )

      if (!response.ok) {
        const data = await response.json()
        rejectError.textContent = data.error || 'Failed to reject'
        rejectError.hidden = false
        submitBtn.disabled = false
        submitBtn.textContent = 'Confirm Rejection'
        return
      }

      rejectModal.hidden = true
      submitBtn.disabled = false
      submitBtn.textContent = 'Confirm Rejection'
      pendingRejectId = null
      loadTransactions()
    } catch (error) {
      rejectError.textContent = 'Network error. Please try again.'
      rejectError.hidden = false
      submitBtn.disabled = false
      submitBtn.textContent = 'Confirm Rejection'
    }
  })

  // ===== START =====
  loadTransactions()
}