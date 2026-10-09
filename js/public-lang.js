import { t, getLanguage, setLanguage } from './i18n.js'

function applyPublicTranslations() {
  document.documentElement.setAttribute('lang', getLanguage())

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    if (key) el.textContent = t(key)
  })

  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title')
    if (key) el.setAttribute('title', t(key))
  })

  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria')
    if (key) el.setAttribute('aria-label', t(key))
  })

  const select = document.getElementById('publicLangToggle')
  if (select) select.value = getLanguage()
}

function initPublicLang() {
  const select = document.getElementById('publicLangToggle')
  if (select) {
    select.addEventListener('change', (e) => {
      setLanguage(e.target.value)
    })
  }
  applyPublicTranslations()
  window.addEventListener('languagechange', applyPublicTranslations)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPublicLang)
} else {
  initPublicLang()
}