import { requireLogin, getUser, clearSession, fetchWithAuth, showToast } from './portal.js'
import { t } from './i18n.js'

const API_URL = 'https://bleca-finance-portal-backend.onrender.com'
const token = requireLogin()

if (token) {
  const user = getUser()
  const greeting = document.getElementById('userGreeting')

  if (user) {
    if (greeting) greeting.textContent = `${t('header.loggedInAs')} ${user.name} (${user.role.replace('_', ' ')})`
    document.getElementById('profileName').textContent = user.name
    document.getElementById('profileEmail').textContent = user.email
    document.getElementById('profileRole').textContent = user.role.replaceAll('_', ' ')
  }

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession()
    window.location.href = 'login.html'
  })

  document.querySelectorAll('[data-password-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.passwordToggle)
      const isVisible = input.type === 'text'
      input.type = isVisible ? 'password' : 'text'
      button.setAttribute('aria-label', `${isVisible ? 'Show' : 'Hide'} ${input.labels[0].textContent.toLowerCase()}`)
    })
  })

  const passwordForm = document.getElementById('passwordForm')
  const errorMessage = document.getElementById('passwordError')
  const successMessage = document.getElementById('passwordSuccess')
  const submitButton = passwordForm.querySelector('button[type="submit"]')

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    errorMessage.hidden = true
    successMessage.hidden = true

    const currentPassword = document.getElementById('currentPassword').value
    const newPassword = document.getElementById('newPassword').value
    const confirmPassword = document.getElementById('confirmPassword').value

    if (newPassword !== confirmPassword) {
      errorMessage.textContent = t('profile.passwordMismatch')
      errorMessage.hidden = false
      showToast(t('profile.toastMismatch'), 'error')
      return
    }

    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      errorMessage.textContent = t('profile.passwordWeak')
      errorMessage.hidden = false
      showToast(t('profile.toastWeak'), 'error')
      return
    }

    submitButton.disabled = true
    submitButton.textContent = t('profile.updating')

    try {
      const response = await fetchWithAuth(`${API_URL}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json()

      if (!response.ok) {
        errorMessage.textContent = data.error || t('profile.errorGeneric')
        errorMessage.hidden = false
        showToast(data.error || t('profile.toastUpdateFailed'), 'error')
        return
      }

      passwordForm.reset()
      successMessage.textContent = data.message || t('profile.toastUpdated')
      successMessage.hidden = false
      showToast(t('profile.toastUpdated'))
    } catch (error) {
      errorMessage.textContent = t('profile.errorNetwork')
      errorMessage.hidden = false
      showToast(t('profile.toastUpdateFailed'), 'error')
    } finally {
      submitButton.disabled = false
      submitButton.textContent = t('profile.updatePassword')
    }
  })

  // ===== LANGUAGE CHANGE =====
  window.addEventListener('languagechange', () => {
    // Re-render any dynamic content if needed
    // Profile data is static from user object, but greeting is updated by portal.js
  })
}
