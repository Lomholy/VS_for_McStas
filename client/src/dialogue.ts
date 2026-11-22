import * as vscode from 'vscode';
import * as data from '../../server/python/src/mcstas_ls/data/mcstas-comps.json'
import { cspMeta, escapeHtml, newNonce } from './mcrunView';

export async function openCompDialog(filePath: string) {
    const comp_json = getcomp(filePath);
    if (!comp_json) {
        return;
    }
    const header = comp_json.name
    // A null default means the parameter is required; its field starts empty
    const parameters = Object.entries(comp_json.parameter_defaults).map(([name, value]) => ({
    name,
    value: value === null ? '' : String(value)
    }));
    const units = Object.fromEntries(
    Object.entries(comp_json.parameter_units).map(([name, value]) => [name, String(value)])
    );

    const comments = Object.fromEntries(
    Object.entries(comp_json.parameter_comments).map(([name, value]) => [name, String(value)])
    );

    const panel = vscode.window.createWebviewPanel(
        'compDialog',
        'Component Parameters',
        vscode.ViewColumn.Two,
        { enableScripts: true,
            retainContextWhenHidden: true
         }
    );

    panel.webview.html = getWebviewContent(header, parameters, units, comments);




    panel.webview.onDidReceiveMessage((message) => {
        const { command, parameters, oldParameters } = message;

        if (command === 'submit' || command === 'writeComponent') {
            // Your existing logic
            const instanceName = parameters['instanceName'] || 'my_component';
            const position = parameters['position'] || '0, 0, 0';
            const relativeAT = parameters['relativeAT'] || 'PREVIOUS';
            const rotation = parameters['rotation'] || '0, 0, 0';
            const relativeROT = parameters['relativeROT'] || 'PREVIOUS';

            delete parameters['instanceName'];
            delete parameters['position'];
            delete parameters['relativeAT'];
            delete parameters['rotation'];
            delete parameters['relativeROT'];
            
            const formattedParams = Object.entries(parameters)
            .filter(([key, val]) => {
                const oldVal = oldParameters.find((p: ComponentParameterInfo) => p.name === key)?.value;
                return val !== oldVal;
            })
            .filter(([_, val]) => val !== undefined && val !== '')
            .map(([key, val]) => `${key} = ${val}`)
            .join(',\n    ');

            const formattedComponent = `COMPONENT ${instanceName} = ${header}(\n    ${formattedParams}\n) AT (${position}) RELATIVE ${relativeAT}\nROTATED (${rotation}) RELATIVE ${relativeROT}`;

            panel.webview.html = `
            <html>
                <head>${cspMeta()}</head>
                <body>
                <h2>Generated Component Declaration</h2>
                <pre>${escapeHtml(formattedComponent)}</pre>
                </body>
            </html>
            `;
        }

        if (command === 'writeMcstasScript') {
            const instanceName = parameters['instanceName'] || 'my_component';
            const componentType = header;
            const relativeAT = parameters['relativeAT'] || 'PREVIOUS';
            const position = parameters['position']||'[0,0,0]';
            const rotation = parameters['rotation']||'[0,0,0]';
            const relativeROT = parameters['relativeROT'] || 'PREVIOUS';
            const defaultPosition = '[0,0,0]';
            const defaultRotation = '[0,0,0]';

            // Remove meta fields from parameter list
            delete parameters['instanceName'];
            delete parameters['position'];
            delete parameters['relativeAT'];
            delete parameters['rotation'];
            delete parameters['relativeROT'];
            

            const oldParametersMap = Object.fromEntries(
                oldParameters.map((p: ComponentParameterInfo)=> [p.name, p.value])
                );
           const paramEntries = Object.entries(parameters)
                .filter(([key, val]) => {
                    const defaultVal = oldParametersMap[key];
                    return val !== undefined && val !== '' && val !== defaultVal;
                });
            
            const paramLine = paramEntries.length > 0
                ? `${instanceName}.set_parameters(${paramEntries.map(([k, v]) => `${k}=${v}`).join(', ')})`
                : ''; // No param line if empty
            let relativeBlock = '';

            if (relativeROT!='PREVIOUS') {
            relativeBlock = `,AT_RELATIVE="${relativeAT}",\nROTATED_RELATIVE="${relativeROT}"`;
            } else {
            relativeBlock = `,RELATIVE="${relativeAT}"`;
            }
            const atLine = position !== defaultPosition ? `,AT=[${position}]` : '';
            const rotatedLine = rotation !== defaultRotation ? `,ROTATED=[${rotation}]` : '';

            const scriptOutput = `${instanceName} = instrument.add_component("${instanceName}", 
"${componentType}"
${atLine} ${rotatedLine} ${relativeBlock}
)
${paramLine}
            `;

            panel.webview.html = `
                <html>
                <head>${cspMeta()}</head>
                <body>
                    <h2>McStasScript Output</h2>
                    <pre style="background: #111; color: #FFFFFF; padding: 1em; font-family: monospace;">${escapeHtml(scriptOutput)}</pre>
                </body>
                </html>
            `;
        }
    }); 
}


function getWebviewContent(header: string, parameters: ComponentParameterInfo[],
                         units: { [key: string]: string }, comments: { [key: string]: string }): string {
    const oldParameters = JSON.parse(JSON.stringify(parameters));
    const nonce = newNonce();
    return `
        <html>
            <head>${cspMeta(nonce)}</head>
            <body>
                 <style>
                   .form-row {
                        display: grid;
                        grid-template-columns: 150px 1fr 80px 1fr;
                        align-items: center;
                        gap: 10px;
                        margin-bottom: 10px;
                    }
                    .form-label {
                        font-weight: 600;
                    }
                    .custom-box {
                        width: 100%;
                        box-sizing: border-box;
                    }
                    .unit {
                        color: var(--vscode-foreground);
                        font-size: 1em; /* You can increase to 1.1em, 1.2em, etc. */
                        text-align: right;
                    }

                    .comment {
                        color: var(--vscode-foreground);
                        font-size: 1em;
                    }
                    .custom-box {
                        border: 2px solid #2196F3;
                        border-radius: 4px;
                        padding: 5px;
                        color: var(--vscode-input-foreground);
                        background-color: transparent;
                    }
                    .param-separator {
                    border: none;
                    border-top: 1px solid #00ff00;
                    margin: 8px 0;
                    }
                    .form-input {
                        display: inline-block;
                    }
                    </style>
                <h2>${escapeHtml(header)}</h2>
                <h3>Component Instance</h3>
                <form id="compForm">
                    <div>
                        <label class="form-label" for="instanceName">Instance Name</label>
                        <input type="text" class="custom-box form-input" id="instanceName" name="instanceName" placeholder="e.g., my_component">
                    </div>
                    <h3>Parameters</h3>
                    ${parameters.map(param => `
                    <div class="form-row">
                        <label class="form-label" for="${escapeHtml(param.name)}">${escapeHtml(param.name)}</label>
                        <input type="text" class="custom-box form-input" id="${escapeHtml(param.name)}" name="${escapeHtml(param.name)}" value="${escapeHtml(param.value)}"${param.value === '' ? ' placeholder="required"' : ''}>
                        <div class="unit">[${escapeHtml(units[param.name] || '')}]</div>
                        <div class="comment">${escapeHtml(comments[param.name] || '')}</div>
                    </div>
                    <hr class="param-separator">
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
                    
                    <button type="submit" name="action" value="writeComponent">Write out to McStas</button>
                    <button type="submit" name="action" value="writeMcstasScript">Write out to mcstasscript</button>
                </form>

                <script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    const oldParameters = ${JSON.stringify(oldParameters).replace(/</g, '\\u003c')};

                    document.getElementById('compForm').onsubmit = (e) => {
                        e.preventDefault();
                        const formData = new FormData(e.target);
                        const submitButton = e.submitter;
                        const action = submitButton?.value; // Will be either "writeComponent" or "writeMcstasScript"

                        const parameters = {};
                        let hasEmpty = false;
                        const specialKeys = ['position', 'rotation', 'relativeROT', 'relativeAT', 'instanceName'];

                        formData.forEach((value, key) => {
                        if (!specialKeys.includes(key) && value.trim() === '') {
                            hasEmpty = true;
                        }
                        parameters[key] = value.trim();
                        });

                        if (hasEmpty) {
                        alert('Please fill in all parameters before submitting.');
                        return;
                        }

                        vscode.postMessage({ command: action, parameters, oldParameters });
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

function getcomp(component: string) {
    const comp_name = component.split("/").pop().split('.')[0];
    const comp = data[comp_name]
    if (typeof comp !== 'object' || comp === null) {
        vscode.window.showErrorMessage(`Error: ${comp_name} was not parsed correctly by McStas, so it cannot be shown as a component`)
        return undefined;
    }
    return comp;
}