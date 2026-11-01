import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { env } from "../env";
import { HttpError } from "./http";

function readConfig() {
  if (env.CLOUDINARY_URL) {
    const url = new URL(env.CLOUDINARY_URL);
    if (url.protocol !== "cloudinary:") {
      console.error("CLOUDINARY_URL must look like cloudinary://API_KEY:API_SECRET@CLOUD_NAME");
      return null;
    }
    return {
      cloud_name: url.hostname,
      api_key: decodeURIComponent(url.username),
      api_secret: decodeURIComponent(url.password),
    };
  }
  if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
    return {
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    };
  }
  return null;
}

const config = readConfig();
if (config) cloudinary.config({ ...config, secure: true });
else console.warn("Cloudinary is not configured: player photo uploads are disabled.");

export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, "Please upload a JPG, PNG, or WEBP photo."));
  },
});

/** Uploads a headshot, cropped square around the face, and returns where it lives. */
export function uploadPhoto(buffer: Buffer): Promise<{ url: string; publicId: string }> {
  if (!config) throw new HttpError(503, "Photo uploads aren't set up yet. Ask an organizer to configure Cloudinary.");
  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        {
          folder: env.CLOUDINARY_FOLDER,
          resource_type: "image",
          transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }, { quality: "auto" }],
        },
        (err, result) => {
          if (err || !result) {
            console.error("Cloudinary upload failed:", err);
            reject(new HttpError(502, "The photo couldn't be uploaded. Please try again."));
          } else {
            resolve({ url: result.secure_url, publicId: result.public_id });
          }
        }
      )
      .end(buffer);
  });
}

/** Best effort: a leftover photo on Cloudinary is harmless, so failures are only logged. */
export async function deletePhoto(publicId: string | null | undefined) {
  if (!publicId || !config) return;
  await cloudinary.uploader.destroy(publicId).catch((err) => console.error("Cloudinary delete failed:", err));
}
