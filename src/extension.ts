import * as vscode from "vscode";

// ctrl '

export function activate(context: vscode.ExtensionContext) {
    let deploy = vscode.commands.registerCommand("sfhelper.deploy", () => {
        executeCommand("DEPLOY");
    });

    let retrieve = vscode.commands.registerCommand("sfhelper.retrieve", () => {
        executeCommand("RETRIEVE");
    });

    let runTest = vscode.commands.registerCommand("sfhelper.runTest", () => {
        executeCommand("RUN TEST");
    });

    let deleteDebugLogs = vscode.commands.registerCommand(
        "sfhelper.deleteDebugLogs",
        () => {
            executeCommand("DELETE DEBUG LOGS");
        }
    );

    let openDropdown = vscode.commands.registerCommand(
        "sfhelper.openDropdown",
        () => {
            const items = [
                {
                    label: "SF Helper: Deploy Active File",
                    command: "sfhelper.deploy",
                },
                {
                    label: "SF Helper: Retrieve Active File",
                    command: "sfhelper.retrieve",
                },
                {
                    label: "SF Helper: Run Active Test Class",
                    command: "sfhelper.runTest",
                },
                {
                    label: "SF Helper: Delete All Debug Logs",
                    command: "sfhelper.deleteDebugLogs",
                },
            ];

            vscode.window.showQuickPick(items).then((selectedItem) => {
                if (selectedItem) {
                    vscode.commands.executeCommand(selectedItem.command);
                }
            });
        }
    );

    context.subscriptions.push(deploy);
    context.subscriptions.push(retrieve);
    context.subscriptions.push(runTest);
    context.subscriptions.push(deleteDebugLogs);
    context.subscriptions.push(openDropdown);
}

function executeCommand(command: string) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("No active editor found.");
        return;
    }

    const filePath = editor.document.uri.fsPath;

    let terminal = vscode.window.activeTerminal;
    if (!terminal) {
        terminal = vscode.window.createTerminal("SFHelper");
    }

    terminal.sendText(`echo "${command}: ${filePath}"`);
    terminal.show();
}

export function deactivate() {}
