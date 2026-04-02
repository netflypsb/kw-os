# kw-os TRIAL-01

## ISSUE 1: most of the MCP servers are broken:

- data exploration: failed to initialize server: C:\Users\netfl\.kw-os\servers\data\data-exploration\.venv\Scripts\python.exe: No module named data_exploration: failed to initialize client: transport error: transport closed
- excel: failed to initialize server: failed to initialize client: transport error: transport closed
- fetch: failed to initialize server: C:\Users\netfl\.kw-os\servers\data\data-exploration\.venv\Scripts\python.exe: No module named data_exploration: failed to initialize client: transport error: transport closed
- git: failed to initialize server: npm error code E404 npm error 404 Not Found - GET https://registry.npmjs.org/@modelcontextprotocol%2fserver-git - Not found npm error 404 npm error 404 The requested resource '@modelcontextprotocol/server-git@*' could not be found or you do not have permission to access it. npm error 404 npm error 404 Note that you can also install from a npm error 404 tarball, folder, http url, or git url. npm error A complete log of this run can be found in: C:\Users\netfl\AppData\Local\npm-cache\_logs\2026-04-02T03_08_35_133Z-debug-0.log: failed to initialize client: transport error: transport closed
- hledger: failed to initialize server: C:\Users\netfl\.kw-os\servers\finance\hledger\.venv\Scripts\python.exe: No module named hledger: failed to initialize client: transport error: transport closed
- imagician: failed to initialize server: npm error could not determine executable to run npm error A complete log of this run can be found in: C:\Users\netfl\AppData\Local\npm-cache\_logs\2026-04-02T03_08_34_760Z-debug-0.log: failed to initialize client: transport error: transport closed
- markitdown: failed to initialize server: C:\Users\netfl\.kw-os\servers\office\markitdown\.venv\Scripts\python.exe: No module named markitdown: failed to initialize client: transport error: transport closed
- pdf-reader: failed to initialize server: npm error code E404 npm error 404 Not Found - GET https://registry.npmjs.org/pdf-reader-mcp - Not found npm error 404 npm error 404 The requested resource 'pdf-reader-mcp@*' could not be found or you do not have permission to access it. npm error 404 npm error 404 Note that you can also install from a npm error 404 tarball, folder, http url, or git url. npm error A complete log of this run can be found in: C:\Users\netfl\AppData\Local\npm-cache\_logs\2026-04-02T03_08_34_854Z-debug-0.log: failed to initialize client: transport error: transport closed
- powerpoint: failed to initialize server: C:\Users\netfl\.kw-os\servers\office\powerpoint\.venv\Scripts\python.exe: No module named powerpoint: failed to initialize client: transport error: transport closed
- sequential-thinking: failed to initialize server: npm error code E404 npm error 404 Not Found - GET https://registry.npmjs.org/@modelcontextprotocol%2fserver-sequentialthinking - Not found npm error 404 npm error 404 The requested resource '@modelcontextprotocol/server-sequentialthinking@*' could not be found or you do not have permission to access it. npm error 404 npm error 404 Note that you can also install from a npm error 404 tarball, folder, http url, or git url. npm error A complete log of this run can be found in: C:\Users\netfl\AppData\Local\npm-cache\_logs\2026-04-02T03_08_34_551Z-debug-0.log: failed to initialize client: transport error: transport 
- time: failed to initialize server: npm error code E404 npm error 404 Not Found - GET https://registry.npmjs.org/@modelcontextprotocol%2fserver-time - Not found npm error 404 npm error 404 The requested resource '@modelcontextprotocol/server-time@*' could not be found or you do not have permission to access it. npm error 404 npm error 404 Note that you can also install from a npm error 404 tarball, folder, http url, or git url. npm error A complete log of this run can be found in: C:\Users\netfl\AppData\Local\npm-cache\_logs\2026-04-02T03_08_34_444Z-debug-0.log: failed to initialize client: transport error: transport closed
- vegalite: failed to initialize server: npm error code E404 npm error 404 Not Found - GET https://registry.npmjs.org/mcp-vegalite-server - Not found npm error 404 npm error 404 The requested resource 'mcp-vegalite-server@*' could not be found or you do not have permission to access it. npm error 404 npm error 404 Note that you can also install from a npm error 404 tarball, folder, http url, or git url. npm error A complete log of this run can be found in: C:\Users\netfl\AppData\Local\npm-cache\_logs\2026-04-02T03_08_34_617Z-debug-0.log: failed to initialize client: transport error: transport closed
- websearch: failed to initialize server: npm error code E404 npm error 404 Not Found - GET https://registry.npmjs.org/web-search-mcp - Not found npm error 404 npm error 404 The requested resource 'web-search-mcp@*' could not be found or you do not have permission to access it. npm error 404 npm error 404 Note that you can also install from a npm error 404 tarball, folder, http url, or git url. npm error A complete log of this run can be found in: C:\Users\netfl\AppData\Local\npm-cache\_logs\2026-04-02T03_08_34_484Z-debug-0.
- word: failed to create mcp stdio client: failed to start stdio transport: failed to start command: exec: "C:\\Users\\netfl\\.kw-os\\servers\\office\\word\\.venv\\Scripts\\python": executable file not found in %PATH%

## ISSUE 2: None of the skills are loaded in the app

## What succeeded
1. KW-OS: Elite Knowledge Worker RULE is present. 

Is this actually the only rule that is supposed to be loaded? It is the only one seen, no other rules, skills are seen. 

## Skills suggestions for addition:
1. https://github.com/anthropics/skills/tree/main/skills/docx
2. https://github.com/anthropics/skills/tree/main/skills/pdf
3. https://github.com/anthropics/skills/tree/main/skills/pptx
4. https://github.com/anthropics/skills/tree/main/skills/xlsx