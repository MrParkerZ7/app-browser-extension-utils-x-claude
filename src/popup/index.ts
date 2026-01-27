// Popup entry point
import './styles/index.css';
import { createLogger } from '../shared/logger';
import { setupTabSwitching, restoreLastTab } from './core/tabs';
import { setupOpenWindow } from './core/window';
import { setupLogging } from './features/logging';
import { setupCSSCounter } from './features/css-counter';
import { setupFBAutoReply } from './features/fb-reply';
import { setupNotificationListener } from './features/fb-notif-listener';

const logger = createLogger('popup');

document.addEventListener('DOMContentLoaded', async () => {
  logger.info('Popup opened');

  // Setup core functionality
  setupOpenWindow();
  setupTabSwitching();
  await restoreLastTab();

  // Setup features
  await setupLogging();
  await setupCSSCounter();
  await setupFBAutoReply();
  await setupNotificationListener();

  // Log current tab info
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0]) {
      logger.debug('Current tab', { url: tabs[0].url, title: tabs[0].title });
    }
  });

  logger.debug('Popup initialization complete');
});

export {};
