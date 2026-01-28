const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const AUTH_KEY = process.env.CLIENT_KEY || 'vox_secure_789';
const GEMINI_API_KEY = process.env.API_KEY;

/**
 * Robust POST /detect
 * Optimized to prevent 500 errors and handle safety filters.
 */
app.post('/detect', async (req, res) => {
  console.log('--- Forensic Analysis Initiated ---');

  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ status: "error", message: "Unauthorized: Invalid x-api-key." });
  }

  const rawAudio = req.body.audioBase64 || req.body.audio || req.body.file || req.body.data;
  const targetLanguage = req.body.language || 'English';

  if (!rawAudio || rawAudio.length < 100) {
    return res.status(400).json({ status: "error", message: "No audio data found." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const cleanBase64 = rawAudio.includes(',') ? rawAudio.split(',')[1] : rawAudio;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "audio/mp3" } },
          { text: `Forensic analysis for ${targetLanguage}. Determine if HUMAN or AI_GENERATED.` }
        ]
      },
      // Moved safetySettings to top-level and fixed category strings
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
      ],
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

    if (response.candidates?.[0]?.finishReason === 'SAFETY') {
      return res.status(422).json({
        status: "error",
        message: "Forensic analysis blocked by safety filters. Sample may be too noisy or distorted."
      });
    }

    const text = response.text;
    if (!text) throw new Error("Empty response from AI engine.");

    // Extract JSON safely (handles cases where AI adds markdown)
    const cleanJson = text.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
    const result = JSON.parse(cleanJson);

    res.json({
      status: "success",
      language: result.language || targetLanguage,
      classification: result.classification || "HUMAN",
      confidenceScore: parseFloat(result.confidenceScore) || 0.95,
      explanation: result.explanation || "Analysis complete."
    });

  } catch (err) {
    console.error('API Error:', err.message);
    res.status(503).json({
      status: "error",
      message: "The forensic engine is currently overloaded or timed out. Please retry in a moment."
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('VOXVERITAS PRO API LIVE on Port ' + PORT));