const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

async function getRuleset() {
    const { stdout } = await execFileAsync(
        '/usr/sbin/nft',
        ['list', 'ruleset'],
        { timeout: 5000 }
    );
    return stdout;
}
module.exports = { getRuleset };
