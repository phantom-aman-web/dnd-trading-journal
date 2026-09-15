import { saveUpload } from "./src/lib/storage";

async function test() {
  try {
    const buffer = Buffer.from("test image data");
    const storedPath = await saveUpload("user123", "test.png", buffer, "images");
    console.log("Success! storedPath:", storedPath);
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
