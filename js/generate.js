import { showToast, fetchWithAuth, getToken } from './portal.js'
import { formatMoney } from './currency.js'

const { jsPDF } = window.jspdf

const API_URL = 'https://bleca-finance-portal-backend.onrender.com'

// ===== GENERATE DOCUMENT MODAL =====

const generateModal = document.getElementById('generateModal')
const openGenerateBtn = document.getElementById('openGenerateDoc')
const closeGenerateBtn = document.getElementById('closeGenerateModal')
const typeStep = document.getElementById('generateTypeStep')
const formStep = document.getElementById('generateFormStep')
const generateTitle = document.getElementById('generateTitle')

openGenerateBtn?.addEventListener('click', () => {
  generateModal.hidden = false
  typeStep.hidden = false
  formStep.hidden = true
  formStep.innerHTML = ''
  generateTitle.textContent = 'Generate Document'
})

function closeGenerate() {
  generateModal.hidden = true
  typeStep.hidden = false
  formStep.hidden = true
  formStep.innerHTML = ''
}

closeGenerateBtn?.addEventListener('click', closeGenerate)

generateModal?.addEventListener('click', (event) => {
  if (event.target === generateModal) closeGenerate()
})

document.querySelectorAll('.doc-type-card').forEach((card) => {
  card.addEventListener('click', () => {
    const type = card.dataset.docType
    openFormFor(type)
  })
})

function openFormFor(type) {
  typeStep.hidden = true
  formStep.hidden = false

  const titles = {
    receipt: 'Generate Receipt',
    invoice: 'Generate Invoice',
    certificate: 'Generate Certificate',
    proposal: 'Generate Proposal',
  }

  generateTitle.textContent = titles[type] || 'Generate Document'

  if (type === 'receipt') {
    formStep.innerHTML = receiptFormHtml()
    attachReceiptHandlers()
    return
  }

  if (type === 'invoice') {
    formStep.innerHTML = invoiceFormHtml()
    attachInvoiceHandlers()
    return
  }

  if (type === 'certificate') {
    formStep.innerHTML = certificateFormHtml()
    attachCertificateHandlers()
    return
  }

  if (type === 'proposal') {
    formStep.innerHTML = proposalFormHtml()
    attachProposalHandlers()
    return
  }

  formStep.innerHTML = `
    <p class="modal-hint">Form for <strong>${type}</strong> will be built next.</p>
    <div class="modal-actions">
      <button type="button" class="btn-cancel" id="backToTypes">← Back</button>
    </div>
  `

  document.getElementById('backToTypes')?.addEventListener('click', backToTypes)
}

function backToTypes() {
  typeStep.hidden = false
  formStep.hidden = true
  formStep.innerHTML = ''
  generateTitle.textContent = 'Generate Document'
}

// ===== HELPERS =====
function formatDateLong(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

// Downloads the PDF to the device AND keeps a copy in the portal
// (Documents page) so it can be reviewed later.
async function downloadAndArchive(doc, fileName, archiveType, archiveDescription) {
  const blob = doc.output('blob')

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  showToast('Document generated')

  if (!getToken()) return

  try {
    const file = new File([blob], fileName, { type: 'application/pdf' })

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', archiveType)
    formData.append('description', archiveDescription)

    const response = await fetchWithAuth(`${API_URL}/documents`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) throw new Error('Failed to archive document')

    showToast('Saved to Documents for future review')
  } catch (error) {
    console.error('Failed to archive document', error)
    showToast('Downloaded, but could not save to Documents', 'warning')
  }
}

// ===== RECEIPT =====
function receiptFormHtml() {
  const today = new Date().toISOString().slice(0, 10)

  return `
    <form id="receiptForm" class="doc-form">
      <div class="form-group">
        <label for="rcpNumber">Receipt Number</label>
        <input type="text" id="rcpNumber" value="BLECA-RCPT-2026-0001" required>
      </div>

      <div class="form-group">
        <label for="rcpDate">Date</label>
        <input type="date" id="rcpDate" value="${today}" required>
      </div>

      <div class="form-group">
        <label for="rcpFrom">Received From</label>
        <input type="text" id="rcpFrom" placeholder="Full name of payer" required>
      </div>

      <div class="form-group">
        <label for="rcpAmount">Amount</label>
        <input type="number" id="rcpAmount" min="1" step="1" required>
      </div>

      <div class="form-group">
        <label for="rcpPurpose">Purpose / Description</label>
        <input type="text" id="rcpPurpose" placeholder="e.g. Bootcamp registration fee" required>
      </div>

      <div class="form-group">
        <label for="rcpMethod">Payment Method</label>
        <select id="rcpMethod">
          <option value="Cash">Cash</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="Mobile Money">Mobile Money</option>
          <option value="Cheque">Cheque</option>
        </select>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" id="backToTypes">← Back</button>
        <button type="submit" class="btn-primary">Generate Receipt</button>
      </div>
    </form>
  `
}

function attachReceiptHandlers() {
  document.getElementById('backToTypes')?.addEventListener('click', backToTypes)

  document.getElementById('receiptForm')?.addEventListener('submit', (event) => {
    event.preventDefault()

    const data = {
      number: document.getElementById('rcpNumber').value.trim(),
      date: document.getElementById('rcpDate').value,
      from: document.getElementById('rcpFrom').value.trim(),
      amount: Number(document.getElementById('rcpAmount').value),
      purpose: document.getElementById('rcpPurpose').value.trim(),
      method: document.getElementById('rcpMethod').value,
    }

    generateReceiptPdf(data)
  })
}

async function generateReceiptPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 50
  let y = 60

  try {
    const logoImg = await loadImage('../images/logo.png')
    doc.addImage(logoImg, 'PNG', margin, y - 15, 60, 60)
  } catch (err) {}

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor('#0F2A44')
  doc.text('BLECA SmartLabs', margin + 75, y + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#6b7280')
  doc.text('CITT Building, Mbeya University of Science and Technology', margin + 75, y + 24)
  doc.text('Mbeya, Tanzania', margin + 75, y + 36)
  doc.text('finance@blecasmartlabs.com  |  0746 044 144', margin + 75, y + 48)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor('#D4A853')
  doc.text('RECEIPT', pageWidth - margin, y + 10, { align: 'right' })

  doc.setFontSize(11)
  doc.setTextColor('#0F2A44')
  doc.text(`Number: ${data.number}`, pageWidth - margin, y + 32, { align: 'right' })

  y += 75
  doc.setDrawColor('#D4A853')
  doc.setLineWidth(1.5)
  doc.line(margin, y, pageWidth - margin, y)

  y += 40
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor('#6b7280')
  doc.text('Received with thanks from:', margin, y)

  y += 22
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor('#0F2A44')
  doc.text(data.from, margin, y)

  y += 30
  doc.setFillColor('#F8F6F1')
  doc.rect(margin, y, pageWidth - margin * 2, 60, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor('#6b7280')
  doc.text('Amount received:', margin + 20, y + 24)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor('#0F2A44')
  doc.text(formatMoney(data.amount, 'TZS'), margin + 20, y + 46)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor('#6b7280')
  doc.text(`Payment method: ${data.method}`, pageWidth - margin - 20, y + 24, { align: 'right' })
  doc.text(`Date: ${formatDateLong(data.date)}`, pageWidth - margin - 20, y + 46, { align: 'right' })

  y += 90
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor('#6b7280')
  doc.text('Purpose:', margin, y)

  y += 20
  doc.setFontSize(14)
  doc.setTextColor('#1A1A1A')
  doc.text(data.purpose, margin, y, { maxWidth: pageWidth - margin * 2 })

  y += 80
  doc.setDrawColor('#9ca3af')
  doc.setLineWidth(0.5)
  doc.line(margin, y, margin + 200, y)

  y += 16
  doc.setFontSize(11)
  doc.setTextColor('#6b7280')
  doc.text('Chris Bwesa', margin, y)
  y += 14
  doc.text('Chief Executive Officer, BLECA SmartLabs', margin, y)

  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(9)
  doc.setTextColor('#9ca3af')
  doc.text(
    'This is a computer-generated receipt from BLECA SmartLabs.',
    pageWidth / 2,
    pageHeight - 30,
    { align: 'center' }
  )

  await downloadAndArchive(
    doc,
    `Receipt-${data.number}.pdf`,
    'Receipt',
    `Generated receipt ${data.number}${data.purpose ? ` · ${data.purpose}` : ''}`
  )
}

// ===== INVOICE =====
function invoiceFormHtml() {
  const today = new Date().toISOString().slice(0, 10)
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return `
    <form id="invoiceForm" class="doc-form">
      <div class="form-group">
        <label for="invNumber">Invoice Number</label>
        <input type="text" id="invNumber" value="BLECA-INV-2026-0001" required>
      </div>

      <div class="form-group">
        <label for="invDate">Invoice Date</label>
        <input type="date" id="invDate" value="${today}" required>
      </div>

      <div class="form-group">
        <label for="invTerms">Payment Terms</label>
        <input type="text" id="invTerms" value="Net 30" required>
      </div>

      <div class="form-group">
        <label for="invDueDate">Due Date</label>
        <input type="date" id="invDueDate" value="${dueDate}" required>
      </div>

      <div class="form-group">
        <label for="invClientName">Bill To — Client Name</label>
        <input type="text" id="invClientName" required>
      </div>

      <div class="form-group">
        <label for="invClientAddress">Client Address</label>
        <input type="text" id="invClientAddress" placeholder="City, Country">
      </div>

      <div class="form-group">
        <label for="invClientEmail">Client Email</label>
        <input type="email" id="invClientEmail" placeholder="client@example.com">
      </div>

      <div class="form-group">
        <label>Items</label>
        <div id="invItems">
          <div class="invoice-item-row">
            <input type="text" class="inv-item-desc" placeholder="Description" required>
            <input type="number" class="inv-item-qty" placeholder="Qty" min="1" step="1" value="1" required>
            <input type="number" class="inv-item-rate" placeholder="Rate (TZS)" min="0" step="1" required>
          </div>
        </div>
        <button type="button" class="btn-cancel" id="addInvoiceItem" style="margin-top:8px;">+ Add Item</button>
      </div>

      <div class="form-group">
        <label for="invNotes">Notes</label>
        <textarea id="invNotes" rows="2">Thank you for your business.</textarea>
      </div>

      <div class="form-group">
        <label for="invBankDetails">Bank Details (one per line)</label>
        <textarea id="invBankDetails" rows="3" placeholder="NMB BANK — 23310052425"></textarea>
      </div>

      <div class="form-group">
        <label for="invTermsText">Terms &amp; Conditions</label>
        <textarea id="invTermsText" rows="2">Payment is due within the terms stated above.</textarea>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" id="backToTypes">← Back</button>
        <button type="submit" class="btn-primary">Generate Invoice</button>
      </div>
    </form>
  `
}

function attachInvoiceHandlers() {
  document.getElementById('backToTypes')?.addEventListener('click', backToTypes)

  document.getElementById('addInvoiceItem')?.addEventListener('click', () => {
    const container = document.getElementById('invItems')
    const row = document.createElement('div')
    row.className = 'invoice-item-row'
    row.innerHTML = `
      <input type="text" class="inv-item-desc" placeholder="Description">
      <input type="number" class="inv-item-qty" placeholder="Qty" min="1" step="1" value="1">
      <input type="number" class="inv-item-rate" placeholder="Rate (TZS)" min="0" step="1">
    `
    container.appendChild(row)
  })

  document.getElementById('invoiceForm')?.addEventListener('submit', (event) => {
    event.preventDefault()

    const items = Array.from(document.querySelectorAll('#invItems .invoice-item-row'))
      .map((row) => ({
        desc: row.querySelector('.inv-item-desc').value.trim(),
        qty: Number(row.querySelector('.inv-item-qty').value) || 0,
        rate: Number(row.querySelector('.inv-item-rate').value) || 0,
      }))
      .filter((item) => item.desc && item.qty > 0)

    if (items.length === 0) {
      showToast('Please add at least one item', 'error')
      return
    }

    const data = {
      number: document.getElementById('invNumber').value.trim(),
      date: document.getElementById('invDate').value,
      terms: document.getElementById('invTerms').value.trim(),
      dueDate: document.getElementById('invDueDate').value,
      clientName: document.getElementById('invClientName').value.trim(),
      clientAddress: document.getElementById('invClientAddress').value.trim(),
      clientEmail: document.getElementById('invClientEmail').value.trim(),
      items,
      notes: document.getElementById('invNotes').value.trim(),
      bankDetails: document.getElementById('invBankDetails').value.trim(),
      termsText: document.getElementById('invTermsText').value.trim(),
    }

    generateInvoicePdf(data)
  })
}

async function generateInvoicePdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 50
  let y = 60

  try {
    const logoImg = await loadImage('../images/logo.png')
    doc.addImage(logoImg, 'PNG', margin, y - 15, 60, 60)
  } catch (err) {}

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor('#0F2A44')
  doc.text('BLECA SmartLabs', margin + 75, y + 10)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#6b7280')
  doc.text('CITT Building, Mbeya University of Science and Technology', margin + 75, y + 24)
  doc.text('Mbeya, Tanzania', margin + 75, y + 36)
  doc.text('finance@blecasmartlabs.com  |  0746 044 144', margin + 75, y + 48)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(28)
  doc.setTextColor('#D4A853')
  doc.text('INVOICE', pageWidth - margin, y + 10, { align: 'right' })

  doc.setFontSize(10)
  doc.setTextColor('#0F2A44')
  doc.text(`Invoice # ${data.number}`, pageWidth - margin, y + 30, { align: 'right' })

  const totalAmount = data.items.reduce((sum, item) => sum + item.qty * item.rate, 0)

  doc.setFont('helvetica', 'bold')
  doc.text(`Balance Due: ${formatMoney(totalAmount, 'TZS')}`, pageWidth - margin, y + 48, { align: 'right' })

  y += 75
  doc.setDrawColor('#D4A853')
  doc.setLineWidth(1)
  doc.line(margin, y, pageWidth - margin, y)

  y += 25
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#6b7280')
  doc.text(`Invoice Date: ${formatDateLong(data.date)}`, margin, y)
  doc.text(`Terms: ${data.terms}`, pageWidth / 2, y)
  doc.text(`Due Date: ${formatDateLong(data.dueDate)}`, pageWidth - margin, y, { align: 'right' })

  y += 40
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor('#0F2A44')
  doc.text('Bill To', margin, y)

  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor('#1A1A1A')
  doc.text(data.clientName, margin, y)

  if (data.clientAddress) {
    y += 14
    doc.setFontSize(10)
    doc.setTextColor('#6b7280')
    doc.text(data.clientAddress, margin, y)
  }

  if (data.clientEmail) {
    y += 14
    doc.setFontSize(10)
    doc.setTextColor('#6b7280')
    doc.text(data.clientEmail, margin, y)
  }

  y += 30
  doc.setFillColor('#0F2A44')
  doc.rect(margin, y, pageWidth - margin * 2, 24, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor('#F8F6F1')
  doc.text('Description', margin + 10, y + 16)
  doc.text('Qty', pageWidth - margin - 200, y + 16, { align: 'right' })
  doc.text('Rate', pageWidth - margin - 100, y + 16, { align: 'right' })
  doc.text('Amount', pageWidth - margin - 10, y + 16, { align: 'right' })

  y += 24
  doc.setFont('helvetica', 'normal')
  doc.setTextColor('#1A1A1A')

  data.items.forEach((item, index) => {
    if (index % 2 === 1) {
      doc.setFillColor('#F8F6F1')
      doc.rect(margin, y, pageWidth - margin * 2, 22, 'F')
    }

    doc.setFontSize(10)
    doc.text(item.desc.substring(0, 45), margin + 10, y + 15)
    doc.text(String(item.qty), pageWidth - margin - 200, y + 15, { align: 'right' })
    doc.text(formatMoney(item.rate, 'TZS'), pageWidth - margin - 100, y + 15, { align: 'right' })
    doc.text(formatMoney(item.qty * item.rate, 'TZS'), pageWidth - margin - 10, y + 15, { align: 'right' })

    y += 22
  })

  y += 15
  doc.setDrawColor('#9ca3af')
  doc.setLineWidth(0.5)
  doc.line(pageWidth - margin - 250, y, pageWidth - margin, y)

  y += 20
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor('#6b7280')
  doc.text('Sub Total', pageWidth - margin - 250, y)
  doc.text(formatMoney(totalAmount, 'TZS'), pageWidth - margin - 10, y, { align: 'right' })

  y += 20
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor('#0F2A44')
  doc.text('Total', pageWidth - margin - 250, y)
  doc.text(formatMoney(totalAmount, 'TZS'), pageWidth - margin - 10, y, { align: 'right' })

  y += 20
  doc.setFillColor('#F8F6F1')
  doc.rect(pageWidth - margin - 250, y - 14, 250, 24, 'F')
  doc.setFontSize(12)
  doc.text('Balance Due', pageWidth - margin - 250 + 10, y + 2)
  doc.text(formatMoney(totalAmount, 'TZS'), pageWidth - margin - 10, y + 2, { align: 'right' })

  y += 50
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor('#0F2A44')
  doc.text('Notes', margin, y)

  y += 16
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#6b7280')
  doc.text(data.notes || '', margin, y, { maxWidth: pageWidth - margin * 2 })

  if (data.bankDetails) {
    y += 30
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor('#0F2A44')
    doc.text('Bank Transfer Details', margin, y)

    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor('#6b7280')
    data.bankDetails.split('\n').forEach((line) => {
      doc.text(line, margin, y)
      y += 13
    })
  }

  if (data.termsText) {
    y += 20
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor('#0F2A44')
    doc.text('Terms & Conditions', margin, y)

    y += 16
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor('#6b7280')
    doc.text(data.termsText, margin, y, { maxWidth: pageWidth - margin * 2 })
  }

  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFontSize(9)
  doc.setTextColor('#9ca3af')
  doc.text(
    'This is a computer-generated invoice from BLECA SmartLabs.',
    pageWidth / 2,
    pageHeight - 30,
    { align: 'center' }
  )

  await downloadAndArchive(
    doc,
    `Invoice-${data.number}.pdf`,
    'Invoice',
    `Generated invoice ${data.number}${data.clientName ? ` · ${data.clientName}` : ''}`
  )
}

// ===== CERTIFICATE (Microsoft style) =====
function certificateFormHtml() {
  const today = new Date().toISOString().slice(0, 10)

  return `
    <form id="certificateForm" class="doc-form">
      <div class="form-group">
        <label for="certNumber">Certificate Number</label>
        <input type="text" id="certNumber" value="BLECA-CERT-2026-0001" required>
      </div>

      <div class="form-group">
        <label for="certStudent">Student Full Name</label>
        <input type="text" id="certStudent" placeholder="Full name" required>
      </div>

      <div class="form-group">
        <label for="certCourse">Course / Program Title</label>
        <input type="text" id="certCourse" placeholder="e.g. Internet of Things Bootcamp" required>
      </div>

      <div class="form-group">
        <label for="certDuration">Duration</label>
        <input type="text" id="certDuration" placeholder="e.g. 5 days (14 – 18 October 2026)" required>
      </div>

      <div class="form-group">
        <label for="certDate">Date of Award</label>
        <input type="date" id="certDate" value="${today}" required>
      </div>

      <div class="form-group">
        <label for="certLocation">Location</label>
        <input type="text" id="certLocation" value="Mbeya, Tanzania" required>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" id="backToTypes">← Back</button>
        <button type="submit" class="btn-primary">Generate Certificate</button>
      </div>
    </form>
  `
}

function attachCertificateHandlers() {
  document.getElementById('backToTypes')?.addEventListener('click', backToTypes)

  document.getElementById('certificateForm')?.addEventListener('submit', (event) => {
    event.preventDefault()

    const data = {
      number: document.getElementById('certNumber').value.trim(),
      student: document.getElementById('certStudent').value.trim(),
      course: document.getElementById('certCourse').value.trim(),
      duration: document.getElementById('certDuration').value.trim(),
      date: document.getElementById('certDate').value,
      location: document.getElementById('certLocation').value.trim(),
    }

    generateCertificatePdf(data)
  })
}

async function generateCertificatePdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 30

  // ===== SOFT CREAM BACKGROUND =====
  doc.setFillColor('#F8F6F1')
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  // ===== OUTER NAVY BAND =====
  doc.setFillColor('#0F2A44')
  doc.rect(0, 0, pageWidth, 26, 'F')
  doc.rect(0, pageHeight - 26, pageWidth, 26, 'F')

  // ===== GOLD THIN BORDER =====
  doc.setDrawColor('#D4A853')
  doc.setLineWidth(2)
  doc.rect(margin + 14, margin + 14, pageWidth - (margin + 14) * 2, pageHeight - (margin + 14) * 2)

  // ===== INNER HAIRLINE BORDER =====
  doc.setDrawColor('#D4A853')
  doc.setLineWidth(0.5)
  doc.rect(margin + 22, margin + 22, pageWidth - (margin + 22) * 2, pageHeight - (margin + 22) * 2)

  // ===== DECORATIVE CORNER ORNAMENTS =====
  const corners = [
    { x: margin + 22, y: margin + 22, dx: 1, dy: 1 },
    { x: pageWidth - margin - 22, y: margin + 22, dx: -1, dy: 1 },
    { x: margin + 22, y: pageHeight - margin - 22, dx: 1, dy: -1 },
    { x: pageWidth - margin - 22, y: pageHeight - margin - 22, dx: -1, dy: -1 },
  ]

  doc.setDrawColor('#D4A853')
  doc.setLineWidth(1.2)
  corners.forEach((c) => {
    const size = 30
    doc.line(c.x, c.y, c.x + c.dx * size, c.y)
    doc.line(c.x, c.y, c.x, c.y + c.dy * size)
    doc.setLineWidth(0.6)
    doc.rect(
      c.x + (c.dx === 1 ? 6 : -12),
      c.y + (c.dy === 1 ? 6 : -12),
      6,
      6
    )
    doc.setLineWidth(1.2)
  })

  // ===== LOGO (top center) =====
  try {
    const logoImg = await loadImage('../images/logo.png')
    doc.addImage(logoImg, 'PNG', pageWidth / 2 - 35, margin + 45, 70, 70)
  } catch (err) {}

  // ===== COMPANY NAME =====
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor('#0F2A44')
  doc.text('BLECA SmartLabs', pageWidth / 2, margin + 145, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#6b7280')
  doc.text(
    'CITT Building, Mbeya University of Science and Technology — Mbeya, Tanzania',
    pageWidth / 2,
    margin + 162,
    { align: 'center' }
  )

  // ===== MAIN TITLE =====
  doc.setFont('times', 'bold')
  doc.setFontSize(42)
  doc.setTextColor('#D4A853')
  doc.text('CERTIFICATE', pageWidth / 2, margin + 225, { align: 'center' })

  doc.setFont('times', 'italic')
  doc.setFontSize(14)
  doc.setTextColor('#0F2A44')
  doc.text('of Completion', pageWidth / 2, margin + 250, { align: 'center' })

  // ===== GOLD DIVIDER =====
  doc.setDrawColor('#D4A853')
  doc.setLineWidth(1)
  doc.line(pageWidth / 2 - 150, margin + 265, pageWidth / 2 + 150, margin + 265)

  // ===== PRESENTATION LINE =====
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor('#6b7280')
  doc.text('This certificate is proudly presented to', pageWidth / 2, margin + 295, { align: 'center' })

  // ===== STUDENT NAME =====
  doc.setFont('times', 'bolditalic')
  doc.setFontSize(36)
  doc.setTextColor('#0F2A44')
  doc.text(data.student, pageWidth / 2, margin + 340, { align: 'center' })

  doc.setDrawColor('#D4A853')
  doc.setLineWidth(1)
  const nameWidth = doc.getTextWidth(data.student)
  doc.line(
    pageWidth / 2 - nameWidth / 2 - 20,
    margin + 350,
    pageWidth / 2 + nameWidth / 2 + 20,
    margin + 350
  )

  // ===== ACHIEVEMENT LINE =====
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor('#6b7280')
  doc.text(
    'for successfully completing the program',
    pageWidth / 2,
    margin + 375,
    { align: 'center' }
  )

  // ===== COURSE =====
  doc.setFont('times', 'bold')
  doc.setFontSize(20)
  doc.setTextColor('#0F2A44')
  doc.text(data.course, pageWidth / 2, margin + 405, { align: 'center' })

  // ===== DURATION =====
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor('#6b7280')
  doc.text(data.duration, pageWidth / 2, margin + 428, { align: 'center' })

  // ===== GOLD SEAL (bottom center) =====
  const sealX = pageWidth / 2
  const sealY = pageHeight - margin - 95
  const sealR = 32

  doc.setDrawColor('#D4A853')
  doc.setFillColor('#F8F6F1')
  doc.setLineWidth(2)
  doc.circle(sealX, sealY, sealR, 'FD')

  doc.setDrawColor('#D4A853')
  doc.setLineWidth(0.5)
  doc.circle(sealX, sealY, sealR - 6)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor('#D4A853')
  doc.text('BLECA', sealX, sealY - 6, { align: 'center' })
  doc.text('OFFICIAL', sealX, sealY + 6, { align: 'center' })
  doc.text('2026', sealX, sealY + 18, { align: 'center' })

  // ===== SIGNATURE (left) =====
  const sigY = pageHeight - margin - 90

  doc.setDrawColor('#6b7280')
  doc.setLineWidth(0.7)
  doc.line(margin + 80, sigY, margin + 280, sigY)

  doc.setFont('times', 'bolditalic')
  doc.setFontSize(14)
  doc.setTextColor('#0F2A44')
  doc.text('Chris Bwesa', margin + 80, sigY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#6b7280')
  doc.text('Chief Executive Officer', margin + 80, sigY + 32)
  doc.text('BLECA SmartLabs', margin + 80, sigY + 46)

  // ===== DATE (right) =====
  doc.setDrawColor('#6b7280')
  doc.setLineWidth(0.7)
  doc.line(pageWidth - margin - 280, sigY, pageWidth - margin - 80, sigY)

  doc.setFont('times', 'bolditalic')
  doc.setFontSize(14)
  doc.setTextColor('#0F2A44')
  doc.text('Date of Award', pageWidth - margin - 280, sigY + 18)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor('#6b7280')
  doc.text(formatDateLong(data.date), pageWidth - margin - 280, sigY + 32)
  doc.text(data.location, pageWidth - margin - 280, sigY + 46)

  // ===== CERTIFICATE NUMBER =====
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor('#D4A853')
  doc.text(
    `Certificate No: ${data.number}`,
    pageWidth / 2,
    pageHeight - margin - 32,
    { align: 'center' }
  )

  await downloadAndArchive(
    doc,
    `Certificate-${data.number}.pdf`,
    'Other',
    `Generated certificate ${data.number}`
  )
}

// ===== PROPOSAL =====
function proposalFormHtml() {
  const today = new Date().toISOString().slice(0, 10)

  return `
    <form id="proposalForm" class="doc-form">
      <div class="form-group">
        <label for="propNumber">Proposal Number</label>
        <input type="text" id="propNumber" value="BLECA-PROP-2026-0001" required>
      </div>

      <div class="form-group">
        <label for="propDate">Date</label>
        <input type="date" id="propDate" value="${today}" required>
      </div>

      <div class="form-group">
        <label for="propTitle">Project Title</label>
        <input type="text" id="propTitle" placeholder="e.g. IoT Monitoring System for Poultry Farming" required>
      </div>

      <div class="form-group">
        <label for="propClient">Prepared For (Client)</label>
        <input type="text" id="propClient" placeholder="Client name and organization" required>
      </div>

      <div class="form-group">
        <label for="propSummary">Executive Summary</label>
        <textarea id="propSummary" rows="3" placeholder="Short overview of the proposal" required></textarea>
      </div>

      <div class="form-group">
        <label for="propBackground">Client Background</label>
        <textarea id="propBackground" rows="3" placeholder="Who the client is and their situation"></textarea>
      </div>

      <div class="form-group">
        <label for="propProblem">Problem Statement</label>
        <textarea id="propProblem" rows="3" placeholder="What problem is being solved"></textarea>
      </div>

      <div class="form-group">
        <label for="propSolution">Proposed Solution</label>
        <textarea id="propSolution" rows="3" placeholder="Our proposed approach"></textarea>
      </div>

      <div class="form-group">
        <label for="propScope">Scope of Work (one item per line)</label>
        <textarea id="propScope" rows="5" placeholder="Design of the system&#10;Hardware build and testing&#10;Deployment and training"></textarea>
      </div>

      <div class="form-group">
        <label for="propTimeline">Timeline (one phase per line)</label>
        <textarea id="propTimeline" rows="4" placeholder="Phase 1: Research — 2 weeks&#10;Phase 2: Prototype — 3 weeks&#10;Phase 3: Deployment — 2 weeks"></textarea>
      </div>

      <div class="form-group">
        <label for="propBudget">Budget (one item per line: label | amount in TZS)</label>
        <textarea id="propBudget" rows="5" placeholder="Hardware components | 1,500,000&#10;Development | 2,000,000&#10;Training | 500,000"></textarea>
      </div>

      <div class="form-group">
        <label for="propPayment">Payment Terms</label>
        <textarea id="propPayment" rows="3">50% upon acceptance of proposal, 50% upon completion.</textarea>
      </div>

      <div class="form-group">
        <label for="propTeam">Team (one name per line: name — role)</label>
        <textarea id="propTeam" rows="4" placeholder="Chris Bwesa — Chief Executive Officer&#10;Faida Sylivester — Finance &amp; Accounting Lead"></textarea>
      </div>

      <div class="form-group">
        <label for="propTerms">Terms &amp; Conditions</label>
        <textarea id="propTerms" rows="3">This proposal is valid for 30 days from the date above.</textarea>
      </div>

      <div class="modal-actions">
        <button type="button" class="btn-cancel" id="backToTypes">← Back</button>
        <button type="submit" class="btn-primary">Generate Proposal</button>
      </div>
    </form>
  `
}

function attachProposalHandlers() {
  document.getElementById('backToTypes')?.addEventListener('click', backToTypes)

  document.getElementById('proposalForm')?.addEventListener('submit', (event) => {
    event.preventDefault()

    const toLines = (text) =>
      text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)

    const parseBudget = (text) =>
      toLines(text).map((line) => {
        const [label, amount] = line.split('|').map((part) => part.trim())
        return {
          label: label || '',
          amount: Number(String(amount).replace(/[^0-9.-]/g, '')) || 0,
        }
      })

    const data = {
      number: document.getElementById('propNumber').value.trim(),
      date: document.getElementById('propDate').value,
      title: document.getElementById('propTitle').value.trim(),
      client: document.getElementById('propClient').value.trim(),
      summary: document.getElementById('propSummary').value.trim(),
      background: document.getElementById('propBackground').value.trim(),
      problem: document.getElementById('propProblem').value.trim(),
      solution: document.getElementById('propSolution').value.trim(),
      scope: toLines(document.getElementById('propScope').value),
      timeline: toLines(document.getElementById('propTimeline').value),
      budget: parseBudget(document.getElementById('propBudget').value),
      payment: document.getElementById('propPayment').value.trim(),
      team: toLines(document.getElementById('propTeam').value),
      terms: document.getElementById('propTerms').value.trim(),
    }

    generateProposalPdf(data)
  })
}

async function generateProposalPdf(data) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 50
  let y = 60

  // ===== COVER =====
  doc.setFillColor('#0F2A44')
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  try {
    const logoImg = await loadImage('../images/logo.png')
    doc.addImage(logoImg, 'PNG', pageWidth / 2 - 40, 110, 80, 80)
  } catch (err) {}

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor('#F8F6F1')
  doc.text('BLECA SmartLabs', pageWidth / 2, 230, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor('#D4A853')
  doc.text('PROPOSAL', pageWidth / 2, 265, { align: 'center' })

  doc.setDrawColor('#D4A853')
  doc.setLineWidth(1)
  doc.line(pageWidth / 2 - 60, 278, pageWidth / 2 + 60, 278)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor('#F8F6F1')
  doc.text(data.title, pageWidth / 2, 330, { align: 'center', maxWidth: pageWidth - 160 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor('#9ca3af')
  doc.text('Prepared for', pageWidth / 2, 400, { align: 'center' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor('#F8F6F1')
  doc.text(data.client, pageWidth / 2, 425, { align: 'center', maxWidth: pageWidth - 160 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor('#9ca3af')
  doc.text(formatDateLong(data.date), pageWidth / 2, 460, { align: 'center' })
  doc.text(`Proposal No: ${data.number}`, pageWidth / 2, 480, { align: 'center' })

  // footer contact
  doc.setFontSize(9)
  doc.setTextColor('#9ca3af')
  doc.text(
    'CITT Building, Mbeya University of Science and Technology — Mbeya, Tanzania',
    pageWidth / 2,
    pageHeight - 60,
    { align: 'center' }
  )
  doc.text('finance@blecasmartlabs.com  |  0746 044 144', pageWidth / 2, pageHeight - 44, {
    align: 'center',
  })

  // ===== PAGE 2 onwards =====
  doc.addPage()

  y = 60

  const heading = (text) => {
    if (y > pageHeight - 120) {
      doc.addPage()
      y = 60
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.setTextColor('#0F2A44')
    doc.text(text, margin, y)
    y += 20
    doc.setDrawColor('#D4A853')
    doc.setLineWidth(0.8)
    doc.line(margin, y, pageWidth - margin, y)
    y += 16
  }

  const paragraph = (text) => {
    if (!text) return
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor('#1A1A1A')
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2)
    lines.forEach((line) => {
      if (y > pageHeight - 70) {
        doc.addPage()
        y = 60
      }
      doc.text(line, margin, y)
      y += 16
    })
    y += 8
  }

  const list = (items) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor('#1A1A1A')
    items.forEach((item) => {
      if (y > pageHeight - 70) {
        doc.addPage()
        y = 60
      }
      doc.text('•', margin, y)
      const lines = doc.splitTextToSize(item, pageWidth - margin * 2 - 20)
      lines.forEach((line, i) => {
        doc.text(line, margin + 16, y + i * 16)
      })
      y += lines.length * 16 + 4
    })
    y += 8
  }

  // Executive Summary
  heading('Executive Summary')
  paragraph(data.summary)

  // About BLECA
  heading('About BLECA SmartLabs')
  paragraph(
    'BLECA SmartLabs is a technology company based in Mbeya, Tanzania, focused on electronics, IoT, AI, and software engineering. We build practical technology solutions for businesses, institutions, and communities.'
  )

  // Client Background
  if (data.background) {
    heading('Client Background')
    paragraph(data.background)
  }

  // Problem
  if (data.problem) {
    heading('Problem Statement')
    paragraph(data.problem)
  }

  // Solution
  if (data.solution) {
    heading('Proposed Solution')
    paragraph(data.solution)
  }

  // Scope
  if (data.scope.length > 0) {
    heading('Scope of Work')
    list(data.scope)
  }

  // Timeline
  if (data.timeline.length > 0) {
    heading('Timeline')
    list(data.timeline)
  }

  // Budget
  if (data.budget.length > 0) {
    heading('Budget')

    doc.setFillColor('#0F2A44')
    doc.rect(margin, y, pageWidth - margin * 2, 24, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor('#F8F6F1')
    doc.text('Item', margin + 10, y + 16)
    doc.text('Amount', pageWidth - margin - 10, y + 16, { align: 'right' })
    y += 24

    let total = 0
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#1A1A1A')

    data.budget.forEach((row, i) => {
      if (y > pageHeight - 70) {
        doc.addPage()
        y = 60
      }
      if (i % 2 === 1) {
        doc.setFillColor('#F8F6F1')
        doc.rect(margin, y, pageWidth - margin * 2, 22, 'F')
      }
      doc.setFontSize(11)
      doc.text(row.label, margin + 10, y + 15)
      doc.text(formatMoney(row.amount, 'TZS'), pageWidth - margin - 10, y + 15, { align: 'right' })
      total += row.amount
      y += 22
    })

    // total
    doc.setFillColor('#F8F6F1')
    doc.rect(margin, y, pageWidth - margin * 2, 26, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor('#0F2A44')
    doc.text('Total', margin + 10, y + 18)
    doc.text(formatMoney(total, 'TZS'), pageWidth - margin - 10, y + 18, { align: 'right' })
    y += 36
  }

  // Payment Terms
  if (data.payment) {
    heading('Payment Terms')
    paragraph(data.payment)
  }

  // Team
  if (data.team.length > 0) {
    heading('Team')
    list(data.team)
  }

  // Terms
  if (data.terms) {
    heading('Terms & Conditions')
    paragraph(data.terms)
  }

  // Acceptance
  heading('Acceptance')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor('#1A1A1A')
  doc.text('Accepted for and on behalf of the client:', margin, y + 10)

  y += 60
  doc.setDrawColor('#9ca3af')
  doc.setLineWidth(0.7)
  doc.line(margin, y, margin + 200, y)
  doc.line(pageWidth - margin - 200, y, pageWidth - margin, y)

  doc.setFontSize(10)
  doc.setTextColor('#6b7280')
  doc.text('Name and Signature', margin, y + 16)
  doc.text('Date', pageWidth - margin - 200, y + 16)

  // ===== FOOTER on every page =====
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(9)
    doc.setTextColor('#9ca3af')
    doc.text(
      `BLECA SmartLabs — Proposal ${data.number} — Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 25,
      { align: 'center' }
    )
  }

  await downloadAndArchive(
    doc,
    `Proposal-${data.number}.pdf`,
    'Other',
    `Generated proposal ${data.number}`
  )
}