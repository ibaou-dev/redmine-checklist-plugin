/* Redmine Checklist plugin — progressive enhancement */
(function () {
  'use strict';

  function initChecklist(panel) {
    if (!panel) return;

    var issueId = panel.dataset.issueId;
    var canManage = panel.dataset.canManage === 'true';

    // Checkbox done-toggle via AJAX
    panel.querySelectorAll('.checklist-checkbox').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var url    = cb.dataset.url;
        var done   = cb.checked ? '1' : '0';
        var token  = document.querySelector('meta[name="csrf-token"]');

        fetch(url + '.js', {
          method:  'PATCH',
          headers: {
            'Content-Type':    'application/x-www-form-urlencoded',
            'X-CSRF-Token':    token ? token.content : '',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: 'checklist_item%5Bis_done%5D=' + done
        });
      });
    });

    // Multiline paste: split on newlines, submit each as separate item
    var input = panel.querySelector('.checklist-new-item-input');
    if (input && canManage) {
      input.addEventListener('paste', function (e) {
        var text = (e.clipboardData || window.clipboardData).getData('text');
        var lines = text.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
        if (lines.length <= 1) return; // single line — let default paste happen
        e.preventDefault();
        // TODO: submit lines one-by-one via AJAX (bulk-add UX)
        input.value = lines[0];
      });
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initChecklist(document.getElementById('checklist-panel'));
  });
})();
