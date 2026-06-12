import { PillarStub } from "@/components/ui/pillar-stub";

export const metadata = { title: "Leads" };

export default function LeadsPage() {
  return (
    <PillarStub
      pillar="Sales"
      surface="Sales Prospect CRM"
      description="Lead tracker for incoming customers who haven't bought yet."
      baseFeatures={[
        "Lead card: name, phone, channel, interest, value estimate",
        "Statuses: New → Contacted → Negotiating → Won → Lost",
        "Notes timeline per lead",
        "Lead → Won → POS one-tap flow",
        "Convert to Customer (Marketing CRM)",
      ]}
    />
  );
}
