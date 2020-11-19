const fs = require('fs');
const ws = require('ws');

import fetch from 'cross-fetch';
import { gql, split } from '@apollo/client';
import { ApolloClient, createHttpLink } from '@apollo/client/core';
import { getMainDefinition } from '@apollo/client/utilities';
import { WebSocketLink } from '@apollo/client/link/ws';
import { InMemoryCache } from '@apollo/client/cache';
import { setContext } from '@apollo/client/link/context';

type NextCB = (response: { data: any }) => void;

function readGraphQLConfig() {
	let config;
	try {
		let configString = fs.readFileSync(
			'/Users/mattehlinger/Library/Application Support/Local/graphql-connection-info.json',
			'utf8',
		);

		config = JSON.parse(configString);
	} catch(err) {
		// probably no file found, so blow on by for now
	}

	return config;
}

const {
	port,
	authToken,
	url,
	subscriptionUrl,
} = readGraphQLConfig();

const httpLink = createHttpLink({
	fetch,
	uri: url,
});

const wsLink = new WebSocketLink({
	uri: subscriptionUrl,
	options: {
		reconnect: true,
	 	connectionParams: {
			authToken: `Bearer ${authToken}`,
		},
	},
	webSocketImpl: ws,
  });

const authLink = setContext((_, { headers }) => {
	return {
		headers: {
			...headers,
			authorization: authToken ? `Bearer ${authToken}` : "",
		},
	};
 });

 const splitLink = split(
	 ({ query }) => {
		const definition = getMainDefinition(query);
		return (
			definition.kind === 'OperationDefinition' &&
			definition.operation === 'subscription'
		);
	 },
	 wsLink,
	 authLink.concat(httpLink),
 );

const client = new ApolloClient({
	link: splitLink,
	cache: new InMemoryCache(),
	defaultOptions: {
		watchQuery: {
			fetchPolicy: 'cache-and-network',
		}
	},
});

const queries = {
	getSites: gql`
		query getSites {
			sites {
				id
				name
				path
			}
		}	
	`,
};

const mutations = {
	startSite: gql`
		mutation startSite($siteId: ID!) {
			startSite(id: $siteId) {
				   id
				   name
				   path						
			}
		}
	`,
	stopSite: gql`
		mutation stopSite($siteId: ID!) {
			stopSite(id: $siteId) {
				id
				name
				status
			}
		}
	`,
};

const subscriptions = {
	instantReloadStatusChange: gql`
		 subscription instantReloadStatusChange($siteId: ID!){
			  instantReloadStatusChange(id: $siteId)
		 }
	`,
	instantReloadFileChange: gql`
		subscription instantReloadFileChange($siteId: ID!){
			instantReloadFileChanged(id: $siteId){
				file
		    	eventType
		    	timeChanged
		    	fileSize
		  	}
		}
	`,
};

export const getSites = async () => {
	const { data: { sites }} = await client.query({ query: queries.getSites });

	return sites;
};

export const startSite = async (siteId: string) => {
	try {
		const { data: startSite } = await client.mutate({
			mutation: mutations.startSite,
			variables: { siteId },
		});

		return startSite;
	} catch(err) {
		console.error(err);
	}
};

export const stopSite = async (siteId: string) => {
	try {
		const { data: { stopSite }} = await client.mutate({
			mutation: mutations.stopSite,
			variables: { siteId },
		});

		return stopSite;
	} catch(err) {
		console.error(err);
	}
};

export const subscribeToInstantReloadStatusChange = (siteId: string, next: NextCB) => {
	try {
		client.subscribe({
			query: subscriptions.instantReloadStatusChange,
			variables: { siteId },
		}).subscribe({
			next,
		});
	} catch(err) {
		console.error(err);
	}
};

export const subscribeToInstantReloadFileChange = (siteId: string, next: NextCB) => {
	try {
		client.subscribe({
			query: subscriptions.instantReloadFileChange,
			variables: { siteId },
		}).subscribe({
			next,
		});
	} catch(err) {
		console.error(err);
	}
};
