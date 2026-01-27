const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require('@google/genai');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 1. Log startup to help debug Render
console.log("Server starting up...");

const apiKey = process.env.API_KEY;
if (!apiKey) {
  console.error("FATAL ERROR: API_KEY environment variable is missing!");
}

const ai = new GoogleGenAI({ apiKey: apiKey || "" });

app.post('/detect', async (req, res) => {
  console.log("Received detection request...");
  
  // Auth check for HCL Tester
  if (req.headers['x-api-key'] !== 'vox_prod_8291_x021') {
    console.warn("Unauthorized attempt with key:", req.headers['x-api-key']);
    return res.status(401).json({ error: 'Invalid x-api-key header' });
  }

  const audioBase64 = req.body['Audio Base64 Format'];
  const language = req.body['Language'] || 'English';
  const audioFormat = req.body['Audio Format'] || 'mp3';

  if (!audioBase64) {
    return res.status(400).json({ error: 'Missing Audio Base64 Format' });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { inlineData: { data: audioBase64, mimeType: `audio/${audioFormat}` } },
        { text: `Forensic Analysis for ${language} audio. Classify as AI_GENERATED or HUMAN.` }
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
    
    // Direct access to text property
    let jsonResult = response.text;
    
    // Sanitization: Remove potential markdown if present
    jsonResult = jsonResult.replace(/\`\`\`json|\`\`\`/g, '').trim();
    
    res.json(JSON.parse(jsonResult));
    console.log("Analysis successful.");
  } catch (err) {
    console.error("Analysis failed:", err.message);
    res.status(500).json({ error: 'Internal Analysis Error', details: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is live on port ${PORT}`);
});