# PrepPulse - Adaptive Meeting Prepper

**Effortless, last-minute meeting prep with AI-powered email, agenda, and document synthesis, right inside Chrome.**

## Overview

Adaptive Meeting Prepper is a Chrome extension designed to help you get meeting-ready in seconds.  
Using built-in AI and content scraping, it summarizes scattered emails, extracts action items, processes slides, and generates actionable, mood-tailored prep, without intrusive logins or OAuth.

---

## Features

- **Gmail Email Scan**: Gather relevant emails via one-click local scraping, no sign-in required.
- **Manual Meeting Date & Time**: Enter date and time for reminders if no calendar integration.
- **Slide Capture & Analysis**: Instantly extract insights from any open document or slide.
- **AI-Powered Meeting Prep**: Summarizes notes, generates actionable talking points, detects risks, and suggests strategies.
- **Mood-Adaptive UI**: Responsive interface colors change to support your confidence, anxiety, or other moods.
- **Suggested Questions**: Smart follow-up questions for focus and clarity.
- **Local Notifications**: Reminds you with Chrome notifications based on your set meeting time.
- **No OAuth Required**: 100% private, easy installation and setup.

---

## Installation

1. Clone or download the repository.
    ```
    git clone [https://github.com/FORGE-2-1/adaptive-meeting-prepper](https://github.com/FORGE-2-1/adaptive-meeting-prepper.git)
    ```
2. Open Google Chrome, go to `chrome://extensions/`
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select the project directory.
5. (If required by your Chrome version) Visit `chrome://flags/` and enable:
    - Prompt API for Gemini Nano
    - Prompt API for Gemini Nano with Multimodal Input
    - Summarization API for Gemini Nano
    - Writer API for Gemini Nano
    - Restart Chrome afterwards.

---

## 📝 Usage

1. Open the extension popup from the Chrome toolbar.
2. Paste or scan emails (click **Scan Emails**) for meeting context. You can use keywords like "from:xyz@gmail.com subject:Project".
3. (Optional) Enter your meeting’s date and time for reminders.
4. Choose your current mood to tailor the interface and assistant tone.
5. **Generate Meeting Prep** to see the AI-powered agenda and suggestions.
6. Use **Capture Slide** on any Google Doc/slide to analyze slide content with AI.(Takes ~10 seconds)
7. Try **Use Suggested Question** to quickly add insightful queries to your notes.
8. Reset the session anytime with the **Reset Session** button.

---

## Testing Instructions

- **Basic:**  
  Just follow the usage steps above. All features work out of the box, with no sign-in.
- **Advanced/AI:**  
  If prompted, enable the appropriate AI flags in `chrome://flags/`.  
- **Developers:**  
  See script comments and `manifest.json` for extension details.

---

## Built With

- JavaScript, HTML, CSS
- Chrome Extensions API (`chrome.scripting`, `chrome.storage`, `chrome.alarms`, `chrome.notifications`)
- **Prompt API** (Chrome Built-in Language Model)
- Multimodal Prompt API (image + text)
- Content scripts for email scraping

---

## Links
- [Demo Video](https://youtu.be/ZczdQZQy2a4)

---
