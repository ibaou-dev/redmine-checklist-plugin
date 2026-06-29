/* Redmine Checklist plugin — progressive enhancement
 * Depends on: jQuery 3.7.1 + jQuery UI 1.13.3 (both bundled by Redmine 6.x)
 * Rails UJS (rails-ujs) is also available via Redmine.
 */
(function ($) {
  'use strict';

  /* -----------------------------------------------------------------------
   * Helper: read CSRF token from meta tag
   * --------------------------------------------------------------------- */
  function csrfToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') : '';
  }

  /* -----------------------------------------------------------------------
   * submitAddForm — set is_section flag then fire the Rails UJS remote form.
   * Rails UJS listens to native DOM 'submit' events, not jQuery's synthetic
   * ones. We use Rails.fire() when available (Rails UJS exposes it globally),
   * otherwise fall back to dispatching a native Event.
   * --------------------------------------------------------------------- */
  function submitAddForm(form, isSection) {
    var sFlag = document.getElementById('checklist-is-section');
    if (!sFlag) return;
    sFlag.value = isSection ? '1' : '0';

    // Rails UJS (rails-ujs gem, loaded by Redmine) exposes Rails.fire()
    // which dispatches a real DOM event and handles remote forms correctly.
    if (window.Rails && typeof window.Rails.fire === 'function') {
      window.Rails.fire(form, 'submit');
    } else {
      // Fallback: dispatch a native submit event (bubbles, cancelable)
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }

  /* -----------------------------------------------------------------------
   * wireInlineEdit — attach inline-edit handler to a single .checklist-edit
   * control inside a given <li>
   * --------------------------------------------------------------------- */
  function wireInlineEdit(li) {
    var editBtn = li.querySelector('.checklist-edit');
    if (!editBtn) return;

    editBtn.addEventListener('click', function (e) {
      e.preventDefault();

      // Find the text/label span
      var textSpan = li.querySelector('.checklist-item-text, .checklist-section-label');
      if (!textSpan) return;

      // If already editing, bail
      if (li.querySelector('.checklist-edit-input')) return;

      var originalText = textSpan.textContent;
      var updateUrl    = editBtn.dataset.url;

      // Build inline input
      var inp = document.createElement('input');
      inp.type  = 'text';
      inp.value = originalText;
      inp.className = 'checklist-edit-input';

      // Replace the text span with the input
      textSpan.replaceWith(inp);
      // Also hide the actions while editing so we don't double-trigger
      var actions = li.querySelector('.checklist-item-actions');
      if (actions) actions.style.opacity = '0';

      inp.focus();
      inp.select();

      function cancel() {
        // Restore original text span
        var restoredSpan = document.createElement('span');
        restoredSpan.className = textSpan.className;
        restoredSpan.textContent = originalText;
        inp.replaceWith(restoredSpan);
        if (actions) actions.style.opacity = '';
      }

      function save() {
        var newSubject = inp.value.trim();
        if (!newSubject || newSubject === originalText) {
          cancel();
          return;
        }

        $.ajax({
          url:      updateUrl,
          type:     'PATCH',
          data:     { 'checklist_item[subject]': newSubject },
          headers:  { 'X-CSRF-Token': csrfToken() },
          dataType: 'script'
          // update.js.erb will replace the <li> with a freshly rendered row
          // (including new wireInlineEdit via initChecklistRow)
        });
      }

      inp.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          save();
        } else if (ev.key === 'Escape') {
          cancel();
        }
      });

      inp.addEventListener('blur', function () {
        // Slight delay so click on another control doesn't double-fire
        setTimeout(function () {
          if (li.querySelector('.checklist-edit-input')) save();
        }, 150);
      });
    });
  }

  /* -----------------------------------------------------------------------
   * initChecklistRow — wire up a single <li> after insert/replace
   * --------------------------------------------------------------------- */
  window.initChecklistRow = function (li) {
    if (!li) return;
    var panel = document.getElementById('checklist-panel');
    if (!panel) return;
    var canDone = panel.dataset.canDone === 'true';

    // Done checkbox → AJAX PATCH to :done action
    var cb = li.querySelector('.checklist-checkbox');
    if (cb && canDone) {
      $(cb).off('change.checklist').on('change.checklist', function () {
        $.ajax({
          url:    cb.dataset.url,
          type:   'PATCH',
          data:   { 'checklist_item[is_done]': cb.checked ? '1' : '0' },
          headers: { 'X-CSRF-Token': csrfToken() },
          dataType: 'script'
        });
      });
    }

    // Inline edit
    wireInlineEdit(li);
  };

  /* -----------------------------------------------------------------------
   * initChecklist — set up the whole checklist panel
   * --------------------------------------------------------------------- */
  function initChecklist(panel) {
    if (!panel) return;

    var canManage  = panel.dataset.canManage  === 'true';
    var reorderUrl = panel.dataset.reorderUrl || '';

    /* --- Wire existing rows -------------------------------------------- */
    panel.querySelectorAll('.checklist-item').forEach(function (li) {
      initChecklistRow(li);
    });

    /* --- Add-item / Add-section two-button form ------------------------- */
    var form = document.getElementById('checklist-add-form');
    if (form && canManage) {
      var input       = form.querySelector('.checklist-new-item-input');
      var addItemBtn  = document.getElementById('checklist-add-item-btn');
      var addSectBtn  = document.getElementById('checklist-add-section-btn');

      // "Add item" button OR pressing Enter in the input → item (is_section=0)
      if (addItemBtn) {
        addItemBtn.addEventListener('click', function () {
          submitAddForm(form, false);
        });
      }

      // Press Enter in the text input → item
      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitAddForm(form, false);
          }
        });
      }

      // "Add section" button → section (is_section=1)
      if (addSectBtn) {
        addSectBtn.addEventListener('click', function () {
          submitAddForm(form, true);
        });
      }

      // After successful create the server returns create.js.erb which
      // appends the row, clears the input, and resets is_section to 0.
      // We re-init sortable to include the new row.
      $(form).on('ajax:success', function () {
        if (canManage) { reinitSortable(panel); }
      });
    }

    /* --- Drag-and-drop reorder (jQuery UI sortable) -------------------- */
    if (canManage && reorderUrl) {
      reinitSortable(panel);
    }
  }

  function reinitSortable(panel) {
    var list = $('#checklist-items', panel);
    if (!list.length) return;
    // Only destroy if sortable was previously initialized (prevents jQuery UI error)
    if (list.data('ui-sortable')) { list.sortable('destroy'); }
    list.sortable({
      handle: '.checklist-handle',
      axis:   'y',
      stop: function () {
        var ids = list.sortable('toArray', { attribute: 'data-id' });
        $.ajax({
          url:     panel.dataset.reorderUrl,
          type:    'POST',
          data:    { ids: ids },
          headers: { 'X-CSRF-Token': csrfToken() },
          dataType: 'script'
        });
      }
    });
  }

  /* -----------------------------------------------------------------------
   * Re-init the sortable after a bulk DOM replace (e.g. applying a template).
   * Exposed on window so .js.erb responses can call it.
   * --------------------------------------------------------------------- */
  window.reinitChecklistSortable = function () {
    var panel = document.getElementById('checklist-panel');
    if (panel && panel.dataset.canManage === 'true' && panel.dataset.reorderUrl) {
      reinitSortable(panel);
    }
  };

  /* -----------------------------------------------------------------------
   * Boot
   * --------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    initChecklist(document.getElementById('checklist-panel'));
  });

}(jQuery));
