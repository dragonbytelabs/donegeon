export type ActionType =
  | "event.formSubmit"
  | "agent.ai"
  | "rule.ifElse"
  | "tool.entraLookup"
  | "tool.jiraCreateUser"
  | "action.slackInvite"
  | "action.slackUpdateProfile"
  | "memory.postgres";

export type Port = {
  id: string;
  side: "left" | "right" | "top" | "bottom";
  label?: string; // e.g. "true", "false"
};

export type CardDef = {
  id: string;
  title: string;
  icon: string;
  kindClass: string; // your sl-kind-* class
  ports: Port[];
  actions: { type: ActionType; config?: any }[];
};
