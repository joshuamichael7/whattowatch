// Netlify function to handle user feedback on recommendations

const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const initSupabaseClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(supabaseUrl, supabaseKey);
};

/**
 * Handler for user feedback on recommendations
 * @param {Object} event - Netlify function event
 * @returns {Object} - Response object
 */
exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    // Parse the request body
    const payload = JSON.parse(event.body);
    const { userId, contentId, isPositive, sourceContentId } = payload;

    // Validate required fields
    if (!contentId || typeof isPositive !== "boolean") {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Initialize Supabase client
    const supabase = initSupabaseClient();

    // Record the feedback in the user_feedback table
    // Note: This table needs to be created in Supabase
    const { error: feedbackError } = await supabase
      .from("user_feedback")
      .insert({
        user_id: userId || "anonymous",
        content_id: contentId,
        source_content_id: sourceContentId || null,
        is_positive: isPositive,
        created_at: new Date().toISOString(),
      });

    if (feedbackError) {
      console.error("Error recording feedback:", feedbackError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to record feedback" }),
      };
    }

    // If there's a source content (the content that led to this recommendation),
    // update the similarity score in the content_similarities table
    if (sourceContentId) {
      try {
        // First, check if a similarity relationship already exists
        const { data: existingRelation, error: fetchError } = await supabase
          .from("content_similarities")
          .select("*")
          .eq("source_id", sourceContentId)
          .eq("target_id", contentId)
          .single();

        if (fetchError && fetchError.code !== "PGRST116") {
          // PGRST116 is the error code for no rows returned
          console.error("Error fetching similarity relationship:", fetchError);
          // Continue with the function, don't return an error response
        }

        // Calculate the new similarity score
        // If the relationship exists, adjust the current score
        // If not, create a new relationship with an initial score
        const baseScore = existingRelation
          ? existingRelation.similarity_score
          : 0.5;
        const adjustment = isPositive ? 0.1 : -0.1; // Increase or decrease by 10%
        let newScore = baseScore + adjustment;

        // Ensure the score stays within 0-1 range
        newScore = Math.max(0.1, Math.min(1.0, newScore));

        if (existingRelation) {
          // Update existing relationship
          const { error: updateError } = await supabase
            .from("content_similarities")
            .update({
              similarity_score: newScore,
              updated_at: new Date().toISOString(),
            })
            .eq("source_id", sourceContentId)
            .eq("target_id", contentId);

          if (updateError) {
            console.error("Error updating similarity score:", updateError);
          }
        } else {
          // Create new relationship
          const { error: insertError } = await supabase
            .from("content_similarities")
            .insert({
              source_id: sourceContentId,
              target_id: contentId,
              similarity_score: newScore,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });

          if (insertError) {
            console.error(
              "Error creating similarity relationship:",
              insertError,
            );
          }
        }
      } catch (error) {
        console.error("Error processing similarity update:", error);
        // Continue with the function, don't return an error response
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: "Feedback recorded successfully",
      }),
    };
  } catch (error) {
    console.error("Error processing feedback:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};
