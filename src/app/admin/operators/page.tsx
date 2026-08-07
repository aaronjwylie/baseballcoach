import { redirect } from "next/navigation";

/** Operators defaults to everyone — the kinds are filters over one list. */
export default function OperatorsIndex() {
  redirect("/admin/operators/all");
}
