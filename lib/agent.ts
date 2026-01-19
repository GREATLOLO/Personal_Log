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
export function createTaskExtractorAgent() {
    return new LlmAgent({
        name: "task-extractor",
        model: "gemini-2.5-flash-lite",

        description:
            "Extracts concise, actionable tasks from daily plans.",

        instruction: `
You are a direct task extractor.
Convert plans into a flat list of concise, actionable tasks.
Do not summarize.
Do not add headers.
Each task must start with "- ".
    `.trim(),

        llm: genai,
    });
}
