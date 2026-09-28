import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

app.post('/api/diagnose', async (req, res) => {
  try {
    const {
      brand = '',
      model = '',
      configurations = '',
      problemQuery = '',
      screenshotBase64 = '',
      screenshotMimeType = 'image/jpeg',
      languageMode = 'bilingual',
    } = req.body || {};

    const hasScreenshot =
      typeof screenshotBase64 === 'string' && screenshotBase64.trim().length > 0;

    const combinedSearch = [brand, model, configurations, problemQuery]
      .filter(Boolean)
      .join(' ')
      .trim();

    if (!combinedSearch && !hasScreenshot) {
      res.status(400).json({
        error:
          'Please describe your mobile problem or upload a screenshot to identify the issue.',
      });
      return;
    }

    const ai = getGenAIClient();

    const languageInstruction =
      languageMode === 'telugu'
        ? 'Write explanations in clear Telugu script (తెలుగు), while keeping exact phone Settings menu names in English (e.g., Settings -> Apps -> Uninstall) so the user can easily locate them on their phone.'
        : languageMode === 'tanglish'
        ? 'Write explanations in conversational Tanglish (Telugu written in English alphabet, e.g., "Meeru munduga Settings loki velli Apps open cheyandi...") combined with exact English phone Settings menu paths.'
        : languageMode === 'bilingual'
        ? 'Provide explanations in both clear English AND conversational Telugu/Tanglish so any user can follow effortlessly. Keep all phone Settings paths in exact English menu labels.'
        : 'Write all explanations in clear, precise, user-friendly English with exact device Settings navigation paths.';

    const systemInstruction = `You are a Senior Mobile Hardware & OS Diagnostic Engineer for all smartphone brands worldwide (Samsung, Apple iPhone, Redmi, Xiaomi, POCO, Vivo, iQOO, OnePlus, Oppo, Realme, Motorola, Nothing, Google Pixel, Infinix, Tecno, Lava, iTel, Honor, Asus, Nokia, Sony, Huawei, etc.).
The user may provide their mobile brand, model, device configurations (RAM, storage, OS version), a text description of their problem, AND/OR a screenshot of their mobile screen showing the error, pop-up ad/virus, battery drain, network issue, or settings screen.

Your job is to:
1. If a screenshot is attached, carefully inspect all text, error dialogs, notification bars, icons, battery/storage graphs, or pop-up ads visible in the screenshot to accurately identify the exact problem and the phone OS/brand UI if visible.
2. Clearly explain what was detected in the screenshot (if provided) and what the problem actually is on their specific phone and configuration.
3. Provide a clear, sequential, step-by-step repair guide tailored to their exact mobile brand and OS menu paths.
4. ${languageInstruction}`;

    const textPrompt = `User Search & Device Details:
- Mobile Brand: ${brand || 'Detect from screenshot or search query'}
- Mobile Model: ${model || 'Detect from screenshot or search query'}
- Mobile Configurations (RAM / Storage / OS / Specs): ${configurations || 'Detect from screenshot or standard configuration'}
- User's Problem Description: "${
      problemQuery ||
      (hasScreenshot
        ? 'Identify the mobile problem shown in the uploaded screenshot and provide step-by-step instructions to fix it.'
        : combinedSearch)
    }"
- Screenshot Uploaded: ${hasScreenshot ? 'YES — inspect the attached screenshot carefully to identify the exact error, app, virus popup, or setting issue.' : 'NO'}

Generate a complete, structured mobile diagnostic and step-by-step troubleshooting report in JSON.`;

    const contentsPayload = hasScreenshot
      ? {
          parts: [
            {
              inlineData: {
                mimeType: screenshotMimeType || 'image/jpeg',
                data: screenshotBase64,
              },
            },
            {
              text: textPrompt,
            },
          ],
        }
      : textPrompt;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contentsPayload,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detectedDeviceLabel: {
              type: Type.STRING,
              description:
                'The mobile brand, model, and configuration identified from the user input or screenshot UI.',
            },
            screenshotFinding: {
              type: Type.STRING,
              description:
                'If a screenshot was uploaded, a clear 1-3 sentence explanation of what error message, app, virus alert, or UI state was detected in the screenshot. If no screenshot was uploaded, return an empty string.',
            },
            issueTitle: {
              type: Type.STRING,
              description: 'Clear, specific title of the diagnosed mobile problem.',
            },
            category: {
              type: Type.STRING,
              description:
                'Category of the mobile problem (e.g., Virus & Malware, Battery & Charging, Performance & Storage, Network & Connectivity, Display & Hardware, Audio & Sensors, System OS).',
            },
            severity: {
              type: Type.STRING,
              description:
                'Urgency level (e.g., Low — Quick Settings Fix, Moderate — Software & Cache Fix, High — Malware or System Risk, Critical — Hardware Inspection).',
            },
            estimatedMinutes: {
              type: Type.NUMBER,
              description: 'Estimated time in minutes to complete the steps (e.g. 10).',
            },
            dataLossRisk: {
              type: Type.STRING,
              description: 'e.g., None (Safe for personal photos/chats) or Backup Recommended',
            },
            whatIsTheProblem: {
              type: Type.STRING,
              description:
                'Clear explanation of what the problem actually is and why it is happening on this specific mobile and configuration.',
            },
            teluguOrTanglishSummary: {
              type: Type.STRING,
              description:
                'Clear 2-3 sentence explanation in Tanglish / Telugu explaining what the problem is and how these steps will solve it.',
            },
            configurationImpact: {
              type: Type.ARRAY,
              description:
                '2 to 3 specific observations linking their entered Brand, Model, Configurations, or Screenshot clues to this problem.',
              items: {
                type: Type.OBJECT,
                properties: {
                  specLabel: { type: Type.STRING },
                  impactAnalysis: { type: Type.STRING },
                },
                required: ['specLabel', 'impactAnalysis'],
              },
            },
            rootCauses: {
              type: Type.ARRAY,
              description: '3 to 4 primary causes behind this issue.',
              items: {
                type: Type.STRING,
              },
            },
            steps: {
              type: Type.ARRAY,
              description:
                '5 to 7 sequential step-by-step instructions to fix the problem completely.',
              items: {
                type: Type.OBJECT,
                properties: {
                  stepNumber: { type: Type.NUMBER },
                  phase: { type: Type.STRING },
                  title: { type: Type.STRING },
                  settingsPath: {
                    type: Type.STRING,
                    description:
                      'Exact menu path on this phone, e.g., Settings -> Apps -> Manage Apps',
                  },
                  instruction: {
                    type: Type.STRING,
                    description:
                      'Detailed, easy-to-follow action instruction for this step.',
                  },
                  whyItWorks: {
                    type: Type.STRING,
                    description: '1 sentence explaining why this step fixes the issue.',
                  },
                  expectedOutcome: {
                    type: Type.STRING,
                    description: 'What the user will see after completing this step.',
                  },
                  dialerCodeOrShortcut: {
                    type: Type.STRING,
                    description:
                      'Optional hardware button combo or dialer code if applicable, or empty string.',
                  },
                },
                required: [
                  'stepNumber',
                  'phase',
                  'title',
                  'settingsPath',
                  'instruction',
                  'whyItWorks',
                  'expectedOutcome',
                  'dialerCodeOrShortcut',
                ],
              },
            },
            whatNotToDo: {
              type: Type.ARRAY,
              description: '3 common mistakes the user should avoid.',
              items: {
                type: Type.STRING,
              },
            },
            whenToVisitServiceCenter: {
              type: Type.STRING,
              description:
                'When the user should visit an authorized service center if software steps do not resolve a physical hardware fault.',
            },
          },
          required: [
            'detectedDeviceLabel',
            'screenshotFinding',
            'issueTitle',
            'category',
            'severity',
            'estimatedMinutes',
            'dataLossRisk',
            'whatIsTheProblem',
            'teluguOrTanglishSummary',
            'configurationImpact',
            'rootCauses',
            'steps',
            'whatNotToDo',
            'whenToVisitServiceCenter',
          ],
        },
      },
    });

    const rawText = response.text;
    if (!rawText) {
      throw new Error('Empty response received from diagnostic model.');
    }

    const parsed = JSON.parse(rawText.trim());
    res.json({ report: parsed });
  } catch (error: any) {
    console.error('Error in /api/diagnose:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate diagnostic report.',
    });
  }
});

app.post('/api/step-assist', async (req, res) => {
  try {
    const {
      deviceLabel,
      stepTitle,
      settingsPath,
      userQuestion,
      languageMode = 'bilingual',
    } = req.body || {};

    if (!userQuestion || !userQuestion.trim()) {
      res.status(400).json({ error: 'Please enter your question about this step.' });
      return;
    }

    const ai = getGenAIClient();

    const prompt = `Device: ${deviceLabel || 'Smartphone'}
Current Troubleshooting Step: "${stepTitle}"
Menu Path: "${settingsPath}"
Language Mode: ${languageMode}

User's Follow-up Question on this Step:
"${userQuestion.trim()}"

Give a concise, practical, step-by-step answer (3-5 sentences max) helping the user complete this exact step on their phone. If they cannot find the menu option, give the exact alternative menu path or search keyword to type inside the Settings search bar. Match the requested Language Mode (${languageMode}, including Tanglish/Telugu if bilingual/tanglish/telugu).`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({
      answer:
        response.text ||
        'Open your phone Settings app and use the top Search bar to type the setting keyword directly.',
    });
  } catch (error: any) {
    console.error('Error in /api/step-assist:', error);
    res.status(500).json({
      error: error?.message || 'Unable to fetch step assistance.',
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FixBench server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;

