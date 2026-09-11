'use server';
/**
 * @fileOverview An AI agent for summarizing a road damage report's lifecycle.
 *
 * - summarizeReportFlow - A function that handles the report summarization.
 * - SummarizeReportInput - The input type for the summarizeReportFlow function.
 * - SummarizeReportOutput - The return type for the summarizeReportFlow function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import type { Report } from '@/lib/types';

// We use a Zod schema that mirrors the main parts of the Report type
// to ensure type safety and provide clear context to the AI.
const ActionLogEntrySchema = z.object({
  status: z.string(),
  timestamp: z.string(),
  actor: z.string(),
  actorName: z.string(),
  notes: z.string().optional(),
});

const SummarizeReportInputSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: z.string(),
  category: z.string(),
  timestamp: z.string().describe('The ISO 8601 timestamp when the report was created.'),
  actionLog: z.array(ActionLogEntrySchema).optional().describe('A chronological log of all actions taken on the report.'),
  citizenRating: z.number().optional().describe('A 1-5 star rating given by the citizen after resolution.'),
});
export type SummarizeReportInput = z.infer<typeof SummarizeReportInputSchema>;

const SummarizeReportOutputSchema = z.object({
  summary: z.string().describe('A concise, 3-4 sentence summary of the report in markdown format.'),
});
export type SummarizeReportOutput = z.infer<typeof SummarizeReportOutputSchema>;

export async function summarizeReportFlow(input: SummarizeReportInput): Promise<SummarizeReportOutput> {
  return reportSummarizerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'summarizeReportPrompt',
  input: { schema: SummarizeReportInputSchema },
  output: { schema: SummarizeReportOutputSchema },
  prompt: `You are a helpful AI assistant for a busy Pune Municipal Corporation (PMC) official.
Your task is to summarize a road damage report based on the provided JSON data.

The user will provide a report object. Analyze its entire lifecycle:
- When was it reported?
- What was the original issue?
- What were the key status changes in the actionLog? (e.g., Submitted -> Assigned -> Resolved)
- How long did it take to resolve?
- What was the final outcome?

Generate a concise, 3-4 sentence summary in markdown format. Start with the report ID. Use bold for key terms like dates, statuses, and ratings.

Example Output:
"Report **{{id}}** was submitted on **<date>** for a 'Pothole'. It was assigned to a worker and marked as **Resolved** on **<date>**. The citizen gave a final rating of **4/5 stars**."

Here is the report data:
\`\`\`json
{{{json input}}}
\`\`\`
`,
});


const reportSummarizerFlow = ai.defineFlow(
  {
    name: 'reportSummarizerFlow',
    inputSchema: SummarizeReportInputSchema,
    outputSchema: SummarizeReportOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
