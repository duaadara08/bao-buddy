import "dotenv/config"; 
import fs from "fs"; 
import {GoogleGenAI} from "@google/genai";
import nodePath from "path";

const ai = new GoogleGenAI ({apiKey: process.env.GEMINI_API_KEY});




const NOTES_DIR=nodePath.resolve("notes");


function safePath(filename){
const full=nodePath.resolve(NOTES_DIR,filename);

if(!full.startsWith(NOTES_DIR+nodePath.sep))
    {
        return null;
    }
return full;
}



async function generate(request) {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      return await ai.models.generateContent(request);
    } catch (err) {
      if (err.status !== 503 || attempt === 5) throw err;
      console.log(`503, retrying in ${attempt * 3}s (attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, attempt * 3000));
    }
  }
}





function readFile(filename) {
    const full=safePath(filename);
     if (!full) return "Error: access denied. Files must be inside the notes folder.";
    try{
        return fs.readFileSync(full,"utf-8");
        } catch (err) {
    console.log("DEBUG:", err.message);  
    return `Error: could not find or read "${filename}" in the notes folder.`;   
  }
}



function saveNote(filename, content) {
      const full=safePath(filename);
      if (!full) return "Error: access denied. Files must be inside the notes folder.";
  try {
    fs.mkdirSync(NOTES_DIR, { recursive: true });   
    fs.writeFileSync(full, content)
    return `Saved to notes/${filename}`;
   } catch (err) {
    console.log("DEBUG:", err.message);   
    return `Error: could not find or read "${filename}" in the notes folder.`;   
  }
}


const tools = [
  {
    functionDeclarations: [
      {
        name: "read_file",
        description: "Read the text contents of a file on the user's computer",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Read a text file from the user's notes folder. Give only the filename, e.g. notes.txt" },

          },
          required: ["path"],
        },
      },
      {
        name: "save_note",
        description: "Save text to a file on the user's computer. Creates the file, or replaces it if it already exists.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Save text to a file in the user's notes folder. Creates the file, or replaces it if it exists. Give only the filename, e.g. summary.txt" },
            content: { type: "string", description: "The text to write into the file" },
          },
          required: ["filename", "content"],
        },
      },
    ],
  },
];




const contents = [];      
const MAX_STEPS = 8;       

//wraps everything and export lets server.js import it 
//before waited fo rthe user at the keyboard and the answer went to console.log that works only on the terminal now the website sends a message to your server .the server needs a way to hand that message to the agent and get it back and send it to the website 
export async function runAgent(message) {
  // add the user's message to memory
  contents.push({ role: "user", parts: [{ text: message }] });

  for (let step = 0; step < MAX_STEPS; step++) {
    const response = await generate({
      model: "gemini-3.5-flash-lite",
      contents: contents,
      config: {
        tools,
        systemInstruction:
          "You are Bao, a friendly study assistant. Be warm and encouraging, and keep answers short. Always read a file with read_file before summarizing or quizzing on it, even if you read it earlier, because it may have changed. If a request is outside what your tools can do, say so honestly instead of guessing.",
      },
    });

    // the model's reply goes into memory either way
    contents.push(response.candidates[0].content);

    // no tool request: this is the final answer, so hand it back
    if (!response.functionCalls) {
      return response.text;//replace console.log
    }

    // tool requests: run every one and collect the results
    const responseParts = [];
    for (const call of response.functionCalls) {
      console.log("Tool called:", call.name, call.args);

      let result;
      if (call.name === "read_file") {
        result = readFile(call.args.path);
      } else if (call.name === "save_note") {
        result = saveNote(call.args.filename, call.args.content);
      } else {
        result = `Error: unknown tool ${call.name}`;
      }

      console.log("Result:", result);
      responseParts.push({
        functionResponse: { name: call.name, response: { result: result } },
      });
    }

    contents.push({ role: "user", parts: responseParts });
  }

  // the loop ran out of laps without a final answer
  return "I stopped because I hit the step limit. Try rephrasing your question.";
}