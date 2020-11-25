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
	log_info("The yesyoucancoderuby extension is now active. The root dir is " + rootDir);
	var chosenExampleNumber = 'none';
	var runMode = 'managed';    // or console

	// The code you place here will be executed every time your command is executed
	let currentPanel = vscode.window.createWebviewPanel(
		'YesYouCanCode',
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
		log_info("YouCanCode extension activation function was called.");
	});

	context.subscriptions.push(disposable);

	hideTerminalWindow();
	//vscode.commands.executeCommand("workbench.action.closeSidebar");
	//vscode.commands.executeCommand("workbench.action.toggleActivityBarVisibility");

	var mapHtml = fs.readFileSync(context.extensionPath + "/problems/map.html", 'utf8');
	currentPanel.webview.postMessage({ challengemap: mapHtml });
	
	var fileSystemWatcher = vscode.workspace.createFileSystemWatcher("**/{r,out}*");
    fileSystemWatcher.ignoreCreateEvents = false;
    fileSystemWatcher.ignoreChangeEvents = false;
    fileSystemWatcher.ignoreDeleteEvents = true;
    fileSystemWatcher.onDidCreate((e) => {
		// Get just the filename
		var lastDelimIndex = e.path.lastIndexOf('/');
		var watchedFileName = e.path.slice(lastDelimIndex + 1);
		//vscode.window.showInformationMessage(watchedFileName + "  was created: " + e);
		if (watchedFileName.startsWith("r")) {
			getWebviewInput(currentPanel);
		} else if (watchedFileName === "out.txt") {
			var outputContent = fs.readFileSync(e.path, 'utf8');
			log_info("output file created: " + outputContent + ".");
   	        currentPanel.webview.postMessage({ output: outputContent});
		} 
    });
    fileSystemWatcher.onDidChange((e) => {
		// Get just the filename
		var lastDelimIndex = e.path.lastIndexOf('/');
		var watchedFileName = e.path.slice(lastDelimIndex + 1);
		//vscode.window.showInformationMessage(watchedFileName + "  was changed: " + e);
		if (watchedFileName === "out.txt") {
			var outputContent = fs.readFileSync(e.path, 'utf8');
			log_info("output file updated: " + outputContent + ".");
			currentPanel.webview.postMessage({ output: outputContent});
		}
    });
}
exports.activate = activate;

function openExample(currentPanel, exampleNumber, rootDir, fs) {
	log_info("Going to open example " + exampleNumber);
	let rubyFileUri = vscode.Uri.file(rootDir + "/problems/code" + exampleNumber + ".rb");
	log_info("Construct ruby code file uri " + rubyFileUri);

	var docHtml = fs.readFileSync(rootDir + "/problems/docs" + exampleNumber + ".html", 'utf8');
	//log_info("the doc html is: " + docHtml);
	currentPanel.webview.postMessage({ challenge: docHtml});
	
	vscode.workspace.openTextDocument(rubyFileUri).then(
		doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
	);
}

function runRubyProgram(currentPanel, rootDir, chosenExampleNumber, fs) {
	log_info("In runRubyProgram() for example " + chosenExampleNumber);
	if (fs.existsSync(rootDir + "/problems/out.txt")) {
		try {
			fs.unlinkSync(rootDir + "/problems/out.txt");
		} catch (err) {
			log_info("We caught an exception");
			log_info(err);
		}
	}
	log_info("We deleted the out.txt file");

	resetMessageQueues();

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
	log_info("Preparing to run ruby using command: " + commandString);

	var expectedOutputStr = fs.readFileSync(rootDir + "/problems/answer" + chosenExampleNumber + ".txt", 'utf8');
	var expectedOutput = expectedOutputStr.split(/\r?\n/);

	try {
		const { spawn } = require("child_process");
		
		const rb = spawn('ruby', [editorFileName]);
        rb.stdout.on('data', (data) => {
			log_info("ruby stdout: " + data);
			// let parsedOutput = parseOutput(data);
			// console.log("The parsed output is: " + parsedOutput);
			// let feedback = determineFeedback(parsedOutput["asarray"], expectedOutput);
			// console.log("The feedback is: " + feedback);
			// // Send info back to the webview for display
		  	// currentPanel.webview.postMessage(
		 	// 	{ output: parsedOutput["output"], feedback: feedback });
        });
        rb.stderr.on('data', (data) => {
            log_info("ruby stderr: " + data);
        });
        rb.on('close', (code) => {
			log_info("Your ruby program exited with code " + code);
			var outputContent = fs.readFileSync(rootDir + "/problems/out.txt", 'utf8');
			let parsedOutput = parseOutput(outputContent);
			log_info("The parsed output is: " + parsedOutput);
			let feedback = determineFeedback(parsedOutput["asarray"], expectedOutput);
			log_info("The feedback is: " + feedback);
			// Send info back to the webview for display
		  	currentPanel.webview.postMessage({ feedback: feedback });
		});

	} catch (err) {
		log_info("We caught an exception");
		log_info(err);
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
		log_info("We already have the code terminal window.");
	} else {
		log_info("Creating the code terminal window.");
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
	log_info("in parseOutput with " + strOutput + "." + strOutput.constructor.name + ".");
	let lines = strOutput.toString('utf8').split(/\r?\n/)
	log_info("got lines: " + lines);
	var actualOutputLines = []
	lines.forEach(element => {
		log_info(element);
		log_info("Line length: " + element.length);
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
	log_info("in determineFeedback. Actual length: " + parsedOutput.length + "  Expected length:" + expectedOutput.length);
	log_info("---------  Actual ------------");
	log_info(parsedOutput);
	log_info("--------- Expected -----------");
	log_info(expectedOutput);
	log_info("------------------------------");
	var actualCount = 0;
	var expectedOutputCount = 0;
	var done = false;
	var match = false;
	while (expectedOutputCount < expectedOutput.length && !done) {
		log_info("Comparing lines " + actualCount + ", " + expectedOutputCount);
		let expectedLine = expectedOutput[expectedOutputCount].replace(/[\n\r]+/g, '');
		let actualLine = parsedOutput[actualCount];
		log_info("[" + actualLine + "], [" + expectedLine + "]");
		let comparison = actualLine.indexOf(expectedLine);
		log_info("Comparison value: " + comparison);
		actualCount = actualCount + 1;
		if (comparison == -1) {
			log_info("Line " + actualCount + " is not a match.");
			if (actualCount >= parsedOutput.length) {
				log_info("We should be done.");
				done = true;
			}
		} else {
			log_info("Line " + actualCount + " has a match.");
			expectedOutputCount = expectedOutputCount + 1;
			if (expectedOutputCount >= expectedOutput.length) {
				match = true;
			}
		}
	}
	if (match) {
		log_info("We got a match");
		return "We got a match";
	}
	log_info("No match");
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
	// Delete any existing message files
	deleteMessageFiles("r");
	deleteMessageFiles("j");
}

function deleteMessageFiles(prefix) {
	var count = 1;
	var done = false;
	while (!done) {
		var file_name = rootDir + "/problems/" + prefix + count.toString();
		if (fs.existsSync(file_name)) {
			try {
				fs.unlinkSync(file_name);
			} catch (err) {
				log_info("Caught an exception trying to delete file " + file_name);
				log_info(err);
				done = true;
			}
		} else {
			done = true;
		}
		count = count + 1;
	}
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

// function timeout() {
//     setTimeout(function () {
//         var o = pop();
//         if (o == null) {
//           // we are done
//         } else {
//           console.log("output: " + o);
//           timeout();
//         }
//     }, 1000);
// }

var info_count = 1;
function log_info(e) {
	let file_name = rootDir + "/problems/info" + info_count.toString();;
	info_count = info_count + 1;
	fs.writeFile(file_name, e, (err) => {
		if (err) throw err;
	});
}

module.exports = {
	activate,
	deactivate
}
