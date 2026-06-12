import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

interface PillarStubProps {
  pillar: string;
  surface: string;
  description: string;
  baseFeatures?: string[];
  primaryMode?: "mobile" | "desktop" | "both";
  className?: string;
}

/**
 * Standard placeholder rendered while a pillar surface is unbuilt.
 *
 * Lists the v1 base-package features for that surface so the team can see
 * what's coming, and so design reviews have something concrete to react to.
 */
export function PillarStub({
  pillar,
  surface,
  description,
  baseFeatures = [],
  primaryMode = "both",
  className,
}: PillarStubProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-700/70 dark:text-brand-200/70">{pillar}</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink sm:text-3xl dark:text-cream-100">
            {surface}
          </h1>
          <p className="mt-2 text-base text-ink-muted dark:text-cream-400">{description}</p>
        </div>
        <Badge tone="brand">v1 core</Badge>
      </div>

      {baseFeatures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>What's shipping</CardTitle>
          </CardHeader>
          <CardBody>
            <ul className="space-y-2">
              {baseFeatures.map((feature) => (
                <li
                  key={feature}
                  className="flex gap-2 text-sm text-ink dark:text-cream-100"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="text-sm text-ink-muted dark:text-cream-400">
          <p>
            <span className="font-medium text-ink dark:text-cream-100">Status:</span> scaffold
            placeholder. Real implementation lands during the relevant build phase.
          </p>
          {primaryMode !== "both" && (
            <p className="mt-1">
              <span className="font-medium text-ink dark:text-cream-100">Primary surface:</span>{" "}
              {primaryMode === "mobile" ? "Mobile PWA" : "Desktop ERP"}.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
