// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require('fs');
const rootDir = vscode.workspace.workspaceFolders[0].uri.fsPath;
const MANAGED_RUN_MODE = 'managed';
const TERMINAL_RUN_MODE = 'terminal';

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
	var runMode = MANAGED_RUN_MODE;

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
			  runRubyProgram(currentPanel, rootDir, chosenExampleNumber, fs, runMode);
			  return;
			case 'start':
			  chosenExampleNumber = message.text;
			  openExample(currentPanel, message.text, rootDir, fs);
			  return;
			case 'gets':
			  push(message.text);
			  return;
			case 'mode':
			  runMode = message.text;
			  if (runMode === TERMINAL_RUN_MODE) {
				showTerminalWindow();
				setRubyRunMode(false);
			  } else {
				hideTerminalWindow();
				setRubyRunMode(true);
			  }
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

function safeDeleteFile(filename) {
	log_info("Safe delete of " + filename);
	if (fs.existsSync(filename)) {
		try {
			fs.unlinkSync(filename);
		} catch (err) {
			log_info("We caught an exception trying to delete " + filename);
			log_info(err);
		}
		return false;
	}
	return true;
}

function openExample(currentPanel, exampleNumber, rootDir, fs) {
	log_info("Going to open example " + exampleNumber);
	let rubyFileUri = vscode.Uri.file(rootDir + "/problems/code" + exampleNumber + ".rb");
	log_info("Construct ruby code file uri " + rubyFileUri);

	var docHtml = fs.readFileSync(rootDir + "/problems/docs" + exampleNumber + ".html", 'utf8');
	var solutionHtml = fs.readFileSync(rootDir + "/problems/solution" + exampleNumber + ".rb", 'utf8');
	currentPanel.webview.postMessage({ challenge: docHtml, solution: solutionHtml });
	vscode.workspace.openTextDocument(rubyFileUri).then(
		doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
	);
}

function runRubyProgram(currentPanel, rootDir, chosenExampleNumber, fs, runMode) {
	log_info("In runRubyProgram() for example " + chosenExampleNumber);
	safeDeleteFile(rootDir + "/log/out.txt");
	resetMessageQueues();

	// Auto save the current editor file, if the user has not done so already
	// because we need the file itself to be saved on disk for the run command
	let openTextDocuments = vscode.window.visibleTextEditors;
	openTextDocuments.forEach(textDoc => {
		if (textDoc.document.fileName.endsWith("code" + chosenExampleNumber + ".rb")) {
			textDoc.document.save();
		}
	});
	
	let editorFileName = rootDir + "/problems/code" + chosenExampleNumber + ".rb";

    if (runMode === TERMINAL_RUN_MODE) {
		let commandString = "ruby " + editorFileName;
		log_info("Preparing to run ruby using command: " + commandString);

		// Don't create a new terminal if it already exists.
	    let theList = vscode.window.terminals;
	    let codeTerminal = undefined;
	    theList.forEach(element => {
	        if (element.name == "Run Your Code") {
	            codeTerminal = element;
	        }
	    });
	    if (codeTerminal) {
	        //log_info("We already have the code terminal window.");
	    } else {
	        codeTerminal = vscode.window.createTerminal("Run Your Code");
	    }
	    codeTerminal.show(true);
	    codeTerminal.sendText("clear", true);
	    codeTerminal.sendText(commandString, true);

    } else {
		let temp_file_name = rootDir + "/problems/temp.rb";
		safeDeleteFile(temp_file_name);

		var sourceCode = fs.readFileSync(editorFileName, 'utf8');
		var modifiedSourceCode = sourceCode.replace(/puts/g, "yycc_puts");
		modifiedSourceCode = modifiedSourceCode.replace(/gets/g, "yycc_gets");
		fs.writeFile(temp_file_name, modifiedSourceCode, (err) => {
			if (err) throw err;
		});

		// Managed run mode where we compare to the expected results
		var expectedOutputStr = fs.readFileSync(rootDir + "/problems/answer" + chosenExampleNumber + ".txt", 'utf8');
		var expectedOutput = expectedOutputStr.split(/\r?\n/);

		try {
			const { spawn } = require("child_process");
			
			const rb = spawn('ruby', [temp_file_name]);
			rb.stdout.on('data', (data) => {
				log_info("ruby stdout: " + data);
			});
			rb.stderr.on('data', (data) => {
				log_info("ruby stderr: " + data);
			});
			rb.on('close', (code) => {
				log_info("Your ruby program exited with code " + code);
				var outputContent = fs.readFileSync(rootDir + "/log/out.txt", 'utf8');
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
	}
}

function getWebviewInput(currentPanel) {
	currentPanel.webview.postMessage({ input: "gets" });
}

function setRubyRunMode(isManagedMode) {
    let ruby_include_file = rootDir + "/problems/yycc.rb";
	safeDeleteFile(ruby_include_file);
	fs.writeFile(ruby_include_file, "MANAGED_RUN_MODE = " + isManagedMode.toString(), (err) => {
		if (err) throw err;
	});
}
function showTerminalWindow() {
	toggleTerminalWindow(true);
}
function hideTerminalWindow() {
	toggleTerminalWindow(false);
}
function toggleTerminalWindow(showFlag) {
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
	if (!showFlag) {
	    codeTerminal.hide();
	}
}

// 9ADCFF   baby blue
// 5299D5   darker blue
// C684C1   purple
// 699A52   green this one
// #DAF7A6  cool lime
// #FFC300  interesting yellow
// #FF5733  cool orange
// #C70039  cool red
// #900C3F  cool maroon
// #581845  cool purple
// #DFFF00  #FFBF00 #FF7F50 #DE3163 #9FE2BF #40E0D0 #6495ED #CCCCFF

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
		  <td align="left">
			<button onClick="runButton()">Run Your Code</button>&nbsp;Mode:
			<select onChange="setRunMode()"name="runMode" id="runMode">
              <option value="managed">Managed</option>
              <option value="terminal">Terminal</option>
            </select>
		  </td>
          <td align="right"><button onClick="reset()">Choose a Different Challenge</button></td>
        </tr>
      </table>
	  <br/>

	  <!-- Form to get string input -->
	  <div id="getsdiv" style="display: none; border:2px solid #900C3F; padding: 5px; margin: 5px;">
	  <label for="getsinput">Program Input:</label>
	  <input type="text" id="getsinput" name="getsinput">
	  <button onClick="sendGetsInput()">Enter</button> 
	  </div>

	  <div id="challenge">&nbsp;</div><br/>
	  <div id="outputDiv"><b>Output</b>
	  <pre id="output"> </pre>
	  </div>
	  
	  <div id="feedbackDiv"><b>Feedback</b><br/><br/>
	  <div id="feedback"></div>
	  </div>

	  <br/><br/><a href="#" onClick="toggleSolution()">Show Solution</a><br/>
	  <div><pre id="solution" style="display: none;"></pre></div>

	  </div>  <!-- end workarea -->
	  <script>
		  const vscode = acquireVsCodeApi();
		  
		  function runButton() {
			document.getElementById("output").innerHTML = " ";
			document.getElementById("feedback").innerHTML = " ";
			vscode.postMessage({
				command: 'run',
				text: 'This will get ignored but does not matter'
			})
		  }
		  function setRunMode() {
			strRunMode = document.getElementById("runMode").value;
			if (strRunMode == "managed") {
				document.getElementById("outputDiv").style.display = "block";
			    document.getElementById("feedbackDiv").style.display = "block";
			} else {
				document.getElementById("outputDiv").style.display = "none";
			    document.getElementById("feedbackDiv").style.display = "none";
			}
			vscode.postMessage({
				command: 'mode',
				text: strRunMode
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
			  if (message.solution) {
				document.getElementById("solution").innerHTML = message.solution;
			  }
		   });

		   function toggleSolution() {
			  solutionDiv = document.getElementById("solution");
			  if (solutionDiv.style.display == "block") {
				  solutionDiv.style.display = "none";
			  } else {
				  solutionDiv.style.display = "block";
			  }
		   }

	  </script>
  </body>
  </html>`;
  }


// this method is called when your extension is deactivated
function deactivate() {}

function parseOutput(strOutput) {
	let lines = strOutput.toString('utf8').split(/\r?\n/)
	var actualOutputLines = []
	lines.forEach(element => {
		if (element.length > 0) {
			actualOutputLines.push(element);
		}
	});

	// TODO Are there other Ruby extensions that can help the user with editing also
	// TODO Add a hint button to provide a template
	return {
		output: actualOutputLines.join("<br/>"),
		asarray: actualOutputLines
	};
}

function determineFeedback(parsedOutput, expectedOutput) {
	log_info("DetermineFeedback. Actual lines: " + parsedOutput.length + " vs expected:" + expectedOutput.length);
	log_info("---------  Actual ------------");
	log_info(parsedOutput);
	log_info("--------- Expected -----------");
	log_info(expectedOutput);
	log_info("------------------------------");
	var actualCount = 0;
	var expectedOutputCount = 0;
	var done = false;
	var feedbackLines = [];
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
			feedbackLines.push("<span style='color: #699A52;'>" + expectedLine + "</span>");
			expectedOutputCount = expectedOutputCount + 1;
		}
	}

	if (expectedOutputCount >= expectedOutput.length) {
		match = true;
	}
	while (expectedOutputCount < expectedOutput.length) {
		let expectedLine = expectedOutput[expectedOutputCount].replace(/[\n\r]+/g, '');
		feedbackLines.push("<span style='color: #C70039;'>" + expectedLine + "</span>");
		expectedOutputCount = expectedOutputCount + 1;
	}

	if (match) {
		return "Your program is correct!<br/><br/>".concat(feedbackLines.join("<br/>"));
	}
    return "Looks like we aren't quite there yet.<br/><br/>".concat(feedbackLines.join("<br/>"));
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
		var file_name = rootDir + "/log/" + prefix + count.toString();
		done = safeDeleteFile(file_name);
		count = count + 1;
	}
}

function push(obj) {
  let file_name = rootDir + "/log/j" + write_count.toString();
  if (fs.existsSync(file_name)) {
    throw file_name + " already exists, cannot write";
  }
  write_count = write_count + 1;
  fs.writeFile(file_name,
      obj, (err) => {
      if (err) throw err;
  });
}


var info_count = 1;
function log_info(e) {
	let file_name = rootDir + "/log/info" + info_count.toString();;
	info_count = info_count + 1;
	fs.writeFile(file_name, e, (err) => {
		if (err) throw err;
	});
}

module.exports = {
	activate,
	deactivate
}
