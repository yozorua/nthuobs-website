/**
 * Observatory site configuration.
 * Edit the values here to match your local environment.
 */

// Absolute path to the latest all-sky camera image on the server filesystem.
// The file is expected to be updated in-place by the camera software.
export const ALLSKY_IMAGE_PATH =
  process.env.ALLSKY_IMAGE_PATH ??
  '/cloud/Monitor/AllSkyCam/Images/Latest/latest_image.jpg';

// How often the browser refreshes the all-sky image (milliseconds).
export const ALLSKY_REFRESH_INTERVAL_MS = 15_000;
