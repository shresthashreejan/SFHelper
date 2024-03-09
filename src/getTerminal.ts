import * as vscode from "vscode";

function getTerminal(terminalPath?: string) {
    const terminals = vscode.window.terminals;
    const sfTerminal = terminals.find(
        (terminal) => terminal.name === "SF Helper"
    );

    if (!sfTerminal) {
        if (terminalPath) {
            return vscode.window.createTerminal({
                name: "SF Helper",
                shellPath: terminalPath,
            });
        } else {
            return vscode.window.createTerminal({ name: "SF Helper" });
        }
    }

    return sfTerminal;
}

export { getTerminal };
