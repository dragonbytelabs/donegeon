import type { CardDef, CardEntity } from "@cleartify/core";
import { uid } from "@cleartify/core";

export const workflowDefs: Record<string, CardDef> = {
  // Event / Trigger
  "event.create_user_submission": {
    id: "event.create_user_submission",
    kind: "event",
    title: "Create User",
    icon: "📝",
    skinClass: "sl-kind-quest",
    leftBadge: "1",
  },

  // Agent
  "agent.ai_tools": {
    id: "agent.ai_tools",
    kind: "agent",
    title: "AI Agent",
    icon: "🤖",
    skinClass: "sl-kind-blank",
    leftBadge: "AGENT",
  },

  // Rule
  "rule.is_manager": {
    id: "rule.is_manager",
    kind: "rule",
    title: "Is Manager?",
    icon: "⎇",
    skinClass: "sl-kind-stone",
    leftBadge: "RULE",
    rightBadge: "T/F",
  },

  // Integrations
  "integration.slack": {
    id: "integration.slack",
    kind: "integration",
    title: "Slack",
    icon: "💬",
    skinClass: "sl-kind-coin",
    leftBadge: "TOOL",
  },
  "integration.entra": {
    id: "integration.entra",
    kind: "integration",
    title: "Entra ID",
    icon: "🧩",
    skinClass: "sl-kind-wood",
    leftBadge: "TOOL",
  },
  "integration.jira": {
    id: "integration.jira",
    kind: "integration",
    title: "Jira",
    icon: "🎫",
    skinClass: "sl-kind-food",
    leftBadge: "TOOL",
  },

  // Actions
  "action.invite_slack_channel": {
    id: "action.invite_slack_channel",
    kind: "action",
    title: "Invite",
    icon: "➕",
    skinClass: "sl-kind-quest",
    leftBadge: "ACT",
  },
  "action.update_slack_profile": {
    id: "action.update_slack_profile",
    kind: "action",
    title: "Update Profile",
    icon: "✏️",
    skinClass: "sl-kind-quest",
    leftBadge: "ACT",
  },

  // Memory
  "memory.state_db": {
    id: "memory.state_db",
    kind: "memory",
    title: "State DB",
    icon: "🗄️",
    skinClass: "sl-kind-stone",
    leftBadge: "MEM",
  },
};

export function spawn(defId: keyof typeof workflowDefs, data: Record<string, unknown> = {}) {
  const defs = workflowDefs[defId];
  if(!defs) {
    throw new Error(`Unknown card defs ID: ${defId}`);
  }

  return new CardEntity(uid("card"), defs, data);
}
