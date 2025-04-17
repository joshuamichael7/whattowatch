const bcrypt = require("bcryptjs");

exports.handler = async (event) => {
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };

  // Handle OPTIONS request (preflight)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: "Preflight call successful" }),
    };
  }

  try {
    // Get the password from the request body
    const { password, hash } = JSON.parse(event.body || "{}");

    // Return bcrypt library information
    const bcryptInfo = {
      version: bcrypt.version || "unknown",
      rounds: 10,
      prefix: "$2a$", // bcryptjs uses $2a$ prefix
    };

    let result = { bcryptInfo };

    // If password is provided, generate a hash
    if (password) {
      const salt = await bcrypt.genSalt(bcryptInfo.rounds);
      const generatedHash = await bcrypt.hash(password, salt);

      result.generatedHash = generatedHash;
      result.hashInfo = {
        prefix: generatedHash.substring(0, 4),
        rounds: generatedHash.substring(4, 6),
        length: generatedHash.length,
      };
    }

    // If both password and hash are provided, verify
    if (password && hash) {
      try {
        const isValid = await bcrypt.compare(password, hash);
        result.verification = {
          isValid,
          hashPrefix: hash.substring(0, 4),
          hashRounds: hash.substring(4, 6),
          hashLength: hash.length,
        };
      } catch (verifyError) {
        result.verificationError = verifyError.message;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error("Error in debug-bcrypt function:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || "Internal server error" }),
    };
  }
};
