const os = require('node:os');
const { execFile } = require('node:child_process');

function getInterfaceStatus() {
    return new Promise((resolve, reject) => {
        execFile(
            "ip",
            ["-j", "address", "show"],
            (error, stdout) => {
                if (error) {
                    return reject(error);
                }

                try {
                    const interfaces = JSON.parse(stdout);

                    resolve(
                        interfaces.map(item => ({
                            name: item.ifname,

                            ipv4: item.addr_info
                                .filter(ip => ip.family === "inet")
                                .map(ip => ip.local),
                            prefix: item.addr_info
                                .filter(ip => ip.family === "inet")
                                .map(ip => ip.prefixlen),
                            ipv6: item.addr_info
                                .filter(ip => ip.family === "inet6")
                                .map(ip => ip.local),

                            status: item.operstate.toLowerCase()
                        }))
                            .sort((a, b) =>
                                a.name.localeCompare(b.name)
                            )
                    );
                } catch (error) {
                    reject(error);
                }
            }
        );
    });
}


module.exports = getInterfaceStatus;
