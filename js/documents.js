import { requireLogin, getUser, clearSession, fetchWithAuth, getToken, showToast } from './portal.js'
import { t } from './i18n.js'

const API_URL = 'https://bleca-finance-portal-backend.onrender.com'

const token = requireLogin()

if (token) {
  const user = getUser()

  // ===== HEADER =====
  const greeting = document.getElementById('userGreeting')
  if (greeting && user) {
    greeting.textContent = `${t('header.loggedInAs')} ${user.name} (${user.role.replace('_', ' ')})`
  }

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearSession()
    window.location.href = 'login.html'
  })

  // ===== HELPERS =====
  const escapeHtml = (str) => {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  const formatDate = (iso) => {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  // ===== LOAD DOCUMENTS =====
  async function loadDocuments() {
    const container = document.getElementById('documentsList')

    try {
      const response = await fetchWithAuth(`${API_URL}/documents`)
      const documents = await response.json()

      if (documents.length === 0) {
        container.innerHTML = `<p class="portal-empty">${t('doc.empty')}</p>`
        return
      }

      container.innerHTML = ''

      documents.forEach((doc) => {
        const row = document.createElement('div')
        row.className = 'portal-row portal-row--doc'

        const fileUrl = `${API_URL}/uploads/${encodeURIComponent(doc.filename)}`

        const canManage =
          user && (user.role === 'ceo' || String(doc.uploadedBy?._id || doc.uploadedBy) === String(user.id))

        const deleteBtn = canManage
          ? `<button type="button" class="btn-delete" data-action="delete-doc" data-id="${doc._id}">${t('doc.delete')}</button>`
          : ''

        row.innerHTML = `
          <div class="portal-row-main">
            <p class="portal-row-title">${escapeHtml(doc.originalName)}</p>
            <p class="portal-row-meta">
              ${escapeHtml(doc.type)} · ${escapeHtml(doc.description || t('doc.noDescription'))}
              · Uploaded ${formatDate(doc.uploadedAt)}
              · By ${escapeHtml(doc.uploadedBy?.name || t('tx.unknownUser'))}
            </p>
          </div>
          <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
            <a href="${fileUrl}" target="_blank" rel="noopener" class="btn-approve" style="text-decoration:none;">${t('doc.view')}</a>
            <button type="button" class="btn-tx-pdf" data-action="download-doc" data-url="${fileUrl}" data-name="${escapeHtml(doc.originalName)}">${t('doc.download')}</button>
            ${deleteBtn}
          </div>
        `

        container.appendChild(row)
      })

      container.querySelectorAll('[data-action="download-doc"]').forEach((btn) => {
        btn.addEventListener('click', () => downloadDocument(btn.dataset.url, btn.dataset.name))
      })

      container.querySelectorAll('[data-action="delete-doc"]').forEach((btn) => {
        btn.addEventListener('click', () => deleteDocument(btn.dataset.id))
      })
    } catch (error) {
      console.error('Failed to load documents', error)
      container.innerHTML = `<p class="portal-empty">${t('doc.errorLoad')}</p>`
    }
  }

  // ===== DOWNLOAD / DELETE DOCUMENT =====
  async function downloadDocument(fileUrl, fileName) {
    try {
      const response = await fetchWithAuth(fileUrl)
      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fileName || 'document'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      showToast(t('doc.toastDownloaded'))
    } catch (error) {
      console.error('Failed to download document', error)
      showToast(t('doc.toastDownloadFailed'), 'error')
    }
  }

  async function deleteDocument(id) {
    if (!confirm(t('doc.deleteConfirm'))) return

    try {
      const response = await fetchWithAuth(`${API_URL}/documents/${id}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Delete failed')

      showToast(t('doc.toastDeleted'))
      loadDocuments()
    } catch (error) {
      console.error('Failed to delete document', error)
      showToast(t('doc.toastDeleteFailed'), 'error')
    }
  }

  // ===== UPLOAD MODAL =====
  const uploadModal = document.getElementById('uploadModal')
  const uploadForm = document.getElementById('uploadForm')
  const uploadError = document.getElementById('uploadError')

  document.getElementById('openUploadDoc')?.addEventListener('click', () => {
    uploadModal.hidden = false
    uploadForm.reset()
    uploadError.hidden = true
  })

  document.getElementById('closeUploadModal')?.addEventListener('click', () => {
    uploadModal.hidden = true
  })

  document.getElementById('cancelUploadModal')?.addEventListener('click', () => {
    uploadModal.hidden = true
  })

  uploadModal?.addEventListener('click', (event) => {
    if (event.target === uploadModal) uploadModal.hidden = true
  })

  uploadForm?.addEventListener('submit', async (event) => {
    event.preventDefault()
    uploadError.hidden = true

    const fileInput = document.getElementById('docFile')

    if (!fileInput.files || fileInput.files.length === 0) {
      uploadError.textContent = t('doc.errorSelectFile')
      uploadError.hidden = false
      showToast(t('doc.errorSelectFile'), 'error')
      return
    }

    const file = fileInput.files[0]

    if (file.size > 5 * 1024 * 1024) {
      uploadError.textContent = t('doc.errorFileTooLarge')
      uploadError.hidden = false
      showToast(t('doc.toastUploadFailed'), 'error')
      return
    }

    const submitBtn = document.getElementById('submitUpload')
    submitBtn.disabled = true
    submitBtn.textContent = t('doc.uploading')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', document.getElementById('docType').value)
    formData.append('description', document.getElementById('docDescription').value.trim())

    try {
      const response = await fetch(`${API_URL}/documents`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const data = await response.json()
        uploadError.textContent = data.error || t('doc.errorUploadFailed')
        uploadError.hidden = false
        showToast(t('doc.toastUploadFailed'), 'error')
        submitBtn.disabled = false
        submitBtn.textContent = t('doc.upload')
        return
      }

      uploadModal.hidden = true
      submitBtn.disabled = false
      submitBtn.textContent = t('doc.upload')
      showToast(t('doc.toastUploaded'))
      loadDocuments()
    } catch (error) {
      uploadError.textContent = t('doc.errorNetwork')
      uploadError.hidden = false
      showToast(t('doc.toastUploadFailed'), 'error')
      submitBtn.disabled = false
      submitBtn.textContent = t('doc.upload')
    }
  })

  // ===== LANGUAGE CHANGE =====
  window.addEventListener('languagechange', () => {
    loadDocuments()
  })

  // ===== START =====
  loadDocuments()
}