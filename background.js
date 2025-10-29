chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'emailsScraped') {
    // Forward emails to popup (or store for further AI processing)
    chrome.runtime.sendMessage(msg);
  }
});

// Optional: notification trigger if calendar events near
chrome.alarms.create('meetingReminder', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'meetingReminder') {
    chrome.notifications.create('', {
      type: 'basic',
      title: 'Adaptive Meeting Prepper',
      message: 'You have an upcoming meeting soon. Ready to prepare?',
    //   iconUrl: 'icons/icon128.png'       
    });
  }
});

// chrome.notifications.create('meetingReminder', {
//   type: 'basic',
// //   iconUrl: chrome.runtime.getURL('icons/icon128.png'),
//   title: 'Upcoming Meeting',
//   message: 'Your next meeting begins in 10 minutes. Tap to open Adaptive Prepper.',
//   priority: 2
// });
