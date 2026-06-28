module ChecklistItemsHelper
  # Returns progress hash {done:, total:, percent:} counting tasks only
  # (sections excluded). Delegates to the model so the same logic is available
  # both in helper-aware views and in the issue-show hook context.
  def checklist_progress(issue)
    issue.checklist_progress_stats
  end
end
