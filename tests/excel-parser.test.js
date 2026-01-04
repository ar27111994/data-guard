/**
 * Excel Parser Tests (using ExcelJS)
 * Tests Excel parsing with edge cases
 */
import ExcelJS from "exceljs";

describe("Excel Parser", () => {
  async function createExcelBuffer(sheetData, options = {}) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(options.sheetName || "Sheet1");

    sheetData.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        sheet.getCell(rowIndex + 1, colIndex + 1).value = value;
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async function parseExcel(buffer, config) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      return { rows: [], headers: [] };
    }

    let worksheet = workbook.worksheets[0];
    if (config.excelSheet) {
      const found = workbook.getWorksheet(config.excelSheet);
      if (found) worksheet = found;
    }

    if (worksheet.rowCount === 0) {
      return { rows: [], headers: [] };
    }

    const rows = [];
    let headers = [];

    worksheet.eachRow((row, rowNumber) => {
      const rowData = [];
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        let value = cell.value;
        if (value && typeof value === "object") {
          if (value.result !== undefined) value = value.result;
          else if (value.richText)
            value = value.richText.map((rt) => rt.text).join("");
          else if (value instanceof Date) value = value.toISOString();
          else value = String(value);
        }
        rowData[colNumber - 1] = value;
      });

      if (config.hasHeader !== false && rowNumber === 1) {
        headers = rowData.map((h, i) =>
          h != null ? String(h) : `column_${i + 1}`
        );
      } else {
        const obj = {};
        if (config.hasHeader !== false) {
          headers.forEach((h, i) => {
            obj[h] = rowData[i] ?? null;
          });
        } else {
          rowData.forEach((v, i) => {
            const colName = `column_${i + 1}`;
            if (!headers.includes(colName)) headers.push(colName);
            obj[colName] = v ?? null;
          });
        }
        rows.push(obj);
      }
    });

    return { rows, headers };
  }

  describe("Basic Excel Parsing", () => {
    test("parses simple Excel with header", async () => {
      const data = [
        ["name", "age", "city"],
        ["John", 30, "NYC"],
        ["Jane", 25, "LA"],
      ];
      const buffer = await createExcelBuffer(data);
      const result = await parseExcel(buffer, { hasHeader: true });

      expect(result.headers).toEqual(["name", "age", "city"]);
      expect(result.rows.length).toBe(2);
    });

    test("parses Excel without header", async () => {
      const data = [
        ["John", 30],
        ["Jane", 25],
      ];
      const buffer = await createExcelBuffer(data);
      const result = await parseExcel(buffer, { hasHeader: false });

      expect(result.headers).toContain("column_1");
    });

    test("handles empty Excel file", async () => {
      const buffer = await createExcelBuffer([]);
      const result = await parseExcel(buffer, {});

      expect(result.rows.length).toBe(0);
    });
  });

  describe("Data Types", () => {
    test("handles numeric values", async () => {
      const data = [
        ["integer", "decimal"],
        [42, 3.14],
      ];
      const buffer = await createExcelBuffer(data);
      const result = await parseExcel(buffer, { hasHeader: true });

      expect(result.rows[0].integer).toBe(42);
    });

    test("handles boolean values", async () => {
      const data = [["bool"], [true], [false]];
      const buffer = await createExcelBuffer(data);
      const result = await parseExcel(buffer, { hasHeader: true });

      expect(result.rows[0].bool).toBe(true);
    });

    test("handles Unicode strings", async () => {
      const data = [["name"], ["日本太郎"], ["Владимир"]];
      const buffer = await createExcelBuffer(data);
      const result = await parseExcel(buffer, { hasHeader: true });

      expect(result.rows[0].name).toBe("日本太郎");
    });
  });

  describe("Sheet Selection", () => {
    test("selects sheet by name", async () => {
      const workbook = new ExcelJS.Workbook();
      const sheet1 = workbook.addWorksheet("DataSheet");
      sheet1.addRow(["name"]);
      sheet1.addRow(["John"]);

      const sheet2 = workbook.addWorksheet("MetaSheet");
      sheet2.addRow(["meta"]);

      const buffer = await workbook.xlsx.writeBuffer();

      const result = await parseExcel(Buffer.from(buffer), {
        hasHeader: true,
        excelSheet: "DataSheet",
      });

      expect(result.headers).toContain("name");
    });
  });

  describe("Edge Cases", () => {
    test("handles many columns", async () => {
      const headers = Array.from({ length: 20 }, (_, i) => `col${i}`);
      const values = Array.from({ length: 20 }, (_, i) => i);
      const data = [headers, values];

      const buffer = await createExcelBuffer(data);
      const result = await parseExcel(buffer, { hasHeader: true });

      expect(result.headers.length).toBe(20);
    });

    test("handles many rows", async () => {
      const data = [["id", "value"]];
      for (let i = 0; i < 100; i++) {
        data.push([i, `value${i}`]);
      }

      const buffer = await createExcelBuffer(data);
      const result = await parseExcel(buffer, { hasHeader: true });

      expect(result.rows.length).toBe(100);
    });
  });
});
