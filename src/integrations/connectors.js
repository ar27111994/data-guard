/**
 * Third-Party Data Source Connectors
 * Integration with Salesforce, HubSpot, Stripe, and other services
 */

import {
  DataQualityError,
  Errors,
  retryWithBackoff,
} from "../utils/error-handler.js";

/**
 * Connector configuration templates
 */
export const CONNECTOR_CONFIGS = {
  salesforce: {
    name: "Salesforce",
    description: "Validate Salesforce data exports",
    authType: "oauth",
    requiredFields: ["accessToken", "instanceUrl"],
    endpoints: {
      query: "/services/data/v58.0/query",
      describe: "/services/data/v58.0/sobjects",
    },
  },
  hubspot: {
    name: "HubSpot",
    description: "Validate HubSpot CRM data",
    authType: "apiKey",
    requiredFields: ["apiKey"],
    baseUrl: "https://api.hubapi.com",
    endpoints: {
      contacts: "/crm/v3/objects/contacts",
      companies: "/crm/v3/objects/companies",
      deals: "/crm/v3/objects/deals",
    },
  },
  stripe: {
    name: "Stripe",
    description: "Validate Stripe payment data",
    authType: "apiKey",
    requiredFields: ["secretKey"],
    baseUrl: "https://api.stripe.com/v1",
    endpoints: {
      charges: "/charges",
      customers: "/customers",
      invoices: "/invoices",
      subscriptions: "/subscriptions",
    },
  },
  airtable: {
    name: "Airtable",
    description: "Validate Airtable base data",
    authType: "apiKey",
    requiredFields: ["apiKey", "baseId", "tableId"],
    baseUrl: "https://api.airtable.com/v0",
  },
};

/**
 * Base connector class
 */
class BaseConnector {
  constructor(config) {
    this.config = config;
    this.name = "BaseConnector";
  }

  /**
   * Validate connector configuration
   */
  validateConfig() {
    const connectorKey = this.name.toLowerCase();
    const connectorConfig = CONNECTOR_CONFIGS[connectorKey];
    if (!connectorConfig) {
      throw new DataQualityError(`Unknown connector: ${this.name}`, {
        code: "UNKNOWN_CONNECTOR",
        details: { availableConnectors: Object.keys(CONNECTOR_CONFIGS) },
      });
    }

    for (const field of connectorConfig.requiredFields || []) {
      if (!this.config[field]) {
        throw new DataQualityError(`Missing required field: ${field}`, {
          code: "MISSING_CONFIG_FIELD",
          details: { connector: this.name, field },
        });
      }
    }
  }

  /**
   * Make authenticated API request
   * @param {string} url - Full URL
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Response data
   */
  async request(url, options = {}) {
    const response = await retryWithBackoff(
      async () => {
        const res = await fetch(url, {
          ...options,
          headers: {
            ...this.getAuthHeaders(),
            "Content-Type": "application/json",
            ...options.headers,
          },
        });

        if (!res.ok) {
          const error = await res.json().catch(() => ({}));
          throw new DataQualityError(
            `API request failed: ${res.status} ${res.statusText}`,
            {
              code: "API_REQUEST_FAILED",
              details: { status: res.status, error },
            }
          );
        }

        return res.json();
      },
      { maxRetries: 3, baseDelayMs: 1000 }
    );

    return response;
  }

  /**
   * Get authentication headers
   */
  getAuthHeaders() {
    return {};
  }

  /**
   * Fetch data from connector
   */
  async fetchData() {
    throw new Error("fetchData must be implemented by subclass");
  }

  /**
   * Transform response to standard format
   * @param {Object} response - API response
   * @returns {Object} Standardized data
   */
  transformResponse(response) {
    return {
      rows: [],
      headers: [],
      metadata: {
        connector: this.name,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Salesforce connector
 */
export class SalesforceConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.name = "Salesforce";
  }

  getAuthHeaders() {
    return {
      Authorization: `Bearer ${this.config.accessToken}`,
    };
  }

  /**
   * Execute SOQL query
   * @param {string} query - SOQL query string
   * @returns {Promise<Object>} Query results
   */
  async query(query) {
    this.validateConfig();

    const encodedQuery = encodeURIComponent(query);
    const url = `${this.config.instanceUrl}/services/data/v58.0/query?q=${encodedQuery}`;

    return this.request(url);
  }

  /**
   * Fetch object records
   * @param {string} objectName - Salesforce object name (e.g., Account, Contact)
   * @param {Array<string>} fields - Fields to fetch
   * @param {number} limit - Maximum records
   * @returns {Promise<Object>} Records
   */
  async fetchData(
    objectName = "Account",
    fields = ["Id", "Name"],
    limit = 1000
  ) {
    // Validate objectName to prevent SOQL injection
    if (!/^[A-Za-z0-9_]+$/.test(objectName)) {
      throw new DataQualityError(`Invalid object name: ${objectName}`, {
        code: "INVALID_OBJECT_NAME",
        details: { objectName },
      });
    }

    // Validate fields to prevent SOQL injection
    const sanitizedFields = fields.filter((field) =>
      /^[A-Za-z0-9_.]+$/.test(field)
    );
    if (sanitizedFields.length === 0) {
      sanitizedFields.push("Id", "Name");
    }

    const query = `SELECT ${sanitizedFields.join(
      ", "
    )} FROM ${objectName} LIMIT ${limit}`;
    const response = await this.query(query);

    return this.transformResponse(response);
  }

  transformResponse(response) {
    const records = response.records || [];

    if (records.length === 0) {
      return { rows: [], headers: [], metadata: { connector: this.name } };
    }

    // Extract headers from first record, excluding metadata fields
    const headers = Object.keys(records[0]).filter(
      (key) => key !== "attributes"
    );

    const rows = records.map((record) => {
      const row = {};
      for (const header of headers) {
        row[header] = record[header];
      }
      return row;
    });

    return {
      rows,
      headers,
      metadata: {
        connector: this.name,
        totalRecords: response.totalSize,
        done: response.done,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * HubSpot connector
 */
export class HubSpotConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.name = "HubSpot";
  }

  getAuthHeaders() {
    // Support both API key (legacy) and access token
    if (this.config.accessToken) {
      return { Authorization: `Bearer ${this.config.accessToken}` };
    }
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  /**
   * Fetch CRM objects
   * @param {string} objectType - Object type (contacts, companies, deals)
   * @param {Array<string>} properties - Properties to fetch
   * @param {number} limit - Maximum records
   * @returns {Promise<Object>} Records
   */
  async fetchData(objectType = "contacts", properties = [], limit = 100) {
    this.validateConfig();

    const baseUrl = CONNECTOR_CONFIGS.hubspot.baseUrl;
    let url = `${baseUrl}/crm/v3/objects/${objectType}?limit=${Math.min(
      limit,
      100
    )}`;

    if (properties.length > 0) {
      url += `&properties=${properties.join(",")}`;
    }

    // Handle pagination for larger datasets
    const allRecords = [];
    let after = null;

    while (allRecords.length < limit) {
      const pageUrl = after ? `${url}&after=${after}` : url;
      const response = await this.request(pageUrl);

      allRecords.push(...(response.results || []));

      if (!response.paging?.next?.after) break;
      after = response.paging.next.after;
    }

    return this.transformResponse({ results: allRecords.slice(0, limit) });
  }

  transformResponse(response) {
    const results = response.results || [];

    if (results.length === 0) {
      return { rows: [], headers: [], metadata: { connector: this.name } };
    }

    // Extract all property keys
    const allProps = new Set();
    for (const record of results) {
      for (const key of Object.keys(record.properties || {})) {
        allProps.add(key);
      }
    }

    const headers = ["id", ...Array.from(allProps)];

    const rows = results.map((record) => {
      const row = { id: record.id };
      for (const prop of allProps) {
        row[prop] = record.properties?.[prop] ?? null;
      }
      return row;
    });

    return {
      rows,
      headers,
      metadata: {
        connector: this.name,
        recordCount: results.length,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Stripe connector
 */
export class StripeConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.name = "Stripe";
  }

  getAuthHeaders() {
    // Stripe uses Bearer token authentication
    return { Authorization: `Bearer ${this.config.secretKey}` };
  }

  /**
   * Fetch Stripe objects
   * @param {string} objectType - Object type (charges, customers, invoices)
   * @param {number} limit - Maximum records
   * @returns {Promise<Object>} Records
   */
  async fetchData(objectType = "charges", limit = 100) {
    this.validateConfig();

    const baseUrl = CONNECTOR_CONFIGS.stripe.baseUrl;
    const endpoint =
      CONNECTOR_CONFIGS.stripe.endpoints[objectType] || `/${objectType}`;
    const url = `${baseUrl}${endpoint}?limit=${Math.min(limit, 100)}`;

    const response = await this.request(url);
    return this.transformResponse(response, objectType);
  }

  transformResponse(response, objectType) {
    const data = response.data || [];

    if (data.length === 0) {
      return { rows: [], headers: [], metadata: { connector: this.name } };
    }

    // Flatten nested objects for table format
    const flattenObject = (obj, prefix = "") => {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}_${key}` : key;
        if (value && typeof value === "object" && !Array.isArray(value)) {
          Object.assign(result, flattenObject(value, newKey));
        } else if (!Array.isArray(value)) {
          result[newKey] = value;
        }
      }
      return result;
    };

    const flatRecords = data.map((record) => flattenObject(record));

    // Get all unique headers
    const headerSet = new Set();
    for (const record of flatRecords) {
      for (const key of Object.keys(record)) {
        headerSet.add(key);
      }
    }

    const headers = Array.from(headerSet);

    const rows = flatRecords.map((record) => {
      const row = {};
      for (const header of headers) {
        row[header] = record[header] ?? null;
      }
      return row;
    });

    return {
      rows,
      headers,
      metadata: {
        connector: this.name,
        objectType,
        recordCount: data.length,
        hasMore: response.has_more,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Airtable connector
 */
export class AirtableConnector extends BaseConnector {
  constructor(config) {
    super(config);
    this.name = "Airtable";
  }

  getAuthHeaders() {
    return { Authorization: `Bearer ${this.config.apiKey}` };
  }

  /**
   * Fetch Airtable records
   * @param {number} maxRecords - Maximum records to fetch
   * @returns {Promise<Object>} Records
   */
  async fetchData(maxRecords = 1000) {
    this.validateConfig();

    const { baseId, tableId } = this.config;
    const url = `${CONNECTOR_CONFIGS.airtable.baseUrl}/${baseId}/${tableId}?maxRecords=${maxRecords}`;

    const response = await this.request(url);
    return this.transformResponse(response);
  }

  transformResponse(response) {
    const records = response.records || [];

    if (records.length === 0) {
      return { rows: [], headers: [], metadata: { connector: this.name } };
    }

    // Get all field names
    const fieldSet = new Set();
    for (const record of records) {
      for (const key of Object.keys(record.fields || {})) {
        fieldSet.add(key);
      }
    }

    const headers = ["id", ...Array.from(fieldSet)];

    const rows = records.map((record) => {
      const row = { id: record.id };
      for (const field of fieldSet) {
        row[field] = record.fields?.[field] ?? null;
      }
      return row;
    });

    return {
      rows,
      headers,
      metadata: {
        connector: this.name,
        recordCount: records.length,
        fetchedAt: new Date().toISOString(),
      },
    };
  }
}

/**
 * Create connector instance
 * @param {string} type - Connector type
 * @param {Object} config - Connector configuration
 * @returns {BaseConnector} Connector instance
 */
export function createConnector(type, config) {
  const connectors = {
    salesforce: SalesforceConnector,
    hubspot: HubSpotConnector,
    stripe: StripeConnector,
    airtable: AirtableConnector,
  };

  const ConnectorClass = connectors[type.toLowerCase()];
  if (!ConnectorClass) {
    throw new DataQualityError(`Unknown connector type: ${type}`, {
      code: "UNKNOWN_CONNECTOR",
      details: { availableConnectors: Object.keys(connectors) },
    });
  }

  return new ConnectorClass(config);
}

/**
 * Fetch data from third-party connector
 * @param {string} connectorType - Connector type
 * @param {Object} config - Connector configuration
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Fetched data
 */
export async function fetchFromConnector(connectorType, config, options = {}) {
  const connector = createConnector(connectorType, config);

  console.log(`   Fetching data from ${connector.name}...`);

  const result = await connector.fetchData(
    options.objectType,
    options.properties || options.fields,
    options.limit
  );

  console.log(
    `   Fetched ${result.rows.length} records from ${connector.name}`
  );

  return result;
}

/**
 * Get available connectors info
 * @returns {Array} Connector information
 */
export function getAvailableConnectors() {
  return Object.entries(CONNECTOR_CONFIGS).map(([key, config]) => ({
    id: key,
    name: config.name,
    description: config.description,
    authType: config.authType,
    requiredFields: config.requiredFields,
  }));
}
