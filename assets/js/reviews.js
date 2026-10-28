document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var container = document.getElementById('student-reviews');
  if (!container) return;

  function isSupportedImageUrl(value) {
    if (typeof value !== 'string') return false;
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com');
    } catch (error) {
      return false;
    }
  }

  function renderReviews(reviews) {
    if (!Array.isArray(reviews)) throw new Error('Format data ulasan tidak valid.');
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
    }).slice(0, 6);

    container.textContent = '';
    if (!published.length) {
      var empty = document.createElement('p');
      empty.className = 'review-empty';
      empty.textContent = 'Ulasan siswa akan segera hadir.';
      container.appendChild(empty);
      return;
    }

    published.forEach(function (review) {
      var card = document.createElement('article');
      card.className = 'review-card';

      if (isSupportedImageUrl(review.image)) {
        var image = document.createElement('img');
        image.className = 'review-screenshot';
        image.src = review.image;
        image.alt = 'Foto ulasan dari ' + review.name;
        image.loading = 'lazy';
        card.appendChild(image);
      }

      var stars = document.createElement('div');
      stars.className = 'review-stars';
      stars.setAttribute('role', 'img');
      stars.setAttribute('aria-label', review.rating + ' dari 5 bintang');
      stars.textContent = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

      var quote = document.createElement('p');
      quote.className = 'review-quote';
      quote.textContent = '“' + review.quote + '”';

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
  }

  window.fetch('/api/reviews?published=1', { cache: 'no-store' }).then(function (response) {
    if (!response.ok) throw new Error('Server ulasan merespons dengan status ' + response.status + '.');
    return response.json();
  }).then(renderReviews).catch(function (error) {
    container.textContent = 'Ulasan belum dapat dimuat saat ini.';
    console.error('Ulasan TRAMVIOR gagal dimuat.', error);
  });
});
