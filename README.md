# Personal Doc RAG Agent 🧠🤖

An advanced, privacy-first **Agentic Retrieval-Augmented Generation (RAG)** workspace. Powered by **Next.js** and **Google Gemini**, this local knowledge copilot is equipped with an autonomous text-based **ReAct agent loop**, allowing the AI to list, read, edit, and self-reindex your personal document library directly through natural chat dialogues.

---

## ⚡ Key Capabilities

* **🤖 Autonomous ReAct Agent Loop:** Handles multi-turn sequential tool execution (e.g. `list_documents` ➔ `read_document_content` ➔ `update_document_content`) inside a single chat turn to edit/rewrite document text.
* **🔍 Semantic Vector RAG:** Parses files (`.pdf`, `.txt`, `.md`) locally and computes **768-dimensional embeddings** using Google's `gemini-embedding-001` (with mathematical offline fallback).
* **🕸️ Reactive Physics Graph:** Dynamically visualizes document nodes and chunk linkages in an interactive, physics-driven Knowledge Graph.
* **✍️ Connected Workspace UI:** Features a distraction-free split Markdown Writer, real-time citation streaming, and automatic document reloading upon agentic edits.

---

## 🛠️ Quick Start & Setup

### 1. Prerequisites
Ensure you have **Node.js** and **Bun** (or npm/yarn) installed on your machine.

### 2. Installation
Clone the repository and install the dependencies:
```bash
# Clone the repository
git clone https://github.com/prashantsharma9027/Agentic-Personal-Rag.git
cd Agentic-Personal-Rag

# Install dependencies
bun install
```

### 3. Environment Configuration
Create a `.env.local` file in the root directory and add your Google Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 4. Run Development Server
Start the Next.js development server:
```bash
bun run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser to start exploring your personal AI workspace!

---

## 🎯 Sample Agent Queries to Try

* **Scan files:** *"What documents are currently in my library?"*
* **Analyze context:** *"Can you read the full contents of `Resume.pdf` and tell me if it lists Python?"*
* **Agentic Editing:** *"Please rewrite my resume document `Resume.pdf` to replace my old domain with `abc.in`."* (Watch the Markdown Editor instantly reload with the changes!)

---

## 🏆 Credits

Built with 💻 and 🦾 by **[Prashant Sharma](https://prashantsharma.in)**.
