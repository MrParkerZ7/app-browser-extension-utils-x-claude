import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { TabNavigation } from './components/TabNavigation';
import { LoggingPanel } from './features/logging/LoggingPanel';
import { CSSCounterPanel } from './features/css-counter/CSSCounterPanel';
import { FBReplyPanel } from './features/fb-reply/FBReplyPanel';
import { IDMPanel } from './features/idm-listener/IDMPanel';
import { createLogger } from '../shared/logger';

const logger = createLogger('popup');

export type TabId = 'tab-logging' | 'tab-css-counter' | 'tab-fb-reply' | 'tab-idm';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('tab-logging');

  useEffect(() => {
    logger.info('Popup opened');

    // Restore last active tab
    chrome.storage.local.get('lastActiveTab').then(result => {
      if (result.lastActiveTab) {
        setActiveTab(result.lastActiveTab as TabId);
      }
    });

    // Log current tab info
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        logger.debug('Current tab', { url: tabs[0].url, title: tabs[0].title });
      }
    });

    logger.debug('Popup initialization complete');
  }, []);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    chrome.storage.local.set({ lastActiveTab: tabId });
  };

  return (
    <>
      <Header />
      <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="content">
        {activeTab === 'tab-logging' && <LoggingPanel />}
        {activeTab === 'tab-css-counter' && <CSSCounterPanel />}
        {activeTab === 'tab-fb-reply' && <FBReplyPanel />}
        {activeTab === 'tab-idm' && <IDMPanel />}
      </div>
    </>
  );
}
