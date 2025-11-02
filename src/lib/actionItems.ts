interface ActionItem {
  id: string;
  description: string;
  assignee?: string;
  deadline?: string;
  priority?: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
}

interface ExtractedActionItems {
  actionItems: ActionItem[];
  rawResponse: string;
}

/**
 * Extracts action items and deadlines from transcript text using AI
 */
export async function extractActionItems(transcript: string): Promise<ExtractedActionItems> {
  const groqKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!groqKey) {
    throw new Error('Groq API key not configured');
  }

  const prompt = `Analyze the following transcript and extract all action items, tasks, deadlines, and assignments. 

For each action item, identify:
- The task description
- Who it's assigned to (if mentioned)
- The deadline or timeframe (if mentioned)
- The priority level (if mentioned)

Format your response as a JSON array of action items. Each action item should have:
- description: string (the task description)
- assignee: string | null (who it's assigned to, or null if not mentioned)
- deadline: string | null (the deadline or timeframe, or null if not mentioned)
- priority: "low" | "medium" | "high" | null (priority level, or null if not mentioned)

Example format:
[
  {
    "description": "Review the quarterly budget report",
    "assignee": "John Doe",
    "deadline": "Next Friday",
    "priority": "high"
  },
  {
    "description": "Send meeting notes to the team",
    "assignee": null,
    "deadline": "End of week",
    "priority": "medium"
  }
]

Only return the JSON array, no additional text or explanation.

Transcript:
${transcript}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts structured action items from meeting transcripts. Always respond with valid JSON only.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3, // Lower temperature for more structured output
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Failed to extract action items: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const rawResponse = data.choices[0]?.message?.content || '[]';

    // Parse JSON response
    let actionItems: ActionItem[];
    try {
      // Try to extract JSON from response (in case there's extra text)
      const jsonMatch = rawResponse.match(/\[[\s\S]*\]/);
      const jsonStr = jsonMatch ? jsonMatch[0] : rawResponse;
      const parsed = JSON.parse(jsonStr);
      
      actionItems = parsed.map((item: any, index: number) => ({
        id: `action-${Date.now()}-${index}`,
        description: item.description || 'No description',
        assignee: item.assignee || undefined,
        deadline: item.deadline || undefined,
        priority: item.priority || 'medium',
        status: 'pending' as const,
      }));
    } catch (parseError) {
      console.error('Error parsing action items JSON:', parseError);
      console.error('Raw response:', rawResponse);
      // Fallback: return empty array
      actionItems = [];
    }

    return {
      actionItems,
      rawResponse,
    };
  } catch (error: any) {
    console.error('Error extracting action items:', error);
    throw new Error(`Failed to extract action items: ${error.message}`);
  }
}

export type { ActionItem, ExtractedActionItems };

