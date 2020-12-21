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
	context.workspaceState.update("chosenExampleNumber", 'none');
	context.workspaceState.update("runMode", MANAGED_RUN_MODE);

	// The code you place here will be executed every time your command is executed
	var currentPanel = createMyWebViewPanel(context);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('yesyoucancoderuby.openHelper', function () {
		log_info("YesYouCanCode extension activation function was called.");
		currentPanel = createMyWebViewPanel(context);
	});

	context.subscriptions.push(disposable);

	hideTerminalWindow();
	
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
			updateTheOutputWindow(context, currentPanel);
		}
    });
    fileSystemWatcher.onDidChange((e) => {
		// Get just the filename
		var lastDelimIndex = e.path.lastIndexOf('/');
		var watchedFileName = e.path.slice(lastDelimIndex + 1);
		//vscode.window.showInformationMessage(watchedFileName + "  was changed: " + e);
		if (watchedFileName === "out.txt") {
			updateTheOutputWindow(context, currentPanel);
		}
    });
}
exports.activate = activate;

function updateTheOutputWindow(context, currentPanel) {
	let out_file_name = rootDir + "/log/out.txt";
	var outputContent = "";
	if (fs.existsSync(out_file_name)) {
		outputContent = fs.readFileSync(out_file_name, 'utf8');
	}
	var errorContent = context.workspaceState.get("errorContent");
	var completeContent;
	if (errorContent == undefined) {
		completeContent = outputContent;
	} else {
		completeContent = outputContent + errorContent
	}
	currentPanel.webview.postMessage({ output: completeContent});
}

function createMyWebViewPanel(context) {
	let tempPanel = vscode.window.createWebviewPanel(
		'YesYouCanCode',
		'Yes, You Can Code',
		vscode.ViewColumn.Two,
		{
			// Enable scripts in the webview
			enableScripts: true
		}
	);
	let imageUri = vscode.Uri.file(context.extensionPath + "/media/TitleSlideYesYouCanCode.png");
	const imageSrc = tempPanel.webview.asWebviewUri(imageUri);
	if (fs.existsSync(rootDir + "/problems/challengeRows.txt")) {
	    var challengeRows = fs.readFileSync(rootDir + "/problems/challengeRows.txt", 'utf8');
		tempPanel.webview.html = getWebviewContent(imageSrc, challengeRows);
	} else {
		tempPanel.webview.html = `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Yes, You Can Code</title>
	  </head>
	  <body>
	  The Yes, You Can Code extension is designed to be run with the <a href="https://github.com/dbroemme/yesyoucancode">Yes, You Can Code</a> git project.
	  <br/><br/>It currently does not work with other projects.
	  </body>
	  </html>`;
	}
	tempPanel.onDidDispose(
		() => {
			tempPanel = undefined;
		},
		undefined,
		context.subscriptions
	  );
	tempPanel.webview.onDidReceiveMessage(
		message => {
		  switch (message.command) {
			case 'run':
			  runRubyProgram(tempPanel, rootDir,
				  context.workspaceState.get("chosenExampleNumber"), fs,
				  context.workspaceState.get("runMode"), context);
			  return;
			case 'start':
			  context.workspaceState.update("chosenExampleNumber", message.text);
			  openExample(tempPanel, message.text, rootDir, fs);
			  return;
			case 'gets':
			  push(message.text);
			  return;
			case 'irb':
			  openirb();
			  return;
			case 'mode':
			  var runMode = message.text;
			  context.workspaceState.update("runMode", runMode);
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

	return tempPanel;
}

function safeDeleteFile(filename) {
	//log_info("Safe delete of " + filename);
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
	//log_info("Going to open example " + exampleNumber);
	let rubyFileUri = vscode.Uri.file(rootDir + "/problems/code" + exampleNumber + ".rb");
	//log_info("Construct ruby code file uri " + rubyFileUri);

	var docHtml = fs.readFileSync(rootDir + "/problems/docs" + exampleNumber + ".html", 'utf8');
	var solutionHtml = fs.readFileSync(rootDir + "/problems/solution" + exampleNumber + ".rb", 'utf8');
	currentPanel.webview.postMessage({ challenge: docHtml, solution: solutionHtml });
	vscode.workspace.openTextDocument(rubyFileUri).then(
		doc => vscode.window.showTextDocument(doc, vscode.ViewColumn.One)
	);
}

function runRubyProgram(currentPanel, rootDir, chosenExampleNumber, fs, runMode, context) {
	//log_info("In runRubyProgram() for example " + chosenExampleNumber);
	let temp_file_name = rootDir + "/problems/temp.rb";
	let out_file_name = rootDir + "/log/out.txt";
	safeDeleteFile(temp_file_name);
	safeDeleteFile(out_file_name);
	context.workspaceState.update("errorContent", undefined);
	resetMessageQueues();

	// Auto save the current editor file, if the user has not done so already
	// because we need the file itself to be saved on disk for the run command
	let openTextDocuments = vscode.window.visibleTextEditors;
	openTextDocuments.forEach(textDoc => {
		if (textDoc.document.fileName.endsWith("code" + chosenExampleNumber + ".rb")) {
			//log_info("We have found the editor with your code to run. Number of lines: "
			//	+ textDoc.document.lineCount);
			var sourceCode = "";
			var i;
			for (i = 0; i < textDoc.document.lineCount; i++) {
				var lineOfSource = textDoc.document.lineAt(i).text;
				if (runMode === MANAGED_RUN_MODE) {
					var tempSourceCode = lineOfSource.replace(/puts/g, "yycc_puts");
					tempSourceCode = tempSourceCode.replace(/gets/g, "yycc_gets");
					sourceCode = sourceCode + tempSourceCode + '\n';
				} else {
					sourceCode = sourceCode + lineOfSource + '\n';
				}
			}
			fs.writeFile(temp_file_name, sourceCode, (err) => {
				if (err) throw err;
			});
		}
	});
	
    if (runMode === TERMINAL_RUN_MODE) {
		let commandString = "ruby problems/temp.rb";
		//log_info("Preparing to run ruby using command: " + commandString);

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
		// Managed run mode where we compare to the expected results
		var expectedOutputStr = fs.readFileSync(rootDir + "/problems/answer" + chosenExampleNumber + ".txt", 'utf8');
		var expectedOutputRaw = expectedOutputStr.split(/\r?\n/);
		var expectedOutput = []
		expectedOutputRaw.forEach(element => {
			if (element.length > 0) {
				expectedOutput.push(element);
			}
		});

		try {
			const { spawn } = require("child_process");
			const rb = spawn('ruby', [temp_file_name]);
			rb.stdout.on('data', (data) => {
				log_info("ruby stdout: " + data);
			});
			rb.stderr.on('data', (data) => {
				log_info("ruby stderr: " + data);
				let strData = data.toString();
				let comparison = strData.indexOf("temp.rb:");
				var errorToShow = strData;
				errorToShow = errorToShow.replace("<", "");
				errorToShow = errorToShow.replace(">", "");
				var errorContent = context.workspaceState.update("errorContent", errorToShow);
				updateTheOutputWindow(context, currentPanel);
		    });
			rb.on('close', (code) => {
				log_info("Your ruby program exited with code " + code);
				if (code == 1) {
					currentPanel.webview.postMessage({
						feedback: "Looks like your <span style='color: #DE3163;'>program had an error, see the output for details.</span>"
					});
				} else {
					if (fs.existsSync(out_file_name)) {
						var outputContent = fs.readFileSync(out_file_name, 'utf8');
						let parsedOutput = parseOutput(outputContent);
						let feedback = determineFeedback(parsedOutput, expectedOutput);
						//log_info("The feedback is: " + feedback);
						// Send info back to the webview for display
						currentPanel.webview.postMessage({ feedback: feedback });
					} else {
						currentPanel.webview.postMessage({
							feedback: "Your program <span style='color: #DE3163;'>did not generate any output or results.</span>"
						});
					}
				}
		    });

		} catch (err) {
			log_info("We caught an exception");
			log_info(err);
		}
	}
}

function openirb() {
	showTerminalWindow();
	setRubyRunMode(true);
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
	codeTerminal.show(false);
	codeTerminal.sendText("irb", true);
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
		//log_info("We already have the code terminal window.");
	} else {
		//log_info("Creating the code terminal window.");
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

function getWebviewContent(imageUri, challengeRows) {
	return `<!DOCTYPE html>
    <html lang="en">
    <head>
	    <meta charset="UTF-8">
	    <meta name="viewport" content="width=device-width, initial-scale=1.0">
	    <title>Yes, You Can Code</title>
	    <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
		<style>
		  examplenode {
			text-align: center;
			vertical-align: middle;
			font-family: arial,helvetica;
			cursor: default;
			border: 2px solid #b5d9ea;
			border-radius: 5px;
		  }
	    </style>
  </head>
  <body>
	  <img src="${imageUri}"/><br/><br/>
	  <div id="challengemap"><b>Select a challenge to get started</b><br/>&nbsp;</div>
	  <div id="chart_div"></div>

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

	    <pre id="output" style="background: #f4f4f4; border: 1px solid #ddd; border-left: 3px solid #5299D5; color: #666; page-break-inside: avoid; font-family: monospace; font-size: 15px; line-height: 1.6; margin-bottom: 1.6em; max-width: 100%; overflow: auto; padding: 1em 1.5em; display: block; word-wrap: break-word;"></pre>
	  
	    <!-- Form to get string input -->
	    <div id="getsdiv" style="display: none; border:2px solid #FF7F50; padding: 5px; margin: 5px;" onKeyPress="return handleFormData(event)">
	      <label for="getsinput">Program Input:</label>
	      <input type="text" id="getsinput" name="getsinput">
	      <button onClick="sendGetsInput()">Enter</button> 
	    </div>

	    <div id="feedback" style="display: none; padding: 10px; border: 1px solid #FFFFFF; border-radius: 5px;"></div>

	    <div id="challenge" style="padding-top: 5px;">&nbsp;</div><br/>

		<br/><a href="#" onClick="toggleSolution()">Show Solution</a>&nbsp;&nbsp;
		<a href="#" onClick="openirb()">Interactive Ruby</a>
		<br/>
	    <div><pre id="solution" style="display: none;"></pre></div>
        <br/><br/>
	  </div>  <!-- end workarea -->
	  <script>
		  const vscode = acquireVsCodeApi();
		  
		  function handleFormData(e) {
			if((e && e.keyCode == 13) || e == 0) {
			  sendGetsInput();
			}
		  }
		  function openirb() {
			document.getElementById("runMode").selectedIndex = 1;
			vscode.postMessage({
				command: 'irb'
			})
		  }
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
			    document.getElementById("feedback").style.display = "block";
			} else {
			    document.getElementById("feedback").style.display = "none";
			}
			vscode.postMessage({
				command: 'mode',
				text: strRunMode
			})
		  }
		  function startProblem(problemNumber) {
			document.getElementById("workarea").style.display = "block";
			document.getElementById("challengemap").style.display = "none";
			document.getElementById("chart_div").style.display = "none";
			vscode.postMessage({
				command: 'start',
				text: problemNumber
			})
		  }
		  function reset() {
			document.getElementById("challengemap").style.display = "block";
			document.getElementById("chart_div").style.display = "block";
			document.getElementById("workarea").style.display = "none";
			document.getElementById("output").innerHTML = " ";
			document.getElementById("feedback").innerHTML = " ";
			document.getElementById("feedback").style.display = "none";
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
				  document.getElementById("feedback").style.display = "block";
			  }
			  if (message.output) {
			      document.getElementById("output").innerHTML = message.output;
			  }
			  if (message.deltaoutput) {
				  let currentContent = document.getElementById("output").innerHTML;
				  document.getElementById("output").innerHTML = currentContent + message.deltaoutput;
 			  }
			  if (message.challengemap) {
				  document.getElementById("challengemap").innerHTML = message.challengemap;
			  }
			  if (message.challenge) {
				document.getElementById("challenge").innerHTML = message.challenge;
			  }
			  if (message.input) {
				document.getElementById("getsdiv").style.display = "block";
				document.getElementById("getsinput").focus();
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

		   // Challenge map uses Google OrgChart library
		   google.charts.load('current', {packages:["orgchart"]});
		   google.charts.setOnLoadCallback(drawChart);

		   function drawChart() {
			   var data = new google.visualization.DataTable();
			   data.addColumn('string', 'Name');
			   data.addColumn('string', 'Manager');
			   data.addColumn('string', 'ToolTip');
			   ${challengeRows}

			   var chart = new google.visualization.OrgChart(document.getElementById('chart_div'));

			   function selectHandler() {
				   var selectedItem = chart.getSelection()[0];
				   var selectedIndex = selectedItem.row;
				   var rowName = data.getFormattedValue(selectedIndex, 0);
				   startProblem(rowName.split('.')[0]);
			   }

			   // Listen for the 'select' event, and call my function selectHandler() when
			   // the user selects something on the chart.
			   google.visualization.events.addListener(chart, 'select', selectHandler);

			   // Draw the chart, setting the allowHtml option to true for the tooltips.
			   chart.draw(data, {'allowHtml':true, 'nodeClass':'examplenode', 'selectedNodeClass':'examplenode'});
		   }
 
		   drawChart();
	  </script>
  </body>
  </html>`;
  }


// this method is called when your extension is deactivated
function deactivate() {}

function getActualOutput(lines) {
	var actualOutputLines = []
	lines.forEach(element => {
		if (element.length > 0) {
			actualOutputLines.push(element);
		}
	});
	return actualOutputLines;
}

function parseOutput(strOutput) {
	let lines = strOutput.toString('utf8').split(/\r?\n/)
	var actualOutputLines = getActualOutput(lines);
	return actualOutputLines;
}

function determineFeedback(parsedOutput, expectedOutput) {
	//log_info("---------  Actual ------------");
	//log_info(parsedOutput);
	//log_info("--------- Expected -----------");
	//log_info(expectedOutput);
	//log_info("------------------------------");
	var actualCount = 0;
	var expectedOutputCount = 0;
	var done = false;
	var feedbackLines = [];
	var match = false;

	while (expectedOutputCount < expectedOutput.length && !done) {
		//log_info("Comparing lines " + actualCount + ", " + expectedOutputCount);
		let expectedLine = expectedOutput[expectedOutputCount].replace(/[\n\r]+/g, '');
		let actualLine = parsedOutput[actualCount];
		//log_info("[" + actualLine + "], [" + expectedLine + "]");
		let comparison = actualLine.indexOf(expectedLine);
		//log_info("Comparison value: " + comparison);
		actualCount = actualCount + 1;
		if (actualCount >= parsedOutput.length) {
			done = true;
		}
    	if (comparison == -1) {
			//log_info("Line " + actualCount + " is not a match.");
		} else {
			//log_info("Line " + actualCount + " has a match.");
			feedbackLines.push("Found text: <span style='color: #FF7F50;'>" + expectedLine + "</span>");
			expectedOutputCount = expectedOutputCount + 1;
		}
	}

	if (expectedOutputCount >= expectedOutput.length) {
		match = true;
	}
	while (expectedOutputCount < expectedOutput.length) {
		let expectedLine = expectedOutput[expectedOutputCount].replace(/[\n\r]+/g, '');
		feedbackLines.push("Did not find: <span style='color: #DE3163;'>" + expectedLine + "</span>");
		expectedOutputCount = expectedOutputCount + 1;
	}

	if (match) {
		return "Your program is correct!<br/>".concat(feedbackLines.join("<br/>"));
	}
    return "Looks like we didn't find the output we expected.<br/>".concat(feedbackLines.join("<br/>"));
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
