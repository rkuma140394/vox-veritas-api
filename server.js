const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());
// IMPORTANT: Increase limit to handle Base64 audio payloads
app.use(express.json({ limit: '50mb' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'vox_secure_789';
const GEMINI_API_KEY = process.env.API_KEY;

const wait = (ms) => new Promise(res => setTimeout(res, ms));

async function callGeminiWithRetry(ai, model, contents, config, retries = 3) {
  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config
    });
    return JSON.parse(response.text);
  } catch (err) {
    const isOverloaded = err.message.includes('503') || err.message.includes('429');
    if (isOverloaded && retries > 0) {
      console.log(`[RETRY] Model busy, waiting ${(4 - retries) * 2}s...`);
      await wait(2000 * (4 - retries));
      return callGeminiWithRetry(ai, model, contents, config, retries - 1);
    }
    throw err;
  }
}

app.post('/detect', async (req, res) => {
  // 1. Validate API Key
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ error: "Invalid x-api-key" });
  }

  // 2. Extract Data (Supporting multiple key formats)
  const audioBase64 = req.body['Audio Base64 Format'] || req.body.audio || req.body.audioData;
  const language = req.body['Language'] || req.body.language || 'English';

  // 3. Validation
  if (!audioBase64 || audioBase64.length < 10) {
    return res.status(400).json({
      error: "No audio data",
      message: "Please ensure you send the 'audio' or 'Audio Base64 Format' property in the JSON body."
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
          { text: "Linguistic Forensic analysis for " + language }
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
    const status = err.message.includes('503') ? 503 : 500;
    res.status(status).json({
      error: "Analysis Failed",
      message: err.message
    });
  }
});

app.listen(process.env.PORT || 3000, () => console.log("Reliable Forensic API Active"));