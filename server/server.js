import express from "express";
import cors from "cors";
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});