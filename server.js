const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());

// Support JSON and Form data with large limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'vox_secure_789';
const GEMINI_API_KEY = process.env.API_KEY;

app.post('/detect', async (req, res) => {
  console.log('--- Incoming Forensic Request ---');

  // 1. Auth Check
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ status: "error", error: "Unauthorized", message: "Invalid X-API-KEY header." });
  }

  // 2. EXTRACTION: Handles 'audio', 'audioBase64', or 'audioData'
  let rawAudio = req.body.audio ||
    req.body.audioBase64 ||
    req.body.audioData ||
    req.body.file ||
    req.body.data;

  const languageInput = req.body.language || req.body.Language || 'English';

  if (!rawAudio || rawAudio.length < 100) {
    return res.status(400).json({
      status: "error",
      error: "No audio data",
      receivedKeys: Object.keys(req.body),
      tip: "Please ensure your JSON body uses the key 'audioBase64'."
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const cleanBase64 = rawAudio.includes(',') ? rawAudio.split(',')[1] : rawAudio;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "audio/mp3" } },
          { text: `Forensic voice analysis for ${languageInput}. Detect Deepfake vs Human speech.` }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: { type: Type.STRING },
            language: { type: Type.STRING },
            classification: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
          },
          required: ['status', 'language', 'classification', 'confidenceScore', 'explanation'],
        }
      }
    });

    console.log('SUCCESS: Pro Analysis Complete');
    const result = JSON.parse(response.text);
    res.json(result);
  } catch (err) {
    console.error('SYSTEM ERROR:', err.message);
    res.status(500).json({ status: "error", error: "Analysis failed", detail: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('=========================================');
  console.log(`VOXVERITAS PRO API LIVE: http://localhost:${PORT}`);
  console.log('Model: gemini-3-pro-preview');
  console.log('=========================================');
});