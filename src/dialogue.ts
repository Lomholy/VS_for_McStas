import * as fs from 'fs';
import * as vscode from 'vscode';

export async function openCompDialog(filePath: string) {
    const { header, parameters } = await parseCompFile(filePath);

    const panel = vscode.window.createWebviewPanel(
        'compDialog',
        'Component Parameters',
        vscode.ViewColumn.One,
        { enableScripts: true }
    );

    panel.webview.html = getWebviewContent(header, parameters);

    // Handle submitted form data
    panel.webview.onDidReceiveMessage((message) => {
        if (message.command === 'submit') {
            const submitted = message.parameters;
    
            const instanceName = submitted['instanceName'] || 'my_component';
            const position = submitted['position'] || '0, 0, 0';
            const relativeAT = submitted['relativeAT'] || 'origin';
            const rotation = submitted['rotation'] || '0, 0, 0';
            const relativeROT = submitted['relativeROT'] || 'origin';
    
            // Remove meta fields
            delete submitted['instanceName'];
            delete submitted['position'];
            delete submitted['relativeAT'];
            delete submitted['rotation'];
            delete submitted['relativeROT'];
            
    
            // Format parameters over multiple lines
            const formattedParams = Object.entries(submitted)
                .map(([key, val]) => `${key} = ${val}`)
                .join(',\n    ');
    
            const formattedComponent = `COMPONENT ${instanceName} = ${header}(\n    ${formattedParams}\n) AT (${position}) RELATIVE ${relativeAT}\nROTATED (${rotation}) RELATIVE ${relativeROT}`;
    
            panel.webview.html = `
                <html>
                    <body>
                        <h2>Generated Component Declaration</h2>
                        <pre>${formattedComponent}</pre>
                    </body>
                </html>
            `;
        }
    });
    
}
function getWebviewContent(header: string, parameters: ComponentParameterInfo[]): string {
    return `
        <html>
            <body>
                <h2>${header}</h2>
                <h3>Component Instance</h3>
                <form id="compForm">
                    <div>
                        <label for="instanceName">Instance Name</label>
                        <input type="text" id="instanceName" name="instanceName" placeholder="e.g., my_component">
                    </div>
                    <div>
                        <label for="position">Position (x, y, z)</label>
                        <input type="text" id="position" name="position" placeholder="e.g., 0, 0, 1">
                    </div>
                    <div>
                        <label for="relativeAT">Relative To</label>
                        <input type="text" id="relativeAT" name="relative" placeholder="e.g., origin">
                    </div>
                    <div>
                        <label for="rotation">Rotation (x, y, z)</label>
                        <input type="text" id="rotation" name="rotation" placeholder="e.g., 0, 0, 0">
                    </div>
                    <div>
                        <label for="relativeROT">Relative To</label>
                        <input type="text" id="relativeROT" name="relative" placeholder="e.g., origin">
                    </div>
                    <h3>Parameters</h3>
                    ${parameters.map(param => `
                        <div>
                            <label for="${param.name}">${param.name}</label>
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
}


// Types for component parameters
interface ComponentParameterInfo {
    name: string;
    value: string;
}

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