function workerAuth(req, res, next) {
    const token = req.headers['x-worker-token'] || req.query.token;
    const secret = process.env.WORKER_TOKEN || 'workerdevtoken';
    if (!token || token !== secret) return res.status(401).json({ error: 'Unauthorized' });
    next();
}

module.exports = workerAuth;
