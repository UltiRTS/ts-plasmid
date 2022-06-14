const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export const CMD_PARAMETERS = {
    'LOGIN': ['username', 'password'],
    'REGISTER': ['username', 'password'],
    'JOINCHAT': ['chatName', 'password'],
    'LEAVECHAT': ['chatName'],
    'SAYCHAT': ['chatName', 'message'],
    'JOINGAME': ['gameName', 'mapId', 'password'],
    'SETAI': ['gameName', 'AI', 'team', 'type'],
    'DELAI': ['gameName', 'AI', 'type'],
    'SETTEAM': ['gameName', 'player', 'team'],
    'SETMAP': ['gameName', 'mapId'],
    'STARTGAME': [],
}


export function randomString(length: number) {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += charSet[Math.floor(Math.random() * charSet.length)];
    }
    return result;
}

export function fullfillParameters(cmd: keyof typeof CMD_PARAMETERS, parameters: object) {
    if(!(cmd in CMD_PARAMETERS)) return false;

    const neededParams: string[] = CMD_PARAMETERS[cmd];
    for(const param of neededParams) {
        if(!(param in parameters)) return false;
    }

    return true;
}
