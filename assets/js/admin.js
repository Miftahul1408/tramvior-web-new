document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var storageKey = 'tramvior-admin-drafts-v1';
  var reviewStorageKey = 'tramvior-admin-reviews-v1';
  var reviewAdminToken = '';
  var publishedArticles = [
    { title: '5 Tips Sukses Wawancara Kerja untuk Siswa SMK', category: 'Dunia Kerja', file: 'tips-wawancara-kerja-smk.html', image: 'tipssukses.png', updatedAt: '1 Jul 2026' },
    { title: 'Cara Hemat Kuota saat Belajar Online', category: 'Tips Belajar', file: 'hemat-kuota-belajar-online.html', image: 'hemat kouta.png', updatedAt: '1 Jul 2026' },
    { title: 'Panduan Persiapan Kerja ke Jepang bagi Lulusan SMK', category: 'Karier Global', file: 'persiapan-kerja-ke-jepang.html', image: 'jepang.png', updatedAt: '1 Jul 2026' },
    { title: 'Kenapa Materi Belajar Umum Tidak Cukup untuk Siswa SMK', category: 'Kurikulum SMK', file: 'materi-belajar-sesuai-jurusan-smk.html', image: 'materiumumsmk.png', updatedAt: '1 Jul 2026' },
    { title: '5 Cara Tetap Fokus Belajar Meski Dikelilingi Notifikasi HP', category: 'Produktivitas', file: 'fokus-belajar-tanpa-distraksi-hp.html', image: 'fokusbelajar.png', updatedAt: '1 Jul 2026' }
  ];
  var draftArticles = [];
  var studentReviews = [];
  var reviewsLoaded = false;
  var reviewsLoading = false;
  var currentFilter = 'all';
  var currentReviewFilter = 'all';
  var toastTimer;
  var toast = document.getElementById('admin-toast');
  var dialog = document.getElementById('article-dialog');
  var draftForm = document.getElementById('draft-form');
  var sidebar = document.getElementById('admin-sidebar');
  var sidebarToggle = document.getElementById('sidebar-toggle');
  var sidebarScrim = document.getElementById('sidebar-scrim');
  var reviewDialog = document.getElementById('review-dialog');
  var reviewForm = document.getElementById('review-form');
  var reviewImagePreviewUrl = '';

  function showToast(message, isError) {
    toast.textContent = message;
    toast.classList.toggle('is-error', Boolean(isError));
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 3400);
  }

  function loadDrafts() {
    try {
      var stored = window.localStorage.getItem(storageKey);
      if (!stored) return [];

      var parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) throw new Error('Format draft tidak valid.');

      return parsed.filter(function (draft) {
        return draft &&
          typeof draft.id === 'string' &&
          typeof draft.title === 'string' &&
          typeof draft.category === 'string' &&
          typeof draft.excerpt === 'string' &&
          typeof draft.updatedAt === 'string';
      });
    } catch (error) {
      showToast('Draft tidak dapat dibaca dari penyimpanan browser. ' + error.message, true);
      return [];
    }
  }

  function saveDrafts() {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(draftArticles));
      return true;
    } catch (error) {
      showToast('Draft gagal disimpan di browser. ' + error.message, true);
      return false;
    }
  }

  function getReviewAdminToken() {
    if (reviewAdminToken) return reviewAdminToken;
    reviewAdminToken = window.prompt('Masukkan token admin ulasan:') || '';
    if (!reviewAdminToken) throw new Error('Token admin diperlukan untuk mengelola ulasan.');
    return reviewAdminToken;
  }

  async function reviewApiRequest(url, options) {
    options.headers = Object.assign({}, options.headers || {}, {
      Authorization: 'Bearer ' + getReviewAdminToken()
    });
    var response = await window.fetch(url, options);
    var result;
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('Server ulasan mengirim respons yang tidak dapat dibaca.');
    }
    if (response.status === 401) {
      reviewAdminToken = '';
      throw new Error('Token admin salah atau sudah tidak berlaku. Coba masukkan lagi.');
    }
    if (!response.ok) throw new Error(result.error || 'Permintaan ulasan gagal.');
    return result;
  }

  function isValidReview(review) {
    return review &&
      typeof review.id === 'string' &&
      typeof review.name === 'string' &&
      typeof review.school === 'string' &&
      typeof review.program === 'string' &&
      typeof review.quote === 'string' &&
      Number.isInteger(review.rating) &&
      review.rating >= 1 &&
      review.rating <= 5 &&
      typeof review.published === 'boolean' &&
      typeof review.updatedAt === 'string' &&
      (review.image === undefined || isSupportedReviewImage(review.image));
  }

  function loadLegacyReviews() {
    var stored = window.localStorage.getItem(reviewStorageKey);
    if (!stored) return [];
    var parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error('Format ulasan lokal tidak valid.');
    return parsed.filter(function (review) {
      return isValidReview(review) &&
        (review.image === undefined || isSupportedReviewImage(review.image));
    });
  }

  async function loadReviews() {
    var reviews = await reviewApiRequest('/api/reviews?admin=1', { method: 'GET', cache: 'no-store' });
    if (!Array.isArray(reviews)) throw new Error('Format ulasan server tidak valid.');
    if (!reviews.every(isValidReview)) throw new Error('Data ulasan server tidak valid.');

    if (!reviews.length) {
      var legacyReviews;
      try {
        legacyReviews = loadLegacyReviews();
      } catch (error) {
        showToast('Data ulasan lama di browser tidak dapat dibaca. ' + error.message, true);
        return reviews;
      }
      if (legacyReviews.length) {
        showToast('Memindahkan ulasan lama dari browser ke penyimpanan website.');
        reviews = await saveReviews(legacyReviews);
        try {
          window.localStorage.removeItem(reviewStorageKey);
        } catch (error) {
          showToast('Ulasan telah dipindahkan, tetapi salinan lama di browser tidak dapat dihapus.', true);
        }
      }
    }
    return reviews;
  }

  async function saveReviews(reviews) {
    var result = await reviewApiRequest('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviews: reviews })
    });
    if (!Array.isArray(result.reviews)) throw new Error('Server tidak mengembalikan data ulasan yang tersimpan.');
    return result.reviews;
  }

  function isSupportedReviewImage(value) {
    if (typeof value !== 'string') return false;
    if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)) return true;
    if (/^private:[a-zA-Z0-9_-]{1,100}$/.test(value)) return true;
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && url.hostname.endsWith('.public.blob.vercel-storage.com');
    } catch (error) {
      return false;
    }
  }

  function loadPrivateReviewImage(review) {
    var preview = document.getElementById('review-image-preview');
    var requestUrl = '/api/review-image?reviewId=' + encodeURIComponent(review.id);
    window.fetch(requestUrl, {
      headers: { Authorization: 'Bearer ' + getReviewAdminToken() }
    }).then(function (response) {
      if (response.status === 401) reviewAdminToken = '';
      if (!response.ok) throw new Error('Foto tersimpan tidak dapat dimuat (status ' + response.status + ').');
      return response.blob();
    }).then(function (imageBlob) {
      if (!reviewDialog.open ||
        document.getElementById('review-id').value !== review.id ||
        document.getElementById('review-image').files.length ||
        document.getElementById('review-image-remove').checked) return;
      if (reviewImagePreviewUrl) URL.revokeObjectURL(reviewImagePreviewUrl);
      reviewImagePreviewUrl = URL.createObjectURL(imageBlob);
      preview.src = reviewImagePreviewUrl;
      preview.hidden = false;
    }).catch(function (error) {
      showToast(error.message, true);
    });
  }

  function readImageAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.addEventListener('load', function () {
        if (typeof reader.result === 'string') resolve(reader.result);
        else reject(new Error('Foto gagal dibaca sebagai gambar.'));
      });
      reader.addEventListener('error', function () {
        reject(new Error('Foto gagal dibaca. Coba pilih file lain.'));
      });
      reader.readAsDataURL(file);
    });
  }

  function makeElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function createArticleRow(article, isDraft, compact) {
    var row = document.createElement('tr');
    var titleCell = document.createElement('td');
    var titleWrap = makeElement('div', 'article-title-cell');
    var thumbnail = makeElement('span', 'article-thumb', '✦');
    if (!isDraft && article.image) {
      var image = document.createElement('img');
      image.src = 'assets/img/' + article.image;
      image.alt = '';
      image.loading = 'lazy';
      thumbnail.textContent = '';
      thumbnail.appendChild(image);
    }
    var textWrap = document.createElement('span');
    textWrap.appendChild(makeElement('strong', '', article.title));
    textWrap.appendChild(makeElement('small', '', isDraft ? 'Draft lokal' : 'TRAMVIOR'));
    titleWrap.appendChild(thumbnail);
    titleWrap.appendChild(textWrap);
    titleCell.appendChild(titleWrap);
    row.appendChild(titleCell);

    var categoryCell = makeElement('td');
    categoryCell.appendChild(makeElement('span', 'category-chip', article.category));
    row.appendChild(categoryCell);

    if (!compact) row.appendChild(makeElement('td', '', article.updatedAt));

    var statusCell = document.createElement('td');
    statusCell.appendChild(makeElement('span', 'status-pill' + (isDraft ? ' status-pill-draft' : ''), isDraft ? 'Draft' : 'Terbit'));
    row.appendChild(statusCell);

    var actionCell = document.createElement('td');
    if (compact) {
      var viewButton = makeElement('button', 'row-action', 'Lihat');
      viewButton.type = 'button';
      viewButton.setAttribute('aria-label', 'Buka artikel ' + article.title);
      viewButton.addEventListener('click', function () {
        if (!isDraft) window.location.href = 'artikel/' + article.file;
        else openDraft(article);
      });
      actionCell.appendChild(viewButton);
    } else {
      var actions = makeElement('div', 'row-actions');
      if (isDraft) {
        var editButton = makeElement('button', 'row-action', 'Edit');
        editButton.type = 'button';
        editButton.addEventListener('click', function () { openDraft(article); });
        actions.appendChild(editButton);

        var deleteButton = makeElement('button', 'row-action row-action-danger', 'Hapus');
        deleteButton.type = 'button';
        deleteButton.addEventListener('click', function () { deleteDraft(article.id); });
        actions.appendChild(deleteButton);
      } else {
        var openLink = document.createElement('a');
        openLink.className = 'row-action';
        openLink.href = 'artikel/' + article.file;
        openLink.textContent = 'Buka ↗';
        openLink.setAttribute('aria-label', 'Buka artikel ' + article.title);
        actions.appendChild(openLink);
      }
      actionCell.appendChild(actions);
    }
    row.appendChild(actionCell);
    return row;
  }

  function renderArticles() {
    var articleList = document.getElementById('article-list');
    var overviewList = document.getElementById('overview-article-list');
    var search = document.getElementById('article-search');
    var query = search.value.trim().toLocaleLowerCase('id');
    var allArticles = publishedArticles.map(function (article) {
      return { article: article, isDraft: false };
    }).concat(draftArticles.map(function (article) {
      return { article: article, isDraft: true };
    }));

    articleList.textContent = '';
    overviewList.textContent = '';
    allArticles.forEach(function (item) {
      var searchable = (item.article.title + ' ' + item.article.category).toLocaleLowerCase('id');
      var filterMatches = currentFilter === 'all' ||
        (currentFilter === 'draft' && item.isDraft) ||
        (currentFilter === 'published' && !item.isDraft);
      if (!filterMatches || (query && searchable.indexOf(query) === -1)) return;
      articleList.appendChild(createArticleRow(item.article, item.isDraft, false));
    });

    allArticles.slice(0, 5).forEach(function (item) {
      overviewList.appendChild(createArticleRow(item.article, item.isDraft, true));
    });

    document.getElementById('article-empty').hidden = articleList.children.length > 0;
    document.getElementById('published-count').textContent = String(publishedArticles.length);
    document.getElementById('draft-count').textContent = String(draftArticles.length);
    document.getElementById('nav-article-count').textContent = String(publishedArticles.length + draftArticles.length);
    document.getElementById('filter-all-count').textContent = String(publishedArticles.length + draftArticles.length);
    document.getElementById('filter-published-count').textContent = String(publishedArticles.length);
    document.getElementById('filter-draft-count').textContent = String(draftArticles.length);
    renderCategories();
  }

  function renderCategories() {
    var categoryCounts = {};
    publishedArticles.forEach(function (article) {
      categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
    });
    var list = document.getElementById('category-list');
    var categories = Object.keys(categoryCounts).map(function (category) {
      return { name: category, count: categoryCounts[category] };
    }).sort(function (left, right) {
      return right.count - left.count || left.name.localeCompare(right.name, 'id');
    });
    list.textContent = '';
    categories.forEach(function (category) {
      var row = makeElement('div', 'category-row');
      row.appendChild(makeElement('span', '', category.name));
      var bar = makeElement('span', 'category-bar');
      var fill = document.createElement('span');
      fill.style.width = Math.round(category.count / publishedArticles.length * 100) + '%';
      bar.appendChild(fill);
      row.appendChild(bar);
      row.appendChild(makeElement('strong', '', String(category.count)));
      list.appendChild(row);
    });
  }

  function renderReviews() {
    var list = document.getElementById('review-list');
    var search = document.getElementById('review-search');
    var query = search.value.trim().toLocaleLowerCase('id');
    var publishedCount = studentReviews.filter(function (review) { return review.published; }).length;
    var pendingCount = studentReviews.length - publishedCount;
    list.textContent = '';

    studentReviews.forEach(function (review) {
      var searchable = (review.name + ' ' + review.school + ' ' + review.program + ' ' + review.quote).toLocaleLowerCase('id');
      var statusMatches = currentReviewFilter === 'all' ||
        (currentReviewFilter === 'published' && review.published) ||
        (currentReviewFilter === 'pending' && !review.published);
      if (!statusMatches || (query && searchable.indexOf(query) === -1)) return;

      var row = document.createElement('tr');
      var authorCell = document.createElement('td');
      var author = makeElement('div', 'review-admin-author');
      author.appendChild(makeElement('span', 'review-admin-avatar', review.name.trim().charAt(0).toLocaleUpperCase('id')));
      var details = document.createElement('span');
      details.appendChild(makeElement('strong', '', review.name));
      details.appendChild(makeElement('small', '', [review.school, review.program].filter(Boolean).join(' · ')));
      author.appendChild(details);
      authorCell.appendChild(author);
      row.appendChild(authorCell);

      var quoteCell = document.createElement('td');
      quoteCell.appendChild(makeElement('span', 'review-admin-quote', review.quote));
      row.appendChild(quoteCell);

      var ratingCell = makeElement('td', 'admin-rating', '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating));
      row.appendChild(ratingCell);

      var statusCell = document.createElement('td');
      statusCell.appendChild(makeElement('span', 'status-pill' + (review.published ? '' : ' status-pill-draft'), review.published ? 'Ditampilkan' : 'Menunggu'));
      row.appendChild(statusCell);

      var actionsCell = document.createElement('td');
      var actions = makeElement('div', 'row-actions');
      var editButton = makeElement('button', 'row-action', 'Edit');
      editButton.type = 'button';
      editButton.addEventListener('click', function () { openReview(review); });
      actions.appendChild(editButton);

      var visibilityButton = makeElement('button', 'row-action', review.published ? 'Sembunyikan' : 'Tampilkan');
      visibilityButton.type = 'button';
      visibilityButton.addEventListener('click', function () { toggleReviewVisibility(review.id); });
      actions.appendChild(visibilityButton);

      var deleteButton = makeElement('button', 'row-action row-action-danger', 'Hapus');
      deleteButton.type = 'button';
      deleteButton.addEventListener('click', function () { deleteReview(review.id); });
      actions.appendChild(deleteButton);
      actionsCell.appendChild(actions);
      row.appendChild(actionsCell);
      list.appendChild(row);
    });

    document.getElementById('review-empty').hidden = list.children.length > 0;
    document.getElementById('review-total').textContent = String(studentReviews.length);
    document.getElementById('review-published').textContent = String(publishedCount);
    document.getElementById('review-pending').textContent = String(pendingCount);
    document.getElementById('nav-review-count').textContent = String(studentReviews.length);
    document.getElementById('review-filter-all-count').textContent = String(studentReviews.length);
    document.getElementById('review-filter-published-count').textContent = String(publishedCount);
    document.getElementById('review-filter-pending-count').textContent = String(pendingCount);
  }

  function openReview(review) {
    document.getElementById('review-dialog-title').textContent = review ? 'Edit ulasan' : 'Tambah ulasan';
    document.getElementById('review-id').value = review ? review.id : '';
    document.getElementById('review-name').value = review ? review.name : '';
    document.getElementById('review-school').value = review ? review.school : '';
    document.getElementById('review-program').value = review ? review.program : '';
    document.getElementById('review-rating').value = String(review ? review.rating : 5);
    document.getElementById('review-quote').value = review ? review.quote : '';
    document.getElementById('review-approved').checked = review ? review.published : false;
    var imageInput = document.getElementById('review-image');
    var imagePreview = document.getElementById('review-image-preview');
    var imageRemoveWrap = document.getElementById('review-image-remove-wrap');
    var imageRemove = document.getElementById('review-image-remove');
    imageInput.value = '';
    if (reviewImagePreviewUrl) URL.revokeObjectURL(reviewImagePreviewUrl);
    reviewImagePreviewUrl = '';
    imagePreview.hidden = !review || !isSupportedReviewImage(review.image);
    imagePreview.removeAttribute('src');
    if (!imagePreview.hidden && /^private:/.test(review.image)) {
      loadPrivateReviewImage(review);
    } else if (!imagePreview.hidden) {
      imagePreview.src = review.image;
    }
    imageRemoveWrap.hidden = imagePreview.hidden;
    imageRemove.checked = false;
    reviewDialog.showModal();
    document.getElementById('review-name').focus();
  }

  async function toggleReviewVisibility(id) {
    var review = studentReviews.find(function (item) { return item.id === id; });
    if (!review) return;
    if (!review.published && !window.confirm('Pastikan siswa telah menyetujui publikasi ulasan ini. Tampilkan sekarang?')) return;
    var previousReviews = studentReviews;
    var updatedReviews = studentReviews.map(function (item) {
      return item.id === id ? Object.assign({}, item, { published: !item.published }) : item;
    });
    try {
      studentReviews = await saveReviews(updatedReviews);
    } catch (error) {
      studentReviews = previousReviews;
      showToast('Perubahan ulasan gagal disimpan. ' + error.message, true);
      return;
    }
    renderReviews();
    showToast(review.published ? 'Ulasan disembunyikan dari website.' : 'Ulasan tampil di website.');
  }

  async function deleteReview(id) {
    var review = studentReviews.find(function (item) { return item.id === id; });
    if (!review || !window.confirm('Hapus ulasan "' + review.name + '" dari website?')) return;
    var previousReviews = studentReviews;
    var updatedReviews = studentReviews.filter(function (item) { return item.id !== id; });
    try {
      studentReviews = await saveReviews(updatedReviews);
    } catch (error) {
      studentReviews = previousReviews;
      showToast('Ulasan gagal dihapus. ' + error.message, true);
      return;
    }
    renderReviews();
    showToast('Ulasan berhasil dihapus dari website.');
  }

  var today = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());
  document.getElementById('dashboard-date').textContent = today.charAt(0).toLocaleUpperCase('id') + today.slice(1);

  function openDraft(draft) {
    document.getElementById('dialog-title').textContent = draft ? 'Edit draft' : 'Tulis artikel';
    document.getElementById('draft-id').value = draft ? draft.id : '';
    document.getElementById('draft-title').value = draft ? draft.title : '';
    document.getElementById('draft-category').value = draft ? draft.category : '';
    document.getElementById('draft-excerpt').value = draft ? draft.excerpt : '';
    dialog.showModal();
    document.getElementById('draft-title').focus();
  }

  function deleteDraft(id) {
    var draft = draftArticles.find(function (item) { return item.id === id; });
    if (!draft || !window.confirm('Hapus draft "' + draft.title + '" dari browser ini?')) return;
    var previousDrafts = draftArticles.slice();
    draftArticles = draftArticles.filter(function (item) { return item.id !== id; });
    if (!saveDrafts()) {
      draftArticles = previousDrafts;
      return;
    }
    renderArticles();
    showToast('Draft berhasil dihapus dari browser ini.');
  }

  function setActiveView(viewName) {
    var view = document.getElementById('view-' + viewName);
    if (!view) return;
    if (viewName === 'reviews' && !reviewsLoaded && !reviewsLoading) {
      reviewsLoading = true;
      loadReviews().then(function (reviews) {
        studentReviews = reviews;
        reviewsLoaded = true;
        renderReviews();
      }).catch(function (error) {
        showToast('Ulasan website tidak dapat dimuat. ' + error.message, true);
      }).finally(function () {
        reviewsLoading = false;
      });
    }
    document.querySelectorAll('.admin-view').forEach(function (section) {
      var isActive = section === view;
      section.hidden = !isActive;
      section.classList.toggle('is-visible', isActive);
    });
    document.querySelectorAll('.admin-nav-link').forEach(function (link) {
      var isActive = link.getAttribute('data-view') === viewName;
      link.classList.toggle('is-active', isActive);
      if (isActive) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    var activeLink = document.querySelector('.admin-nav-link[data-view="' + viewName + '"]');
    var labelNode = activeLink && Array.prototype.find.call(activeLink.childNodes, function (node) {
      return node.nodeType === 3 && node.textContent.trim();
    });
    document.getElementById('topbar-page').textContent = labelNode ? labelNode.textContent.trim() : 'Ringkasan';
    closeSidebar();
    window.scrollTo(0, 0);
  }

  function closeSidebar() {
    sidebar.classList.remove('is-open');
    sidebarScrim.classList.remove('is-visible');
    sidebarToggle.setAttribute('aria-expanded', 'false');
  }

  draftArticles = loadDrafts();
  renderArticles();
  renderReviews();

  document.querySelectorAll('.admin-nav-link').forEach(function (link) {
    link.addEventListener('click', function () { setActiveView(link.getAttribute('data-view')); });
  });
  document.querySelectorAll('[data-open-view]').forEach(function (button) {
    button.addEventListener('click', function () { setActiveView(button.getAttribute('data-open-view')); });
  });
  document.querySelectorAll('[data-create-article]').forEach(function (button) {
    button.addEventListener('click', function () { openDraft(null); });
  });
  document.querySelectorAll('[data-create-review]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!reviewsLoaded) {
        setActiveView('reviews');
        showToast('Tunggu hingga data ulasan selesai dimuat.', true);
        return;
      }
      openReview(null);
    });
  });
  document.querySelectorAll('[data-close-dialog]').forEach(function (button) {
    button.addEventListener('click', function () { dialog.close(); });
  });
  document.querySelectorAll('[data-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      currentFilter = button.getAttribute('data-filter');
      document.querySelectorAll('[data-filter]').forEach(function (filterButton) {
        filterButton.classList.toggle('is-selected', filterButton === button);
      });
      renderArticles();
    });
  });
  document.querySelectorAll('[data-review-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      currentReviewFilter = button.getAttribute('data-review-filter');
      document.querySelectorAll('[data-review-filter]').forEach(function (filterButton) {
        filterButton.classList.toggle('is-selected', filterButton === button);
      });
      renderReviews();
    });
  });
  document.getElementById('article-search').addEventListener('input', renderArticles);
  document.getElementById('review-search').addEventListener('input', renderReviews);
  document.querySelectorAll('[data-close-review-dialog]').forEach(function (button) {
    button.addEventListener('click', function () { reviewDialog.close(); });
  });
  document.getElementById('review-image').addEventListener('change', function (event) {
    var file = event.target.files[0];
    var preview = document.getElementById('review-image-preview');
    var removeWrap = document.getElementById('review-image-remove-wrap');
    var removeCheckbox = document.getElementById('review-image-remove');
    if (!file) return;
    if (!/^image\/(?:png|jpeg|webp)$/.test(file.type)) {
      event.target.value = '';
      showToast('Pilih gambar PNG, JPG, atau WebP.', true);
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      event.target.value = '';
      showToast('Ukuran foto maksimal 2 MB.', true);
      return;
    }
    if (reviewImagePreviewUrl) URL.revokeObjectURL(reviewImagePreviewUrl);
    reviewImagePreviewUrl = URL.createObjectURL(file);
    preview.src = reviewImagePreviewUrl;
    preview.hidden = false;
    removeWrap.hidden = true;
    removeCheckbox.checked = false;
  });
  document.getElementById('review-image-remove').addEventListener('change', function (event) {
    var preview = document.getElementById('review-image-preview');
    if (!event.target.checked) {
      var reviewId = document.getElementById('review-id').value;
      var existingReview = studentReviews.find(function (review) { return review.id === reviewId; });
      if (existingReview && isSupportedReviewImage(existingReview.image)) {
        preview.src = existingReview.image;
        preview.hidden = false;
      }
      return;
    }
    preview.hidden = true;
    preview.removeAttribute('src');
    if (reviewImagePreviewUrl) URL.revokeObjectURL(reviewImagePreviewUrl);
    reviewImagePreviewUrl = '';
    document.getElementById('review-image').value = '';
  });
  document.querySelectorAll('.notice-dismiss').forEach(function (button) {
    button.addEventListener('click', function () { button.closest('.notice-banner').remove(); });
  });
  sidebarToggle.addEventListener('click', function () {
    var isOpen = sidebar.classList.toggle('is-open');
    sidebarScrim.classList.toggle('is-visible', isOpen);
    sidebarToggle.setAttribute('aria-expanded', String(isOpen));
  });
  sidebarScrim.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeSidebar();
  });

  draftForm.addEventListener('submit', function (event) {
    event.preventDefault();
    if (!draftForm.reportValidity()) return;

    var id = document.getElementById('draft-id').value;
    var now = new Date().toISOString();
    var existingDraft = draftArticles.find(function (draft) { return draft.id === id; });
    var draft = {
      id: id || (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'draft-' + Date.now()),
      title: document.getElementById('draft-title').value.trim(),
      category: document.getElementById('draft-category').value,
      excerpt: document.getElementById('draft-excerpt').value.trim(),
      updatedAt: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(now))
    };
    if (!draft.title || !draft.category) {
      showToast('Judul dan kategori artikel wajib diisi.', true);
      return;
    }
    if (existingDraft) {
      draftArticles = draftArticles.map(function (item) { return item.id === id ? draft : item; });
    } else {
      draftArticles.unshift(draft);
    }
    if (!saveDrafts()) {
      draftArticles = existingDraft ? draftArticles.map(function (item) { return item.id === id ? existingDraft : item; }) : draftArticles.filter(function (item) { return item.id !== draft.id; });
      return;
    }
    renderArticles();
    dialog.close();
    draftForm.reset();
    document.getElementById('draft-id').value = '';
    setActiveView('articles');
    showToast(existingDraft ? 'Perubahan draft tersimpan di browser ini.' : 'Draft tersimpan di browser ini.');
  });

  reviewForm.addEventListener('submit', async function (event) {
    event.preventDefault();
    if (!reviewsLoaded) {
      showToast('Data ulasan website belum berhasil dimuat.', true);
      return;
    }
    if (!reviewForm.reportValidity()) return;

    var id = document.getElementById('review-id').value;
    var existingReview = studentReviews.find(function (review) { return review.id === id; });
    var imageInput = document.getElementById('review-image');
    var imageFile = imageInput.files[0];
    if (imageFile && (!/^image\/(?:png|jpeg|webp)$/.test(imageFile.type) || imageFile.size > 2 * 1024 * 1024)) {
      showToast('Pilih foto PNG, JPG, atau WebP maksimal 2 MB.', true);
      return;
    }

    var review = {
      id: id || (window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'review-' + Date.now()),
      name: document.getElementById('review-name').value.trim(),
      school: document.getElementById('review-school').value.trim(),
      program: document.getElementById('review-program').value.trim(),
      rating: Number(document.getElementById('review-rating').value),
      quote: document.getElementById('review-quote').value.trim(),
      published: document.getElementById('review-approved').checked,
      updatedAt: new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date())
    };
    if (!review.name || !review.school || !review.quote || !Number.isInteger(review.rating) || review.rating < 1 || review.rating > 5) {
      showToast('Lengkapi nama, sekolah, isi ulasan, dan rating yang valid.', true);
      return;
    }

    var removeImage = document.getElementById('review-image-remove').checked;
    var submitButton = reviewForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      if (imageFile) {
        review.image = await readImageAsDataUrl(imageFile);
      } else if (!removeImage && existingReview && isSupportedReviewImage(existingReview.image)) {
        review.image = existingReview.image;
      }

      var previousReviews = studentReviews;
      var updatedReviews = existingReview
        ? studentReviews.map(function (item) { return item.id === id ? review : item; })
        : [review].concat(studentReviews);
      try {
        studentReviews = await saveReviews(updatedReviews);
      } catch (error) {
        studentReviews = previousReviews;
        throw error;
      }

      renderReviews();
      reviewDialog.close();
      reviewForm.reset();
      document.getElementById('review-id').value = '';
      var imagePreview = document.getElementById('review-image-preview');
      imagePreview.hidden = true;
      imagePreview.removeAttribute('src');
      if (reviewImagePreviewUrl) URL.revokeObjectURL(reviewImagePreviewUrl);
      reviewImagePreviewUrl = '';
      document.getElementById('review-image-remove-wrap').hidden = true;
      setActiveView('reviews');
      showToast(existingReview ? 'Perubahan ulasan tersimpan di website.' : 'Ulasan tersimpan di website.');
    } catch (error) {
      showToast('Ulasan gagal disimpan. ' + error.message, true);
    } finally {
      submitButton.disabled = false;
    }
  });
});
