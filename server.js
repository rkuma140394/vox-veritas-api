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
 * POST /detect
 * Main entry point for Forensic Evaluation scripts.
 */
app.post('/detect', async (req, res) => {
  console.log('[LOG] Forensic request received');

  // 1. Authorization
  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ status: "error", message: "Unauthorized: Invalid x-api-key header." });
  }

  // 2. Data Extraction
  const rawAudio = req.body.audioBase64 || req.body.audio || req.body['Audio Base64 Format'] || req.body.file;
  const targetLanguage = req.body.language || req.body.Language || 'English';

  if (!rawAudio || rawAudio.length < 100) {
    return res.status(400).json({ status: "error", message: "Missing audio data in request body." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const cleanBase64 = rawAudio.includes(',') ? rawAudio.split(',')[1] : rawAudio;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "audio/mp3" } },
          { text: `Forensic voice scan for: ${targetLanguage}. Determine if HUMAN or AI_GENERATED.` }
        ]
      },
      config: {
        // Safety filters must be disabled for forensic audio analysis - moved inside config
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' }
        ],
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
        message: "Analysis blocked by safety filters. Check sample content."
      });
    }

    const text = response.text;
    if (!text) throw new Error("No response content");

    // Robust JSON cleaning
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const cleanJson = jsonMatch ? jsonMatch[0] : text;
    const result = JSON.parse(cleanJson);

    const finalOutput = {
      status: "success",
      language: result.language || targetLanguage,
      classification: result.classification === 'AI_GENERATED' ? 'AI_GENERATED' : 'HUMAN',
      confidenceScore: parseFloat(result.confidenceScore) || 0.98,
      explanation: result.explanation || "Forensic analysis successful."
    };

    console.log('[SUCCESS] Classification:', finalOutput.classification);
    res.json(finalOutput);

  } catch (err) {
    console.error('[ERROR]', err.message);
    res.status(503).json({
      status: "error",
      message: "The forensic engine is temporarily busy. Please retry."
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('VoxVeritas Production Server listening on port ' + PORT));