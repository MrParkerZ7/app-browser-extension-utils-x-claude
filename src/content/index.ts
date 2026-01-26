// Content script - runs in the context of web pages
import { createLogger } from '../shared/logger';
import { CSSSearchResult, FBReplyResult, FBReplySteps } from '../shared/types';
import { wait } from '../shared/utils';

// Prevent multiple initializations when script is injected multiple times
const windowWithFlag = window as unknown as { __contentScriptInitialized?: boolean };
const alreadyInitialized = windowWithFlag.__contentScriptInitialized === true;
windowWithFlag.__contentScriptInitialized = true;

// Only run if not already initialized
if (!alreadyInitialized) {

const logger = createLogger('content');

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

// Helper to get comment IDs from URL
interface CommentIds {
  commentId: string | null;
  replyCommentId: string | null;
  targetId: string | null; // The ID we should use to find the target
  isReplyTarget: boolean;  // Whether we're targeting a reply (reply_comment_id present)
}

function getCommentIdsFromUrl(): CommentIds {
  const url = new URL(window.location.href);
  const commentId = url.searchParams.get('comment_id');
  const replyCommentId = url.searchParams.get('reply_comment_id');

  return {
    commentId,
    replyCommentId,
    // Target the most specific ID (reply_comment_id if present, otherwise comment_id)
    targetId: replyCommentId || commentId,
    // Track whether we're targeting a reply or the main comment
    isReplyTarget: replyCommentId !== null,
  };
}

// Helper to find the comment element by comment_id
// isReplyTarget: true if we're looking for a reply_comment_id, false if looking for comment_id
function findCommentById(targetId: string, isReplyTarget: boolean): HTMLElement | null {
  logger.info('Searching for comment with ID', { targetId, isReplyTarget });

  // Facebook stores comment IDs in various places - look for links/elements containing the ID
  // We need to be precise about which parameter we're matching

  const allLinks = document.querySelectorAll('a[href*="comment_id"]');
  const matchingContainers: { container: HTMLElement; isExactMatch: boolean; depth: number }[] = [];

  for (const link of Array.from(allLinks)) {
    const href = link.getAttribute('href') || '';

    // Check for exact parameter match based on what we're looking for
    let isExactMatch = false;

    if (isReplyTarget) {
      // Looking for reply_comment_id - must match reply_comment_id=targetId
      isExactMatch = href.includes(`reply_comment_id=${targetId}`);
    } else {
      // Looking for comment_id (not reply) - must match comment_id=targetId
      // But NOT reply_comment_id=targetId (that would be a different comment)
      isExactMatch = href.includes(`comment_id=${targetId}`) && !href.includes(`reply_comment_id=${targetId}`);
    }

    if (isExactMatch || href.includes(`=${targetId}`)) {
      const commentContainer = link.closest('[role="article"]') as HTMLElement;
      if (commentContainer) {
        // Calculate depth
        let depth = 0;
        let el: HTMLElement | null = commentContainer;
        while (el) { depth++; el = el.parentElement; }

        // Check if we already have this container
        const existing = matchingContainers.find(m => m.container === commentContainer);
        if (!existing) {
          matchingContainers.push({ container: commentContainer, isExactMatch, depth });
          logger.info('Found potential comment', {
            href: href.substring(0, 100),
            isExactMatch,
            depth,
          });
        } else if (isExactMatch && !existing.isExactMatch) {
          // Upgrade to exact match
          existing.isExactMatch = true;
        }
      }
    }
  }

  if (matchingContainers.length > 0) {
    // First, prefer exact matches
    const exactMatches = matchingContainers.filter(m => m.isExactMatch);

    if (exactMatches.length > 0) {
      if (isReplyTarget) {
        // For replies, prefer the deepest (most nested) exact match
        exactMatches.sort((a, b) => b.depth - a.depth);
      } else {
        // For main comments, prefer the shallowest exact match (avoid nested replies)
        exactMatches.sort((a, b) => a.depth - b.depth);
      }
      logger.info('Found exact match for comment', { isReplyTarget, depth: exactMatches[0].depth });
      return exactMatches[0].container;
    }

    // Fallback to non-exact matches with same depth logic
    if (isReplyTarget) {
      matchingContainers.sort((a, b) => b.depth - a.depth);
    } else {
      matchingContainers.sort((a, b) => a.depth - b.depth);
    }
    logger.info('Found comment by link href (non-exact)', { count: matchingContainers.length });
    return matchingContainers[0].container;
  }

  // Method 2: Look for data attributes containing the ID
  const elementsWithData = document.querySelectorAll(`[data-ft*="${targetId}"], [data-commentid="${targetId}"]`);
  if (elementsWithData.length > 0) {
    const container = (elementsWithData[0] as HTMLElement).closest('[role="article"]') as HTMLElement;
    if (container) {
      logger.info('Found comment by data attribute');
      return container;
    }
  }

  // Method 3: Search in aria-describedby or other attributes
  const allArticles = document.querySelectorAll('[role="article"]');
  const articleMatches: { article: HTMLElement; depth: number }[] = [];

  for (const article of Array.from(allArticles)) {
    const links = article.querySelectorAll('a[href]');
    for (const link of Array.from(links)) {
      const href = link.getAttribute('href') || '';
      if (href.includes(`comment_id=${targetId}`) || href.includes(`reply_comment_id=${targetId}`)) {
        let depth = 0;
        let el: Element | null = article;
        while (el) { depth++; el = el.parentElement; }
        articleMatches.push({ article: article as HTMLElement, depth });
        break;
      }
    }
  }

  if (articleMatches.length > 0) {
    // Sort by depth based on target type
    if (isReplyTarget) {
      articleMatches.sort((a, b) => b.depth - a.depth);
    } else {
      articleMatches.sort((a, b) => a.depth - b.depth);
    }
    logger.info('Found comment by article search');
    return articleMatches[0].article;
  }

  logger.warn('Could not find comment element by ID');
  return null;
}

// Extract profile name from a comment element
function extractProfileName(commentElement: HTMLElement): string | null {
  logger.info('Extracting profile name from comment element');

  // Method 1: Find the FIRST link in the comment - this is almost always the profile name
  // Facebook puts the author name as the first clickable link
  const allLinks = commentElement.querySelectorAll('a');
  for (const link of Array.from(allLinks)) {
    const href = link.getAttribute('href') || '';
    const text = link.textContent?.trim() || '';

    // Skip empty, comment links, timestamps, reactions, etc
    if (!text || text.length < 2 || text.length > 60) continue;
    if (href.includes('comment_id') || href.includes('reply_comment_id')) continue;
    if (href.includes('/photos/') || href.includes('/videos/')) continue;
    if (text.match(/^\d+\s*(h|m|d|w|phút|giờ|ngày)/i)) continue; // Timestamps
    if (text.match(/^(Like|Reply|Thích|Phản hồi|Trả lời|See more|Xem thêm)$/i)) continue;

    // Must contain at least one letter (any language)
    if (!/[\p{L}]/u.test(text)) continue;

    // This is likely the profile name
    logger.info('Found profile name (first valid link)', { name: text, href: href.substring(0, 50) });
    return text;
  }

  // Method 2: Look for spans with specific attributes that contain names
  const nameSpans = commentElement.querySelectorAll('span[dir="auto"], span[class*="x1lliihq"]');
  for (const span of Array.from(nameSpans)) {
    const text = span.textContent?.trim() || '';
    if (text.length >= 2 && text.length <= 60 && /[\p{L}]/u.test(text)) {
      // Check if this span has a link as parent or child
      const parentLink = span.closest('a');
      const childLink = span.querySelector('a');
      if (parentLink || childLink) {
        const href = parentLink?.getAttribute('href') || childLink?.getAttribute('href') || '';
        if (!href.includes('comment')) {
          logger.info('Found profile name (span with link)', { name: text });
          return text;
        }
      }
    }
  }

  // Method 3: Get text from the first anchor that looks like a profile URL
  for (const link of Array.from(allLinks)) {
    const href = link.getAttribute('href') || '';
    // Profile URLs patterns
    if (href.includes('/user/') || href.includes('profile.php') || href.match(/facebook\.com\/[a-zA-Z0-9.]+\/?(\?|$)/)) {
      const text = link.textContent?.trim();
      if (text && text.length >= 2 && text.length <= 60) {
        logger.info('Found profile name (profile URL)', { name: text, href: href.substring(0, 50) });
        return text;
      }
    }
  }

  logger.warn('Could not extract profile name from comment');
  return null;
}

// Simulate a realistic mouse click that triggers React event handlers
function simulateClick(element: HTMLElement): void {
  const rect = element.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  const eventOptions = {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: centerX,
    clientY: centerY,
    button: 0,
  };

  // Dispatch full mouse event sequence for React compatibility
  element.dispatchEvent(new MouseEvent('mousedown', eventOptions));
  element.dispatchEvent(new MouseEvent('mouseup', eventOptions));
  element.dispatchEvent(new MouseEvent('click', eventOptions));
}

// FB Auto Reply functionality
async function performFBReply(message: string, steps: FBReplySteps): Promise<FBReplyResult> {
  logger.info('Starting FB Auto Reply', { message, steps, url: window.location.href });

  try {
    // Wait for page to be ready and for Facebook to load the comment
    await wait(2000);

    // Get both comment_id and reply_comment_id from URL
    const { commentId, replyCommentId, targetId, isReplyTarget } = getCommentIdsFromUrl();
    logger.info('Comment IDs from URL', { commentId, replyCommentId, targetId, isReplyTarget });

    // Find the specific comment element by ID
    // isReplyTarget tells us whether we're targeting a reply (reply_comment_id in URL) or main comment (only comment_id)
    let targetComment: HTMLElement | null = null;
    if (targetId) {
      targetComment = findCommentById(targetId, isReplyTarget);
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

    // ========== STEP 1: Click Reply Button ==========
    let input: HTMLElement | null = null;

    if (steps.clickReply) {
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
            // Use simulated click for React compatibility
            simulateClick(htmlBtn);
            logger.info('Clicked reply button within target comment', { text: btn.textContent?.trim() });
            replyClicked = true;
            await wait(2000);
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
                simulateClick(htmlBtn);
                logger.info('Clicked reply button in parent container', { text });
                replyClicked = true;
                await wait(2000);
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
                  simulateClick(htmlBtn);
                  logger.info('Clicked nearby reply button', { text: btn.textContent?.trim() });
                  replyClicked = true;
                  await wait(2000);
                  break;
                }
              } else {
                // No target comment, just click the first reply button
                simulateClick(htmlBtn);
                logger.info('Clicked first visible reply button', { text });
                replyClicked = true;
                await wait(2000);
                break;
              }
            }
          }
        }
      }

      // Wait longer for the reply input and @mention tag to appear
      await wait(1500);
      logger.info('Step 1 (Click Reply) completed', { replyClicked });
    }

    // If we need to input text or submit, we need to find the input element
    if (steps.inputText || steps.submitReply) {
      // Find the comment input - look for the most recently appeared input (reply inputs appear after clicking)
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
    }

    // ========== STEP 2: Input Text ==========
    if (steps.inputText && input) {
      // Focus and click the input
      input.focus();
      input.click();
      await wait(500);

      // Check if Facebook automatically inserted the @mention
      // Wait a bit more and check again for @mention to appear
      let hasFacebookMention = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        const mentionSpan = input.querySelector('[data-lexical-text="true"], [data-text="true"], span[spellcheck="false"]');
        const inputText = input.textContent?.trim() || '';

        // Check if there's an @mention (Facebook adds it as a special span or with @ prefix)
        if (mentionSpan || inputText.startsWith('@') || inputText.includes('@')) {
          hasFacebookMention = true;
          logger.info('Facebook @mention detected', { inputText: inputText.substring(0, 50), attempt });
          break;
        }

        if (attempt < 2) {
          await wait(500);
        }
      }

      // If no @mention from Facebook, manually insert the profile name
      let profileMention = '';
      if (!hasFacebookMention && targetComment) {
        const profileName = extractProfileName(targetComment);
        if (profileName) {
          profileMention = `@${profileName} `;
          logger.info('Will manually insert @mention', { profileName });
        }
      }

      // Insert text into the input
      if (input.getAttribute('contenteditable') === 'true') {
        // Check current state of the input
        const mentionSpan = input.querySelector('[data-lexical-text="true"], [data-text="true"], span[spellcheck="false"]');
        const currentText = input.textContent?.trim() || '';
        const hasExistingMention = mentionSpan !== null || currentText.startsWith('@');

        logger.info('Input state before insertion', {
          hasFacebookMention,
          hasExistingMention,
          profileMention,
          currentText: currentText.substring(0, 50),
        });

        const selection = window.getSelection();
        const range = document.createRange();

        // Determine what text to insert
        let textToInsert: string;

        if (hasFacebookMention || hasExistingMention) {
          // Facebook added @mention, just append our message after it
          // Move cursor to end
          const walker = document.createTreeWalker(input, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, null);
          let lastNode: Node | null = input;
          let node: Node | null;
          while ((node = walker.nextNode())) {
            lastNode = node;
          }

          if (lastNode && lastNode.nodeType === Node.TEXT_NODE) {
            range.setStart(lastNode, (lastNode as Text).length);
            range.setEnd(lastNode, (lastNode as Text).length);
          } else {
            range.selectNodeContents(input);
            range.collapse(false);
          }

          textToInsert = ' ' + message;
        } else if (profileMention) {
          // No Facebook @mention, we need to insert our manual one
          // Clear any existing content first and start fresh
          if (currentText.length > 0) {
            // Select all and delete
            range.selectNodeContents(input);
            selection?.removeAllRanges();
            selection?.addRange(range);
            document.execCommand('delete', false);
            await wait(100);
          }

          // Position at start
          range.selectNodeContents(input);
          range.collapse(true);

          textToInsert = profileMention + message;
          logger.info('Inserting manual @mention', { textToInsert });
        } else {
          // No @mention available, just insert the message
          range.selectNodeContents(input);
          range.collapse(true);
          textToInsert = message;
        }

        selection?.removeAllRanges();
        selection?.addRange(range);

        // Use insertText to add the message
        document.execCommand('insertText', false, textToInsert);

        // Trigger input event to notify Facebook's React (without data to avoid double insertion)
        input.dispatchEvent(new Event('input', { bubbles: true }));

        logger.info('Step 2 (Input Text) completed', { textToInsert });
      } else {
        // Regular input/textarea
        const inputEl = input as HTMLInputElement;
        const textToInsert = profileMention ? profileMention + message : message;
        inputEl.value = textToInsert;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        logger.info('Step 2 (Input Text) completed', { textToInsert });
      }

      await wait(800);
    }

    // ========== STEP 3: Submit Reply ==========
    if (steps.submitReply && input) {
      // Submit the comment using Enter key (most reliable for Facebook)
      // Facebook comments are typically submitted with Enter key
      logger.info('Step 3 (Submit): Submitting comment via Enter key');

      input.focus();

      // Try Enter key submission first (works for most Facebook comment boxes)
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true,
      });
      input.dispatchEvent(enterEvent);

      await wait(300);

      // Also dispatch keyup
      input.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
      }));

      await wait(1000);

      // Check if comment was submitted by seeing if input is now empty or cleared
      const inputAfterSubmit = input.textContent?.trim() || '';

      // If Enter didn't work (input still has content), try finding submit button
      if (inputAfterSubmit.length > 0 && inputAfterSubmit.includes(message)) {
        logger.info('Enter key may not have worked, trying submit button');

        // Find submit button near the input - be very specific to avoid avatar clicks
        const parent = input.closest('form') || input.parentElement?.parentElement?.parentElement?.parentElement || document.body;

        const submitSelectors = [
          '[aria-label*="Comment" i][aria-label*="press" i]',
          '[aria-label="Submit" i]',
          '[aria-label="Post" i]',
          '[aria-label="Send" i]',
          '[aria-label="Gửi" i]',
          '[aria-label="Đăng" i]',
          '[data-testid*="submit"]',
          '[type="submit"]',
        ];

        let submitBtn: HTMLElement | null = null;

        for (const selector of submitSelectors) {
          const btns = parent.querySelectorAll(selector);
          for (const btn of Array.from(btns)) {
            const el = btn as HTMLElement;
            // Check if visible
            if (el.offsetParent !== null) {
              const ariaLabel = el.getAttribute('aria-label')?.toLowerCase() || '';
              const tagName = el.tagName.toLowerCase();

              // Skip images, avatars, and profile-related elements
              if (tagName === 'img' || tagName === 'image') continue;
              if (el.querySelector('img, image, svg[aria-label*="profile" i]')) continue;
              if (ariaLabel.includes('profile') || ariaLabel.includes('avatar') || ariaLabel.includes('photo')) continue;
              if (ariaLabel.includes('emoji') || ariaLabel.includes('gif') || ariaLabel.includes('sticker')) continue;

              // Must have a submit-related aria-label
              if (ariaLabel.includes('submit') || ariaLabel.includes('post') || ariaLabel.includes('send') ||
                  ariaLabel.includes('gửi') || ariaLabel.includes('đăng') || ariaLabel.includes('comment')) {
                submitBtn = el;
                logger.info('Found submit button', { ariaLabel, tagName });
                break;
              }
            }
          }
          if (submitBtn) break;
        }

        if (submitBtn) {
          submitBtn.click();
          logger.info('Clicked submit button');
        }
      } else {
        logger.info('Comment appears to have been submitted via Enter key');
      }

      await wait(2000);
      logger.info('Step 3 (Submit) completed');
    }

    logger.info('FB Auto Reply completed', { steps });
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
    const steps: FBReplySteps = message.payload?.steps || { clickReply: true, inputText: true, submitReply: true };
    performFBReply(replyMessage, steps).then(result => {
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

// Export for external use (only if not already initialized)
(window as unknown as { __contentScriptExports?: { sendMessageToBackground: typeof sendMessageToBackground; logger: typeof logger } }).__contentScriptExports = { sendMessageToBackground, logger };

} // End of if (!alreadyInitialized)

// Re-export from window for module compatibility
const exports = (window as unknown as { __contentScriptExports?: { sendMessageToBackground: unknown; logger: unknown } }).__contentScriptExports;
const sendMessageToBackground = exports?.sendMessageToBackground;
const logger = exports?.logger;

export { sendMessageToBackground, logger };
