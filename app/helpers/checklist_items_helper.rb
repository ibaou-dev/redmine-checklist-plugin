module ChecklistItemsHelper
  def checklist_progress(issue)
    items = issue.checklist_items
    return nil if items.empty?

    done  = items.done.count
    total = items.count
    pct   = (done.to_f / total * 100).round

    { done: done, total: total, percent: pct }
  end
end
