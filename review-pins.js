/* Комментарии с привязкой к месту на странице прототипа. */
(function () {
  var state = {
    key: 'review-pins', items: [], onChange: null, mode: false, inited: false,
    current: null, dragging: null, layer: null, popup: null, button: null, tip: null,
    skip: '#ed-bar,#ed-hint,#rp-pop,#rp-layer,#rp-btn,.rp-pin,.rp-skip'
  };

  var clean = (function () {
    try {
      var params = new URLSearchParams(location.search);
      return params.has('clean') || location.hash === '#clean';
    } catch (error) {
      return false;
    }
  })();

  var css = ''
    + '#rp-layer{position:absolute;left:0;top:0;width:100%;height:0;z-index:998;pointer-events:none}'
    + '.rp-pin{position:absolute;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:#ffe14a;color:#0c0c0c;border:2px solid #0c0c0c;box-shadow:0 6px 18px rgba(0,0,0,.45);font:700 12px/24px system-ui,-apple-system,sans-serif;text-align:center;cursor:grab;pointer-events:auto;user-select:none;transition:transform .12s}'
    + '.rp-pin:hover{transform:translate(-50%,-50%) scale(1.15)}'
    + '.rp-pin.drag{cursor:grabbing;transform:translate(-50%,-50%) scale(1.15)}'
    + '.rp-pin.empty{background:#fff}'
    + 'body.rp-mode{cursor:crosshair}'
    + 'body.rp-mode a,body.rp-mode button,body.rp-mode input,body.rp-mode textarea{cursor:crosshair}'
    + '#rp-pop{position:absolute;z-index:1001;width:330px;max-width:calc(100vw - 24px);display:none;padding:12px;border-radius:14px;background:#fff;color:#0c0c0c;box-shadow:0 18px 50px rgba(0,0,0,.5);font-family:system-ui,-apple-system,sans-serif}'
    + '#rp-pop.on{display:block}'
    + '#rp-pop .rp-title{margin-bottom:6px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;opacity:.55}'
    + '#rp-pop .rp-near{max-height:56px;overflow:hidden;margin-bottom:8px;padding:6px 8px;border-radius:8px;background:#f4f4f4;font-size:12px;line-height:1.45}'
    + '#rp-pop textarea{box-sizing:border-box;width:100%;min-height:86px;padding:9px 10px;resize:vertical;border:1.5px solid #ddd;border-radius:10px;background:#fff;color:#0c0c0c;font:14px/1.45 system-ui,-apple-system,sans-serif}'
    + '#rp-pop textarea:focus{outline:none;border-color:#0c0c0c}'
    + '#rp-pop .rp-footer{display:flex;align-items:center;gap:8px;margin-top:9px}'
    + '#rp-pop button{padding:8px 12px;border:0;border-radius:9px;background:#eee;color:#0c0c0c;font-size:13px;font-weight:700;cursor:pointer}'
    + '#rp-pop .rp-save{background:#0c0c0c;color:#fff}'
    + '#rp-pop .rp-delete{margin-left:auto;background:transparent;color:#c8500a}'
    + '#rp-tip{position:fixed;left:50%;top:14px;z-index:1001;display:none;transform:translateX(-50%);padding:9px 16px;border:1px solid rgba(255,255,255,.2);border-radius:999px;background:rgba(12,12,12,.92);color:#fff;font:600 13px system-ui,-apple-system,sans-serif;pointer-events:none}'
    + '#rp-tip.on{display:block}#rp-tip b{color:#ffe14a}'
    + '#rp-btn.on{background:#ffe14a!important}'
    + '@media(max-width:640px){#rp-pop{width:calc(100vw - 24px)}}';

  function inSkip(element) {
    return !!(element && element.closest && element.closest(state.skip));
  }

  function escapeHtml(value) {
    return (value || '').replace(/[<>&]/g, function (char) {
      return {'<': '&lt;', '>': '&gt;', '&': '&amp;'}[char];
    });
  }

  function persist() {
    try { localStorage.setItem(state.key, JSON.stringify(state.items)); } catch (error) {}
    if (state.onChange) {
      try { state.onChange(); } catch (error) {}
    }
  }

  var anchorSelector = '[id],[data-blk],section,header,footer,article,main';

  function tagAnchors() {
    var anchors = document.querySelectorAll(anchorSelector);
    for (var index = 0; index < anchors.length; index += 1) {
      if (!anchors[index].hasAttribute('data-rp')) anchors[index].setAttribute('data-rp', 'rp' + index);
    }
  }

  function anchorOf(element) {
    if (!element || element === document.body) return document.body;
    return element.closest ? (element.closest(anchorSelector) || document.body) : document.body;
  }

  function keyOf(anchor) {
    if (anchor === document.body) return 'body';
    return anchor.id ? '#' + anchor.id : (anchor.getAttribute('data-rp') || 'body');
  }

  function resolve(pin) {
    var anchor = null;
    if (pin.anchor === 'body') anchor = document.body;
    if (!anchor && pin.anchor && pin.anchor.charAt(0) === '#') {
      try { anchor = document.querySelector(pin.anchor); } catch (error) { anchor = null; }
    }
    if (!anchor && pin.rp) anchor = document.querySelector('[data-rp="' + pin.rp + '"]');
    return anchor || document.body;
  }

  function isVisible(element) {
    if (element === document.body) return true;
    if (!element.offsetParent && getComputedStyle(element).position !== 'fixed') return false;
    var rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function nearbyText(element) {
    var textElement = element && element.closest ? (element.closest('[data-olabel],p,li,h1,h2,h3,h4,button,a') || element) : element;
    var text = textElement && textElement.textContent ? textElement.textContent.replace(/\s+/g, ' ').trim() : '';
    return text.slice(0, 140);
  }

  function blockLabel(element) {
    var block = element && element.closest ? element.closest('[data-blk],section[id],[id]') : null;
    return block ? (block.getAttribute('data-blk') || block.id || 'страница') : 'страница';
  }

  function buildUi() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    state.layer = document.createElement('div');
    state.layer.id = 'rp-layer';
    document.body.appendChild(state.layer);

    state.popup = document.createElement('div');
    state.popup.id = 'rp-pop';
    state.popup.innerHTML = '<div class="rp-title"></div><div class="rp-near"></div>'
      + '<textarea placeholder="Что поправить в этом месте?"></textarea>'
      + '<div class="rp-footer"><button class="rp-save">Готово</button><button class="rp-cancel">Отмена</button><button class="rp-delete">Удалить</button></div>';
    document.body.appendChild(state.popup);

    state.tip = document.createElement('div');
    state.tip.id = 'rp-tip';
    state.tip.innerHTML = 'Кликни в любом месте страницы, чтобы оставить комментарий. <b>Esc</b>, выйти';
    document.body.appendChild(state.tip);

    state.button = document.createElement('button');
    state.button.id = 'rp-btn';
    state.button.type = 'button';
    state.button.textContent = 'Комментарий к месту';
    var bar = document.getElementById('ed-bar');
    if (bar) bar.insertBefore(state.button, bar.querySelector('#ed-save') || null);

    state.button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      setMode(!state.mode);
    });
    state.popup.querySelector('.rp-save').onclick = commit;
    state.popup.querySelector('.rp-cancel').onclick = function () { closePopup(true); };
    state.popup.querySelector('.rp-delete').onclick = function () {
      if (state.current) remove(state.current.id);
      closePopup();
    };
    state.popup.querySelector('textarea').addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePopup(true);
      }
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        commit();
      }
    });
  }

  function setMode(on) {
    state.mode = !!on;
    if (state.mode) document.dispatchEvent(new CustomEvent('reviewpins:modechange', {detail: {on: true}}));
    document.body.classList.toggle('rp-mode', state.mode);
    state.tip.classList.toggle('on', state.mode);
    state.button.classList.toggle('on', state.mode);
    state.button.textContent = state.mode ? 'Выбери место' : 'Комментарий к месту';
  }

  function openPopup(pin) {
    state.current = pin;
    var anchor = resolve(pin);
    var rect = anchor.getBoundingClientRect();
    var x = rect.left + window.scrollX + pin.x * rect.width;
    var y = rect.top + window.scrollY + pin.y * rect.height;
    state.popup.querySelector('.rp-title').textContent = 'Комментарий №' + (state.items.indexOf(pin) + 1) + ' · ' + (pin.label || '');
    var near = state.popup.querySelector('.rp-near');
    if (pin.near) {
      near.hidden = false;
      near.innerHTML = 'Рядом: ' + escapeHtml(pin.near);
    } else {
      near.hidden = true;
      near.textContent = '';
    }
    var textarea = state.popup.querySelector('textarea');
    textarea.value = pin.text || '';
    state.popup.querySelector('.rp-delete').hidden = !pin.text;
    state.popup.classList.add('on');
    var maxLeft = window.scrollX + document.documentElement.clientWidth - state.popup.offsetWidth - 12;
    state.popup.style.left = Math.max(window.scrollX + 12, Math.min(x + 18, maxLeft)) + 'px';
    var popupHeight = state.popup.offsetHeight;
    var viewportTop = window.scrollY + 12;
    var viewportBottom = window.scrollY + window.innerHeight - 12;
    var top = y + 18;
    if (top + popupHeight > viewportBottom) top = y - 18 - popupHeight;
    if (top < viewportTop || top + popupHeight > viewportBottom) top = Math.max(viewportTop, viewportBottom - popupHeight);
    state.popup.style.top = top + 'px';
    setTimeout(function () { textarea.focus(); }, 30);
  }

  function closePopup(dropEmpty) {
    if (dropEmpty && state.current && !state.current.text) remove(state.current.id, true);
    state.popup.classList.remove('on');
    state.current = null;
    render();
  }

  function commit() {
    if (!state.current) return;
    var text = state.popup.querySelector('textarea').value.trim();
    if (text) state.current.text = text;
    else remove(state.current.id, true);
    state.popup.classList.remove('on');
    state.current = null;
    persist();
    render();
  }

  function remove(id, silent) {
    state.items = state.items.filter(function (pin) { return pin.id !== id; });
    if (silent) {
      try { localStorage.setItem(state.key, JSON.stringify(state.items)); } catch (error) {}
    } else {
      persist();
    }
    render();
  }

  function add(clientX, clientY) {
    var hit = document.elementFromPoint(clientX, clientY);
    if (inSkip(hit)) return;
    var anchor = anchorOf(hit);
    var rect = anchor.getBoundingClientRect();
    var pin = {
      id: 'p' + Date.now() + Math.floor(Math.random() * 1000),
      anchor: keyOf(anchor),
      rp: anchor.getAttribute ? (anchor.getAttribute('data-rp') || '') : '',
      x: rect.width ? (clientX - rect.left) / rect.width : 0,
      y: rect.height ? (clientY - rect.top) / rect.height : 0,
      near: nearbyText(hit),
      label: blockLabel(hit),
      text: '',
      createdAt: new Date().toISOString()
    };
    state.items.push(pin);
    render();
    openPopup(pin);
  }

  function render() {
    if (!state.layer) return;
    state.layer.innerHTML = '';
    state.layer.style.height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) + 'px';
    state.items.forEach(function (pin, index) {
      var anchor = resolve(pin);
      if (!isVisible(anchor)) return;
      var rect = anchor.getBoundingClientRect();
      var marker = document.createElement('div');
      marker.className = 'rp-pin' + (pin.text ? '' : ' empty');
      marker.textContent = String(index + 1);
      marker.title = pin.text || 'Комментарий без текста';
      marker.dataset.pid = pin.id;
      marker.style.left = (rect.left + window.scrollX + pin.x * rect.width) + 'px';
      marker.style.top = (rect.top + window.scrollY + pin.y * rect.height) + 'px';
      state.layer.appendChild(marker);
    });
  }

  function pinById(id) {
    return state.items.find(function (pin) { return pin.id === id; }) || null;
  }

  function contentAt(x, y) {
    var display = state.layer.style.display;
    state.layer.style.display = 'none';
    try {
      return document.elementFromPoint(x, y);
    } finally {
      state.layer.style.display = display;
    }
  }

  function wire() {
    document.addEventListener('click', function (event) {
      if (inSkip(event.target)) return;
      if (event.altKey || state.mode) {
        event.preventDefault();
        event.stopPropagation();
        add(event.clientX, event.clientY);
      }
    }, true);

    document.addEventListener('mousedown', function (event) {
      var marker = event.target.closest ? event.target.closest('.rp-pin') : null;
      if (!marker) {
        if (state.popup.classList.contains('on') && !event.target.closest('#rp-pop')) closePopup(true);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      state.dragging = {element: marker, pin: pinById(marker.dataset.pid), startX: event.clientX, startY: event.clientY, moved: false};
    }, true);

    document.addEventListener('mousemove', function (event) {
      var drag = state.dragging;
      if (!drag) return;
      if (!drag.moved && Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) < 4) return;
      drag.moved = true;
      drag.element.classList.add('drag');
      drag.element.style.pointerEvents = 'none';
      drag.element.style.left = (event.clientX + window.scrollX) + 'px';
      drag.element.style.top = (event.clientY + window.scrollY) + 'px';
    });

    document.addEventListener('mouseup', function (event) {
      var drag = state.dragging;
      if (!drag) return;
      state.dragging = null;
      drag.element.classList.remove('drag');
      drag.element.style.pointerEvents = '';
      if (!drag.moved) {
        openPopup(drag.pin);
        return;
      }
      var hit = contentAt(event.clientX, event.clientY);
      if (!hit || inSkip(hit)) {
        render();
        return;
      }
      var anchor = anchorOf(hit);
      var rect = anchor.getBoundingClientRect();
      drag.pin.anchor = keyOf(anchor);
      drag.pin.rp = anchor.getAttribute ? (anchor.getAttribute('data-rp') || '') : '';
      drag.pin.x = rect.width ? (event.clientX - rect.left) / rect.width : 0;
      drag.pin.y = rect.height ? (event.clientY - rect.top) / rect.height : 0;
      drag.pin.near = nearbyText(hit);
      drag.pin.label = blockLabel(hit);
      persist();
      render();
    });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      if (state.popup.classList.contains('on')) closePopup(true);
      else if (state.mode) setMode(false);
    });

    var timer = null;
    function relayout() {
      if (state.mode && document.body.classList.contains('ed-on')) setMode(false);
      clearTimeout(timer);
      timer = setTimeout(render, 120);
    }
    window.addEventListener('resize', relayout);
    window.addEventListener('load', relayout);
    new MutationObserver(relayout).observe(document.body, {attributes: true, attributeFilter: ['class']});
    if (window.ResizeObserver) new ResizeObserver(relayout).observe(document.body);
  }

  window.ReviewPins = {
    init: function (options) {
      options = options || {};
      if (clean || state.inited) return;
      state.inited = true;
      state.key = options.key || ('rp-' + location.pathname);
      if (options.skip) state.skip += ',' + options.skip;
      state.onChange = options.onChange || null;
      try { state.items = JSON.parse(localStorage.getItem(state.key) || '[]') || []; } catch (error) { state.items = []; }
      tagAnchors();
      buildUi();
      wire();
      render();
    },
    items: function () {
      return state.items.filter(function (pin) { return (pin.text || '').trim(); }).map(function (pin, index) {
        return {
          scope: 'пин', n: index + 1, block: pin.label || '', anchor: pin.anchor || '', near: pin.near || '',
          x: +(pin.x || 0).toFixed(3), y: +(pin.y || 0).toFixed(3), text: pin.text.trim()
        };
      });
    },
    count: function () { return this.items().length; },
    restore: function (comments) {
      state.items = comments.map(function (pin, index) {
        return {
          id: 'saved-' + index, anchor: pin.anchor || 'body',
          x: pin.x || 0, y: pin.y || 0, near: pin.near || '',
          label: pin.block || '', text: pin.text || ''
        };
      });
      try { localStorage.setItem(state.key, JSON.stringify(state.items)); } catch (error) {}
      render();
    },
    clear: function () {
      state.items = [];
      try { localStorage.removeItem(state.key); } catch (error) {}
      render();
    },
    goto: function (number) {
      var list = state.items.filter(function (pin) { return (pin.text || '').trim(); });
      var pin = list[number - 1];
      if (!pin) return;
      var anchor = resolve(pin);
      if (!isVisible(anchor)) return;
      anchor.scrollIntoView({block: 'center'});
      setTimeout(render, 300);
    },
    render: render
  };
})();
