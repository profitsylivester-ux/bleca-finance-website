// Backend URL — local during development.
// Change this to the Render URL before deploying.
const API_URL = 'http://localhost:3001'

export function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container')
  if (!container) {
    container = document.createElement('div')
    container.className = 'toast-container'
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.className = `toast toast--${type}`
  toast.textContent = message
  container.appendChild(toast)
  setTimeout(() => toast.remove(), 3200)
}

const themeIcons = {
  dark: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m17.07 7.07-1.42-1.42M6.35 6.35 4.93 4.93m14.14 0-1.42 1.42M6.35 17.65l-1.42 1.42"></path></svg>',
  light: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"></path></svg>',
}

function applyPortalTheme(isDark) {
  document.body.classList.toggle('dark', isDark)
  document.querySelectorAll('.portal-theme-toggle').forEach((button) => {
    button.innerHTML = isDark ? themeIcons.dark : themeIcons.light
    button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode')
    button.title = isDark ? 'Switch to light mode' : 'Switch to dark mode'
  })
}

applyPortalTheme(localStorage.getItem('portal_theme') === 'dark')

document.querySelectorAll('.portal-theme-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const isDark = !document.body.classList.contains('dark')
    localStorage.setItem('portal_theme', isDark ? 'dark' : 'light')
    applyPortalTheme(isDark)
  })
})

const currentUser = getUser()
document.querySelectorAll('.ceo-only').forEach((link) => {
  link.hidden = currentUser?.role !== 'ceo'
})

// ===== TOKEN HELPERS =====

export function getToken() {
  return localStorage.getItem('portal_token')
}

export function getUser() {
  const raw = localStorage.getItem('portal_user')
  return raw ? JSON.parse(raw) : null
}

export function saveSession(token, user) {
  localStorage.setItem('portal_token', token)
  localStorage.setItem('portal_user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('portal_token')
  localStorage.removeItem('portal_user')
}

// ===== LOGIN PAGE =====

const loginForm = document.getElementById('loginForm')

if (loginForm) {
  const emailInput = document.getElementById('staff-email')
  const passwordInput = document.getElementById('staff-password')
  const togglePassword = document.getElementById('togglePassword')
  const errorBox = document.getElementById('loginError')
  const loginButton = document.getElementById('loginButton')

  // Eye icon: show / hide password
  togglePassword.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password'
    passwordInput.type = isPassword ? 'text' : 'password'
    togglePassword.setAttribute(
      'aria-label',
      isPassword ? 'Hide password' : 'Show password'
    )
  })

  // Submit login
  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    errorBox.hidden = true
    errorBox.textContent = ''
    loginButton.disabled = true
    loginButton.textContent = 'Signing in...'

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value.trim(),
          password: passwordInput.value,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        errorBox.textContent = data.error || 'Login failed'
        errorBox.hidden = false
        loginButton.disabled = false
        loginButton.textContent = 'Sign in'
        return
      }

      saveSession(data.token, data.user)
      window.location.href = 'dashboard.html'
    } catch (error) {
      errorBox.textContent = 'Cannot reach the server. Please try again.'
      errorBox.hidden = false
      loginButton.disabled = false
      loginButton.textContent = 'Sign in'
    }
  })
}

// ===== PROTECTED PAGES =====

export function requireLogin() {
  const token = getToken()
  if (!token) {
    window.location.href = 'login.html'
    return null
  }
  return token
}

export async function fetchWithAuth(url, options = {}) {
  const token = getToken()

  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  })

  if (response.status === 401) {
    clearSession()
    window.location.href = 'login.html'
    throw new Error('Session expired')
  }

  return response
}