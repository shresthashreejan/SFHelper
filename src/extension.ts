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
            command: "sfhelper.monitorDebugLogs",
            action: "monitorDebugLogs",
            label: "Monitor Debug Logs (Experimental)",
        },
        {
            command: "sfhelper.executeAnonymousCode",
            action: "executeAnonymousCode",
            label: "Execute Anonymous Code (Experimental)",
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
                if (action === "monitorDebugLogs") {
                    monitorLogs();
                } else if (action === "executeAnonymousCode") {
                    console.log("executeAnonymousCode");
                } else if (action === "deleteDebugLogs") {
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
                if (selectedItem) {
                    switch (selectedItem.action) {
                        case "monitorDebugLogs":
                            monitorLogs();
                            break;
                        case "executeAnonymousCode":
                            executeAnonymousCode();
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
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const data = fs.readFileSync("debugLevel.json", "utf8");
    return JSON.parse(data);
}

function createDebugLevel(terminal: vscode.Terminal, debugLevelName: string) {
    terminal.sendText(
        `sf data create record -s DebugLevel -t -v "DeveloperName=${debugLevelName} MasterLabel=${debugLevelName} ApexCode=FINEST ApexProfiling=FINER Callout=DEBUG Database=DEBUG System=DEBUG Validation=FINE Visualforce=FINE"`
    );
}

function executeAnonymousCode() {
    const fileName = "anonymousCode.apex";

    if (
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
    ) {
        const filePath = path.join(
            vscode.workspace.workspaceFolders[0].uri.fsPath,
            fileName
        );

        vscode.workspace
            .openTextDocument(vscode.Uri.file(filePath))
            .then((document) => {
                vscode.window.showTextDocument(document).then(() => {
                    vscode.workspace.onDidSaveTextDocument((savedDocument) => {
                        if (savedDocument.fileName === filePath) {
                            const terminal = getTerminal();
                            terminal.sendText(
                                "sf apex run -f ./anonymousCode.apex"
                            );
                            terminal.sendText("del anonymousCode.apex");
                            terminal.show();
                        }
                    });
                });
            });
    } else {
        vscode.window.showErrorMessage("No workspace found.");
    }
}

export function deactivate() {}
