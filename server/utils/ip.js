function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return (req.socket && req.socket.remoteAddress) || '';
}

function extractIpv4(ip) {
    if (!ip) return null;
    const mapped = ip.match(/::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
    if (mapped) return mapped[1];
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return ip;
    return null;
}

function getIpv4Prefix(ipv4) {
    if (!ipv4) return null;
    const parts = ipv4.split('.');
    if (parts.length < 2) return null;
    return `${parts[0]}.${parts[1]}`;
}

module.exports = { getClientIp, extractIpv4, getIpv4Prefix };
