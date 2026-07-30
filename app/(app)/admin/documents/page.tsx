import { redirect } from "next/navigation";

export const metadata = { title: "Documents" };

/** Document templates are a marketplace add-on — not in core v1. Send users to Storage. */
export default function DocumentsPage() {
  redirect("/admin/storage");
}
