import React, { Component, useCallback } from 'react';
import logo from './logo.svg';
import './App.css';

import { useState, useEffect, useRef } from 'react';
import { Button, Input, Label } from 'semantic-ui-react';
import 'semantic-ui-css/semantic.min.css';

/* This requires that the react app's config be "ejected" and set resolve.mainFields to
 * ['jsnext:main', 'browser', 'module', 'main']
 * This tells webpack to look for the jsnext:main entry point first and use the ES6 classes in the SDK
 */
import platformClient from 'purecloud-platform-client-v2';

const App = () => {
	const [gcallId, setgcallId] = useState([]);
	const [gparticipantId, setgparticipantId] = useState([]);
	const [gdnis, setgdnis] = useState([]);
	const [gani, setgani] = useState([]);
	const [gstate, setgstate] = useState([]);
	const [gpresence, setgpresence] = useState([]);
	const [gdirection, setgdirection] = useState([]);
	const [gmuted, setgmuted] = useState(false);
	const [gheld, setgheld] = useState(false);
	const [gconversationList, setgconversationList] = useState([{}]);

	const refinputnumber = useRef(null);
	const refparticipantnumber = useRef(null);
	const [unlessCond, setunlessCond] = useState(false);

	const [gisconnected, setgisconnected] = useState(false);
	const [muted, setmuted] = useState(false);
	const [held, setheld] = useState(false);
	const [isConsult, setisConsult] = useState(false);

	const [valinputnumber, setvalinputnumber] = useState('');
	const handleChange = (e) => setvalinputnumber(e.target.value);
	const [valparticipantnumber, setvalparticipantnumber] = useState('');
	const handleChange2 = (e) => setvalparticipantnumber(e.target.value);

	const localState = new Date().getTime();
	//console.log(`state=${localState}`);

	const clientId = 'd03eb90b-4753-4144-be08-da2890cfa679'; //ama_implicit トークンの暗黙的な付与（ブラウザー
	const redirectUri = window.location.href;
	const client = platformClient.ApiClient.instance;
	const conversationsApi = new platformClient.ConversationsApi();
	const notificationsApi = new platformClient.NotificationsApi();
	const usersApi = new platformClient.UsersApi();
	// Set Genesys Cloud settings
	client.setEnvironment('mypurecloud.jp');
	client.setPersistSettings(true, 'test_app');

	// Set local vars
	let CONVERSATION_LIST_TEMPLATE = null;
	let conversationList = {};
	let me,
		webSocket,
		conversationsTopic,
		stationTopic,
		presenceTopic,
		routingStatusTopic,
		notificationChannel;

	useEffect(() => {
		client
			.loginImplicitGrant(clientId, redirectUri, { state: localState })
			.then((res) => {
				console.log('Logged in');
				//console.log(res);
				//console.log(
				//	res.state === localState
				//		? 'State match'
				//		: `Different state: ${res.state}`
				//);

				// Get authenticated user's info
				return usersApi.getUsersMe();
			})
			.then((res) => {
				console.log('userMe: ', res);
				me = res;

				// Create notification channel
				return notificationsApi.postNotificationsChannels();
			})
			.then((channel) => {
				console.log('channel: ', channel);
				notificationChannel = channel;

				// Set up web socket
				webSocket = new WebSocket(notificationChannel.connectUri);
				webSocket.onmessage = handleNotification;

				// Subscribe to authenticated user's conversations
				conversationsTopic = 'v2.users.' + me.id + '.conversations';
				stationTopic = 'v2.users.' + me.id + '.station';
				presenceTopic = 'v2.users.' + me.id + '.presence';
				routingStatusTopic = 'v2.users.' + me.id + '.routingStatus';
				//const body2 = [{ id: conversationsTopic }];
				const body = [
					{ id: conversationsTopic },
					{ id: stationTopic },
					{ id: presenceTopic },
					{ id: routingStatusTopic },
				];
				return notificationsApi.putNotificationsChannelSubscriptions(
					notificationChannel.id,
					body
				);
			})
			.catch(function (response) {
				console.log(response);
			});
	}, []); // Only 1 time.

	useEffect(() => {
		console.debug('MainHeaderでuseEffect[unlessCond]が実行されました');
	}, [unlessCond]); // Update if authState changes

	useEffect(() => {
		console.debug('MainHeaderでuseEffect[gisconnected]が実行されました');
		//console.log(unlessCond);
		disconnect(gcallId, gparticipantId);
	}, [gisconnected]); // Update if authState changes

	useEffect(() => {
		console.debug('MainHeaderでuseEffect[muted]が実行されました');
		//console.log(muted);
		mute(gcallId, gparticipantId, gmuted);
	}, [muted]); // Update if authState changes

	useEffect(() => {
		console.debug('MainHeaderでuseEffect[held]が実行されました');
		//console.log(held);
		hold(gcallId, gparticipantId, gheld);
	}, [held]); // Update if authState changes

	useEffect(() => {
		console.debug('MainHeaderでuseEffect[isConsult]が実行されました');
		//console.log(isConsult);
		startConsult();
	}, [isConsult]); // Update if authState changes

	useEffect(() => {
		console.debug('MainHeaderでuseEffect[gconversationList]が実行されました');
		console.log(gconversationList);
	}, [gconversationList]); // Update if authState changes
	//===================================================================================
	// FROM GENESYS
	//===================================================================================
	// Handle Websocket Function
	function handleNotification(message) {
		// Parse notification string to a JSON object
		const notification = JSON.parse(message.data);

		switch (notification.topicName.toLowerCase()) {
			case 'channel.metadata':
				// Heartbeat  Discard unwanted notifications
				console.info('Ignoring metadata: ', notification);
				return;
			case conversationsTopic.toLowerCase():
				// Conversations
				console.debug('Conversation notification: ', notification);
				//--------------------
				// react state に　Copy
				//--------------------
				setgcallId(notification.eventBody.id);
				console.debug('gcallId:', notification.eventBody.id);
				setgparticipantId(notification.eventBody.participants[0].id);
				console.debug(
					'gparticipantId:',
					notification.eventBody.participants[0].id
				);
				setgheld(notification.eventBody.participants[0].calls[0].held);
				console.debug(
					'gheld:',
					notification.eventBody.participants[0].calls[0].held
				);
				setgmuted(notification.eventBody.participants[0].calls[0].muted);
				console.debug(
					'gmuted:',
					notification.eventBody.participants[0].calls[0].muted
				);
				// React へ　setState
				//setgdnis(notification.eventBody.participants[0].dnis);
				//setgani(notification.eventBody.participants[0].ani);
				setgstate(notification.eventBody.participants[0].calls[0].state);
				//setgdirection(notification.eventBody.participants[0].calls[0].direction);

				// See function description for explanation

				copyCallPropsToParticipant(notification.eventBody);

				// Update conversation in list or remove it if disconnected
				if (isConversationDisconnected(notification.eventBody)) {
					delete conversationList[notification.eventBody.id];
				} else {
					conversationList[notification.eventBody.id] = notification.eventBody;
					setgconversationList(notification.eventBody);
				}
				return;

			case routingStatusTopic.toLowerCase():
				// RoutingStatus
				console.debug('routingStatus notification: ', notification);
				return;
			case presenceTopic.toLowerCase():
				// RoutingStatus
				console.debug('presence notification: ', notification);
				setgpresence(notification.eventBody.presenceDefinition.systemPresence);
				return;
			default:
				// Unexpected topic
				console.warn('Unknown notification: ', notification);
				return;
		}
	}

	/* This function copies properties from the participant's call object in a notification to the
	 * participant object to make the participant object look the same as the response from the
	 * conversations APIs. This isn't strictly necessary, but is helpful to maintain a consistent structure.
	 */
	function copyCallPropsToParticipant(conversation) {
		conversation.participants.forEach((participant) => {
			if (!participant.calls || participant.calls.length === 0) return;

			participant.ani = participant.calls[0].self.addressNormalized;
			participant.attributes = participant.additionalProperties;
			participant.confined = participant.calls[0].confined;
			participant.direction = participant.calls[0].direction;
			participant.dnis = participant.calls[0].other.addressNormalized;
			participant.held = participant.calls[0].held;
			participant.muted = participant.calls[0].muted;
			participant.provider = participant.calls[0].provider;
			participant.recording = participant.calls[0].recording;
			participant.recordingState = participant.calls[0].recordingState;
			participant.state = participant.calls[0].state;

			if (participant.userId)
				participant.user = {
					id: participant.userId,
					selfUri: `/api/v2/users/${participant.userId}`,
				};
			if (participant.calls[0].peerId)
				participant.peer = participant.calls[0].peerId;
		});
	}

	// Determines if a conversation is disconnected by checking to see if all participants are disconnected
	function isConversationDisconnected(conversation) {
		let isConnected = false;
		conversation.participants.some((participant) => {
			if (participant.state !== 'disconnected') {
				isConnected = true;
				return true;
			}
		});

		return !isConnected;
	}

	// Mute participant
	function mute(callId, participantId, currentMuteState) {
		// Create request body, only set desired properties
		let body = {
			muted: !currentMuteState,
		};

		// Invoke API
		conversationsApi
			.patchConversationsCallParticipant(callId, participantId, body)
			.then(() => {
				// Result will be empty here
			})
			.catch((err) => console.error(err));
	}

	// Hold participant
	function hold(callId, participantId, currentHoldState) {
		// Create request body, only set desired properties
		let body = {
			held: !currentHoldState,
		};

		// Invoke API
		conversationsApi
			.patchConversationsCallParticipant(callId, participantId, body)
			.then(() => {
				// Result will be empty here
			})
			.catch((err) => console.error(err));
	}

	// Disconnect participant
	function disconnect(callId, participantId) {
		// Create request body, only set desired properties
		let body = {
			state: 'disconnected',
		};

		// Invoke API
		conversationsApi
			.patchConversationsCallParticipant(callId, participantId, body)
			.then(() => {
				// Result will be empty here
			})
			.catch((err) => console.error(err));
	}

	// Initiate a consult transfer
	function startConsult() {
		//console.debug(conversationList);
		console.debug(gconversationList);
		//let callId = conversationList[Object.keys(conversationList)[0]].id;
		//let callId = gconversationList.id;
		let callId = gcallId;
		// Grab the first participant, which should be the party we dialed for an outbound call
		//let participantId = conversationList[callId].participants[1].id;
		let participantId = gparticipantId;

		// Create request body
		let body = {
			speakTo: 'destination',
			destination: {
				//address: $('input#newparticipant').val(),
				address: valparticipantnumber,
			},
		};
		// Invoke API
		conversationsApi
			.postConversationsCallParticipantConsult(callId, participantId, body)
			.then(() => {
				//$('input#newparticipant').val('');
				// We can ignore the response in this tutorial.
			})
			.catch((err) => console.error(err));
	}

	// Change which parties in the consult transfer are speaking
	function consultSpeakTo(speakTo) {
		//let callId = conversationList[Object.keys(conversationList)[0]].id;
		let callId = gcallId;

		//grab the first participant, which should be the party we dialed for an outbound call
		//let participantId = conversationList[callId].participants[1].id;
		let participantId = gparticipantId;

		// Create request body
		let body = {
			speakTo: speakTo,
		};

		// Invoke API
		conversationsApi
			.patchConversationsCallParticipantConsult(callId, participantId, body)
			.then(() => {
				// We can ignore the response in this tutorial.
			})
			.catch((err) => console.error(err));
	}

	//======================================
	const MakeCall = () => {
		setgisconnected(true);
		refinputnumber.current.focus();
		// Create request body
		let body = {
			phoneNumber: valinputnumber,
		};

		// Invoke API
		console.log(body);
		conversationsApi
			.postConversationsCalls(body)
			.then(() => {})
			.catch((err) => console.error(err));
	};

	//-------------------------

	//-------------------------

	//-------------------------
	/*
	gdnis is {gdnis} / gani is {gani} / gstate is {gstate} / gdirection is{' '}
	{gdirection} /gisconnected is {gisconnected.toString()} / gcallId is{' '}
	{gcallId} / gparticipantId is {gparticipantId} / gmuted is{' '}
	{gmuted.toString()} / gheld is {gheld.toString()} / unlessCond :{' '}
	{unlessCond.toString()} / muted: {muted.toString()} / held:{' '}
	{held.toString()} / isConsult: {isConsult.toString()}
	*/
	//-------------------------

	return (
		<div className="ui grid">
			<div className="eight wide column">
				<div className="ui divided selection list">
					<a className="item">
						<div className="ui large green horizontal label">Info1 </div>
						{valinputnumber}
						{gstate.length !== 0 && (
							<div className="ui mini grey circular label">{gstate}</div>
						)}
					</a>
					<a className="item">
						<div className="ui large green horizontal label">Info2 </div>
						{valparticipantnumber}
						{gpresence.length !== 0 && (
							<div className="ui mini grey circular label">{gpresence}</div>
						)}
					</a>
					<a className="item">
						<Input
							type="text"
							id="dialstring"
							placeholder="3172222222"
							ref={refinputnumber}
							val={valinputnumber}
							onChange={handleChange}
						/>

						<Button inverted color="green" id="dial" onClick={() => MakeCall()}>
							Dial
						</Button>

						{gisconnected === true && (
							<div>
								{muted === false && (
									<Button inverted color="green" onClick={() => setmuted(true)}>
										Mute
									</Button>
								)}
								{muted === true && (
									<Button inverted color="blue" onClick={() => setmuted(false)}>
										unMute
									</Button>
								)}
								{held === false && (
									<Button inverted color="green" onClick={() => setheld(true)}>
										Hold
									</Button>
								)}
								{held === true && (
									<Button inverted color="blue" onClick={() => setheld(false)}>
										unHold
									</Button>
								)}

								<label htmlFor="newparticipant">転送</label>
								<Input
									type="text"
									id="newparticipant"
									placeholder="3172222222"
									ref={refparticipantnumber}
									val={valparticipantnumber}
									onChange={handleChange2}
								/>
								<Button
									inverted
									color="purple"
									id="Consult"
									onClick={() => setisConsult('on')}
								>
									Consult
								</Button>
								<Button
									inverted
									color="red"
									onClick={() => setgisconnected(false)}
								>
									Disconnect
								</Button>
								{isConsult === 'on' && (
									<div>
										<Button
											inverted
											color="purple"
											onClick="consultSpeakTo('BOTH')"
										>
											Speak to Both
										</Button>
										<Button
											inverted
											color="purple"
											onClick="consultSpeakTo('DESTINATION')"
										>
											Speak to Destination
										</Button>
										<Button
											inverted
											color="purple"
											onClick="consultSpeakTo('OBJECT')"
										>
											Speak to First Party
										</Button>
										<Button
											inverted
											color="purple"
											onClick={() => setisConsult('off')}
										>
											Consult off
										</Button>
									</div>
								)}
							</div>
						)}
					</a>
				</div>
			</div>
			<div className="two wide column"></div>
		</div>
	);
};

export default App;

/*
class App extends Component {
	constructor(props) {
		super(props);
		this.state = {};

		// Setup
		const client = platformClient.ApiClient.instance;
		const usersApi = new platformClient.UsersApi();
		client.setPersistSettings(true, 'custom_app');
		// client.setDebugLog(console.log, 25);
		const redirectUri = 'http://localhost:3000/';
		//const clientId = 'babbc081-0761-4f16-8f56-071aa402ebcb';
		const clientId = 'd03eb90b-4753-4144-be08-da2890cfa679'; //ama_implicit トークンの暗黙的な付与（ブラウザー
		const localState = new Date().getTime();
		console.log(`state=${localState}`);
		// Set Genesys Cloud settings
		client.setEnvironment('mypurecloud.jp');
		client.setPersistSettings(true, 'test_app');

		// Connect
		client
			.loginImplicitGrant(clientId, redirectUri, { state: localState })
			.then((res) => {
				console.log('logged in');
				console.log(res);
				console.log(
					res.state === localState
						? 'State match'
						: `Different state: ${res.state}`
				);

				// Get logged in user's info
				return usersApi.getUsersMe();
			})
			.then((res) => {
				this.setState({ name: res.name });
				console.log(res);
			})
			.catch((err) => {
				// Handle failure response
				console.log(err);
			});
	}

	render() {
		console.log(platformClient);
		return (
			<div className="App">
				<header className="App-header">
					<img src={logo} className="App-logo" alt="logo" />
					<h1 className="App-title">Welcome to React {this.state.name}</h1>
				</header>
				<p className="App-intro">
					To get started, edit <code>src/App.js</code> and save to reload.
				</p>
			</div>
		);
	}
}
*/
