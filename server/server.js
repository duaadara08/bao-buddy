import express from "express";
import cors from "cors";
import multer from "multer";   // NEW: receives uploaded files
import fs from "fs";           // NEW: saves files to disk
import path from "path";       // NEW: cleans up file names
import { runAgent } from "./study_agent.js";   //  agent function

const app = express();
const PORT = 3001;
 
app.use(cors());           // lets the React page (another port) talk to this server
app.use(express.json());   // lets the server read JSON(message is in json format) sent in a request

app.get("/hello", (req, res) => {
  res.send("Hello from BaoBuddy!");
});


app.post("/chat", async (req, res) => {//when a POST arrives at /chat ,do this 
  const message = req.body.message;//read the user's message 

  if (!message) {
    return res.status(400).json({ error: "Please send a message." });
  }

  try {
    const reply = await runAgent(message);//give message to agent and wait for its answer 
    res.json({ reply });//send answer back 
  } catch (err) {
    console.log("Agent error:", err.message,err.cause);
    res.status(500).json({ error: "Something went wrong. Try again." });
  }
});

// NEW: multer keeps the uploaded file in memory so we can check it before saving
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 },   // 1 MB max
});

// NEW: when a POST arrives at /upload, do this
app.post("/upload", (req, res) => {
  upload.single("file")(req, res, (err) => {
    // multer reports problems like "file too big" here
    if (err) {
      const tooBig = err.code === "LIMIT_FILE_SIZE";
      return res.status(400).json({ error: tooBig ? "File too big (max 1 MB)." : "Upload failed." });
    }

    const file = req.file;   // the file the website sent
    if (!file) return res.status(400).json({ error: "No file received." });

    // keep only the file's name (drops any folder path the sender included)
    const name = path.basename(file.originalname);

    // only .txt files are allowed
    if (!name.toLowerCase().endsWith(".txt")) {
      return res.status(400).json({ error: "Only .txt files are allowed." });
    }

    // replace anything odd in the name with an underscore
    const safeName = name.replace(/[^a-zA-Z0-9._-]/g, "_");

    // save it into the notes folder (the only folder Bao can read)
    fs.mkdirSync("notes", { recursive: true });
    fs.writeFileSync(path.join("notes", safeName), file.buffer);

    res.json({ message: `Saved ${safeName}`, filename: safeName });   // tell the website it worked
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});