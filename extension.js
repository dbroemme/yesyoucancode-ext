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
	console.log("The yesyoucancoderuby extension is now active. The root dir is " + rootDir);
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
			  runRubyProgram(currentPanel, rootDir, chosenExampleNumber, fs);
			  return;
			case 'start':
			  chosenExampleNumber = message.text;
			  openExample(currentPanel, message.text, rootDir, fs);
			  return;
			case 'gets':
			  //vscode.window.showErrorMessage(message.text);
			  push(message.text);
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

	hideTerminalWindow();
	//vscode.commands.executeCommand("workbench.action.closeSidebar");
	//vscode.commands.executeCommand("workbench.action.toggleActivityBarVisibility");

	var mapHtml = fs.readFileSync(context.extensionPath + "/problems/map.html", 'utf8');
	currentPanel.webview.postMessage({ challengemap: mapHtml });
	
	var fileSystemWatcher = vscode.workspace.createFileSystemWatcher("**/{r,j}*");
    fileSystemWatcher.ignoreCreateEvents = false;
    fileSystemWatcher.ignoreChangeEvents = true;
    fileSystemWatcher.ignoreDeleteEvents = true;
    fileSystemWatcher.onDidCreate((e) => {
		// Get just the filename
		var lastDelimIndex = e.path.lastIndexOf('/');
		var watchedFileName = e.path.slice(lastDelimIndex + 1);
		//vscode.window.showInformationMessage("The watched file name is " + watchedFileName);
		if (watchedFileName.startsWith("r")) {
			//vscode.window.showInformationMessage("A Ruby message file was created: " + e);
			getWebviewInput(currentPanel);
		} else if (watchedFileName.startsWith("j")) {
			vscode.window.showInformationMessage("This was our own file that was created: " + e);
		} else {
			vscode.window.showInformationMessage("An unidentified file was created: " + e);
		} 
    });
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
	currentPanel.webview.postMessage({ challenge: docHtml});
	
	vscode.workspace.openTextDocument(rubyFileUri).then(
		doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
	);
}

function runRubyProgram(currentPanel, rootDir, chosenExampleNumber, fs) {
	console.log("In runRubyProgram() for example " + chosenExampleNumber);
	console.log("[3] The root dir is " + rootDir);
	// Auto save the current editor file, if the user has not done so already
	// because we need the file itself to be saved on disk for the run command
	let openTextDocuments = vscode.window.visibleTextEditors;
	openTextDocuments.forEach(textDoc => {
		if (textDoc.document.fileName.endsWith(chosenExampleNumber + ".rb")) {
			textDoc.document.save();
		}
	});
	
	let editorFileName = rootDir + "/problems/code" + chosenExampleNumber + ".rb";
	let commandString = "ruby " + editorFileName;
	console.log("Preparing to run ruby using command: " + commandString);

	var expectedOutputStr = fs.readFileSync(rootDir + "/problems/answer" + chosenExampleNumber + ".txt", 'utf8');
	var expectedOutput = expectedOutputStr.split(/\r?\n/);

	try {
		const { spawn } = require("child_process");
		
		const rb = spawn('ruby', [editorFileName]);
        rb.stdout.on('data', (data) => {
			console.log("ruby stdout: " + data);
			let parsedOutput = parseOutput(data);
			console.log("The parsed output is: " + parsedOutput);
			let feedback = determineFeedback(parsedOutput["asarray"], expectedOutput);
			console.log("The feedback is: " + feedback);
			// Send info back to the webview for display
		  	currentPanel.webview.postMessage(
		 		{ output: parsedOutput["output"], feedback: feedback });
        });
        rb.stderr.on('data', (data) => {
            console.error("ruby stderr: " + data);
        });
        rb.on('close', (code) => {
            console.log("Your ruby program exited with code " + code);
		});

	} catch (err) {
		console.log("We caught an exception");
		console.log(err);
	}
	//setTimeout(function(){ getCommandOutput(currentPanel, chosenExampleNumber); }, 1000);
}

function getWebviewInput(currentPanel) {
	currentPanel.webview.postMessage({ input: "gets" });
	// TODO Do we need to wait now. I think so, right?
}

function hideTerminalWindow() {
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
	codeTerminal.sendText("clear", true);
	codeTerminal.hide();
	//codeTerminal.sendText(commandString, true);
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
	  <style>
	  pre {
		background: #f4f4f4;
		border: 1px solid #ddd;
		border-left: 3px solid #5299D5;
		color: #666;
		page-break-inside: avoid;
		font-family: monospace;
		font-size: 15px;
		line-height: 1.6;
		margin-bottom: 1.6em;
		max-width: 100%;
		overflow: auto;
		padding: 1em 1.5em;
		display: block;
		word-wrap: break-word;
	}
	</style>
  </head>
  <body>
	  <img src="${imageUri}"/><br/><br/>
	  <div id="challengemap">&nbsp;<br/>&nbsp;</div>
      <div id="workarea" style="display: none;">
	  <table border="0" width="100%">
        <tr>
          <td align="left"><button onClick="runButton()">Run Your Code</button></td>
          <td align="right"><button onClick="reset()">Choose a Different Challenge</button></td>
        </tr>
      </table>
	  <br/>

	  <!-- Form to get string input -->
	  <div id="getsdiv" style="display: none;">
	  <label for="getsinput">Program Input:</label>
	  <input type="text" id="getsinput" name="getsinput">
	  <button onClick="sendGetsInput()">Enter</button> 
	  </div>

	  <div id="challenge">&nbsp;</div>
	  <br/><b>Output</b><div>
	  <pre id="output"> </pre>
	  <br/></div>
	  <br/><b>Feedback</b><div>
	  <pre id="feedback"> </pre>
	  <br/></div>

	  </div>  <!-- end workarea -->
	  <script>
		  const vscode = acquireVsCodeApi();
		  
		  function runButton() {
			vscode.postMessage({
				command: 'run',
				text: 'This will get ignored but does not matter'
			})
		  }
		  function startProblem(problemNumber) {
			document.getElementById("workarea").style.display = "block";
			document.getElementById("challengemap").style.display = "none";
			vscode.postMessage({
				command: 'start',
				text: problemNumber
			})
		  }
		  function reset() {
			document.getElementById("challengemap").style.display = "block";
			document.getElementById("workarea").style.display = "none";
			document.getElementById("output").innerHTML = " ";
			document.getElementById("feedback").innerHTML = " ";
		  }
		  function sendGetsInput() {
			getsInput = document.getElementById("getsinput").value;
			vscode.postMessage({
				command: 'gets',
				text: getsInput
			})
			document.getElementById("getsinput").value = "";
			document.getElementById("getsdiv").style.display = "none";
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
			  if (message.challenge) {
				document.getElementById("challenge").innerHTML = message.challenge;
			  }
			  if (message.input) {
				document.getElementById("getsdiv").style.display = "block";
			  }
		   });
	  </script>
  </body>
  </html>`;
  }


// this method is called when your extension is deactivated
function deactivate() {}

function parseOutput(strOutput) {
	console.log("in parseOutput with " + strOutput + "." + strOutput.constructor.name + ".");
	let lines = strOutput.toString('utf8').split(/\r?\n/)
	console.log("got lines: " + lines);
	var actualOutputLines = []
	lines.forEach(element => {
		console.log(element);
		console.log("Line length: " + element.length);
		if (element.length > 0) {
			actualOutputLines.push(element);
		}
	});

	// Show the difference in the feedback sent to the webview
	// TODO Are there other Ruby extensions that can help the user with editing also
	// TODO Add a hint button to provide a template
	return {
		output: actualOutputLines.join("<br/>"),
		asarray: actualOutputLines
	};
}

function determineFeedback(parsedOutput, expectedOutput) {
	console.log("in determineFeedback. Actual length: " + parsedOutput.length + "  Expected length:" + expectedOutput.length);
	console.log("---------  Actual ------------");
	console.log(parsedOutput);
	console.log("--------- Expected -----------");
	console.log(expectedOutput);
	console.log("------------------------------");
	var actualCount = 0;
	var expectedOutputCount = 0;
	var done = false;
	var match = false;
	while (expectedOutputCount < expectedOutput.length && !done) {
		console.log("Comparing lines " + actualCount + ", " + expectedOutputCount);
		let expectedLine = expectedOutput[expectedOutputCount].replace(/[\n\r]+/g, '');
		let actualLine = parsedOutput[actualCount];
		console.log("[" + actualLine + "], [" + expectedLine + "]");
		let comparison = actualLine.indexOf(expectedLine);
		console.log("Comparison value: " + comparison);
		actualCount = actualCount + 1;
		if (comparison == -1) {
			console.log("Line " + actualCount + " is not a match.");
			if (actualCount >= parsedOutput.length) {
				console.log("We should be done.");
				done = true;
			}
		} else {
			console.log("Line " + actualCount + " has a match.");
			expectedOutputCount = expectedOutputCount + 1;
			if (expectedOutputCount >= expectedOutput.length) {
				match = true;
			}
		}
	}
	if (match) {
		console.log("We got a match");
		return "We got a match";
	}
	console.log("No match");
	return "No match";
}


//
// This is file-based messaging logic
//
var write_count = 1;
var read_count = 1;

function resetMessageQueues() {
	write_count = 1;
	read_count = 1;
}

function push(obj) {
  let file_name = rootDir + "/problems/j" + write_count.toString();
  if (fs.existsSync(file_name)) {
    throw file_name + " already exists, cannot write";
  }
  write_count = write_count + 1;
  fs.writeFile(file_name,
      obj, (err) => {
      if (err) throw err;
  });
}

// function pop() {
//   let file_name = rootDir + "/problems/r" + read_count.toString();
//   console.log("Attempting to read from file " + file_name);
//   if (fs.existsSync(file_name)) {
//     console.log("file does exist");
//     var d = new Date();
//     var n = d.getTime();
//     let s = fs.statSync(file_name);
//     let diff = n - s.mtimeMs;
//     console.log("The file is " + diff + " ms old");
//     if (diff < 500) {
//       // The file is too new, pretend it isn't there yet
//       return null;
//     }
//     read_count = read_count + 1;
//     const data = fs.readFileSync(file_name, 'utf8');
//     console.log("The file data is " + data + ".");
//     return data;
//   } else {
//     console.log("file does not exist");
//   }
//   return null;
// }

function timeout() {
    setTimeout(function () {
        var o = pop();
        if (o == null) {
          // we are done
        } else {
          console.log("output: " + o);
          timeout();
        }
    }, 1000);
}

module.exports = {
	activate,
	deactivate
}
