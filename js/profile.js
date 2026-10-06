import { requireLogin, getUser, clearSession, fetchWithAuth, showToast } from './portal.js'

const API_URL = 'https://bleca-finance-portal-backend.onrender.com'
const token = requireLogin()

if (token) {
  const user = getUser()
  const greeting = document.getElementById('userGreeting')

  if (user) {
    if (greeting) greeting.textContent = `Logged in as ${user.name} (${user.role.replace('_', ' ')})`
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
      errorMessage.textContent = 'The new passwords do not match.'
      errorMessage.hidden = false
      showToast('Passwords do not match', 'error')
      return
    }

    if (newPassword.length < 8 || !/\d/.test(newPassword)) {
      errorMessage.textContent = 'New password must be at least 8 characters and include a number.'
      errorMessage.hidden = false
      showToast('Password does not meet requirements', 'error')
      return
    }

    submitButton.disabled = true
    submitButton.textContent = 'Updating...'

    try {
      const response = await fetchWithAuth(`${API_URL}/auth/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json()

      if (!response.ok) {
        errorMessage.textContent = data.error || 'Could not update password.'
        errorMessage.hidden = false
        showToast(data.error || 'Password update failed', 'error')
        return
      }

      passwordForm.reset()
      successMessage.textContent = data.message || 'Password updated.'
      successMessage.hidden = false
      showToast('Password updated')
    } catch (error) {
      errorMessage.textContent = 'Could not reach the server. Please try again.'
      errorMessage.hidden = false
      showToast('Password update failed', 'error')
    } finally {
      submitButton.disabled = false
      submitButton.textContent = 'Update Password'
    }
  })
}
