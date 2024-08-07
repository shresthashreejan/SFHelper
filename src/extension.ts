import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import os from "os";

import { getTerminal } from "./getTerminal";

const platform = os.platform();
const unixSystem: boolean = platform !== "win32" ? true : false;

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
            label: "Execute Anonymous Code",
        },
        {
            command: "sfhelper.monitorDebugLogs",
            action: "monitorDebugLogs",
            label: "Monitor Debug Logs",
        },
        {
            command: "sfhelper.deleteDebugLogs",
            action: "deleteDebugLogs",
            label: "Delete All Debug Logs",
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

    let terminal = getTerminal(false);
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

        if (fs.existsSync(filePath)) {
            vscode.workspace
                .openTextDocument(vscode.Uri.file(filePath))
                .then((document) => {
                    vscode.window.showTextDocument(document).then(() => {
                        const willSaveTextDocumentDisposable =
                            vscode.workspace.onWillSaveTextDocument((event) => {
                                if (
                                    event.document.fileName === filePath &&
                                    event.reason ===
                                        vscode.TextDocumentSaveReason.Manual
                                ) {
                                    const terminal = getTerminal(false);
                                    terminal.sendText(
                                        `sf apex run -f ./${fileName}`
                                    );
                                    terminal.show();
                                    const didCloseTextDocumentDisposable =
                                        vscode.workspace.onDidCloseTextDocument(
                                            (document) => {
                                                if (
                                                    document.fileName.endsWith(
                                                        "anonymouscode.apex"
                                                    )
                                                ) {
                                                    let delCommand = unixSystem
                                                        ? "rm"
                                                        : "del";
                                                    terminal.sendText(
                                                        `${delCommand} ${fileName}`
                                                    );
                                                    willSaveTextDocumentDisposable.dispose();
                                                    didCloseTextDocumentDisposable.dispose();
                                                }
                                            }
                                        );
                                }
                            });
                    });
                });
        }
    }
}

async function monitorLogs() {
    const terminal = getTerminal(true);
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

        let monitorCommand = unixSystem
            ? `sf apex tail log -c -d ${debugLevelName} | grep "exception"`
            : `sf apex tail log -c -d ${debugLevelName} | select-string -pattern "exception"`;
        let delCommand = unixSystem ? "rm" : "del";

        terminal.sendText(`${delCommand} debuglevel.json`);
        terminal.sendText(`clear`);
        terminal.sendText(monitorCommand);
    } catch (error) {
        console.error(error);
        return;
    }
    terminal.show();
}

async function fetchDataFromDebugLevel(terminal: vscode.Terminal) {
    let fetchCommand = unixSystem
        ? 'sf data query -q "SELECT Id, DeveloperName FROM DebugLevel" -t -r "json" > debuglevel.json'
        : 'sf data query -q "SELECT Id, DeveloperName FROM DebugLevel" -t -r "json" | out-file -encoding oem debuglevel.json';

    terminal.sendText(fetchCommand);
    await new Promise((resolve) => setTimeout(resolve, 10000));
    const data = fs.readFileSync("debuglevel.json", "utf8");
    return JSON.parse(data);
}

function createDebugLevel(terminal: vscode.Terminal, debugLevelName: string) {
    terminal.sendText(
        `sf data create record -s DebugLevel -t -v "DeveloperName=${debugLevelName} MasterLabel=${debugLevelName} ApexCode=FINEST ApexProfiling=FINER Callout=DEBUG Database=DEBUG System=DEBUG Validation=FINE Visualforce=FINE"`
    );
}

function deleteLogs() {
    let terminal = getTerminal(false);
    let csvFile = "debuglogs.csv";
    let delCommand = unixSystem ? "rm" : "del";
    let delLogsCommand = unixSystem
        ? `sf data query -q "SELECT Id FROM ApexLog ORDER BY loglength DESC" -r "csv" > ${csvFile}`
        : `sf data query -q "SELECT Id FROM ApexLog ORDER BY loglength DESC" -r "csv" | out-file -encoding oem ${csvFile}`;

    terminal.sendText(delLogsCommand);
    terminal.sendText(`sf data delete bulk -s ApexLog -f ${csvFile}`);
    terminal.sendText(`${delCommand} ${csvFile}`);
    terminal.show();
}

export function deactivate() {}
