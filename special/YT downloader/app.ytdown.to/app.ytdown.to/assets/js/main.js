window._adsCheck = Number(document.querySelector('script[data-domain]').dataset.ads);

window._adsclick = function (e) {
  e && e.preventDefault();
  const currentTime = Date.now();

  const lastClickTime = localStorage.getItem('lastDownloadClick');
  const oneDayInMs = 24 * 60 * 60 * 1000;

  if (!lastClickTime || (currentTime - lastClickTime > oneDayInMs)) {

    localStorage.setItem('lastDownloadClick', currentTime);

    window.open('https://otieu.com/4/9939032', '_blank');
  }
}

jQuery(document).ready(function ($) {
  // Single DOM scan instead of 15 — read all data-* attrs from main script tag at once
  var _scriptEl = document.querySelector('script[data-domain]');
  var _ds = (_scriptEl && _scriptEl.dataset) || {};
  const domain = _ds.domain;
  const download = _ds.download;
  const start = _ds.start;
  const information = _ds.information;
  const media = _ds.media;
  const file_size = _ds.fileSize;
  const agreeing_terms = _ds.agreeingTerms;
  const close = _ds.close;
  const ok = _ds.ok;
  const invalid_url = _ds.invalidUrl;
  const invalid_url_instruction = _ds.invalidUrlInstruction;
  const maintenance_mode = Number(_ds.maintenanceMode || 0);
  const media_queued_message = _ds.mediaQueuedMessage;
  const maintenance_notify = _ds.maintenanceNotify;
  const unexpected_error = _ds.unexpectedError;
  const geo_restricted = _ds.geoRestricted;
  const thumbnail = _ds.thumbnail;
  const proxy_url = domain + '/proxy.php';
  const dt = _ds.dt || '';
  const sitekey_turnstile = '0x4AAAAAAAkWGa51oCzAJ43z';
  var isCaptcha = Number($('script[data-captcha]').attr('data-captcha'));
// 25/04/2026 — poll caps + consec error abort + visitor message extractor
  if (typeof MAX_POLL_RETRIES === 'undefined') {
    var MAX_POLL_RETRIES = Infinity;
    var MAX_CONSEC_ERRORS = 3;
    var _pollCount = 0;
    var _consecErrors = 0;
  var _remintTries = 0, _dlRemintTries = 0;
  }
  function getApiMessage(xhrOrData) {
    if (!xhrOrData) return null;
    var j = xhrOrData.responseJSON || xhrOrData;
    if (!j) return null;
    if (j.api && typeof j.api === 'object' && j.api.message) return j.api.message;
    if (j.message) return j.message;
    return null;
  }
  function __e(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      var m = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
      return m[c];
    });
  }

  var isCooldown = Number($('script[data-cooldown]').attr('data-cooldown'));
  var maxQuality = Number($('script[data-max-quality]').attr('data-max-quality'));
  var audioOnly = Number(_ds.audioOnly || 0);

  // Variables to track ongoing download requests
  var currentDownloadRequest = null;
  var currentDownloadTimeout = null;

  // Check for maintenance mode (503 error)
  if (maintenance_mode) {
    $('#ytdown-downloader-form #postUrl').prop('disabled', true);
    $('#ytdown-downloader-form button.paste-button').prop('disabled', true);
    $('#ytdown-downloader-form button.btn-download').prop('disabled', true);
    $('.error-show').show();
    let maintenanceHTML = `<div class="error-detail">${maintenance_notify}</div>`;
    $('.error-show').html(maintenanceHTML);
  }

  // Function to toggle languages button
  $(".faq-question").click(function (e) {
    e.preventDefault();
    $(this).closest(".faq-item").toggleClass("collapse");
    $(this).closest(".faq-item").find(".faq-answer").slideToggle();

  });


  var $navWrapper = $('.navbar-wrapper');
  var stickyOffset = $navWrapper.length ? $navWrapper.offset().top : 0;

  // Throttled via requestAnimationFrame — avoid 60fps DOM thrash on mobile scroll
  if ($navWrapper.length) {
    var _scrollTicking = false;
    var _isSticky = false;
    var _onScroll = function () {
      var y = window.pageYOffset || document.documentElement.scrollTop;
      var shouldStick = y > stickyOffset;
      if (shouldStick !== _isSticky) {
        $navWrapper.toggleClass('sticky', shouldStick);
        _isSticky = shouldStick;
      }
      _scrollTicking = false;
    };
    window.addEventListener('scroll', function () {
      if (!_scrollTicking) {
        window.requestAnimationFrame(_onScroll);
        _scrollTicking = true;
      }
    }, { passive: true });
  }

  // Function to handle dark mode toggle
  function darkMode() {
    var $toggleSwitch = $('.toggle-switch input[type="checkbox"]');
    var _$html = $('html');

    $toggleSwitch.on('change', function () {
      var theme = $(this).is(':checked') ? "dark" : "light";
      localStorage.setItem("theme", theme);
      _$html.removeClass('dark light').addClass(theme);

      $.post(domain + '/darkmode.php', {
        darkMode: theme === 'dark' ? '1' : '0'
      });
    });
  };

  darkMode();

  // Function to toggle the menu and backdrop
  function toggleMenu() {
    const $body = $('body');
    const $navbar = $('#navbar-mobile');
    $navbar.toggleClass('show');
    $body.toggleClass('backdrop');

    // Prevent body from scrolling when menu is open
    $body.toggleClass('no-scroll', $navbar.hasClass('show'));
  }

  // Toggle the menu on button click
  $('button.menu-toggle').on('click', function (e) {
    e.preventDefault();
    toggleMenu();
  });

  // Close the menu when clicking outside of it
  $(document).on('click', function (e) {
    const $menu = $('#navbar-mobile');
    const isClickInsideMenu = $menu.has(e.target).length > 0;
    const isClickOnToggle = $(e.target).closest("button.menu-toggle").length > 0;

    if (!isClickInsideMenu && !isClickOnToggle && $menu.hasClass('show')) {
      toggleMenu();
    }
  });

  // Check for input value on change
  $('#postUrl').on('input', function () {
    if ($(this).val() !== '') {
      $('#ytdown-downloader-form .paste-button').hide();
      $('#ytdown-downloader-form .clear-button').css('display', 'flex');
    } else {
      $('#ytdown-downloader-form .clear-button').hide();
      $('#ytdown-downloader-form .paste-button').css('display', 'flex');
    }
  });

  // Handle Paste Button Click
    $('#postUrl').on('paste', function () {
    var $i = $(this);
    setTimeout(function () {
      var raw = String($i.val() || '');
      var m = raw.match(/https?:\/\/\S+/);
      var url = m ? m[0].replace(/[.,;:)>\]'"]+$/, '') : raw.trim();
      if (isValidURL(url)) {
        $i.val(url);
        // auto-fetch disabled 25/04: $('#ytdown-downloader-form').submit();
      }
    }, 0);
  });

$('.paste-button').on('click', function () {
    navigator.clipboard.readText().then(function (clipboardText) {
      var raw = String(clipboardText || '');
      var m = raw.match(/https?:\/\/\S+/);
      var pasted = m ? m[0].replace(/[.,;:)>\]'"]+$/, '') : raw.trim();
      if (isValidURL(pasted)) {
        $('#postUrl').val(pasted);
        $('#ytdown-downloader-form .paste-button').hide();
        $('#ytdown-downloader-form .clear-button').css('display', 'flex');
              // auto-fetch disabled 25/04: $('#ytdown-downloader-form').submit();
      }
    });
  });

  // Clear input value
  $('#ytdown-downloader-form .clear-button').on('click', function (e) {
    e.preventDefault();
    $('#postUrl').val('');
    $(this).hide();
    $('#ytdown-downloader-form .paste-button').css('display', 'flex');
  });

  // Function to check if a string is a valid URL
  function isValidURL(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  function convertToMBorGB(sizeStr) {
    // Defensive parse: accept "8.32 MB" (with space) or "8.32MB" (no space)
    let cleaned = String(sizeStr || '').replace(/,/g, '').trim();
    let sizeArr = cleaned.split(/\s+/);
    let sizeValue = parseFloat(sizeArr[0]);
    let sizeUnit = (sizeArr[1] || '').toUpperCase();
    if (!sizeUnit) {
      let m = cleaned.match(/^([\d.]+)\s*(KB|MB|GB|TB|B)$/i);
      if (m) { sizeValue = parseFloat(m[1]); sizeUnit = m[2].toUpperCase(); }
    }

    // Convert to MB based on the unit
    let sizeInMB;
    switch (sizeUnit) {
      case 'KB':
        sizeInMB = sizeValue / 1024; // KB to MB
        break;
      case 'MB':
        sizeInMB = sizeValue; // Already in MB
        break;
      case 'GB':
        sizeInMB = sizeValue * 1024; // GB to MB
        break;
      default:
        return '0 MB';
    }

    // If the size is 1000 MB or more, return in GB, otherwise in MB
    if (sizeInMB >= 1024) {
      return (sizeInMB / 1024).toFixed(2) + ' GB';
    } else {
      return sizeInMB.toFixed(2) + ' MB';
    }
  }

  // Function to abort current download process
  function abortCurrentDownload() {
    if (currentDownloadRequest && currentDownloadRequest.abort) {
      currentDownloadRequest.abort();
      currentDownloadRequest = null;
    }
    if (currentDownloadTimeout) {
      clearTimeout(currentDownloadTimeout);
      currentDownloadTimeout = null;
    }
  }

  // Inner SVG for the two button icons (same 24x24 viewBox as the .download-icon wrapper).
  // "Start" stage uses a forward arrow (proceed); "Download"/direct stages use the download-to-tray icon.
  var startIconInner = '<g id="SVGRepo_iconCarrier"><path d="M4 12h14M13 6l6 6-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></g>';
  var downloadIconInner = '<g id="SVGRepo_iconCarrier"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.163 2.819C9 3.139 9 3.559 9 4.4V11H7.803c-.883 0-1.325 0-1.534.176a.75.75 0 0 0-.266.62c.017.274.322.593.931 1.232l4.198 4.401c.302.318.453.476.63.535a.749.749 0 0 0 .476 0c.177-.059.328-.217.63-.535l4.198-4.4c.61-.64.914-.96.93-1.233a.75.75 0 0 0-.265-.62C17.522 11 17.081 11 16.197 11H15V4.4c0-.84 0-1.26-.164-1.581a1.5 1.5 0 0 0-.655-.656C13.861 2 13.441 2 12.6 2h-1.2c-.84 0-1.26 0-1.581.163a1.5 1.5 0 0 0-.656.656zM5 21a1 1 0 0 0 1 1h12a1 1 0 1 0 0-2H6a1 1 0 0 0-1 1z" fill="#fff" /></g>';

  // Swap the button's leading icon without touching the loading spinner sibling.
  function setDownloadButtonIcon($btn, isStart) {
    $btn.find('.download-icon').html(isStart ? startIconInner : downloadIconInner);
  }

  // Trigger the browser download for an already-prepared file.
  function triggerFileDownload(fileUrl, fileName) {
    if (!fileUrl) return;
    var a = $('<a>').attr('href', fileUrl).attr('download', fileName || '').appendTo('body').get(0);
    a.click();
    $(a).remove();
  }

  function refreshDownloadButton() {
    abortCurrentDownload();
    var $btn = $('#downloadButton');
    if (!$btn.length) return;
    var isDirect = $('.download-option option:selected').data('direct') == 1;
    $btn.removeData('fileUrl').removeData('fileName');
    if (isDirect) {
      $btn.attr('data-stage', 'direct');
      $btn.find('.download-container span').text(download);
      setDownloadButtonIcon($btn, false);
    } else {
      $btn.attr('data-stage', 'start');
      $btn.find('.download-container span').text(start);
      setDownloadButtonIcon($btn, true);
    }
    $btn.find('.loading-container').hide();
    $btn.find('.download-container').show();
    $('.jumbotron .result .download-option').prop('disabled', false);
  }

  // Helper to show download progress error and reset UI
  function showDownloadProgressError(clickedButton) {
    abortCurrentDownload();
    $('.jumbotron .result .download-option').prop("disabled", false);

    // Replace spinner with error icon in loading-container
    if (clickedButton && clickedButton.length) {
      const $loadingContainer = clickedButton.closest('.btn-download-wrap').find('.download-button .loading-container');
      if ($loadingContainer.length) {
        $loadingContainer.find('.spinner-icon').replaceWith(`
          <svg class="spinner-icon" width="17px" height="17px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" stroke="#ff012a" stroke-width="2" fill="none"/>
            <path d="M12 8v4M12 16h.01" stroke="#ff012a" stroke-width="2" stroke-linecap="round"/>
          </svg>
        `);
        $loadingContainer.find('#progressText').text(unexpected_error);
        $loadingContainer.find('#progress').css('width', '0');
      }
    }
  }

  // Function to get details with progress simulation
  function _getDetail(url, totalSize, clickedButton) {
    if (typeof _pollCount !== 'undefined' && ++_pollCount > MAX_POLL_RETRIES) {
      console.warn('[poll] MAX_POLL_RETRIES exceeded for', url);
      _pollCount = 0;
      return;
    }
    // Abort any existing download request (only if there's one running)
    if (currentDownloadRequest || currentDownloadTimeout) {
      abortCurrentDownload();
    }

    // Create and store the new request immediately
    var ajaxRequest = $.ajax({
      url: proxy_url,
      method: 'POST',
      timeout: 30000,
      data: {
        url: url,
        dt: (window.__d || dt),
      },
      success: function (data) {
        // Check if request was aborted (another download started)
        if (currentDownloadRequest !== ajaxRequest) {
          return;
        }
        if (typeof _consecErrors !== 'undefined') _consecErrors = 0;
        _dlRemintTries = 0;
        if (data.api) {
          // Cache hot-path selectors — avoid 6+ queries per poll
          var $progressText = $('#progressText');
          var $progress = $('#progress');
          let status = String(data.api.status || '').toLowerCase();
          let position = data.api.position;
          let percentString = data.api.progress;
          if (!percentString || status === "error") {
            showDownloadProgressError(clickedButton);
            return;
          }

          $progressText.next('.queue-position').remove();

          if (status === "queued") {
            $progressText.addClass('queue').text(`${media_queued_message}`);

            if (position) {
              if ($progressText.next('.queue-position').length === 0) {
                $progressText.after('<span class="queue-position" style="margin-left: 3px;"></span>');
              }

              // Update position
              $('.loading-content .queue-position').text(`(${position})`);
            }

            $progress.css('width', '0%');

            currentDownloadTimeout = setTimeout(() => {
              if (currentDownloadRequest === ajaxRequest) {
                _getDetail(url, totalSize, clickedButton);
              }
            }, 2000);
            return;
          }

          $progressText.removeClass('queue');

          if (status === "completed") {

            // $progressText.text(`${totalSize} / ${totalSize} (100%)`);
            $progressText.text(`${totalSize} (100%)`);
            // Set progress width to 100%
            setTimeout(function () { $progress.css('width', '100%'); }, 100);

            // Wait for the progress bar to finish transitioning — .one() auto-removes after fire
            $progress.off('transitionend.dlComplete').one('transitionend.dlComplete', function () {
              // Enable download options once transition to 100% completes
              $('.jumbotron .result .download-option').prop("disabled", false);

              var $btn = clickedButton.closest('.btn-download-wrap').find('.download-button');
              $btn.attr('data-stage', 'ready')
                .data('fileUrl', data.api.fileUrl)
                .data('fileName', data.api.fileName);
              $btn.find('.download-container span').text(download);
              setDownloadButtonIcon($btn, false);

              // Ads already fired on the Start click; just deliver the file now.
              triggerFileDownload(data.api.fileUrl, data.api.fileName);

              // Hide the loading container and show the download container
              $btn.find('.loading-container').hide();
              $btn.find('.download-container').show();

              $progress.css('width', '0');
            });

            // Clear download tracking after completion
            currentDownloadRequest = null;
            currentDownloadTimeout = null;
          } else {
            let percentComplete = parseFloat(percentString.replace('%', '')); // Extract numeric percentage
            let totalMB = parseFloat(totalSize.replace(' GB', '').replace(' MB', '')) * (totalSize.includes('GB') ? 1024 : 1); // Convert total size to MB for internal calculations
            // Update progress based on actual percentage and retry
            let downloadedMB = ((totalMB * percentComplete) / 100).toFixed(2);
            let downloadedSize = downloadedMB >= 1000
              ? (downloadedMB / 1024).toFixed(2) + ' GB'
              : downloadedMB + ' MB';

            // $progressText.text(`${downloadedSize} / ${totalSize} (${percentString})`);
            $progressText.text(`${downloadedSize} (${percentString})`);
            $progress.css('width', percentComplete + '%');

            currentDownloadTimeout = setTimeout(() => {
              if (currentDownloadRequest === ajaxRequest) {
                _getDetail(url, totalSize, clickedButton);
              }
            }, 2000); // Retry after 2 seconds
          }
        }
      },
      error: function (xhr) {
        if (xhr.status === 409) {
          if (_dlRemintTries++ >= 3) {
            if (!window.__reminting) fileNotFound(getApiMessage(xhr));
            return;
          }
          window.__remint()
            .then(function () { _getDetail(url, totalSize, clickedButton); })
            .catch(function (e) {
              if (e && e.kind === 'transport') { window.__d = null; _getDetail(url, totalSize, clickedButton); }
              else { fileNotFound('Please refresh the page and try again.'); }
            });
          return;
        }
        if (typeof _consecErrors !== 'undefined' && ++_consecErrors >= MAX_CONSEC_ERRORS) {
          console.warn('[poll] MAX_CONSEC_ERRORS reached, aborting');
          _consecErrors = 0;
          if (typeof currentDownloadRequest !== 'undefined') currentDownloadRequest = null;
          if (typeof currentDownloadTimeout !== 'undefined' && currentDownloadTimeout) { clearTimeout(currentDownloadTimeout); currentDownloadTimeout = null; }
          fileNotFound(getApiMessage(xhr));
          return;
        }
        // Check if request was aborted (another download started)
        if (currentDownloadRequest !== ajaxRequest) {
          return;
        }
        // Retry after a delay in case of an error
        currentDownloadTimeout = setTimeout(() => {
          if (currentDownloadRequest === ajaxRequest) {
            _getDetail(url, totalSize, clickedButton);
          }
        }, 2000); // Retry after 2 seconds
      }
    });

    // Store the current request immediately after creation
    currentDownloadRequest = ajaxRequest;
  }

  var directDownloadSpinnerIcon = '<svg class="download-icon-loading spinner-icon" width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.5"><circle cx="12" cy="12" r="9" stroke-opacity=".3"></circle><path class="spinner-arc" d="M12 3C16.9706 3 21 7.02944 21 12"></path></g></svg>';

  // Function to initiate video download
  window.downloadAction = function (event, mediaUrl, fileSize, isDirect) {
    event.preventDefault();
    let clickedButton = $(event.currentTarget);

    if (isDirect) {
      var $downloadBtn = clickedButton.closest('.btn-download-wrap').find('.download-button');
      if ($downloadBtn.hasClass('direct-downloading')) return;

      var $container = $downloadBtn.find('.download-container');
      var $icon = $container.find('.download-icon');
      if (!$container.find('.download-icon-loading').length) {
        $icon.after(directDownloadSpinnerIcon);
      }

      $downloadBtn.addClass('direct-downloading');
      $icon.hide();
      $container.find('.download-icon-loading').addClass('is-visible');
      $('.jumbotron .result .download-option').prop('disabled', true);

      setTimeout(function () {
        var iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = mediaUrl;
        document.body.appendChild(iframe);
        setTimeout(function () {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }, 120000);

        $container.find('.download-icon-loading').removeClass('is-visible');
        $icon.show();
        $downloadBtn.removeClass('direct-downloading');
        $('.jumbotron .result .download-option').prop('disabled', false);
      }, 1200);

      return;
    }

    // Reset poll counters for the new download
    if (typeof _pollCount !== 'undefined') _pollCount = 0;
    if (typeof _consecErrors !== 'undefined') _consecErrors = 0;
    // Convert the file size to either MB or GB
    let totalSize = convertToMBorGB(fileSize);

    // Append spinner icon only to the clicked button
    let loading_process = `
    <div class="loading-container" id="loading" style="display:none">
                        <span class="loading-content">
                        <svg class="spinner-icon" width="17" height="17" viewBox="0 0 24 24">
                                <g fill="none" stroke="currentColor" stroke-linecap="round" stroke-width="2.5">
                                    <circle cx="12" cy="12" r="9" stroke-opacity=".3"></circle>
                                    <path class="spinner-arc" d="M12 3C16.9706 3 21 7.02944 21 12"></path>
                                </g>
                            </svg>
                            <span class="spinner" role="status"></span>
                            <span id="progressText"></span>
                        </span>
                        <div id="progress" style="width: 0"></div>
                    </div>`;

    // Disable all download buttons except the clicked one

    // Add the spinner icon to the clicked download button
    if (clickedButton.find('.loading-container').length === 0) {
      clickedButton.closest('.btn-download-wrap').find('.download-button').prepend(loading_process);
    }

    clickedButton.closest('.btn-download-wrap').find('.download-button .loading-container').show();
    clickedButton.closest('.btn-download-wrap').find('.download-button .download-container').hide();

    // Show the download modal and reset progress
    $('#progressText').addClass('queue');
    $('#progressText').text(`${media_queued_message}`);

    $('.jumbotron .result .download-option').prop("disabled", true);

    _getDetail(mediaUrl, totalSize, clickedButton);

  }

  if (isCaptcha && $('.cf-turnstile').length > 0) {
    sessionStorage.removeItem('turnstileVerified');
    sessionStorage.removeItem('turnstileToken');
    $('#ytdown-downloader-form button.btn-download').prop('disabled', true).css({ 'opacity': '0.5', 'cursor': 'not-allowed' });
    // Render Turnstile widget before sending AJAX request  
    var currentTheme = localStorage.getItem('theme');
    $('.cf-turnstile').html('');

    turnstile.render('.cf-turnstile', {
      sitekey: sitekey_turnstile,
      theme: currentTheme,
      retry: 'never',  // Turn off automatic retry
      callback: function (token) {
        sessionStorage.setItem('turnstileToken', token);
        $('#ytdown-downloader-form button.btn-download').prop('disabled', false).css({ 'opacity': '1', 'cursor': 'pointer' });
      },
      'error-callback': function (errorCode) {
        console.error('Turnstile error code:', errorCode);
        // Clear the previous Turnstile token
        sessionStorage.removeItem('turnstileToken');
        // Reset the Turnstile widget manually
        turnstile.reset();
        $('.jumbotron .download-label').show();
        $('.jumbotron .spinner-icon').hide();
        $('#ytdown-downloader-form button.btn-download').prop('disabled', true).css({ 'opacity': '0.5', 'cursor': 'not-allowed' });
      },
    });
  }

  // Contact page render turnstile
  function renderContactTurnstile(attempts) {
    attempts = attempts || 0;
    if (!$('#contact-form').length || !$('#contact-form').find('.cf-turnstile').length) {
      return;
    }
    if (typeof turnstile === 'undefined') {
      if (attempts < 120) {
        setTimeout(function () { renderContactTurnstile(attempts + 1); }, 50);
      }
      return;
    }
    sessionStorage.removeItem('contactTurnstileToken');
    $('#contact-form .cf-turnstile').html('');
    $('#contact-form .submit-button').prop('disabled', true).css({ 'opacity': '0.5', 'cursor': 'not-allowed' });
    var contactTheme = localStorage.getItem('theme');
    window.__contactTurnstileWidgetId = turnstile.render('#contact-form .cf-turnstile', {
      sitekey: sitekey_turnstile,
      theme: contactTheme,
      retry: 'never',
      callback: function (token) {
        sessionStorage.setItem('contactTurnstileToken', token);
        $('#contact-form .submit-button').prop('disabled', false).css({ 'opacity': '1', 'cursor': 'pointer' });
      },
      'error-callback': function (errorCode) {
        console.error('Turnstile error code (contact):', errorCode);
        sessionStorage.removeItem('contactTurnstileToken');
        if (window.__contactTurnstileWidgetId != null) {
          turnstile.reset(window.__contactTurnstileWidgetId);
        }
        $('#contact-form .submit-button').prop('disabled', true).css({ 'opacity': '0.5', 'cursor': 'not-allowed' });
      },
    });
  }
  renderContactTurnstile(0);

  if (isCooldown) {
    // Cooldown management functions
    let cooldownTimer = null;
    let remainingTime = 0;

    function checkCooldownStatus() {
      return $.ajax({
        url: domain + '/cooldown.php',
        method: 'POST',
        timeout: 30000,
        data: { action: 'check' },
        dataType: 'json'
      }).done(function (response) {
      }).fail(function (xhr, status, error) {
        console.error('Cooldown check failed:', error);
      });
    }

    function recordDownload() {
      return $.ajax({
        url: domain + '/cooldown.php',
        method: 'POST',
        timeout: 30000,
        data: { action: 'record' },
        dataType: 'json'
      });
    }

    function startCooldownTimer(seconds) {
      remainingTime = seconds;
      updateCooldownUI();

      cooldownTimer = setInterval(function () {
        remainingTime--;
        updateCooldownUI();

        if (remainingTime <= 0) {
          clearInterval(cooldownTimer);
          enableDownloadButton();
        }
      }, 1000);
    }

    function updateCooldownUI() {
      const $button = $('#ytdown-downloader-form button.btn-download');
      const $errorShow = $('.error-show');

      if (remainingTime > 0) {
        $button.prop('disabled', true).css({ 'opacity': '0.5', 'cursor': 'not-allowed' });

        // Show cooldown error message like invalid URL
        $errorShow.show();

        // Get cooldown message from language data
        const cooldownMessage = $('script[data-cooldown-message]').data('cooldown-message') || 'Please wait {seconds} seconds before downloading again.';
        const message = cooldownMessage.replace('{seconds}', remainingTime);

        $errorShow.html(`
          <div class="error-detail">${message}</div>
        `);
      }
    }

    function enableDownloadButton() {
      const $button = $('#ytdown-downloader-form button.btn-download');
      const $errorShow = $('.error-show');

      $button.prop('disabled', false).css({ 'opacity': '1', 'cursor': 'pointer' });
      $errorShow.hide();
    }

    // Function to clear cooldown manually
    window.clearCooldown = function () {
      if (cooldownTimer) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
      remainingTime = 0;
      enableDownloadButton();
    }

    // Check cooldown status on page load
    checkCooldownStatus().done(function (response) {
      if (!response.can_download && response.remaining_time > 0) {
        startCooldownTimer(response.remaining_time);
      }
    }).fail(function (xhr, status, err) {
      console.warn('cooldown check failed, proceeding without timer:', status, err);
    });
  }

  // Main handle submit form
  $('#ytdown-downloader-form').submit(function (event) {
    event.preventDefault();

    if (isCooldown) {
      // Check cooldown before proceeding — fail-open: proceed if response shape is unexpected or fetch fails
      checkCooldownStatus().done(function (response) {
        if (response && response.can_download === false) {
          if (response.remaining_time > 0) {
            startCooldownTimer(response.remaining_time);
          }
          return;
        }
        processDownload();
      }).fail(function () {
        // Network error — don't block the user
        processDownload();
      });
    } else {
      processDownload();
    }

    function processDownload() {
      // Abort any ongoing download process when starting a new download
      abortCurrentDownload();

      var urlInput = $('input#postUrl').val();
      $('.media-loaded').hide();
      $('.error-show').hide();
      $('.jumbotron .spinner-icon').show();
      $('.jumbotron .download-label').hide();
      $('.download-another').hide();

      if (urlInput === '') {
        return fileNotFound();
      } else {
        let n = urlInput.match(/^.+(http[^ ]+).*$/)
        if (n) {
          urlInput = n[1]
          $('input#postUrl').val(urlInput);
        }
      }

      urlInput = urlInput.trim();
      if (!/^https?:\/\//i.test(urlInput) && /^(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\b/i.test(urlInput)) {
        urlInput = 'https://' + urlInput;
        $('input#postUrl').val(urlInput);
      }

      const isVerified = sessionStorage.getItem('turnstileVerified') === 'true';
      const turnstileToken = sessionStorage.getItem('turnstileToken');

      if (isCaptcha && !isVerified) {
        // Verify Turnstile first
        verifyTurnstile(turnstileToken, urlInput);
      } else {
        // No captcha or already verified
        submitForm(urlInput);
      }
    }

    function verifyTurnstile(token, urlInput) {
      $.ajax({
        url: domain + '/turnstile.php',
        method: 'POST',
        timeout: 30000,
        data: {
          'cf-turnstile-response': token
        },
        success: function (response) {
          if (response && response.success) {
            sessionStorage.setItem('turnstileVerified', 'true');
            submitForm(urlInput);
          } else {
            console.error('Turnstile verification failed:', response ? response.message : 'No response');
            fileNotFound();
          }
        },
        error: function (xhr, status, error) {
          console.error('Turnstile verification request failed:', status, error);
          console.error('Response:', xhr.responseText);
          fileNotFound();
        }
      });
    }

    function submitForm(urlInput) {
      if (!window.__d && !dt) {
        window.__mws = window.__mws || Date.now();
        var _waited = Date.now() - window.__mws;
        // require_mint: the on-load mint hasn't produced a token yet. Give it ~1s, then actively drive a robust
        // re-mint (fresh challenge + 20s watchdog) so a transient on-load mint failure self-heals rather than stranding the user.
        if (_waited > 1000 && !window.__reminting && !window.__d && typeof window.__remint === 'function') {
          try { window.__remint().catch(function () {}); } catch (e) {}
        }
        // Keep polling while within the base window, OR while a re-mint is actively in flight (hard cap 15s).
        if ((_waited < 4000 || window.__reminting) && _waited < 15000) { return setTimeout(function () { submitForm(urlInput); }, 120); }
        try { $('.jumbotron .spinner-icon').hide(); $('.jumbotron .download-label').show(); $('.media-loaded').hide(); $('.error-show').show().html('<div class="error-detail">Please refresh the page and try again.</div>'); } catch (e) {}
        return;
      }
      window.__mws = undefined;
      var data = {
        url: urlInput,
        dt: (window.__d || dt)
      };
      $.ajax({
        url: proxy_url,
        method: 'POST',
        timeout: 30000,
        data: data,
        success: function (data) {
          _remintTries = 0;
          // Check for maintenance mode (503 error)
          if (data.api && String(data.api.status || '').toLowerCase() === "error" && data.api.code === 503) {
            $('.download-another').hide();
            $('.jumbotron .spinner-icon').hide();
            $('.jumbotron .download-label').show();
            $('.media-loaded').hide();
            $('.error-show').show();
            let maintenanceHTML = `<div class="error-detail">${maintenance_notify}</div>`;
            $('.error-show').html(maintenanceHTML);
            return;
          }

          // Country restriction
          if (data.api && String(data.api.error || '').toUpperCase() === "GEO_RESTRICTED") {
            return fileNotFound(geo_restricted);
          }

          if (data.api && (String(data.api.status || '').toLowerCase() === "error" || data.api.service !== "YouTube")) {
            // closeModal('captchaModal');
            return fileNotFound();
          }

          if (data.api && String(data.api.status || '').toLowerCase() == "ok") {
            if (isCaptcha) {
              sessionStorage.setItem('turnstileVerified', 'true');
            }

            if (isCooldown) {
              // Record the download for cooldown tracking
              recordDownload().done(function () {
                // Start cooldown timer after successful download
                startCooldownTimer(60);
              });
            }

            $('.media-loaded').show();

            function isMobile() {
              return $(window).width() <= 767;
            }

            // Initialize an empty HTML string
            let downloaderDetailsHTML = '';

            downloaderDetailsHTML += `
            <div class="result">    
              <div class="box-item" style="width: 50%">
                <div class="title-header">${information}</div>
                ${(data.api.mediaItems && data.api.mediaItems[0] && data.api.mediaItems[0].mediaPreviewUrl) ? `<div class="thumbnail">
                    <video poster="${__e(data.api.mediaItems[0].mediaThumbnail)}" width="100%" preload="auto" controls muted webkit-playsinline playsinline controlsList="nodownload noplaybackrate" disablePictureInPicture>
                      <source src="${__e(data.api.mediaItems[0].mediaPreviewUrl)}" type="video/mp4">
                    </video>
                                     </div>` :
                `${data.api.imagePreviewUrl ? `<div class="thumbnail"><img src="${__e(data.api.imagePreviewUrl)}" alt="thumbnail"></div>` : ''}`
              }
                <div class="content">
                  ${(data.api.userInfo && data.api.userInfo.name) ?
                `<div class="infor creator"><span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#ff012a">
  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
</svg>
<a href="${__e(data.api.userInfo.internalUrl)}" target="_blank" rel="nofollow noopener noreferrer">${__e(data.api.userInfo.name)}</a></span></div>`
                : ''}

                    ${data.api.title && data.api.title !== null && data.api.title !== 'N/A' ?
                `<div class="infor title" title="${__e(data.api.title)}"><span>${__e(data.api.title)}</span></div>`
                : ''}
                  
                  ${data.api.description && data.api.description !== null && data.api.description !== 'N/A' ?
                `<div class="infor description"><span>${__e(data.api.description)}</span></div>` : ''}
                   ${(data.api.mediaItems && data.api.mediaItems[0] && data.api.mediaItems[0].mediaDuration) ?
                `<div class="infor duration"><span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18">
                    <circle cx="12" cy="12" r="10" stroke="#ff012a" stroke-width="2" fill="none"/>
                    <line x1="12" y1="12" x2="12" y2="7" stroke="#ff012a" stroke-width="2"/>
                    <line x1="12" y1="12" x2="16" y2="12" stroke="#ff012a" stroke-width="2"/>
                  </svg>${__e(data.api.mediaItems[0].mediaDuration)}</span></div>` : ''}
                </div>
            </div>
             <div class="box-item download-option-wrapper" style="width: 50%">
                <div class="title-header">${media}</div>
                 <div class="box">`
            // Build download options from mediaItems and optional audioTracks
            var hasMediaItems = data.api.mediaItems && data.api.mediaItems.length > 0;
            var hasAudioTracks = audioOnly && data.api.audioTracks && data.api.audioTracks.length > 0;
            if (hasMediaItems || hasAudioTracks) {
              let optionsHtml = '';
              if (hasMediaItems) {
                data.api.mediaItems.forEach(item => {
                  if (audioOnly) {
                    const ext = (item.mediaExtension || '').toUpperCase();
                    if (ext !== 'MP3' && ext !== 'M4A') return;
                  }
                  // Check if quality restriction is set and filter accordingly
                  if (item.type === 'Video' && maxQuality > 0) {
                    let itemRes = 0;
                    if (item.mediaUrl) {
                      const lastPart = item.mediaUrl.split('/').pop();
                      const match = lastPart.match(/(\d{3,4})p\b/);
                      if (match) itemRes = parseInt(match[1]);
                    }

                    if (itemRes > maxQuality) return;
                  }
                  optionsHtml += `<option value="${__e(item.mediaUrl)}" data-fileSize="${__e(item.mediaFileSize)}">
                ${__e(item.mediaExtension || '')}
                - (${item.mediaRes ? __e(item.mediaRes) + ' ' : ''}${__e(item.mediaQuality || '')})
              </option>`;
                });
              }
              if (hasAudioTracks) {
                data.api.audioTracks.forEach(function (track) {
                  if (!track.mediaUrl) return;
                  var ext = (track.mediaExtension || 'M4A').toUpperCase();
                  var label = ext + ' - [' + (track.name || '') + ']';
                  optionsHtml += `<option value="${__e(track.mediaUrl)}" data-fileSize="${__e(track.mediaFileSize)}" data-direct="1">
                ${__e(label)}
              </option>`;
                });
              }

              if (!optionsHtml) {
                fileNotFound();
                return;
              }

              downloaderDetailsHTML += `<select class="download-option">`;
              downloaderDetailsHTML += optionsHtml;
              $('.download-another').show();
              downloaderDetailsHTML += `</select>
             <div class="divider-wraper">
                <hr>
                <div class="divider-content-center">${file_size}: <span class="filesize"></span></div>
                </div>
                   <div class="btn-download-wrap normal-quaity">
                      <a href="javascript: void(0);" class="download-link download-button" id="downloadButton" data-stage="start">
                        <div class="download-container btn-download">
                          <svg class="download-icon" width="22px" height="22px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <g id="SVGRepo_iconCarrier">
                                <path d="M4 12h14M13 6l6 6-6 6" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
                            </g>
                          </svg>
                          <span>${start}</span>
                        </div>
                      </a>
                    </div>
                    <div class="agree-terms">
                    <small>${agreeing_terms}</small>
                    </div>
                    `;
            }
            downloaderDetailsHTML += `</div>
              </div>
              </div>`;
            // Set the HTML
            $('.media-loaded').html(downloaderDetailsHTML);

            // Get the first option's file size and display it
            const firstOptionFileSize = $('.download-option option:first').data('filesize');
            $('.filesize').text(firstOptionFileSize ? `${firstOptionFileSize}` : 'N/A');
            // Set the button label for the initially selected option (direct audio -> "Download")
            refreshDownloadButton();

            // Add event listener to update the file size when the user selects a different option
            $('.download-option').on('change', function () {
              const selectedFileSize = $(this).find('option:selected').data('filesize');
              $('.filesize').text(selectedFileSize ? `${selectedFileSize}` : 'N/A');
              // Selection changed: re-sync the button (label + drop any stale prepared file)
              refreshDownloadButton();
            });

            $('#downloadButton').on('click', function (event) {
              const $btn = $(this);
              const selectedOption = $('.download-option option:selected');
              const mediaUrl = selectedOption.val();
              const mediaFileSize = selectedOption.data('filesize');
              const isDirect = selectedOption.data('direct') == 1;

              // Stage 2 — already processed & auto-downloaded: clicking again re-downloads (fallback) + ads
              if ($btn.attr('data-stage') === 'ready') {
                if (window._adsCheck && typeof window._adsclick === 'function') window._adsclick(event);
                triggerFileDownload($btn.data('fileUrl'), $btn.data('fileName'));
                return;
              }

              // Direct downloads have no processing step — download immediately (+ ads)
              if (isDirect) {
                if (window._adsCheck && typeof window._adsclick === 'function') window._adsclick(event);
                downloadAction(event, mediaUrl, mediaFileSize, true);
                return;
              }

              // Stage 1 — "Start": fire ads on this real click gesture (so the popup isn't blocked),
              // then begin processing. The file auto-downloads once processing completes.
              if (window._adsCheck && typeof window._adsclick === 'function') window._adsclick(event);
              downloadAction(event, mediaUrl, mediaFileSize, false);
            });

          } else {
            // Handle case where API returns an error
            fileNotFound();
          }
        },
        error: function (xhr, status, error) {
          if (xhr.status === 409) {
            if (_remintTries++ >= 3) {
              if (!window.__reminting) fileNotFound('Please refresh the page and try again.');
              return;
            }
            window.__remint()
              .then(function () { submitForm(urlInput); })
              .catch(function (e) {
                if (e && e.kind === 'transport') { window.__d = null; submitForm(urlInput); }
                else { fileNotFound('Please refresh the page and try again.'); }
              });
            return;
          }
          console.log(error);
          $('.download-another').hide();
          $('.jumbotron .spinner-icon').hide();
          $('.jumbotron .download-label').show();
          fileNotFound(getApiMessage(xhr));
        }
      }).always(function () {
        $('.jumbotron .spinner-icon').hide();
        $('.jumbotron .download-label').show();
      });
    }
  });


  function fileNotFound(customMessage) {
    var bodyText = (customMessage && String(customMessage).trim()) ? String(customMessage).replace(/[&<>"']/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}) : invalid_url;
    $('.download-another').hide();
    $('.jumbotron .spinner-icon').hide();
    $('.jumbotron .download-label').show();
    $('.media-loaded').hide();
    $('.error-show').show();
    // $('#messageModal').show();
    // Handle any errors that occur during the AJAX request
    let downloaderErrorsHTML = `
    <div class="error-detail">${bodyText}</div>`;
    $('.error-show').html(downloaderErrorsHTML);
    // $('body').addClass('no-scroll');
  }


  function closeModal(modalId) {
    $('#' + modalId).hide();
    $('body').removeClass('no-scroll'); // Enable scrolling when modal is closed
  }

  $(document).on('click', '.download-another', function () {
    // Abort any ongoing download process (only if download is in progress)
    abortCurrentDownload();
    $(this).hide();
    $('.media-loaded').hide();
    $('input#postUrl').val('');
    $('#ytdown-downloader-form .clear-button').hide();
    $('#ytdown-downloader-form .paste-button').css('display', 'flex');
    if ('scrollBehavior' in document.documentElement.style) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      $('html, body').animate({ scrollTop: 0 }, 500);
    }
  });

  // Close the modal when clicking outside of the modal content and clicking close button on the modal 
  $(document).on('click', function (event) {

    if ($(event.target).closest('.modal-content').length === 0 && $('#messageModal').is(':visible')) {
      closeModal('messageModal');
    }
  });
  // Check for input value on page load
  $('input#postUrl').trigger('input');

  $(window).resize(function () {
    if ($(window).width() >= 575) {
      $('body').removeClass('no-scroll');
      $('#menu').removeClass('in');
    }
  });
  $('.dark-mode .toggle-dark').click(function () {
    $('#menu').css('transition', 'none');
  });
  $('.dark-mode .toggle-light').click(function () {
    $('#menu').css('transition', 'none');
  });
  $('button.navbar-toggle').on('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    $("#menu").toggleClass('in');
    $("body").toggleClass('no-scroll');
    $('#menu').css('transition', 'all 0.3s');
    $(".nav-overlay").toggleClass('active');
  });
  $(".navbar-header .nav-overlay").on("click", this, function (e) {
    $("button.navbar-toggle").trigger("click");
  });

  $(document).on('click', '.language-dropdown-btn', function (e) {
    e.preventDefault();
    e.stopPropagation(); // Prevent the click from bubbling up

    $(this).toggleClass("active");
    const $dropdownMenu = $(this).next();

    if ($dropdownMenu.length) {
      $dropdownMenu.toggleClass("show");

      // Close the dropdown when clicking outside of it — .one() with proper args (not .on().one())
      $(document).off('click.dropdownClose').one('click.dropdownClose', function (event) {
        if (!event.target.closest('.language-dropdown-btn') && !$dropdownMenu.is(event.target)) {
          $dropdownMenu.removeClass("show");
          $('.language-dropdown-btn').removeClass("active");
        }
      });
    }
  });
});

// Submit contact form post data to Telegram bot
if ($("#contact-form").length) {
  $("#loading-spinner").hide();
  $("#contact-form").submit(async function (event) {
    event.preventDefault();

    const name = $("#your-name").val();
    const email = $("#your-email").val();
    const message = $("#your-message").val();
    const url = $("#your-url").val();
    const notification = $("#notification");

    if (!name || !email || !message) {
      return;
    }

    var contactHasTurnstile = $("#contact-form").find(".cf-turnstile").length > 0;
    var storedContactTurnstileToken = null;
    if (contactHasTurnstile) {
      storedContactTurnstileToken = sessionStorage.getItem("contactTurnstileToken");
      if (!storedContactTurnstileToken) {
        var turnstileRequiredMsg = $('script[data-domain]').data('contactTurnstileRequired');
        if (turnstileRequiredMsg && notification.length) {
          notification.text(turnstileRequiredMsg).removeClass('success').addClass('error').show();
          setTimeout(function () {
            notification.fadeOut();
          }, 5000);
        }
        return;
      }
    }

    var _appData = window.appData || {};
    const currentLang = _appData.langName || '';
    const currentWebsite = _appData.currentWebsite || '';
    const clientIP = _appData.clientIP || '';
    const clientLocation = _appData.clientLocation || '';

    const submitButton = $(".submit-button");
    const submitText = $("#submit-text");
    const loadingSpinner = $("#loading-spinner");
    var $mainScriptTag = $('script[data-domain]');
    var contactSuccessText = $mainScriptTag.data('contactSuccess');
    var contactErrorText = $mainScriptTag.data('contactError');

    submitButton.prop('disabled', true);
    submitText.hide();
    loadingSpinner.show();

    let response;

    try {
      const formData = new FormData();
      formData.append('action', 'send_telegram');
      formData.append('name', name);
      formData.append('email', email);
      formData.append('message', message);
      formData.append('url', url);
      formData.append('langName', currentLang);
      formData.append('currentWebsite', currentWebsite);
      formData.append('clientIP', clientIP);
      formData.append('clientLocation', clientLocation);

      if (contactHasTurnstile && storedContactTurnstileToken) {
        formData.append("cf-turnstile-response", storedContactTurnstileToken);
      }

      const _abortCtl = ('AbortController' in window) ? new AbortController() : null;
      const _abortTm = _abortCtl ? setTimeout(function () { _abortCtl.abort(); }, 30000) : null;
      try {
        response = await fetch(window.location.href, {
          method: "POST",
          body: formData,
          signal: _abortCtl ? _abortCtl.signal : undefined
        });
      } finally {
        if (_abortTm) clearTimeout(_abortTm);
      }

      const result = await response.json();

      if (response.ok && result.success) {
        notification.text(contactSuccessText);
        notification.removeClass("error").addClass("success");
        $("#contact-form")[0].reset();
        if (contactHasTurnstile && typeof turnstile !== "undefined") {
          sessionStorage.removeItem("contactTurnstileToken");
          if (window.__contactTurnstileWidgetId != null) {
            turnstile.reset(window.__contactTurnstileWidgetId);
          } else {
            turnstile.reset();
          }
          $("#contact-form .submit-button").prop("disabled", true).css({ opacity: "0.5", cursor: "not-allowed" });
        }
      } else {
        const errorMsg = result.error || contactErrorText;
        notification.text(errorMsg);
        notification.removeClass("success").addClass("error");
      }
    } catch (error) {
      notification.text(contactErrorText);
      notification.removeClass("success").addClass("error");
    } finally {
      submitButton.prop('disabled', false);
      submitText.show();
      loadingSpinner.hide();
      notification.show();
      setTimeout(function () {
        notification.fadeOut();
      }, 5000);
    }
  });
}

function toggleDropdown(element) {
  $(element).find('.caret').toggleClass('arrowUp')
  $(element).next().slideToggle();
}

/**
 * Maintenance Mode JavaScript
 * Disables all interactions when maintenance mode is active
 */
(function () {
  'use strict';

  // Only run if maintenance mode is active
  if (!$('body').hasClass('maintenance-active')) {
    return;
  }

  // Wait for jQuery to be available
  function initMaintenance() {
    if (typeof jQuery === 'undefined') {
      setTimeout(initMaintenance, 50);
      return;
    }

    var $ = jQuery;

    // Disable all interactions
    $('body').css({
      'overflow': 'hidden',
      'pointer-events': 'none'
    });

    // Prevent all clicks outside maintenance overlay — vanilla DOM (5-10x faster than jQuery)
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.maintenance-overlay')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    }, true);

    // Prevent form submissions
    $(document).on('submit', function (e) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    });

    // Block keyboard events (except F12 for dev tools)
    $(document).on('keydown', function (e) {
      if (e.key !== 'F12') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      }
    });

    // Disable all form inputs outside maintenance overlay
    $('input, textarea, select, button, a').not('.maintenance-overlay *').each(function () {
      var $el = $(this);
      $el.css('pointer-events', 'none').prop('disabled', true);
      if ($el.is('a')) {
        $el.attr('href', 'javascript:void(0)');
      }
    });
  }

  // Start initialization
  initMaintenance();
})();