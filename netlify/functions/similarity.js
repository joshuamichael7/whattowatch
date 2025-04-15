// Edge function for calculating text similarity
// Using pure JS implementation instead of TensorFlow.js to avoid dependency issues
const natural = require("natural");

exports.handler = async function (event, context) {
  try {
    // Parse the request body
    const body = JSON.parse(event.body);
    const { basePlot, candidatePlots } = body;

    if (!basePlot || !candidatePlots || !Array.isArray(candidatePlots)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error:
            "Invalid request. Required: basePlot (string) and candidatePlots (array of strings)",
        }),
      };
    }

    console.log(
      `Processing similarity for ${candidatePlots.length} candidates`,
    );

    // Calculate cosine similarity using natural's TfIdf
    const tfidf = new natural.TfIdf();

    // Add documents
    tfidf.addDocument(basePlot);
    candidatePlots.forEach((plot) => tfidf.addDocument(plot));

    // Calculate similarities
    const similarities = [];

    for (let i = 0; i < candidatePlots.length; i++) {
      // Get terms from base plot
      const baseTerms = {};
      tfidf.listTerms(0).forEach((item) => {
        baseTerms[item.term] = item.tfidf;
      });

      // Get terms from candidate plot
      const candidateTerms = {};
      tfidf.listTerms(i + 1).forEach((item) => {
        candidateTerms[item.term] = item.tfidf;
      });

      // Calculate cosine similarity
      let dotProduct = 0;
      let baseMagnitude = 0;
      let candidateMagnitude = 0;

      // Calculate dot product and magnitudes
      const allTerms = new Set([
        ...Object.keys(baseTerms),
        ...Object.keys(candidateTerms),
      ]);

      allTerms.forEach((term) => {
        const baseValue = baseTerms[term] || 0;
        const candidateValue = candidateTerms[term] || 0;

        dotProduct += baseValue * candidateValue;
        baseMagnitude += baseValue * baseValue;
        candidateMagnitude += candidateValue * candidateValue;
      });

      // Calculate final similarity
      const similarity =
        dotProduct /
          (Math.sqrt(baseMagnitude) * Math.sqrt(candidateMagnitude)) || 0;
      similarities.push(similarity);
    }

    console.log("Similarities calculated successfully");

    return {
      statusCode: 200,
      body: JSON.stringify({ similarities }),
    };
  } catch (error) {
    console.error("Error in similarity function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Error calculating similarities",
        message: error.message,
      }),
    };
  }
};
