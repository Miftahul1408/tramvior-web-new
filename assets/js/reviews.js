document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var container = document.getElementById('student-reviews');
  if (!container) return;
  var controls = document.getElementById('review-controls');
  var previousButton = document.getElementById('review-previous');
  var nextButton = document.getElementById('review-next');
  var position = document.getElementById('review-position');

  function getSlideStep() {
    var card = container.querySelector('.review-card');
    if (!card) return 0;
    var styles = window.getComputedStyle(container);
    return card.getBoundingClientRect().width + (parseFloat(styles.columnGap) || 0);
  }

  function updateControls() {
    var cards = container.querySelectorAll('.review-card');
    var step = getSlideStep();
    if (!cards.length || !step) {
      controls.hidden = true;
      return;
    }

    var visibleCount = Math.max(1, Math.floor((container.clientWidth + 1) / step));
    controls.hidden = cards.length <= visibleCount;
    previousButton.disabled = container.scrollLeft <= 1;
    nextButton.disabled = container.scrollLeft + container.clientWidth >= container.scrollWidth - 1;

    var firstIndex = Math.min(cards.length - visibleCount, Math.round(container.scrollLeft / step));
    var lastIndex = Math.min(cards.length, firstIndex + visibleCount);
    position.textContent = 'Ulasan ' + (firstIndex + 1) + '–' + lastIndex + ' dari ' + cards.length;
  }

  previousButton.addEventListener('click', function () {
    container.scrollBy({ left: -getSlideStep(), behavior: 'smooth' });
  });
  nextButton.addEventListener('click', function () {
    container.scrollBy({ left: getSlideStep(), behavior: 'smooth' });
  });
  container.addEventListener('scroll', updateControls, { passive: true });
  window.addEventListener('resize', updateControls);

  function getConfig() {
    var config = window.TRAMVIOR_SUPABASE;
    if (!config || !config.url || !config.anonKey) {
      throw new Error('Konfigurasi Supabase belum tersedia.');
    }
    return { url: config.url.replace(/\/+$/, ''), anonKey: config.anonKey };
  }

  async function supabaseRequest(path, options) {
    var config = getConfig();
    options = options || {};
    options.headers = Object.assign({
      apikey: config.anonKey,
      Authorization: 'Bearer ' + config.anonKey
    }, options.headers || {});
    var response = await window.fetch(config.url + path, options);
    if (!response.ok) throw new Error('Supabase merespons dengan status ' + response.status + '.');
    return response.json();
  }

  function getImageUrl(path) {
    if (!path) return Promise.resolve('');
    var encodedPath = path.split('/').map(encodeURIComponent).join('/');
    return supabaseRequest('/storage/v1/object/sign/review-images/' + encodedPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 })
    }).then(function (result) {
      var config = getConfig();
      var signedPath = result.signedURL || result.signedUrl;
      if (!signedPath) throw new Error('Supabase tidak mengembalikan alamat foto.');
      if (/^https?:\/\//i.test(signedPath)) return signedPath;
      return config.url + (signedPath.indexOf('/storage/v1/') === 0 ? '' : '/storage/v1') + signedPath;
    });
  }

  function renderReviews(reviews) {
    if (!Array.isArray(reviews)) throw new Error('Format data ulasan tidak valid.');
    container.textContent = '';
    if (!reviews.length) {
      var empty = document.createElement('p');
      empty.className = 'review-empty';
      empty.textContent = 'Ulasan siswa akan segera hadir.';
      container.appendChild(empty);
      updateControls();
      return;
    }

    reviews.slice(0, 6).forEach(function (review) {
      var card = document.createElement('article');
      card.className = 'review-card';

      if (review.imageUrl) {
        var image = document.createElement('img');
        image.className = 'review-screenshot';
        image.src = review.imageUrl;
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
    updateControls();
  }

  supabaseRequest('/rest/v1/student_reviews?select=id,name,school,program,quote,rating,image_path&published=eq.true&order=updated_at.desc&limit=6', {
    method: 'GET',
    cache: 'no-store'
  }).then(function (reviews) {
    return Promise.all(reviews.map(function (review) {
      return getImageUrl(review.image_path).then(function (imageUrl) {
        return Object.assign({}, review, { imageUrl: imageUrl });
      });
    }));
  }).then(renderReviews).catch(function (error) {
    container.textContent = 'Ulasan belum dapat dimuat saat ini.';
    console.error('Ulasan TRAMVIOR gagal dimuat.', error);
  });
});
