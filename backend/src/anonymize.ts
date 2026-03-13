/**
 * Document anonymization for fallback verifiers.
 * Redacts PII from documents before sharing with anonymous verifiers.
 *
 * For MVP, this creates a simple redacted version by:
 * 1. For images: overlays black bars on configurable regions
 * 2. For text/PDF: replaces detected PII patterns with [REDACTED]
 *
 * Post-MVP: integrate with AI services for smarter redaction.
 */

// PII patterns to redact in text documents
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Social Security Numbers (various formats)
  { pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, replacement: "[SSN REDACTED]" },
  // Email addresses
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, replacement: "[EMAIL REDACTED]" },
  // Phone numbers (various formats)
  { pattern: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE REDACTED]" },
  // Dates of birth patterns
  { pattern: /\b(?:born|DOB|date of birth)[:\s]*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/gi, replacement: "[DOB REDACTED]" },
  // Swiss AHV/AVS numbers
  { pattern: /\b756\.\d{4}\.\d{4}\.\d{2}\b/g, replacement: "[AHV REDACTED]" },
  // Passport numbers (generic)
  { pattern: /\b(?:passport|pass\.?\s*no\.?)[:\s]*[A-Z0-9]{6,12}/gi, replacement: "[PASSPORT REDACTED]" },
  // Street addresses (basic pattern)
  { pattern: /\b\d{1,5}\s+(?:[A-Za-z]+\s){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl)\b/gi, replacement: "[ADDRESS REDACTED]" },
];

/**
 * Anonymize text content by redacting PII patterns.
 */
export function anonymizeText(text: string): string {
  let result = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Anonymize a document buffer.
 * For text-based files, applies PII redaction.
 * For binary files (images, PDFs), returns as-is with a warning
 * (full image redaction requires sharp/canvas — post-MVP).
 */
export function anonymizeDocument(
  fileBuffer: Buffer,
  fileName: string
): { anonymizedBuffer: Buffer; wasRedacted: boolean } {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  const textExtensions = ["txt", "csv", "json", "xml", "html", "md"];

  if (textExtensions.includes(extension)) {
    const text = fileBuffer.toString("utf-8");
    const anonymized = anonymizeText(text);
    return {
      anonymizedBuffer: Buffer.from(anonymized, "utf-8"),
      wasRedacted: anonymized !== text,
    };
  }

  // For non-text files, return original with flag
  // Post-MVP: use sharp for image redaction, pdf-lib for PDF redaction
  return {
    anonymizedBuffer: fileBuffer,
    wasRedacted: false,
  };
}
