// Backend URL — local during development.
// Change this to the Render URL before deploying.
const API_URL = 'http://localhost:3001'

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