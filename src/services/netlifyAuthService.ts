/**
 * Service for interacting with Netlify functions for auth operations
 */

// Get user profile by ID
export async function getUserById(userId: string) {
  try {
    console.log(`[netlifyAuthService] Getting user by ID: ${userId}`);
    const response = await fetch("/.netlify/functions/auth-helper", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "getUserById",
        userId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error(
      `[netlifyAuthService] Error getting user by ID: ${userId}`,
      error,
    );
    throw error;
  }
}

// Get user profile by email
export async function getUserByEmail(email: string) {
  try {
    console.log(`[netlifyAuthService] Getting user by email: ${email}`);
    const response = await fetch("/.netlify/functions/auth-helper", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "getUserByEmail",
        email,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error(
      `[netlifyAuthService] Error getting user by email: ${email}`,
      error,
    );
    throw error;
  }
}

// Check if user exists by ID or email
export async function checkUserExists(
  userIdOrEmail: string,
  isEmail: boolean = false,
) {
  try {
    console.log(
      `[netlifyAuthService] Checking if user exists: ${userIdOrEmail}`,
    );
    const response = await fetch("/.netlify/functions/auth-helper", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "checkUserExists",
        ...(isEmail ? { email: userIdOrEmail } : { userId: userIdOrEmail }),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    const result = await response.json();
    return { exists: result.exists, error: null };
  } catch (error: any) {
    console.error(
      `[netlifyAuthService] Error checking if user exists: ${userIdOrEmail}`,
      error,
    );
    return { exists: false, error };
  }
}
