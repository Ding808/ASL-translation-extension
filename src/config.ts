// Load environment variables from .env file during build time
// These values will be replaced by webpack during build

export const config = {
  ROBOFLOW_API_URL: process.env.ROBOFLOW_API_URL || '',
  ROBOFLOW_API_KEY: process.env.ROBOFLOW_API_KEY || ''
};