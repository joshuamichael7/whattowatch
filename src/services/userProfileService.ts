/**
 * Service for fetching user profile information
 * Uses Netlify function to get profile data from Supabase
 */

/**
 * Get user profile by ID
 * @param userId The user's ID
 * @returns The user profile or null if not found
 */
export async function getUserProfileById(userId: string) {
  try {
    console.log(`[userProfileService] Getting profile for user ID: ${userId}`);

    const response = await fetch("/.netlify/functions/get-user-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    });

    if (response.status === 404) {
      console.log(
        `[userProfileService] No profile found for user ID: ${userId}`,
      );
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    const result = await response.json();
    return result.profile;
  } catch (error) {
    console.error(
      `[userProfileService] Error getting profile for user ID: ${userId}`,
      error,
    );
    return null;
  }
}

/**
 * Get user profile by email
 * @param email The user's email
 * @returns The user profile or null if not found
 */
export async function getUserProfileByEmail(email: string) {
  try {
    console.log(`[userProfileService] Getting profile for email: ${email}`);

    const response = await fetch("/.netlify/functions/get-user-profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    if (response.status === 404) {
      console.log(`[userProfileService] No profile found for email: ${email}`);
      return null;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`,
      );
    }

    const result = await response.json();
    return result.profile;
  } catch (error) {
    console.error(
      `[userProfileService] Error getting profile for email: ${email}`,
      error,
    );
    return null;
  }
}
