"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWebviewHtml = getWebviewHtml;
function getWebviewHtml(instrName, params) {
    const inputs = params
        .map(p => `
		  <div class="param-row">
			<label for="${p.name}">${p.name}</label>
			<input id="${p.name}" name="${p.name}" value="${p.defaultValue}" />
		  </div>
		`)
        .join('<br>');
    return `
	  <!DOCTYPE html>
	  <html lang="en">
	  <head>
		<meta charset="UTF-8" />
		<style>
		  body { 
			font-family: sans-serif; 
			padding: 1rem; 
			max-width: 500px;
		  }
		  .param-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 0.1rem;
		  }
		  label {
			font-size: 0.9rem;
			width: 45%; /* Label width */
			padding-right: 0.5rem; /* Space between label and input */
		  }
		  input {
			width: 50%; /* Adjust input field width */
			padding: 0.2rem 0.4rem;
			font-size: 0.85rem;
		  }
		  button { 
			margin-top: 0.1rem; 
			padding: 0.3rem 0.8rem; 
			font-size: 0.9rem; 
			font-weight: bold; 
		  }
		</style>
	  </head>
	  <body>
		<h2>Run McStas Simulation: ${instrName}</h2>
		<form id="paramForm">
		  ${inputs}
		  <button type="submit">Run Simulation</button>
		</form>
  
		<script>
		  const vscode = acquireVsCodeApi();
		  document.getElementById('paramForm').addEventListener('submit', (e) => {
			e.preventDefault();
			const form = e.target;
			const values = {};
			for (const el of form.elements) {
			  if (el.name) values[el.name] = el.value;
			}
			vscode.postMessage({ command: 'run', values });
		  });
		</script>
	  </body>
	  </html>
	`;
}
//# sourceMappingURL=mcrunView.js.map