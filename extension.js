// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('The "yesyoucancoderuby" extension is now active!');
	let rootDir = vscode.workspace.rootPath;
	var chosenExampleNumber = 'none';

	// The code you place here will be executed every time your command is executed
	let currentPanel = vscode.window.createWebviewPanel(
		'yesyoucancoderuby',
		'Yes, You Can Code',
		vscode.ViewColumn.Two,
		{
			// Enable scripts in the webview
			enableScripts: true
		}
	);
	let imageUri = vscode.Uri.file(context.extensionPath + "/media/TitleSlideYesYouCanCode.png");
	const imageSrc = currentPanel.webview.asWebviewUri(imageUri);
	currentPanel.webview.html = getWebviewContent(imageSrc);
	currentPanel.onDidDispose(
	  () => {
		  currentPanel = undefined;
	  },
	  undefined,
	  context.subscriptions
	);
	currentPanel.webview.onDidReceiveMessage(
		message => {
		  switch (message.command) {
			case 'run':
			  console.log("The run button was clicked");
			  runRubyProgram(currentPanel, rootDir, chosenExampleNumber);
			  return;
			case 'start':
			  chosenExampleNumber = message.text;
			  openExample(message.text, rootDir);
			  return;
			case 'alert':
			  vscode.window.showErrorMessage(message.text);
			  return;
		  }
		},
		undefined,
		context.subscriptions
	);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('yesyoucancoderuby.helloWorld', function () {
		console.log("YouCanCode extension activation function was called.");
		//	let cursorPosition = editor.selection.start
		//	var lineCount = cursorPosition.line	
		//	vscode.window.showInformationMessage('The line count is ' + lineCount);
		
		//const { exec } = require("child_process");
		// exec("ruby " + editorFileName, (error, stdout, stderr) => {
		// 	if (error) {
		// 		console.log(`error: ${error.message}`);
		// 		return;
		// 	}
		// 	if (stderr) {
		// 		console.log(`stderr: ${stderr}`);
		// 		return;
		// 	}
		// 	console.log(`stdout: ${stdout}`);
		// });
	});

	context.subscriptions.push(disposable);
}
exports.activate = activate;

function openExample(exampleNumber, rootDir) {
	console.log("Going to open example " + exampleNumber);
	console.log("Root dir is " + rootDir);
	//let workspaceFolderPath = workspaceFolder.uri.path;
	//vscode.Uri.file(path.join(folder.uri.fsPath, 'foo.js'))
	let fileUri = vscode.Uri.file(rootDir + "/problems/example" + exampleNumber + ".rb");
	console.log("Construct uri " + fileUri);
	vscode.workspace.openTextDocument(fileUri).then(
		doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
	);
}

function runRubyProgram(currentPanel, rootDir, chosenExampleNumber) {
	console.log("In runRubyProgram() for example " + chosenExampleNumber);
	openExample(chosenExampleNumber, rootDir);

	let editorFileName = rootDir + "/problems/example" + chosenExampleNumber + ".rb";
	let commandString = "ruby " + editorFileName;
	console.log("Preparing to run ruby using command: " + commandString);

	// Don't create a new terminal if it already exists.
	let theList = vscode.window.terminals;
	let codeTerminal = undefined;
	theList.forEach(element => {
			if (element.name == "Run Your Code") {
				codeTerminal = element;
			}
		}
	);
	if (codeTerminal) {
		console.log("We already have the code terminal window.");
	} else {
		console.log("Creating the code terminal window.");
		codeTerminal = vscode.window.createTerminal("Run Your Code");
	}
	codeTerminal.show(true);
	//let uuid = generatedRunId();
	//codeTerminal.sendText("echo " + uuid, true);
	codeTerminal.sendText("clear", true);
	codeTerminal.sendText(commandString, true);

	setTimeout(function(){ getCommandOutput(currentPanel, chosenExampleNumber); }, 1000);

}
function timeout(currentPanel) {
    setTimeout(function () {
		if (getCommandOutput(currentPanel)) {
			// done
		} else {
			console.log("Going to set timeout for another second. ");
			var today = new Date();
			var strTime = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
			console.log("Sleeping at " + strTime);
		    timeout();
		}
    }, 1000);
}
// 9ADCFF   baby blue
// 5299D5   darker blue
// C684C1   purple
// 699A52   green this one
function getWebviewContent(imageUri) {
	return `<!DOCTYPE html>
  <html lang="en">
  <head>
	  <meta charset="UTF-8">
	  <meta name="viewport" content="width=device-width, initial-scale=1.0">
	  <title>Yes, You Can Code</title>
  </head>
  <body>
	  <h2>Ruby Helper</h2>
	  <img src="${imageUri}"/><br/>
	  <table border="0" width="100%">
	    <tr>
		  <td><button onClick="runButton()">Run Your Code</button></td>
		  <td>Hello there.</td>
		</tr>
	    <tr>
		  <td><a href="#" onClick="startProblem('1')" >Run Problem 1</a></td>
		  <td><a href="#" onClick="startProblem('2')" >Run Problem 2</a></td>
		</tr>
	  </table>

	  <br/>
	  <h2>Output</h2>
	  <div id="output" style="color: #CF9176; border:1px solid #2196F3; border-radius: 5px;">&nbsp;<br/>&nbsp;</div>
	  <h2>Feedback</h2>
	  <div id="feedback" style="color: #DCDDA7; border:1px solid #2196F3; border-radius: 5px;">&nbsp;<br/>&nbsp;</div>
	  <script>
		  const vscode = acquireVsCodeApi();
		  
		  function runButton() {
			vscode.postMessage({
				command: 'run',
				text: 'This will get ignored but does not matter'
			})
		  }
		  function startProblem(problemNumber) {
			vscode.postMessage({
				command: 'start',
				text: problemNumber
			})
		  }

		  // Handle the message inside the webview
		  window.addEventListener('message', event => {
			  const message = event.data; // The JSON data our extension sent
			  document.getElementById("feedback").innerHTML = message.feedback;
			  document.getElementById("output").innerHTML = message.output;
		  });
	  </script>
  </body>
  </html>`;
  }


// this method is called when your extension is deactivated
function deactivate() {}

function getCommandOutput(currentPanel, chosenExampleNumber) {
	vscode.commands.executeCommand('workbench.action.terminal.selectAll').then(() => {
		vscode.commands.executeCommand('workbench.action.terminal.copySelection').then(() => {
		    vscode.commands.executeCommand('workbench.action.terminal.clearSelection').then(() => {
		        vscode.env.clipboard.readText().then((text)=>{
					console.log("The clipboard text is as follows");
					console.log(text);
					console.log("---");
					let parsedOutput = parseOutput(text);
					console.log(parsedOutput);
					if (parsedOutput["feedback"] == "NOT-DONE") {
						return false;
					}
					// Here we send info back to the webview for display
    				currentPanel.webview.postMessage(
						{ output: parsedOutput["output"], feedback: parsedOutput["feedback"] });
					return true;
		        });
		    });
		});
	});
	return false;
}

function parseOutput(strOutput) {
	// var pos = strOutput.lastIndexOf(commandString);
	// if (pos == -1) {
	// 	console.log("The command was not found in the output");
	// 	return;
	// }
	// var theRest = strOutput.slice(pos);
	let lines = strOutput.split(/\r?\n/)
	// The first line is the command itself
	let outputLines = lines.slice(1)
	let doneIndex = 0
	for (let index = 0; index < outputLines.length; index++) {
		let line = outputLines[index];
		if (line.substr(line.length-2, 2) == "$ ") {
			doneIndex = index;
		}
	}
	console.log("The done index is " + doneIndex);
	if (doneIndex == 0) {
		console.log("ERROR occurred, did not find the shell prompt indicating the output is over.");
		return "NOT-DONE";
	}
	console.log("-----");
	console.log(outputLines);
	let actualOutputLines = outputLines.slice(0, doneIndex);
	// TODO Add the answer and compare what we got with the answer
	// Show the difference in the feedback sent to the webview
	// TODO Are there other Ruby extensions that can help the user with editing also
	// TODO Add a hint button to provide a template
	// TODO Parameterize this, so we can use for different problem assignements
	return {
		output: actualOutputLines.join("<br/>"),
		feedback: "There are " + actualOutputLines.length + " lines of output"
	};
}

function generatedRunId() {
	return 'xxxxxxxx'.replace(/[x]/g, function(c) {
	  var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
	  return v.toString(16);
	});
}

module.exports = {
	activate,
	deactivate
}
