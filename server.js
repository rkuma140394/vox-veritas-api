const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());
// IMPORTANT: Increase limit to handle large audio payloads (Base64 is ~33% larger than binary)
app.use(express.json({ limit: '50mb' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'vox_secure_789';
const GEMINI_API_KEY = process.env.API_KEY;

const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function callGeminiWithRetry(ai, model, contents, config, retries = 3) {
  try {
    const response = await ai.models.generateContent({ model, contents, config });
    return JSON.parse(response.text);
  } catch (err) {
    const isOverloaded = err.message.includes('503') || err.message.includes('429');
    if (isOverloaded && retries > 0) {
      await wait(1000 * (4 - retries));
      return callGeminiWithRetry(ai, model, contents, config, retries - 1);
    }
    throw err;
  }
}

app.post('/detect', async (req, res) => {
  // 1. Auth Guard
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ error: "Invalid API Key" });
  }

  // 2. Data Extraction
  // Ensure the client sends 'audio' as a raw Base64 string
  const audioBase64 = req.body.audio || req.body['Audio Base64 Format'];
  const language = req.body.language || 'English';

  if (!audioBase64 || audioBase64.length < 100) {
    return res.status(400).json({
      error: "No audio data",
      message: "Validation failed: The 'audio' property must contain a valid Base64 encoded audio string."
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const result = await callGeminiWithRetry(
      ai,
      "gemini-3-flash-preview",
      {
        parts: [
          { inlineData: { data: audioBase64, mimeType: "audio/mp3" } },
          { text: "Forensic linguistic analysis for: " + language }
        ]
      },
      {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            languageDetected: { type: Type.STRING },
            artifactsFound: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['classification', 'confidenceScore', 'explanation', 'languageDetected', 'artifactsFound'],
        }
      }
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Forensic failure", detail: err.message });
  }
});

app.listen(3000, () => console.log("API LIVE: http://localhost:3000"));