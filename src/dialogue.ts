import * as fs from 'fs';
import * as vscode from 'vscode';
// Function to open the dialog with component parameters
export async function openCompDialog(filePath: string) {
    const { header, parameters } = await parseCompFile(filePath);

    // Create a Webview Panel
    const panel = vscode.window.createWebviewPanel(
        'compDialog',
        'Component Parameters',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    // Create the HTML content for the Webview
    const content = `
        <html>
            <body>
                <h2>${header}</h2>
                <h3>Parameters</h3>
                <form id="compForm">
                    ${parameters.map(param => `
                        <div>
                            <label for="${param.name}">${param.name} </label>
                            <input type="text" id="${param.name}" name="${param.name}" value="${param.value || ''}">
                        </div>
                    `).join('')}
                    <button type="submit">Submit</button>
                </form>
                <script>
                    const vscode = acquireVsCodeApi();
                    document.getElementById('compForm').onsubmit = (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const parameters = {};
                        formData.forEach((value, key) => {
                            parameters[key] = value;
                        });
                        vscode.postMessage({ command: 'submit', parameters });
                    };
                </script>
            </body>
        </html>
    `;

    panel.webview.html = content;

    // Handle submitted form data
    panel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'submit') {
            // console.log('Form data:', message.parameters);
            // Here, you could save the data or perform further actions
        }
    });
}

// Types for component parameters
interface ComponentParameterInfo {
    name: string;
    value: string;
}

// Function to match and parse component parameters from the file's header
// function matchDocStringsToPars(headerPSection: string): ComponentParameterInfo[] {
//     const lines = headerPSection.split('\n');
//     const parameters: ComponentParameterInfo[] = [];
//     let lastPar: ComponentParameterInfo | null = null;

//     lines.forEach(line => {
//         const match = /(\w+):\s*(.*)/.exec(line);
//         if (match) {
//             if (lastPar) {
//                 lastPar.docAndUnit += ` ${match[2].trim()}`;
//             } else {
//                 // Creating a new parameter object when we find the first match
//                 lastPar = { name: match[1], value: match[2].trim(), docAndUnit: match[2].trim() };
//                 parameters.push(lastPar);
//             }
//         }
//     });
//     // console.log(parameters)
//     return parameters;
// }

// Parsing the .comp file to extract header and parameters
async function parseCompFile(filePath: string): Promise<{ header: string; parameters: ComponentParameterInfo[] }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    let parameters: ComponentParameterInfo[] = []
    // Regex to extract the header part (assuming it's between /* and */)
    const headerMatch = content.match(/Component:\s*(\w+)/);
    const header = headerMatch ? headerMatch[1].trim() : '';


    // Step 1: Match the line containing "SETTING PARAMETERS (...)"
    const match = content.match(/SETTING PARAMETERS\s*\(([^)]*)\)/m);
    let insideParentheses: string =""
    
    if (match) {// Check for null

        console.log(match[0])

        insideParentheses = match[0].split('(')[1]; // This is the content inside (...)
        insideParentheses = insideParentheses.replace(")", "");
    }
    // Step 2: Extract each "key=value" pair
    const params: Record<string, string> = {};
    const pairs = insideParentheses.split(',').map(pair => pair.trim());

    for (const pair of pairs) {
        const [key, value] = pair.split('=').map(part => part.trim());
        if (key && value !== undefined) {
            params[key] = value;
            console.log(key,value);
        }
        parameters.push({name:key, value: value})
    }
    return { header, parameters };
}