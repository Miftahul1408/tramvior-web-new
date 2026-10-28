'use strict';

var assert = require('node:assert/strict');
var test = require('node:test');

process.env.REVIEWS_ADMIN_TOKEN = 'test-secret';
process.env.REVIEWS_IMAGES_BLOB_TOKEN = 'image-token';

var storage = require('../lib/reviews-storage');
var blob = require('@vercel/blob');
var loadReviewsFromBlob = storage.loadReviews;
var saveReviewsToBlob = storage.saveReviews;
var records = [];
var uploads = [];
var deletions = [];
storage.hasDataStore = function () { return true; };
storage.hasImageStore = function () { return true; };
storage.loadReviews = async function () { return records; };
storage.saveReviews = async function (reviews) { records = reviews; };
blob.put = async function (pathname, data, options) {
  uploads.push({ pathname: pathname, data: data, options: options });
  return { url: 'https://test.public.blob.vercel-storage.com/' + pathname };
};
blob.del = async function (urls, options) {
  deletions.push({ urls: urls, options: options });
};

var reviewsApi = require('../api/reviews');
var reviewImageApi = require('../api/review-image');

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader: function (name, value) { this.headers[name] = value; },
    status: function (code) { this.statusCode = code; return this; },
    json: function (value) { this.body = value; return this; },
    end: function (value) { this.body = value; return this; }
  };
}

async function call(handler, request) {
  var response = createResponse();
  await handler(request, response);
  return response;
}

test('review storage protects pending images until approval', async function () {
  records = [];
  uploads = [];
  var imageData = 'data:image/png;base64,iVBORw0KGgo=';
  var pendingReview = {
    id: 'student-1',
    name: 'Siswa',
    school: 'SMK',
    program: '',
    quote: 'Ulasan',
    rating: 5,
    published: false,
    updatedAt: '2026-10-28',
    image: imageData
  };

  var response = await call(reviewsApi, {
    method: 'GET',
    query: { admin: '1' },
    headers: {}
  });
  assert.equal(response.statusCode, 401);

  response = await call(reviewsApi, {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
    body: { reviews: [pendingReview] }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.reviews[0].image, 'private:student-1');
  assert.equal(records[0].image, imageData);
  assert.equal(uploads.length, 0);

  response = await call(reviewsApi, {
    method: 'GET',
    query: { published: '1' },
    headers: {}
  });
  assert.deepEqual(response.body, []);

  response = await call(reviewsApi, {
    method: 'GET',
    query: { admin: '1' },
    headers: { authorization: 'Bearer test-secret' }
  });
  assert.equal(response.body[0].image, 'private:student-1');
  assert.equal(JSON.stringify(response.body).includes('base64,'), false);

  response = await call(reviewImageApi, {
    method: 'GET',
    query: { reviewId: 'student-1' },
    headers: {}
  });
  assert.equal(response.statusCode, 401);

  response = await call(reviewImageApi, {
    method: 'GET',
    query: { reviewId: 'student-1' },
    headers: { authorization: 'Bearer test-secret' }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'image/png');
  assert.equal(Buffer.isBuffer(response.body), true);

  var approvedReview = Object.assign({}, pendingReview, {
    published: true,
    image: 'private:student-1'
  });
  response = await call(reviewsApi, {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
    body: { reviews: [approvedReview] }
  });
  assert.equal(response.statusCode, 200);
  assert.match(response.body.reviews[0].image, /public\.blob\.vercel-storage\.com/);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].options.access, 'public');
  response = await call(reviewImageApi, {
    method: 'GET',
    query: { reviewId: 'student-1' },
    headers: { authorization: 'Bearer test-secret' }
  });
  assert.equal(response.statusCode, 404);

  response = await call(reviewsApi, {
    method: 'GET',
    query: { published: '1' },
    headers: {}
  });
  assert.equal(response.body.length, 1);
  assert.match(response.body[0].image, /public\.blob\.vercel-storage\.com/);

  response = await call(reviewsApi, {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
    body: { reviews: [] }
  });
  assert.equal(response.statusCode, 200);
  assert.equal(records.length, 0);
  assert.equal(deletions.length, 1);
  assert.equal(deletions[0].urls.length, 1);

  records = [Object.assign({}, pendingReview, {
    published: true,
    image: 'https://test.public.blob.vercel-storage.com/review-images/example.png'
  })];
  process.env.REVIEWS_DATA_BLOB_TOKEN = 'data-token';
  storage.loadReviews = loadReviewsFromBlob;
  storage.saveReviews = saveReviewsToBlob;
  var getOptions;
  blob.get = async function (pathname, options) {
    getOptions = { pathname: pathname, options: options };
    return { statusCode: 200, stream: new Response(JSON.stringify(records)).body };
  };
  var storedReviews = await storage.loadReviews();
  assert.equal(storedReviews.length, 1);
  assert.equal(getOptions.pathname, 'tramvior/reviews.json');
  assert.equal(getOptions.options.access, 'private');
  assert.equal(getOptions.options.token, 'data-token');

  var putOptions;
  blob.put = async function (pathname, data, options) {
    putOptions = { pathname: pathname, data: data, options: options };
    return {};
  };
  await storage.saveReviews(storedReviews);
  assert.equal(putOptions.pathname, 'tramvior/reviews.json');
  assert.equal(putOptions.options.access, 'private');
  assert.equal(putOptions.options.allowOverwrite, true);
});
