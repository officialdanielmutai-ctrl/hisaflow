const fs = require('fs');

function getPngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
    return 'Not a valid PNG';
  }
  // IHDR chunk should follow immediately after signature (at offset 8)
  // IHDR width is at offset 16 (4 bytes), height at offset 20 (4 bytes)
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return `${width}x${height}`;
}

console.log('icon-192.png:', getPngDimensions('e:/LEINTUM/Hisa Flow/apps/frontend/public/icons/icon-192.png'));
console.log('icon-512.png:', getPngDimensions('e:/LEINTUM/Hisa Flow/apps/frontend/public/icons/icon-512.png'));
