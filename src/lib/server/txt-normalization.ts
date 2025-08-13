/**
 * TXT Record Normalization Utility
 * 
 * RFC 1035 TXT records may be returned as an array of quoted substrings.
 * This module provides functionality to normalize TXT record strings by
 * joining sub-strings with "" (empty string) before comparison so 
 * multi-chunk answers are considered equivalent.
 */

/**
 * Normalize a TXT record value for consistent comparison.
 * 
 * RFC 1035 allows TXT records to be split into multiple quoted substrings,
 * which may be returned as an array. This function joins them with an empty
 * string to create a normalized representation for comparison purposes.
 * 
 * @param txtValue - The TXT record value, either as a string or array of strings
 * @returns Normalized TXT record string
 */
export function normalizeTxtRecord(txtValue: string | string[]): string {
  if (Array.isArray(txtValue)) {
    // Join multiple substrings with empty string as per RFC 1035
    return txtValue.join('');
  }
  
  // If it's already a string, return as-is
  return txtValue;
}

/**
 * Normalize multiple TXT record values for consistency checking.
 * 
 * @param txtValues - Array of TXT record values to normalize
 * @returns Array of normalized TXT record strings
 */
export function normalizeTxtRecords(txtValues: (string | string[])[]): string[] {
  return txtValues.map(normalizeTxtRecord);
}

/**
 * Check if two TXT record values are equivalent after normalization.
 * 
 * @param value1 - First TXT record value
 * @param value2 - Second TXT record value
 * @returns True if the normalized values are identical
 */
export function areTxtRecordsEquivalent(
  value1: string | string[], 
  value2: string | string[]
): boolean {
  return normalizeTxtRecord(value1) === normalizeTxtRecord(value2);
}
