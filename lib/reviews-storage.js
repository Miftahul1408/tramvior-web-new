'use strict';

var blob = require('@vercel/blob');

var reviewsPath = 'tramvior/reviews.json';

function hasDataStore() {
  return Boolean(process.env.REVIEWS_DATA_BLOB_TOKEN);
}

function hasImageStore() {
  return Boolean(process.env.REVIEWS_IMAGES_BLOB_TOKEN);
}

async function loadReviews() {
  var result = await blob.get(reviewsPath, {
    access: 'private',
    token: process.env.REVIEWS_DATA_BLOB_TOKEN,
    useCache: false
  });
  if (!result) return [];
  if (result.statusCode !== 200) throw new Error('Review data returned an unexpected status.');

  var reviews = await new Response(result.stream).json();
  if (!Array.isArray(reviews)) throw new Error('Stored reviews have an invalid format.');
  return reviews;
}

async function saveReviews(reviews) {
  await blob.put(reviewsPath, JSON.stringify(reviews), {
    access: 'private',
    token: process.env.REVIEWS_DATA_BLOB_TOKEN,
    allowOverwrite: true,
    contentType: 'application/json'
  });
}

module.exports = {
  hasDataStore: hasDataStore,
  hasImageStore: hasImageStore,
  loadReviews: loadReviews,
  saveReviews: saveReviews
};
