'use strict';

var crypto = require('node:crypto');

function isConfigured() {
  return Boolean(process.env.REVIEWS_ADMIN_TOKEN);
}

function isAuthorized(request) {
  var expected = process.env.REVIEWS_ADMIN_TOKEN;
  var authorization = request.headers.authorization || '';
  var prefix = 'Bearer ';
  if (!expected || authorization.indexOf(prefix) !== 0) return false;

  var expectedBuffer = Buffer.from(expected);
  var receivedBuffer = Buffer.from(authorization.slice(prefix.length));
  return expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

module.exports = { isConfigured: isConfigured, isAuthorized: isAuthorized };
