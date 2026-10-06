import { requireLogin, getUser, clearSession, fetchWithAuth, showToast } from './portal.js'

const API_URL = 'http://localhost:3001'

const token = requireLogin()

if (token) {
  const user = getUser()

  // Greeting
  const greeting = document.getElementById('userGreeting')
  if (greeting && user) {
    greeting.textContent = `Logged in as ${user.name} (${user.role.replace('_', ' ')})`
  }

  // Logout
  const logoutBtn = document.getElementById('logoutBtn')
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearSession()
      window.location.href = 'login.html'
    })
  }

  // Format numbers with commas
  const formatTZS = (value) => {
    return new Intl.NumberFormat('en-TZ', {
      style: 'decimal',
      maximumFractionDigits: 0,
    }).format(value) + ' TZS'
  }

  let allTransactions = []

  function renderCharts(transactions) {
    const monthlyCanvas = document.getElementById('monthlyTransactionsChart')
    const categoryCanvas = document.getElementById('expenseCategoriesChart')

    if (!window.Chart) {
      document.querySelectorAll('.chart-frame').forEach((frame) => {
        frame.innerHTML = '<p class="chart-fallback">Charts are unavailable because Chart.js did not load.</p>'
      })
      return
    }

    const now = new Date()
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return {
        key,
        label: date.toLocaleDateString('en-GB', { month: 'short' }),
        income: 0,
        expense: 0,
      }
    })
    const monthLookup = new Map(months.map((month) => [month.key, month]))
    const approved = transactions.filter((transaction) => transaction.status === 'approved')

    approved.forEach((transaction) => {
      const date = new Date(transaction.date)
      if (Number.isNaN(date.getTime())) return
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const month = monthLookup.get(key)
      if (month && (transaction.type === 'income' || transaction.type === 'expense')) {
        month[transaction.type] += Number(transaction.amount) || 0
      }
    })

    new window.Chart(monthlyCanvas, {
      type: 'bar',
      data: {
        labels: months.map((month) => month.label),
        datasets: [
          { label: 'Income', data: months.map((month) => month.income), backgroundColor: '#0f7a3d' },
          { label: 'Expenses', data: months.map((month) => month.expense), backgroundColor: '#c1121f' },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { color: '#6b7280' }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { color: '#6b7280' }, grid: { color: 'rgba(15, 42, 68, 0.12)' } },
        },
        plugins: {
          legend: { labels: { color: '#6b7280' } },
          tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${formatTZS(context.raw)}` } },
        },
      },
    })

    const categoryTotals = new Map()
    approved.filter((transaction) => transaction.type === 'expense').forEach((transaction) => {
      const category = transaction.category || 'Other'
      categoryTotals.set(category, (categoryTotals.get(category) || 0) + (Number(transaction.amount) || 0))
    })
    const categories = [...categoryTotals.entries()]

    if (categories.length === 0) {
      categoryCanvas.parentElement.innerHTML = '<p class="chart-fallback">No approved expenses to show yet.</p>'
      return
    }

    new window.Chart(categoryCanvas, {
      type: 'pie',
      data: {
        labels: categories.map(([category]) => category),
        datasets: [{
          data: categories.map(([, amount]) => amount),
          backgroundColor: ['#0F2A44', '#D4A853', '#0f7a3d', '#c1121f', '#6b7280', '#9ca3af'],
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#6b7280' } },
          tooltip: { callbacks: { label: (context) => `${context.label}: ${formatTZS(context.raw)}` } },
        },
      },
    })
  }

  const loadReportLogo = () => new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = '../images/logo.png'
  })

  async function generateMonthlyReport() {
    const JsPDF = window.jspdf?.jsPDF
    if (!JsPDF) throw new Error('PDF support did not load. Please refresh and try again.')

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthTransactions = allTransactions.filter((transaction) => {
      const date = new Date(transaction.date)
      return date >= monthStart && date < nextMonth
    })
    const approved = monthTransactions.filter((transaction) => transaction.status === 'approved')
    const income = approved.filter((transaction) => transaction.type === 'income')
      .reduce((total, transaction) => total + (Number(transaction.amount) || 0), 0)
    const expenses = approved.filter((transaction) => transaction.type === 'expense')
      .reduce((total, transaction) => total + (Number(transaction.amount) || 0), 0)

    const doc = new JsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margin = 36
    const monthLabel = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

    try {
      const logo = await loadReportLogo()
      doc.addImage(logo, 'PNG', margin, 24, 42, 42)
    } catch (error) {
      console.warn('Report logo could not be loaded:', error)
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.setTextColor('#0F2A44')
    doc.text('BLECA SmartLabs', margin + 54, 42)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor('#6b7280')
    doc.text('Finance & Accounting', margin + 54, 58)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor('#0F2A44')
    doc.text(`Monthly Financial Report — ${monthLabel}`, pageWidth - margin, 42, { align: 'right' })
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Totals include approved transactions only.', pageWidth - margin, 58, { align: 'right' })

    const summaryY = 82
    const summaryWidth = (pageWidth - margin * 2 - 24) / 3
    const summaryItems = [
      ['Total income', income, '#0f7a3d'],
      ['Total expenses', expenses, '#c1121f'],
      ['Net balance', income - expenses, '#0F2A44'],
    ]
    summaryItems.forEach(([label, value, color], index) => {
      const x = margin + index * (summaryWidth + 12)
      doc.setFillColor('#F8F6F1')
      doc.roundedRect(x, summaryY, summaryWidth, 46, 4, 4, 'F')
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor('#6b7280')
      doc.text(label, x + 12, summaryY + 17)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(color)
      doc.text(formatTZS(value), x + 12, summaryY + 36)
    })

    const columns = [
      { label: 'Date', width: 70 },
      { label: 'Description', width: 250 },
      { label: 'Type', width: 70 },
      { label: 'Category', width: 125 },
      { label: 'Amount', width: 115 },
      { label: 'Status', width: 100 },
    ]
    const tableWidth = columns.reduce((total, column) => total + column.width, 0)
    let y = 148

    const drawTableHeader = () => {
      doc.setFillColor('#0F2A44')
      doc.rect(margin, y, tableWidth, 24, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor('#F8F6F1')
      let x = margin
      columns.forEach((column) => {
        doc.text(column.label, x + 7, y + 16)
        x += column.width
      })
      y += 24
    }

    drawTableHeader()
    const rows = monthTransactions.length ? monthTransactions : [null]
    rows.forEach((transaction) => {
      const rawCells = transaction
        ? [
            new Date(transaction.date).toLocaleDateString('en-GB'),
            transaction.description || '',
            transaction.type || '',
            transaction.category || '',
            formatTZS(Number(transaction.amount) || 0),
            transaction.status || '',
          ]
        : ['—', 'No transactions for this month.', '', '', '', '']
      const cellLines = rawCells.map((value, index) => doc.splitTextToSize(String(value), columns[index].width - 12))
      const rowHeight = Math.max(26, ...cellLines.map((lines) => lines.length * 11 + 10))

      if (y + rowHeight > pageHeight - 38) {
        doc.addPage()
        y = 36
        drawTableHeader()
      }

      doc.setDrawColor('#9ca3af')
      doc.setLineWidth(0.5)
      doc.rect(margin, y, tableWidth, rowHeight)
      let x = margin
      cellLines.forEach((lines, index) => {
        doc.setTextColor('#1A1A1A')
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.text(lines, x + 6, y + 15)
        x += columns[index].width
        if (index < columns.length - 1) doc.line(x, y, x, y + rowHeight)
      })
      y += rowHeight
    })

    const pageCount = doc.getNumberOfPages()
    const generatedAt = new Date().toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
    })
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor('#6b7280')
      doc.text(`Generated ${generatedAt}`, margin, pageHeight - 18)
      doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, pageHeight - 18, { align: 'right' })
    }

    doc.save(`BLECA-Report-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`)
    showToast('Monthly report generated')
  }

  const reportError = document.getElementById('reportError')
  document.getElementById('downloadMonthlyReport')?.addEventListener('click', async () => {
    reportError.hidden = true
    try {
      await generateMonthlyReport()
    } catch (error) {
      reportError.textContent = error.message || 'Could not generate the monthly report.'
      reportError.hidden = false
      showToast('Monthly report generation failed', 'error')
    }
  })

  // Load summary
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

  // Load recent transactions
  async function loadRecent() {
    const container = document.getElementById('recentTransactions')

    try {
      const response = await fetchWithAuth(`${API_URL}/transactions`)
      const transactions = await response.json()
      allTransactions = transactions
      renderCharts(transactions)

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

  // Load pending approvals
  async function loadPending() {
    const container = document.getElementById('pendingApprovals')

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

  // Small HTML escape for safety
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