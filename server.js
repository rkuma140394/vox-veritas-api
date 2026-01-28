const express = require('express');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();
app.use(express.json({ limit: '50mb' }));

app.post('/detect', async (req, res) => {
  // STRICT EVALUATION COMPLIANCE: Error Response
  const AUTH_KEY = req.headers['x-api-key'];
  if (AUTH_KEY !== 'vox_secure_789') {
    return res.status(401).json({
      status: "error",
      message: "Invalid API key or malformed request"
    });
  }

  const { audioBase64, language } = req.body;
  if (!audioBase64) {
    return res.status(400).json({
      status: "error",
      message: "Invalid API key or malformed request"
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{
        parts: [{ inlineData: { data: audioBase64, mimeType: "audio/mp3" } }, { text: "Audit: " + language }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            explanation: { type: Type.STRING }
          },
          required: ['classification', 'confidenceScore', 'explanation']
        }
      }
    });

    const result = JSON.parse(response.text);

    // STRICT EVALUATION COMPLIANCE: Success Response
    res.json({
      status: "success",
      language: language || "English",
      classification: result.classification,
      confidenceScore: result.confidenceScore,
      explanation: result.explanation
    });

  } catch (err) {
    res.status(503).json({
      status: "error",
      message: "Invalid API key or malformed request"
    });
  }
});

app.listen(3000);