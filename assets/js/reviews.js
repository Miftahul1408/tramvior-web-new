document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var container = document.getElementById('student-reviews');
  if (!container) return;

  var reviews;
  try {
    reviews = JSON.parse(window.localStorage.getItem('tramvior-admin-reviews-v1') || '[]');
  } catch (error) {
    container.textContent = 'Ulasan belum dapat dimuat dari penyimpanan browser ini.';
    console.error('Ulasan TRAMVIOR gagal dimuat.', error);
    return;
  }

  if (!Array.isArray(reviews)) {
    container.textContent = 'Format data ulasan tidak valid.';
    console.error('Ulasan TRAMVIOR tidak dapat ditampilkan: format data tidak valid.');
    return;
  }

  var published = reviews.filter(function (review) {
    return review &&
      review.published === true &&
      typeof review.name === 'string' &&
      typeof review.school === 'string' &&
      typeof review.program === 'string' &&
      typeof review.quote === 'string' &&
      Number.isInteger(review.rating) &&
      review.rating >= 1 &&
      review.rating <= 5;
  });

  if (!published.length) return;
  container.textContent = '';

  published.slice(0, 6).forEach(function (review) {
    var card = document.createElement('article');
    card.className = 'review-card';

    var stars = document.createElement('div');
    stars.className = 'review-stars';
    stars.setAttribute('role', 'img');
    stars.setAttribute('aria-label', review.rating + ' dari 5 bintang');
    stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

    var quote = document.createElement('p');
    quote.className = 'review-quote';
    quote.textContent = '“' + review.quote + '”';

    if (typeof review.image === 'string' && /^data:image\/(?:png|jpeg|webp);base64,/i.test(review.image)) {
      var screenshot = document.createElement('img');
      screenshot.className = 'review-screenshot';
      screenshot.src = review.image;
      screenshot.alt = 'Screenshot chat ulasan dari ' + review.name;
      screenshot.loading = 'lazy';
      card.appendChild(screenshot);
    }

    var author = document.createElement('div');
    author.className = 'review-author';
    var avatar = document.createElement('span');
    avatar.className = 'review-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = review.name.trim().charAt(0).toLocaleUpperCase('id');

    var details = document.createElement('span');
    var name = document.createElement('strong');
    name.textContent = review.name;
    var school = document.createElement('small');
    school.textContent = [review.school, review.program].filter(Boolean).join(' · ');
    details.appendChild(name);
    details.appendChild(school);
    author.appendChild(avatar);
    author.appendChild(details);
    card.appendChild(stars);
    card.appendChild(quote);
    card.appendChild(author);
    container.appendChild(card);
  });
});
