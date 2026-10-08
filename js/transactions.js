import { requireLogin, getUser, clearSession, fetchWithAuth, showToast } from './portal.js'
import { formatMoney } from './currency.js'
import { t } from './i18n.js'
const API_URL = 'https://bleca-finance-portal-backend.onrender.com'

const token = requireLogin()

if (token) {
  const user = getUser()
  const isCEO = user && user.role === 'ceo'

  // ===== HEADER =====
  const greeting = document.getElementById('userGreeting')
  if (greeting && user) {
    greeting.textContent = `${t('header.loggedInAs')} ${user.name} (${user.role.replace('_', ' ')})`
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
      container.innerHTML = `<p class="portal-empty">${t('tx.errorLoad')}</p>`
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
      let emptyMsg = ''
      if (searchQuery) {
        emptyMsg = t('tx.emptySearch')
      } else if (currentFilter === 'all') {
        emptyMsg = t('tx.emptyAll')
      } else if (currentFilter === 'pending') {
        emptyMsg = t('tx.emptyPending')
      } else if (currentFilter === 'approved') {
        emptyMsg = t('tx.emptyApproved')
      } else if (currentFilter === 'rejected') {
        emptyMsg = t('tx.emptyRejected')
      }
      container.innerHTML = `<p class="portal-empty">${emptyMsg}</p>`
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
            <button class="btn-approve" data-action="approve" data-id="${tx._id}">${t('tx.approve')}</button>
            <button class="btn-reject" data-action="reject" data-id="${tx._id}">${t('tx.reject')}</button>
          </div>
        `
      }

      let rejectionHtml = ''
      if (tx.status === 'rejected' && tx.rejectionReason) {
        rejectionHtml = `
          <div class="tx-rejection-reason">
            <strong>${t('tx.rejectedLabel')}</strong> ${escapeHtml(tx.rejectionReason)}
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
                · ${t('tx.by')} ${escapeHtml(tx.createdBy?.name || t('tx.unknownUser'))}
              </p>
              <p style="margin-top:6px;">
                <span class="status-pill ${tx.status}">${t('tx.status' + tx.status.charAt(0).toUpperCase() + tx.status.slice(1))}</span>
              </p>
            </div>
            <div class="portal-row-amount ${tx.type}" style="text-align:right;">
              ${sign} ${formatMoney(tx.amount, tx.currency)}
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
      'Date', 'Description', 'Type', 'Category', 'Project', 'Amount', 'Currency',
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
        csvEscape(tx.currency || 'TZS'),
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
    submitBtn.textContent = t('tx.saving')

    const payload = {
      date: document.getElementById('txDate').value,
      description: document.getElementById('txDescription').value.trim(),
      amount: Number(document.getElementById('txAmount').value),
      currency: document.getElementById('txCurrency').value,
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
        newError.textContent = data.error || t('tx.errorSaveFailed')
        newError.hidden = false
        showToast(t('tx.toastSaveFailed'), 'error')
        submitBtn.disabled = false
        submitBtn.textContent = t('tx.save')
        return
      }

      newForm.reset()
      newModal.hidden = true
      submitBtn.disabled = false
      submitBtn.textContent = t('tx.save')
      showToast(t('tx.toastSaved'))
      loadTransactions()
    } catch (error) {
      newError.textContent = t('tx.errorNetwork')
      newError.hidden = false
      showToast(t('tx.toastSaveFailed'), 'error')
      submitBtn.disabled = false
      submitBtn.textContent = t('tx.save')
    }
  })

  // ===== APPROVE =====
  async function approveTransaction(id) {
    if (!confirm(t('tx.approveConfirm'))) return

    try {
      const response = await fetchWithAuth(`${API_URL}/transactions/${id}/approve`, {
        method: 'PUT',
      })
      if (!response.ok) throw new Error('Approval failed')
      showToast(t('tx.toastApproved'))
      loadTransactions()
    } catch (error) {
      console.error('Failed to approve', error)
      showToast(t('tx.toastApprovalFailed'), 'error')
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
      rejectError.textContent = t('tx.rejectRequired')
      rejectError.hidden = false
      showToast(t('tx.rejectRequired'), 'error')
      return
    }

    const submitBtn = document.getElementById('submitReject')
    submitBtn.disabled = true
    submitBtn.textContent = t('tx.rejecting')

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
        rejectError.textContent = data.error || t('tx.errorSaveFailed')
        rejectError.hidden = false
        showToast(t('tx.toastRejectFailed'), 'error')
        submitBtn.disabled = false
        submitBtn.textContent = t('tx.confirmReject')
        return
      }

      rejectModal.hidden = true
      submitBtn.disabled = false
      submitBtn.textContent = t('tx.confirmReject')
      pendingRejectId = null
      showToast(t('tx.toastRejected'), 'warning')
      loadTransactions()
    } catch (error) {
      rejectError.textContent = t('tx.errorNetwork')
      rejectError.hidden = false
      showToast(t('tx.toastRejectFailed'), 'error')
      submitBtn.disabled = false
      submitBtn.textContent = t('tx.confirmReject')
    }
  })

  // ===== LANGUAGE CHANGE =====
  window.addEventListener('languagechange', () => {
    renderTransactions()
  })

  // ===== START =====
  loadTransactions()
}