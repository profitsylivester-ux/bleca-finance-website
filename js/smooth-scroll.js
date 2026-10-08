// Smooth scroll for in-page anchor links + active nav state
(function () {
  'use strict'

  function getHeaderOffset() {
    const header = document.querySelector('.navbar')
    if (!header) return 0
    return header.getBoundingClientRect().height
  }

  function smoothScrollTo(targetId) {
    const target = document.getElementById(targetId)
    if (!target) return
    const offset = getHeaderOffset() + 12
    const top = target.getBoundingClientRect().top + window.pageYOffset - offset
    window.scrollTo({ top: top, behavior: 'smooth' })
  }

  function setActive(link) {
    document.querySelectorAll('.nav-links a.active').forEach((a) => a.classList.remove('active'))
    if (link) link.classList.add('active')
  }

  // Intercept clicks on in-page anchors
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    const href = link.getAttribute('href')
    if (!href || href === '#' || href.length < 2) return
    link.addEventListener('click', (e) => {
      const id = href.slice(1)
      const target = document.getElementById(id)
      if (!target) return
      e.preventDefault()
      smoothScrollTo(id)
      setActive(link)
      history.replaceState(null, '', href)
    })
  })

  // Update active nav as user scrolls
  const sections = Array.from(document.querySelectorAll('section[id]'))
  if (sections.length === 0) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        const id = entry.target.getAttribute('id')
        const matching = document.querySelector(`.nav-links a[href="#${id}"]`)
        if (matching) setActive(matching)
      })
    },
    { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
  )
  sections.forEach((s) => observer.observe(s))
})()