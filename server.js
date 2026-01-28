const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());

// Support JSON, Form-Encoded, and Raw Text (for direct base64 uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.text({ limit: '50mb', type: 'text/*' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'vox_secure_789';
const GEMINI_API_KEY = process.env.API_KEY;

app.post('/detect', async (req, res) => {
  console.log('--- Incoming Request ---');
  console.log('Headers:', req.headers['content-type']);

  // 1. Auth Check
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ error: "Unauthorized", message: "Missing or invalid X-API-KEY header." });
  }

  // 2. OMNI-DETECTION: Look for audio data in every possible location
  let rawAudio = null;

  if (typeof req.body === 'string' && req.body.length > 100) {
    // Case: User sent the raw base64 string as the body
    rawAudio = req.body;
  } else if (req.body) {
    // Case: User sent JSON or Form data
    rawAudio = req.body.audio || req.body.audioData || req.body.file || req.body.data;
  }

  if (!rawAudio || rawAudio.length < 100) {
    console.error('Validation Error: No audio found in body');
    return res.status(400).json({
      error: "No audio data",
      receivedKeys: req.body ? Object.keys(req.body) : 'none',
      tip: "Ensure you are sending a JSON body like {\"audio\": \"...base64...\"} with Content-Type: application/json"
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const cleanBase64 = rawAudio.includes(',') ? rawAudio.split(',')[1] : rawAudio;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "audio/mp3" } },
          { text: "Linguistic Forensic Analysis. Output JSON." }
        ]
      },
      config: {
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
    });

    res.json(JSON.parse(response.text));
  } catch (err) {
    console.error('Gemini Error:', err.message);
    res.status(500).json({ error: "Analysis failed", detail: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Omni-Input API active on port ${PORT}`));