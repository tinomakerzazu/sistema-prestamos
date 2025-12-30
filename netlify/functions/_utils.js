const crypto = require('crypto');

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  };
}

function parseJsonBody(body) {
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch (err) {
    return {};
  }
}

function getPathId(event, functionName) {
  const raw = event.path || '';
  const parts = raw.split('/').filter(Boolean);
  const index = parts.indexOf(functionName);
  if (index === -1) return null;
  const id = parts[index + 1];
  return id || null;
}

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseDataUrl(dataUrl) {
  if (!dataUrl) return null;
  if (dataUrl.startsWith('data:')) {
    const match = dataUrl.match(/^data:(.+);base64,(.*)$/);
    if (!match) return null;
    return {
      contentType: match[1],
      buffer: Buffer.from(match[2], 'base64')
    };
  }

  return {
    contentType: 'application/octet-stream',
    buffer: Buffer.from(dataUrl, 'base64')
  };
}

function getExtensionFromType(contentType) {
  if (!contentType) return '.bin';
  if (contentType.includes('png')) return '.png';
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return '.jpg';
  if (contentType.includes('webp')) return '.webp';
  return '.bin';
}

module.exports = {
  jsonResponse,
  parseJsonBody,
  getPathId,
  makeId,
  parseDataUrl,
  getExtensionFromType
};
