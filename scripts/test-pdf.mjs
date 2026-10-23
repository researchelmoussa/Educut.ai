import fs from 'fs';

function buildPdfFromJpeg(jpegBuffer, width, height) {
  const mediaWidth = 842; // A4 landscape pt
  const mediaHeight = 595;

  const contentStream = `q ${mediaWidth} 0 0 ${mediaHeight} 0 0 cm /Im1 Do Q\n`;
  const contentLen = Buffer.byteLength(contentStream, 'utf8');

  const header = `%PDF-1.4\n`;
  
  const obj1 = `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`;
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${mediaWidth} ${mediaHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`;
  const obj4Head = `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBuffer.length} >>\nstream\n`;
  const obj4Tail = `\nendstream\nendobj\n`;
  const obj5 = `5 0 obj\n<< /Length ${contentLen} >>\nstream\n${contentStream}endstream\nendobj\n`;

  // Calculate offsets
  const offsets = [];
  let cur = Buffer.byteLength(header, 'utf8');

  offsets.push(cur); // obj 1
  cur += Buffer.byteLength(obj1, 'utf8');

  offsets.push(cur); // obj 2
  cur += Buffer.byteLength(obj2, 'utf8');

  offsets.push(cur); // obj 3
  cur += Buffer.byteLength(obj3, 'utf8');

  offsets.push(cur); // obj 4
  cur += Buffer.byteLength(obj4Head, 'utf8') + jpegBuffer.length + Buffer.byteLength(obj4Tail, 'utf8');

  offsets.push(cur); // obj 5
  cur += Buffer.byteLength(obj5, 'utf8');

  const startXref = cur;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += String(off).padStart(10, '0') + ` 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  return Buffer.concat([
    Buffer.from(header, 'utf8'),
    Buffer.from(obj1, 'utf8'),
    Buffer.from(obj2, 'utf8'),
    Buffer.from(obj3, 'utf8'),
    Buffer.from(obj4Head, 'utf8'),
    jpegBuffer,
    Buffer.from(obj4Tail, 'utf8'),
    Buffer.from(obj5, 'utf8'),
    Buffer.from(xref, 'utf8'),
    Buffer.from(trailer, 'utf8')
  ]);
}

// Minimal 1x1 JPEG test
const minimalJpeg = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
const pdfBuf = buildPdfFromJpeg(minimalJpeg, 1, 1);
fs.writeFileSync('scripts/test.pdf', pdfBuf);
console.log('PDF generated successfully, size:', pdfBuf.length);
