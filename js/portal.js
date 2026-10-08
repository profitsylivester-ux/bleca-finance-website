// Backend URL — BLECA Finance Portal backend on Render
const API_URL = 'https://bleca-finance-portal-backend.onrender.com'

import { t, getLanguage } from './i18n.js'

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    el.textContent = t(key)
  })
}

document.documentElement.setAttribute('lang', getLanguage())
applyTranslations()
window.addEventListener('languagechange', applyTranslations)

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

// ===== TOASTS =====
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

// ===== LOGIN PAGE =====

const loginForm = document.getElementById('loginForm')

if (loginForm) {
  const emailInput = document.getElementById('staff-email')
  const passwordInput = document.getElementById('staff-password')
  const togglePassword = document.getElementById('togglePassword')
  const errorBox = document.getElementById('loginError')
  const loginButton = document.getElementById('loginButton')

  togglePassword?.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password'
    passwordInput.type = isPassword ? 'text' : 'password'
    togglePassword.setAttribute(
      'aria-label',
      isPassword ? 'Hide password' : 'Show password'
    )
  })

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault()

    errorBox.hidden = true
    errorBox.textContent = ''
    loginButton.disabled = true
    loginButton.textContent = t('login.signingIn')

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
        loginButton.textContent = t('login.submit')
        return
      }

      saveSession(data.token, data.user)
      window.location.href = 'dashboard.html'
    } catch (error) {
      errorBox.textContent = 'Cannot reach the server. Please try again.'
      errorBox.hidden = false
      loginButton.disabled = false
      loginButton.textContent = t('login.submit')
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

// ===== HIDE CEO-ONLY LINKS FOR NON-CEO USERS =====
const currentUser = getUser()
if (currentUser && currentUser.role !== 'ceo') {
  document.querySelectorAll('.ceo-only').forEach((el) => {
    el.style.display = 'none'
  })
}

// ===== DARK MODE =====
const themeToggle = document.getElementById('themeToggle')

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark')
    if (themeToggle) themeToggle.textContent = '☀'
  } else {
    document.body.classList.remove('dark')
    if (themeToggle) themeToggle.textContent = '☾'
  }
}

const savedTheme = localStorage.getItem('portal_theme') || 'light'
applyTheme(savedTheme)

themeToggle?.addEventListener('click', () => {
  const current = localStorage.getItem('portal_theme') === 'dark' ? 'dark' : 'light'
  const next = current === 'dark' ? 'light' : 'dark'
  localStorage.setItem('portal_theme', next)
  applyTheme(next)
})

export function initI18n() {
  document.documentElement.setAttribute('lang', getLanguage())
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    el.textContent = t(key)
  })
  window.addEventListener('languagechange', () => {
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n')
      el.textContent = t(key)
    })
  })
}