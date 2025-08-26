/**
 * Unit tests for TXT record normalization functionality
 * Tests cover string normalization and equivalence checking
 */

import { describe, it, expect } from 'vitest';
import { 
  normalizeTxtRecord, 
  normalizeTxtRecords, 
  areTxtRecordsEquivalent 
} from './txt-normalization.js';

describe('normalizeTxtRecord', () => {
  it('should return string as-is when input is already a string', () => {
    const input = 'v=spf1 include:_spf.example.com ~all';
    const result = normalizeTxtRecord(input);
    
    expect(result).toBe(input);
  });

  it('should join array of strings with empty string', () => {
    const input = ['v=spf1 ', 'include:_spf.example.com ', '~all'];
    const expected = 'v=spf1 include:_spf.example.com ~all';
    const result = normalizeTxtRecord(input);
    
    expect(result).toBe(expected);
  });

  it('should handle empty array', () => {
    const input: string[] = [];
    const result = normalizeTxtRecord(input);
    
    expect(result).toBe('');
  });

  it('should handle single-element array', () => {
    const input = ['single-value'];
    const result = normalizeTxtRecord(input);
    
    expect(result).toBe('single-value');
  });

  it('should handle empty strings in array', () => {
    const input = ['', 'test', '', 'value', ''];
    const expected = 'testvalue';
    const result = normalizeTxtRecord(input);
    
    expect(result).toBe(expected);
  });

  it('should handle quoted substrings correctly', () => {
    const input = ['"google-site-verification=', 'abcd1234"'];
    const expected = '"google-site-verification=abcd1234"';
    const result = normalizeTxtRecord(input);
    
    expect(result).toBe(expected);
  });
});

describe('normalizeTxtRecords', () => {
  it('should normalize multiple TXT records', () => {
    const input = [
      'single-string',
      ['multi', 'part', 'string'],
      ['another', 'record']
    ];
    const expected = [
      'single-string',
      'multipartstring',
      'anotherrecord'
    ];
    const result = normalizeTxtRecords(input);
    
    expect(result).toEqual(expected);
  });

  it('should handle empty array', () => {
    const input: (string | string[])[] = [];
    const result = normalizeTxtRecords(input);
    
    expect(result).toEqual([]);
  });

  it('should handle mixed string and array inputs', () => {
    const input = [
      'simple-string',
      ['array', 'parts'],
      'another-simple-string',
      ['more', 'array', 'parts']
    ];
    const expected = [
      'simple-string',
      'arrayparts',
      'another-simple-string',
      'morearrayparts'
    ];
    const result = normalizeTxtRecords(input);
    
    expect(result).toEqual(expected);
  });
});

describe('areTxtRecordsEquivalent', () => {
  it('should return true for identical strings', () => {
    const value1 = 'v=spf1 include:_spf.example.com ~all';
    const value2 = 'v=spf1 include:_spf.example.com ~all';
    const result = areTxtRecordsEquivalent(value1, value2);
    
    expect(result).toBe(true);
  });

  it('should return true for equivalent string and array', () => {
    const value1 = 'v=spf1 include:_spf.example.com ~all';
    const value2 = ['v=spf1 ', 'include:_spf.example.com ', '~all'];
    const result = areTxtRecordsEquivalent(value1, value2);
    
    expect(result).toBe(true);
  });

  it('should return true for equivalent arrays', () => {
    const value1 = ['v=spf1 ', 'include:_spf.example.com ', '~all'];
    const value2 = ['v=spf1 include:_spf.example.com ~all'];
    const result = areTxtRecordsEquivalent(value1, value2);
    
    expect(result).toBe(true);
  });

  it('should return false for different values', () => {
    const value1 = 'v=spf1 include:_spf.example.com ~all';
    const value2 = 'v=spf1 include:_spf.different.com ~all';
    const result = areTxtRecordsEquivalent(value1, value2);
    
    expect(result).toBe(false);
  });

  it('should return false for different normalized values', () => {
    const value1 = ['google-site-verification=', 'abcd1234'];
    const value2 = ['google-site-verification=', 'efgh5678'];
    const result = areTxtRecordsEquivalent(value1, value2);
    
    expect(result).toBe(false);
  });

  it('should handle empty values', () => {
    const value1 = '';
    const value2: string[] = [];
    const result = areTxtRecordsEquivalent(value1, value2);
    
    expect(result).toBe(true);
  });

  it('should handle complex multi-part records', () => {
    // Simulate DNS TXT record that might be split across multiple strings
    const value1 = 'v=DMARC1; p=reject; rua=mailto:dmarc@example.com; ruf=mailto:dmarc@example.com; sp=reject; adkim=s; aspf=s;';
    const value2 = [
      'v=DMARC1; p=reject; ',
      'rua=mailto:dmarc@example.com; ',
      'ruf=mailto:dmarc@example.com; ',
      'sp=reject; adkim=s; aspf=s;'
    ];
    const result = areTxtRecordsEquivalent(value1, value2);
    
    expect(result).toBe(true);
  });
});
