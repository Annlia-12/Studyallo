import { NextApiRequest, NextApiResponse } from 'next';
import { Configuration, OpenAIApi } from 'openai';
import formidable from 'formidable';
import fs from 'fs';

export const config = {
  api: {
    bodyParser: false, // needed to handle file uploads
  },
};

// Configure OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY, // make sure your key is in .env
});
const openai = new OpenAIApi(configuration);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse uploaded file or text
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'File parsing error' });

    let notesText = '';

    // Get pasted text
    if (fields.text) {
      notesText = fields.text.toString();
    }
    // Get uploaded file content (txt only for now)
    else if (files.file) {
      const file = files.file as formidable.File;
      notesText = fs.readFileSync(file.filepath, 'utf-8');
    } else {
      return res.status(400).json({ error: 'No notes provided' });
    }

    try {
      // Ask OpenAI to generate quiz questions in JSON format
      const prompt = `
You are an AI that creates quizzes. 

Create 5 multiple-choice questions from the following notes. 
Return the result as a JSON array with this structure:

[
  {
    "question": "Your question here",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0, // index of the correct answer (0-3)
    "explanation": "Why this answer is correct"
  }
]

Notes:
${notesText}
      `;

      const response = await openai.createChatCompletion({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      });

      const aiOutput = response.data.choices[0].message?.content || '';

      // Try to parse AI response as JSON
      let questions;
      try {
        questions = JSON.parse(aiOutput);
      } catch {
        // fallback: return empty sample question if AI output fails
        questions = [
          {
            id: 1,
            question: "Failed to parse AI output",
            options: ["A", "B", "C", "D"],
            correct: 0,
            explanation: "Check the notes format or API response",
          },
        ];
      }

      res.status(200).json({ questions });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to generate quiz' });
    }
  });
}
