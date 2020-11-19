
const expandTilde = require('expand-tilde');

import * as vscode from 'vscode';
import { gql } from '@apollo/client';
import {
	client,
	getSites,
	startSite,
	stopSite,
} from './graphqlClient';


interface SiteData {
	id: string;
	name: string;
	path: string;
}


const createStartStopHandler = (config: {
	siteId: string,
	startMsg: string,
	finishSuccessMsg: string,
	finishFailMsg: string,
	action: (siteId: string) => Promise<SiteData>,
}) => async () => {
	vscode.window.showInformationMessage(`Attempting to start LocalWP site ${config.siteId}`,);

	const siteData = await config.action(config.siteId);
	
	let finishMessage = config.finishSuccessMsg;
	if (!siteData) {
		finishMessage = config.finishFailMsg;
	}

	vscode.window.showInformationMessage(finishMessage);
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

	console.log('LocalWP site found. Registering commands...');

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

	try {

		const res = await client.query({
			query: gql`
				query {
					getInstantReloadStatus($siteId: ID!) {
						getInstantReloadStatus(id: $siteId)
					}
				}
			`,
			variables: {
				siteId: currentSite.id,
			}
		});
		// .subscribeToMore({
		// 	document: gql` subscription instantReloadStatusChange {
 	// 			instantReloadStatusChange {
		// 			id
		// 			status
		// 		}
		// 	}`,
		// 	// variables:
		// 	// UpdateQuery:
		// });

		console.log(res);
	} catch(err) {
		console.error(err)
	}
}

// this method is called when your extension is deactivated
export function deactivate() {}
