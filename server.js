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
 * GOLDEN PRODUCTION VERSION - ACOUSTIC FORENSICS UPDATE
 * Instructs model to ignore text content and focus purely on voice texture.
 */
app.post('/detect', async (req, res) => {
  console.log('[API] New Request Inbound');

  if (req.headers['x-api-key'] !== AUTH_KEY) {
    return res.status(401).json({ status: "error", message: "Invalid x-api-key." });
  }

  const rawAudio = req.body.audioBase64 || req.body.audio || req.body['Audio Base64 Format'] || req.body.file;
  const targetLanguage = req.body.language || req.body.Language || 'English';

  if (!rawAudio || rawAudio.length < 100) {
    return res.status(400).json({ status: "error", message: "Missing audio data." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    const cleanBase64 = rawAudio.includes(',') ? rawAudio.split(',')[1] : rawAudio;

    // Fix: Removed safetySettings which is not supported in GenerateContentParameters
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: "audio/mp3" } },
          { text: `Forensic scan for ${targetLanguage}. Ignore text content, focus on acoustics.` }
        ]
      },
      config: {
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: `You are a forensic audio expert. 
        DO NOT classify based on WHAT is said. Even if a human says "I am a robot", classify as HUMAN if the voice has natural textures.
        Look for: Glottal stops, natural aspiration, and room reverb (HUMAN) vs spectral voids and vocoder jitter (AI).
        The "language" field MUST be exactly "${targetLanguage}".`,
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
      return res.status(422).json({ status: "error", message: "Scan blocked by Safety Filters." });
    }

    const text = response.text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const result = JSON.parse(jsonMatch ? jsonMatch[0] : text);

    const normalizedLanguage = (result.language && result.language.length > 3)
      ? result.language
      : targetLanguage;

    res.json({
      status: "success",
      language: normalizedLanguage,
      classification: result.classification === 'AI_GENERATED' ? 'AI_GENERATED' : 'HUMAN',
      confidenceScore: parseFloat(result.confidenceScore) || 0.99,
      explanation: result.explanation || "Forensic scan successful."
    });

  } catch (err) {
    console.error('[API ERROR]', err.message);
    res.status(503).json({ status: "error", message: "Forensic engine busy. Retry in 1s." });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('VoxVeritas Production API Live on ' + PORT));