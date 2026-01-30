import { renderHook, act } from '@testing-library/react';
import { useChromeMessageListener, useSendMessage, sendMessage } from './useChromeMessage';
import { resetChromeMocks } from '../../test/setup';

describe('useChromeMessageListener', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it('should add message listener on mount', () => {
    const handler = jest.fn();
    renderHook(() => useChromeMessageListener('FB_STATE_UPDATE', handler));

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('should remove message listener on unmount', () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useChromeMessageListener('FB_STATE_UPDATE', handler));

    unmount();

    expect(chrome.runtime.onMessage.removeListener).toHaveBeenCalled();
  });

  it('should call handler when matching message is received', () => {
    const handler = jest.fn();
    let registeredListener: (message: { type: string; payload?: unknown }) => void;

    (chrome.runtime.onMessage.addListener as jest.Mock).mockImplementation(listener => {
      registeredListener = listener;
    });

    renderHook(() => useChromeMessageListener('FB_STATE_UPDATE', handler));

    // Simulate receiving a message
    act(() => {
      registeredListener({ type: 'FB_STATE_UPDATE', payload: { data: 'test' } });
    });

    expect(handler).toHaveBeenCalledWith({ data: 'test' });
  });

  it('should not call handler for non-matching messages', () => {
    const handler = jest.fn();
    let registeredListener: (message: { type: string; payload?: unknown }) => void;

    (chrome.runtime.onMessage.addListener as jest.Mock).mockImplementation(listener => {
      registeredListener = listener;
    });

    renderHook(() => useChromeMessageListener('FB_STATE_UPDATE', handler));

    // Simulate receiving a different message type
    act(() => {
      registeredListener({ type: 'LOGS_UPDATED', payload: { data: 'test' } });
    });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe('useSendMessage', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it('should return a function', () => {
    const { result } = renderHook(() => useSendMessage());

    expect(typeof result.current).toBe('function');
  });

  it('should send message via chrome.runtime.sendMessage', async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message, callback) => {
      callback({ success: true, data: 'response' });
    });

    const { result } = renderHook(() => useSendMessage());

    const response = await result.current({ type: 'TEST_MESSAGE' } as any);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'TEST_MESSAGE' },
      expect.any(Function)
    );
    expect(response).toEqual({ success: true, data: 'response' });
  });

  it('should handle no response', async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message, callback) => {
      callback(undefined);
    });

    const { result } = renderHook(() => useSendMessage());

    const response = await result.current({ type: 'TEST_MESSAGE' } as any);

    expect(response).toEqual({ success: false, error: 'No response' });
  });
});

describe('sendMessage', () => {
  beforeEach(() => {
    resetChromeMocks();
  });

  it('should send message and return response', async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message, callback) => {
      callback({ success: true, data: 'test data' });
    });

    const response = await sendMessage({ type: 'FB_GET_STATE' } as any);

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      { type: 'FB_GET_STATE' },
      expect.any(Function)
    );
    expect(response).toEqual({ success: true, data: 'test data' });
  });

  it('should handle null response', async () => {
    (chrome.runtime.sendMessage as jest.Mock).mockImplementation((message, callback) => {
      callback(null);
    });

    const response = await sendMessage({ type: 'TEST' } as any);

    expect(response).toEqual({ success: false, error: 'No response' });
  });
});
