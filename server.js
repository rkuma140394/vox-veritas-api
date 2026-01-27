const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

// Enable JSON reading
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Setup Keys
// This checks your Render Dashboard for CLIENT_KEY. 
// If you didn't set it yet, it uses 'my_voice_key_123'
const AUTH_KEY = process.env.CLIENT_KEY || 'my_voice_key_123';
const GEMINI_API_KEY = process.env.API_KEY;

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "" });

// 2. Status Page (Check this in your browser)
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family:sans-serif; padding:40px; text-align:center;">
      <h1 style="color:#4f46e5;">VoxVeritas API is Online</h1>
      <p>Server Status: <b>Healthy</b></p>
      <p>Your x-api-key for testing is: <code style="background:#f3f4f6; padding:4px 8px; border-radius:4px;">${AUTH_KEY}</code></p>
    </div>
  `);
});

// 3. Main Detection Route
app.post('/detect', async (req, res) => {
  const headerKey = req.headers['x-api-key'];

  // Check if password matches
  if (headerKey !== AUTH_KEY) {
    return res.status(401).json({
      error: "Invalid x-api-key",
      received: headerKey,
      hint: "Check CLIENT_KEY in Render Environment Variables"
    });
  }

  const audioBase64 = req.body['Audio Base64 Format'];
  const language = req.body['Language'] || 'English';

  if (!audioBase64) return res.status(400).json({ error: "No audio data provided" });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { inlineData: { data: audioBase64, mimeType: "audio/mp3" } },
        { text: "Analyze if this " + language + " voice is AI or Human." }
      ],
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

    // Clean and return result
    const text = response.text.replace(/\`\`\`json|\`\`\`/g, '').trim();
    res.json(JSON.parse(text));
  } catch (err) {
    res.status(500).json({ error: "Gemini Error: " + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("API is live on port " + PORT));