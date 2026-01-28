import { useEffect, useCallback } from 'react';
import type { MessageType, MessageResponse } from '../../shared/types';

export function useChromeMessageListener(
  type: MessageType['type'],
  handler: (payload: unknown) => void
) {
  useEffect(() => {
    const listener = (message: { type: string; payload?: unknown }) => {
      if (message.type === type) {
        handler(message.payload);
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [type, handler]);
}

export function useSendMessage() {
  return useCallback((message: MessageType): Promise<MessageResponse> => {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(message, response => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }, []);
}

export async function sendMessage(message: MessageType): Promise<MessageResponse> {
  return new Promise(resolve => {
    chrome.runtime.sendMessage(message, response => {
      resolve(response || { success: false, error: 'No response' });
    });
  });
}
