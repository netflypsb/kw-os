As of 2026, while there isn't one "official" single npx package that bundles everything under a single name (like `npx knowledge-worker-os`), the **Model Context Protocol (MCP)** ecosystem has matured to the point where you can achieve this using "MCP Package Managers."

These tools allow non-developers to turn an IDE—specifically **Cursor**, **Windsurf**, or **VS Code**—into a powerful knowledge-work hub with one or two commands.

### 1. The "Installer" (The npx package you need)
Instead of a single app, you use an **MCP CLI** which acts as your setup wizard. The most popular one for non-developers is **Smithery**.

To set up a local ecosystem of skills and servers, you can run:
```bash
npx @smithery/cli install <server-name> --client cursor
```
This command automatically updates your IDE's configuration, installs the necessary local server, and provides the AI with the "skills" (tools) required.

---

### 2. The "Knowledge Work" Bundle
To replicate the "full lifecycle" of office tasks and research, you should install this specific "stack" of local MCP servers via npx:

| Capability | Recommended MCP Server / Package | Key Functionality |
| :--- | :--- | :--- |
| **MS Office Lifecycle** | `@softeria/ms-365-mcp-server` | Create, read, and edit Word, Excel, and PowerPoint via the Microsoft Graph API. |
| **Deep Research** | `@automatalabs/mcp-server-playwright` | Enables the AI to browse the web, click buttons, and "read" live sites just like a human. |
| **PDF & Data Parsing** | `document-reader` or `markitdown` | Converts complex PDFs, Excel sheets, and images into Markdown that the AI can actually use for work. |
| **Memory & Resources** | `knowledge-mcp` | Creates a local vector database for your personal files/prompts so the AI "remembers" your specific business context. |

---

### 3. Enabling "Skills, Prompts, and Resources"
The specific feature you are looking for—where prompts and instructions are bundled with the tools—is now standardized as **Agent Skills**.

* **How to trigger it:** In IDEs like Cursor or VS Code, you can now place a `.cursorrules` or `.agents/skills/` folder in your workspace. 
* **The npx approach:** You can find community "Skill Bundles" on GitHub and install them via:
    `npx mcp-get install [community-skill-link]`
    This will drop pre-written prompts (e.g., "How to write a board-deck PowerPoint") and local resources directly into your project.

---

### 4. How to Set It Up (Step-by-Step)
If you are a non-developer using **Cursor** (the most knowledge-worker-friendly IDE):

1.  **Open the Terminal** in Cursor (`Ctrl + ~`).
2.  **Install the Office Suite:** `npx @smithery/cli install @softeria/ms-365-mcp-server --client cursor`
3.  **Install the Research Browser:** `npx @smithery/cli install @automatalabs/mcp-server-playwright --client cursor`
4.  **Add your "Knowledge" folder:** Drag your work PDFs/Word docs into a folder named `/knowledge`.
5.  **Talk to it:** Type: *"Analyze the Q3 report in my knowledge folder and draft a 5-slide PowerPoint deck highlighting the risks."*

### Why use an IDE for this?
Unlike standard LLM web chats (like ChatGPT), using an IDE with these npx-installed servers gives the AI **direct filesystem access**. It doesn't just "talk" about a PowerPoint; it can actually write the `.pptx` file to your hard drive, open it, and edit it based on your feedback.



Would you like the specific `.json` configuration code to manually add these to a different IDE like VS Code or Windsurf?