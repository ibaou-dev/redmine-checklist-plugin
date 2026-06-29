class ChecklistProjectSetting < ApplicationRecord
  belongs_to :project

  MODES = %w[inherit enabled disabled].freeze

  validates :enforce_mode, inclusion: { in: MODES }

  # -------------------------------------------------------------------------
  # enforce_statuses serialization (JSON array of status-id strings)
  # -------------------------------------------------------------------------

  def status_ids
    return [] if enforce_statuses.blank?

    JSON.parse(enforce_statuses)
  rescue JSON::ParserError, TypeError
    []
  end

  def status_ids=(ids)
    self.enforce_statuses = Array(ids).reject(&:blank?).map(&:to_s).to_json
  end

  # -------------------------------------------------------------------------
  # Project-wins resolver
  # Returns { enabled: <bool>, status_ids: [<strings>] }
  # -------------------------------------------------------------------------

  def self.effective_for(project)
    g               = Setting.plugin_redmine_checklist
    global_enabled  = ['1', 'true', true].include?(g['enforce_mandatory'])
    global_statuses = Array(g['enforce_statuses']).reject(&:blank?).map(&:to_s)
    global_result   = { enabled: global_enabled, status_ids: global_statuses }

    return global_result if project.nil?

    rec = find_by(project_id: project.id)

    return global_result if rec.nil? || rec.enforce_mode == 'inherit'

    if rec.enforce_mode == 'disabled'
      { enabled: false, status_ids: [] }
    else
      # 'enabled'
      { enabled: true, status_ids: rec.status_ids }
    end
  end
end
