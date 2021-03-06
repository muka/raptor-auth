module.exports.router = (router) => {

    const logger = require('../logger')
    const api = require('../api')
    const qp = require('../query-parser')
    const sdk = require('../raptor').client()

    router.get('/', function(req, res) {

        let queryFields = [ 'username', 'id', 'email', 'enabled' ]

        if(req.query.ownerId) {
            queryFields.push('ownerId')
        }

        let p = qp.parse({
            params: req.query,
            queryFields: queryFields
        })

        const q = {}
        const orQ = []

        if (p.query.id) {
            orQ.push({id: new RegExp(p.query.id, 'i')})
        }

        if (p.query.username) {
            orQ.push({username: new RegExp(p.query.username, 'i')})
        }

        if(p.query.email) {
            q.email = p.query.email
        }

        if (p.query.ownerId) {
            q.ownerId = p.query.ownerId
        }

        if (orQ.length > 0) {
            q['$or'] = orQ
        }

        return api.User.list(q, p.pager)
            .then((users) => {
                logger.debug('Found %s users', users.length)
                res.json(users)
            })
    })

    router.post('/', function(req, res) {

        const user = Object.assign({}, req.body)
        if(user.id !== undefined) {
            delete user.id
        }

        //TODO review permission for users
        if(!req.user.isAdmin()) {
            user.roles = []
        }

        return api.User.create(user)
            .then((user) => {
                logger.debug('Created user %s [id=%s]', user.username, user.id)
                res.json(user)
            })
    })

    router.put('/:userId', function(req, res) {

        const u = Object.assign({}, req.body, { id: req.params.userId })

        //TODO review permission for users
        // only `admin`, `admin_user` can promote an user to admin
        if (u.roles) {

            u.roles = u.roles
                .filter((role) => role !== 'service')

            // cannot change roles
            if(!req.user.isAdmin()) {
                delete u.roles
            }
        }

        return api.User.update(u)
            .then((user) => {
                logger.debug('Updated user %s [id=%s]', user.username, user.id)
                res.json(user)
            })
    })

    router.delete('/:userId', function(req, res) {
        return api.User.read({ id: req.params.userId })
            .then(() => api.User.delete({ id: req.params.userId })
                .then(() => {
                    res.status(202).send()
                    return sdk.App().search({users: [req.params.userId]})
                        .then((pager) => {
                            let uid = req.params.userId
                            let apps = pager.getContent()
                            apps.forEach((a) => {
                                logger.debug(uid)
                                logger.debug(a.id)
                                sdk.App().deleteUser(a.id, uid).then((ap) => {
                                    logger.debug('User also removed from app %s', ap.id)
                                })
                            })
                        })
                })
                .catch((e)=>{
                    logger.debug(e)    
                }))
    })

    router.get('/:userId/impersonate', function(req, res) {
        return api.User.read({ id: req.params.userId })
            .then((user) => {
                return api.Token.createLogin(user)
                    .then((t) => {
                        logger.debug('Impersonate %s', req.body.username)
                        res.json({
                            token: t.token,
                            expires: Math.round(t.expires / 1000),
                            user: user,
                        })
                    })
            })
    })

    router.get('/:userId', function(req, res) {
        return api.User.read({ id: req.params.userId })
            .then((user) => {
                res.json(user)
            })
    })

}
