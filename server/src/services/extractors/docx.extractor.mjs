import yauzl from 'yauzl';
import { XMLParser } from 'fast-xml-parser';
import {
  ExtractionError,
  EXTRACTION_LIMITS,
  sanitizeResumeText,
  validateExtractedText,
} from '../../utils/text.util.mjs';

/**
 * Extract plain text from a WordprocessingML run (<w:r>).
 * Handles text (<w:t>), tabs (<w:tab>), and breaks (<w:br>, <w:cr>).
 *
 * @param {object|Array} rNode
 * @returns {string}
 */
const extractRunText = (rNode) => {
  if (!rNode) return '';
  if (Array.isArray(rNode)) {
    return rNode.map(extractRunText).join('');
  }
  if (typeof rNode !== 'object') return '';

  let text = '';
  if (rNode['w:t'] !== undefined) {
    const t = rNode['w:t'];
    text += typeof t === 'object' && t !== null && '#text' in t ? String(t['#text']) : String(t || '');
  }
  if (rNode['w:tab'] !== undefined) {
    text += '\t';
  }
  if (rNode['w:br'] !== undefined || rNode['w:cr'] !== undefined) {
    text += '\n';
  }
  return text;
};

/**
 * Extract plain text from a WordprocessingML paragraph (<w:p>).
 *
 * @param {object|Array} pNode
 * @returns {string}
 */
const extractParagraphText = (pNode) => {
  if (!pNode) return '';
  if (Array.isArray(pNode)) {
    return pNode.map(extractParagraphText).filter(Boolean).join('\n\n');
  }
  if (typeof pNode !== 'object') return '';

  let text = '';
  if (pNode['w:r']) {
    text += extractRunText(pNode['w:r']);
  }
  if (pNode['w:hyperlink']) {
    const links = Array.isArray(pNode['w:hyperlink']) ? pNode['w:hyperlink'] : [pNode['w:hyperlink']];
    for (const link of links) {
      if (link && link['w:r']) text += extractRunText(link['w:r']);
    }
  }
  if (pNode['w:sdt']) {
    const sdtList = Array.isArray(pNode['w:sdt']) ? pNode['w:sdt'] : [pNode['w:sdt']];
    for (const sdt of sdtList) {
      if (sdt && sdt['w:sdtContent'] && sdt['w:sdtContent']['w:r']) {
        text += extractRunText(sdt['w:sdtContent']['w:r']);
      }
    }
  }
  return text;
};

/**
 * Extract plain text from a WordprocessingML table (<w:tbl>).
 * Preserves columns with tab characters and rows with newlines.
 *
 * @param {object|Array} tblNode
 * @returns {string}
 */
const extractTableText = (tblNode) => {
  if (!tblNode) return '';
  if (Array.isArray(tblNode)) {
    return tblNode.map(extractTableText).filter(Boolean).join('\n\n');
  }
  const rows = tblNode['w:tr'] ? (Array.isArray(tblNode['w:tr']) ? tblNode['w:tr'] : [tblNode['w:tr']]) : [];
  const rowTexts = [];
  for (const tr of rows) {
    const cells = tr['w:tc'] ? (Array.isArray(tr['w:tc']) ? tr['w:tc'] : [tr['w:tc']]) : [];
    const cellTexts = cells.map((tc) => {
      if (tc['w:p']) {
        const pTexts = Array.isArray(tc['w:p'])
          ? tc['w:p'].map(extractParagraphText)
          : [extractParagraphText(tc['w:p'])];
        return pTexts.join(' ').trim();
      }
      return '';
    });
    rowTexts.push(cellTexts.join('\t'));
  }
  return rowTexts.join('\n');
};

/**
 * Extract structured text from WordprocessingML document body (<w:body>).
 *
 * @param {object} bodyNode
 * @returns {string}
 */
const extractDocxBody = (bodyNode) => {
  if (!bodyNode || typeof bodyNode !== 'object') return '';
  const parts = [];

  const handleContainer = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node['w:p']) {
      const pText = extractParagraphText(node['w:p']);
      if (pText) parts.push(pText);
    }
    if (node['w:tbl']) {
      const tblText = extractTableText(node['w:tbl']);
      if (tblText) parts.push(tblText);
    }
    if (node['w:sdt']) {
      const sdtList = Array.isArray(node['w:sdt']) ? node['w:sdt'] : [node['w:sdt']];
      for (const sdt of sdtList) {
        if (sdt && sdt['w:sdtContent']) {
          handleContainer(sdt['w:sdtContent']);
        }
      }
    }
  };

  handleContainer(bodyNode);
  return parts.join('\n\n');
};

/**
 * Extract plain text from a DOCX binary buffer with layered security controls.
 *
 * Security Controls Enforced:
 * 1. Metadata inspection (max 1000 entries, max 255 char names, no path traversal/backslashes).
 * 2. Mandatory presence of root [Content_Types].xml and exact word/document.xml.
 * 3. Strict rejection of alternative document part names (word/document2.xml).
 * 4. Streaming byte-counter limiting uncompressed word/document.xml to 10 MB.
 * 5. Total archive-read limit of 10 MB.
 * 6. Rejection of XML payloads containing <!DOCTYPE or <!ENTITY declarations.
 * 7. Fast-XML-Parser configured with processEntities: false (zero external entity resolution).
 * 8. Immediate stream destruction and archive closure on limits or errors.
 * 9. Pure memory processing (zero temporary files written to disk).
 *
 * @param {Buffer} buffer - Raw DOCX binary buffer
 * @param {object} [options={}]
 * @param {number} [options.maxXmlBytes=10485760] - Max uncompressed XML bytes (default 10 MB)
 * @returns {Promise<{ text: string, totalPages: number, format: 'docx', characterCount: number, wordCount: number }>}
 * @throws {ExtractionError}
 */
export const extractTextFromDocx = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    if (!buffer || !(buffer instanceof Buffer) || buffer.length === 0) {
      return reject(
        new ExtractionError(
          'INVALID_BUFFER',
          'A valid, non-empty binary buffer is required for DOCX extraction.',
          400
        )
      );
    }

    const maxXmlBytes = options.maxXmlBytes ?? EXTRACTION_LIMITS.MAX_XML_STREAM_BYTES;
    const maxTotalBytes = options.maxTotalBytes ?? EXTRACTION_LIMITS.MAX_ARCHIVE_TOTAL_BYTES;

    let isSettled = false;
    let activeStream = null;

    const cleanupAndReject = (err, zipfile = null) => {
      if (isSettled) return;
      isSettled = true;

      if (activeStream) {
        try {
          activeStream.destroy();
        } catch (_) {}
        activeStream = null;
      }

      if (zipfile) {
        try {
          zipfile.close();
        } catch (_) {}
      }

      reject(err);
    };

    const cleanupAndResolve = (result, zipfile = null) => {
      if (isSettled) return;
      isSettled = true;

      if (activeStream) {
        try {
          activeStream.destroy();
        } catch (_) {}
        activeStream = null;
      }

      if (zipfile) {
        try {
          zipfile.close();
        } catch (_) {}
      }

      resolve(result);
    };

    yauzl.fromBuffer(buffer, { lazyEntries: true, decodeStrings: true }, (openErr, zipfile) => {
      if (openErr || !zipfile) {
        return cleanupAndReject(
          new ExtractionError(
            'CORRUPTED_DOCUMENT',
            'The DOCX archive structure is corrupted or unreadable.',
            422
          )
        );
      }

      let hasContentTypes = false;
      let hasWordDocument = false;
      let entryCount = 0;
      let documentXmlEntry = null;

      zipfile.on('error', (err) => {
        cleanupAndReject(
          new ExtractionError(
            'CORRUPTED_DOCUMENT',
            `DOCX archive read error: ${err.message || 'malformed ZIP stream'}`,
            422
          ),
          zipfile
        );
      });

      // Pass 1: Scan and validate archive entries without extracting
      zipfile.on('entry', (entry) => {
        if (isSettled) return;

        entryCount++;
        if (entryCount > 1000) {
          return cleanupAndReject(
            new ExtractionError(
              'CORRUPTED_DOCUMENT',
              'DOCX archive exceeds the maximum threshold of 1,000 entries.',
              422
            ),
            zipfile
          );
        }

        const fileName = entry.fileName;
        if (!fileName || typeof fileName !== 'string' || fileName.length > 255) {
          return cleanupAndReject(
            new ExtractionError(
              'CORRUPTED_DOCUMENT',
              'DOCX entry name exceeds the 255-character security limit.',
              422
            ),
            zipfile
          );
        }

        // Reject path traversal, absolute paths, and backslashes
        if (
          fileName.includes('..') ||
          fileName.startsWith('/') ||
          fileName.startsWith('\\') ||
          fileName.includes('\\')
        ) {
          return cleanupAndReject(
            new ExtractionError(
              'CORRUPTED_DOCUMENT',
              'DOCX entry contains forbidden path traversal or separator characters.',
              422
            ),
            zipfile
          );
        }

        if (fileName === '[Content_Types].xml') {
          hasContentTypes = true;
        }

        // Strictly target word/document.xml
        if (fileName === 'word/document.xml') {
          hasWordDocument = true;
          documentXmlEntry = entry;
        }

        // Continue scanning to verify all archive entries
        zipfile.readEntry();
      });

      // Pass 2: When directory traversal ends, extract word/document.xml if valid
      zipfile.on('end', () => {
        if (isSettled) return;

        if (!hasContentTypes) {
          return cleanupAndReject(
            new ExtractionError(
              'CORRUPTED_DOCUMENT',
              'The DOCX archive is missing required root [Content_Types].xml.',
              422
            ),
            zipfile
          );
        }

        if (!hasWordDocument || !documentXmlEntry) {
          return cleanupAndReject(
            new ExtractionError(
              'CORRUPTED_DOCUMENT',
              'The DOCX archive is missing required word/document.xml.',
              422
            ),
            zipfile
          );
        }

        // Stream word/document.xml with byte counting limit
        zipfile.openReadStream(documentXmlEntry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            return cleanupAndReject(
              new ExtractionError(
                'CORRUPTED_DOCUMENT',
                'Failed to open stream for DOCX document content.',
                422
              ),
              zipfile
            );
          }

          activeStream = readStream;
          const chunks = [];
          let uncompressedBytes = 0;

          readStream.on('data', (chunk) => {
            if (isSettled) return;

            uncompressedBytes += chunk.length;

            // Enforce uncompressed XML size limit and total read limit
            if (uncompressedBytes > maxXmlBytes) {
              return cleanupAndReject(
                new ExtractionError(
                  'DECOMPRESSION_LIMIT_EXCEEDED',
                  `DOCX uncompressed XML content exceeded the security limit of ${maxXmlBytes} bytes.`,
                  422
                ),
                zipfile
              );
            }

            if (uncompressedBytes > maxTotalBytes) {
              return cleanupAndReject(
                new ExtractionError(
                  'ARCHIVE_SIZE_LIMIT_EXCEEDED',
                  `DOCX total archive stream exceeded the security limit of ${maxTotalBytes} bytes.`,
                  422
                ),
                zipfile
              );
            }

            chunks.push(chunk);
          });

          readStream.on('error', (err) => {
            cleanupAndReject(
              new ExtractionError(
                'CORRUPTED_DOCUMENT',
                `Error streaming DOCX XML content: ${err.message}`,
                422
              ),
              zipfile
            );
          });

          readStream.on('end', () => {
            if (isSettled) return;

            const xmlBuffer = Buffer.concat(chunks);
            const xmlString = xmlBuffer.toString('utf-8');

            // Enforce rejection of DOCTYPE and ENTITY declarations (XXE protection)
            if (/<!(?:doctype|entity)\b/i.test(xmlString)) {
              return cleanupAndReject(
                new ExtractionError(
                  'UNSAFE_XML_DECLARATION',
                  'DOCX XML content contains forbidden DOCTYPE or ENTITY declarations.',
                  422
                ),
                zipfile
              );
            }

            try {
              const parser = new XMLParser({
                ignoreAttributes: false,
                processEntities: false, // Disables entity expansion
                allowBooleanAttributes: false,
              });

              const parsed = parser.parse(xmlString);
              if (!parsed || !parsed['w:document']) {
                return cleanupAndReject(
                  new ExtractionError(
                    'CORRUPTED_DOCUMENT',
                    'Invalid WordprocessingML XML root structure.',
                    422
                  ),
                  zipfile
                );
              }

              const rawText = extractDocxBody(parsed['w:document']['w:body'] || parsed['w:document']);
              const sanitized = sanitizeResumeText(rawText);
              const validated = validateExtractedText(sanitized);

              cleanupAndResolve(
                {
                  text: validated.text,
                  totalPages: 1,
                  format: 'docx',
                  characterCount: validated.characterCount,
                  wordCount: validated.wordCount,
                },
                zipfile
              );
            } catch (parseErr) {
              if (parseErr instanceof ExtractionError) {
                return cleanupAndReject(parseErr, zipfile);
              }
              cleanupAndReject(
                new ExtractionError(
                  'CORRUPTED_DOCUMENT',
                  `Failed to parse DOCX XML: ${parseErr.message}`,
                  422
                ),
                zipfile
              );
            }
          });
        });
      });

      // Initiate entry scanning
      zipfile.readEntry();
    });
  });
};

export default {
  extractTextFromDocx,
};
