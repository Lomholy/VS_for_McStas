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
            console.log(message)
            const submitted = message.parameters;
            const original: ComponentParameterInfo[] = message.oldParameters
            
    
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
            
    
            const formattedParams = Object.entries(submitted)
            .filter(([key, val]) => {
                // Only include parameters that have changed (submitted value is different from old value)
                const oldVal = original.find(p => p.name === key)?.value;
                return val !== oldVal;  // Include only parameters that have changed
            })
            .filter(([key, val]) => val !== undefined && val !== '')  // Only include parameters with values
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
    const oldParameters = JSON.parse(JSON.stringify(parameters));
    return `
        <html>
            <body>
                 <style>
                    .custom-box {
                        border: 2px solid #2196F3;
                        border-radius: 4px;
                        padding: 5px;
                        color: white;
                        text-shadow: -1px -1px 0 black,
                                    1px -1px 0 black,
                                    -1px 1px 0 black,
                                    1px 1px 0 black;
                        background-color: transparent;
                    }
                    .form-row {
                        font-family: monospace; /* Ensures character spacing is consistent */
                        margin-bottom: 10px;
                    }

                    .form-label {
                        display: inline-block;
                        width: 30ch; /* 30 character spaces wide */
                        vertical-align: middle;
                    }

                    .form-input {
                        display: inline-block;
                        vertical-align: middle;
                    }
                    </style>
                <h2>${header}</h2>
                <h3>Component Instance</h3>
                <form id="compForm">
                    <div>
                        <label class="form-label" for="instanceName">Instance Name</label>
                        <input type="text" class="custom-box form-input" id="instanceName" name="instanceName" placeholder="e.g., my_component">
                    </div>
                    <h3>Parameters</h3>
                    ${parameters.map(param => `
                        <div>
                            <label class="form-label" for="${param.name}">${param.name}</label>
                            <input align="center" type="text" 
                                class="custom-box form-input"
                                id="${param.name}" name="${param.name}" value="${param.value || ''}">
                        </div>
                        
                    `).join('')}
                    <div>
                        <label class="form-label" align="left" for="position">Position (x, y, z)</label>
                        <input type="text" 
                            class="custom-box form-input"
                            id="position" 
                            name="position" 
                            placeholder="e.g., 0, 0, 0">
                    </div>
                    <div>
                        <label class="form-label" align="left" for="relativeAT">Relative To</label>
                        <input type="text" 
                                class="custom-box form-input" 
                                id="relativeAT" 
                                name="relativeAT" 
                                placeholder="e.g., origin">
                    </div>
                    <div>
                        <label class="form-label" align="left" for="rotation">Rotation (x, y, z)</label>
                        <input type="text" 
                                class="custom-box form-input" 
                                id="rotation" 
                                name="rotation" 
                                placeholder="e.g., 0, 0, 0">
                    </div>
                    <div>
                        <label class="form-label" align="left" for="relativeROT">Relative To</label>
                        <input type="text" 
                                class="custom-box form-input" 
                                id="relativeROT" 
                                name="relativeROT" 
                                placeholder="e.g., origin">
                    </div>
                    <button type="submit" >Write out Component</button>
                </form>
                <script>
                    const vscode = acquireVsCodeApi();
                    const oldParameters = ${JSON.stringify(oldParameters)};
                    document.getElementById('compForm').onsubmit = (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const parameters = {};
                        let hasEmpty = false;
                        const specialKeys = ['position', 
                                            'rotation', 
                                            'relativeROT', 
                                            'relativeAT',
                                            'instanceName'];
                        formData.forEach((value, key) => {
                            if (!specialKeys.includes(key)){
                                if (value.trim() === '') {
                                    hasEmpty = true;
                                }
                        }
                            parameters[key] = value.trim();
                        });

                        if (hasEmpty) {
                            alert('Please fill in all parameters before submitting.');
                            return;
                        }

                        vscode.postMessage({ command: 'submit', parameters, oldParameters});
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