import { RequestMessage } from "../server";
import { spawn } from 'child_process';
import log from '../log'
import * as path from 'path';

type ServerCapabilities = Record<string, unknown>;


interface InitializeResult {
	capabilities: ServerCapabilities;

	serverInfo?: {
		
		name: string;

		version?: string;
	};
}
async function printcomponents(url: string) {
  try{
    const response = await fetch(url)

    const text = await response.text(); // or use response.json() if it's JSON
    log.write(text); // Now logs the actual response content
  } catch (error) {
    log.write(`Error fetching from Flask server: ${error}`);
  }

}

async function waitForServerReady(url: string, timeout = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url); 
      const text = await res.text();
      log.write(text);
      if (res.ok) return;
    } catch (_) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  log.write('Error: server not reachable');
  throw new Error("Server did not start in time");
}

export const initialize = (message: RequestMessage): InitializeResult => {
    log.write("Inside Initialization!");
    // const mccodePath = path.join(__dirname, '../../', 'McCode/mcstas-comps')

    
    (async () => {
      try {
        await waitForServerReady('http://127.0.0.1:5000/');
        await printcomponents('http://127.0.0.1:5000/get_all_comps');
      } catch (error) {
        log.write(`Error waiting for server: ${error}`);
      }
    })();


    return {
        capabilities: {completionProvider: {}, textDocumentSync: 1},
        serverInfo: {
            name: "lsp-from-scratch",
            version: "0.0.1"
        }
    }
};