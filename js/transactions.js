import { requireLogin, getUser, clearSession, fetchWithAuth, showToast } from './portal.js'
const API_URL = 'https://bleca-finance-portal-backend.onrender.com'

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
  let searchQuery = ''
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

    const filtered = allTransactions.filter((tx) => {
      const matchesStatus = currentFilter === 'all' || tx.status === currentFilter
      const searchableText = [tx.description, tx.category, tx.project].join(' ').toLowerCase()
      return matchesStatus && searchableText.includes(searchQuery)
    })

    if (filtered.length === 0) {
      container.innerHTML = `<p class="portal-empty">${searchQuery ? 'No transactions match your search.' : `No ${currentFilter === 'all' ? '' : currentFilter + ' '}transactions.`}</p>`
      return
    }

    container.innerHTML = ''

    filtered.forEach((tx) => {
      const row = document.createElement('div')
      row.className = `portal-row portal-row--${tx.type}`
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

  document.getElementById('transactionSearch')?.addEventListener('input', (event) => {
    searchQuery = event.target.value.trim().toLowerCase()
    renderTransactions()
  })

  function exportCSV(transactions) {
    const formatCsvDate = (iso) => {
      if (!iso) return ''
      const date = new Date(iso)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}/${month}/${year}`
    }

    const csvEscape = (value) => {
      const str = String(value ?? '')
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const headers = [
      'Date', 'Description', 'Type', 'Category', 'Project', 'Amount (TZS)',
      'Status', 'Created By', 'Approved By', 'Rejection Reason',
    ]
    const rows = [headers.join(',')]

    transactions.forEach((tx) => {
      const row = [
        `="${formatCsvDate(tx.date)}"`,
        csvEscape(tx.description),
        csvEscape(tx.type),
        csvEscape(tx.category),
        csvEscape(tx.project),
        csvEscape(tx.amount),
        csvEscape(tx.status),
        csvEscape(tx.createdBy?.name || ''),
        csvEscape(tx.approvedBy?.name || ''),
        csvEscape(tx.rejectionReason || ''),
      ]
      rows.push(row.join(','))
    })

    const csvContent = rows.join('\r\n')
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `BLECA-Transactions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast('Transactions exported')
  }

  document.getElementById('exportTransactions')?.addEventListener('click', () => {
    exportCSV(allTransactions)
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
        showToast('Transaction save failed', 'error')
        submitBtn.disabled = false
        submitBtn.textContent = 'Save Transaction'
        return
      }

      newForm.reset()
      newModal.hidden = true
      submitBtn.disabled = false
      submitBtn.textContent = 'Save Transaction'
      showToast('Transaction saved')
      loadTransactions()
    } catch (error) {
      newError.textContent = 'Network error. Please try again.'
      newError.hidden = false
      showToast('Transaction save failed', 'error')
      submitBtn.disabled = false
      submitBtn.textContent = 'Save Transaction'
    }
  })

  // ===== APPROVE =====
  async function approveTransaction(id) {
    if (!confirm('Approve this transaction?')) return

    try {
      const response = await fetchWithAuth(`${API_URL}/transactions/${id}/approve`, {
        method: 'PUT',
      })
      if (!response.ok) throw new Error('Approval failed')
      showToast('Transaction approved')
      loadTransactions()
    } catch (error) {
      console.error('Failed to approve', error)
      showToast('Transaction approval failed', 'error')
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
      showToast('Please explain why this is rejected', 'error')
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
        showToast('Transaction rejection failed', 'error')
        submitBtn.disabled = false
        submitBtn.textContent = 'Confirm Rejection'
        return
      }

      rejectModal.hidden = true
      submitBtn.disabled = false
      submitBtn.textContent = 'Confirm Rejection'
      pendingRejectId = null
      showToast('Transaction rejected', 'warning')
      loadTransactions()
    } catch (error) {
      rejectError.textContent = 'Network error. Please try again.'
      rejectError.hidden = false
      showToast('Transaction rejection failed', 'error')
      submitBtn.disabled = false
      submitBtn.textContent = 'Confirm Rejection'
    }
  })

  // ===== START =====
  loadTransactions()
}