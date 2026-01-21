import { LlmAgent } from "@google/adk";
import { GoogleGenAI } from "@google/genai";

const genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_GENAI_API_KEY! });

/**
 * Mirrors:
 * Agent(
 *   name="helpful_assistant",
 *   model=Gemini(...),
 *   description=...,
 *   instruction=...
 * )
 */
const INSTRUCTION = `
You are a direct task extractor.
Convert plans into a flat list of concise, actionable tasks.
Do not summarize.
Do not add headers.
Each task must start with "- ".
`.trim();

export function createTaskExtractorAgent() {
    const modelName = "gemini-2.5-flash-lite";

    const agent = new LlmAgent({
        name: "task_extractor",
        model: modelName,

        description:
            "Extracts concise, actionable tasks from daily plans.",

        instruction: INSTRUCTION,
    });

    return {
        ...agent,
        generate: async (prompt: string) => {
            try {
                const response = await genai.models.generateContent({
                    model: modelName,
                    config: {
                        systemInstruction: {
                            parts: [{ text: INSTRUCTION }]
                        }
                    },
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }]
                        }
                    ]
                });

                // Handle response structure for @google/genai
                // candidates are directly on the response object
                const candidate = response.candidates?.[0];
                const textPart = candidate?.content?.parts?.[0]?.text;

                // Support result.text if it exists as a property or function
                const text = response.text || textPart || "";

                return { text };
            } catch (e: any) {
                console.error("Agent generation failed:", e);
                throw e;
            }
        }
    } as any;
}

const TIME_EXTRACTION_INSTRUCTION = `
You are a time extraction specialist.
Extract time information from task descriptions and return ONLY a JSON object.

Rules:
1. Extract any time mentioned in the task (e.g., "9am", "14:30", "2-3pm", "morning", "evening")
2. Normalize times to 24-hour format when possible (e.g., "9am" → "09:00", "2pm" → "14:00")
3. Keep relative times as-is (e.g., "morning", "afternoon", "evening", "night")
4. For time ranges, use the start time (e.g., "2-3pm" → "14:00")
5. Remove the time from the task description to get clean content
6. If no time found, return null for scheduledTime

Return ONLY valid JSON in this exact format:
{
  "cleanedContent": "task description without time",
  "scheduledTime": "HH:MM" or "morning/afternoon/evening/night" or null
}

Do not include any other text, explanation, or markdown formatting.
`.trim();

export function createTimeExtractorAgent() {
    const modelName = "gemini-2.5-flash-lite";

    const agent = new LlmAgent({
        name: "time_extractor",
        model: modelName,
        description: "Extracts time information from task descriptions.",
        instruction: TIME_EXTRACTION_INSTRUCTION,
    });

    return {
        ...agent,
        generate: async (prompt: string) => {
            try {
                const response = await genai.models.generateContent({
                    model: modelName,
                    config: {
                        systemInstruction: {
                            parts: [{ text: TIME_EXTRACTION_INSTRUCTION }]
                        }
                    },
                    contents: [
                        {
                            role: 'user',
                            parts: [{ text: prompt }]
                        }
                    ]
                });

                const candidate = response.candidates?.[0];
                const textPart = candidate?.content?.parts?.[0]?.text;
                const text = response.text || textPart || "";

                return { text };
            } catch (e: any) {
                console.error("Time extraction agent failed:", e);
                throw e;
            }
        }
    } as any;
}
