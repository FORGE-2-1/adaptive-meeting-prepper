// import { LanguageModel } from 'chrome://language-model/';

const scanEmailsBtn = document.getElementById('scanEmailsBtn');
const scanCalendarBtn = document.getElementById('scanCalendarBtn');
const captureSlideBtn = document.getElementById('captureSlideBtn');
const resetBtn = document.getElementById('resetBtn');
const generateBtn = document.getElementById('generateBtn');
const useQuestionBtn = document.getElementById('useQuestionBtn');

const emailFilterInput = document.getElementById('emailFilter');
const userNotesInput = document.getElementById('userNotes');
const moodSelect = document.getElementById('mood');
const outputDiv = document.getElementById('output');
const suggestedQuestionDiv = document.getElementById('suggestedQuestion');

const meetingDateInput = document.getElementById('meetingDate');
const meetingTimeInput = document.getElementById('meetingTime');
const meetingDateTimeDisplay = document.getElementById('meetingDateTimeDisplay');

let lmSession = null;
let chatHistory = [];
let suggestedQuestion = null;


userNotesInput.addEventListener('input', () => {
  generateBtn.disabled = !userNotesInput.value.trim();
});

// Manual meeting date/time display update + local storage
function updateMeetingDateTimeDisplay() {
  const date = meetingDateInput.value;
  const time = meetingTimeInput.value;
  if (date && time) {
    meetingDateTimeDisplay.textContent = `Scheduled for: ${date} at ${time}`;
  } else if (date) {
    meetingDateTimeDisplay.textContent = `Scheduled for: ${date}`;
  } else {
    meetingDateTimeDisplay.textContent = 'No meeting date/time set';
  }
  chrome.storage.local.set({ meetingDatetime: { date, time } });
}

meetingDateInput.addEventListener('change', updateMeetingDateTimeDisplay);
meetingTimeInput.addEventListener('change', updateMeetingDateTimeDisplay);

// Load meeting date/time on startup
chrome.storage.local.get('meetingDatetime', data => {
  if (data.meetingDatetime) {
    meetingDateInput.value = data.meetingDatetime.date || '';
    meetingTimeInput.value = data.meetingDatetime.time || '';
    updateMeetingDateTimeDisplay();
  }
});



// Gmail scan flow: open Gmail filtered search and inject scraper
scanEmailsBtn.onclick = async () => {
  // const { accessToken } = await chrome.storage.local.get('accessToken');
  // if (!accessToken) return outputDiv.textContent = 'Please sign in first';

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

function showSuggestedQuestion(question) {
  if (!question) {
    suggestedQuestionDiv.style.display = 'none';
    suggestedQuestionDiv.textContent = '';
    suggestedQuestion = null;
    useQuestionBtn.style.display = 'none';
    return;
  }
  suggestedQuestion = question;
  suggestedQuestionDiv.textContent = `Suggested Question: "${question}" (click Use Suggested Question button to add)`;
  suggestedQuestionDiv.style.display = 'block';
  useQuestionBtn.style.display = 'inline-block';
}

useQuestionBtn.onclick = () => {
  if (!suggestedQuestion) return;
  userNotesInput.value += (userNotesInput.value ? '\n\n' : '') + suggestedQuestion;
  userNotesInput.focus();
  showSuggestedQuestion(null);
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

    const { date, time } = await chrome.storage.local.get('meetingDatetime').then(data => data.meetingDatetime || {});
    const meetingDateTime = date ? `${date}${time ? ` at ${time}` : ''}` : 'not set'; // Define meetingDateTime here

    if (!notes) {
      outputDiv.textContent = 'Please provide content to generate prep.';
      return;
    }

    outputDiv.textContent = 'Processing...';

    const inputPrompt = `
    You are a meeting preparation assistant. Your task is to help the user prepare effectively for their upcoming meeting.

    Meeting date and time: ${meetingDateTime}
    User mood: ${mood}

    Here are the user's notes, which include relevant emails, calendar events, and additional context:
    ${notes}

    Based on this information, provide the following in JSON format:
    {
      "summary": "A concise summary of the meeting context.",
      "talkingPoints": ["Key talking point 1", "Key talking point 2", "..."],
      "advice": "Personalized advice or strategies tailored to the user's mood and the meeting's purpose.",
      "risks": ["Potential risk 1", "Potential risk 2", "..."],
      "mitigationStrategies": ["Mitigation strategy 1", "Mitigation strategy 2", "..."]
    }
    Ensure your response is clear, actionable, and empathetic.
    `;

    let finalOutput = '';
    const stream = lmSession.promptStreaming(inputPrompt);
    for await (const chunk of stream) {
      finalOutput += chunk;
    }

    const cleaned = finalOutput
    .replace(/^```json/, '')   // Remove ```json at the start
    .replace(/^json/, '')      // Remove json at the start
    .replace(/```$/, '')       // Remove closing ```
    .trim();                   // Remove extra whitespace


    // Parse the AI's JSON response
    
    const parsedOutput = JSON.parse(cleaned);//finalOutput);
    try {

      outputDiv.innerHTML = `
        <h3>Meeting Prep</h3>
        <p><strong>Summary:</strong> ${parsedOutput.summary}</p>

        <p><strong>Talking Points:</strong></p>
        <ul>
          ${parsedOutput.talkingPoints.map(point => `<li>${point}</li>`).join('')}
        </ul>

        <p><strong>Advice:</strong> ${parsedOutput.advice}</p>

        <p><strong>Risks:</strong></p>
        <ul>
          ${parsedOutput.risks.map(risk => `<li>${risk}</li>`).join('')}
        </ul>

        <p><strong>Mitigation Strategies:</strong></p>
        <ul>
          ${parsedOutput.mitigationStrategies.map(strategy => `<li>${strategy}</li>`).join('')}
        </ul>
      `;
    } catch (e) {
      outputDiv.textContent = parsedOutput; //'Error parsing AI response. Please try again.';
      console.error('Parsing error:', e);
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



function scheduleReminder() {
  chrome.storage.local.get('meetingDatetime', data => {
    const md = data.meetingDatetime;
    if (!md?.date) return;
    const datetimeStr = md.time ? `${md.date}T${md.time}:00` : `${md.date}T09:00:00`;
    const when = new Date(datetimeStr).getTime();
    if (when > Date.now()) {
      chrome.alarms.create('meetingReminder', { when });
    }
  });
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'meetingReminder') {
    chrome.notifications.create('meetingNotif', {
      type: 'basic',
      // iconUrl: 'icon.png',
      title: 'Upcoming Meeting',
      message: 'Your scheduled meeting is approaching.',
    });
  }
});


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


// const moodSelect = document.getElementById('mood');
moodSelect.addEventListener('change', () => {
  document.body.setAttribute('data-mood', moodSelect.value);
});
// Run once on load:
document.body.setAttribute('data-mood', moodSelect.value);
