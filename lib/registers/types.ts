export type RegisterKind = "lockers" | "keys";
export type AccessArea = RegisterKind | "issues";
export type AccessLevel = "none" | "view" | "edit";

export type RegisterRow = {
  item_id: number;
  item_number: string;
  item_group: string | null;
  item_notes: string | null;
  is_active: boolean;
  assignment_id: number | null;
  wasra_number: number | null;
  holder_name: string | null;
  assigned_on: string | null;
  assignment_notes: string | null;
  deposit_amount: number | null;
  condition: string | null;
};

export type HistoryRow = {
  item_id: number;
  assignment_id: number;
  wasra_number: number | null;
  holder_name: string | null;
  assigned_on: string;
  returned_on: string | null;
  notes: string | null;
  deposit_amount: number | null;
  condition: string | null;
};

export type RpcResult = { outcome: string; message: string };

export const REGISTER_CONFIG = {
  lockers: {
    title: "Locker Register",
    singular: "locker",
    plural: "lockers",
    registerView: "app_locker_register",
    historyView: "app_locker_history",
    groupLabel: "Location",
    numberLabel: "Locker number",
    issueVerb: "Assign",
    returnVerb: "Return",
    path: "/admin/lockers",
  },
  keys: {
    title: "Key Register",
    singular: "key",
    plural: "keys",
    registerView: "app_key_register",
    historyView: "app_key_history",
    groupLabel: "Key type",
    numberLabel: "Key number",
    issueVerb: "Issue",
    returnVerb: "Return",
    path: "/admin/keys",
  },
} as const;

export function formatDate(value: string | null) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
