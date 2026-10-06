// AI chatbot powered by the BLECA Finance backend (Google Gemini).

const API_URL = 'https://bleca-finance-backend.onrender.com/chat'

const chatbot = document.querySelector('#chatbot')

if (chatbot) {
  const toggle = chatbot.querySelector('#chatbot-toggle')
  const panel = chatbot.querySelector('#chatbot-panel')
  const closeButton = chatbot.querySelector('#chatbot-close')
  const messageList = chatbot.querySelector('#chatbot-messages')
  const form = chatbot.querySelector('#chatbot-form')
  const input = chatbot.querySelector('#chatbot-input')
  const sendButton = chatbot.querySelector('.chatbot-send')

  let hasWelcomed = false
  let isWaiting = false

  // Add a chat message bubble
  const addMessage = (text, sender) => {
    const message = document.createElement('p')
    message.className = `chatbot-message chatbot-message--${sender}`
    message.textContent = text
    messageList.append(message)
    messageList.scrollTop = messageList.scrollHeight
    return message
  }

  // Show quick reply buttons only once
  const addQuickReplies = () => {
    const quickReplies = document.createElement('div')
    quickReplies.className = 'chatbot-quick-replies'

    const questions = [
      ['About BLECA', 'What is BLECA SmartLabs?'],
      ['Finance services', 'What services does the Finance department provide?'],
      ['Contact', 'How can I contact BLECA?'],
    ]

    questions.forEach(([label, question]) => {
      const button = document.createElement('button')
      button.className = 'chatbot-quick-reply'
      button.type = 'button'
      button.textContent = label
      button.addEventListener('click', () => {
        input.value = question
        form.requestSubmit()
      })
      quickReplies.append(button)
    })

    messageList.append(quickReplies)
    messageList.scrollTop = messageList.scrollHeight
  }

  // Send the question to the backend
  const sendToBackend = async (question) => {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question }),
    })

    if (!response.ok) {
      throw new Error('Backend error')
    }

    const data = await response.json()
    return data.reply || "I couldn't find an answer. Please try again."
  }

  // Open / close the panel
  const openChat = () => {
    panel.hidden = false
    toggle.setAttribute('aria-expanded', 'true')
    toggle.setAttribute('aria-label', 'Close chat')

    if (!hasWelcomed) {
      addMessage(
        "Hello! I'm the BLECA Finance assistant. Ask me about our department, services, or how to contact us.",
        'assistant'
      )
      addQuickReplies()
      hasWelcomed = true
    }

    input.focus()
  }

  const closeChat = () => {
    panel.hidden = true
    toggle.setAttribute('aria-expanded', 'false')
    toggle.setAttribute('aria-label', 'Open chat')
    toggle.focus()
  }

  toggle.addEventListener('click', () => {
    if (panel.hidden) {
      openChat()
    } else {
      closeChat()
    }
  })

  closeButton.addEventListener('click', closeChat)

  // Handle send
  form.addEventListener('submit', async (event) => {
    event.preventDefault()
    const question = input.value.trim()

    if (!question || isWaiting) return

    addMessage(question, 'user')
    input.value = ''
    input.disabled = true
    sendButton.disabled = true
    isWaiting = true

    // Remove quick replies after the first message
    chatbot.querySelector('.chatbot-quick-replies')?.remove()

    const typing = addMessage('Typing...', 'assistant')
    typing.classList.add('chatbot-message--typing')

    try {
      const reply = await sendToBackend(question)
      typing.remove()
      addMessage(reply, 'assistant')
    } catch (error) {
      typing.remove()
      addMessage(
        'Sorry, the assistant is not available right now. Please try again or email finance@blecasmartlabs.com.',
        'assistant'
      )
    }

    input.disabled = false
    sendButton.disabled = false
    isWaiting = false
    input.focus()
  })
}