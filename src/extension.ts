import * as vscode from "vscode";
import * as path from "path";

import { powershellPath } from "./powershellPath";
import { getTerminal } from "./getTerminal";

export function activate(context: vscode.ExtensionContext) {
    const commands = [
        {
            command: "sfhelper.deploy",
            action: "deploy",
            label: "Deploy Active File",
        },
        {
            command: "sfhelper.deployFolder",
            action: "deployFolder",
            label: "Deploy Active Folder",
        },
        {
            command: "sfhelper.retrieve",
            action: "retrieve",
            label: "Retrieve Active File",
        },
        {
            command: "sfhelper.retrieveFolder",
            action: "retrieveFolder",
            label: "Retrieve Active Folder",
        },
        {
            command: "sfhelper.runTest",
            action: "runTest",
            label: "Run Active Test Class",
        },
        {
            command: "sfhelper.deleteDebugLogs",
            action: "deleteDebugLogs",
            label: "Delete All Debug Logs (Requires Powershell)",
        },
    ];

    commands.forEach(({ command, action }) => {
        context.subscriptions.push(
            vscode.commands.registerCommand(command, () => {
                if (action === "deleteDebugLogs") {
                    deleteLogs();
                } else {
                    executeCommand(action);
                }
            })
        );
    });

    let items = commands.map(({ label, action }) => ({
        label: `SF Helper: ${label}`,
        action: `${action}`,
    }));

    let openDropdown = vscode.commands.registerCommand(
        "sfhelper.openDropdown",
        () => {
            vscode.window.showQuickPick(items).then((selectedItem) => {
                if (selectedItem && selectedItem.action === "deleteDebugLogs") {
                    deleteLogs();
                } else if (selectedItem) {
                    executeCommand(selectedItem.action);
                }
            });
        }
    );
    context.subscriptions.push(openDropdown);
}

function executeCommand(action: string) {
    const editor = vscode.window.activeTextEditor;
    let cmdPrefix: string = "";
    let cmdSuffix: string = "";

    if (!editor) {
        vscode.window.showErrorMessage("No active editor found.");
        return;
    }
    let filePath = editor.document.uri.fsPath;

    switch (action) {
        case "deploy":
            cmdPrefix = "sf project deploy start -d";
            cmdSuffix = "-c";
            break;
        case "deployFolder":
            cmdPrefix = "sf project deploy start -d";
            cmdSuffix = "-c";
            filePath = path.dirname(filePath);
            break;
        case "retrieve":
            cmdPrefix = "sf project retrieve start -d";
            cmdSuffix = "-c";
            break;
        case "retrieveFolder":
            cmdPrefix = "sf project retrieve start -d";
            cmdSuffix = "-c";
            filePath = path.dirname(filePath);
            break;
        case "runTest":
            cmdPrefix = "sf apex run test -n";
            cmdSuffix = "-r human -c -y";
            break;
        default:
            break;
    }

    let terminal = getTerminal();
    terminal.sendText(`${cmdPrefix} ${filePath} ${cmdSuffix}`);
    terminal.show();
}

function deleteLogs() {
    let terminalPath = powershellPath();
    if (terminalPath && terminalPath != null) {
        let terminal = getTerminal(terminalPath);
        terminal.sendText(
            `sf data query -q "SELECT Id FROM ApexLog ORDER BY loglength DESC" -r "csv" | out-file -encoding oem debugLogs.csv | sf data delete bulk -s ApexLog -f debugLogs.csv`
        );
        setTimeout(() => {
            terminal.sendText(`del debugLogs.csv`);
        }, 3000);
        terminal.show();
    } else {
        let terminal = getTerminal();
        terminal.sendText(`echo "Powershell not found."`);
        terminal.show();
    }
}

export function deactivate() {}
