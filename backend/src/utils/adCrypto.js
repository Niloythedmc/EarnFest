export function encryptPayload(payloadObj, key) {
  const text = JSON.stringify(payloadObj);
  let result = [];
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const keyChar = key.charCodeAt(i % key.length);
    const encryptedByte = (charCode ^ keyChar) & 0xFF;
    result.push(encryptedByte.toString(16).padStart(2, '0'));
  }
  return result.join('');
}

export function decryptPayload(hexStr, key) {
  let result = '';
  for (let i = 0; i < hexStr.length; i += 2) {
    const byteVal = parseInt(hexStr.substring(i, i + 2), 16);
    const keyChar = key.charCodeAt((i / 2) % key.length);
    result += String.fromCharCode(byteVal ^ keyChar);
  }
  return JSON.parse(result);
}
