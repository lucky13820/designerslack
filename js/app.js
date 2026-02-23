/* ==========================================================================
   Designer Slack Communities — App Logic
   Filtering, search, pagination, card rendering, form submission
   ========================================================================== */

(function () {
  'use strict';

  // ---- Config ----
  const PER_PAGE = 30;
  let currentPage = 1;
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
    renderPagination();
    bindEvents();
  }

  // ---- Card Rendering ----
  function renderCards() {
    const start = (currentPage - 1) * PER_PAGE;
    const end = start + PER_PAGE;
    const page = filteredData.slice(start, end);

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
    currentPage = 1;
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
    renderPagination();
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

  // ---- Pagination ----
  function renderPagination() {
    paginationEl.innerHTML = '';
    var totalPages = Math.ceil(filteredData.length / PER_PAGE);

    if (totalPages <= 1) return;

    if (currentPage > 1) {
      var prevBtn = document.createElement('button');
      prevBtn.className = 'pagination-btn';
      prevBtn.textContent = 'Previous';
      prevBtn.addEventListener('click', function () {
        currentPage--;
        renderCards();
        renderPagination();
        scrollToTop();
      });
      paginationEl.appendChild(prevBtn);
    }

    var info = document.createElement('span');
    info.style.cssText = 'display:inline-flex;align-items:center;margin:0 16px;font-size:16px;font-weight:700;';
    info.textContent = currentPage + ' / ' + totalPages;
    paginationEl.appendChild(info);

    if (currentPage < totalPages) {
      var nextBtn = document.createElement('button');
      nextBtn.className = 'pagination-btn';
      nextBtn.textContent = 'Next';
      nextBtn.addEventListener('click', function () {
        currentPage++;
        renderCards();
        renderPagination();
        scrollToTop();
      });
      paginationEl.appendChild(nextBtn);
    }
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

    // Form submission (Netlify Forms)
    addForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var formData = new FormData(addForm);

      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(formData).toString()
      })
      .then(function (res) {
        if (res.ok) {
          addForm.style.display = 'none';
          formSuccess.classList.add('visible');
        } else {
          alert('Something went wrong. Please try again.');
        }
      })
      .catch(function () {
        alert('Something went wrong. Please try again.');
      });
    });

    // Show/hide "Add a community" section
    document.getElementById('show-add-form').addEventListener('click', function (e) {
      e.preventDefault();
      var section = document.getElementById('add-community');
      section.classList.toggle('visible');
      if (section.classList.contains('visible')) {
        section.scrollIntoView({ behavior: 'smooth' });
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
