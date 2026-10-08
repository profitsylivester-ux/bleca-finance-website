const translations = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.transactions': 'Transactions',
    'nav.documents': 'Documents',
    'nav.profile': 'Profile',
    'nav.activity': 'Activity',
    'nav.logout': 'Logout',
    'header.loggedInAs': 'Logged in as',
    'nav.ceoOnly': 'Activity',
    'login.eyebrow': 'Finance & Accounting',
    'login.title': 'Staff Login',
    'login.description': 'BLECA SmartLabs staff access only',
    'login.email': 'Work email',
    'login.password': 'Password',
    'login.submit': 'Sign in',
    'login.signingIn': 'Signing in...',
  },
  sw: {
    'nav.dashboard': 'Dashibodi',
    'nav.transactions': 'Miamala',
    'nav.documents': 'Nyaraka',
    'nav.profile': 'Wasifu',
    'nav.activity': 'Shughuli',
    'nav.logout': 'Toka',
    'header.loggedInAs': 'Umeingia kama',
    'nav.ceoOnly': 'Shughuli',
    'login.eyebrow': 'Fedha na Uhasibu',
    'login.title': 'Kuingia kwa Wafanyakazi',
    'login.description': 'Ufikiaji wa wafanyakazi wa BLECA SmartLabs pekee',
    'login.email': 'Barua pepe ya kazini',
    'login.password': 'Nenosiri',
    'login.submit': 'Ingia',
    'login.signingIn': 'Inaingia...',
  },
}

let currentLanguage = localStorage.getItem('portal_language') || 'en'

export function getLanguage() {
  return currentLanguage
}

export function setLanguage(lang) {
  if (lang !== 'en' && lang !== 'sw') return
  currentLanguage = lang
  localStorage.setItem('portal_language', lang)
  document.documentElement.setAttribute('lang', lang)
  window.dispatchEvent(new Event('languagechange'))
}

export function t(key) {
  const dict = translations[currentLanguage] || translations.en
  if (dict[key]) return dict[key]
  if (translations.en[key]) return translations.en[key]
  return key
}