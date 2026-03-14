import mammoth from 'mammoth'
import fs from 'fs'

/**
 * File Processing Library
 * 
 * This library handles text extraction from different file types:
 * - PDFs: Uses LLM (Gemini) exclusively - no native dependencies needed
 * - Word Docs: Uses Mammoth library for text extraction
 * - Text Files: Direct file system read
 * 
 * Why LLM for PDFs?
 * - Avoids canvas and other native C++ dependencies that cause installation issues
 * - Handles both text-based and image-based PDFs consistently
 * - Better understanding of document structure and context
 * - Extracts text AND generates requirements in one API call
 * - No pdfjs-dist, tesseract.js, or OCR libraries needed
 */

// For PDFs, we'll use LLM processing directly (no pdfjs-dist)
// This avoids canvas dependency issues and gives better results
export async function extractTextFromPDF(filePath: string): Promise<string> {
  // Throw error to trigger LLM processing in upload route
  // This is intentional - LLM handles both text and image PDFs better
  throw new Error('PDF processing requires LLM. This will be handled by the upload route.')
}

// Word document extraction
export async function extractTextFromWord(filePath: string): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ path: filePath })
    return result.value
  } catch (error) {
    throw new Error(`Failed to extract text from Word document: ${error}`)
  }
}

export async function extractTextFromTxt(filePath: string): Promise<string> {
  try {
    return fs.readFileSync(filePath, 'utf-8')
  } catch (error) {
    throw new Error(`Failed to read text file: ${error}`)
  }
}

// Main text extraction function
export async function extractTextFromDocument(filePath: string, mimeType: string): Promise<string> {
  switch (mimeType) {
    case 'application/pdf':
      return extractTextFromPDF(filePath)
    case 'application/msword':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return extractTextFromWord(filePath)
    case 'text/plain':
      return extractTextFromTxt(filePath)
    default:
      throw new Error(`Unsupported file type: ${mimeType}`)
  }
}

// Helper functions (keep your existing ones)
export function fileExists(filePath: string): boolean {
  return fs.existsSync(filePath)
}

export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.error('Error deleting file:', error)
  }
}