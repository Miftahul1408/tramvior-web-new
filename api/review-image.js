'use strict';

var auth = require('../lib/reviews-auth');
var images = require('../lib/reviews-image');
var storage = require('../lib/reviews-storage');

function sendError(response, status, message) {
  response.status(status).json({ error: message });
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'private, no-store');
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return sendError(response, 405, 'Method not allowed.');
  }
  if (!storage.hasDataStore()) {
    return sendError(response, 503, 'Review data storage is not configured.');
  }
  if (!auth.isConfigured()) {
    return sendError(response, 503, 'Review admin access is not configured.');
  }
  if (!auth.isAuthorized(request)) {
    return sendError(response, 401, 'Admin authorization is required.');
  }

  var reviewId = request.query && request.query.reviewId;
  if (typeof reviewId !== 'string' || !reviewId) {
    return sendError(response, 400, 'A review ID is required.');
  }

  try {
    var reviews = await storage.loadReviews();
    var review = reviews.find(function (item) { return item.id === reviewId; });
    var image = review && !review.published ? images.decodeReviewImage(review.image) : null;
    if (!image) return sendError(response, 404, 'Private review image not found.');

    response.setHeader('Content-Type', image.contentType);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return response.status(200).end(image.buffer);
  } catch (error) {
    console.error('Unable to load private review image.', error);
    return sendError(response, 500, 'Review image could not be loaded.');
  }
};
