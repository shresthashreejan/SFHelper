import * as vscode from "vscode";

function getTerminal(terminalPath?: string, isLogsTerminal?: boolean) {
    const terminalName = isLogsTerminal ? "SF Helper Logs" : "SF Helper";
    const terminal = vscode.window.terminals.find(
        (t) => t.name === terminalName
    );

    if (!terminal) {
        return vscode.window.createTerminal({
            name: terminalName,
            ...(terminalPath && { shellPath: terminalPath }),
        });
    }

    return terminal;
}

export { getTerminal };
