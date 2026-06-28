module RedmineChecklist
  module Patches
    module IssuePatch
      def self.included(base)
        base.has_many :checklist_items, -> { order(:position) },
                      dependent: :destroy,
                      foreign_key: :issue_id
      end
    end
  end
end

Issue.include RedmineChecklist::Patches::IssuePatch
