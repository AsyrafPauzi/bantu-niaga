import { describe, expect, it } from "vitest";
import { paginateArray, parsePagination, totalPages } from "@/lib/pagination";

describe("pagination", () => {
  it("parses page and pageSize from search params", () => {
    const result = parsePagination({ page: "2", pageSize: "10" });
    expect(result).toEqual({
      page: 2,
      pageSize: 10,
      from: 10,
      to: 19,
    });
  });

  it("clamps invalid values", () => {
    const result = parsePagination({ page: "-1", pageSize: "999" });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
  });

  it("paginates arrays", () => {
    const items = [1, 2, 3, 4, 5];
    expect(paginateArray(items, 2, 2)).toEqual({
      items: [3, 4],
      total: 5,
    });
  });

  it("snaps pageSize to allowed options when configured", () => {
    const result = parsePagination(
      { pageSize: "50" },
      {
        defaultPageSize: 10,
        allowedPageSizes: [10, 25, 50, 100],
      },
    );
    expect(result.pageSize).toBe(50);

    const invalid = parsePagination(
      { pageSize: "30" },
      {
        defaultPageSize: 10,
        allowedPageSizes: [10, 25, 50, 100],
      },
    );
    expect(invalid.pageSize).toBe(10);
  });

  it("computes total pages", () => {
    expect(totalPages(26, 10)).toBe(3);
  });
});
