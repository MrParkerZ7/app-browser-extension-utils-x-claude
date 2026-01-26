// Content script - runs in the context of web pages
import { createLogger } from '../shared/logger';
import { CSSSearchResult, FBReplyResult } from '../shared/types';

const logger = createLogger('content');

// Helper to wait
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Example: Send message to background script
function sendMessageToBackground(message: { type: string; payload?: unknown }) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// HTML Search functionality - counts exact class matches and text matches
function searchCSS(query: string): CSSSearchResult {
  const result: CSSSearchResult = {
    query,
    classes: 0,
    textMatches: 0,
  };

  if (!query.trim()) return result;

  const searchTerm = query.trim();
  const searchClasses = searchTerm.split(/\s+/);

  const allElements = document.querySelectorAll('*');

  allElements.forEach(el => {
    // Count elements where className exactly matches OR all searched classes are present
    if (searchClasses.length > 1) {
      // Multiple classes: check if element has all of them
      const hasAll = searchClasses.every(cls => el.classList.contains(cls));
      if (hasAll) {
        result.classes++;
      }
    } else {
      // Single class: exact match
      if (el.classList.contains(searchTerm)) {
        result.classes++;
      }
    }

    // Count elements with exact text match (direct text only, not children)
    const directText = Array.from(el.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent || '')
      .join('')
      .trim();

    if (directText === searchTerm) {
      result.textMatches++;
    }
  });

  return result;
}

// Helper to get comment_id from URL
function getCommentIdFromUrl(): string | null {
  const url = new URL(window.location.href);
  // Try reply_comment_id first (more specific), then comment_id
  return url.searchParams.get('reply_comment_id') || url.searchParams.get('comment_id');
}

// Helper to find the comment element by comment_id
function findCommentById(commentId: string): HTMLElement | null {
  logger.info('Searching for comment with ID', { commentId });

  // Facebook stores comment IDs in various places - look for links/elements containing the ID
  // Method 1: Find links that contain the comment_id in href
  const allLinks = document.querySelectorAll('a[href*="comment_id"]');
  for (const link of Array.from(allLinks)) {
    const href = link.getAttribute('href') || '';
    if (href.includes(`comment_id=${commentId}`) || href.includes(`reply_comment_id=${commentId}`)) {
      // Found a link with this comment ID - find its parent comment container
      const commentContainer = link.closest('[role="article"]') as HTMLElement;
      if (commentContainer) {
        logger.info('Found comment by link href', { href: href.substring(0, 100) });
        return commentContainer;
      }
    }
  }

  // Method 2: Look for data attributes containing the ID
  const elementsWithData = document.querySelectorAll(`[data-ft*="${commentId}"], [data-commentid="${commentId}"]`);
  if (elementsWithData.length > 0) {
    const container = (elementsWithData[0] as HTMLElement).closest('[role="article"]') as HTMLElement;
    if (container) {
      logger.info('Found comment by data attribute');
      return container;
    }
  }

  // Method 3: Search in aria-describedby or other attributes
  const allArticles = document.querySelectorAll('[role="article"]');
  for (const article of Array.from(allArticles)) {
    const html = article.innerHTML;
    // Check if this article contains a reference to our comment ID
    if (html.includes(commentId)) {
      // Verify this is the actual comment, not just a reference
      const links = article.querySelectorAll('a[href]');
      for (const link of Array.from(links)) {
        const href = link.getAttribute('href') || '';
        if (href.includes(commentId)) {
          logger.info('Found comment by innerHTML search');
          return article as HTMLElement;
        }
      }
    }
  }

  // Method 4: Facebook sometimes uses the comment ID in the URL of timestamp links
  const timeLinks = document.querySelectorAll('a[href*="permalink"], a[href*="comment"]');
  for (const link of Array.from(timeLinks)) {
    const href = link.getAttribute('href') || '';
    if (href.includes(commentId)) {
      const container = link.closest('[role="article"]') as HTMLElement;
      if (container) {
        logger.info('Found comment via timestamp/permalink link');
        return container;
      }
    }
  }

  logger.warn('Could not find comment element by ID');
  return null;
}

// FB Auto Reply functionality
async function performFBReply(message: string): Promise<FBReplyResult> {
  logger.info('Starting FB Auto Reply', { message, url: window.location.href });

  try {
    // Wait for page to be ready and for Facebook to load the comment
    await wait(2000);

    // Get the comment_id from URL
    const commentId = getCommentIdFromUrl();
    logger.info('Comment ID from URL', { commentId });

    // Find the specific comment element by ID
    let targetComment: HTMLElement | null = null;
    if (commentId) {
      targetComment = findCommentById(commentId);
    }

    if (targetComment) {
      logger.info('Found target comment element', {
        classList: targetComment.className.substring(0, 100),
      });

      // Scroll the comment into view to make sure it's visible
      targetComment.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await wait(500);
    } else {
      logger.warn('Could not find target comment by ID, will try to find reply button globally');
    }

    // Search scope - either the target comment or the whole document
    const searchScope = targetComment || document;

    // Try to find and click "Reply" link/button within the target comment
    let replyClicked = false;
    const replyButtons = Array.from(searchScope.querySelectorAll('[role="button"], span, a, div[role="button"]'));

    for (const btn of replyButtons) {
      const text = btn.textContent?.toLowerCase().trim() || '';
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();

      // Match reply button text (English and Vietnamese)
      if (text === 'reply' || text === 'phản hồi' || text === 'trả lời' ||
          ariaLabel.includes('reply') || ariaLabel.includes('phản hồi') || ariaLabel.includes('trả lời')) {
        const htmlBtn = btn as HTMLElement;
        // Make sure it's visible
        if (htmlBtn.offsetParent !== null || htmlBtn.offsetHeight > 0) {
          htmlBtn.click();
          logger.info('Clicked reply button within target comment', { text: btn.textContent?.trim() });
          replyClicked = true;
          await wait(1000);
          break;
        }
      }
    }

    if (!replyClicked && targetComment) {
      // Try finding reply button by looking at siblings or parent's children
      logger.info('Trying to find reply button in parent container');
      const parentContainer = targetComment.parentElement;
      if (parentContainer) {
        const btns = Array.from(parentContainer.querySelectorAll('[role="button"], span, a'));
        for (const btn of btns) {
          const text = btn.textContent?.toLowerCase().trim() || '';
          if (text === 'reply' || text === 'phản hồi' || text === 'trả lời') {
            const htmlBtn = btn as HTMLElement;
            if (htmlBtn.offsetParent !== null || htmlBtn.offsetHeight > 0) {
              htmlBtn.click();
              logger.info('Clicked reply button in parent container', { text });
              replyClicked = true;
              await wait(1000);
              break;
            }
          }
        }
      }
    }

    if (!replyClicked) {
      logger.warn('Could not find reply button, trying global search near target');
      // Fallback: Find reply button closest to the target comment
      const allReplyButtons = Array.from(document.querySelectorAll('[role="button"], span, a'));
      for (const btn of allReplyButtons) {
        const text = btn.textContent?.toLowerCase().trim() || '';
        if (text === 'reply' || text === 'phản hồi' || text === 'trả lời') {
          const htmlBtn = btn as HTMLElement;
          if (htmlBtn.offsetParent !== null || htmlBtn.offsetHeight > 0) {
            // If we have a target comment, check if this reply button is near it
            if (targetComment) {
              const btnRect = htmlBtn.getBoundingClientRect();
              const commentRect = targetComment.getBoundingClientRect();
              // Check if button is within or near the comment
              if (btnRect.top >= commentRect.top - 100 && btnRect.bottom <= commentRect.bottom + 100) {
                htmlBtn.click();
                logger.info('Clicked nearby reply button', { text: btn.textContent?.trim() });
                replyClicked = true;
                await wait(1000);
                break;
              }
            } else {
              // No target comment, just click the first reply button
              htmlBtn.click();
              logger.info('Clicked first visible reply button', { text });
              replyClicked = true;
              await wait(1000);
              break;
            }
          }
        }
      }
    }

    // Wait a bit more for the reply input to appear
    await wait(500);

    // Find the comment input - look for the most recently appeared input (reply inputs appear after clicking)
    let input: HTMLElement | null = null;

    // Try various selectors for Facebook comment box
    const inputSelectors = [
      '[contenteditable="true"][role="textbox"]',
      '[contenteditable="true"][data-lexical-editor="true"]',
      '[aria-label*="reply" i][contenteditable="true"]',
      '[aria-label*="Reply" i][contenteditable="true"]',
      '[aria-label*="comment" i][contenteditable="true"]',
      '[aria-label*="Write" i][contenteditable="true"]',
      'div[contenteditable="true"]',
    ];

    // First, try to find input within or near the target comment
    if (targetComment) {
      // Look for input in the target comment's parent container (reply box appears below the comment)
      const parentContainer = targetComment.parentElement?.parentElement?.parentElement || targetComment.parentElement || targetComment;

      for (const selector of inputSelectors) {
        const elements = parentContainer.querySelectorAll(selector);
        for (const el of Array.from(elements)) {
          const htmlEl = el as HTMLElement;
          if (htmlEl.offsetParent !== null || htmlEl.offsetHeight > 0) {
            input = htmlEl;
            logger.info('Found input within target comment container');
            break;
          }
        }
        if (input) break;
      }
    }

    // If no input found in target comment, find the last visible one (most recently opened)
    if (!input) {
      for (const selector of inputSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // Get the last visible one (reply inputs usually appear at the end)
          for (let i = elements.length - 1; i >= 0; i--) {
            const el = elements[i] as HTMLElement;
            if (el.offsetParent !== null || el.offsetHeight > 0) {
              input = el;
              break;
            }
          }
          if (input) break;
        }
      }
    }

    if (!input) {
      logger.error('Could not find comment input');
      return { success: false, error: 'Could not find comment input' };
    }

    logger.info('Found input element', {
      tagName: input.tagName,
      ariaLabel: input.getAttribute('aria-label'),
      role: input.getAttribute('role'),
    });

    // Focus and click the input
    input.focus();
    input.click();
    await wait(300);

    // Clear and insert text using execCommand (works better with contenteditable)
    if (input.getAttribute('contenteditable') === 'true') {
      // Select all and delete
      document.execCommand('selectAll', false);
      document.execCommand('delete', false);

      // Insert text using execCommand
      document.execCommand('insertText', false, message);

      logger.info('Text inserted via execCommand');
    } else {
      // Regular input/textarea
      (input as HTMLInputElement).value = message;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await wait(500);

    // Find and click submit button
    // Facebook submit buttons are often near the input
    const parent = input.closest('form') || input.parentElement?.parentElement?.parentElement?.parentElement || document.body;

    const submitSelectors = [
      '[aria-label*="Submit" i]',
      '[aria-label*="Post" i]',
      '[aria-label*="Send" i]',
      '[aria-label*="Gửi" i]',
      '[aria-label*="Đăng" i]',
      '[data-testid*="submit"]',
      '[type="submit"]',
      'form [role="button"]:not([aria-label*="emoji" i]):not([aria-label*="gif" i]):not([aria-label*="photo" i]):not([aria-label*="sticker" i])',
    ];

    let submitBtn: HTMLElement | null = null;

    for (const selector of submitSelectors) {
      const btns = parent.querySelectorAll(selector);
      for (const btn of Array.from(btns)) {
        const el = btn as HTMLElement;
        // Check if visible and looks like a submit button
        if (el.offsetParent !== null) {
          const text = el.textContent?.toLowerCase() || '';
          const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
          // Skip if it's an emoji/sticker/photo button
          if (text.includes('emoji') || text.includes('gif') || text.includes('photo') || text.includes('sticker')) {
            continue;
          }
          if (ariaLabel.includes('submit') || ariaLabel.includes('post') || ariaLabel.includes('send') ||
              ariaLabel.includes('gửi') || ariaLabel.includes('đăng') || text === '') {
            submitBtn = el;
            break;
          }
        }
      }
      if (submitBtn) break;
    }

    if (submitBtn) {
      logger.info('Found submit button', {
        ariaLabel: submitBtn.getAttribute('aria-label'),
        text: submitBtn.textContent?.substring(0, 50),
      });

      // Click the submit button
      submitBtn.click();
      logger.info('Clicked submit button');
      await wait(500);

      // Try clicking again if needed (sometimes FB needs double click)
      submitBtn.click();
    } else {
      // Fallback: try pressing Enter with Ctrl (some FB versions need this)
      logger.warn('No submit button found, trying keyboard submit');

      input.focus();

      // Try Enter key
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(enterEvent);

      await wait(200);

      // Also dispatch keyup
      input.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
      }));
    }

    await wait(2000);

    logger.info('FB Auto Reply completed');
    return { success: true };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('FB Auto Reply failed', { error: errorMsg });
    return { success: false, error: errorMsg };
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // Check if extension context is still valid
  if (!chrome.runtime?.id) {
    return false;
  }

  if (message.type === 'CSS_SEARCH') {
    const query = message.payload?.query || '';
    const result = searchCSS(query);
    // Only log if context is still valid
    if (chrome.runtime?.id) {
      logger.debug('CSS search performed', { query, result });
    }
    sendResponse({ success: true, data: result });
  }

  if (message.type === 'FB_AUTO_REPLY') {
    const replyMessage = message.payload?.message || '';
    performFBReply(replyMessage).then(result => {
      sendResponse({ success: result.success, data: result, error: result.error });
    });
    return true; // Keep channel open for async response
  }

  return true;
});

// Example: DOM manipulation
function init() {
  logger.info('Content script initialized', {
    url: window.location.href,
    title: document.title
  });

  // Log page visibility changes
  document.addEventListener('visibilitychange', () => {
    logger.debug('Visibility changed', {
      hidden: document.hidden,
      state: document.visibilityState
    });
  });

  // Log errors on the page
  window.addEventListener('error', (event) => {
    logger.error('Page error caught', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    });
  });

  // Log unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection', {
      reason: String(event.reason),
    });
  });
}

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { sendMessageToBackground, logger };
