/**
 * Cloud Storage Integration
 * Upload cleaned data to S3, GCS, or Azure Blob
 */

/**
 * Upload data to cloud storage
 * @param {string} data - Data to upload (CSV string or buffer)
 * @param {Object} config - Cloud storage configuration
 * @returns {Promise<Object>} Upload result
 */
export async function uploadToCloud(data, config) {
  const { cloudStorage } = config;

  if (!cloudStorage || !cloudStorage.provider) {
    return { success: false, message: "No cloud storage configured" };
  }

  const { provider, bucket, path, credentials } = cloudStorage;

  try {
    switch (provider.toLowerCase()) {
      case "s3":
        return await uploadToS3(data, bucket, path, credentials);
      case "gcs":
        return await uploadToGCS(data, bucket, path, credentials);
      case "azure":
        return await uploadToAzure(data, bucket, path, credentials);
      default:
        return { success: false, message: `Unknown provider: ${provider}` };
    }
  } catch (error) {
    console.error(`Cloud upload failed: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Upload to Amazon S3
 * NOTE: Requires aws-sdk to be installed
 */
async function uploadToS3(data, bucket, path, credentials) {
  // Using fetch for presigned URL approach (no SDK dependency)
  if (credentials.presignedUrl) {
    const response = await fetch(credentials.presignedUrl, {
      method: "PUT",
      body: data,
      headers: { "Content-Type": "text/csv" },
    });

    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.status}`);
    }

    return {
      success: true,
      provider: "s3",
      bucket,
      path,
      url: credentials.presignedUrl.split("?")[0],
    };
  }

  // For full SDK integration, user would need to install aws-sdk
  console.log(`S3 upload configured for s3://${bucket}/${path}`);
  console.log(
    "To enable direct S3 upload, provide a presignedUrl in credentials"
  );
  console.log("Or install aws-sdk and provide accessKeyId + secretAccessKey");

  return {
    success: false,
    message: "S3 direct upload requires presignedUrl or aws-sdk installation",
    configured: { bucket, path },
  };
}

/**
 * Upload to Google Cloud Storage
 * NOTE: Requires @google-cloud/storage to be installed
 */
async function uploadToGCS(data, bucket, path, credentials) {
  if (credentials.signedUrl) {
    const response = await fetch(credentials.signedUrl, {
      method: "PUT",
      body: data,
      headers: { "Content-Type": "text/csv" },
    });

    if (!response.ok) {
      throw new Error(`GCS upload failed: ${response.status}`);
    }

    return {
      success: true,
      provider: "gcs",
      bucket,
      path,
      url: `gs://${bucket}/${path}`,
    };
  }

  console.log(`GCS upload configured for gs://${bucket}/${path}`);
  console.log(
    "To enable direct GCS upload, provide a signedUrl in credentials"
  );

  return {
    success: false,
    message:
      "GCS direct upload requires signedUrl or @google-cloud/storage installation",
    configured: { bucket, path },
  };
}

/**
 * Upload to Azure Blob Storage
 * NOTE: Requires @azure/storage-blob to be installed
 */
async function uploadToAzure(data, container, path, credentials) {
  if (credentials.sasUrl) {
    const response = await fetch(credentials.sasUrl, {
      method: "PUT",
      body: data,
      headers: {
        "Content-Type": "text/csv",
        "x-ms-blob-type": "BlockBlob",
      },
    });

    if (!response.ok) {
      throw new Error(`Azure upload failed: ${response.status}`);
    }

    return {
      success: true,
      provider: "azure",
      container,
      path,
      url: credentials.sasUrl.split("?")[0],
    };
  }

  console.log(`Azure upload configured for ${container}/${path}`);
  console.log("To enable direct Azure upload, provide a sasUrl in credentials");

  return {
    success: false,
    message:
      "Azure direct upload requires sasUrl or @azure/storage-blob installation",
    configured: { container, path },
  };
}

/**
 * Generate cloud storage configuration schema for input
 */
export const CLOUD_STORAGE_SCHEMA = {
  type: "object",
  properties: {
    provider: {
      type: "string",
      enum: ["s3", "gcs", "azure"],
      description: "Cloud storage provider",
    },
    bucket: {
      type: "string",
      description: "Bucket/container name",
    },
    path: {
      type: "string",
      description: "Object path/key",
    },
    credentials: {
      type: "object",
      description:
        "Provider-specific credentials (presignedUrl, signedUrl, or sasUrl)",
    },
  },
};

export { uploadToS3, uploadToGCS, uploadToAzure };
