'use server';
/**
 * @fileOverview A Genkit flow for the Parivartan AI chatbot.
 *
 * - chatbotFlow - A function that generates a response based on conversation history.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';

const ChatbotInputSchema = z.object({
    history: z.array(z.object({
        role: z.enum(['user', 'model']),
        content: z.string(),
    })),
});

const ChatbotOutputSchema = z.object({
    response: z.string(),
});

const quickAnswers: Record<string, string> = {
    'How do I report a problem?': `Go to "Report a Problem", use the camera to capture a clear photo, let AI auto-suggest the category, then submit. Your report gets a tracking ID.`,

    'What problems can I report?': `Potholes, cracks, surface failures, water-logging, garbage/debris, streetlights, and drainage issues.`,

    'How do I report a pothole?': `Take a clear photo of the pothole. AI will auto-detect it as "Pothole" with appropriate priority. Add location details and submit.`,

    'How do I report garbage and debris?': `Photograph the garbage/debris. AI will classify it as "Garbage/Debris". Include nearby landmarks for location reference and submit.`,

    'How do I report a streetlight problem?': `Take a photo of the broken or dim streetlight with surrounding context. AI will identify it as "Streetlight Issue" and assign it to Electricity department.`,

    'How do I report water-logging and drainage issues?': `Capture the standing water or flooding. AI will classify as "Water-logged Damage". Note if it occurs after rain. Drainage department will handle it.`,

    'How can I track my reports?': `Go to "My Complaints" to view all your reports. See status (Submitted, Under Verification, Assigned, In Progress, Resolved, Rejected), photos, and updates.`,

    'What do the different report statuses mean?': `Submitted=Received, Under Verification=Being reviewed, Assigned=Worker assigned, In Progress=Work started, Resolved=Fixed, Rejected=Invalid/duplicate.`,

    'How does the AI analysis work?': `AI detects damage type, assesses severity, suggests category and department, and assigns priority. You can edit before submitting.`,

    'What should I do if my report is rejected?': `Review the rejection reason. Resubmit with a clearer photo, better location, or revised description. Contact support if you think it was wrong.`,

    'How do I provide more details for my report?': `Use the description field to add context (damage size, landmarks, safety impact). After submission, comment via "My Complaints" for updates.`,

    'What if the AI analysis is incorrect?': `Edit the category, description, and priority before submission to match what you actually see in the photo.`,

    'How are priorities assigned?': `Based on severity (High/Critical for major damage), public safety impact, and road type (busy roads get higher priority).`,

    'Can I help fix issues in my area?': `Yes! Report accurate issues with photos, verify if problems still exist, add progress updates, and join the community leaderboard.`,

    'How do I contact support?': `Use the chatbot for questions, check Help in settings for technical issues, or visit the Contact page for report-specific concerns.`,
};

export const chatbotFlow = ai.defineFlow(
  {
    name: 'chatbotFlow',
    inputSchema: ChatbotInputSchema,
    outputSchema: ChatbotOutputSchema,
  },
  async (input) => {
    // Get the last user message
    const userMessages = input.history.filter((m) => m.role === 'user');
    const lastUserMessageContent = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : '';

    // Check for exact quick answer matches first
    if (lastUserMessageContent && quickAnswers[lastUserMessageContent]) {
        return { response: quickAnswers[lastUserMessageContent] };
    }

    // Try to find a close match in quickAnswers (case-insensitive)
    const lowerLastMessage = lastUserMessageContent.toLowerCase();
    for (const [question, answer] of Object.entries(quickAnswers)) {
      if (question.toLowerCase() === lowerLastMessage) {
        return { response: answer };
      }
    }

    const systemPrompt = `You are Roadie, a helpful AI assistant for the Parivartan civic issue management platform.

Your Purpose:
- Help citizens report road damage, garbage, streetlight issues, water-logging, and drainage problems
- Answer questions about how to use the app
- Provide guidance on tracking reports and understanding statuses
- Help citizens understand municipal department workflows

Do not use any emojis in your responses. Keep all responses professional and clear.

You have expertise in the following areas:

1. REPORTING POTHOLES:
   - Citizens should take clear photos showing the pothole's depth and size
   - Include surrounding road context for location identification
   - AI will suggest "Pothole" category with High priority for severe cases
   - Engineering department handles pothole repairs
   - Large potholes on busy roads are marked Critical priority

2. REPORTING GARBAGE AND DEBRIS:
   - Photos should show the extent of litter, waste, or debris on the road
   - Include landmarks (shops, bus stops) for better location reference
   - Mention if garbage is blocking drainage or affecting traffic flow
   - Traffic department handles cleanup operations
   - Severity depends on impact on cleanliness and public health

3. REPORTING STREETLIGHT ISSUES:
   - Photos should show broken, non-functional, or dim streetlights
   - Include surrounding area (buildings, shops) for location context
   - Mention if the area becomes unsafe at night
   - Electricity department handles streetlight repairs
   - High-traffic areas and residential zones get priority

4. REPORTING WATER-LOGGING AND DRAINAGE:
   - Photos should document standing water, flooding, or seepage
   - Describe if issue occurs during rain or persists year-round
   - Mention if it affects buildings, traffic, or pedestrians
   - Drainage or Water Supply department handles these issues
   - Indicates underlying drainage system failures

5. APP FEATURES:
   - Report a Problem: Camera capture, AI analysis, location tagging
   - My Complaints: Track all submitted reports and their statuses
   - Report Statuses: Submitted, Under Verification, Assigned, In Progress, Resolved, Rejected
   - Leaderboard: Citizens earn points for valid reports
   - Notifications: Real-time updates on report status changes

6. REPORT STATUS WORKFLOW:
   - Submitted: System received the report successfully
   - Under Verification: Official validates the complaint
   - Assigned: Worker or team assigned to fix the issue
   - In Progress: Work started on-site
   - Resolved: Issue fixed with proof photos
   - Rejected: Report invalid or duplicate

7. AI ANALYSIS PROCESS:
   - Detects damage type automatically: Pothole, Crack, Surface failure, Water-logged damage, Garbage/Debris, Streetlight Issue
   - Assesses severity: Low, Medium, High
   - Recommends appropriate department: Engineering, Traffic, Drainage, Electricity, Water Supply
   - Assigns initial priority based on type and severity
   - Users can edit suggestions before final submission

Guidelines for Responses:
- Be conversational but professional
- Use clear lists and formatting for readability
- Keep responses concise: 1-3 short sentences by default
- Use bullet points only when absolutely needed
- No emojis under any circumstances
- If asked about topics outside the app, acknowledge and suggest they contact municipal authorities
- For technical issues, guide them to the app's Help section
- Always encourage accurate, detailed reports
- Be supportive of citizen participation in municipal improvement
- Never make promises about response times or guarantee outcomes

If a user asks something you don't know, say "I don't have detailed information about that. Please contact the Pune Municipal Corporation directly for assistance" and suggest they submit a report through the app if relevant.
`;

    try {
      const historyForGenkit = input.history.map(msg => ({
        role: msg.role,
        content: [{ text: msg.content }],
      }));

      const llmResponse = await ai.generate({
        messages: historyForGenkit,
        model: 'googleai/gemini-2.5-flash',
        config: {
          temperature: 0.7,
          maxOutputTokens: 180,
        },
        system: systemPrompt,
      });
      
      return { response: llmResponse.text || "I'm sorry, I couldn't generate a response at this moment." };
    } catch (error: any) {
      // Handle quota and connection errors gracefully
      const errorMessage = String(error?.message || '');
      
      if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('quota')) {
        console.error('Chatbot API quota exceeded. Using fallback response.');
        
        const fallbackResponse = `I'm temporarily experiencing high demand. However, I can offer these suggestions:

For reporting issues:
- Go to "Report a Problem" to submit photos of potholes, garbage, streetlights, or water-logging
- Use the camera to capture clear images with location context
- The app's AI will help categorize and prioritize your report

Common issue types we help with:
- Potholes and surface cracks
- Garbage and debris on roads
- Broken streetlights
- Water-logging and drainage issues

For status updates, check "My Complaints" to track your reports.

If you have specific questions, please try again in a moment, or explore these sections of the app for immediate help.`;
        
        return { response: fallbackResponse };
      }
      
      // For other errors, provide a helpful fallback
      console.error('Chatbot error:', error);
      
      const genericFallback = `I encountered a temporary issue processing your question. Here is what I can help with:

1. How to report: Camera capture, AI analysis, location tagging
2. Tracking reports: View status in My Complaints
3. Issue types: Potholes, garbage, streetlights, water-logging, drainage
4. Statuses: Submitted, Under Verification, Assigned, In Progress, Resolved, Rejected
5. Points and leaderboard: Earn points for valid reports

Please try your question again, or explore the app's Help section for more information.`;
      
      return { response: genericFallback };
    }
  }
);
