// Connect the chat controls and keep the assistant limited to public information.
const chatbot = document.querySelector("#chatbot");

if (chatbot) {
  const toggle = chatbot.querySelector("#chatbot-toggle");
  const panel = chatbot.querySelector("#chatbot-panel");
  const closeButton = chatbot.querySelector("#chatbot-close");
  const messageList = chatbot.querySelector("#chatbot-messages");
  const form = chatbot.querySelector("#chatbot-form");
  const input = chatbot.querySelector("#chatbot-input");
  const sendButton = chatbot.querySelector(".chatbot-send");
  const suggestionList = chatbot.querySelector("#chatbot-suggestions");
  let hasWelcomed = false;
  let isWaiting = false;
  let quickReplies = null;

  // Normalize common BLECA and finance typos only for intent matching.
  const typoCorrections = new Map([
    ["blecca", "bleca"], ["finace", "finance"], ["finanace", "finance"],
    ["servces", "services"], ["servise", "service"], ["servcie", "service"],
    ["conatct", "contact"], ["contcat", "contact"], ["emial", "email"],
    ["phne", "phone"], ["locaton", "location"], ["loction", "location"],
    ["invioce", "invoice"], ["invoce", "invoice"], ["reciept", "receipt"],
    ["recipt", "receipt"], ["budegt", "budget"], ["budjet", "budget"],
    ["balnce", "balance"], ["partnrship", "partnership"], ["projcts", "projects"],
  ]);

  const suggestedQuestions = [
    { label: "About BLECA", question: "What is BLECA SmartLabs?", keywords: ["bleca", "about", "smartlabs"] },
    { label: "Finance services", question: "What services does the Finance department provide?", keywords: ["finance", "accounting", "service", "budget", "payment"] },
    { label: "Contact details", question: "How can I contact BLECA?", keywords: ["contact", "email", "phone", "whatsapp"] },
    { label: "Office hours", question: "What are your office hours?", keywords: ["hour", "open", "time"] },
    { label: "Location", question: "Where is BLECA located?", keywords: ["location", "where", "based"] },
    { label: "Projects", question: "What projects has BLECA built?", keywords: ["project", "water", "crop", "energy", "campus"] },
    { label: "Invoices and receipts", question: "How do I submit an invoice or receipt?", keywords: ["invoice", "receipt", "document"] },
    { label: "Grants and partnerships", question: "Is BLECA open to grants or partnerships?", keywords: ["grant", "funding", "partner", "sponsor"] },
  ];

  const correctKnownTypos = (question) => question.replace(/\b[a-z']+\b/gi, (word) => {
    return typoCorrections.get(word.toLowerCase()) || word;
  });

  // Suggest a few likely complete questions as the visitor types.
  const updateSuggestions = () => {
    const correctedText = correctKnownTypos(input.value).toLowerCase().trim();
    const words = correctedText.match(/[a-z0-9]+/g) || [];
    const matches = suggestedQuestions.filter((suggestion) => suggestion.keywords.some((keyword) => {
      return correctedText.includes(keyword) || words.some((word) => word.length > 1 && keyword.startsWith(word));
    })).slice(0, 3);

    suggestionList.replaceChildren();
    suggestionList.hidden = correctedText.length < 2 || matches.length === 0;

    matches.forEach((suggestion) => {
      const button = document.createElement("button");
      button.className = "chatbot-suggestion";
      button.type = "button";
      button.setAttribute("role", "option");
      button.textContent = suggestion.label;
      button.addEventListener("click", () => {
        input.value = suggestion.question;
        suggestionList.hidden = true;
        input.focus();
      });
      suggestionList.append(button);
    });
  };

  // Add plain text messages so user input is never interpreted as HTML.
  const addMessage = (text, sender, extraClass = "") => {
    const message = document.createElement("div");
    message.className = `chatbot-message chatbot-message--${sender}${extraClass ? ` ${extraClass}` : ""}`;

    let list = null;
    text.split(/\r?\n/).forEach((line) => {
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);

      if (bullet) {
        if (!list) {
          list = document.createElement("ul");
          message.append(list);
        }

        const item = document.createElement("li");
        item.textContent = bullet[1];
        list.append(item);
        return;
      }

      list = null;
      if (line.trim()) {
        const paragraph = document.createElement("p");
        paragraph.textContent = line;
        message.append(paragraph);
      }
    });

    messageList.append(message);
    messageList.scrollTop = messageList.scrollHeight;
    return message;
  };

  // Offer common starting points until the visitor sends their first question.
  const addQuickReplies = () => {
    quickReplies = document.createElement("div");
    quickReplies.className = "chatbot-quick-replies";
    quickReplies.setAttribute("role", "group");
    quickReplies.setAttribute("aria-label", "Suggested questions");

    [
      ["About BLECA", "What is BLECA SmartLabs?"],
      ["Finance services", "What services does the Finance department provide?"],
      ["Contact", "How can I contact BLECA?"],
    ].forEach(([label, question]) => {
      const button = document.createElement("button");
      button.className = "chatbot-quick-reply";
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        input.value = question;
        form.requestSubmit();
      });
      quickReplies.append(button);
    });

    messageList.append(quickReplies);
    messageList.scrollTop = messageList.scrollHeight;
  };

  // Match the requested public FAQ topics; sensitive finance questions get a safe handoff.
  const getReply = (question) => {
    const text = correctKnownTypos(question).toLowerCase();

    if (/\b(fuck|shit|bitch|asshole|idiot|stupid|porn|nude)\b/.test(text)) {
      return "Please keep your questions related to the Finance & Accounting Department.";
    }
    if (/^(hi|hello|hey|hiya|good morning|good afternoon|good evening)\b(?:[\s,!.?]+(?:there|how are you|how's it going|good to see you))*[!.?,\s]*$/.test(text)) {
      return "Hi! Welcome to BLECA. I can help with Finance & Accounting, BLECA's services and projects, contact details, or location. What would you like to know?";
    }
    if (/^(thanks?|thank you|thanks a lot|thank you so much|appreciate it)[!.?,\s]*$/.test(text)) {
      return "You're welcome! Let me know if you have another question about BLECA or Finance & Accounting.";
    }
    if (/\b(money|budget|budgets|balance|balances|salary|salaries|transaction|transactions)\b/.test(text)) {
      return "I can only share general information about the department. Please contact the Finance & Accounting Lead directly for anything specific.";
    }
    if (/\b(help|what can i ask|what can you do)\b/.test(text)) {
      return "You can ask me about:\n- Finance & Accounting services\n- Invoices and receipts\n- Office hours and contact details\n- BLECA's technology services and projects\n- Programs and partnerships";
    }
    if (/\bwhat is bleca\b|\babout bleca\b|\bwhat does bleca do\b|\bwhat is smartlabs\b|\babout smartlabs\b/.test(text)) {
      return "BLECA SmartLabs is an African innovation lab based at the CITT Building at Mbeya University of Science and Technology. It researches, prototypes, and deploys software and hardware for local challenges, while training engineers through real projects.";
    }
    if (/\b(project|projects|portfolio|smart water|crop disease|campus management|smart energy|healthcare data|e-learning)\b/.test(text)) {
      return "BLECA's public projects include:\n- Smart water monitoring\n- AI crop disease detection\n- Campus management platform\n- Smart energy monitoring\n- Healthcare data analytics\n- E-learning platform";
    }
    if (/\b(bootcamp|research|prototype|prototyping|program|programs)\b/.test(text)) {
      return "BLECA works across research, prototypes, and bootcamp training. Its projects are built with local users and include documentation and training for handover.";
    }
    if (/\b(team|staff|people|who works)\b/.test(text)) {
      return "BLECA's public team includes:\n- Chris Bwesa, CEO & Financial Officer\n- Johnson Hassan, Head of AI Research & Development\n- Blandina Kakore, AI Lead\n- Fedelika Maxmus, Project Manager\n- Geofrey Gerazi, EduTech Lead\n- Ipyana Mwaisekwa, Marketing\n- Junior Jackson, Software Lead";
    }
    if (/\b(chris bwesa|ceo|financial officer)\b/.test(text)) {
      return "BLECA's public website lists Chris Bwesa as CEO & Financial Officer. For Finance & Accounting enquiries, email finance@blecasmartlabs.com.";
    }
    if (/\b(invoice|receipt)\b/.test(text)) {
      return "To submit an invoice or receipt, please email it to finance@blecasmartlabs.com or contact the Finance & Accounting Lead.";
    }
    if (/\b(funding|grant|grants|fellowship|fellowships|sponsorship|partnership|partnerships|pilot)\b/.test(text)) {
      return "BLECA welcomes:\n- Grants and fellowships\n- Sponsorship and competitions\n- Institutional partnerships\n- Community pilots\n\nFor general enquiries, email blecasmartlabs@gmail.com.";
    }
    if (/\b(bleca|smartlabs|technology|technologies|software|hardware|artificial intelligence|\bai\b|data infrastructure|web|mobile)\b/.test(text) && /\b(service|services|build|offer|expertise|work)\b/.test(text)) {
      return "BLECA's technology services include:\n- Artificial intelligence\n- Data infrastructure\n- Web and mobile platforms\n- Performance engineering\n- Security and privacy\n- Analytics";
    }
    if (/\b(service|services)\b/.test(text)) {
      return "Finance & Accounting services include:\n- Cash & Bank Management\n- Budgets & Planning\n- Invoicing & Payments\n- Financial Records\n- Reporting\n- Compliance & Audit Support";
    }
    if (/\b(contact|email|phone)\b/.test(text)) {
      return "For Finance & Accounting:\n- Email: finance@blecasmartlabs.com\n- Telephone or WhatsApp: 0746 044 144\n\nFor general BLECA enquiries:\n- Email: blecasmartlabs@gmail.com";
    }
    if (/\b(hours?|open|opening)\b/.test(text)) {
      return "Our office hours are Monday to Friday, 9:00 to 17:00.";
    }
    if (/\b(location|where)\b/.test(text)) {
      return "BLECA SmartLabs is based at the CITT Building, Mbeya University of Science and Technology, Mbeya, Tanzania.";
    }
    if (/\b(department)\b|\bwhat do you do\b/.test(text)) {
      return "The Finance & Accounting Department manages BLECA's cash, budgets, invoices, payments, and financial records. Every shilling is tracked, approved, and documented.";
    }
    return "I'm not sure about that. Please contact us at finance@blecasmartlabs.com and we'll help you.";
  };

  // Show the welcome once per page visit and return focus to the launcher on close.
  toggle.addEventListener("click", () => {
    if (!panel.hidden) {
      closeChat();
      return;
    }

    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    toggle.setAttribute("aria-label", "Close chat");

    if (!hasWelcomed) {
      addMessage("Hello! I'm the BLECA Finance assistant. Ask me about our department, services, or how to contact us.", "assistant");
      addQuickReplies();
      hasWelcomed = true;
    }

    input.focus();
  });

  const closeChat = () => {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open chat");
    toggle.focus();
  };

  closeButton.addEventListener("click", closeChat);

  input.addEventListener("input", updateSuggestions);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      suggestionList.hidden = true;
    }
  });

  // Simulate a short typing pause before sending a safe canned response.
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const question = input.value.trim();

    if (!question || isWaiting) {
      return;
    }

    const correctedQuestion = correctKnownTypos(question);
    addMessage(question, "user");
    if (correctedQuestion !== question) {
      addMessage(`I read that as: ${correctedQuestion}`, "assistant");
    }
    quickReplies?.remove();
    quickReplies = null;
    suggestionList.hidden = true;
    input.value = "";
    input.disabled = true;
    sendButton.disabled = true;
    isWaiting = true;
    const typingMessage = addMessage("Typing...", "assistant", "chatbot-message--typing");

    await new Promise((resolve) => window.setTimeout(resolve, 800));

    typingMessage.remove();
    addMessage(getReply(correctedQuestion), "assistant");
    input.disabled = false;
    sendButton.disabled = false;
    isWaiting = false;
    input.focus();
  });
}