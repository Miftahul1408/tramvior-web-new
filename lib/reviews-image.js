'use strict';

var maximumImageSize = 2 * 1024 * 1024;
var imageTypes = {
  'image/png': { extension: 'png', signature: function (buffer) {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  } },
  'image/jpeg': { extension: 'jpg', signature: function (buffer) {
    return buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  } },
  'image/webp': { extension: 'webp', signature: function (buffer) {
    return buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP';
  } }
};

function decodeReviewImage(imageData) {
  var match = typeof imageData === 'string' &&
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(imageData);
  if (!match) return null;

  var imageType = imageTypes[match[1]];
  var imageBuffer = Buffer.from(match[2], 'base64');
  if (imageBuffer.length > maximumImageSize ||
    imageBuffer.toString('base64') !== match[2] ||
    !imageType.signature(imageBuffer)) {
    return null;
  }
  return { buffer: imageBuffer, contentType: match[1], extension: imageType.extension };
}

module.exports = { decodeReviewImage: decodeReviewImage };
