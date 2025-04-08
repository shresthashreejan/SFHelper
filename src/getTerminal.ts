import * as vscode from "vscode";
import { execSync } from "child_process";
import os from 'os';

const platform = os.platform();

function getTerminal(isLogsTerminal: boolean)
{
    const terminalName = isLogsTerminal ? "SF Helper Logs" : "SF Helper";
    const terminal = vscode.window.terminals.find(
        (t) => t.name === terminalName
    );

    if(!terminal)
    {
        let shellPath;
        if(platform === 'win32')
        {
            try {
                const paths = execSync("where.exe powershell.exe pwsh.exe", {
                    encoding: "utf8",
                }).trim().split("\r\n");
                
                if(paths.length > 0)
                {
                    shellPath = paths[0];
                }
            }
            catch(error)
            {
                vscode.window.showErrorMessage("Powershell not found.");
            }
        }
        else
        {
            shellPath = "/bin/bash";
        }

        return vscode.window.createTerminal({
            name: terminalName,
            ...(shellPath && { shellPath }),
        });
    }

    return terminal;
}

export { getTerminal };