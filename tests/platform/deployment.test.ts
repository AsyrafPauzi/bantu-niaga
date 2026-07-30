import { afterEach, describe, expect, it } from "vitest";
import {
  getDeploymentMode,
  isStandaloneDeployment,
  parseDeploymentMode,
} from "@/lib/platform/deployment";

describe("deployment mode", () => {
  const prevDeployment = process.env.DEPLOYMENT_MODE;
  const prevPublic = process.env.NEXT_PUBLIC_DEPLOYMENT_MODE;

  afterEach(() => {
    if (prevDeployment === undefined) {
      delete process.env.DEPLOYMENT_MODE;
    } else {
      process.env.DEPLOYMENT_MODE = prevDeployment;
    }
    if (prevPublic === undefined) {
      delete process.env.NEXT_PUBLIC_DEPLOYMENT_MODE;
    } else {
      process.env.NEXT_PUBLIC_DEPLOYMENT_MODE = prevPublic;
    }
  });

  it("defaults to saas", () => {
    delete process.env.DEPLOYMENT_MODE;
    delete process.env.NEXT_PUBLIC_DEPLOYMENT_MODE;
    expect(getDeploymentMode()).toBe("saas");
    expect(isStandaloneDeployment()).toBe(false);
  });

  it("parses standalone", () => {
    process.env.DEPLOYMENT_MODE = "standalone";
    expect(parseDeploymentMode("standalone")).toBe("standalone");
    expect(getDeploymentMode()).toBe("standalone");
    expect(isStandaloneDeployment()).toBe(true);
  });

  it("treats unknown values as saas", () => {
    expect(parseDeploymentMode("invalid")).toBe("saas");
  });
});
