// Scrapes top 10 email metadata from filtered Gmail view (no bodies for privacy)
(() => {
  try {
    const emails = [...document.querySelectorAll('.zA')].slice(0, 10);
    const data = emails.map(el => ({
      from: el.querySelector('.yX.xY span:not([role="presentation"])')?.innerText || '',
      subject: el.querySelector('.bog')?.innerText || '',
      date: el.querySelector('.xW.xY')?.getAttribute('title') || '',
      snippet: el.querySelector('.y2')?.innerText.trim() || ''
    }));
    chrome.runtime.sendMessage({ type: 'emailsScraped', data });
  } catch (e) {
    console.error('Email scraping failed:', e);
  }
})();
