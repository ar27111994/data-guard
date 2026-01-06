/**
 * Third-Party Connectors Tests
 */

import {
  createConnector,
  getAvailableConnectors,
  CONNECTOR_CONFIGS,
  SalesforceConnector,
  HubSpotConnector,
  StripeConnector,
  AirtableConnector,
} from "../src/integrations/connectors.js";

describe("Third-Party Connectors", () => {
  describe("Available Connectors", () => {
    test("returns list of connectors", () => {
      const connectors = getAvailableConnectors();
      expect(connectors.length).toBeGreaterThan(0);
      expect(connectors.some((c) => c.id === "salesforce")).toBe(true);
      expect(connectors.some((c) => c.id === "hubspot")).toBe(true);
      expect(connectors.some((c) => c.id === "stripe")).toBe(true);
      expect(connectors.some((c) => c.id === "airtable")).toBe(true);
    });

    test("includes required fields info", () => {
      const connectors = getAvailableConnectors();
      const salesforce = connectors.find((c) => c.id === "salesforce");

      expect(salesforce.requiredFields).toBeDefined();
      expect(salesforce.authType).toBeDefined();
    });
  });

  describe("Connector Creation", () => {
    test("creates Salesforce connector", () => {
      const connector = createConnector("salesforce", {
        accessToken: "test-token",
        instanceUrl: "https://test.salesforce.com",
      });

      expect(connector).toBeInstanceOf(SalesforceConnector);
    });

    test("creates HubSpot connector", () => {
      const connector = createConnector("hubspot", {
        apiKey: "test-key",
      });

      expect(connector).toBeInstanceOf(HubSpotConnector);
    });

    test("creates Stripe connector", () => {
      const connector = createConnector("stripe", {
        secretKey: "sk_test_123",
      });

      expect(connector).toBeInstanceOf(StripeConnector);
    });

    test("creates Airtable connector", () => {
      const connector = createConnector("airtable", {
        apiKey: "key123",
        baseId: "app123",
        tableId: "tbl123",
      });

      expect(connector).toBeInstanceOf(AirtableConnector);
    });

    test("throws for unknown connector", () => {
      expect(() => createConnector("unknown", {})).toThrow();
    });

    test("handles case-insensitive type", () => {
      const connector = createConnector("HUBSPOT", {
        apiKey: "test",
      });

      expect(connector).toBeInstanceOf(HubSpotConnector);
    });
  });

  describe("Connector Configuration", () => {
    test("Salesforce config has correct fields", () => {
      const config = CONNECTOR_CONFIGS.salesforce;
      expect(config.name).toBe("Salesforce");
      expect(config.authType).toBe("oauth");
      expect(config.requiredFields).toContain("accessToken");
      expect(config.requiredFields).toContain("instanceUrl");
    });

    test("HubSpot config has correct fields", () => {
      const config = CONNECTOR_CONFIGS.hubspot;
      expect(config.name).toBe("HubSpot");
      expect(config.baseUrl).toBeDefined();
      expect(config.endpoints.contacts).toBeDefined();
    });

    test("Stripe config has correct fields", () => {
      const config = CONNECTOR_CONFIGS.stripe;
      expect(config.name).toBe("Stripe");
      expect(config.endpoints.charges).toBeDefined();
      expect(config.endpoints.customers).toBeDefined();
    });

    test("Airtable config has correct fields", () => {
      const config = CONNECTOR_CONFIGS.airtable;
      expect(config.name).toBe("Airtable");
      expect(config.requiredFields).toContain("baseId");
      expect(config.requiredFields).toContain("tableId");
    });
  });

  describe("Response Transformation", () => {
    test("Salesforce transforms SOQL response", () => {
      const connector = new SalesforceConnector({
        accessToken: "test",
        instanceUrl: "https://test.salesforce.com",
      });

      const response = {
        totalSize: 2,
        done: true,
        records: [
          { attributes: { type: "Account" }, Id: "001", Name: "Test Corp" },
          { attributes: { type: "Account" }, Id: "002", Name: "Demo Inc" },
        ],
      };

      const result = connector.transformResponse(response);
      expect(result.rows.length).toBe(2);
      expect(result.headers).toContain("Id");
      expect(result.headers).toContain("Name");
      expect(result.headers).not.toContain("attributes");
    });

    test("HubSpot transforms CRM response", () => {
      const connector = new HubSpotConnector({ apiKey: "test" });

      const response = {
        results: [
          { id: "1", properties: { email: "a@b.com", name: "John" } },
          { id: "2", properties: { email: "c@d.com", name: "Jane" } },
        ],
      };

      const result = connector.transformResponse(response);
      expect(result.rows.length).toBe(2);
      expect(result.headers).toContain("id");
      expect(result.headers).toContain("email");
    });

    test("Stripe flattens nested response", () => {
      const connector = new StripeConnector({ secretKey: "sk_test" });

      const response = {
        data: [
          {
            id: "ch_1",
            amount: 1000,
            currency: "usd",
            billing_details: { name: "John" },
          },
        ],
        has_more: false,
      };

      const result = connector.transformResponse(response, "charges");
      expect(result.rows.length).toBe(1);
      expect(result.headers).toContain("id");
      expect(result.headers).toContain("billing_details_name");
    });

    test("Airtable transforms records", () => {
      const connector = new AirtableConnector({
        apiKey: "key",
        baseId: "app",
        tableId: "tbl",
      });

      const response = {
        records: [
          { id: "rec1", fields: { Name: "A", Status: "Active" } },
          { id: "rec2", fields: { Name: "B", Status: "Inactive" } },
        ],
      };

      const result = connector.transformResponse(response);
      expect(result.rows.length).toBe(2);
      expect(result.headers).toContain("id");
      expect(result.headers).toContain("Name");
    });

    test("handles empty response", () => {
      const connector = new HubSpotConnector({ apiKey: "test" });
      const result = connector.transformResponse({ results: [] });

      expect(result.rows).toEqual([]);
      expect(result.headers).toEqual([]);
    });
  });

  describe("Edge Cases", () => {
    test("handles missing properties gracefully", () => {
      const connector = new HubSpotConnector({ apiKey: "test" });

      const response = {
        results: [
          { id: "1", properties: {} },
          { id: "2" }, // No properties
        ],
      };

      expect(() => connector.transformResponse(response)).not.toThrow();
    });

    test("handles deeply nested Stripe data", () => {
      const connector = new StripeConnector({ secretKey: "test" });

      const response = {
        data: [
          {
            id: "1",
            nested: {
              level1: {
                level2: {
                  value: "deep",
                },
              },
            },
          },
        ],
      };

      const result = connector.transformResponse(response, "test");
      expect(result.rows.length).toBe(1);
    });
  });
});
