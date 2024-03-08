import { execSync } from "child_process";

function powershellPath() {
    try {
        const paths = execSync("where.exe powershell.exe pwsh.exe", {
            encoding: "utf8",
        })
            .trim()
            .split("\r\n");

        if (paths.length > 0) {
            return paths[0];
        }
    } catch (error) {
        console.log(error);
    }
}

export { powershellPath };
