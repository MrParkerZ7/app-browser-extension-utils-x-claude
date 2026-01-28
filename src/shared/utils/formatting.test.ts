import { formatTimestamp, escapeHtml, formatData } from './formatting';

describe('formatTimestamp', () => {
  it('should format timestamp as date string', () => {
    // Use a fixed timestamp: January 15, 2024 10:30:45.123
    const timestamp = new Date(2024, 0, 15, 10, 30, 45, 123).getTime();
    const result = formatTimestamp(timestamp);

    // Should contain date parts
    expect(result).toContain('01');
    expect(result).toContain('15');
    // Should contain time parts
    expect(result).toContain('10');
    expect(result).toContain('30');
    expect(result).toContain('45');
    // Should contain milliseconds
    expect(result).toContain('.123');
  });

  it('should pad milliseconds with leading zeros', () => {
    const timestamp = new Date(2024, 0, 15, 10, 30, 45, 5).getTime();
    const result = formatTimestamp(timestamp);
    expect(result).toContain('.005');
  });

  it('should handle zero milliseconds', () => {
    const timestamp = new Date(2024, 0, 15, 10, 30, 45, 0).getTime();
    const result = formatTimestamp(timestamp);
    expect(result).toContain('.000');
  });
});

describe('escapeHtml', () => {
  it('should escape < and > characters', () => {
    const result = escapeHtml('<script>alert("xss")</script>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
  });

  it('should escape & character', () => {
    const result = escapeHtml('Tom & Jerry');
    expect(result).toContain('&amp;');
  });

  it('should preserve quotes (textContent method does not escape quotes)', () => {
    const result = escapeHtml('Say "Hello"');
    // textContent method preserves quotes as-is
    expect(result).toBe('Say "Hello"');
  });

  it('should return empty string for empty input', () => {
    const result = escapeHtml('');
    expect(result).toBe('');
  });

  it('should not modify safe text', () => {
    const result = escapeHtml('Hello World');
    expect(result).toBe('Hello World');
  });

  it('should handle multiple special characters', () => {
    const result = escapeHtml('<div class="test">A & B</div>');
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&amp;');
  });
});

describe('formatData', () => {
  it('should return empty string for undefined', () => {
    expect(formatData(undefined)).toBe('');
  });

  it('should return empty string for null', () => {
    expect(formatData(null)).toBe('');
  });

  it('should stringify objects', () => {
    const obj = { name: 'test', value: 123 };
    const result = formatData(obj);
    expect(result).toBe('{"name":"test","value":123}');
  });

  it('should stringify arrays', () => {
    const arr = [1, 2, 3];
    const result = formatData(arr);
    expect(result).toBe('[1,2,3]');
  });

  it('should stringify primitives', () => {
    expect(formatData(123)).toBe('123');
    expect(formatData('hello')).toBe('"hello"');
    expect(formatData(true)).toBe('true');
  });

  it('should handle nested objects', () => {
    const obj = { outer: { inner: 'value' } };
    const result = formatData(obj);
    expect(result).toBe('{"outer":{"inner":"value"}}');
  });

  it('should handle circular references gracefully', () => {
    const obj: Record<string, unknown> = { name: 'test' };
    obj.self = obj;

    // Should not throw and should return string representation
    const result = formatData(obj);
    expect(typeof result).toBe('string');
  });
});
