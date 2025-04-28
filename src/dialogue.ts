import * as fs from 'fs';
import * as vscode from 'vscode';

// Types for component parameters
interface ComponentParameterInfo {
    name: string;
    value: string;
    docAndUnit: string;
}

// Function to match and parse component parameters from the file's header
function matchDocStringsToPars(headerPSection: string): ComponentParameterInfo[] {
    const lines = headerPSection.split('\n');
    const parameters: ComponentParameterInfo[] = [];
    let lastPar: ComponentParameterInfo | null = null;

    lines.forEach(line => {
        const match = /(\w+):\s*(.*)/.exec(line);
        if (match) {
            if (lastPar) {
                lastPar.docAndUnit += ` ${match[2].trim()}`;
            } else {
                // Creating a new parameter object when we find the first match
                lastPar = { name: match[1], value: match[2].trim(), docAndUnit: match[2].trim() };
                parameters.push(lastPar);
            }
        }
    });
    console.log(parameters)
    return parameters;
}

// Parsing the .comp file to extract header and parameters
async function parseCompFile(filePath: string): Promise<{ header: string; parameters: ComponentParameterInfo[] }> {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Regex to extract the header part (assuming it's between /* and */)
    const headerMatch = content.match(/\/\*+\s*\*([\s\S]*?)\*%\s*(?:%I|%D|%P|%E)[\s\S]*\*\//);
    const header = headerMatch ? headerMatch[1].trim() : '';

    // Use the improved parser to match and extract parameter data
    const parameters = matchDocStringsToPars(header); 

    return { header, parameters };
}

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
                <h2>Header Information</h2>
                <pre>${header}</pre>
                <h3>Parameters</h3>
                <form id="compForm">
                    ${parameters.map(param => `
                        <div>
                            <label for="${param.name}">${param.name} (${param.docAndUnit})</label>
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
            console.log('Form data:', message.parameters);
            // Here, you could save the data or perform further actions
        }
    });
}


// import * as fs from 'fs';
// import * as path from 'path';
// import * as vscode from 'vscode';

// async function parseCompFile(filePath: string): Promise<{ header: string; parameters: CompParameter[] }> {
//     const content = fs.readFileSync(filePath, 'utf-8');
    
//     // Regex to extract the parts we're interested in
//     const headerMatch = content.match(/\/\*+\s*\*([\s\S]*?)\*%\s*(?:%I|%D|%P|%E)[\s\S]*\*\//);
//     const header = headerMatch ? headerMatch[1].trim() : '';

//     const paramMatches = content.match(/%P[\s\S]*?([a-zA-Z_][\w]*)\s*:\s*\[(.*?)\](.*?)\n/g);

//     const parameters: CompParameter[] = paramMatches ? paramMatches.map(paramMatch => {
//         const parts = paramMatch.split(/\s*:\s*\[|\]\s+/);
//         return {
//             name: parts[0].trim(),
//             description: parts[2].trim(),
//             value: parts[1].trim() // Store the default value (optional)
//         };
//     }) : [];

//     return { header, parameters };
// }

// export async function openCompDialog(filePath: string) {
//     const { header, parameters } = await parseCompFile(filePath);

//     // Create a Webview Panel
//     const panel = vscode.window.createWebviewPanel(
//         'compDialog',
//         'Component Parameters',
//         vscode.ViewColumn.One,
//         { enableScripts: true }
//     );

//     // Create the HTML content for the Webview
//     const content = `
//         <html>
//             <body>
//                 <h2>Header Information</h2>
//                 <pre>${header}</pre>
//                 <h3>Parameters</h3>
//                 <form id="compForm">
//                     ${parameters.map(param => `
//                         <div>
//                             <label for="${param.name}">${param.name} (${param.description})</label>
//                             <input type="text" id="${param.name}" name="${param.name}" value="${param.value || ''}">
//                         </div>
//                     `).join('')}
//                     <button type="submit">Submit</button>
//                 </form>
//                 <script>
//                     const vscode = acquireVsCodeApi();
//                     document.getElementById('compForm').onsubmit = (e) => {
//                         e.preventDefault();
//                         const formData = new FormData(e.target);
//                         const parameters = {};
//                         formData.forEach((value, key) => {
//                             parameters[key] = value;
//                         });
//                         vscode.postMessage({ command: 'submit', parameters });
//                     };
//                 </script>
//             </body>
//         </html>
//     `;

//     panel.webview.html = content;

//     // Handle submitted form data
//     panel.webview.onDidReceiveMessage((message) => {
//         if (message.command === 'submit') {
//             console.log('Form data:', message.parameters);
//             // Here, you could save the data or perform further actions
//         }
//     });
// }
// interface CompParameter {
//     name: string;
//     description: string;
//     value?: string;
// }