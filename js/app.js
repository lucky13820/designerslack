/* ==========================================================================
   Designer Slack Communities — App Logic
   Filtering, search, pagination, card rendering, form submission
   ========================================================================== */

(function () {
  'use strict';

  // ---- Config ----
  const PER_PAGE = 30;
  let visibleCount = PER_PAGE;
  let loading = false;
  let filteredData = [];
  let activeLocation = '';
  let activeType = '';
  let searchQuery = '';
  let debounceTimer = null;

  // ---- DOM refs ----
  const listEl = document.getElementById('community-list');
  const paginationEl = document.getElementById('pagination');
  const noResultsEl = document.getElementById('no-results');
  const countEl = document.getElementById('community-count');
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  const activeFiltersEl = document.getElementById('active-filters');

  // Dropdowns
  const locationToggle = document.getElementById('location-toggle');
  const locationList = document.getElementById('location-list');
  const typeToggle = document.getElementById('type-toggle');
  const typeList = document.getElementById('type-list');

  // Form
  const addForm = document.getElementById('add-form');
  const formSuccess = document.getElementById('form-success');

  // ---- Initialize ----
  function init() {
    filteredData = [...COMMUNITIES_DATA];
    updateCount(COMMUNITIES_DATA.length);
    renderCards();
    bindEvents();
    bindInfiniteScroll();
  }

  // ---- Card Rendering ----
  function renderCards() {
    var page = filteredData.slice(0, visibleCount);

    listEl.innerHTML = '';

    if (page.length === 0) {
      noResultsEl.classList.add('visible');
      paginationEl.innerHTML = '';
      return;
    }

    noResultsEl.classList.remove('visible');

    page.forEach(function (community) {
      listEl.appendChild(createCard(community));
    });

    // Show or hide the "load more" indicator
    if (visibleCount < filteredData.length) {
      paginationEl.innerHTML = '<div class="scroll-loader"><div class="scroll-spinner"></div></div>';
    } else {
      paginationEl.innerHTML = '';
    }
  }

  function appendCards() {
    var start = visibleCount;
    visibleCount += PER_PAGE;
    var newItems = filteredData.slice(start, visibleCount);

    newItems.forEach(function (community) {
      listEl.appendChild(createCard(community));
    });

    if (visibleCount >= filteredData.length) {
      paginationEl.innerHTML = '';
    }
  }

  function createCard(c) {
    const item = document.createElement('div');
    item.className = 'community-list-item';

    // Badge class and inline styles
    const badgeClass = c.accessType === 'invite-only' ? 'invite-only' : 'public';
    let badgeStyle = '';
    if (c.badgeTextColor && c.badgeBgColor) {
      badgeStyle = 'style="color:' + c.badgeTextColor + ';background-color:' + c.badgeBgColor + '"';
    }

    // Logo or initial (small, beside title)
    let logoHtml;
    if (c.logoUrl) {
      logoHtml = '<img alt="' + escapeHtml(c.name) + '" src="' + escapeHtml(c.logoUrl) + '" loading="lazy" class="title-link--image">';
    } else {
      const initial = c.name ? c.name.charAt(0).toUpperCase() : '?';
      logoHtml = '<div class="title-link--initial">' + initial + '</div>';
    }

    // Social links
    let socialHtml = '';
    if (c.twitterUrl) {
      const handle = c.twitterUrl.replace(/https?:\/\/(www\.)?(twitter|x)\.com\//, '').replace(/\/$/, '');
      socialHtml += '<a href="' + escapeHtml(c.twitterUrl) + '" target="_blank" rel="noopener" class="small-link">' +
        '<img src="images/twitter.png" width="20" alt="" class="small-link--image">' +
        '<div class="text-base gray">' + escapeHtml(handle) + '</div></a>';
    }
    if (c.instagramUrl) {
      const handle = c.instagramUrl.replace(/https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '');
      socialHtml += '<a href="' + escapeHtml(c.instagramUrl) + '" target="_blank" rel="noopener" class="small-link">' +
        '<img src="images/instagram.png" width="20" alt="" class="small-link--image">' +
        '<div class="text-base gray">' + escapeHtml(handle) + '</div></a>';
    }

    // Location tags
    let locationHtml = '';
    if (c.locations && c.locations.length > 0) {
      locationHtml = '<div class="location-tag-container">' +
        c.locations.map(function (loc) { return '<span class="location-tag">' + escapeHtml(loc) + '</span>'; }).join(', ') +
        '</div>';
    }

    // Join link
    const joinUrl = c.websiteUrl || '#';

    item.innerHTML =
      '<div class="card">' +
        '<div class="card-content">' +
          '<a href="' + escapeHtml(joinUrl) + '" target="_blank" rel="noopener" class="title-link">' +
            logoHtml +
            '<div>' +
              '<h2 class="text-2xl title">' + escapeHtml(c.name) + '</h2>' +
              '<div class="badge ' + badgeClass + '" ' + badgeStyle + '>' + escapeHtml(c.accessType) + '</div>' +
            '</div>' +
          '</a>' +
          '<p class="card-description">' + escapeHtml(c.description) + '</p>' +
          locationHtml +
          socialHtml +
        '</div>' +
        '<a href="' + escapeHtml(joinUrl) + '" target="_blank" rel="noopener" class="small-join-link">' +
          '<div class="text-base gold">Join the community</div>' +
        '</a>' +
      '</div>' +
      '<div class="card-bg"></div>';

    return item;
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // ---- Filtering ----
  function applyFilters() {
    visibleCount = PER_PAGE;
    var query = searchQuery.toLowerCase().trim();

    filteredData = COMMUNITIES_DATA.filter(function (c) {
      // Location filter
      if (activeLocation && (!c.locations || c.locations.indexOf(activeLocation) === -1)) {
        return false;
      }
      // Type filter
      if (activeType && (!c.types || c.types.indexOf(activeType) === -1)) {
        return false;
      }
      // Search filter
      if (query) {
        var name = (c.name || '').toLowerCase();
        var desc = (c.description || '').toLowerCase();
        var locs = (c.locations || []).join(' ').toLowerCase();
        var types = (c.types || []).join(' ').toLowerCase();
        if (name.indexOf(query) === -1 && desc.indexOf(query) === -1 &&
            locs.indexOf(query) === -1 && types.indexOf(query) === -1) {
          return false;
        }
      }
      return true;
    });

    updateCount(filteredData.length);
    renderCards();
    renderActiveFilters();
  }

  function updateCount(count) {
    countEl.textContent = count + ' communities';
  }

  // ---- Active Filters Display ----
  function renderActiveFilters() {
    activeFiltersEl.innerHTML = '';

    if (activeLocation) {
      var tag = document.createElement('span');
      tag.className = 'active-filter-tag';
      tag.innerHTML = 'Location: ' + escapeHtml(activeLocation) + ' <span class="remove" data-filter="location">&times;</span>';
      activeFiltersEl.appendChild(tag);
    }

    if (activeType) {
      var tag = document.createElement('span');
      tag.className = 'active-filter-tag';
      tag.innerHTML = 'Type: ' + escapeHtml(activeType) + ' <span class="remove" data-filter="type">&times;</span>';
      activeFiltersEl.appendChild(tag);
    }

    // Bind remove clicks
    activeFiltersEl.querySelectorAll('.remove').forEach(function (el) {
      el.addEventListener('click', function () {
        var filter = this.getAttribute('data-filter');
        if (filter === 'location') {
          activeLocation = '';
          setActiveLink(locationList, '');
          locationToggle.querySelector('span').textContent = 'Location';
        } else if (filter === 'type') {
          activeType = '';
          setActiveLink(typeList, '');
          typeToggle.querySelector('span').textContent = 'Group Type';
        }
        applyFilters();
      });
    });
  }

  // ---- Infinite Scroll ----
  function bindInfiniteScroll() {
    window.addEventListener('scroll', function () {
      if (loading || visibleCount >= filteredData.length) return;

      var scrollBottom = window.innerHeight + window.scrollY;
      var threshold = document.documentElement.scrollHeight - 300;

      if (scrollBottom >= threshold) {
        loading = true;
        appendCards();
        loading = false;
      }
    });
  }

  // ---- Dropdown Logic ----
  function setupDropdown(toggleEl, listEl, onSelect) {
    toggleEl.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = listEl.classList.contains('open');
      closeAllDropdowns();
      if (!isOpen) {
        listEl.classList.add('open');
        toggleEl.classList.add('active');
      }
    });

    listEl.querySelectorAll('.filter-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var value = this.getAttribute('data-value');
        onSelect(value, this.textContent);
        closeAllDropdowns();
      });
    });
  }

  function closeAllDropdowns() {
    document.querySelectorAll('.filter-list').forEach(function (el) { el.classList.remove('open'); });
    document.querySelectorAll('.filter-button').forEach(function (el) { el.classList.remove('active'); });
  }

  function setActiveLink(listEl, value) {
    listEl.querySelectorAll('.filter-link').forEach(function (link) {
      link.classList.toggle('active', link.getAttribute('data-value') === value);
    });
  }

  // ---- Event Bindings ----
  function bindEvents() {
    // Location dropdown
    setupDropdown(locationToggle, locationList, function (value, label) {
      activeLocation = value;
      setActiveLink(locationList, value);
      locationToggle.querySelector('span').textContent = value ? label : 'Location';
      applyFilters();
    });

    // Type dropdown
    setupDropdown(typeToggle, typeList, function (value, label) {
      activeType = value;
      setActiveLink(typeList, value);
      typeToggle.querySelector('span').textContent = value ? label : 'Group Type';
      applyFilters();
    });

    // Search
    searchInput.addEventListener('input', function () {
      clearTimeout(debounceTimer);
      var val = this.value;
      debounceTimer = setTimeout(function () {
        searchQuery = val;
        if (val) {
          searchClear.classList.add('visible');
        } else {
          searchClear.classList.remove('visible');
        }
        applyFilters();
      }, 250);
    });

    searchClear.addEventListener('click', function (e) {
      e.preventDefault();
      searchInput.value = '';
      searchQuery = '';
      searchClear.classList.remove('visible');
      applyFilters();
    });

    // Close dropdowns on outside click
    document.addEventListener('click', function () {
      closeAllDropdowns();
    });

    // Form submission: verify Turnstile, then submit to Netlify Forms
    var submitBtn = addForm.querySelector('.form-submit');
    addForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var turnstileInput = document.querySelector('[name="cf-turnstile-response"]');
      if (!turnstileInput || !turnstileInput.value) {
        alert('Please complete the captcha.');
        return;
      }

      submitBtn.classList.add('loading');

      // Step 1: Verify Turnstile token server-side
      fetch('/.netlify/functions/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: turnstileInput.value })
      })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error(data.error || 'Verification failed.');
          });
        }
        // Step 2: Submit to Netlify Forms (per docs: POST to / with URL-encoded body)
        var formData = new FormData(addForm);
        formData.set('form-name', 'add-community');
        return fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(formData).toString()
        });
      })
      .then(function (res) {
        if (res && res.ok) {
          addForm.style.display = 'none';
          formSuccess.classList.add('visible');
          setTimeout(function () {
            document.getElementById('add-community-modal').classList.remove('visible');
            document.body.style.overflow = '';
            addForm.style.display = '';
            addForm.reset();
            if (typeof turnstile !== 'undefined') turnstile.reset();
            formSuccess.classList.remove('visible');
          }, 3000);
        } else if (res) {
          throw new Error('Form submission failed.');
        }
      })
      .catch(function (err) {
        alert(err.message || 'Something went wrong. Please try again.');
      })
      .finally(function () {
        submitBtn.classList.remove('loading');
      });
    });

    // Modal open/close
    var modal = document.getElementById('add-community-modal');
    document.getElementById('show-add-form').addEventListener('click', function (e) {
      e.preventDefault();
      modal.classList.add('visible');
      document.body.style.overflow = 'hidden';
    });

    document.getElementById('modal-close').addEventListener('click', function () {
      modal.classList.remove('visible');
      document.body.style.overflow = '';
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal) {
        modal.classList.remove('visible');
        document.body.style.overflow = '';
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('visible')) {
        modal.classList.remove('visible');
        document.body.style.overflow = '';
      }
    });
  }

  // ---- Start ----
  if (typeof COMMUNITIES_DATA !== 'undefined') {
    init();
  } else {
    console.error('COMMUNITIES_DATA not loaded');
  }
})();
