import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

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
            command: "sfhelper.executeAnonymousCode",
            action: "executeAnonymousCode",
            label: "Execute Anonymous Code (Requires Powershell)",
        },
        {
            command: "sfhelper.monitorDebugLogs",
            action: "monitorDebugLogs",
            label: "Monitor Debug Logs (Requires Powershell)",
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
                switch (action) {
                    case "executeAnonymousCode":
                        executeAnonymousCode();
                        break;
                    case "monitorDebugLogs":
                        monitorLogs();
                        break;
                    case "deleteDebugLogs":
                        deleteLogs();
                        break;
                    default:
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
                if (selectedItem) {
                    switch (selectedItem.action) {
                        case "executeAnonymousCode":
                            executeAnonymousCode();
                            break;
                        case "monitorDebugLogs":
                            monitorLogs();
                            break;
                        case "deleteDebugLogs":
                            deleteLogs();
                            break;
                        default:
                            executeCommand(selectedItem.action);
                    }
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
            filePath = path.basename(filePath, path.extname(filePath));
            break;
        default:
            break;
    }

    let terminal = getTerminal();
    terminal.sendText(`${cmdPrefix} ${filePath} ${cmdSuffix}`);
    terminal.show();
}

function executeAnonymousCode() {
    if (
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
    ) {
        const fileName = "anonymouscode.apex";
        const filePath = path.join(
            vscode.workspace.workspaceFolders[0].uri.fsPath,
            fileName
        );

        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(
                filePath,
                "// Write your Apex code here, then press Ctrl+S to execute anonymously.",
                "utf-8"
            );
        }

        vscode.workspace
            .openTextDocument(vscode.Uri.file(filePath))
            .then((document) => {
                vscode.window.showTextDocument(document).then(() => {
                    vscode.workspace.onWillSaveTextDocument((event) => {
                        if (
                            event.document.fileName === filePath &&
                            event.reason ===
                                vscode.TextDocumentSaveReason.Manual
                        ) {
                            const terminal = getTerminal();
                            terminal.sendText(
                                "sf apex run -f ./anonymouscode.apex"
                            );
                            terminal.sendText("del anonymouscode.apex");
                            terminal.show();
                        }
                    });
                });
            });
    }
}

async function monitorLogs() {
    const terminalPath = powershellPath();
    if (!terminalPath) {
        vscode.window.showErrorMessage("Powershell not found.");
        return;
    }

    const terminal = getTerminal(terminalPath, true);
    try {
        const debugLevelData = await fetchDataFromDebugLevel(terminal);
        let debugLevelName =
            debugLevelData && debugLevelData.result
                ? debugLevelData.result?.records[0]?.DeveloperName
                : null;

        if (!debugLevelName) {
            debugLevelName = "SF_Helper";
            createDebugLevel(terminal, debugLevelName);
        }

        terminal.sendText(`del debugLevel.json`);
        terminal.sendText(`clear`);
        terminal.sendText(
            `sf apex tail log -c -d ${debugLevelName} | select-string -pattern "assert|error"`
        );
    } catch (error) {
        console.error(error);
        return;
    }
    terminal.show();
}

async function fetchDataFromDebugLevel(terminal: vscode.Terminal) {
    terminal.sendText(
        'sf data query -q "SELECT Id, DeveloperName FROM DebugLevel" -t -r "json" | out-file -encoding oem debugLevel.json'
    );
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const data = fs.readFileSync("debugLevel.json", "utf8");
    return JSON.parse(data);
}

function createDebugLevel(terminal: vscode.Terminal, debugLevelName: string) {
    terminal.sendText(
        `sf data create record -s DebugLevel -t -v "DeveloperName=${debugLevelName} MasterLabel=${debugLevelName} ApexCode=FINEST ApexProfiling=FINER Callout=DEBUG Database=DEBUG System=DEBUG Validation=FINE Visualforce=FINE"`
    );
}

function deleteLogs() {
    let terminalPath = powershellPath();
    if (!terminalPath) {
        vscode.window.showErrorMessage("Powershell not found.");
        return;
    }

    const terminal = getTerminal(terminalPath);
    terminal.sendText(
        `sf data query -q "SELECT Id FROM ApexLog ORDER BY loglength DESC" -r "csv" | out-file -encoding oem debugLogs.csv | sf data delete bulk -s ApexLog -f debugLogs.csv`
    );
    terminal.sendText(`del debugLogs.csv`);
    terminal.show();
}

export function deactivate() {}
