import { describe, it, expect, vi, beforeEach } from "vitest";
import { formatOutput, printTable, printKeyValue } from "../lib/output.js";

describe("output", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("formatOutput", () => {
    it("should output JSON when json option is true", () => {
      const data = { id: "123", name: "test" };
      formatOutput(data, { json: true });

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });

    it("should output string directly in human mode", () => {
      formatOutput("hello world");

      expect(consoleSpy).toHaveBeenCalledWith("hello world");
    });

    it("should JSON-stringify objects in human mode", () => {
      const data = { key: "value" };
      formatOutput(data);

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });
  });

  describe("printTable", () => {
    it("should output JSON when json option is true", () => {
      const rows = [{ id: "1", name: "foo" }];
      const columns = [
        { key: "id", label: "ID" },
        { key: "name", label: "Name" },
      ];

      printTable(rows, columns, { json: true });

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(rows, null, 2));
    });

    it("should print 'No results found' for empty arrays", () => {
      printTable([], [{ key: "id", label: "ID" }]);

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("No results"));
    });

    it("should print header and rows for non-empty data", () => {
      const rows = [
        { id: "abc", name: "Test" },
        { id: "def", name: "Other" },
      ];
      printTable(rows, [
        { key: "id", label: "ID", width: 10 },
        { key: "name", label: "Name", width: 10 },
      ]);

      // Check that it was called with header-like content and row content
      const calls = consoleSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((c) => c.includes("ID"))).toBe(true);
      expect(calls.some((c) => c.includes("abc"))).toBe(true);
      expect(calls.some((c) => c.includes("2 results"))).toBe(true);
    });
  });

  describe("printKeyValue", () => {
    it("should output JSON when json option is true", () => {
      const data = { ID: "123", Name: "test" };
      printKeyValue(data, { json: true });

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2));
    });

    it("should print key-value pairs in human mode", () => {
      printKeyValue({ ID: "abc", Name: "test" });

      const calls = consoleSpy.mock.calls.map((c) => String(c[0]));
      expect(calls.some((c) => c.includes("ID") && c.includes("abc"))).toBe(true);
      expect(calls.some((c) => c.includes("Name") && c.includes("test"))).toBe(true);
    });
  });
});
