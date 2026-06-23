// Automation engine (spec §5.8). Rules are stored per ServiceVersion as JSON and run
// synchronously inside server actions (no cron). This module is PURE: it decides what
// actions to take; the caller persists them. That keeps it unit-testable.

export type AutomationEvent = "service_line_added" | "task_completed" | "field_condition";

export interface AutomationRule {
  event: AutomationEvent;
  // optional condition on an input/form field: field == value
  ifField?: string;
  ifEquals?: string | number;
  // THEN action:
  action: "create_task" | "create_followup" | "create_issue" | "add_checklist";
  taskName?: string;
  requiredRoleKey?: string;
  followupDays?: number; // for create_followup
  issueTitle?: string;
  checklistTemplateId?: string;
}

export interface AutomationContext {
  event: AutomationEvent;
  fields?: Record<string, unknown>; // service line inputs / form values
}

export interface PlannedAction {
  type: AutomationRule["action"];
  taskName?: string;
  requiredRoleKey?: string;
  dueInDays?: number;
  issueTitle?: string;
  checklistTemplateId?: string;
}

function conditionMatches(rule: AutomationRule, ctx: AutomationContext): boolean {
  if (!rule.ifField) return true;
  const actual = ctx.fields?.[rule.ifField];
  // Loose compare so "2" == 2 works for form inputs.
  return String(actual ?? "") === String(rule.ifEquals ?? "");
}

/** Given a set of rules and an event context, return the actions that should run. */
export function planAutomations(rules: AutomationRule[], ctx: AutomationContext): PlannedAction[] {
  const out: PlannedAction[] = [];
  for (const rule of rules) {
    if (rule.event !== ctx.event) continue;
    if (!conditionMatches(rule, ctx)) continue;
    switch (rule.action) {
      case "create_task":
        out.push({ type: "create_task", taskName: rule.taskName || "Automated task", requiredRoleKey: rule.requiredRoleKey });
        break;
      case "create_followup":
        out.push({ type: "create_followup", taskName: rule.taskName || "Follow-up", dueInDays: rule.followupDays ?? 7, requiredRoleKey: rule.requiredRoleKey });
        break;
      case "create_issue":
        out.push({ type: "create_issue", issueTitle: rule.issueTitle || "Automated issue" });
        break;
      case "add_checklist":
        out.push({ type: "add_checklist", checklistTemplateId: rule.checklistTemplateId });
        break;
    }
  }
  return out;
}

export function parseRules(json: string | null | undefined): AutomationRule[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? (arr as AutomationRule[]) : [];
  } catch {
    return [];
  }
}
