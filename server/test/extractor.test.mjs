/**
 * Unit test suite for Phase 6 Stage 2: Utilities and Extractors
 */

import {
  sanitizeResumeText,
  validateExtractedText,
  ExtractionError,
  EXTRACTION_LIMITS,
} from '../src/utils/text.util.mjs';
import storageService from '../src/services/storage.service.mjs';
import { extractTextFromPdf } from '../src/services/extractors/pdf.extractor.mjs';
import { extractTextFromDocx } from '../src/services/extractors/docx.extractor.mjs';
import yauzl from 'yauzl';
import {
  createValidResumePdf,
  createEncryptedPdf,
  createEmptyTextPdf,
  createValidResumeDocx,
  createDocxWithXxe,
  createDocxWithEntity,
  createEmptyTextDocx,
  createDocxWithXmlOfSize,
  createMissingContentTypesZip,
  createMissingDocumentXmlZip,
  createInvalidDocxWithDocument2,
  createCorruptedZip,
} from './fixtures.mjs';

const test = async (name, fn) => {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    if (err.stack) console.error(err.stack);
    process.exitCode = 1;
  }
};

const assertThrows = async (fn, expectedCode) => {
  let threw = false;
  try {
    await fn();
  } catch (err) {
    threw = true;
    if (expectedCode && err.code !== expectedCode) {
      throw new Error(`Expected error code "${expectedCode}", but received "${err.code}": ${err.message}`);
    }
  }
  if (!threw) {
    throw new Error(`Expected function to throw code "${expectedCode}", but it succeeded without error`);
  }
};

async function run() {
  console.log('====================================================');
  console.log('Running Phase 6 Stage 2: Extractor & Utility Tests');
  console.log('====================================================\n');

  // ==========================================================================
  // 1. Text Sanitization & Validation Tests
  // ==========================================================================
  await test('Text Sanitizer: Normalizes Unicode NFKC ligatures', () => {
    const raw = 'Proﬁcient in ofﬁce tools and ﬂexible architectures.'; // ligatures fi, fl
    const cleaned = sanitizeResumeText(raw);
    if (cleaned !== 'Proficient in office tools and flexible architectures.') {
      throw new Error(`Unexpected NFKC result: "${cleaned}"`);
    }
  });

  await test('Text Sanitizer: Strips null bytes and control chars while preserving newlines, tabs, and bullets', () => {
    const raw = 'Header\u0000\x07\x1B\n• Item 1\t$100k\r\n– Item 2\x0C';
    const cleaned = sanitizeResumeText(raw);
    const expected = 'Header\n• Item 1\t$100k\n– Item 2';
    if (cleaned !== expected) {
      throw new Error(`Expected "${expected}", got "${cleaned}"`);
    }
  });

  await test('Text Sanitizer: Collapses 3+ newlines to exactly 2 without destroying paragraph separation', () => {
    const raw = 'Paragraph 1\n\n\n\n\nParagraph 2\n\nParagraph 3';
    const cleaned = sanitizeResumeText(raw);
    const expected = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
    if (cleaned !== expected) {
      throw new Error(`Expected "${expected}", got "${cleaned}"`);
    }
  });

  await test('Text Validator: Rejects documents with fewer than 20 readable characters', () => {
    assertThrows(() => {
      validateExtractedText('Short text');
    }, 'NO_READABLE_TEXT');

    assertThrows(() => {
      validateExtractedText('   \n\n\t   ');
    }, 'NO_READABLE_TEXT');
  });

  await test('Text Validator: Rejects documents exceeding maximum character limit', () => {
    const largeText = 'A'.repeat(EXTRACTION_LIMITS.MAX_TEXT_LENGTH + 10);
    assertThrows(() => {
      validateExtractedText(largeText);
    }, 'TEXT_LIMIT_EXCEEDED');
  });

  await test('Text Validator: Validates non-empty document with character and word count', () => {
    const valid = 'Jane Doe is a software engineer with 10 years of experience.';
    const res = validateExtractedText(valid);
    if (res.characterCount !== valid.length || res.wordCount < 5) {
      throw new Error('Word or character count inaccurate');
    }
  });

  // ==========================================================================
  // 2. Storage Service: readFileBuffer Tests
  // ==========================================================================
  await test('Storage Service: readFileBuffer validates path jail and reads stored file', async () => {
    const testBuffer = Buffer.from('Testing storage read buffer functionality');
    const saved = await storageService.saveFileAtomic(testBuffer, '.pdf');

    try {
      const read = await storageService.readFileBuffer(saved.relativePath);
      if (!read.equals(testBuffer)) {
        throw new Error('Read buffer does not match written buffer');
      }
    } finally {
      await storageService.deleteFile(saved.relativePath);
    }
  });

  await test('Storage Service: readFileBuffer rejects path traversal attempts', async () => {
    await assertThrows(async () => {
      await storageService.readFileBuffer('resumes/../../etc/passwd');
    }, 'INVALID_PATH');

    await assertThrows(async () => {
      await storageService.readFileBuffer('../secret.pdf');
    }, 'INVALID_PATH');
  });

  await test('Storage Service: readFileBuffer returns STORAGE_READ_ERROR when file is missing', async () => {
    await assertThrows(async () => {
      await storageService.readFileBuffer('resumes/00000000-0000-0000-0000-000000000000.pdf');
    }, 'STORAGE_READ_ERROR');
  });

  // ==========================================================================
  // 3. PDF Extractor Tests
  // ==========================================================================
  await test('PDF Extractor: Extracts plain text accurately from valid PDF', async () => {
    const sampleText = 'Alice Johnson\nPrincipal Cloud Engineer\nProficient in Kubernetes, Go, and PostgreSQL.';
    const pdfBuffer = createValidResumePdf(sampleText);
    const result = await extractTextFromPdf(pdfBuffer);

    if (result.format !== 'pdf') throw new Error(`Expected format pdf, got ${result.format}`);
    if (result.totalPages !== 1) throw new Error(`Expected 1 page, got ${result.totalPages}`);
    if (!result.text.includes('Alice Johnson') || !result.text.includes('Principal Cloud Engineer')) {
      throw new Error(`Extracted text does not contain expected content: "${result.text}"`);
    }
    if (result.characterCount < 20) throw new Error('Expected characterCount >= 20');
  });

  await test('PDF Extractor: Rejects corrupted/malformed PDF with CORRUPTED_DOCUMENT', async () => {
    const corruptBuffer = Buffer.from('%PDF-1.4\ncorrupted xref table and non-pdf junk stream');
    await assertThrows(async () => {
      await extractTextFromPdf(corruptBuffer);
    }, 'CORRUPTED_DOCUMENT');
  });

  await test('PDF Extractor: Catches encrypted/password-protected PDF with DOCUMENT_ENCRYPTED', async () => {
    const encryptedPdf = createEncryptedPdf();
    await assertThrows(async () => {
      await extractTextFromPdf(encryptedPdf);
    }, 'DOCUMENT_ENCRYPTED');
  });

  await test('PDF Extractor: Rejects empty/textless PDF with NO_READABLE_TEXT', async () => {
    const emptyPdf = createEmptyTextPdf();
    await assertThrows(async () => {
      await extractTextFromPdf(emptyPdf);
    }, 'NO_READABLE_TEXT');
  });

  await test('PDF Extractor: Handles extraction deadline timeout via Promise.race', async () => {
    const pdfBuffer = createValidResumePdf();
    // Pass deadline of 0ms to force immediate timeout
    await assertThrows(async () => {
      await extractTextFromPdf(pdfBuffer, { timeoutMs: 0 });
    }, 'EXTRACTION_TIMEOUT');
  });

  // ==========================================================================
  // 4. DOCX Extractor Tests
  // ==========================================================================
  await test('DOCX Extractor: Extracts structured text with paragraphs and tables from valid DOCX', async () => {
    const docxBuffer = createValidResumeDocx();
    const result = await extractTextFromDocx(docxBuffer);

    if (result.format !== 'docx') throw new Error(`Expected format docx, got ${result.format}`);
    if (!result.text.includes('John Doe') || !result.text.includes('Senior Full Stack Engineer')) {
      throw new Error(`Extracted text missing expected content: "${result.text}"`);
    }
    if (!result.text.includes('JavaScript\t8 Years')) {
      throw new Error(`Table content was not extracted with tabs: "${result.text}"`);
    }
    if (result.characterCount < 20) throw new Error('Expected characterCount >= 20');
  });

  await test('DOCX Extractor: Rejects archive missing root [Content_Types].xml', async () => {
    const buffer = createMissingContentTypesZip();
    await assertThrows(async () => {
      await extractTextFromDocx(buffer);
    }, 'CORRUPTED_DOCUMENT');
  });

  await test('DOCX Extractor: Strictly rejects substitute part name word/document2.xml', async () => {
    const buffer = createInvalidDocxWithDocument2();
    await assertThrows(async () => {
      await extractTextFromDocx(buffer);
    }, 'CORRUPTED_DOCUMENT');
  });

  await test('DOCX Extractor: Rejects malformed or truncated ZIP archives', async () => {
    const buffer = createCorruptedZip();
    await assertThrows(async () => {
      await extractTextFromDocx(buffer);
    }, 'CORRUPTED_DOCUMENT');
  });

  await test('DOCX Extractor: Rejects XML payloads containing <!DOCTYPE declarations', async () => {
    const xxeDocx = createDocxWithXxe();
    await assertThrows(async () => {
      await extractTextFromDocx(xxeDocx);
    }, 'UNSAFE_XML_DECLARATION');
  });

  await test('DOCX Extractor: Rejects XML payloads containing <!ENTITY declarations', async () => {
    const entityDocx = createDocxWithEntity();
    await assertThrows(async () => {
      await extractTextFromDocx(entityDocx);
    }, 'UNSAFE_XML_DECLARATION');
  });

  await test('DOCX Extractor: Rejects archive missing required word/document.xml', async () => {
    const buffer = createMissingDocumentXmlZip();
    await assertThrows(async () => {
      await extractTextFromDocx(buffer);
    }, 'CORRUPTED_DOCUMENT');
  });

  await test('DOCX Extractor: Enforces uncompressed XML stream limit and halts stream', async () => {
    // Generate DOCX with 3,000 bytes XML, test with maxXmlBytes = 1,000
    const largeXmlDocx = createDocxWithXmlOfSize(3000);
    await assertThrows(async () => {
      await extractTextFromDocx(largeXmlDocx, { maxXmlBytes: 1000 });
    }, 'DECOMPRESSION_LIMIT_EXCEEDED');
  });

  await test('DOCX Extractor: Enforces total archive read limit and halts stream', async () => {
    // Generate DOCX with 3,000 bytes XML, test with maxTotalBytes = 1,000
    const largeXmlDocx = createDocxWithXmlOfSize(3000);
    await assertThrows(async () => {
      await extractTextFromDocx(largeXmlDocx, { maxTotalBytes: 1000 });
    }, 'ARCHIVE_SIZE_LIMIT_EXCEEDED');
  });

  await test('DOCX Extractor: Destroys stream and closes ZIP file on limit violation', async () => {
    let zipClosed = false;
    let streamDestroyed = false;

    const largeXmlDocx = createDocxWithXmlOfSize(3000);
    const originalFromBuffer = yauzl.fromBuffer;

    yauzl.fromBuffer = (buffer, options, callback) => {
      originalFromBuffer(buffer, options, (err, zipfile) => {
        if (err) return callback(err);
        const originalClose = zipfile.close.bind(zipfile);
        zipfile.close = () => {
          zipClosed = true;
          return originalClose();
        };
        const originalOpenReadStream = zipfile.openReadStream.bind(zipfile);
        zipfile.openReadStream = (entry, streamCallback) => {
          originalOpenReadStream(entry, (sErr, stream) => {
            if (sErr) return streamCallback(sErr);
            const originalDestroy = stream.destroy.bind(stream);
            stream.destroy = () => {
              streamDestroyed = true;
              return originalDestroy();
            };
            streamCallback(null, stream);
          });
        };
        callback(null, zipfile);
      });
    };

    try {
      await assertThrows(async () => {
        await extractTextFromDocx(largeXmlDocx, { maxXmlBytes: 1000 });
      }, 'DECOMPRESSION_LIMIT_EXCEEDED');

      if (!zipClosed) {
        throw new Error('Expected zipfile.close() to be called on error');
      }
      if (!streamDestroyed) {
        throw new Error('Expected stream.destroy() to be called on limit violation');
      }
    } finally {
      yauzl.fromBuffer = originalFromBuffer;
    }
  });

  await test('DOCX Extractor: Rejects empty body with NO_READABLE_TEXT', async () => {
    const emptyDocx = createEmptyTextDocx();
    await assertThrows(async () => {
      await extractTextFromDocx(emptyDocx);
    }, 'NO_READABLE_TEXT');
  });

  await test('DOCX Extractor: Rejects invalid or empty buffer', async () => {
    await assertThrows(async () => {
      await extractTextFromDocx(null);
    }, 'INVALID_BUFFER');

    await assertThrows(async () => {
      await extractTextFromDocx(Buffer.alloc(0));
    }, 'INVALID_BUFFER');
  });

  console.log('\n====================================================');
  console.log('Stage 2 Extractor & Utility Suite Complete');
  console.log('====================================================\n');
}

run().catch((err) => {
  console.error('Unhandled test suite failure:', err);
  process.exit(1);
});
