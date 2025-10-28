// Function to generate a simple license key from an email
function generateLicenseKey(email) {
  const timestamp = new Date().getTime(); // Use a timestamp for uniqueness
  const data = `${email}:${timestamp}`; // Combine email with timestamp
  let base64 = Buffer.from(data).toString("base64");

  // Remove padding '=' characters from base64
  base64 = base64.replace(/=/g, "");

  // Reverse the base64 string for obfuscation
  const reversedBase64 = base64.split("").reverse().join("");

  // Generate 15 random characters (uppercase, lowercase, and numbers)
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const randomChars = Array.from({ length: 15 }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length)),
  ).join("");

  // Prepend the random characters to the license key
  return randomChars + reversedBase64;
}

// Function to decode the email from a license key
function decodeEmailFromLicenseKey(licenseKey) {
  try {
    // Reverse the obfuscation by reversing the string back
    const base64Reversed = licenseKey.split("").reverse().join("");
    const decodedData = Buffer.from(base64Reversed, "base64").toString("utf8");
    const [email, timestamp] = decodedData.split(":");

    if (!email || !timestamp) {
      throw new Error("Invalid license key format.");
    }

    return email;
  } catch (error) {
    throw new Error("Failed to decode the license key.");
  }
}

// Get the action (generate/decode) and email/license key from command line arguments
const action = process.argv[2];
const input = process.argv[3];

if (!action || !input) {
  console.error("Usage: node script.js <generate|decode> <email|licenseKey>");
  process.exit(1);
}

try {
  if (action === "generate") {
    const licenseKey = generateLicenseKey(input);
    console.log(licenseKey);
  } else if (action === "decode") {
    const decodedEmail = decodeEmailFromLicenseKey(input);
    console.log(`Decoded Email: ${decodedEmail}`);
  } else {
    console.error(
      'Invalid action. Use "generate" to create a license key or "decode" for decoding.',
    );
    process.exit(1);
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
