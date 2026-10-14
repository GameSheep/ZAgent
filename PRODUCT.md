# ZAgent

A desktop Obsidian plugin for people who already use local AI agent CLIs and want to work on the Markdown note in front of them without finding paths or switching directories manually.

The user selected an Obsidian composer followed by an external interactive terminal. Success means opening from the note's three-dot menu, seeing installed agents, choosing a task or writing an instruction, and starting the chosen CLI with the note's absolute path and latest saved content.

Assumptions: use native Obsidian controls and theme; support Windows first and provide macOS/Linux launchers. Agents require the user's existing installation and authentication. Quick tasks are editable instructions, not automatically applied changes. No plugin API keys or cloud backend.
