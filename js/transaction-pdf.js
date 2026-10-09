import { formatMoney } from './currency.js'

const { jsPDF } = window.jspdf

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

export function transactionPdfFileName(tx) {
  const datePart = new Date(tx.date).toISOString().slice(0, 10)
  const slug = String(tx.description || '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)

  return `BLECA-Transaction-${datePart}-${slug || 'record'}.pdf`
}

// Builds a one-page transaction voucher PDF and returns the jsPDF document
export async function buildTransactionPdf(tx) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 50
  let y = 60

  // ===== HEADER =====
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
  doc.setFontSize(20)
  doc.setTextColor('#D4A853')
  doc.text('TRANSACTION VOUCHER', pageWidth - margin, y + 10, { align: 'right' })

  doc.setFontSize(11)
  doc.setTextColor('#0F2A44')
  doc.text(`Ref: BLECA-TX-${String(tx._id).slice(-8).toUpperCase()}`, pageWidth - margin, y + 32, {
    align: 'right',
  })

  y += 75
  doc.setDrawColor('#D4A853')
  doc.setLineWidth(1.5)
  doc.line(margin, y, pageWidth - margin, y)

  // ===== DESCRIPTION =====
  y += 40
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor('#6b7280')
  doc.text(tx.type === 'income' ? 'Income received:' : 'Expense paid:', margin, y)

  y += 22
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor('#0F2A44')
  doc.text(doc.splitTextToSize(tx.description, pageWidth - margin * 2)[0], margin, y)

  // ===== AMOUNT BOX =====
  y += 30
  doc.setFillColor('#F8F6F1')
  doc.rect(margin, y, pageWidth - margin * 2, 60, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor('#6b7280')
  doc.text('Amount:', margin + 20, y + 24)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor('#0F2A44')
  const sign = tx.type === 'income' ? '+' : '−'
  doc.text(`${sign} ${formatMoney(tx.amount, tx.currency)}`, margin + 20, y + 46)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor('#6b7280')
  doc.text(`Payment method: ${tx.paymentMethod || 'Cash'}`, pageWidth - margin - 20, y + 24, {
    align: 'right',
  })
  doc.text(`Date: ${formatDateLong(tx.date)}`, pageWidth - margin - 20, y + 46, { align: 'right' })

  // ===== DETAILS =====
  y += 90
  doc.setFontSize(12)
  doc.setTextColor('#6b7280')
  doc.text('Details:', margin, y)

  const statusLabel = tx.status.charAt(0).toUpperCase() + tx.status.slice(1)
  const details = [
    ['Category', tx.category],
    ['Project', tx.project],
    ['Currency', tx.currency || 'TZS'],
    ['Status', statusLabel],
    ['Created by', tx.createdBy?.name || 'Unknown'],
    ['Approved by', tx.approvedBy?.name || '—'],
  ]

  const colWidth = (pageWidth - margin * 2) / 2
  let rowY = y + 26

  details.forEach(([label, value], index) => {
    const col = index % 2
    const row = Math.floor(index / 2)
    const x = margin + col * colWidth

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor('#9ca3af')
    doc.text(label, x, rowY + row * 34)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor('#1A1A1A')
    doc.text(String(value), x, rowY + row * 34 + 16, { maxWidth: colWidth - 15 })
  })

  y = rowY + 2 * 34 + 10

  // ===== REJECTION REASON =====
  if (tx.status === 'rejected' && tx.rejectionReason) {
    doc.setFillColor('#FDECEC')
    doc.rect(margin, y, pageWidth - margin * 2, 46, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor('#c1121f')
    doc.text('Rejection reason:', margin + 14, y + 18)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor('#c1121f')
    doc.text(doc.splitTextToSize(tx.rejectionReason, pageWidth - margin * 2 - 28)[0], margin + 14, y + 34)
    y += 62
  }

  // ===== SIGNATURE =====
  y += 40
  doc.setDrawColor('#9ca3af')
  doc.setLineWidth(0.5)
  doc.line(margin, y, margin + 200, y)

  y += 16
  doc.setFontSize(11)
  doc.setTextColor('#6b7280')

  if (tx.status === 'pending') {
    doc.text('Awaiting approval', margin, y)
    y += 14
    doc.text('Chief Executive Officer, BLECA SmartLabs', margin, y)
  } else {
    doc.text(tx.approvedBy?.name || 'Chris Bwesa', margin, y)
    y += 14
    doc.text(
      `${tx.status === 'approved' ? 'Approved' : 'Reviewed'} by Chief Executive Officer, BLECA SmartLabs`,
      margin,
      y
    )
  }

  // ===== FOOTER =====
  doc.setFontSize(9)
  doc.setTextColor('#9ca3af')
  doc.text(
    'This is a computer-generated transaction voucher from BLECA SmartLabs.',
    pageWidth / 2,
    pageHeight - 30,
    { align: 'center' }
  )

  return doc
}
