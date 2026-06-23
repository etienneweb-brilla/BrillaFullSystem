import { describe, it, expect } from "vitest";
import { planAutomations, parseRules, type AutomationRule } from "./automation";

describe("planAutomations", () => {
  it("fires a create_task rule on the matching event", () => {
    const rules: AutomationRule[] = [
      { event: "service_line_added", action: "create_task", taskName: "Inspect", requiredRoleKey: "supervisor" },
    ];
    const actions = planAutomations(rules, { event: "service_line_added" });
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: "create_task", taskName: "Inspect", requiredRoleKey: "supervisor" });
  });

  it("ignores rules for other events", () => {
    const rules: AutomationRule[] = [{ event: "task_completed", action: "create_issue", issueTitle: "x" }];
    expect(planAutomations(rules, { event: "service_line_added" })).toHaveLength(0);
  });

  it("respects field conditions", () => {
    const rules: AutomationRule[] = [
      { event: "service_line_added", ifField: "laundry", ifEquals: "yes", action: "create_task", taskName: "Collect laundry" },
    ];
    expect(planAutomations(rules, { event: "service_line_added", fields: { laundry: "no" } })).toHaveLength(0);
    expect(planAutomations(rules, { event: "service_line_added", fields: { laundry: "yes" } })).toHaveLength(1);
  });

  it("create_followup carries the due offset", () => {
    const rules: AutomationRule[] = [{ event: "task_completed", action: "create_followup", followupDays: 14 }];
    const [a] = planAutomations(rules, { event: "task_completed" });
    expect(a.type).toBe("create_followup");
    expect(a.dueInDays).toBe(14);
  });

  it("loose-compares numbers and strings", () => {
    const rules: AutomationRule[] = [
      { event: "field_condition", ifField: "manpower", ifEquals: 2, action: "create_issue", issueTitle: "two" },
    ];
    expect(planAutomations(rules, { event: "field_condition", fields: { manpower: "2" } })).toHaveLength(1);
  });
});

describe("parseRules", () => {
  it("returns [] on bad input", () => {
    expect(parseRules("not json")).toEqual([]);
    expect(parseRules(null)).toEqual([]);
  });
});
