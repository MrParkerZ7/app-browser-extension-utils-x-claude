// Formatting utility functions

export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function formatData(data: unknown): string {
  if (data === undefined || data === null) return '';
  try {
    return JSON.stringify(data, null, 0);
  } catch {
    return String(data);
  }
}
