import { requireLogin, getUser, clearSession, fetchWithAuth } from './portal.js'
import { formatMoney } from './currency.js'
import { t } from './i18n.js'

const API_URL = 'https://bleca-finance-portal-backend.onrender.com'

const token = requireLogin()

if (token) {
  const user = getUser()

  const greeting = document.getElementById('userGreeting')
  if (greeting && user) {
    greeting.textContent = t('dashboard.greeting').replace('{name}', user.name).replace('{role}', user.role.replace('_', ' '))
  }

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession()
    window.location.href = 'login.html'
  })

  async function loadSummary() {
    try {
      const response = await fetchWithAuth(`${API_URL}/transactions/summary`)
      const data = await response.json()

      document.getElementById('statCash').textContent = formatMoney(data.cashPosition, 'TZS')
      document.getElementById('statReceived').textContent = formatMoney(data.receivedThisMonth, 'TZS')
      document.getElementById('statSpent').textContent = formatMoney(data.spentThisMonth, 'TZS')
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
        container.innerHTML = `<p class="portal-empty">${t('dashboard.emptyRecent')}</p>`
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
            ${sign} ${formatMoney(tx.amount, tx.currency)}
          </div>
        `

        container.appendChild(row)
      })
    } catch (error) {
      console.error('Failed to load recent', error)
      container.innerHTML = `<p class="portal-empty">${t('dashboard.errorRecent')}</p>`
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
        container.innerHTML = `<p class="portal-empty">${t('dashboard.emptyPending')}</p>`
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
              · By ${escapeHtml(tx.createdBy?.name || t('dashboard.unknownUser'))}
            </p>
          </div>
          <div class="portal-row-amount ${tx.type}">
            ${tx.type === 'income' ? '+' : '−'} ${formatMoney(tx.amount, tx.currency)}
          </div>
        `

        container.appendChild(row)
      })
    } catch (error) {
      console.error('Failed to load pending', error)
      container.innerHTML = `<p class="portal-empty">${t('dashboard.errorPending')}</p>`
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

  // ===== Charts =====
  const analyticsCache = new Map()
  let seriesChart = null
  let categoryChart = null
  let seriesRenderId = 0
  let categoryRenderId = 0

  const seriesTypeSelect = document.getElementById('seriesChartType')
  const seriesPeriodSelect = document.getElementById('seriesPeriod')
  const categoryTypeSelect = document.getElementById('categoryChartType')
  const categoryPeriodSelect = document.getElementById('categoryPeriod')
  const seriesCanvas = document.getElementById('monthlyTransactionsChart')
  const categoryCanvas = document.getElementById('expenseCategoriesChart')
  const seriesStatus = document.getElementById('seriesChartStatus')
  const categoryStatus = document.getElementById('categoryChartStatus')

  const formatCompact = (value) => {
    return new Intl.NumberFormat('en-TZ', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }

  const chartTheme = () => {
    return document.body.classList.contains('dark')
      ? {
          income: '#0f7a3d',
          expense: '#c1121f',
          grid: 'rgba(248, 246, 241, 0.14)',
          text: '#F8F6F1',
          segments: ['#D4A853', '#F8F6F1', '#0f7a3d', '#c1121f', '#9ca3af', '#6b7280'],
        }
      : {
          income: '#0f7a3d',
          expense: '#c1121f',
          grid: 'rgba(15, 42, 68, 0.10)',
          text: '#6b7280',
          segments: ['#0F2A44', '#D4A853', '#0f7a3d', '#c1121f', '#6b7280', '#9ca3af'],
        }
  }

  const setChartStatus = (canvas, statusEl, message) => {
    if (!canvas || !statusEl) return
    statusEl.textContent = message || ''
    statusEl.hidden = !message
    canvas.hidden = Boolean(message)
  }

  const formatBucketLabel = (label) => {
    const match = /^(\d{4})-(\d{2})$/.exec(String(label))
    if (!match) return label
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const index = Number(match[2]) - 1
    return months[index] ? `${months[index]} ${match[1]}` : label
  }

  const topCategories = (categories, limit = 5) => {
    const list = Array.isArray(categories) ? categories : []
    if (list.length <= limit) return list
    const rest = list.slice(limit)
    const otherTotal = rest.reduce((sum, item) => sum + (item.total || 0), 0)
    return [...list.slice(0, limit), { name: 'Other', total: otherTotal }]
  }

  async function fetchAnalytics(period) {
    if (analyticsCache.has(period)) return analyticsCache.get(period)

    const response = await fetchWithAuth(
      `${API_URL}/transactions/analytics?period=${encodeURIComponent(period)}`
    )
    if (!response.ok) throw new Error(`Analytics request failed (${response.status})`)

    const data = await response.json()
    analyticsCache.set(period, data)
    return data
  }

  async function renderSeriesChart() {
    if (!seriesCanvas || !seriesTypeSelect || !seriesPeriodSelect) return

    const renderId = ++seriesRenderId

    if (typeof Chart === 'undefined') {
      setChartStatus(seriesCanvas, seriesStatus, t('dashboard.chartLibError'))
      return
    }

    const type = seriesTypeSelect.value
    const period = seriesPeriodSelect.value

    try {
      const data = await fetchAnalytics(period)
      if (renderId !== seriesRenderId) return

      const theme = chartTheme()
      const series = Array.isArray(data.series) ? data.series : []
      const labels = series.map((point) => formatBucketLabel(point.label))

      const makeDataset = (label, key, color) => {
        const values = series.map((point) => point[key] || 0)
        return type === 'line'
          ? {
              label,
              data: values,
              borderColor: color,
              backgroundColor: color,
              borderWidth: 2,
              fill: false,
              tension: 0.35,
              pointRadius: 3,
              pointHoverRadius: 5,
            }
          : {
              label,
              data: values,
              backgroundColor: color,
              borderRadius: 4,
              maxBarThickness: 34,
            }
      }

      setChartStatus(seriesCanvas, seriesStatus, '')
      seriesChart?.destroy()

      seriesChart = new Chart(seriesCanvas.getContext('2d'), {
        type,
        data: {
          labels,
          datasets: [
            makeDataset(t('dashboard.legendIncome'), 'income', theme.income),
            makeDataset(t('dashboard.legendExpense'), 'expense', theme.expense),
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { labels: { color: theme.text, usePointStyle: true, boxWidth: 8 } },
            tooltip: {
              callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatMoney(ctx.parsed.y, 'TZS')}` },
            },
          },
          scales: {
            x: { grid: { color: theme.grid }, ticks: { color: theme.text } },
            y: {
              beginAtZero: true,
              grid: { color: theme.grid },
              ticks: { color: theme.text, callback: (value) => formatCompact(value) },
            },
          },
        },
      })
    } catch (error) {
      if (renderId !== seriesRenderId) return
      console.error('Failed to load income vs expenses chart', error)
      seriesChart?.destroy()
      seriesChart = null
      setChartStatus(seriesCanvas, seriesStatus, t('dashboard.chartLoadError'))
    }
  }

  async function renderCategoryChart() {
    if (!categoryCanvas || !categoryTypeSelect || !categoryPeriodSelect) return

    const renderId = ++categoryRenderId

    if (typeof Chart === 'undefined') {
      setChartStatus(categoryCanvas, categoryStatus, t('dashboard.chartLibError'))
      return
    }

    const type = categoryTypeSelect.value
    const period = categoryPeriodSelect.value

    try {
      const data = await fetchAnalytics(period)
      if (renderId !== categoryRenderId) return

      const items = topCategories(data.categories)

      if (items.length === 0) {
        categoryChart?.destroy()
        categoryChart = null
        setChartStatus(categoryCanvas, categoryStatus, t('dashboard.noExpenses'))
        return
      }

      const theme = chartTheme()

      setChartStatus(categoryCanvas, categoryStatus, '')
      categoryChart?.destroy()

      categoryChart = new Chart(categoryCanvas.getContext('2d'), {
        type,
        data: {
          labels: items.map((item) => item.name),
          datasets: [
            {
              data: items.map((item) => item.total || 0),
              backgroundColor: items.map((item, index) => theme.segments[index % theme.segments.length]),
              borderWidth: 2,
              hoverOffset: 8,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'right',
              labels: { color: theme.text, usePointStyle: true, boxWidth: 8 },
            },
            tooltip: {
              callbacks: { label: (ctx) => `${ctx.label}: ${formatMoney(ctx.parsed, 'TZS')}` },
            },
          },
        },
      })
    } catch (error) {
      if (renderId !== categoryRenderId) return
      console.error('Failed to load expenses by category chart', error)
      categoryChart?.destroy()
      categoryChart = null
      setChartStatus(categoryCanvas, categoryStatus, t('dashboard.chartLoadError'))
    }
  }

  seriesTypeSelect?.addEventListener('change', renderSeriesChart)
  seriesPeriodSelect?.addEventListener('change', renderSeriesChart)
  categoryTypeSelect?.addEventListener('change', renderCategoryChart)
  categoryPeriodSelect?.addEventListener('change', renderCategoryChart)

  const themeObserver = new MutationObserver(() => {
    renderSeriesChart()
    renderCategoryChart()
  })
  themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] })

  window.addEventListener('languagechange', () => {
    loadRecent()
    loadPending()
    renderSeriesChart()
    renderCategoryChart()
  })

  loadSummary()
  loadRecent()
  loadPending()
  renderSeriesChart()
  renderCategoryChart()
}