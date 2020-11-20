// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const rootDir = vscode.workspace.workspaceFolders[0].uri.fsPath;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('The "yesyoucancoderuby" extension is now active!');
	console.log("[1] The root dir is " + rootDir);
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
			  runRubyProgram(currentPanel, rootDir, chosenExampleNumber, fs);
			  return;
			case 'start':
			  chosenExampleNumber = message.text;
			  openExample(currentPanel, message.text, rootDir, fs);
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
	});

	context.subscriptions.push(disposable);

	var mapHtml = fs.readFileSync(context.extensionPath + "/problems/map.html", 'utf8');
	//console.log("the map html is: " + mapHtml);
    currentPanel.webview.postMessage({ challengemap: mapHtml });
}
exports.activate = activate;

function openExample(currentPanel, exampleNumber, rootDir, fs) {
	console.log("Going to open example " + exampleNumber);
	console.log("[2] The root dir is " + rootDir);
	console.log("The fs var is " + fs);
	let rubyFileUri = vscode.Uri.file(rootDir + "/problems/code" + exampleNumber + ".rb");
	console.log("Construct ruby code file uri " + rubyFileUri);

	var docHtml = fs.readFileSync(rootDir + "/problems/docs" + exampleNumber + ".html", 'utf8');
	console.log("the doc html is: " + docHtml);
	currentPanel.webview.postMessage({ challengename: "Challenge #" + exampleNumber,
										challenge: docHtml});
	
	vscode.workspace.openTextDocument(rubyFileUri).then(
		doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
	);
}

function runRubyProgram(currentPanel, rootDir, chosenExampleNumber, fs) {
	console.log("In runRubyProgram() for example " + chosenExampleNumber);
	console.log("[3] The root dir is " + rootDir);
	// TODO auto save the current editor file, if the user has not done so already
	// because we need the file itself to be saved for it to be run by the
	// next command
	let editorFileName = rootDir + "/problems/code" + chosenExampleNumber + ".rb";
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
	try {
		const { exec } = require("child_process");
		exec("ruby " + editorFileName, (error, stdout, stderr) => {
			if (error) {
				console.log(`error: ${error.message}`);
				return;
			}
			if (stderr) {
				console.log(`stderr: ${stderr}`);
				return;
			}
			console.log("---");
			console.log(stdout);
			let parsedOutput = parseOutput(stdout);
			console.log("---");
			console.log(parsedOutput);
			// Here we send info back to the webview for display
			currentPanel.webview.postMessage(
				{ output: parsedOutput["output"], feedback: parsedOutput["feedback"] });
		});
	} catch (err) {
		console.log("We caught an exception");
		console.log(err);
	}
	//setTimeout(function(){ getCommandOutput(currentPanel, chosenExampleNumber); }, 1000);
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
	  <img src="${imageUri}"/><br/><br/>
	  <table border="0" width="100%">
        <tr>
          <td align="left"><button onClick="runButton()">Run Your Code</button>&nbsp;&nbsp;<span id="challengename">Select below</span></td>
          <td align="right"><button onClick="reset()">Choose a Different Challenge</button></td>
        </tr>
      </table>
	  <br/>
	  <h2 id="challengemapheader">Challenges</h2>
	  <div id="challengemap" style="color: #CF9176; border:1px solid #2196F3; border-radius: 5px;">&nbsp;<br/>&nbsp;</div>
	  <h2>Current Challenge</h2>
	  <div id="challenge" style="color: #CF9176; border:1px solid #2196F3; border-radius: 5px;">&nbsp;<br/>&nbsp;</div>
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
		  function reset() {
			document.getElementById("challengemapheader").style.display = "block";
			document.getElementById("challengemap").style.display = "block";
		  }

		  // Handle the message inside the webview
		  window.addEventListener('message', event => {
			  const message = event.data; // The JSON data our extension sent
			  if (message.feedback) {
			  	  document.getElementById("feedback").innerHTML = message.feedback;
			  }
			  if (message.output) {
			      document.getElementById("output").innerHTML = message.output;
			  }
			  if (message.challengemap) {
				  document.getElementById("challengemap").innerHTML = message.challengemap;
			  }
			  if (message.challengename) {
				  document.getElementById("challengename").innerHTML = message.challengename;
				  document.getElementById("challengemapheader").style.display = "none";
				  document.getElementById("challengemap").style.display = "none";
			  }
			  if (message.challenge) {
				document.getElementById("challenge").innerHTML = message.challenge;
			}
		});
	  </script>
  </body>
  </html>`;
  }


// this method is called when your extension is deactivated
function deactivate() {}

function parseOutput(strOutput) {
	let actualOutputLines = strOutput.split(/\r?\n/)
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
