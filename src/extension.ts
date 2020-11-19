const path = require('path');
const expandTilde = require('expand-tilde');
import * as vscode from 'vscode';
import {
	getSites,
	startSite,
	stopSite,
	subscribeToInstantReloadStatusChange,
	subscribeToInstantReloadFileChange,
} from './graphqlClient';


interface SiteData {
	id: string;
	name: string;
	path: string;
}

const getSiteShellConfig = (siteId: string) => {
	const fileName = `${siteId}.sh`;
	const pathPieces = [process.env.HOME];

	switch(process.platform) {
		case 'darwin':
			pathPieces.push('Library', 'Application\ Support');
			break;
		case 'win32':
			pathPieces.push('Roaming');
			break;
		default:
			path.join('.config');
			break;
	}

	pathPieces.push('Local', 'ssh-entry', fileName);

	return path.join(...pathPieces);
};

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	const sites = await getSites();

	const currentSite = sites.find((site: SiteData) => {
		return expandTilde(site.path) === vscode.workspace.rootPath;
	});

	/**
	 * @todo if a site isn't found, this extension should not even launch
	 * 
	 * See the vscode activation events docs for more info
	 * https://code.visualstudio.com/api/references/activation-events
	 */
	if (!currentSite) {
		return;
	}


	/**
	 * Command to start a isite in Local
	 */
	let startSiteCmd = vscode.commands.registerCommand('localwp.startSite', async () => {
		vscode.window.showInformationMessage(`Attempting to start LocalWP site ${currentSite.id}`,);

		const siteData = await startSite(currentSite.id);
		
		let finishMessage = 'Site started';
		if (!siteData) {
			finishMessage = 'Site not started';
		}

		vscode.window.showInformationMessage(finishMessage);
	});

	context.subscriptions.push(startSiteCmd);

	/**
	 * Command to stop a site in Local
	 */
	let stopSiteCmd = vscode.commands.registerCommand('localwp.stopSite', async () => {
		vscode.window.showInformationMessage(`Attempting to stop LocalWP site ${currentSite.id}`);

		const siteData = await stopSite(currentSite.id);

		let finishMessage = 'Site stopped';
		if (!siteData) {
			finishMessage = 'Site not stopped';
		}

		vscode.window.showInformationMessage(finishMessage);
	});

	context.subscriptions.push(stopSiteCmd);

	const instantReloadChannel = vscode.window.createOutputChannel('LocalWP: Instant Reload');

	subscribeToInstantReloadStatusChange(currentSite.id, ({ data }) => {
		instantReloadChannel.appendLine(data.instantReloadStatusChange);
	});

	subscribeToInstantReloadFileChange(currentSite.id, ({ data }) => {
		const { file, eventType, timeChanged, fileSize } = data.instantReloadFileChanged;

		let verb = 'Changed';
		let size = `(${fileSize})`;

		if (['unlink', 'unlinkDir'].includes(eventType)) {
			verb = 'Deleted';
			size = '';
		} else if (['add', 'addDir'].includes(eventType)) {
			verb = 'Added';
		}

		instantReloadChannel.appendLine(`[${timeChanged}] - ${verb} - ${file} ${size}`);
	});

	/**
	 * Create a terminal and load in the site's shell config
	 */
	vscode.window.createTerminal(
		'LocalWP Site Shell',
		getSiteShellConfig(currentSite.id),
	);
}

// this method is called when your extension is deactivated
export function deactivate() {}
