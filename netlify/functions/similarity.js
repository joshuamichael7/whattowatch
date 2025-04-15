// Edge function for calculating text similarity using TensorFlow.js
const tf = require("@tensorflow/tfjs");
require("@tensorflow/tfjs-node");
const use = require("@tensorflow-models/universal-sentence-encoder");

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

    // Load the Universal Sentence Encoder model
    const model = await use.load();
    console.log("Model loaded successfully");

    // Get embeddings for all plots
    const plots = [basePlot, ...candidatePlots];
    const embeddings = await model.embed(plots);
    console.log("Embeddings generated successfully");

    // Calculate cosine similarity for each candidate
    const baseTensor = embeddings.slice([0, 0], [1]);
    const similarities = [];

    for (let i = 0; i < candidatePlots.length; i++) {
      const candidateTensor = embeddings.slice([i + 1, 0], [1]);

      // Calculate dot product
      const dot = tf.matMul(baseTensor, candidateTensor, false, true);

      // Calculate magnitudes
      const baseMag = tf.norm(baseTensor);
      const candidateMag = tf.norm(candidateTensor);

      // Calculate similarity (cosine similarity)
      const similarity = dot.div(baseMag.mul(candidateMag));

      // Get the similarity value
      const similarityValue = await similarity.data();
      similarities.push(similarityValue[0]);

      // Clean up tensors
      dot.dispose();
      baseMag.dispose();
      candidateMag.dispose();
      similarity.dispose();
    }

    // Clean up the main tensors
    baseTensor.dispose();
    embeddings.dispose();

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
