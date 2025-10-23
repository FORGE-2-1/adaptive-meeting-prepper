const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const scanEmailsBtn = document.getElementById('scanEmailsBtn');
const scanCalendarBtn = document.getElementById('scanCalendarBtn');
const generateBtn = document.getElementById('generateBtn');
const resetBtn = document.getElementById('resetBtn');
const emailFilterInput = document.getElementById('emailFilter');
const userNotesInput = document.getElementById('userNotes');
const moodSelect = document.getElementById('mood');
const outputDiv = document.getElementById('output');
const captureSlideBtn = document.getElementById('captureSlideBtn');
const suggestedQuestionDiv = document.getElementById('suggestedQuestion');
const useQuestionBtn = document.getElementById('useQuestionBtn');

let lmSession = null;
let chatHistory = [];

async function updateUIOnSignIn(signedIn) {
  signInBtn.style.display = signedIn ? 'none' : 'inline-block';
  signOutBtn.style.display = signedIn ? 'inline-block' : 'none';
  scanEmailsBtn.disabled = !signedIn;
  scanCalendarBtn.disabled = !signedIn;
  generateBtn.disabled = !signedIn;
}

async function signIn() {
  try {
    const clientId = "YOUR-CLIENT-ID from google OAuth 2.0 Client IDs in credentials section"//chrome.runtime.getManifest().oauth2.client_id;
    const redirectUri = chrome.identity.getRedirectURL();
    console.log(redirectUri)
    const scopes = "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly"//chrome.runtime.getManifest().oauth2.scopes.join(' ');
    await chrome.identity.launchWebAuthFlow({
      'url': `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=token&redirect_uri=${redirectUri}&scope=${encodeURIComponent(scopes)}`,
      'interactive': true
    }, async redirectUrl => {
      console.log('Redirect URL:', redirectUrl); // Log the redirect URL
      if (redirectUrl) {
        // Extract token from redirectUrl
        const url = new URL(redirectUrl);
        const accessToken = url.hash.match(/access_token=([^&]+)/)[1];
        console.log("access token-----"+accessToken)
        chrome.storage.local.set({accessToken});
        await updateUIOnSignIn(true);
      }
    });
  } catch (e) {
    outputDiv.textContent = 'Sign-in failed. Please try again.'+ e;
  }
}

async function signOut() {
  chrome.storage.local.remove('accessToken');
  await updateUIOnSignIn(false);
}

signInBtn.onclick = signIn;
signOutBtn.onclick = signOut;

async function checkSignIn() {
  const { accessToken } = await chrome.storage.local.get('accessToken');
  await updateUIOnSignIn(!!accessToken);
}

await checkSignIn();

// Gmail scan flow: open Gmail filtered search and inject scraper
scanEmailsBtn.onclick = async () => {
  const { accessToken } = await chrome.storage.local.get('accessToken');
  if (!accessToken) return outputDiv.textContent = 'Please sign in first';

  const filter = emailFilterInput.value.trim() || 'label:inbox';
  const query = encodeURIComponent(filter);
  const gmailSearchUrl = `https://mail.google.com/mail/u/0/#search/${query}`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.tabs.update(tab.id, { url: gmailSearchUrl });
  outputDiv.textContent = 'Loading Gmail...';
  setTimeout(() => {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/gmail_scraper.js']
    });
  }, 3000);
};

// Listen to emails scraped from content script
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'emailsScraped') {
    // Compose a brief summary for AI input
    const emailData = msg.data.map(m => `${m.date} from ${m.from}: ${m.subject}`).join('\n');
    userNotesInput.value += (userNotesInput.value ? '\n\n' : '') + `Email Summary:\n${emailData}`;
    outputDiv.textContent = 'Emails loaded and appended to notes.';
  }
});

// Calendar scan fetch upcoming meetings
scanCalendarBtn.onclick = async () => {
  try {
    const { accessToken } = await chrome.storage.local.get('accessToken');
    if (!accessToken) return outputDiv.textContent = 'Please sign in first';

    const nowISO = new Date().toISOString();
    const maxTime = new Date(Date.now() + 48 * 3600 * 1000).toISOString();

    const calendarResponse = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${nowISO}&timeMax=${maxTime}&singleEvents=true&orderBy=startTime`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const calendarData = await calendarResponse.json();

    if (!calendarData.items || calendarData.items.length === 0)
      return outputDiv.textContent = 'No upcoming meetings in next 48 hours.';

    const eventsText = calendarData.items.map(ev => {
      const start = ev.start?.dateTime || ev.start?.date || '';
      return `${start} - ${ev.summary}`;
    }).join('\n');
    userNotesInput.value += (userNotesInput.value ? '\n\n' : '') + `Upcoming Meetings:\n${eventsText}`;
    outputDiv.textContent = 'Upcoming meetings added to notes.';
  } catch (error) {
    outputDiv.textContent = `Error fetching calendar: ${error.message}`;
  }
};

// Capture current tab screenshot and append to notes (as base64 placeholder, real app would convert or OCR)
captureSlideBtn.onclick = async () => {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab();//{ format: "jpeg", quality: 40 });
    const screenshotBlob = await (await fetch(dataUrl)).blob();

    await initAISession(); // Ensure the AI session is initialized

    const response = await lmSession.prompt([
      {
        role: "user",
        content: [
          { type: "text", value: "Explain the main topic or slide content shown in this image." },
          { type: "image", value: screenshotBlob }
        ]
      }
    ]);

    console.log(response);
    const explanation = response;
    userNotesInput.value += (userNotesInput.value ? '\n\n' : '') + `Slide Analysis:\n${explanation}`;
    outputDiv.textContent = 'Slide content analyzed and added to notes.';
  } catch (e) {
    outputDiv.textContent = `Screenshot analysis failed: ${e.message}`;
  }
};

// Initialize or restore AI session
async function initAISession() {
  if (lmSession) return;
  const availability = await LanguageModel.availability();
  if (availability !== 'available') {
    outputDiv.textContent = 'AI model not ready, please wait or restart.';
    return;
  }
  const restored = await chrome.storage.local.get('chatContext');
  lmSession = await LanguageModel.create({
    initialPrompts: restored.chatContext || [
      {
        role: 'system',
        content: 'You are Adaptive Meeting Prepper, helping users prepare meetings using email and calendar data. Respond concisely and empathetically, considering the user\'s mood.'
      }
    ],
    outputLanguage: 'en', // Specify default output language as English
    capabilities: ['text', 'image'], // Enable image support
    expectedInputs: [
      { type: "text" },
      { type: "image" }
    ],
    expectedOutputs: [{ type: "text" }]
  });
}

// Function to suggest a follow-up question based on current chat context
async function suggestFollowUpQuestion() {
  if (!lmSession) await initAISession();
  
  if (chatHistory.length === 0) {
    console.log('No conversation history to suggest questions from.');
    if (suggestedQuestionDiv) suggestedQuestionDiv.style.display = 'none';
    return;
  }

  const historyText = chatHistory.map(m => `${m.role}: ${m.content}`).join('\n');

  const questionPrompt = `
Based on the following conversation context, suggest one relevant question or template that the user can ask or think about next.
Respond with only the question and nothing else.

Conversation:
${historyText}
  `;

  try {
    const response = await lmSession.prompt(questionPrompt);
    const suggestedQuestion = response.trim();
    
    if (suggestedQuestion.length > 10) {
      console.log('Suggested question:', suggestedQuestion);
      
      if (suggestedQuestionDiv) {
        suggestedQuestionDiv.textContent = suggestedQuestion;
        suggestedQuestionDiv.style.display = 'block';
      }
      
      if (useQuestionBtn) {
        useQuestionBtn.style.display = 'inline-block';
        useQuestionBtn.onclick = () => {
          userNotesInput.value += (userNotesInput.value ? '\n\n' : '') + suggestedQuestion;
          if (suggestedQuestionDiv) suggestedQuestionDiv.style.display = 'none';
        };
      }
    } else {
      console.log('No suitable question suggested.');
      if (suggestedQuestionDiv) suggestedQuestionDiv.style.display = 'none';
    }
  } catch (e) {
    console.error('Error suggesting follow-up question:', e);
    if (suggestedQuestionDiv) suggestedQuestionDiv.style.display = 'none';
  }
}

// Generate Meeting Prep with streamed output
generateBtn.onclick = async () => {
  try {
    await initAISession();
    const notes = userNotesInput.value.trim();
    const mood = moodSelect.value;

    if (!notes) {
      outputDiv.textContent = 'Please provide content to generate prep.';
      return;
    }

    outputDiv.textContent = 'Processing...';

    const inputPrompt = `
You are a meeting preparation assistant. Your task is to help the user prepare effectively for their upcoming meeting.

User mood: ${mood}

Here are the user's notes, which include relevant emails, calendar events, and additional context:
${notes}

Based on this information, provide the following:
1. A concise summary of the meeting context.
2. Key talking points or agenda items to focus on.
3. Personalized advice or strategies tailored to the user's mood and the meeting's purpose.
4. Any potential risks or challenges to be aware of, along with mitigation strategies.

Ensure your response is clear, actionable, and empathetic.
    `;

    let finalOutput = '';
    const stream = lmSession.promptStreaming(inputPrompt);
    for await (const chunk of stream) {
      finalOutput += chunk;
      outputDiv.textContent = finalOutput;
    }

    chatHistory.push({ role: 'user', content: notes });
    chatHistory.push({ role: 'assistant', content: finalOutput });

    await chrome.storage.local.set({ chatContext: chatHistory });

    // Suggest a follow-up question after generating prep
    await suggestFollowUpQuestion();

  } catch (e) {
    outputDiv.textContent = `Error: ${e.message}`;
  }
};

// Reset session & storage
resetBtn.onclick = async () => {
  if (lmSession) {
    await lmSession.destroy();
    lmSession = null;
  }
  chatHistory = [];
  await chrome.storage.local.remove('chatContext');
  userNotesInput.value = '';
  outputDiv.textContent = 'Session reset. Ready for new prep.';
  if (suggestedQuestionDiv) suggestedQuestionDiv.style.display = 'none';
};

// Load previous session data on load
(async function() {
  const stored = await chrome.storage.local.get('chatContext');
  if (stored.chatContext) {
    chatHistory = stored.chatContext;
    const lastOutput = chatHistory.filter(m => m.role === 'assistant').pop();
    outputDiv.textContent = lastOutput?.content || 'Output restored.';
  }
})();


