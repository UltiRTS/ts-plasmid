import { randomInt } from 'node:crypto';
import type { GameConf } from '../interfaces';

export class GameRoom {
  roomNotes = '';
  title = '';
  hoster = '';
  mapId = 0;
  ais: { [key: string]: { team: string } } = {};
  chickens: { [key: string]: { team: string } } = {};
  players: { [key: string]: { isSpec: boolean; team: string; hasmap: boolean } } = {};
  polls: { [key: string]: string[] } = {};
  id = 0;
  engineToken = '';
  password = '';
  isStarted = false;
  responsibleAutohost = '::ffff:127.0.0.1';
  autohostPort = 0;
  aiHosters: string[] = [];
  mod = 'mod.sdd';

  constructor(title?: string, hoster?: string, mapId?: number, ID?: number, password?: string, autohost?: string);
  constructor(title: string, hoster: string, mapId: number, ID: number, password: string, autohost: string) {
    this.hoster = hoster;
    this.aiHosters = [hoster];
    this.players[hoster] = { isSpec: false, team: 'A', hasmap: false };
    this.title = title;
    this.mapId = mapId;
    this.id = ID;
    this.password = password;
    this.engineToken = makeid(10);
    this.responsibleAutohost = autohost;
    this.autohostPort = 0;

    function makeid(length: number) {
      let result = '';
      const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const charactersLength = characters.length;
      for (let i = 0; i < length; i++)
        result += characters.charAt(Math.floor(Math.random() * charactersLength));

      return result;
    }
  }

  serialize() {
    return JSON.stringify(this);
  }

  static from(str: string) {
    try {
      return Object.assign(new GameRoom(), JSON.parse(str)) as GameRoom;
    }
    catch (e) {
      return null;
    }
  }

  empty() {
    return Object.keys(this.players).length === 0;
  }

  setRoomNotes(notes: string) {
    this.roomNotes = notes;
  }

  getRoomNotes() {
    return this.roomNotes;
  }

  setAIHoster(hosters: string[]) {
    this.aiHosters = hosters;
  }

  setPlayer(playerName: string, team: string) {
    if (this.players[playerName])
      this.players[playerName].team = team;
    else
      this.players[playerName] = { team, isSpec: false, hasmap: false };
  }

  hasMap(player: string) {
    this.players[player].hasmap = true;
  }

  ready() {
    let ready = true;
    for (const player in this.players)
      ready = ready && this.players[player].hasmap;

    return ready;
  }

  // return a list of players
  getPlayers() {
    return Object.keys(this.players);
  }

  removePlayer(playerName: string) {
    delete this.players[playerName];
    if (playerName === this.hoster && !this.empty()) {
      const players = Object.keys(this.players);
      this.hoster = players[randomInt(players.length)];
    }
  }

  setAI(aiName: string, team: string) {
    this.ais[aiName] = { team };
  }

  setChicken(chickenName: string, team: string) {
    this.chickens[chickenName] = { team };
  }

  checkStarted() {
    return this.isStarted;
  }

  removeAI(aiName: string) {
    delete this.ais[aiName];
  }

  removeChicken(chickenName: string) {
    delete this.chickens[chickenName];
  }

  setPlayerMapStatus(playerName: string, hasMap: boolean) {
    this.players[playerName].hasmap = hasMap;
  }

  getPlayerCount() {
    return Object.keys(this.players).length;
  }

  // set room title

  /**
   *
   * @param {String} roomName the name of the room
   */
  setRoomName(roomName: string) {
    this.title = roomName;
  }

  setMod(mod: string) {
    this.mod = mod;
  }

  setSpec(player: string) {
    if (this.players[player])
      this.players[player].isSpec = !this.players[player].isSpec;
  }

  getPort() {
    return this.id + 6000;
  }

  getTitle() {
    return this.title;
  }

  getID() {
    return this.id;
  }

  setResponsibleAutohost(ip: string) {
    this.responsibleAutohost = ip;
  }

  // get responsible autohost
  /**
   *
   * @return {int} id of the autohost in the config
   */
  getResponsibleAutohost() {
    return this.responsibleAutohost;
  }

  /**
   *
   * @param {String} playerName name of player
   * @param {String} actionName name of the poll
   */
  addPoll(playerName: string, actionName: string) {
    if (!(actionName in this.polls))
      this.polls[actionName] = [];

    if (!this.polls[actionName].includes(playerName))
      this.polls[actionName].push(playerName);
  }

  // remove all polls this user has made
  removePoll(playerName: string) {
    for (const poll in this.polls) {
      if (this.polls[poll].includes(playerName))
        this.polls[poll].splice(this.polls[poll].indexOf(playerName), 1);
    }
  }

  // get poll count
  /**
   * @return {int} number of polls
   * @param {String} actionName
   */
  getPollCount(actionName: string) {
    if (!this.polls.hasOwnProperty(actionName))
      return 0;

    return this.polls[actionName].length;
  }

  getPolls() {
    const returningPoll: { [key: string]: number } = {};
    for (const poll in this.polls)
      returningPoll[poll] = this.polls[poll].length;

    return returningPoll;
  }

  clearPoll(actionName: string) {
    if (actionName in this.polls)
      this.polls[actionName] = [];
  }

  setPasswd(passwd: string) {
    this.password = passwd;
  }

  getHoster() {
    return this.hoster;
  }

  getMap() {
    return this.mapId;
  }

  setMapId(mapId: number) {
    if (mapId === this.mapId)
      return;
    this.mapId = mapId;

    for (const player in this.players)
      this.players[player].hasmap = false;
  }

  configureToStop() {
    this.isStarted = false;
    this.polls = {};
  }

  configureToStart() {
    // this.isStarted=true;
    this.polls = {};

    const engineLaunchObj: GameConf = {
      id: this.id,
      title: this.title,
      mgr: this.responsibleAutohost,
      team: {},
      mapId: this.mapId,
      aiHosters: [],
    };
    engineLaunchObj.id = this.id;
    engineLaunchObj.title = this.title;
    engineLaunchObj.mgr = this.responsibleAutohost;
    engineLaunchObj.team = {};

    engineLaunchObj.mapId = this.mapId;
    engineLaunchObj.aiHosters = [];
    engineLaunchObj.mod = this.mod;

    const teamMapping: { [key: string]: number } = {};
    let teamCount = 0;

    // the below discoveres new letters and assign those with a number
    for (const player in this.players) {
      const team = this.players[player].team;
      if (!(team in teamMapping)) {
        teamMapping[team] = teamCount;
        teamCount++;
      }
    }

    for (const player in this.ais) {
      const team = this.ais[player].team;
      if (!(team in teamMapping)) {
        teamMapping[team] = teamCount;
        teamCount++;
      }
    }

    for (const player in this.chickens) {
      const team = this.chickens[player].team;
      if (!(team in teamMapping)) {
        teamMapping[team] = teamCount;
        teamCount++;
      }
    }

    let count = 0;
    // the below handles players including spectators
    for (const player in this.players) {
      const playerName = player;
      let team;
      if (this.players[player].isSpec)
        team = 0;
      else
        team = teamMapping[this.players[player].team];

      engineLaunchObj.team[playerName] = {
        index: count,
        isAI: false,
        isChicken: false,
        isSpectator: this.players[player].isSpec,
        team,
      };

      if (player in this.aiHosters)
        engineLaunchObj.aiHosters.push(count);

      count++;
    }
    // the below handles AI configs
    for (const AI in this.ais) {
      const AIName = AI;

      const AIId = AIName + count;
      engineLaunchObj.team[AIId] = {
        index: count,
        isAI: true,
        isChicken: false,
        isSpectator: false,
        team: teamMapping[this.ais[AI].team],
      };
      count++;
    }

    for (const chicken in this.chickens) {
      const chickenName = chicken;
      const chickenId = chickenName + count;
      engineLaunchObj.team[chickenId] = {
        index: count,
        isAI: false,
        isChicken: true,
        isSpectator: false,
        team: teamMapping[this.chickens[chicken].team],
      };
      count++;
    }

    return engineLaunchObj;
  }
}
