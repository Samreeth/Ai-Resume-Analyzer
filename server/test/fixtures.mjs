/**
 * Test fixtures for Phase 5 Resume Upload validation & integration testing
 */

/**
 * Minimal valid PDF buffer matching PDF 1.4 specification
 */
export const createTestPdf = () => {
  const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 28 >>
stream
BT /F1 12 Tf (Hello Resume) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000209 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
287
%%EOF
`;
  return Buffer.from(content, 'utf8');
};

/**
 * Generate a binary in-memory ZIP archive from a map of entry names to content
 * Implements standard PKWARE ZIP specification without external dependencies
 *
 * @param {Record<string, string>} entries
 * @returns {Buffer}
 */
export const createTestZip = (entries) => {
  const parts = [];
  const cdParts = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.from(content, 'utf8');
    const nameBuf = Buffer.from(name, 'utf8');

    // Local file header (30 bytes + name length)
    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(10, 4); // version needed to extract
    local.writeUInt16LE(0, 6); // general purpose bit flag
    local.writeUInt16LE(0, 8); // compression method (0 = stored)
    local.writeUInt16LE(0, 10); // file last mod time
    local.writeUInt16LE(0, 12); // file last mod date
    local.writeUInt32LE(0, 14); // crc-32 (0 for store in test)
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26); // file name length
    local.writeUInt16LE(0, 28); // extra field length
    nameBuf.copy(local, 30);

    parts.push(local);
    parts.push(data);

    // Central directory file header (46 bytes + name length)
    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0); // signature
    cd.writeUInt16LE(20, 4); // version made by
    cd.writeUInt16LE(10, 6); // version needed to extract
    cd.writeUInt16LE(0, 8); // general purpose bit flag
    cd.writeUInt16LE(0, 10); // compression method
    cd.writeUInt16LE(0, 12); // last mod time
    cd.writeUInt16LE(0, 14); // last mod date
    cd.writeUInt32LE(0, 16); // crc-32
    cd.writeUInt32LE(data.length, 20); // compressed size
    cd.writeUInt32LE(data.length, 24); // uncompressed size
    cd.writeUInt16LE(nameBuf.length, 28); // file name length
    cd.writeUInt16LE(0, 30); // extra field length
    cd.writeUInt16LE(0, 32); // file comment length
    cd.writeUInt16LE(0, 34); // disk number start
    cd.writeUInt16LE(0, 36); // internal file attributes
    cd.writeUInt32LE(0, 38); // external file attributes
    cd.writeUInt32LE(offset, 42); // relative offset of local header
    nameBuf.copy(cd, 46);

    cdParts.push(cd);
    offset += local.length + data.length;
  }

  const cdTotalLen = cdParts.reduce((acc, part) => acc + part.length, 0);
  const cdOffset = offset;

  // End of Central Directory Record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk number with start of CD
  eocd.writeUInt16LE(Object.keys(entries).length, 8); // total entries on disk
  eocd.writeUInt16LE(Object.keys(entries).length, 10); // total entries in CD
  eocd.writeUInt32LE(cdTotalLen, 12); // size of CD
  eocd.writeUInt32LE(cdOffset, 16); // offset of start of CD
  eocd.writeUInt16LE(0, 20); // zip file comment length

  return Buffer.concat([...parts, ...cdParts, eocd]);
};

/**
 * Valid DOCX archive buffer containing mandatory [Content_Types].xml and word/document.xml
 */
export const createTestDocx = () => {
  return createTestZip({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>',
    'word/document.xml': '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:document>',
  });
};

/**
 * Invalid DOCX containing word/document2.xml instead of word/document.xml
 */
export const createInvalidDocxWithDocument2 = () => {
  return createTestZip({
    '[Content_Types].xml': '<Types/>',
    'word/document2.xml': '<w:document/>',
  });
};

/**
 * Generic non-DOCX ZIP archive
 */
export const createGenericZip = () => {
  return createTestZip({
    'photo.jpg': 'fake_jpeg_binary_data',
    'readme.txt': 'This is a general zip archive.',
  });
};

/**
 * ZIP with missing [Content_Types].xml
 */
export const createMissingContentTypesZip = () => {
  return createTestZip({
    'word/document.xml': '<w:document/>',
  });
};

/**
 * Corrupted / truncated ZIP buffer
 */
export const createCorruptedZip = () => {
  return Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0xff, 0xff]);
};

/**
 * ZIP with an excessive entry count (> 1,000 entries)
 */
export const createZipWithManyEntries = (count = 1005) => {
  const entries = {};
  for (let i = 0; i < count; i++) {
    entries[`file_${i}.txt`] = `content_${i}`;
  }
  return createTestZip(entries);
};

/**
 * ZIP with an entry name exceeding 255 characters
 */
export const createZipWithLongName = () => {
  const longName = 'a'.repeat(260) + '.txt';
  return createTestZip({
    '[Content_Types].xml': '<Types/>',
    'word/document.xml': '<w:document/>',
    [longName]: 'data',
  });
};

/**
 * ZIP with directory traversal in entry name
 */
export const createZipWithPathTraversal = () => {
  return createTestZip({
    '../[Content_Types].xml': '<Types/>',
    'word/document.xml': '<w:document/>',
  });
};

export default {
  createTestPdf,
  createTestZip,
  createTestDocx,
  createInvalidDocxWithDocument2,
  createGenericZip,
  createMissingContentTypesZip,
  createCorruptedZip,
  createZipWithManyEntries,
  createZipWithLongName,
  createZipWithPathTraversal,
};
