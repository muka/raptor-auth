var logger = require('../logger')
var api = require('../api')
const qp = require('../query-parser')

module.exports.router = (router) => {

    /**
     * @swagger
     * definitions:
     *   Client:
     *     type: object
     *     required:
     *       - clientId
     *       - clientSecret
     *       - enabled
     *     properties:
     *       clientId:
     *         type: string
     *       clientSecret:
     *         type: string
     *       enabled:
     *         type: boolean
     */
    router.get('/', function(req, res) {

        let p = qp.parse({
            params: req.query,
            queryFields: [ 'name', 'id', 'userId', 'enabled' ]
        })

        return api.Client.list(p.query, p.pager)
            .then((clients) => {
                logger.debug('Found %s clients', clients.length)
                res.json(clients)
            })
    })

    router.post('/', function(req, res) {
        const c = Object.assign({}, req.body, { userId: req.user.id })
        return api.Client.create(c)
            .then((client) => {
                logger.debug('Created client %s [id=%s]', client.name, client.id)
                res.json(client)
            })
    })

    router.put('/:clientId', function(req, res) {
        const c = Object.assign({}, req.body, { userId: req.user.id, id: req.params.clientId })
        return api.Client.update(c)
            .then((client) => {
                logger.debug('Updated client %s [id=%s]', client.name, client.uuid)
                res.json(client)
            })
    })

    router.delete('/:clientId', function(req, res) {
        return api.Client.delete({ id: req.params.clientId })
            .then(() => {
                logger.debug('Deleted client %s', req.params.clientId)
                res.status(202).send()
            })
    })

    router.get('/:clientId', function(req, res) {
        return api.Client.read({ id: req.params.clientId })
            .then((client) => {
                res.json(client)
            })
    })

}
