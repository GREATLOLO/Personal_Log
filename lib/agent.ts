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
        name: "task-extractor",
        model: modelName,

        description:
            "Extracts concise, actionable tasks from daily plans.",

        instruction: INSTRUCTION,

        llm: genai,
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
                // It might be response.text() or digging into candidates
                const candidate = response.response?.candidates?.[0];
                const textPart = candidate?.content?.parts?.[0]?.text;

                // Support result.text() if it exists as a function or property
                const text = typeof response.text === 'function' ? response.text() : (textPart || "");

                return { text };
            } catch (e: any) {
                console.error("Agent generation failed:", e);
                throw e;
            }
        }
    } as any;
}
