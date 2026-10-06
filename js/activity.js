import { requireLogin, getUser, clearSession, fetchWithAuth, showToast } from './portal.js'
const API_URL = 'https://bleca-finance-portal-backend.onrender.com'
const token = requireLogin()

if (token) {
  const user = getUser()

  if (!user || user.role !== 'ceo') {
    window.location.href = 'dashboard.html'
  } else {
    const greeting = document.getElementById('userGreeting')
    if (greeting) greeting.textContent = `Logged in as ${user.name} (${user.role.replace('_', ' ')})`

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      clearSession()
      window.location.href = 'login.html'
    })

    const activityList = document.getElementById('activityList')

    const formatDateTime = (value) => new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))

    const renderActivities = (activities) => {
      activityList.replaceChildren()

      if (activities.length === 0) {
        activityList.innerHTML = '<p class="portal-empty">No activity has been recorded yet.</p>'
        return
      }

      activities.forEach((activity) => {
        const row = document.createElement('article')
        row.className = 'portal-row portal-row--activity activity-row'

        const main = document.createElement('div')
        main.className = 'portal-row-main'
        const title = document.createElement('p')
        title.className = 'portal-row-title'
        title.textContent = activity.action
        const meta = document.createElement('p')
        meta.className = 'portal-row-meta'
        meta.textContent = `${activity.userName} · ${formatDateTime(activity.createdAt)}`
        main.append(title, meta)

        const details = document.createElement('p')
        details.className = 'activity-details'
        details.textContent = activity.details || 'No additional details.'
        row.append(main, details)
        activityList.append(row)
      })
    }

    const loadActivity = async () => {
      try {
        const response = await fetchWithAuth(`${API_URL}/activity`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Could not load activity.')
        renderActivities(data)
      } catch (error) {
        activityList.innerHTML = '<p class="portal-empty">Could not load activity. Please try again.</p>'
        showToast('Could not load activity', 'error')
      }
    }

    loadActivity()
  }
}
