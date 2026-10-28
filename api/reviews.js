'use strict';

var crypto = require('node:crypto');
var blob = require('@vercel/blob');
var auth = require('../lib/reviews-auth');
var images = require('../lib/reviews-image');
var storage = require('../lib/reviews-storage');

function isPrivateImageReference(value) {
  return typeof value === 'string' && /^private:[a-zA-Z0-9_-]{1,100}$/.test(value);
}

function sendError(response, status, message) {
  response.status(status).json({ error: message });
}

function isPublicImageUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    var url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname.endsWith('.public.blob.vercel-storage.com');
  } catch (error) {
    return false;
  }
}

function isValidReview(review) {
  return review &&
    typeof review.id === 'string' && review.id.length > 0 && review.id.length <= 100 &&
    typeof review.name === 'string' && review.name.length > 0 && review.name.length <= 60 &&
    typeof review.school === 'string' && review.school.length > 0 && review.school.length <= 100 &&
    typeof review.program === 'string' && review.program.length <= 80 &&
    typeof review.quote === 'string' && review.quote.length > 0 && review.quote.length <= 350 &&
    Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5 &&
    typeof review.published === 'boolean' &&
    typeof review.updatedAt === 'string' &&
    (review.image === undefined ||
      isPublicImageUrl(review.image) ||
      isPrivateImageReference(review.image) ||
      Boolean(images.decodeReviewImage(review.image)));
}

function isStoredReview(review) {
  return isValidReview(review) &&
    (review.image === undefined ||
      isPublicImageUrl(review.image) ||
      (!review.published &&
        (isPrivateImageReference(review.image) || Boolean(images.decodeReviewImage(review.image)))));
}

function sanitizeReviews(reviews) {
  return reviews.map(function (review) {
    if (!review.published && images.decodeReviewImage(review.image)) {
      return Object.assign({}, review, { image: 'private:' + review.id });
    }
    return review;
  });
}

function getPublicImageUrls(reviews) {
  return new Set(reviews.map(function (review) {
    return review.image;
  }).filter(isPublicImageUrl));
}

async function prepareReviews(reviews, previousReviews) {
  var prepared = [];
  for (var index = 0; index < reviews.length; index += 1) {
    var review = Object.assign({}, reviews[index]);
    if (isPrivateImageReference(review.image)) {
      var previousReview = previousReviews.find(function (item) { return item.id === review.id; });
      if (!previousReview || previousReview.published || !images.decodeReviewImage(previousReview.image)) {
        throw new Error('Pending review image is no longer available.');
      }
      review.image = previousReview.image;
    }

    var decodedImage = images.decodeReviewImage(review.image);
    if (decodedImage) {
      if (review.published) {
        if (!storage.hasImageStore()) throw new Error('Review image storage is not configured.');
        var uploaded = await blob.put(
          'review-images/' + crypto.randomUUID() + '.' + decodedImage.extension,
          decodedImage.buffer,
          {
            access: 'public',
            token: process.env.REVIEWS_IMAGES_BLOB_TOKEN,
            addRandomSuffix: false,
            contentType: decodedImage.contentType
          }
        );
        review.image = uploaded.url;
      }
    }
    prepared.push(review);
  }
  return prepared;
}

function readBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') return JSON.parse(request.body);
  return {};
}

module.exports = async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!storage.hasDataStore()) {
    return sendError(response, 503, 'Review data storage is not configured.');
  }
  if (!auth.isConfigured()) {
    return sendError(response, 503, 'Review admin access is not configured.');
  }

  if (request.method === 'GET') {
    var isAdminRequest = request.query && request.query.admin === '1';
    if (isAdminRequest && !auth.isAuthorized(request)) {
      return sendError(response, 401, 'Admin authorization is required.');
    }

    try {
      var reviews = await storage.loadReviews();
      if (!reviews.every(isStoredReview)) throw new Error('Stored reviews have an invalid format.');
      var visibleReviews = isAdminRequest
        ? reviews
        : reviews.filter(function (review) { return review.published === true; });
      var sanitizedReviews = isAdminRequest ? sanitizeReviews(visibleReviews) : visibleReviews;
      return response.status(200).json(sanitizedReviews.slice(0, isAdminRequest ? 500 : 6));
    } catch (error) {
      console.error('Unable to load reviews from Vercel Blob.', error);
      return sendError(response, 500, 'Reviews could not be loaded.');
    }
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST');
    return sendError(response, 405, 'Method not allowed.');
  }
  if (!auth.isAuthorized(request)) {
    return sendError(response, 401, 'Admin authorization is required.');
  }

  var reviews;
  try {
    reviews = readBody(request).reviews;
  } catch (error) {
    return sendError(response, 400, 'Request body must be valid JSON.');
  }
  if (!Array.isArray(reviews) || reviews.length > 500 || !reviews.every(isValidReview)) {
    return sendError(response, 400, 'Review data is invalid.');
  }
  var reviewIds = new Set(reviews.map(function (review) { return review.id; }));
  if (reviewIds.size !== reviews.length) {
    return sendError(response, 400, 'Review IDs must be unique.');
  }
  if (!storage.hasImageStore() && reviews.some(function (review) {
    return review.published &&
      (isPrivateImageReference(review.image) || Boolean(images.decodeReviewImage(review.image)));
  })) {
    return sendError(response, 503, 'Review image storage is not configured.');
  }

  try {
    var previousReviews = await storage.loadReviews();
    if (!previousReviews.every(isStoredReview)) throw new Error('Stored reviews have an invalid format.');
    var preparedReviews = await prepareReviews(reviews, previousReviews);
    await storage.saveReviews(preparedReviews);
    var retainedImages = getPublicImageUrls(preparedReviews);
    var removedImages = Array.from(getPublicImageUrls(previousReviews)).filter(function (url) {
      return !retainedImages.has(url);
    });
    if (removedImages.length && storage.hasImageStore()) {
      try {
        await blob.del(removedImages, { token: process.env.REVIEWS_IMAGES_BLOB_TOKEN });
      } catch (error) {
        console.error('Review data was saved, but unused images could not be removed from Vercel Blob.', error);
      }
    }
    return response.status(200).json({ reviews: sanitizeReviews(preparedReviews) });
  } catch (error) {
    console.error('Unable to save reviews to Vercel Blob.', error);
    return sendError(response, 500, 'Reviews could not be saved.');
  }
};

module.exports.config = {
  api: {
    bodyParser: { sizeLimit: '4mb' }
  }
};
