const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function randomString(length: number) {
    let result = "";
    for (let i = 0; i < length; i++) {
        result += charSet[Math.floor(Math.random() * charSet.length)];
    }
    return result;
}
